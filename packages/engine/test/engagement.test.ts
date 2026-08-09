/**
 * AN ENGAGEMENT IS A SEQUENCE (owner's `combat_tours_revamp.md` §3).
 *
 * The claims: length scales with stakes; the outcome is decided at contact
 * and carried rather than re-rolled; and the follow-on beat — the one that
 * is about a person rather than the ground — only appears in the worst of
 * them.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import {
  afterActionWords,
  beatsFor,
  consequenceWords,
  decodeEngagement,
  encodeEngagement,
  engagementRoll,
  followOnFor,
  orientWords,
} from '../src/engagement.js'

describe('length scales with stakes', () => {
  it('a near-miss is short and the worst of them is long', () => {
    const light = beatsFor('light', false)
    const heavy = beatsFor('heavy', false)
    const overrun = beatsFor('overrun', false)
    expect(light.length).toBeLessThan(heavy.length)
    expect(heavy.length).toBeLessThan(overrun.length)
    // A model that made every contact a five-part sequence would be the
    // popup problem again, slower.
    expect(light.length).toBeLessThanOrEqual(3)
  })

  it('every sequence opens on contact and closes on the after-action', () => {
    for (const threat of ['light', 'heavy', 'overrun'] as const) {
      for (const defining of [false, true]) {
        const beats = beatsFor(threat, defining)
        expect(beats[0], `${threat}/${String(defining)}`).toBe('contact')
        expect(beats[beats.length - 1], `${threat}/${String(defining)}`).toBe('after')
        expect(beats).toContain('decision')
      }
    }
  })

  it('the defining event of a tour is never the short shape', () => {
    expect(beatsFor('light', true).length).toBeGreaterThan(beatsFor('light', false).length)
  })

  it('the follow-on only appears in the worst of them', () => {
    // The beat that is about a person rather than the ground.
    expect(beatsFor('light', false)).not.toContain('followon')
    expect(beatsFor('heavy', false)).not.toContain('followon')
    expect(beatsFor('overrun', false)).toContain('followon')
  })
})

describe('the sequence survives the round trip', () => {
  it('encodes and decodes without losing anything', () => {
    const beats = beatsFor('overrun', false)
    const encoded = encodeEngagement('pinned', 'overrun', 2, beats, 'push', 417)
    const back = decodeEngagement(encoded)
    expect(back).not.toBeNull()
    if (back === null) return
    expect(back.sceneId).toBe('pinned')
    expect(back.threat).toBe('overrun')
    expect(back.step).toBe(2)
    expect(back.beats).toEqual(beats)
    expect(back.firstChoice).toBe('push')
    expect(back.seedRoll).toBe(417)
  })

  it('carries "no choice yet" as a real state rather than a guess', () => {
    const back = decodeEngagement(encodeEngagement('x', 'light', 0, ['contact'], null, 5))
    expect(back?.firstChoice).toBeNull()
  })

  it('a malformed pending decodes to nothing rather than a wrong engagement', () => {
    expect(decodeEngagement(null)).toBeNull()
    expect(decodeEngagement('')).toBeNull()
  })
})

describe('the roll is drawn once and carried', () => {
  it('the same contact is the same contact however many times it is asked', () => {
    const world = createWorld(makeSeed(8))
    const a = engagementRoll(world, 30 as never, 900, 4)
    const b = engagementRoll(world, 30 as never, 900, 4)
    // Choices bend the seed; they never re-roll it. Without this a player
    // could reload for a better firefight and the choices would stop being
    // choices.
    expect(a).toBe(b)
  })

  it('and different contacts are different', () => {
    const world = createWorld(makeSeed(8))
    const seen = new Set<number>()
    for (let i = 0; i < 200; i += 1) seen.add(engagementRoll(world, 30 as never, 900, i))
    expect(seen.size).toBeGreaterThan(50)
  })
})

describe('the beats say something', () => {
  it('what somebody notices depends on how good they are', () => {
    const sharp = orientWords('heavy', 800, true)
    const green = orientWords('heavy', 200, true)
    expect(sharp).not.toBe(green)
    expect(sharp.length).toBeGreaterThan(30)
    expect(green.length).toBeGreaterThan(20)
  })

  it('and on whether anybody can hear you', () => {
    expect(orientWords('heavy', 800, true)).not.toBe(orientWords('heavy', 800, false))
  })

  it('a consequence is felt before the next decision is made', () => {
    for (const choice of ['push', 'hold', 'cover'] as const) {
      for (const good of [true, false]) {
        const words = consequenceWords(choice, good, 'heavy')
        expect(words.length, `${choice}/${String(good)}`).toBeGreaterThan(20)
      }
      // Going well and going badly must not read the same.
      expect(consequenceWords(choice, true, 'heavy')).not.toBe(
        consequenceWords(choice, false, 'heavy'),
      )
    }
  })

  it('the follow-on is about a person, and a leader spends other people', () => {
    const asMan = followOnFor('Doc', false)
    const asLeader = followOnFor('Doc', true)
    expect(asMan.tell).toContain('Doc')
    // "The worst decisions in the game should be the ones where the right
    // tactical answer costs you someone you know."
    expect(asLeader.tell).toContain("other people's lives")
    expect(asLeader.labels.hold).toContain('Send')
    expect(asMan.labels.hold).not.toContain('Send')
  })

  it('the after-action counts up, and says so plainly', () => {
    expect(afterActionWords('overrun', 2, 1)).toContain('2 killed')
    expect(afterActionWords('heavy', 0, 3)).toContain('3 hit')
    expect(afterActionWords('light', 0, 0)).toContain('obody hurt')
  })
})
