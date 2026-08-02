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
import type { NewsItem } from './geopolitics.js'
import type { ServiceBranch, ServiceSpecialty } from './content.js'
import { educationRank, meetsRequirement, RECORD_GATE_YEARS } from './content.js'
import { isDeployed } from './deployment.js'
import { isSeverelyAiling } from './health.js'
import { hasAnswered, raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { withArticle } from './text.js'
import { hash32, openStream, Stream, type StreamId } from './rng.js'
import type { CausalFactor, Person, World } from './types.js'
import { placesOfKind } from './worldgen.js'

const ENLIST_MIN_AGE = 18
/** M-ARMY2 (owner): the office takes volunteers to thirty-eight. */
const ENLIST_MAX_AGE = 38
/** Disability at or above this ends (or bars) service on medical grounds. */
const MEDICAL_LIMIT = 400

// --- M-ARMY2 career shape (owner direction, 2026-08-01) --------------------
/** Up-or-out applies BELOW this pay grade only. Make E-5 (SGT, PO2, SSgt)
 *  and the service will keep you: "a ton of people retire at SGT, SSG". */
const HYT_BELOW_GRADE = 5
/**
 * Twenty years is the door everyone aims at — the reason "a ton of people
 * retire at SGT, SSG" is true. Reaching it makes leaving attractive rather
 * than forced.
 */
export const RETIREMENT_ELIGIBLE_MONTHS = 240
/**
 * How long a career can run AT a grade. Up-or-out handles everything below
 * E-5; above it, the ceiling rises with the grade, so a sergeant serves
 * their twenty and retires while a senior NCO can run the full thirty
 * (review S2: with no ceiling at all, a thirty-year SGT reads wrong to
 * anyone who wore the rank).
 */
function careerCeilingMonths(grade: number): number {
  return grade <= 5 ? RETIREMENT_ELIGIBLE_MONTHS : 360
}
/** Mandatory retirement age. Nobody serves past it, rank regardless. */
const SERVICE_RETIREMENT_AGE = 62

// --- M-ARMY2 misconduct ----------------------------------------------------
/**
 * Monthly incident chance per 1000: 2 for the diligent up to 8 for the
 * careless, +3 more when the work is already failing. Tuned UP from the
 * first draft (review S1), where a third strike inside five years fired
 * roughly once a century — a career-ending path nobody would ever meet,
 * and the only removal path the E-5 tenure exemption leaves standing.
 */
function misconductChance(person: Person, performance: number): number {
  let chance = 2 + Math.floor(Math.max(0, 550 - person.traits.diligence) / 90)
  if (performance < 300) chance += 3
  return chance
}
/** A third company punishment inside this window ends the career. */
const MISCONDUCT_STRIKES = 3
const MISCONDUCT_WINDOW_MONTHS = 60
const MINOR_INFRACTIONS = [
  'late off leave',
  'asleep on watch',
  'a scrap in barracks',
  'missed movement',
  'drink where it should not have been',
] as const
const SEVERE_INFRACTIONS = ['a fight that went too far', 'insubordination before the company'] as const

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
// ---------------------------------------------------------------------------
// Unit rosters (M-ARMY2 item 7, owner: "add unit info like who our squad
// members are and our SGT etc like the rank structure of that unit")
// ---------------------------------------------------------------------------

/** Fictional company letters and squad ordinals — no real unit is named. */
const COMPANY_LETTERS = ['A', 'B', 'C', 'D'] as const
const SQUAD_ORDINALS = ['1st', '2nd', '3rd', '4th'] as const

/**
 * Which sub-unit a soldier belongs to at their current posting.
 *
 * DERIVED, not stored (DOMAIN_MAP §1 — a roster kept in two places is two
 * truths): the pair (person, base) hashes to a company and a squad, so a
 * soldier keeps the same squadmates for as long as they are posted
 * together, and a transfer genuinely moves them. No schema change, and a
 * save written before this existed answers the same way.
 */
function subUnitOf(
  world: World,
  personId: EntityId,
  baseId: EntityId,
): { company: string; squad: string } {
  const draw = hash32(world.seed, Stream.Employment, personId, baseId + 31_000)
  const company = COMPANY_LETTERS[draw % COMPANY_LETTERS.length] ?? 'A'
  const squad = SQUAD_ORDINALS[Math.floor(draw / 4) % SQUAD_ORDINALS.length] ?? '1st'
  return { company, squad }
}

export interface RosterMember {
  readonly personId: EntityId
  readonly name: string
  readonly rankTitle: string
  readonly rank: number
  readonly specialtyTitle: string
  /** 'squad leader' | 'team leader' | the trade they actually do. */
  readonly role: string
  readonly deployed: boolean
}

export interface UnitRoster {
  /** e.g. "1st Squad, A Company" — the fictional structure, in words. */
  readonly unitName: string
  readonly baseName: string
  readonly branchName: string
  readonly members: readonly RosterMember[]
}

/**
 * The people a soldier actually serves beside: same posting, same branch,
 * same squad, still serving. Sorted by rank (then seniority in grade, then
 * id) so the top of the list is the person who answers for the rest — the
 * squad leader is whoever really holds the rank, not a label.
 *
 * Read side only. Everyone here is a full simulated person who can be
 * promoted, punished, hurt or killed, which is the point of showing them.
 */
export function unitRosterOf(world: World, personId: EntityId): UnitRoster | null {
  return rosterFrom(world, personId, activeRecord(world, personId))
}

/**
 * The squad someone was in, for a record that has since CLOSED — the
 * newsroom needs it the month a soldier dies, when the record is already
 * shut and unitRosterOf rightly answers null. Members are still only the
 * living and serving: it is the squad that survives them.
 */
export function lastUnitRosterOf(world: World, personId: EntityId): UnitRoster | null {
  return rosterFrom(world, personId, world.service.get(personId))
}

function rosterFrom(
  world: World,
  personId: EntityId,
  record: ServiceRecordT | undefined,
): UnitRoster | null {
  if (!record) return null
  const mine = subUnitOf(world, personId, record.baseId)

  const members: RosterMember[] = []
  for (const other of world.service.values()) {
    if (other.dischargedAtTick !== null) continue
    if (other.baseId !== record.baseId || other.branch !== record.branch) continue
    const person = world.people.get(other.personId)
    if (!person || person.deathTick !== null) continue
    const theirs = subUnitOf(world, other.personId, other.baseId)
    if (theirs.company !== mine.company || theirs.squad !== mine.squad) continue
    members.push({
      personId: other.personId,
      name: `${person.givenName} ${person.familyName}`,
      rankTitle: rankTitle(other.branch, other.rank),
      rank: other.rank,
      specialtyTitle: specialtyById(other.specialtyId).title,
      role: '',
      deployed: isDeployed(world, other.personId),
    })
  }
  members.sort(
    (a, b) =>
      b.rank - a.rank ||
      (world.service.get(a.personId)?.rankSinceTick ?? 0) -
        (world.service.get(b.personId)?.rankSinceTick ?? 0) ||
      a.personId - b.personId,
  )

  const withRoles = members.map((member, index) => ({
    ...member,
    role: index === 0 ? 'squad leader' : index === 1 ? 'team leader' : member.specialtyTitle,
  }))

  return {
    unitName: `${mine.squad} Squad, ${mine.company} Company`,
    baseName: world.places.get(record.baseId)?.name ?? 'a home station',
    branchName: BRANCH_NAMES[record.branch as ServiceBranch] ?? 'the service',
    members: withRoles,
  }
}

/** The squadmate a medic would reach first: nearest in the same squad, not
 *  the person themselves. Used by the combat first-aid moment. */
export function squadmatesOf(world: World, personId: EntityId): readonly RosterMember[] {
  const roster = unitRosterOf(world, personId)
  if (!roster) return []
  return roster.members.filter((m) => m.personId !== personId)
}

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
      (e) => e.type === 'dropped-selection' && e.subjectId === personId && e.detail === unit.id,
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
/**
 * The marks on someone's file inside the window that can end a career, and
 * how many it takes. A soldier knows exactly where they stand with the
 * orderly room; the player was the only one who did not (review S3). Read
 * side only — the punishments themselves are never a choice.
 */
export function disciplinaryFileOf(
  world: World,
  personId: EntityId,
): { readonly marks: number; readonly endsCareerAt: number; readonly windowYears: number } | null {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return null
  const marks = world.events.filter(
    (e) =>
      e.type === 'disciplined' &&
      e.subjectId === personId &&
      world.tick - e.tick < MISCONDUCT_WINDOW_MONTHS,
  ).length
  return {
    marks,
    endsCareerAt: MISCONDUCT_STRIKES,
    windowYears: Math.floor(MISCONDUCT_WINDOW_MONTHS / 12),
  }
}

export function boardStandingFor(
  world: World,
  personId: EntityId,
): {
  readonly targetTitle: string
  /** The ladder INDEX the title renders from — what records key on (W1). */
  readonly targetRank: number
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
    targetRank: gates.targetRank,
    timeInGrade: world.tick - record.rankSinceTick,
    tigNeeded: gates.tigNeeded,
    cutoff: gates.cutoff,
    points: promotionPointsFor(world, personId),
    priorPassOvers: world.events.filter(
      (e) => e.type === 'passed-over' && e.subjectId === personId && e.detail === String(gates.targetRank),
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
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 0
  return pensionValueOf(world, personId)
}

/**
 * What a service record is worth per month, WITHOUT asking whether its
 * owner is still alive. pensionOf refuses the dead — this is what the
 * survivor's share is computed from (a widow's benefit is a share of what
 * he was drawing, and he is by definition not drawing it any more).
 */
export function pensionValueOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick === null) return 0

  let monthly = 0
  // What the service took: harm it left on the body.
  const serviceDisability = world.health.get(personId)?.serviceDisability ?? 0
  if (serviceDisability >= PENSION_THRESHOLD) {
    monthly += serviceDisability * PENSION_CENTS_PER_POINT
  }
  // What the service owes: the years themselves. Both can be true at once
  // — a wounded lifer is owed for the wound AND for the career.
  monthly += retirementPayOf(record)
  return monthly
}

/**
 * Retirement pay: what a full career is worth every month for the rest of
 * a life. Twenty years is the door (M-ARMY2's own career shape put it
 * there); a quarter of a per-cent per month served, so twenty years pays
 * half the final wage and thirty pays three quarters.
 *
 * A term ended early pays nothing — that is what makes twenty years mean
 * something. Neither does misconduct: the file that ends a career ends the
 * claim with it. Medical discharge has its own pension, above.
 */
export function retirementPayOf(
  record: NonNullable<ReturnType<World['service']['get']>>,
): number {
  if (record.dischargedAtTick === null) return 0
  if (record.dischargeReason === null) return 0
  if (!RETIREMENT_ENDINGS.has(record.dischargeReason)) return 0
  const years = Math.floor((record.dischargedAtTick - record.enlistedAtTick) / TICKS_PER_YEAR)
  if (years < Math.floor(RETIREMENT_ELIGIBLE_MONTHS / 12)) return 0
  const share = Math.min(750, years * 25)
  return Math.floor((record.monthlyPay * share) / 1000)
}

/** Endings that carry a career's pension. 'end of term' is not one of
 *  them — four years is a term, not a career. */
const RETIREMENT_ENDINGS: ReadonlySet<string> = new Set([
  'twenty years served',
  'thirty years served',
  'retirement age',
  'high-year tenure',
])

/** The share of a pension that outlives its holder, per cent. */
const SURVIVOR_SHARE = 55

/**
 * What a widow or widower draws from a pension their spouse no longer
 * can. A pension used to end at the grave and leave the person who spent
 * a career beside it with nothing — which, now that careers pay, would
 * quietly impoverish every service family at exactly the wrong moment.
 *
 * DERIVED, not stored: a marriage that ended on the day one of them died
 * IS widowhood (relationships turns the edge to former-spouse and stamps
 * endedAtTick), and the pension is read off the record the service keeps
 * forever. No schema change; an old save answers correctly.
 *
 * Reads world.relationships directly rather than importing the
 * relationships module — the same seam relationships uses to read service
 * (a widow's claim must not add a module cycle between them).
 */
export function survivorPensionOf(world: World, personId: EntityId): number {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 0

  let monthly = 0
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'former-spouse' || relationship.endedAtTick === null) continue
    if (relationship.a !== personId && relationship.b !== personId) continue
    const spouseId = relationship.a === personId ? relationship.b : relationship.a
    const spouse = world.people.get(spouseId)
    // Widowed, not divorced: the marriage ended the day they died.
    if (!spouse || spouse.deathTick === null) continue
    if (spouse.deathTick !== relationship.endedAtTick) continue
    const theirs = pensionValueOf(world, spouseId)
    if (theirs <= 0) continue
    monthly += Math.floor((theirs * SURVIVOR_SHARE) / 100)
  }
  return monthly
}

/** Civilian occupations a veteran's training opened. Empty for non-veterans.
 *  Unions EVERY trade served, not just the last — retraining for a final
 *  term must not erase twelve years of the old one (P2 military review). */
export function veteranUnlocks(world: World, personId: EntityId): readonly string[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick === null) return []
  const unlocks: string[] = []
  for (const specialtyId of [...record.priorSpecialtyIds, record.specialtyId]) {
    for (const occupation of specialtyById(specialtyId).civilianUnlocks) {
      if (!unlocks.includes(occupation)) unlocks.push(occupation)
    }
  }
  return unlocks
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
  if (age > ENLIST_MAX_AGE) return 'Past enlistment age — the office takes volunteers at eighteen to thirty-eight.'
  if (world.service.has(person.id)) return 'One service career per life; the record stands.'
  if (isSeverelyAiling(world, person.id)) return 'The body would not pass the medical today.'
  if ((world.health.get(person.id)?.disability ?? 0) >= MEDICAL_LIMIT) {
    return 'The medical exam reads the record of old harm, and refuses.'
  }
  const education = world.education.get(person.id)
  if (education?.enrolledIn !== null && education !== undefined) return 'Still in school.'
  // C1: the record at the courthouse answers first. Ten clean years and
  // the door opens again (waivers are a later milestone's nuance). Read
  // inline — crime.ts imports this module for discharge, so importing its
  // predicates back would add a direct two-module cycle; the shared
  // constant in content.ts keeps the two gates from drifting apart.
  const criminal = world.criminal.get(person.id)
  if (criminal !== undefined) {
    if (criminal.jailedUntilTick !== null && tick < criminal.jailedUntilTick) {
      return 'Not from a cell.'
    }
    if (criminal.convictions.some((c) => tick - c.tick < RECORD_GATE_YEARS * 12)) {
      return 'The record at the courthouse answers first.'
    }
  }
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
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
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

/**
 * M-ARMY2. Whether a recruiting drive is on: the recruiters set up in town
 * for the first three months of roughly every third year — and in EVERY
 * such window while the Republic is at war, because that is when the push
 * actually happens (review S6: the drive must be downstream of the world,
 * not the entire cause of itself). The calendar draw is derived from the
 * seed; the war term reads live state, and the drive's own EVENT (emitted
 * at each season's first month) is what history keeps — so a loaded old
 * save never grows drives it did not live (review S7).
 */
export function recruitingDriveActive(world: World, tick: Tick): boolean {
  if (tick < 0) return false
  const month = tick % TICKS_PER_YEAR
  if (month >= 3) return false
  const home = homeland(world)
  if (home && activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return true
  const year = Math.floor(tick / TICKS_PER_YEAR)
  const rng = openStream(world.seed, Stream.Employment, 909_090, year)
  return rng.chance(1, 3)
}

export function runService(world: World, tick: Tick): void {
  const drive = recruitingDriveActive(world, tick)
  // The season's first active month goes on the record — the event IS the
  // history the news reads (review S7).
  if (drive && !recruitingDriveActive(world, (tick - 1) as Tick)) {
    const home = homeland(world)
    if (home) {
      recordEvent(world, tick, { type: 'recruiting-drive', subjectId: home.id })
    }
  }
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
    const parentServed = person.parentIds.some((id) => world.service.has(id))

    if (person.id === world.player.personId) {
      // The drive knocks louder for the player too, and so does the family
      // that served — parity with the NPC terms below (review S3).
      const knock = (35 + (parentServed ? 10 : 0)) * (drive ? 3 : 1)
      if (!world.employment.has(person.id) && rng.chance(knock, 1_000)) {
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
    // M-ARMY2 (owner design): the family that served pulls a little, and a
    // recruiting drive in town is the season people actually walk in.
    const jobless = !world.employment.has(person.id)
    let propensity = (jobless ? 110 : 16) + Math.floor(person.traits.ambition / 25)
    if (parentServed) propensity += 30
    if (drive) propensity *= 3
    if (!rng.chance(propensity, 12_000)) continue

    const options = eligibleSpecialties(world, person)
    if (options.length === 0) continue
    const education = world.education.get(person.id)
    const weights = options.map((sp) => 1 + educationRank(sp.requires) + (education && meetsRequirement(education.level, sp.requires) ? 2 : 0))
    const chosen = rng.pickWeighted(options, weights)

    // Factor weights double as story salience: only the top three reach the
    // Why? (review S2). The drive — the largest single term in the model —
    // must outrank the tautological reached-adulthood, and the tradition
    // names the parent who served (rule 5).
    const servedParent = person.parentIds.find((id) => world.service.has(id)) ?? null
    enlistPerson(world, tick, person, chosen, [
      factor('reached-adulthood', 150),
      ...(jobless ? [factor('way-out-of-town', 500)] : []),
      ...(parentServed ? [factor('service-tradition', 300, servedParent)] : []),
      ...(drive ? [factor('recruiting-drive', 550)] : []),
      factor('ambition', person.traits.ambition),
    ])
  }
}

/**
 * M-ARMY2. The town's service news, read from EVENTS like every other news
 * source (an earlier draft derived it, which would assert drives an old
 * save never lived). The player is excluded throughout — their own
 * timeline carries their story.
 *
 * WHAT MAKES THE FEED, and why: the recruiting seasons (rare, and the
 * thing that makes people walk in), someone home from a war, and a death
 * in uniform. Enlistments and peacetime homecomings were removed on owner
 * direction — at four hundred people they buried the feed. Keeping the
 * war's return leg is deliberate: recruiting notices and funerals with
 * nothing between them is not a neutral picture of service either.
 */
export function serviceNewsSince(
  world: World,
  since: Tick,
): NewsItem[] {
  const items: NewsItem[] = []
  for (const event of world.events) {
    if (event.tick < since) continue
    if (event.type === 'recruiting-drive') {
      items.push({
        tick: event.tick,
        // Not 'nearby': the red rule is for what lands ON the town — a war
        // it is in, one of its own dead. A recruiting season is a notice
        // and should not wear the same emphasis (owner).
        text: 'the recruiters set up on the square — a drive is on',
        nearby: false,
        kind: 'recruiting-drive',
      })
      continue
    }
    if (event.subjectId === world.player.personId) continue
    // OWNER DIRECTION: enlistments are NOT news. At four hundred people
    // that was several a year, and the News tab reads from the beginning of
    // the world — the wall of cards buried everything else, and a card
    // about a man who enlisted forty years ago reads as a claim about him
    // today. A career belongs on the person's own timeline.
    //
    // What the town DOES hear is the heavy end: someone coming home from a
    // WAR (about one every three years, not one a month), and someone not
    // coming home at all. Review S6: a feed of recruiting notices and
    // deaths, with nothing in between, tilts in both directions at once.
    if (event.type === 'returned-home' && event.detail === 'tour complete') {
      const person = world.people.get(event.subjectId)
      const record = world.service.get(event.subjectId)
      if (!person || !record) continue
      items.push({
        tick: event.tick,
        text: `${person.givenName} ${person.familyName} came home from the war`,
        nearby: true,
        subjectId: person.id,
        kind: 'came-home',
      })
    } else if (event.type === 'died') {
      const record = world.service.get(event.subjectId)
      if (!record || record.dischargedAtTick !== event.tick) continue
      if (record.dischargeReason !== 'died in service') continue
      const person = world.people.get(event.subjectId)
      if (!person) continue
      items.push({
        tick: event.tick,
        text: `${person.givenName} ${person.familyName} died in service`,
        nearby: true,
        subjectId: person.id,
        kind: 'died-in-service',
      })
    }
  }
  items.sort((a, b) => a.tick - b.tick)
  return items
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

  // M-ARMY2 career shape (owner): thirty years is a career, sixty-two is
  // the last year in uniform — the army's decisions, not questions, player
  // and NPC alike. Neither fires in a theatre (the boat home first; the
  // dead-in-theatre lessons hold for the living too).
  if (!isDeployed(world, person.id)) {
    if (ageAt(person.birthTick, tick) >= SERVICE_RETIREMENT_AGE) {
      discharge(world, tick, person, record, 'retirement age', [factor('old-age', 700)])
      return
    }
    const served = tick - record.enlistedAtTick
    const ceiling = careerCeilingMonths(
      BRANCH_GRADES[record.branch as ServiceBranch][record.rank] ?? 9,
    )
    if (served >= ceiling) {
      discharge(
        world, tick, person, record,
        ceiling === RETIREMENT_ELIGIBLE_MONTHS ? 'twenty years served' : 'thirty years served',
        [factor('term-ended', 800)],
      )
      return
    }
  }

  // Performance drifts toward what diligence can deliver, as at any work.
  const pull = person.traits.diligence - record.performance
  let performance = Math.max(0, Math.min(1000, record.performance + Math.floor(pull / 40) + rng.nextInt(-8, 9)))

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

  let promotedThisMonth = false
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
      promotedThisMonth = true
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
  // P2: a retrain's school completes on its own clock — without this the
  // feed said "reported to school" forever (military review S2).
  if (
    record.specialtyChangedAtTick !== null &&
    tick - record.specialtyChangedAtTick === specialty.schoolMonths
  ) {
    recordEvent(world, tick, { type: 'completed-training', subjectId: person.id, detail: `${specialty.title} school` })
  }
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
      const dropsFor = (unitId: string): number =>
        world.events.filter(
          (e) => e.type === 'dropped-selection' && e.subjectId === person.id && e.detail === unitId,
        ).length
      const unit = SPECIAL_UNITS.find(
        (u) =>
          u.branches.includes(branch) &&
          record.unitId !== u.id &&
          (u.feederUnitId === null ? record.unitId === null : record.unitId === u.feederUnitId) &&
          rank >= u.minRank &&
          performance >= u.minPerformance &&
          u.requiredBadges.every((b) => badges.includes(b)) &&
          dropsFor(u.id) < 2,
      )
      if (unit) {
        const margin = Math.max(10, Math.min(400, performance - unit.minPerformance + 60))
        if (rng.chance(margin, unit.selectionDenominator)) {
          unitId = unit.id
          recordEvent(world, tick, { type: 'joined-unit', subjectId: person.id, detail: unit.id })
        } else {
          recordEvent(world, tick, { type: 'dropped-selection', subjectId: person.id, detail: unit.id })
        }
      }
    }
  }

  // --- Misconduct (M-ARMY2, owner: "mistakes that can get you Article
  // 15's"). A company punishment happens TO a soldier the way an illness
  // does: careless months produce it, the record keeps it, and a third
  // inside five years ends the career — which is also the honest removal
  // path for the ranks up-or-out no longer touches. Not in a theatre
  // (deployment owns those months), not during basic.
  if (!deployed && monthsIn > 2 && rng.chance(misconductChance(person, performance), 1_000)) {
    const priorStrikes = world.events.filter(
      (e) =>
        e.type === 'disciplined' &&
        e.subjectId === person.id &&
        tick - e.tick < MISCONDUCT_WINDOW_MONTHS,
    ).length
    const severe = rng.chance(1, 6)
    const willBust = severe && rank > 0 && priorStrikes + 1 < MISCONDUCT_STRIKES
    const infraction = severe ? rng.pick(SEVERE_INFRACTIONS) : rng.pick(MINOR_INFRACTIONS)
    // The stripe lost is in the event's own words — a demotion must never
    // be silent (the P1 principle).
    recordEvent(world, tick, {
      type: 'disciplined',
      subjectId: person.id,
      detail: willBust ? `${infraction} — busted a stripe` : infraction,
    })

    if (priorStrikes + 1 >= MISCONDUCT_STRIKES) {
      // The file is full. The month ends at the orderly room.
      discharge(world, tick, person, world.service.get(person.id)!, 'misconduct', [
        factor('poor-performance', 1000 - performance),
        factor('prior-record', priorStrikes * 300),
      ])
      return
    }
    performance = Math.max(0, performance - (severe ? 80 : 60))
    if (willBust) {
      // Busted a grade. The month's promotion, if one landed, is undone by
      // the same stroke.
      rank -= 1
      rankSinceTick = tick
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
    // Never on a month a promotion just landed (P1 review M1): the stale
    // time-in-grade would open the NEXT board with zero months in the new
    // grade — a same-tick second 'promotion' record hijacks the Why?, and
    // a put-in dies against its own fresh rankSinceTick. The board waits
    // for a month in grade like the soldier does.
    const gates = promotedThisMonth ? null : competitiveGates(specialty, rank)
    if (gates) {
      // LIVE time in grade, not the value captured at the top of the month
      // (review S4): a bust resets rankSinceTick, and the stale figure asked
      // a just-demoted soldier to put in with credit they no longer had —
      // then the answer's own re-check failed and recorded NOTHING. The
      // board waits for a month in grade like the soldier does.
      const over = tick - rankSinceTick - gates.tigNeeded
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
    // rating the board counts. RARER than the first draft (owner: "I get
    // hit with a lot of the base pop ups but not very many interactive
    // scenes where it's life or death"): the routine questions were
    // crowding out the ones that matter. Roughly one slot every six years,
    // and the player can always ASK for one from the Service tab.
    if (rng.chance(1, 72)) {
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
    // The rotation list, while the Republic fights — asked twice as rarely
    // now, for the same reason as the schoolhouse: orders find people
    // anyway, and the volunteer button is always there.
    const home = homeland(world)
    if (
      home !== undefined &&
      activeWars(world).some((w) => w.a === home.id || w.b === home.id) &&
      rng.chance(1, 12)
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

  // HIGH-YEAR TENURE: up or out — but ONLY below E-5 (M-ARMY2, owner:
  // "a ton of people retire at SGT, SSG"). Make sergeant and the service
  // will keep you to thirty years or sixty-two, unless the file fills with
  // misconduct. Below the line, six years in grade and the service does
  // not offer another term — player and NPC alike, the army's decision,
  // not a question. The term was served in full, so good conduct is still
  // judged (the grant accepts this discharge).
  const grade = BRANCH_GRADES[branch][rank] ?? 9
  if (grade < HYT_BELOW_GRADE && tick - rankSinceTick >= HIGH_YEAR_TENURE_TIG) {
    discharge(world, tick, person, world.service.get(person.id)!, 'high-year tenure', [
      factor('time-in-grade', 1000),
    ])
    return
  }

  // Term's end. The player signs or leaves; an NPC's retention is a weighing
  // of the same things (rank earned, other doors), resolved by their own roll.
  if (person.id === world.player.personId) {
    const landed = raisePending(world, {
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
    if (landed) {
      // The clock halts on the pending; the term is settled by the answer.
      world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 0 })
    } else {
      // Another question held the slot: the term holds one more month and
      // the office asks again (P1: no silent loss of the term's question).
      // Accepted corner (review S3): the retry month still adds to
      // termPerformanceSum, inflating the closing term's average ~2% — the
      // same shape stop-loss already accepts over far longer holds.
      world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 1 })
    }
    return
  }

  // Twenty years in, most people take the retirement — that is what makes
  // "retired as a sergeant" the ordinary end of a career rather than a rare
  // one (review S2). Before then, rank earned makes staying likelier.
  const retirementEligible = tick - record.enlistedAtTick >= RETIREMENT_ELIGIBLE_MONTHS
  const retention = retirementEligible ? 260 : 380 + rank * 90
  if (rng.chance(retention, 1_000)) {
    reenlist(world, tick, person)
  } else {
    discharge(
      world, tick, person, world.service.get(person.id)!,
      retirementEligible ? 'twenty years served' : 'end of term',
      [factor('term-ended', 600)],
    )
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

// ---------------------------------------------------------------------------
// P2 single-writer helpers. The player's tab verbs and board resolution used
// to write world.service directly from player.ts — a DOMAIN_MAP §6 violation
// carried since M-SERVICE-PLAY. Every mutation now comes through here. Each
// helper is the FIELD WRITE only: the caller owns the story (events, records,
// rolls), because who asked and why differs between callers.
// ---------------------------------------------------------------------------

type ServiceRecordT = NonNullable<ReturnType<World['service']['get']>>

function activeRecord(world: World, personId: EntityId): ServiceRecordT | undefined {
  const record = world.service.get(personId)
  return record === undefined || record.dischargedAtTick !== null ? undefined : record
}

/**
 * M-ARMY2. Death in uniform closes the record — quietly: the death event is
 * the event, and a 'discharged' card for the dead would read wrong. The
 * record survives (foundation §10) with an honest end date, and the
 * deployment quota's countServing stops counting a body.
 */
export function closeServiceOnDeath(world: World, tick: Tick, personId: EntityId): void {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return
  world.service.set(personId, {
    ...record,
    dischargedAtTick: tick,
    dischargeReason: 'died in service',
    termMonthsLeft: 0,
  })
}

/**
 * A veteran has died. If they were drawing a pension and leave a spouse,
 * the survivor's share begins — ON THE RECORD, the same rule every other
 * pension follows (never silent income). Called for EVERY death, not only
 * deaths in uniform: most veterans die decades after the uniform came off.
 *
 * Must run BEFORE relationships turns the marriage into widowhood, which
 * is why performDeath calls it where it does — the spouse is still a
 * spouse at this moment. The ongoing payment is derived by
 * survivorPensionOf from the widowed edge afterwards.
 */
export function openSurvivorPension(world: World, tick: Tick, deceasedId: EntityId): void {
  const value = pensionValueOf(world, deceasedId)
  if (value <= 0) return
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'spouse') continue
    if (relationship.a !== deceasedId && relationship.b !== deceasedId) continue
    const survivorId = relationship.a === deceasedId ? relationship.b : relationship.a
    const survivor = world.people.get(survivorId)
    if (!survivor || survivor.deathTick !== null) continue
    const share = Math.floor((value * SURVIVOR_SHARE) / 100)
    if (share <= 0) continue
    recordEvent(world, tick, {
      type: 'granted-pension',
      subjectId: survivorId,
      otherId: deceasedId,
      detail: String(share),
    })
    recordDecision(world, tick, {
      subjectId: survivorId,
      decision: 'pension',
      significance: 'notable',
      inputs: [factor('service-tradition', 600, deceasedId)],
      chosen: "the survivor's share of a service pension began",
      rejected: [],
      streamId: Stream.Employment,
    })
    return
  }
}

/** Raise performance (capped at 1000) — schools and courses pay this. */
export function boostServicePerformance(world: World, personId: EntityId, amount: number): void {
  const record = activeRecord(world, personId)
  if (!record) return
  world.service.set(personId, {
    ...record,
    performance: Math.min(1000, record.performance + amount),
  })
}

/** Put someone in a special unit — selection already passed by the caller. */
export function assignServiceUnit(world: World, personId: EntityId, unitId: string): void {
  const record = activeRecord(world, personId)
  if (!record) return
  world.service.set(personId, { ...record, unitId })
}

/** Set the fitness score, clamped to the test's own scale. */
export function setServiceFitness(world: World, personId: EntityId, score: number): void {
  const record = activeRecord(world, personId)
  if (!record) return
  world.service.set(personId, {
    ...record,
    fitnessScore: Math.max(0, Math.min(MAX_FITNESS_POINTS, score)),
  })
}

/** Append a qualification if it is not already held. */
export function addServiceQualification(world: World, personId: EntityId, qualification: string): void {
  const record = activeRecord(world, personId)
  if (!record || record.qualifications.includes(qualification)) return
  world.service.set(personId, {
    ...record,
    qualifications: [...record.qualifications, qualification],
  })
}

/** The board said yes: one grade up, pay to match. Returns the new rank for
 *  the caller's prose, or null if nobody was there to promote. */
export function applyBoardPromotion(world: World, tick: Tick, personId: EntityId): number | null {
  const record = activeRecord(world, personId)
  if (!record) return null
  const newRank = record.rank + 1
  world.service.set(personId, {
    ...record,
    rank: newRank,
    rankSinceTick: tick,
    monthlyPay: servicePay(record.branch as ServiceBranch, newRank),
  })
  return newRank
}

/** P2. Change trade at reenlistment: the old trade joins the record's
 *  history (veteranUnlocks unions across all of them — nothing served is
 *  erased), the new trade's school runs from this tick (deployment waits
 *  for it; completed-training fires when it lands), and the pay table
 *  already keys on rank alone. */
export function retrainSpecialty(
  world: World,
  tick: Tick,
  person: Person,
  specialtyId: string,
): void {
  const record = activeRecord(world, person.id)
  if (!record || record.specialtyId === specialtyId) return
  const previous = specialtyById(record.specialtyId)
  world.service.set(person.id, {
    ...record,
    specialtyId,
    priorSpecialtyIds: [...record.priorSpecialtyIds, record.specialtyId],
    specialtyChangedAtTick: tick,
  })
  const specialty = specialtyById(specialtyId)
  recordEvent(world, tick, {
    type: 'began-training',
    subjectId: person.id,
    detail: `${specialty.title} school`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'training',
    significance: 'major',
    inputs: [factor('own-choice', 1000)],
    chosen: `retrained as ${withArticle(specialty.title)}`,
    rejected: [`to stay ${withArticle(previous.title)}`],
    streamId: Stream.Employment,
  })
}

export function discharge(
  world: World,
  tick: Tick,
  person: Person,
  record: NonNullable<ReturnType<World['service']['get']>>,
  reason: string,
  inputs: readonly CausalFactor[],
  // The stream that actually resolved this discharge, so the record can be
  // re-derived: crime's misconduct discharge passes its own (review S5).
  streamId: StreamId = Stream.Employment,
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

  // And the career's own pension, which the years earned rather than the
  // wounds. Read off the record we just closed, so the reason and the
  // years are the ones that actually ended it (M-ARMY2: a thirty-year
  // sergeant used to retire with nothing at all).
  const closed = world.service.get(person.id)
  const retirementPay = closed === undefined ? 0 : retirementPayOf(closed)
  if (retirementPay > 0) {
    const years = Math.floor((tick - record.enlistedAtTick) / TICKS_PER_YEAR)
    recordEvent(world, tick, {
      type: 'granted-pension',
      subjectId: person.id,
      detail: String(retirementPay),
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'pension',
      significance: 'notable',
      inputs: [factor('time-in-grade', Math.min(1000, years * 30)), factor('term-ended', 600)],
      chosen: `retired on ${String(years)} years' service`,
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
    streamId,
  })
}

/** True when the education fork at eighteen should offer the uniform. */
export function educationOffersEnlistment(world: World, person: Person, tick: Tick): boolean {
  return canEnlist(world, person, tick) && !hasAnswered(world, 'enlist')
}
