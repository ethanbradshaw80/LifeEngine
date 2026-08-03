/**
 * Converting between a live World and a SaveFile.
 *
 * This module is PURE. It takes data and returns data; it never reads or
 * writes anything. IndexedDB access lives in `apps/web`, because the engine
 * and its persistence must run unchanged in a Web Worker and, later, on a
 * server (ADR-0003, ADR-0010).
 */

import { generateNations, relationshipKey, specById, toSnapshot } from '@life-engine/engine'
import type {
  Accounts,
  AwardRecord,
  CausalRecord,
  CriminalRecord,
  EducationRecord,
  EmploymentRecord,
  GeoRelation,
  HealthRecord,
  Deployment,
  Relationship,
  ServiceRecord,
  Household,
  Nation,
  Person,
  Place,
  PlayerState,
  Town,
  World,
  WorldEvent,
} from '@life-engine/engine'
import type { WorldSpec } from '@life-engine/engine'
import type { EntityId, Seed, Tick } from '@life-engine/shared'
import { checksumOf } from './encoding.js'
import { migrate } from './migrations.js'
import { LOCAL_USER_ID, SaveError, SCHEMA_VERSION } from './schema.js'
import type { SaveFile, SaveHeader } from './schema.js'
import {
  optionalString,
  requireField,
  requireInteger,
  requireObject,
  requireString,
  validateWorldBody,
} from './validate.js'

/**
 * Serialize a world.
 *
 * The world body is produced by the engine's own `toSnapshot`, so there is one
 * flattening implementation rather than two that can drift apart.
 */
export function toSaveFile(world: World, userId: string = LOCAL_USER_ID): SaveFile {
  const snapshot = toSnapshot(world)
  const body = snapshot.body

  const header: SaveHeader = {
    schemaVersion: SCHEMA_VERSION,
    simulationVersion: snapshot.header.simulationVersion,
    seed: world.seed,
    tick: world.tick,
    savedAtTick: world.tick,
    userId,
    presetId: world.presetId,
    checksum: checksumOf(body),
  }

  return { header, world: body }
}

export interface LoadResult {
  readonly world: World
  readonly header: SaveHeader
  /** Migration steps applied, oldest first. Empty when the save was current. */
  readonly migrationsApplied: readonly string[]
  /**
   * True when the save was written by a different simulation version.
   * Determinism is guaranteed WITHIN a version, not across one — results may
   * now diverge from the original run, and the player should be told rather
   * than left to discover it (docs/DETERMINISM.md §7).
   */
  readonly simulationVersionChanged: boolean
  /**
   * True when the save names a preset this build does not have. The world
   * loads on Classic content — better than refusing — but its future
   * newborn names, service ladders and foreign nations are then a DIFFERENT
   * preset's, which is exactly the intentional divergence DETERMINISM.md §7
   * says must be told rather than discovered.
   */
  readonly presetUnknown: boolean
}

/**
 * Load a save: migrate, verify, validate, hydrate.
 *
 * Throws SaveError rather than returning a partial world. A corrupt save that
 * loads halfway is worse than one that refuses — the player keeps a broken
 * game and does not know it.
 */
export function fromSaveFile(raw: unknown, currentSimulationVersion: number): LoadResult {
  const { save, applied } = migrate(raw)

  const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
  const worldValue = requireField(save, 'world', 'save')

  const expected = requireString(header, 'checksum', 'save.header')
  const actual = checksumOf(worldValue)
  if (expected !== actual) {
    throw new SaveError(
      `This save appears to be damaged and was not loaded (checksum ${actual}, expected ${expected}). Your previous save has not been overwritten.`,
      'checksum-mismatch',
    )
  }

  const body = validateWorldBody(worldValue)
  const simulationVersion = requireInteger(header, 'simulationVersion', 'save.header')

  // A save from before W1 has no preset; every one of them is Classic.
  const presetId = optionalString(header, 'presetId') ?? 'classic'

  const world = hydrate(body, {
    seed: requireInteger(header, 'seed', 'save.header') as Seed,
    tick: requireInteger(header, 'tick', 'save.header') as Tick,
    // An unknown preset id resolves to Classic rather than throwing: a world
    // that loads beats a worker that dies (resistance 2). The id itself is
    // carried through UNRESOLVED so re-saving cannot rewrite the world's
    // identity as 'classic' (persistence review).
    spec: specById(presetId),
    presetId,
  })

  return {
    world,
    header: {
      schemaVersion: SCHEMA_VERSION,
      simulationVersion,
      seed: world.seed,
      tick: world.tick,
      savedAtTick: requireInteger(header, 'savedAtTick', 'save.header') as Tick,
      userId: requireString(header, 'userId', 'save.header'),
      presetId,
      checksum: actual,
    },
    migrationsApplied: applied,
    simulationVersionChanged: simulationVersion !== currentSimulationVersion,
    presetUnknown: presetId !== world.spec.id,
  }
}

/**
 * Rebuild the live World from validated plain data.
 *
 * The arrays become Maps keyed the way the engine expects. Friendships are
 * re-keyed with `friendshipKey` rather than trusting a stored key, so a save
 * cannot introduce an inconsistent pair ordering.
 *
 * Element shapes are trusted at this point: `validateWorldBody` has confirmed
 * the arrays exist, and the checksum has confirmed the bytes are intact. A
 * per-element schema check would be the next hardening step if saves ever
 * arrive from somewhere less trusted than the player's own browser — which is
 * exactly what Milestone 6 introduces.
 */
function hydrate(
  body: Record<string, unknown>,
  meta: { seed: Seed; tick: Tick; spec: WorldSpec; presetId: string },
): World {
  const places = new Map<EntityId, Place>()
  for (const place of body['places'] as Place[]) places.set(place.id, place)

  const people = new Map<EntityId, Person>()
  for (const person of body['people'] as Person[]) people.set(person.id, person)

  const households = new Map<EntityId, Household>()
  for (const household of body['households'] as Household[]) households.set(household.id, household)

  const accounts = new Map<EntityId, Accounts>()
  for (const record of (body['accounts'] as Accounts[] | undefined) ?? []) {
    accounts.set(record.personId, record)
  }

  const education = new Map<EntityId, EducationRecord>()
  for (const record of body['education'] as EducationRecord[]) education.set(record.personId, record)

  const employment = new Map<EntityId, EmploymentRecord>()
  for (const record of body['employment'] as EmploymentRecord[]) {
    employment.set(record.personId, record)
  }

  const health = new Map<import('@life-engine/shared').EntityId, HealthRecord>()
  for (const record of (body['health'] as HealthRecord[] | undefined) ?? []) {
    health.set(record.personId, record)
  }

  const service = new Map<import('@life-engine/shared').EntityId, ServiceRecord>()
  for (const record of (body['service'] as ServiceRecord[] | undefined) ?? []) {
    service.set(record.personId, record)
  }

  const deployments = new Map<import('@life-engine/shared').EntityId, Deployment[]>()
  for (const entry of (body['deployments'] as { personId: number; tours: Deployment[] }[] | undefined) ?? []) {
    deployments.set(entry.personId as never, entry.tours)
  }

  const awards = new Map<import('@life-engine/shared').EntityId, AwardRecord[]>()
  for (const entry of (body['awards'] as { personId: number; decorations: AwardRecord[] }[] | undefined) ?? []) {
    awards.set(entry.personId as never, entry.decorations)
  }

  const criminal = new Map<import('@life-engine/shared').EntityId, CriminalRecord>()
  for (const record of (body['criminal'] as CriminalRecord[] | undefined) ?? []) {
    criminal.set(record.personId, record)
  }

  const relationships = new Map<string, Relationship>()
  for (const relationship of body['relationships'] as Relationship[]) {
    relationships.set(relationshipKey(relationship.a, relationship.b), relationship)
  }

  const nations = new Map<import('@life-engine/shared').EntityId, Nation>()
  for (const nation of (body['nations'] as Nation[] | undefined) ?? []) {
    nations.set(nation.id, nation)
  }
  const geoRelations = new Map<string, GeoRelation>()
  for (const relation of (body['geoRelations'] as GeoRelation[] | undefined) ?? []) {
    geoRelations.set(relation.a < relation.b ? `${relation.a}:${relation.b}` : `${relation.b}:${relation.a}`, relation)
  }

  const world: World = {
    seed: meta.seed,
    tick: meta.tick,
    spec: meta.spec,
    presetId: meta.presetId,
    nextEntityId: body['nextEntityId'] as number,
    nextEventId: body['nextEventId'] as number,
    nextCausalRecordId: body['nextCausalRecordId'] as number,
    town: body['town'] as Town,
    places,
    people,
    households,
    accounts,
    economy: body['economy'] as World['economy'],
    sectorPrices: body['sectorPrices'] as World['sectorPrices'],
    education,
    employment,
    relationships,
    events: body['events'] as WorldEvent[],
    causalRecords: body['causalRecords'] as CausalRecord[],
    player: body['player'] as PlayerState,
    health,
    service,
    awards,
    criminal,
    deployments,
    nations,
    geoRelations,
  }

  // A v6-or-older save was migrated with empty collections: generate the
  // wider world now, deterministically from the save's own seed. The town's
  // history is untouched; the news simply starts today.
  if (world.nations.size === 0) {
    generateNations(world)
  }

  return world
}
