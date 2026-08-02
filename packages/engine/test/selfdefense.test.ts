/**
 * Justified force (C3 §14–§15).
 *
 * The part players get wrong, and the doc insists on: using force on
 * somebody in your house does NOT automatically clear you. The state
 * decides whether to charge it, and a trial weighs the circumstances.
 */

import { describe, expect, it } from 'vitest'
import { justificationOf } from '../src/crime.js'

describe('a claim of self-defense', () => {
  it('is strongest at home against an armed intruder', () => {
    const strong = justificationOf({
      inTheHome: true,
      intruderArmed: true,
      intruderFleeing: false,
      lethal: true,
    })
    const weak = justificationOf({
      inTheHome: false,
      intruderArmed: false,
      intruderFleeing: false,
      lethal: true,
    })
    expect(strong).toBeGreaterThan(weak)
    expect(strong).toBeGreaterThan(700)
  })

  it('collapses when they were running away', () => {
    // Shooting somebody in the back as they leave is not defence of
    // anything, and the law is not sentimental about it.
    const standing = justificationOf({
      inTheHome: true,
      intruderArmed: true,
      intruderFleeing: false,
      lethal: true,
    })
    const fleeing = justificationOf({
      inTheHome: true,
      intruderArmed: true,
      intruderFleeing: true,
      lethal: true,
    })
    expect(fleeing).toBeLessThan(standing)
    expect(standing - fleeing).toBeGreaterThanOrEqual(400)
  })

  it('is weaker for killing over property alone', () => {
    const overProperty = justificationOf({
      inTheHome: true,
      intruderArmed: false,
      intruderFleeing: false,
      lethal: true,
    })
    const againstAWeapon = justificationOf({
      inTheHome: true,
      intruderArmed: true,
      intruderFleeing: false,
      lethal: true,
    })
    expect(overProperty).toBeLessThan(againstAWeapon)
  })

  it('never reaches certainty in either direction', () => {
    // No automatic pass and no automatic conviction — that is the whole
    // design of an affirmative defence.
    for (const inTheHome of [true, false]) {
      for (const intruderArmed of [true, false]) {
        for (const intruderFleeing of [true, false]) {
          for (const lethal of [true, false]) {
            const score = justificationOf({ inTheHome, intruderArmed, intruderFleeing, lethal })
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1000)
          }
        }
      }
    }
  })
})
