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
  decodeSequence,
  encodeSequence,
  beatAt,
  beatAsks,
  whoIsDown,
  followOnOdds,
  followOnWords,
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


describe('the sequence rides on the scene encoding', () => {
  it('appending beats does not break an old pending', () => {
    // decodeScene reads only the first two segments, which is why the
    // sequence could be added without a new pending kind.
    const withSeq = encodeSequence('pinned', 'heavy', 2, ['contact', 'decision', 'after'])
    expect(withSeq.startsWith('pinned:heavy')).toBe(true)
    const seq = decodeSequence(withSeq)
    expect(seq.step).toBe(2)
    expect(seq.beats.length).toBe(3)
  })

  it('a pending from before engagements existed is one decision', () => {
    // The old format, exactly as it was written.
    const old = decodeSequence('pinned:heavy')
    expect(old.step).toBe(0)
    // Never zero beats — a sequence with nothing in it renders an empty
    // screen and swallows the moment.
    expect(old.beats).toEqual(['decision'])
    expect(beatAsks(beatAt(old.beats, 0))).toBe(true)
  })

  it('only the decision beats ask anything', () => {
    expect(beatAsks('contact')).toBe(false)
    expect(beatAsks('orient')).toBe(false)
    expect(beatAsks('consequence')).toBe(false)
    expect(beatAsks('after')).toBe(false)
    // The outcome must fire exactly once, on a beat that actually asks.
    expect(beatAsks('decision')).toBe(true)
    expect(beatAsks('followon')).toBe(true)
  })

  it('every sequence contains exactly one plain decision', () => {
    for (const threat of ['light', 'heavy', 'overrun']) {
      for (const defining of [false, true]) {
        const beats = beatsFor(threat, defining)
        const asks = beats.filter((b) => b === 'decision')
        expect(asks.length, threat + String(defining)).toBe(1)
      }
    }
  })

  it('beatAt is total — it never walks off either end', () => {
    const beats = beatsFor('overrun', false)
    expect(beatAt(beats, -5)).toBe(beats[0])
    expect(beatAt(beats, 999)).toBe(beats[beats.length - 1])
    expect(beatAt([], 0)).toBe('decision')
  })
})


describe('the follow-on is its own question', () => {
  it('the outcome beat is the decision ALONE, not anything that asks', () => {
    // THE BUG THIS PINS, which shipped and had to be fixed: the resolver
    // guarded on `beatAsks`, which is true for the follow-on too — so in
    // an overrun sequence the scene outcome, INCLUDING THE WOUND AND DEATH
    // MATRIX, fired twice. One firefight, two rolls for a life.
    //
    // The earlier test asserted every sequence holds exactly one plain
    // decision. True, and never the property the guard used.
    const overrun = beatsFor('overrun', false)
    const asking = overrun.filter((b) => beatAsks(b))
    expect(asking.length).toBeGreaterThan(1)
    // Which is exactly why `beatAsks` must not be what decides whether the
    // scene outcome runs.
    expect(overrun.filter((b) => b === 'decision').length).toBe(1)
    expect(overrun.filter((b) => b === 'followon').length).toBe(1)
  })

  it('names the same man to the screen and to the resolver', () => {
    const team = [
      { personId: 1, nickname: 'Doc' },
      { personId: 2, nickname: 'Tex' },
      { personId: 3, nickname: 'Ghost' },
    ]
    // Both sides read from the same roll; two draws would put one name in
    // the question and another in the outcome.
    for (const roll of [0, 5, 17, 998]) {
      expect(whoIsDown(team, roll)?.nickname).toBe(whoIsDown(team, roll)?.nickname)
    }
    expect(whoIsDown([], 3)).toBeNull()
  })

  it('none of the three answers is free', () => {
    for (const choice of ['push', 'hold', 'cover']) {
      const odds = followOnOdds(choice, false)
      expect(odds.heLives, choice).toBeGreaterThan(0)
      expect(odds.heLives, choice).toBeLessThan(1000)
    }
    // Going out gives him the best chance and costs you the most.
    expect(followOnOdds('push', false).heLives).toBeGreaterThan(followOnOdds('cover', false).heLives)
    expect(followOnOdds('push', false).youAreHit).toBeGreaterThan(followOnOdds('cover', false).youAreHit)
  })

  it('a leader sending two men is safer for HIM, not safer', () => {
    const asLeader = followOnOdds('hold', true)
    const asMan = followOnOdds('hold', false)
    // The command weight the design has wanted: your risk drops and
    // somebody else picks it up.
    expect(asLeader.youAreHit).toBeLessThan(asMan.youAreHit)
    expect(asLeader.anotherIsHit).toBeGreaterThan(0)
    expect(asMan.anotherIsHit).toBe(0)
  })

  it('holding everybody back is the safe one and it mostly kills him', () => {
    const odds = followOnOdds('cover', false)
    expect(odds.youAreHit).toBeLessThan(100)
    expect(odds.heLives).toBeLessThan(400)
  })

  it('and it says so either way, without letting anybody off', () => {
    expect(followOnWords('cover', 'Doc', false)).toContain('Doc')
    // "You were not wrong and it does not help."
    expect(followOnWords('cover', 'Doc', false).length).toBeGreaterThan(40)
    expect(followOnWords('push', 'Doc', true)).toContain('alive')
  })
})
