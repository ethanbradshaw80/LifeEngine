/**
 * M-CAREER §3. The moments a job is made of.
 *
 * THE RULE THIS ENFORCES is the one the crime scenes are held to, applied
 * to work: each moment has its OWN copy. The mistake's answers are "Own it
 * / Quietly fix it / Let it slide" and not the assignment's, and no line of
 * prose appears in two moments.
 *
 * And the claims about the mechanism: three real answers, the reaching one
 * genuinely able to fail, the safe one genuinely costing something, and the
 * whole thing seeded so a moment reads the same twice.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  WORK_CHOICES,
  WORK_MOMENTS,
  decodeWorkMoment,
  encodeWorkMoment,
  momentsFor,
  outcomeOf,
  raiseFrom,
  situationOf,
  workMomentById,
  workResultFor,
} from '../src/workmoments.js'
import type { WorkChoice, WorkResult } from '../src/workmoments.js'

const RESULTS: readonly WorkResult[] = ['good', 'bad']

describe('every moment', () => {
  it('has three answers, on the three rails', () => {
    expect(WORK_MOMENTS.length).toBeGreaterThanOrEqual(10)
    for (const moment of WORK_MOMENTS) {
      expect(moment.options.map((o) => o.id)).toEqual([...WORK_CHOICES])
      for (const option of moment.options) {
        expect(option.title.trim(), moment.id).not.toBe('')
        expect(option.detail.length, `${moment.id}: ${option.id}`).toBeGreaterThan(20)
        expect(option.tag.trim()).not.toBe('')
      }
    }
  })

  it('has a situation and all six outcomes, none of them a stub', () => {
    for (const moment of WORK_MOMENTS) {
      expect(moment.situation.length, moment.id).toBeGreaterThan(0)
      for (const line of moment.situation) {
        expect(line.length, `${moment.id} situation`).toBeGreaterThan(40)
      }
      for (const choice of WORK_CHOICES) {
        for (const result of RESULTS) {
          const pool = moment.outcomes[choice][result]
          expect(pool.length, `${moment.id}.${choice}.${result} is empty`).toBeGreaterThan(0)
          for (const outcome of pool) {
            expect(outcome.title.trim(), `${moment.id}.${choice}.${result}`).not.toBe('')
            expect(outcome.text.length).toBeGreaterThan(30)
            expect(outcome.foot.trim()).not.toBe('')
            expect(Number.isInteger(outcome.performance)).toBe(true)
            expect(Number.isInteger(outcome.payPerMille)).toBe(true)
          }
        }
      }
    }
  })

  it('shares no line of prose with any other moment', () => {
    // THE WHOLE POINT. One generic template reused across every moment is
    // exactly the bug the crime scenes were rebuilt to kill; work must not
    // reintroduce it.
    const owner = new Map<string, string>()
    const shared: string[] = []
    for (const moment of WORK_MOMENTS) {
      const lines = [
        ...moment.situation,
        ...moment.options.flatMap((o) => [o.title, o.detail]),
        ...WORK_CHOICES.flatMap((choice) =>
          RESULTS.flatMap((result) =>
            moment.outcomes[choice][result].flatMap((o) => [o.title, o.text, o.foot]),
          ),
        ),
      ]
      for (const line of lines) {
        const previous = owner.get(line)
        if (previous !== undefined && previous !== moment.id) {
          shared.push(`${previous} / ${moment.id}: ${line}`)
        }
        owner.set(line, moment.id)
      }
    }
    expect(shared).toEqual([])
  })

  it('does not let one moment’s vocabulary into another', () => {
    // The assignment has an account; the mistake has a figure; night school
    // has a certificate. None of them belongs in the others.
    const FORBIDDEN: Record<string, readonly RegExp[]> = {
      'the-mistake': [/\baccount\b/i, /certificate/i],
      'back-to-school': [/\baccount\b/i],
      mentor: [/certificate/i, /\bdeadline\b/i],
      crunch: [/certificate/i],
    }
    const offenders: string[] = []
    for (const moment of WORK_MOMENTS) {
      const patterns = FORBIDDEN[moment.id] ?? []
      if (patterns.length === 0) continue
      const lines = [
        ...moment.situation,
        ...moment.options.map((o) => o.detail),
        ...WORK_CHOICES.flatMap((choice) =>
          RESULTS.flatMap((result) => moment.outcomes[choice][result].map((o) => o.text)),
        ),
      ]
      for (const line of lines) {
        for (const pattern of patterns) {
          if (pattern.test(line)) offenders.push(`${moment.id}: ${line}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the three answers are a real choice', () => {
  it('lets the reaching one fail and the measured one mostly work', () => {
    for (const moment of WORK_MOMENTS) {
      let leadGood = 0
      let steadyGood = 0
      for (let roll = 0; roll < 1000; roll++) {
        if (workResultFor(moment, 'lead', 500, roll) === 'good') leadGood++
        if (workResultFor(moment, 'steady', 500, roll) === 'good') steadyGood++
      }
      // The reaching answer is genuinely a gamble...
      expect(leadGood, `${moment.id} lead`).toBeGreaterThan(150)
      expect(leadGood, `${moment.id} lead`).toBeLessThan(850)
      // ...and the measured one is not, which is what makes it the middle.
      expect(steadyGood).toBeGreaterThan(leadGood)
    }
  })

  it('rewards standing — the trusted are likelier to land it', () => {
    const moment = workMomentById('big-assignment')
    expect(moment).toBeDefined()
    if (!moment) return
    let poor = 0
    let strong = 0
    for (let roll = 0; roll < 1000; roll++) {
      if (workResultFor(moment, 'lead', 200, roll) === 'good') poor++
      if (workResultFor(moment, 'lead', 900, roll) === 'good') strong++
    }
    expect(strong).toBeGreaterThan(poor)
  })

  it('makes the safe answer cost something', () => {
    // Passing is never free — it is read as passing, which is the whole
    // reason the three are a decision rather than a menu.
    for (const moment of WORK_MOMENTS) {
      const best = moment.outcomes.pass.good[0]
      const worst = moment.outcomes.pass.bad[0]
      expect(best, moment.id).toBeDefined()
      expect(worst, moment.id).toBeDefined()
      expect(best!.performance, `${moment.id} pass is a free win`).toBeLessThanOrEqual(20)
      expect(worst!.performance).toBeLessThan(0)
    }
  })

  it('pays a raise only where the moment is about money', () => {
    const paying = WORK_MOMENTS.filter((moment) =>
      WORK_CHOICES.some((choice) =>
        RESULTS.some((result) => moment.outcomes[choice][result].some((o) => o.payPerMille > 0)),
      ),
    ).map((moment) => moment.id)
    expect(paying).toContain('ask-for-more')
    expect(paying).toContain('poached')
    expect(paying).not.toContain('conflict')
    expect(raiseFrom(400_000 as never, 90)).toBe(36_000)
    expect(raiseFrom(400_000 as never, 0)).toBe(0)
  })
})

describe('the wording is seeded, and stable', () => {
  it('reads the same twice and varies between variants', () => {
    const moment = workMomentById('poached')
    expect(moment).toBeDefined()
    if (!moment) return
    expect(situationOf(moment, 3)).toBe(situationOf(moment, 3))
    expect(situationOf(moment, 0)).not.toBe(situationOf(moment, 1))
    // And it never runs off the end of a pool.
    for (const variant of [0, 7, 999, 1_000_000]) {
      expect(situationOf(moment, variant).trim()).not.toBe('')
      for (const choice of WORK_CHOICES) {
        for (const result of RESULTS) {
          expect(outcomeOf(moment, choice, result, variant)?.text.trim()).not.toBe('')
        }
      }
    }
  })

  it('survives the round trip on a pending', () => {
    expect(decodeWorkMoment(encodeWorkMoment('ethics', 42))).toEqual({
      momentId: 'ethics',
      variant: 42,
    })
    expect(decodeWorkMoment(null)).toEqual({ momentId: '', variant: 0 })
  })

  it('keeps the ethics fork for people senior enough to be asked', () => {
    expect(momentsFor(0).map((m) => m.id)).not.toContain('ethics')
    expect(momentsFor(3).map((m) => m.id)).toContain('ethics')
  })
})

describe('in a running world', () => {
  it('happens often enough to be a career and rarely enough to be a job', () => {
    // MEASURED across three seeds and seventy-five years: 2,080 moments,
    // every one of the ten kinds represented — about one every three years
    // for a given worker.
    const seen = new Map<string, number>()
    let total = 0
    for (const seedValue of [12345, 4141, 777]) {
      const world = createWorld(makeSeed(seedValue), 100)
      // 1500 rather than 900 (v155): the rarest moments live at the top
      // rungs, and whether anybody REACHES those rungs inside the window
      // shifts with the economy. The property is that every moment is
      // reachable, so the window grew instead of the bar dropping.
      advanceTicks(world, 1500)
      for (const event of world.events) {
        if (event.type !== 'work-moment') continue
        total++
        const id = (event.detail ?? '').split(':')[0] ?? ''
        seen.set(id, (seen.get(id) ?? 0) + 1)
      }
    }
    expect(total).toBeGreaterThan(500)
    /**
     * REACHABILITY IS TESTED WHERE THE LADDER EXISTS. The three worlds
     * above are 100-person towns, chosen for speed — and a town that small
     * barely populates its executive rungs, so the top-rung moments starve
     * regardless of the window: measured, `the-succession` fired zero
     * times across all three at 125 years while `crunch` fired 447. That
     * is a fact about tiny towns, not about the content. The
     * every-moment-fires claim runs against a full-size town, where every
     * rung has somebody on it.
     */
    /**
     * TWO FULL TOWNS, NOT ONE — and the window grew rather than the bar
     * dropping, which is how this same test was repaired the last time.
     *
     * MEASURED across three full-size towns of 125 years: `the-succession`
     * fired FOUR times in total and `the-board` six. They are the top-rung
     * moments, they need somebody standing at the very top of a ladder when
     * the roll comes up, and at that rarity a single town is simply not a
     * big enough sample to prove reachability — seed 4242 misses the
     * succession while 909 and 12345 both catch it.
     *
     * The claim has not moved: every moment must be REACHABLE. What changed
     * is that it is now asked of a sample large enough to answer it.
     */
    for (const townSeed of [4242, 909]) {
      const fullTown = createWorld(makeSeed(townSeed))
      advanceTicks(fullTown, 1500)
      for (const event of fullTown.events) {
        if (event.type !== 'work-moment') continue
        const id = (event.detail ?? '').split(':')[0] ?? ''
        seen.set(id, (seen.get(id) ?? 0) + 1)
      }
    }
    expect(seen.size, 'some moments never fire').toBe(WORK_MOMENTS.length)
  },
  /**
   * THIRTY MINUTES, AND THE CLAIM IS UNCHANGED — only the patience is.
   *
   * This test runs FIVE worlds, two of them full-size towns at 125 years,
   * because the rarest moments need somebody standing at the top of a ladder
   * when the roll comes up and a single small town cannot answer that. It is
   * expensive BY DESIGN and the comments above record why the window grew
   * rather than the bar dropping.
   *
   * MEASURED after the event-index fix: 494s running alone, against a default
   * bound of 900s. It still exceeded that under full-suite parallelism, where
   * a dozen worlds are being simulated in other workers at the same time — so
   * the default was the wrong bound for this one test, not evidence of a
   * problem. Raised rather than the test being cheapened, because cheapening
   * it means dropping a town and the last time somebody did that the
   * top-rung moments went untested.
   */
  1_800_000)

  it('records a cause for every one of them', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 480)
    const moments = world.events.filter((e) => e.type === 'work-moment')
    expect(moments.length).toBeGreaterThan(0)
    for (const event of moments.slice(0, 10)) {
      const [momentId, choice, result] = (event.detail ?? '::').split(':')
      expect(workMomentById(momentId ?? ''), event.detail ?? '').toBeDefined()
      expect(WORK_CHOICES).toContain(choice as WorkChoice)
      expect(['good', 'bad']).toContain(result)
    }
  })
})
