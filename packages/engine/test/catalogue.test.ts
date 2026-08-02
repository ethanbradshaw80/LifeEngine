/**
 * The offence catalogue (C3 §8-§10).
 *
 * Data this size stops being readable by eye, so the invariants are here
 * instead: no duplicate ids, no backwards sentence ranges, no escalation
 * pointing at a charge that does not exist, no mandatory minimum above its
 * own ceiling, and every grade with a title somebody can read.
 */

import { describe, expect, it } from 'vitest'
import { GRADE_TITLES, isFelony, OFFENCES, offenceById } from '../src/content.js'

describe('the offence catalogue', () => {
  it('holds together', () => {
    const ids = OFFENCES.map((o) => o.id)
    expect(new Set(ids).size, 'a duplicate offence id').toBe(ids.length)

    for (const offence of OFFENCES) {
      expect(GRADE_TITLES[offence.grade], `${offence.id} has no grade title`).toBeDefined()
      expect(offence.minMonths, `${offence.id} sentence range is backwards`).toBeLessThanOrEqual(
        offence.maxMonths,
      )
      expect(offence.gainMin, `${offence.id} payoff range is backwards`).toBeLessThanOrEqual(
        offence.gainMax,
      )
      expect(offence.clearance, `${offence.id} clearance is not per-mille`).toBeLessThanOrEqual(1000)
      if (offence.escalatesTo !== undefined) {
        expect(
          offenceById(offence.escalatesTo),
          `${offence.id} escalates to ${offence.escalatesTo}, which does not exist`,
        ).toBeDefined()
      }
      if (offence.mandatoryMin !== undefined) {
        expect(
          offence.mandatoryMin,
          `${offence.id} has a mandatory minimum above its own ceiling`,
        ).toBeLessThanOrEqual(offence.maxMonths)
      }
    }
  })

  it('keeps the serious end serious and the ordinary end ordinary', () => {
    // A capital offence is a felony for every gate that asks.
    expect(isFelony('capital')).toBe(true)
    expect(isFelony('class-a-felony')).toBe(true)
    expect(isFelony('class-a-misdemeanor')).toBe(false)

    // Every violent charge is a felony or the top misdemeanor — nothing
    // violent hides at the bottom of the ladder where a fade would clear it
    // in a couple of years.
    for (const offence of OFFENCES.filter((o) => o.violent === true)) {
      expect(
        isFelony(offence.grade) || offence.grade === 'class-a-misdemeanor',
        `${offence.id} is violent but graded ${offence.grade}`,
      ).toBe(true)
    }

    // And a killing is never a misdemeanor.
    for (const id of ['murder-first', 'murder-second', 'felony-murder', 'voluntary-manslaughter']) {
      const offence = offenceById(id)
      expect(offence, `${id} is missing`).toBeDefined()
      expect(isFelony(offence?.grade ?? 'class-c-misdemeanor')).toBe(true)
    }
  })
})
