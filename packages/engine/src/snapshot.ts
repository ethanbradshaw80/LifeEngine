/**
 * Serializable world state, and a state hash for determinism testing.
 *
 * Milestone 1 does NOT include save/load — that is Milestone 4. What is
 * required here is that world state CAN be serialized, because it must cross a
 * Web Worker boundary later and because the determinism tests need a stable
 * fingerprint of the whole world.
 *
 * The header carries schemaVersion, simulationVersion, seed, and userId from
 * the very first snapshot ever produced (ADR-0010). userId is "local" until
 * accounts exist at Milestone 6. It costs nothing now and avoids a migration
 * across every existing save later.
 */

import type { Seed, Tick } from '@life-engine/shared'
import type { World } from './types.js'

export const SCHEMA_VERSION = 1
/**
 * Simulation behaviour version.
 *
 * v1 — Milestone 1. Placeholder friendships; partnership was an accident of
 *      shared housing.
 * v2 — Milestone 5. The relationships domain: compatibility-driven friendship,
 *      courtship, marriage, divorce and widowhood, and births that require an
 *      actual partnership. Results differ from v1 for every seed, which is what
 *      a version bump is for (docs/DETERMINISM.md §7).
 */
export const SIMULATION_VERSION = 2

/** Placeholder until accounts arrive at Milestone 6. */
export const LOCAL_USER_ID = 'local'

export interface SnapshotHeader {
  readonly schemaVersion: number
  readonly simulationVersion: number
  readonly seed: Seed
  readonly tick: Tick
  readonly userId: string
}

export interface WorldSnapshot {
  readonly header: SnapshotHeader
  readonly body: unknown
}

/**
 * Convert to plain JSON-safe data. Maps become sorted arrays of entries —
 * sorted, not insertion-ordered, so that two worlds with identical content
 * always serialize identically regardless of the order things were created.
 */
export function toSnapshot(world: World): WorldSnapshot {
  return {
    header: {
      schemaVersion: SCHEMA_VERSION,
      simulationVersion: SIMULATION_VERSION,
      seed: world.seed,
      tick: world.tick,
      userId: LOCAL_USER_ID,
    },
    body: {
      nextEntityId: world.nextEntityId,
      nextEventId: world.nextEventId,
      nextCausalRecordId: world.nextCausalRecordId,
      town: world.town,
      places: [...world.places.values()].sort((a, b) => a.id - b.id),
      people: [...world.people.values()].sort((a, b) => a.id - b.id),
      households: [...world.households.values()].sort((a, b) => a.id - b.id),
      education: [...world.education.values()].sort((a, b) => a.personId - b.personId),
      employment: [...world.employment.values()].sort((a, b) => a.personId - b.personId),
      relationships: [...world.relationships.values()].sort((a, b) => a.a - b.a || a.b - b.b),
      events: world.events,
      causalRecords: world.causalRecords,
    },
  }
}

/**
 * Deterministic JSON with object keys sorted.
 *
 * JSON.stringify follows insertion order, so two structurally identical
 * objects built in different orders would stringify differently and produce
 * different hashes. Sorting keys removes that.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

export function serialize(world: World): string {
  return canonical(toSnapshot(world))
}

/**
 * A 32-bit fingerprint of the entire world. Two runs of the same seed must
 * produce the same hash at every tick; if they diverge, bisect by tick to find
 * where (docs/DETERMINISM.md §10).
 *
 * FNV-1a, inlined. This is called once per tick by the determinism tests over a
 * serialized world that reaches megabytes, so the per-character cost matters:
 * an earlier version called a helper with rest-arguments per character and made
 * the test suite take minutes instead of seconds. Not a cryptographic hash —
 * it only needs to detect change, which it does well.
 */
export function worldHash(world: World): number {
  const text = serialize(world)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Hex form, for committing golden values and reading in logs. */
export function worldHashHex(world: World): string {
  return worldHash(world).toString(16).padStart(8, '0')
}
