/**
 * A TOUR IS A PLACE AND AN ARC (owner's `combat_tours_revamp.md` §1, §4b).
 *
 * The spec's complaint was that a tour "reads like a slot machine of
 * popups" — and the reason was that nothing about it had a shape. Month
 * four was identical to month one, and a supply clerk's war was an
 * operator's war at lower volume.
 *
 * The claims: a tour has a middle and an end; tempo comes from the war
 * rather than from nothing; the tiers are genuinely different wars; and
 * nobody is ever perfectly safe.
 */

import { describe, expect, it } from 'vitest'
import type { EntityId } from '@life-engine/shared'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import {
  beatFor,
  contactChanceFor,
  monthContactChance,
  operationNameFor,
  phaseFor,
  severityBiasFor,
  tempoFor,
  tempoWords,
  tierFor,
} from '../src/tours.js'
import type { IntensityTier } from '../src/tours.js'

describe('a tour has an arc', () => {
  it('runs arrival, grind, the defining event, wind-down, home — in that order', () => {
    const seen: string[] = []
    for (let month = 0; month <= 12; month += 1) {
      const beat = beatFor(month, 12)
      if (seen[seen.length - 1] !== beat) seen.push(beat)
    }
    expect(seen[0]).toBe('arrival')
    expect(seen[seen.length - 1]).toBe('home')
    expect(seen).toContain('grind')
    expect(seen).toContain('defining')
    expect(seen).toContain('winddown')
  })

  it('the defining event is not the last thing that happens', () => {
    // A tour has to go on afterwards, or the wind-down means nothing —
    // coming home the week after the worst day of your life is a different
    // thing from carrying it for a season first.
    const defining = [...Array(14).keys()].filter((m) => beatFor(m, 14) === 'defining')
    const after = [...Array(14).keys()].filter((m) => beatFor(m, 14) === 'winddown')
    expect(defining.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(0)
    expect(Math.max(...after)).toBeGreaterThan(Math.max(...defining))
  })

  it('the beats are not the same month twice over', () => {
    const arrival = phaseFor('arrival').contactPerMille
    const grind = phaseFor('grind').contactPerMille
    const defining = phaseFor('defining').contactPerMille
    const winddown = phaseFor('winddown').contactPerMille
    const home = phaseFor('home').contactPerMille
    // The defining stretch is the heaviest, and going home is the lightest.
    expect(defining).toBeGreaterThan(grind)
    expect(grind).toBeGreaterThan(winddown)
    expect(winddown).toBeGreaterThan(home)
    // Arrival is dangerous for a reason that is not drama: the ground is
    // unlearned and two units are in the same place.
    expect(arrival).toBeGreaterThan(winddown)
  })

  it('every beat has words somebody could read', () => {
    for (const beat of ['arrival', 'grind', 'defining', 'winddown', 'home'] as const) {
      const phase = phaseFor(beat)
      expect(phase.title.length, beat).toBeGreaterThan(3)
      expect(phase.words.length, beat).toBeGreaterThan(40)
    }
  })
})

describe('the tiers are different wars, not volumes of the same one', () => {
  it('a rear job, a support job, combat arms, and a special unit — in that order', () => {
    const tempo = 500
    const rear = contactChanceFor(0, tempo)
    const support = contactChanceFor(1, tempo)
    const arms = contactChanceFor(2, tempo)
    const special = contactChanceFor(3, tempo)
    expect(support).toBeGreaterThan(rear)
    expect(arms).toBeGreaterThan(support)
    expect(special).toBeGreaterThan(arms)
    // The spec's own words: a player who picks the special-unit path
    // "should feel the difference immediately".
    expect(special).toBeGreaterThan(rear * 5)
  })

  it('and it goes harder as well as more often', () => {
    expect(severityBiasFor(3)).toBeGreaterThan(severityBiasFor(2))
    expect(severityBiasFor(2)).toBeGreaterThan(severityBiasFor(1))
    expect(severityBiasFor(0)).toBe(0)
  })

  it('NOBODY IS SAFE — a rocket does not check your job', () => {
    // The floor is the point. A clerk on a quiet tour is unlikely to be in
    // contact and is never impossible to be.
    for (const tier of [0, 1, 2, 3] as const) {
      expect(contactChanceFor(tier, 60), `tier ${String(tier)}`).toBeGreaterThan(0)
      expect(monthContactChance(tier, 60, 'home'), `tier ${String(tier)}`).toBeGreaterThan(0)
    }
  })

  it('nor is anybody certain to be in contact', () => {
    // A month in which contact is guaranteed is not a war, it is a
    // treadmill.
    for (const tier of [0, 1, 2, 3] as const) {
      expect(monthContactChance(tier as IntensityTier, 1_000, 'defining')).toBeLessThan(1_000)
    }
  })

  it('the tier is read off the job rather than a hand-kept list', () => {
    expect(tierFor(900, false)).toBe(2)
    expect(tierFor(400, false)).toBe(1)
    expect(tierFor(100, false)).toBe(0)
    // A special unit outranks everything — that IS the tier.
    expect(tierFor(100, true)).toBe(3)
    expect(tierFor(900, true)).toBe(3)
  })
})

describe('tempo comes from the war', () => {
  it('a bad war makes a hot tour', () => {
    const world = createWorld(makeSeed(21))
    const hot: number[] = []
    const quiet: number[] = []
    for (let i = 0; i < 400; i += 1) {
      hot.push(tempoFor(world, i as never, (500 + i) as EntityId, 1, 900))
      quiet.push(tempoFor(world, i as never, (500 + i) as EntityId, 1, 200))
    }
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(hot)).toBeGreaterThan(mean(quiet))
  })

  it('and two people in the same war still get different tours', () => {
    const world = createWorld(makeSeed(21))
    const seen = new Set<number>()
    for (let i = 0; i < 200; i += 1) seen.add(tempoFor(world, 40 as never, (700 + i) as EntityId, 1, 600))
    // A theatre is not one place.
    expect(seen.size).toBeGreaterThan(20)
  })

  it('tempo always has words, at every setting', () => {
    for (const tempo of [0, 100, 200, 400, 600, 800, 1_000]) {
      expect(tempoWords(tempo).length, String(tempo)).toBeGreaterThan(4)
    }
  })
})

describe('the operation has a name', () => {
  it('a fictional one, and a stable one', () => {
    // Fictional per the spec's own §1 — the conflicts are invented, and an
    // invented war under a real operation's name would put words in the
    // mouths of people who were actually there.
    const name = operationNameFor(1234)
    expect(name.startsWith('Operation ')).toBe(true)
    expect(name.split(' ').length).toBe(3)
    // Same input, same name: a tour does not get renamed on reload.
    expect(operationNameFor(1234)).toBe(name)
  })

  it('and different tours get different names', () => {
    const names = new Set([...Array(60).keys()].map((i) => operationNameFor(i * 37)))
    expect(names.size).toBeGreaterThan(10)
  })
})
