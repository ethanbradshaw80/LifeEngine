/**
 * RE CODES — coming back (owner: "thats why we have RE codes so that
 * people who get out at say 8 years and then want to reenlist can join
 * another branch and stuff. But if you have an RE4 or 3 the recruiter
 * should deny you").
 *
 * Before this the engine said "one service career per life" and meant it:
 * somebody who got out at eight years could never serve again, in any
 * branch, for any reason.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { reCodeAllowsReturn, reCodeFor } from '../src/service.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 60 * 12)

describe('what the papers say about coming back', () => {
  it('bars the endings that should bar, and no others', () => {
    expect(reCodeFor('misconduct')).toBe(4)
    expect(reCodeFor('barred from reenlistment')).toBe(4)
    expect(reCodeFor('medical')).toBe(4)
    expect(reCodeFor('medically-unfit')).toBe(4)
    // Ran out of runway at a rank is not the same as ending badly.
    expect(reCodeFor('high-year tenure')).toBe(2)
    expect(reCodeFor('time-in-grade')).toBe(2)
    // Served the term, or the whole career.
    expect(reCodeFor('end of term')).toBe(1)
    expect(reCodeFor('twenty years served')).toBe(1)
  })

  it('turns away a 3 or a 4 and takes a 1 or a 2', () => {
    // The owner's ruling: a 3 is denied at the desk, waiver or no waiver.
    expect(reCodeAllowsReturn(1)).toBe(true)
    expect(reCodeAllowsReturn(2)).toBe(true)
    expect(reCodeAllowsReturn(3)).toBe(false)
    expect(reCodeAllowsReturn(4)).toBe(false)
  })

  it('reads a record written before any of this as clean', () => {
    // Refusing somebody on the strength of a field their save never had
    // would be inventing a black mark.
    expect(reCodeAllowsReturn(undefined)).toBe(true)
  })

  it('stamps a code on every separation the discharge path handles', () => {
    let stamped = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick === null) continue
      // 'died in service' closes a record without going through the
      // discharge paperwork, and a dead soldier has no RE code — which is
      // right, and is why this counts rather than requiring.
      if (record.dischargeReason === 'died in service') continue
      expect(record.reCode).toBeDefined()
      stamped += 1
    }
    expect(stamped).toBeGreaterThan(20)
  })
})

describe('going back in', () => {
  it('actually happens', () => {
    // MEASURED at zero on the first attempt: the bar was fixed and a
    // SECOND door — a blanket `if (record) continue` in the enlistment
    // loop — was still bolted behind it. A rule can be right and never
    // fire, which is why this pins the outcome and not the rule.
    const returned = [...world.service.values()].filter(
      (record) => (record.priorTerms ?? []).length > 0,
    )
    expect(returned.length).toBeGreaterThan(0)
  })

  it('lets somebody sign with a different branch', () => {
    // The owner's words: "can join another branch and stuff".
    const switched = [...world.service.values()].filter((record) =>
      (record.priorTerms ?? []).some((term) => term.branch !== record.branch),
    )
    expect(switched.length).toBeGreaterThan(0)
  })

  it('never lets a barred record back in', () => {
    for (const record of world.service.values()) {
      for (const term of record.priorTerms ?? []) {
        // Every term they served before this one must have ended in a way
        // that allowed a return. A 4 in the history means the recruiter
        // took somebody they had refused.
        expect(reCodeAllowsReturn(term.reCode)).toBe(true)
      }
    }
  })

  it('never loses the career that came before', () => {
    // world.service holds ONE record per person, so a second enlistment
    // would otherwise overwrite the first — and that record is the
    // artifact a descendant finds three generations on.
    for (const record of world.service.values()) {
      for (const term of record.priorTerms ?? []) {
        expect(term.dischargedAtTick).toBeGreaterThan(term.enlistedAtTick)
        expect(term.branch.length).toBeGreaterThan(0)
        expect(term.dischargeReason.length).toBeGreaterThan(0)
      }
    }
  })
})
