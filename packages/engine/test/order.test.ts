import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'

/**
 * THE ASSUMPTION FOUR SYSTEMS NOW LEAN ON.
 *
 * `runStats`, `runWellbeing`, `runFinances` and the snapshot all used to
 * write `[...world.people.values()].sort((a, b) => a.id - b.id)`, and
 * processing order must be reproducible or determinism is gone (Law 11).
 *
 * The sort was redundant: a Map iterates in INSERTION order, ids are handed
 * out ascending and never reused, so the copy arrives sorted. Removing it
 * saved an O(n log n) pass per system per tick over every person who has
 * ever lived — 2,861 records at world-year 200, of which 1,653 are dead.
 *
 * That is only safe while the ids really are ascending. If some future
 * worldgen inserts a person out of order, or ids start being reused, four
 * systems silently change their processing order and every golden hash
 * moves for a reason nobody would think to look for. This test is what
 * turns that into a red suite instead of a mystery.
 */
describe('the people map', () => {
  it('iterates in ascending id order, which four systems depend on', () => {
    const world = createWorld(makeSeed(4242))
    // Long enough for births, deaths, migration and household churn to have
    // rearranged things if anything was going to.
    advanceTicks(world, 12 * 80)

    let last = -1
    let outOfOrder = 0
    for (const person of world.people.values()) {
      if (person.id < last) outOfOrder += 1
      last = person.id
    }

    expect(world.people.size).toBeGreaterThan(800)
    expect(outOfOrder).toBe(0)

    // AND THE HOUSEHOLDS, for the same reason and the same six call sites.
    let lastHousehold = -1
    let householdsOutOfOrder = 0
    for (const household of world.households.values()) {
      if (household.id < lastHousehold) householdsOutOfOrder += 1
      lastHousehold = household.id
    }
    expect(world.households.size).toBeGreaterThan(100)
    expect(householdsOutOfOrder).toBe(0)
  })
})
