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
import { requireArray, requireField, requireInteger, requireObject, requireString } from './validate.js'

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

/** v10 → v11 (M-WOUNDS). Named harm: kinds, sites, marks-in-words. Old
 *  ailments keep null kinds — the record never said what they were. */
const V10_TO_V11: Migration = {
  from: 10,
  to: 11,
  describe: 'add ailment kinds, sites and marks (existing ailments unnamed)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const health = Array.isArray(world['health']) ? world['health'] : []
    const migrated = health.map((entry) => {
      const record = requireObject(entry, 'save.world.health[]')
      return { ...record, ailmentKind: null, ailmentSite: null, marks: [] }
    })
    const nextWorld: Record<string, unknown> = { ...world, health: migrated }
    return {
      header: { ...header, schemaVersion: 11, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v11 → v12 (M-GAMEDEPTH). Nations gain war exhaustion. The old sim never
 *  tracked it, so every migrated nation arrives rested — null, not invented. */
const V11_TO_V12: Migration = {
  from: 11,
  to: 12,
  describe: 'add nation war exhaustion (none recorded)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nations = Array.isArray(world['nations']) ? world['nations'] : []
    const migrated = nations.map((entry) => {
      const nation = requireObject(entry, 'save.world.nations[]')
      return { ...nation, exhaustedUntilTick: null }
    })
    const nextWorld: Record<string, unknown> = { ...world, nations: migrated }
    return {
      header: { ...header, schemaVersion: 12, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v12 → v13 (M-GAMEDEPTH, military realism).
 *
 * Service records move from the old six-step shared ladder onto per-branch
 * US-style ladders. Old rank indexes are remapped by rough grade equivalence
 * so nobody is demoted or jumped by the migration. The time-in-grade clock
 * (`rankSinceTick`) starts at the save's own tick — when they actually made
 * rank was never recorded, and unrecorded history is not invented.
 * `qualifications` start empty for the same reason.
 */
const V12_TO_V13: Migration = {
  from: 12,
  to: 13,
  describe: 'move service ranks onto branch ladders (time-in-grade starts now)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const tick = requireInteger(header, 'tick', 'save.header')
    const service = Array.isArray(world['service']) ? world['service'] : []

    // Mapped by PAY GRADE equivalence so nobody is demoted or bumped a
    // grade: old corporal was E-4, so it lands on PO3/SrA (E-4), not on
    // PO2/SSgt (E-5). Two old ranks may share a landing spot; that is the
    // honest cost of moving between ladders of different lengths.
    const remap: Record<string, readonly number[]> = {
      'land-forces': [0, 2, 3, 4, 5, 8],
      'naval-service': [0, 2, 3, 3, 4, 6],
      'air-guard': [0, 2, 3, 3, 4, 6],
    }

    const migrated = service.map((entry) => {
      const record = requireObject(entry, 'save.world.service[]')
      const branch = typeof record['branch'] === 'string' ? record['branch'] : 'land-forces'
      const oldRank = typeof record['rank'] === 'number' ? record['rank'] : 0
      const ladder = remap[branch] ?? remap['land-forces'] ?? [0]
      const rank = ladder[Math.max(0, Math.min(ladder.length - 1, oldRank))] ?? 0
      return { ...record, rank, rankSinceTick: tick, qualifications: [] }
    })

    const nextWorld: Record<string, unknown> = { ...world, service: migrated }
    return {
      header: { ...header, schemaVersion: 13, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v13 → v14 (L4-M5). Awards and veterans arrive.
 *
 * - `world.awards`: EMPTY. Causal records are written when the moment
 *   happens, never reconstructed (rule 4); a medal issued retroactively by
 *   a migration would be exactly that. The Republic starts decorating now.
 * - Health records gain wound provenance (`ailmentServiceConnected`: false —
 *   whatever ails them now was never stamped) and the pension's ledger
 *   (`serviceDisability`: 0 — attribution that was never recorded is not
 *   invented, so old wounds pay no pension; new ones will).
 * - Service records gain `termPerformanceSum`, ESTIMATED as current
 *   performance × months served this term — computed from the save's own
 *   recorded fields (the v5 wage-migration precedent), not invented.
 * - The nation called 'Ashkelon' — a real city, caught by review before it
 *   could be minted onto campaign medals — is renamed to the fictional
 *   'Veskarn'. The name is display content; recorded EVENTS keep their old
 *   text, because an old newspaper is an old newspaper.
 */
const V13_TO_V14: Migration = {
  from: 13,
  to: 14,
  describe: 'add awards, wound provenance, pension ledger; rename Ashkelon',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')

    const service = Array.isArray(world['service']) ? world['service'] : []
    const migratedService = service.map((entry) => {
      const record = requireObject(entry, 'save.world.service[]')
      const performance = typeof record['performance'] === 'number' ? record['performance'] : 500
      const termMonthsLeft = typeof record['termMonthsLeft'] === 'number' ? record['termMonthsLeft'] : 0
      const monthsServed = Math.max(0, 48 - termMonthsLeft)
      return { ...record, termPerformanceSum: performance * monthsServed }
    })

    const health = Array.isArray(world['health']) ? world['health'] : []
    const migratedHealth = health.map((entry) => {
      const record = requireObject(entry, 'save.world.health[]')
      return { ...record, ailmentServiceConnected: false, serviceDisability: 0 }
    })

    const nations = Array.isArray(world['nations']) ? world['nations'] : []
    const migratedNations = nations.map((entry) => {
      const nation = requireObject(entry, 'save.world.nations[]')
      return nation['name'] === 'Ashkelon' ? { ...nation, name: 'Veskarn' } : nation
    })

    const nextWorld: Record<string, unknown> = {
      ...world,
      service: migratedService,
      health: migratedHealth,
      nations: migratedNations,
      awards: [],
    }
    return {
      header: { ...header, schemaVersion: 14, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v14 → v15 (M-SPECOPS). Special units and promotion points arrive;
 *  service records gain `unitId: null` (no membership predates the units)
 *  and an untested fitness score (the first test happens now, not in a
 *  reconstructed past). */
const V14_TO_V15: Migration = {
  from: 14,
  to: 15,
  describe: 'add special-unit membership and fitness scores (none reconstructed)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const service = Array.isArray(world['service']) ? world['service'] : []
    const migrated = service.map((entry) => {
      const record = requireObject(entry, 'save.world.service[]')
      return { ...record, unitId: null, fitnessScore: 0, fitnessTestedAtTick: null }
    })
    const nextWorld: Record<string, unknown> = { ...world, service: migrated }
    return {
      header: { ...header, schemaVersion: 15, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v15 → v16 (C1). Crime arrives; nobody's past is invented. */
const V15_TO_V16: Migration = {
  from: 15,
  to: 16,
  describe: 'add criminal records (empty — the law starts watching now)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld: Record<string, unknown> = { ...world, criminal: [] }
    return {
      header: { ...header, schemaVersion: 16, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v16 → v17 (D2). Marriages gain a family-size aspiration. Existing
 *  couples get NULL — their plan is decided (and recorded) on the first
 *  tick after load, never invented by a migration. */
const V16_TO_V17: Migration = {
  from: 16,
  to: 17,
  describe: 'add family-size aspiration to relationships (null — plans are decided in play)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const relationships = requireArray(world, 'relationships', 'save.world').map((entry) => ({
      ...requireObject(entry, 'save.world.relationships[]'),
      familySizeAspiration: null,
    }))
    const nextWorld: Record<string, unknown> = { ...world, relationships }
    return {
      header: { ...header, schemaVersion: 17, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/** v17 → v18 (P2). Households gain a spending stance (NULL — the
 *  character-driven formula is the null behaviour, and no one's chosen
 *  posture is invented) and service records gain retrain history (empty /
 *  null — nobody retrained before retraining existed). */
const V17_TO_V18: Migration = {
  from: 17,
  to: 18,
  describe: 'add household spending stance and service retrain history (nothing invented)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const households = requireArray(world, 'households', 'save.world').map((entry) => ({
      ...requireObject(entry, 'save.world.households[]'),
      spendStance: null,
    }))
    const service = (Array.isArray(world['service']) ? world['service'] : []).map((entry) => ({
      ...requireObject(entry, 'save.world.service[]'),
      priorSpecialtyIds: [],
      specialtyChangedAtTick: null,
    }))
    const nextWorld: Record<string, unknown> = { ...world, households, service }
    return {
      header: { ...header, schemaVersion: 18, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ARMY2 peacetime rotations. Every tour on an old save answered a war —
 * that is all the deployment system could do — so each one is marked
 * 'combat' with no host. Nothing is invented: the war fields they already
 * carry stay exactly as they were.
 */
const V18_TO_V19: Migration = {
  from: 18,
  to: 19,
  describe: 'mark existing tours as combat deployments (rotations are new)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const deployments = (Array.isArray(world['deployments']) ? world['deployments'] : []).map(
      (entry) => {
        const person = requireObject(entry, 'save.world.deployments[]')
        const tours = (Array.isArray(person['tours']) ? person['tours'] : []).map((tour) => ({
          ...requireObject(tour, 'save.world.deployments[].tours[]'),
          kind: 'combat',
          hostId: null,
        }))
        return { ...person, tours }
      },
    )
    const nextWorld: Record<string, unknown> = { ...world, deployments }
    return {
      header: { ...header, schemaVersion: 19, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * Nations gain a peacetime baseline that war erodes and peace rebuilds.
 * An old save's nations have never been ground down — strength has been a
 * constant for their whole history — so their current strength IS their
 * baseline. Nothing is invented and no history is rewritten.
 */
const V19_TO_V20: Migration = {
  from: 19,
  to: 20,
  describe: 'give nations a peacetime strength baseline (their current strength)',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nations = (Array.isArray(world['nations']) ? world['nations'] : []).map((entry) => {
      const nation = requireObject(entry, 'save.world.nations[]')
      return { ...nation, baseStrength: nation['strength'] }
    })
    const nextWorld: Record<string, unknown> = { ...world, nations }
    return {
      header: { ...header, schemaVersion: 20, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * W1. The header records which WorldSpec preset made the world. Every save
 * that predates presets was made by the only world there was, so they are
 * all Classic — this states it rather than leaving the field absent and
 * making every reader guess (the load path defaults too, belt and braces).
 *
 * The world body is untouched, so the checksum does not move.
 */
const V20_TO_V21: Migration = {
  from: 20,
  to: 21,
  describe: "name the preset that made the world ('classic' for every save that predates presets)",
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireField(save, 'world', 'save')
    return {
      header: { ...header, schemaVersion: 21, presetId: 'classic' },
      world,
    }
  },
}

/**
 * The war model gained length and difficulty (owner spec, 2026-08-02):
 * nations carry a combat rating and the months they have spent at war, and a
 * war carries the length it was rolled to run.
 *
 * An OLD save gets its ratings derived from the strength it already has —
 * the same rule a preset-less nation uses at generation, so a migrated world
 * rates its countries exactly as a fresh one would. War months start at zero
 * rather than being reconstructed: the events are there but the tally never
 * was, and inventing a country's war history is worse than starting its
 * experience clock now. Wars already running have no rolled length and end
 * the way they always did, on weariness.
 */
const V21_TO_V22: Migration = {
  from: 21,
  to: 22,
  describe: 'give nations a combat rating and a war-months tally, and wars a rolled length',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')

    const nations = (Array.isArray(world['nations']) ? world['nations'] : []).map((entry) => {
      const nation = requireObject(entry, 'save.world.nations[]')
      const strength = typeof nation['strength'] === 'number' ? nation['strength'] : 500
      return {
        ...nation,
        combatRating: Math.max(1, Math.min(10, Math.round(strength / 95))),
        warMonths: 0,
      }
    })
    const geoRelations = (Array.isArray(world['geoRelations']) ? world['geoRelations'] : []).map(
      (entry) => ({ ...requireObject(entry, 'save.world.geoRelations[]'), plannedWarMonths: null }),
    )

    const nextWorld: Record<string, unknown> = { ...world, nations, geoRelations }
    return {
      header: { ...header, schemaVersion: 22, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * School houses got a calendar (owner spec): a service record now holds the
 * seat it took and the month that class starts. Nobody in an older save was
 * ever down for a class, so both are null — an in-progress course is not a
 * thing that existed to reconstruct.
 */
const V22_TO_V23: Migration = {
  from: 22,
  to: 23,
  describe: 'give service records a school seat and its class date',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const service = (Array.isArray(world['service']) ? world['service'] : []).map((entry) => ({
      ...requireObject(entry, 'save.world.service[]'),
      schoolId: null,
      schoolStartsAtTick: null,
    }))
    const nextWorld: Record<string, unknown> = { ...world, service }
    return {
      header: { ...header, schemaVersion: 23, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

const V23_TO_V24: Migration = {
  from: 23,
  to: 24,
  describe: 'note that unit moments now exist',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    // NOTHING TO CHANGE, and that is the honest migration. Unit moments add
    // a pending KIND and a richer `choice` string on the log entries they
    // write — neither is a field, and an old save contains no unit moments
    // because that world never had any. Rewriting its log to pretend
    // otherwise would be inventing history the player never played.
    return {
      header: { ...header, schemaVersion: 24, checksum: checksumOf(world) },
      world,
    }
  },
}

const V24_TO_V25: Migration = {
  from: 24,
  to: 25,
  describe: 'give every past tour a capture field, set free',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    // NOBODY IN AN OLD SAVE WAS EVER TAKEN — no build before this one could
    // take them — so every migrated tour is set free rather than guessed at.
    const deployments = (Array.isArray(world['deployments']) ? world['deployments'] : []).map((entry) => {
      const pair = requireObject(entry, 'save.world.deployments[]')
      const tours = Array.isArray(pair['tours']) ? pair['tours'] : []
      return {
        ...pair,
        tours: tours.map((tour) => ({
          ...requireObject(tour, 'save.world.deployments[].tours[]'),
          capturedAtTick: null,
        })),
      }
    })
    const nextWorld: Record<string, unknown> = { ...world, deployments }
    return {
      header: { ...header, schemaVersion: 25, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

const V25_TO_V26: Migration = {
  from: 25,
  to: 26,
  describe: 'record when a soldier joined their unit, where it is known',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    // NULL MEANS UNKNOWN, and that is the honest value. An old save never
    // recorded the date; enlistedAtTick would be a guess that reads as a
    // fact, and it would hand a senior parachutist's badge to somebody on
    // the strength of it.
    const service = (Array.isArray(world['service']) ? world['service'] : []).map((entry) => ({
      ...requireObject(entry, 'save.world.service[]'),
      unitSinceTick: null,
    }))
    const nextWorld: Record<string, unknown> = { ...world, service }
    return {
      header: { ...header, schemaVersion: 26, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

const V26_TO_V27: Migration = {
  from: 26,
  to: 27,
  describe: 'give criminal records probation, dispositions and restitution',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const criminal = (Array.isArray(world['criminal']) ? world['criminal'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.criminal[]')
      const convictions = Array.isArray(record['convictions']) ? record['convictions'] : []
      return {
        ...record,
        // NOBODY IN AN OLD SAVE IS ON PROBATION, because no build before
        // this one could put them there — the same honesty the capture
        // migration used. Nothing is invented, and nothing is owed.
        probationUntilTick: null,
        suspendedMonths: 0,
        restitutionOwed: 0,
        convictions: convictions.map((c) => {
          const conviction = requireObject(c, 'save.world.criminal[].convictions[]')
          // THE DISPOSITION IT CAN BE READ AS HAVING HAD. The old court had
          // two answers, and the record still says which one it gave: months
          // is jail, money is a fine. That is not a guess — it is what the
          // stored sentence already means.
          const months = typeof conviction['sentenceMonths'] === 'number' ? conviction['sentenceMonths'] : 0
          return { ...conviction, disposition: months > 0 ? 'jail' : 'fine' }
        }),
      }
    })
    const nextWorld: Record<string, unknown> = { ...world, criminal }
    return {
      header: { ...header, schemaVersion: 27, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ECON §1. THE POT BECOMES PEOPLE'S MONEY.
 *
 * Every household held one balance and every wage went into it. Now each
 * person holds their own accounts and the household keeps only its shared
 * obligations, so an existing save has to be told whose money that was.
 *
 * A POSITIVE balance is SPLIT AMONG THE ADULTS who live there, evenly, with
 * the remainder to the eldest — it was earned by the people under that roof
 * and there is no record of who earned which part, so an even split is the
 * one answer that invents nothing. A household of children keeps it as a
 * shared balance rather than handing a bank account to a six-year-old.
 *
 * A NEGATIVE balance STAYS ON THE HOUSEHOLD, because that is exactly what
 * the new field means: arrears are the roof's, not any one person's, and
 * every consequence that reads them — the forced move, the marriage strain —
 * keeps working untouched.
 */
const V27_TO_V28: Migration = {
  from: 27,
  to: 28,
  describe: 'split the household pot into personal accounts',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const households = Array.isArray(world['households']) ? world['households'] : []
    const people = Array.isArray(world['people']) ? world['people'] : []
    const tick = typeof world['tick'] === 'number' ? world['tick'] : 0

    const bornAt = new Map<number, number>()
    for (const entry of people) {
      const person = requireObject(entry, 'save.world.people[]')
      const id = typeof person['id'] === 'number' ? person['id'] : -1
      const birth = typeof person['birthTick'] === 'number' ? person['birthTick'] : 0
      const dead = person['deathTick'] !== null && person['deathTick'] !== undefined
      if (id >= 0 && !dead) bornAt.set(id, birth)
    }

    const accounts: Record<string, unknown>[] = []
    const rewritten = households.map((entry) => {
      const household = requireObject(entry, 'save.world.households[]')
      const savings = typeof household['savings'] === 'number' ? household['savings'] : 0
      const memberIds = Array.isArray(household['memberIds']) ? household['memberIds'] : []
      if (savings <= 0) return household

      // Adults only, ELDEST FIRST — the remainder goes to them, so the
      // order has to be the one the comment claims. Birth tick, then id, so
      // it is reproducible.
      const adults = memberIds
        .filter((id): id is number => typeof id === 'number')
        .filter((id) => {
          const birth = bornAt.get(id)
          return birth !== undefined && Math.floor((tick - birth) / 12) >= 18
        })
        .sort((a, b) => (bornAt.get(a) ?? 0) - (bornAt.get(b) ?? 0) || a - b)
      if (adults.length === 0) return household

      const share = Math.floor(savings / adults.length)
      let remainder = savings - share * adults.length
      for (const id of adults) {
        // The eldest is first in this order and carries the odd cents.
        const extra = remainder
        remainder = 0
        accounts.push({
          personId: id,
          checking: share + extra,
          savings: 0,
          brokerage: 0,
          retirement: 0,
        })
      }
      return { ...household, savings: 0 }
    })

    // The world changed, so the checksum is recomputed over it — every
    // migration that rewrites data does this, and the load path verifies it
    // AFTER migrating.
    const nextWorld = { ...world, households: rewritten, accounts }
    return {
      ...save,
      header: { ...header, schemaVersion: 28, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ECON §3. The tax year joins the accounts.
 *
 * Both fields start at ZERO for everybody, which is the honest reading: no
 * build before this withheld anything, so nobody in an existing save has
 * paid tax and nobody is owed a refund. The first January after loading
 * files a return on the months since, which is the correct first return.
 */
const V28_TO_V29: Migration = {
  from: 28,
  to: 29,
  describe: 'give every account a tax year',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const accounts = (Array.isArray(world['accounts']) ? world['accounts'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.accounts[]')
      return { ...record, taxableYtd: 0, withheldYtd: 0 }
    })
    const nextWorld = { ...world, accounts }
    return {
      ...save,
      header: { ...header, schemaVersion: 29, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ECON §4. The weather arrives.
 *
 * An existing save has no economy because no build before this one had one.
 * It starts in EXPANSION at the base price level — which is the honest
 * reading: the prices in that save ARE its price level, so declaring today
 * "1000" makes every figure in it mean exactly what it already meant. The
 * cycle starts drifting from the month it is loaded.
 */
const V29_TO_V30: Migration = {
  from: 29,
  to: 30,
  describe: 'give the world an economy',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld = {
      ...world,
      economy: {
        phase: 'expansion',
        phaseSinceTick: typeof world['tick'] === 'number' ? world['tick'] : 0,
        growthPerMille: 25,
        inflationPerMille: 20,
        unemploymentPerMille: 45,
        ratePerMille: 35,
        marketIndex: 10_000,
        priceLevelPerMille: 1000,
      },
    }
    return {
      ...save,
      header: { ...header, schemaVersion: 30, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ECON §5. The market opens.
 *
 * Every sector starts at its base price and nobody holds anything, which is
 * the honest reading of a world that had no market: no history of prices is
 * invented, and nobody is handed a portfolio they never bought.
 */
const V30_TO_V31: Migration = {
  from: 30,
  to: 31,
  describe: 'open the market and give every account a portfolio',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const accounts = (Array.isArray(world['accounts']) ? world['accounts'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.accounts[]')
      return { ...record, holdings: [], retirementHoldings: [] }
    })
    const nextWorld = {
      ...world,
      accounts,
      sectorPrices: {
        industrial: 10_000,
        agricultural: 10_000,
        defense: 10_000,
        consumer: 10_000,
      },
    }
    return {
      ...save,
      header: { ...header, schemaVersion: 31, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ECON §6. Credit arrives.
 *
 * Nobody in an existing save owes anything, owns a home through a mortgage,
 * or has a payment history — because no build before this one could give
 * them one. A clean file and a starting score is the only honest reading:
 * inventing debts would be a claim about a life that never happened, and
 * inventing a good history would hand out a score nobody earned.
 */
const V31_TO_V32: Migration = {
  from: 31,
  to: 32,
  describe: 'give every account a clean credit file',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const accounts = (Array.isArray(world['accounts']) ? world['accounts'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.accounts[]')
      return {
        ...record,
        loans: [],
        homePlaceId: null,
        homePurchasePrice: 0,
        monthsPaid: 0,
        defaults: 0,
      }
    })
    const nextWorld = { ...world, accounts }
    return {
      ...save,
      header: { ...header, schemaVersion: 32, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-SAFETY. THE FLOORS, AND THE COURTHOUSE.
 *
 * Nobody in an existing save has a work record, an insurance clock or a
 * filing, because no build before this one could give them one. The honest
 * reading of `monthsWorked` for an old save is ZERO — inventing a career
 * would hand out a state pension nobody earned, and Law 3 says a record has
 * to be something that happened. Everyone alive at load starts building
 * theirs from the next month, which is late but true.
 *
 * Households gain `homelessSinceTick: null` — everybody in an old save has
 * a roof by construction, because the state did not exist to lose it.
 */
const V32_TO_V33: Migration = {
  from: 32,
  to: 33,
  describe: 'open the courthouse and put a floor under everybody',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const accounts = (Array.isArray(world['accounts']) ? world['accounts'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.accounts[]')
      return { ...record, monthsWorked: 0, lastMonthlyPay: 0, unemploymentUntilTick: null }
    })
    const households = (Array.isArray(world['households']) ? world['households'] : []).map(
      (entry) => {
        const record = requireObject(entry, 'save.world.households[]')
        return { ...record, homelessSinceTick: null }
      },
    )
    const nextWorld = { ...world, accounts, households, bankruptcies: [] }
    return {
      ...save,
      header: { ...header, schemaVersion: 33, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-CAREER §1. THE LADDER ARRIVES.
 *
 * Every employment record gains the track it sits on and the tick it took
 * its rung. The track is READ FROM THE OCCUPATION rather than invented — a
 * shop clerk has always been on the retail ladder, the game simply had no
 * ladders to say so. `rungSinceTick` becomes the tick the job started,
 * which is the honest reading: nobody has been promoted yet, so the rung
 * they are on is the one they were hired onto.
 */
const V33_TO_V34: Migration = {
  from: 33,
  to: 34,
  describe: 'put every job on the ladder it was always on',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const employment = (Array.isArray(world['employment']) ? world['employment'] : []).map(
      (entry) => {
        const record = requireObject(entry, 'save.world.employment[]')
        const occupationId = typeof record['occupationId'] === 'string' ? record['occupationId'] : ''
        const started = typeof record['startedAtTick'] === 'number' ? record['startedAtTick'] : 0
        return {
          ...record,
          trackId: TRACK_OF[occupationId] ?? null,
          rungSinceTick: started,
        }
      },
    )
    const nextWorld = { ...world, employment }
    return {
      ...save,
      header: { ...header, schemaVersion: 34, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * The occupation-to-track map, FROZEN AT THIS MIGRATION.
 *
 * Deliberately a copy rather than a read of CAREER_TRACKS: a migration must
 * mean the same thing in ten years' time, and the ladders will move. This
 * is what they were on the day the field was added.
 */
const TRACK_OF: Readonly<Record<string, string>> = {
  apprentice: 'trades', carpenter: 'trades', 'master-tradesman': 'trades',
  'site-foreman': 'trades', contractor: 'trades',
  'shop-clerk': 'retail', 'shift-lead': 'retail', 'assistant-manager': 'retail',
  'store-manager': 'retail', 'district-manager': 'retail',
  clerk: 'office', associate: 'office', 'senior-associate': 'office', manager: 'office',
  director: 'office', 'vice-president': 'office', executive: 'office',
  labourer: 'industrial', millhand: 'industrial', 'lead-hand': 'industrial',
  foreman: 'industrial', superintendent: 'industrial', 'plant-manager': 'industrial',
  aide: 'medical', nurse: 'medical', 'charge-nurse': 'medical', 'nurse-manager': 'medical',
  resident: 'physician', doctor: 'physician', 'chief-of-medicine': 'physician',
  teacher: 'education', 'department-head': 'education',
  'assistant-principal': 'education', principal: 'education',
  constable: 'civil', sergeant: 'civil', 'police-chief': 'civil',
  bookkeeper: 'professional', accountant: 'professional',
  'senior-accountant': 'professional', partner: 'professional',
}

/**
 * M-CAREER §5. THE TOWN GAINS A REGISTER OF BUSINESSES.
 *
 * Empty for every existing save: nobody could have opened one, because
 * there was nothing to open. Law 6 — unrecorded history stays unrecorded.
 */
const V34_TO_V35: Migration = {
  from: 34,
  to: 35,
  describe: 'open a register of businesses',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const nextWorld = { ...world, businesses: [] }
    return {
      ...save,
      header: { ...header, schemaVersion: 35, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-MONEY2. THE PURSE BECOMES THE PERSON'S.
 *
 * Spend stance moves from the household to the person. Every living member
 * inherits the roof's posture, which is the honest reading: that IS how
 * they were carrying their money the day before, and Law 3 says a record
 * should say what happened rather than what would be tidy.
 */
const V35_TO_V36: Migration = {
  from: 35,
  to: 36,
  describe: 'give every person their own way of carrying money',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const households = Array.isArray(world['households']) ? world['households'] : []
    const stanceOf = new Map<number, unknown>()
    for (const entry of households) {
      const record = requireObject(entry, 'save.world.households[]')
      const members = Array.isArray(record['memberIds']) ? record['memberIds'] : []
      for (const memberId of members) {
        if (typeof memberId === 'number') stanceOf.set(memberId, record['spendStance'] ?? null)
      }
    }
    const people = (Array.isArray(world['people']) ? world['people'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.people[]')
      const id = typeof record['id'] === 'number' ? record['id'] : -1
      return { ...record, spendStance: stanceOf.get(id) ?? null }
    })
    const nextWorld = { ...world, people }
    return {
      ...save,
      header: { ...header, schemaVersion: 36, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * M-ENLIST. THE RECRUITING STATION OPENS.
 *
 * Every serving or discharged record gains an entry-test score and a track.
 *
 * THE SCORE IS BACK-FILLED AT A FLAT 55, and the spec offered a choice
 * between that and deriving it from stats. Flat, deliberately: a derived
 * score would be a claim about a test this person never sat, and Law 3 says
 * the record holds what happened. 55 is "qualified for the trade they
 * actually hold", which is the one thing their history does prove.
 *
 * The track is 'enlisted' unless the record already carries a commission —
 * a mustang commissioned from the ranks entered as enlisted and this cannot
 * tell the difference, so it reads the commission it can see.
 *
 * Specialty ids are untouched: every old trade is still in the catalogue,
 * now with a code and a gate beside it, so nothing has to be remapped.
 */
const V36_TO_V37: Migration = {
  from: 36,
  to: 37,
  describe: 'give every service record an entry score and a track',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    const service = (Array.isArray(world['service']) ? world['service'] : []).map((entry) => {
      const record = requireObject(entry, 'save.world.service[]')
      return {
        ...record,
        aptitude: typeof record['aptitude'] === 'number' ? record['aptitude'] : 55,
        track: record['commissioned'] === true ? 'officer' : 'enlisted',
      }
    })
    const nextWorld = { ...world, service }
    return {
      ...save,
      header: { ...header, schemaVersion: 37, checksum: checksumOf(nextWorld) },
      world: nextWorld,
    }
  },
}

/**
 * v37 -> v38. M-ENLIST phases 4 and 5. NOTHING IN THE SAVE CHANGES.
 *
 * This exists because DETERMINISM.md §7 puts PLAYER-PATH changes on the
 * schema version rather than the simulation version, and phases 4 and 5 are
 * exactly that: which scene a trade meets, how often a contact arrives as a
 * decision, and which services the branch menu offers. An unplayed world is
 * byte identical — the goldens confirm it — so SIMULATION_VERSION stays put
 * and this stamp is what makes the divergence notice fire on a save
 * continued under the new code.
 *
 * A migration that rewrites no data still recomputes the checksum, because
 * the checksum is over the world and the world is unchanged; doing it the
 * same way as every other migration is cheaper than explaining why this one
 * is special.
 */
const V37_TO_V38: Migration = {
  from: 37,
  to: 38,
  describe: 'stamp the player-path changes of M-ENLIST phases 4 and 5',
  apply(save) {
    const header = requireObject(requireField(save, 'header', 'save'), 'save.header')
    const world = requireObject(requireField(save, 'world', 'save'), 'save.world')
    return {
      ...save,
      header: { ...header, schemaVersion: 38, checksum: checksumOf(world) },
      world,
    }
  },
}

const MIGRATIONS: readonly Migration[] = [V1_TO_V2, V2_TO_V3, V3_TO_V4, V4_TO_V5, V5_TO_V6, V6_TO_V7, V7_TO_V8, V8_TO_V9, V9_TO_V10, V10_TO_V11, V11_TO_V12, V12_TO_V13, V13_TO_V14, V14_TO_V15, V15_TO_V16, V16_TO_V17, V17_TO_V18, V18_TO_V19, V19_TO_V20, V20_TO_V21, V21_TO_V22, V22_TO_V23, V23_TO_V24, V24_TO_V25, V25_TO_V26, V26_TO_V27, V27_TO_V28, V28_TO_V29, V29_TO_V30, V30_TO_V31, V31_TO_V32, V32_TO_V33, V33_TO_V34, V34_TO_V35, V35_TO_V36, V36_TO_V37, V37_TO_V38]

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
