/**
 * Military service as a career. L4-M3.
 *
 * Peacetime only, and deliberately so: LAYER4_PLAN requires service to be a
 * complete, playable career — enlistment, training pay, postings, promotion,
 * discharge, reenlistment — BEFORE L4-M4 lets the wars from the news find the
 * people who signed up. Most military work is not combat (foundation §6), and
 * this milestone is all of the other kind.
 *
 * Design rules honoured here:
 *   - Enlistment is a decision. The player is asked (the fork at eighteen
 *     offers the uniform beside college and trade; recruiters call on the
 *     young and unemployed); NPCs weigh it like any other door out of town.
 *   - THE RECORD SURVIVES DISCHARGE. A service record is the artifact a
 *     descendant finds (foundation §10); nothing deletes one.
 *   - Specialties carry exposure PROFILES, not danger ratings — what a job
 *     does, never how dangerous a country is (the permanent rule).
 *   - Veterans carry their training home: specialty unlocks open civilian
 *     doors education alone would not.
 *
 * OWNERSHIP: this system is the single writer of service records. Employment
 * and finances READ them.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { grantGoodConduct, grantLongService, grantMeritoriousService, grantQualificationBadge } from './awards.js'
import { ageAt } from './clock.js'
import {
  BOARD_CUTOFF_BASE,
  BOARD_CUTOFF_STEP,
  BRANCH_GRADES,
  BRANCH_NAMES,
  BRANCH_RANKS,
  COMPETITIVE_FROM,
  HIGH_YEAR_TENURE_TIG,
  JUNIOR_TIG_MONTHS,
  MAX_DECORATION_POINTS,
  MAX_FITNESS_POINTS,
  MAX_SENIORITY_POINTS,
  PENSION_CENTS_PER_POINT,
  PENSION_THRESHOLD,
  POINTS_PER_BADGE,
  POINTS_PER_CAMPAIGN,
  POINTS_PER_COMBAT_ACTION,
  POINTS_PER_GOOD_CONDUCT,
  POINTS_PER_LONG_SERVICE,
  POINTS_PER_MERITORIOUS,
  POINTS_PER_VALOR,
  POINTS_PER_WOUND_RECOGNITION,
  SERVICE_SCHOOLS,
  SERVICE_TERM_MONTHS,
  servicePay,
  SPECIAL_UNITS,
  SPECIALTIES,
  specialtyById,
  specialUnitById,
} from './content.js'
import { activeWars, homeland } from './geopolitics.js'
import type { ServiceBranch, ServiceSpecialty } from './content.js'
import { educationRank, meetsRequirement } from './content.js'
import { isDeployed } from './deployment.js'
import { isSeverelyAiling } from './health.js'
import { hasAnswered, raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { CausalFactor, Person, World } from './types.js'
import { placesOfKind } from './worldgen.js'

const ENLIST_MIN_AGE = 18
const ENLIST_MAX_AGE = 26
/** Disability at or above this ends (or bars) service on medical grounds. */
const MEDICAL_LIMIT = 400

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function isServing(world: World, personId: EntityId): boolean {
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick === null
}

export function isVeteran(world: World, personId: EntityId): boolean {
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick !== null
}

/** Monthly service pay for the household ledger — grade pay plus any
 *  special-duty pay the unit carries. Zero when not serving. */
export function servicePayOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (record === undefined || record.dischargedAtTick !== null) return 0
  const unit = record.unitId === null ? undefined : specialUnitById(record.unitId)
  return record.monthlyPay + (unit?.dutyPay ?? 0)
}

/** The branch's own title for a ladder index — 'PFC', 'PO2', 'SSgt'. */
export function rankTitle(branch: string, rank: number): string {
  const ladder = BRANCH_RANKS[branch as ServiceBranch] ?? BRANCH_RANKS['land-forces']
  return ladder[Math.max(0, Math.min(ladder.length - 1, rank))] ?? ladder[0] ?? 'PVT'
}

/** The gates on the NEXT competitive step, or null when the next step is
 *  junior (time-based) or the ladder is topped out. The cutoff is POINTS,
 *  per trade — the real monthly-cutoff-list shape (M-SPECOPS). */
export function competitiveGates(
  specialty: ServiceSpecialty,
  rank: number,
): { readonly targetRank: number; readonly tigNeeded: number; readonly cutoff: number } | null {
  const branch = specialty.branch
  const ladder = BRANCH_RANKS[branch]
  const competitiveFrom = COMPETITIVE_FROM[branch]
  if (rank >= ladder.length - 1) return null
  if (rank + 1 < competitiveFrom) return null
  const grades = BRANCH_GRADES[branch]
  const stepsUp = rank + 1 - competitiveFrom
  // A same-grade lateral (SPC→CPL) is an appointment, not a grade board —
  // quicker than a board, but it waits on a billet, not on the calendar
  // alone (owner: two mid-career promotions in a year reads wrong).
  const sameGrade = grades[rank + 1] === grades[rank]
  const tigNeeded = sameGrade ? 12 : 12 + stepsUp * 6
  const cutoff = BOARD_CUTOFF_BASE + stepsUp * BOARD_CUTOFF_STEP + specialty.boardCutoffOffset
  return { targetRank: rank + 1, tigNeeded, cutoff }
}

export interface PromotionPoints {
  readonly performance: number
  readonly fitness: number
  readonly badges: number
  readonly decorations: number
  readonly seniority: number
  readonly total: number
}

/**
 * Promotion points (M-SPECOPS): the several roads to the same board.
 * Performance is the evaluation; the fitness test is the body's share;
 * badges are the schools attended; decorations are the service recorded;
 * seniority is time in grade. A middling evaluation can still make the
 * cutoff through work the player chooses to do — which is the point.
 */
export function promotionPointsFor(world: World, personId: EntityId): PromotionPoints {
  const record = world.service.get(personId)
  if (!record) {
    return { performance: 0, fitness: 0, badges: 0, decorations: 0, seniority: 0, total: 0 }
  }
  const decorations = world.awards.get(personId) ?? []
  const badgeCount = decorations.filter((a) => a.kind === 'qualification-badge').length
  const decorationPoints = decorations.reduce((sum, award) => {
    if (award.kind === 'campaign') return sum + award.count * POINTS_PER_CAMPAIGN
    if (award.kind === 'good-conduct') return sum + award.count * POINTS_PER_GOOD_CONDUCT
    if (award.kind === 'wound-recognition') return sum + award.count * POINTS_PER_WOUND_RECOGNITION
    if (award.kind === 'combat-action') return sum + award.count * POINTS_PER_COMBAT_ACTION
    if (award.kind === 'valor') return sum + award.count * POINTS_PER_VALOR
    if (award.kind === 'meritorious-service') return sum + award.count * POINTS_PER_MERITORIOUS
    if (award.kind === 'long-service') return sum + award.count * POINTS_PER_LONG_SERVICE
    return sum
  }, 0)
  const points = {
    performance: Math.floor(record.performance / 2),
    fitness: Math.min(MAX_FITNESS_POINTS, record.fitnessScore),
    badges: badgeCount * POINTS_PER_BADGE,
    // Capped like the real awards bucket: a rack cannot buy a board alone.
    decorations: Math.min(MAX_DECORATION_POINTS, decorationPoints),
    seniority: Math.min(MAX_SENIORITY_POINTS, world.tick - record.rankSinceTick),
  }
  return {
    ...points,
    total: points.performance + points.fitness + points.badges + points.decorations + points.seniority,
  }
}

/** What the annual fitness test finds: the body, honestly, with age in it. */
export function fitnessScoreFor(person: Person, age: number, noise: number): number {
  const base = Math.floor(person.traits.vitality / 5) + Math.floor(person.traits.resilience / 10)
  const ageDrag = Math.max(0, (age - 30) * 3)
  return Math.max(0, Math.min(MAX_FITNESS_POINTS, base - ageDrag + noise))
}

/** Badges this person wears — qualification-badge decorations, by title. */
export function badgesOf(world: World, personId: EntityId): readonly string[] {
  return (world.awards.get(personId) ?? [])
    .filter((a) => a.kind === 'qualification-badge')
    .map((a) => a.title)
}

/**
 * The Service tab's school list, with the door open or the reason it is not
 * — engine-authored words, so the UI renders rather than writes.
 */
export function schoolOptionsFor(
  world: World,
  personId: EntityId,
): readonly { id: string; title: string; badge: string; open: boolean; reason: string }[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return []
  const specialty = specialtyById(record.specialtyId)
  const badges = badgesOf(world, personId)
  return SERVICE_SCHOOLS.map((school) => {
    let reason = ''
    if (school.branches.length > 0 && !school.branches.includes(specialty.branch)) {
      reason = `${BRANCH_NAMES[specialty.branch]} does not send people here.`
    } else if (school.specialtyIds.length > 0 && !school.specialtyIds.includes(record.specialtyId)) {
      reason = 'Not this trade.'
    } else if (badges.includes(school.badge)) {
      reason = 'Already earned.'
    } else if (record.rank < school.minRank) {
      reason = `Opens at ${rankTitle(record.branch, school.minRank)}.`
    } else if (record.performance < school.minPerformance) {
      reason = 'The work is not there yet.'
    }
    return { id: school.id, title: school.title, badge: school.badge, open: reason === '', reason }
  })
}

/** The special units, with the selection door open or the stated bar. */
export function unitOptionsFor(
  world: World,
  personId: EntityId,
): readonly { id: string; name: string; tier: number; open: boolean; reason: string }[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return []
  const specialty = specialtyById(record.specialtyId)
  const badges = badgesOf(world, personId)
  return SPECIAL_UNITS.map((unit) => {
    let reason = ''
    const drops = world.events.filter(
      (e) => e.type === 'dropped-selection' && e.subjectId === personId && e.detail === unit.name,
    ).length
    if (record.unitId === unit.id) {
      reason = 'Already wearing the tab.'
    } else if (!unit.branches.includes(specialty.branch)) {
      reason = `${BRANCH_NAMES[specialty.branch]} does not feed this unit.`
    } else if (unit.feederUnitId !== null && record.unitId !== unit.feederUnitId) {
      reason = `Selection draws from ${specialUnitById(unit.feederUnitId)?.name ?? 'the feeder unit'}.`
    } else if (record.rank < unit.minRank) {
      reason = `Looks at ${rankTitle(record.branch, unit.minRank)} and above.`
    } else if (unit.requiredBadges.some((b) => !badges.includes(b))) {
      reason = `Wants ${unit.requiredBadges.filter((b) => !badges.includes(b)).join(', ')} first.`
    } else if (record.performance < unit.minPerformance) {
      reason = 'The file is not strong enough yet.'
    } else if (drops >= 2) {
      reason = 'Two selections is what the file allows.'
    }
    return { id: unit.id, name: unit.name, tier: unit.tier, open: reason === '', reason }
  })
}

/**
 * The player's standing before the board, for the stakes screen and the
 * board resolution — everything here is what the person themselves would
 * know. Null when not serving or the next step is not competitive.
 */
export function boardStandingFor(
  world: World,
  personId: EntityId,
): {
  readonly targetTitle: string
  readonly timeInGrade: number
  readonly tigNeeded: number
  /** The trade's points cutoff for the next rank. */
  readonly cutoff: number
  readonly points: PromotionPoints
  /** Recorded non-selections for this same rank — the file the board reads. */
  readonly priorPassOvers: number
} | null {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return null
  const specialty = specialtyById(record.specialtyId)
  const gates = competitiveGates(specialty, record.rank)
  if (!gates) return null
  const targetTitle = rankTitle(record.branch, gates.targetRank)
  return {
    targetTitle,
    timeInGrade: world.tick - record.rankSinceTick,
    tigNeeded: gates.tigNeeded,
    cutoff: gates.cutoff,
    points: promotionPointsFor(world, personId),
    priorPassOvers: world.events.filter(
      (e) => e.type === 'passed-over' && e.subjectId === personId && e.detail === targetTitle,
    ).length,
  }
}

/**
 * Monthly disability pension, in cents. Paid to living veterans for
 * SERVICE-CONNECTED disability: harm from wounds stamped at infliction as
 * the service's, accrued whenever those wounds resolved — including years
 * after discharge. Civilian illness during a career does not count, and a
 * war wound still healing at discharge is not missed. Provenance, not a
 * date range.
 */
export function pensionOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick === null) return 0
  const serviceDisability = world.health.get(personId)?.serviceDisability ?? 0
  if (serviceDisability < PENSION_THRESHOLD) return 0
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 0
  return serviceDisability * PENSION_CENTS_PER_POINT
}

/** Civilian occupations a veteran's training opened. Empty for non-veterans. */
export function veteranUnlocks(world: World, personId: EntityId): readonly string[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick === null) return []
  return specialtyById(record.specialtyId).civilianUnlocks
}

function eligibleSpecialties(world: World, person: Person): ServiceSpecialty[] {
  const education = world.education.get(person.id)
  const level = education?.level ?? 'none'
  return SPECIALTIES.filter((sp) => meetsRequirement(level, sp.requires))
}

/**
 * Why enlistment is closed to this person right now — or null when the door
 * is open. The Service tab shows the reason instead of a dead button
 * (M-SERVICE-PLAY): the recruiter's "no" is information, not a mystery.
 */
export function enlistmentBar(world: World, person: Person, tick: Tick): string | null {
  const age = ageAt(person.birthTick, tick)
  if (age < ENLIST_MIN_AGE) return 'Not yet eighteen.'
  if (age > ENLIST_MAX_AGE) return 'Past enlistment age — the office takes volunteers at eighteen to twenty-six.'
  if (world.service.has(person.id)) return 'One service career per life; the record stands.'
  if (isSeverelyAiling(world, person.id)) return 'The body would not pass the medical today.'
  if ((world.health.get(person.id)?.disability ?? 0) >= MEDICAL_LIMIT) {
    return 'The medical exam reads the record of old harm, and refuses.'
  }
  const education = world.education.get(person.id)
  if (education?.enrolledIn !== null && education !== undefined) return 'Still in school.'
  if (eligibleSpecialties(world, person).length === 0) return 'No specialty is open at this schooling.'
  return null
}

function canEnlist(world: World, person: Person, tick: Tick): boolean {
  return enlistmentBar(world, person, tick) === null
}

// ---------------------------------------------------------------------------
// Enlistment
// ---------------------------------------------------------------------------

/** Shared by the player path and the NPC path: one door, one ledger entry. */
export function enlistPerson(
  world: World,
  tick: Tick,
  person: Person,
  specialty: ServiceSpecialty,
  extraInputs: readonly CausalFactor[],
): void {
  const bases = placesOfKind(world, 'base')
  const base = bases[Math.abs(person.id) % Math.max(1, bases.length)]
  if (!base) return

  // Enlisting ends a civilian job; the uniform is not a side line.
  if (world.employment.has(person.id)) {
    world.employment.delete(person.id)
    recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'enlisted' })
  }

  world.service.set(person.id, {
    personId: person.id,
    branch: specialty.branch,
    specialtyId: specialty.id,
    rank: 0,
    rankSinceTick: tick,
    qualifications: [],
    enlistedAtTick: tick,
    baseId: base.id,
    monthlyPay: servicePay(specialty.branch, 0),
    performance: Math.floor((person.traits.diligence + 500) / 2),
    termMonthsLeft: SERVICE_TERM_MONTHS,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 0,
    unitId: null,
    fitnessScore: 0,
    fitnessTestedAtTick: null,
  })

  recordEvent(world, tick, {
    type: 'enlisted',
    subjectId: person.id,
    placeId: base.id,
    detail: specialty.title,
  })
  // The first thing service is, is training: ten weeks of basic before the
  // trade. Part of the record from day one — a term is a lived four years.
  recordEvent(world, tick, {
    type: 'began-training',
    subjectId: person.id,
    detail: 'basic training',
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'enlistment',
    significance: 'defining',
    inputs: [...extraInputs, factor('steady-pay', Math.floor(servicePay(specialty.branch, 0) / 1000))],
    chosen: `enlisted in ${BRANCH_NAMES[specialty.branch]} as a ${specialty.title}`,
    rejected: ['civilian life'],
    streamId: Stream.Employment,
  })
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runService(world: World, tick: Tick): void {
  for (const person of livingSorted(world)) {
    const record = world.service.get(person.id)

    if (record && record.dischargedAtTick === null) {
      serveMonth(world, tick, person, record)
      continue
    }
    if (record) continue // a veteran; their serving days are recorded, and done

    // Civilian of enlistment age: the door exists. The player gets a
    // recruiter's knock when young, jobless and fit; NPCs weigh the same door
    // with their own feet.
    if (!canEnlist(world, person, tick)) continue

    const rng = openStream(world.seed, Stream.Employment, person.id, tick + 3333)

    if (person.id === world.player.personId) {
      if (!world.employment.has(person.id) && rng.chance(35, 1_000)) {
        raisePending(world, {
          tick,
          kind: 'enlist',
          personId: person.id,
          otherId: null,
          occupationId: null,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: ['accept', 'decline'],
        })
      }
      continue
    }

    // NPC propensity: modest, and modelled — the jobless and the ambitious
    // hear the recruiter out more often; the settled mostly do not.
    // First tuning gave one enlistment in fifty years: the town hires its
    // young within a month or two, so the jobless window barely exists. The
    // door has to be audible over a paycheck, not only instead of one.
    const jobless = !world.employment.has(person.id)
    const propensity = (jobless ? 110 : 16) + Math.floor(person.traits.ambition / 25)
    if (!rng.chance(propensity, 12_000)) continue

    const options = eligibleSpecialties(world, person)
    if (options.length === 0) continue
    const education = world.education.get(person.id)
    const weights = options.map((sp) => 1 + educationRank(sp.requires) + (education && meetsRequirement(education.level, sp.requires) ? 2 : 0))
    const chosen = rng.pickWeighted(options, weights)

    enlistPerson(world, tick, person, chosen, [
      factor('reached-adulthood', 400),
      ...(jobless ? [factor('way-out-of-town', 500)] : []),
      factor('ambition', person.traits.ambition),
    ])
  }
}

function livingSorted(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((a, b) => a.id - b.id)
  return living
}

/** One month in uniform: drift, review, the term clock, the body's verdict. */
function serveMonth(world: World, tick: Tick, person: Person, record: NonNullable<ReturnType<World['service']['get']>>): void {
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 4444)

  // Medical discharge: the body rules service in a way it does not rule a desk.
  const disability = world.health.get(person.id)?.disability ?? 0
  if (disability >= MEDICAL_LIMIT) {
    discharge(world, tick, person, record, 'medical', [factor('medically-unfit', disability)])
    return
  }

  // Performance drifts toward what diligence can deliver, as at any work.
  const pull = person.traits.diligence - record.performance
  const performance = Math.max(0, Math.min(1000, record.performance + Math.floor(pull / 40) + rng.nextInt(-8, 9)))

  const specialty = specialtyById(record.specialtyId)
  const branch = specialty.branch
  const ladder = BRANCH_RANKS[branch]
  const monthsIn = tick - record.enlistedAtTick
  const schoolDone = 2 + specialty.schoolMonths // basic (~10 weeks) then the trade school
  const deployed = isDeployed(world, person.id)

  // --- Promotion, checked MONTHLY, one step at a time, never skipped. ------
  // Junior ranks go on time in grade — near-automatic unless the work is
  // poor, which is how it actually works. From the board ranks up it is
  // competitive: a real wait, a real performance bar, and being passed over
  // is a thing that happens. The old annual review promoted straight past
  // ranks; the owner noticed from inside the uniform.
  let rank = record.rank
  let rankSinceTick = record.rankSinceTick
  const timeInGrade = tick - record.rankSinceTick
  const isPlayer = person.id === world.player.personId

  // The annual fitness test, run for EVERYONE — nobody opts out of it, and
  // nobody keeps a score their body no longer holds (review: the opt-in
  // version punished forgetting the button AND let one peak score fund a
  // twenty-year career). The player's ACTION is training for it, not
  // whether it happens.
  let fitnessScore = record.fitnessScore
  let fitnessTestedAtTick = record.fitnessTestedAtTick
  if (monthsIn > 0 && monthsIn % 12 === 5) {
    fitnessScore = fitnessScoreFor(person, ageAt(person.birthTick, tick), rng.nextInt(-15, 16))
    fitnessTestedAtTick = tick
    if (isPlayer) {
      recordEvent(world, tick, { type: 'fitness-tested', subjectId: person.id, detail: String(fitnessScore) })
    }
  }

  if (rank < ladder.length - 1) {
    const competitiveFrom = COMPETITIVE_FROM[branch]
    let promote = false
    if (rank + 1 < competitiveFrom) {
      const due = JUNIOR_TIG_MONTHS[branch][rank] ?? 6
      promote = timeInGrade >= due && performance >= 300
    } else if (!isPlayer) {
      // The board ranks, NPC path: PROMOTION POINTS against the trade's
      // cutoff — evaluation, fitness, badges, decorations, seniority. The
      // draw stands in for slot timing, not for merit. THE PLAYER never
      // promotes through this branch: their stripes come only through the
      // board question (M-SERVICE-PLAY) — put in for, not received.
      const gates = competitiveGates(specialty, rank)
      if (gates && timeInGrade >= gates.tigNeeded) {
        // Clearly over the cutoff = promoted; the draw lives only near the
        // line (the same rule the player's board follows).
        const points = promotionPointsFor(world, person.id).total
        const margin = points - gates.cutoff
        promote = margin >= 0 && (margin >= 150 || rng.chance(6 + Math.floor(margin / 15), 24))
      }
    }
    if (promote) {
      rank += 1
      rankSinceTick = tick
      recordEvent(world, tick, {
        type: 'promoted',
        subjectId: person.id,
        detail: rankTitle(branch, rank),
      })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'promotion',
        significance: 'notable',
        inputs: [
          factor('time-in-grade', Math.min(1000, timeInGrade * 10)),
          factor('strong-performance', performance),
          ...(record.qualifications.length > 0 ? [factor('holds-qualification', 400)] : []),
        ],
        chosen: `made ${rankTitle(branch, rank)}`,
        rejected: [],
        streamId: Stream.Employment,
      })
    }
  }

  // --- Service texture: the term is a lived four years. --------------------
  // The training pipeline is deterministic (everyone does basic, everyone
  // does their school); exercises and qualifications are the texture of the
  // years after, and a posting moves mid-term. None of it while deployed —
  // the deployment system owns those months.
  let baseId = record.baseId
  let unitId = record.unitId
  const qualifications = [...record.qualifications]
  if (monthsIn === 2) {
    recordEvent(world, tick, { type: 'completed-training', subjectId: person.id, detail: 'basic training' })
    recordEvent(world, tick, { type: 'began-training', subjectId: person.id, detail: `${specialty.title} school` })
  } else if (monthsIn === schoolDone) {
    recordEvent(world, tick, { type: 'completed-training', subjectId: person.id, detail: `${specialty.title} school` })
    recordEvent(world, tick, {
      type: 'changed-post',
      subjectId: person.id,
      placeId: record.baseId,
      detail: world.places.get(record.baseId)?.name ?? 'a home station',
    })
  } else if (!deployed && monthsIn > schoolDone) {
    // PCS: a permanent change of station lands mid-term, then on a slow cycle.
    if (monthsIn % 36 === 30) {
      const bases = placesOfKind(world, 'base')
      const next = bases.find((b) => b.id !== baseId)
      if (next) {
        baseId = next.id
        recordEvent(world, tick, {
          type: 'changed-post',
          subjectId: person.id,
          placeId: next.id,
          detail: next.name,
        })
      }
    } else if (rng.chance(1, 14)) {
      const flavour =
        branch === 'naval-service' ? 'a sea patrol' : branch === 'air-guard' ? 'a readiness exercise' : 'a field exercise'
      recordEvent(world, tick, { type: 'field-exercise', subjectId: person.id, detail: flavour })
    } else if (
      !qualifications.includes(specialty.qualification) &&
      performance >= 550 &&
      rng.chance(1, 20)
    ) {
      // A qualification is EARNED — performance-gated, once, on the record.
      // The badge is its visible form (L4-M5), referencing this entry.
      qualifications.push(specialty.qualification)
      const qualEvent = recordEvent(world, tick, {
        type: 'earned-qualification',
        subjectId: person.id,
        detail: specialty.qualification,
      })
      grantQualificationBadge(world, tick, person.id, qualEvent, specialty.qualification)
    } else if (!isPlayer && rng.chance(1, 40)) {
      // NPCs go to schools too — the player is not special (charter §2).
      // Their path is quieter: the first open school takes them.
      const badges = badgesOf(world, person.id)
      const school = SERVICE_SCHOOLS.find(
        (s) =>
          (s.branches.length === 0 || s.branches.includes(branch)) &&
          (s.specialtyIds.length === 0 || s.specialtyIds.includes(record.specialtyId)) &&
          rank >= s.minRank &&
          performance >= s.minPerformance &&
          !badges.includes(s.badge),
      )
      if (school) {
        recordEvent(world, tick, { type: 'completed-training', subjectId: person.id, detail: school.title })
        const badgeEvent = recordEvent(world, tick, {
          type: 'earned-qualification',
          subjectId: person.id,
          detail: school.badge,
        })
        grantQualificationBadge(world, tick, person.id, badgeEvent, school.badge)
      }
    } else if (!isPlayer && rng.chance(1, 240)) {
      // And some try for the special units — the SAME selection the player
      // faces: the roll can fail, failures are on the record, two drops
      // close the file, and tier 2 draws from the feeder unit. The player
      // is not special (charter §2), and a unit a descendant finds must
      // have had more than one member, ever (foundation §13).
      const badges = badgesOf(world, person.id)
      const dropsFor = (unitName: string): number =>
        world.events.filter(
          (e) => e.type === 'dropped-selection' && e.subjectId === person.id && e.detail === unitName,
        ).length
      const unit = SPECIAL_UNITS.find(
        (u) =>
          u.branches.includes(branch) &&
          record.unitId !== u.id &&
          (u.feederUnitId === null ? record.unitId === null : record.unitId === u.feederUnitId) &&
          rank >= u.minRank &&
          performance >= u.minPerformance &&
          u.requiredBadges.every((b) => badges.includes(b)) &&
          dropsFor(u.name) < 2,
      )
      if (unit) {
        const margin = Math.max(10, Math.min(400, performance - unit.minPerformance + 60))
        if (rng.chance(margin, unit.selectionDenominator)) {
          unitId = unit.id
          recordEvent(world, tick, { type: 'joined-unit', subjectId: person.id, detail: unit.name })
        } else {
          recordEvent(world, tick, { type: 'dropped-selection', subjectId: person.id, detail: unit.name })
        }
      }
    }
  }

  // --- The player's own hands on the career (M-SERVICE-PLAY). -------------
  // Service used to happen TO the player; these are the handles. Only the
  // player draws here (guarded), so a world played by nobody is untouched.
  if (isPlayer && !deployed && monthsIn > schoolDone) {
    // The board's question, yearly once eligible. Deterministic cadence —
    // eligibility is a fact, not a roll. DEFERRED, NEVER LOST: if another
    // question held the month (a wound's convalescence, say), the ask
    // retries for two more months; the player's own log is the dedupe, so
    // an answered board never re-asks inside its year.
    const gates = competitiveGates(specialty, rank)
    if (gates) {
      const over = timeInGrade - gates.tigNeeded
      const askedRecently = world.player.log.some(
        (entry) => entry.kind === 'promotion-board' && tick - entry.tick < 10,
      )
      if (over >= 0 && over % 12 <= 2 && !askedRecently) {
        raisePending(world, {
          tick,
          kind: 'promotion-board',
          personId: person.id,
          otherId: null,
          occupationId: null,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: ['put-in', 'pass'],
        })
      }
    }
    // A school slot opens now and then — the way to train, and to earn the
    // rating the board counts.
    if (rng.chance(1, 36)) {
      raisePending(world, {
        tick,
        kind: 'attend-school',
        personId: person.id,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['attend', 'pass'],
      })
    }
    // The rotation list, while the Republic fights. Orders can still come
    // regardless — volunteering just stops waiting for them.
    const home = homeland(world)
    if (
      home !== undefined &&
      activeWars(world).some((w) => w.a === home.id || w.b === home.id) &&
      rng.chance(1, 6)
    ) {
      raisePending(world, {
        tick,
        kind: 'volunteer-deploy',
        personId: person.id,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
    }
  }

  const termMonthsLeft = record.termMonthsLeft - 1

  world.service.set(person.id, {
    ...record,
    rank,
    rankSinceTick,
    qualifications,
    baseId,
    unitId,
    fitnessScore,
    fitnessTestedAtTick,
    performance,
    monthlyPay: servicePay(branch, rank),
    termMonthsLeft,
    // The term's running ledger: good conduct is judged on the average of
    // every served month, not the last month's noise.
    termPerformanceSum: record.termPerformanceSum + performance,
  })

  if (termMonthsLeft > 0) return

  // STOP-LOSS: a term does not end in a theatre. The question waits for the
  // boat home — the army's oldest fine print, and honestly modelled as such.
  if (isDeployed(world, person.id)) {
    world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 1 })
    return
  }

  // HIGH-YEAR TENURE: up or out. Six years in the same grade and the
  // service does not offer another term — player and NPC alike, because
  // this is the army's decision, not a question. The term itself was served
  // in full, so good conduct is still judged (the grant accepts this
  // discharge). Nobody sits at SPC for forty years any more.
  if (rank < ladder.length - 1 && tick - rankSinceTick >= HIGH_YEAR_TENURE_TIG) {
    discharge(world, tick, person, world.service.get(person.id)!, 'high-year tenure', [
      factor('time-in-grade', 1000),
    ])
    return
  }

  // Term's end. The player signs or leaves; an NPC's retention is a weighing
  // of the same things (rank earned, other doors), resolved by their own roll.
  if (person.id === world.player.personId) {
    raisePending(world, {
      tick,
      kind: 'reenlist',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: servicePay(branch, rank),
      placeId: null,
      options: ['stay', 'leave'],
    })
    // The clock halts on the pending; the term is settled by the answer.
    world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 0 })
    return
  }

  const retention = 380 + rank * 90
  if (rng.chance(retention, 1_000)) {
    reenlist(world, tick, person)
  } else {
    discharge(world, tick, person, world.service.get(person.id)!, 'end of term', [factor('term-ended', 600)])
  }
}

export function reenlist(world: World, tick: Tick, person: Person): void {
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return
  // Judge the closing term BEFORE the ledger resets for the next one.
  const termAverage = termAveragePerformance(record)
  world.service.set(person.id, {
    ...record,
    termMonthsLeft: SERVICE_TERM_MONTHS,
    termPerformanceSum: 0,
  })
  const reenlisted = recordEvent(world, tick, {
    type: 'reenlisted',
    subjectId: person.id,
    detail: rankTitle(record.branch, record.rank),
  })
  grantGoodConduct(world, tick, person.id, reenlisted, termAverage)
  grantMeritoriousService(world, tick, person.id, reenlisted, termAverage)
  grantLongService(world, tick, person.id, reenlisted, Math.floor((tick - record.enlistedAtTick) / 12))
}

/** Average monthly performance across the term now closing. */
function termAveragePerformance(record: NonNullable<ReturnType<World['service']['get']>>): number {
  const monthsServed = Math.max(1, SERVICE_TERM_MONTHS - record.termMonthsLeft)
  return Math.floor(record.termPerformanceSum / monthsServed)
}

export function discharge(
  world: World,
  tick: Tick,
  person: Person,
  record: NonNullable<ReturnType<World['service']['get']>>,
  reason: string,
  inputs: readonly CausalFactor[],
): void {
  // The record is CLOSED, never deleted: this is the artifact a descendant
  // finds three generations on (foundation §10).
  world.service.set(person.id, {
    ...record,
    dischargedAtTick: tick,
    dischargeReason: reason,
    termMonthsLeft: 0,
  })
  const dischargedEvent = recordEvent(world, tick, { type: 'discharged', subjectId: person.id, detail: reason })
  // An end-of-term discharge closes a completed term; good conduct is
  // judged on the term's AVERAGE. A term cut short — medical or otherwise —
  // is refused by the grant itself, which reads the reason off the event.
  grantGoodConduct(world, tick, person.id, dischargedEvent, termAveragePerformance(record))
  grantMeritoriousService(world, tick, person.id, dischargedEvent, termAveragePerformance(record))
  grantLongService(world, tick, person.id, dischargedEvent, Math.floor((tick - record.enlistedAtTick) / 12))

  // If the service already left recognized harm on the body, the pension
  // begins the day the uniform comes off — on the record, never silently.
  // (The other path — the wound resolving into disability AFTER discharge —
  // is recorded by the health system at that later crossing.)
  const serviceDisability = world.health.get(person.id)?.serviceDisability ?? 0
  if (serviceDisability >= PENSION_THRESHOLD) {
    recordEvent(world, tick, {
      type: 'granted-pension',
      subjectId: person.id,
      detail: String(serviceDisability * PENSION_CENTS_PER_POINT),
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'pension',
      significance: 'notable',
      inputs: [factor('service-disability', serviceDisability)],
      chosen: 'the pension board recognized the service-connected disability',
      rejected: [],
      streamId: Stream.Employment,
    })
  }
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'enlistment',
    significance: 'major',
    inputs: [...inputs],
    chosen: `left ${BRANCH_NAMES[specialtyById(record.specialtyId).branch]} after ${Math.max(1, Math.floor((tick - record.enlistedAtTick) / TICKS_PER_YEAR))} years' service`,
    rejected: ['to serve on'],
    streamId: Stream.Employment,
  })
}

/** True when the education fork at eighteen should offer the uniform. */
export function educationOffersEnlistment(world: World, person: Person, tick: Tick): boolean {
  return canEnlist(world, person, tick) && !hasAnswered(world, 'enlist')
}
