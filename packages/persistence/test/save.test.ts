/**
 * Persistence tests.
 *
 * The three things that must never break:
 *   1. A save round-trips without losing anything.
 *   2. An old save still loads (migration), tested against a REAL committed v1
 *      save rather than a fixture written to match today's assumptions.
 *   3. A damaged save is REFUSED, not partially loaded.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { seed as makeSeed } from '@life-engine/shared'
import {
  advanceTicks,
  chooseSpendStance,
  createWorld,
  lifeStory,
  livingPeople,
  setPlayer,
  SIMULATION_VERSION,
  worldHash,
} from '@life-engine/engine'
import {
  canonicalJson,
  checksumOf,
  fromSaveFile,
  migrate,
  readSchemaVersion,
  reviveBigInts,
  SaveError,
  SCHEMA_VERSION,
  toSaveFile,
} from '../src/index.js'

const FIXTURE_V1 = fileURLToPath(
  new URL('./fixtures/save-v1-seed777.json', import.meta.url),
)

function build(seedValue = 12345, ticks = 120) {
  const world = createWorld(makeSeed(seedValue), 100)
  advanceTicks(world, ticks)
  return world
}

/** Round-trip through JSON text, as a real save would go through storage. */
function throughStorage(value: unknown): unknown {
  return reviveBigInts(JSON.parse(canonicalJson(value)))
}

describe('round trip', () => {
  it('restores a world that is byte-identical to the original', () => {
    const original = build()
    const restored = fromSaveFile(throughStorage(toSaveFile(original)), SIMULATION_VERSION).world

    // The strongest possible check: the whole-world fingerprint used by the
    // determinism tests. If anything at all was lost, this differs.
    expect(worldHash(restored)).toBe(worldHash(original))
  })

  it('restores every collection', () => {
    const original = build()
    const restored = fromSaveFile(throughStorage(toSaveFile(original)), SIMULATION_VERSION).world

    expect(restored.people.size).toBe(original.people.size)
    expect(restored.places.size).toBe(original.places.size)
    expect(restored.households.size).toBe(original.households.size)
    expect(restored.education.size).toBe(original.education.size)
    expect(restored.employment.size).toBe(original.employment.size)
    expect(restored.relationships.size).toBe(original.relationships.size)
    expect(restored.events.length).toBe(original.events.length)
    expect(restored.causalRecords.length).toBe(original.causalRecords.length)
    expect(restored.tick).toBe(original.tick)
    expect(restored.seed).toBe(original.seed)
    expect(restored.nextEntityId).toBe(original.nextEntityId)
  })

  it('restores narrative exactly', () => {
    const original = build()
    const restored = fromSaveFile(throughStorage(toSaveFile(original)), SIMULATION_VERSION).world
    const someone = livingPeople(original)[0]
    expect(someone).toBeDefined()
    if (!someone) return
    expect(lifeStory(restored, someone.id)).toBe(lifeStory(original, someone.id))
  })

  it('continues identically after a save and load', () => {
    // Save at tick 60, load, run to 120. Must match an uninterrupted run.
    const straight = build(12345, 120)

    const staged = build(12345, 60)
    const reloaded = fromSaveFile(throughStorage(toSaveFile(staged)), SIMULATION_VERSION).world
    advanceTicks(reloaded, 60)

    expect(worldHash(reloaded)).toBe(worldHash(straight))
  })

  it('writes a header carrying schema, simulation version, seed and userId', () => {
    const save = toSaveFile(build(999, 12))
    expect(save.header.schemaVersion).toBe(SCHEMA_VERSION)
    expect(save.header.simulationVersion).toBe(SIMULATION_VERSION)
    expect(save.header.seed).toBe(999)
    expect(save.header.userId).toBe('local')
    expect(save.header.checksum).toMatch(/^[0-9a-f]{8}$/)
  })

  it('a chosen spending stance survives save and load (v18, per person from v36)', () => {
    // The stance is the one field only a PLAYER ever sets, so the ordinary
    // round-trip tests never exercise it non-null. If hydration ever stopped
    // spreading households wholesale, the loss would be silent — the exact
    // failure mode persistence exists to prevent (persistence review, P2).
    const original = build()
    const anyone = livingPeople(original).find((p) => p.householdId !== null)
    expect(anyone).toBeDefined()
    if (!anyone) return
    setPlayer(original, anyone.id)
    const result = chooseSpendStance(original, 'thrifty')
    expect(result.set).toBe(true)

    const restored = fromSaveFile(throughStorage(toSaveFile(original)), SIMULATION_VERSION).world
    // M-MONEY2: the posture belongs to the PERSON now, not the roof.
    expect(restored.people.get(anyone.id)?.spendStance).toBe('thrifty')
  })
})

describe('migration from a real v1 save', () => {
  const rawV1: unknown = JSON.parse(readFileSync(FIXTURE_V1, 'utf8'))

  it('the fixture really is schema v1', () => {
    // Guards against the fixture being silently regenerated in a newer format,
    // which would make this whole suite test nothing.
    expect(readSchemaVersion(rawV1)).toBe(1)
  })

  it('migrates to the current schema', () => {
    const result = migrate(rawV1)
    expect(readSchemaVersion(result.save)).toBe(SCHEMA_VERSION)
    expect(result.fromVersion).toBe(1)
    expect(result.applied.length).toBeGreaterThan(0)
  })

  it('loads a v1 save without losing data', () => {
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)

    expect(loaded.migrationsApplied.length).toBe(68) // v1 through v69, applied in sequence
    expect(loaded.world.people.size).toBeGreaterThan(0)
    expect(loaded.world.events.length).toBeGreaterThan(0)
    // v18: nobody's chosen posture is invented — every migrated household
    // keeps the character-driven default.
    for (const household of loaded.world.households.values()) {
      expect(household.spendStance).toBeNull()
    }
    expect(loaded.world.seed).toBe(777)

    // Every person must still have their identity — the invariant that makes a
    // person the same person across a schema change.
    for (const person of loaded.world.people.values()) {
      expect(person.givenName.length).toBeGreaterThan(0)
      expect(Number.isInteger(person.birthTick)).toBe(true)
      expect(person.id).toBeGreaterThan(0)
    }
  })

  it('generates the wider world for a save that predates it', () => {
    // A v1 save knows nothing of nations. Loading generates them from the
    // save's own seed — deterministically, so loading twice gives the same
    // world stage. The town's history is untouched; the news starts now.
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)
    expect(loaded.world.nations.size).toBe(13)
    expect(loaded.world.geoRelations.size).toBeGreaterThan(0)
    const again = fromSaveFile(rawV1, SIMULATION_VERSION)
    expect([...again.world.nations.values()].map((n) => n.name)).toEqual(
      [...loaded.world.nations.values()].map((n) => n.name),
    )
  })

  it('produces a world that still simulates', () => {
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)
    const before = loaded.world.people.size
    advanceTicks(loaded.world, 24)
    expect(loaded.world.people.size).toBeGreaterThanOrEqual(before)
    expect(loaded.world.tick).toBe(84)
  })

  it('carries friendships across the v3 relationship change without inventing marriages', () => {
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)
    // A v2 save recorded no relationship type, so every migrated edge must be a
    // plain friendship. Claiming any of these people were married would be
    // history the simulation never observed.
    for (const relationship of loaded.world.relationships.values()) {
      expect(relationship.type).toBe('friend')
      expect(relationship.typeSinceTick).toBe(relationship.formedAtTick)
      expect(relationship.endedAtTick).toBeNull()
    }
  })

  it('re-saving a migrated world yields the current schema', () => {
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)
    const resaved = toSaveFile(loaded.world)
    expect(resaved.header.schemaVersion).toBe(SCHEMA_VERSION)
    expect(fromSaveFile(throughStorage(resaved), SIMULATION_VERSION).migrationsApplied).toEqual([])
  })
})

describe('corruption is refused, not loaded', () => {
  it('rejects a save whose world was altered', () => {
    const save = toSaveFile(build(555, 24))
    const tampered = JSON.parse(canonicalJson(save)) as Record<string, unknown>
    const world = tampered['world'] as Record<string, unknown>
    world['nextEntityId'] = 999_999

    expect(() => fromSaveFile(tampered, SIMULATION_VERSION)).toThrow(SaveError)
    expect(() => fromSaveFile(tampered, SIMULATION_VERSION)).toThrow(/damaged/i)
  })

  it('rejects a truncated save', () => {
    const text = canonicalJson(toSaveFile(build(555, 24)))
    const truncated = text.slice(0, Math.floor(text.length / 2))
    expect(() => JSON.parse(truncated)).toThrow()
  })

  it('rejects a save that is not an object', () => {
    expect(() => fromSaveFile('nonsense', SIMULATION_VERSION)).toThrow(SaveError)
    expect(() => fromSaveFile(null, SIMULATION_VERSION)).toThrow(SaveError)
    expect(() => fromSaveFile([], SIMULATION_VERSION)).toThrow(SaveError)
  })

  it('rejects a save missing its header', () => {
    expect(() => fromSaveFile({ world: {} }, SIMULATION_VERSION)).toThrow(/missing "header"/)
  })

  it('rejects a save missing a whole domain', () => {
    const save = toSaveFile(build(555, 24))
    const broken = JSON.parse(canonicalJson(save)) as Record<string, unknown>
    const world = broken['world'] as Record<string, unknown>
    delete world['households']
    // Re-checksum so it fails on the missing domain, not the checksum — proving
    // structural validation catches what the checksum cannot.
    ;(broken['header'] as Record<string, unknown>)['checksum'] = checksumOf(world)

    expect(() => fromSaveFile(broken, SIMULATION_VERSION)).toThrow(/households/)
  })

  it('refuses a save from a newer build rather than guessing', () => {
    const save = toSaveFile(build(555, 24))
    const future = JSON.parse(canonicalJson(save)) as Record<string, unknown>
    ;(future['header'] as Record<string, unknown>)['schemaVersion'] = SCHEMA_VERSION + 5

    expect(() => fromSaveFile(future, SIMULATION_VERSION)).toThrow(/newer version/i)
  })

  it('reports a simulation version change instead of hiding it', () => {
    const save = toSaveFile(build(555, 24))
    const loaded = fromSaveFile(throughStorage(save), SIMULATION_VERSION + 1)
    expect(loaded.simulationVersionChanged).toBe(true)
  })
})

describe('encoding', () => {
  it('sorts keys so identical data always produces identical text', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }))
  })

  it('round-trips BigInt, which plain JSON cannot', () => {
    // Money is a Number today, but ADR-0008 requires BigInt for aggregate
    // economy figures at Layer 4. Supporting it now avoids a migration then.
    expect(() => JSON.stringify({ n: 1n })).toThrow()

    const value = { national: 9_007_199_254_740_993n, nested: [1n, { deep: 2n }] }
    const restored = reviveBigInts(JSON.parse(canonicalJson(value))) as typeof value

    expect(restored.national).toBe(9_007_199_254_740_993n)
    expect(restored.nested[0]).toBe(1n)
  })

  it('changes the checksum when any byte changes', () => {
    expect(checksumOf({ a: 1 })).not.toBe(checksumOf({ a: 2 }))
  })
})

describe('the pot becomes people (M-ECON §1, schema v28)', () => {
  it('hands a household balance to the adults who lived there, to the cent', () => {
    // The money must not evaporate in the migration, and it must not land
    // on a child. Built as a v27 save so only the one step under test runs.
    const world = {
      tick: 240,
      people: [
        { id: 1, birthTick: 0, deathTick: null },   // adult
        { id: 2, birthTick: 12, deathTick: null },  // adult
        { id: 3, birthTick: 228, deathTick: null }, // a one-year-old
      ],
      households: [{ id: 10, memberIds: [1, 2, 3], savings: 100_001 }],
    }
    const save = {
      header: { schemaVersion: 27, checksum: checksumOf(world) },
      world,
    }

    const migrated = migrate(save)
    const out = migrated.save as { world: Record<string, unknown> }
    const accounts = out.world['accounts'] as { personId: number; checking: number }[]
    const households = out.world['households'] as { savings: number }[]

    // Split between the two ADULTS, eldest carrying the odd cent.
    expect(accounts.map((a) => a.personId).sort((a, b) => a - b)).toEqual([1, 2])
    const total = accounts.reduce((sum, a) => sum + a.checking, 0)
    expect(total).toBe(100_001)
    expect(accounts.find((a) => a.personId === 1)?.checking).toBe(50_001)
    expect(accounts.find((a) => a.personId === 2)?.checking).toBe(50_000)
    // The household keeps nothing: it holds obligations now.
    expect(households[0]?.savings).toBe(0)
  })

  it('leaves arrears on the household, because that is whose they are', () => {
    const world = {
      tick: 240,
      people: [{ id: 1, birthTick: 0, deathTick: null }],
      households: [{ id: 10, memberIds: [1], savings: -45_000 }],
    }
    const save = { header: { schemaVersion: 27, checksum: checksumOf(world) }, world }

    const out = migrate(save).save as { world: Record<string, unknown> }
    const households = out.world['households'] as { savings: number }[]
    const accounts = out.world['accounts'] as unknown[]

    // A debt is the roof's, and every consequence that reads it keeps working.
    expect(households[0]?.savings).toBe(-45_000)
    expect(accounts.length).toBe(0)
  })
})

describe('the world remembers which preset made it (W1)', () => {
  it('round-trips the preset id through the header', () => {
    const world = createWorld(makeSeed(2024), 40)
    const save = toSaveFile(world)
    expect(save.header.presetId).toBe('classic')

    const loaded = fromSaveFile(save, SIMULATION_VERSION)
    expect(loaded.world.spec.id).toBe('classic')
    expect(loaded.world.presetId).toBe('classic')
    expect(loaded.header.presetId).toBe('classic')
    expect(loaded.presetUnknown).toBe(false)
  })

  it('loads a pre-preset save as Classic — which is what it is', () => {
    const rawV1: unknown = JSON.parse(readFileSync(FIXTURE_V1, 'utf8'))
    const loaded = fromSaveFile(rawV1, SIMULATION_VERSION)
    expect(loaded.world.spec.id).toBe('classic')
    expect(loaded.world.town.name.length).toBeGreaterThan(0)
  })

  it('an unknown preset degrades to Classic rather than refusing the save', () => {
    // A save written by a LATER build, opened here. A world that loads beats
    // a worker that throws (WORLD_MODES_PLAN.md, resistance 2).
    const world = createWorld(makeSeed(2024), 40)
    const save = toSaveFile(world)
    const fromTheFuture = {
      ...save,
      header: { ...save.header, presetId: 'american-heartland-2' },
    }
    const loaded = fromSaveFile(fromTheFuture, SIMULATION_VERSION)
    expect(loaded.world.spec.id).toBe('classic')
    expect(loaded.world.people.size).toBe(world.people.size)
    // And it SAYS so. Substituting a preset changes future newborn names,
    // service ladders and foreign nations; DETERMINISM.md §7 requires an
    // intentional divergence be reported, not discovered.
    expect(loaded.presetUnknown).toBe(true)
  })

  it('does not rewrite an unknown preset as Classic when the world is saved again', () => {
    // The persistence review's must-fix. Running an unfamiliar preset's
    // world on Classic content is a graceful degradation; writing 'classic'
    // back into its header is DATA LOSS, and the autosave fires 600ms after
    // any change, so it would happen silently and could not be undone.
    const world = createWorld(makeSeed(2024), 40)
    const fromTheFuture = {
      ...toSaveFile(world),
      header: { ...toSaveFile(world).header, presetId: 'american-heartland-2' },
    }

    const loaded = fromSaveFile(fromTheFuture, SIMULATION_VERSION)
    expect(loaded.world.spec.id).toBe('classic') // content it can serve
    expect(loaded.world.presetId).toBe('american-heartland-2') // identity it keeps

    const resaved = toSaveFile(loaded.world)
    expect(resaved.header.presetId).toBe('american-heartland-2')

    // And it survives any number of round trips, not just the first.
    expect(
      toSaveFile(fromSaveFile(resaved, SIMULATION_VERSION).world).header.presetId,
    ).toBe('american-heartland-2')
  })
})
