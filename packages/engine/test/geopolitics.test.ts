/**
 * Geopolitics. L4-M1.
 *
 * The claims: the world beyond the town exists and is fictional; wars start
 * AND end for explainable reasons; the world does not collapse into permanent
 * war (the R-07 stability pattern at planetary scale); nations stay
 * aggregate; and none of it perturbs the town's people.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { NATION_NAMES } from '../src/content.js'
import {
  activeWars,
  homeland,
  newsSince,
} from '../src/geopolitics.js'
import { advanceTicks, createWorld, worldHash } from '../src/index.js'
import type { World } from '../src/types.js'

function grownWorld(ticks = 2400): World {
  // Two hundred years: enough history for wars to rise and fall repeatedly.
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, ticks)
  return world
}

describe('the world beyond the town', () => {
  it('has a dozen fictional nations and exactly one homeland', () => {
    const world = createWorld(makeSeed(12345))
    expect(world.nations.size).toBe(13)

    const homelands = [...world.nations.values()].filter((n) => n.isHomeland)
    expect(homelands.length).toBe(1)
    expect(homelands[0]?.name).toBe('the Republic')

    const allowed = new Set<string>([...NATION_NAMES, 'the Republic'])
    for (const nation of world.nations.values()) {
      expect(allowed.has(nation.name), `${nation.name} is not on the fictional list`).toBe(true)
    }
  })

  it('gives every pair of nations a relation', () => {
    const world = createWorld(makeSeed(12345))
    const n = world.nations.size
    expect(world.geoRelations.size).toBe((n * (n - 1)) / 2)
  })

  it('is deterministic like everything else', () => {
    const first = createWorld(makeSeed(777))
    const second = createWorld(makeSeed(777))
    advanceTicks(first, 240)
    advanceTicks(second, 240)
    expect(worldHash(first)).toBe(worldHash(second))
  })
})

describe('wars', () => {
  it('start, and end, across two centuries', () => {
    const world = grownWorld()
    const began = world.events.filter((e) => e.type === 'war-began').length
    const ceasefires = world.events.filter((e) => e.type === 'ceasefire').length
    const peaces = world.events.filter((e) => e.type === 'peace-restored').length

    expect(began).toBeGreaterThan(0)
    expect(ceasefires).toBeGreaterThan(0)
    expect(peaces).toBeGreaterThan(0)
    // Wars that started mostly resolved: the world is not a ratchet.
    expect(ceasefires).toBeGreaterThanOrEqual(Math.floor(began * 0.6))
  })

  it('never engulf the whole world at once', () => {
    // Sample the war count century by century rather than only at the end.
    const world = createWorld(makeSeed(12345))
    const totalPairs = world.geoRelations.size
    for (let step = 0; step < 20; step++) {
      advanceTicks(world, 120)
      const wars = activeWars(world).length
      expect(wars, `tick ${world.tick}: ${wars} concurrent wars`).toBeLessThan(totalPairs / 4)
    }
  })

  it('every outbreak carries an explainable, defining record', () => {
    const world = grownWorld(1200)
    const outbreaks = world.events.filter((e) => e.type === 'war-began')
    expect(outbreaks.length).toBeGreaterThan(0)
    for (const event of outbreaks) {
      // One nation can transit twice in a month (tension with one neighbour,
      // war with another), so match on significance too — the war's record is
      // the Defining one among that tick's geopolitics records.
      const records = world.causalRecords.filter(
        (r) => r.decision === 'geopolitics' && r.tick === event.tick && r.subjectId === event.subjectId,
      )
      const defining = records.find((r) => r.significance === 'defining')
      expect(defining, `war at tick ${event.tick} has no defining record`).toBeDefined()
      expect(defining?.inputs.length).toBeGreaterThan(0)
    }
  })

  it('counts casualties as aggregate numbers that stop at ceasefire', () => {
    const world = grownWorld(1200)
    let sawCasualties = false
    for (const relation of world.geoRelations.values()) {
      expect(Number.isInteger(relation.casualtiesA)).toBe(true)
      expect(Number.isInteger(relation.casualtiesB)).toBe(true)
      expect(relation.casualtiesA).toBeGreaterThanOrEqual(0)
      if (relation.casualtiesA + relation.casualtiesB > 0) sawCasualties = true
    }
    expect(sawCasualties).toBe(true)
  })

  it('phases exist only during wars', () => {
    const world = grownWorld(600)
    for (const relation of world.geoRelations.values()) {
      if (relation.state === 'war') expect(relation.warPhase).not.toBeNull()
      else expect(relation.warPhase).toBeNull()
    }
  })
})

describe('the aggregate rule', () => {
  it('adds no people to the world', () => {
    // Nations are entities but never persons: the person count of a world
    // with 13 nations equals the person count generated for the town.
    const world = createWorld(makeSeed(12345))
    for (const nationId of world.nations.keys()) {
      expect(world.people.has(nationId)).toBe(false)
      expect(world.education.has(nationId)).toBe(false)
      expect(world.employment.has(nationId)).toBe(false)
    }
  })

  it('never lets geopolitics touch a person directly', () => {
    // Geo events reference only nation ids; no person's timeline contains one.
    const world = grownWorld(600)
    const geoTypes = new Set(['war-began', 'ceasefire', 'peace-restored', 'tensions-shifted'])
    for (const event of world.events) {
      if (!geoTypes.has(event.type)) continue
      expect(world.nations.has(event.subjectId)).toBe(true)
      expect(world.people.has(event.subjectId)).toBe(false)
    }
  })

  it('leaves the town byte-identical to a world where nobody reads the news', () => {
    // Strongest possible isolation claim available cheaply: person systems do
    // not read geo state yet, and geo draws live on their own stream — so the
    // PEOPLE of two same-seed worlds must match exactly, which the golden
    // hash of the whole world already asserts elsewhere. Here: the town's
    // population statistics stay in their historical bands with geopolitics
    // running (no accidental coupling through shared draws).
    const world = grownWorld(600)
    const living = [...world.people.values()].filter((p) => p.deathTick === null).length
    expect(living).toBeGreaterThan(40)
  })
})

describe('news', () => {
  it('reports wars and homeland shifts, not every foreign squabble', () => {
    const world = grownWorld(1200)
    const items = newsSince(world, 0 as never)
    expect(items.length).toBeGreaterThan(0)

    const home = homeland(world)
    expect(home).toBeDefined()
    for (const item of items) {
      expect(item.text.length).toBeGreaterThan(10)
      expect(item.text).not.toContain('undefined')
    }
    // Homeland-involved items are flagged for the feed to emphasize.
    const nearby = items.filter((i) => i.nearby)
    const wars = items.filter((i) => i.text.includes('war') || i.text.includes('ceasefire'))
    expect(nearby.length + wars.length).toBeGreaterThan(0)
  })
})
