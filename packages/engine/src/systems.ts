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
import { barredFromWork } from './conditions.js'
import {
  educationRank,
  isHigherEducation,
  meetsRequirement,
  OCCUPATIONS,
  occupationById,
  typicalPay,
  PRIVATE_SCHOOL_TUITION,
  majorsFor,
  tuitionPerYearFor,
  AID_PER_MILLE,
  MERIT_ATTAINMENT,
  GRADUATE_ADMISSION,
  HALLS_PER_YEAR,
} from './content.js'
import { eventsFor, factor, recordDecision, recordEvent } from './records.js'
import { atTodaysPrices } from './economy.js'
import { openStream, Stream } from './rng.js'
import { disciplineOf, smartsOf } from './stats.js'
import {
  isEntryWork,
  meritedRung,
  nextRungOf,
  placeOf,
  promotionBar,
  reviewScoreFor,
  trackById,
} from './careers.js'
import {
  WORK_CHOICES,
  encodeWorkMoment,
  momentsFor,
  outcomeOf,
  raiseFrom,
  workMomentById,
  workResultFor,
} from './workmoments.js'
import type { WorkChoice } from './workmoments.js'
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
import {
  SCHOOL_CHOICES,
  encodeSchoolMoment,
  schoolMomentById,
  schoolMomentsFor,
  schoolOutcomeOf,
  schoolResultFor,
} from './schoolmoments.js'
import type { SchoolChoice, SchoolStage } from './schoolmoments.js'
import { nudgeWellbeing } from './wellbeing.js'
import { endRelationshipsOnDeath, partnerOf, relationshipBetween, spouseOf } from './relationships.js'
import { hasAnswered, raisePending } from './player.js'
import { isTrustSensitive } from './content.js'
import type { CausalFactor, EducationRecord, Occupation } from './types.js'
import { businessKindById } from './business.js'
import {
  businessDemandsAllHours,
  canAfford,
  chargeTuition,
  distributeEstate,
  householdIncome,
  arrearsOf,
  passOnBusinesses,
  passOnStakes,
  startUnemployment,
  passOnHomes,
  passWalletToSurvivor,
} from './finances.js'
import { householdIncome as schoolIncomeOf } from './finances.js'
import { freshHealth, inflictWound, isSeverelyAiling, mortalityFromHealth } from './health.js'
import { isJailed, recordGateOf } from './crime.js'
import { DEBATE_OPTIONS, debateDue } from './government.js'

import { describeAilment, pickInjury } from './wounds.js'
import {
  closeServiceOnDeath,
  educationOffersEnlistment,
  isServing,
  openSurvivorPension,
  veteranUnlocks,
  isVeteran,
  enlistmentBar,
  enlistPerson,
  eligibleSpecialties,
} from './service.js'
import { placesOfKind } from './worldgen.js'

// --- Tunables. Named so the numbers are not scattered as bare literals. ------

/**
 * HOW MUCH TIME IN THE TRADE IS WORTH, at its ceiling. A BALANCE NUMBER.
 * Reached at twelve years.
 */
const EXPERIENCE_CAP = 215

const SCHOOL_START_AGE = 6

/**
 * HOW HARD A MATCHING FIELD PULLS a graduate toward the work it is for.
 *
 * A BALANCE NUMBER. It started at 3 and MEASURED 22% of graduates in a
 * job that wanted their field — better than the ~9% a blind draw gives,
 * but too quiet to be the "visibly affects which careers open" the spec
 * asks for. The reason it reads quiet is that eligibility is a FLOOR: a
 * university graduate is eligible for all forty-odd occupations, so a
 * multiplier on the one or two that match is fighting a wide field.
 */
const MAJOR_PULL = 8
// ELEMENTARY, MIDDLE, HIGH — five, three and four years, which lands the
// diploma at eighteen exactly as before. The age-18 fork is the hinge of a
// whole life in this game and moving it was never on the table.
const PRIMARY_YEARS = 5
const MIDDLE_YEARS = 3
const SECONDARY_YEARS = 4
/** Shorter than the degree beneath it, and dearer per year. */
const GRADUATE_YEARS = 2
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
    case 'middle':
      return MIDDLE_YEARS
    case 'secondary':
      return SECONDARY_YEARS
    case 'trade':
      return TRADE_YEARS
    case 'college':
      return COLLEGE_YEARS
    case 'graduate':
      return GRADUATE_YEARS
    default:
      return 0
  }
}

function nextLevel(current: EducationLevel): EducationLevel | null {
  switch (current) {
    case 'none':
      return 'primary'
    case 'primary':
      return 'middle'
    case 'middle':
      return 'secondary'
    case 'secondary':
      return null // trade or college is a choice, handled below
    default:
      return null
  }
}

/**
 * HOW MANY PARENTS ARE ACTUALLY AT THE TABLE.
 *
 * Not how many exist — how many are alive and under the same roof. A
 * father in the ground and a father in another household are the same
 * number of parents at homework time, and the model should not pretend
 * otherwise.
 */
function parentsAtHome(world: World, person: Person): number {
  let count = 0
  for (const parentId of person.parentIds) {
    const parent = world.people.get(parentId)
    if (parent === undefined || parent.deathTick !== null) continue
    if (parent.householdId !== person.householdId) continue
    count += 1
  }
  return count
}

/**
 * WHERE A CHILDHOOD IS HEADING — the number the school years walk toward.
 *
 * Everything the spec asks to matter, and nothing that does not: the two
 * traits that describe how a person meets work, the school they were sent
 * to, who is at home, and whether they study. All of it is CAUSED, which
 * is the whole point — a child who ends up poorly schooled here can be
 * traced to a specific reason rather than to a die roll (Law 10).
 *
 * Deliberately NOT fed by Smarts, though the spec floats the loop. Smarts
 * is DERIVED from attainment; feeding it back in would have compounded a
 * number into its own input every month for thirteen years, and the child
 * who started slightly ahead would have ended in a different world from
 * the one who started slightly behind. The loop still closes — studying
 * raises both — just not through itself.
 */
function schoolTargetFor(world: World, person: Person, record: EducationRecord): number {
  // The two traits, weighted toward the one that describes showing up.
  let target = Math.floor((person.traits.diligence * 11 + person.traits.curiosity * 9) / 20)
  // The school the money bought.
  if (record.schooling === 'private') target += 90
  // Who is at home. Two parents is the quiet advantage nobody names; none
  // at all is the loudest disadvantage in the whole model.
  const parents = parentsAtHome(world, person)
  target += parents >= 2 ? 45 : parents === 1 ? 0 : -70
  // Their own effort, once they are old enough to choose it.
  target += Math.min(60, world.habits.get(person.id)?.studied ?? 0)

  // WHAT THE TOWN VOTED TO SPEND ON ITS SCHOOLS (government plan §4,
  // phase 2's third lever). A STATE-SCHOOLED CHILD ONLY: the whole point
  // of paying for a private education is that it does not depend on what
  // the council decided this year, and a lever that moved both would have
  // made the private premium meaningless.
  //
  // Centred on the default of 500 so the wiring changed nothing on the
  // day it landed. At the extremes it is worth about two thirds of what
  // private school buys — enough that a town starving its schools is
  // visible in its children, not enough to overwhelm who they are.
  if (record.schooling !== 'private') {
    target += Math.trunc(((world.policy.schoolFunding - 500) * 60) / 500)
  }
  return Math.max(0, Math.min(1000, target))
}

/**
 * PUBLIC OR PRIVATE — decided once, by the money that was there.
 *
 * The spec is explicit that this should be inequality that is CAUSED and
 * not random: "a born-rich kid may get private school, a poor one won't."
 * So the household's monthly income sets the odds and the draw only
 * decides the marginal cases. A family clearing the tuition many times
 * over almost always sends the child; a family who would go hungry for it
 * effectively never does, whatever the die says.
 */
function choosePrivate(world: World, person: Person, rng: Rng): boolean {
  if (person.householdId === null) return false
  const household = world.households.get(person.householdId)
  if (household === undefined) return false
  const income = schoolIncomeOf(world, household)
  const tuition = atTodaysPrices(world, PRIVATE_SCHOOL_TUITION)
  // FOUR TIMES THE FEES BEFORE IT IS EVEN A QUESTION. The first numbers
  // here were twice the fees and a 62% ceiling, and MEASURED they put 52%
  // of the town's children through private school — which would have made
  // the ordinary childhood the expensive one and drained the private
  // advantage of any meaning. These are tuned to land it near a fifth.
  if (tuition <= 0 || income <= tuition * 4) return false
  // Chances climb with what is left over after the fees, and stop at a
  // ceiling: even comfortable families in this town mostly use the school
  // down the road.
  const headroom = Math.floor(((income - tuition * 4) * 1000) / (tuition * 10))
  return rng.chance(Math.min(300, headroom), 1000)
}


/**
 * THE MOMENTS A CHILDHOOD IS MADE OF (education master §0.5, §7).
 *
 * Same shape as the work moment next door: an occasional roll, the player
 * asked and an NPC deciding by character, both answers running through
 * one apply function so a played childhood and a simulated one obey the
 * same rules.
 *
 * OCCASIONAL IS THE POINT. The owner's popup-fatigue rule means this
 * cannot be a monthly interruption — at 14 in 1000 a child meets roughly
 * two of these per stage, which is enough for a childhood to have shape
 * and few enough that each one is worth reading.
 */
/**
 * DEBATE NIGHT. Government decides WHETHER one is due — it cannot raise a
 * pending without closing an import cycle — and this raises it, because
 * this module already holds both ends.
 */
function runDebateNight(world: World, tick: Tick): void {
  const officeId = debateDue(world, tick)
  if (officeId === null || world.player.personId === null) return
  raisePending(world, {
    tick,
    kind: 'debate',
    personId: world.player.personId,
    otherId: null,
    occupationId: officeId,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: DEBATE_OPTIONS.map((option) => option.id),
  })
}

function runSchoolMoments(world: World, tick: Tick): void {
  for (const person of livingPeople(world)) {
    const record = world.education.get(person.id)
    if (record === undefined) continue
    /**
     * A CHILDHOOD STARTS BEFORE A SCHOOL DOES (live player, on itch: "from
     * ages 0-18 there is pretty much nothing to do besides click").
     *
     * Two starvations, one loop. Before enrollment there was no stage at
     * all — the first moment a life could offer arrived at six, in a
     * classroom, so ages nought-to-five were empty by construction. The
     * 'early' stage covers three-to-five: the dark hallway, the big slide,
     * the kid next door.
     */
    const age = ageAt(person.birthTick, tick)
    const stage: SchoolStage | null =
      record.enrolledIn === 'primary'
        ? 'primary'
        : record.enrolledIn === 'middle'
          ? 'middle'
          : record.enrolledIn === 'secondary'
            ? 'secondary'
            : record.enrolledIn === null && age >= 3 && age <= 5
              ? 'early'
              : null
    if (stage === null) continue
    // Not in the first term: a moment needs somebody to have been there
    // long enough for the room to mean anything. (The early years have no
    // term to be new in.)
    if (stage !== 'early' && record.enrolledAtTick !== null && tick - record.enrolledAtTick < 4) continue

    // Its own tick offset, so this cannot disturb the enrolment draws or
    // the performance walk that share Stream.Education.
    //
    // AND THE SECOND STARVATION WAS THE RATE. Fourteen in a thousand,
    // monthly, is one moment every six years — the whole authored pool
    // (eleven moments before the early years joined) effectively never
    // fired, and a player's school years were the empty clicking the
    // complaint describes. Fifty-five a month is a moment most years:
    // texture, not spam, across a fifteen-year childhood.
    const rng = openStream(world.seed, Stream.Education, person.id, tick + 44_100)
    if (!rng.chance(55, 1000)) continue

    const open = schoolMomentsFor(stage)
    if (open.length === 0) continue
    const moment = open[rng.nextIntInclusive(0, open.length - 1)]
    if (!moment) continue
    const variant = rng.nextIntInclusive(0, 999)

    if (person.id === world.player.personId) {
      const raised = raisePending(world, {
        tick,
        kind: 'school-moment',
        personId: person.id,
        otherId: null,
        occupationId: encodeSchoolMoment(moment.id, variant),
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: [...SCHOOL_CHOICES],
      })
      if (raised) continue
    }

    // WHAT A CHILD DOES when nobody is playing them. Their own character:
    // curiosity and ambition reach, diligence carries the middle, and a
    // child with neither keeps their head down. Deliberately a lower bar
    // than the adult version — children are worse at not reaching.
    const nerve = Math.floor((person.traits.ambition + person.traits.curiosity) / 2)
    const choice: SchoolChoice = nerve > 580 ? 'reach' : nerve > 320 ? 'steady' : 'duck'
    applySchoolMoment(world, tick, person.id, moment.id, choice, variant)
  }
}

/**
 * WHAT THE ANSWER COST OR BOUGHT.
 *
 * Attainment is education's own to write, so it is written here. Morale
 * goes through wellbeing's door rather than being poked directly, for the
 * same single-writer reason the work moment routes pay through
 * `grantRaise`.
 */
export function applySchoolMoment(
  world: World,
  tick: Tick,
  personId: EntityId,
  momentId: string,
  choice: SchoolChoice,
  variant: number,
): void {
  const moment = schoolMomentById(momentId)
  const record = world.education.get(personId)
  if (!moment || record === undefined) return
  const result = schoolResultFor(moment, choice, record.attainment, variant % 1000)
  const outcome = schoolOutcomeOf(moment, choice, result, variant)
  if (outcome === undefined) return

  world.education.set(personId, {
    ...record,
    attainment: Math.max(0, Math.min(1000, record.attainment + outcome.attainment)),
  })
  if (outcome.wellbeing !== 0) {
    nudgeWellbeing(world, tick, personId, outcome.wellbeing, moment.title.toLowerCase())
  }
  recordEvent(world, tick, {
    type: 'school-moment',
    subjectId: personId,
    detail: `${moment.id}:${choice}:${result}`,
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'training',
    significance: Math.abs(outcome.attainment) >= 35 ? 'major' : 'notable',
    inputs: [
      factor('own-choice', personId === world.player.personId ? 1000 : 500),
      factor('strong-performance', record.attainment),
    ],
    chosen: `${moment.title.toLowerCase()}: ${outcome.title.toLowerCase()}`,
    rejected: moment.options.filter((option) => option.id !== choice).map((option) => option.title),
    streamId: Stream.Education,
  })
}

/**
 * WHAT THEY CHOSE TO STUDY, when nobody is playing them.
 *
 * Weighted by how close the field sits to the person: a curious mind
 * leans to the sciences and a dogged one to nursing, and the weight is
 * the INVERSE of the distance between them so nobody is barred from
 * anything. A determined incurious person can still read liberal arts —
 * it is just not the way to bet (Law 10).
 */
function pickMajor(person: Person, level: EducationLevel, rng: Rng): string | null {
  const open = majorsFor(level)
  if (open.length === 0) return null
  const weights = open.map((major) => {
    const gap =
      Math.abs(major.curiosity - person.traits.curiosity) +
      Math.abs(major.diligence - person.traits.diligence)
    // Never zero: every field keeps a floor of a chance.
    return Math.max(20, 1400 - Math.floor(gap / 2))
  })
  return rng.pickWeighted(open, weights)?.id ?? null
}

/**
 * WHO IS PAYING FOR THIS COURSE (education master §4).
 *
 * Decided once, at enrolment, in a fixed order of precedence rather than
 * by a roll — every one of these is EARNED by something already true
 * about the person, which is what makes the answer explainable when the
 * game is asked why (Law 3).
 *
 * The GI Bill comes first because a veteran has already paid. ROTC next,
 * because it is a bargain struck rather than an award granted. Merit
 * before need, so a poor child with a strong record is on a scholarship
 * for their record and not for their poverty.
 */
function fundingFor(
  world: World,
  person: Person,
  record: EducationRecord,
  level: EducationLevel,
  rng: Rng,
): 'self' | 'merit' | 'need' | 'rotc' | 'gi-bill' {
  // ALREADY SERVED. The service bought this in arrears.
  if (isVeteran(world, person.id)) return 'gi-bill'

  // THE BARGAIN. Only at university, only where a commission is the thing
  // being bought, and only for somebody the service would actually take.
  // Offered rather than assumed: most students do not sign this.
  if (level === 'college' && enlistmentBar(world, person, world.tick) === null) {
    const willing = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
    if (rng.chance(Math.min(260, Math.floor(willing / 5)), 1000)) return 'rotc'
  }

  if (record.attainment >= MERIT_ATTAINMENT) return 'merit'

  // NEED. Measured against what the course actually costs rather than an
  // absolute, so it keeps meaning the same thing as prices move.
  if (person.householdId !== null) {
    const household = world.households.get(person.householdId)
    if (household !== undefined) {
      const yearly = atTodaysPrices(world, tuitionPerYearFor(level))
      if (householdIncome(world, household) * 12 < yearly * 4) return 'need'
    }
  }
  return 'self'
}

/**
 * WHAT ROTC OWES, COLLECTED.
 *
 * The spec's own alternative when the commitment cannot be kept —
 * "repayment or enlisted service" — is what happens to anybody the
 * service will no longer take: the aid becomes an ordinary student debt,
 * charged in one go, because the country paid for a degree and got
 * nothing for it. Nobody is trapped, and nobody gets it free.
 */
function honourRotc(world: World, tick: Tick, person: Person): void {
  if (enlistmentBar(world, person, tick) === null) {
    const rng = openStream(world.seed, Stream.Education, person.id, tick + 88_300)
    const options = eligibleSpecialties(world, person)
    const chosen = options.length > 0 ? rng.pick(options) : undefined
    if (chosen !== undefined && chosen !== null) {
      enlistPerson(world, tick, person, chosen, [
        factor('holds-a-degree', 900),
        factor('honorable-term', 400),
      ])
      recordEvent(world, tick, { type: 'won-funding', subjectId: person.id, detail: 'rotc-served' })
      return
    }
  }
  // THE COMMISSION CANNOT BE HONOURED. Four years of fees become a debt.
  const owed = atTodaysPrices(world, tuitionPerYearFor('college') * 4) as Money
  chargeTuition(world, tick, person.id, owed)
  recordEvent(world, tick, { type: 'won-funding', subjectId: person.id, detail: 'rotc-repaid' })
}

/**
 * WHY THIS JOB IS CLOSED TO THIS PERSON — or null when it is open.
 *
 * The bar pattern, applied to hiring (careers overhaul, and the owner's
 * `careers.html` asks for it explicitly): the openings list shows the
 * locked jobs WITH THEIR REASON rather than hiding them, so "🔒 Earned by
 * climbing: constable → sergeant" is on the screen instead of the job
 * quietly not being there.
 *
 * One function so the greyed row and the refusal cannot disagree, and so
 * the reasons stay in the engine where the rules are. The order matters:
 * the most fundamental answer first, because telling somebody their
 * schooling is short when the real problem is that nobody may be hired
 * into that rung at all would be a lie by omission.
 */
export function hiringBar(
  world: World,
  person: Person,
  occupationId: string,
  tick: Tick,
): string | null {
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  if (occupation === undefined) return 'No such work in this town.'

  // 1. THE LADDER. Nobody is hired into the middle of one.
  if (!isEntryWork(occupationId)) {
    const place = placeOf(occupationId)
    const below = place === undefined ? undefined : place.track.rungs[place.rung - 1]
    const under = below === undefined ? undefined : OCCUPATIONS.find((o) => o.id === below.occupationId)
    const rung = place === undefined ? undefined : place.track.rungs[place.rung]
    const credential =
      rung?.needsLevel === 'graduate' ? 'a postgraduate qualification and ' : ''
    return under === undefined
      ? 'Earned by climbing, not by being hired into it.'
      : `Earned by climbing: ${credential}years as ${withArticle(under.title)} first. You cannot be hired straight in.`
  }

  // 2. THE PAPERS.
  const education = world.education.get(person.id)
  const level = education?.level ?? 'none'
  const unlocked = veteranUnlocks(world, person.id)
  if (!meetsRequirement(level, occupation.requires) && !unlocked.includes(occupationId)) {
    return `Asks for ${SCHOOLING_FOR_BAR[occupation.requires] ?? 'more schooling'} — the papers are not there.`
  }

  // 3. THE RECORD at the courthouse.
  if (recordGateOf(world, person.id, tick) === 'hard' && isTrustSensitive(occupationId)) {
    return 'A conviction on the record closes this kind of work.'
  }

  // 4. THE CHAIR. Some posts are one to a town.
  if (occupationId === 'constable' && !constableSeatOpen(world)) {
    return 'The county has all the constables it is paying for.'
  }
  if (!topSeatOpen(world, occupationId)) {
    return 'Somebody already holds that post, and a town supports one.'
  }
  return null
}

/** The words a requirement is said in on the openings list. */
const SCHOOLING_FOR_BAR: Readonly<Record<string, string>> = {
  none: 'no schooling',
  primary: 'elementary school',
  middle: 'middle school',
  secondary: 'a high school diploma',
  trade: 'trade school',
  college: 'a degree',
  graduate: 'a postgraduate qualification',
}

/**
 * Does this person's service actually count toward this work? The chip
 * the mockup calls "Army medic — edge", and the same list the interview
 * reads when it hands out the bonus.
 */
export function serviceEdgeFor(world: World, personId: EntityId, occupationId: string): boolean {
  return veteranUnlocks(world, personId).includes(occupationId)
}

export function runEducation(world: World, tick: Tick): void {
  runDebateNight(world, tick)
  runSchoolMoments(world, tick)
  for (const person of livingPeople(world)) {
    const record = world.education.get(person.id)
    if (!record) continue
    const age = ageAt(person.birthTick, tick)

    // THE SCHOOL YEARS, AS A NUMBER THAT MOVES.
    //
    // `attainment` used to be written once and never touched again, so a
    // childhood in a stable home and a private classroom finished on the
    // same figure as one spent anywhere else. It walks toward a target
    // now, an eighth of the gap a month, which over the thirteen years of
    // the ladder is plenty to separate two lives without either a good
    // stretch or a bad one being a cliff (Law 7).
    //
    // The result lives in a LOCAL and travels into whichever write
    // happens below. Both branches spread `...record`, and a value set on
    // the map here would be silently reverted by the very next line —
    // ADR-0039, the third time that trap has been walked into.
    let attainment = record.attainment
    // THE K-12 STAGES ONLY. This is a CHILDHOOD arc and its inputs say so:
    // "how many parents are at home" is a real force on a nine-year-old and
    // a meaningless one for a twenty-year-old who has moved out to study.
    // Letting it run through college applied a seventy-point penalty to a
    // degree for the crime of not living with your parents, and a stats
    // test caught it by noticing that a mind had started going backwards.
    // What a degree does to performance is phase 4's business.
    const atSchool =
      record.enrolledIn === 'primary' ||
      record.enrolledIn === 'middle' ||
      record.enrolledIn === 'secondary'
    if (atSchool) {
      // Its own stream draw is safe here: a person who is enrolled never
      // reaches the enrolment draws in the same tick, so this cannot
      // reshuffle the sequence those depend on.
      const school = openStream(world.seed, Stream.Education, person.id, tick)
      const target = schoolTargetFor(world, person, record)
      attainment = Math.max(
        0,
        Math.min(1000, attainment + Math.floor((target - attainment) / 8) + school.nextInt(-8, 8)),
      )
    }

    // Finish a course that has come due.
    if (record.enrolledIn !== null && record.completesAtTick !== null && tick >= record.completesAtTick) {
      world.education.set(person.id, {
        ...record,
        level: record.enrolledIn,
        enrolledIn: null,
        enrolledAtTick: null,
        completesAtTick: null,
        attainment,
        // THE HALL EMPTIES WHEN THE COURSE DOES. A graduate is back in
        // the housing market like everybody else, which is the point at
        // which having a degree is supposed to start paying for itself.
        inHalls: false,
      })
      recordEvent(world, tick, {
        type: 'finished-school',
        subjectId: person.id,
        detail: record.enrolledIn,
      })
      // THE BARGAIN FALLS DUE (education master §4). ROTC paid for the
      // degree in advance against a commission owed on the other side of
      // it, and a debt nobody ever collects is not a bargain — it is just
      // a scholarship with a longer name.
      //
      // The degree itself does the commissioning: `commissionsOnEntry`
      // already reads a college record and puts that person on the
      // officer ladder, so honouring this is a matter of getting them to
      // the door, not of a second mechanism.
      if (record.funding === 'rotc' && record.enrolledIn === 'college') {
        honourRotc(world, tick, person)
      }
      continue
    }

    if (record.enrolledIn !== null) {
      // THE BILL FOR THE YEAR (education master §3). On the anniversary of
      // enrolment and not before, so nobody is charged twice for a month
      // and the first year is billed on arrival.
      //
      // The schoolhouse says WHO owes and HOW MUCH; finances decides where
      // the money comes from and carries any debt. Education requests, it
      // never writes cents.
      const fee = tuitionPerYearFor(record.enrolledIn)
      const since = tick - (record.enrolledAtTick ?? tick)
      if (fee > 0 && since % TICKS_PER_YEAR === 0) {
        // WHAT THE AID TAKES OFF. Applied to the year's bill rather than
        // to the debt afterwards, so a funded student never borrows in
        // the first place — which is the whole point of §4. A fully
        // funded one is charged nothing and chargeTuition is never called.
        const aid = AID_PER_MILLE[record.funding ?? 'self'] ?? 0
        // ROOM AND BOARD RIDES WITH THE TUITION, which is the owner's own
        // framing: "living in the dorms and paying through tuition". Aid
        // covers it on the same terms — a scholarship that paid the fees
        // and left somebody unable to afford a bed would not be a
        // scholarship.
        const room = record.inHalls === true ? atTodaysPrices(world, HALLS_PER_YEAR) : 0
        const gross = atTodaysPrices(world, fee) + room
        const owed = (gross - Math.floor((gross * aid) / 1000)) as Money
        const borrowed = owed <= 0 ? (0 as Money) : chargeTuition(world, tick, person.id, owed)
        if (borrowed > 0) {
          recordEvent(world, tick, {
            type: 'took-student-loan',
            subjectId: person.id,
            detail: record.enrolledIn,
          })
        }
      }

      // WHAT ARE YOU READING? Asked once, of the player only, and only
      // where there is a real menu — a high-school diploma is not in
      // anything. Gated on the field still being empty rather than on
      // hasAnswered, so somebody who does a trade and later a degree is
      // asked both times.
      if (
        person.id === world.player.personId &&
        (record.major ?? null) === null &&
        majorsFor(record.enrolledIn).length > 0
      ) {
        const menu = majorsFor(record.enrolledIn)
        const raised = raisePending(world, {
          tick,
          kind: 'major',
          personId: person.id,
          otherId: null,
          occupationId: record.enrolledIn,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: menu.map((major) => major.id),
        })
        // NEVER A PERSON STUDYING NOTHING. If the question was not raised
        // — one is already up, or it lapsed — their own character answers
        // it rather than the field staying empty for four years.
        if (!raised && tick - (record.enrolledAtTick ?? tick) > 6) {
          const rng = openStream(world.seed, Stream.Education, person.id, tick + 61_700)
          world.education.set(person.id, {
            ...record,
            attainment,
            major: pickMajor(person, record.enrolledIn, rng),
          })
          continue
        }
      }
      if (attainment !== record.attainment) {
        world.education.set(person.id, { ...record, attainment })
      }
      continue // still studying
    }
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
      // Somebody who missed school does not start it at thirty. Each rung
      // has its own ceiling, and middle school needed one of its own or an
      // adult in a migrated save would enrol in it at twenty-five.
      const tooOld =
        (automatic === 'primary' && age > 12) ||
        (automatic === 'middle' && age > 15) ||
        (automatic === 'secondary' && age > 19)
      if (!tooOld) {
        enrol(world, tick, person, automatic, rng)
        continue
      }
    }

    // After secondary: trade or college, driven by curiosity and diligence.
    //
    // THE DOOR STAYS OPEN LONGER FOR A VETERAN, and it had to: the GI Bill
    // was written, wired and MEASURED at zero people, because a window
    // closing at twenty-four is shut before almost anybody is discharged.
    // The benefit existed in the code and was unreachable in the world,
    // which is the most expensive kind of feature there is. Somebody who
    // served four years and comes home at twenty-three could just squeeze
    // through; somebody who served twenty never could.
    const window = isVeteran(world, person.id) ? 45 : 24
    if (record.level === 'secondary' && age >= 18 && age <= window) {
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
      continue
    }

    // THE STEP ABOVE THE DEGREE (education master §5). Selective, on the
    // record rather than on a roll — but there is deliberately NO closed
    // door: somebody who misses the mark can study, raise it and come
    // back, because a permanent bar at twenty-two is the dead end Law 7
    // forbids.
    if (record.level === 'college' && age >= 21 && age <= 40) {
      if (record.attainment < GRADUATE_ADMISSION) continue
      if (person.id === world.player.personId) {
        if (!hasAnswered(world, 'graduate')) {
          raisePending(world, {
            tick,
            kind: 'graduate',
            personId: person.id,
            otherId: null,
            occupationId: null,
            workplaceId: null,
            monthlyPay: null,
            placeId: null,
            options: ['enrol', 'decline'],
          })
        }
        continue
      }
      // Rarer than the first degree, and it wants the turn of mind that
      // wanted the first one.
      const appetite = Math.floor((person.traits.curiosity * 3 + person.traits.diligence) / 4)
      if (!rng.chance(appetite, 26_000)) continue
      enrol(world, tick, person, 'graduate', rng)
    }
  }
}

/**
 * ADR-0033. Is the fork at eighteen still owed to this person?
 *
 * The same window `runEducation` raises it in. One function, so the
 * employment system cannot decide the fork is over while the schoolhouse
 * still intends to ask.
 */
export function educationForkPending(world: World, person: Person, tick: Tick): boolean {
  if (person.id !== world.player.personId) return false
  if (hasAnswered(world, 'education')) return false
  const record = world.education.get(person.id)
  if (record === undefined || record.level !== 'secondary') return false
  const age = ageAt(person.birthTick, tick)
  return age >= 18 && age <= 24
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
  if (isServing(world, person.id)) return 'The uniform is a full-time career.'
  const education = world.education.get(person.id)
  if (!education) return 'The schooling already stands.'
  if (education.enrolledIn !== null) return 'Already enrolled.'
  // THE DIPLOMA IS ALWAYS RECOVERABLE (education master §8, Law 7).
  //
  // Somebody who left school without one can sit it at any age. This is
  // the whole of the GED path and it comes BEFORE the age ceiling
  // deliberately: the door that closes at twenty-four is the one into
  // college, and closing the way back to a high-school diploma with it
  // would make one bad year at sixteen a life sentence.
  if (educationRank(education.level) < educationRank('secondary')) return null
  // A VETERAN'S DOOR STAYS OPEN, the same widening the GI Bill needed —
  // without it the benefit is unclaimable for anybody who served a full
  // term. See runEducation.
  const ceiling = isVeteran(world, person.id) ? 45 : 24
  if (age > ceiling) return 'The schoolhouse takes them younger. That door has closed.'
  if (education.level === 'college') {
    // The step above the degree has its own bar: a record, not an age.
    return education.attainment >= GRADUATE_ADMISSION
      ? null
      : 'Graduate programmes want a stronger record than this one.'
  }
  if (education.level !== 'secondary') return 'The schooling already stands.'
  return null
}

/**
 * LEAVING A COURSE (education master §6, §8).
 *
 * No degree, and THE DEBT STAYS — that is the whole shape of the thing.
 * Somebody who leaves in their third year owes three years and has
 * nothing to show for it, which is the real cost of the decision and the
 * reason it is a decision at all.
 *
 * Never a dead end (Law 7): the level they already hold is untouched, and
 * `enrolmentBar` will let them back in.
 */
export function dropOut(world: World, tick: Tick, personId: EntityId): boolean {
  const record = world.education.get(personId)
  if (record === undefined || record.enrolledIn === null) return false
  const leaving = record.enrolledIn
  world.education.set(personId, {
    ...record,
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    // Walking out of the course walks out of the hall with it.
    inHalls: false,
  })
  recordEvent(world, tick, { type: 'left-course', subjectId: personId, detail: leaving })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'training',
    significance: 'major',
    inputs: [
      factor('own-choice', personId === world.player.personId ? 1000 : 500),
      factor('strong-performance', record.attainment),
    ],
    chosen: `left ${leaving} without finishing`,
    rejected: ['seeing it through'],
    streamId: Stream.Education,
  })
  return true
}

/** Why the door out is shut, or null when it is open. */
export function dropOutBar(world: World, personId: EntityId): string | null {
  const record = world.education.get(personId)
  if (record === undefined || record.enrolledIn === null) return 'You are not enrolled in anything.'
  // Nobody drops out of primary school by choice.
  if (!isHigherEducation(record.enrolledIn)) return 'Children do not get to leave school.'
  return null
}

function enrol(world: World, tick: Tick, person: Person, level: EducationLevel, rng: Rng): void {
  const record = world.education.get(person.id)
  if (!record) return
  // A little variance so cohorts do not move in lockstep.
  const months = yearsFor(level) * TICKS_PER_YEAR + rng.nextInt(0, 6)
  // WHICH SCHOOL, settled the first time a child walks into one and kept
  // for the rest of the ladder. Deciding it afresh at every rung would
  // have let a family's good year move the child to private school and
  // their bad year move them back, which is not how anybody's childhood
  // goes; and it is the K-12 years that cost money, so a trade or college
  // enrolment leaves whatever was already there alone.
  // WHICH SCHOOL — and WHO DECIDES.
  //
  // The spec splits this precisely: when the player IS the child their
  // parents' finances decide it, which is inequality that is caused
  // rather than chosen (Law 10). But "when the player is later a PARENT,
  // THEY choose public vs private for their own kids and pay for it".
  // That half was never built — the owner, playing, got no popup at all.
  //
  // So a played parent is asked, and the answer is applied on the next
  // pass; everybody else's is settled here as before. A lapsed question
  // falls through to the same draw, so a child is never left unschooled
  // because a popup went unanswered.
  const playerParent =
    world.player.personId !== null && person.parentIds.includes(world.player.personId)
  if (level === 'primary' && record.schooling === undefined && playerParent) {
    const asked = raisePending(world, {
      tick,
      kind: 'school-choice',
      personId: world.player.personId as EntityId,
      otherId: person.id,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['private', 'public'],
    })
    if (asked) return
  }
  const schooling =
    record.schooling ??
    (level === 'primary' && choosePrivate(world, person, rng) ? 'private' : 'public')
  // THE FIELD OF STUDY. An NPC's is settled here; the PLAYER'S is left
  // null on purpose, because what you read at university is not a thing
  // that should happen to somebody off-screen. `runEducation` asks them on
  // the next tick and fills it in if the question goes unanswered, so a
  // lapsed pending is never a person studying nothing for four years.
  const major =
    person.id === world.player.personId ? (record.major ?? null) : pickMajor(person, level, rng)
  // WHO IS PAYING. Only asked where there is a bill; the K-12 ladder has
  // none, and settling a funding source for a nine-year-old would put a
  // scholarship on a childhood.
  const funding =
    tuitionPerYearFor(level) > 0 ? fundingFor(world, person, record, level, rng) : record.funding
  // HALLS, for a full-time student who would otherwise be holding a roof
  // up on no wage. Somebody still at home stays at home — that is where
  // most students are — and only a person heading their own household
  // moves into the institution's.
  const alone =
    person.householdId !== null &&
    !(world.households.get(person.householdId)?.memberIds ?? []).some(
      (id) => person.parentIds.includes(id) && world.people.get(id)?.deathTick === null,
    )
  const inHalls = isHigherEducation(level) && alone
  world.education.set(person.id, {
    ...record,
    enrolledIn: level,
    enrolledAtTick: tick,
    completesAtTick: (tick + months) as Tick,
    schooling,
    major,
    // Spread rather than assigned: `exactOptionalPropertyTypes` means an
    // explicit `undefined` is not the same as an absent key, and the
    // absent one is what "nobody ever asked" has to look like.
    ...(funding === undefined ? {} : { funding }),
    ...(inHalls ? { inHalls: true } : {}),
  })
  if (funding !== undefined && funding !== 'self') {
    recordEvent(world, tick, { type: 'won-funding', subjectId: person.id, detail: funding })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'training',
      significance: 'notable',
      inputs: [
        factor('strong-performance', record.attainment),
        factor('qualification-earned', funding === 'gi-bill' ? 1000 : 500),
      ],
      chosen: `${level} paid for by ${funding}`,
      rejected: ['paying for it themselves'],
      streamId: Stream.Education,
    })
  }
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
/**
 * IS THERE A CHAIR AT THE TOP OF THIS LADDER? (careers overhaul, Fix 2.)
 *
 * A town has one chief of police, not sixteen. The seat model already
 * existed for constables — and was only ever consulted when HIRING, so
 * nobody could be hired as a chief but anybody could be PROMOTED into
 * one, and MEASURED the town ended up with sixteen of them.
 *
 * The top rung of a ladder is a leadership post rather than a grade, so
 * it is capped by the size of the place. Everything below it is a job
 * title and stays uncapped: a town can have as many carpenters as it can
 * feed, and exactly one person running the hospital.
 */
function topSeatOpen(world: World, occupationId: string): boolean {
  const place = placeOf(occupationId)
  if (place === undefined) return true
  if (place.rung !== place.track.rungs.length - 1) return true
  let adults = 0
  let holding = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 70) continue
    adults += 1
    if (world.employment.get(person.id)?.occupationId === occupationId) holding += 1
  }
  return holding < Math.max(1, Math.floor(adults / 200) + 1)
}

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

/**
 * M-CAREER §2. THE ANNUAL REVIEW — the civilian promotion board.
 *
 * Once a year, in the month the job started, a person standing on a rung
 * with the next one's requirements met is put up for it. The player is
 * ASKED, because a promotion is a real choice — it is more money and more
 * of your life — and NPCs are moved on the same numbers without a popup,
 * which is the parity rule.
 *
 * The economy has its hand on this: reviewScoreFor leans on the cycle, so
 * booms open doors a slump keeps shut. Being passed over is recorded too —
 * a career that stalls is a thing that happened, not an absence of things.
 */
function runReviews(world: World, tick: Tick): void {
  for (const person of livingPeople(world).sort((a, b) => a.id - b.id)) {
    const job = world.employment.get(person.id)
    if (!job || job.trackId === null) continue
    // Once a year, on the anniversary of taking the rung.
    if ((tick - job.rungSinceTick) % 12 !== 0 || tick === job.rungSinceTick) continue

    const track = trackById(job.trackId)
    if (!track) continue
    const place = placeOf(job.occupationId)
    if (!place) continue
    const monthsInRung = tick - job.rungSinceTick
    const discipline = disciplineOf(world, person.id, tick)
    const level = world.education.get(person.id)?.level ?? 'none'
    if (promotionBar(track, place.rung, job.performance, monthsInRung, discipline, level) !== null) {
      continue
    }

    const next = nextRungOf(track, place.rung)
    if (!next) continue
    // THE CHAIR HAS TO BE EMPTY. A promotion board cannot appoint a second
    // chief of police because the first one is still in the job.
    if (!topSeatOpen(world, next.occupationId)) continue
    const score = reviewScoreFor(job.performance, monthsInRung, world.economy.growthPerMille, {
      smarts: smartsOf(world, person.id),
      discipline,
    })
    const rng = openStream(world.seed, Stream.Career, person.id, tick + 9_100)
    // Meeting the bar is not the same as being chosen. The score decides,
    // and a slump can leave somebody qualified standing still for years.
    if (!rng.chance(Math.max(0, Math.min(1000, score - 300)), 1000)) {
      recordEvent(world, tick, { type: 'passed-over', subjectId: person.id, detail: next.occupationId })
      continue
    }

    if (person.id === world.player.personId) {
      const raised = raisePending(world, {
        tick,
        kind: 'promotion-offer',
        personId: person.id,
        otherId: null,
        occupationId: next.occupationId,
        workplaceId: job.workplaceId,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
      if (raised) continue
    }
    promoteTo(world, tick, person.id, next.occupationId)
  }
}

/**
 * M-CAREER §2. UP A RUNG. The pay is drawn on the new occupation's band, at
 * today's prices, and performance carries across — you are the same worker,
 * in a bigger job.
 */
export function promoteTo(world: World, tick: Tick, personId: EntityId, occupationId: string): boolean {
  const job = world.employment.get(personId)
  if (!job) return false
  const occupation = occupationById(occupationId)
  const rng = openStream(world.seed, Stream.Career, personId, tick + 9_200)
  const pay = atTodaysPrices(
    world,
    rng.nextIntInclusive(occupation.minMonthlyPay, occupation.maxMonthlyPay) as Money,
  ) as Money
  const place = placeOf(occupationId)
  world.employment.set(personId, {
    ...job,
    occupationId,
    monthlyPay: pay,
    trackId: place?.track.id ?? job.trackId,
    rungSinceTick: tick,
    // A new rung is a fresh start on it: the review that follows is about
    // the job they are in now, not the one they left.
    performance: Math.max(400, job.performance - 60),
  })
  recordEvent(world, tick, {
    type: 'promoted-at-work',
    subjectId: personId,
    detail: occupationId,
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'employment-change',
    significance: 'major',
    inputs: [
      factor('qualified-for-role', job.performance),
      factor('steady-pay', Math.min(1000, (tick - job.rungSinceTick) * 8)),
    ],
    chosen: `promoted to ${occupation.title}`,
    rejected: ['staying where they were'],
    streamId: Stream.Career,
  })
  return true
}

/**
 * M-CAREER §3. THE MONTHS A JOB IS SOMETHING OTHER THAN A WAGE.
 *
 * Rare, per person, per month — a job that produced a moment every month
 * would be a job nobody could hold. The player is ASKED; NPCs answer the
 * same three rails on the same numbers, by character rather than by dice:
 * an ambitious, diligent person reaches, a cautious one does not. Parity is
 * that the maths is identical, not that the answers are.
 */
function runWorkMoments(world: World, tick: Tick): void {
  for (const person of livingPeople(world).sort((a, b) => a.id - b.id)) {
    const job = world.employment.get(person.id)
    if (!job) continue
    // Not in the first half-year of a job: a moment needs somebody to have
    // been there long enough for it to mean anything.
    if (tick - job.startedAtTick < 6) continue

    const rng = openStream(world.seed, Stream.Career, person.id, tick + 9_300)
    if (!rng.chance(18, 1000)) continue

    const place = placeOf(job.occupationId)
    const open = momentsFor(place?.rung ?? 0)
    if (open.length === 0) continue
    /**
     * NOT THE SAME SCENE TWICE, while there is anything else to show
     * (playtest, Jack Baldwin: "'The Crunch' (2016, 2024, and again
     * verbatim in 2037/2038)... 'The New One' (2009, 2014, 2024, 2027,
     * 2034)"). The pick was uniform over the rung's pool with no memory,
     * and the pools are small, so a career reran its own scenes word for
     * word — which is what erodes "every life is different" fastest.
     *
     * The ledger already remembers: every resolved moment records a
     * `work-moment` event whose detail leads with the moment id. For the
     * PLAYER, the pick now excludes seen moments until the pool is
     * exhausted, then starts over — a rerun after everything has been
     * seen is honest; a rerun instead of something new is not. NPCs keep
     * the plain roll: nobody reads their scenes, and their behaviour is
     * settled by the same maths either way (M-CAREER §3 parity is about
     * the numbers, not the prose).
     */
    let pool = open
    if (person.id === world.player.personId) {
      const seen = new Set<string>()
      for (const event of eventsFor(world, person.id)) {
        if (event.type !== 'work-moment') continue
        const id = (event.detail ?? '').split(':')[0]
        if (id !== undefined && id.length > 0) seen.add(id)
      }
      const fresh = open.filter((m) => !seen.has(m.id))
      if (fresh.length > 0) pool = fresh
    }
    const moment = pool[rng.nextIntInclusive(0, pool.length - 1)]
    if (!moment) continue
    const variant = rng.nextIntInclusive(0, 999)

    if (person.id === world.player.personId) {
      const raised = raisePending(world, {
        tick,
        kind: 'work-moment',
        personId: person.id,
        otherId: null,
        occupationId: encodeWorkMoment(moment.id, variant),
        workplaceId: job.workplaceId,
        monthlyPay: null,
        placeId: null,
        options: [...WORK_CHOICES],
      })
      if (raised) continue
    }

    // WHAT AN NPC DOES. Their own character, not a coin: ambition reaches,
    // diligence carries the middle, and somebody with neither keeps their
    // head down. The same three answers, the same maths after it.
    const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
    const choice: WorkChoice = drive > 640 ? 'lead' : drive > 380 ? 'steady' : 'pass'
    applyWorkMoment(world, tick, person.id, moment.id, choice, variant)
  }
}

/**
 * M-CAREER §3. WHAT THE ANSWER COST OR BOUGHT.
 *
 * The outcome's own numbers, applied through the single writers that
 * already exist — performance through adjustJobPerformance, pay through
 * grantRaise — so a moment cannot move anything by a route the rest of the
 * game does not use.
 */
export function applyWorkMoment(
  world: World,
  tick: Tick,
  personId: EntityId,
  momentId: string,
  choice: WorkChoice,
  variant: number,
): void {
  const moment = workMomentById(momentId)
  const job = world.employment.get(personId)
  if (!moment || !job) return
  const result = workResultFor(moment, choice, job.performance, variant % 1000)
  const outcome = outcomeOf(moment, choice, result, variant)
  if (!outcome) return

  adjustJobPerformance(world, personId, outcome.performance)
  if (outcome.payPerMille > 0) {
    // CLAMPED TO WHAT THE JOB IS WORTH. A counteroffer really can put
    // somebody above the usual band, but pay that can drift past the
    // ceiling compounds over a career — and the invariant that a wage sits
    // inside its occupation's band at today's prices is what stops a
    // fifty-year run inventing money. The way past the ceiling is the next
    // rung, which is the whole point of there being a ladder.
    const ceiling = atTodaysPrices(world, occupationById(job.occupationId).maxMonthlyPay) as Money
    const raise = raiseFrom(job.monthlyPay, outcome.payPerMille)
    const next = Math.min(job.monthlyPay + raise, ceiling) as Money
    if (next > job.monthlyPay) grantRaise(world, tick, personId, next)
  }
  recordEvent(world, tick, {
    type: 'work-moment',
    subjectId: personId,
    detail: `${moment.id}:${choice}:${result}`,
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'employment-change',
    significance: Math.abs(outcome.performance) >= 90 ? 'major' : 'notable',
    inputs: [
      factor('own-choice', personId === world.player.personId ? 1000 : 500),
      factor('qualified-for-role', job.performance),
    ],
    chosen: `${moment.title.toLowerCase()}: ${outcome.title.toLowerCase()}`,
    rejected: moment.options.filter((option) => option.id !== choice).map((option) => option.title),
    streamId: Stream.Career,
  })
}

/**
 * WHAT WORK THIS PERSON COULD START IN, and the ONE place that decides it.
 *
 * Extracted so the birth family can be given jobs by the same rule the town
 * hires by (owner, playing: "everytime you start a new life the NPC family
 * doesn't start with a job"). A second copy of these filters is exactly how
 * the three cost functions drifted apart four times in this project.
 *
 * The rule is the BOTTOM of the ladder, deliberately — see the job-change
 * pass for moving up. A ladder is entered at its first rung, and work that
 * sits on no ladder is entry by definition.
 */
export function eligibleStartingWork(
  world: World,
  personId: EntityId,
  level: EducationLevel,
): readonly Occupation[] {
  const unlocked = veteranUnlocks(world, personId)
  const gate = recordGateOf(world, personId, world.tick)
  return OCCUPATIONS.filter(
    (o) => meetsRequirement(level, o.requires) || unlocked.includes(o.id),
  )
    .filter((o) => isEntryWork(o.id))
    .filter((o) => o.id !== 'constable' || constableSeatOpen(world))
    .filter((o) => gate !== 'hard' || !isTrustSensitive(o.id))
    // M-HEALTH §4. THE BODY CLOSES DOORS TOO. A permanent wound takes the
    // manual trades off the table for good — the spec's own example is that
    // an amputee is not a roofer. This is the whole point of the revamp: a
    // condition that cannot be felt anywhere else in the game is not
    // modelled, and before this a lost leg changed nothing about a life.
    .filter((o) => !barredFromWork(world, personId, o.id))
}

/**
 * PUT A GROWN PERSON INTO WORK RIGHT NOW, rather than waiting for the
 * monthly pass to notice them.
 *
 * THE BUG (owner, playing): "everytime you start a new life the NPC family
 * doesn't start with a job". A birth family is written straight into the
 * world — mother, father, siblings, all of them adults with histories — and
 * nothing gave them any. `runEmployment` would eventually hire them, but it
 * is a monthly pass with a chance gate on it, so the player opened their own
 * birth certificate and found two unemployed parents.
 *
 * Uses `eligibleStartingWork`, the same rule the town hires by, so a parent
 * cannot land somewhere the town would never have put them.
 *
 * Returns false when there is no work this person could hold — which is a
 * real answer, not a failure: some people are not employed.
 */
export function hireIntoStartingWork(
  world: World,
  tick: Tick,
  person: Person,
  rng: Rng,
): boolean {
  if (world.employment.has(person.id)) return false
  const education = world.education.get(person.id)
  if (education === undefined) return false
  const eligible = eligibleStartingWork(world, person.id, education.level)
  if (eligible.length === 0) return false

  const workplaces = [...world.places.values()]
  if (workplaces.length === 0) return false

  // Better-paid roles weighted rather than always-the-best, exactly as the
  // monthly pass does it — two parents with the same schooling should not
  // lead identical lives.
  const weights = eligible.map((o) => 1 + Math.floor(typicalPay(o) / 10_000))
  const chosen = rng.pickWeighted(eligible, weights)
  const workplace = rng.pick(workplaces)
  const pay = atTodaysPrices(
    world,
    rng.nextIntInclusive(chosen.minMonthlyPay, chosen.maxMonthlyPay) as Money,
  ) as Money
  hirePerson(world, tick, person, chosen, workplace.id, pay, [
    factor('qualified-for-role', 500 + educationRank(education.level) * 100),
    factor('ambition', person.traits.ambition),
  ])
  return true
}

/**
 * WHO ACTUALLY WORKS THERE.
 *
 * Employment records point at a `workplaceId`, and business ids come from
 * the same entity counter as places — so a job can name a business with no
 * ambiguity and no new field. Derived rather than stored: `Business.employees`
 * would be a second source of truth for the same fact, and Law 12 says one.
 */
export function employeesOf(world: World, businessId: EntityId): readonly EntityId[] {
  const found: EntityId[] = []
  for (const [personId, job] of world.employment) {
    if (job.workplaceId !== businessId) continue
    if (world.people.get(personId)?.deathTick !== null) continue
    found.push(personId)
  }
  return found.sort((a, b) => a - b)
}

/**
 * A BUSINESS TAKES SOMEBODY ON — and from now on a shop on the square is
 * somewhere a named person goes to work, not a capital figure that returns
 * a percentage.
 *
 * NO SECOND WAGE BILL. `monthlyProfitFor` already returns what the month
 * cleared AFTER costs, labour included; charging payroll again on top would
 * double-count it and wreck a balance that was measured into place (58 per
 * cent of businesses surviving, failures clustering in the downturns). What
 * changes here is WHO the work belongs to, which is the part the town could
 * not see.
 *
 * Slow and seeded: a trading business with room, capital above its founding
 * stake and a good run behind it looks for somebody roughly once a year.
 */
function runBusinessHiring(world: World, tick: Tick): void {
  if (tick % 6 !== 1) return
  for (const business of [...world.businesses.values()].sort((a, b) => a.id - b.id)) {
    if (business.closedTick !== null) continue
    /**
     * YOUR SHOP IS YOURS TO RUN (owner, 2026-08-13: "expanding like adding
     * employees and stuff should 100% be user controlled").
     *
     * The town goes on staffing ITSELF — an NPC's business hires without
     * anybody clicking, which is what keeps the market alive. But taking
     * somebody on at the player's own business is a decision with a wage
     * attached and a name attached, and it belongs on the screen, not in
     * a background pass that happens while they are looking elsewhere.
     */
    if (business.ownerId === world.player.personId) continue
    const kind = businessKindById(business.kindId)
    if (kind === undefined || kind.maxEmployees <= 0) continue
    if (business.badMonths > 0) continue
    const staff = employeesOf(world, business.id)
    if (staff.length >= kind.maxEmployees) continue
    if (business.capital < atTodaysPrices(world, kind.capital)) continue

    const rng = openStream(world.seed, Stream.Employment, business.id, tick + 12_700)
    if (!rng.chance(620, 1000)) continue

    // Somebody in town who needs the work: of age, not in uniform, not
    // already employed, and not the owner.
    const looking = livingPeople(world)
      .filter((person) => {
        if (person.id === business.ownerId) return false
        /**
         * THE TOWN DOES NOT HAND THE PLAYER A JOB — the same rule the
         * ordinary hiring pass obeys, and for the same reason it was
         * written: work arriving unasked in a popup was a live complaint
         * ("offered doctor at $200k leaving the army"). A shop taking
         * somebody on must not quietly become the player's employer while
         * they were doing something else. The player applies, from the
         * job board, and the interview decides it.
         */
        if (person.id === world.player.personId) return false
        const age = ageAt(person.birthTick, tick)
        if (age < 18 || age > 66) return false
        if (world.employment.has(person.id)) return false
        if (isServing(world, person.id)) return false
        if (world.education.get(person.id)?.enrolledIn != null) return false
        return true
      })
      .sort((a, b) => a.id - b.id)
    if (looking.length === 0) continue
    const hired = rng.pick(looking)

    const education = world.education.get(hired.id)
    const eligible = eligibleStartingWork(world, hired.id, education?.level ?? 'none')
    if (eligible.length === 0) continue
    /**
     * THE SAME WEIGHTING THE TOWN'S OWN HIRING USES — better-paid roles
     * likelier, never always-the-best. This took `eligible[0]` at first,
     * which is an arbitrary role and in practice close to the worst one:
     * MEASURED, it dragged the median performance of an ordinary career
     * from above the promotion bar to just under it (559 against a floor
     * of 560), because a shop was quietly parking people on the bottom
     * rung that the ordinary pass would have started higher.
     */
    const occupation = rng.pickWeighted(
      eligible,
      eligible.map((o) => 1 + Math.floor(typicalPay(o) / 10_000)),
    )
    const pay = atTodaysPrices(
      world,
      rng.nextIntInclusive(occupation.minMonthlyPay, occupation.maxMonthlyPay),
    ) as Money

    hirePerson(world, tick, hired, occupation, business.id, pay, [
      factor('own-choice', 400),
      factor('local-employer', 800),
    ])
  }
}

/**
 * A CLOSURE PUTS REAL PEOPLE OUT OF WORK.
 *
 * finances closes a business; employment is this domain's to write, so the
 * two are reconciled here rather than finances reaching across the seam.
 * Anybody whose workplace has shut is laid off — with the insurance a
 * layoff qualifies for, because losing your job when the shop folds is
 * exactly the thing that floor exists for.
 */
function runClosureLayoffs(world: World, tick: Tick): void {
  for (const [personId, job] of [...world.employment].sort((a, b) => a[0] - b[0])) {
    const business = world.businesses.get(job.workplaceId)
    if (business === undefined || business.closedTick === null) continue
    if (world.people.get(personId)?.deathTick !== null) continue
    world.employment.delete(personId)
    startUnemployment(world, personId, tick)
    recordEvent(world, tick, { type: 'laid-off', subjectId: personId, detail: business.name })
    recordEvent(world, tick, { type: 'left-job', subjectId: personId, detail: 'the firm closed' })
    recordDecision(world, tick, {
      subjectId: personId,
      decision: 'employment-change',
      significance: 'major',
      inputs: [factor('employer-closed', 1000)],
      chosen: `lost the job when ${business.name} closed`,
      rejected: ['to keep the job'],
      streamId: Stream.Economy,
    })
  }
}

/**
 * LET SOMEBODY GO. The owner's decision, so it carries the owner's reason —
 * but the person still gets the insurance a layoff earns, because being
 * dismissed by a shop that could not carry you is the same loss as being
 * dismissed by one that closed.
 */
export function dismissFromBusiness(
  world: World,
  tick: Tick,
  personId: EntityId,
  firmName: string,
): void {
  if (!world.employment.has(personId)) return
  world.employment.delete(personId)
  startUnemployment(world, personId, tick)
  recordEvent(world, tick, { type: 'laid-off', subjectId: personId, detail: firmName })
  recordEvent(world, tick, { type: 'left-job', subjectId: personId, detail: 'let go' })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'employment-change',
    significance: 'major',
    inputs: [factor('employer-closed', 700)],
    chosen: `was let go by ${firmName}`,
    rejected: ['to keep the job'],
    streamId: Stream.Economy,
  })
}

export function runEmployment(world: World, tick: Tick): void {
  runReviews(world, tick)
  runWorkMoments(world, tick)
  runBusinessHiring(world, tick)
  runClosureLayoffs(world, tick)

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

    /**
     * A BUSINESS THIS BIG IS THE JOB (owner: "businesses take time. Limit
     * this").
     *
     * Not a question, and deliberately not a pending one — he asked for
     * FEWER interruptions in the same breath. It is a consequence with a
     * record: the hours stopped being available and the feed says so. The
     * same rule for the player and the town, because a rule that only
     * binds the player is a penalty rather than a rule.
     */
    if (job && businessDemandsAllHours(world, person.id)) {
      world.employment.delete(person.id)
      recordEvent(world, tick, {
        type: 'left-job',
        subjectId: person.id,
        detail: 'the-business',
      })
      continue
    }

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
        driftPerformance(world, person, job, rngWorking, tick)
        continue
      }
      retirePerson(world, tick, person, [factor('old-age', 900)])
      continue
    }

    if (age < WORKING_AGE || age >= RETIREMENT_AGE) continue
    if (isHigherEducation(education.enrolledIn)) continue // full-time study

    const rng = openStream(world.seed, Stream.Employment, person.id, tick)

    if (job) {
      driftPerformance(world, person, job, rng, tick)
      annualReview(world, tick, person)
      considerBetterJob(world, tick, person, job, rng, workplaces.length)
      continue
    }

    // Too ill or hurt to take new work this month.
    if (isSeverelyAiling(world, person.id)) continue

    // Unemployed: look for work. A veteran's specialty opens doors their
    // schooling alone would not — the mechanic comes home a machinist;
    // `eligibleStartingWork` reads that, along with the record gate.
    // ADR-0033. A HARD RECORD CLOSES THE TRUSTED WORK for everybody, not
    // just the player — Law 1, and otherwise the town would quietly staff
    // its school and its police station with people the player is refused
    // alongside. Ordinary work stays open; the drag below is the rest.
    const gate = recordGateOf(world, person.id, world.tick)
    // WHERE A CAREER CAN START (careers overhaul, Fix 1). Schooling alone
    // used to decide this, so anything a person's education qualified
    // them for could be handed over — including the top of a ladder they
    // had never set foot on. That is the "doctor at $200k leaving the
    // army", and it is what made the ladders decorative: there was no
    // reason to climb five rungs when the town would hand you the fifth.
    //
    // THIS IS THE PATH FOR SOMEBODY WITH NO JOB, so the rule is simply
    // the bottom: a ladder is entered at its first rung, and work that
    // sits on no ladder is entry by definition. Moving UP by changing
    // employer is a different path, and it reads a person's own record —
    // see the job-change pass below.
    const eligible = eligibleStartingWork(world, person.id, education.level)
    if (eligible.length === 0) continue

    // Hiring is not guaranteed — ambition and diligence improve the odds,
    // and a recent conviction closes some doors before they open (C1): the
    // record follows, though after ten clean years it stops gating.
    // C3 §5. THE GATE GRADES INSTEAD OF FLIPPING. It used to be a boolean
    // that switched off on an anniversary: barred one month, forgotten the
    // next. A hard gate is the wall it always was, a soft one is a door
    // that got heavier, and an old conviction is not read at all.
    const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
    const recordDrag = gate === 'hard' ? 120 : gate === 'soft' ? 45 : 0
    if (!rng.chance(Math.max(40, 250 + Math.floor(drive / 4) - recordDrag), 1000)) continue

    // Prefer better-paid roles, weighted rather than always-the-best, so two
    // people with identical qualifications do not lead identical lives.
    // WHAT THEY STUDIED OPENS DOORS (spec §1). A matching field triples
    // the weight rather than unlocking anything: an engineering graduate
    // is far likelier to end up an engineer, and a liberal-arts one is
    // not barred from it. A mismatch costs nothing — the spec is explicit
    // that you still work, you just do it without the edge.
    const field = education.major ?? null
    const weights = eligible.map((o) => {
      const base = 1 + Math.floor(typicalPay(o) / 10_000)
      const wanted = o.preferredMajors
      if (wanted === undefined || field === null) return base
      return wanted.includes(field) ? base * MAJOR_PULL : base
    })
    const chosen = rng.pickWeighted(eligible, weights)
    const workplace = rng.pick(workplaces)
    // M-ECON §4. THE BAND IS BASE-YEAR; a wage is offered at TODAY'S prices.
    // Without this, rent inflates over a century and pay does not, and every
    // household in the world ends up permanently behind.
    // AND HOW WELL THEY START (spec §1: a match "unlocks or boosts access
    // AND starting quality"). Matched, the offer is drawn from the top
    // half of the band instead of the whole of it — the same job, entered
    // from a better place. Never above the ceiling; the band is the band.
    const matched =
      field !== null && (chosen.preferredMajors?.includes(field) ?? false)
    const floorPay = matched
      ? chosen.minMonthlyPay + Math.floor((chosen.maxMonthlyPay - chosen.minMonthlyPay) / 2)
      : chosen.minMonthlyPay
    const pay = atTodaysPrices(
      world,
      rng.nextIntInclusive(floorPay, chosen.maxMonthlyPay),
    ) as Money

    // THE TOWN DOES NOT HAND THE PLAYER A JOB (careers overhaul, Fix 1).
    //
    // This raised an unsolicited `job-offer` — work arriving in a popup
    // for something you never asked about. Together with hiring that
    // ignored the ladder it is the whole of the owner's complaint:
    // "offered doctor at $200k leaving the army".
    //
    // The player applies instead, from the job board that already exists
    // on the Jobs tab, and applying runs the interview that already
    // exists in interview.ts. The comment left at this site months ago
    // said instant offers should route to an interview; this is that.
    //
    // NPCs are unaffected. They go on being hired by the same pass, at
    // entry rungs like everybody else — the town keeps staffing itself,
    // it simply stops staffing the player.
    //
    // Headhunting survives, because a rival firm poaching somebody senior
    // is a real thing rather than a gift — it lives in considerBetterJob,
    // where a person's own record is already in hand.
    if (person.id === world.player.personId) continue

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
    // M-CAREER §1. Which ladder this job sits on, and when they took this
    // rung. Null where the job belongs to no track — the ladders cover the
    // town's work, not every job it is possible to hold.
    trackId: placeOf(occupation.id)?.track.id ?? null,
    rungSinceTick: tick,
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

/**
 * HOW GOOD SOMEBODY CAN GET AT THE JOB (careers overhaul, Fix 2).
 *
 * This used to be DILIGENCE ALONE, and that single fact made every career
 * ladder in the game unclimbable. MEASURED, with the entry-rung rule in
 * place so people had to climb rather than be hired into the top: median
 * performance settled at 497 because median diligence is 500, while the
 * median rung asks 660. Sixty-two per cent of everybody on a ladder was
 * stuck on the reviews gate, permanently, by arithmetic. The town had no
 * contractors, no chief of medicine, no partners and no executives — the
 * roles had only ever been filled by hiring strangers straight into them.
 *
 * So the ceiling is what the spec asks for: the stats a person actually
 * has, plus the thing that was missing entirely — TIME IN THE TRADE.
 * Somebody who has done a job for ten years is better at it than they
 * were on their first day, and no amount of diligence substitutes for
 * that. It is also what makes a ladder a ladder rather than a sorting of
 * people by a trait they were born with (Law 10: unequal, but caused).
 *
 * Balance numbers, measured and retuned; see the commit.
 */
function performanceCeiling(world: World, person: Person, job: EmploymentRecord, tick: Tick): number {
  // The three stats the spec names, weighted toward the one that is
  // about turning up and doing the work.
  const base = Math.floor(
    (person.traits.diligence * 55 +
      smartsOf(world, person.id) * 25 +
      disciplineOf(world, person.id, tick) * 20) /
      100,
  )
  // EXPERIENCE. Capped, so a long career is an advantage and not an
  // automatic promotion — twelve years reaches the ceiling of it.
  const months = Math.max(0, tick - job.startedAtTick)
  const experience = Math.min(EXPERIENCE_CAP, Math.floor((months * EXPERIENCE_CAP) / 144))
  // The body still sets the limit (L4-M2).
  const health = world.health.get(person.id)
  return Math.max(0, base + experience - Math.floor((health?.disability ?? 0) / 2))
}

function driftPerformance(
  world: World,
  person: Person,
  job: EmploymentRecord,
  rng: Rng,
  tick: Tick,
): void {
  const health = world.health.get(person.id)
  const ceiling = performanceCeiling(world, person, job, tick)
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
  // MOVING FOR BETTER PAY IS BOUNDED BY YOUR OWN RECORD (Fix 1).
  //
  // Changing employer is how somebody legitimately steps up without
  // waiting for a promotion where they are — but it is a step, not a
  // leap. `meritedRung` allows the rung they hold and, where their
  // reviews already clear the next one's bar, the rung above it. Without
  // this, "ambitious people occasionally move for better pay" would have
  // read the whole occupation list and let a shop clerk move to chief of
  // medicine because it pays more and a degree is a degree.
  const standing = meritedRung(job.occupationId, job.performance)
  const better = OCCUPATIONS.filter(
    (o) => meetsRequirement(education.level, o.requires) && typicalPay(o) > typicalPay(current),
  ).filter((o) => {
    if (!topSeatOpen(world, o.id)) return false
    if (isEntryWork(o.id)) return true
    const place = placeOf(o.id)
    return place !== undefined && place.rung <= standing
  })
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
  //
  // AN UNSOLICITED APPROACH IS FOR SOMEBODY WORTH APPROACHING (Fix 1).
  // The spec keeps headhunting but constrains it: "only for someone
  // already senior and experienced in that field... never a random gift."
  // A rival firm poaching a site foreman is a real thing; the same firm
  // cold-calling a shop clerk about a job they never asked for is the
  // behaviour this overhaul deleted, wearing a different hat. Somebody at
  // the bottom of a ladder applies from the job board like anyone else.
  const climbed = placeOf(job.occupationId)
  if (person.id === world.player.personId && (climbed === undefined || climbed.rung < 1)) {
    return
  }
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
      // SLEEPING ON IT IS A REAL ANSWER HERE TOO (ADR-0034, Law 5).
      // The unemployed offer that carried 'wait' is gone; this is the one
      // kind of unsolicited offer that survives, and a poached senior
      // deserves the same night to think about it that a school leaver
      // used to get.
      options: ['accept', 'decline', 'wait'],
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

  for (const stale of livingPeople(world)) {
    // THE LIST IS A SNAPSHOT AND THIS LOOP MOVES PEOPLE (invariant sweep).
    //
    // `moveInWithPartner` writes the PARTNER's householdId as well as the
    // mover's. When that partner's own turn came round, the loop was still
    // holding the object captured before the move — so `householdOf` read
    // the household they had already left, `leaveHome` built them a third
    // household out of it, and the one they had just moved into went on
    // listing them for ever.
    //
    // Measured at seed 4141, tick 533: household 626 held [502, 505] while
    // 505 lived in 627. A phantom member is not cosmetic — rent splits,
    // household income and costs, the financial unit and the estate all
    // count that list.
    const person = world.people.get(stale.id)
    if (!person || person.deathTick !== null) continue
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
          // NO STREET MENU. This offered every affordable neighbourhood as
          // a `to-<placeId>` button — the abstract housing model the
          // property market replaced, arriving as a popup after the list
          // that carried it was deleted from the Money tab.
          //
          // The question is now the only one worth asking: do you want to
          // leave? Yes takes the place the engine found. Somebody who
          // wants to CHOOSE where they live does it in Property, against
          // actual houses with prices, conditions and owners — and
          // somebody who would rather stay at home while they study or
          // work simply declines, which was the whole of the complaint.
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

      const income = householdIncome(world, household)
      const better = neighbourhoods.filter(
        (p) => p.desirability > current.desirability + 100 && canAfford(income, p.desirability),
      )
      if (better.length === 0) continue

      const target = rng.pick(better)

      // A better street is affordable, so the family moves.
      //
      // THE PLAYER IS NO LONGER ASKED, and the distinction matters because
      // there are two move-house questions in this engine and only one of
      // them is going. This one was SHOPPING — a nicer postcode is within
      // reach, would you like it — and shopping for somewhere to live
      // happens in Property now, against actual houses with prices,
      // conditions and owners. Asking it here would be the Streets list
      // again, arriving as a popup instead of a list.
      //
      // The one in finances.ts STAYS. That is a family who cannot pay for
      // where they are, being moved somewhere cheaper: the world acting on
      // them rather than an offer, and part of how the safety net keeps a
      // household off the street.
      if (person.id === world.player.personId) continue

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
/**
 * IS THIS PERSON SOMEWHERE ELSE ENTIRELY?
 *
 * Deployed, held, or in a cell — the three ways somebody is not at home
 * this month. One predicate because the answer is wanted in more than one
 * place and the three must not drift apart.
 */
function isApart(world: World, personId: EntityId): boolean {
  // READ OFF THE STATE, not through deployment.ts. Importing that module
  // here closes a cycle the ratchet refuses, and the question being asked
  // is small enough to answer from the world directly — the same reason
  // wellbeing.ts was made a leaf. An open tour is the last one with no
  // return date, and being a prisoner is a field on it.
  const person = world.people.get(personId)
  if (person === undefined || person.deathTick !== null) return false
  const tours = world.deployments.get(personId)
  const tour = tours === undefined ? undefined : tours[tours.length - 1]
  if (tour !== undefined && tour.returnedAtTick === null) return true
  const criminal = world.criminal.get(personId)
  return (
    criminal !== undefined &&
    criminal.jailedUntilTick !== null &&
    world.tick < criminal.jailedUntilTick
  )
}

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
  return conceptionBase(
    world,
    tick,
    mother,
    tie,
    livingChildren,
    arrearsOf(world, household) >= 5_000_000,
  )
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

    // THE LETTERS ARE THE KITCHEN-TABLE GATE, not any tight month. H1
    // made ordinary arrears a normal season of a life — it rides on the
    // wallet instead of being reset by an eviction — and halving conception
    // on ANY negative month pushed completed-cohort childlessness past the
    // believable band (measured: 26.3% at seed 12345 over 150 years). The
    // gate now opens where the STORY says the money got frightening: the
    // -$50k letters (same threshold as the mounting-debts moment). There a
    // family slows down and a married couple can cut the plan short.
    // stopFamilyEarly is retired with the pot that used to trigger it: its
    // old condition read household.savings, which H0 froze at zero, so it
    // had been dead code — and enabling it against the wallet pushed the
    // completed-cohort childless share to 28.3%, past the believable band.
    // The slowdown below is the whole kitchen-table effect now.
    const behind = arrearsOf(world, household) >= 5_000_000
    void married

    // NOBODY CONCEIVES A CHILD FROM ANOTHER COUNTRY (owner, playing:
    // "when I was deployed yesterday my wife and I had a kid because the
    // popup came up... how could we possibly have a kid when im deployed
    // to another country").
    //
    // The model had every reason a couple might not start a family —
    // money, age, the plan they agreed at the wedding — and no notion of
    // whether the two of them were in the same country. A deployment is
    // six to twelve months on the other side of the world.
    //
    // The same hole, and the same fix, for the two other ways a person is
    // simply ABSENT: a cell and a prison camp. Jail is already treated as
    // absence at the kitchen table (finances charges no food for somebody
    // the county is feeding); it was not treated as absence here.
    if (isApart(world, person.id) || isApart(world, partnerId)) continue

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
    spendStance: null,
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

  // M-CAREER §5. THE BUSINESS PASSES ON EVERY DEATH, not only the ones that
  // empty a household — that is where the estate is settled, and a business
  // owner usually dies with somebody still in the house.
  passOnBusinesses(world, tick, person.id)
  passOnStakes(world, tick, person.id)
  passOnHomes(world, tick, person.id)

  if (person.householdId !== null) {
    removeFromHousehold(world, person.householdId, person.id)
  }

  /**
   * SURVIVORSHIP BEFORE WIDOWHOOD (H0). The joint wallet lives on the
   * lower-id spouse's record — if that spouse is the one dying, the
   * couple's whole liquid balance is sitting on a dead person's ledger.
   * It passes to the survivor HERE, while the marriage still exists on
   * paper, because one line down the marriage ends and the wallet routing
   * with it. Ordering is the entire correctness of this: after
   * endRelationshipsOnDeath the survivor's wallet is their own empty
   * record, and the money would be stranded with the estate.
   *
   * AND WHEN NOBODY SURVIVES THE MARRIAGE, THE WILL IS READ — on EVERY
   * death, not only the ones that empty a household. Money is personal now
   * (H0), so a widowed parent dying with grown children still in the house
   * used to leave their whole savings stranded on a dead ledger: the old
   * gate waited for the building to empty, which is a rule about a POT
   * that no longer exists.
   */
  {
    const widow = spouseOf(world, person.id)
    const survivor = widow === null ? undefined : world.people.get(widow)
    if (widow !== null && survivor !== undefined && survivor.deathTick === null) {
      passWalletToSurvivor(world, person.id, widow)
    } else {
      distributeEstate(world, tick, person)
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
