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
import { ageAt } from './clock.js'
import {
  educationRank,
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
  World,
} from './types.js'
import { friendshipKey } from './types.js'
import { withArticle } from './text.js'
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
const FRIENDSHIP_END_STRENGTH = 120
const MAX_FRIENDS = 8
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
      const appetite = Math.floor((person.traits.curiosity * 2 + person.traits.diligence) / 3)
      if (!rng.chance(appetite, 4000)) continue
      const choice: EducationLevel = rng.chance(person.traits.curiosity, 1400) ? 'college' : 'trade'
      enrol(world, tick, person, choice, rng)
    }
  }
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
      world.employment.delete(person.id)
      recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'retired' })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'employment-change',
        significance: 'major',
        inputs: [factor('old-age', 900)],
        chosen: 'retired',
        rejected: ['to keep working'],
        streamId: Stream.Employment,
      })
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

    world.employment.set(person.id, {
      personId: person.id,
      occupationId: chosen.id,
      workplaceId: workplace.id,
      monthlyPay: pay,
      startedAtTick: tick,
      performance: Math.floor((person.traits.diligence + 500) / 2),
    })

    recordEvent(world, tick, {
      type: 'hired',
      subjectId: person.id,
      placeId: workplace.id,
      detail: chosen.title,
    })

    const rejected = eligible.filter((o) => o.id !== chosen.id).map((o) => o.title)
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'employment-change',
      significance: 'major',
      inputs: [
        factor('qualified-for-role', 500 + educationRank(education.level) * 100),
        factor('ambition', person.traits.ambition),
        factor('higher-pay', Math.floor(typicalPay(chosen) / 1000)),
      ],
      chosen: `took work as ${withArticle(chosen.title)}`,
      rejected: rejected.slice(0, 3).map((title) => `to take work as ${withArticle(title)}`),
      streamId: Stream.Employment,
    })
  }
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

  world.employment.set(person.id, {
    personId: person.id,
    occupationId: target.id,
    workplaceId: workplace.id,
    monthlyPay: pay,
    startedAtTick: tick,
    performance: job.performance,
  })

  recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: current.title })
  recordEvent(world, tick, {
    type: 'hired',
    subjectId: person.id,
    placeId: workplace.id,
    detail: target.title,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs: [
      factor('higher-pay', Math.floor((pay - job.monthlyPay) / 100)),
      factor('ambition', person.traits.ambition),
      factor('qualified-for-role', 400),
    ],
    chosen: `moved to work as ${withArticle(target.title)}`,
    rejected: [`to stay as ${withArticle(current.title)}`],
    streamId: Stream.Employment,
  })
}

// ---------------------------------------------------------------------------
// Friendship
// ---------------------------------------------------------------------------

export function runFriendship(world: World, tick: Tick): void {
  const living = livingPeople(world)
  if (living.length < 2) return

  const friendCounts = new Map<EntityId, number>()
  for (const friendship of world.friendships.values()) {
    friendCounts.set(friendship.a, (friendCounts.get(friendship.a) ?? 0) + 1)
    friendCounts.set(friendship.b, (friendCounts.get(friendship.b) ?? 0) + 1)
  }

  // Decay first, so a friendship formed this tick is not immediately decayed.
  for (const [key, friendship] of world.friendships) {
    const next = friendship.strength - 3
    if (next < FRIENDSHIP_END_STRENGTH) {
      world.friendships.delete(key)
      recordEvent(world, tick, {
        type: 'friendship-lapsed',
        subjectId: friendship.a,
        otherId: friendship.b,
      })
    } else {
      world.friendships.set(key, { ...friendship, strength: next })
    }
  }

  for (const person of living) {
    const age = ageAt(person.birthTick, tick)
    if (age < 5) continue
    if ((friendCounts.get(person.id) ?? 0) >= MAX_FRIENDS) continue

    const rng = openStream(world.seed, Stream.Relationships, person.id, tick)
    if (!rng.chance(person.traits.sociability, 30_000)) continue

    // Candidates: similar age, alive, not already a friend.
    const candidates = living.filter((other) => {
      if (other.id === person.id) return false
      if (world.friendships.has(friendshipKey(person.id, other.id))) return false
      const otherAge = ageAt(other.birthTick, tick)
      return Math.abs(otherAge - age) <= 8
    })
    if (candidates.length === 0) continue

    const other = rng.pick(candidates)
    const strength = 300 + rng.nextInt(0, 400)
    world.friendships.set(friendshipKey(person.id, other.id), {
      a: person.id < other.id ? person.id : other.id,
      b: person.id < other.id ? other.id : person.id,
      strength,
      formedAtTick: tick,
    })
    friendCounts.set(person.id, (friendCounts.get(person.id) ?? 0) + 1)
    friendCounts.set(other.id, (friendCounts.get(other.id) ?? 0) + 1)

    recordEvent(world, tick, { type: 'befriended', subjectId: person.id, otherId: other.id })
  }
}

export function friendsOf(world: World, personId: EntityId): EntityId[] {
  const friends: EntityId[] = []
  for (const friendship of world.friendships.values()) {
    if (friendship.a === personId) friends.push(friendship.b)
    else if (friendship.b === personId) friends.push(friendship.a)
  }
  friends.sort((a, b) => a - b)
  return friends
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
    const job = world.employment.get(person.id)
    const stillWithParents = person.parentIds.some((id) => household.memberIds.includes(id))

    // Leave the parental home once there is an income.
    if (stillWithParents && job) {
      if (!rng.chance(60 + Math.floor(person.traits.ambition / 20), 1000)) continue

      const partnerId = findPartner(world, person, tick, rng)
      const newHouseholdId = allocateId(world)
      const home = rng.pick(neighbourhoods)

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

      const inputs = [factor('reached-adulthood', 600), factor('has-income', 500)]
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
 * A partner is drawn from close friends of similar age who have also left
 * home or are old enough to. There is no marriage system in Milestone 1 —
 * this is household formation, which is explicitly in scope, and nothing more.
 */
function findPartner(world: World, person: Person, tick: Tick, rng: Rng): EntityId | null {
  if (!rng.chance(55, 100)) return null

  const age = ageAt(person.birthTick, tick)
  const candidates: EntityId[] = []

  for (const friendId of friendsOf(world, person.id)) {
    const friend = world.people.get(friendId)
    if (!friend || friend.deathTick !== null) continue
    if (friend.sex === person.sex) continue // simplification: see note below
    const friendAge = ageAt(friend.birthTick, tick)
    if (friendAge < LEAVE_HOME_AGE || Math.abs(friendAge - age) > 8) continue
    const friendship = world.friendships.get(friendshipKey(person.id, friendId))
    if (!friendship || friendship.strength < 400) continue
    // Do not pull someone out of a household they already formed as an adult.
    const theirHousehold = friend.householdId === null ? null : world.households.get(friend.householdId)
    if (theirHousehold && !friend.parentIds.some((id) => theirHousehold.memberIds.includes(id))) continue
    candidates.push(friendId)
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a - b)
  return rng.pick(candidates)
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

    const partnerId = household.memberIds.find((id) => {
      if (id === person.id) return false
      const member = world.people.get(id)
      if (!member || member.deathTick !== null) return false
      if (member.sex === person.sex) return false
      return ageAt(member.birthTick, tick) >= WORKING_AGE
    })
    if (partnerId === undefined) continue

    const childrenAtHome = household.memberIds.filter((id) => {
      const member = world.people.get(id)
      return member ? member.parentIds.includes(person.id) : false
    }).length

    const rng = openStream(world.seed, Stream.LifeEventTiming, person.id, tick + 7777)
    // Falls with age and with children already at home.
    const base = 240 - childrenAtHome * 70 - Math.max(0, age - 34) * 12
    if (base <= 0) continue
    if (!rng.chanceInTenThousand(base)) continue

    const childId = allocateId(world)
    const traitRng = openStream(world.seed, Stream.PersonTraits, childId, 0)
    const partner = world.people.get(partnerId)

    world.people.set(childId, {
      id: childId,
      givenName: rng.pick(
        rng.chance(1, 2)
          ? (['Mary', 'Jennifer', 'Sarah', 'Emily', 'Laura', 'Karen', 'Rebecca', 'Anne'] as const)
          : (['James', 'Robert', 'Michael', 'David', 'Peter', 'Daniel', 'Alan', 'Frank'] as const),
      ),
      familyName: partner?.familyName ?? person.familyName,
      sex: rng.chance(1, 2) ? 'female' : 'male',
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
      parentIds: [person.id, partnerId],
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
    recordEvent(world, tick, { type: 'had-child', subjectId: person.id, otherId: childId })
  }
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

    for (const [key, friendship] of world.friendships) {
      if (friendship.a === person.id || friendship.b === person.id) world.friendships.delete(key)
    }

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
