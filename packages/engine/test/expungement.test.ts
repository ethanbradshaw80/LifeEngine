/**
 * Expungement (C3 §5, Decision 2).
 *
 * "It never leaves the history — but it can lose its power." Sealing stops
 * every gate reading a conviction and changes nothing about the fact that
 * it happened. Erasure would let a record rewrite history, which is the one
 * thing the whole engine rests on not happening.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { expungementBar, gateStrengthOf, petitionForExpungement, recordGateOf } from '../src/crime.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'
import type { Tick } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'

function withConviction(world: World, personId: EntityId, kind: string, yearsAgo: number): void {
  const record = world.criminal.get(personId)
  world.criminal.set(personId, {
    personId,
    convictions: [
      ...(record?.convictions ?? []),
      {
        kind,
        tick: Math.max(0, world.tick - yearsAgo * 12) as Tick,
        sentenceMonths: 0,
        fine: 20_000,
      },
    ],
    jailedUntilTick: null,
  })
}

describe('sealing a record', () => {
  it('lifts the consequence and keeps the history', () => {
    const world = createWorld(makeSeed(6600), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person || person.householdId === null) throw new Error('nobody with a house')
    const household = world.households.get(person.householdId)
    if (household) world.households.set(household.id, { ...household, savings: 500_000 as never })

    // A shoplifting conviction, recent enough to still gate.
    withConviction(world, person.id, 'shoplifting', 1)
    expect(recordGateOf(world, person.id, world.tick)).toBe('hard')
    // Too recent to petition.
    expect(expungementBar(world, person.id, world.tick)).not.toBeNull()

    // Old enough, and the court agrees.
    const old = createWorld(makeSeed(6601), 60)
    advanceTicks(old, 240) // the conviction has to have somewhere to be old IN
    const olderPerson = livingPeople(old).sort((a, b) => a.id - b.id)[0]
    if (!olderPerson || olderPerson.householdId === null) throw new Error('nobody')
    if (olderPerson.deathTick !== null) throw new Error('the subject died')
    const house = old.households.get(olderPerson.householdId)
    if (house) old.households.set(house.id, { ...house, savings: 500_000 as never })
    withConviction(old, olderPerson.id, 'shoplifting', 9)

    expect(expungementBar(old, olderPerson.id, old.tick)).toBeNull()
    // A life of twenty years may have picked up a conviction of its own;
    // what matters is that everything sealable got sealed.
    const result = petitionForExpungement(old, olderPerson.id, old.tick)
    expect(result.sealed).toBeGreaterThanOrEqual(1)

    // THE CONSEQUENCE IS GONE...
    expect(recordGateOf(old, olderPerson.id, old.tick)).toBe('none')
    // ...AND THE HISTORY IS NOT. The conviction is still on the file, and
    // still says what it always said.
    const sealed = old.criminal.get(olderPerson.id)?.convictions ?? []
    expect(sealed.some((c) => c.kind === 'shoplifting'), 'the conviction left the file').toBe(true)
    for (const conviction of sealed) {
      expect(conviction.sealed, `${conviction.kind} was not sealed`).toBe(true)
      expect(gateStrengthOf(conviction, old.tick)).toBe('none')
    }
  })

  it('never seals the worst of it', () => {
    const world = createWorld(makeSeed(6602), 60)
    advanceTicks(world, 600)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person || person.householdId === null) throw new Error('nobody')
    const house = world.households.get(person.householdId)
    if (house) world.households.set(house.id, { ...house, savings: 500_000 as never })

    // Decades clean, and it does not matter.
    withConviction(world, person.id, 'murder-second', 40)
    expect(expungementBar(world, person.id, world.tick)).not.toBeNull()
    expect(petitionForExpungement(world, person.id, world.tick).sealed).toBe(0)
    // And it still bars every door it ever barred.
    expect(recordGateOf(world, person.id, world.tick)).toBe('hard')
  })
})
