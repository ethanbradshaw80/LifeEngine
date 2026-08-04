/**
 * The tick systems. Each runs once per simulated month, over every living
 * person in ascending entity-ID order.
 *
 * Ordering within the tick is fixed and documented in tick.ts. Ordering within
 * a system is always ascending entity ID — never Map insertion order, never
 * "whatever the collection gives us" — because processing order affects
 * outcomes and must be reproducible.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { entityId, TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt, isBirthdayMonth } from './clock.js'
import {
  educationRank,
  meetsRequirement,
  OCCUPATIONS,
  occupationById,
  typicalPay,
} from './content.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { atTodaysPrices } from './economy.js'
import { openStream, Stream } from './rng.js'
import type { Rng } from './rng.js'
import type {
  EducationLevel,
  EmploymentRecord,
  Household,
  Person,
  Relationship,
  Sex,
  World,
} from './types.js'
import { withArticle } from './text.js'
import { endRelationshipsOnDeath, partnerOf, relationshipBetween, stopFamilyEarly } from './relationships.js'
import { hasAnswered, raisePending } from './player.js'
import type { CausalFactor, Occupation } from './types.js'
import {
  canAfford,
  distributeEstate,
  householdCosts,
  householdIncome,
  inArrears,
  startUnemployment,
} from './finances.js'
import { freshHealth, inflictWound, isSeverelyAiling, mortalityFromHealth } from './health.js'
import { isJailed, recordGateOf } from './crime.js'
import { describeAilment, pickInjury } from './wounds.js'
import {
  closeServiceOnDeath,
  educationOffersEnlistment,
  isServing,
  openSurvivorPension,
  veteranUnlocks,
} from './service.js'
import { placesOfKind } from './worldgen.js'

// --- Tunables. Named so the numbers are not scattered as bare literals. ------

const SCHOOL_START_AGE = 6
const PRIMARY_YEARS = 6
const SECONDARY_YEARS = 6
export const TRADE_YEARS = 2
// Exported for the education stakes text (P1) — prose must not drift.
export const COLLEGE_YEARS = 4
/**
 * The three lines a working life is judged against (0-1000 performance).
 * Exported because the Jobs tab tells the player where they stand, and a
 * number the UI hardcodes is a number that drifts away from the model.
 */
export const RAISE_MIN_PERFORMANCE = 350
export const WARNING_PERFORMANCE = 240
export const DISMISSAL_PERFORMANCE = 200

const WORKING_AGE = 18
const RETIREMENT_AGE = 66
const LEAVE_HOME_AGE = 19
/** Months a household must exist before it will consider moving again. */
const SETTLING_MONTHS = 24
// Exported so demographics.ts's copies are testable against these (D1).
export const CHILDBEARING_MIN_AGE = 20
export const CHILDBEARING_MAX_AGE = 42

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Living people, in ascending id order. The canonical processing order. */
export function livingPeople(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((a, b) => a.id - b.id)
  return living
}

function setPerson(world: World, person: Person): void {
  world.people.set(person.id, person)
}

function householdOf(world: World, person: Person): Household | undefined {
  return person.householdId === null ? undefined : world.households.get(person.householdId)
}

function allocateId(world: World): EntityId {
  const id = entityId(world.nextEntityId)
  world.nextEntityId += 1
  return id
}

function removeFromHousehold(world: World, householdId: EntityId, personId: EntityId): void {
  const household = world.households.get(householdId)
  if (!household) return
  const remaining = household.memberIds.filter((id) => id !== personId)
  world.households.set(householdId, {
    ...household,
    memberIds: remaining,
    dissolvedTick: remaining.length === 0 ? world.tick : household.dissolvedTick,
  })
}

function addToHousehold(world: World, householdId: EntityId, personId: EntityId): void {
  const household = world.households.get(householdId)
  if (!household) return
  if (household.memberIds.includes(personId)) return
  world.households.set(householdId, {
    ...household,
    memberIds: [...household.memberIds, personId],
  })
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

function yearsFor(level: EducationLevel): number {
  switch (level) {
    case 'primary':
      return PRIMARY_YEARS
    case 'secondary':
      return SECONDARY_YEARS
    case 'trade':
      return TRADE_YEARS
    case 'college':
      return COLLEGE_YEARS
    default:
      return 0
  }
}

function nextLevel(current: EducationLevel): EducationLevel | null {
  switch (current) {
    case 'none':
      return 'primary'
    case 'primary':
      return 'secondary'
    case 'secondary':
      return null // trade or college is a choice, handled below
    default:
      return null
  }
}

export function runEducation(world: World, tick: Tick): void {
  for (const person of livingPeople(world)) {
    const record = world.education.get(person.id)
    if (!record) continue
    const age = ageAt(person.birthTick, tick)

    // Finish a course that has come due.
    if (record.enrolledIn !== null && record.completesAtTick !== null && tick >= record.completesAtTick) {
      world.education.set(person.id, {
        ...record,
        level: record.enrolledIn,
        enrolledIn: null,
        enrolledAtTick: null,
        completesAtTick: null,
      })
      recordEvent(world, tick, {
        type: 'finished-school',
        subjectId: person.id,
        detail: record.enrolledIn,
      })
      continue
    }

    if (record.enrolledIn !== null) continue // still studying
    if (age < SCHOOL_START_AGE) continue

    const rng = openStream(world.seed, Stream.Education, person.id, tick)

    // Compulsory-ish progression through primary and secondary.
    //
    // The age caps matter: without them an adult in the founding generation
    // whose schooling stopped at primary would enrol in secondary school at 25
    // and graduate at 32, which is not how school works. People who missed
    // school stay at the level they reached.
    const automatic = nextLevel(record.level)
    if (automatic !== null && age >= SCHOOL_START_AGE) {
      const tooOld =
        (automatic === 'primary' && age > 12) || (automatic === 'secondary' && age > 19)
      if (!tooOld) {
        enrol(world, tick, person, automatic, rng)
        continue
      }
    }

    // After secondary: trade or college, driven by curiosity and diligence.
    if (record.level === 'secondary' && age >= 18 && age <= 24) {
      // The player is asked once, at 18, rather than rolled for: this is the
      // first fork in a life and it should never happen off-screen. An NPC's
      // appetite roll decides the same question for them.
      if (person.id === world.player.personId) {
        if (!hasAnswered(world, 'education')) {
          raisePending(world, {
            tick,
            kind: 'education',
            personId: person.id,
            otherId: null,
            occupationId: null,
            workplaceId: null,
            monthlyPay: null,
            placeId: null,
            // The fork at eighteen offers the uniform beside the classroom
            // when the person qualifies (L4-M3).
            options: educationOffersEnlistment(world, person, tick)
              ? ['college', 'trade', 'work', 'enlist']
              : ['college', 'trade', 'work'],
          })
        }
        continue
      }
      const appetite = Math.floor((person.traits.curiosity * 2 + person.traits.diligence) / 3)
      if (!rng.chance(appetite, 4000)) continue
      const choice: EducationLevel = rng.chance(person.traits.curiosity, 1400) ? 'college' : 'trade'
      enrol(world, tick, person, choice, rng)
    }
  }
}

/** Player answer applied through the same enrolment code NPCs use. */
export function enrolPlayer(world: World, tick: Tick, person: Person, level: EducationLevel): void {
  const rng = openStream(world.seed, Stream.Education, person.id, tick)
  enrol(world, tick, person, level, rng)
}

/**
 * P2. Why the schoolhouse door is closed — or null when it is open. The
 * same 18–24 / secondary window the NPC appetite roll keeps. The verb AND
 * the UI both read this one function, so the button state can never
 * disagree with the refusal words (review S7).
 */
export function enrolmentBar(world: World, person: Person, tick: Tick): string | null {
  const age = ageAt(person.birthTick, tick)
  if (age < 18) return 'Not yet eighteen.'
  if (age > 24) return 'The schoolhouse takes them younger. That door has closed.'
  if (isServing(world, person.id)) return 'The uniform is a full-time career.'
  const education = world.education.get(person.id)
  if (!education) return 'The schooling already stands.'
  if (education.enrolledIn !== null) return 'Already enrolled.'
  if (education.level !== 'secondary') return 'The schooling already stands.'
  return null
}

function enrol(world: World, tick: Tick, person: Person, level: EducationLevel, rng: Rng): void {
  const record = world.education.get(person.id)
  if (!record) return
  // A little variance so cohorts do not move in lockstep.
  const months = yearsFor(level) * TICKS_PER_YEAR + rng.nextInt(0, 6)
  world.education.set(person.id, {
    ...record,
    enrolledIn: level,
    enrolledAtTick: tick,
    completesAtTick: (tick + months) as Tick,
  })
  recordEvent(world, tick, { type: 'started-school', subjectId: person.id, detail: level })
}

// ---------------------------------------------------------------------------
// Employment
// ---------------------------------------------------------------------------

/**
 * C3 §3. Whether the county has a constable's post going.
 *
 * A CONSTABLE IS A PUBLIC OFFICE, NOT A TRADE. Left as an ordinary
 * occupation it was picked like any other and a town of sixty adults hired
 * four of them — one working adult in fifteen wearing a badge, which is
 * about thirty times the real ratio and flattened the crime-pressure index
 * to nothing on its own.
 *
 * One post per two hundred and fifty adults, and always at least one: even
 * a small town has somebody to call.
 */
function constableSeatOpen(world: World): boolean {
  let adults = 0
  let serving = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 65) continue
    adults += 1
    if (world.employment.get(person.id)?.occupationId === 'constable') serving += 1
  }
  return serving < Math.max(1, Math.floor(adults / 250) + 1)
}

export function runEmployment(world: World, tick: Tick): void {
  const workplaces = placesOfKind(world, 'workplace')
  if (workplaces.length === 0) return

  for (const person of livingPeople(world)) {
    // The uniform is a full-time career: no civilian hiring, hopping or
    // retirement mechanics while serving (L4-M3; the service system owns it).
    if (isServing(world, person.id)) continue
    // Jail is absence (C1): no work happens from a cell.
    if (isJailed(world, person.id)) continue

    const age = ageAt(person.birthTick, tick)
    const education = world.education.get(person.id)
    if (!education) continue

    const job = world.employment.get(person.id)

    // Retirement.
    if (job && age >= RETIREMENT_AGE) {
      // The player is asked, once a year on their birthday, and may keep
      // working as long as they live. An NPC retires when the age arrives;
      // modelling every NPC's retirement appetite would be depth nobody sees.
      if (person.id === world.player.personId) {
        if (isBirthdayMonth(person.birthTick, tick)) {
          raisePending(world, {
            tick,
            kind: 'retirement',
            personId: person.id,
            otherId: null,
            occupationId: job.occupationId,
            workplaceId: job.workplaceId,
            monthlyPay: job.monthlyPay,
            placeId: null,
            options: ['retire', 'keep-working'],
          })
        }
        // A working player past retirement age still does their job.
        const rngWorking = openStream(world.seed, Stream.Employment, person.id, tick)
        driftPerformance(world, person, job, rngWorking)
        continue
      }
      retirePerson(world, tick, person, [factor('old-age', 900)])
      continue
    }

    if (age < WORKING_AGE || age >= RETIREMENT_AGE) continue
    if (education.enrolledIn !== null && educationRank(education.enrolledIn) > 2) continue // full-time study

    const rng = openStream(world.seed, Stream.Employment, person.id, tick)

    if (job) {
      driftPerformance(world, person, job, rng)
      annualReview(world, tick, person)
      considerBetterJob(world, tick, person, job, rng, workplaces.length)
      continue
    }

    // Too ill or hurt to take new work this month.
    if (isSeverelyAiling(world, person.id)) continue

    // Unemployed: look for work. A veteran's specialty opens doors their
    // schooling alone would not — the mechanic comes home a machinist.
    const unlocked = veteranUnlocks(world, person.id)
    const eligible = OCCUPATIONS.filter(
      (o) => meetsRequirement(education.level, o.requires) || unlocked.includes(o.id),
    ).filter((o) => o.id !== 'constable' || constableSeatOpen(world))
    if (eligible.length === 0) continue

    // Hiring is not guaranteed — ambition and diligence improve the odds,
    // and a recent conviction closes some doors before they open (C1): the
    // record follows, though after ten clean years it stops gating.
    // C3 §5. THE GATE GRADES INSTEAD OF FLIPPING. It used to be a boolean
    // that switched off on an anniversary: barred one month, forgotten the
    // next. A hard gate is the wall it always was, a soft one is a door
    // that got heavier, and an old conviction is not read at all.
    const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
    const gate = recordGateOf(world, person.id, world.tick)
    const recordDrag = gate === 'hard' ? 120 : gate === 'soft' ? 45 : 0
    if (!rng.chance(Math.max(40, 250 + Math.floor(drive / 4) - recordDrag), 1000)) continue

    // Prefer better-paid roles, weighted rather than always-the-best, so two
    // people with identical qualifications do not lead identical lives.
    const weights = eligible.map((o) => 1 + Math.floor(typicalPay(o) / 10_000))
    const chosen = rng.pickWeighted(eligible, weights)
    const workplace = rng.pick(workplaces)
    // M-ECON §4. THE BAND IS BASE-YEAR; a wage is offered at TODAY'S prices.
    // Without this, rent inflates over a century and pay does not, and every
    // household in the world ends up permanently behind.
    const pay = atTodaysPrices(
      world,
      rng.nextIntInclusive(chosen.minMonthlyPay, chosen.maxMonthlyPay),
    ) as Money

    // The roll decided an opportunity exists this month. For the player it
    // becomes an offer they can refuse; refused, it is gone (Law 5).
    if (person.id === world.player.personId) {
      raisePending(world, {
        tick,
        kind: 'job-offer',
        personId: person.id,
        otherId: null,
        occupationId: chosen.id,
        workplaceId: workplace.id,
        monthlyPay: pay,
        placeId: null,
        options: ['accept', 'decline'],
      })
      continue
    }

    const rejected = eligible
      .filter((o) => o.id !== chosen.id)
      .map((o) => `to take work as ${withArticle(o.title)}`)
    hirePerson(world, tick, person, chosen, workplace.id, pay, [
      factor('qualified-for-role', 500 + educationRank(education.level) * 100),
      factor('ambition', person.traits.ambition),
      factor('higher-pay', Math.floor(typicalPay(chosen) / 1000)),
    ], rejected.slice(0, 3))
  }
}

/** One hiring implementation for both the automatic path and player choices. */
export function hirePerson(
  world: World,
  tick: Tick,
  person: Person,
  occupation: Occupation,
  workplaceId: EntityId,
  pay: Money,
  inputs: readonly CausalFactor[],
  rejected: readonly string[] = [],
): void {
  const previous = world.employment.get(person.id)
  if (previous) {
    recordEvent(world, tick, {
      type: 'left-job',
      subjectId: person.id,
      detail: occupationById(previous.occupationId).title,
    })
  }
  world.employment.set(person.id, {
    personId: person.id,
    occupationId: occupation.id,
    workplaceId,
    monthlyPay: pay,
    startedAtTick: tick,
    performance: previous?.performance ?? Math.floor((person.traits.diligence + 500) / 2),
  })
  recordEvent(world, tick, {
    type: 'hired',
    subjectId: person.id,
    placeId: workplaceId,
    detail: occupation.title,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs,
    chosen: `took work as ${withArticle(occupation.title)}`,
    rejected: [...rejected],
    streamId: Stream.Employment,
  })
}

/** One retirement implementation for both the automatic path and player choices. */
export function retirePerson(
  world: World,
  tick: Tick,
  person: Person,
  inputs: readonly CausalFactor[],
): void {
  world.employment.delete(person.id)
  recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'retired' })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs,
    chosen: 'retired',
    rejected: ['to keep working'],
    streamId: Stream.Employment,
  })
}

/**
 * P2. Walking out is the automatic paths' teardown with an honest name: the
 * job is released, the record says whose choice it was. Shared so a future
 * NPC quit (none is modelled today) behaves identically.
 */
export function performQuit(
  world: World,
  tick: Tick,
  person: Person,
  inputs: readonly CausalFactor[],
): void {
  const job = world.employment.get(person.id)
  if (!job) return
  world.employment.delete(person.id)
  recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'quit' })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs,
    chosen: `quit the ${occupationById(job.occupationId).title} work`,
    rejected: ['to stay in the role'],
    streamId: Stream.Employment,
  })
}

/**
 * P2 single-writer helpers for employment fields (the service.ts pattern):
 * the caller owns the story, systems owns the write.
 */
export function adjustJobPerformance(world: World, personId: EntityId, amount: number): void {
  const job = world.employment.get(personId)
  if (!job) return
  world.employment.set(personId, {
    ...job,
    performance: Math.max(0, Math.min(1000, job.performance + amount)),
  })
}

/** A raise granted outside the annual cycle — the asked-for kind. */
export function grantRaise(world: World, tick: Tick, personId: EntityId, newPay: Money): void {
  const job = world.employment.get(personId)
  if (!job) return
  world.employment.set(personId, { ...job, monthlyPay: newPay })
  recordEvent(world, tick, {
    type: 'got-raise',
    subjectId: personId,
    placeId: job.workplaceId,
    detail: String(newPay),
  })
}

/**
 * The annual review: pay creeps toward the occupation's ceiling, faster for
 * good work. M-DEPTH2 — before this, pay was set at hire and never moved,
 * which made a forty-year career financially identical to forty first years.
 *
 * Deliberately NO random draw: performance already carries the noise (it
 * drifts stochastically each month), and a raise that follows from recorded
 * performance is explainable in a way a payroll lottery is not. Poor work
 * (under 350) earns nothing — the review happens; the raise does not.
 *
 * Not a player decision: nobody decides to receive a raise. It lands in the
 * feed like weather.
 */
function annualReview(world: World, tick: Tick, person: Person): void {
  const job = world.employment.get(person.id)
  if (!job) return
  const monthsIn = tick - job.startedAtTick
  if (monthsIn < TICKS_PER_YEAR || monthsIn % TICKS_PER_YEAR !== 0) return

  const occupation = occupationById(job.occupationId)
  // M-ECON §4. THE BAND MOVES WITH PRICES, so a wage set in 1970 is judged
  // against 1970's ceiling expressed in today's money, not against a figure
  // that stopped meaning anything decades ago.
  const ceiling = atTodaysPrices(world, occupation.maxMonthlyPay)
  const headroom = ceiling - job.monthlyPay

  // COST OF LIVING FIRST, and it is not merit — it is the year catching up
  // with the wage. Good times pass it on; a downturn does not, which is
  // what "freezes in bad times" means and why a recession quietly costs a
  // household ground even when nobody is laid off.
  const inflation = world.economy.inflationPerMille
  const passedOn = inflation > 0 && world.economy.growthPerMille > 0 ? inflation : 0
  const cola = Math.floor((job.monthlyPay * passedOn) / 1000)

  if (headroom <= 0 || job.performance < RAISE_MIN_PERFORMANCE) {
    // No merit raise, but the cost of living still moves for anyone whose
    // pay has fallen behind the band's floor.
    if (cola > 0 && job.monthlyPay < ceiling) {
      world.employment.set(person.id, {
        ...job,
        monthlyPay: Math.min(job.monthlyPay + cola, ceiling) as Money,
      })
    }
    return
  }

  // Top performance closes ~15% of the remaining gap a year; adequate ~5%.
  const raise = Math.floor((headroom * job.performance) / 6500) + cola
  if (raise < Math.floor(job.monthlyPay / 100)) return // under 1%: not worth an event

  // Never above the band's ceiling. The ceiling itself rises with prices,
  // so somebody already at the top still keeps pace with the cost of living
  // — the raise simply arrives as the band moving under them.
  const newPay = Math.min(job.monthlyPay + raise, ceiling) as Money
  if (newPay <= job.monthlyPay) return
  world.employment.set(person.id, { ...job, monthlyPay: newPay })
  recordEvent(world, tick, {
    type: 'got-raise',
    subjectId: person.id,
    placeId: job.workplaceId,
    detail: String(newPay),
  })
}

function driftPerformance(world: World, person: Person, job: EmploymentRecord, rng: Rng): void {
  // The body sets the ceiling (L4-M2): performance drifts toward what
  // diligence can deliver THROUGH the disability, and an active severe
  // ailment drags the month regardless.
  const health = world.health.get(person.id)
  const ceiling = Math.max(0, person.traits.diligence - Math.floor((health?.disability ?? 0) / 2))
  const ailingDrag = health && health.ailment !== null && health.severity >= 600 ? 25 : 0

  const pull = ceiling - job.performance
  const drift = Math.floor(pull / 40) + rng.nextInt(-8, 9) - ailingDrag
  const next = Math.max(0, Math.min(1000, job.performance + drift))
  world.employment.set(person.id, { ...job, performance: next })
}

function considerBetterJob(
  world: World,
  tick: Tick,
  person: Person,
  job: EmploymentRecord,
  rng: Rng,
  workplaceCount: number,
): void {
  const education = world.education.get(person.id)
  if (!education) return

  // P2: the player hears about it before the axe. One warning per job spell,
  // at the top of the slide (240) rather than inside the dismissal zone
  // (200), so the warning can still be acted on. The dismissal model below
  // is untouched — a warned player who keeps sliding is let go exactly as an
  // NPC would be; the moment is the knowing, not a shield.
  if (
    person.id === world.player.personId &&
    job.performance < WARNING_PERFORMANCE &&
    !world.player.log.some(
      (entry) => entry.kind === 'foremans-warning' && entry.tick >= job.startedAtTick,
    )
  ) {
    const landed = raisePending(world, {
      tick,
      kind: 'foremans-warning',
      personId: person.id,
      otherId: null,
      occupationId: job.occupationId,
      workplaceId: job.workplaceId,
      monthlyPay: null,
      placeId: null,
      options: ['knuckle-down', 'shrug'],
    })
    if (landed) {
      recordEvent(world, tick, {
        type: 'warned-at-work',
        subjectId: person.id,
        placeId: job.workplaceId,
      })
      return // the month belongs to the warning; the rolls resume next tick
    }
  }

  // M-ECON §4. THE ECONOMY TAKES JOBS.
  //
  // Until now a job could only be lost by being bad at it — so a recession
  // was a number nobody felt, and the single largest thing an economy does
  // to a life did not happen. A downturn lays people off, and it does not
  // ask whether they were any good: it leans on the weak, but it reaches
  // everyone.
  //
  // Scaled off unemployment, which the cycle already moves — expansion sits
  // near 40 per-mille and a depression near 190, so this is roughly five
  // times as likely at the bottom as at the top.
  const slack = world.economy.unemploymentPerMille
  if (slack > 55) {
    // A weak file goes first, which is what "last in, first out" really
    // looks like from inside — but a good one is not safe.
    const exposure = job.performance < DISMISSAL_PERFORMANCE ? 3 : 1
    if (rng.chanceInTenThousand(Math.min(400, (slack - 55) * exposure))) {
      world.employment.delete(person.id)
      // M-SAFETY §4. A LAYOFF QUALIFIES; being sacked and walking out do
      // not. The insurance runs for a bounded stretch from here, which is
      // the floor under the single largest thing an economy does to a life.
      startUnemployment(world, person.id, tick)
      recordEvent(world, tick, { type: 'laid-off', subjectId: person.id, detail: 'laid off' })
      recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'laid off' })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'employment-change',
        significance: 'major',
        inputs: [
          factor('economy-turned', Math.min(1000, slack * 5)),
          ...(job.performance < DISMISSAL_PERFORMANCE
            ? [factor('poor-performance', 1000 - job.performance)]
            : []),
        ],
        chosen: 'was laid off',
        rejected: ['to keep the job'],
        streamId: Stream.Economy,
      })
      return
    }
  }

  // Poor performers can lose the job.
  if (job.performance < DISMISSAL_PERFORMANCE && rng.chanceInTenThousand(400)) {
    world.employment.delete(person.id)
    recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'let go' })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'employment-change',
      significance: 'major',
      inputs: [factor('poor-performance', 1000 - job.performance)],
      chosen: 'was let go',
      rejected: ['to stay in the role'],
      streamId: Stream.Employment,
    })
    return
  }

  // Ambitious people occasionally move for better pay.
  if (!rng.chance(person.traits.ambition, 60_000)) return

  const current = occupationById(job.occupationId)
  const better = OCCUPATIONS.filter(
    (o) => meetsRequirement(education.level, o.requires) && typicalPay(o) > typicalPay(current),
  )
  if (better.length === 0) return

  const target = rng.pick(better)
  const pay = atTodaysPrices(
    world,
    rng.nextIntInclusive(target.minMonthlyPay, target.maxMonthlyPay),
  ) as Money
  if (pay <= job.monthlyPay) return

  const workplaces = placesOfKind(world, 'workplace')
  const workplace = workplaces.length > 0 ? rng.pick(workplaces) : null
  if (!workplace || workplaceCount === 0) return

  // A better opening exists. The player decides whether to take it; an NPC's
  // ambition already decided for them when the roll passed.
  if (person.id === world.player.personId) {
    raisePending(world, {
      tick,
      kind: 'job-offer',
      personId: person.id,
      otherId: null,
      occupationId: target.id,
      workplaceId: workplace.id,
      monthlyPay: pay,
      placeId: null,
      options: ['accept', 'decline'],
    })
    return
  }

  hirePerson(world, tick, person, target, workplace.id, pay, [
    factor('higher-pay', Math.floor((pay - job.monthlyPay) / 100)),
    factor('ambition', person.traits.ambition),
    factor('qualified-for-role', 400),
  ], [`to stay as ${withArticle(current.title)}`])
}

// ---------------------------------------------------------------------------
// Households: leaving home, partnering, moving
// ---------------------------------------------------------------------------

export function runHouseholds(world: World, tick: Tick): void {
  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) return

  for (const person of livingPeople(world)) {
    const age = ageAt(person.birthTick, tick)
    if (age < LEAVE_HOME_AGE) continue

    const household = householdOf(world, person)
    if (!household) continue

    const rng = openStream(world.seed, Stream.LifeEventTiming, person.id, tick)

    // Couples who live apart may move in together.
    //
    // Without this, household formation only ever fired for someone still
    // living with their parents, so anyone who moved out alone could never
    // pair up. Over fifty years that produced eight couples living separately,
    // one marriage and almost no children — the population quietly collapsed.
    if (moveInWithPartner(world, tick, person, rng)) continue
    const job = world.employment.get(person.id)
    const stillWithParents = person.parentIds.some((id) => household.memberIds.includes(id))

    // Leave the parental home once there is an income — and only to a street
    // the wage can actually carry. A labourer does not move out into Kestrel
    // Hill; if nothing is affordable, they stay home and save.
    //
    // NOT while the partner lives under the same roof (D2 review M1): a
    // married person in a multigenerational household is not a kid leaving
    // home, and the solo move-out walked out on spouse and newborn, whom
    // moveInWithPartner then reunited — an endless recordless oscillation.
    // The couple moving out TOGETHER is a future household behaviour.
    if (stillWithParents && job) {
      const partnerId = partnerOf(world, person.id)
      if (partnerId !== null && household.memberIds.includes(partnerId)) continue
      if (!rng.chance(60 + Math.floor(person.traits.ambition / 20), 1000)) continue

      const affordable = neighbourhoods.filter((p) => canAfford(job.monthlyPay, p.desirability))
      if (affordable.length === 0) continue
      const home = rng.pick(affordable)

      // The urge and the destination are simulated either way; only who says
      // yes differs. The player can stay home as long as they like. P2: the
      // whole (already deterministic) affordable list is on the table —
      // 'accept' is the engine's pick, 'to-<placeId>' any other door.
      if (person.id === world.player.personId) {
        raisePending(world, {
          tick,
          kind: 'move-out',
          personId: person.id,
          otherId: null,
          occupationId: null,
          workplaceId: null,
          monthlyPay: null,
          placeId: home.id,
          options: [
            'accept',
            'decline',
            ...affordable
              .filter((p) => p.id !== home.id)
              .sort((x, y) => x.id - y.id)
              .map((p) => `to-${String(p.id)}`),
          ],
        })
        continue
      }

      performMoveOut(world, tick, person, home.id, [])
      continue
    }

    // Established households occasionally move somewhere better.
    if (!stillWithParents && job) {
      const current = world.places.get(household.placeId)
      if (!current) continue
      // Settle in before moving again. Without this, people who have just left
      // home move across town in the same year, which reads as thrashing.
      if (tick - household.formedTick < SETTLING_MONTHS) continue
      if (!rng.chanceInTenThousand(60)) continue

      const income = householdIncome(world, household)
      const better = neighbourhoods.filter(
        (p) => p.desirability > current.desirability + 100 && canAfford(income, p.desirability),
      )
      if (better.length === 0) continue

      const target = rng.pick(better)

      // A better street is affordable. The player decides whether the family
      // moves; for an NPC the desirability gap already decided. P2: every
      // qualifying street is offered, not just the engine's pick.
      if (person.id === world.player.personId) {
        raisePending(world, {
          tick,
          kind: 'move-house',
          personId: person.id,
          otherId: null,
          occupationId: null,
          workplaceId: null,
          monthlyPay: null,
          placeId: target.id,
          options: [
            'accept',
            'decline',
            ...better
              .filter((p) => p.id !== target.id)
              .sort((x, y) => x.id - y.id)
              .map((p) => `to-${String(p.id)}`),
          ],
        })
        continue
      }

      world.households.set(household.id, { ...household, placeId: target.id })
      recordEvent(world, tick, { type: 'moved-house', subjectId: person.id, placeId: target.id })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'move',
        significance: 'major',
        inputs: [
          factor('better-neighbourhood', target.desirability - current.desirability),
          factor('can-afford-move', Math.floor(job.monthlyPay / 100)),
        ],
        chosen: `moved to ${target.name}`,
        rejected: [`to stay in ${current.name}`],
        streamId: Stream.LifeEventTiming,
      })
    }
  }
}

/**
 * Merge two households when a courting or married couple live apart.
 *
 * The person with fewer people depending on them moves; ties break on the lower
 * entity id so the outcome never depends on iteration order.
 */
function moveInWithPartner(world: World, tick: Tick, person: Person, rng: Rng): boolean {
  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return false

  const partner = world.people.get(partnerId)
  if (!partner || partner.deathTick !== null) return false
  if (person.householdId === null || partner.householdId === null) return false
  if (person.householdId === partner.householdId) return false
  if (ageAt(partner.birthTick, tick) < LEAVE_HOME_AGE) return false

  const tie = relationshipBetween(world, person.id, partnerId)
  if (!tie) return false

  // Only one of the pair should act. The lower id decides, so the same couple
  // is not processed twice in the same month.
  if (person.id > partnerId) return false

  // Stronger and longer attachments move in sooner — and newlyweds do not
  // keep two houses for a year (D2: the measured cohabitation lag was
  // eating the family window).
  const months = tick - tie.typeSinceTick
  const weddingPull = tie.type === 'spouse' ? 320 : 0
  const appetite = Math.floor(tie.strength / 8) + Math.min(60, months) + weddingPull
  if (!rng.chance(appetite, 1_400)) return false

  const personHome = world.households.get(person.householdId)
  const partnerHome = world.households.get(partner.householdId)
  if (!personHome || !partnerHome) return false

  const personDependents = personHome.memberIds.filter((id) =>
    world.people.get(id)?.parentIds.includes(person.id),
  ).length
  const partnerDependents = partnerHome.memberIds.filter((id) =>
    world.people.get(id)?.parentIds.includes(partnerId),
  ).length

  const moverIsPerson =
    personDependents < partnerDependents ||
    (personDependents === partnerDependents && person.id < partnerId)

  const moverId = moverIsPerson ? person.id : partnerId
  const destination = moverIsPerson ? partnerHome : personHome
  const mover = world.people.get(moverId)
  if (!mover || mover.householdId === null) return false

  removeFromHousehold(world, mover.householdId, moverId)
  addToHousehold(world, destination.id, moverId)
  setPerson(world, { ...mover, householdId: destination.id })

  recordEvent(world, tick, {
    type: 'moved-in-together',
    subjectId: moverId,
    otherId: moverIsPerson ? partnerId : person.id,
    placeId: destination.placeId,
  })
  recordDecision(world, tick, {
    subjectId: moverId,
    decision: 'household-formation',
    significance: 'defining',
    inputs: [
      factor('close-friendship', tie.strength, moverIsPerson ? partnerId : person.id),
      factor('years-together', months),
    ],
    chosen: `moved in with ${moverIsPerson ? partner.givenName : person.givenName}`,
    rejected: ['to keep living apart'],
    streamId: Stream.LifeEventTiming,
  })
  return true
}

/**
 * Relocate a household. Used by the player's move-house resolution.
 */
export function moveHouse(
  world: World,
  tick: Tick,
  person: Person,
  placeId: EntityId,
  extraInputs: readonly CausalFactor[],
): void {
  const household = householdOf(world, person)
  const target = world.places.get(placeId)
  if (!household || !target) return
  const current = world.places.get(household.placeId)

  world.households.set(household.id, { ...household, placeId })
  recordEvent(world, tick, { type: 'moved-house', subjectId: person.id, placeId })
  // A downhill move is not a negative amount of "better street" — it is a
  // cheaper one, and the record says which it was (review S5).
  const desirabilityGain = target.desirability - (current?.desirability ?? 0)
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'move',
    significance: 'major',
    inputs: [
      ...extraInputs,
      desirabilityGain >= 0
        ? factor('better-neighbourhood', desirabilityGain)
        : factor('cheaper-rent', -desirabilityGain),
    ],
    chosen: `moved to ${target.name}`,
    rejected: [current ? `to stay in ${current.name}` : 'to stay put'],
    streamId: Stream.LifeEventTiming,
  })
}

/** One move-out implementation for both the automatic path and player choices.
 * Extra inputs (the player's 'own-choice') are listed first in the record.
 */
export function performMoveOut(
  world: World,
  tick: Tick,
  person: Person,
  placeId: EntityId,
  extraInputs: readonly CausalFactor[],
): void {
  const household = householdOf(world, person)
  if (!household) return
  const home = world.places.get(placeId)
  if (!home) return

  // Who they pair with is owned by the relationships domain, not decided
  // here. Households react to relationships; they do not create them.
  const partnerId = eligibleCohabitant(world, person.id)
  const newHouseholdId = allocateId(world)

  removeFromHousehold(world, household.id, person.id)
  const members: EntityId[] = [person.id]
  if (partnerId !== null) {
    const partner = world.people.get(partnerId)
    if (partner !== undefined) {
      if (partner.householdId !== null) removeFromHousehold(world, partner.householdId, partnerId)
      members.push(partnerId)
      setPerson(world, { ...partner, householdId: newHouseholdId })
    }
  }

  // A person leaves home with one month of their own wages in hand — a
  // stake from the family, not a share of the family pot. Splitting the
  // parents' savings on every move-out would drain founding households in a
  // generation.
  const moverPay = world.employment.get(person.id)?.monthlyPay ?? 0
  world.households.set(newHouseholdId, {
    id: newHouseholdId,
    placeId: home.id,
    memberIds: members,
    formedTick: tick,
    dissolvedTick: null,
    savings: moverPay as Money,
    spendStance: null,
    homelessSinceTick: null,
  })
  setPerson(world, { ...person, householdId: newHouseholdId })

  recordEvent(world, tick, { type: 'left-home', subjectId: person.id, placeId: home.id })
  if (partnerId !== null) {
    recordEvent(world, tick, {
      type: 'moved-in-together',
      subjectId: person.id,
      otherId: partnerId,
      placeId: home.id,
    })
  }

  const inputs = [...extraInputs, factor('reached-adulthood', 600), factor('has-income', 500)]
  if (partnerId !== null) inputs.push(factor('close-friendship', 800, partnerId))

  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'household-formation',
    significance: 'defining',
    inputs,
    chosen:
      partnerId === null
        ? `moved out to ${home.name}`
        : `moved to ${home.name} with someone close`,
    rejected: ['to stay in the family home'],
    streamId: Stream.LifeEventTiming,
  })
}

/**
 * The partner a person would move in with, if any.
 *
 * Reads the relationships graph; it never creates a tie. Courtship and marriage
 * are the relationships domain's business, and households only react to them.
 */
function eligibleCohabitant(world: World, personId: EntityId): EntityId | null {
  const partnerId = partnerOf(world, personId)
  if (partnerId === null) return null

  const partner = world.people.get(partnerId)
  if (!partner || partner.deathTick !== null) return null

  // Do not pull someone out of a household they already established as an adult.
  const theirHome = partner.householdId === null ? null : world.households.get(partner.householdId)
  if (theirHome && !partner.parentIds.some((id) => theirHome.memberIds.includes(id))) return null

  return partnerId
}

// ---------------------------------------------------------------------------
// Births
//
// Milestone 1 has no marriage system, so a birth requires an adult woman in a
// household with a co-resident adult of the opposite sex. That is a deliberate
// simplification of a genuinely complex area, not a claim about how families
// work; a real model belongs in Layer 2 with the relationship systems.
// ---------------------------------------------------------------------------

/**
 * Could this woman and her partner have a child right now? Returns the
 * partner's id, or null. The SAME eligibility runBirths rolls against,
 * extracted so a custom life (M-GAMEDEPTH) can only ever be born to a couple
 * the automatic path could have given a child to — no household the
 * simulation would refuse.
 */
export function birthEligible(world: World, tick: Tick, person: Person): EntityId | null {
  if (person.deathTick !== null) return null
  if (person.sex !== 'female') return null
  const age = ageAt(person.birthTick, tick)
  if (age < CHILDBEARING_MIN_AGE || age > CHILDBEARING_MAX_AGE) return null

  const household = householdOf(world, person)
  if (!household) return null

  // Milestone 5: a birth needs an actual partnership, not merely two adults
  // who happen to share a roof. That was the Milestone 1 placeholder, and it
  // is why the population used to decline — most people never formed such a
  // household by accident.
  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return null
  if (!household.memberIds.includes(partnerId)) return null
  const partnerPerson = world.people.get(partnerId)
  if (!partnerPerson || partnerPerson.deathTick !== null) return null

  // Living with her parents blocks a COURTING couple, not a married one —
  // newlyweds under a parental roof still start families (D2: the old
  // unconditional check quietly sterilized every couple that merged into a
  // parents' household, which moveInWithPartner does all the time).
  if (person.parentIds.some((id) => household.memberIds.includes(id))) {
    const tie = relationshipBetween(world, person.id, partnerId)
    if (tie === undefined || tie.type !== 'spouse') return null
  }
  return partnerId
}

/**
 * P2. Why the couple cannot try for a child this month, in words — or null
 * when they can. `person` is EITHER partner (the verb is the player's);
 * the gates are birthEligible's, judged on the mother, kept in step by hand:
 * a gate added there without words here is a silent refusal, which the verb
 * exists to prevent.
 */
export function birthBar(world: World, tick: Tick, person: Person): string | null {
  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return 'There is nobody to try with.'
  const partner = world.people.get(partnerId)
  if (!partner || partner.deathTick !== null) return 'They are gone.'

  const mother = person.sex === 'female' ? person : partner
  const father = person.sex === 'female' ? partner : person
  if (mother.sex !== 'female' || father.sex !== 'male') return 'The two of you cannot bear a child.'
  const age = ageAt(mother.birthTick, tick)
  if (age < CHILDBEARING_MIN_AGE) return 'Not yet — too young for that road.'
  if (age > CHILDBEARING_MAX_AGE) return 'That season has passed.'

  const household = householdOf(world, mother)
  if (!household) return 'There is no roof to raise a child under.'
  if (!household.memberIds.includes(father.id)) return 'Not while you live apart.'
  if (mother.parentIds.some((id) => household.memberIds.includes(id))) {
    const tie = relationshipBetween(world, mother.id, father.id)
    if (tie === undefined || tie.type !== 'spouse') return "Not under her parents' roof, unwed."
  }
  return null
}

/**
 * The per-ten-thousand monthly conception chance for this couple — the birth
 * model's own arithmetic, extracted so the P2 try-for-child verb rolls the
 * SAME odds runBirths does. D2: for some women the children never come, and
 * for some they come slowly — latent facts drawn from a constant-keyed
 * stream (same woman, same answers, forever); modelled circumstance, not a
 * rate lever (ADR-0019). May return zero or negative: the caller treats
 * anything non-positive as "not this month".
 */
function conceptionBase(
  world: World,
  tick: Tick,
  mother: Person,
  tie: Relationship | undefined,
  livingChildren: number,
  behind: boolean,
): number {
  const age = ageAt(mother.birthTick, tick)
  const married = tie !== undefined && tie.type === 'spouse'
  const fertilityDraw = openStream(world.seed, Stream.LifeEventTiming, mother.id, 424_242)
  if (fertilityDraw.chance(55, 1_000)) return 0 // the children never came
  const slowToConceive = fertilityDraw.chance(65, 1_000)

  const agePenalty = Math.max(0, age - 36) * 14
  let base: number
  if (married && tie.familySizeAspiration !== null && livingChildren < tie.familySizeAspiration) {
    base = 365 - agePenalty // building the family they hoped for
  } else if (married) {
    base = 12 - agePenalty // the plan is complete; life still happens
  } else {
    base = 60 - agePenalty // courting — the plan comes with the wedding
  }
  if (behind) base = Math.floor(base / 2) // money talks at the kitchen table
  if (slowToConceive) base = Math.floor(base / 5)
  return base
}

/** The verb-facing wrapper: the same chance, computed from a cold start. */
export function monthlyConceptionChance(
  world: World,
  tick: Tick,
  mother: Person,
  fatherId: EntityId,
): number {
  const household = householdOf(world, mother)
  if (!household) return 0
  let livingChildren = 0
  for (const child of world.people.values()) {
    if (child.deathTick === null && child.parentIds.includes(mother.id)) livingChildren++
  }
  const tie = relationshipBetween(world, mother.id, fatherId)
  return conceptionBase(world, tick, mother, tie, livingChildren, inArrears(world, household.id))
}

export function runBirths(world: World, tick: Tick): void {
  // Living children per parent, one pass — the aspiration reads it (D2).
  const livingChildCounts = new Map<EntityId, number>()
  for (const child of world.people.values()) {
    if (child.deathTick !== null) continue
    for (const parentId of child.parentIds) {
      livingChildCounts.set(parentId, (livingChildCounts.get(parentId) ?? 0) + 1)
    }
  }

  for (const person of livingPeople(world)) {
    const partnerId = birthEligible(world, tick, person)
    if (partnerId === null) continue
    const household = householdOf(world, person)
    if (!household) continue

    // D2: family size is the couple's PLAN, not a per-child rate penalty.
    // The plan was decided and recorded at the wedding; the birth system
    // only reads it. Money still talks at the kitchen table: an arrears
    // month grows no family, and deep arrears can shrink the plan itself —
    // once, on the record (stopFamilyEarly; relationships owns the edge).
    const tie = relationshipBetween(world, person.id, partnerId)
    const married = tie !== undefined && tie.type === 'spouse'
    const children = livingChildCounts.get(person.id) ?? 0

    // Deep arrears can shrink the plan itself — once, on the record.
    // Ordinary arrears only slows the family down (below): poor families
    // still had children; pretending otherwise is neither realism nor
    // kindness.
    const behind = inArrears(world, household.id)
    if (behind && married && household.savings < -2 * householdCosts(world, household)) {
      stopFamilyEarly(world, tick, person.id)
    }

    // NOTE the tie passed below is the one read BEFORE stopFamilyEarly — a
    // plan cut this month applies from next month, as it always has.
    const base = conceptionBase(world, tick, person, tie, children, behind)
    if (base <= 0) continue

    const rng = openStream(world.seed, Stream.LifeEventTiming, person.id, tick + 7777)
    if (!rng.chanceInTenThousand(base)) continue

    // The moment is real either way; the player couple decides. For everyone
    // else the roll IS the decision, as it always was.
    if (person.id === world.player.personId || partnerId === world.player.personId) {
      const playerId = world.player.personId
      if (playerId === null) continue
      raisePending(world, {
        tick,
        kind: 'child',
        personId: playerId,
        otherId: playerId === person.id ? partnerId : person.id,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
      continue
    }

    deliverChild(world, tick, person.id, partnerId)
  }
}

/** Player-provided birth facts for a custom life. Any field left undefined
 *  falls back to the engine's own deterministic draw. */
export interface BirthOverrides {
  readonly givenName?: string
  readonly familyName?: string
  readonly sex?: Sex
}

/**
 * One birth implementation for both the automatic path and player choices.
 *
 * `motherId` must be the female partner — the caller has already verified the
 * pairing. All randomness is keyed on (mother, tick) and on the child's own
 * id, so a birth resolved from a player decision after the tick produces
 * exactly the child the automatic path would have produced during it —
 * PROVIDED no other birth lands later in the same tick: the deferred
 * resolve allocates the child's id after those births instead of before,
 * and traits key on the id (review S5). Rare at real birth rates; the
 * parity test scouts the earliest birth to stay clear of it.
 *
 * `overrides` (M-GAMEDEPTH) replaces name and sex with the player's inputs
 * for a custom life. An overridden field consumes NO draw — the custom path
 * never has to match an automatic twin — while traits still come from the
 * child's own id stream: who the family is remains the player's choice, who
 * the child turns out to be remains the world's.
 */
export function deliverChild(
  world: World,
  tick: Tick,
  motherId: EntityId,
  partnerId: EntityId,
  overrides?: BirthOverrides,
): EntityId | null {
  const mother = world.people.get(motherId)
  const partner = world.people.get(partnerId)
  if (!mother || mother.householdId === null) return null
  const household = world.households.get(mother.householdId)
  if (!household) return null

  const rng = openStream(world.seed, Stream.LifeEventTiming, motherId, tick + 8888)
  const childId = allocateId(world)
  const traitRng = openStream(world.seed, Stream.PersonTraits, childId, 0)

  // Sex is decided FIRST, then the name is drawn from the matching list.
  // These used to be two independent draws, which produced girls called Peter
  // — spotted while reading a life story, not by any test.
  const childSex: Sex = overrides?.sex ?? (rng.chance(1, 2) ? 'female' : 'male')

  world.people.set(childId, {
    id: childId,
    // Names AND weights from the same pool. The first draft took the names
    // from the spec and the weights from the module constants, which is
    // fine for Classic and a RangeError on the first birth under any pool
    // of a different length — a crash inside the tick, inside the worker
    // (W1 architecture review).
    givenName:
      overrides?.givenName ??
      (() => {
        const pool = childSex === 'female' ? world.spec.femaleGiven : world.spec.maleGiven
        return rng.pickWeighted(pool.names, pool.weights)
      })(),
    familyName: overrides?.familyName ?? partner?.familyName ?? mother.familyName,
    sex: childSex,
    birthTick: tick,
    deathTick: null,
    causeOfDeath: null,
    tier: 'deep',
    traits: {
      sociability: traitRng.nextBellInt(0, 1000),
      diligence: traitRng.nextBellInt(0, 1000),
      ambition: traitRng.nextBellInt(0, 1000),
      resilience: traitRng.nextBellInt(0, 1000),
      curiosity: traitRng.nextBellInt(0, 1000),
      vitality: traitRng.nextBellInt(200, 1000),
    },
    householdId: household.id,
    parentIds: [motherId, partnerId],
  })

  world.education.set(childId, {
    personId: childId,
    level: 'none',
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: 500,
  })
  world.health.set(childId, freshHealth(childId))

  addToHousehold(world, household.id, childId)
  recordEvent(world, tick, { type: 'born', subjectId: childId, placeId: household.placeId })
  recordEvent(world, tick, { type: 'had-child', subjectId: motherId, otherId: childId })
  // P1: the father was invisible at his own child's birth — eventsFor
  // matches subject/other only, and he was neither. Both parents carry it.
  recordEvent(world, tick, { type: 'had-child', subjectId: partnerId, otherId: childId })
  return childId
}

// ---------------------------------------------------------------------------
// Mortality
//
// Runs last in the tick, so a person who dies this month still did whatever
// they were going to do first. Death is Defining and always carries a causal
// record — never an unexplained hidden roll (Law 3).
// ---------------------------------------------------------------------------

/** Monthly death chance per 10,000, before vitality is applied. */
function baseMortality(age: number): number {
  if (age < 1) return 6
  if (age < 15) return 1
  if (age < 40) return 2
  if (age < 55) return 5
  if (age < 65) return 12
  if (age < 75) return 30
  if (age < 85) return 80
  if (age < 95) return 200
  return 420
}

export function runMortality(world: World, tick: Tick): void {
  for (const person of livingPeople(world)) {
    const age = ageAt(person.birthTick, tick)
    const rng = openStream(world.seed, Stream.Health, person.id, tick)

    // Vitality shifts the rate by up to ±40%; the body's current state
    // (active ailment, permanent disability) adds its own weight (L4-M2).
    const base = baseMortality(age)
    const adjustment = 1400 - Math.floor((person.traits.vitality * 800) / 1000)
    const rate =
      Math.max(1, Math.floor((base * adjustment) / 1000)) +
      mortalityFromHealth(world.health.get(person.id))

    if (!rng.chanceInTenThousand(rate)) continue

    const accidental = age < 55 && rng.chance(1, 3)

    // L4-M2: most accidents that would have killed now wound instead. The
    // person survives into an injury the health system will carry — possibly
    // to full recovery, possibly to a permanent mark, occasionally to a death
    // that arrives anyway through the elevated mortality of the wounded.
    if (accidental && rng.chance(2, 3)) {
      const record = world.health.get(person.id) ?? freshHealth(person.id)
      if (record.ailment === null) {
        const wound = inflictWound(
          world, tick, person.id, rng.nextIntInclusive(600, 950), 'mishap', rng,
        )
        recordEvent(world, tick, {
          type: 'was-injured',
          subjectId: person.id,
          detail: `serious:${wound.description}`,
        })
      }
      continue
    }

    // DEATH NAMES ITS CAUSE (M-HARM, owner direction queued since
    // M-WOUNDS): an active ailment is what killed — "died of pneumonia",
    // not "died of illness". A fatal accident names its harm the same way.
    // Only a death with nothing on the health record stays general.
    const healthRecord = world.health.get(person.id)
    const activeAilment = healthRecord !== undefined && healthRecord.ailment !== null
    let cause: string
    if (accidental) {
      const fatalInjury = pickInjury(rng, 'mishap')
      cause = `an accident — ${describeAilment('injury', fatalInjury.kind, fatalInjury.site)}`
    } else if (activeAilment) {
      cause = describeAilment(
        healthRecord.ailment ?? 'illness',
        healthRecord.ailmentKind,
        healthRecord.ailmentSite,
      )
    } else {
      cause = age >= 70 ? 'old age' : 'a sudden illness'
    }

    performDeath(world, tick, person, cause,
      accidental
        ? [factor('accident', 800)]
        : [factor('old-age', Math.min(1000, age * 10)), factor('frailty', 1000 - person.traits.vitality)],
      Stream.Health,
    )
  }
}

/**
 * One death implementation, whatever the cause. A life ends the same way —
 * the job released, the household informed, the estate passed, the marriage
 * become widowhood, the record written — whether age takes it or a war does
 * (L4-M4 extracted this so combat could never invent its own cheaper death).
 */
export function performDeath(
  world: World,
  tick: Tick,
  person: Person,
  cause: string,
  inputs: readonly CausalFactor[],
  streamId: number,
): void {
  const age = ageAt(person.birthTick, tick)
  setPerson(world, { ...person, deathTick: tick, causeOfDeath: cause })
  world.employment.delete(person.id)
  // A death in uniform closes the service record (service owns the write).
  // Left open, a dead soldier stayed "serving" forever — inflating the
  // deployment quota's denominator and reading as a career that never
  // ended (M-ARMY2; the isDeployed dead-exclusion's sibling).
  closeServiceOnDeath(world, tick, person.id)
  // A pension does not have to die with the person who earned it: the
  // survivor's share opens here, while the marriage is still a marriage
  // (relationships turns it to widowhood a few lines down).
  openSurvivorPension(world, tick, person.id)

  if (person.householdId !== null) {
    const householdId = person.householdId
    removeFromHousehold(world, householdId, person.id)
    // If the death emptied the household, the pot passes to the deceased's
    // living children (finances owns how). Grief first, then the will.
    const household = world.households.get(householdId)
    if (household && household.memberIds.length === 0) {
      distributeEstate(world, tick, person, household)
    }
  }

  // The relationships domain owns its own state, including what a death does
  // to it — a marriage ends in widowhood, not divorce (DOMAIN_MAP.md §2).
  endRelationshipsOnDeath(world, tick, person.id)

  recordEvent(world, tick, { type: 'died', subjectId: person.id, detail: cause })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'death',
    significance: 'defining',
    inputs: [...inputs],
    chosen: `died of ${cause} at ${age}`,
    rejected: [],
    streamId,
  })
}
