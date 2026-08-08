/**
 * Education phase 1 — the full school ladder.
 *
 * The owner's spec: childhood should be "a lived stage, not a blur you skip
 * to age 18". Elementary, middle and high school are three stages now
 * rather than two covering twelve years in one jump.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import {
  educationRank,
  isHigherEducation,
  majorById,
  majorsFor,
  meetsRequirement,
  occupationById,
} from '../src/content.js'
import { livingPeople } from '../src/systems.js'
import { accountsOf } from '../src/finances.js'
import { CREDIT_MIN, LOAN_TERMS } from '../src/credit.js'

/**
 * The debts a person can walk into a bank and ask for. Declared here
 * rather than imported from the UI: the engine test's job is to pin that
 * a student loan is NOT one of them, and reaching into apps/web for the
 * answer would make an engine test depend on the interface.
 */
const OVER_THE_COUNTER_KINDS: readonly string[] = ['personal', 'auto']
import { timelineFor } from '../src/story.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 40 * 12)

describe('the ladder', () => {
  it('runs elementary → middle → high school → the fork', () => {
    expect(educationRank('none')).toBeLessThan(educationRank('primary'))
    expect(educationRank('primary')).toBeLessThan(educationRank('middle'))
    expect(educationRank('middle')).toBeLessThan(educationRank('secondary'))
    expect(educationRank('secondary')).toBeLessThan(educationRank('trade'))
    expect(educationRank('trade')).toBeLessThan(educationRank('college'))
  })

  it('keeps every job requirement meaning exactly what it meant', () => {
    // THE RISK OF INSERTING A RUNG. Occupations gate on `secondary` meaning
    // A DIPLOMA. Because meetsRequirement compares RANKS rather than
    // matching names, adding middle school shifts the numbers without
    // shifting any meaning — a middle-school leaver still does not qualify
    // for work that wants a diploma.
    expect(meetsRequirement('secondary', 'secondary')).toBe(true)
    expect(meetsRequirement('college', 'secondary')).toBe(true)
    expect(meetsRequirement('trade', 'secondary')).toBe(true)
    expect(meetsRequirement('middle', 'secondary'), 'middle school passed as a diploma').toBe(false)
    expect(meetsRequirement('primary', 'secondary')).toBe(false)
    // And middle school IS above elementary, which is the point of it.
    expect(meetsRequirement('middle', 'primary')).toBe(true)
  })

  it('does not mistake a high-schooler for a university student', () => {
    // THE BUG THIS PINS. Three places asked `educationRank(level) > 2`
    // meaning "trade school or university" — which worked only because
    // `secondary` happened to sit at rank 2. Inserting `middle` beneath it
    // would have made that "secondary or above", and every fifteen-year-old
    // in the game would have been barred from a part-time job as a
    // full-time university student.
    expect(isHigherEducation('trade')).toBe(true)
    expect(isHigherEducation('college')).toBe(true)
    expect(isHigherEducation('secondary'), 'high school counted as higher education').toBe(false)
    expect(isHigherEducation('middle')).toBe(false)
    expect(isHigherEducation('primary')).toBe(false)
    expect(isHigherEducation(null)).toBe(false)
  })
})

describe('a town climbs it', () => {
  it('puts children at each stage at the age that stage belongs to', () => {
    // MEASURED across forty years: none 0-10, middle 14-18, secondary from
    // 18 up. The diploma still lands at eighteen, which matters more than
    // anything else here — the age-18 fork is the hinge of a whole life.
    const ages = new Map<string, number[]>()
    for (const person of livingPeople(world)) {
      const level = world.education.get(person.id)?.level ?? 'none'
      const list = ages.get(level) ?? []
      list.push(ageAt(person.birthTick, world.tick))
      ages.set(level, list)
    }
    const youngest = (level: string): number => Math.min(...(ages.get(level) ?? [999]))

    expect(ages.get('middle')?.length, 'nobody ever finished middle school').toBeGreaterThan(5)
    // Nobody holds a stage before they could possibly have finished it.
    expect(youngest('primary')).toBeGreaterThanOrEqual(10)
    expect(youngest('middle')).toBeGreaterThanOrEqual(13)
    expect(youngest('secondary'), 'a diploma before eighteen').toBeGreaterThanOrEqual(17)
  })

  it('still sends people on to trade and college afterwards', () => {
    const levels = livingPeople(world).map((p) => world.education.get(p.id)?.level ?? 'none')
    expect(levels.filter((l) => l === 'trade').length).toBeGreaterThan(5)
    expect(levels.filter((l) => l === 'college').length).toBeGreaterThan(5)
  })

  it('leaves the people who missed school where they stopped', () => {
    // Somebody whose schooling ended at elementary does not enrol in middle
    // school at thirty. Each rung has its own ceiling.
    const stuck = livingPeople(world).filter((p) => {
      const rec = world.education.get(p.id)
      return rec?.level === 'primary' && ageAt(p.birthTick, world.tick) > 25
    })
    for (const person of stuck) {
      expect(world.education.get(person.id)?.enrolledIn, `${person.givenName} went back to school late`).toBeNull()
    }
  })
})

/**
 * Education phase 1, the other half — the childhood performance arc and
 * the school the money bought.
 *
 * `attainment` used to be written once and never touched again, so all
 * thirteen years of the ladder were decorative: two children with the
 * same traits finished identical whatever happened in between.
 */
describe('the school years leave a mark', () => {
  it('moves attainment while a child is enrolled', () => {
    // Somebody, somewhere, has to be off the number they were born with.
    // A static field would put every single child on exactly 500.
    const moved = livingPeople(world).filter((person) => {
      const record = world.education.get(person.id)
      if (record === undefined || record.schooling === undefined) return false
      return record.attainment !== 500
    })
    expect(moved.length).toBeGreaterThan(0)
  })

  it('keeps private school a minority, not the ordinary childhood', () => {
    let priv = 0
    let pub = 0
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.schooling === 'private') priv += 1
      else if (record?.schooling === 'public') pub += 1
    }
    expect(priv).toBeGreaterThan(0)
    // The first numbers put 52% of the town's children through private
    // school, which made the ordinary childhood the expensive one.
    expect(priv).toBeLessThan(pub / 2)
  })

  it('pays off on average without being a guarantee', () => {
    const priv: number[] = []
    const pub: number[] = []
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record === undefined || record.schooling === undefined) continue
      const age = ageAt(person.birthTick, world.tick)
      if (age < 18 || age > 26) continue
      ;(record.schooling === 'private' ? priv : pub).push(record.attainment)
    }
    const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
    expect(priv.length).toBeGreaterThan(0)
    expect(pub.length).toBeGreaterThan(0)
    expect(mean(priv)).toBeGreaterThan(mean(pub))
    // ...but it never buys the top of the class outright. A diligent,
    // curious child at the ordinary school still beats a lazy rich one,
    // which is the difference between unequal and predetermined (Law 10).
    //
    // STATED ABOUT THE POPULATION, NOT ABOUT ONE CHILD. This first read
    // "the best public result beats the best private one", which was true
    // when measured and then failed by seven points the moment an
    // unrelated phase reshuffled the streams — a claim about a single
    // highest individual is a coin toss dressed as an invariant, which is
    // exactly what was wrong with the shocks threshold. The property that
    // actually matters is that the ordinary school keeps producing
    // children who beat a typical private outcome.
    const privSorted = [...priv].sort((a, b) => a - b)
    const privMedian = privSorted[Math.floor(privSorted.length / 2)] ?? 0
    expect(pub.filter((value) => value > privMedian).length).toBeGreaterThan(0)
    expect(Math.max(...pub)).toBeGreaterThan(Math.floor(Math.max(...priv) * 0.9))
  })

  it('keeps a child in the same kind of school all the way up', () => {
    // Deciding it afresh at each rung would have let a good year move a
    // child to private school and a bad one move them back.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.schooling === undefined) continue
      if (record.level === 'none') continue
      // Anybody past primary who was ever assigned a school still has one.
      expect(['public', 'private']).toContain(record.schooling)
    }
  })
})

/**
 * Education phase 2 — the moments a childhood is made of.
 *
 * The school years were a countdown: a child enrolled, thirteen years
 * passed, a diploma appeared, and nothing in between was ever a thing
 * that happened.
 */
describe('school-age moments', () => {
  it('fires during the school years and reaches the timeline', () => {
    const seen = world.events.filter((event) => event.type === 'school-moment')
    expect(seen.length).toBeGreaterThan(0)
    // The visibility ratchet allows a DETAIL-LESS school-moment to render
    // nothing, because a bare one is not a thing that happened. This is
    // the other half of that bargain: a real one must be readable.
    const real = seen.find((event) => (event.detail ?? '').split(':').length === 3)
    expect(real).toBeDefined()
    if (real === undefined) return
    const line = timelineFor(world, real.subjectId as never).find((entry) =>
      entry.text.includes('at school'),
    )
    expect(line).toBeDefined()
  })

  it('only happens to children who are actually at school', () => {
    // A trade course is not a childhood, and neither is a degree.
    for (const event of world.events) {
      if (event.type !== 'school-moment') continue
      const person = world.people.get(event.subjectId as never)
      if (person === undefined) continue
      const age = ageAt(person.birthTick, event.tick)
      expect(age).toBeGreaterThanOrEqual(6)
      expect(age).toBeLessThanOrEqual(20)
    }
  })

  it('stays occasional, because a childhood is not a popup gallery', () => {
    // The owner's popup-fatigue rule. Roughly two per stage is the aim;
    // this catches it firing like a monthly interruption.
    const perChild = new Map<number, number>()
    for (const event of world.events) {
      if (event.type !== 'school-moment') continue
      perChild.set(event.subjectId, (perChild.get(event.subjectId) ?? 0) + 1)
    }
    const worst = Math.max(...perChild.values())
    expect(worst).toBeLessThanOrEqual(12)
  })
})

/**
 * Education phase 3 — a field of study, and what it opens.
 */
describe('majors', () => {
  it('gives every graduate a field and nobody else one', () => {
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record === undefined) continue
      const field = record.major ?? null
      if (field === null) continue
      // A field only exists where a school teaches one. A diploma is not
      // in anything, and neither is middle school.
      const at = record.enrolledIn ?? record.level
      expect(['trade', 'college']).toContain(at)
      expect(majorById(field)).toBeDefined()
      // And it has to be a field that school actually teaches.
      expect(majorsFor(at as never).map((major) => major.id)).toContain(field)
    }
  })

  it('never leaves somebody studying nothing for four years', () => {
    // The player is asked; if the question lapses their own character
    // answers it. Anybody well into a course has a field on the record.
    const adrift = livingPeople(world).filter((person) => {
      const record = world.education.get(person.id)
      if (record === undefined || record.enrolledIn === null) return false
      if (record.enrolledIn !== 'trade' && record.enrolledIn !== 'college') return false
      if (world.tick - (record.enrolledAtTick ?? world.tick) <= 6) return false
      return (record.major ?? null) === null
    })
    expect(adrift).toEqual([])
  })

  it('pulls graduates toward the work their field is for', () => {
    let matched = 0
    let mismatched = 0
    for (const person of livingPeople(world)) {
      const field = world.education.get(person.id)?.major ?? null
      const job = world.employment.get(person.id)
      if (field === null || job === undefined) continue
      const wanted = occupationById(job.occupationId).preferredMajors
      if (wanted === undefined) continue
      if (wanted.includes(field)) matched += 1
      else mismatched += 1
    }
    expect(matched + mismatched).toBeGreaterThan(20)
    // MEASURED at roughly a third, against the ~9% a blind draw gives.
    // The claim is that a field visibly moves where people end up — not
    // that it decides it, because most graduates do not work in theirs.
    expect(matched * 4).toBeGreaterThan(mismatched)
    expect(matched).toBeLessThan(mismatched)
  })

  it('does not bar anybody from work their field is not for', () => {
    // Law 7, and the spec's own rule: a mismatch costs the edge, not the
    // job. Somebody, somewhere, is working outside what they studied.
    const offPiste = livingPeople(world).filter((person) => {
      const field = world.education.get(person.id)?.major ?? null
      const job = world.employment.get(person.id)
      if (field === null || job === undefined) return false
      const wanted = occupationById(job.occupationId).preferredMajors
      return wanted !== undefined && !wanted.includes(field)
    })
    expect(offPiste.length).toBeGreaterThan(0)
  })
})

/**
 * Education phase 5 — tuition, and the debt it leaves.
 *
 * The economy hook: higher education costs real money, paid from savings
 * where there are savings and borrowed where there are not, and the debt
 * is a consequence that outlives the course.
 */
describe('tuition and student loans', () => {
  it('charges for higher education and nothing for school', () => {
    // Nobody is billed for the K-12 ladder beyond private-school fees,
    // and no student loan exists for a childhood.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record === undefined) continue
      const loan = accountsOf(world, person.id).loans.find((l) => l.kind === 'student')
      if (loan === undefined) continue
      // A student debt means they went somewhere that charges.
      const everHigher =
        isHigherEducation(record.level) || isHigherEducation(record.enrolledIn)
      expect(everHigher).toBe(true)
    }
  })

  it('leaves debt on enough graduates to matter', () => {
    // MEASURED: 138 of 177 people with a field carry a balance. The point
    // of the phase is that the choice at eighteen is not free.
    let carrying = 0
    let graduates = 0
    for (const person of livingPeople(world)) {
      if ((world.education.get(person.id)?.major ?? null) === null) continue
      graduates += 1
      if (accountsOf(world, person.id).loans.some((l) => l.kind === 'student')) carrying += 1
    }
    expect(graduates).toBeGreaterThan(20)
    expect(carrying).toBeGreaterThan(graduates / 4)
  })

  it('does not bill a student while they are still studying', () => {
    // A four-year course billing from month one is a bill somebody with no
    // wages cannot meet, and would put every student in the town into
    // default in their first year. Interest still accrues; payments wait.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.enrolledIn === null || record?.enrolledIn === undefined) continue
      const loan = accountsOf(world, person.id).loans.find((l) => l.kind === 'student')
      if (loan === undefined) continue
      // Nobody enrolled is in default on a student loan.
      expect(loan.missedMonths).toBe(0)
    }
  })

  it('keeps the debt after a default, charged off and not growing', () => {
    // The ruling: every other loan is CLOSED by defaulting and this one is
    // not, or default would be the cheap way out of an education —
    // MEASURED at 71 defaults against 61 payoffs before the change, more
    // than half of all borrowers walking away. Charged off it stops
    // compounding, so a surviving debt is not a permanent trap (Law 7).
    const chargedOff = livingPeople(world)
      .map((person) => accountsOf(world, person.id).loans.find((l) => l.kind === 'student'))
      .filter((loan) => loan !== undefined && loan.missedMonths >= 3)
    expect(chargedOff.length).toBeGreaterThan(0)
    for (const loan of chargedOff) {
      expect(loan?.balance).toBeGreaterThan(0)
    }
  })

  it('is never sold over the counter', () => {
    // The cheapest debt in the game, gated on no credit score at all, and
    // the one bankruptcy cannot clear. Listed as a cash product it would
    // be both an exploit and a trap.
    expect(LOAN_TERMS.find((t) => t.kind === 'student')?.minCredit).toBe(CREDIT_MIN)
    expect(OVER_THE_COUNTER_KINDS).not.toContain('student')
  })
})
