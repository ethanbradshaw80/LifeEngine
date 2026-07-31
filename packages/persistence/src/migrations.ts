/**
 * Save migrations.
 *
 * Rules (docs/DETERMINISM.md §7, ADR-0004):
 *
 * - Migrations apply IN SEQUENCE. A v1 save becomes v2, then v3, never v1→v3
 *   directly. One step per version keeps each one small and testable.
 * - A migration NEVER silently drops a field. If data cannot be carried
 *   forward, that is a deliberate decision to state in the migration's comment.
 * - Every migration is tested against a REAL old save committed to the
 *   repository, not a hand-written fixture that happens to match today's
 *   assumptions.
 * - Loading a save older than the current version is normal. Loading one from
 *   the FUTURE is not — refuse rather than guess.
 */

import { checksumOf } from './encoding.js'
import { MIN_SUPPORTED_SCHEMA_VERSION, SaveError, SCHEMA_VERSION } from './schema.js'
import { requireField, requireInteger, requireObject, requireString } from './validate.js'

interface Migration {
  readonly from: number
  readonly to: number
  readonly describe: string
  readonly apply: (save: Record<string, unknown>) => Record<string, unknown>
}

/**
 * v1 → v2 (Milestone 4).
 *
 * v1 was `{ header: { schemaVersion, simulationVersion, seed, tick, userId },
 * body: {...} }` with no integrity check.
 *
 * v2 renames `body` to `world`, and adds `checksum` and `savedAtTick` to the
 * header. The checksum is COMPUTED here rather than invented: a v1 save was
 * never checksummed, so the correct behaviour is to compute one over the data
 * as loaded and carry it forward. Nothing is dropped.
 */
const V1_TO_V2: Migration = {
  from: 1,
  to: 2,
  describe: 'rename body → world; add checksum and savedAtTick',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const body = requireField(save, 'body', 'save')

    const tick = requireInteger(header, 'tick', 'save.header')

    return {
      header: {
        schemaVersion: 2,
        simulationVersion: requireInteger(header, 'simulationVersion', 'save.header'),
        seed: requireInteger(header, 'seed', 'save.header'),
        tick,
        savedAtTick: tick,
        userId: requireString(header, 'userId', 'save.header'),
        checksum: checksumOf(body),
      },
      world: body,
    }
  },
}

/**
 * v2 → v3 (Milestone 5).
 *
 * The relationships domain replaced the placeholder friendship model. Every
 * stored friendship becomes a typed edge.
 *
 * Every old friendship becomes `type: 'friend'` — the only honest choice. A v2
 * save recorded no relationship type, so claiming any of these people were
 * married would be inventing history the simulation never observed. Some of
 * them would have gone on to marry, and after this migration they still can:
 * the courtship system will pick them up from their existing strength.
 *
 * `typeSinceTick` is set to the original `formedAtTick`, which is true — the
 * friendship began then and has been a friendship ever since.
 */
const V2_TO_V3: Migration = {
  from: 2,
  to: 3,
  describe: 'friendships → typed relationships',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')

    const oldFriendships = Array.isArray(world['friendships']) ? world['friendships'] : []
    const relationships = oldFriendships.map((entry) => {
      const friendship = requireObject(entry, 'save.world.friendships[]')
      const formedAtTick = requireInteger(friendship, 'formedAtTick', 'friendship')
      return {
        a: requireInteger(friendship, 'a', 'friendship'),
        b: requireInteger(friendship, 'b', 'friendship'),
        type: 'friend',
        strength: requireInteger(friendship, 'strength', 'friendship'),
        formedAtTick,
        typeSinceTick: formedAtTick,
        endedAtTick: null,
      }
    })

    const nextWorld: Record<string, unknown> = { ...world, relationships }
    delete nextWorld['friendships']

    return {
      header: { ...header, schemaVersion: 3, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v3 → v4 (M-PLAY).
 *
 * Adds `world.player`. A v3 save was a pure simulation — nobody was being
 * played — so the honest default is exactly that: no player, no pending
 * decision, an empty choice log. Nothing is dropped.
 */
const V3_TO_V4: Migration = {
  from: 3,
  to: 4,
  describe: 'add player state (nobody played, empty choice log)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')

    const nextWorld: Record<string, unknown> = {
      ...world,
      player: { personId: null, pending: null, log: [], nextDecisionId: 1 },
    }

    return {
      header: { ...header, schemaVersion: 4, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v4 → v5 (M-MONEY).
 *
 * Households gain `savings`. The stored world never tracked money, so any
 * default is an assumption — this one is stated and computed from the save's
 * OWN data: four months of the household's wages, summed from its members'
 * employment records. A household of earners resumes comfortable; a household
 * of none resumes with a small cushion rather than instant arrears, because
 * punishing a player for our schema change would be absurd.
 */
const V4_TO_V5: Migration = {
  from: 4,
  to: 5,
  describe: 'add household savings (four months of own wages)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')

    const payByPerson = new Map<number, number>()
    const employment = Array.isArray(world['employment']) ? world['employment'] : []
    for (const entry of employment) {
      const record = requireObject(entry, 'save.world.employment[]')
      payByPerson.set(
        requireInteger(record, 'personId', 'employment'),
        requireInteger(record, 'monthlyPay', 'employment'),
      )
    }

    const MONTHS_OF_CUSHION = 4
    const NO_EARNER_CUSHION_CENTS = 60_000 // $600

    const households = Array.isArray(world['households']) ? world['households'] : []
    const migrated = households.map((entry) => {
      const household = requireObject(entry, 'save.world.households[]')
      const memberIds = Array.isArray(household['memberIds']) ? (household['memberIds'] as number[]) : []
      let income = 0
      for (const memberId of memberIds) income += payByPerson.get(memberId) ?? 0
      const savings = income > 0 ? income * MONTHS_OF_CUSHION : NO_EARNER_CUSHION_CENTS
      return { ...household, savings }
    })

    const nextWorld: Record<string, unknown> = { ...world, households: migrated }

    return {
      header: { ...header, schemaVersion: 5, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v5 → v6 (M-LEGACY).
 *
 * The player state gains `lineage`. An old save has lived no completed lives
 * that were recorded, so the honest default is empty — history that was not
 * written down is not reconstructed (Law 3 applies to metadata too).
 */
const V5_TO_V6: Migration = {
  from: 5,
  to: 6,
  describe: 'add player lineage (empty — unrecorded history stays unrecorded)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const player = requireObject(requireField(world, 'player', 'save.world'), 'save.world.player')

    const nextWorld: Record<string, unknown> = {
      ...world,
      player: { ...player, lineage: [] },
    }

    return {
      header: { ...header, schemaVersion: 6, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v6 → v7 (L4-M1).
 *
 * The world gains nations and geo-relations. An old save's wider world is
 * generated deterministically from its own seed at LOAD time (the same
 * generation a fresh world runs at tick 0) — the honest framing is that the
 * news simply starts now. Migration adds EMPTY collections; hydration-side
 * code fills them if empty, because generation needs the live World shape,
 * not raw JSON.
 */
const V6_TO_V7: Migration = {
  from: 6,
  to: 7,
  describe: 'add nations and geoRelations (generated from seed on load)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld: Record<string, unknown> = { ...world, nations: [], geoRelations: [] }
    return {
      header: { ...header, schemaVersion: 7, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v7 → v8 (L4-M2).
 *
 * Every person gains a health record. An old save recorded no ailments and
 * no disabilities, so everyone arrives WELL AND UNMARKED — including people
 * whose recorded history contains surviving nothing worse than time. That is
 * the honest default: history that was not written down is not invented.
 */
const V7_TO_V8: Migration = {
  from: 7,
  to: 8,
  describe: 'add health records (everyone well and unmarked)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const people = Array.isArray(world['people']) ? world['people'] : []

    const health = people.map((entry) => {
      const person = requireObject(entry, 'save.world.people[]')
      return {
        personId: requireInteger(person, 'id', 'person'),
        ailment: null,
        severity: 0,
        peakSeverity: 0,
        sinceTick: null,
        askedConvalesce: false,
        disability: 0,
      }
    })

    const nextWorld: Record<string, unknown> = { ...world, health }
    return {
      header: { ...header, schemaVersion: 8, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v8 → v9 (L4-M3). The world gains service records — empty for old saves:
 * nobody's service was recorded because nobody could serve. Unrecorded
 * history stays unrecorded.
 */
const V8_TO_V9: Migration = {
  from: 8,
  to: 9,
  describe: 'add service records (empty — no service predates the service)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld: Record<string, unknown> = { ...world, service: [] }
    return {
      header: { ...header, schemaVersion: 9, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v9 → v10 (L4-M4). Deployment histories; empty for old saves. */
const V9_TO_V10: Migration = {
  from: 9,
  to: 10,
  describe: 'add deployment histories (empty)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld: Record<string, unknown> = { ...world, deployments: [] }
    return {
      header: { ...header, schemaVersion: 10, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

const MIGRATIONS: readonly Migration[] = [V1_TO_V2, V2_TO_V3, V3_TO_V4, V4_TO_V5, V5_TO_V6, V6_TO_V7, V7_TO_V8, V8_TO_V9, V9_TO_V10]

/** Read the schema version from an unvalidated save, or fail clearly. */
export function readSchemaVersion(save: unknown): number {
  const root = requireObject(save, 'save')
  const header = requireObject(requireField(root, 'header', 'save'), 'save.header')
  return requireInteger(header, 'schemaVersion', 'save.header')
}

export interface MigrationResult {
  readonly save: Record<string, unknown>
  /** Human-readable steps applied, oldest first. Empty if already current. */
  readonly applied: readonly string[]
  readonly fromVersion: number
}

/**
 * Bring a save up to the current schema, applying each step in order.
 *
 * Throws rather than guessing when the save is too old to support or newer
 * than this build understands. A save from the future usually means the player
 * opened an old tab, and loading it partially would corrupt real progress.
 */
export function migrate(save: unknown): MigrationResult {
  const fromVersion = readSchemaVersion(save)

  if (fromVersion > SCHEMA_VERSION) {
    throw new SaveError(
      `This save was written by a newer version of the game (schema ${fromVersion}; this build understands ${SCHEMA_VERSION}). Update the game to open it.`,
      'from-the-future',
    )
  }

  if (fromVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    throw new SaveError(
      `This save is too old to open (schema ${fromVersion}; the oldest supported is ${MIN_SUPPORTED_SCHEMA_VERSION}).`,
      'too-old',
    )
  }

  let current = requireObject(save, 'save')
  const applied: string[] = []
  let version = fromVersion

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version)
    if (!step) {
      throw new SaveError(
        `No migration from schema ${version} to ${version + 1}. This is a bug: a version was added without its migration.`,
        'migration-failed',
      )
    }
    current = step.apply(current)
    applied.push(`v${step.from} → v${step.to}: ${step.describe}`)
    version = step.to
  }

  return { save: current, applied, fromVersion }
}
