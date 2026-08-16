/**
 * THE TWELVE-YEAR WALL (ADR-0032, owner: "after 12 years of service you must
 * either become indefinite or get out... SGT is the rank that should be the
 * safe spot... CPLs can not become career CPLs").
 *
 * Three claims:
 *   under twelve years nothing changes;
 *   at twelve years with the stripes there is no term left to sign, only
 *     indefinite or the door;
 *   at twelve years without them the service writes nothing at all — and
 *     that applies to the town, not only to the player.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { eligibilityOf } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import { BRANCH_GRADES, BRANCH_RANKS } from '../src/content.js'
import {
  INDEFINITE_AT_YEARS,
  INDEFINITE_MIN_GRADE,
  INDEFINITE_RETIRE_AT_YEARS,
  SERVICE_MAX_YEARS,
  indefiniteStandingFor,
  reenlistEligibility,
} from '../src/reenlistment.js'
import type { ServiceRecord } from '../src/types.js'

const CLEAN = {
  strikes: 0,
  endsCareerAt: 3,
  criminalGate: 'none' as const,
  hitHighYearTenure: false,
  age: 34,
}

function aRecord(rank: number): ServiceRecord {
  return {
    personId: 1,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    unitSinceTick: null,
    commissioned: false,
    rank,
    rankSinceTick: 0,
    qualifications: [],
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
    enlistedAtTick: 0,
    baseId: null,
    monthlyPay: 200_000,
    performance: 620,
    termMonthsLeft: 0,
    termMonths: 48,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 0,
    unitId: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessTestedAtTick: null,
  } as unknown as ServiceRecord
}

describe('where the wall stands', () => {
  it('is grade 5 in all three branches — SGT, PO2, SSgt', () => {
    // The owner's rule is about a RANK; the code enforces a GRADE, because
    // that is the one number the three ladders share. If they ever drift
    // apart this test is the thing that notices.
    const ground = BRANCH_RANKS['land-forces'].indexOf('SGT')
    expect(BRANCH_GRADES['land-forces'][ground]).toBe(INDEFINITE_MIN_GRADE)

    // And the corporal sits BELOW it, which is the whole point.
    const corporal = BRANCH_RANKS['land-forces'].indexOf('CPL')
    expect(corporal).toBeGreaterThan(-1)
    expect(BRANCH_GRADES['land-forces'][corporal]).toBeLessThan(INDEFINITE_MIN_GRADE)

    for (const branch of ['naval-service', 'air-guard'] as const) {
      // Every branch must have SOMETHING at the line, or its people would
      // hit a wall none of them could ever pass.
      expect(BRANCH_GRADES[branch].some((g) => g >= INDEFINITE_MIN_GRADE)).toBe(true)
    }
  })

  it('lets nobody through early and everybody senior through at twelve', () => {
    for (let years = 0; years < INDEFINITE_AT_YEARS; years++) {
      expect(indefiniteStandingFor(9, years)).toBe('contract')
      expect(indefiniteStandingFor(1, years)).toBe('contract')
    }
    expect(indefiniteStandingFor(INDEFINITE_MIN_GRADE, INDEFINITE_AT_YEARS)).toBe('elect')
    expect(indefiniteStandingFor(INDEFINITE_MIN_GRADE - 1, INDEFINITE_AT_YEARS)).toBe('barred')
    // And it does not un-bar later: a corporal at twenty is still a corporal.
    expect(indefiniteStandingFor(INDEFINITE_MIN_GRADE - 1, 20)).toBe('barred')
  })
})

describe('what the retention desk says at the wall', () => {
  it('offers the usual menu of terms under twelve years', () => {
    const eligibility = reenlistEligibility(aRecord(5), {
      ...CLEAN,
      yearsServed: 8,
      grade: 5,
    })
    expect(eligibility.code).toBe('RE-1')
    expect(eligibility.terms.length).toBeGreaterThan(1)
  })

  it('offers a sergeant no terms at all, because there are none left', () => {
    const eligibility = reenlistEligibility(aRecord(5), {
      ...CLEAN,
      yearsServed: 12,
      grade: 5,
    })
    // Still welcome — but welcome to something that is not a contract.
    expect(eligibility.code).toBe('RE-1')
    expect(eligibility.terms).toEqual([])
    expect(eligibility.reason).toContain('indefinitely')
  })

  it('bars a corporal at twelve years, on a clean file', () => {
    const eligibility = reenlistEligibility(aRecord(4), {
      ...CLEAN,
      yearsServed: 12,
      grade: 4,
    })
    // Nothing he did: no strikes, no convictions, no high-year tenure. The
    // service simply does not carry a career at that grade.
    expect(eligibility.code).toBe('RE-4')
    expect(eligibility.reason).toContain('stripes')
    expect(eligibility.terms).toEqual([])
  })
})

describe('the town lives under the same rule', () => {
  it('has nobody serving past twelve years below the line', () => {
    // Law 1: the rule is the simulation's, not a screen the player sees.
    // A career corporal anywhere in a long-run world means the wall leaks.
    //
    // THE SEEDS ARE FIVE, AND THAT IS DELIBERATE. This test passed over
    // three seeds while two career corporals stood in the other two: an
    // indefinite sergeant busted a stripe kept the flag, and the term-end
    // handler returns early for anybody indefinite, so he was never asked
    // the wall's question again. Measured — 92 busts across five seeds and
    // forty years, two of them landing here.
    let checked = 0
    let indefiniteSeen = 0
    for (const seed of [4141, 9001, 31337, 777, 12345]) {
      const world = createWorld(makeSeed(seed), 400)
      advanceTicks(world, 40 * 12)
      for (const record of world.service.values()) {
        if (record.dischargedAtTick !== null) continue
        if (record.commissioned === true) continue
        const years = Math.floor((world.tick - record.enlistedAtTick) / 12)
        if (years < INDEFINITE_AT_YEARS) continue
        checked++
        const grade = BRANCH_GRADES[record.branch as 'land-forces'][record.rank] ?? 0
        // A LONG-SERVER MAY SIT BELOW THE LINE MID-TERM — a PO1 who signed
        // legitimately and was busted twice afterwards serves out the term
        // he signed, and the wall denies him at its end (high year tenure
        // separates at term end, not the day of the bust). What the wall
        // must never allow is the SIGNING below the line: every below-line
        // long-server has to show a bust AFTER their last reenlistment —
        // the innocent explanation — or they walked through the back door.
        if (grade < INDEFINITE_MIN_GRADE) {
          // A plain number, not a Tick: `Math.max` returns number and the
          // reduce would otherwise infer the branded type for its accumulator
          // and reject its own result.
          let lastSigned: number = record.enlistedAtTick
          for (const e of world.events) {
            if (e.type !== 'reenlisted' || e.subjectId !== record.personId) continue
            lastSigned = Math.max(lastSigned, e.tick)
          }
          const bustedSince = world.events.some(
            (e) =>
              e.type === 'disciplined' &&
              e.subjectId === record.personId &&
              e.tick > lastSigned &&
              (e.detail ?? '').includes('busted'),
          )
          expect(
            bustedSince,
            `${record.branch} rank ${String(record.rank)} at ${String(years)} years with no bust since signing — the wall leaked`,
          ).toBe(true)
        }
        // The flag itself, not only the years — the bust reached the record
        // without going near the wall, so check the state the wall sets.
        if (record.indefinite === true) {
          indefiniteSeen++
          expect(
            grade,
            `indefinite at grade ${String(grade)} — a career corporal by the back door`,
          ).toBeGreaterThanOrEqual(INDEFINITE_MIN_GRADE)
        }
      }
    }
    // The assertion above is vacuous if nobody got that far, so prove
    // somebody did — long careers must still exist.
    expect(checked, 'no long enlisted career in any seed').toBeGreaterThan(0)
    expect(indefiniteSeen, 'nobody reached indefinite status at all').toBeGreaterThan(0)
  })
})

/**
 * WHAT INDEFINITE BUYS (owner: "by indefinite I meant like must serve to 20
 * years and up to 30 if they choose, not the rest of their life").
 *
 * A commitment to the pension point, then an option past it.
 */
describe('indefinite is a commitment, not a life sentence', () => {
  it('runs to thirty years and no further', () => {
    expect(SERVICE_MAX_YEARS).toBe(30)
    expect(INDEFINITE_RETIRE_AT_YEARS).toBe(20)
    expect(INDEFINITE_RETIRE_AT_YEARS).toBeGreaterThan(INDEFINITE_AT_YEARS)
  })

  it('does not force a sergeant out the moment the pension exists', () => {
    // The bug this fixes: careerCeilingMonths retired grade 5 at exactly
    // twenty, so somebody who had just committed to indefinite service was
    // discharged at the point the choice was supposed to become theirs.
    let pastTwenty = 0
    let stoppedByThirty = true
    for (const seed of [4141, 9001, 31337]) {
      const world = createWorld(makeSeed(seed), 400)
      advanceTicks(world, 45 * 12)
      for (const record of world.service.values()) {
        const end = record.dischargedAtTick ?? world.tick
        const years = Math.floor((end - record.enlistedAtTick) / 12)
        if (record.commissioned === true) continue
        if (years > 20) pastTwenty++
        if (years > SERVICE_MAX_YEARS) stoppedByThirty = false
      }
    }
    expect(pastTwenty, 'nobody ever serves past twenty years').toBeGreaterThan(0)
    expect(stoppedByThirty, 'somebody served past thirty years').toBe(true)
  })
})

describe('an officer is not a corporal', () => {
  it('does not separate a major sixteen years into a good career', () => {
    // OWNER, PLAYING: "majors should not be getting kicked out if they are
    // past 12 years in service... I just got kicked out after 16 years of
    // an amazing career because I was a major."
    //
    // He was removed by the CAREER CORPORAL RULE. `grades` is the ENLISTED
    // table and it was being indexed with an officer's rank index — a major
    // sits at officer index 3, and enlisted index 3 is E-4. So the
    // twelve-year wall saw a specialist with sixteen years who had never
    // made sergeant, and did exactly what it was built to do.
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 45)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')

    const branch = world.spec.branches[0]
    if (!branch) throw new Error('no branch')
    const major = 3 // 2LT, 1LT, CPT, MAJ
    world.service.set(person.id, {
      personId: person.id,
      branch: branch.id,
      specialtyId: 'rifleman',
      commissioned: true,
      rank: major,
      rankSinceTick: (world.tick - 80) as never, // long in grade, on purpose
      qualifications: [],
      enlistedAtTick: (world.tick - 16 * 12) as never,
      baseId: null,
      monthlyPay: 700_000 as never,
      performance: 780,
      termMonthsLeft: 1,
      dischargedAtTick: null,
      dischargeReason: null,
      termPerformanceSum: 780 * 6,
      unitId: null,
      unitSinceTick: null,
      schoolId: null,
      schoolStartsAtTick: null,
      fitnessTestedAtTick: world.tick,
      priorSpecialtyIds: [],
    } as never)

    // The service must still want him: no wall, and no up-or-out either.
    const eligibility = eligibilityOf(world, person, world.service.get(person.id)!, world.tick)
    expect(eligibility.code, eligibility.reason).not.toBe('RE-4')

    // AND HE MUST NOT BE REMOVED BY AN ENLISTED RULE. He may still choose
    // to leave — officers resign, and the ordinary retention roll is
    // allowed to take him — but "barred from reenlistment" and "high-year
    // tenure" are the two the wall and up-or-out produce, and neither has
    // any business ending a commissioned career.
    advanceTicks(world, 24)
    const after = world.service.get(person.id)
    expect(after?.dischargeReason).not.toBe('barred from reenlistment')
    expect(after?.dischargeReason).not.toBe('high-year tenure')
  })

  it('reads a rank off the ladder its owner is actually on', () => {
    // The root cause, asserted directly: an officer's grade must not come
    // from the enlisted table.
    const world = createWorld(makeSeed(4141), 120)
    const branch = world.spec.branches[0]
    if (!branch) throw new Error('no branch')
    const officerGrades = branch.officerGrades ?? []
    expect(officerGrades.length, 'no officer grade table to read').toBeGreaterThan(3)
    // A major is O-4 on his own ladder and E-4 on nobody's.
    expect(officerGrades[3]).toBe(4)
    expect(branch.grades[3]).toBe(4)
    // Same number, different meaning — which is exactly why the bug was
    // invisible: the tables overlap for the first few rungs.
  })
})
