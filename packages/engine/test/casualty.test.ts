/**
 * GETTING HIT DOES NOT MEAN GOING HOME (owner's `combat_tours_revamp.md`
 * §5, §5d).
 *
 * The spec puts this in bold and calls it "the key realism the owner
 * called out": the large majority of wounds are tiers 1-3 and end in
 * return to duty. Only tier 4+ leaves the theatre. A soldier can be
 * wounded three or four times across a career and keep serving; the
 * tour-ending wound is the exception, not the default.
 *
 * If that stops being true, a career becomes one hit.
 */

import { describe, expect, it } from 'vitest'
import {
  EVACUATES_AT,
  TIER_WORDS,
  careShiftFor,
  endsTheTour,
  evacMinutesFor,
  meritsWoundRecognition,
  permanentDisabilityFrom,
  resolveCasualty,
  returnsToDuty,
} from '../src/casualty.js'
import type { WoundTier } from '../src/casualty.js'

function spread(minutes: number, armour = true): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (let roll = 0; roll < 6_000; roll += 1) {
    const c = resolveCasualty('shrapnel', 'leg', minutes, armour, roll)
    counts[c.tier] = (counts[c.tier] ?? 0) + 1
  }
  return counts
}

describe('most wounds send you back to the fight', () => {
  it('the large majority are tiers one to three', () => {
    const counts = spread(45)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const rtd = (counts[1] ?? 0) + (counts[2] ?? 0) + (counts[3] ?? 0)
    // "The tour-ending wound is the EXCEPTION, not the default outcome of
    // taking fire."
    expect(rtd / total).toBeGreaterThan(0.75)
  })

  it('and the ones that end a tour are the minority', () => {
    const counts = spread(45)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const out = (counts[4] ?? 0) + (counts[5] ?? 0) + (counts[6] ?? 0)
    expect(out / total).toBeLessThan(0.25)
    // But never zero — the exception has to be able to happen.
    expect(out).toBeGreaterThan(0)
  })

  it('the line is drawn in exactly one place', () => {
    expect(EVACUATES_AT).toBe(4)
    for (const tier of [1, 2, 3] as const) {
      expect(returnsToDuty(tier), String(tier)).toBe(true)
      expect(endsTheTour(tier), String(tier)).toBe(false)
    }
    for (const tier of [4, 5, 6] as const) {
      expect(returnsToDuty(tier), String(tier)).toBe(false)
      expect(endsTheTour(tier), String(tier)).toBe(true)
    }
  })

  it('a soldier can be hit repeatedly and keep serving', () => {
    // Four separate woundings; the odds of all four ending the tour must
    // be small, or a career is one hit.
    let survivedAllFour = 0
    for (let seed = 0; seed < 500; seed += 1) {
      const hits = [0, 1, 2, 3].map((i) =>
        resolveCasualty('shrapnel', 'arm', 40, true, seed * 7 + i * 1_301),
      )
      if (hits.every((h) => !h.evacuated)) survivedAllFour += 1
    }
    expect(survivedAllFour / 500).toBeGreaterThan(0.3)
  })
})

describe('the chain decides which', () => {
  it('reaching a surgical team fast pulls the outcome down the tiers', () => {
    const fast = spread(15)
    const slow = spread(180)
    const badFast = (fast[4] ?? 0) + (fast[5] ?? 0) + (fast[6] ?? 0)
    const badSlow = (slow[4] ?? 0) + (slow[5] ?? 0) + (slow[6] ?? 0)
    // The golden hour is real, and it is why medevac exists.
    expect(badSlow).toBeGreaterThan(badFast)
  })

  it('the care shift rewards speed and punishes distance', () => {
    expect(careShiftFor(15)).toBeLessThan(0)
    expect(careShiftFor(45)).toBeLessThan(0)
    expect(careShiftFor(90)).toBeGreaterThan(0)
    expect(careShiftFor(240)).toBeGreaterThan(careShiftFor(90))
  })

  it('a hot landing zone makes the wait longer, which is the cruel part', () => {
    // A bird will not come into fire, so the worse the fight the longer
    // the wait — exactly backwards from what the casualty needs.
    expect(evacMinutesFor(900, false, 0)).toBeGreaterThan(evacMinutesFor(100, false, 0))
  })

  it('and a medic on the ground shortens it', () => {
    expect(evacMinutesFor(500, true, 0)).toBeLessThan(evacMinutesFor(500, false, 0))
  })

  it('body armour is why torso wounds became survivable', () => {
    const withArmour = resolveCasualty('gunshot', 'chest', 45, true, 3_000)
    const without = resolveCasualty('gunshot', 'chest', 45, false, 3_000)
    expect(withArmour.tier).toBeLessThanOrEqual(without.tier)
  })

  it('where somebody is hit matters more than almost anything', () => {
    const head = spread(45)
    let headBad = 0
    for (let roll = 0; roll < 6_000; roll += 1) {
      if (resolveCasualty('gunshot', 'head', 45, true, roll).tier >= 4) headBad += 1
    }
    let handBad = 0
    for (let roll = 0; roll < 6_000; roll += 1) {
      if (resolveCasualty('gunshot', 'hand', 45, true, roll).tier >= 4) handBad += 1
    }
    expect(headBad).toBeGreaterThan(handBad)
    void head
  })
})

describe('what a wound leaves behind', () => {
  it('a near miss is not a wound and everything else is', () => {
    expect(meritsWoundRecognition(1)).toBe(false)
    for (const tier of [2, 3, 4, 5, 6] as const) {
      expect(meritsWoundRecognition(tier), String(tier)).toBe(true)
    }
  })

  it('only the permanent ones leave a disability', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      expect(permanentDisabilityFrom(tier, 'leg'), String(tier)).toBe(0)
    }
    expect(permanentDisabilityFrom(5, 'leg')).toBeGreaterThan(0)
    // A spine is not an ankle.
    expect(permanentDisabilityFrom(5, 'back')).toBeGreaterThan(
      permanentDisabilityFrom(5, 'hand'),
    )
  })

  it('every tier has words, and going down costs time', () => {
    for (const tier of [1, 2, 3, 4, 5, 6] as const) {
      expect(TIER_WORDS[tier as WoundTier].length, String(tier)).toBeGreaterThan(3)
    }
    expect(resolveCasualty('gunshot', 'leg', 45, true, 0).words.length).toBeGreaterThan(20)
  })
})
