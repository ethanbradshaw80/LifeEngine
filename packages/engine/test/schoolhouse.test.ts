/**
 * M-SCHOOL phase 1 — the catalogue is coherent.
 *
 * The schoolhouse remodel (owner's spec) gives every course a category, a
 * wash-out weight, a seat scarcity and a lifetime attempt cap. None of that
 * has behaviour yet; this pins the DATA, because a school whose gates
 * cannot be met is a school nobody will ever attend, and that failure is
 * silent — it looks exactly like a course that is merely rare.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { recordEvent } from '../src/records.js'
import { flagStatus, schoolOptionsFor } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import { BRANCH_GRADES, SERVICE_SCHOOLS } from '../src/content.js'

/** A plain serving record, enough for the flag to have something to read. */
function enlist(world: ReturnType<typeof createWorld>, personId: number): void {
  world.service.set(personId as never, {
    personId: personId as never,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 4,
    rankSinceTick: world.tick,
    qualifications: [],
    enlistedAtTick: world.tick,
    baseId: null,
    monthlyPay: 139_000 as never,
    performance: 700,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 4_200,
    unitId: null,
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 300,
    fitnessTestedAtTick: world.tick,
  } as never)
}

describe('every course in the catalogue', () => {
  it('carries the fields the schoolhouse will read', () => {
    for (const school of SERVICE_SCHOOLS) {
      expect(['pme', 'skill', 'selection'], school.id).toContain(school.category)
      expect(school.difficulty, `${school.id} difficulty`).toBeGreaterThanOrEqual(0)
      expect(school.difficulty, `${school.id} difficulty`).toBeLessThan(1000)
      expect(school.seatScarcity, `${school.id} scarcity`).toBeGreaterThan(0)
      expect(school.seatScarcity, `${school.id} scarcity`).toBeLessThan(1000)
      // A course nobody may ever attend twice is a course a wash-out ends
      // for good, which is the opposite of the road back Law 7 asks for.
      expect(school.maxAttempts, `${school.id} attempts`).toBeGreaterThanOrEqual(2)
    }
  })

  it('never requires a badge no course grants', () => {
    // A DANGLING PREREQUISITE IS AN UNREACHABLE SCHOOL, and it fails
    // silently: the course simply never opens, which reads as "rare".
    const granted = new Set(SERVICE_SCHOOLS.map((s) => s.badge))
    for (const school of SERVICE_SCHOOLS) {
      for (const badge of school.prereqBadges ?? []) {
        expect(granted, `${school.id} requires "${badge}", which no course grants`).toContain(badge)
      }
    }
  })

  it('never requires a badge from a school its own people cannot attend', () => {
    // A branch-locked prerequisite is the same trap one step further out: a
    // course open to the naval service that requires a badge only the land
    // forces can earn is closed to everybody, and says nothing about it.
    const byBadge = new Map(SERVICE_SCHOOLS.map((s) => [s.badge, s]))
    for (const school of SERVICE_SCHOOLS) {
      for (const badge of school.prereqBadges ?? []) {
        const source = byBadge.get(badge)
        if (!source || source.branches.length === 0) continue
        const reachable =
          school.branches.length === 0
            ? source.branches.length === 0
            : school.branches.every((b) => source.branches.includes(b))
        expect(
          reachable,
          `${school.id} is open to [${school.branches.join(', ') || 'all'}] but its prerequisite "${badge}" comes from ${source.id}, open only to [${source.branches.join(', ')}]`,
        ).toBe(true)
      }
    }
  })

  it('makes selection harder than education, which is the whole distinction', () => {
    const pme = SERVICE_SCHOOLS.filter((s) => s.category === 'pme')
    const selection = SERVICE_SCHOOLS.filter((s) => s.category === 'selection')
    expect(pme.length, 'no PME in the catalogue').toBeGreaterThan(0)
    expect(selection.length, 'no selection course in the catalogue').toBeGreaterThan(0)
    // The spec is explicit: PME rarely washes anybody out — the difficulty
    // is getting the seat in time to promote.
    const hardestPme = Math.max(...pme.map((s) => s.difficulty))
    const easiestSelection = Math.min(...selection.map((s) => s.difficulty))
    expect(hardestPme).toBeLessThan(easiestSelection)
  })
})

/**
 * M-PROMO — the school gates the grade, and the town survives it.
 */
describe('professional military education', () => {
  it('gates the first NCO rung in every branch', () => {
    // If a branch has no course gating E-5, its people promote past the
    // gate for free and the rule is a rule for the other two only.
    for (const branch of ['land-forces', 'naval-service', 'air-guard']) {
      const gating = SERVICE_SCHOOLS.filter(
        (s) => s.gatesGrade === 5 && (s.branches.length === 0 || s.branches.includes(branch)),
      )
      expect(gating.length, `${branch} has no course gating E-5`).toBeGreaterThan(0)
    }
  })

  it('never sets an entry bar above the rank it gates', () => {
    // MEASURED, AND THIS IS WHY THE TEST EXISTS. The first PME numbers put
    // a 470-performance bar on the course that gates sergeant — a rank that
    // is won on promotion POINTS, where seniority, badges and decorations
    // carry a middling evaluation. The ordinary soldier could no longer
    // make sergeant at all, sat at corporal until high-year tenure removed
    // him, and the NCO ranks emptied: 45 tenure discharges in forty years
    // and one sergeant left standing out of fifteen serving.
    //
    // A school is education. The selection happens at the board.
    for (const school of SERVICE_SCHOOLS) {
      if (school.gatesGrade === undefined) continue
      expect(
        school.minPerformance,
        `${school.id} demands more to walk in than the grade it gates is worth`,
      ).toBeLessThanOrEqual(650)
    }
  })
})

describe('the town still makes sergeants', () => {
  it('reaches the top of the ladder over a long run', () => {
    // THE GATE MUST NOT FREEZE THE ARMY. A school that gates a grade is
    // only honest if the unit actually sends people to it — and for a long
    // while it did not, because the booking was written mid-month and the
    // month's single closing write reverted it (ADR-0039's trap, walked
    // into an hour after it was written down). Measured then: ZERO school
    // bookings of any kind across twenty-five years.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    let top = 0
    let serving = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null || record.commissioned === true) continue
      serving++
      top = Math.max(top, BRANCH_GRADES[record.branch as 'land-forces'][record.rank] ?? 0)
    }
    expect(serving, 'nobody is serving at all').toBeGreaterThan(5)
    expect(top, 'nobody got past the first NCO gate in forty years').toBeGreaterThanOrEqual(7)
  })
})

/**
 * M-SCHOOL §3 — the flag. "Suspension of favourable actions": no school, no
 * promotion, no reenlistment, no medal, until it clears.
 */
describe('the flag', () => {
  it('closes the schoolhouse to a soldier who has just been punished', () => {
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 20 && ageAt(p.birthTick, world.tick) <= 40)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')
    enlist(world, person.id)

    expect(flagStatus(world, person.id, world.tick).flagged).toBe(false)
    recordEvent(world, world.tick, {
      type: 'disciplined',
      subjectId: person.id,
      detail: 'late for duty',
    })
    const flag = flagStatus(world, person.id, world.tick)
    expect(flag.flagged).toBe(true)
    expect(flag.reasons).toContain('adverse-action')
    // The tab says which, in words, rather than greying a row in silence.
    expect(flag.words).toContain('flagged')
    // And every course is shut, with that reason on it.
    const open = schoolOptionsFor(world, person.id).filter((o) => o.open)
    expect(open.length, 'a flagged soldier was still offered a seat').toBe(0)
  })

  it('lifts when the punishment ages off — a suspension is not a discharge', () => {
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 20 && ageAt(p.birthTick, world.tick) <= 40)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')
    enlist(world, person.id)
    recordEvent(world, world.tick, {
      type: 'disciplined',
      subjectId: person.id,
      detail: 'late for duty',
    })
    expect(flagStatus(world, person.id, world.tick).flagged).toBe(true)
    expect(flagStatus(world, person.id, (world.tick + 13) as Tick).flagged).toBe(false)
  })

  it('does not flag most of the army for being averagely fit', () => {
    // THE BUG THIS PINS. The fitness bar was set at 200 by guesswork and
    // flagged FIFTEEN OF SEVENTEEN serving soldiers, because the scores
    // this game produces run 114 to 207 with a median of 180 — the
    // "failing" bar sat above the middle of the force. Flagged means no
    // school, no promotion and no reenlistment, so the whole army stalled
    // below the first senior rung.
    //
    // A failure has to be a failure, not an average.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    let serving = 0
    let flagged = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      serving++
      if (flagStatus(world, record.personId, world.tick).flagged) flagged++
    }
    expect(serving, 'no army to measure').toBeGreaterThan(5)
    expect(flagged / serving, 'most of the army is flagged').toBeLessThan(0.5)
  }, 300_000)
})
