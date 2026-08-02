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
import { educationRank, OCCUPATIONS, occupationById } from './content.js'
import { sentenceCase, withArticle } from './text.js'
import { canAfford, householdCosts, householdIncome, inArrears, monthlyNetOf, setSpendStance } from './finances.js'
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
import { activeWars, homeland } from './geopolitics.js'
import { alliedWars } from './deployment.js'
import { answerDesperation, isJailed, resolveCourt } from './crime.js'
import { GRADE_TITLES, offenceById } from './content.js'
import { adjustAilmentSeverity, applyConvalescence, inflictWound, isSeverelyAiling } from './health.js'
import { grantCampaignMedal, grantQualificationBadge, grantValor, grantWoundRecognition } from './awards.js'
import {
  addServiceQualification,
  applyBoardPromotion,
  assignServiceUnit,
  boardStandingFor,
  boostServicePerformance,
  discharge as dischargeService,
  enlistPerson,
  enlistmentBar,
  isServing,
  rankTitle,
  recruitingDriveActive,
  reenlist as reenlistService,
  retrainSpecialty,
  schoolOptionsFor,
  setServiceFitness,
  unitOptionsFor,
  veteranUnlocks,
} from './service.js'
import { MAX_FITNESS_POINTS, schoolById, specialUnitById } from './content.js'
import { placesOfKind } from './worldgen.js'
import {
  BRANCH_NAMES,
  meetsRequirement,
  SERVICE_TERM_MONTHS,
  servicePay,
  SPECIALTIES,
  specialtyById,
} from './content.js'
import { rentFor } from './content.js'
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
} from './systems.js'
import type { PendingDecision, PendingKind, Person, Sex, World } from './types.js'

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
export function applyForJob(world: World, occupationId: string): { hired: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { hired: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { hired: false, reason: 'A decision is already waiting.' }
  const occupation = OCCUPATIONS.find((o) => o.id === occupationId)
  if (!occupation) return { hired: false, reason: 'No such trade in town.' }

  const tick = world.tick
  const age = ageAt(person.birthTick, tick)
  if (age < 18) return { hired: false, reason: 'Not yet eighteen.' }
  if (isServing(world, person.id)) {
    return { hired: false, reason: 'The uniform is a full-time career; leave the service first.' }
  }
  const education = world.education.get(person.id)
  if (education?.enrolledIn !== null && education !== undefined && educationRank(education.enrolledIn) > 2) {
    return { hired: false, reason: 'Full-time study fills the days.' }
  }
  if (isSeverelyAiling(world, person.id)) {
    return { hired: false, reason: 'Too ill or hurt to take new work this month.' }
  }
  // Jail is absence (C1) — runEmployment has always known that and this
  // verb never did, so a jailed player could be hired from a cell. Reachable
  // the moment C2 let the player go to jail at all.
  if (isJailed(world, person.id)) {
    return { hired: false, reason: 'Nobody is hiring out of a cell.' }
  }
  const current = world.employment.get(person.id)
  if (current?.occupationId === occupationId) {
    return { hired: false, reason: 'This is already the work they do.' }
  }
  // One asking a month: the same month re-rolls the same answer, and a life
  // story should not carry ten identical rejections dated the same day.
  if (world.player.log.some((entry) => entry.kind === 'job-application' && entry.tick === tick)) {
    return { hired: false, reason: 'One asking a month. The town knows where to find you.' }
  }

  // The asking is a player input — logged before the answer, so replay
  // walks the same road.
  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    tick,
    kind: 'job-application',
    choice: occupationId,
  })
  world.player.nextDecisionId += 1

  const unlocked = veteranUnlocks(world, person.id)
  const qualified =
    meetsRequirement(education?.level ?? 'none', occupation.requires) || unlocked.includes(occupation.id)
  if (!qualified) {
    return { hired: false, reason: `${occupation.title} asks for ${occupation.requires === 'college' ? 'college' : occupation.requires === 'trade' ? 'trade school' : 'more schooling'} — the papers are not there.` }
  }

  const workplaces = placesOfKind(world, 'workplace')
  if (workplaces.length === 0) return { hired: false, reason: 'No workplace stands in town.' }

  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 9999)
  // Asking beats waiting for the town to come to you — but a big step up
  // from today's wage is a harder door, and none of it is a sure thing.
  const drive = Math.floor((person.traits.ambition + person.traits.diligence) / 2)
  const stretch = current !== undefined && occupation.minMonthlyPay > Math.floor(current.monthlyPay * 13 / 10) ? 150 : 0
  if (!rng.chance(450 + Math.floor(drive / 4) - stretch, 1000)) {
    recordEvent(world, tick, { type: 'turned-down', subjectId: person.id, detail: occupation.title })
    return { hired: false, reason: `No place for ${withArticle(occupation.title)} this month. The asking is on the record.` }
  }

  const workplace = rng.pick(workplaces)
  const pay = rng.nextIntInclusive(occupation.minMonthlyPay, occupation.maxMonthlyPay) as Money
  hirePerson(world, tick, person, occupation, workplace.id, pay, [
    factor('own-choice', 1000),
    factor('qualified-for-role', 500 + educationRank(education?.level ?? 'none') * 100),
  ])
  return { hired: true, reason: '' }
}

/**
 * Walk into the recruiting office, now, from the Service tab. Eligible, the
 * which-uniform question follows immediately; barred, the reason comes back
 * in plain words instead of a silent dead end.
 */
export function requestEnlistment(world: World): { asked: boolean; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { asked: false, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { asked: false, reason: 'A decision is already waiting.' }

  const bar = enlistmentBar(world, person, world.tick)
  if (bar !== null) return { asked: false, reason: bar }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    tick: world.tick,
    kind: 'walk-in-enlist',
    choice: 'asked',
  })
  world.player.nextDecisionId += 1

  askSpecialty(world, world.tick, person.id)
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
  if (world.tick - record.enlistedAtTick <= 2 + specialtyById(record.specialtyId).schoolMonths) {
    return { attended: false, reason: 'Finish the pipeline first.' }
  }
  // A retrain restarts the pipeline for the NEW trade (P2).
  if (
    record.specialtyChangedAtTick !== null &&
    world.tick - record.specialtyChangedAtTick <= specialtyById(record.specialtyId).schoolMonths
  ) {
    return { attended: false, reason: 'Finish the pipeline first.' }
  }
  const school = schoolById(schoolId)
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
    tick: world.tick,
    kind: 'school-request',
    choice: schoolId,
  })
  world.player.nextDecisionId += 1

  const rng = openStream(world.seed, Stream.Employment, person.id, world.tick + 8777)
  if (!rng.chance(1, 3)) {
    return { attended: false, reason: `No slot at ${school.title} this cycle. Ask again next season.` }
  }

  recordEvent(world, world.tick, { type: 'completed-training', subjectId: person.id, detail: school.title })
  const badgeEvent = recordEvent(world, world.tick, {
    type: 'earned-qualification',
    subjectId: person.id,
    detail: school.badge,
  })
  grantQualificationBadge(world, world.tick, person.id, badgeEvent, school.badge)
  boostServicePerformance(world, person.id, school.performanceBoost)
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'training',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('ambition', person.traits.ambition)],
    chosen: `asked for and got a slot at ${school.title}`,
    rejected: [],
    streamId: Stream.Employment,
  })
  return { attended: true, reason: '' }
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
  const unit = specialUnitById(unitId)
  if (!unit) return { joined: false, reason: 'No such unit.' }
  const option = unitOptionsFor(world, person.id).find((o) => o.id === unitId)
  if (!option) return { joined: false, reason: 'No such unit.' }
  if (!option.open) return { joined: false, reason: option.reason }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    tick: world.tick,
    kind: 'unit-tryout',
    choice: unitId,
  })
  world.player.nextDecisionId += 1

  const rng = openStream(world.seed, Stream.Employment, person.id, world.tick + 7333)
  const margin = Math.max(10, Math.min(400, record.performance - unit.minPerformance + 60))
  const selected = rng.chance(margin, unit.selectionDenominator)

  if (selected) {
    assignServiceUnit(world, person.id, unit.id)
    recordEvent(world, world.tick, { type: 'joined-unit', subjectId: person.id, detail: unit.id })
    recordDecision(world, world.tick, {
      subjectId: person.id,
      decision: 'selection',
      significance: 'defining',
      inputs: [factor('own-choice', 1000), factor('strong-performance', record.performance)],
      chosen: `selected for ${unit.name}`,
      rejected: [],
      streamId: Stream.Employment,
    })
    return { joined: true, reason: '' }
  }

  recordEvent(world, world.tick, { type: 'dropped-selection', subjectId: person.id, detail: unit.id })
  recordDecision(world, world.tick, {
    subjectId: person.id,
    decision: 'selection',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('strong-performance', record.performance)],
    chosen: `went to ${unit.name} selection; came back without it`,
    rejected: [],
    streamId: Stream.Employment,
  })
  return { joined: false, reason: `Selection said not this time. The trying is on the record.` }
}

/**
 * Train for the fitness test, from the Service tab. The TEST is mandatory
 * and annual for everyone — nobody opts out of it, and nobody keeps a score
 * the body no longer holds. The player's hand on it is TRAINING: a real
 * bump now, twice a year at most, and age still gets its say when the test
 * comes around.
 */
export function trainFitness(world: World): { trained: boolean; score: number; reason: string } {
  const person = playerPerson(world)
  if (!person || person.deathTick !== null) return { trained: false, score: 0, reason: 'Nobody is being played.' }
  if (world.player.pending !== null) return { trained: false, score: 0, reason: 'A decision is already waiting.' }
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return { trained: false, score: 0, reason: 'Not serving.' }
  if (world.player.log.some((entry) => entry.kind === 'fitness-test' && world.tick - entry.tick < 6)) {
    return { trained: false, score: record.fitnessScore, reason: 'The body needs the months between blocks of training.' }
  }

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    tick: world.tick,
    kind: 'fitness-test',
    choice: 'trained',
  })
  world.player.nextDecisionId += 1

  const score = Math.min(MAX_FITNESS_POINTS, record.fitnessScore + 40)
  setServiceFitness(world, person.id, score)
  recordEvent(world, world.tick, {
    type: 'completed-training',
    subjectId: person.id,
    detail: 'a block of fitness training',
  })
  return { trained: true, score, reason: '' }
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
  // A child under the parents' roof does not set the family's posture
  // (review S4 — the verb must not outrank the model's own idea of whose
  // house it is).
  if (person.parentIds.some((id) => household.memberIds.includes(id))) {
    return { set: false, reason: "The purse is your parents' to carry." }
  }
  if (household.spendStance === stance) return { set: false, reason: 'That is already how the money is carried.' }
  if (world.player.log.some((entry) => entry.kind === 'spend-stance' && entry.tick === world.tick)) {
    return { set: false, reason: 'The purse was already settled this month.' }
  }

  logVerb(world, 'spend-stance', stance ?? 'as-it-comes')
  setSpendStance(world, world.tick, person.householdId, stance, person.id)
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

  if (severity >= 940 && rng.chance(2, 5)) {
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
      grantCampaignMedal(world, tick, person.id, died, enemyName, monthsIn, true)
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
export function raisePending(
  world: World,
  spec: Omit<PendingDecision, 'id'>,
): boolean {
  if (world.player.pending !== null) return false // one question at a time
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

    case 'specialty': {
      const specialty = SPECIALTIES.find((sp) => sp.id === choice)
      if (specialty) {
        // The circumstances an NPC's record names, on the player's too
        // (military review S4): both are public facts the character knows.
        const servedParent = person.parentIds.find((id) => world.service.has(id)) ?? null
        enlistPerson(world, pending.tick, person, specialty, [
          factor('own-choice', 1000),
          ...(servedParent !== null ? [factor('service-tradition', 300, servedParent)] : []),
          ...(recruitingDriveActive(world, pending.tick) ? [factor('recruiting-drive', 550)] : []),
        ])
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
          const cutoffWithFile = standing.cutoff + standing.priorPassOvers * 15
          const margin = prepped - cutoffWithFile
          const selected =
            margin >= 0 && (margin >= 150 || rng.chance(6 + Math.floor(margin / 15), 24))
          if (selected) {
            const newRank = applyBoardPromotion(world, pending.tick, person.id)
            if (newRank === null) break // no record to promote — no event lies about it
            recordEvent(world, pending.tick, {
              type: 'promoted',
              subjectId: person.id,
              detail: rankTitle(record.branch, newRank),
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
              chosen: `made ${rankTitle(record.branch, newRank)}`,
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
          const specialty = specialtyById(record.specialtyId)
          // One event, not a same-tick begin-and-end: a short course fits
          // inside the month, and the feed should not pretend otherwise.
          recordEvent(world, pending.tick, { type: 'completed-training', subjectId: person.id, detail: 'an advanced course' })
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
      if (choice === 'accept') {
        volunteerForDeployment(world, pending.tick, person.id)
      }
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
      resolveCourt(
        world, pending.tick, person, pending.monthlyPay ?? 0, rng,
        choice === 'plead-guilty' ? 'plead-guilty' : 'stand-trial',
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

    case 'combat-moment': {
      // The squad is pinned. Both answers are real and both go on the
      // record — and BOTH are still a firefight: keeping down rolls the
      // month's ordinary danger, going forward rolls more of it, with the
      // same fatal tail the automatic resolver carries (review: the
      // bravest act in the game must not be the only one that cannot
      // kill). Only the act is optional; the exposure never was.
      const enemy = pending.otherId === null ? undefined : world.nations.get(pending.otherId)
      const rng = openStream(world.seed, Stream.CombatResolution, person.id, pending.tick + 9100)
      if (choice === 'lead-the-break') {
        const act = recordEvent(world, pending.tick, {
          type: 'act-of-valor',
          subjectId: person.id,
          ...(pending.otherId !== null ? { otherId: pending.otherId } : {}),
          detail: 'went forward under fire',
        })
        // Not every brave act is decorated: the write-up has to happen,
        // and mostly it does not (review: a star at ×8 is cosmetic
        // leveling, whatever it cites). The ACT stays on the record
        // either way — that part nobody can take.
        if (rng.chance(1, 3)) {
          grantValor(world, pending.tick, person.id, act, enemy?.name ?? 'the enemy')
        }
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'deployment',
          significance: 'defining',
          inputs: [factor('own-choice', 1000), factor('battlefield-chaos', 800)],
          chosen: 'went forward under fire',
          rejected: ['to keep down'],
          streamId: Stream.CombatResolution,
        })
        resolveMomentCasualty(world, pending.tick, person, pending.otherId, rng, 450, 450)
      } else {
        recordEvent(world, pending.tick, {
          type: 'kept-heads-down',
          subjectId: person.id,
          ...(pending.otherId !== null ? { otherId: pending.otherId } : {}),
        })
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'deployment',
          significance: 'notable',
          inputs: [factor('own-choice', 1000)],
          chosen: 'kept down and held the position',
          rejected: ['to go forward'],
          streamId: Stream.CombatResolution,
        })
        // Still pinned, still a firefight: the ordinary month's danger.
        resolveMomentCasualty(world, pending.tick, person, pending.otherId, rng, 250, 300)
      }
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
    case 'school-request':
    case 'unit-tryout':
    case 'fitness-test':
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
        if (choice === 'stay') {
          reenlistService(world, pending.tick, person)
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'enlistment',
            significance: 'major',
            inputs: [factor('own-choice', 1000), factor('steady-pay', Math.floor(record.monthlyPay / 1000))],
            chosen: 'signed for another term',
            rejected: ['to leave the service'],
            streamId: Stream.Employment,
          })
        } else {
          dischargeService(world, pending.tick, person, record, 'end of term', [
            factor('own-choice', 1000),
            factor('term-ended', 600),
          ])
        }
      }
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

  // A wound taken during the combat moment is still a wound somebody has
  // to work on — and only now is the pending slot free to ask (review S7).
  if (pending.kind === 'combat-moment') {
    const hurt = world.health.get(person.id)
    if (hurt && hurt.ailment !== null && person.deathTick === null) {
      offerFieldAid(world, pending.tick, person.id, hurt.severity)
    }
  }

  // Follow-up questions: an accepted enlistment immediately asks WHICH
  // uniform. Raised after commit so the pending slot is free again.
  if (pending.kind === 'enlist' && choice === 'accept') {
    askSpecialty(world, pending.tick, person.id)
  }
  if (pending.kind === 'education' && choice === 'enlist') {
    askSpecialty(world, pending.tick, person.id)
  }
  // P2: signing again asks the trade question too — keep the specialty, or
  // retrain into another the schooling admits.
  if (pending.kind === 'reenlist' && choice === 'stay') {
    askRetrain(world, pending.tick, person.id)
  }
}

/** The retrain menu at reenlistment: keep the trade, or cross to another. */
function askRetrain(world: World, tick: PendingDecision['tick'], personId: EntityId): void {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return
  const education = world.education.get(personId)
  const level = education?.level ?? 'none'
  const alternatives = SPECIALTIES.filter(
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

/** The specialty menu: every branch role this person's schooling admits. */
function askSpecialty(world: World, tick: PendingDecision['tick'], personId: EntityId): void {
  const person = world.people.get(personId)
  if (!person) return
  const education = world.education.get(personId)
  const level = education?.level ?? 'none'
  const options = SPECIALTIES.filter((sp) => meetsRequirement(level, sp.requires)).map((sp) => sp.id)
  if (options.length === 0) return
  raisePending(world, {
    tick,
    kind: 'specialty',
    personId,
    otherId: null,
    occupationId: null,
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
    choice,
  })
  world.player.pending = null
}

/** Has the player already answered a decision of this kind? */
export function hasAnswered(world: World, kind: PendingKind): boolean {
  return world.player.log.some((entry) => entry.kind === kind)
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
      const role = pending.occupationId
        ? withArticle(occupationById(pending.occupationId).title)
        : 'a job'
      const where = pending.workplaceId === null ? '' : ` at ${world.places.get(pending.workplaceId)?.name ?? 'a workplace'}`
      return `There is an opening for ${role}${where}. Take it?`
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
    case 'specialty':
      return 'Which uniform? Your schooling opens these doors.'
    case 'promotion-board': {
      const standing = boardStandingFor(world, pending.personId)
      return `The ${standing?.targetTitle ?? 'promotion'} board meets. Put your name in?`
    }
    case 'attend-school':
      return 'A slot at an advanced school has opened. Take it?'
    case 'volunteer-deploy':
      return 'The unit is taking names for the next deployment. Volunteer?'
    case 'support-deployment': {
      const ally = pending.placeId === null ? undefined : world.nations.get(pending.placeId)
      return `${ally?.name ?? 'The country you are posted to'} has gone to war while you stand on its soil. Go home, or stay and fight beside them?`
    }
    case 'desperation':
      return 'The money is not there and it is not coming. There is a house on the next street with something in it.'
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
    case 'combat-moment':
      return 'Fire off the ridge; the squad is pinned where it lies. What do you do?'
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
    case 'school-request':
      return 'Asked for a school slot.' // log-only
    case 'unit-tryout':
      return 'Put in for selection.' // log-only
    case 'fitness-test':
      return 'Took the fitness test.' // log-only
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
      const title = record ? rankTitle(record.branch, record.rank) : 'soldier'
      return `Your term is up, ${title}. Sign for another four years?`
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
          lines.push(`You earn ${formatMoney(current.monthlyPay)} a month now; this pays ${formatMoney(pending.monthlyPay)}.`)
          if (diff < 0) lines.push('That is a pay cut.')
        } else {
          lines.push(`It pays ${formatMoney(pending.monthlyPay)} a month. You have no wages today.`)
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
        lines.push(`Rent in ${target.name} is ${formatMoney(rentFor(target.desirability))} a month against your ${formatMoney(job.monthlyPay)}.`)
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
        lines.push(`Retiring ends your ${formatMoney(job.monthlyPay)} a month.`)
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
      lines.push(`A term is ${String(SERVICE_TERM_MONTHS / 12)} years. Pay starts around ${formatMoney(servicePay('land-forces', 0))} a month, and rises with rank.`)
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

    case 'specialty': {
      for (const id of pending.options) {
        const sp = SPECIALTIES.find((x) => x.id === id)
        if (!sp) continue
        const risky = sp.exposure.directCombat >= 500 || sp.exposure.convoy >= 500
        // Name the doors it opens, not just that doors exist (P1).
        const unlocks =
          sp.civilianUnlocks.length > 0
            ? ` — opens ${sp.civilianUnlocks.map((id) => occupationById(id).title).join(', ')} after the service`
            : ''
        lines.push(`${sp.title} (${BRANCH_NAMES[sp.branch]}): ${String(sp.schoolMonths)} months' school after basic${risky ? ' — the sharp end, if it ever comes to that' : ''}${unlocks}.`)
      }
      break
    }

    case 'reenlist': {
      const record = world.service.get(pending.personId)
      if (record) {
        const years = Math.floor((pending.tick - record.enlistedAtTick) / TICKS_PER_YEAR)
        lines.push(`${String(years)} year${years === 1 ? '' : 's'} served; ${rankTitle(record.branch, record.rank)}, ${formatMoney(record.monthlyPay)} a month.`)
        lines.push(`Leaving keeps the record${specialtyById(record.specialtyId).civilianUnlocks.length > 0 ? ' and the trade' : ''}; staying is four more years.`)
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
        const realBar = standing.cutoff + standing.priorPassOvers * 15
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
        lines.push(`The job pays ${formatMoney(job.monthlyPay)} a month.`)
      }
      lines.push('Knuckling down is a real effort with a real cost in sweat; shrugging changes nothing.')
      lines.push('Either way, keep sliding and the job will not keep itself. This warning comes once.')
      break
    }

    case 'retrain': {
      const record = world.service.get(pending.personId)
      const current = record ? specialtyById(record.specialtyId) : undefined
      if (current) {
        lines.push(`Today you are ${withArticle(current.title)}.`)
      }
      for (const id of pending.options) {
        if (id === 'keep') continue
        const sp = SPECIALTIES.find((x) => x.id === id)
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

    case 'combat-moment': {
      lines.push('Going forward is how it gets unpinned — and how people get hit, and worse.')
      lines.push('Keeping down is still a firefight; the month is dangerous either way. Both answers go on the record.')
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
