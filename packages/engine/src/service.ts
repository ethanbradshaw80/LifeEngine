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

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { eventsFor } from './eventindex.js'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import {
  grantAchievement,
  grantCommendation,
  grantGoodConduct,
  grantLongService,
  grantMeritoriousService,
  grantNationalDefense,
  grantNcoDevelopment,
  grantQualificationBadge,
  grantServiceRibbon,
} from './awards.js'
import { ageAt } from './clock.js'
import { atTodaysPrices } from './economy.js'
import { entryTestScore } from './enlistment.js'
import {
  BOARD_CUTOFF_BASE,
  BOARD_CUTOFF_STEP,
  BILLET_TOUR_MONTHS,
  BRANCH_BILLETS,
  HIGH_YEAR_TENURE_TIG,
  MAX_DECORATION_POINTS,
  MAX_FITNESS_POINTS,
  MAX_SENIORITY_POINTS,
  PENSION_CENTS_PER_POINT,
  PENSION_THRESHOLD,
  POINTS_PER_BADGE,
  POINTS_PER_ACHIEVEMENT,
  POINTS_PER_CAMPAIGN,
  POINTS_PER_COMMENDATION,
  POINTS_PER_NATIONAL_DEFENSE,
  POINTS_PER_NCO_DEVELOPMENT,
  POINTS_PER_OVERSEAS,
  POINTS_PER_SERVICE_RIBBON,
  POINTS_PER_COMBAT_ACTION,
  POINTS_PER_GOOD_CONDUCT,
  POINTS_PER_LONG_SERVICE,
  POINTS_PER_MERITORIOUS,
  POINTS_PER_VALOR,
  POINTS_PER_WOUND_RECOGNITION,
  SERVICE_TERM_MONTHS,
  specialtyTitleFor,
  servicePayOn,
  officerPayOn,
  offenceById,
  isFelony,
} from './content.js'
import { activeWars, homeland } from './geopolitics.js'
import type { NewsItem } from './geopolitics.js'
import type { ServiceSchool, ServiceSpecialty } from './content.js'
import { educationRank, meetsRequirement } from './content.js'
import { isDeployed } from './deployment.js'
import { inflictWound, isSeverelyAiling } from './health.js'
import { hasAnswered, raisePending } from './player.js'
import { isCaptive } from './deployment.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { withArticle } from './text.js'
import { hash32, openStream, type Rng, Stream, type StreamId } from './rng.js'
import type { CausalFactor, Person, Place, World } from './types.js'
import {
  optionsFor,
  reenlistEligibility,
  indefiniteStandingFor,
  INDEFINITE_MIN_GRADE,
  INDEFINITE_RETIRE_AT_YEARS,
  SERVICE_MAX_YEARS,
  srbFor,
  STABILITY_MONTHS,
} from './reenlistment.js'
import type { Eligibility, ReenlistmentOption } from './reenlistment.js'
import { placesOfKind } from './worldgen.js'
import { branchSpecFor, specialtyFor, unitFor } from './worldspec.js'

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
 * How long up-or-out lets somebody sit at a junior grade — LONGER for a
 * soldier who is visibly working at it.
 *
 * OWNER (playing): people should be shown the door "only if they suck, or
 * have low effort like no badges or anything and aren't trying hard". A flat
 * six-year clock could not tell those two apart: the soldier collecting
 * schools and holding a good evaluation went out on exactly the same month
 * as the one coasting, because the only thing being measured was that the
 * board had not picked them up.
 *
 * So the effort the player actually put in buys time. A strong evaluation is
 * two more years; a rack of qualifications is two more again. Six years for
 * somebody doing nothing, ten for somebody trying and unlucky — which is
 * also the honest shape, because a strong performer at a junior grade is
 * somebody the board eventually reaches.
 */
function highYearTenureMonthsFor(record: {
  readonly performance: number
  readonly qualifications: readonly string[]
}): number {
  let months = HIGH_YEAR_TENURE_TIG
  if (record.performance >= 550) months += 24
  if (record.qualifications.length >= 2) months += 24
  return months
}
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
function careerCeilingMonths(grade: number, indefinite: boolean): number {
  // ADR-0032, corrected. AN INDEFINITE CAREER RUNS TO THIRTY. The grade-5
  // ceiling of twenty was written when nothing else capped a sergeant, and
  // under the twelve-year wall it did the opposite of what it should:
  // somebody who had just committed to indefinite service was force-retired
  // at exactly the point the choice was supposed to become theirs.
  if (indefinite) return SERVICE_MAX_YEARS * 12
  return grade <= 5 ? RETIREMENT_ELIGIBLE_MONTHS : 360
}
/** Mandatory retirement age. Nobody serves past it, rank regardless. */
const SERVICE_RETIREMENT_AGE = 62

/**
 * ADR-0037. Was this serving person convicted THIS month of something the
 * court did not send them away for? Returns the offence in words, or null.
 *
 * Read-only on `world.criminal`, which crime.ts owns. Confinement is
 * excluded deliberately: a soldier in a cell is a separation problem, not
 * an orderly-room one, and the existing path already handles them.
 */
function convictionToAnswerFor(world: World, personId: EntityId, tick: Tick): string | null {
  const record = world.criminal.get(personId)
  if (!record) return null
  // THE MONTH AFTER, because runService runs before runCrime in the tick —
  // a conviction handed down this month is not on the commander's desk
  // until next month, which is also how it works. Checking the previous
  // month exactly, once, is what keeps it from firing twice.
  for (const conviction of record.convictions) {
    if (conviction.tick !== tick - 1) continue
    if (conviction.sentenceMonths > 0) return null
    return offenceById(conviction.kind)?.title ?? conviction.kind
  }
  return null
}

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
  const unit = record.unitId === null ? undefined : unitFor(world, record.unitId)
  // AT TODAY'S PRICES, like every civilian wage. Service pay was the one
  // wage in the world that never moved: the grade tables are base-year
  // content and were being paid out at face value forever, so a sergeant
  // in 2070 drew a 1970 sergeant's money while the rent around him had
  // risen eightfold. The stored `monthlyPay` stays base-year — it is the
  // grade's pay, not this month's — and the price level is applied here,
  // in the one place the number is read.
  return atTodaysPrices(world, (record.monthlyPay + (unit?.dutyPay ?? 0)) as Money)
}


/** What a branch is called: "the Land Forces". */
export function branchName(world: World, branchId: string): string {
  return branchSpecFor(world, branchId).name
}

/** The branch's own title for a ladder index — 'PFC', 'PO2', 'SSgt'. */
/**
 * A rank's title on the ladder somebody is actually on.
 *
 * `commissioned` decides which ladder is read. It defaults to the enlisted
 * one, so every existing caller keeps its meaning and a record written
 * before commissions existed reads exactly as it did.
 */
/**
 * What to call this person, reading their own record for which ladder they
 * are on. Prefer this over rankTitle where a record exists — it is the one
 * that cannot get an officer's title wrong.
 */
export function rankTitleOf(world: World, personId: EntityId): string {
  const record = world.service.get(personId)
  if (!record) return ''
  // THE BILLET SHOWS OVER THE GRADE while it is held. A first sergeant is
  // addressed as one, not as the master sergeant he is on the pay table.
  if (typeof record.billet === 'string' && record.billet !== '') return record.billet
  return rankTitle(world, record.branch, record.rank, record.commissioned === true)
}

/**
 * COMMISSIONING (owner: the college pipeline had nowhere to go).
 *
 * A degree at the recruiting office is a commission, which is how every
 * army this is modelled on treats one. It is not a bonus: an officer
 * starts at the bottom of a different ladder, with a longer obligation and
 * a different job, and a sergeant with fifteen years out-earns a new
 * lieutenant.
 */
export function commissionsOnEntry(world: World, personId: EntityId): boolean {
  return (world.education.get(personId)?.level ?? 'none') === 'college'
}

export function rankTitle(
  world: World,
  branch: string,
  rank: number,
  commissioned = false,
): string {
  const spec = branchSpecFor(world, branch)
  const ladder = commissioned ? (spec.officerRanks ?? []) : spec.ranks
  // An unresolvable branch has no ladder: say the index rather than inventing
  // a rank from someone else's.
  if (ladder.length === 0) return `#${String(rank)}`
  return ladder[Math.max(0, Math.min(ladder.length - 1, rank))] ?? ladder[0] ?? 'PVT'
}

/** The gates on the NEXT competitive step, or null when the next step is
 *  junior (time-based) or the ladder is topped out. The cutoff is POINTS,
 *  per trade — the real monthly-cutoff-list shape (M-SPECOPS). */
export function competitiveGates(
  world: World,
  specialty: ServiceSpecialty,
  rank: number,
  commissioned = false,
): { readonly targetRank: number; readonly tigNeeded: number; readonly cutoff: number } | null {
  const branch = branchSpecFor(world, specialty.branch)
  // THE LADDER THIS PERSON IS ACTUALLY ON (military review, must-fix 1). This
  // read the enlisted ladder for everybody, so a commissioned member at 1LT
  // asked whether index 2 cleared an ENLISTED competitiveFrom of four — it
  // does not — and fell out of both the junior path and the board path. The
  // career stopped dead at O-2 while the pay table, the TIG table and six
  // officer ranks sat there unreachable.
  const ladder = commissioned ? (branch.officerRanks ?? branch.ranks) : branch.ranks
  const grades = commissioned ? (branch.officerGrades ?? branch.grades) : branch.grades
  const competitiveFrom = commissioned ? OFFICER_COMPETITIVE_FROM : branch.competitiveFrom
  if (rank >= ladder.length - 1) return null
  if (rank + 1 < competitiveFrom) return null
  const stepsUp = rank + 1 - competitiveFrom
  // A same-grade lateral (SPC→CPL) is an appointment, not a grade board —
  // quicker than a board, but it waits on a billet, not on the calendar
  // alone (owner: two mid-career promotions in a year reads wrong).
  const sameGrade = grades[rank + 1] === grades[rank]
  // An officer's boards are FAR apart — four years in grade for major, five
  // for lieutenant colonel — which is the same table the junior officer
  // steps read, so the two halves of the ladder cannot drift.
  const tigNeeded = commissioned
    ? (OFFICER_TIG_MONTHS[rank] ?? 48)
    : sameGrade
      ? 12
      : 12 + stepsUp * 6
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
    if (award.kind === 'commendation') return sum + award.count * POINTS_PER_COMMENDATION
    if (award.kind === 'achievement') return sum + award.count * POINTS_PER_ACHIEVEMENT
    if (award.kind === 'nco-development') return sum + award.count * POINTS_PER_NCO_DEVELOPMENT
    if (award.kind === 'national-defense') return sum + award.count * POINTS_PER_NATIONAL_DEFENSE
    if (award.kind === 'overseas') return sum + award.count * POINTS_PER_OVERSEAS
    if (award.kind === 'service-ribbon') return sum + award.count * POINTS_PER_SERVICE_RIBBON
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
 * truths). Keyed on the POSTING, so everybody at a station in the same
 * branch serves in the same sub-unit, and a transfer genuinely moves them.
 *
 * IT USED TO BE KEYED ON THE PERSON, which split each posting across
 * sixteen buckets. Measured across three sixty-year towns: postings hold
 * one to five people, and 30 of 34 serving members were ALONE in their own
 * squad — so there was no squad, no squadmates, and an officer could never
 * be listed at the head of anything (owner: "not being properly listed or
 * assigned to squads"). A structure that exists on paper and never has two
 * people in it is not a structure.
 */
function subUnitOf(
  world: World,
  baseId: EntityId,
  branchId: string,
): { company: string; squad: string } {
  const branchIndex = Math.max(0, world.spec.branches.findIndex((b) => b.id === branchId))
  const draw = hash32(world.seed, Stream.Employment, baseId, 31_000 + branchIndex)
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
/**
 * Somebody from this unit who has died in the last few months, or null.
 *
 * The ramp ceremony scene asserts a death; this is what makes the assertion
 * true before it is spoken. Only the unit's own, only recently, and the
 * roster helpers cannot answer it — they list the LIVING on purpose.
 */
export function deadFromTheUnit(world: World, unitId: string, tick: Tick): EntityId | null {
  let found: EntityId | null = null
  for (const record of world.service.values()) {
    if (record.unitId !== unitId) continue
    const person = world.people.get(record.personId)
    if (!person || person.deathTick === null) continue
    if (tick - person.deathTick > 3 || person.deathTick > tick) continue
    if (found === null || record.personId < found) found = record.personId
  }
  return found
}

export function unitRosterOf(world: World, personId: EntityId): UnitRoster | null {
  return rosterFrom(world, activeRecord(world, personId))
}

/**
 * The squad someone was in, for a record that has since CLOSED — the
 * newsroom needs it the month a soldier dies, when the record is already
 * shut and unitRosterOf rightly answers null. Members are still only the
 * living and serving: it is the squad that survives them.
 */
export function lastUnitRosterOf(world: World, personId: EntityId): UnitRoster | null {
  return rosterFrom(world, world.service.get(personId))
}

/**
 * §6. WHO SWEARS YOU IN.
 *
 * The people senior to you in your own squad, senior first. A ceremony
 * administered by a name the player has watched get promoted, wounded or
 * buried is a different thing from one administered by an anonymous
 * adjutant — and every one of these is a full simulated person who can
 * later be any of those.
 *
 * Empty only where the posting genuinely holds nobody senior — a small town
 * whose station has one soldier on it. A recruit is posted the day they
 * sign, so in a working world they usually DO have somebody to choose, and
 * that is right: you are sworn in by whoever is there, and the first name
 * on your record is a person rather than a form.
 */
export function oathAdministratorsFor(world: World, personId: EntityId): readonly RosterMember[] {
  const record = activeRecord(world, personId)
  if (!record) return []

  // THE POSTING IS THE UNIT. Everyone at a station in the same branch now
  // serves in one sub-unit, so "your squad first" no longer distinguishes
  // anybody — seniority does, and the senior person present is the one who
  // would actually administer it.
  const candidates: { member: RosterMember; authority: number }[] = []
  for (const other of world.service.values()) {
    if (other.personId === personId) continue
    if (other.dischargedAtTick !== null) continue
    if (other.baseId !== record.baseId || other.branch !== record.branch) continue
    // SENIOR BY AUTHORITY, not by ladder index — an index comparison called
    // a lieutenant junior to a master sergeant, because both ladders start
    // at zero.
    if (authorityOf(world, other.personId) <= authorityOf(world, personId)) continue
    const person = world.people.get(other.personId)
    if (!person || person.deathTick !== null) continue
    if (isDeployed(world, other.personId)) continue
    candidates.push({
      authority: authorityOf(world, other.personId),
      member: {
        personId: other.personId,
        name: `${person.givenName} ${person.familyName}`,
        rankTitle: rankTitle(world, other.branch, other.rank, other.commissioned === true),
        rank: other.rank,
        specialtyTitle: specialtyFor(world, other.specialtyId).title,
        role: other.commissioned === true ? 'your officer' : 'your unit',
        deployed: false,
      },
    })
  }
  candidates.sort(
    (a, b) => b.authority - a.authority || a.member.personId - b.member.personId,
  )
  return candidates.slice(0, 3).map((c) => c.member)
}

/**
 * How senior somebody is, comparably across the two ladders.
 *
 * Pay grade, with every officer above every enlisted member — which is the
 * one thing the raw ladder index cannot express, because both ladders start
 * at zero.
 */
function authorityOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (!record) return -1
  const branch = branchSpecFor(world, record.branch)
  if (record.commissioned === true) {
    return 100 + ((branch.officerGrades ?? [])[record.rank] ?? record.rank + 1)
  }
  return branch.grades[record.rank] ?? record.rank + 1
}

function rosterFrom(world: World, record: ServiceRecordT | undefined): UnitRoster | null {
  if (!record) return null
  const mine = subUnitOf(world, record.baseId, record.branch)

  // A SPECIAL UNIT IS A UNIT (owner, playing: "I just got assigned to a
  // special unit after dropping a packet but my actual unit like the people
  // in it didn't change").
  //
  // He is right, and it was a hole rather than a decision: the roster was
  // built from base + branch and never read `unitId` at all, so passing
  // selection changed the badge on the record and nothing about who you
  // served beside. The whole point of selection is the people on the other
  // side of it.
  //
  // So: in a special unit, your roster is that unit — and ONLY that unit,
  // wherever its people are stationed, because a unit that recruits by
  // selection is not a station's worth of whoever turned up. Outside one,
  // your roster is the station as before, minus anybody who has left it for
  // a selected unit. They are not in your squad any more either.
  const inSpecialUnit = record.unitId !== null

  const members: RosterMember[] = []
  for (const other of world.service.values()) {
    if (other.dischargedAtTick !== null) continue
    if (inSpecialUnit) {
      if (other.unitId !== record.unitId) continue
    } else {
      if (other.unitId !== null) continue
      if (other.baseId !== record.baseId || other.branch !== record.branch) continue
    }
    const person = world.people.get(other.personId)
    if (!person || person.deathTick !== null) continue
    members.push({
      personId: other.personId,
      name: `${person.givenName} ${person.familyName}`,
      // The ladder THEY are on. A lieutenant in the roster was being listed
      // under a private's rank (owner: "having their rank wrongs in
      // different menus").
      rankTitle: rankTitle(world, other.branch, other.rank, other.commissioned === true),
      rank: other.rank,
      specialtyTitle: specialtyFor(world, other.specialtyId).title,
      role: '',
      deployed: isDeployed(world, other.personId),
    })
  }
  // SORTED BY WHO ACTUALLY ANSWERS FOR THE REST, which is not the ladder
  // index. Rank is an index into whichever ladder somebody is on, so a
  // second lieutenant sat at 0 and sorted BELOW a master sergeant at 8 —
  // the platoon's officer was listed last and a sergeant was named as their
  // leader (owner: "not being properly listed or assigned to squads"). An
  // officer is above the enlisted, and within each ladder the grade orders
  // them.
  members.sort(
    (a, b) =>
      authorityOf(world, b.personId) - authorityOf(world, a.personId) ||
      (world.service.get(a.personId)?.rankSinceTick ?? 0) -
        (world.service.get(b.personId)?.rankSinceTick ?? 0) ||
      a.personId - b.personId,
  )

  // And the roles follow: a squad with an officer in it is led by the
  // officer, and the senior enlisted beside them is the platoon sergeant —
  // not a "team leader" reporting to nobody.
  const ledByAnOfficer = world.service.get(members[0]?.personId ?? (0 as EntityId))?.commissioned === true
  const withRoles = members.map((member, index) => ({
    ...member,
    role:
      index === 0
        ? ledByAnOfficer
          ? 'platoon leader'
          : 'squad leader'
        : index === 1
          ? ledByAnOfficer
            ? 'platoon sergeant'
            : 'team leader'
          : member.specialtyTitle,
  }))

  // A selected unit is called by its own name. "1st Squad, A Company" is
  // what an ordinary posting is called; the Pathfinders are the Pathfinders.
  const special = record.unitId === null ? undefined : unitFor(world, record.unitId)
  return {
    unitName: special?.name ?? `${mine.squad} Squad, ${mine.company} Company`,
    baseName: world.places.get(record.baseId)?.name ?? 'a home station',
    branchName: branchName(world, record.branch),
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
export interface SchoolOption {
  readonly id: string
  readonly title: string
  readonly badge: string
  readonly open: boolean
  readonly reason: string
  /** How long the course runs, once you are on it. */
  readonly courseMonths: number
  /** The tick the next class starts, off the fixed grid. */
  readonly nextClassTick: Tick
  /** Months until that class starts. Zero means it starts this month. */
  readonly monthsUntilClass: number
  /** Seats left in it, after everyone already slotted in. */
  readonly seatsLeft: number

  // ---- M-SCHOOL §6, what the schoolhouse tab needs ------------------
  /**
   * Whether this course belongs on this soldier's list AT ALL.
   *
   * False for another service's schools, another trade's, and the other
   * ladder's — facts about who they are, which no amount of work changes.
   * True for everything else, including courses they cannot get into
   * today: a standing not yet reached is worth seeing.
   *
   * THE TAB READS THIS ONE FIELD. It used to filter by matching the reason
   * TEXT, which broke the moment a flag rewrote the reason — a flagged
   * soldier saw every course in the game. A boolean cannot be knocked out
   * by reordering a message.
   */
  readonly onYourList: boolean
  /** pme · skill · selection — the tab groups by this. */
  readonly category: 'pme' | 'skill' | 'selection'
  /** How hard, 1–5, for a dot read rather than a number nobody can place. */
  readonly difficultyDots: number
  /** How scarce a seat is, 1–5, same idea. */
  readonly scarcityDots: number
  /** The grade this course gates, if it gates one. */
  readonly gatesGrade: number | null
  /** Every gate, met or not, in the words the screen should use. */
  readonly requirements: readonly { readonly met: boolean; readonly words: string }[]
  /** What this soldier has already tried here. */
  readonly attempts: {
    readonly failed: number
    readonly graduated: boolean
    readonly injured: number
    readonly left: number
  }
}

/**
 * The next class start for a school, off a FIXED GRID from tick 0 (owner
 * spec). Not a draw and not "whenever you asked" — the schoolhouse has a
 * calendar, every world's is the same, and a save reloaded mid-wait shows
 * the same date it showed before.
 */
export function nextClassTick(school: ServiceSchool, tick: Tick): Tick {
  const cadence = Math.max(1, school.classCadenceMonths)
  const since = tick % cadence
  return (since === 0 ? tick : tick + (cadence - since)) as Tick
}

/** Seats already taken in a school's next class. */
function seatsTaken(world: World, schoolId: string, classTick: Tick): number {
  let taken = 0
  for (const record of world.service.values()) {
    if (record.schoolId === schoolId && record.schoolStartsAtTick === classTick) taken++
  }
  return taken
}

/**
 * The school houses, filtered to THIS BRANCH and answered with the class
 * schedule: what it costs in months, when the next class starts, and whether
 * there is a seat in it.
 *
 * Branch-incompatible schools are still returned with their reason, because
 * the UI hides them rather than the engine pretending they do not exist —
 * an engine that silently drops content is an engine you cannot debug.
 */
/**
 * Whether a record clears a rank gate written on the ENLISTED ladder.
 *
 * `minRank` on a school or a special unit is an index into the enlisted
 * ranks — "opens at SPC". An officer's rank is an index into a DIFFERENT,
 * six-rung ladder, so comparing the two numbers compares nothing: a second
 * lieutenant sat at index 0 and was refused every course that opened at
 * index 1, while a captain cleared a sergeant's gate by coincidence of
 * arithmetic. (Owner, playing an officer: "cant attend schools".)
 *
 * A commissioned member is above every enlisted gate these courses set, so
 * they clear it. What still stops them is everything that is actually about
 * them — the branch, the trade, the badge they already hold, the evaluation
 * and the seats.
 */
/**
 * THE PAY GRADE THIS PERSON HOLDS, read off the ladder they are actually on.
 *
 * OWNER, PLAYING: "majors should not be getting kicked out if they are past
 * 12 years in service... I just got kicked out after 16 years of an amazing
 * career because I was a major."
 *
 * He was thrown out by the CAREER CORPORAL RULE. `grades` is the enlisted
 * table, and it was being indexed with an OFFICER's rank index: a major sits
 * at officer index 3, and enlisted index 3 is E-4. So the twelve-year wall
 * (ADR-0032) looked at a major with sixteen years, saw a specialist who had
 * never made sergeant, and separated him — exactly the outcome that rule
 * exists to produce, applied to exactly the wrong person.
 *
 * High-year tenure read the same wrong number, so a major with six years in
 * grade was up-or-out too. Both are ENLISTED rules; neither has any business
 * touching a commissioned career, and the guard for that is below.
 *
 * Every grade read now goes through here.
 */
function gradeOf(
  world: World,
  record: { readonly branch: string; readonly rank: number; readonly commissioned?: boolean },
  fallback = 1,
): number {
  const spec = branchSpecFor(world, record.branch)
  const table = record.commissioned === true ? (spec.officerGrades ?? spec.grades) : spec.grades
  return table[record.rank] ?? fallback
}

export function meetsRankGate(
  record: { readonly rank: number; readonly commissioned?: boolean },
  minRank: number,
): boolean {
  if (record.commissioned === true) return true
  return record.rank >= minRank
}

export function schoolOptionsFor(world: World, personId: EntityId): readonly SchoolOption[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return []
  const specialty = specialtyFor(world, record.specialtyId)
  const badges = badgesOf(world, personId)
  return world.spec.schools.map((school) => {
    const classTick = nextClassTick(school, world.tick)
    const seatsLeft = Math.max(0, school.seatsPerClass - seatsTaken(world, school.id, classTick))

    let reason = ''
    // THE FLAG COMES FIRST, because it is the answer to every course at
    // once and the player deserves the real reason rather than the next
    // one down the list.
    const flag = flagStatus(world, personId, world.tick)
    const failed = (record.schoolAttempts ?? []).filter(
      (a) => a.schoolId === school.id && a.outcome === 'failed',
    ).length
    // STRUCTURAL FIRST, SITUATIONAL SECOND — and the order is load-bearing.
    //
    // The tab hides a course by matching the words "does not send people
    // here", which is how a soldier avoids reading a catalogue of other
    // services' schools. Putting the flag check above the branch check
    // meant a FLAGGED soldier never got those words: his reason was
    // "Ineligible — flagged", the filter stopped matching, and every
    // course in the game appeared on his screen (owner, playing: "you
    // should only see schools that you are eligible for"). The wash-out cap
    // had the same shape.
    //
    // Branch and trade are facts about who you are; a flag and a spent
    // attempt are facts about where you are today. The permanent ones
    // decide whether the course is on your list at all.
    const commissioned = record.commissioned === true
    const wrongLadder =
      (school.track === 'enlisted' && commissioned) ||
      (school.track === 'officer' && !commissioned)
    if (school.branches.length > 0 && !school.branches.includes(specialty.branch)) {
      reason = `${branchName(world, specialty.branch)} does not send people here.`
    } else if (school.specialtyIds.length > 0 && !school.specialtyIds.includes(record.specialtyId)) {
      reason = 'Not this trade.'
    } else if (wrongLadder) {
      reason =
        school.track === 'enlisted'
          ? 'Enlisted professional education. Officers do not attend.'
          : 'An officer course.'
    } else if (flag.flagged) {
      reason = flag.words
    } else if (failed >= school.maxAttempts) {
      // THE UNIT WILL NOT FUND A THIRD SEAT. A wash-out is a setback, not a
      // wall — but the seats are finite, and this is where that stops being
      // free (M-SCHOOL §5).
      reason = `Washed out ${String(failed)} time${failed === 1 ? '' : 's'}. The unit will not fund another seat.`
    } else if (badges.includes(school.badge)) {
      reason = 'Already earned.'
    } else if (!meetsRankGate(record, school.minRank)) {
      // M-ENLIST §5. THE LADDER THEY ARE ON, not the enlisted one. A
      // lieutenant was being told a course "opens at SGT", which is a rank
      // he will never hold and a sentence that means nothing to him.
      reason = `Opens at ${rankTitle(world, record.branch, school.minRank, record.commissioned === true)}.`
    } else if (record.performance < school.minPerformance) {
      reason = 'The work is not there yet.'
    } else if (record.schoolId !== null) {
      reason = 'You are already down for a course.'
    } else if (seatsLeft === 0) {
      reason = 'The next class is full.'
    }

    // A dot read, not a number. "Difficulty 420" means nothing to anybody;
    // four dots out of five reads at a glance, which is what the owner's
    // mockup asks for.
    const dots = (value: number): number => Math.max(1, Math.min(5, Math.ceil(value / 200)))
    const attempts = record.schoolAttempts ?? []
    const failedHere = attempts.filter((a) => a.schoolId === school.id && a.outcome === 'failed').length
    const requirements: { met: boolean; words: string }[] = []
    if (school.minRank > 0) {
      requirements.push({
        met: meetsRankGate(record, school.minRank),
        words: `${rankTitle(world, record.branch, school.minRank, record.commissioned === true)} or above`,
      })
    }
    requirements.push({
      met: record.performance >= school.minPerformance,
      words: 'Standing meets the bar',
    })
    if (school.minFitness !== undefined) {
      requirements.push({
        met: record.fitnessScore >= school.minFitness,
        words: 'Fitness standard for day zero',
      })
    }
    if (school.minAptitude !== undefined) {
      requirements.push({
        met: (record.aptitude ?? 0) >= school.minAptitude,
        words: 'Aptitude score',
      })
    }
    if (school.minTimeInServiceMonths !== undefined) {
      requirements.push({
        met: world.tick - record.enlistedAtTick >= school.minTimeInServiceMonths,
        words: `${String(Math.round(school.minTimeInServiceMonths / 12))} years in service`,
      })
    }
    for (const prereq of school.prereqBadges ?? []) {
      requirements.push({ met: badges.includes(prereq), words: `${prereq} badge held` })
    }
    requirements.push({ met: !flag.flagged, words: 'Not flagged' })

    return {
      onYourList:
        (school.branches.length === 0 || school.branches.includes(specialty.branch)) &&
        (school.specialtyIds.length === 0 || school.specialtyIds.includes(record.specialtyId)) &&
        !wrongLadder,
      category: school.category,
      difficultyDots: dots(school.difficulty),
      scarcityDots: dots(school.seatScarcity),
      gatesGrade: school.gatesGrade ?? null,
      requirements,
      attempts: {
        failed: failedHere,
        graduated: badges.includes(school.badge),
        injured: attempts.filter((a) => a.schoolId === school.id && a.outcome === 'injured').length,
        left: Math.max(0, school.maxAttempts - failedHere),
      },
      id: school.id,
      title: school.title,
      badge: school.badge,
      open: reason === '',
      reason,
      courseMonths: school.courseMonths,
      nextClassTick: classTick,
      monthsUntilClass: classTick - world.tick,
      seatsLeft,
    }
  })
}

/** The special units, with the selection door open or the stated bar. */
export function unitOptionsFor(
  world: World,
  personId: EntityId,
): readonly { id: string; name: string; tier: number; open: boolean; reason: string }[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return []
  const specialty = specialtyFor(world, record.specialtyId)
  const badges = badgesOf(world, personId)
  return world.spec.units.map((unit) => {
    let reason = ''
    const drops = eventsFor(world, personId).filter(
      (e) => e.type === 'dropped-selection' && e.detail === unit.id,
    ).length
    if (record.unitId === unit.id) {
      reason = 'Already wearing the tab.'
    } else if (!unit.branches.includes(specialty.branch)) {
      reason = `${branchName(world, specialty.branch)} does not feed this unit.`
    } else if (unit.feederUnitId !== null && record.unitId !== unit.feederUnitId) {
      reason = `Selection draws from ${unitFor(world, unit.feederUnitId)?.name ?? 'the feeder unit'}.`
    } else if (!meetsRankGate(record, unit.minRank)) {
      reason = `Looks at ${rankTitle(world, record.branch, unit.minRank, record.commissioned === true)} and above.`
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

/**
 * Up-or-out, as the serving member can see it — months in grade, the months
 * they get, and whether the clock is close enough to matter.
 *
 * OWNER (playing): "I literally just got kicked out the army... I didn't
 * even get the choice." The rule itself is right — a service really does
 * stop offering terms to somebody it has not promoted — but it was arriving
 * as a surprise, and a surprise is what makes a correct rule feel arbitrary.
 * A real orderly room tells you where you stand long before the date.
 *
 * Null for anyone the rule cannot reach: made the grade, discharged, or on
 * a ladder with no such thing.
 */
export function upOrOutStandingFor(
  world: World,
  personId: EntityId,
): { readonly monthsInGrade: number; readonly monthsAllowed: number; readonly warning: boolean } | null {
  const record = activeRecord(world, personId)
  if (!record) return null
  // HIGH-YEAR TENURE IS AN ENLISTED RULE. An officer's career is bounded by
  // selection boards and statute, not by time in grade at the bottom of a
  // ladder he is not on.
  if (record.commissioned === true) return null
  const grade = gradeOf(world, record, 9)
  if (grade >= HYT_BELOW_GRADE) return null
  const monthsAllowed = highYearTenureMonthsFor(record)
  const monthsInGrade = world.tick - record.rankSinceTick
  return {
    monthsInGrade,
    monthsAllowed,
    // A year out is enough time to put in for a board or take a school —
    // which is the whole point of saying it.
    warning: monthsAllowed - monthsInGrade <= 12,
  }
}

/**
 * What a file of non-selections adds to the board's cutoff.
 *
 * CAPPED, at four boards' worth. A record of being passed over genuinely
 * makes the next board harder — that is why 'let it go by' is a real
 * choice — but an unbounded penalty is not a harder board, it is a closed
 * door wearing a board's clothes. Past the cap the file has said what it
 * has to say, and the only thing that moves is the points the member earns.
 */
const FILE_PENALTY_PER_PASS = 15
const FILE_PENALTY_CAP = FILE_PENALTY_PER_PASS * 4

export function filePenaltyFor(priorPassOvers: number): number {
  return Math.min(FILE_PENALTY_CAP, priorPassOvers * FILE_PENALTY_PER_PASS)
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
  /** What those non-selections actually add to the cutoff, capped. */
  readonly filePenalty: number
  /**
   * M-PROMO. The course still owed for the next grade, or null when the
   * way is clear. The Service tab reads this to say "requires the Advanced
   * Leader Course" instead of leaving somebody at the cutoff wondering why
   * nothing happens — the bar pattern, one function feeding both the screen
   * and the decision.
   */
  readonly schoolOwed: { readonly id: string; readonly title: string } | null
} | null {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return null
  const specialty = specialtyFor(world, record.specialtyId)
  const commissioned = record.commissioned === true
  const gates = competitiveGates(world, specialty, record.rank, commissioned)
  if (!gates) return null
  const targetTitle = rankTitle(world, record.branch, gates.targetRank, commissioned)
  const owed = schoolOwedFor(world, personId, record.branch, gates.targetRank, commissioned)
  return {
    targetTitle,
    schoolOwed: owed === undefined ? null : { id: owed.id, title: owed.title },
    targetRank: gates.targetRank,
    timeInGrade: world.tick - record.rankSinceTick,
    tigNeeded: gates.tigNeeded,
    cutoff: gates.cutoff,
    points: promotionPointsFor(world, personId),
    filePenalty: filePenaltyFor(
      world.events.filter(
        (e) => e.type === 'passed-over' && e.subjectId === personId && e.detail === String(gates.targetRank),
      ).length,
    ),
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
  //
  // The RATE is base-year content, like a grade's pay; the price level is
  // applied at the end. A pension that never rose would be the same bug
  // service pay had — a veteran drawing 1970 money in 2070.
  const serviceDisability = world.health.get(personId)?.serviceDisability ?? 0
  if (serviceDisability >= PENSION_THRESHOLD) {
    monthly += serviceDisability * PENSION_CENTS_PER_POINT
  }
  // What the service owes: the years themselves. Both can be true at once
  // — a wounded lifer is owed for the wound AND for the career.
  monthly += retirementPayOf(record)
  return atTodaysPrices(world, monthly as Money)
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
    for (const occupation of specialtyFor(world, specialtyId).civilianUnlocks) {
      if (!unlocks.includes(occupation)) unlocks.push(occupation)
    }
  }
  return unlocks
}

function eligibleSpecialties(world: World, person: Person): ServiceSpecialty[] {
  const education = world.education.get(person.id)
  const level = education?.level ?? 'none'
  return world.spec.specialties.filter((sp) => meetsRequirement(level, sp.requires))
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
    // C3 §2. NOT WHILE SUPERVISED. Probation restricts movement and the
    // army is movement — you cannot report to a posting in another country
    // while a court expects to see you monthly.
    const probationUntil = criminal.probationUntilTick ?? null
    if (probationUntil !== null && tick < probationUntil) {
      return 'The court expects to see you monthly; the recruiter will wait.'
    }
    // C3 §5. THE GRADED GATE, read inline for the same reason the comment
    // above gives: a hard gate refuses, a soft one does not — an old
    // misdemeanor should not still be closing this door, and a violent
    // felony always will.
    const gated = criminal.convictions.some((c) => {
      if (c.sealed === true) return false
      const offence = offenceById(c.kind)
      const years = Math.floor((tick - c.tick) / 12)
      if (offence !== undefined && (offence.grade === 'capital' || (offence.violent === true && isFelony(offence.grade)))) {
        return true
      }
      const felony = offence !== undefined && isFelony(offence.grade)
      return years < (felony ? 10 : 3)
    })
    if (gated) {
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

/**
 * The installations a branch actually posts people to (W2 review must-fix).
 *
 * A base entry with no branches is joint-use and open to everyone, which is
 * what Classic's two stations have always been — so Classic's postings do
 * not move. A preset that names REAL installations tags each one, because
 * posting a sailor to an army post is a false claim about a real place
 * written into a record that is never rewritten.
 *
 * Falls back to every base rather than none: a branch with no installation
 * of its own still has to put its people somewhere, and a soldier with no
 * posting is a worse answer than a joint one.
 */
function basesFor(world: World, branchId: string): Place[] {
  const all = placesOfKind(world, 'base')
  const tagged = new Map(world.spec.gazetteer.bases.map((b) => [b.name, b.branches]))
  const mine = all.filter((place) => {
    const branches = tagged.get(place.name)
    return branches === undefined || branches.length === 0 || branches.includes(branchId)
  })
  return mine.length > 0 ? mine : all
}

/** Shared by the player path and the NPC path: one door, one ledger entry. */
export function enlistPerson(
  world: World,
  tick: Tick,
  person: Person,
  specialty: ServiceSpecialty,
  extraInputs: readonly CausalFactor[],
  commissionElected?: boolean,
  /** M-ENLIST §5c. The officer job the branch assigned, where there is one. */
  officerRoleId?: string,
): void {
  const bases = basesFor(world, specialty.branch)
  const base = bases[Math.abs(person.id) % Math.max(1, bases.length)]
  if (!base) return

  // Enlisting ends a civilian job; the uniform is not a side line.
  if (world.employment.has(person.id)) {
    world.employment.delete(person.id)
    recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'enlisted' })
  }

  // A DEGREE IS A COMMISSION (owner: the college pipeline had nowhere to
  // go). Not a bonus — the officer starts at the bottom of a different
  // ladder with a different job, and a sergeant with fifteen years still
  // out-earns a new lieutenant.
  //
  // AND IT IS A CHOICE, NOT A CONSEQUENCE (owner: there was no option to
  // commission). A graduate can sign either way and real ones do — the
  // player is asked, and the answer arrives here. NPCs have no one to ask,
  // so the degree still speaks for them.
  //
  // AND ONLY WHERE THERE IS A LADDER TO COMMISSION ONTO. A preset may ship a
  // service with no officer corps at all (w1's Ranger Corps does), and
  // commissioning somebody into an empty ladder produced a record whose rank
  // rendered as "#1" — a person with no rank at all.
  const commissioned =
    (commissionElected ?? commissionsOnEntry(world, person.id)) &&
    (branchSpecFor(world, specialty.branch).officerRanks?.length ?? 0) > 0

  world.service.set(person.id, {
    personId: person.id,
    branch: specialty.branch,
    specialtyId: specialty.id,
    unitSinceTick: null,
    commissioned,
    rank: 0,
    rankSinceTick: tick,
    qualifications: [],
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
    enlistedAtTick: tick,
    baseId: base.id,
    monthlyPay: commissioned
      ? officerPayOn(branchSpecFor(world, specialty.branch), 0)
      : servicePayOn(branchSpecFor(world, specialty.branch), 0),
    performance: Math.floor((person.traits.diligence + 500) / 2),
    termMonthsLeft: commissioned ? OFFICER_TERM_MONTHS : SERVICE_TERM_MONTHS,
    termMonths: commissioned ? OFFICER_TERM_MONTHS : SERVICE_TERM_MONTHS,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 0,
    unitId: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 0,
    fitnessTestedAtTick: null,
    // M-ENLIST §4. The score they sat for, kept for ever. Written once,
    // here, and never recomputed — see the field's own note.
    aptitude: entryTestScore(world, person.id),
    track: commissioned ? 'officer' : 'enlisted',
    ...(officerRoleId !== undefined ? { officerRoleId } : {}),
  })

  recordEvent(world, tick, {
    type: 'enlisted',
    subjectId: person.id,
    placeId: base.id,
    detail: specialtyTitleFor(specialty, commissioned),
  })
  // The first thing service is, is training: ten weeks of basic before the
  // trade. Part of the record from day one — a term is a lived four years.
  recordEvent(world, tick, {
    type: 'began-training',
    subjectId: person.id,
    detail: commissioned ? 'the commissioning course' : 'basic training',
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'enlistment',
    significance: 'defining',
    inputs: [
      ...extraInputs,
      factor('steady-pay', Math.floor(servicePayOn(branchSpecFor(world, specialty.branch), 0) / 1000)),
    ],
    chosen: commissioned
      ? `commissioned into ${branchName(world, specialty.branch)} as ${
          'aeiou'.includes(specialtyTitleFor(specialty, true).charAt(0)) ? 'an' : 'a'
        } ${specialtyTitleFor(specialty, true)}`
      : `enlisted in ${branchName(world, specialty.branch)} as ${withArticle(specialty.title)}`,
    rejected: commissioned ? ['civilian life', 'signing as enlisted'] : ['civilian life'],
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
  // BAND 3 CONVENES BEFORE THE MONTH IS SERVED. The annual boards are a
  // cross-person comparison — a fixed number of seats competed for — so
  // they cannot live inside the per-person pass the way the points path
  // does. Once a year, and a no-op every other month.
  runSelectionBoards(world, tick)
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
      // A GRADUATE HEARS FROM THE OFFICE EVEN IN A GOOD JOB. The old gate
      // was joblessness alone, which quietly closed the officer path: the
      // people a recruiter calls hardest about a commission are exactly the
      // ones who walked out of college into work. Softer, because it is a
      // harder call to take — but it comes.
      const employed = world.employment.has(person.id)
      const reachable = !employed || commissionsOnEntry(world, person.id)
      if (reachable && rng.chance(employed ? Math.floor(knock / 3) : knock, 1_000)) {
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
/**
 * A recruiting season is news TO SOMEBODY IT COULD BE ABOUT.
 *
 * OWNER, reading a life back: the drive turned up on a three-year-old's
 * timeline, and again at eight, eleven and twelve. The town-wide feed is
 * merged into every personal story, so a notice aimed at people old enough
 * to sign was being filed as an event in a child's life. It is not — for
 * them it is a thing that happened to the square.
 *
 * From a couple of years out, and until the office stops taking volunteers.
 * Not for anyone already in uniform or already out of it: the recruiters
 * are not there for them either.
 */
function driveConcernsPerson(world: World, person: Person, tick: Tick): boolean {
  const age = ageAt(person.birthTick, tick)
  if (age < ENLIST_MIN_AGE - 2 || age > ENLIST_MAX_AGE) return false
  return !world.service.has(person.id)
}

export function serviceNewsSince(
  world: World,
  since: Tick,
  /** Whose story this feed is for. Omitted is the town's own paper, which
   *  carries the notice whoever is reading it. */
  forPersonId?: EntityId,
): NewsItem[] {
  const reader = forPersonId === undefined ? undefined : world.people.get(forPersonId)
  const items: NewsItem[] = []
  for (const event of world.events) {
    if (event.tick < since) continue
    if (event.type === 'recruiting-drive') {
      if (reader !== undefined && !driveConcernsPerson(world, reader, event.tick)) continue
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
    // OWNER DIRECTION, 2026-08-02: a homecoming is NOT news. The paper
    // reports the ones who did not come back, and nothing else about an
    // individual's service.
    //
    // The homecoming card was added deliberately, against exactly this —
    // review S6 warned that recruiting notices and funerals with nothing
    // between them tilts the feed in both directions at once. The owner has
    // read that and wants the paper narrower anyway, which is his call: a
    // small-town paper runs the death and not the return, and a soldier's
    // own homecoming still sits on their own timeline where it belongs.
    // The recruiting-drive notice above still carries the other end.
    if (event.type === 'died') {
      const record = world.service.get(event.subjectId)
      if (!record || record.dischargedAtTick !== event.tick) continue
      if (record.dischargeReason !== 'died in service') continue
      const person = world.people.get(event.subjectId)
      if (!person) continue
      // The event's own detail says what killed them. 'wounds taken in
      // action' is the enemy; an accident on deployment is not, and neither
      // is an illness in a theatre — the paper should not call any of those
      // the same thing.
      const cause = event.detail ?? ''
      const killedInAction = cause.includes('wounds taken in action')
      // AN ACCIDENT AND AN ILLNESS ARE THE TWO THIS HAS TO SAY OUT LOUD.
      // The first pass matched only 'accident on deployment', so a training
      // death on a peacetime rotation read as "died in service" while the
      // identical accident in a theatre was named — and a prisoner who died
      // of illness rather than hardship was anonymised the same way. Both
      // are the point: a soldier is not only killed by an enemy.
      const heldWhenTheyDied = world.events.some(
        (e) => e.type === 'was-captured' && e.subjectId === event.subjectId && e.tick <= event.tick,
      ) && !world.events.some(
        (e) => e.type === 'repatriated' && e.subjectId === event.subjectId && e.tick <= event.tick,
      )
      // ONLY THE DEATHS THE UNIFORM CAUSED (owner, reading the paper: a
      // soldier who died of an illness was given a combat headline —
      // "killed in service", "was hit and did not make it off the road" —
      // over a body that said sudden illness).
      //
      // A person in uniform can die of anything anybody else dies of, and
      // when they do it is not a service story: it belongs on their own
      // page and their family's, not on the front of the paper under the
      // war. What the station reports is the enemy, the accident, and the
      // cell — the three the service itself is answerable for.
      const howTheyDied = killedInAction
        ? 'was killed in action'
        : cause.includes('accident')
          ? 'was killed in an accident in uniform'
          : cause.includes('captivity') || heldWhenTheyDied
            ? 'died a prisoner'
            : null
      if (howTheyDied === null) continue
      items.push({
        tick: event.tick,
        text: `${person.givenName} ${person.familyName} ${howTheyDied}`,
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
/**
 * Months in grade before an officer's next step, by current rank.
 *
 * Long, because a commission is a long road: roughly two years to first
 * lieutenant, another two to captain, and everything above that is a board
 * with real time behind it. The enlisted table is six-month steps, which is
 * how a twenty-eight-year-old ended up a lieutenant colonel.
 */
const OFFICER_TIG_MONTHS: readonly number[] = [24, 24, 48, 60, 72, 84]

/**
 * The officer ladder's first BOARD step. Below it, promotion is time in
 * grade; at and above it, a board sits. Second lieutenant to first is
 * near-automatic for anyone who is not failing; captain is earned.
 */
const OFFICER_COMPETITIVE_FROM = 2

/**
 * A commission's initial obligation.
 *
 * SIX YEARS, not four (military review, should-fix 6). The comments claimed
 * a longer obligation and the code wrote the enlisted term, which made the
 * commission +55% pay for the same commitment — and once the ladder above
 * O-2 works, that is a straight upgrade. The extra two years are what the
 * commissioning course costs, and they are the reason to think about it.
 */
const OFFICER_TERM_MONTHS = 72

function serveMonth(world: World, tick: Tick, person: Person, record: NonNullable<ReturnType<World['service']['get']>>): void {
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 4444)

  // Medical discharge: the body rules service in a way it does not rule a desk.
  const disability = world.health.get(person.id)?.disability ?? 0
  // NOT WHILE HELD. A board cannot separate a man it cannot examine, and
  // without this a prisoner carrying an old wound left the army in enemy
  // hands and was repatriated into a record saying he had been a civilian
  // for a year. The same reasoning the career discharges below already use
  // for a theatre: the boat home first.
  if (disability >= MEDICAL_LIMIT && !isCaptive(world, person.id)) {
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
      gradeOf(world, record, 9),
      record.indefinite === true,
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

  // HELD. Nothing about a month in a cell is a month of service: no course
  // finishes, no training completes, no evaluation moves, and the term's
  // own clock does not run.
  const held = isCaptive(world, person.id)

  // Performance drifts toward what diligence can deliver, as at any work —
  // EXCEPT IN A CELL. Nobody is evaluating a prisoner, and letting the value
  // drift meant a long captivity quietly improved the number the promotion
  // boards read and the next term's Good Conduct is judged on. Freezing the
  // running sum and not the value it comes from only fixed half of it.
  const pull = person.traits.diligence - record.performance
  let performance = held
    ? record.performance
    : Math.max(0, Math.min(1000, record.performance + Math.floor(pull / 40) + rng.nextInt(-8, 9)))

  const specialty = specialtyFor(world, record.specialtyId)
  // The branch is the RECORD's, never re-derived from the trade. They are
  // written together at enlistment and can only disagree when the trade
  // does not resolve — and then re-deriving it costs the soldier their pay:
  // a blank branch has no grades, servicePayOn falls to E-1, and the ledger
  // is rewritten every month at any rank (second W1 review, must-fix).
  const branch = record.branch
  // THE LADDER THIS PERSON IS ON. Promotion was bounded by the enlisted
  // ladder's length for everybody, so a commissioned officer walked the
  // officer ladder at a private's pace and the paper printed a
  // twenty-eight-year-old lieutenant colonel (owner, reading it).
  const commissioned = record.commissioned === true
  const branchSpec = branchSpecFor(world, branch)
  const ladder = commissioned ? (branchSpec.officerRanks ?? branchSpec.ranks) : branchSpec.ranks
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
  // Carried, not written: see the bust below.
  let indefinite = record.indefinite
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

  // Carried to the single write at the end of the month, for the same
  // reason `indefinite` is (ADR-0039).
  let seat: { readonly schoolId: string; readonly startsAtTick: Tick } | null = null
  let promotedThisMonth = false
  if (rank < ladder.length - 1) {
    // AN OFFICER'S FIRST STEPS ARE SLOW AND THE REST ARE A BOARD. Two
    // years to first lieutenant and four to captain is the real shape, and
    // it is why the enlisted table could not be reused: those are six
    // months apart.
    const competitiveFrom = commissioned ? OFFICER_COMPETITIVE_FROM : branchSpec.competitiveFrom
    let promote = false
    if (rank + 1 < competitiveFrom) {
      const due = commissioned ? OFFICER_TIG_MONTHS[rank] ?? 24 : branchSpec.juniorTigMonths[rank] ?? 6
      promote = timeInGrade >= due && performance >= 300
      // A SAME-GRADE LATERAL IS NOT AUTOMATIC (owner's
      // `army_promotions_fix.md`: "Corporal — lateral appointment, the NCO
      // version of SPC; commander names you"). SPC and CPL are both E-4;
      // the corporal is the one handed an NCO's job, and most specialists
      // never are.
      //
      // MEASURED, AND THIS IS WHY IT MATTERS BEYOND FLAVOUR: making it
      // automatic on time marched every specialist to corporal at twelve
      // months, which RESET the time-in-grade clock — so high-year tenure,
      // which is the up-or-out rule for everybody below sergeant, could
      // never fire again. Soldiers who should have been let go at six
      // years in grade sailed on to the twelve-year wall instead, and two
      // tests that had been guarding that rule went red.
      if (promote && (branchSpec.grades[rank + 1] ?? 0) === (branchSpec.grades[rank] ?? 0)) {
        promote = performance >= 520 && rng.chance(1, 30)
      }
    } else if (isSeniorBand(branchSpec.grades[rank + 1] ?? 0) && !commissioned) {
      // BAND 3 IS THE BOARD'S, NOT THIS MONTH'S. A senior grade is a fixed
      // number of seats competed for once a year (runSelectionBoards); if
      // the monthly points path also filled them, the seats would mean
      // nothing and the pyramid would flatten again.
      promote = false
    } else if (!isPlayer) {
      // The board ranks, NPC path: PROMOTION POINTS against the trade's
      // cutoff — evaluation, fitness, badges, decorations, seniority. The
      // draw stands in for slot timing, not for merit. THE PLAYER never
      // promotes through this branch: their stripes come only through the
      // board question (M-SERVICE-PLAY) — put in for, not received.
      const gates = competitiveGates(world, specialty, rank, commissioned)
      if (gates && timeInGrade >= gates.tigNeeded) {
        // Clearly over the cutoff = promoted; the draw lives only near the
        // line (the same rule the player's board follows).
        const points = promotionPointsFor(world, person.id).total
        const margin = points - gates.cutoff
        promote = margin >= 0 && (margin >= 150 || rng.chance(6 + Math.floor(margin / 15), 24))
      }
    }
    // THE UNIT SPENDS A SEAT. Not on the player — theirs is a choice they
    // make from the schoolhouse — but on everybody else, or the gate below
    // would empty every NCO rank in the world.
    if (!isPlayer && seat === null) seat = seatDueFor(world, tick, person.id, rng)

    // AND A FLAGGED SOLDIER IS NOT PROMOTED (M-SCHOOL §3). Same rule for
    // the town as for the player: a suspension of favourable actions
    // suspends the favourable action.
    if (promote && flagStatus(world, person.id, tick).flagged) promote = false

    // M-PROMO. THE SCHOOL IS A HARD GATE, and it sits on top of whatever
    // the branch's own engine decided. A soldier who has cleared the cutoff
    // but never been to the course does not pin the grade on — he waits for
    // a seat, which is exactly the pressure the spec wants PME to create.
    // Applies to player and NPC alike (Law 1).
    if (promote && schoolOwedFor(world, person.id, branch, rank + 1, commissioned) !== undefined) {
      promote = false
    }
    if (promote) {
      promotedThisMonth = true
      rank += 1
      rankSinceTick = tick
      recordEvent(world, tick, {
        type: 'promoted',
        subjectId: person.id,
        detail: rankTitle(world, branch, rank, commissioned),
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
        chosen: `made ${rankTitle(world, branch, rank, commissioned)}`,
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
  let joinedUnitThisMonth = false
  const qualifications = [...record.qualifications]
  // P2: a retrain's school completes on its own clock — without this the
  // feed said "reported to school" forever (military review S2).
  if (
    record.specialtyChangedAtTick !== null &&
    tick - record.specialtyChangedAtTick === specialty.schoolMonths
  ) {
    recordEvent(world, tick, { type: 'completed-training', subjectId: person.id, detail: `${specialty.title} school` })
  }
  if (monthsIn === 2 && !held) {
    const basicDone = recordEvent(world, tick, {
      type: 'completed-training',
      subjectId: person.id,
      detail: 'basic training',
    })
    // The first ribbon anybody gets, off the event that earns it.
    grantServiceRibbon(world, tick, person.id, basicDone)
    recordEvent(world, tick, { type: 'began-training', subjectId: person.id, detail: `${specialty.title} school` })
  } else if (monthsIn === schoolDone && !held) {
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
      // A transfer stays inside the service: the same rule as the first
      // posting, for the same reason.
      const bases = basesFor(world, record.branch)
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
      const school = world.spec.schools.find(
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
      // Per-person, not per-ledger: this ran for every serving soldier every
      // month and walked all 34,000 events to count two.
      const own = eventsFor(world, person.id)
      const dropsFor = (unitId: string): number =>
        own.filter((e) => e.type === 'dropped-selection' && e.detail === unitId).length
      const unit = world.spec.units.find(
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
          // A NEW UNIT IS A NEW CLOCK. Without this a Pathfinder who made
          // the Vanguard Group carried the Pathfinders' join date into it,
          // and was the old hand of a team he joined this month.
          joinedUnitThisMonth = true
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
  // ADR-0037. THE BRIDGE: a civilian conviction is a military matter.
  //
  // The services punish members for civilian offences under the UCMJ, and
  // this world had the two systems standing side by side saying nothing to
  // each other. A conviction that ends in a fine or probation produces an
  // Article 15; one that ends in confinement does NOT, because confinement
  // already removes the soldier from duty and that path belongs to
  // discharge.
  //
  // SINGLE WRITER PRESERVED (DOMAIN_MAP §2): crime.ts owns `world.criminal`
  // and never touches rank; this reads it and writes the service record,
  // which is service.ts's own.
  // Not `!deployed && ...`: that yields `false` rather than null on a
  // deployed member, and `false !== null` would fire the whole block.
  const convictedThisMonth = deployed ? null : convictionToAnswerFor(world, person.id, tick)
  if (convictedThisMonth !== null || (!deployed && monthsIn > 2 && rng.chance(misconductChance(person, performance), 1_000))) {
    const priorStrikes = eventsFor(world, person.id).filter(
      (e) => e.type === 'disciplined' && tick - e.tick < MISCONDUCT_WINDOW_MONTHS,
    ).length
    // A conviction the court took seriously enough to convict on is severe
    // by definition; a careless month rolls for it.
    const severe = convictedThisMonth !== null || rng.chance(1, 6)
    const willBust = severe && rank > 0 && priorStrikes + 1 < MISCONDUCT_STRIKES
    const infraction =
      convictedThisMonth !== null
        ? `civilian conviction — ${convictedThisMonth}`
        : severe
          ? rng.pick(SEVERE_INFRACTIONS)
          : rng.pick(MINOR_INFRACTIONS)
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
      // AND LOSING THE STRIPES LOSES INDEFINITE STATUS (ADR-0032).
      //
      // THE CAREER CORPORAL CAME BACK THROUGH THE ORDERLY ROOM. The wall
      // stops a corporal signing on past twelve years, but nothing stopped
      // an indefinite SERGEANT being busted down to corporal and keeping
      // the flag: the term-end handler returns early for anybody
      // indefinite, so he was never asked the wall's question again and
      // `careerCeilingMonths` carried him to thirty years as a career
      // corporal — the exact thing the owner's rule exists to prevent,
      // reached by the one door that was not checked.
      //
      // He goes back on contracts. The next term's end asks the wall, and
      // at twelve years and grade four the wall has one answer.
      //
      // AND IT IS CARRIED IN A LOCAL, NOT WRITTEN HERE. The first version of
      // this fix wrote `indefinite: false` straight to the record and it was
      // silently reverted: the single write at the end of this month spreads
      // `...record`, the snapshot taken before any of this ran, so every
      // field NOT in its explicit list goes back to what it was. Measured
      // with the mid-tick write in place — two below-line indefinite records
      // still standing across five seeds and forty years, which is what sent
      // me looking. Anything this month decides must travel in a local.
      const bustedGrade = gradeOf(world, { ...record, rank }, 1)
      if (indefinite === true && bustedGrade < INDEFINITE_MIN_GRADE) indefinite = false
      world.service.set(person.id, { ...world.service.get(person.id)!, rank, rankSinceTick })
    }
    // ADR-0037 §3. THE PAPER, and only for the ones that cost something.
    // A stripe, or a conviction. Late off leave stays the quiet line it is.
    if (person.id === world.player.personId && (willBust || convictedThisMonth !== null)) {
      raisePending(world, {
        tick,
        kind: 'article15',
        personId: person.id,
        otherId: null,
        occupationId: String(tick),
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['acknowledge'],
      })
    }
  }

    // --- SENIOR PARACHUTIST (awards pack §7). -----------------------------
  // Not a course — a clock, and NOT the player's alone: NPCs walk the
  // same roads (charter §2), and a badge only the player can hold is a
  // board advantage nobody beside them can answer. Three years carrying a parachutist rating on
  // a jump status is what the badge recognises, so it is granted by the
  // monthly pass rather than by a schoolhouse. (Master Parachutist is the
  // Jumpmaster Course's badge and stays a school's to give.)
  if (unitId !== null && record.unitSinceTick !== null) {
    const unit = unitFor(world, unitId)
    const onJumpStatus =
      unit !== null &&
      unit !== undefined &&
      unit.requiredBadges.some((badge) => badge === 'parachutist' || badge === 'military freefall')
    const held = badgesOf(world, person.id)
    if (
      onJumpStatus &&
      held.includes('parachutist') &&
      !held.includes('senior parachutist') &&
      tick - record.unitSinceTick >= 36
    ) {
      const earned = recordEvent(world, tick, {
        type: 'earned-qualification',
        subjectId: person.id,
        detail: 'senior parachutist',
      })
      grantQualificationBadge(world, tick, person.id, earned, 'senior parachutist')
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
    // THE LADDER THEY ARE ON. Without this the player's board read the
    // ENLISTED gate for a commissioned member: a lieutenant asked whether
    // index 2 cleared an enlisted competitiveFrom of four, got null, and was
    // never offered a board at all (owner, playing an officer: "cant get
    // promoted"). The NPC path and the standings were already passing it;
    // this one site was missed, which is why officers promoted in the town
    // and never in the player's own career.
    const gates = promotedThisMonth
      ? null
      : competitiveGates(world, specialty, rank, commissioned)
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
      // AND THE SCHOOL IS OWED FIRST. Asking somebody to put in for a
      // grade they cannot pin on is a question with one real answer, and
      // the Service tab already states the reason (`schoolOwed` on the
      // board standing). The question waits for the seat.
      const owesSchool =
        schoolOwedFor(world, person.id, branch, gates.targetRank, commissioned) !== undefined
      // AND NOBODY PUTS IN FOR A CENTRALIZED BOARD. At the senior grades
      // the file competes whether its owner submits it or not — that is
      // what "centralized" means — so the question would be a button with
      // no alternative. The player is selected, or passed over, like
      // everybody else.
      const senior = !commissioned && isSeniorBand(branchSpec.grades[gates.targetRank] ?? 0)
      if (over >= 0 && over % 12 <= 2 && !askedRecently && !owesSchool && !senior) {
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
      // WHICH SCHOOL. The slot used to be anonymous — the prompt said "an
      // advanced school" and the record said "an advanced course" — while
      // the world has a list of named courses with their own badges and
      // gates. A DD-214 that lists "an advanced course" among real schools
      // reads like a placeholder, because it was one.
      const open = schoolOptionsFor(world, person.id).filter((option) => option.open)
      const offered = open[open.length - 1]
      if (offered !== undefined) {
        raisePending(world, {
          tick,
          kind: 'attend-school',
          personId: person.id,
          otherId: null,
          occupationId: offered.id,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: ['attend', 'pass'],
        })
      }
    }
    // --- UNIT MOMENTS (owner's combat plan §4a). ------------------------
    // Commitment and aftermath, not contact. Each plays ONCE, and the log
    // is what remembers: a cutscene the player has already been through is
    // not a cutscene the second time.
    if (world.player.pending === null) {
      // ONCE PER LIFE, NOT ONCE PER SAVE. The player log is never cleared on
      // succession — it is the deterministic replay record — so an unscoped
      // dedupe would let the first life in a save answer reporting-in and
      // silently deny every heir after them. Scoped to this enlistment, the
      // way every other log dedupe in this file is scoped to something.
      const played = (id: string): boolean =>
        world.player.log.some(
          (entry) =>
            entry.kind === 'unit-moment' &&
            entry.tick >= record.enlistedAtTick &&
            entry.choice.startsWith(`${id}:`),
        )
      // When selection said yes. The tryout is the player's own verb, so
      // the log knows the month without a new field on the service record.
      const joinedAt = world.player.log
        .filter((entry) => entry.kind === 'unit-tryout' && entry.tick >= record.enlistedAtTick)
        .reduce((latest, entry) => (entry.tick > latest ? entry.tick : latest), -1)
      const raiseMoment = (id: string, unitId: string | null): void => {
        raisePending(world, {
          tick,
          kind: 'unit-moment',
          personId: person.id,
          otherId: null,
          occupationId: unitId === null ? id : `${id}:${unitId}`,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: ['push', 'hold', 'cover'],
        })
      }

      if (unitId === null) {
        // The packet. Only offered when a door is actually open, so it is
        // never an invitation to something the file would refuse.
        const open = unitOptionsFor(world, person.id).find((option) => option.open)
        if (open !== undefined && !played('packet-drop') && rng.chance(1, 30)) {
          raiseMoment('packet-drop', open.id)
        }
      } else {
        // THE LOG WINS where it has an answer: it records the month the
        // player actually went to selection. The record's date is the
        // fallback, and on a migrated save it was only learned at load —
        // trusting it first told a ten-year Pathfinder it was his first day.
        const monthsInUnit =
          joinedAt >= 0
            ? tick - joinedAt
            : record.unitSinceTick === null
              ? -1
              : tick - record.unitSinceTick
        if (!played('reporting-in') && monthsInUnit >= 0 && monthsInUnit <= 3) {
          // First day in the team room — and it has to actually BE the first
          // day. Ungated, this told a six-year veteran (and every migrated
          // save) that nobody there was impressed yet, and wrote a fabricated
          // first day into the record to go with it.
          raiseMoment('reporting-in', unitId)
        } else if (!played('losing-one') && deadFromTheUnit(world, unitId, tick) !== null) {
          // SOMEBODY HAS TO HAVE DIED. The scene states a fact about the
          // world — a team member going home in an aircraft — and Law 1 does
          // not let the cutscene be the thing that makes it true. It waits
          // for a real death in the unit, or it never plays.
          raiseMoment('losing-one', unitId)
        } else if (!played('the-old-hand') && monthsInUnit >= 36 && rng.chance(1, 48)) {
          // Long enough IN THE UNIT to be one of the ones they watch. Time
          // enlisted is not the same thing: eight years in a line unit does
          // not make somebody the old hand of a team they joined last month.
          raiseMoment('the-old-hand', unitId)
        }
      }
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

  // A record migrated from before the field existed does not know when its
  // soldier joined the unit. It learns the date HERE, at the first month it
  // is seen — the clock starts where the knowledge starts, rather than at a
  // date nobody recorded.
  // WHEN THEY JOINED. A new unit stamps today; a record migrated from
  // before this field existed learns today as the first date anybody knows;
  // otherwise the date it already carries is the truth and stays.
  const unitSinceTick =
    unitId === null ? null : joinedUnitThisMonth ? tick : (record.unitSinceTick ?? tick)

  // MONTHS HELD DO NOT COUNT TOWARD THE TERM AVERAGE. They are not months
  // of service anybody can judge, and letting them in meant a captivity
  // quietly argued for the Good Conduct Medal at the end of it.


  // A CELL IS NOT A TERM OF SERVICE. Neither side of the average moves while
  // somebody is held: not the months, which the term counts, and not the
  // sum, which the Good Conduct and Meritorious Service medals are judged
  // on. Letting them move meant a captivity quietly argued for a decoration
  // for "a term of distinguished service, by the record" — and, because the
  // term kept counting down, could discharge a man in enemy hands.
  const termMonthsLeft = held ? record.termMonthsLeft : record.termMonthsLeft - 1

  world.service.set(person.id, {
    ...record,
    rank,
    rankSinceTick,
    unitSinceTick,
    qualifications,
    baseId,
    unitId,
    fitnessScore,
    fitnessTestedAtTick,
    performance,
    // An officer's pay comes off the officer table (owner's officer gap).
    monthlyPay: record.commissioned === true
      ? officerPayOn(branchSpecFor(world, branch), rank)
      : servicePayOn(branchSpecFor(world, branch), rank),
    termMonthsLeft,
    // The term's running ledger: good conduct is judged on the average of
    // every served month, not the last month's noise.
    termPerformanceSum: held ? record.termPerformanceSum : record.termPerformanceSum + performance,
    // Undefined on a record that never had it, and left that way — writing
    // `false` where there was nothing changes the saved shape for no gain.
    ...(indefinite === undefined ? {} : { indefinite }),
    ...(seat === null ? {} : { schoolId: seat.schoolId, schoolStartsAtTick: seat.startsAtTick }),
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
  // THE LADDER THIS PERSON IS ON. Reading the enlisted table with an
  // officer's rank index made a major look like a specialist, and up-or-out
  // removed him for it.
  const grade = gradeOf(world, { branch, rank, commissioned }, 9)
  if (
    !commissioned &&
    grade < HYT_BELOW_GRADE &&
    tick - rankSinceTick >= highYearTenureMonthsFor(world.service.get(person.id)!)
  ) {
    discharge(world, tick, person, world.service.get(person.id)!, 'high-year tenure', [
      factor('time-in-grade', 1000),
    ])
    return
  }

  // Term's end. The player signs or leaves; an NPC's retention is a weighing
  // of the same things (rank earned, other doors), resolved by their own roll.
  // §7. INDEFINITE. Past senior NCO the contract stops being a contract:
  // they serve until retirement, high-year tenure or age, and asking a
  // first sergeant every four years whether he would like to stay is the
  // kind of prompt that teaches a player to stop reading them.
  //
  // AND IT IS NOT A LIFE SENTENCE (owner: "must serve to 20 years and up to
  // 30 if they choose"). Under twenty the commitment is the whole point and
  // nothing is asked. At twenty the pension exists, and from there on the
  // question is real again — draw it, or serve on toward the thirty-year
  // stop. So the silence has an end date rather than being permanent.
  if (record.indefinite === true) {
    const yearsIn = Math.floor((tick - record.enlistedAtTick) / 12)
    if (yearsIn < INDEFINITE_RETIRE_AT_YEARS) {
      world.service.set(person.id, {
        ...record,
        termMonthsLeft: record.termMonths ?? SERVICE_TERM_MONTHS,
        termPerformanceSum: 0,
      })
      return
    }
    if (person.id === world.player.personId) {
      const landed = raisePending(world, {
        tick,
        kind: 'reenlist',
        personId: person.id,
        otherId: null,
        occupationId: 'RE-1',
        workplaceId: null,
        monthlyPay: servicePayOn(branchSpecFor(world, branch), rank),
        placeId: null,
        options: ['stay', 'retire'],
      })
      // The clock halts on the pending; a refused raise holds one more
      // month and the office asks again (P1: no silent loss of it).
      world.service.set(person.id, {
        ...world.service.get(person.id)!,
        termMonthsLeft: landed ? 0 : 1,
      })
      return
    }
    // The town answers the same question with its own weighting: most take
    // the pension at twenty, and the ones who stay are the ones the service
    // has been good to.
    if (rng.chance(300 + record.performance / 5, 1_000)) {
      world.service.set(person.id, {
        ...record,
        termMonthsLeft: record.termMonths ?? SERVICE_TERM_MONTHS,
        termPerformanceSum: 0,
      })
    } else {
      discharge(world, tick, person, record, 'twenty years served', [
        factor('term-ended', 700),
      ])
    }
    return
  }

  // A FLAG STOPS THE PEN (M-SCHOOL §3). A suspension of favourable actions
  // covers reenlistment, so the term cannot be signed while one is up.
  //
  // BUT ONLY A FLAG THAT WILL LIFT ON ITS OWN. An adverse action ages off
  // in twelve months, so holding the term for it is a real hold and it
  // ends. A FITNESS FAILURE DOES NOT age off — it clears when the next
  // test is passed, and a body that cannot pass never clears it.
  //
  // MEASURED, and this was a trap of my own making: holding for ANY flag
  // meant a permanently unfit soldier could neither reenlist nor leave. He
  // sat out the rest of his career in limbo — unpromotable, on frozen pay,
  // his term ending and re-ending every month until the thirty-year
  // ceiling or age sixty-two finally removed him. The demographic test
  // caught it from three systems away: completed families went 25.4%
  // childless against a 25% ceiling, because a stalled career is a life
  // that does not start.
  //
  // So the hold is for the temporary flag only. A soldier who reaches the
  // end of a term still failing the standard is not held: the service
  // simply does not write him another contract, which is what the ordinary
  // eligibility check below already says, honestly and with an ending.
  const flagAtTerm = flagStatus(world, person.id, tick)
  if (flagAtTerm.reasons.includes('adverse-action')) {
    world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 1 })
    return
  }

  // §2. THE SERVICE DECIDES FIRST. Reenlistment is earned: a barred file
  // separates at the end of term whatever the person wants, and that is
  // not the player's choice to make.
  const eligibility = eligibilityOf(world, person, record, tick)
  if (eligibility.code === 'RE-4') {
    recordEvent(world, tick, {
      type: 'barred-from-reenlistment',
      subjectId: person.id,
      detail: eligibility.reason,
    })
    discharge(world, tick, person, record, 'barred from reenlistment', [factor('time-in-grade', 600)])
    return
  }

  if (person.id === world.player.personId) {
    const landed = raisePending(world, {
      tick,
      kind: 'reenlist',
      personId: person.id,
      otherId: null,
      // The RE code travels so the scene can say what the door is.
      occupationId: eligibility.code,
      workplaceId: null,
      monthlyPay: servicePayOn(branchSpecFor(world, branch), rank),
      placeId: null,
      // §8. At twenty years the fork is not stay-or-go, it is another term
      // or a pension — and the player should be told that is what it is.
      //
      // THE WALL COMES FIRST (ADR-0032). At twelve years there is no
      // "another term" to offer: the verb becomes GO INDEFINITE, and it is
      // the same word whether the alternative is separating or drawing a
      // pension. A record already indefinite never reaches here at all.
      options: (() => {
        const years = Math.floor((tick - record.enlistedAtTick) / 12)
        // Indefinite status is an enlisted institution; an officer signs
        // on the way he always has.
        const stay =
          !commissioned && indefiniteStandingFor(grade, years) === 'elect' ? 'indefinite' : 'reenlist'
        return years >= 20 ? [stay, 'retire'] : [stay, 'separate']
      })(),
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

/**
 * §2. What the service will do about another term, read from what the
 * world already records: the evaluation, the orderly room, the courthouse
 * and the clock.
 */
export function eligibilityOf(
  world: World,
  person: Person,
  record: ServiceRecordT,
  tick: Tick,
): Eligibility {
  const strikes = eventsFor(world, person.id).filter(
    (e) => e.type === 'disciplined' && tick - e.tick < MISCONDUCT_WINDOW_MONTHS,
  ).length
  // THE COURTHOUSE, GRADED — a serving member is not a stranger at the
  // recruiting desk. A serious conviction ends the career; a lesser one
  // costs a waiver and the bonus, not the choice.
  const criminal = world.criminal.get(person.id)
  let criminalGate: 'none' | 'waiver' | 'bar' = 'none'
  for (const conviction of criminal?.convictions ?? []) {
    if (conviction.sealed === true) continue
    const offence = offenceById(conviction.kind)
    if (offence === undefined) continue
    const years = Math.floor((tick - conviction.tick) / 12)
    const grave =
      offence.grade === 'capital' || (offence.violent === true && isFelony(offence.grade))
    if (grave || (isFelony(offence.grade) && years < 10)) {
      criminalGate = 'bar'
      break
    }
    if (years < 3) criminalGate = 'waiver'
  }
  const commissionedHere = record.commissioned === true
  const grade = gradeOf(world, record, 1)
  return reenlistEligibility(record, {
    strikes,
    endsCareerAt: MISCONDUCT_STRIKES,
    criminalGate,
    // High-year tenure: the up-or-out rule the career already models.
    // The same up-or-out rule the career already models, asked here as
    // the reason the service will not write another contract.
    // BOTH OF THESE ARE ENLISTED RULES, and an officer is exempt from
    // each. Passing his real years with a grade the wall would refuse is
    // what separated a sixteen-year major; passing zero years tells the
    // wall there is nothing here for it to judge.
    hitHighYearTenure:
      !commissionedHere &&
      grade < HYT_BELOW_GRADE &&
      tick - record.rankSinceTick >= highYearTenureMonthsFor(record),
    age: ageAt(person.birthTick, tick),
    // The twelve-year wall (ADR-0032). Whole years, so the month a career
    // turns twelve is the month the question changes.
    yearsServed: commissionedHere ? 0 : Math.floor((tick - record.enlistedAtTick) / 12),
    grade,
  })
}

/** What this reenlistment would pay, if anything. */
export function bonusFor(world: World, record: ServiceRecordT, tick: Tick, termYears: number): Money {
  const specialty = specialtyFor(world, record.specialtyId)
  const years = Math.floor((tick - record.enlistedAtTick) / 12)
  return srbFor(specialty, years, termYears, record.monthlyPay)
}

/**
 * The contract's state, carried on the pendings that build it:
 * "code|termYears|option|bonus".
 */
export function encodeContract(
  code: string,
  termYears: number,
  option: string,
  bonus: number,
): string {
  return `${code}|${String(termYears)}|${option}|${String(bonus)}`
}

export function decodeContract(encoded: string | null): {
  code: string
  termYears: number
  option: ReenlistmentOption | 'none'
  bonus: number
} {
  const parts = (encoded ?? '').split('|')
  const option = parts[2] ?? 'none'
  return {
    code: parts[0] ?? 'RE-1',
    termYears: Number(parts[1] ?? '4'),
    option:
      option === 'bonus' || option === 'school' || option === 'stability' || option === 'reclass'
        ? option
        : 'none',
    bonus: Number(parts[3] ?? '0'),
  }
}

/** §3. The terms the service will write for this file. */
export function termsOfferedTo(world: World, person: Person, tick: Tick): readonly number[] {
  const record = world.service.get(person.id)
  if (!record) return []
  return eligibilityOf(world, person, record, tick).terms
}

/** §5. The options on this contract, given what it pays. */
export function optionsOffered(code: string, bonus: number): readonly ReenlistmentOption[] {
  return optionsFor(code === 'RE-3' ? 'RE-3' : 'RE-1', bonus as Money)
}

/**
 * §5. Apply what they chose. The money moves through the household ledger
 * like every other sum in this game; the school and the stabilization are
 * promises the rest of the engine already knows how to keep.
 */
export function applyReenlistmentOption(
  world: World,
  tick: Tick,
  person: Person,
  option: ReenlistmentOption | 'none',
): void {
  const record = world.service.get(person.id)
  if (!record) return
  // THE MONEY IS THE CALLER'S TO MOVE. finances.ts already imports this
  // module for service pay, so reaching back into it from here would close
  // a cycle the import ratchet exists to prevent. The caller has the
  // ledger; this function has the decision.
  if (option === 'bonus') return
  // Reclassification is a QUESTION, not an effect: which trade is the
  // player's to answer, and the caller owns the pendings. Elected here,
  // asked one prompt later.
  if (option === 'reclass') return
  if (option === 'stability') {
    // No involuntary orders for two years. The deployment system reads it.
    world.service.set(person.id, {
      ...record,
      stabilizedUntilTick: (tick + STABILITY_MONTHS) as Tick,
    })
    return
  }
  if (option === 'school') {
    // A guaranteed seat at the best school currently open to them — the
    // thing they would otherwise have had to compete for.
    const open = schoolOptionsFor(world, person.id).filter((o) => o.open)
    const pick = open[open.length - 1]
    if (pick !== undefined) {
      const school = world.spec.schools.find((sc) => sc.id === pick.id)
      if (school !== undefined) {
        world.service.set(world.service.get(person.id)!.personId, {
          ...world.service.get(person.id)!,
          schoolId: school.id,
          schoolStartsAtTick: nextClassTick(school, tick),
        })
      }
    }
  }
}

export function reenlist(
  world: World,
  tick: Tick,
  person: Person,
  termMonths?: number,
  administratorId?: EntityId | null,
): void {
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return
  // Judge the closing term BEFORE the ledger resets for the next one.
  const termAverage = termAveragePerformance(record)
  // §3. THE TERM IS CHOSEN, not a constant. A record without one ran the
  // old fixed contract, and reading it as such is the truth about it.
  const chosen = termMonths ?? record.termMonths ?? SERVICE_TERM_MONTHS
  const grade = gradeOf(world, record, 1)
  world.service.set(person.id, {
    ...record,
    termMonthsLeft: chosen,
    termMonths: chosen,
    termPerformanceSum: 0,
    // THE WALL (ADR-0032). Signing again at twelve years IS electing
    // indefinite — there is nothing else on offer, so the record simply
    // says so rather than asking a second question with one answer. Once
    // set it never clears: a career does not go back on the clock.
    indefinite:
      record.indefinite === true ||
      indefiniteStandingFor(grade, Math.floor((tick - record.enlistedAtTick) / 12)) === 'elect',
  })
  const reenlisted = recordEvent(world, tick, {
    type: 'reenlisted',
    subjectId: person.id,
    ...(administratorId ? { otherId: administratorId } : {}),
    // §6. Who administered the oath, where somebody did. `otherId` already
    // means "the other person involved", so the ceremony needs no new event
    // type and no schema change — and a save written before this simply has
    // null there, which reads as the anonymous adjutant it always was.
    detail: rankTitle(world, record.branch, record.rank, record.commissioned === true),
  })
  // A FLAG SUSPENDS FAVOURABLE ACTIONS, AND A MEDAL IS ONE (M-SCHOOL §3).
  //
  // WHICH MEDALS, THOUGH — this is a judgement the spec does not make and
  // somebody had to. Suspended: the routine, discretionary ones a command
  // decides to give. NOT suspended, and deliberately: the decorations that
  // record something that HAPPENED — a wound, a campaign, contact with the
  // enemy, captivity, an act of valour. Heroism under fire is not a favour
  // the orderly room grants, and a Purple Heart withheld because somebody
  // was late to formation would be the game calling a fact a reward.
  const flagged = flagStatus(world, person.id, tick).flagged
  if (!flagged) {
    grantGoodConduct(world, tick, person.id, reenlisted, termAverage)
    grantMeritoriousService(world, tick, person.id, reenlisted, termAverage)
  }
  // A commendable term, below the meritorious bar. The merit Bronze Star
  // used to be granted here too and is retired (owner): a Bronze Star means
  // somebody did something under fire, and it was arriving for signing on
  // again. A distinguished term has the Meritorious Service Medal, which is
  // what that medal is for.
  if (!flagged) grantCommendation(world, tick, person.id, reenlisted, termAverage)
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
  world.service.set(personId, { ...record, unitId, unitSinceTick: world.tick })
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

/**
 * M-SCHOOL §3. THE FLAG — suspension of favourable actions.
 *
 * The owner's spec calls this "the gate that ties discipline to schooling
 * (big interconnection)", and it is: while a soldier is flagged they cannot
 * be sent to school, be promoted, reenlist, or receive an award. It is the
 * payoff of the Article 15 work — misconduct now visibly closes the
 * schoolhouse door rather than costing a number nobody sees.
 *
 * DERIVED, NOT STORED. Every reason is owned by the system that causes it
 * and read from state that system already writes — the discipline events,
 * the fitness score, the separation on the record. Storing a flag would
 * mean two owners for one fact and a lifetime of them drifting apart
 * (DOMAIN_MAP §2, single-writer).
 *
 * WHAT THE SPEC ASKS FOR THAT IS NOT HERE, and why: "body composition" is
 * listed as a reason and there is no weight or tape standard anywhere in
 * this game to read. Inventing one to satisfy a list would be inventing a
 * whole system nobody asked for. The reason is deliberately absent rather
 * than faked, and the shape below takes new reasons without changing its
 * callers.
 */
export type FlagReason = 'adverse-action' | 'fitness-failure' | 'pending-separation'

export interface FlagStatus {
  readonly flagged: boolean
  readonly reasons: readonly FlagReason[]
  /** Plain words for the screen, or '' when the way is clear. */
  readonly words: string
  /**
   * The tick this lifts on its own, or null when it lifts on an ACTION
   * rather than a date.
   *
   * The difference matters to the person under it: an adverse action ages
   * off and there is nothing to do but serve the months, while a fitness
   * failure clears the next time the test is passed and waiting will not
   * help. A screen that said only "flagged" would leave them unable to
   * tell which of those they were living in.
   */
  readonly liftsAtTick: Tick | null
}

/**
 * Below this the fitness test is a failure, and a failure is a flag.
 *
 * MEASURED, and the first number was a disaster. Set at 200 by guesswork,
 * it flagged FIFTEEN OF SEVENTEEN serving soldiers — because the scores
 * this game actually produces run 114 to 207 with a median of 180, so the
 * "failing" bar sat above the middle of the army. Flagged means no school,
 * no promotion and no reenlistment, so the whole force stalled below the
 * first senior rung and the schoolhouse test caught it.
 *
 * A failure has to be a failure, not an average. This sits below the tenth
 * percentile of the observed range and wants re-checking if the fitness
 * model ever moves.
 */
const FITNESS_FAILING = 128

/** How long a single adverse action holds the flag up. */
const ADVERSE_ACTION_MONTHS = 12

const FLAG_WORDS: Readonly<Record<FlagReason, string>> = {
  'adverse-action': 'Ineligible — flagged (adverse action).',
  'fitness-failure': 'Ineligible — flagged (failed the fitness standard).',
  'pending-separation': 'Ineligible — flagged (pending separation).',
}

export function flagStatus(world: World, personId: EntityId, tick: Tick): FlagStatus {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) {
    return { flagged: false, reasons: [], words: '', liftsAtTick: null }
  }
  const reasons: FlagReason[] = []

  // THE ORDERLY ROOM. A company punishment holds the flag up for a year —
  // this is the Article 15 reaching the schoolhouse, which is the whole
  // point of the interconnection.
  const actions = eventsFor(world, personId).filter(
    (e) => e.type === 'disciplined' && tick - e.tick < ADVERSE_ACTION_MONTHS,
  )
  // The LAST one decides when it lifts — a second punishment inside the
  // window extends the flag rather than running alongside the first.
  const latestAction = actions.reduce((latest, e) => (e.tick > latest ? e.tick : latest), -1)
  if (actions.length > 0) reasons.push('adverse-action')

  // THE BODY'S SHARE. Only once the test has actually been taken — a
  // record whose score has never been set is untested, not failing, and
  // flagging every new soldier for a test they have not sat would be a
  // bug wearing a rule's clothes.
  if (record.fitnessTestedAtTick !== null && record.fitnessScore < FITNESS_FAILING) {
    reasons.push('fitness-failure')
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    words: reasons.map((r) => FLAG_WORDS[r]).join(' '),
    // Only the dated one gives a date. A fitness failure lifts when the
    // next test is passed, and pretending otherwise would promise a month
    // that means nothing.
    liftsAtTick:
      latestAction >= 0 && !reasons.includes('fitness-failure')
        ? ((latestAction + ADVERSE_ACTION_MONTHS) as Tick)
        : null,
  }
}

/**
 * M-PROMO BAND 3 — THE CENTRALIZED SELECTION BOARD.
 *
 * From the owner's `army_promotions_fix.md` §1: "E-7 → E-9: a centralized
 * HQDA selection board. Once a year a Department-of-the-Army board convenes,
 * reads your entire file, and selects a fixed number. No points — it's your
 * record vs. everyone else's."
 *
 * THE FIXED NUMBER IS THE WHOLE POINT, and it is what was missing. Running
 * the E-5/E-6 points logic all the way up meant every senior grade was an
 * individual test against a cutoff: clear it and you promote, and so does
 * everybody else who cleared it. Measured with the PME gate in and this
 * band still absent — seventeen of thirty-three serving sat at E-7 or
 * above. An army shaped like that has no privates in it.
 *
 * A selection board is not a test. It is a competition for a set number of
 * seats, and the seats are what make the ladder a pyramid.
 */
const SENIOR_BAND_FROM_GRADE = 7

/**
 * How much of an enlisted force each senior grade is allowed to be, per
 * thousand. A pyramid: plenty of sergeants, few sergeants major.
 *
 * TUNED, NOT SOURCED. Real force structures publish grade tables and these
 * are not them — they are the shape (each rung a fraction of the one below)
 * at numbers that produce a believable town. Worth replacing with real
 * proportions if anybody wants to look them up.
 */
const SENIOR_SHARE_PER_MILLE: Readonly<Record<number, number>> = { 7: 130, 8: 55, 9: 20 }

/** Whether this grade is filled by the annual board rather than by points. */
export function isSeniorBand(grade: number): boolean {
  return grade >= SENIOR_BAND_FROM_GRADE
}

/**
 * What the board reads: the whole file, weighted. Not promotion points —
 * the spec is explicit that there are none at this level — but the same
 * evidence a real board sees, in one comparable number.
 */
function fileStrengthOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (!record) return 0
  const decorations = world.awards.get(personId) ?? []
  const valour = decorations.filter((a) => a.kind === 'valor').length
  const merit = decorations.filter(
    (a) => a.kind === 'meritorious-service' || a.kind === 'commendation',
  ).length
  const badges = decorations.filter((a) => a.kind === 'qualification-badge').length
  return (
    record.performance * 2 +
    Math.min(240, world.tick - record.rankSinceTick) +
    valour * 300 +
    merit * 90 +
    badges * 40 +
    Math.min(200, record.fitnessScore / 3)
  )
}

/**
 * The annual boards, one per branch per senior grade.
 *
 * Runs on a fixed month off the epoch grid so a replay convenes it in the
 * same month every time, the way the school class dates already work.
 */
export function runSelectionBoards(world: World, tick: Tick): void {
  if (tick % 12 !== 7) return

  const serving = [...world.service.values()]
    .filter((r) => r.dischargedAtTick === null && r.commissioned !== true)
    .sort((a, b) => a.personId - b.personId)
  if (serving.length === 0) return

  const branches = [...new Set(serving.map((r) => r.branch))].sort()
  for (const branch of branches) {
    const spec = branchSpecFor(world, branch)
    const force = serving.filter((r) => r.branch === branch)
    if (force.length === 0) continue
    const gradeOf = (rank: number): number => spec.grades[rank] ?? 0

    for (const grade of [7, 8, 9]) {
      const share = SENIOR_SHARE_PER_MILLE[grade] ?? 0
      const seats = Math.floor((force.length * share) / 1000)
      const sitting = force.filter((r) => gradeOf(r.rank) === grade).length
      const vacancies = seats - sitting
      if (vacancies <= 0) continue

      // Everybody one rung below who could actually pin it on.
      const candidates = force
        .filter((r) => {
          const next = r.rank + 1
          if (next >= spec.ranks.length) return false
          if (gradeOf(next) !== grade) return false
          if (world.tick - r.rankSinceTick < 24) return false
          if (isDeployed(world, r.personId) || isCaptive(world, r.personId)) return false
          if (flagStatus(world, r.personId, tick).flagged) return false
          // The school is a hard gate here too — a board does not select
          // somebody who cannot be promoted when the list publishes.
          return schoolOwedFor(world, r.personId, branch, next, false) === undefined
        })
        .map((r) => ({ record: r, strength: fileStrengthOf(world, r.personId) }))
        // Strongest file first; the id breaks ties so a replay selects the
        // same people in the same order.
        .sort((a, b) => b.strength - a.strength || a.record.personId - b.record.personId)

      const selected = candidates.slice(0, vacancies)
      for (const { record } of selected) {
        const person = world.people.get(record.personId)
        if (!person) continue
        const newRank = applyBoardPromotion(world, tick, record.personId)
        if (newRank === null) continue
        recordEvent(world, tick, {
          type: 'promoted',
          subjectId: record.personId,
          detail: rankTitle(world, branch, newRank, false),
        })
        recordDecision(world, tick, {
          subjectId: record.personId,
          decision: 'promotion',
          significance: 'major',
          inputs: [
            factor('strong-performance', record.performance),
            factor('time-in-grade', Math.min(1000, world.tick - record.rankSinceTick)),
          ],
          chosen: `selected for ${rankTitle(world, branch, newRank, false)}`,
          rejected: [],
          streamId: Stream.Employment,
        })
      }
      // THE ONES WHO WERE NOT SELECTED. A passed-over file is already a
      // thing this game records and reads — the cutoff carries a penalty
      // for it — so a board that selects silently would be hiding the half
      // of its work that hurts.
      for (const { record } of candidates.slice(vacancies)) {
        recordEvent(world, tick, {
          type: 'passed-over',
          subjectId: record.personId,
          detail: String(record.rank + 1),
        })
      }
    }
  }
  runBillets(world, tick)
}


/**
 * M-PROMO. WHO HOLDS THE COMMAND BILLETS THIS YEAR.
 *
 * Runs with the selection boards, after them, so somebody promoted into
 * E-8 this month can be looked at for First Sergeant in the same sitting.
 *
 * A tour ends and the title goes back — that reversion is the part the
 * spec is most explicit about, and the part a "just add two ranks" model
 * would have got wrong for good.
 */
function runBillets(world: World, tick: Tick): void {
  const serving = [...world.service.values()]
    .filter((r) => r.dischargedAtTick === null && r.commissioned !== true)
    .sort((a, b) => a.personId - b.personId)

  // First, the tours that are over.
  for (const record of serving) {
    if (typeof record.billet !== 'string' || record.billet === '') continue
    const since = record.billetSinceTick ?? tick
    const spec = branchSpecFor(world, record.branch)
    const grade = spec.grades[record.rank] ?? 0
    const stillRates = (BRANCH_BILLETS[record.branch as 'land-forces'] ?? {})[grade] !== undefined
    if (tick - since < BILLET_TOUR_MONTHS && stillRates) continue
    // Either the tour ran out or a promotion moved them off the grade the
    // billet belongs to. Both end it, and both revert the title.
    world.service.set(record.personId, { ...record, billet: null, billetSinceTick: null })
    recordEvent(world, tick, {
      type: 'billet-ended',
      subjectId: record.personId,
      detail: record.billet,
    })
  }

  // Then the seats that are open.
  const branches = [...new Set(serving.map((r) => r.branch))].sort()
  for (const branch of branches) {
    const spec = branchSpecFor(world, branch)
    const table = BRANCH_BILLETS[branch as 'land-forces'] ?? {}
    for (const gradeKey of Object.keys(table).sort()) {
      const grade = Number(gradeKey)
      const billet = table[grade]
      if (billet === undefined) continue
      const atGrade = serving.filter(
        (r) => r.branch === branch && (spec.grades[r.rank] ?? 0) === grade,
      )
      // ONE SEAT PER FOUR PEOPLE AT THE GRADE, at least one where anybody
      // holds it at all — a company has one first sergeant, not four.
      const seats = Math.max(1, Math.floor(atGrade.length / 4))
      const held = atGrade.filter((r) => typeof r.billet === 'string' && r.billet !== '').length
      let open = seats - held
      if (open <= 0) continue
      const candidates = atGrade
        .filter((r) => !(typeof r.billet === 'string' && r.billet !== ''))
        .map((r) => ({ record: r, strength: fileStrengthOf(world, r.personId) }))
        .sort((a, b) => b.strength - a.strength || a.record.personId - b.record.personId)
      for (const { record } of candidates) {
        if (open <= 0) break
        const current = world.service.get(record.personId)
        if (!current || current.dischargedAtTick !== null) continue
        world.service.set(record.personId, {
          ...current,
          billet: billet.abbr,
          billetSinceTick: tick,
        })
        recordEvent(world, tick, {
          type: 'billet-taken',
          subjectId: record.personId,
          detail: billet.title,
        })
        open -= 1
      }
    }
  }
}

/**
 * M-PROMO. THE UNIT SENDS ITS OWN PEOPLE TO SCHOOL.
 *
 * FOUND WHILE BUILDING THE PME GATE, and it would have been a disaster on
 * its own. Before this, the ONLY doors into a schoolhouse were the player's
 * — a monthly offer, the Service tab's request, and the reenlistment
 * retention option. An NPC never attended a course in their life. That was
 * survivable while a school only pinned a badge on; the moment the school
 * GATES THE GRADE it means every soldier in every town stops dead below the
 * first NCO rung, and a world with no sergeants in it has no army in it.
 *
 * So the unit does what a unit does: when somebody has the time in grade,
 * the standing and the rank for the course their next grade needs, they get
 * a seat. Seeded off the service stream like everything else, weighted by
 * the course's own scarcity, and it runs for the player's NPCs and for the
 * whole town alike (Law 1 — the rule is the simulation's, not a screen).
 *
 * The PLAYER is deliberately excluded. Their seat is theirs to ask for and
 * accept; the point of the schoolhouse tab is that they choose. Sending
 * them automatically would take the decision the spec is built around.
 */
function seatDueFor(
  world: World,
  tick: Tick,
  personId: EntityId,
  rng: Rng,
): { readonly schoolId: string; readonly startsAtTick: Tick } | null {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick !== null) return null
  if (record.schoolId !== null) return null
  if (isCaptive(world, personId)) return null
  if (isDeployed(world, personId)) return null

  // The course the NEXT grade needs, if any is owed.
  const spec = branchSpecFor(world, record.branch)
  const nextRank = record.rank + 1
  const ladder = record.commissioned === true ? (spec.officerRanks ?? spec.ranks) : spec.ranks
  if (nextRank >= ladder.length) return null
  const owed = schoolOwedFor(world, personId, record.branch, nextRank, record.commissioned === true)
  if (owed === undefined) return null

  // The same gates the player's own list applies, so the two cannot drift.
  const option = schoolOptionsFor(world, personId).find((o) => o.id === owed.id)
  if (option === undefined || !option.open) return null

  // Scarcity decides how often the quota reaches this soldier. A course
  // nobody can get near takes years to come round; a leader course comes
  // round often, because it has to for anybody to make sergeant.
  // MEASURED. The first formula gave a leader course roughly one month in
  // two and still produced only fourteen graduations in forty years, because
  // most of the people who needed it were failing the entry bar rather than
  // the roll. With the bar corrected the roll is what paces it, so it is
  // generous for the courses everybody must pass through and stingy for the
  // ones a career is built on.
  const chance = Math.max(6, 90 - Math.floor(owed.seatScarcity / 12))
  if (!rng.chance(chance, 100)) return null

  // RETURNED, NOT WRITTEN — see ADR-0039. The month ends with one write
  // that spreads the record as it was BEFORE any of this ran, and
  // `schoolId` is not among the fields that write names. The first version
  // of this booked the seat straight onto the record and it was reverted
  // the same month, every month: measured at ZERO school bookings of any
  // kind across twenty-five years. The trap was documented an hour before
  // it was walked into.
  return { schoolId: owed.id, startsAtTick: nextClassTick(owed, tick) }
}

/**
 * M-PROMO. THE SCHOOL IS A HARD GATE.
 *
 * From the owner's `army_promotions_fix.md` §2: "you cannot promote into an
 * NCO rank without its school complete. The school is a hard gate, on top
 * of the points/board." Every branch works the same way here even though
 * the three promotion ENGINES do not — a grade you have not been to school
 * for is a grade you do not pin on.
 *
 * Returns the course still owed, or undefined when the way is clear. The
 * caller turns that into the plain reason the bar pattern wants: "requires
 * the Advanced Leader Course."
 */
export function schoolOwedFor(
  world: World,
  personId: EntityId,
  branch: string,
  targetRank: number,
  commissioned: boolean,
): ServiceSchool | undefined {
  // OFFICERS ARE OUT OF SCOPE HERE. Their PME ladder is real but the spec
  // scopes it to a later phase, and gating officer promotion on courses
  // that do not exist yet would stop every officer career dead at O-1.
  if (commissioned) return undefined
  const spec = branchSpecFor(world, branch)
  const grade = spec.grades[targetRank]
  if (grade === undefined) return undefined
  // The catalogue is the WORLD's, not the branch's — a preset swaps the
  // whole list, which is how Heartland gets the same schools by reference.
  const gating = world.spec.schools.find(
    (school) => school.gatesGrade === grade && admitsBranch(school, branch),
  )
  if (gating === undefined) return undefined
  return holdsBadge(world, personId, gating.badge) ? undefined : gating
}

/** Whether a course admits this branch — empty means all of them. */
function admitsBranch(school: ServiceSchool, branch: string): boolean {
  return school.branches.length === 0 || school.branches.includes(branch)
}

/**
 * Whether the badge is already pinned on. Read off the awards ledger, which
 * is where graduation puts it — not off the events, which would mean a
 * linear scan of the whole world's history on every promotion check.
 */
function holdsBadge(world: World, personId: EntityId, badge: string): boolean {
  return (world.awards.get(personId) ?? []).some(
    (award) => award.kind === 'qualification-badge' && award.title === badge,
  )
}

/** The board said yes: one grade up, pay to match. Returns the new rank for
 *  the caller's prose, or null if nobody was there to promote. */
export function applyBoardPromotion(world: World, tick: Tick, personId: EntityId): number | null {
  const record = activeRecord(world, personId)
  if (!record) return null
  const newRank = record.rank + 1
  const branch = branchSpecFor(world, record.branch)
  world.service.set(personId, {
    ...record,
    rank: newRank,
    rankSinceTick: tick,
    // The table the member is paid from, not the one everybody used to be
    // paid from — a promoted lieutenant's pay used to fall to the enlisted
    // scale until serveMonth quietly corrected it a month later.
    monthlyPay:
      record.commissioned === true ? officerPayOn(branch, newRank) : servicePayOn(branch, newRank),
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
  const previous = specialtyFor(world, record.specialtyId)
  world.service.set(person.id, {
    ...record,
    specialtyId,
    priorSpecialtyIds: [...record.priorSpecialtyIds, record.specialtyId],
    specialtyChangedAtTick: tick,
  })
  const specialty = specialtyFor(world, specialtyId)
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

  // THE PAPERWORK, at every separation and for every reason (owner's spec).
  // Raised AFTER the record closes, because the DD-214 is a summary of a
  // finished career and reads every field off the closed record — dates,
  // total service, character of service. Rendering it from an open one
  // would be a document about something that had not happened yet.
  //
  // Not for the dead: a person killed in service is not out-processing, and
  // the pending resolver refuses a question for someone who cannot answer.
  // Their record still closes and still holds everything the sheet would
  // have said, which is what a family reads later.
  if (person.id === world.player.personId && person.deathTick === null) {
    raisePending(world, {
      tick,
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
  // An end-of-term discharge closes a completed term; good conduct is
  // judged on the term's AVERAGE. A term cut short — medical or otherwise —
  // is refused by the grant itself, which reads the reason off the event.
  grantGoodConduct(world, tick, person.id, dischargedEvent, termAveragePerformance(record))
  grantMeritoriousService(world, tick, person.id, dischargedEvent, termAveragePerformance(record))
  // A commendable term, below the meritorious bar. The merit Bronze Star
  // was granted here too and is retired (owner) — see the reenlistment
  // door for why.
  grantCommendation(world, tick, person.id, dischargedEvent, termAveragePerformance(record))
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
    chosen: `left ${branchName(world, record.branch)} after ${Math.max(1, Math.floor((tick - record.enlistedAtTick) / TICKS_PER_YEAR))} years' service`,
    rejected: ['to serve on'],
    streamId,
  })
}

/** True when the education fork at eighteen should offer the uniform. */
export function educationOffersEnlistment(world: World, person: Person, tick: Tick): boolean {
  return canEnlist(world, person, tick) && !hasAnswered(world, 'enlist')
}

/**
 * The schoolhouse's own month: classes start, classes finish, badges get
 * pinned on. Runs for EVERYONE with a seat, player or not — a school with a
 * calendar that only the player experiences is not a school, it is a menu.
 */
/**
 * The National Defense Service Medal: served while the country was at war,
 * whoever they were and wherever they stood. Checked monthly because that is
 * what the ribbon means — not a deployment, not a decoration for anything
 * done, simply that you were in uniform when it happened.
 */
export function runWartimeService(world: World, tick: Tick): void {
  if (activeWars(world).length === 0) return
  const home = homeland(world)
  if (!home) return
  const ourWar = activeWars(world).some((war) => war.a === home.id || war.b === home.id)
  if (!ourWar) return

  const records = [...world.service.values()].sort((a, b) => a.personId - b.personId)
  for (const record of records) {
    if (record.dischargedAtTick !== null) continue
    const already = (world.awards.get(record.personId) ?? []).some((a) => a.kind === 'national-defense')
    if (already) continue
    const person = world.people.get(record.personId)
    if (!person || person.deathTick !== null) continue

    const served = recordEvent(world, tick, {
      type: 'wartime-service',
      subjectId: record.personId,
    })
    grantNationalDefense(world, tick, record.personId, served)
  }
}

export function runSchools(world: World, tick: Tick): void {
  const records = [...world.service.values()].sort((a, b) => a.personId - b.personId)
  for (const record of records) {
    if (record.schoolId === null || record.schoolStartsAtTick === null) continue
    // NOBODY ATTENDS A COURSE FROM A CELL. Without this the schoolhouse ran
    // for a prisoner exactly as for anyone else and handed him a
    // qualification badge, the development ribbon and an achievement medal
    // for months he spent held — an award for service that provably did not
    // happen, which is the one thing the earnability rule exists to stop.
    // The seat is kept, not lost: he is held, not out.
    // NOBODY ATTENDS FROM A THEATRE EITHER. Pre-existing, and flight school's
    // nine months widened the window enough to matter: a deployed soldier was
    // graduating a course, collecting the badge and the ribbon that go with
    // it, from the other side of a war. The seat is KEPT in both cases — they
    // are away, not out — so the class resumes when they are home.
    if (isCaptive(world, record.personId) || isDeployed(world, record.personId)) {
      // AWAY, SO THE CLASS DATE MOVES WITH THEM. Skipping alone left the
      // date stale, and a stale date graduates on its own the month they
      // get home — a badge for a course nobody sat in. The seat is held and
      // the start rolls to the next class after they are back.
      const away = world.spec.schools.find((sc) => sc.id === record.schoolId)
      if (away !== undefined && record.schoolStartsAtTick !== null && tick >= record.schoolStartsAtTick) {
        world.service.set(record.personId, {
          ...record,
          schoolStartsAtTick: nextClassTick(away, (tick + 1) as Tick),
        })
      }
      continue
    }
    if (record.dischargedAtTick !== null) {
      // Out of the service is out of the class.
      world.service.set(record.personId, { ...record, schoolId: null, schoolStartsAtTick: null })
      continue
    }
    const school = world.spec.schools.find((s) => s.id === record.schoolId)
    if (!school) {
      world.service.set(record.personId, { ...record, schoolId: null, schoolStartsAtTick: null })
      continue
    }
    if (tick === record.schoolStartsAtTick) {
      recordEvent(world, tick, {
        type: 'began-training',
        subjectId: record.personId,
        detail: school.title,
      })
      continue
    }
    if (tick < record.schoolStartsAtTick + school.courseMonths) continue

    // ---- M-SCHOOL §5. THE COURSE DECIDES, and it can say no. ----------
    //
    // "Hard schools are hard — you can wash out. Attrition is real and
    // varies enormously." Before this, arriving at the last month WAS
    // graduating: the badge was pinned on for everybody who sat down,
    // whatever the course and whoever they were.
    //
    // The roll is off the service stream, salted by the school and the
    // attempt, so a second go is a second roll and a replay is the same
    // story. What moves it is the soldier: the fit, the sharp and the
    // diligent wash out less, which is the whole reason those numbers are
    // on the record.
    const attempts = record.schoolAttempts ?? []
    const spent = attempts.filter(
      (a) => a.schoolId === school.id && a.outcome === 'failed',
    ).length
    const courseRng = openStream(
      world.seed,
      Stream.Employment,
      record.personId,
      tick + 61_003 + spent * 977 + school.id.length,
    )

    // INJURY FIRST, and it is not failure. Weighted by how long the course
    // runs — a nine-month school has more chances to break somebody than a
    // three-week one.
    if (courseRng.chance(Math.min(60, 4 + school.courseMonths * 3), 1_000)) {
      const wound = inflictWound(world, tick, record.personId, 260 + courseRng.nextInt(0, 220), 'field-accident', courseRng)
      recordEvent(world, tick, {
        type: 'was-injured',
        subjectId: record.personId,
        detail: `minor:${wound.description}`,
      })
      recordEvent(world, tick, {
        type: 'dropped-from-training',
        subjectId: record.personId,
        detail: `${school.title}:injured`,
      })
      world.service.set(record.personId, {
        ...record,
        schoolId: null,
        schoolStartsAtTick: null,
        recyclesUsed: 0,
        // NOT counted against maxAttempts — see SchoolAttempt.
        schoolAttempts: [...attempts, { schoolId: school.id, tick, outcome: 'injured' }],
      })
      continue
    }

    // THE ATTRITION ROLL. The course's own weight, moved by the person.
    const relief =
      Math.floor(Math.max(0, record.performance - 500) / 6) +
      Math.floor(Math.max(0, record.fitnessScore - 150) / 3)
    const washChance = Math.max(0, school.difficulty - relief)
    if (courseRng.chance(washChance, 1_000)) {
      // A RECYCLE IS NOT A FAILURE. Repeat the phase: more time, another
      // roll, and nothing on the record but the months. Limited, then it
      // becomes a wash-out for real.
      const recycles = record.recyclesUsed ?? 0
      if (school.recycleAllowed === true && recycles < 1) {
        recordEvent(world, tick, {
          type: 'recycled-in-training',
          subjectId: record.personId,
          detail: school.title,
        })
        world.service.set(record.personId, {
          ...record,
          schoolStartsAtTick: tick as Tick,
          recyclesUsed: recycles + 1,
        })
        continue
      }
      recordEvent(world, tick, {
        type: 'dropped-from-training',
        subjectId: record.personId,
        detail: `${school.title}:washed`,
      })
      world.service.set(record.personId, {
        ...record,
        schoolId: null,
        schoolStartsAtTick: null,
        recyclesUsed: 0,
        schoolAttempts: [...attempts, { schoolId: school.id, tick, outcome: 'failed' }],
      })
      continue
    }

    // Graduation: the badge is pinned on through the awards machinery, the
    // same door an NPC's is.
    const graduated = recordEvent(world, tick, {
      type: 'completed-training',
      subjectId: record.personId,
      detail: school.title,
    })
    const badgeEvent = recordEvent(world, tick, {
      type: 'earned-qualification',
      subjectId: record.personId,
      detail: school.badge,
    })
    grantQualificationBadge(world, tick, record.personId, badgeEvent, school.badge)
    // Two more the awards pack hangs off graduating: the leaders course
    // carries its own ribbon, and finishing any course with the work behind
    // you is an achievement in its own right.
    grantNcoDevelopment(world, tick, record.personId, graduated, school.badge)
    grantAchievement(world, tick, record.personId, graduated, record.performance)
    const current = world.service.get(record.personId) ?? record
    world.service.set(record.personId, {
      ...current,
      schoolId: null,
      schoolStartsAtTick: null,
      recyclesUsed: 0,
      schoolAttempts: [
        ...(current.schoolAttempts ?? []),
        { schoolId: school.id, tick, outcome: 'graduated' },
      ],
      performance: Math.max(0, Math.min(1000, current.performance + school.performanceBoost)),
    })
  }
}
