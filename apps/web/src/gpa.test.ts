/**
 * The report card (education master §2).
 *
 * `attainment` is stored 0-1000 and stays that way — integer state, one
 * scale, no floats in the save. This is the presentation of it, and a
 * grade scale is exactly the sort of mapping that is silently wrong at
 * the edges for years.
 */

import { describe, expect, it } from 'vitest'
import { gpaOf } from './GameScreen.js'

describe('the report card', () => {
  it('runs the whole scale from nothing to full marks', () => {
    expect(gpaOf(0)).toEqual({ figure: '0.0', letter: 'F' })
    expect(gpaOf(1000)).toEqual({ figure: '4.0', letter: 'A' })
  })

  it('puts the letters on the boundaries a person expects', () => {
    // Anybody who has seen a report card should be able to read this one
    // without being taught the scale.
    expect(gpaOf(875).letter).toBe('A') // 3.5
    expect(gpaOf(860).letter).toBe('B') // 3.4
    expect(gpaOf(625).letter).toBe('B') // 2.5
    expect(gpaOf(610).letter).toBe('C') // 2.4
    expect(gpaOf(375).letter).toBe('C') // 1.5
    expect(gpaOf(360).letter).toBe('D') // 1.4
    expect(gpaOf(250).letter).toBe('D') // 1.0
    expect(gpaOf(230).letter).toBe('F') // 0.9
  })

  it('never reads outside the scale, whatever it is handed', () => {
    // The store is clamped, but a display that can print 5.3 because
    // something upstream slipped is worse than one that cannot.
    expect(gpaOf(-500)).toEqual({ figure: '0.0', letter: 'F' })
    expect(gpaOf(99_999)).toEqual({ figure: '4.0', letter: 'A' })
  })

  it('always shows one decimal place, so the column does not jump', () => {
    for (const value of [0, 125, 250, 500, 750, 1000]) {
      expect(gpaOf(value).figure).toMatch(/^\d\.\d$/)
    }
  })
})
