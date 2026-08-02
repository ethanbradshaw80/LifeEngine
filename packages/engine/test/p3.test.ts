/**
 * P3 — the surfaces. What the tabs read, tested where the tabs cannot be.
 *
 * The ledger's arithmetic lives in finances.test.ts (it belongs beside the
 * functions it decomposes). This file covers the wording layer: temperament
 * in words, which is engine text and therefore engine-tested.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import {
  advanceTicks,
  ageAt,
  createWorld,
  describeTraits,
  lookForPlace,
  moveBar,
  placesOfKind,
  setPlayer,
  traitWords,
} from '../src/index.js'
import type { Traits } from '../src/types.js'

function traits(overrides: Partial<Traits>): Traits {
  return {
    sociability: 500,
    diligence: 500,
    ambition: 500,
    resilience: 500,
    curiosity: 500,
    vitality: 500,
    ...overrides,
  }
}

describe('temperament in words', () => {
  it('says nothing about a person with nothing that stands out', () => {
    expect(traitWords(traits({}))).toEqual([])
    expect(describeTraits(traits({}))).toBe('')
  })

  it('names the notable traits at both ends', () => {
    expect(traitWords(traits({ diligence: 900 }))).toEqual(['diligent'])
    expect(traitWords(traits({ diligence: 60 }))).toEqual(['easy-going'])
    expect(traitWords(traits({ vitality: 950 }))).toEqual(['hale'])
    expect(traitWords(traits({ vitality: 90 }))).toEqual(['frail'])
  })

  it('leads with the strongest, and never invents a middling one', () => {
    const words = traitWords(traits({ diligence: 700, ambition: 990, curiosity: 500 }))
    expect(words).toEqual(['ambitious', 'diligent'])
    expect(words).not.toContain('curious')
  })

  it('reads as a sentence would', () => {
    expect(describeTraits(traits({ ambition: 990 }))).toBe('ambitious')
    expect(describeTraits(traits({ ambition: 990, vitality: 900 }))).toBe('ambitious and hale')
    expect(describeTraits(traits({ ambition: 990, vitality: 900, sociability: 50 }))).toBe(
      'ambitious, private and hale',
    )
  })

  it('does not drift as a life is lived, and repeats across worlds', () => {
    const world = createWorld(makeSeed(4242), 60)
    const before = new Map(
      [...world.people.values()].map((p) => [p.id, describeTraits(p.traits)] as const),
    )
    advanceTicks(world, 240)
    // Traits are set at birth and never rewritten; twenty years of living
    // must not change a word, or the sheet would be lying about the person
    // the Why? texts keep citing.
    for (const person of world.people.values()) {
      const was = before.get(person.id)
      if (was !== undefined) expect(describeTraits(person.traits)).toBe(was)
    }

    const twin = createWorld(makeSeed(4242), 60)
    expect(new Map([...twin.people.values()].map((p) => [p.id, describeTraits(p.traits)] as const))).toEqual(
      before,
    )
  })

  it('describes a real town without describing everyone', () => {
    const world = createWorld(makeSeed(12345), 100)
    const people = [...world.people.values()]
    const described = people.filter((p) => describeTraits(p.traits) !== '')
    // Some stand out, most do not. Both halves matter: adjectives on
    // everybody would be noise, adjectives on nobody would be a dead feature.
    expect(described.length).toBeGreaterThan(5)
    expect(described.length).toBeLessThan(people.length)
  })
})

describe('the streets browser asks the engine for the whole gate', () => {
  it('refuses in the same words the verb would, for every reason it has', () => {
    // P3 review: the browser modelled affordability alone and claimed in a
    // comment to model all four gates, so a nineteen-year-old still at home
    // saw live buttons everywhere and was refused by all of them. moveBar is
    // now the single source of both answers — this test is the proof that
    // they cannot drift, because the same string has to come back twice.
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 60)
    const street = placesOfKind(world, 'neighbourhood')
      .slice()
      .sort((a, b) => a.desirability - b.desirability)[0]
    expect(street).toBeDefined()
    if (!street) return

    const child = [...world.people.values()]
      .filter((person) => person.deathTick === null && ageAt(person.birthTick, world.tick) < 18)
      .sort((a, b) => a.id - b.id)[0]
    expect(child).toBeDefined()
    if (!child) return

    setPlayer(world, child.id)
    const bar = moveBar(world, child.id, street.id, world.tick)
    expect(bar).not.toBeNull()
    expect(lookForPlace(world, street.id)).toEqual({ moved: false, reason: bar })
  })

  it('lets a grown householder look, and says so by returning nothing', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 360)
    const streets = placesOfKind(world, 'neighbourhood')
      .slice()
      .sort((a, b) => a.desirability - b.desirability)
    const cheapest = streets[0]
    expect(cheapest).toBeDefined()
    if (!cheapest) return

    // Somebody grown, in a household of their own, living somewhere other
    // than the cheapest street and earning enough to carry it.
    const mover = [...world.people.values()]
      .filter((person) => {
        if (person.deathTick !== null) return false
        if (ageAt(person.birthTick, world.tick) < 18) return false
        if (person.householdId === null) return false
        const household = world.households.get(person.householdId)
        if (!household || household.placeId === cheapest.id) return false
        if (person.parentIds.some((id) => household.memberIds.includes(id))) return false
        return world.employment.has(person.id)
      })
      .sort((a, b) => a.id - b.id)[0]
    expect(mover).toBeDefined()
    if (!mover) return

    setPlayer(world, mover.id)
    expect(moveBar(world, mover.id, cheapest.id, world.tick)).toBeNull()
    expect(lookForPlace(world, cheapest.id).moved).toBe(true)
  })
})
