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
  GRADUATE_ADMISSION,
  MERIT_ATTAINMENT,
  majorById,
  majorsFor,
  meetsRequirement,
  occupationById,
} from '../src/content.js'
import { dropOut, dropOutBar, enrolmentBar, livingPeople } from '../src/systems.js'
import { accountsOf, debitPerson, takeLoan } from '../src/finances.js'
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
    // NO COMPARISON OF THE TWO MAXIMA. This carried one — the best public
    // result within ten per cent of the best private one — and it is the
    // SECOND time a claim about the single highest individual has broken
    // on an unrelated change. The private cohort in this band is about ten
    // people; its maximum is noise, and a test built on noise reports the
    // seed rather than the rule. The median crossing above is the same
    // claim made about the population, and it holds.
    //
    // MEASURED across every band when this broke, to be sure the mechanic
    // had not actually failed: private 638-667 against public 523-535 at
    // 18-26, 18-40, 12-18 and 18-90. The edge is intact; the assertion was
    // not.
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
      expect(['trade', 'college', 'graduate']).toContain(at)
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
    //
    // BUILT, NOT LOOKED FOR. The first version of this scanned the shared
    // world for somebody who happened to be in default, which made it a
    // test of whether the town produced an example rather than of whether
    // the rule works — and phase 6 promptly made funded students common
    // enough that it found none. The situation is constructed now.
    const own = createWorld(makeSeed(4141), 200)
    advanceTicks(own, 30 * 12)
    const debtor = livingPeople(own).find((person) => {
      const age = ageAt(person.birthTick, own.tick)
      const record = own.education.get(person.id)
      return age > 30 && age < 55 && record?.enrolledIn === null
    })
    expect(debtor).toBeDefined()
    if (debtor === undefined) return

    // Deliberately far beyond anything this person could service: the
    // claim under test is what happens when the payments CANNOT be made,
    // so the debt has to be unpayable rather than merely inconvenient.
    expect(takeLoan(own, own.tick, debtor.id, 'student', 900_000_000 as never)).toBe(true)
    // Nothing to pay it with, and no wages coming in. Emptied through
    // the module's own door rather than by reaching for a private writer.
    const before = accountsOf(own, debtor.id)
    debitPerson(own, debtor.id, (before.checking + before.savings) as never)
    own.employment.delete(debtor.id)

    for (let i = 0; i < 8; i++) advanceTicks(own, 1)
    const after = accountsOf(own, debtor.id).loans.find((l) => l.kind === 'student')
    // It is still there — every other kind of loan would have been closed
    // by the default — and it stopped growing once it was charged off.
    expect(after).toBeDefined()
    expect(after?.missedMonths).toBeGreaterThanOrEqual(3)
    // AND IT STOPPED GROWING — but only measured across a window where
    // this person is definitely not back at school. A student loan also
    // defers WHILE ENROLLED, and deferred interest still accrues, so a
    // debtor who re-enrols mid-window grows their balance for an entirely
    // legitimate reason. (The veteran door opened in phase 6 makes that
    // reachable at this age, which is how the first version of this
    // assertion failed.)
    // AND WHILE IT STAYS IN DEFAULT IT DOES NOT GROW.
    //
    // Stated exactly, because two rounds of getting this wrong showed the
    // property is narrower than "the balance is frozen". Charged off is
    // not a permanent state: it tracks the CURRENT missed months, so a
    // debtor who finds the money and pays a full month is current again
    // and accrues normally afterwards — which is right, and which makes
    // the balance both fall and rise across a long window.
    //
    // The protection Law 7 actually needs is against the debtor who can
    // NEVER pay, and that is what this checks: across any month where the
    // loan was in default at both ends, the balance did not increase. The
    // person who never pays is frozen; the person who pays is not
    // punished for it.
    let previous = after
    for (let i = 0; i < 24; i++) {
      if (own.education.get(debtor.id)?.enrolledIn !== null) break
      advanceTicks(own, 1)
      const now = accountsOf(own, debtor.id).loans.find((l) => l.kind === 'student')
      if (now === undefined || previous === undefined) break
      if (previous.missedMonths >= 3 && now.missedMonths >= 3) {
        expect(now.balance).toBeLessThanOrEqual(previous.balance)
      }
      previous = now
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

/**
 * Education phase 6 — scholarships and funded paths.
 */
describe('who pays for the course', () => {
  it('runs every path the spec asks for, and none of them nominally', () => {
    const seen = new Set<string>()
    for (const person of livingPeople(world)) {
      const funding = world.education.get(person.id)?.funding
      if (funding !== undefined) seen.add(funding)
    }
    // The GI Bill in particular: it was written, wired and MEASURED at
    // zero people, because the enrolment window shut at 24 and almost
    // nobody is discharged that young. A benefit that exists in the code
    // and is unreachable in the world is the most expensive kind of
    // feature there is, so this pins that it is actually reachable.
    for (const path of ['self', 'need', 'merit', 'rotc', 'gi-bill']) {
      expect(seen).toContain(path)
    }
  })

  it('never leaves a fully funded student holding a debt', () => {
    // The whole point of §4: aid comes off the year's BILL, not off the
    // loan afterwards, so a funded student never borrows in the first
    // place. If this fails the discount is being applied too late.
    for (const person of livingPeople(world)) {
      const funding = world.education.get(person.id)?.funding
      if (funding !== 'rotc' && funding !== 'gi-bill') continue
      const owes = accountsOf(world, person.id).loans.some((l) => l.kind === 'student')
      // ...unless ROTC fell through and the fees became a debt, which is
      // the spec's own alternative and a different thing entirely.
      const repaid = world.events.some(
        (event) =>
          event.type === 'won-funding' &&
          event.subjectId === person.id &&
          event.detail === 'rotc-repaid',
      )
      if (!repaid) expect(owes).toBe(false)
    }
  })

  it('collects what ROTC is owed', () => {
    // A debt nobody ever collects is not a bargain, it is a scholarship
    // with a longer name. Everybody the fees were paid for either took the
    // commission or owes the money back.
    const signed = livingPeople(world).filter(
      (person) => world.education.get(person.id)?.funding === 'rotc',
    )
    expect(signed.length).toBeGreaterThan(0)
    const honoured = world.events.filter(
      (event) =>
        event.type === 'won-funding' &&
        (event.detail === 'rotc-served' || event.detail === 'rotc-repaid'),
    )
    expect(honoured.length).toBeGreaterThan(0)
  })

  it('awards merit for the record and need for the money', () => {
    // Order of precedence, and it is not cosmetic: merit is tested before
    // need so a poor child with a strong record is on a scholarship for
    // the record, not for the poverty.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.funding !== 'merit') continue
      expect(record.attainment).toBeGreaterThanOrEqual(MERIT_ATTAINMENT)
    }
  })

  it('puts nobody in the K-12 ladder on a scholarship', () => {
    // Nobody is billed for childhood, so nobody is funded through it.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.funding === undefined) continue
      const everHigher =
        isHigherEducation(record.level) || isHigherEducation(record.enrolledIn)
      expect(everHigher).toBe(true)
    }
  })
})

/**
 * Education phases 7 and 8 — the step above the degree, and the way back.
 */
describe('graduate school', () => {
  it('sits above the degree without disturbing anything under it', () => {
    // Appended, not inserted: every gate below keeps its meaning, which is
    // the same property that made the middle-school insertion safe.
    expect(educationRank('graduate')).toBeGreaterThan(educationRank('college'))
    expect(educationRank('college')).toBe(5)
    expect(meetsRequirement('graduate', 'college')).toBe(true)
    expect(meetsRequirement('graduate', 'secondary')).toBe(true)
    expect(meetsRequirement('college', 'graduate')).toBe(false)
    // And it is full-time study, so it keeps somebody out of a full job.
    expect(isHigherEducation('graduate')).toBe(true)
  })

  it('is selective, and never a closed door', () => {
    // Somebody who misses the mark can study, raise the record and come
    // back — a permanent bar at twenty-two is the dead end Law 7 forbids.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record === undefined) continue
      if (record.level !== 'graduate' && record.enrolledIn !== 'graduate') continue
      expect(record.attainment).toBeGreaterThanOrEqual(GRADUATE_ADMISSION - 100)
    }
  })

  it('is read in a university field, never a trade certificate', () => {
    // Nobody reads for a master's in a welding certificate.
    const fields = majorsFor('graduate').map((major) => major.id)
    expect(fields.length).toBeGreaterThan(0)
    expect(fields).not.toContain('welding')
    for (const field of fields) {
      expect(majorById(field)?.forLevel).toBe('college')
    }
  })
})

describe('leaving, and coming back', () => {
  it('lets an adult without a diploma sit for one at any age', () => {
    // The GED path (§8). The door that shuts at twenty-four is the one
    // into college; closing the way back to a high-school diploma with it
    // would make one bad year at sixteen a life sentence.
    const own = createWorld(makeSeed(4141), 200)
    advanceTicks(own, 40 * 12)
    const dropout = livingPeople(own).find((person) => {
      const record = own.education.get(person.id)
      const age = ageAt(person.birthTick, own.tick)
      return (
        age > 30 &&
        record !== undefined &&
        record.enrolledIn === null &&
        educationRank(record.level) < educationRank('secondary')
      )
    })
    // If nobody in this town missed school, the claim is untestable
    // rather than false — but say so instead of passing silently.
    expect(dropout).toBeDefined()
    if (dropout === undefined) return
    expect(enrolmentBar(own, dropout, own.tick)).toBeNull()
  })

  it('keeps the fees when somebody walks away from a course', () => {
    // No degree, and the debt stays: somebody who leaves in their third
    // year owes three years and has nothing to show for it, which is the
    // real cost of the decision and the reason it is a decision.
    const own = createWorld(makeSeed(4141), 200)
    advanceTicks(own, 30 * 12)
    const student = livingPeople(own).find(
      (person) => own.education.get(person.id)?.enrolledIn === 'college',
    )
    expect(student).toBeDefined()
    if (student === undefined) return

    const before = own.education.get(student.id)
    const debtBefore = accountsOf(own, student.id).loans.find((l) => l.kind === 'student')
    expect(dropOut(own, own.tick, student.id)).toBe(true)

    const after = own.education.get(student.id)
    expect(after?.enrolledIn).toBeNull()
    // The level they already held is untouched — leaving college does not
    // take away the diploma.
    expect(after?.level).toBe(before?.level)
    const debtAfter = accountsOf(own, student.id).loans.find((l) => l.kind === 'student')
    expect(debtAfter?.balance ?? 0).toBe(debtBefore?.balance ?? 0)
    // And it is not a dead end: they can go back.
    expect(dropOutBar(own, student.id)).not.toBeNull()
  })

  it('will not let a child drop out of primary school', () => {
    const child = livingPeople(world).find((person) => {
      const record = world.education.get(person.id)
      return record?.enrolledIn === 'primary' || record?.enrolledIn === 'middle'
    })
    expect(child).toBeDefined()
    if (child === undefined) return
    expect(dropOutBar(world, child.id)).toContain('Children')
  })
})
