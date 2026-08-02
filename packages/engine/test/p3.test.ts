/**
 * P3 — the surfaces. What the tabs read, tested where the tabs cannot be.
 *
 * The ledger's arithmetic lives in finances.test.ts (it belongs beside the
 * functions it decomposes). This file covers the wording layer: temperament
 * in words, which is engine text and therefore engine-tested.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld, describeTraits, traitWords } from '../src/index.js'
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
