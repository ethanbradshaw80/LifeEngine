/**
 * Converting between a live World and a SaveFile.
 *
 * This module is PURE. It takes data and returns data; it never reads or
 * writes anything. IndexedDB access lives in `apps/web`, because the engine
 * and its persistence must run unchanged in a Web Worker and, later, on a
 * server (ADR-0003, ADR-0010).
 */

import { relationshipKey, toSnapshot } from '@life-engine/engine'
import type {
  CausalRecord,
  EducationRecord,
  EmploymentRecord,
  Relationship,
  Household,
  Person,
  Place,
  PlayerState,
  Town,
  World,
  WorldEvent,
} from '@life-engine/engine'
import type { EntityId, Seed, Tick } from '@life-engine/shared'
import { checksumOf } from './encoding.js'
import { migrate } from './migrations.js'
import { LOCAL_USER_ID, SaveError, SCHEMA_VERSION } from './schema.js'
import type { SaveFile, SaveHeader } from './schema.js'
import { requireField, requireInteger, requireObject, requireString, validateWorldBody } from './validate.js'

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

  const world = hydrate(body, {
    seed: requireInteger(header, 'seed', 'save.header') as Seed,
    tick: requireInteger(header, 'tick', 'save.header') as Tick,
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
      checksum: actual,
    },
    migrationsApplied: applied,
    simulationVersionChanged: simulationVersion !== currentSimulationVersion,
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
function hydrate(body: Record<string, unknown>, meta: { seed: Seed; tick: Tick }): World {
  const places = new Map<EntityId, Place>()
  for (const place of body['places'] as Place[]) places.set(place.id, place)

  const people = new Map<EntityId, Person>()
  for (const person of body['people'] as Person[]) people.set(person.id, person)

  const households = new Map<EntityId, Household>()
  for (const household of body['households'] as Household[]) households.set(household.id, household)

  const education = new Map<EntityId, EducationRecord>()
  for (const record of body['education'] as EducationRecord[]) education.set(record.personId, record)

  const employment = new Map<EntityId, EmploymentRecord>()
  for (const record of body['employment'] as EmploymentRecord[]) {
    employment.set(record.personId, record)
  }

  const relationships = new Map<string, Relationship>()
  for (const relationship of body['relationships'] as Relationship[]) {
    relationships.set(relationshipKey(relationship.a, relationship.b), relationship)
  }

  return {
    seed: meta.seed,
    tick: meta.tick,
    nextEntityId: body['nextEntityId'] as number,
    nextEventId: body['nextEventId'] as number,
    nextCausalRecordId: body['nextCausalRecordId'] as number,
    town: body['town'] as Town,
    places,
    people,
    households,
    education,
    employment,
    relationships,
    events: body['events'] as WorldEvent[],
    causalRecords: body['causalRecords'] as CausalRecord[],
    player: body['player'] as PlayerState,
  }
}
