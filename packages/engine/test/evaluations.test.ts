/**
 * THE ANNUAL EVALUATION (MILITARY_DEPTH_PLAN §10.2).
 *
 * A career is decided by a stack of reports somebody senior wrote about you,
 * and the engine had none: promotion read a single `performance` integer that
 * drifted on its own. Nobody wrote you up, nobody had it in for you, and
 * there was nothing to read back in thirty years.
 *
 * MEASURED at seed 4242 over forty years — 3,372 reports across 384 people —
 * one career reads like this, which is the whole point:
 *
 *     630 fully capable    by Gonzalez   (regard +120)
 *     745 among the best   by Wood       (regard  +92)
 *     532 satisfactory     by Dawson     (regard  -76)
 *     387 progressing      by Becker     (regard -116)
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { evaluationsOf, raterFor, regardBetween } from '../src/evaluations.js'
import { unitRosterOf } from '../src/service.js'
import { BRANCH_GRADES } from '../src/content.js'
import { decisionForEvent } from '../src/records.js'
import { explainDecision } from '../src/story.js'

describe('the annual evaluation', () => {
  it('is written by a named person who is senior to you', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)

    let checked = 0
    for (const record of world.service.values()) {
      const reports = evaluationsOf(world, record.personId)
      if (reports.length === 0) continue
      const last = reports[reports.length - 1]
      if (last === undefined || last.raterId === null) continue
      checked += 1
      // The rater is a real person, not the subject, and stood above them.
      expect(world.people.get(last.raterId), 'the rater is nobody').toBeDefined()
      expect(last.raterId).not.toBe(record.personId)
    }
    expect(checked, 'nobody in this world was ever rated').toBeGreaterThan(0)
  })

  it('keeps the same opinion of you year after year', () => {
    /**
     * THE POINT OF SEEDING ON THE PAIR. A rater who re-rolled every year would be
     * weather; one who does not is a fact about a posting. "The first sergeant
     * who has it in for you" only means something if he still has it in for
     * you next March.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)
    const someone = [...world.service.values()].find(
      (r) => r.dischargedAtTick === null && raterFor(world, r.personId) !== null,
    )
    expect(someone, 'nobody has a rater').toBeDefined()
    if (someone === undefined) return
    const rater = raterFor(world, someone.personId)
    if (rater === null) return

    const first = regardBetween(world, rater, someone.personId)
    advanceTicks(world, 36)
    expect(regardBetween(world, rater, someone.personId)).toBe(first)
  })

  it('explains itself, because it moves a career', () => {
    // Law 3, and the independent review asked for it by name: a report that
    // decides a promotion has to say what it was made of.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)
    const rated = world.events.find((e) => e.type === 'evaluated')
    expect(rated, 'no report was ever written').toBeDefined()
    if (rated === undefined) return
    const record = decisionForEvent(world, rated)
    expect(record, 'the report has no causal record behind it').not.toBeNull()
    if (record === null) return
    const why = explainDecision(world, record)
    expect(why.length, 'the report cannot say why it said that').toBeGreaterThan(0)
    // And the man who wrote it is one of the reasons.
    expect(record.inputs.some((f) => f.factor === 'rater-regard')).toBe(true)
  })

  it('a rater who dislikes you costs you, and one who rates you well pays', () => {
    /**
     * THE TEETH. An opinion nobody acts on is decoration, so the mark moves
     * the record — and across a whole force the people with well-disposed
     * raters must end up measurably ahead of the people without.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)

    /**
     * MEASURED OVER EVERYONE EVER RATED, not the survivors.
     *
     * A first version of this compared `performance` among people STILL
     * SERVING and reported the badly-rated as slightly ahead — 640 against
     * 626 — which looked like the feature not working and was survivorship
     * instead: a weak man with a hostile rater is separated, so the ones left
     * carrying bad reports are the ones who were strong enough to survive
     * them. Being pushed out is part of what a bad rater costs, so it has to
     * be inside the measurement rather than filtered out of it.
     *
     * Measured this way at seed 4242 over forty years: mean mark 734 against
     * 610, and mean final rank 5.65 against 5.02.
     */
    let likedTotal = 0
    let likedCount = 0
    let dislikedTotal = 0
    let dislikedCount = 0
    for (const record of world.service.values()) {
      const reports = evaluationsOf(world, record.personId)
      if (reports.length < 3) continue
      // How the people who wrote about them felt, on average.
      let regard = 0
      let seen = 0
      for (const report of reports) {
        if (report.raterId === null) continue
        regard += regardBetween(world, report.raterId, record.personId)
        seen += 1
      }
      if (seen === 0) continue
      const average = regard / seen
      const meanMark = reports.reduce((sum, r) => sum + r.mark, 0) / reports.length
      if (average > 20) {
        likedTotal += meanMark
        likedCount += 1
      } else if (average < -20) {
        dislikedTotal += meanMark
        dislikedCount += 1
      }
    }
    expect(likedCount, 'nobody was well thought of').toBeGreaterThan(0)
    expect(dislikedCount, 'nobody was badly thought of').toBeGreaterThan(0)
    const liked = likedTotal / likedCount
    const disliked = dislikedTotal / dislikedCount
    expect(
      liked,
      `well-rated mean mark ${liked.toFixed(0)} vs badly-rated ${disliked.toFixed(0)}`,
    ).toBeGreaterThan(disliked)
  })

  it('rates sergeants and above, and nobody below', () => {
    /**
     * OWNER: "only SGT and above are receiving these evaluations". That is how
     * the real form works — below sergeant a soldier is counselled by his team
     * leader, which is a different piece of paper and does not decide a
     * career.
     *
     * E-5 is the line and the GRADE is the test, not the ladder index: SPC and
     * CPL are both E-4 and only one of them wears an NCO's stripes.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)

    let rated = 0
    for (const record of world.service.values()) {
      /**
       * THE CURRENT CAREER ONLY — the same trap `service.test.ts` documents
       * for promotions. Re-enlisting into another branch starts a new ladder
       * at the bottom, so a rated air-guard master sergeant who signs again
       * as a land-forces private reads as an E-1 holding three reports. The
       * reports are real and so is the private; they belong to two different
       * careers.
       */
      const reports = evaluationsOf(world, record.personId).filter(
        (r) => r.tick >= record.enlistedAtTick,
      )
      if (reports.length === 0) continue
      rated += 1
      if (record.commissioned === true) continue
      /**
       * A BUST IS THE INNOCENT EXPLANATION, and the first draft of this test
       * did not allow for one: it found "an E-4 holds 3 annual reports" and
       * called it a leak. He was a sergeant when they were written and lost
       * the stripe afterwards, which is a career, not a bug. Rank is the only
       * thing that moves down, so a man below the line must show one.
       */
      const grades = BRANCH_GRADES[record.branch as 'land-forces'] ?? []
      const grade = grades[record.rank] ?? 0
      if (grade < 5) {
        const busted = world.events.some(
          (e) =>
            e.type === 'disciplined' &&
            e.subjectId === record.personId &&
            (e.detail ?? '').includes('busted'),
        )
        expect(
          busted,
          `an E-${String(grade)} holds ${String(reports.length)} reports and was never busted`,
        ).toBe(true)
        continue
      }
      expect(
        grade,
        `an E-${String(grade)} holds ${String(reports.length)} annual reports`,
      ).toBeGreaterThanOrEqual(5)
    }
    expect(rated, 'nobody was rated at all').toBeGreaterThan(0)
  })

  it('is written by somebody who genuinely outranks them', () => {
    /**
     * OWNER: "we need to make sure its our superiors that are ratings us."
     * The roster is sorted by authority but adjacent people can SHARE a grade
     * — two sergeants standing next to each other, neither of whom writes the
     * other's report — so "the next name up" was not enough.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)

    let checked = 0
    for (const record of world.service.values()) {
      const raterId = raterFor(world, record.personId)
      if (raterId === null) continue
      const theirs = world.service.get(raterId)
      if (theirs === undefined) continue
      checked += 1
      const gradeOf = (r: typeof record): number =>
        r.commissioned === true
          ? 100 + r.rank
          : (BRANCH_GRADES[r.branch as 'land-forces'] ?? [])[r.rank] ?? r.rank + 1
      expect(
        gradeOf(theirs),
        `rated by an equal: E-${String(gradeOf(theirs))} writing on E-${String(gradeOf(record))}`,
      ).toBeGreaterThan(gradeOf(record))
    }
    expect(checked, 'nobody has a rater').toBeGreaterThan(0)
  })

  it('never rates somebody against a roster they are not on', () => {
    // The rater comes out of the unit, so a person with no unit gets no
    // report rather than an invented one.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 20 * 12)
    for (const record of world.service.values()) {
      const rater = raterFor(world, record.personId)
      if (rater === null) continue
      const roster = unitRosterOf(world, record.personId)
      expect(roster?.members.some((m) => m.personId === rater)).toBe(true)
    }
  })
})
