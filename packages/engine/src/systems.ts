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
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  meetsRequirement,
  OCCUPATIONS,
  occupationById,
  typicalPay,
} from './content.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { Rng } from './rng.js'
import type {
  EducationLevel,
  EmploymentRecord,
  Household,
  Person,
  Sex,
  World,
} from './types.js'
import { withArticle } from './text.js'
import { endRelationshipsOnDeath, partnerOf, relationshipBetween } from './relationships.js'
import { hasAnswered, raisePending } from './player.js'
import type { CausalFactor, Occupation } from './types.js'
import { placesOfKind } from './worldgen.js'

// --- Tunables. Named so the numbers are not scattered as bare literals. ------

const SCHOOL_START_AGE = 6
const PRIMARY_YEARS = 6
const SECONDARY_YEARS = 6
const TRADE_YEARS = 2
const COLLEGE_YEARS = 4
const WORKING_AGE = 18
const RETIREMENT_AGE = 66
const LEAVE_HOME_AGE = 19
/** Months a household must exist before it will consider moving again. */
const SETTLING_MONTHS = 24
const CHILDBEARING_MIN_AGE = 20
const CHILDBEARING_MAX_AGE = 42

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
            options: ['college', 'trade', 'work'],
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

export function runEmployment(world: World, tick: Tick): void {
  const workplaces = placesOfKind(world, 'workplace')
  if (workplaces.length === 0) return

  for (const person of livingPeople(world)) {
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
      considerBetterJob(world, tick, person, job, rng, workplaces.length)
      continue
    }

    // Unemployed: look for work.
    const eligible = OCCUPATIONS.filter((o) => meetsRequirement(education.level, o.requires))
    if (eligible.length === 0) continue

    // Hiring is not guaranteed — ambition and diligence improve the odds.
    const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
    if (!rng.chance(250 + Math.floor(drive / 4), 1000)) continue

    // Prefer better-paid roles, weighted rather than always-the-best, so two
    // people with identical qualifications do not lead identical lives.
    const weights = eligible.map((o) => 1 + Math.floor(typicalPay(o) / 10_000))
    const chosen = rng.pickWeighted(eligible, weights)
    const workplace = rng.pick(workplaces)
    const pay = rng.nextIntInclusive(chosen.minMonthlyPay, chosen.maxMonthlyPay) as Money

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

function driftPerformance(world: World, person: Person, job: EmploymentRecord, rng: Rng): void {
  const pull = person.traits.diligence - job.performance
  const drift = Math.floor(pull / 40) + rng.nextInt(-8, 9)
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

  // Poor performers can lose the job.
  if (job.performance < 200 && rng.chanceInTenThousand(400)) {
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
  const pay = rng.nextIntInclusive(target.minMonthlyPay, target.maxMonthlyPay) as Money
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

    // Leave the parental home once there is an income.
    if (stillWithParents && job) {
      if (!rng.chance(60 + Math.floor(person.traits.ambition / 20), 1000)) continue

      const home = rng.pick(neighbourhoods)

      // The urge and the destination are simulated either way; only who says
      // yes differs. The player can stay home as long as they like.
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
          options: ['accept', 'decline'],
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

      const better = neighbourhoods.filter((p) => p.desirability > current.desirability + 100)
      if (better.length === 0) continue

      const target = rng.pick(better)

      // A better street is affordable. The player decides whether the family
      // moves; for an NPC the desirability gap already decided.
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
          options: ['accept', 'decline'],
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

  // Stronger and longer attachments move in sooner.
  const months = tick - tie.typeSinceTick
  const appetite = Math.floor(tie.strength / 8) + Math.min(60, months)
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
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'move',
    significance: 'major',
    inputs: [
      ...extraInputs,
      factor('better-neighbourhood', target.desirability - (current?.desirability ?? 0)),
    ],
    chosen: `moved to ${target.name}`,
    rejected: [current ? `to stay in ${current.name}` : 'to stay put'],
    streamId: Stream.LifeEventTiming,
  })
}

/**
 * One move-out implementation for both the automatic path and player choices.
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
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'move',
    significance: 'major',
    inputs: [
      ...extraInputs,
      factor('better-neighbourhood', target.desirability - (current?.desirability ?? 0)),
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

  world.households.set(newHouseholdId, {
    id: newHouseholdId,
    placeId: home.id,
    memberIds: members,
    formedTick: tick,
    dissolvedTick: null,
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

export function runBirths(world: World, tick: Tick): void {
  for (const person of livingPeople(world)) {
    if (person.sex !== 'female') continue
    const age = ageAt(person.birthTick, tick)
    if (age < CHILDBEARING_MIN_AGE || age > CHILDBEARING_MAX_AGE) continue

    const household = householdOf(world, person)
    if (!household) continue
    if (person.parentIds.some((id) => household.memberIds.includes(id))) continue // still at home

    // Milestone 5: a birth needs an actual partnership, not merely two adults
    // who happen to share a roof. That was the Milestone 1 placeholder, and it
    // is why the population used to decline — most people never formed such a
    // household by accident.
    const partnerId = partnerOf(world, person.id)
    if (partnerId === null) continue
    if (!household.memberIds.includes(partnerId)) continue
    const partnerPerson = world.people.get(partnerId)
    if (!partnerPerson || partnerPerson.deathTick !== null) continue

    const childrenAtHome = household.memberIds.filter((id) => {
      const member = world.people.get(id)
      return member ? member.parentIds.includes(person.id) : false
    }).length

    const rng = openStream(world.seed, Stream.LifeEventTiming, person.id, tick + 7777)
    // Falls with age and with children already at home.
    const base = 240 - childrenAtHome * 70 - Math.max(0, age - 34) * 12
    if (base <= 0) continue
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

/**
 * One birth implementation for both the automatic path and player choices.
 *
 * `motherId` must be the female partner — the caller has already verified the
 * pairing. All randomness is keyed on (mother, tick) and on the child's own
 * id, so a birth resolved from a player decision after the tick produces
 * exactly the child the automatic path would have produced during it.
 */
export function deliverChild(world: World, tick: Tick, motherId: EntityId, partnerId: EntityId): void {
  const mother = world.people.get(motherId)
  const partner = world.people.get(partnerId)
  if (!mother || mother.householdId === null) return
  const household = world.households.get(mother.householdId)
  if (!household) return

  const rng = openStream(world.seed, Stream.LifeEventTiming, motherId, tick + 8888)
  const childId = allocateId(world)
  const traitRng = openStream(world.seed, Stream.PersonTraits, childId, 0)

  // Sex is decided FIRST, then the name is drawn from the matching list.
  // These used to be two independent draws, which produced girls called Peter
  // — spotted while reading a life story, not by any test.
  const childSex: Sex = rng.chance(1, 2) ? 'female' : 'male'

  world.people.set(childId, {
    id: childId,
    givenName: rng.pick(childSex === 'female' ? FEMALE_GIVEN_NAMES : MALE_GIVEN_NAMES),
    familyName: partner?.familyName ?? mother.familyName,
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

  addToHousehold(world, household.id, childId)
  recordEvent(world, tick, { type: 'born', subjectId: childId, placeId: household.placeId })
  recordEvent(world, tick, { type: 'had-child', subjectId: motherId, otherId: childId })
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

    // Vitality shifts the rate by up to ±40%.
    const base = baseMortality(age)
    const adjustment = 1400 - Math.floor((person.traits.vitality * 800) / 1000)
    const rate = Math.max(1, Math.floor((base * adjustment) / 1000))

    if (!rng.chanceInTenThousand(rate)) continue

    const accidental = age < 55 && rng.chance(1, 3)
    const cause = accidental ? 'an accident' : age >= 70 ? 'old age' : 'illness'

    setPerson(world, { ...person, deathTick: tick, causeOfDeath: cause })
    world.employment.delete(person.id)

    if (person.householdId !== null) removeFromHousehold(world, person.householdId, person.id)

    // The relationships domain owns its own state, including what a death does
    // to it — a marriage ends in widowhood, not divorce (DOMAIN_MAP.md §2).
    endRelationshipsOnDeath(world, tick, person.id)

    recordEvent(world, tick, { type: 'died', subjectId: person.id, detail: cause })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'death',
      significance: 'defining',
      inputs: accidental
        ? [factor('accident', 800)]
        : [factor('old-age', Math.min(1000, age * 10)), factor('frailty', 1000 - person.traits.vitality)],
      chosen: `died of ${cause} at ${age}`,
      rejected: [],
      streamId: Stream.Health,
    })
  }
}
