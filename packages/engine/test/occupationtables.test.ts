/**
 * TWO OCCUPATION TABLES, ONE NAMESPACE.
 *
 * The owner's career paths and the old M-CAREER tracks are two models of the
 * same careers, so nine ids appear in both — `teacher`, `accountant`,
 * `sergeant`, `partner` and five more. That is allowed. What is not allowed
 * is either table quietly changing what the other one means.
 *
 * Both failures below were REAL and were found by a test rather than by
 * reading: a plain schoolteacher recorded as standing on rung 2 of a ladder
 * they never joined, and nine of the town's wages silently repriced because
 * the rung table was concatenated second.
 */

import { describe, expect, it } from 'vitest'
import { OCCUPATIONS, PATH_OCCUPATIONS, occupationById, rungPlaceOf } from '../src/content.js'
import { FIRST_SLICE } from '../src/pathcontent.js'

describe('the ladders do not redefine the town', () => {
  it('never moves a wage the town already set', () => {
    /**
     * A law partner's band moved from $1,458-2,396 to $3,300-4,033 the
     * moment rungs joined the table, because `[...OCCUPATIONS, ...RUNGS]`
     * lets the later entry win. Nothing said so. Every save in existence
     * was written against the town's numbers.
     */
    for (const town of OCCUPATIONS) {
      const looked = occupationById(town.id)
      expect(looked.minMonthlyPay, `${town.id} was repriced by the ladders`).toBe(town.minMonthlyPay)
      expect(looked.maxMonthlyPay, `${town.id} was repriced by the ladders`).toBe(town.maxMonthlyPay)
      expect(looked.title).toBe(town.title)
      expect(looked.requires).toBe(town.requires)
    }
  })

  it('never claims one of the town’s jobs for a ladder', () => {
    // `rungPlaceOf` decides whether being hired puts somebody on a path.
    // Answering yes for `teacher` put schoolteachers on the teaching ladder
    // at rung 2, which is both untrue and a senior seat handed out free.
    for (const town of OCCUPATIONS) {
      expect(rungPlaceOf(town.id), `${town.id} is claimed by a ladder`).toBeUndefined()
    }
  })

  it('still knows every rung that is a ladder’s alone', () => {
    // The other half of the guard: excluding the collisions must not
    // exclude the other three hundred.
    const claimed = FIRST_SLICE.flatMap((path) => path.levels)
      .filter((level) => !OCCUPATIONS.some((o) => o.id === level.id))
      .filter((level) => rungPlaceOf(level.id) === undefined)
    expect(claimed, 'rungs the engine no longer recognises').toEqual([])
  })

  it('gives every rung a real wage and a readable name', () => {
    // Why rungs had to become first-class at all: an unknown occupation
    // falls back to a synthetic that pays ZERO, and `considerBetterJob`
    // ranks by pay — so every job in town read as a raise and pulled people
    // off their ladders.
    for (const rung of PATH_OCCUPATIONS) {
      const looked = occupationById(rung.id)
      expect(looked.maxMonthlyPay, `${rung.id} pays nothing`).toBeGreaterThan(0)
      expect(looked.minMonthlyPay).toBeLessThanOrEqual(looked.maxMonthlyPay)
    }
  })
})
