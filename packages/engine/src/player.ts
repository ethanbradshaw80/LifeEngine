/**
 * The player domain: being one person inside the simulation.
 *
 * Design rule: THE PLAYER IS NOT SPECIAL. Their person keeps the same traits,
 * relationships, mortality and records as everyone else, and the world does
 * not revolve around them (charter §2). The only difference is who answers
 * their major decisions — the decision *points* are the same ones the
 * simulation already models, reached by the same rolls. Where an NPC's roll
 * succeeds and the engine decides, the player's roll succeeds and the engine
 * asks.
 *
 * Two consequences worth understanding:
 *
 *  - Opportunities are real. A job offer exists because the employment system
 *    generated one this month, not because a menu was due. Decline it and it
 *    is gone (Law 5: opportunities expire).
 *
 *  - Choices are inputs to the deterministic record. Every answer is appended
 *    to `world.player.log` with its tick; same seed + same answers replays the
 *    same life exactly.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { formatMoney, TICKS_PER_YEAR } from '@life-engine/shared'
import { isHigherEducation, OCCUPATIONS, occupationById } from './content.js'
import { bareName, sentenceCase, sentenceInWords, withArticle } from './text.js'
import {
  canAfford,
  creditPerson,
  debitPerson,
  sellHome,
  signLease,
  householdCosts,
  householdIncome,
  inArrears,
  monthlyNetOf,
  setSpendStance,
} from './finances.js'
import { LIVING_COST_CHILD } from './content.js'
import {
  answerSupportDeployment,
  currentDeployment,
  evacuateHome,
  offerFieldAid,
  rotationAvailable,
  supportDeploymentAvailable,
  volunteerForDeployment,
  volunteerForRotation,
  volunteerForSupport,
} from './deployment.js'
import { activeWars, combatPowerOf, homeland, sueForPeace } from './geopolitics.js'
import { alliedWars, canVolunteerForDeployment, deployUnderOrders, isCaptive, startRotation } from './deployment.js'
import { nudgeWellbeing } from './wellbeing.js'
import { disciplineOf, smartsOf } from './stats.js'
import { beatAsks, beatAt, decodeSequence, encodeSequence } from './engagement.js'
import {
  ceilingFor,
  freshAthlete,
  makesSquad,
  overallOf,
  positionById,
  potentialFor,
  rested,
  rookieWageFor,
  applyFight,
  runDraftFor,
  runFight,
  runSigning,
  rulesFor,
  secondActsFor,
  signedWageFor,
  startingStats,
  train,
  tryoutBar,
} from './sports.js'
import type { TrainingFocus } from './sports.js'
import { endorsementOfferFor } from './sportspaper.js'
import {
  CASINO_MIN_AGE,
  HAND_CHOICES,
  POKER_SKILL_MAX,
  gamblerOf,
  buyChipsBar,
  handOutcomeWords,
  holdFromCashier,
  keyHandFor,
  keyHandOutcome,
  playSession,
  playTable,
  playTournament,
  pokerCeilingFor,
  skillGainFrom,
  stakeById,
  tournamentById,
  tournamentRunning,
  turnProBar,
  wagerCreepPerMille,
} from './casino.js'
import type {
  HandChoice,
  Stake,
  BlackjackChoice,
  SessionResult,
  TableGame,
  TableResult,
  TournamentResult,
} from './casino.js'
import { decodeScene, outcomeFor, SCENE_OPTIONS, sceneById, unitMomentById } from './scenes.js'
import type { SceneChoice } from './scenes.js'
import {
  answerDesperation,
  answerCase,
  executeOffence,
  caseSceneOf,
  openCase,
  answerVictimMoment,
  defendTheHouse,
  describePleaDeal,
  isJailed,
  pleaDealFor,
  recordGateOf,
  resolveCourt,
} from './crime.js'
import { GRADE_TITLES, isTrustSensitive, offenceById } from './content.js'
import type { Offence } from './content.js'
import { adjustAilmentSeverity, applyConvalescence, inflictWound, isSeverelyAiling } from './health.js'
import { grantCampaignMedal, grantQualificationBadge, grantValor, grantWoundRecognition } from './awards.js'
import {
  termsOfferedTo,
  optionsOffered,
  encodeContract,
  decodeContract,
  bonusFor,
  applyReenlistmentOption,
  addServiceQualification,
  applyBoardPromotion,
  assignServiceUnit,
  boardStandingFor,
  boostServicePerformance,
  commissionsOnEntry,
  oathAdministratorsFor,
  discharge as dischargeService,
  enlistPerson,
  enlistmentBar,
  isServing,
  rankTitle,
  recruitingDriveActive,
  reenlist as reenlistService,
  retrainSpecialty,
  schoolOptionsFor,
  unitOptionsFor,
  veteranUnlocks,
  branchName,
  discharge,
} from './service.js'
import { MAX_FITNESS_POINTS } from './content.js'
import { placesOfKind } from './worldgen.js'
import {
  meetsRequirement,
  SERVICE_TERM_MONTHS,
  annualPay,
  servicePayOn,
  officerPayOn,
  specialtyTitleFor,
  } from './content.js'
import { rentFor } from './content.js'
import {
  accountsOf,
  applyMoneyShock,
  fileBankruptcy,
  buyHome,
  homePurchaseBar,
  moneyOnHand,
  payOffPlan,
  buyInvestment,
  buyShares,
  grantShares,
  payDownBar,
  payDownLoan,
  sellShares,
  creditOf,
  moveBetweenOwnAccounts,
  sellInvestment,
  takeLoan,
} from './finances.js'
import { loanBar } from './credit.js'
import type { LoanKind } from './types.js'
import { crimeOutcomeFor, decodeCrimeScene } from './crimescene.js'
import { decodeWorkMoment, situationOf, workMomentById } from './workmoments.js'
import {
  INTERVIEW_APPROACHES,
  approachBonus,
  decodeInterview,
  encodeInterview,
  interviewSituation,
} from './interview.js'
import type { InterviewApproach } from './interview.js'
import { placeOf } from './careers.js'
import { article15For } from './article15.js'
import type { HabitKind } from './types.js'
import {
  dropHabit,
  fitnessOf,
  keepsHabit,
  setFitness,
  STATS_FROM_AGE,
  takeUpHabit,
} from './stats.js'
import { openFilingOf, planPayoffBar } from './bankruptcy.js'
import { leaseBar } from './realestate.js'
import {
  accessionOf,
  accessionWords,
  aptitudeWords,
  assignOfficerRole,
  entryTestScore,
  mosBar,
  officerRolesOf,
} from './enlistment.js'
import { OFFICER_ROLES } from './content.js'
import type { OfficerRole, ServiceBranchSpec } from './types.js'
import type { HomePurchaseMethod } from './finances.js'
import type { AthleteRecord, Business, SessionSummary } from './types.js'
import {
  annualRevenueOf,
  businessBar,
  businessKindById,
  scaleUpBar,
  valuationOf,
} from './business.js'
import { openBusiness } from './finances.js'
import { atTodaysPrices } from './economy.js'
import type { CrimeChoice, CrimeDanger } from './crimescene.js'
import { separationFor } from './separation.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import {
  compatibility,
  courtshipBar,
  partnerOf,
  performCourtshipEnd,
  performSeparation,
  promoteToCourting,
  promoteToSpouse,
  proposalBar,
  reconcile,
  relationshipBetween,
  spouseOf,
  strengthenFriendship,
  tendMarriage,
} from './relationships.js'
import {
  adjustJobPerformance,
  birthBar,
  birthEligible,
  COLLEGE_YEARS,
  deliverChild,
  enrolmentBar,
  enrolPlayer,
  grantRaise,
  hirePerson,
  monthlyConceptionChance,
  moveHouse,
  performDeath,
  performMoveOut,
  performQuit,
  retirePerson,
  TRADE_YEARS,
  promoteTo,
  applySchoolMoment,
  applyWorkMoment,
  educationForkPending,
  dropOut,
  dropOutBar,
} from './systems.js'
import { decodeSchoolMoment, schoolMomentById, schoolSituationOf } from './schoolmoments.js'
import { majorsFor } from './content.js'
import {
  DEBATE_LINES,
  campaign,
  candidacyBar,
  castVote,
  leverBar,
  setLever,
  warPowerBar,
  debate,
  declareCandidacy,
  voteBar,
} from './government.js'
import type { CampaignAction, DebateChoice } from './government.js'
import {
  IPO_FLOAT_PER_MILLE,
  IPO_MIN_VALUATION,
  floatProceedsFor,
  listCompany,
  stockById,
} from './market.js'
import type { PendingDecision, PendingKind, Person, Sex, World } from './types.js'
import { schoolFor, specialtyFor, unitFor } from './worldspec.js'

/**
 * Begin playing a living person. Clears any stale pending decision.
 *
 * `asHeir` continues the LINE: the previous (dead) player joins the lineage,
 * so the save remembers every life this dynasty has lived. Picking a fresh
 * unrelated person starts a new story and the old line ends with its last
 * life un-appended — a deliberate asymmetry: lineage records successions,
 * not abandonments.
 */
export function setPlayer(world: World, personId: EntityId | null, asHeir = false): void {
  if (personId !== null) {
    const person = world.people.get(personId)
    if (!person) throw new Error(`No person ${personId} in this world`)
    if (person.deathTick !== null) throw new Error(`${person.givenName} is not alive`)
  }
  if (asHeir && world.player.personId !== null && personId !== null) {
    const previous = world.people.get(world.player.personId)
    if (previous && previous.deathTick !== null) {
      world.player.lineage.push(previous.id)
    }
  }
  world.player.personId = personId
  world.player.pending = null
}

export function playerPerson(world: World) {
  return world.player.personId === null ? undefined : world.people.get(world.player.personId)
}

export function playerIsAlive(world: World): boolean {
  return playerPerson(world)?.deathTick === null
}

/** Living children of the player, oldest first — the heir candidates (Law 8). */
export function heirsOf(world: World, personId: EntityId): EntityId[] {
  const heirs: EntityId[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (person.parentIds.includes(personId)) heirs.push(person.id)
  }
  heirs.sort((a, b) => {
    const pa = world.people.get(a)
    const pb = world.people.get(b)
    return (pa?.birthTick ?? 0) - (pb?.birthTick ?? 0) || a - b
  })
  return heirs
}

// ---------------------------------------------------------------------------
// Custom lives (M-GAMEDEPTH)
// ---------------------------------------------------------------------------

/**
 * A brand-new person the player asks to be born as. Null fields mean "let the
 * world decide" — the engine draws them from its own streams exactly as an
 * automatic birth would.
 */
export interface CustomLifeSpec {
  readonly givenName: string | null
  readonly familyName: string | null
  readonly sex: Sex | null
  readonly motherId: EntityId
}

/**
 * Women who could be handed a newborn this month — the same eligibility the
 * automatic birth roll uses, as a query for the character-creation screen.
 * Sorted by id for determinism.
 */
export function motherCandidates(world: World): EntityId[] {
  const candidates: EntityId[] = []
  for (const person of world.people.values()) {
    if (birthEligible(world, world.tick, person) !== null) candidates.push(person.id)
  }
  candidates.sort((a, b) => a - b)
  return candidates
}

/**
 * Bring a custom life into the world: a newborn of an existing eligible
 * couple, then begin playing it from age 0.
 *
 * DETERMINISM: the spec is a PLAYER INPUT. It is appended to player.log as a
 * 'custom-birth' entry (never a live pending question), so seed + log still
 * replays the world byte for byte. Name and sex come from the spec where
 * given; traits always come from the child's own id stream — who the child
 * turns out to be is still the world's answer.
 *
 * Returns the child's id, or null if the couple cannot have a child (the
 * same test the automatic path applies — no household the simulation would
 * refuse gets one by menu).
 */
export function createCustomLife(world: World, spec: CustomLifeSpec): EntityId | null {
  const mother = world.people.get(spec.motherId)
  if (!mother) return null
  const partnerId = birthEligible(world, world.tick, mother)
  if (partnerId === null) return null

  // Player-typed text: trimmed, pipes stripped (the log separator), empty
  // treated as "let the world decide".
  const cleanName = spec.givenName?.trim().replace(/\|/g, '') ?? ''
  const cleanFamily = spec.familyName?.trim().replace(/\|/g, '') ?? ''

  const childId = deliverChild(world, world.tick, spec.motherId, partnerId, {
    ...(cleanName.length > 0 ? { givenName: cleanName } : {}),
    ...(cleanFamily.length > 0 ? { familyName: cleanFamily } : {}),
    ...(spec.sex !== null ? { sex: spec.sex } : {}),
  })
  if (childId === null) return null

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'custom-birth',
    choice: `${cleanName}|${cleanFamily}|${spec.sex ?? ''}|${String(spec.motherId)}`,
  })
  world.player.nextDecisionId += 1

  setPlayer(world, childId)
  return childId
}

// ---------------------------------------------------------------------------
// Tab verbs (M-SERVICE-PLAY): actions the player INITIATES, resolved by the
// same machinery the world already uses. Each verb logs itself (the
// custom-birth pattern) so seed + log still replays the world exactly; each
// answers honestly, including "no".
// ---------------------------------------------------------------------------

/**
 * Ask after work at a particular trade, now, from the Jobs tab. Being
 * qualified gets you considered; the town still has to have a place. A "no"
 * goes in the feed like a "yes" does — asking is part of the story.
 */
/**
 * M-CAREER §4. WHY THIS JOB IS SHUT TO THEM, in plain English, or null when
 * it is open.
 *
 * The `offenceBar` / `moveBar` pattern, and for the same reason: the
 * Openings list and the button under it must read from ONE function, or a
 * live row and an honest refusal will eventually disagree. Everything
 * applyForJob would refuse for is here, so the list can grey a row and say
 * why without guessing.
 */
export function jobBar(world: World, occupationId: string): string | null {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return 'Nobody is being played.'
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  if (!occupation) return 'No such trade in town.'

  const tick = world.tick
  if (ageAt(person.birthTick, tick) < 18) return 'Not yet eighteen.'
  if (isServing(world, person.id)) {
    return 'The uniform is a full-time career; leave the service first.'
  }
  const education = world.education.get(person.id)
  if (education !== undefined && isHigherEducation(education.enrolledIn)) {
    return 'Full-time study fills the days.'
  }
  if (isSeverelyAiling(world, person.id)) return 'Too ill or hurt to take new work this month.'
  if (isJailed(world, person.id)) return 'Nobody is hiring out of a cell.'
  const current = world.employment.get(person.id)
  if (current?.occupationId === occupationId) return 'This is already the work they do.'
  if (world.player.log.some((entry) => entry.kind === 'job-application' && entry.tick === tick)) {
    return 'One asking a month. The town knows where to find you.'
  }
  const unlocked = veteranUnlocks(world, person.id)
  const qualified =
    meetsRequirement(education?.level ?? 'none', occupation.requires) || unlocked.includes(occupation.id)
  if (!qualified) {
    const asks =
      occupation.requires === 'college'
        ? 'college'
        : occupation.requires === 'trade'
          ? 'trade school'
          : 'more schooling'
    return `${sentenceCase(occupation.title)} asks for ${asks} — the papers are not there.`
  }
  if (placesOfKind(world, 'workplace').length === 0) return 'No workplace stands in town.'
  // ADR-0033. THE RECORD IS READ AT THE DOOR, and only for the work that
  // genuinely turns on it. A hard gate — a serious conviction, still recent
  // — shuts a badge, a classroom, a ward and a ledger. It shuts nothing
  // else: the drag on an ordinary job is in the interview, where a real
  // employer's doubt lives, not in a refusal at the door.
  if (isTrustSensitive(occupationId) && recordGateOf(world, person.id, tick) === 'hard') {
    return `${sentenceCase(occupation.title)} will not take a conviction still on the record.`
  }
  return null
}

/**
 * M-CAREER §4. Is this job a genuine reach for them?
 *
 * A rung above what they hold, or a third more money than they earn now.
 * The interview reads it: what wins a room you are ready for is not what
 * wins a room you are reaching into.
 */
export function isStretchFor(world: World, personId: EntityId, occupationId: string): boolean {
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  if (!occupation) return false
  const current = world.employment.get(personId)
  if (!current) return false
  if (occupation.minMonthlyPay > Math.floor((current.monthlyPay * 13) / 10)) return true
  const here = placeOf(current.occupationId)
  const there = placeOf(occupationId)
  return here !== undefined && there !== undefined && there.rung > here.rung
}

/**
 * M-CAREER §4. GO AND ASK.
 *
 * NOTE THE RETURN. This used to hire you or not; it now opens an INTERVIEW,
 * so `applied` is what it can honestly report — whether the room happened.
 * Whether they want you is decided in it, and the offer that may follow is
 * a card of its own. The field was called `hired` and a test caught the lie
 * immediately, which is the field name doing its job.
 */
export function applyForJob(world: World, occupationId: string): { applied: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { applied: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { applied: false, reason: 'A decision is already waiting.' }
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  if (!occupation) return { applied: false, reason: 'No such trade in town.' }

  const tick = world.tick
  const age = ageAt(person.birthTick, tick)
  if (age < 18) return { applied: false, reason: 'Not yet eighteen.' }
  if (isServing(world, person.id)) {
    return { applied: false, reason: 'The uniform is a full-time career; leave the service first.' }
  }
  const education = world.education.get(person.id)
  if (education !== undefined && isHigherEducation(education.enrolledIn)) {
    return { applied: false, reason: 'Full-time study fills the days.' }
  }
  if (isSeverelyAiling(world, person.id)) {
    return { applied: false, reason: 'Too ill or hurt to take new work this month.' }
  }
  // Jail is absence (C1) — runEmployment has always known that and this
  // verb never did, so a jailed player could be hired from a cell. Reachable
  // the moment C2 let the player go to jail at all.
  if (isJailed(world, person.id)) {
    return { applied: false, reason: 'Nobody is hiring out of a cell.' }
  }
  const current = world.employment.get(person.id)
  if (current?.occupationId === occupationId) {
    return { applied: false, reason: 'This is already the work they do.' }
  }
  // ADR-0033 STILL HOLDS, it just guards a different door now. The rule
  // was "the fork at eighteen comes first" and it used to sit on the
  // unsolicited job offer, which the careers overhaul deleted. A school
  // leaver with college, a trade, the uniform and work all still open
  // should not be able to answer that question by taking a job instead —
  // so the gate moved to the asking.
  if (educationForkPending(world, person, tick)) {
    return {
      applied: false,
      reason: 'There is a decision waiting about what comes after school. That first.',
    }
  }
  // One asking a month: the same month re-rolls the same answer, and a life
  // story should not carry ten identical rejections dated the same day.
  if (world.player.log.some((entry) => entry.kind === 'job-application' && entry.tick === tick)) {
    return { applied: false, reason: 'One asking a month. The town knows where to find you.' }
  }

  // The asking is a player input — logged before the answer, so replay
  // walks the same road.
  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick,
    kind: 'job-application',
    choice: occupationId,
  })
  world.player.nextDecisionId += 1

  const unlocked = veteranUnlocks(world, person.id)
  const qualified =
    meetsRequirement(education?.level ?? 'none', occupation.requires) || unlocked.includes(occupation.id)
  if (!qualified) {
    return { applied: false, reason: `${occupation.title} asks for ${occupation.requires === 'college' ? 'college' : occupation.requires === 'trade' ? 'trade school' : 'more schooling'} — the papers are not there.` }
  }

  // M-CAREER §4. THERE IS A ROOM NOW.
  //
  // This used to be one hidden roll behind a button. The interview is a
  // real moment with three ways to play it, and the roll happens when it is
  // answered — see the 'interview' case in resolvePending.
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 9999)
  const variant = rng.nextIntInclusive(0, 999)
  const opened = raisePending(world, {
    tick,
    kind: 'interview',
    personId: person.id,
    otherId: null,
    occupationId: encodeInterview(occupation.id, variant),
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: [...INTERVIEW_APPROACHES],
  })
  if (opened) return { applied: true, reason: '' }
  return { applied: false, reason: 'There is already a decision waiting.' }
}

/**
 * M-CAREER §4. THE ROOM'S ANSWER.
 *
 * The odds the old button rolled, plus what the approach was worth in a
 * room of this kind. Returns the offer to raise, or null for a no — the
 * caller raises it AFTER commit(), because raisePending refuses while the
 * answered interview still holds the slot. (The trap the trial, the
 * contract chain, the separation sheet and the crime scene each fell into.)
 */
export function resolveInterview(
  world: World,
  tick: Tick,
  person: Person,
  occupationId: string,
  approach: InterviewApproach,
  variant: number,
): { hired: boolean; workplaceId: EntityId | null; pay: Money } {
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  const workplaces = placesOfKind(world, 'workplace')
  if (!occupation || workplaces.length === 0) {
    return { hired: false, workplaceId: null, pay: 0 as Money }
  }
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 10_101)
  const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
  const stretch = isStretchFor(world, person.id, occupationId)
  // WHAT THE SERVICE IS WORTH IN THE ROOM (Fix 1, veteran transition).
  //
  // The spec is precise about this: a specialty "gives an EDGE in the
  // interview... never a doctor with no medical ladder behind it". So a
  // veteran applying into the field their trade actually was does not
  // skip the interview and is not handed the job — they walk in better
  // than the person beside them, which is what a decade of doing the
  // work is worth and no more.
  const relevant = veteranUnlocks(world, person.id).includes(occupationId)
  const serviceEdge = relevant ? 170 : 0
  const odds =
    450 +
    Math.floor(drive / 4) -
    (stretch ? 150 : 0) +
    approachBonus(approach, stretch) +
    serviceEdge
  if (!rng.chance(Math.max(30, Math.min(970, odds)), 1000)) {
    recordEvent(world, tick, { type: 'turned-down', subjectId: person.id, detail: occupation.title })
    return { hired: false, workplaceId: null, pay: 0 as Money }
  }
  const workplace = rng.pick(workplaces)
  const pay = atTodaysPrices(
    world,
    rng.nextIntInclusive(occupation.minMonthlyPay, occupation.maxMonthlyPay) as Money,
  ) as Money
  void variant
  return { hired: true, workplaceId: workplace.id, pay }
}

/**
 * Walk into the recruiting office, now, from the Service tab. Eligible, the
 * which-uniform question follows immediately; barred, the reason comes back
 * in plain words instead of a silent dead end.
 */
/**
 * M-CAREER §5. OPEN THE DOORS.
 *
 * Real capital, out of savings, gone the moment it is spent. Refused in
 * plain words rather than greyed out, like every other verb here.
 */
export function startBusiness(world: World, kindId: string): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const kind = businessKindById(kindId)
  const accounts = accountsOf(world, person.id)
  const cash = (accounts.savings + accounts.checking) as Money
  const capital = kind === undefined ? (0 as Money) : (atTodaysPrices(world, kind.capital) as Money)
  const owns = [...world.businesses.values()].some(
    (business) => business.ownerId === person.id && business.closedTick === null,
  )
  const bar = businessBar(kind, cash, capital, owns, ageAt(person.birthTick, world.tick))
  if (bar !== null) return { done: false, reason: bar }
  if (!kind) return { done: false, reason: 'No such trade to go into.' }

  const opened = openBusiness(world, world.tick, person.id, kind.id, capital)
  return opened
    ? { done: true, reason: '' }
    : { done: false, reason: 'It did not come together this month.' }
}

/**
 * THE BUSINESS THIS PERSON IS RUNNING, or undefined.
 *
 * One per person is already the rule `businessBar` enforces at opening, so
 * the first trading one is the only one.
 */
export function businessOf(world: World, personId: EntityId): Business | undefined {
  for (const business of world.businesses.values()) {
    if (business.ownerId === personId && business.closedTick === null) return business
  }
  return undefined
}

/**
 * GROW IT INTO A COMPANY (careers overhaul, Fix 3B).
 *
 * Costs nothing and takes nothing — this is not a purchase, it is the
 * moment a business that has already outgrown itself starts behaving like
 * what it has become: the capital ceiling lifts, the owner starts drawing a
 * salary instead of the profit, and the thing acquires a valuation.
 */
export function scaleUpPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const business = businessOf(world, person.id)
  const kind = business === undefined ? undefined : businessKindById(business.kindId)
  const bar = scaleUpBar(business, kind, world.tick)
  if (bar !== null) return { done: false, reason: bar }
  if (business === undefined) return { done: false, reason: 'There is no business to grow.' }

  logVerb(world, 'scale-up', business.name)
  world.businesses.set(business.id, { ...business, scaledAtTick: world.tick })
  recordEvent(world, world.tick, {
    type: 'company-scaled',
    subjectId: person.id,
    detail: business.name,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'business',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('years-trading', 800)],
    chosen: `grew ${business.name} into a company`,
    rejected: ['kept it the size it was'],
    streamId: Stream.Career,
  })
  return { done: true, reason: '' }
}

/**
 * Why this company cannot go public, or null. The bar pattern.
 */
export function ipoBar(world: World, personId: EntityId): string | null {
  const business = businessOf(world, personId)
  if (business === undefined) return 'You do not run a company.'
  if (business.scaledAtTick == null) {
    return 'A trade does not list on an exchange. Grow it into a company first.'
  }
  if (business.listedStockId != null) return 'It is already public.'
  const kind = businessKindById(business.kindId)
  if (kind === undefined) return 'You do not run a company.'
  const valuation = valuationOf(business, kind)
  if (valuation < IPO_MIN_VALUATION) {
    return `Nobody will underwrite it at ${String(Math.floor(valuation / 100_000_00))} million. It needs to be worth ${String(Math.floor(IPO_MIN_VALUATION / 100_000_00))}.`
  }
  return null
}

/**
 * TAKE IT PUBLIC — the capstone (careers overhaul, Fix 3C).
 *
 * Three things happen and each belongs to a different module, which is the
 * whole test of whether this is really wired into the world or merely
 * looks like it:
 *
 *   the MARKET lists it, and from the next tick it has a price that moves,
 *     analyst coverage, and news of its own — the same engine as the other
 *     thirty-three, with no special case anywhere;
 *   FINANCES pays the founder for the slice they sold, because finances is
 *     the only thing in this world that moves money;
 *   the founder's remaining stake becomes a HOLDING, so it sits in the
 *     portfolio next to everything else they own and rises and falls with
 *     the share price like anybody else's shares.
 *
 * That last one is the point of the feature. Your net worth is now exposed
 * to a market, and the exposure is real in both directions.
 */
export function takePublicPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = ipoBar(world, person.id)
  if (bar !== null) return { done: false, reason: bar }
  const business = businessOf(world, person.id)
  const kind = business === undefined ? undefined : businessKindById(business.kindId)
  if (business === undefined || kind === undefined) {
    return { done: false, reason: 'You do not run a company.' }
  }

  const valuation = valuationOf(business, kind)
  const stockId = `ipo-${String(business.id)}`
  const annualProfit = Math.floor(annualRevenueOf(business, kind) / 8) as Money
  const stock = listCompany(
    world,
    world.tick,
    stockId,
    business.name,
    business.kindId,
    valuation,
    annualProfit,
  )
  if (stock === undefined) return { done: false, reason: 'The listing did not go through.' }

  logVerb(world, 'take-public', business.name)
  const keptPerMille = 1000 - IPO_FLOAT_PER_MILLE
  world.businesses.set(business.id, {
    ...business,
    listedStockId: stockId,
    founderStakePerMille: keptPerMille,
  })

  // The cash for the slice sold. finances writes it, as always.
  creditPerson(world, person.id, floatProceedsFor(valuation))
  // And the rest becomes shares they hold, at the opening price.
  grantShares(
    world,
    person.id,
    stockId,
    stock.sectorId,
    Math.floor((stock.sharesOutstanding * keptPerMille) / 1000),
    Math.floor((valuation * keptPerMille) / 1000) as Money,
  )

  recordEvent(world, world.tick, {
    type: 'went-public',
    subjectId: person.id,
    detail: `${business.name}:${stock.ticker}`,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'business',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('valuation', 1000)],
    chosen: `took ${business.name} public as ${stock.ticker}`,
    rejected: ['kept it private'],
    streamId: Stream.Career,
  })
  return { done: true, reason: '' }
}

// ---------------------------------------------------------------------------
// THE CASINO (owner's `casino_poker_master_1.md`)
// ---------------------------------------------------------------------------

/**
 * WHAT A PLAYER CAN ACTUALLY PUT ON A TABLE — savings plus checking.
 *
 * This is the "bankroll" every screen in the spec refers to. It is
 * deliberately NOT stored anywhere: a poker player's bankroll IS their
 * money, and keeping a second number for it would be two sources of truth
 * for how much somebody has (Law 12). Finances owns cents; this reads them.
 */
export function bankrollOf(world: World, personId: EntityId): Money {
  return gamblerOf(world, personId).chips
}

/**
 * Why the doors are shut, or null. Age, money, and a body in a cell.
 */
export function casinoBar(world: World, wager: Money): string | null {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return 'Nobody is being played.'
  if (world.player.pending !== null) return 'A decision is already waiting.'
  if (ageAt(person.birthTick, world.tick) < CASINO_MIN_AGE) {
    return `They card everybody on the door. You have to be ${String(CASINO_MIN_AGE)}.`
  }
  if (isCaptive(world, person.id)) return 'Held prisoner. None of this is yours to ask for.'
  const criminal = world.criminal.get(person.id)
  if (criminal?.jailedUntilTick != null && world.tick < criminal.jailedUntilTick) {
    return 'Not from in here.'
  }
  if (wager <= 0) return 'You have to put something up.'
  // CHIPS, NOT CASH. What you can lose at a table is what is in the tray,
  // and nothing at a table can reach the rent. Getting to the rent takes a
  // second, deliberate act: walking back to the cashier.
  if (gamblerOf(world, person.id).chips < wager) {
    return 'You are out of chips. The cashier is by the door.'
  }
  return null
}

/**
 * BUY CHIPS. The cashier — the one place cents and chips ever meet.
 *
 * finances debits the money and this module credits the tray, which is the
 * single-writer rule doing exactly what it is for: two owners, one seam,
 * and no way for either to write the other's number.
 */
export function buyChipsPlayer(world: World, cents: Money): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  if (ageAt(person.birthTick, world.tick) < CASINO_MIN_AGE) {
    return { done: false, reason: `They card everybody on the door. You have to be ${String(CASINO_MIN_AGE)}.` }
  }
  if (isCaptive(world, person.id)) {
    return { done: false, reason: 'Held prisoner. None of this is yours to ask for.' }
  }
  const liquid = walletOf(world, person.id)
  const bar = buyChipsBar(cents, liquid)
  if (bar !== null) return { done: false, reason: bar }

  const record = gamblerOf(world, person.id)
  // How many times already tonight. The month is the visit — this world's
  // clock has no evenings in it, and re-buying inside one month is the
  // closest honest reading of going back to the window.
  const rebuys = record.lastPlayedTick === world.tick ? 1 + Math.floor(record.hold / 200) : 0
  const creep = holdFromCashier(cents, liquid, rebuys, disciplineOf(world, person.id, world.tick))

  logVerb(world, 'buy-chips', String(cents))
  debitPerson(world, person.id, cents)
  world.gamblers.set(person.id, {
    ...record,
    chips: (record.chips + cents) as Money,
    hold: Math.min(1_000, record.hold + creep),
    lastPlayedTick: world.tick,
    inRecoverySinceTick: null,
  })
  recordEvent(world, world.tick, {
    type: 'bought-chips',
    subjectId: person.id,
    detail: String(cents),
  })
  return { done: true, reason: '' }
}

/**
 * CASH OUT. The tray goes back across the window and becomes money again.
 *
 * Free, unlimited, and never refused — walking away with what you have
 * left is the one thing a game about this must never make difficult.
 */
export function cashOutPlayer(world: World): { done: boolean; reason: string; cents: Money } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) {
    return { done: false, reason: 'Nobody is being played.', cents: 0 as Money }
  }
  const record = gamblerOf(world, person.id)
  if (record.chips <= 0) return { done: false, reason: 'You have nothing to cash.', cents: 0 as Money }
  const cents = record.chips
  logVerb(world, 'cash-out', String(cents))
  world.gamblers.set(person.id, { ...record, chips: 0 as Money })
  creditPerson(world, person.id, cents)
  recordEvent(world, world.tick, {
    type: 'cashed-out',
    subjectId: person.id,
    detail: String(cents),
  })
  return { done: true, reason: '', cents }
}

/** Money that is actually theirs to spend — the cashier's side of the window. */
export function walletOf(world: World, personId: EntityId): Money {
  const accounts = accountsOf(world, personId)
  return Math.max(0, accounts.savings + accounts.checking) as Money
}

/** Record the night: the hours, the money, and what it is costing. */
/**
 * Settle a night against the tray, and write the record.
 *
 * THE MONEY NEVER TOUCHES AN ACCOUNT HERE. Chips go up or down and that is
 * all — the accounts only move at the cashier. `net` may be negative, and
 * it cannot take the tray below nothing: when the chips are gone you are
 * done, which is what being out of chips means.
 *
 * The HOLD is not touched here either. It is bought at the window, not at
 * the table, and putting it in both places would count the same act twice.
 */
function recordPlay(
  world: World,
  personId: EntityId,
  wagered: Money,
  net: number,
  hours: number,
  skillGain: number,
): void {
  const before = gamblerOf(world, personId)
  world.gamblers.set(personId, {
    ...before,
    chips: Math.max(0, before.chips + net) as Money,
    pokerSkill: Math.min(POKER_SKILL_MAX, before.pokerSkill + skillGain),
    hoursPlayed: before.hoursPlayed + hours,
    lifetimeNet: before.lifetimeNet + net,
    lifetimeWagered: before.lifetimeWagered + wagered,
    lastPlayedTick: world.tick,
  })
}

/**
 * BLACKJACK OR SLOTS. The casino resolves; finances moves the money.
 */
export function playTablePlayer(
  world: World,
  game: TableGame,
  wager: Money,
  choice: BlackjackChoice,
): { done: boolean; reason: string; result: TableResult | null } {
  const bar = casinoBar(world, wager)
  if (bar !== null) return { done: false, reason: bar, result: null }
  const person = playerPerson(world)
  if (!person) return { done: false, reason: 'Nobody is being played.', result: null }

  // THE HOLD MAKES PEOPLE BET MORE THAN THEY MEANT TO. This is where that
  // becomes real money rather than a number on a screen.
  const record = gamblerOf(world, person.id)
  const intended = Math.floor((wager * wagerCreepPerMille(record)) / 1_000)
  const staked = Math.min(intended, bankrollOf(world, person.id)) as Money

  const result = playTable(
    world,
    world.tick,
    person.id,
    game,
    staked,
    choice,
    smartsOf(world, person.id),
    record.hoursPlayed,
  )
  logVerb(world, 'gamble', `${game}:${String(result.wagered)}`)
  // NO CASH MOVES. It is chips across a felt table, and the tray is the
  // whole of what is at risk.
  recordPlay(world, person.id, result.wagered, result.net, 1, 0)
  recordEvent(world, world.tick, {
    type: 'gambled',
    subjectId: person.id,
    detail: `${game}:${String(result.net)}`,
  })
  return { done: true, reason: '', result }
}

/**
 * SETTLE A CASH SESSION: the chips move, the record grows, and the recap
 * is stored for the screen (spec §2b).
 *
 * Shared by the ordinary path and by the key hand's resolution, so a night
 * with a big pot in it and a night without settle through exactly the same
 * code — the hand adds to the night rather than being a separate event
 * that has to be kept in step.
 */
function settleSession(
  world: World,
  person: Person,
  stake: Stake,
  buyIn: Money,
  result: SessionResult,
  extraPerMille: number,
): SessionSummary {
  const shift = Math.floor((buyIn * extraPerMille) / 1_000)
  const net = Math.max(-(buyIn * 3), result.net + shift)

  const before = gamblerOf(world, person.id)
  const ceiling = pokerCeilingFor(
    smartsOf(world, person.id),
    disciplineOf(world, person.id, world.tick),
    person.traits.resilience,
  )
  const gain = skillGainFrom(before.pokerSkill, ceiling, result.hours * 2)
  recordPlay(world, person.id, buyIn, net, result.hours, gain)

  const summary: SessionSummary = {
    tick: world.tick,
    stakeTitle: stake.title,
    hours: result.hours,
    hands: result.hands,
    net,
    perHour: Math.floor(net / Math.max(1, result.hours)),
    biggestPot: result.biggestPot,
    chipsAfter: gamblerOf(world, person.id).chips,
    words: result.words,
  }
  world.gamblers.set(person.id, { ...gamblerOf(world, person.id), lastSession: summary })
  recordEvent(world, world.tick, {
    type: 'played-poker',
    subjectId: person.id,
    detail: `${stake.title}:${String(net)}`,
  })
  return summary
}

/** "stakeId|hours|net|hands|biggestPot|visit" — the night, held while the
 *  player answers the hand. A pending carries strings, so this is how the
 *  already-seeded session survives the round trip without being re-rolled
 *  (which would let somebody reload for a better night). */
export function encodeHeldSession(
  stakeId: string,
  result: SessionResult,
  visit: number,
): string {
  return [
    stakeId,
    String(result.hours),
    String(result.net),
    String(result.hands),
    String(result.biggestPot),
    String(visit),
  ].join('|')
}

export function decodeHeldSession(encoded: string | null): {
  stakeId: string
  result: SessionResult
  visit: number
} | null {
  if (encoded === null) return null
  const [stakeId, hours, net, hands, pot, visit] = encoded.split('|')
  if (stakeId === undefined || hours === undefined || net === undefined) return null
  const stake = stakeById(stakeId)
  if (stake === undefined) return null
  return {
    stakeId,
    visit: Number(visit ?? 0),
    result: {
      stakeId,
      hours: Number(hours),
      hands: Number(hands ?? 0),
      net: Number(net),
      perHour: Math.floor(Number(net) / Math.max(1, Number(hours))),
      biggestPot: Number(pot ?? 0) as Money,
      words: '',
    },
  }
}

/**
 * A CASH SESSION at a chosen stake.
 *
 * The bar refuses a stake you cannot buy into at all; it does NOT refuse a
 * stake you are under-rolled for, and that is deliberate. Playing above
 * your roll is the single most common way people go broke at this game,
 * and a casino that stopped you would be removing the decision the whole
 * bankroll model exists to pose. You are told, and then it is yours.
 */
export function playPokerPlayer(
  world: World,
  stakeId: string,
  hours: number,
): { done: boolean; reason: string; result: SessionResult | null } {
  const stake = stakeById(stakeId)
  if (stake === undefined) return { done: false, reason: 'No such game running.', result: null }
  const person = playerPerson(world)
  if (!person) return { done: false, reason: 'Nobody is being played.', result: null }
  const buyIn = atTodaysPrices(world, stake.buyIn) as Money
  const bar = casinoBar(world, buyIn)
  if (bar !== null) return { done: false, reason: bar, result: null }

  const record = gamblerOf(world, person.id)
  const played = Math.max(1, Math.min(12, hours))
  const result = playSession(
    world,
    world.tick,
    person.id,
    stake,
    buyIn,
    record.pokerSkill,
    played,
    record.hoursPlayed,
  )

  logVerb(world, 'poker', `${stakeId}:${String(played)}`)

  // A BIG POT, SOMETIMES. When one comes up the night is HELD rather than
  // settled: the already-seeded session travels on the pending, the player
  // answers, and the answer shifts what the night was worth. Re-rolling
  // the session after the answer would let somebody reload for a better
  // one, which is the whole reason the result is carried across rather
  // than recomputed.
  const hand = keyHandFor(world, world.tick, person.id, record.hoursPlayed, record.pokerSkill)
  if (hand !== null && person.id === world.player.personId) {
    const raised = raisePending(world, {
      tick: world.tick,
      kind: 'key-hand',
      personId: person.id,
      otherId: null,
      occupationId: encodeHeldSession(stakeId, result, record.hoursPlayed),
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: [...HAND_CHOICES],
    })
    if (raised) return { done: true, reason: '', result: null }
  }

  settleSession(world, person, stake, buyIn, result, 0)
  return { done: true, reason: '', result }
}

/** Enter a tournament. */
export function enterTournamentPlayer(
  world: World,
  tournamentId: string,
): { done: boolean; reason: string; result: TournamentResult | null } {
  const event = tournamentById(tournamentId)
  if (event === undefined) return { done: false, reason: 'No such tournament.', result: null }
  const person = playerPerson(world)
  if (!person) return { done: false, reason: 'Nobody is being played.', result: null }
  if (!tournamentRunning(event, world.tick)) {
    return { done: false, reason: 'That one is not running this month.', result: null }
  }
  const buyIn = atTodaysPrices(world, event.buyIn) as Money
  const bar = casinoBar(world, buyIn)
  if (bar !== null) return { done: false, reason: bar, result: null }

  const record = gamblerOf(world, person.id)
  const result = playTournament(
    world,
    world.tick,
    person.id,
    event,
    buyIn,
    record.pokerSkill,
    record.hoursPlayed,
  )

  logVerb(world, 'tournament', tournamentId)

  const ceiling = pokerCeilingFor(
    smartsOf(world, person.id),
    disciplineOf(world, person.id, world.tick),
    person.traits.resilience,
  )
  const gain = skillGainFrom(record.pokerSkill, ceiling, result.hours * 2)
  recordPlay(world, person.id, result.buyIn, result.net, result.hours, gain)
  const best = record.bestFinish
  world.gamblers.set(person.id, {
    ...gamblerOf(world, person.id),
    bestFinish: best === null || result.finish < best ? result.finish : best,
    lastTournament: {
      tick: world.tick,
      title: event.title,
      field: result.field,
      finish: result.finish,
      payout: result.payout,
      bounties: result.bounties,
      buyIn: result.buyIn,
      net: result.net,
      hours: result.hours,
      chipsAfter: gamblerOf(world, person.id).chips,
      words: result.words,
    },
  })
  recordEvent(world, world.tick, {
    type: 'played-tournament',
    subjectId: person.id,
    detail: `${event.title}:${String(result.finish)}/${String(event.field)}:${String(result.net)}`,
  })
  return { done: true, reason: '', result }
}

/**
 * STUDY (spec §3: "poker skill only grows by actually playing and
 * studying... put in the work, don't just toggle it").
 *
 * Away from the table, and it costs a month's evenings rather than money.
 * It is worth LESS than playing per unit of effort and it is worth
 * something when a downswing means you should not be at a table at all —
 * which is the honest relationship between the two.
 */
export function studyPokerPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { done: false, reason: 'A decision is already waiting.' }
  if (ageAt(person.birthTick, world.tick) < CASINO_MIN_AGE) {
    return { done: false, reason: 'There is time for that later.' }
  }
  const record = gamblerOf(world, person.id)
  if (world.player.log.some((e) => e.kind === 'study-poker' && world.tick - e.tick < 3)) {
    return { done: false, reason: 'You have been at the books. It has to be spread out to stick.' }
  }
  const ceiling = pokerCeilingFor(
    smartsOf(world, person.id),
    disciplineOf(world, person.id, world.tick),
    person.traits.resilience,
  )
  const gain = skillGainFrom(record.pokerSkill, ceiling, 55)
  if (gain <= 0) {
    return { done: false, reason: 'There is nothing left in a book for you. Only volume now.' }
  }
  logVerb(world, 'study-poker', String(gain))
  world.gamblers.set(person.id, {
    ...record,
    pokerSkill: Math.min(POKER_SKILL_MAX, record.pokerSkill + gain),
  })
  return { done: true, reason: '' }
}

/** Make it the job (spec §2, "going pro"). */
export function turnProPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = gamblerOf(world, person.id)
  const lowStake = stakeById('low')
  const buyIn = lowStake === undefined ? (0 as Money) : (atTodaysPrices(world, lowStake.buyIn) as Money)
  const bar = turnProBar(record, walletOf(world, person.id), buyIn)
  if (bar !== null) return { done: false, reason: bar }

  logVerb(world, 'turn-pro', 'poker')
  world.gamblers.set(person.id, { ...record, turnedProAtTick: world.tick })
  // Leaving a job to do this is the player's own decision and the job
  // system's to carry out — this module does not fire anybody.
  recordEvent(world, world.tick, {
    type: 'turned-pro',
    subjectId: person.id,
    detail: 'poker',
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('has-income', Math.min(1000, record.pokerSkill))],
    chosen: 'started playing poker for a living',
    rejected: ['kept it to evenings'],
    streamId: Stream.Casino,
  })
  return { done: true, reason: '' }
}

/**
 * ADMIT IT AND STOP (spec: "with a recovery arc, modeled seriously").
 *
 * Deliberately available at ANY time and to anybody, including somebody
 * whose hold is nowhere near a problem — deciding to stop is not something
 * a person should have to qualify for. What it does is real: recovery
 * eases the hold three times faster than merely not playing, because
 * choosing to stop is different from happening not to.
 */
export function seekHelpPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = gamblerOf(world, person.id)
  if (record.inRecoverySinceTick !== null) return { done: false, reason: 'You are already doing this.' }
  if (record.hold <= 0 && record.hoursPlayed === 0) {
    return { done: false, reason: 'There is nothing to walk away from.' }
  }
  logVerb(world, 'seek-help', 'gambling')
  world.gamblers.set(world.player.personId ?? person.id, {
    ...record,
    inRecoverySinceTick: world.tick,
  })
  recordEvent(world, world.tick, {
    type: 'sought-help',
    subjectId: person.id,
    detail: 'gambling',
  })
  return { done: true, reason: '' }
}

// ---------------------------------------------------------------------------
// SPORT (owner's `sports_careers_master.md`)
// ---------------------------------------------------------------------------

export function athleteOf(world: World, personId: EntityId): AthleteRecord | undefined {
  return world.athletes.get(personId)
}

/**
 * TRY OUT FOR THE TEAM, and pick a position while you are at it.
 *
 * The tryout can be FAILED, at twelve, which is deliberate. A pipeline
 * whose first step nobody fails is not a pipeline.
 */
export function tryOutPlayer(
  world: World,
  sport: string,
  positionId: string,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const age = ageAt(person.birthTick, world.tick)
  const bar = tryoutBar(age, world.athletes.get(person.id))
  if (bar !== null) return { done: false, reason: bar }
  const position = positionById(positionId)
  if (position === undefined || position.sport !== sport) {
    return { done: false, reason: 'They do not field that position.' }
  }
  // COMBAT DOES NOT HAVE A SCHOOL TEAM. You walk into a gym, and there is
  // no squad to be cut from — which is why the tryout gate does not apply
  // and a fighter starts on the amateur road instead.
  const combat = sport === 'combat'

  const rng = openStream(world.seed, Stream.Sports, person.id * 3, world.tick)
  const stats = startingStats(
    person.traits.vitality,
    person.traits.resilience,
    person.traits.diligence,
    rng.nextIntInclusive(0, 4_095),
  )
  const potential = potentialFor(
    person.traits.vitality,
    person.traits.resilience,
    rng.nextIntInclusive(-6, 24),
  )
  const trial = freshAthlete(person.id, sport as never, positionId, stats, potential)

  logVerb(world, 'try-out', `${sport}:${positionId}`)
  if (!combat && !makesSquad(overallOf(trial), 'school', rng.nextIntInclusive(-10, 10))) {
    recordEvent(world, world.tick, {
      type: 'missed-squad',
      subjectId: person.id,
      detail: position.title,
    })
    return { done: false, reason: 'You were cut. Plenty of people are, and you can try again next year.' }
  }

  world.athletes.set(
    person.id,
    combat ? { ...trial, level: 'college', wins: 0, losses: 0, finishes: 0, ranking: 0 } : trial,
  )
  recordEvent(world, world.tick, {
    type: 'made-team',
    subjectId: person.id,
    detail: `${position.title}`,
  })
  return { done: true, reason: '' }
}

/**
 * PUT THE WORK IN (spec §"Training is real work" — "an ongoing regimen,
 * not a switch... with plateaus, fatigue, and injury / overtraining
 * risk").
 *
 * THIS IS THE FULL VERSION of the principle poker started. It can be done
 * every month and doing it every month is a MISTAKE: fatigue blunts the
 * work AND raises the chance of getting hurt, so the answer is a rhythm
 * rather than a held-down button. Resting is the other half of it and is
 * its own verb for exactly that reason.
 */
export function trainPlayer(
  world: World,
  focus: string,
): { done: boolean; reason: string; words: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) {
    return { done: false, reason: 'Nobody is being played.', words: '' }
  }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.level === 'done') {
    return { done: false, reason: 'You are not on a team.', words: '' }
  }
  if (isCaptive(world, person.id)) {
    return { done: false, reason: 'Held prisoner. None of this is yours to ask for.', words: '' }
  }
  const health = world.health.get(person.id)
  if (health !== undefined && health.ailment !== null && health.severity >= 500) {
    return { done: false, reason: 'Not while you are laid up like this.', words: '' }
  }
  const chosen: TrainingFocus =
    focus === 'strength' ? 'strength' : focus === 'conditioning' ? 'conditioning' : 'skill'

  const age = ageAt(person.birthTick, world.tick)
  const rng = openStream(world.seed, Stream.Sports, person.id * 5 + record.seasons, world.tick + 900)
  const result = train(
    record,
    chosen,
    ceilingFor(record.potential, age),
    rng.nextIntInclusive(0, 999),
    rng.nextIntInclusive(0, 999),
  )

  logVerb(world, 'train', chosen)
  const stats: Record<string, number> = { ...record.stats }
  for (const [id, gain] of Object.entries(result.gained)) {
    stats[id] = Math.min(99, (stats[id] ?? 0) + gain)
  }
  world.athletes.set(person.id, { ...record, stats, fatigue: result.fatigueAfter })

  if (result.hurt) {
    // THE HEALTH MODULE OWNS INJURY. This says somebody got hurt; what
    // that means is not this module's to decide (Law 12).
    recordEvent(world, world.tick, {
      type: 'training-injury',
      subjectId: person.id,
      detail: chosen,
    })
    nudgeWellbeing(world, world.tick, person.id, -30, 'the injury')
  }
  return { done: true, reason: '', words: result.words }
}

/** The other half of training, and the only thing that clears fatigue. */
export function restPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.level === 'done') {
    return { done: false, reason: 'You are not on a team.' }
  }
  if (record.fatigue <= 0) return { done: false, reason: 'You are already fresh.' }
  logVerb(world, 'rest-up', String(record.fatigue))
  world.athletes.set(person.id, { ...record, fatigue: rested(record.fatigue) })
  return { done: true, reason: '' }
}

/**
 * TAKE AN OFFER (spec: a scholarship "ties to the education module's
 * aid").
 *
 * Walking on is a real choice and so is turning them all down — the
 * developmental road exists precisely so college is not the only door.
 */
export function acceptOfferPlayer(world: World, offerId: string): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined) return { done: false, reason: 'You are not on a team.' }
  const offer = (record.offers ?? []).find((entry) => entry.id === offerId)
  if (offer === undefined) return { done: false, reason: 'That offer is not on the table.' }

  logVerb(world, 'take-offer', offerId)
  // The other offers are GONE once one is taken — you cannot sign with a
  // programme and keep the rest warm. Rebuilt without the key rather than
  // set to undefined, which the strict optional rules refuse and which
  // would leave an empty slot meaning two different things.
  const { offers: _taken, ...rest } = record
  world.athletes.set(person.id, {
    ...rest,
    level: 'college',
    teamName: offer.programme,
  })
  recordEvent(world, world.tick, {
    type: 'signed-letter',
    subjectId: person.id,
    detail: `${offer.programme}:${offer.ride}`,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('qualified-for-role', offer.strength * 10)],
    chosen: `signed with ${offer.programme}`,
    rejected: (record.offers ?? [])
      .filter((entry) => entry.id !== offerId)
      .map((entry) => entry.programme),
    streamId: Stream.Sports,
  })
  return { done: true, reason: '' }
}

/**
 * DECLARE FOR THE DRAFT.
 *
 * The age rule is the sport's real one and is enforced HERE rather than
 * only greyed out on a screen. Undrafted is the ordinary answer and it is
 * not the end — the developmental road is still open.
 */
export function declareForDraftPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.level === 'done') {
    return { done: false, reason: 'You are not on a team.' }
  }
  if (record.level === 'pro') return { done: false, reason: 'You are already a professional.' }
  const age = ageAt(person.birthTick, world.tick)
  const rules = rulesFor(record.sport)
  if (age < rules.proAge) {
    return {
      done: false,
      reason:
        rules.draftPicks === 0
          ? `Nobody signs anybody at ${String(age)} in this sport. ${String(rules.proAge)} is the door.`
          : `The league takes nobody under ${String(rules.proAge)}${rules.proAge >= 21 ? ', three years removed from school' : ', and a year removed from school'}. You are ${String(age)}.`,
    }
  }

  const rng = openStream(world.seed, Stream.Sports, person.id * 7, world.tick + 1_700)
  const production = Math.min(99, Math.floor(record.careerPoints / Math.max(1, record.careerGames)) * 3)

  // NO DRAFT IN THIS SPORT — soccer and combat. A club or a promotion
  // signs you, or nobody does, and that is a genuinely different thing
  // from hearing your name on a night when sixty are called.
  if (rules.draftPicks === 0) {
    const evidence =
      record.sport === 'combat' ? (record.wins ?? 0) * 9 - (record.losses ?? 0) * 6 : production
    const signing = runSigning(record.sport, overallOf(record), Math.max(0, evidence), rng.nextIntInclusive(-6, 6))
    logVerb(world, 'declare-draft', record.sport)
    if (!signing.signed) return { done: false, reason: signing.words }
    world.athletes.set(person.id, {
      ...record,
      level: 'pro',
      teamName: signing.clubName,
      tier: signing.tier,
      wage: signedWageFor(record.sport, signing.tier, overallOf(record)),
      turnedProAtTick: world.tick,
    })
    recordEvent(world, world.tick, {
      type: 'signed-pro',
      subjectId: person.id,
      detail: `${signing.clubName}:${String(signing.tier)}`,
    })
    return { done: true, reason: signing.words }
  }

  const result = runDraftFor(rules, overallOf(record), production, rng.nextIntInclusive(-6, 6))

  logVerb(world, 'declare-draft', String(record.seasons))
  if (result.pick === null) {
    world.athletes.set(person.id, { ...record, level: 'pro', teamName: 'the developmental league', wage: 40_000 as Money })
    recordEvent(world, world.tick, { type: 'went-undrafted', subjectId: person.id, detail: '' })
    return { done: true, reason: result.words }
  }

  world.athletes.set(person.id, {
    ...record,
    level: 'pro',
    draftPick: result.pick,
    teamName: result.teamName,
    wage: rookieWageFor(result.pick),
    turnedProAtTick: world.tick,
  })
  recordEvent(world, world.tick, {
    type: 'drafted',
    subjectId: person.id,
    detail: `${String(result.pick)}:${result.teamName}`,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('qualified-for-role', overallOf(record) * 10)],
    chosen: `drafted ${String(result.pick)} by the ${result.teamName}`,
    rejected: ['stayed in college'],
    streamId: Stream.Sports,
  })
  return { done: true, reason: result.words }
}

/**
 * TAKE A FIGHT (spec §"Combat sports").
 *
 * A fighter's career is a series of these rather than a season, which is
 * why combat gets its own verb instead of riding the season simulation. A
 * record is built one night at a time and it is the thing everybody in the
 * sport reads.
 *
 * The purse is real money and finances moves it, as always.
 */
export function takeFightPlayer(world: World): { done: boolean; reason: string; words: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) {
    return { done: false, reason: 'Nobody is being played.', words: '' }
  }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.sport !== 'combat' || record.level === 'done') {
    return { done: false, reason: 'You are not a fighter.', words: '' }
  }
  if (isCaptive(world, person.id)) {
    return { done: false, reason: 'Held prisoner. None of this is yours to ask for.', words: '' }
  }
  const health = world.health.get(person.id)
  if (health !== undefined && health.ailment !== null && health.severity >= 400) {
    return { done: false, reason: 'No commission licences somebody in this condition.', words: '' }
  }

  const fights = (record.wins ?? 0) + (record.losses ?? 0)
  const result = runFight(world, world.tick, person.id, record, fights)
  logVerb(world, 'take-fight', String(fights))

  const after = applyFight(record, result)
  world.athletes.set(person.id, {
    ...after,
    fatigue: Math.min(1_000, record.fatigue + 160),
  })
  creditPerson(world, person.id, atTodaysPrices(world, result.purse) as Money)
  recordEvent(world, world.tick, {
    type: 'fought',
    subjectId: person.id,
    detail: `${result.opponent}:${result.won ? 'W' : 'L'}${result.finish ? 'F' : ''}`,
  })
  if (after.champion === true && record.champion !== true) {
    recordEvent(world, world.tick, { type: 'won-title', subjectId: person.id, detail: record.teamName })
    recordDecision(world, world.tick, {
      subjectId: person.id,
      decision: 'employment-change',
      significance: 'defining',
      inputs: [factor('own-choice', 1000), factor('qualified-for-role', overallOf(record) * 10)],
      chosen: 'won the title',
      rejected: ['stayed a contender'],
      streamId: Stream.Sports,
    })
  }
  return { done: true, reason: '', words: result.words }
}

/**
 * SIGN AN ENDORSEMENT (spec §"Money, fame").
 *
 * Only ever offered to somebody a brand actually wants, which is very few
 * people — and the paper's morals clause is not decoration: a scandal
 * ends it, and the yearly pass enforces exactly that.
 */
export function signEndorsementPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.level !== 'pro') {
    return { done: false, reason: 'Nobody endorses somebody who is not playing.' }
  }
  if ((record.endorsements ?? 0) > 0) return { done: false, reason: 'You already have a deal.' }
  const offered = endorsementOfferFor(record)
  if (offered <= 0) {
    return { done: false, reason: 'Nobody knows who you are yet. That is what an endorsement buys.' }
  }
  logVerb(world, 'endorse', String(offered))
  world.athletes.set(person.id, { ...record, endorsements: offered })
  recordEvent(world, world.tick, {
    type: 'signed-endorsement',
    subjectId: person.id,
    detail: String(offered),
  })
  return { done: true, reason: '' }
}

/**
 * WHAT COMES AFTER (spec §"the second act", Law 7).
 *
 * A career ends around thirty-five and a life does not. This is chosen
 * rather than assigned, and "something else entirely" is always on the
 * list because it is what most people who ever played professionally
 * actually do.
 */
export function secondActPlayer(world: World, actId: string): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined) return { done: false, reason: 'You never played.' }
  if (record.level !== 'done') return { done: false, reason: 'You are still playing.' }
  if ((record.secondAct ?? '') !== '') return { done: false, reason: 'You have already decided.' }
  const act = secondActsFor(record).find((entry) => entry.id === actId)
  if (act === undefined) return { done: false, reason: 'That is not open to you.' }

  logVerb(world, 'second-act', actId)
  world.athletes.set(person.id, { ...record, secondAct: act.title })
  recordEvent(world, world.tick, {
    type: 'second-act',
    subjectId: person.id,
    detail: act.title,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('has-income', 400)],
    chosen: `went into ${act.title.toLowerCase()} after playing`,
    rejected: secondActsFor(record).filter((entry) => entry.id !== actId).map((entry) => entry.title),
    streamId: Stream.Sports,
  })
  return { done: true, reason: '' }
}

/** Hang them up. Always available — nobody is trapped in a career here. */
export function retirePlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const record = world.athletes.get(person.id)
  if (record === undefined || record.level === 'done') {
    return { done: false, reason: 'There is nothing to retire from.' }
  }
  logVerb(world, 'retire-sport', String(record.seasons))
  world.athletes.set(person.id, {
    ...record,
    level: 'done',
    retiredAtTick: world.tick,
    wage: 0 as Money,
    endedBecause: 'retired',
  })
  recordEvent(world, world.tick, {
    type: 'retired-from-sport',
    subjectId: person.id,
    detail: String(record.seasons),
  })
  return { done: true, reason: '' }
}

/**
 * M-ECON §9. THE BANK'S VERBS.
 *
 * Every one is a player INPUT — logged before it acts, refused honestly,
 * and routed through finances, which remains the single writer of money.
 * The screen computes nothing; it asks.
 */
export function bankTransfer(
  world: World,
  cents: number,
  toSavings: boolean,
): { moved: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { moved: false, reason: 'Nobody is being played.' }
  if (cents <= 0) return { moved: false, reason: 'Nothing to move.' }
  const moved = moveBetweenOwnAccounts(world, person.id, cents as Money, toSavings)
  return moved > 0
    ? { moved: true, reason: '' }
    : { moved: false, reason: 'That account does not hold it.' }
}

/**
 * BUY AND SELL A NAMED COMPANY. Siblings of the fund verbs, sharing their
 * shape so the worker, the log and the refusals all behave identically —
 * the only thing that differs is what is being priced.
 */
export function buySharesPlayer(
  world: World,
  stockId: string,
  cents: number,
  retirement: boolean,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  if (stockById(world, stockId) === undefined) return { done: false, reason: 'No such company.' }
  const spent = buyShares(world, world.tick, person.id, stockId, cents as Money, retirement)
  if (spent <= 0) return { done: false, reason: 'Not enough in savings to buy in.' }
  logVerb(world, 'invest', stockId)
  return { done: true, reason: '' }
}

export function sellSharesPlayer(
  world: World,
  stockId: string,
  retirement: boolean,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const got = sellShares(world, world.tick, person.id, stockId, retirement)
  if (got <= 0) return { done: false, reason: 'You hold no shares in that.' }
  logVerb(world, 'divest', stockId)
  return { done: true, reason: '' }
}

export function investPlayer(
  world: World,
  sectorId: string,
  cents: number,
  retirement: boolean,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const spent = buyInvestment(world, world.tick, person.id, sectorId, cents as Money, retirement)
  if (spent <= 0) return { done: false, reason: 'Not enough in savings to buy in.' }
  logVerb(world, 'invest', sectorId)
  return { done: true, reason: '' }
}

export function divestPlayer(
  world: World,
  sectorId: string,
  retirement: boolean,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const got = sellInvestment(world, world.tick, person.id, sectorId, retirement)
  if (got <= 0) return { done: false, reason: 'You hold none of that.' }
  logVerb(world, 'divest', sectorId)
  return { done: true, reason: '' }
}

export function borrowPlayer(
  world: World,
  kind: LoanKind,
  cents: number,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const accounts = accountsOf(world, person.id)
  const bar = loanBar(
    world,
    kind,
    creditOf(world, person.id),
    accounts.loans,
    (accounts.savings + accounts.checking) as Money,
    cents as Money,
  )
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'borrow', kind)
  return takeLoan(world, world.tick, person.id, kind, cents as Money)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The bank would not write it.' }
}

export function buyHomePlayer(
  world: World,
  /** ADR-0035. Cash or a mortgage — both are real ways to buy a house. */
  method: HomePurchaseMethod = 'mortgage',
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  if (person.householdId === null) return { done: false, reason: 'You have no address to buy.' }
  const household = world.households.get(person.householdId)
  if (!household) return { done: false, reason: 'You have no address to buy.' }
  // The refusal the button was greyed with, said out loud — rather than
  // "the purchase did not go through", which explains nothing.
  const bar = homePurchaseBar(world, person.id, household.placeId, method)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'buy-home', `${String(household.placeId)}:${method}`)
  return buyHome(world, world.tick, person.id, household.placeId, method)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The purchase did not go through.' }
}

/**
 * ADR-0038. SETTLE THE CHAPTER 13 PLAN, today, in full.
 *
 * The refusal is the bar's own words rather than "that did not work" —
 * "settling the plan costs 4,200 dollars; you have 900" tells the player
 * what to go and do about it.
 */
export function payOffBankruptcyPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const filing = openFilingOf(world, person.id)
  const bar = planPayoffBar(filing, moneyOnHand(world, person.id), world.tick)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'pay-off-plan', String(filing?.filedAtTick ?? 0))
  return payOffPlan(world, world.tick, person.id)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The court did not close the plan.' }
}


/**
 * Take something up, or give it up. The activities from the stats spec,
 * as habits rather than buttons.
 *
 * WHAT THIS DELIBERATELY IS NOT: a boost. Nothing here moves a stat on the
 * spot. Taking up training changes where the body is HEADING and the months
 * still have to happen; giving it up lets the target fall back and the body
 * follows it down. That is the line the spec draws — the player chooses to
 * invest, and the effect is modelled, gradual, caused and recorded.
 */
export function setHabit(
  world: World,
  kind: HabitKind,
  keep: boolean,
): { changed: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { changed: false, reason: 'Nobody is being played.' }
  const age = ageAt(person.birthTick, world.tick)
  if (age < STATS_FROM_AGE) {
    return { changed: false, reason: 'Too young for that to mean anything yet.' }
  }
  if (!keep) {
    if (!keepsHabit(world, person.id, kind)) return { changed: false, reason: 'Not something you do.' }
    dropHabit(world, person.id, kind)
    logVerb(world, 'habit', `${kind}:stop`)
    return { changed: true, reason: '' }
  }
  if (keepsHabit(world, person.id, kind)) {
    return { changed: false, reason: 'Already something you do.' }
  }
  // A BODY THAT IS BADLY HURT IS NOT TRAINED THROUGH (spec §2b). Study and
  // company are exactly what a person laid up CAN do, so only training is
  // gated on it.
  if (kind === 'training') {
    const health = world.health.get(person.id)
    if (health !== undefined && health.ailment !== null && health.severity >= 500) {
      return { changed: false, reason: 'Not while you are laid up like this.' }
    }
  }
  takeUpHabit(world, world.tick, person.id, kind)
  logVerb(world, 'habit', `${kind}:start`)
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'spending',
    significance: 'notable',
    inputs: [factor('own-choice', 1000)],
    chosen:
      kind === 'training'
        ? 'took up training'
        : kind === 'study'
          ? 'took up studying'
          : 'started making time for people',
    rejected: [],
    streamId: Stream.Health,
  })
  return { changed: true, reason: '' }
}

/**
 * See a doctor.
 *
 * The one activity that is NOT a habit — it is a visit, and the spec
 * describes it as one: "catches illness earlier, manages recovery; costs
 * money and time." So it costs money and it takes the edge off whatever is
 * wrong, which is what seeing somebody about it actually does.
 *
 * It cannot cure. The health system owns recovery and this only speeds it;
 * a visit that made an ailment vanish would be this module writing state it
 * does not own.
 */
export const DOCTOR_VISIT_COST = 12_000 as Money

export function seeADoctor(world: World): { seen: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { seen: false, reason: 'Nobody is being played.' }
  if (moneyOnHand(world, person.id) < DOCTOR_VISIT_COST) {
    return {
      seen: false,
      reason: `A visit is ${String(Math.round(DOCTOR_VISIT_COST / 100))} dollars and you do not have it.`,
    }
  }
  if (world.player.log.some((entry) => entry.kind === 'doctor' && world.tick - entry.tick < 6)) {
    return { seen: false, reason: 'You were seen recently. Give it a few months.' }
  }
  const health = world.health.get(person.id)
  if (health === undefined || health.ailment === null) {
    return { seen: false, reason: 'Nothing to be seen about.' }
  }

  debitPerson(world, person.id, DOCTOR_VISIT_COST)
  // A quarter off what is wrong. Real, bounded, and not a cure.
  world.health.set(person.id, {
    ...health,
    severity: Math.max(0, Math.floor(health.severity * 0.75)),
  })
  logVerb(world, 'doctor', String(health.severity))
  recordEvent(world, world.tick, {
    type: 'saw-a-doctor',
    subjectId: person.id,
    detail: String(DOCTOR_VISIT_COST),
  })
  return { seen: true, reason: '' }
}


/** Buy a specific home off the market. */
export function buyPropertyPlayer(
  world: World,
  propertyId: string,
  /**
   * CASH OR A MORTGAGE (owner, playing: "there isnt a way to buy the
   * house outright either... I had to take a mortgage out").
   *
   * `buyHome` has taken both since ADR-0035 and pays the whole price for
   * cash — the property path simply hardcoded 'mortgage' in three places
   * and never offered the choice. Defaulted here so every existing caller
   * keeps its meaning.
   */
  method: HomePurchaseMethod = 'mortgage',
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const property = world.properties.get(propertyId)
  if (!property) return { done: false, reason: 'No such address.' }
  const bar = homePurchaseBar(world, person.id, property.neighbourhoodPlaceId, method)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'buy-home', `${propertyId}:${method}`)
  return buyHome(world, world.tick, person.id, property.neighbourhoodPlaceId, method, propertyId)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The sale did not go through.' }
}

/** Pay a lump off a debt, or clear it outright. */
export function payDownPlayer(
  world: World,
  kind: LoanKind,
  cents: number,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = payDownBar(world, person.id, kind)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'pay-down', kind)
  return payDownLoan(world, world.tick, person.id, kind, cents as Money) > 0
    ? { done: true, reason: '' }
    : { done: false, reason: 'Nothing was paid.' }
}

/** Take a tenancy on a specific home. */
export function rentPropertyPlayer(world: World, propertyId: string): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null || person.householdId === null) {
    return { done: false, reason: 'Nobody is being played.' }
  }
  const bar = leaseBar(world, person.householdId, propertyId, moneyOnHand(world, person.id))
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'rent-home', propertyId)
  return signLease(world, world.tick, person.id, propertyId)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The landlord did not take it.' }
}

/** Sell the house you own. */
/**
 * LEAVE THE COURSE. The bar and the verb read the same function, so the
 * greyed button and the refusal can never disagree.
 */
/**
 * MARK A BALLOT. The bar and the verb read one function, so a greyed
 * button and a refusal cannot disagree.
 */
/**
 * STAND FOR OFFICE, and run the campaign. Each reads the engine's own
 * bar, so a greyed button and a refusal cannot disagree.
 */
/**
 * SUE FOR PEACE, as commander-in-chief. The other side has a say, which
 * is why this can fail and say so.
 */
export function seekPeacePlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = warPowerBar(world, person.id)
  if (bar !== null) return { done: false, reason: bar }
  const home = homeland(world)
  if (home === undefined) return { done: false, reason: 'There is no country to speak for.' }
  logVerb(world, 'seek-peace', '')
  return sueForPeace(world, world.tick, home.id)
    ? { done: true, reason: '' }
    : { done: false, reason: 'They are not ready to stop. Not yet.' }
}

export function setLeverPlayer(
  world: World,
  lever: string,
  value: number,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = leverBar(world, person.id, lever)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'set-lever', lever)
  return setLever(world, person.id, lever, value, world.tick)
    ? { done: true, reason: '' }
    : { done: false, reason: 'It already stands there.' }
}

export function standPlayer(world: World, officeId: string): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = candidacyBar(world, person.id, officeId, world.tick)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'stand', officeId)
  return declareCandidacy(world, person.id, officeId, world.tick)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The nomination did not go through.' }
}

export function campaignPlayer(
  world: World,
  officeId: string,
  action: CampaignAction,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  logVerb(world, 'campaign', action)
  if (campaign(world, person.id, officeId, action, world.tick)) return { done: true, reason: '' }
  return {
    done: false,
    reason:
      action === 'advertise'
        ? 'There is not enough in the war chest to buy anything worth having.'
        : 'There is no campaign to run.',
  }
}

export function votePlayer(
  world: World,
  officeId: string,
  forPersonId: number,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = voteBar(world, person.id, officeId, world.tick)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'vote', officeId)
  return castVote(world, person.id, officeId, forPersonId as never, world.tick)
    ? { done: true, reason: '' }
    : { done: false, reason: 'That name is not on this ballot.' }
}

export function dropOutPlayer(world: World): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  const bar = dropOutBar(world, person.id)
  if (bar !== null) return { done: false, reason: bar }
  logVerb(world, 'drop-out', '')
  return dropOut(world, world.tick, person.id)
    ? { done: true, reason: '' }
    : { done: false, reason: 'Nothing came of it.' }
}

export function sellHomePlayer(
  world: World,
  propertyId?: string,
): { done: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { done: false, reason: 'Nobody is being played.' }
  if (propertyId !== undefined) {
    const deed = world.properties.get(propertyId)
    if (deed === undefined) return { done: false, reason: 'No such address.' }
    if (deed.ownerId !== person.id) return { done: false, reason: 'That is not yours to sell.' }
  }
  logVerb(world, 'sell-home', propertyId ?? '')
  return sellHome(world, world.tick, person.id, propertyId)
    ? { done: true, reason: '' }
    : { done: false, reason: 'The sale did not go through.' }
}

export function requestEnlistment(world: World): { asked: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { asked: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { asked: false, reason: 'A decision is already waiting.' }

  const bar = enlistmentBar(world, person, world.tick)
  if (bar !== null) return { asked: false, reason: bar }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'walk-in-enlist',
    choice: 'asked',
  })
  world.player.nextDecisionId += 1

  askEntryPath(world, world.tick, person.id)
  return { asked: true, reason: '' }
}

/**
 * Ask for a school slot, now, from the Service tab. The door's state comes
 * from schoolOptionsFor; a slot still has to exist this cycle. One request
 * per half-year — the schoolhouse is not a vending machine.
 */
export function requestSchool(world: World, schoolId: string): { attended: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { attended: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { attended: false, reason: 'A decision is already waiting.' }
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return { attended: false, reason: 'Not serving.' }
  if (isCaptive(world, person.id)) return { attended: false, reason: 'Held prisoner. None of this is yours to ask for.' }
  if (world.tick - record.enlistedAtTick <= 2 + specialtyFor(world, record.specialtyId).schoolMonths) {
    return { attended: false, reason: 'Finish the pipeline first.' }
  }
  // A retrain restarts the pipeline for the NEW trade (P2).
  if (
    record.specialtyChangedAtTick !== null &&
    world.tick - record.specialtyChangedAtTick <= specialtyFor(world, record.specialtyId).schoolMonths
  ) {
    return { attended: false, reason: 'Finish the pipeline first.' }
  }
  const school = schoolFor(world, schoolId)
  if (!school) return { attended: false, reason: 'No such school.' }
  const option = schoolOptionsFor(world, person.id).find((o) => o.id === schoolId)
  if (!option) return { attended: false, reason: 'No such school.' }
  if (!option.open) return { attended: false, reason: option.reason }
  if (
    world.player.log.some((entry) => entry.kind === 'school-request' && world.tick - entry.tick < 6)
  ) {
    return { attended: false, reason: 'The schoolhouse answered this half-year already.' }
  }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'school-request',
    choice: schoolId,
  })
  world.player.nextDecisionId += 1

  // A SEAT IN THE NEXT CLASS, not an instant badge (owner spec). The
  // schoolhouse has a calendar: you are slotted in, you wait for the class
  // to start, you attend, and the badge is pinned on at graduation. The old
  // one-in-three draw is gone — the honest scarcity is SEATS, which
  // schoolOptionsFor already counts, and a full class is a reason a player
  // can see rather than a die they cannot.
  const classTick = option.nextClassTick
  world.service.set(person.id, {
    ...record,
    schoolId: school.id,
    schoolStartsAtTick: classTick,
  })
  recordEvent(world, world.tick, {
    type: 'took-a-seat',
    subjectId: person.id,
    detail: school.title,
  })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'training',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('ambition', person.traits.ambition)],
    chosen: `took a seat in the next ${school.title} class`,
    rejected: [],
    streamId: Stream.Employment,
  })

  const wait = classTick - world.tick
  return {
    attended: true,
    reason:
      wait <= 0
        ? `Class starts this month at ${school.title}.`
        : `You have a seat. ${school.title} starts in ${String(wait)} month${wait === 1 ? '' : 's'}.`,
  }
}

/**
 * A unit moment's pending carries "moment-id" or "moment-id:unit-id" in
 * occupationId, because PendingDecision has one string to spare and adding
 * a field to it would touch every save.
 */
function momentIdOf(occupationId: string | null | undefined): string {
  if (occupationId === null || occupationId === undefined) return ''
  const cut = occupationId.indexOf(':')
  return cut === -1 ? occupationId : occupationId.slice(0, cut)
}

function unitIdOf(occupationId: string | null | undefined): string {
  if (occupationId === null || occupationId === undefined) return ''
  const cut = occupationId.indexOf(':')
  return cut === -1 ? '' : occupationId.slice(cut + 1)
}

/**
 * Put in for a special unit's selection, from the Service tab. The gates
 * are stated in unitOptionsFor; selection itself can be failed, the failure
 * is on the record without shame, and the file allows two tries.
 */
export function tryOutForUnit(world: World, unitId: string): { joined: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { joined: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { joined: false, reason: 'A decision is already waiting.' }
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return { joined: false, reason: 'Not serving.' }
  if (isCaptive(world, person.id)) return { joined: false, reason: 'Held prisoner. None of this is yours to ask for.' }
  const unit = unitFor(world, unitId)
  if (!unit) return { joined: false, reason: 'No such unit.' }
  const option = unitOptionsFor(world, person.id).find((o) => o.id === unitId)
  if (!option) return { joined: false, reason: 'No such unit.' }
  if (!option.open) return { joined: false, reason: option.reason }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'unit-tryout',
    choice: unitId,
  })
  world.player.nextDecisionId += 1

  // SELECTION IS PLAYED, NOT ROLLED. It used to resolve the instant the
  // player asked for it, which made the hardest thing a soldier does a
  // silent coin flip. It is a cutscene now and the answer moves the odds,
  // but the roll below is the same roll off the same stream with the same
  // margin, so nothing about who passes has quietly changed.
  raisePending(world, {
    kind: 'unit-moment',
    tick: world.tick,
    personId: person.id,
    otherId: null,
    occupationId: `selection-day:${unit.id}`,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: [...SCENE_OPTIONS],
  })
  return { joined: false, reason: '' }
}

/**
 * Resolve a selection the player has just been through. `answer` is the
 * cutscene's spectrum: emptying the tank passes more often and costs a
 * body sometimes, pacing is the middle, nursing an injury rarely passes.
 */
function resolveSelectionDay(
  world: World,
  person: Person,
  unitId: string,
  answer: SceneChoice,
  tick: Tick,
): void {
  const record = world.service.get(person.id)
  const unit = unitFor(world, unitId)
  if (!record || !unit) return

  // SALTED BY ATTEMPT. The draw is keyed on the tick, and selection can be
  // re-entered the same month — so without this, a player who answered
  // 'cover' and failed could ask again immediately, answer 'push', and turn
  // the very same fixed roll into a free pass. The attempt count moves the
  // stream, so a second try is a second roll.
  const attempts = world.player.log.filter((entry) => entry.kind === 'unit-tryout').length
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 7333 + attempts * 101)
  const effort = answer === 'push' ? 120 : answer === 'hold' ? 0 : -140
  const margin = Math.max(10, Math.min(400, record.performance - unit.minPerformance + 60 + effort))
  const selected = rng.chance(margin, unit.selectionDenominator)

  // THE COURSE IS WHAT BEATS PEOPLE HERE, not an enemy: emptying the tank
  // can cost a body, and it goes down as the field accident it is.
  if (answer === 'push' && rng.chance(1, 7)) {
    const severity = 300 + rng.nextInt(0, 250)
    const wound = inflictWound(world, tick, person.id, severity, 'field-accident', rng)
    // ON THE RECORD, with its cause. This wound is service-connected and can
    // reach a pension decades later; Law 3 does not make an exception for the
    // ones that happen on a course instead of in a war.
    recordEvent(world, tick, {
      type: 'was-injured',
      subjectId: person.id,
      detail: `minor:${wound.description}`,
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'selection',
      significance: 'notable',
      inputs: [factor('own-choice', 1000), factor('unit-standard', unit.minPerformance)],
      chosen: `was hurt emptying the tank at ${unit.name} selection`,
      rejected: [],
      streamId: Stream.Employment,
    })
  }

  if (selected) {
    assignServiceUnit(world, person.id, unit.id)
    recordEvent(world, tick, { type: 'joined-unit', subjectId: person.id, detail: unit.id })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'selection',
      significance: 'defining',
      inputs: [factor('own-choice', 1000), factor('unit-standard', unit.minPerformance)],
      chosen: `selected for ${unit.name}`,
      rejected: [],
      streamId: Stream.Employment,
    })
    return
  }

  recordEvent(world, tick, { type: 'dropped-selection', subjectId: person.id, detail: unit.id })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'selection',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('unit-standard', unit.minPerformance)],
    chosen: `went to ${unit.name} selection; came back without it`,
    rejected: [],
    streamId: Stream.Employment,
  })
}

/**
 * Put in the work on your own body.
 *
 * WAS MILITARY-ONLY, AND IS NOT ANY MORE (owner: "civs should have civilian
 * stats and ways to work on them as well starting from age like 12"). This
 * refused anybody not serving, which made the body something the army gave
 * you and took away at discharge. A sixteen-year-old who runs every morning
 * arrives at the recruiting station fitter than one who does not, and a
 * veteran does not stop having a body the month the uniform comes off.
 *
 * The military fitness TEST is still the army's — annual, mandatory, and
 * nobody opts out. What this is, for everybody, is the training.
 */
export function trainFitness(world: World): { trained: boolean; score: number; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { trained: false, score: 0, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { trained: false, score: 0, reason: 'A decision is already waiting.' }
  const age = ageAt(person.birthTick, world.tick)
  if (age < STATS_FROM_AGE) {
    return { trained: false, score: 0, reason: 'Too young to be training like that.' }
  }
  if (isCaptive(world, person.id)) return { trained: false, score: 0, reason: 'Held prisoner. None of this is yours to ask for.' }
  // A BODY THAT IS ALREADY HURT IS NOT TRAINED THROUGH (spec §2b: "gated
  // out by a serious injury"). The health system owns the ailment; this
  // only reads it.
  const health = world.health.get(person.id)
  if (health !== undefined && health.ailment !== null && health.severity >= 500) {
    return { trained: false, score: fitnessOf(world, person.id), reason: 'Not while you are laid up like this.' }
  }
  if (world.player.log.some((entry) => entry.kind === 'fitness-test' && world.tick - entry.tick < 6)) {
    return {
      trained: false,
      score: fitnessOf(world, person.id),
      reason: 'The body needs the months between blocks of training.',
    }
  }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'fitness-test',
    choice: 'trained',
  })
  world.player.nextDecisionId += 1

  const score = Math.min(MAX_FITNESS_POINTS, fitnessOf(world, person.id) + 40)
  setFitness(world, person.id, score)
  recordEvent(world, world.tick, {
    type: 'completed-training',
    subjectId: person.id,
    detail: 'a block of fitness training',
  })
  return { trained: true, score, reason: '' }
}

/**
 * PUT IN THE WORK ON YOUR RECORD (owner, playing: "I have a 300 pt score and
 * I am still not meeting the bar... it was all the schoolhouses").
 *
 * THE BAR HAD NO PATH BEHIND IT. Every schoolhouse card carries a checklist
 * with "Standing meets the bar" on it, and standing was written by exactly
 * three things: graduating a school, finishing a deployment, and one
 * reporting-in moment that happens once. The first is CIRCULAR — standing is
 * what gets you into the school that raises standing — and the other two are
 * not choices. A player who read "✕ Standing meets the bar" had nothing to
 * do about it but wait, and waiting did not work either, because the drift
 * target was a birth trait.
 *
 * The seasoning term fixes the waiting. THIS is the doing: extra duty, the
 * detail nobody volunteers for, the range you run on a weekend. It is the
 * same shape as `trainFitness` because it is the same kind of act — months
 * of effort, a real gain, and a cooldown so it is a decision rather than a
 * button to hold down.
 *
 * IT COSTS SOMETHING REAL. The hours come out of a life, and wellbeing is
 * where a life keeps its score. A soldier who volunteers for everything is
 * well thought of and tired, which is true of every soldier who volunteers
 * for everything.
 */
const EXTRA_DUTY_GAIN = 30
const EXTRA_DUTY_COOLDOWN = 6

export function takeExtraDuty(world: World): { done: boolean; standing: number; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) {
    return { done: false, standing: 0, reason: 'Nobody is being played.' }
  }
  const bar = extraDutyBar(world)
  if (bar !== null) return { done: false, standing: 0, reason: bar }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'extra-duty',
    choice: 'volunteered',
  })
  world.player.nextDecisionId += 1

  boostServicePerformance(world, person.id, EXTRA_DUTY_GAIN)
  nudgeWellbeing(world, world.tick, person.id, -25, 'the extra duty')
  recordEvent(world, world.tick, {
    type: 'completed-training',
    subjectId: person.id,
    detail: 'extra duty nobody else volunteered for',
  })
  return {
    done: true,
    standing: world.service.get(person.id)?.performance ?? 0,
    reason: '',
  }
}

/**
 * Why the extra duty is not available, or null. The bar pattern: the greyed
 * button and the refusal come from one place, so they cannot disagree.
 */
export function extraDutyBar(world: World): string | null {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return 'Nobody is being played.'
  if (world.player.pending !== null) return 'A decision is already waiting.'
  const record = world.service.get(person.id)
  if (record === undefined || record.dischargedAtTick !== null) {
    return 'Only somebody serving can pick up extra duty.'
  }
  if (isCaptive(world, person.id)) return 'Held prisoner. None of this is yours to ask for.'
  if (record.schoolId !== null) return 'You are away at a course.'
  // A BODY THAT IS ALREADY HURT IS NOT WORKED THROUGH, the same rule the
  // fitness training keeps, and for the same reason.
  const health = world.health.get(person.id)
  if (health !== undefined && health.ailment !== null && health.severity >= 500) {
    return 'Not while you are laid up like this.'
  }
  if (
    world.player.log.some(
      (entry) => entry.kind === 'extra-duty' && world.tick - entry.tick < EXTRA_DUTY_COOLDOWN,
    )
  ) {
    return 'You have been carrying the extra load already. It has to be earned over months.'
  }
  return null
}

/**
 * Raise a hand for the rotation, on demand. Same machinery as the pending —
 * this is the button for the player who is not waiting to be asked.
 */
export function requestDeployment(world: World): { deployed: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { deployed: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { deployed: false, reason: 'A decision is already waiting.' }
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return { deployed: false, reason: 'Not serving.' }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind: 'volunteer-deploy',
    choice: 'walk-in',
  })
  world.player.nextDecisionId += 1

  if (volunteerForDeployment(world, world.tick, person.id)) {
    return { deployed: true, reason: '' }
  }
  // An ALLY's war comes before a quiet posting (M-ARMY2, owner: "I want
  // the option to be there as well so that we can get more combat if
  // wanted"). The Republic is not a belligerent; the soldier still goes.
  if (volunteerForSupport(world, world.tick, person.id)) {
    return { deployed: true, reason: '' }
  }
  // Between wars the list is still open — for the rotation (M-ARMY2). The
  // same button, the honest answer for the years the Republic is at peace.
  if (volunteerForRotation(world, world.tick, person.id)) {
    return { deployed: true, reason: '' }
  }
  const home = homeland(world)
  const atWar = home !== undefined && activeWars(world).some((w) => w.a === home.id || w.b === home.id)
  return {
    deployed: false,
    reason:
      atWar || rotationAvailable(world) || supportDeploymentAvailable(world)
        ? 'Not yet — finish the pipeline, or come home first.'
        : 'No war, and no ally taking people this season.',
  }
}

// ---------------------------------------------------------------------------
// P2 — the verbs. What the simulation already models, initiable. Every verb:
// gate honestly (refusal in words, nothing burned), log the ask (replay walks
// the same road), then resolve through the same shared function the automatic
// path uses. The player is still not special — only who starts it differs.
// ---------------------------------------------------------------------------

/** The shared guard every verb starts with. */
function verbPerson(world: World): { person: Person } | { reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { reason: 'A decision is already waiting.' }
  return { person }
}

/** Append a player input to the replay log. Exported for crime.ts, whose
 *  Record-tab verb is a player input like any other (C2 review). */
export function logVerb(world: World, kind: PendingKind, choice: string): void {
  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    // ADR-0033: whose life this choice belonged to.
    ...(world.player.personId !== null ? { personId: world.player.personId } : {}),
    tick: world.tick,
    kind,
    choice,
  })
  world.player.nextDecisionId += 1
}

/** Ask a close friend to court. The gates are the automatic path's, and the
 *  refusal names the one that closed the door. */
export function courtFriend(world: World, otherId: EntityId): { courting: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { courting: false, reason: guard.reason }
  const { person } = guard

  const bar = courtshipBar(world, person.id, otherId, world.tick)
  if (bar !== null) return { courting: false, reason: bar }

  logVerb(world, 'court-friend', String(otherId))
  const tie = relationshipBetween(world, person.id, otherId)
  if (!tie || tie.type !== 'friend') return { courting: false, reason: 'You are not friends.' } // unreachable past the bar
  promoteToCourting(world, world.tick, tie, [factor('own-choice', 1000)])
  return { courting: true, reason: '' }
}

/** Propose. Clearing considerMarriage's own bar IS the yes — the appetite
 *  roll is NPC timing, not consent, and the player does not also roll dice
 *  for an answer. */
export function propose(world: World): { married: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { married: false, reason: guard.reason }
  const { person } = guard

  const bar = proposalBar(world, person.id, world.tick)
  if (bar !== null) return { married: false, reason: bar }

  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return { married: false, reason: 'There is nobody to ask.' }
  const tie = relationshipBetween(world, person.id, partnerId)
  if (!tie) return { married: false, reason: 'There is nobody to ask.' }

  logVerb(world, 'proposal', String(partnerId))
  promoteToSpouse(world, world.tick, tie, [factor('own-choice', 1000)])
  return { married: true, reason: '' }
}

/** End the courtship. The sim finally gets its courtship-ended path. */
export function endCourtship(world: World): { ended: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { ended: false, reason: guard.reason }
  const { person } = guard

  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return { ended: false, reason: 'There is no courtship to end.' }
  const tie = relationshipBetween(world, person.id, partnerId)
  if (!tie || tie.type !== 'courting') return { ended: false, reason: 'There is no courtship to end.' }

  logVerb(world, 'courtship-end', String(partnerId))
  performCourtshipEnd(world, world.tick, tie, person.id, [factor('own-choice', 1000)])
  return { ended: true, reason: '' }
}

/** Walk out of the marriage. Allowed always — the record carries own-choice
 *  and whatever strain truthfully existed, nothing invented. */
export function walkOut(world: World): { separated: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { separated: false, reason: guard.reason }
  const { person } = guard

  const spouseId = spouseOf(world, person.id)
  if (spouseId === null) return { separated: false, reason: 'There is no marriage to leave.' }
  const tie = relationshipBetween(world, person.id, spouseId)
  if (!tie || tie.type !== 'spouse') return { separated: false, reason: 'There is no marriage to leave.' }

  logVerb(world, 'walk-out', String(spouseId))
  performSeparation(world, world.tick, tie, [factor('own-choice', 1000)])
  return { separated: true, reason: '' }
}

/** Make time for the marriage: a smaller mend than the brink's reconcile,
 *  quarterly at most — showing up is not a slider to hold down. */
export function tendTheMarriage(world: World): { tended: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { tended: false, reason: guard.reason }
  const { person } = guard

  const spouseId = spouseOf(world, person.id)
  if (spouseId === null) return { tended: false, reason: 'There is no marriage to tend.' }
  const tie = relationshipBetween(world, person.id, spouseId)
  if (!tie || tie.type !== 'spouse') return { tended: false, reason: 'There is no marriage to tend.' }
  if (world.player.log.some((entry) => entry.kind === 'marriage-tend' && world.tick - entry.tick < 3)) {
    return { tended: false, reason: 'You have been making the time already. Let the weeks do their part.' }
  }

  logVerb(world, 'marriage-tend', String(spouseId))
  tendMarriage(world, world.tick, tie)
  return { tended: true, reason: '' }
}

/** An afternoon with a friend. One social call a month — there is a life to
 *  live around it. */
export function spendTimeWith(world: World, otherId: EntityId): { spent: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { spent: false, reason: guard.reason }
  const { person } = guard

  const tie = relationshipBetween(world, person.id, otherId)
  if (!tie || tie.type !== 'friend') return { spent: false, reason: 'You are not friends.' }
  if (world.player.log.some((entry) => entry.kind === 'social-call' && entry.tick === world.tick)) {
    return { spent: false, reason: 'The month has had its visiting.' }
  }

  logVerb(world, 'social-call', String(otherId))
  strengthenFriendship(world, world.tick, tie, person.id)
  return { spent: true, reason: '' }
}

/**
 * Try for a child. The gates are birthEligible's, in words; conception stays
 * the model's own draw — trying opens the month, it does not buy the answer.
 * A quiet "not this month" is all anyone is owed: latent fertility is a
 * hidden fact of the world and stays hidden here.
 */
export function tryForChild(world: World): { conceived: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { conceived: false, reason: guard.reason }
  const { person } = guard

  const bar = birthBar(world, world.tick, person)
  if (bar !== null) return { conceived: false, reason: bar }
  if (world.player.log.some((entry) => entry.kind === 'child-try' && entry.tick === world.tick)) {
    return { conceived: false, reason: 'The month has one answer, and it was given.' }
  }

  const partnerId = partnerOf(world, person.id)
  if (partnerId === null) return { conceived: false, reason: 'There is nobody to try with.' }
  const partner = world.people.get(partnerId)
  if (!partner) return { conceived: false, reason: 'There is nobody to try with.' }
  const mother = person.sex === 'female' ? person : partner
  const father = person.sex === 'female' ? partner : person

  // A birth already happened this month — the auto path's, or an accepted
  // child question. Without this guard the verb re-keys deliverChild's
  // (mother, tick) streams and delivers the SAME child twice: same name,
  // same sex, two ids (architecture review M2).
  if (
    world.events.some(
      (e) =>
        e.type === 'had-child' &&
        e.tick === world.tick &&
        (e.subjectId === mother.id || e.subjectId === father.id),
    )
  ) {
    return { conceived: false, reason: 'The month has its answer already.' }
  }

  logVerb(world, 'child-try', String(partnerId))

  // The same monthly chance runBirths computes for this couple — the verb's
  // own salt, so the ask is a second real try, not a replay of the tick's.
  const chance = monthlyConceptionChance(world, world.tick, mother, father.id)
  const rng = openStream(world.seed, Stream.LifeEventTiming, mother.id, world.tick + 3333)
  if (chance <= 0 || !rng.chanceInTenThousand(chance)) {
    return { conceived: false, reason: 'Not this month.' }
  }

  const childId = deliverChild(world, world.tick, mother.id, father.id)
  if (childId === null) return { conceived: false, reason: 'Not this month.' }
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'household-formation',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('wanted-family', 800)],
    chosen: 'tried for a child, and the child came',
    rejected: [],
    streamId: Stream.LifeEventTiming,
  })
  return { conceived: true, reason: '' }
}

/** Quit the job. No roll — the door opens from the inside. */
export function quitJob(world: World): { quit: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { quit: false, reason: guard.reason }
  const { person } = guard

  if (!world.employment.has(person.id)) return { quit: false, reason: 'There is no job to quit.' }

  logVerb(world, 'job-quit', 'quit')
  performQuit(world, world.tick, person, [factor('own-choice', 1000)])
  return { quit: true, reason: '' }
}

/**
 * Ask for a raise. The asking is on the record; the answer rolls against the
 * performance the reviews actually read, and the raise that comes is the
 * review formula's own — asking moves the timing, never the arithmetic.
 */
export function askForRaise(world: World): { raised: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { raised: false, reason: guard.reason }
  const { person } = guard

  const job = world.employment.get(person.id)
  if (!job) return { raised: false, reason: 'There is no employer to ask.' }
  if (world.player.log.some((entry) => entry.kind === 'raise-request' && world.tick - entry.tick < 6)) {
    return { raised: false, reason: 'The question was asked this half-year already.' }
  }

  // Topped-out pay is knowable before asking — a gate, not a roll, so it
  // must not burn the half-year (review N5).
  const occupation = occupationById(job.occupationId)
  const headroom = occupation.maxMonthlyPay - job.monthlyPay
  if (headroom <= 0) {
    return { raised: false, reason: `${occupation.title} pay tops out where yours already is.` }
  }

  logVerb(world, 'raise-request', job.occupationId)
  if (job.performance < 350) {
    recordEvent(world, world.tick, { type: 'turned-down', subjectId: person.id, detail: 'a raise' })
    return { raised: false, reason: 'The work this year does not argue for it. The asking is on the record.' }
  }

  const rng = openStream(world.seed, Stream.Employment, person.id, world.tick + 6111)
  if (!rng.chance(job.performance - 250, 1_200)) {
    recordEvent(world, world.tick, { type: 'turned-down', subjectId: person.id, detail: 'a raise' })
    return { raised: false, reason: 'Not this year, the foreman says. The asking is on the record.' }
  }

  const raise = Math.floor((headroom * job.performance) / 6500)
  if (raise < Math.floor(job.monthlyPay / 100)) {
    return { raised: false, reason: 'The sums left in this trade are too small to move.' }
  }
  grantRaise(world, world.tick, person.id, (job.monthlyPay + raise) as Money)
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('strong-performance', job.performance)],
    chosen: 'asked for a raise, and got it',
    rejected: [],
    streamId: Stream.Employment,
  })
  return { raised: true, reason: '' }
}

/** Go back to school, 18–24 — the same window the town's own young adults
 *  keep, closed to the player until now by their first answer. */
export function requestEnrolment(
  world: World,
  level: 'college' | 'trade',
): { enrolled: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { enrolled: false, reason: guard.reason }
  const { person } = guard

  const bar = enrolmentBar(world, person, world.tick)
  if (bar !== null) return { enrolled: false, reason: bar }

  logVerb(world, 're-enrolment', level)
  enrolPlayer(world, world.tick, person, level)
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'employment-change',
    significance: 'major',
    inputs: [factor('own-choice', 1000)],
    chosen: level === 'college' ? 'went back for college' : 'went back for trade school',
    rejected: ['to keep on as things were'],
    streamId: Stream.Education,
  })
  return { enrolled: true, reason: '' }
}

/** Set the household's spending posture. A standing choice, not a lever to
 *  wiggle — one change a month. */
export function chooseSpendStance(
  world: World,
  stance: 'thrifty' | 'loose' | null,
): { set: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { set: false, reason: guard.reason }
  const { person } = guard

  if (person.householdId === null) return { set: false, reason: 'There is no household to steer.' }
  const household = world.households.get(person.householdId)
  if (!household) return { set: false, reason: 'There is no household to steer.' }
  // A CHILD does not set a posture; a grown adult does, even under their
  // parents' roof.
  //
  // This used to bar anybody living with a parent, which was right when a
  // household was the only economic unit and wrong the moment it stopped
  // being one (owner: "why would my parents control my spending when I'm a
  // grown man after 18"). Their money is their own now; so is the decision
  // about how they carry it.
  if (ageAt(person.birthTick, world.tick) < 18) {
    return { set: false, reason: "The purse is your parents' to carry." }
  }
  // M-MONEY2. THEIR OWN POSTURE, not the roof's. A grown adult sets how
  // they carry their money; their parents do not set it for them.
  if (person.spendStance === stance) {
    return { set: false, reason: 'That is already how the money is carried.' }
  }
  if (world.player.log.some((entry) => entry.kind === 'spend-stance' && entry.tick === world.tick)) {
    return { set: false, reason: 'The purse was already settled this month.' }
  }

  logVerb(world, 'spend-stance', stance ?? 'as-it-comes')
  setSpendStance(world, world.tick, person.id, stance)
  return { set: true, reason: '' }
}

/** Look for a place on a chosen street. The affordability rule is the same
 *  one every move obeys; the whole household comes along. */
/**
 * Why this household cannot go looking at that street — or null if it can.
 *
 * P3 review: the Streets browser modelled ONE of this verb's four gates and
 * claimed in a comment to model them all, so a nineteen-year-old still at
 * home saw live buttons on every affordable street and was refused by every
 * one. The bar pattern (proposalBar, courtshipBar, enrolmentBar) exists to
 * stop exactly that, and lookForPlace now answers from this function, so the
 * disabled state and the refusal are the same sentence by construction.
 */
export function moveBar(
  world: World,
  personId: EntityId,
  placeId: EntityId,
  tick: Tick,
): string | null {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 'There is nobody to move.'
  if (ageAt(person.birthTick, tick) < 18) return 'Not yet eighteen.'
  if (person.householdId === null) return 'There is no household to move.'
  const household = world.households.get(person.householdId)
  if (!household) return 'There is no household to move.'
  // Living with the parents means it is THEIR house to move (review S4);
  // the way out of it is the move-out moment, not this verb.
  if (person.parentIds.some((id) => household.memberIds.includes(id))) {
    return "Your parents' house is not yours to move."
  }
  const target = world.places.get(placeId)
  if (!target || target.kind !== 'neighbourhood') return 'No such street.'
  if (target.id === household.placeId) return 'You already live there.'
  if (world.player.log.some((entry) => entry.kind === 'house-hunt' && tick - entry.tick < 6)) {
    return 'The household moved house this half-year already. Let it settle.'
  }
  if (!canAfford(householdIncome(world, household), target.desirability)) {
    return `Rent on ${target.name} is ${formatMoney(rentFor(target.desirability))} a month — the household cannot carry it.`
  }
  return null
}

/**
 * The homeland, named. W1 (resistance 6): every one of these sentences used
 * to have "the Republic" typed into it, which is a preset's content sitting
 * inside engine prose. The nation object has carried the name since L4-M1.
 */
function homelandName(world: World): string {
  return homeland(world)?.name ?? 'the homeland'
}

export function lookForPlace(world: World, placeId: EntityId): { moved: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { moved: false, reason: guard.reason }
  const { person } = guard

  const bar = moveBar(world, person.id, placeId, world.tick)
  if (bar !== null) return { moved: false, reason: bar }

  logVerb(world, 'house-hunt', String(placeId))
  moveHouse(world, world.tick, person, placeId, [factor('own-choice', 1000)])
  return { moved: true, reason: '' }
}

/** Choose how to carry an ailment, month by month — the convalesce question,
 *  repeatable while anything ails. */
export function setConvalescenceStance(
  world: World,
  rest: boolean,
): { set: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { set: false, reason: guard.reason }
  const { person } = guard

  const record = world.health.get(person.id)
  if (!record || record.ailment === null) return { set: false, reason: 'Nothing ails you.' }
  if (world.player.log.some((entry) => entry.kind === 'convalesce-stance' && entry.tick === world.tick)) {
    return { set: false, reason: 'The month is already being carried one way.' }
  }

  logVerb(world, 'convalesce-stance', rest ? 'rest' : 'push-on')
  applyConvalescenceChoice(world, world.tick, person, rest)
  return { set: true, reason: '' }
}

/** Ask to leave the service. The honest answer is nearly always no — that is
 *  what a term IS — and the refusal says exactly why and until when. */
export function requestDischarge(world: World): { discharged: boolean; reason: string } {
  const guard = verbPerson(world)
  if ('reason' in guard) return { discharged: false, reason: guard.reason }
  const { person } = guard

  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return { discharged: false, reason: 'Not serving.' }
  const away = currentDeployment(world, person.id)
  if (away !== undefined) {
    return {
      discharged: false,
      reason:
        away.kind === 'rotation'
          ? 'Not from an overseas posting. Finish the rotation, then ask.'
          : 'Not from a theatre. The boat home comes first, then the question.',
    }
  }
  if (record.termMonthsLeft > 0) {
    const months = record.termMonthsLeft
    return {
      discharged: false,
      reason: `The term runs another ${String(months)} month${months === 1 ? '' : 's'}. ${sentenceCase(homelandName(world))} holds you to it; the question comes with the term's end.`,
    }
  }
  return {
    discharged: false,
    reason: 'The term is up this month — the reenlistment question is the door out.',
  }
}

/**
 * The convalesce choice, shared by the pending's resolution and the P2
 * stance verb: same effect, same event, same record.
 */
function applyConvalescenceChoice(world: World, tick: PendingDecision['tick'], person: Person, rest: boolean): void {
  applyConvalescence(world, tick, person.id, rest)
  recordEvent(world, tick, {
    type: 'convalesced',
    subjectId: person.id,
    detail: rest ? 'rest' : 'push-on',
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'convalescence',
    significance: 'notable',
    inputs: [
      factor('own-choice', 1000),
      factor('frailty', world.health.get(person.id)?.severity ?? 500),
    ],
    chosen: rest ? 'took time to heal' : 'worked through it',
    rejected: [rest ? 'to push on' : 'to rest'],
    streamId: Stream.Health,
  })
}

/**
 * The combat-moment's shared casualty resolution: the same shape as the
 * automatic resolver — severity, the SAME fatal tail, evacuation when
 * serious, the same posthumous recognition — so a moment month is never a
 * discount on the war (review: the player's death rate must not fall just
 * because a question was asked).
 */
/**
 * Cut a volunteer's orders and put them in front of the player. Returns
 * false when there is no war to volunteer for, in which case nothing was
 * promised and nothing is owed.
 */
function askToAcknowledgeOrders(world: World, tick: Tick, personId: EntityId): boolean {
  const home = homeland(world)
  if (!home) return false
  const war = activeWars(world).find((w) => w.a === home.id || w.b === home.id)
  if (!war) return false
  // DO NOT CUT ORDERS THE ARMY WOULD REFUSE. The volunteer question can be
  // offered inside the retrain window, where the trade school is not
  // finished — and then the sheet appeared, the player acknowledged it, and
  // volunteerForDeployment quietly declined. Nothing happened, and nothing
  // said why. Ask the same door the answer will use, before showing paper.
  if (!canVolunteerForDeployment(world, tick, personId)) return false
  const enemyId = war.a === home.id ? war.b : war.a
  const enemy = world.nations.get(enemyId)
  // A VOLUNTEER'S RECORD SAYS SO. Same event type — a set of orders is a
  // set of orders — but the detail carries whose idea it was, because the
  // timeline is the only place a reader can tell them apart.
  recordEvent(world, tick, {
    type: 'received-orders',
    subjectId: personId,
    otherId: enemyId,
    detail:
      enemy === undefined
        ? 'the front, at their own request'
        : `the ${bareName(enemy.name)} front, at their own request`,
  })
  return raisePending(world, {
    tick,
    kind: 'deployment-order',
    personId,
    otherId: enemyId,
    occupationId: 'voluntary',
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: ['go'],
  })
}

function resolveMomentCasualty(
  world: World,
  tick: PendingDecision['tick'],
  person: Person,
  enemyId: EntityId | null,
  rng: ReturnType<typeof openStream>,
  gatePerMille: number,
  severityFloor: number,
): void {
  if (!rng.chance(gatePerMille, 1_000)) return
  const severity = rng.nextBellInt(severityFloor, 1000)
  const enemy = enemyId === null ? undefined : world.nations.get(enemyId)
  const enemyName = enemy?.name ?? 'the enemy'

  // AND THE PLAYER'S OWN SCENES WERE THE SAFEST PLACE IN THE WAR. A moment
  // needed 940 on a curve that mostly lands well below it, so the one path
  // the player actually watches was the least lethal thing in the game
  // while NPCs died at 720. A scene the player answers should cost what
  // anybody else's month costs.
  if (severity >= 880 && rng.chance(2, 5)) {
    const deployment = currentDeployment(world, person.id)
    const monthsIn = deployment === undefined ? 0 : tick - deployment.startedAtTick
    performDeath(
      world, tick, person, 'wounds taken in action',
      [factor('own-choice', 1000), factor('battlefield-chaos', severity)],
      Stream.CombatResolution,
    )
    evacuateHome(world, tick, person.id)
    for (let i = world.events.length - 1; i >= 0; i--) {
      const died = world.events[i]
      if (!died || died.type !== 'died' || died.subjectId !== person.id) continue
      grantWoundRecognition(world, tick, person.id, died, enemyName)
      grantCampaignMedal(
        world, tick, person.id, died, enemyName, monthsIn, true,
      )
      break
    }
    return
  }

  const wound = inflictWound(world, tick, person.id, severity, 'direct-combat', rng)
  const woundEvent = recordEvent(world, tick, {
    type: 'wounded-in-action',
    subjectId: person.id,
    ...(enemyId !== null ? { otherId: enemyId } : {}),
    detail: `${severity >= 600 ? 'serious' : 'minor'}:${wound.description}`,
  })
  grantWoundRecognition(world, tick, person.id, woundEvent, enemyName)
  // NOTE: field aid for a combat-moment wound cannot be raised here — the
  // moment's own pending is still held until resolvePending commits, so
  // the ask would be silently refused (review S7 found this comment
  // claiming otherwise). resolvePending raises it after the commit; the
  // evacuation is what happens here.
  if (severity >= 600) evacuateHome(world, tick, person.id)
}

/**
 * Called by systems at a player choice point. Halts the clock. Returns
 * whether the question actually LANDED — one question at a time, and a
 * caller holding a one-shot flag (convalesce's asked bit, a term's last
 * month) must not burn it on a question nobody saw (P1: no silent loss).
 * Most moments need no guard: their conditions persist and the site
 * re-fires on a later month's roll.
 */
/**
 * HOW LONG A "NO" LASTS, in months, by question.
 *
 * Not every question should stick. A job offer is about a SPECIFIC job
 * and the next one is a different opportunity; a moment at work or school
 * is an event that happened, not an invitation. These are the ones where
 * the question is "do you want this KIND of thing in your life", and
 * where being asked again next month makes the refusal meaningless.
 *
 * BALANCE NUMBERS. Long enough that a no is respected, short enough that
 * a life can change its mind — a couple who did not want a child at
 * twenty-two are allowed to want one at twenty-four.
 */
const DECLINE_COOLDOWN: Readonly<Record<string, number>> = {
  courtship: 24,
  child: 18,
  marriage: 24,
  'move-house': 12,
  'move-out': 12,
}

/** Answers that mean "no", across the various button sets. */
const REFUSALS: ReadonlySet<string> = new Set(['decline', 'no', 'refuse', 'stay', 'wait-longer'])

export function raisePending(
  world: World,
  spec: Omit<PendingDecision, 'id'>,
): boolean {
  if (world.player.pending !== null) return false // one question at a time
  // AND NOTHING AT ALL REACHES A PRISONER. A man held by a hostile force is
  // not weighing a job offer, not moving house, not being asked whether to
  // rest or push on. Every one of those questions could reach him before
  // this, because each raise site knew about its own subject and none knew
  // about captivity.
  //
  // The guard is here rather than at the sites because there are fifteen of
  // them and there will be more. Callers holding a one-shot flag are safe:
  // this returns false, which is the same contract as a question that could
  // not land because another one was already up.
  if (spec.personId === world.player.personId && isCaptive(world, spec.personId)) return false
  // A REFUSAL LASTS. Same reasoning as the captivity guard above: the
  // check belongs here rather than at the raise sites, because there are
  // fifteen of them and each one only knows about itself.
  const cooldown = DECLINE_COOLDOWN[spec.kind] ?? 0
  if (cooldown > 0) {
    const declined = world.player.declinedAtTick?.[spec.kind]
    if (declined !== undefined && spec.tick - declined < cooldown) return false
  }
  world.player.pending = { ...spec, id: world.player.nextDecisionId }
  world.player.nextDecisionId += 1
  return true
}

/** True while the world is halted awaiting the player. */
export function awaitingPlayer(world: World): boolean {
  return world.player.pending !== null
}

/**
 * Answer the pending decision. Applies the effect through the same code the
 * automatic path uses, records the choice in the log, and releases the clock.
 *
 * Every applied effect writes a causal record whose first factor is
 * 'own-choice' — so a life story honestly distinguishes "chose to" from
 * "the circumstances decided" (Law 3).
 */
export function resolvePending(world: World, choice: string): void {
  const pending = world.player.pending
  if (!pending) throw new Error('No decision is pending')
  // Carries the trial's next scene out of the switch below, so it can be
  // raised after commit() with the pending slot free.
  let trialNext: string | null = null
  let trialOpens: { offence: Offence; taken: number } | null = null
  let contractNext: {
    kind: 'reenlist-term' | 'reenlist-option' | 'service-contract'
    state: string
  } | null = null
  // ADR-0034. THE OFFER SLEPT ON, re-raised after commit for the usual
  // reason: raisePending refuses while this pending still holds the slot.
  let offerAgain: PendingDecision | null = null
  // M-ENLIST §5c. THE COMMISSION, carried out of the switch for the same
  // reason as everything else here: enlistPerson can raise the contract,
  // and a raise while this pending still holds the slot is refused.
  let officerNext: {
    role: OfficerRole
    branch: ServiceBranchSpec
    assignment: { wasFirstChoice: boolean; reason: string }
    aptitude: number
  } | null = null
  // M-CAREER §4. The OFFER, carried out of the switch below for the same
  // reason everything else here is: raisePending refuses while the answered
  // interview still holds the slot, so a job won in the room would vanish.
  let offerNext: {
    occupationId: string
    workplaceId: EntityId
    pay: Money
  } | null = null
  // The crime, run after commit() so the courthouse it may open can land.
  let crimeNext: {
    offenceId: string
    danger: CrimeDanger
    variant: number
    choice: CrimeChoice
  } | null = null
  if (!pending.options.includes(choice)) {
    throw new Error(`"${choice}" is not one of: ${pending.options.join(', ')}`)
  }

  const person = world.people.get(pending.personId)
  if (!person || person.deathTick !== null) {
    // The person died in the same tick the question was raised. The question
    // is moot; log the answer so replay stays exact, and move on.
    commit(world, pending, choice)
    return
  }

  switch (pending.kind) {
    case 'education': {
      if (choice === 'college' || choice === 'trade') {
        enrolPlayer(world, pending.tick, person, choice)
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'employment-change',
          significance: 'major',
          inputs: [factor('own-choice', 1000), factor('reached-adulthood', 400)],
          chosen: choice === 'college' ? 'went to college' : 'entered trade school',
          rejected: choice === 'college' ? ['trade school', 'going straight to work'] : ['college', 'going straight to work'],
          streamId: Stream.Education,
        })
      }
      // 'work' needs no action — the employment system will offer jobs.
      // 'enlist' is applied by the follow-up specialty question below.
      break
    }

    case 'job-offer': {
      // ADR-0034. WAITING KEEPS IT ALIVE, for a while. The offer is
      // re-raised after commit — the trap this file has fallen into seven
      // times — and lapses once the employer has waited long enough.
      if (choice === 'wait') {
        if (waitsOnOffer(world, person.id) < OFFER_WAITS_ALLOWED) {
          offerAgain = pending
        }
        break
      }
      if (choice === 'accept' && pending.occupationId && pending.workplaceId !== null && pending.monthlyPay !== null) {
        const occupation = occupationById(pending.occupationId)
        hirePerson(world, pending.tick, person, occupation, pending.workplaceId, pending.monthlyPay, [
          factor('own-choice', 1000),
          factor('higher-pay', Math.floor(pending.monthlyPay / 1000)),
        ])
      }
      break
    }

    case 'move-out': {
      // P2: 'accept' is the engine's pick; 'to-<placeId>' any other street
      // from the (deterministic) candidate list the pending carried.
      const destination =
        choice === 'accept'
          ? pending.placeId
          : choice.startsWith('to-')
            ? (Number(choice.slice(3)) as EntityId)
            : null
      if (destination !== null) {
        performMoveOut(world, pending.tick, person, destination, [factor('own-choice', 1000)])
      }
      break
    }

    case 'courtship': {
      if (choice === 'accept' && pending.otherId !== null) {
        const tie = relationshipBetween(world, person.id, pending.otherId)
        if (tie && tie.type === 'friend') {
          promoteToCourting(world, pending.tick, tie, [factor('own-choice', 1000)])
        }
      }
      break
    }

    case 'marriage': {
      if (choice === 'accept' && pending.otherId !== null) {
        const tie = relationshipBetween(world, person.id, pending.otherId)
        if (tie && tie.type === 'courting') {
          promoteToSpouse(world, pending.tick, tie, [factor('own-choice', 1000)])
        }
      }
      break
    }

    case 'child': {
      if (choice === 'accept' && pending.otherId !== null) {
        // deliverChild expects the mother first; the player may be either parent.
        const other = world.people.get(pending.otherId)
        if (other) {
          const motherId = person.sex === 'female' ? person.id : pending.otherId
          const fatherId = person.sex === 'female' ? pending.otherId : person.id
          void other
          deliverChild(world, pending.tick, motherId, fatherId)
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'household-formation',
            significance: 'defining',
            inputs: [factor('own-choice', 1000), factor('wanted-family', 800)],
            chosen: 'grew the family',
            rejected: ['not yet'],
            streamId: Stream.LifeEventTiming,
          })
        }
      }
      break
    }

    case 'move-house': {
      const destination =
        choice === 'accept'
          ? pending.placeId
          : choice.startsWith('to-')
            ? (Number(choice.slice(3)) as EntityId)
            : null
      if (destination !== null) {
        moveHouse(world, pending.tick, person, destination, [factor('own-choice', 1000)])
      }
      break
    }

    case 'retirement': {
      if (choice === 'retire') {
        retirePerson(world, pending.tick, person, [
          factor('own-choice', 1000),
          factor('old-age', 500),
        ])
      }
      // 'keep-working' needs no action; the question returns next birthday.
      break
    }

    case 'separation': {
      const tie =
        pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie && tie.type === 'spouse') {
        if (choice === 'separate') {
          performSeparation(world, pending.tick, tie, [factor('own-choice', 1000)])
        } else {
          reconcile(world, pending.tick, tie)
        }
      }
      break
    }

    case 'convalesce': {
      // Shared with the P2 stance verb: same effect, same event, same record.
      applyConvalescenceChoice(world, pending.tick, person, choice === 'rest')
      break
    }

    case 'enlist': {
      // Accepting the door does not put on the uniform yet: the SPECIALTY
      // choice follows, raised after this one commits (see below).
      break
    }

    case 'crime-scene': {
      // THE ANSWER IS WHAT DOES IT. Nothing has moved yet — no money, no
      // record, no courthouse.
      //
      // DEFERRED PAST commit(), because the crime can end at the courthouse
      // and the courthouse is another pending: running it here would have
      // raisePending refuse while this answered scene still holds the slot,
      // and the arrest would vanish. The same trap the trial, the contract
      // chain and the separation sheet each fell into.
      const state = decodeCrimeScene(pending.occupationId)
      if (offenceById(state.offenceId) !== undefined) {
        crimeNext = {
          offenceId: state.offenceId,
          danger: state.danger,
          variant: state.variant,
          choice: choice === 'press' || choice === 'cool' ? choice : 'bail',
        }
      }
      break
    }

    case 'interview': {
      // M-CAREER §4. The room's answer. The roll happens HERE, not when the
      // button was pressed — how they played it is part of the odds.
      const state = decodeInterview(pending.occupationId)
      const approach: InterviewApproach =
        choice === 'sell' || choice === 'keen' ? choice : 'straight'
      const result = resolveInterview(
        world,
        pending.tick,
        person,
        state.occupationId,
        approach,
        state.variant,
      )
      if (result.hired && result.workplaceId !== null) {
        offerNext = {
          occupationId: state.occupationId,
          workplaceId: result.workplaceId,
          pay: result.pay,
        }
      }
      break
    }

    case 'school-moment': {
      // The parity rule again: a played childhood and a simulated one run
      // through one function, so being the player is never a discount.
      const state = decodeSchoolMoment(pending.occupationId)
      applySchoolMoment(
        world,
        pending.tick,
        person.id,
        state.momentId,
        choice === 'reach' || choice === 'steady' ? choice : 'duck',
        state.variant,
      )
      break
    }

    case 'work-moment': {
      // M-CAREER §3. The answer runs through the same function an NPC's
      // does — the parity rule, and the reason a moment cannot be a
      // discount for being played.
      const state = decodeWorkMoment(pending.occupationId)
      applyWorkMoment(
        world,
        pending.tick,
        person.id,
        state.momentId,
        choice === 'lead' || choice === 'steady' ? choice : 'pass',
        state.variant,
      )
      break
    }

    case 'promotion-offer': {
      // M-CAREER §2. The civilian promotion board's answer. Declining is a
      // real answer with a real cost — the rung stays where it is and the
      // clock on it starts again — because a career is a series of choices
      // about how much of your life the job gets.
      if (choice === 'accept' && pending.occupationId !== null) {
        promoteTo(world, pending.tick, person.id, pending.occupationId)
      }
      break
    }

    case 'bankruptcy': {
      // M-SAFETY §2. Which chapter, where more than one is open. The court
      // is not being asked whether — the household is insolvent either way
      // — it is being asked how, and the two roads are genuinely different:
      // a plan keeps the home and takes years, a liquidation is a fresh
      // start at zero that costs everything not exempt.
      if (choice === 'ride-it-out') {
        // NOT YET. Nothing is filed, nothing is discharged, and the hole
        // goes on getting deeper — which is the honest consequence and the
        // reason this is a real choice rather than a softer wording of the
        // same outcome.
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'spending',
          significance: 'major',
          inputs: [factor('own-choice', 1000)],
          chosen: 'to keep trading rather than file',
          rejected: ['a petition in bankruptcy'],
          streamId: Stream.Economy,
        })
        break
      }
      fileBankruptcy(world, pending.tick, person.id, choice === 'chapter-7' ? 7 : 13)
      break
    }

    case 'money-shock': {
      // §8. The bill happens either way; what the player chooses is whether
      // it comes out of what they have or is carried as debt.
      applyMoneyShock(
        world,
        pending.tick,
        person.id,
        pending.occupationId ?? 'medical',
        (pending.monthlyPay ?? 0) as Money,
        choice === 'pay-over-time',
      )
      break
    }

    case 'commission': {
      // Answered by the branch question raised behind it — nothing is
      // written until the job is chosen, because a record needs all of it.
      break
    }

    case 'branch-choice':
      // M-ENLIST §1. The service is remembered on the next pending rather
      // than written down: there is no record to write it to yet.
      break

    case 'entry-test':
      // A gate, not a decision. The score is a pure function of the seed
      // and the person, so nothing has to be carried out of here.
      break

    case 'officer-preference': {
      // M-ENLIST §5c. WHAT THEY ASKED FOR, and what the service does with
      // it. The assignment happens here because this is the answer; the
      // record is written by commissionPerson below.
      const branchId = pending.occupationId ?? ''
      const branch = world.spec.branches.find((b) => b.id === branchId)
      const aptitude = world.service.get(person.id)?.aptitude ?? entryTestScore(world, person.id)
      if (branch) {
        // Their pick first, then the rest of the list in its own order —
        // "ranked preferences" without making the player drag rows about.
        const preferences = [choice, ...(pending.options ?? []).filter((id) => id !== choice)]
        const assignment = assignOfficerRole(
          world,
          person.id,
          branch,
          OFFICER_ROLES,
          preferences,
          aptitude,
        )
        if (assignment.role) {
          officerNext = { role: assignment.role, branch, assignment, aptitude }
        }
      }
      break
    }

    case 'article15': {
      // ADR-0037. SIGNING IS NOT AGREEING. Nonjudicial punishment is
      // imposed by the commander — the stripe is already gone by the time
      // this paper reaches the player, exactly as the module's own rule
      // says the punishments are never a choice. Acknowledging closes it.
      break
    }

    case 'separation-record': {
      // The record already closed; this is the out-processing. The
      // retirement certificate, where the years earned one, is raised after
      // commit like every other follow-up.
      break
    }

    case 'retirement-certificate':
      break

    case 'specialty': {
      const specialty = world.spec.specialties.find((sp) => sp.id === choice)
      if (specialty) {
        // The circumstances an NPC's record names, on the player's too
        // (military review S4): both are public facts the character knows.
        const servedParent = person.parentIds.find((id) => world.service.has(id)) ?? null
        enlistPerson(
          world,
          pending.tick,
          person,
          specialty,
          [
            factor('own-choice', 1000),
            ...(servedParent !== null ? [factor('service-tradition', 300, servedParent)] : []),
            ...(recruitingDriveActive(world, pending.tick) ? [factor('recruiting-drive', 550)] : []),
            ...(isOfficerPending(pending) ? [factor('holds-a-degree', 700)] : []),
          ],
          isOfficerPending(pending),
        )
      }
      break
    }

    case 'promotion-board': {
      // Stripes are put in for. Putting in comes with putting in the work
      // (+40 on the month), and the answer — either answer — goes on the
      // record. 'pass' means not considered: an own choice, no roll.
      if (choice === 'put-in') {
        const record = world.service.get(person.id)
        const standing = boardStandingFor(world, person.id)
        if (record && record.dischargedAtTick === null && standing && standing.timeInGrade >= standing.tigNeeded) {
          const rng = openStream(world.seed, Stream.Employment, person.id, pending.tick + 5666)
          // POINTS against the trade's cutoff (M-SPECOPS): evaluation,
          // fitness, badges, decorations, seniority — plus the packet work
          // of putting in. The board reads the file too: each recorded
          // non-selection raises what it takes, which is what makes 'pass'
          // a real choice — an unready packet costs the next one.
          //
          // CLEARING THE CUTOFF CLEARLY MEANS SELECTED — that is what a
          // cutoff is (owner playtest: 796 against 510, passed over; the
          // old flat slot-lottery gated people far above the line). The
          // draw exists only NEAR the line, standing in for the cutoff's
          // month-to-month drift the game does not model.
          const prepped = standing.points.total + 40
          const cutoffWithFile = standing.cutoff + standing.filePenalty
          const margin = prepped - cutoffWithFile
          const selected =
            margin >= 0 && (margin >= 150 || rng.chance(6 + Math.floor(margin / 15), 24))
          if (selected) {
            const newRank = applyBoardPromotion(world, pending.tick, person.id)
            if (newRank === null) break // no record to promote — no event lies about it
            recordEvent(world, pending.tick, {
              type: 'promoted',
              subjectId: person.id,
              detail: rankTitle(world, record.branch, newRank, record.commissioned === true),
            })
            recordDecision(world, pending.tick, {
              subjectId: person.id,
              decision: 'promotion',
              significance: 'notable',
              inputs: [
                factor('own-choice', 1000),
                factor('strong-performance', record.performance),
                factor('time-in-grade', Math.min(1000, standing.timeInGrade * 10)),
              ],
              chosen: `made ${rankTitle(world, record.branch, newRank, record.commissioned === true)}`,
              rejected: [],
              streamId: Stream.Employment,
            })
          } else {
            recordEvent(world, pending.tick, {
              type: 'passed-over',
              subjectId: person.id,
              // W1 resistance 4: the LADDER INDEX, not the title. A rank's
              // words belong to a preset's branch table; the index is what
              // the world actually holds, and story.ts renders it back.
              detail: String(standing.targetRank),
            })
            recordDecision(world, pending.tick, {
              subjectId: person.id,
              decision: 'promotion',
              significance: 'notable',
              inputs: [factor('own-choice', 1000), factor('strong-performance', record.performance)],
              chosen: `went before the ${standing.targetTitle} board; not selected`,
              rejected: [],
              streamId: Stream.Employment,
            })
          }
        }
      } else {
        // Letting it go by is a choice too, and it is on the record — the
        // stakes text promises exactly that, so the code keeps the promise.
        // P1: and now the FEED keeps it too.
        recordEvent(world, pending.tick, { type: 'declined-board', subjectId: person.id })
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'promotion',
          significance: 'notable',
          inputs: [factor('own-choice', 1000)],
          chosen: 'let the board go by',
          rejected: ['to put in'],
          streamId: Stream.Employment,
        })
      }
      break
    }

    case 'attend-school': {
      if (choice === 'attend') {
        const record = world.service.get(person.id)
        if (record && record.dischargedAtTick === null) {
          const specialty = specialtyFor(world, record.specialtyId)
          // One event, not a same-tick begin-and-end: a short course fits
          // inside the month, and the feed should not pretend otherwise.
          const school =
            pending.occupationId === null
              ? undefined
              : world.spec.schools.find((sc) => sc.id === pending.occupationId)
          recordEvent(world, pending.tick, {
            type: 'completed-training',
            subjectId: person.id,
            detail: school?.title ?? 'an advanced course',
          })
          const performance = Math.min(1000, record.performance + 60)
          boostServicePerformance(world, person.id, 60)
          // The school can also earn the trade's rating — which counts
          // toward the board (the training-to-promotion path the owner
          // asked for, and the real one).
          if (!record.qualifications.includes(specialty.qualification) && performance >= 500) {
            const qualEvent = recordEvent(world, pending.tick, {
              type: 'earned-qualification',
              subjectId: person.id,
              detail: specialty.qualification,
            })
            addServiceQualification(world, person.id, specialty.qualification)
            grantQualificationBadge(world, pending.tick, person.id, qualEvent, specialty.qualification)
          }
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'training',
            significance: 'notable',
            inputs: [factor('own-choice', 1000), factor('ambition', person.traits.ambition)],
            chosen: 'took a slot at an advanced school',
            rejected: ['to let it go by'],
            streamId: Stream.Employment,
          })
        }
      }
      break
    }

    case 'volunteer-deploy': {
      // NOT resolved here: accepting raises the orders sheet, and a pending
      // cannot be raised while this one still holds the slot. Handled after
      // commit(), below.
      break
    }

    case 'support-deployment': {
      // Both answers end the rotation; one of them starts a war.
      answerSupportDeployment(world, pending.tick, person.id, choice === 'stay-and-fight')
      break
    }

    case 'desperation': {
      // Deliberately NOT resolved here. Taking it can lead to an arrest,
      // and the arrest owes the player a plea — but raisePending refuses
      // while this very pending still holds the slot, so the court would
      // sentence them off-screen, which is the one thing C2 exists to
      // stop. Resolved after commit(), below. (The same trap the combat
      // moment hit with field aid; the same cure.)
      break
    }

    case 'plea': {
      // The court sits either way; the plea decides how it goes.
      const offence = pending.occupationId === null ? null : (offenceById(pending.occupationId) ?? null)
      const rng = openStream(world.seed, Stream.Crime, person.id, pending.tick + 6363)
      // STANDING TRIAL IS PLAYED NOW (owner: "I just click stand trial and
      // then I get convicted"). The three scenes are raised after commit,
      // and the verdict comes out of what the defendant actually did.
      if (choice === 'stand-trial' && offence !== null) {
        trialOpens = { offence, taken: pending.monthlyPay ?? 0 }
        break
      }
      resolveCourt(
        world, pending.tick, person, pending.monthlyPay ?? 0, rng,
        choice === 'plead-guilty' ? 'plead-guilty' : 'take-plea-deal',
        offence,
      )
      break
    }

    case 'first-aid': {
      resolveFieldAid(world, pending.tick, person, person.id, choice)
      break
    }

    case 'treat-casualty': {
      if (pending.otherId !== null) {
        const casualty = world.people.get(pending.otherId)
        if (casualty) resolveFieldAid(world, pending.tick, person, casualty.id, choice)
      }
      break
    }

    case 'reenlist-term': {
      // §3 → §5. The chosen term decides the bonus, and the bonus decides
      // whether there is an option worth asking about.
      const state = decodeContract(pending.occupationId)
      const years = Number(choice.replace('yr', '')) || state.termYears
      const record = world.service.get(person.id)
      const bonus = record === undefined ? 0 : bonusFor(world, record, pending.tick, years)
      const options = optionsOffered(state.code, bonus)
      contractNext =
        options.length === 0
          ? { kind: 'service-contract', state: encodeContract(state.code, years, 'none', bonus) }
          : { kind: 'reenlist-option', state: encodeContract(state.code, years, 'none', bonus) }
      break
    }

    case 'reenlist-option': {
      const state = decodeContract(pending.occupationId)
      contractNext = {
        kind: 'service-contract',
        state: encodeContract(state.code, state.termYears, choice, state.bonus),
      }
      break
    }

    case 'service-contract': {
      // §6b. THE OATH IS WHAT EXECUTES IT. Everything before this was
      // paperwork; this is the moment the contract becomes a fact.
      //
      // §6. And the CHOICE here is who administers it — the answer is a
      // roster member's id, or 'take-the-oath' when there was nobody to
      // choose from (a first enlistment has no unit yet).
      const state = decodeContract(pending.occupationId)
      const administratorId = choice.startsWith('by-')
        ? (Number(choice.slice(3)) as EntityId)
        : null
      if (state.code === 'enlist') break // the first term already began
      // A zero term is the INDEFINITE contract (ADR-0032). Passing 0 through
      // would set termMonthsLeft to zero and fire the term's end again the
      // same month, for ever — undefined keeps the standing term, which for
      // an indefinite record is only a heartbeat nobody is asked about.
      reenlistService(
        world,
        pending.tick,
        person,
        state.termYears > 0 ? state.termYears * 12 : undefined,
        administratorId,
      )
      applyReenlistmentOption(world, pending.tick, person, state.option)
      // The money is moved here, where the ledger is reachable.
      if (state.option === 'bonus' && state.bonus > 0) {
        // M-ECON §1. THE MEMBER'S MONEY, NOT THE ROOF'S. This used to credit
        // the household balance, which since the split is an OBLIGATIONS
        // counter clamped at or below zero every month — so a player took a
        // twelve-thousand-dollar bonus and the next settle deleted it.
        creditPerson(world, person.id, state.bonus as Money)
      }
      break
    }

    case 'trial': {
      // The next scene is raised AFTER commit — raisePending refuses while
      // this one still holds the slot, which is the trap this file has now
      // shipped broken three times.
      trialNext = answerCase(world, pending.tick, person, pending.occupationId, choice).next
      break
    }

    case 'crime-victim': {
      if (choice === 'defend') {
        defendTheHouse(world, pending.tick, person, pending.occupationId ?? 'burglary')
        break
      }
      answerVictimMoment(
        world,
        pending.tick,
        person,
        pending.occupationId ?? 'theft',
        pending.monthlyPay ?? 0,
        choice === 'report',
      )
      break
    }

    case 'unit-moment': {
      // NOT resolveMomentCasualty \u2014 that is the ENEMY CONTACT resolver and
      // it carries a firefight's fatal tail. These are commitment and
      // aftermath: what they cost is a place in the unit, a body worn out
      // on a course, or nothing at all but how somebody is remembered.
      const momentId = momentIdOf(pending.occupationId)
      const moment = unitMomentById(momentId)
      const answer: SceneChoice =
        choice === 'push' || choice === 'hold' || choice === 'cover' ? choice : 'hold'
      const did = moment?.did[answer] ?? 'answered the unit'

      recordEvent(world, pending.tick, {
        type: 'unit-moment',
        subjectId: person.id,
        detail: `${momentId}:${answer}`,
      })
      // NOT for selection day: resolveSelectionDay writes the record that
      // says how it ENDED, and two 'selection' records at one tick means the
      // Why? finds this one first and the outcome becomes unreachable.
      if (moment !== undefined && moment.id !== 'selection-day') {
        const standard = unitFor(world, unitIdOf(pending.occupationId))?.minPerformance
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'selection',
          significance: 'notable',
          // Only real numbers here. A ramp ceremony is not explained by a
          // unit standard, so it does not claim to be.
          inputs:
            standard === undefined
              ? [factor('own-choice', 1000)]
              : [factor('own-choice', 1000), factor('unit-standard', standard)],
          chosen: did,
          rejected: SCENE_OPTIONS.filter((option) => option !== answer).map(
            (option) => moment.did[option] ?? `to ${option}`,
          ),
          streamId: Stream.CombatResolution,
        })
      }

      if (moment?.id === 'selection-day') {
        resolveSelectionDay(world, person, unitIdOf(pending.occupationId), answer, pending.tick)
      }
      if (moment?.id === 'reporting-in') {
        // How somebody comes in is how they are read for a while after.
        const shift = answer === 'push' ? -20 : answer === 'hold' ? 40 : 0
        if (shift !== 0) boostServicePerformance(world, person.id, shift)
      }
      break
    }

    case 'combat-moment': {
      // A BEAT THAT IS NOT THE DECISION RESOLVES TO NOTHING BUT THE NEXT
      // BEAT (combat revamp §3). Contact, orient, consequence and the
      // after-action are read-and-continue: the sequence is what makes an
      // engagement an engagement, and the outcome below must fire exactly
      // ONCE, on the beat that actually asks.
      //
      // The re-raise happens after `commit`, at the foot of this function,
      // because the pending slot is still occupied here.
      {
        const seq = decodeSequence(pending.occupationId)
        if (!beatAsks(beatAt(seq.beats, seq.step))) break
      }

      // THE THREE-OPTION SCENE (owner's combat plan §2). One spectrum —
      // push, hold, cover — and the outcome is the cell where the answer
      // meets how bad the moment actually was. The player was TOLD the
      // threat before answering, so this is a read rather than a coin
      // flip, and the record carries the threat as a factor so the Why?
      // can say what it was.
      //
      // EVERY CELL KEEPS THE FATAL TAIL. That is the invariant the whole
      // system hangs on: the bravest answer must not be the only one that
      // can kill you, and the most careful must not be the only one that
      // cannot.
      const { sceneId, threat } = decodeScene(pending.occupationId)
      const scene = sceneById(sceneId)
      const answer: SceneChoice =
        choice === 'push' || choice === 'hold' || choice === 'cover' ? choice : 'hold'
      const outcome = outcomeFor(answer, threat)
      const enemy = pending.otherId === null ? undefined : world.nations.get(pending.otherId)
      const rng = openStream(world.seed, Stream.CombatResolution, person.id, pending.tick + 9100)

      const did = scene?.did[answer] ?? 'held the position under fire'

      // Going forward is an ACT, and the act is what a decoration cites —
      // so it goes on the record whether or not anybody writes it up.
      if (outcome.valorInN > 0) {
        const act = recordEvent(world, pending.tick, {
          type: 'act-of-valor',
          subjectId: person.id,
          ...(pending.otherId !== null ? { otherId: pending.otherId } : {}),
          detail: did,
        })
        // Not every brave act is decorated, and the odds are the cell's:
        // pushing into an overrun is both the most dangerous thing in the
        // game and the likeliest to be recognized.
        if (rng.chance(1, outcome.valorInN)) {
          grantValor(world, pending.tick, person.id, act, enemy?.name ?? 'the enemy', threat)
        }
      } else {
        recordEvent(world, pending.tick, {
          type: 'kept-heads-down',
          subjectId: person.id,
          ...(pending.otherId !== null ? { otherId: pending.otherId } : {}),
          detail: did,
        })
      }

      recordDecision(world, pending.tick, {
        subjectId: person.id,
        decision: 'deployment',
        significance: answer === 'push' ? 'defining' : 'notable',
        inputs: [
          factor('own-choice', 1000),
          // How bad it was, on the record — so the Why? can explain the
          // outcome rather than only the choice.
          factor('threat-level', threat === 'overrun' ? 1000 : threat === 'heavy' ? 600 : 250),
          factor('battlefield-chaos', 800),
        ],
        chosen: did,
        rejected: SCENE_OPTIONS.filter((o) => o !== answer).map(
          (o) => scene?.did[o] ?? `to ${o}`,
        ),
        streamId: Stream.CombatResolution,
      })

      resolveMomentCasualty(
        world,
        pending.tick,
        person,
        pending.otherId,
        rng,
        outcome.gate,
        outcome.severityFloor,
      )
      break
    }

    case 'foremans-warning': {
      // The warning is real either way; only what is done with it differs.
      // Knuckling down is the convalesce push-on pattern: a real, bounded
      // effort bump. Shrugging changes nothing — and the dismissal model
      // keeps rolling next month regardless.
      if (choice === 'knuckle-down') {
        adjustJobPerformance(world, person.id, 80)
      }
      recordDecision(world, pending.tick, {
        subjectId: person.id,
        decision: 'employment-change',
        significance: 'notable',
        inputs: [
          factor('own-choice', 1000),
          factor('poor-performance', 1000 - (world.employment.get(person.id)?.performance ?? 0)),
        ],
        chosen: choice === 'knuckle-down' ? 'took the warning to heart' : 'shrugged the warning off',
        rejected: [choice === 'knuckle-down' ? 'to shrug it off' : 'to knuckle down'],
        streamId: Stream.Employment,
      })
      break
    }

    case 'retrain': {
      // 'keep' holds the trade; any other answer is a specialty id from the
      // options list — service owns the write.
      if (choice !== 'keep') {
        retrainSpecialty(world, pending.tick, person, choice)
      }
      break
    }

    case 'custom-birth': {
      // Never a live question: createCustomLife writes the log entry itself.
      // Reaching here means a corrupted pending — refuse loudly.
      throw new Error('custom-birth is a log entry, not a live decision')
    }

    case 'job-application':
    case 'walk-in-enlist':
    case 'invest':
    case 'divest':
    case 'borrow':
    case 'buy-home':
    case 'habit':
    case 'doctor':
    case 'rent-home':
    case 'sell-home':
    case 'vote':
    case 'stand':
    case 'campaign':
    case 'set-lever':
    case 'seek-peace':
    case 'pay-down':
    case 'drop-out':
    case 'pay-off-plan':
    case 'school-request':
    case 'unit-tryout':
    case 'fitness-test':
    case 'extra-duty':
    case 'scale-up':
    case 'take-public':
    case 'gamble':
    case 'buy-chips':
    case 'cash-out':
    case 'poker':
    case 'tournament':
    case 'study-poker':
    case 'turn-pro':
    case 'seek-help':
    case 'try-out':
    case 'train':
    case 'rest-up':
    case 'take-offer':
    case 'declare-draft':
    case 'retire-sport':
    case 'take-fight':
    case 'endorse':
    case 'second-act':
    case 'offence':
    case 'court-friend':
    case 'proposal':
    case 'courtship-end':
    case 'marriage-tend':
    case 'social-call':
    case 'child-try':
    case 'walk-out':
    case 'job-quit':
    case 'raise-request':
    case 're-enrolment':
    case 'spend-stance':
    case 'house-hunt':
    case 'convalesce-stance': {
      // Log-only, like custom-birth: the tab verbs write these themselves.
      throw new Error(`${pending.kind} is a log entry, not a live decision`)
    }

    case 'reenlist': {
      const record = world.service.get(person.id)
      if (record && record.dischargedAtTick === null) {
        if (choice === 'reenlist' || choice === 'stay' || choice === 'indefinite') {
          // §1. THE ANSWER OPENS THE CONTRACT rather than signing it. Term,
          // then option, then the oath — and the oath is what executes it.
          //
          // INDEFINITE SKIPS THE TERM (ADR-0032), because there is no term:
          // straight to the oath, which is still a ceremony and still the
          // thing that executes it. No term also means no term bonus, which
          // the scene says out loud rather than quietly not paying.
          // NO TERMS ON OFFER MEANS INDEFINITE, whichever word the button
          // used. At twelve years that word is "go indefinite"; at twenty,
          // for somebody already indefinite, it is "stay on" — and both
          // have to reach the oath, because the oath is what resets the
          // term. Returning null here left termMonthsLeft at zero and the
          // office asked again every single month.
          const terms = termsOfferedTo(world, person, pending.tick)
          contractNext =
            choice === 'indefinite' || terms.length === 0
              ? {
                  kind: 'service-contract',
                  state: encodeContract(pending.occupationId ?? 'RE-1', 0, 'none', 0),
                }
              : {
                    kind: 'reenlist-term',
                    state: encodeContract(
                      pending.occupationId ?? 'RE-1',
                      terms[terms.length - 1] ?? 4,
                      'none',
                      0,
                    ),
                  }
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'enlistment',
            significance: 'major',
            inputs: [factor('own-choice', 1000), factor('steady-pay', Math.floor(record.monthlyPay / 1000))],
            chosen: choice === 'indefinite' ? 'went indefinite' : 'agreed to sign again',
            rejected: ['to leave the service'],
            streamId: Stream.Employment,
          })
        } else {
          // ANSWERING "RETIRE" IS A RETIREMENT. Both answers used to fall
          // here under 'end of term', which excluded the pension, printed
          // "completion of required service" on the sheet, and still issued
          // a certificate saying the member had retired — three documents
          // and a ledger disagreeing about one month.
          dischargeService(world, pending.tick, person, record, choice === 'retire' ? 'twenty years served' : 'end of term', [
            factor('own-choice', 1000),
            factor('term-ended', 600),
          ])
        }
      }
      break
    }

    case 'deployment-order': {
      // ADR-0022 §5, from the owner's answer: refusing is allowed and it
      // costs. Everything below reuses machinery that already exists —
      // the tour, the misconduct discharge, the cell, the record gate — so
      // a refusal lands the player exactly where an NPC's misconduct lands
      // them, which is the whole point of it being a real choice.
      const enemyId = pending.otherId
      const record = world.service.get(person.id)
      if (enemyId === null || !record) break

      // A PEACETIME POSTING IS NOT A WAR, and its sheet only has the one
      // button: there is no enemy to be excused from and nothing to refuse.
      if (pending.occupationId === 'rotation') {
        const host = world.nations.get(enemyId)
        if (host) {
          startRotation(
            world, pending.tick, person.id, host,
            [factor('under-orders', 1000)],
            `posted to ${host.name} on rotation`,
            [],
          )
        }
        break
      }

      if (pending.occupationId === 'voluntary') {
        // Their own hand raised it, and the record says so. If the door has
        // closed between the sheet and the answer — the war ended, say —
        // the refusal goes on the record rather than nowhere: the player was
        // shown paper and is owed an account of what became of it.
        if (!volunteerForDeployment(world, pending.tick, person.id)) {
          recordEvent(world, pending.tick, {
            type: 'received-orders',
            subjectId: person.id,
            detail: 'the orders were withdrawn before they could be answered',
          })
        }
        break
      }

      if (choice === 'go') {
        deployUnderOrders(world, person.id, enemyId, [factor('own-choice', 400)])
        break
      }

      if (choice === 'request-exemption') {
        // Rarely granted (the spec's `exemptionChance`), and the asking is
        // on the record either way. Denied means you go anyway — no second
        // question, because a chained pending is the trap this project has
        // now shipped broken twice (see the note at the top of this file).
        const rng = openStream(world.seed, Stream.CombatResolution, person.id, pending.tick + 91)
        const granted = rng.chanceInTenThousand(1200)
        recordEvent(world, pending.tick, {
          type: 'asked-exemption',
          subjectId: person.id,
          otherId: enemyId,
          detail: granted ? 'granted' : 'denied',
        })
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'deployment',
          significance: 'notable',
          inputs: [factor('own-choice', 1000), factor('under-orders', 600)],
          chosen: granted ? 'asked to be excused, and was' : 'asked to be excused, and was not',
          rejected: [],
          streamId: Stream.CombatResolution,
        })
        if (!granted) {
          deployUnderOrders(world, person.id, enemyId, [factor('reluctant', 700)])
        }
        break
      }

      if (choice === 'refuse') {
        refuseOrders(world, pending.tick, person, record, enemyId)
      }
      break
    }

    case 'graduate': {
      // The advanced degree. Declining is a real answer and not a
      // deferral: the question is asked once, and the record that got the
      // offer is still there if they change their mind by studying.
      if (choice === 'enrol') {
        enrolPlayer(world, pending.tick, person, 'graduate')
      }
      break
    }

    case 'debate': {
      // A MOMENT, on the same rails as every other. The answer runs
      // through the same function the polls read, so a debate the player
      // wins is a debate the town saw them win.
      const officeId = pending.occupationId ?? ''
      const answer: DebateChoice =
        choice === 'attack' || choice === 'policy' || choice === 'personal' ? choice : 'policy'
      debate(world, person.id, officeId, answer, pending.tick)
      break
    }

    case 'school-choice': {
      // THE PARENT'S CALL, and the parent's bill. Written onto the
      // CHILD'S record — `otherId` is whose schooling this is — and the
      // household pays for it through householdCosts like any other
      // month's expense.
      const childId = pending.otherId
      const child = childId === null ? undefined : world.education.get(childId)
      if (childId !== null && child !== undefined) {
        world.education.set(childId, {
          ...child,
          schooling: choice === 'private' ? 'private' : 'public',
        })
      }
      break
    }

    case 'major': {
      // WHAT THEY READ. Written straight onto the record because education
      // owns it, and validated against the school they are actually at so
      // an answer cannot put a welding certificate on a degree.
      const record = world.education.get(person.id)
      const enrolled = record?.enrolledIn ?? null
      if (record !== undefined && enrolled !== null) {
        const open = majorsFor(enrolled)
        const chosen = open.find((major) => major.id === choice)
        if (chosen !== undefined) {
          world.education.set(person.id, { ...record, major: chosen.id })
          recordEvent(world, pending.tick, {
            type: 'chose-major',
            subjectId: person.id,
            detail: chosen.id,
          })
        }
      }
      break
    }

    case 'key-hand': {
      // THE NIGHT WAS ALREADY DECIDED when they sat down; this settles what
      // the big pot did to it. The session travelled on the pending rather
      // than being re-rolled here, so answering cannot shop for a better
      // evening (spec §5: the choice shifts a seeded outcome, it does not
      // add randomness).
      const held = decodeHeldSession(pending.occupationId)
      if (held === null) break
      const stake = stakeById(held.stakeId)
      if (stake === undefined) break
      const buyIn = atTodaysPrices(world, stake.buyIn) as Money
      const record = gamblerOf(world, person.id)
      const hand = keyHandFor(world, pending.tick, person.id, record.hoursPlayed, record.pokerSkill)
      if (hand === null) {
        settleSession(world, person, stake, buyIn, held.result, 0)
        break
      }
      // The SAME draw decides it whichever way they answer — which is what
      // makes folding a real read rather than a way of dodging a coin flip.
      const rng = openStream(world.seed, Stream.Casino, person.id * 31 + held.visit, pending.tick + 8_800)
      const roll = rng.nextIntInclusive(0, 999)
      const answer: HandChoice =
        choice === 'fold' || choice === 'call' || choice === 'shove' ? choice : 'fold'
      const gained = keyHandOutcome(hand, answer, roll)
      const summary = settleSession(world, person, stake, buyIn, held.result, gained)
      recordDecision(world, pending.tick, {
        subjectId: person.id,
        decision: 'spending',
        significance: 'notable',
        inputs: [factor('own-choice', 1000), factor('unit-standard', hand.aheadPerMille)],
        chosen: `${answer} — ${handOutcomeWords(answer, gained)}`,
        rejected: HAND_CHOICES.filter((c) => c !== answer).map((c) => `to ${c}`),
        streamId: Stream.Casino,
      })
      void summary
      break
    }

    default: {
      const never: never = pending.kind
      throw new Error(`Unhandled decision kind ${String(never)}`)
    }
  }

  commit(world, pending, choice)

  // The desperation answer runs with the slot free, so an arrest can ask
  // for a plea instead of the courthouse ruling over the player's head.
  if (pending.kind === 'desperation') {
    answerDesperation(world, pending.tick, person, choice === 'take-it')
  }

  // THE NEXT BEAT, now the slot is free. An engagement runs until its
  // beats are done; only then does anything else get to ask.
  if (pending.kind === 'combat-moment' && person.deathTick === null) {
    const seq = decodeSequence(pending.occupationId)
    const next = seq.step + 1
    if (next < seq.beats.length) {
      const { sceneId, threat } = decodeScene(pending.occupationId)
      raisePending(world, {
        tick: pending.tick,
        kind: 'combat-moment',
        personId: person.id,
        otherId: pending.otherId,
        occupationId: encodeSequence(sceneId, threat, next, seq.beats),
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: [...SCENE_OPTIONS],
      })
      return
    }
  }

  // A wound taken during the combat moment is still a wound somebody has
  // to work on — and only now is the pending slot free to ask (review S7).
  if (pending.kind === 'combat-moment') {
    const hurt = world.health.get(person.id)
    if (hurt && hurt.ailment !== null && person.deathTick === null) {
      offerFieldAid(world, pending.tick, person.id, hurt.severity)
    }
  }

  // A VOLUNTEER GETS ORDERS TOO. Putting a hand up is not the same as
  // being on a plane: the sheet still has to be cut, and it says
  // VOLUNTARY on it. Raised after commit so the slot is free.
  if (pending.kind === 'volunteer-deploy' && choice === 'accept') {
    askToAcknowledgeOrders(world, pending.tick, person.id)
  }

  // The trial opens with the slot free, for the same reason.
  if (trialOpens !== null) {
    openCase(world, pending.tick, person.id, trialOpens.offence, trialOpens.taken)
  }

  // ADR-0034. THE OFFER AGAIN, with the slot free. Same job, same pay,
  // same employer — a month older, which the words say.
  if (offerAgain !== null) {
    raisePending(world, {
      tick: pending.tick,
      kind: 'job-offer',
      personId: offerAgain.personId,
      otherId: null,
      occupationId: offerAgain.occupationId,
      workplaceId: offerAgain.workplaceId,
      monthlyPay: offerAgain.monthlyPay,
      placeId: null,
      options:
        waitsOnOffer(world, person.id) >= OFFER_WAITS_ALLOWED
          ? ['accept', 'decline']
          : ['accept', 'decline', 'wait'],
    })
  }

  // M-ENLIST §5c. THE COMMISSION, with the slot free.
  //
  // An officer's TRADE is the enlisted specialty their role sits over —
  // an infantry officer commands infantry — so the record keeps both: the
  // specialty for everything already built on it (exposure, schools, the
  // veteran's civilian unlocks) and the officer role for what is new.
  if (officerNext !== null) {
    const { role, branch, assignment, aptitude } = officerNext
    const specialty =
      world.spec.specialties.find(
        (sp) => sp.branch === branch.id && sp.field === role.field,
      ) ?? world.spec.specialties.find((sp) => sp.branch === branch.id)
    if (specialty) {
      enlistPerson(
        world,
        pending.tick,
        person,
        specialty,
        [
          factor('own-choice', assignment.wasFirstChoice ? 1000 : 400),
          factor('holds-a-degree', 700),
          factor('qualified-for-role', Math.min(1000, aptitude * 10)),
        ],
        true,
        role.id,
      )
      recordEvent(world, pending.tick, {
        type: 'commissioned',
        subjectId: person.id,
        detail: assignment.wasFirstChoice ? role.title : `${role.title} (not first choice)`,
      })
    }
  }

  // M-CAREER §4. THE OFFER, with the slot free. Shown as a job-offer, which
  // is the pending the town already uses when it comes to you — the same
  // card, reached by having gone and asked.
  if (offerNext !== null) {
    raisePending(world, {
      tick: pending.tick,
      kind: 'job-offer',
      personId: person.id,
      otherId: null,
      occupationId: offerNext.occupationId,
      workplaceId: offerNext.workplaceId,
      monthlyPay: offerNext.pay,
      placeId: null,
      options: ['accept', 'decline'],
    })
  }

  // The crime itself, with the slot free.
  if (crimeNext !== null) {
    const offence = offenceById(crimeNext.offenceId)
    if (offence !== undefined) {
      const outcome = crimeOutcomeFor(crimeNext.danger, crimeNext.choice, offence, crimeNext.variant)
      executeOffence(world, pending.tick, person, offence, outcome)
      // The armed resident, through the same health system every other
      // wound uses. A shotgun in a hallway is not a special case, and it
      // can kill — which is the whole weight of pressing on in a room that
      // already told you what was in it.
      if (outcome.kind === 'wounded') {
        const rng = openStream(world.seed, Stream.Crime, person.id, pending.tick + 5254)
        inflictWound(
          world,
          pending.tick,
          person.id,
          rng.nextIntInclusive(520, 900),
          'direct-combat',
          rng,
        )
      }
    }
  }

  // The reenlistment chain, with the slot free — term, then option, then
  // the contract itself.
  if (contractNext !== null) {
    const options =
      contractNext.kind === 'reenlist-term'
        ? termsOfferedTo(world, person, pending.tick).map((y) => `${String(y)}yr`)
        : contractNext.kind === 'reenlist-option'
        ? optionsOffered(
            decodeContract(contractNext.state).code,
            decodeContract(contractNext.state).bonus,
          )
        : oathOptionsFor(world, person.id)
    raisePending(world, {
      tick: pending.tick,
      kind: contractNext.kind,
      personId: person.id,
      otherId: null,
      occupationId: contractNext.state,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: [...options],
    })
  }

  // The trial's next scene, with the slot free.
  if (trialNext !== null) {
    const showing = caseSceneOf(world, person.id, trialNext, pending.tick)
    if (showing !== null) {
      raisePending(world, {
        tick: pending.tick,
        kind: 'trial',
        personId: person.id,
        otherId: null,
        occupationId: trialNext,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: showing.scene.options.map((o) => o.id),
      })
    }
  }

  // Dropping a packet is a commitment, and a commitment has to arrive
  // somewhere: 'push' puts the player in front of selection itself. Raised
  // after commit for the same reason as everything else in this block —
  // raisePending refuses while the answered pending still holds the slot.
  if (pending.kind === 'unit-moment' && momentIdOf(pending.occupationId) === 'packet-drop' && choice === 'push') {
    const unitId = unitIdOf(pending.occupationId)
    if (unitId !== '') tryOutForUnit(world, unitId)
  }

  // Follow-up questions: an accepted enlistment immediately asks WHICH
  // uniform. Raised after commit so the pending slot is free again.
  if (pending.kind === 'enlist' && choice === 'accept') {
    askEntryPath(world, pending.tick, person.id)
  }
  if (pending.kind === 'education' && choice === 'enlist') {
    askEntryPath(world, pending.tick, person.id)
  }
  // M-ENLIST §1. THE PIPELINE, each step raised after the last one commits
  // — the slot has to be free or raisePending refuses, which is the trap
  // every chained question in this file has fallen into at least once.
  if (pending.kind === 'commission') {
    askBranch(world, pending.tick, person.id, choice === 'officer' ? 'officer' : 'enlisted')
  }
  if (pending.kind === 'branch-choice') {
    askEntryTest(world, pending.tick, person.id, choice, pending.occupationId ?? 'enlisted')
  }
  if (pending.kind === 'entry-test') {
    const [branchId, track] = (pending.occupationId ?? ':').split(':')
    if (track === 'officer') {
      askOfficerPreference(world, pending.tick, person.id, branchId ?? '')
    } else {
      askSpecialty(world, pending.tick, person.id, false, branchId)
    }
  }
  // THE SHEET, WHEN THE ANSWER ITSELF ENDED THE CAREER. `discharge()` raises
  // it for every tick-driven separation, but answering "come home" runs the
  // discharge INSIDE this resolution — while the answered pending still holds
  // the slot, so raisePending refuses it and the paperwork silently vanishes.
  // The same trap the trial and the contract chain fell into. Raised here,
  // with the slot free.
  const closed = world.service.get(person.id)
  if (
    closed !== undefined &&
    closed.dischargedAtTick === pending.tick &&
    person.deathTick === null &&
    person.id === world.player.personId &&
    // NEITHER document may re-raise the other. The certificate carries the
    // same tick as the sheet, so excluding only the sheet left acknowledge →
    // certificate → acknowledge → sheet running forever: the twenty-year
    // career, the most earned moment in the arc, could never be left.
    pending.kind !== 'separation-record' &&
    pending.kind !== 'retirement-certificate'
  ) {
    raisePending(world, {
      tick: pending.tick,
      kind: 'separation-record',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['acknowledge'],
    })
  }

  // Twenty years earns the second document, alongside the first. Raised
  // after commit, with the pending slot free.
  if (
    pending.kind === 'separation-record' &&
    (separationFor(world, person.id)?.retirementEligible ?? false)
  ) {
    raisePending(world, {
      tick: pending.tick,
      kind: 'retirement-certificate',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['accept'],
    })
  }

  // §6c. THE FIRST CONTRACT IS PAPER TOO. The record already exists by the
  // time this raises — the trade choice wrote it — so the oath here executes
  // nothing; it is the ceremony over a term that has begun. That asymmetry
  // with reenlistment is deliberate: a first-termer signs at the office and
  // swears at the station, and there is nothing to undo in between.
  // M-ENLIST §5c: an officer candidate never sees the trade menu — the
  // branch assigns the role — so the officer road reaches the paper from
  // its own last step instead.
  if (
    (pending.kind === 'specialty' || pending.kind === 'officer-preference') &&
    isServing(world, person.id)
  ) {
    raisePending(world, {
      tick: pending.tick,
      kind: 'service-contract',
      personId: person.id,
      otherId: null,
      // The term the RECORD was just written with — a commission's initial
      // obligation is longer than an enlistment's, and the paper has to say
      // the number the person is actually held to.
      occupationId: encodeContract(
        'enlist',
        Math.floor(
          (world.service.get(person.id)?.termMonths ?? SERVICE_TERM_MONTHS) / 12,
        ),
        'none',
        0,
      ),
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: [...oathOptionsFor(world, person.id)],
    })
  }
  // THE TRADE QUESTION COMES AFTER THE OATH, and only when it was BOUGHT.
  // It used to fire on every reenlistment, which made a specialty something
  // you re-picked every four years for free (owner). Now it is one of the
  // things the retention office puts on the table, and taking it costs you
  // the bonus you would otherwise have taken.
  if (
    pending.kind === 'service-contract' &&
    decodeContract(pending.occupationId).code !== 'enlist' &&
    decodeContract(pending.occupationId).option === 'reclass'
  ) {
    askRetrain(world, pending.tick, person.id)
  }
}

/** The retrain menu at reenlistment: keep the trade, or cross to another. */
function askRetrain(world: World, tick: PendingDecision['tick'], personId: EntityId): void {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return
  const education = world.education.get(personId)
  const level = education?.level ?? 'none'
  const alternatives = world.spec.specialties.filter(
    (sp) => sp.id !== record.specialtyId && sp.branch === record.branch && meetsRequirement(level, sp.requires),
  ).map((sp) => sp.id)
  if (alternatives.length === 0) return // nothing to cross to; no empty question
  raisePending(world, {
    tick,
    kind: 'retrain',
    personId,
    otherId: null,
    occupationId: null,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: ['keep', ...alternatives],
  })
}

/**
 * M-ARMY2. The minutes after a serious wound resolved.
 *
 * THE RULE THIS OBEYS (the combat-moment precedent): a choice is never a
 * discount on the wound. Every answer is a real attempt with a real cost,
 * the odds come from the severity the model already rolled, and the worst
 * outcome — a wound that was going to be survivable being lost — stays
 * reachable from all three. What the answer moves is how much, and at
 * what price.
 *
 * `actor` is who is doing the work; `casualtyId` is who is bleeding. They
 * are the same person for self-aid, and different for a medic's squadmate.
 */
function resolveFieldAid(
  world: World,
  tick: PendingDecision['tick'],
  actor: Person,
  casualtyId: EntityId,
  choice: string,
): void {
  const record = world.health.get(casualtyId)
  if (!record || record.ailment === null) return
  const casualty = world.people.get(casualtyId)
  if (!casualty || casualty.deathTick !== null) return

  const severity = record.severity
  const rng = openStream(world.seed, Stream.Health, casualtyId, tick + 8200)
  const selfAid = casualtyId === actor.id
  const trained =
    world.service.get(actor.id)?.specialtyId === 'medic' ? 250 : 0

  // How well it goes: the wound's own severity against the hands working
  // on it. Pressing is the most effective and the most exposed; calling
  // brings better hands but costs the minutes it takes them to arrive;
  // lying still risks least and helps least.
  let skill: number
  let extraExposure: number
  let delayCost: number
  let chosen: string
  switch (choice) {
    case 'press-the-wound':
    case 'work-the-wound':
      skill = 520 + trained + Math.floor(actor.traits.resilience / 5)
      extraExposure = 140
      delayCost = 0
      chosen = selfAid ? 'kept pressure on it and held on' : 'worked the wound where it lay'
      break
    case 'call-for-help':
    case 'call-the-evac':
      skill = 380 + trained + Math.floor(actor.traits.sociability / 8)
      extraExposure = 40
      delayCost = 60
      chosen = selfAid ? 'called out, and waited for hands' : 'called the evacuation in'
      break
    default: // lie-still / drag-them-out
      skill = selfAid ? 260 + Math.floor(actor.traits.resilience / 6) : 340 + trained
      extraExposure = selfAid ? 0 : 60
      delayCost = selfAid ? 0 : 110
      chosen = selfAid ? 'lay still and let it clot' : 'dragged them out of it first'
      break
  }

  // WHAT THE WOUND WAS. An accident is not enemy action, and a death from
  // one must not be dressed as a combat death — the decoration would then
  // be granted off a cause that never happened (review M2). The month's
  // own wound event is the honest source.
  let enemyAction = false
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event || event.tick !== tick || event.subjectId !== casualtyId) continue
    if (event.type === 'wounded-in-action') { enemyAction = true; break }
    if (event.type === 'was-injured') break
  }
  const enemyId = currentDeployment(world, casualtyId)?.enemyId ?? null
  const enemyName = (enemyId === null ? undefined : world.nations.get(enemyId)?.name) ?? 'the enemy'

  // The tail that kills. The severity is the weight, the hands working on
  // it are the counterweight, and delay adds to it. Exposure is the
  // ACTOR's risk — which for self-aid is the casualty's own (review S5:
  // the text promised this and the model did the opposite).
  const mortalPressure =
    Math.max(0, severity - 600) * 2 + delayCost + (selfAid ? extraExposure : 0)
  const lost = rng.chance(Math.max(10, mortalPressure - Math.floor(skill / 3)), 1_000)

  // The casualty was SHOT; they did not choose this. Their own record says
  // so, and when someone else worked on them it names them (review S4).
  const casualtyInputs = [
    factor('battlefield-chaos', severity),
    ...(selfAid ? [factor('own-choice', 1000)] : [factor('holds-qualification', 400, actor.id)]),
  ]
  const actorInputs = [
    factor('own-choice', 1000),
    factor('battlefield-chaos', severity),
    ...(trained > 0 ? [factor('holds-qualification', 400)] : []),
  ]

  if (lost) {
    performDeath(
      world, tick, casualty,
      enemyAction ? 'wounds taken in action' : 'an accident on deployment',
      casualtyInputs, Stream.Health,
    )
    evacuateHome(world, tick, casualtyId)
    if (enemyAction) {
      for (let i = world.events.length - 1; i >= 0; i--) {
        const died = world.events[i]
        if (!died || died.type !== 'died' || died.subjectId !== casualtyId) continue
        grantWoundRecognition(world, tick, casualtyId, died, enemyName)
        break
      }
    }
    // The losing branch gets its event too — a medic's timeline must not
    // be silent about the person who died under their hands (review S4).
    recordEvent(world, tick, {
      type: 'field-aid',
      subjectId: actor.id,
      ...(selfAid ? {} : { otherId: casualtyId }),
      detail: selfAid
        ? `${chosen} — it was not enough`
        : `${chosen}; ${casualty.givenName} did not make it`,
    })
    recordDecision(world, tick, {
      subjectId: actor.id,
      decision: 'convalescence',
      significance: 'defining',
      inputs: actorInputs,
      chosen: selfAid ? chosen : `${chosen} — and lost them`,
      rejected: [],
      streamId: Stream.Health,
    })
    return
  }

  // Held on. Better work leaves less behind; the peak the body already hit
  // is untouched, so any permanent mark it earned is still earned.
  adjustAilmentSeverity(world, casualtyId, -Math.floor(skill / 4) + Math.floor(delayCost / 2))
  recordEvent(world, tick, {
    type: 'field-aid',
    subjectId: actor.id,
    ...(selfAid ? {} : { otherId: casualtyId }),
    detail: selfAid ? chosen : `${chosen} — ${casualty.givenName} held on`,
  })
  recordDecision(world, tick, {
    subjectId: actor.id,
    decision: 'convalescence',
    significance: 'notable',
    inputs: actorInputs,
    chosen,
    rejected: [],
    streamId: Stream.Health,
  })
}

/**
 * §6. The oath's options: the people senior to you in your own squad, or
 * the plain button when there is nobody — which is every first enlistment,
 * because a recruit has no unit yet.
 */
function oathOptionsFor(world: World, personId: EntityId): readonly string[] {
  const candidates = oathAdministratorsFor(world, personId)
  if (candidates.length === 0) return ['take-the-oath']
  return candidates.map((member) => `by-${String(member.personId)}`)
}

/**
 * The door, and which side of it you walk in on.
 *
 * A degree is a real fork at the recruiting office — the same person can
 * sign as a private or take the commissioning course — so it is ASKED
 * rather than assumed. Without one there is nothing to ask: the officer
 * ladder is closed at entry, and the question would be a menu with a single
 * item on it.
 */
function askEntryPath(world: World, tick: PendingDecision['tick'], personId: EntityId): void {
  const anyOfficers = world.spec.branches.some((b) => (b.officerRanks?.length ?? 0) > 0)
  if (!anyOfficers || !commissionsOnEntry(world, personId)) {
    // M-ENLIST §1: no fork to offer, so straight to the first real step.
    askBranch(world, tick, personId, 'enlisted')
    return
  }
  raisePending(world, {
    tick,
    kind: 'commission',
    personId,
    otherId: null,
    occupationId: null,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: ['officer', 'enlisted'],
  })
}

/**
 * M-ENLIST §1/§4. WHICH SERVICES WOULD ACTUALLY TAKE THIS PERSON.
 *
 * Every branch gates its jobs on the entry test, and the gates are not the
 * same height: the ground service will take a 31, the air service starts at
 * 40. Offering a service that has nothing open is offering a door into a
 * blank wall — the player picks it, sits the test, and the trade menu comes
 * back empty with nothing to say for itself.
 *
 * The score is a pure function of the seed and the person, so it can be
 * asked BEFORE the test is shown without the test being a formality: the
 * player still does not know it, and the menu is only ever narrowed by it.
 */
function branchesOpenTo(
  world: World,
  personId: EntityId,
  track: 'enlisted' | 'officer',
): readonly ServiceBranchSpec[] {
  const level = world.education.get(personId)?.level ?? 'none'
  const aptitude = entryTestScore(world, personId)
  return world.spec.branches.filter((branch) => {
    if (track === 'officer' && (branch.officerRanks?.length ?? 0) === 0) return false
    if (track === 'officer') {
      // An officer's trade comes from the role, and the roles have their own
      // gates — so the question is whether any role here is open to them.
      return officerRolesOf(OFFICER_ROLES, branch.id).some(
        (role) => aptitude >= (role.minAptitude ?? 0),
      )
    }
    return world.spec.specialties.some(
      (specialty) =>
        specialty.branch === branch.id && mosBar(specialty, aptitude, level) === null,
    )
  })
}

/**
 * M-ENLIST §1. STEP ONE — WHICH SERVICE.
 *
 * The pipeline is branch, then the entry test, then a job you actually
 * qualify for. Each step is its own pending so it saves and resumes: a
 * player who closes the tab half way through enlisting comes back to the
 * same question.
 *
 * `track` rides on occupationId because nothing else remembers it yet —
 * the record is not written until the job comes back, three steps later.
 */
/**
 * M-ENLIST §1. Was this menu raised on the officer road?
 *
 * The pending carries "branch:track" in occupationId because there is no
 * record to hang it on yet — the record is not written until the trade
 * comes back. One reader, so the format lives in one place.
 */
function isOfficerPending(pending: PendingDecision): boolean {
  return (pending.occupationId ?? '').endsWith(':officer')
}

function askBranch(world: World, tick: Tick, personId: EntityId, track: 'enlisted' | 'officer'): void {
  const options = branchesOpenTo(world, personId, track).map((branch) => branch.id)
  if (options.length === 0) return
  raisePending(world, {
    tick,
    kind: 'branch-choice',
    personId,
    otherId: null,
    occupationId: track,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options,
  })
}

/**
 * M-ENLIST §4. STEP TWO — THE TEST.
 *
 * No input: it is a gate, not a decision. The score is not carried on the
 * pending because it does not need to be — `entryTestScore` is a pure
 * function of the seed and the person, so every step downstream can ask for
 * it again and get the same number.
 */
function askEntryTest(world: World, tick: Tick, personId: EntityId, branchId: string, track: string): void {
  raisePending(world, {
    tick,
    kind: 'entry-test',
    personId,
    otherId: null,
    occupationId: `${branchId}:${track}`,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: ['continue'],
  })
}

/**
 * M-ENLIST §5c. STEP THREE, OFFICER ROAD — what they ask the branch for.
 *
 * What the asking MEANS depends on the service, which is the point: the
 * naval service is choosing a community, the ground service is listing a
 * preference it may not honour, the air service is stating one before being
 * assigned. Same screen, three different weights.
 */
function askOfficerPreference(world: World, tick: Tick, personId: EntityId, branchId: string): void {
  const aptitude = world.service.get(personId)?.aptitude ?? entryTestScore(world, personId)
  const options = officerRolesOf(OFFICER_ROLES, branchId)
    .filter((role) => aptitude >= (role.minAptitude ?? 0))
    .map((role) => role.id)
  if (options.length === 0) return
  raisePending(world, {
    tick,
    kind: 'officer-preference',
    personId,
    otherId: null,
    occupationId: branchId,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options,
  })
}

/**
 * The specialty menu: every branch role this person's schooling admits.
 *
 * `commissioned` rides on the pending's occupationId because it was decided
 * one question ago and nothing else remembers it — the record is not written
 * until the specialty comes back.
 */
function askSpecialty(
  world: World,
  tick: PendingDecision['tick'],
  personId: EntityId,
  commissioned: boolean,
  branchId?: string,
): void {
  const person = world.people.get(personId)
  if (!person) return
  const education = world.education.get(personId)
  const level = education?.level ?? 'none'
  // M-ENLIST §4. THE TEST IS THE GATE. The menu is this branch's jobs that
  // the score AND the schooling both open — the locked ones are drawn on
  // the screen with the reason, but they are not options.
  const aptitude = world.service.get(personId)?.aptitude ?? entryTestScore(world, personId)
  const options = world.spec.specialties
    .filter((sp) => branchId === undefined || sp.branch === branchId)
    .filter((sp) => mosBar(sp, aptitude, level) === null)
    // A commission needs a ladder to stand on: a branch with no officer
    // corps cannot be joined as an officer, whatever the degree says.
    .filter(
      (sp) =>
        !commissioned ||
        (world.spec.branches.find((b) => b.id === sp.branch)?.officerRanks?.length ?? 0) > 0,
    )
    .map((sp) => sp.id)
  if (options.length === 0) return
  raisePending(world, {
    tick,
    kind: 'specialty',
    personId,
    otherId: null,
    occupationId: `${branchId ?? ''}:${commissioned ? 'officer' : 'enlisted'}`,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options,
  })
}

function commit(world: World, pending: PendingDecision, choice: string): void {
  world.player.log.push({
    decisionId: pending.id,
    tick: pending.tick,
    kind: pending.kind,
    // ADR-0033. The pending's OWN subject, not whoever is being played when
    // it commits — they are the same person in every case that exists
    // today, and if that ever stops being true the pending is right.
    personId: pending.personId,
    // A unit moment logs WHICH cutscene it was ("losing-one:hold"), because
    // "has this one already played" is asked every month and the log is the
    // cheap place to ask it. The event ledger would answer too, and it grows
    // without bound.
    choice: pending.kind === 'unit-moment' ? `${momentIdOf(pending.occupationId)}:${choice}` : choice,
  })
  // A "NO" IS STAMPED so it can be honoured. Recorded for every kind
  // rather than only the ones with a cooldown today: the table in
  // DECLINE_COOLDOWN decides what to DO with it, and adding a kind there
  // later should not need this line changed as well.
  if (REFUSALS.has(choice)) {
    world.player.declinedAtTick = {
      ...(world.player.declinedAtTick ?? {}),
      [pending.kind]: pending.tick,
    }
  }
  world.player.pending = null
}

/** Has the player already answered a decision of this kind? */
export function hasAnswered(world: World, kind: PendingKind): boolean {
  // SCOPED TO THIS LIFE (ADR-0033). See PlayerChoice.personId: an heir must
  // be asked the questions their parent already answered, because they are
  // a different person having a different life.
  const who = world.player.personId
  if (who === null) return false
  return world.player.log.some((entry) => entry.kind === kind && entry.personId === who)
}

/**
 * ADR-0034. How many times this offer has already been slept on, and what
 * that leaves. An employer waits, but not indefinitely.
 */
export const OFFER_WAITS_ALLOWED = 2

function held_of(world: World, pending: PendingDecision): string {
  const waited = waitsOnOffer(world, pending.personId)
  if (waited === 0) return ''
  const left = OFFER_WAITS_ALLOWED - waited
  return left <= 0
    ? ' They want an answer this time.'
    : ` You have already asked for time once; they will hold it ${String(left)} more month${left === 1 ? '' : 's'}.`
}

/**
 * How many times the player has deferred the offer standing right now.
 *
 * The log records the CHOICE, not what it was about, so this counts the
 * unbroken run of waits at the end — which is the same thing, because only
 * one offer is ever open at a time and accepting or declining closes it.
 */
function waitsOnOffer(world: World, personId: EntityId): number {
  let waits = 0
  for (let i = world.player.log.length - 1; i >= 0; i--) {
    const entry = world.player.log[i]
    if (entry === undefined) break
    if (entry.kind !== 'job-offer') continue
    if (entry.personId !== personId) continue
    // Only the unbroken run of waits at the end counts: an accepted or
    // declined offer closes the book on the ones before it.
    if (entry.choice !== 'wait') break
    waits++
  }
  return waits
}

/**
 * Human-readable prompt for a pending decision. Lives in the engine so the
 * text comes from the same facts as the records — the UI renders, it does not
 * author.
 */
export function describePending(world: World, pending: PendingDecision): string {
  const person = world.people.get(pending.personId)
  const other = pending.otherId === null ? null : world.people.get(pending.otherId)
  const age = person ? ageAt(person.birthTick, pending.tick) : 0

  switch (pending.kind) {
    case 'education':
      return `You are ${age} and finished with secondary school. What next?`
    case 'job-offer': {
      // ADR-0034. AN OFFER, NOT A NOTICEBOARD. This used to read "there is
      // an opening for a shop clerk" — which is what the newspaper says,
      // not what somebody says to you after they have decided they want
      // you. The difference is the whole feeling of getting a job.
      const role = pending.occupationId
        ? withArticle(occupationById(pending.occupationId).title)
        : 'a job'
      const where =
        pending.workplaceId === null
          ? ''
          : ` ${world.places.get(pending.workplaceId)?.name ?? 'a workplace'}`
      const held = held_of(world, pending)
      return where === ''
        ? `Good news — they want to offer you ${role}.${held}`
        : `Good news —${where} has offered you ${role}.${held}`
    }
    case 'move-out': {
      const where = pending.placeId === null ? 'town' : (world.places.get(pending.placeId)?.name ?? 'town')
      return `You could afford a place of your own in ${where}. Move out?`
    }
    case 'courtship':
      return `You and ${other ? `${other.givenName} ${other.familyName}` : 'someone'} have grown close. See where it goes?`
    case 'marriage':
      return `Marry ${other ? `${other.givenName} ${other.familyName}` : 'your partner'}?`
    case 'child':
      return `You and ${other ? other.givenName : 'your partner'} could grow the family. Have a child?`
    case 'move-house': {
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const household = person?.householdId == null ? undefined : world.households.get(person.householdId)
      const current = household ? world.places.get(household.placeId) : undefined
      const where = target?.name ?? 'a better street'
      // The same decision kind serves moving up and moving down; which one
      // this is shows in the words, and the stakes carry the numbers.
      if (target && current && target.desirability < current.desirability) {
        return `Money is short. Move to ${where}, where the rent is cheaper?`
      }
      return `A place in ${where} is within reach. Move the household?`
    }
    case 'retirement':
      return `You are ${age}. Retire, or keep working?`
    case 'separation':
      return `Things with ${other ? other.givenName : 'your spouse'} have grown distant. What do you do?`
    case 'convalesce': {
      const record = world.health.get(pending.personId)
      const what = record?.ailment === 'injury' ? 'The injury is serious' : 'The illness is serious'
      return `${what}. How do you carry it?`
    }
    case 'enlist':
      return `A recruiter for ${homelandName(world)} has your name. Enlist?`
    case 'commission':
      return (
        'You hold a degree, and the office will take you either way: sign on ' +
        'the enlisted side and start at the bottom of that ladder, or take the ' +
        'commissioning course and enter as an officer.'
      )
    case 'interview': {
      // The scene component draws the room; this is the fallback line.
      const state = decodeInterview(pending.occupationId)
      const title = occupationById(state.occupationId).title
      return `They are interviewing you for ${withArticle(title)}. ${interviewSituation(state.variant)}`
    }

    case 'school-moment': {
      // The scene component draws the card; this is the fallback line.
      const state = decodeSchoolMoment(pending.occupationId)
      const moment = schoolMomentById(state.momentId)
      return moment === undefined
        ? 'Something has happened at school.'
        : schoolSituationOf(moment, state.variant)
    }

    case 'work-moment': {
      // The scene component draws the card; this is the fallback line.
      const state = decodeWorkMoment(pending.occupationId)
      const moment = workMomentById(state.momentId)
      return moment === undefined
        ? 'Something has come up at work.'
        : situationOf(moment, state.variant)
    }

    case 'promotion-offer': {
      const title = occupationById(pending.occupationId ?? '').title
      return `They want to make you ${withArticle(title)}. More money, more of your week, and more of it on you. Take it?`
    }

    case 'bankruptcy': {
      const owed = formatMoney((pending.monthlyPay ?? 0) as Money)
      const both = (pending.options ?? []).length > 1
      return both
        ? `You owe ${owed} and there is no month ahead that clears it. The court will hear either a repayment plan or a liquidation. Which do you file?`
        : `You owe ${owed} and there is no month ahead that clears it. There is one road open to you at the courthouse.`
    }

    case 'money-shock': {
      const bill = formatMoney((pending.monthlyPay ?? 0) as Money)
      switch (pending.occupationId) {
        case 'scam':
          return `Money has gone out of your account that you did not send. ${bill}, and the bank is not going to help.`
        case 'repairs':
          return `The roof has been leaking for weeks and now the ceiling is down. ${bill} to put it right.`
        default:
          return `A hospital bill arrives for ${bill}. Nobody warned you it would be this much.`
      }
    }

    case 'crime-scene': {
      // The scene component draws the room; this is the fallback line.
      const state = decodeCrimeScene(pending.occupationId)
      return `${offenceById(state.offenceId)?.title ?? 'The job'} — you are in it now.`
    }

    case 'separation-record': {
      const sheet = separationFor(world, pending.personId)
      return sheet === undefined
        ? 'Your service is at an end.'
        : `${sheet.totalService} in ${sheet.branch}. This is your discharge record — everything the service will say about you from here.`
    }
    case 'article15': {
      const sheet = article15For(world, pending.personId, Number(pending.occupationId ?? 0) as Tick)
      return sheet === undefined
        ? 'The orderly room has paperwork for you.'
        : sheet.reduced
          ? `The company commander has imposed nonjudicial punishment. You have lost a grade. Sign for it.`
          : `The company commander has imposed nonjudicial punishment: ${sheet.offence}. Sign for it.`
    }
    case 'retirement-certificate':
      // The country is the PRESET'S, never a name typed into engine prose.
      return `Twenty years. ${sentenceCase(homelandName(world))} has something to say about that.`
    case 'branch-choice':
      return pending.occupationId === 'officer'
        ? 'A commission is a service, not a job. Which one?'
        : 'Three services are recruiting. Which one do you walk into?'
    case 'entry-test': {
      const score = world.service.get(pending.personId)?.aptitude ?? entryTestScore(world, pending.personId)
      return `The entry test comes back: ${String(score)}. ${sentenceCase(aptitudeWords(score))}`
    }
    case 'officer-preference': {
      const branch = world.spec.branches.find((b) => b.id === pending.occupationId)
      return branch === undefined
        ? 'What do you want to do?'
        : accessionWords(accessionOf(branch))
    }
    case 'specialty':
      // M-ENLIST §2. The branch is already answered by the time this is
      // asked, so the question is only ever about the trade.
      return isOfficerPending(pending)
        ? 'Which trade will you be commissioned into? Your degree opens these doors.'
        : 'What will you do in the uniform? Your test and your schooling open these doors.'
    case 'promotion-board': {
      const standing = boardStandingFor(world, pending.personId)
      return `The ${standing?.targetTitle ?? 'promotion'} board meets. Put your name in?`
    }
    case 'attend-school':
      {
        // The course has a NAME, and the player deciding whether to go
        // should be told which one it is.
        const school =
          pending.occupationId === null
            ? undefined
            : world.spec.schools.find((sc) => sc.id === pending.occupationId)
        return school === undefined
          ? 'A slot at an advanced school has opened. Take it?'
          : `A seat has opened at ${school.title}. Take it?`
      }
    case 'volunteer-deploy':
      return 'The unit is taking names for the next deployment. Volunteer?'
    case 'support-deployment': {
      const ally = pending.placeId === null ? undefined : world.nations.get(pending.placeId)
      return `${ally?.name ?? 'The country you are posted to'} has gone to war while you stand on its soil. Go home, or stay and fight beside them?`
    }
    case 'desperation': {
      // THE PROMPT HAS TO MATCH THE LEDGER. Found by playing: the moment is
      // reachable at the baseline pressure everybody carries, so a major on
      // $37,200 a year with $17,000 by met a screen telling him the money
      // was not there and not coming. It was there. The circumstance is
      // already modelled — behind, out of work, or neither — so the words
      // are read from it rather than assuming the worst case (Law 1).
      const behind = inArrears(world, person?.householdId ?? null)
      const jobless =
        !world.employment.has(pending.personId) && !isServing(world, pending.personId)
      const house = 'There is a house on the next street with something in it.'
      if (behind && jobless) {
        return `The money is not there and it is not coming. ${house}`
      }
      if (behind) return `The month will not close, however you move it around. ${house}`
      if (jobless) return `Another week with no work in it, and the savings only go so far. ${house}`
      return `Nobody is home on the next street, and nobody would know. ${house}`
    }
    case 'plea': {
      const offence = pending.occupationId === null ? undefined : offenceById(pending.occupationId)
      return `You are charged with ${offence?.title ?? 'theft'}. How do you plead?`
    }
    case 'first-aid': {
      const record = world.health.get(pending.personId)
      const where = record?.ailmentSite ?? null
      return where === null
        ? 'You are hit, and still awake. What do you do?'
        : `You are hit — the ${where} — and still awake. What do you do?`
    }
    case 'treat-casualty': {
      const casualty = pending.otherId === null ? undefined : world.people.get(pending.otherId)
      const record = pending.otherId === null ? undefined : world.health.get(pending.otherId)
      const where = record?.ailmentSite ?? null
      return `${casualty?.givenName ?? 'One of yours'} is down${where === null ? '' : ` — the ${where}`}, and you are the medic. What do you do?`
    }
    case 'unit-moment':
      return unitMomentById(momentIdOf(pending.occupationId))?.tell ?? 'The unit has something to say to you.'

    case 'reenlist-term': {
      const state = decodeContract(pending.occupationId)
      return state.code === 'RE-3'
        ? 'The waiver came through. The service will write you two more years — that is the offer, and there is not another one.'
        : 'How long do you want to sign for? A longer contract pays more and holds you longer.'
    }

    case 'reenlist-option': {
      const state = decodeContract(pending.occupationId)
      return state.bonus > 0
        ? `Your trade is short, so there is money on the table — ${formatMoney(state.bonus as Money)} — or you can take something that is not money.`
        : 'There is no bonus for your trade, but the service will still bargain: a school, or a promise about where you live.'
    }

    case 'service-contract': {
      const state = decodeContract(pending.occupationId)
      return state.code === 'enlist'
        ? 'The contract is drawn. Raise your right hand.'
        : `${String(state.termYears)} more years. The contract is drawn — raise your right hand.`
    }

    case 'trial': {
      const showing = caseSceneOf(world, pending.personId, pending.occupationId, pending.tick)
      return showing === null ? 'The court is sitting.' : showing.scene.tell
    }

    case 'crime-victim': {
      const taken = pending.monthlyPay ?? 0
      return `You come home to a forced door and the savings short by ${formatMoney(taken as Money)}.`
    }

    case 'combat-moment': {
      // THE TELL (owner's combat plan §2). The player is told how bad it
      // is BEFORE answering — that is what makes the matrix a read rather
      // than a lottery, and it is why the record can explain the outcome.
      const { sceneId, threat } = decodeScene(pending.occupationId)
      return sceneById(sceneId)?.tell[threat] ?? 'The squad is pinned. What do you do?'
    }
    case 'foremans-warning': {
      const role = pending.occupationId ? occupationById(pending.occupationId).title : 'the job'
      return `The foreman pulls you aside: the ${role} work has been slipping. What do you do?`
    }
    case 'retrain':
      return 'Signing again opens the trade question. Keep your specialty, or retrain?'
    case 'custom-birth':
      return 'A new life begins.' // log-only; never shown as a question
    case 'job-application':
      return 'Asked after work.' // log-only
    case 'walk-in-enlist':
      return 'Walked into the recruiting office.' // log-only
    case 'invest':
      return 'Bought into the market.' // log-only
    case 'divest':
      return 'Sold out of the market.' // log-only
    case 'borrow':
      return 'Took on a debt.' // log-only
    case 'buy-home':
      return 'Bought a home.' // log-only
    case 'habit':
      return 'Changed what you make time for.' // log-only
    case 'doctor':
      return 'Saw a doctor.' // log-only
    case 'rent-home':
      return 'Took a place on a lease.' // log-only
    case 'sell-home':
      return 'Sold the house.' // log-only
    case 'drop-out':
      return 'Left the course.' // log-only
    case 'vote':
      return 'Voted.' // log-only
    case 'stand':
      return 'Stood for office.' // log-only
    case 'campaign':
      return 'Campaigned.' // log-only
    case 'set-lever':
      return 'Set policy.' // log-only
    case 'seek-peace':
      return 'Sought peace.' // log-only
    case 'pay-down':
      return 'Paid down a debt.' // log-only
    case 'pay-off-plan':
      return 'Paid off the bankruptcy plan.' // log-only
    case 'school-request':
      return 'Asked for a school slot.' // log-only
    case 'unit-tryout':
      return 'Put in for selection.' // log-only
    case 'fitness-test':
      return 'Took the fitness test.' // log-only
    case 'extra-duty':
      return 'Picked up extra duty.' // log-only
    case 'scale-up':
      return 'Grew it into a company.' // log-only
    case 'take-public':
      return 'Took the company public.' // log-only
    case 'gamble':
      return 'Played the tables.' // log-only
    case 'buy-chips':
      return 'Bought chips.' // log-only
    case 'cash-out':
      return 'Cashed out.' // log-only
    case 'poker':
      return 'Sat down for a session.' // log-only
    case 'tournament':
      return 'Entered a tournament.' // log-only
    case 'study-poker':
      return 'Studied the game.' // log-only
    case 'turn-pro':
      return 'Went pro.' // log-only
    case 'seek-help':
      return 'Asked for help.' // log-only
    case 'try-out':
      return 'Tried out for the team.' // log-only
    case 'train':
      return 'Put the work in.' // log-only
    case 'rest-up':
      return 'Rested.' // log-only
    case 'take-offer':
      return 'Signed with a programme.' // log-only
    case 'declare-draft':
      return 'Declared for the draft.' // log-only
    case 'retire-sport':
      return 'Hung them up.' // log-only
    case 'take-fight':
      return 'Took a fight.' // log-only
    case 'endorse':
      return 'Signed an endorsement.' // log-only
    case 'second-act':
      return 'Chose what came next.' // log-only
    case 'offence':
      return 'Went and did it.' // log-only
    case 'court-friend':
      return 'Asked to court.' // log-only
    case 'proposal':
      return 'Proposed.' // log-only
    case 'courtship-end':
      return 'Ended the courtship.' // log-only
    case 'marriage-tend':
      return 'Made time for the marriage.' // log-only
    case 'social-call':
      return 'Spent time with a friend.' // log-only
    case 'child-try':
      return 'Tried for a child.' // log-only
    case 'walk-out':
      return 'Left the marriage.' // log-only
    case 'job-quit':
      return 'Quit the job.' // log-only
    case 'raise-request':
      return 'Asked for a raise.' // log-only
    case 're-enrolment':
      return 'Went back to school.' // log-only
    case 'spend-stance':
      return 'Settled how the money is carried.' // log-only
    case 'house-hunt':
      return 'Went looking for a place.' // log-only
    case 'convalesce-stance':
      return 'Chose how to carry the ailment.' // log-only
    case 'reenlist': {
      const record = world.service.get(pending.personId)
      const title = record ? rankTitle(world, record.branch, record.rank, record.commissioned === true) : 'soldier'
      // NOT "another four years": the term is chosen one prompt later, and
      // this promised a number the player was about to be asked for. At
      // twenty years it is not the same question at all, and the fork
      // should say so before the buttons do.
      const servedYears = record === undefined
        ? 0
        : Math.floor((pending.tick - record.enlistedAtTick) / TICKS_PER_YEAR)
      // THE WALL SAYS ITS OWN NAME (ADR-0032). At twelve years there is no
      // term on the table, and a prompt that said "sign on for another
      // term" would be describing a thing the service does not offer.
      const atTheWall = (pending.options ?? []).includes('indefinite')
      if (atTheWall) {
        return servedYears >= 20
          ? `Twelve years and more, ${title}. Indefinite status, or retire on the pension you have earned?`
          : `Twelve years, ${title}. The service stops writing terms here — go indefinite and serve on, or take off the uniform. Indefinite carries no term, and no term bonus.`
      }
      // Already indefinite and past twenty: the commitment is served and
      // the choice is genuinely theirs again, up to the thirty-year stop.
      if (record?.indefinite === true && servedYears >= 20) {
        const left = 30 - servedYears
        return left <= 0
          ? `Thirty years, ${title}. That is the end of it.`
          : `${String(servedYears)} years, ${title}. The pension is yours whenever you want it — or serve on. ${String(left)} year${left === 1 ? '' : 's'} left before the service retires you regardless.`
      }
      return servedYears >= 20
        ? `Twenty years in, ${title}. Sign for another term, or retire on the pension you have earned?`
        : `Your term is up, ${title}. Sign on for another term?`
    }
    case 'deployment-order': {
      const enemy = pending.otherId === null ? undefined : world.nations.get(pending.otherId)
      const record = world.service.get(pending.personId)
      const title = record ? rankTitle(world, record.branch, record.rank, record.commissioned === true) : 'soldier'
      return `Orders, ${title}: you are going to ${enemy?.name ?? 'the front'}. What do you do?`
    }
    case 'graduate': {
      return 'Your record is strong enough for graduate work. Two more years, and it is not cheap. Do you go?'
    }
    case 'debate': {
      const line = DEBATE_LINES[Math.abs(pending.tick) % DEBATE_LINES.length] ?? DEBATE_LINES[0]
      return line ?? 'The debate is tonight.'
    }
    case 'school-choice': {
      const child = pending.otherId === null ? undefined : world.people.get(pending.otherId)
      const name = child === undefined ? 'your child' : child.givenName
      return `${name} starts school this year. The private school charges, and the money comes out of the household every month. Where do they go?`
    }
    case 'major': {
      const where = pending.occupationId === 'trade' ? 'the trade school' : 'the university'
      return `You are enrolled at ${where}. What are you going to study?`
    }
    case 'key-hand': {
      const record = gamblerOf(world, pending.personId)
      const hand = keyHandFor(world, pending.tick, pending.personId, record.hoursPlayed, record.pokerSkill)
      return hand === null
        ? 'A big pot, and it is on you.'
        : `${hand.villain} moves all in. ${hand.read}`
    }

    default: {
      const never: never = pending.kind
      return String(never)
    }
  }
}

/**
 * The STAKES of a pending decision: short factual lines the player should see
 * before answering. Everything here is read from world state — the same facts
 * the records will cite — never invented for drama. An empty array is honest
 * when there is nothing more to say.
 */
export function describeStakes(world: World, pending: PendingDecision): string[] {
  const person = world.people.get(pending.personId)
  if (!person) return []
  const other = pending.otherId === null ? undefined : world.people.get(pending.otherId)
  const lines: string[] = []

  // Compatibility in words — the stakes speak the town's language, not the
  // model's numbers (P1).
  function matchWords(match: number): string {
    if (match >= 800) return 'People are rarely so well matched'
    if (match >= 650) return 'You are well matched'
    if (match >= 500) return 'You are different in ways that rub'
    return 'You are an odd match, and both of you know it'
  }

  switch (pending.kind) {
    case 'deployment-order': {
      const enemy = pending.otherId === null ? undefined : world.nations.get(pending.otherId)
      const home = homeland(world)
      if (enemy !== undefined && home !== undefined) {
        const gap = combatPowerOf(enemy) - combatPowerOf(home)
        lines.push(
          gap > 2
            ? `${sentenceCase(enemy.name)} outmatches us. This will be a hard tour.`
            : gap < -2
              ? `${sentenceCase(enemy.name)} is outmatched, which is not the same as safe.`
              : `${sentenceCase(enemy.name)} is a fair match for us.`,
        )
      }
      lines.push('Going is what the uniform is for; a tour runs ten months.')
      lines.push('Asking to be excused is allowed. It is rarely granted, and the asking is remembered.')
      lines.push('Refusing is a court-martial: time in a cell, a discharge for misconduct, and a record that follows you home.')
      break
    }
    case 'education': {
      // The modelled facts, not slogans: what each road actually pays in
      // THIS world's occupation table (P1).
      const bandFor = (level: 'trade' | 'college') => {
        const jobs = OCCUPATIONS.filter((o) => o.requires === level)
        if (jobs.length === 0) return null
        const top = Math.max(...jobs.map((o) => o.maxMonthlyPay))
        const names = jobs
          .slice()
          .sort((x, y) => y.maxMonthlyPay - x.maxMonthlyPay)
          .slice(0, 3)
          .map((o) => o.title)
          .join(', ')
        return { top, names }
      }
      const college = bandFor('college')
      const trade = bandFor('trade')
      if (college) {
        lines.push(`College is ${String(COLLEGE_YEARS)} years and opens ${college.names} — up to ${formatMoney(college.top as never)} a month.`)
      }
      if (trade) {
        lines.push(`Trade school is ${String(TRADE_YEARS)} years and opens ${trade.names} — up to ${formatMoney(trade.top as never)} a month.`)
      }
      lines.push('Working now means wages immediately, and the education question is closed.')
      break
    }
    case 'job-offer': {
      if (pending.monthlyPay !== null) {
        const current = world.employment.get(person.id)
        if (current) {
          const diff = pending.monthlyPay - current.monthlyPay
          lines.push(`You earn ${formatMoney(annualPay(current.monthlyPay))} a year now; this pays ${formatMoney(annualPay(pending.monthlyPay))}.`)
          if (diff < 0) lines.push('That is a pay cut.')
        } else {
          lines.push(`It pays ${formatMoney(annualPay(pending.monthlyPay))} a year. You have no wages today.`)
        }
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const shortfall = householdCosts(world, household) - householdIncome(world, household)
        if (household.savings < 0) {
          lines.push(`The household is ${formatMoney(-household.savings as never)} behind.`)
        } else if (shortfall > 0) {
          lines.push(`The household runs ${formatMoney(shortfall as never)} short each month right now.`)
        }
      }
      break
    }
    case 'move-out': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const others = household.memberIds.filter((id) => id !== person.id).length
        lines.push(`You live with ${others} ${others === 1 ? 'person' : 'people'} now.`)
      }
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const job = world.employment.get(person.id)
      if (target && job) {
        lines.push(`Rent in ${target.name} is ${formatMoney(rentFor(target.desirability))} a month against your ${formatMoney(annualPay(job.monthlyPay))} a year.`)
      }
      break
    }
    case 'courtship': {
      if (other) {
        const otherAge = ageAt(other.birthTick, pending.tick)
        const job = world.employment.get(other.id)
        lines.push(`${other.givenName} is ${otherAge}${job ? ' and working' : ''}.`)
        // The same factors the record will cite, in words (P1).
        lines.push(`${matchWords(compatibility(person, other))}.`)
        const tie = relationshipBetween(world, person.id, other.id)
        if (tie) {
          const years = Math.floor((pending.tick - tie.formedAtTick) / TICKS_PER_YEAR)
          lines.push(years >= 1 ? `You have known each other ${String(years)} year${years === 1 ? '' : 's'}.` : 'You have not known each other long.')
        }
        lines.push('Courting closes the door on other courtships while it lasts.')
      }
      break
    }
    case 'marriage': {
      const tie = pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie) {
        const years = Math.floor((pending.tick - tie.typeSinceTick) / TICKS_PER_YEAR)
        lines.push(years >= 1 ? `You have been courting ${String(years)} year${years === 1 ? '' : 's'}.` : 'The courtship is young.')
      }
      if (other) {
        lines.push(`${matchWords(compatibility(person, other))}.`)
        const earners =
          (world.employment.has(person.id) ? 1 : 0) + (world.employment.has(other.id) ? 1 : 0)
        lines.push(
          earners === 2
            ? 'Two wages would share one roof.'
            : earners === 1
              ? 'One of you has work today.'
              : 'Neither of you has work today.',
        )
      }
      break
    }
    case 'child': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const children = household.memberIds.filter((id) =>
          world.people.get(id)?.parentIds.includes(person.id),
        ).length
        lines.push(children === 0 ? 'It would be your first.' : `You have ${children} at home already.`)
        // The number that decides it, honestly (P1, corrected by review
        // S2): lifestyle spending flexes with the surplus, so a child's
        // cost mostly comes out of lifestyle, not out of the net. Show the
        // month AS IT WOULD BE, at the household's own spending habit.
        const net = monthlyNetOf(world, household)
        const surplusNow = householdIncome(world, household) - householdCosts(world, household)
        const surplusThen = surplusNow - LIVING_COST_CHILD
        if (surplusNow > 0 && surplusThen > 0) {
          const netThen = Math.floor((surplusThen * net) / surplusNow)
          lines.push(
            `A child adds about ${formatMoney(LIVING_COST_CHILD)} a month; lifestyle spending absorbs most of it. The month would clear about ${formatMoney(netThen as never)}.`,
          )
        } else if (surplusThen <= 0) {
          lines.push(
            `A child adds about ${formatMoney(LIVING_COST_CHILD)} a month — and that would put the month under water.`,
          )
        } else {
          lines.push(`A child adds about ${formatMoney(LIVING_COST_CHILD)} a month.`)
        }
        if (inArrears(world, household.id)) {
          lines.push('The household is already behind on money.')
        }
      }
      break
    }
    case 'move-house': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const current = household ? world.places.get(household.placeId) : undefined
      if (current && target && household) {
        const rentNow = rentFor(current.desirability)
        const rentThen = rentFor(target.desirability)
        if (target.desirability > current.desirability) {
          lines.push(`${target.name} is a better street than ${current.name}.`)
          lines.push(`Rent rises from ${formatMoney(rentNow)} to ${formatMoney(rentThen)} a month.`)
        } else {
          lines.push(`Rent falls from ${formatMoney(rentNow)} to ${formatMoney(rentThen)} a month.`)
          if (household.savings < 0) {
            lines.push(`The household is ${formatMoney(-household.savings as never)} behind; staying digs deeper.`)
          }
        }
        if (household.memberIds.length > 1) {
          lines.push(`The whole household of ${household.memberIds.length} moves with you.`)
        }
      }
      break
    }
    case 'retirement': {
      const job = world.employment.get(person.id)
      if (job) {
        lines.push(`Retiring ends your ${formatMoney(annualPay(job.monthlyPay))} a year.`)
        const started = job.startedAtTick
        const years = Math.floor((pending.tick - started) / TICKS_PER_YEAR)
        if (years >= 1) lines.push(`You have held this job ${String(years)} year${years === 1 ? '' : 's'}.`)
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        lines.push(
          household.savings > 0
            ? `The household has ${formatMoney(household.savings)} put by.`
            : 'There is nothing put by.',
        )
        // The number that actually decides this: how long the money lasts.
        const annualBasics = householdCosts(world, household) * 12
        if (household.savings > 0 && annualBasics > 0) {
          const years = Math.floor(household.savings / annualBasics)
          lines.push(
            years >= 1
              ? `At today's costs that carries the household about ${String(years)} year${years === 1 ? '' : 's'}.`
              : 'At today\'s costs that is less than a year.',
          )
        }
      }
      lines.push('You can keep working as long as you live; the question returns each birthday.')
      break
    }
    case 'separation': {
      const tie = pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie) {
        const years = Math.floor((pending.tick - tie.formedAtTick) / TICKS_PER_YEAR)
        if (years >= 1) lines.push(`You have been together ${String(years)} years.`)
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household && other) {
        const children = household.memberIds.filter((id) => {
          const member = world.people.get(id)
          return member ? member.parentIds.includes(person.id) && member.parentIds.includes(other.id) : false
        }).length
        if (children > 0) lines.push(`${children} ${children === 1 ? 'child lives' : 'children live'} at home. One of you moves out; they stay.`)
      }
      // Name what actually weakened it — the same modelled strains the
      // record will cite (P1).
      if (other) {
        const strains: string[] = []
        if (household && inArrears(world, household.id)) strains.push('money has been short')
        // A uniform is work (P2 carry-note: the stakes once told a serving
        // spouse they had none).
        const personWorks = world.employment.has(person.id) || isServing(world, person.id)
        const otherWorks = world.employment.has(other.id) || isServing(world, other.id)
        if (!personWorks && !otherWorks) {
          strains.push('neither of you has work')
        }
        if (compatibility(person, other) < 550) strains.push('you have always been different people')
        if (strains.length > 0) {
          const joined = strains.join('; ')
          lines.push(`What wore it down: ${joined}.`)
        } else {
          lines.push('Nothing names itself; the years alone have worn it.')
        }
      }
      lines.push('Staying is a real attempt — it restores some closeness, but the strains remain.')
      break
    }
    case 'enlist': {
      // This world's first branch, not Classic's — the stakes screen must
      // not quote a pay table the player's preset does not use.
      const firstBranch = world.spec.branches[0]
      // A GRADUATE IS ABOUT TO BE OFFERED A COMMISSION, so quoting them the
      // E-1 figure one screen earlier is a wrong number, not a simplification
      // (military review, should-fix 5).
      const graduate = commissionsOnEntry(world, pending.personId)
      lines.push(
        `A term is ${String(SERVICE_TERM_MONTHS / 12)} years. Pay starts around ${formatMoney(annualPay(firstBranch ? servicePayOn(firstBranch, 0) : (0 as Money)))} a year, and rises with rank.`,
      )
      if (graduate && firstBranch) {
        lines.push(
          `Your degree opens the officer route: a commission starts nearer ${formatMoney(annualPay(officerPayOn(firstBranch, 0)))} a year, on a longer obligation. You will be asked which.`,
        )
      }
      lines.push('Service ends any civilian job; a specialty can open doors when you come home.')
      const wars = activeWars(world)
      const home = homeland(world)
      if (home && wars.some((w) => w.a === home.id || w.b === home.id)) {
        lines.push(`${sentenceCase(homelandName(world))} is at war. Service now will not be quiet.`)
      } else if (wars.length > 0) {
        lines.push(`There is war abroad — ${String(wars.length)} conflict${wars.length === 1 ? '' : 's'} in the news. ${sentenceCase(homelandName(world))} is not in them today.`)
      }
      break
    }

    case 'commission': {
      // The facts the world already models, on the one decision the owner
      // asked for. Every number here is read, not asserted.
      const branch = world.spec.branches[0]
      if (branch) {
        const topEnlisted = branch.ranks.length - 1
        const topOfficer = (branch.officerRanks ?? branch.ranks).length - 1
        lines.push(
          `Enlisted: starts at ${formatMoney(annualPay(servicePayOn(branch, 0)))} a year, first stripe in about six months, and ${branch.ranks[topEnlisted] ?? 'the top'} at ${formatMoney(annualPay(servicePayOn(branch, topEnlisted)))} is as far as it goes.`,
        )
        lines.push(
          `Commissioned: starts at ${formatMoney(annualPay(officerPayOn(branch, 0)))}, but the first step takes two years — and the ladder runs to ${(branch.officerRanks ?? [])[topOfficer] ?? 'the top'} at ${formatMoney(annualPay(officerPayOn(branch, topOfficer)))}.`,
        )
      }
      lines.push(
        `The obligation is not the same either: ${String(SERVICE_TERM_MONTHS / 12)} years enlisted, 6 for a commission.`,
      )
      lines.push('A senior sergeant still out-earns a new lieutenant. The commission is the longer road, not the shortcut.')
      break
    }

    case 'specialty': {
      // An officer does not go to basic, and their trade has its own name.
      const asOfficer = isOfficerPending(pending)
      for (const id of pending.options) {
        const sp = world.spec.specialties.find((x) => x.id === id)
        if (!sp) continue
        const risky = sp.exposure.directCombat >= 500 || sp.exposure.convoy >= 500
        // Name the doors it opens, not just that doors exist (P1).
        const unlocks =
          sp.civilianUnlocks.length > 0
            ? ` — opens ${sp.civilianUnlocks.map((id) => occupationById(id).title).join(', ')} after the service`
            : ''
        lines.push(`${specialtyTitleFor(sp, asOfficer)} (${branchName(world, sp.branch)}): ${String(sp.schoolMonths)} months' school after ${asOfficer ? 'the commissioning course' : 'basic'}${risky ? ' — the sharp end, if it ever comes to that' : ''}${unlocks}.`)
      }
      break
    }

    case 'reenlist': {
      const record = world.service.get(pending.personId)
      if (record) {
        const years = Math.floor((pending.tick - record.enlistedAtTick) / TICKS_PER_YEAR)
        lines.push(`${String(years)} year${years === 1 ? '' : 's'} served; ${rankTitle(world, record.branch, record.rank, record.commissioned === true)}, ${formatMoney(annualPay(record.monthlyPay))} a year.`)
        lines.push(
          `Leaving keeps the record${specialtyFor(world, record.specialtyId).civilianUnlocks.length > 0 ? ' and the trade' : ''}; staying means choosing a new term next.`,
        )
      }
      break
    }

    case 'convalesce': {
      const record = world.health.get(pending.personId)
      if (record) {
        // How bad it actually is, in words scaled to the model (P1).
        lines.push(
          record.severity >= 750
            ? 'It is grave — the kind people do not always come back from.'
            : record.severity >= 600
              ? 'It is serious, and getting through it will take months.'
              : 'It is serious enough that how you carry it matters.',
        )
        lines.push('Resting heals faster but the work will slip.')
        lines.push('Pushing on keeps the job sharp and the body slow to mend — and an illness this deep can already leave a permanent mark.')
        const job = world.employment.get(person.id)
        if (job) lines.push(`You are working as ${withArticle(occupationById(job.occupationId).title)}.`)
      }
      break
    }

    case 'promotion-board': {
      // Everything here is what the person themselves would know: their own
      // standing, their own time in grade. The board's slot arithmetic stays
      // the board's.
      const standing = boardStandingFor(world, pending.personId)
      if (standing) {
        // The bar the board ACTUALLY applies: base cutoff plus what the file
        // of prior non-selections adds (P2 carry-note — the stakes used to
        // print the base and the resolution used the raised one).
        const realBar = standing.cutoff + standing.filePenalty
        lines.push(
          `Your points: ${String(standing.points.total)} against the ${standing.targetTitle} cutoff of ${String(realBar)} for your trade${standing.priorPassOvers > 0 ? ' (raised by the file)' : ''}.`,
        )
        lines.push(
          `Evaluation ${String(standing.points.performance)} · fitness ${String(standing.points.fitness)} · badges ${String(standing.points.badges)} · decorations ${String(standing.points.decorations)} · seniority ${String(standing.points.seniority)}.`,
        )
        lines.push(`${String(standing.timeInGrade)} months in grade; the board asks ${String(standing.tigNeeded)}.`)
        if (standing.priorPassOvers > 0) {
          lines.push(
            `The file shows ${String(standing.priorPassOvers)} prior non-selection${standing.priorPassOvers === 1 ? '' : 's'}; the board reads it.`,
          )
        }
        lines.push('Schools, the fitness test and decorations all raise the points. An unready packet goes in the file; letting it go by is quieter — and a choice on the record too.')
      }
      break
    }

    case 'attend-school': {
      lines.push('A school sharpens the work — and can earn the rating the board counts.')
      lines.push('The slot is this month or not at all.')
      break
    }

    case 'foremans-warning': {
      const job = world.employment.get(person.id)
      if (job) {
        lines.push(
          job.performance < 200
            ? 'The work is at the edge of what the foreman will carry.'
            : 'The work has slipped low enough to be noticed.',
        )
        lines.push(`The job pays ${formatMoney(annualPay(job.monthlyPay))} a year.`)
      }
      lines.push('Knuckling down is a real effort with a real cost in sweat; shrugging changes nothing.')
      lines.push('Either way, keep sliding and the job will not keep itself. This warning comes once.')
      break
    }

    case 'retrain': {
      const record = world.service.get(pending.personId)
      const current = record ? specialtyFor(world, record.specialtyId) : undefined
      if (current) {
        lines.push(`Today you are ${withArticle(current.title)}.`)
      }
      for (const id of pending.options) {
        if (id === 'keep') continue
        const sp = world.spec.specialties.find((x) => x.id === id)
        if (!sp) continue
        // What a serving soldier knows better than any recruit: where the
        // trade stands when it comes to it, and how its board runs
        // (military review S4 — omitting these rewarded out-of-game
        // knowledge).
        const risky = sp.exposure.directCombat >= 500 || sp.exposure.convoy >= 500
        const cutoffShift =
          current === undefined ? 0 : sp.boardCutoffOffset - current.boardCutoffOffset
        const board =
          cutoffShift === 0
            ? ''
            : cutoffShift > 0
              ? ` — its board cuts ${String(cutoffShift)} points higher`
              : ` — its board cuts ${String(-cutoffShift)} points lower`
        const unlocks =
          sp.civilianUnlocks.length > 0
            ? ` — opens ${sp.civilianUnlocks.map((o) => occupationById(o).title).join(', ')} after the service`
            : ''
        lines.push(
          `${sp.title}: ${String(sp.schoolMonths)} months' school${risky ? ' — the sharp end, if it ever comes to that' : ''}${board}${unlocks}.`,
        )
      }
      lines.push(
        'Retraining sends you back through the schoolhouse — no orders until it finishes. The record, the rank, and every trade already served stay yours.',
      )
      break
    }

    case 'plea': {
      // C3 §13. THE TERMS ARE ON THE SCREEN. A deal the player cannot read
      // is not a choice, and the gap between the offer and what a trial
      // risks is the entire reason plea bargaining exists.
      const charge = pending.occupationId === null ? undefined : offenceById(pending.occupationId)
      if (charge !== undefined) {
        const deal = pleaDealFor(world, person.id, charge, pending.tick)
        if (deal !== null) {
          lines.push(describePleaDeal(deal))
          lines.push(
            `Standing trial risks the full ${charge.title} charge — up to ${sentenceInWords(charge.maxMonths)} — and refusing a deal means no discount if it goes badly.`,
          )
        } else {
          lines.push(`The state has offered nothing. The charge is ${charge.title}.`)
        }
      }
      break
    }

    case 'crime-victim': {
      // C3 §15. THE THIRD OPTION IS NOT A FREE ONE, and the player has to
      // know that before they take it — using force does not clear you,
      // in this game or in the country it is modelled on.
      lines.push('Meeting them with force does not clear you: the county decides what to make of it, and a fleeing burglar shot in the back is the weakest case there is.')
      lines.push('Reporting it gives the constables something to work with — most burglaries are never solved, and a report is worth real odds rather than a certainty.')
      lines.push('If they catch whoever did it, the court can order the money paid back.')
      lines.push('Letting it go costs nothing and is on the record all the same.')
      break
    }

    case 'unit-moment': {
      // NOBODY IS SHOOTING IN ANY OF THESE, and the player has to be told,
      // because they have learned that push/hold/cover means a firefight.
      // Here it means a place in the unit, a body, or nothing at all but
      // how a thing is carried afterwards.
      const moment = momentIdOf(pending.occupationId)
      if (moment === 'selection-day') {
        lines.push('The course is what beats people here \u2014 an injury or a quiet walk to the truck, not an enemy.')
        lines.push('Emptying the tank passes more often and costs a body more often. Nursing an injury rarely passes.')
      } else if (moment === 'packet-drop') {
        lines.push('A packet is a commitment, not a casualty. The file allows two tries at selection.')
      } else if (moment === 'losing-one') {
        lines.push('Nothing here is dangerous. It is only hard.')
      } else {
        lines.push('What is being judged is the standard, not the risk.')
      }
      break
    }

    case 'combat-moment': {
      const { threat } = decodeScene(pending.occupationId)
      lines.push(
        threat === 'overrun'
          ? 'This one is as bad as it gets. Going forward into it is the most dangerous thing you can do — and the likeliest to be written up.'
          : threat === 'heavy'
            ? 'It is a real fight. Going forward buys ground and costs for it; standing your ground is steady work.'
            : 'It is not much of a contact. Going forward here is cheap, and cheap is where reputations start.',
      )
      lines.push('Covering survives it best — and none of the three is safe. Every answer can kill you.')
      lines.push('All three go on the record, whichever you pick.')
      break
    }

    case 'desperation': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        if (household.savings < 0) {
          lines.push(`The household is ${formatMoney(-household.savings as never)} behind.`)
        }
        const shortfall = householdCosts(world, household) - householdIncome(world, household)
        if (shortfall > 0) {
          lines.push(`It runs ${formatMoney(shortfall as never)} short every month.`)
        }
      }
      lines.push('A house on this street holds a few hundred dollars. Taking it would be real money in a real pocket.')
      lines.push('The town sees a lot. If it is seen, the courthouse answers within the month, and a record follows you into every job you ever ask for.')
      lines.push('Going without is a choice too, and it goes on the record as one.')
      break
    }

    case 'plea': {
      const offence = pending.occupationId === null ? undefined : offenceById(pending.occupationId)
      const priors = world.criminal.get(person.id)?.convictions.length ?? 0
      if (offence) {
        lines.push(
          `${offence.title[0]?.toUpperCase() ?? ''}${offence.title.slice(1)} is ${withArticle(GRADE_TITLES[offence.grade])}: ${
            offence.maxMonths === 0
              ? 'a fine'
              : `up to ${offence.maxMonths >= 24 ? `${String(Math.floor(offence.maxMonths / 12))} years` : `${String(offence.maxMonths)} months`}`
          }.`,
        )
      }
      if (priors > 0) {
        lines.push(`The file shows ${String(priors)} prior conviction${priors === 1 ? '' : 's'}. The court reads it before you speak.`)
      } else {
        lines.push('The file is clean, which is worth something here.')
      }
      // What the plea actually buys, per offence, rather than a promise
      // the sentencing code does not keep (review S4).
      const canBeFined = offence === undefined || offence.fine > 0
      lines.push(
        priors === 0 && canBeFined
          ? 'Pleading guilty is a certain conviction and a lighter hand — with a clean file it can end in a fine where a trial might have meant months.'
          : priors === 0
            ? 'Pleading guilty is a certain conviction and a shorter term. This charge carries no fine; it is months either way.'
            : 'Pleading guilty is a certain conviction and a shorter term. The file rules out a fine.',
      )
      lines.push('Standing trial can end in acquittal and can end worse. The court has heard the case either way.')
      break
    }

    case 'first-aid':
    case 'treat-casualty': {
      const casualtyId = pending.kind === 'first-aid' ? pending.personId : pending.otherId
      const record = casualtyId === null ? undefined : world.health.get(casualtyId)
      if (record) {
        // How bad it is, in the words the model actually supports.
        lines.push(
          record.severity >= 850
            ? 'It is bleeding badly. This is the kind people do not always come back from.'
            : record.severity >= 720
              ? 'It is serious, and it is not going to hold on its own.'
              : 'It is bad, but it is the kind that gets dressed and carried.',
        )
        if (record.ailmentKind !== null && record.ailmentSite !== null) {
          lines.push(`${withArticle(String(record.ailmentKind))} to the ${record.ailmentSite}.`)
        }
      }
      if (pending.kind === 'first-aid') {
        lines.push('Pressing the wound works best and keeps you in the open longest.')
        lines.push('Calling out brings better hands, and costs the minutes it takes them.')
        lines.push('Lying still is the safest thing to do and the least help.')
      } else {
        lines.push('Working it where they lie is the best medicine and the worst cover.')
        lines.push('Dragging them out first costs them minutes and buys you both cover.')
        lines.push('Calling the evacuation is steadier, and slower.')
        lines.push('Your training counts here — this is the trade.')
      }
      lines.push('Whatever you choose, a wound this bad can still be lost.')
      break
    }

    case 'support-deployment': {
      const ally = pending.placeId === null ? undefined : world.nations.get(pending.placeId)
      const enemy = pending.otherId === null ? undefined : world.nations.get(pending.otherId)
      if (ally && enemy) {
        lines.push(`${ally.name} is at war with ${enemy.name}${
          // The war's own state, which is what the danger is computed from.
          (() => {
            const war = alliedWars(world).find((o) => o.ally.id === ally.id)
            return war?.war.warPhase !== undefined && war?.war.warPhase !== null
              ? `, in its ${war.war.warPhase}`
              : ''
          })()
        }.`)
      }
      lines.push('Staying makes it a real tour: ten months, the same danger as any front, and the same way home.')
      lines.push(`${sentenceCase(homelandName(world))} is not in this war. Going home costs you nothing and no one will hold it against you.`)
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const children = household.memberIds.filter((id) =>
          world.people.get(id)?.parentIds.includes(person.id),
        ).length
        if (children > 0) {
          lines.push(`${String(children)} ${children === 1 ? 'child' : 'children'} at home.`)
        }
      }
      break
    }

    case 'volunteer-deploy': {
      const home = homeland(world)
      const war = home === undefined ? undefined : activeWars(world).find((w) => w.a === home.id || w.b === home.id)
      if (war && home) {
        const enemy = world.nations.get(war.a === home.id ? war.b : war.a)
        if (enemy) lines.push(`The war is with ${enemy.name}${war.warPhase !== null ? `, in its ${war.warPhase}` : ''}.`)
      }
      lines.push('A tour is ten months. Your term holds while you are out there — the boat home comes first.')
      lines.push('Orders can still find you either way; volunteering only stops the waiting.')
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const children = household.memberIds.filter((id) =>
          world.people.get(id)?.parentIds.includes(person.id),
        ).length
        if (children > 0) lines.push(`${String(children)} ${children === 1 ? 'child' : 'children'} at home.`)
      }
      break
    }

    default:
      break
  }
  return lines
}

/**
 * Refusing orders. The court-martial the owner asked for, built entirely
 * out of consequences this game already models: a sentence served in a
 * cell, a discharge for misconduct, and a conviction that the hiring gate
 * and the enlistment gate both read for years afterwards.
 *
 * It is deliberately not survivable-as-if-nothing-happened. The player was
 * told all three costs before answering (describeStakes), which is what
 * makes it a decision rather than a trap.
 */
function refuseOrders(
  world: World,
  tick: Tick,
  person: Person,
  record: NonNullable<ReturnType<World['service']['get']>>,
  enemyId: EntityId,
): void {
  const enemy = world.nations.get(enemyId)
  const sentenceMonths = 9

  recordEvent(world, tick, {
    type: 'refused-orders',
    subjectId: person.id,
    otherId: enemyId,
    detail: enemy?.name ?? 'the front',
  })

  // The court. Same shape as any other conviction, so the record tab, the
  // hiring drag and the enlistment bar all read it without knowing what it
  // was for.
  const existing = world.criminal.get(person.id)
  world.criminal.set(person.id, {
    personId: person.id,
    convictions: [
      ...(existing?.convictions ?? []),
      { kind: 'refusing-orders', tick, sentenceMonths, fine: 0 },
    ],
    jailedUntilTick: (tick + sentenceMonths) as Tick,
  })
  recordEvent(world, tick, {
    type: 'was-convicted',
    subjectId: person.id,
    detail: `jail:${String(sentenceMonths)}`,
  })

  // And out of the service, for the reason it actually was.
  discharge(
    world,
    tick,
    person,
    record,
    'misconduct',
    [factor('own-choice', 1000), factor('under-orders', 1000)],
    Stream.CombatResolution,
  )

  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'deployment',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('under-orders', 1000)],
    chosen: `refused orders to ${enemy?.name ?? 'the front'}`,
    rejected: ['to go where they were sent'],
    streamId: Stream.CombatResolution,
  })
}
