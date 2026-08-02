/**
 * Static content tables: names, places, occupations.
 *
 * All names are ordinary and invented; no real private individuals are
 * referenced (PROJECT_CHARTER.md §2). Occupations are generic roles rather
 * than real employers — businesses do not exist as entities in Milestone 1,
 * so a "workplace" is just a named place in town.
 */

import type { Money } from '@life-engine/shared'
import { dollars } from '@life-engine/shared'
import type { ServiceBranchSpec } from './types.js'
import type { EducationLevel, Occupation } from './types.js'
import type {
  ExposureProfile,
  ServiceSchool,
  ServiceSpecialty,
  SpecialUnit,
} from './types.js'

// The shapes moved to types.ts with W1 (the spec has to name them and
// types.ts imports nothing); the DATA below is still Classic's content.
export type { ExposureProfile, ServiceSchool, ServiceSpecialty, SpecialUnit }

/**
 * NAMES come from the 1990 US Census now (names.ts, owner-supplied): 300
 * male and 500 female given names, 1,000 family names, each with its real
 * frequency. The old lists were 32/32/40 invented ones, which in a town of
 * four hundred meant a dozen Jameses and everybody a Whitlock or a Thorne.
 * Re-exported from here so every existing import keeps working.
 */
export {
  FAMILY_NAME_WEIGHTS,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  FEMALE_GIVEN_WEIGHTS,
  MALE_GIVEN_NAMES,
  MALE_GIVEN_WEIGHTS,
} from './names.js'

export const NEIGHBOURHOOD_NAMES: readonly string[] = [
  'Millbrook', 'Cedar Flats', 'Old Quarry', 'Riverside', 'Kestrel Hill',
  'The Bottoms', 'Ashgrove', 'Fairview',
]

export const WORKPLACE_NAMES: readonly string[] = [
  'the paper mill', 'the rail depot', 'the grain elevator', 'the county hospital',
  'the machine shop', 'the grocery on Main', 'the lumber yard', 'the telephone exchange',
  "the diner on Second Street", 'the savings bank', "Halloran's garage", 'the courthouse',
]

export const CIVIC_NAMES: readonly string[] = ['the town hall', 'the public library']

/**
 * What actually bites at work (M-DEPTH3, owner direction queued since
 * M-WOUNDS: "workplace incidents naming the machine"). Keyed by occupation;
 * trades without a table hurt themselves the generic way.
 */
export const MACHINES_BY_OCCUPATION: Readonly<Record<string, readonly string[]>> = {
  millhand: ['the head saw', 'the planer', 'the log carriage'],
  machinist: ['the lathe', 'the stamping press', 'the grinder'],
  labourer: ['the hoist', 'the scaffolds', 'a load that shifted'],
  carpenter: ['the table saw', 'the roof joists'],
  electrician: ['a live panel', 'the pole transformer'],
  cook: ['the fryer', 'the range'],
  foreman: ['the loading dock', 'the conveyor'],
}

/**
 * Foreign nations, all invented (fictional-world constraint,
 * MILITARY_AND_WAR_FOUNDATION §3). Chosen to sound like places without
 * sounding like any place in particular.
 */
// All invented (foundation §3). 'Ashkelon' was here until L4-M5's review
// caught it — a real city and a real conflict site, about to be minted onto
// campaign medals. Names on the permanent record must never be real places.
export const NATION_NAMES: readonly string[] = [
  'Varenia', 'Costmara', 'Belgrave', 'Tyrene', 'Osmark', 'Halvia',
  'Rondesia', 'Quillar', 'Verros', 'Nortavia', 'Sundermark', 'Veskarn',
]

export const SCHOOL_NAME = 'Fairview Consolidated School'

export const TOWN_NAME = 'Haverlock'

/**
 * Occupations available in town. Deliberately small and generic — a rich
 * occupation model is Layer 2 work.
 *
 * Pay is monthly, in the simulation's own economy. There is no inflation model
 * in Milestone 1, so these figures are stable for the whole run.
 */
export const OCCUPATIONS: readonly Occupation[] = [
  { id: 'labourer', title: 'labourer', requires: 'none', minMonthlyPay: dollars(900), maxMonthlyPay: dollars(1500) },
  { id: 'shop-clerk', title: 'shop clerk', requires: 'primary', minMonthlyPay: dollars(1100), maxMonthlyPay: dollars(1700) },
  { id: 'millhand', title: 'mill hand', requires: 'primary', minMonthlyPay: dollars(1300), maxMonthlyPay: dollars(2100) },
  { id: 'clerk', title: 'office clerk', requires: 'secondary', minMonthlyPay: dollars(1600), maxMonthlyPay: dollars(2400) },
  { id: 'machinist', title: 'machinist', requires: 'trade', minMonthlyPay: dollars(2000), maxMonthlyPay: dollars(3200) },
  { id: 'electrician', title: 'electrician', requires: 'trade', minMonthlyPay: dollars(2200), maxMonthlyPay: dollars(3600) },
  { id: 'nurse', title: 'nurse', requires: 'trade', minMonthlyPay: dollars(2300), maxMonthlyPay: dollars(3400) },
  { id: 'teacher', title: 'teacher', requires: 'college', minMonthlyPay: dollars(2400), maxMonthlyPay: dollars(3800) },
  { id: 'engineer', title: 'engineer', requires: 'college', minMonthlyPay: dollars(3000), maxMonthlyPay: dollars(5200) },
  { id: 'accountant', title: 'accountant', requires: 'college', minMonthlyPay: dollars(2800), maxMonthlyPay: dollars(4600) },
  // M-DEPTH2: a town needs more ways to earn a living than ten.
  { id: 'cook', title: 'cook', requires: 'none', minMonthlyPay: dollars(950), maxMonthlyPay: dollars(1600) },
  { id: 'bookkeeper', title: 'bookkeeper', requires: 'secondary', minMonthlyPay: dollars(1500), maxMonthlyPay: dollars(2300) },
  { id: 'carpenter', title: 'carpenter', requires: 'trade', minMonthlyPay: dollars(2100), maxMonthlyPay: dollars(3400) },
  { id: 'foreman', title: 'foreman', requires: 'secondary', minMonthlyPay: dollars(2000), maxMonthlyPay: dollars(3000) },
  { id: 'pharmacist', title: 'pharmacist', requires: 'college', minMonthlyPay: dollars(2900), maxMonthlyPay: dollars(4400) },
  { id: 'doctor', title: 'doctor', requires: 'college', minMonthlyPay: dollars(3600), maxMonthlyPay: dollars(6000) },
]

// ---------------------------------------------------------------------------
// Prices
//
// One price level for the whole run — there is no inflation model yet, and
// wages are likewise flat. What matters at this layer is the RATIO of rent
// and living costs to wages, because that is what makes a job offer or a
// move genuinely consequential.
// ---------------------------------------------------------------------------

/** Cheapest conceivable monthly rent, for the least desirable street. */
export const RENT_FLOOR = dollars(160)
/** Added rent per point of neighbourhood desirability (0-1000 scale). */
const RENT_PER_DESIRABILITY_CENTS = 55

/** Monthly cost of keeping an adult fed, clothed and warm. */
export const LIVING_COST_ADULT = dollars(210)
/** Children cost less per head. School is public and free. */
export const LIVING_COST_CHILD = dollars(120)

/**
 * Monthly rent for a neighbourhood. Desirability 150 → ~$242; 950 → ~$682.
 * Against wages of $900-$5,200 a month, a single labourer can afford the
 * bottom of town and a college couple the top, which is the intended shape.
 */
export function rentFor(desirability: number): Money {
  return (RENT_FLOOR + desirability * RENT_PER_DESIRABILITY_CENTS) as Money
}

// ---------------------------------------------------------------------------
// Military service (L4-M3)
//
// All fictional (MILITARY_AND_WAR_FOUNDATION §3): the Republic's forces, not
// any real military. Exposure profiles are CONTENT — static facts about what
// a specialty does — and are the seed of L4-M4's danger vectors: infantry and
// convoy drivers deployed to the same theatre must not have the same war
// (foundation §7). No profile is a danger rating; danger is computed later,
// from the geopolitical state, per the permanent rule.
// ---------------------------------------------------------------------------

export type ServiceBranch = 'land-forces' | 'naval-service' | 'air-guard'

export const BRANCH_NAMES: Readonly<Record<ServiceBranch, string>> = {
  'land-forces': 'the Land Forces',
  'naval-service': 'the Naval Service',
  'air-guard': 'the Air Guard',
}

/**
 * Enlisted ladders, junior to senior, one per branch — modelled on the real
 * US structure (M-GAMEDEPTH owner direction). The fictional-world constraint
 * covers nations, units and insignia, NOT structure: the foundation says
 * "preserve authentic structure, progression, meaning." Officers arrive later.
 *
 * A record stores an INDEX into its branch's ladder; titles resolve through
 * rankTitle(branch, rank). No rank is ever skipped.
 */
export const BRANCH_RANKS: Readonly<Record<ServiceBranch, readonly string[]>> = {
  'land-forces': ['PVT', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG'],
  'naval-service': ['SR', 'SA', 'SN', 'PO3', 'PO2', 'PO1', 'CPO'],
  'air-guard': ['AB', 'Amn', 'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt'],
}

/**
 * Pay grade (E-1..E-8) for each ladder index. Pay reads the GRADE, not the
 * index: SPC and CPL are both E-4, exactly as in life.
 */
export const BRANCH_GRADES: Readonly<Record<ServiceBranch, readonly number[]>> = {
  'land-forces': [1, 2, 3, 4, 4, 5, 6, 7, 8],
  'naval-service': [1, 2, 3, 4, 5, 6, 7],
  'air-guard': [1, 2, 3, 4, 5, 6, 7],
}

/** Monthly pay by pay grade, E-1 first. A pay table, not base+step. */
const PAY_BY_GRADE: readonly number[] = [
  dollars(1_100), dollars(1_180), dollars(1_270), dollars(1_390),
  dollars(1_560), dollars(1_790), dollars(2_060), dollars(2_360),
]

/**
 * The first ladder index that takes a promotion board. Everything below is
 * time-in-grade — near-automatic, the way junior enlisted promotion works.
 */
export const COMPETITIVE_FROM: Readonly<Record<ServiceBranch, number>> = {
  'land-forces': 4, // CPL and above
  'naval-service': 3, // PO3 and above
  'air-guard': 4, // SSgt and above
}

/**
 * Months in grade before the next junior promotion is due, indexed by the
 * CURRENT rank. E-1→E-2 at ~6 months, E-3 by the first year, E-4 around the
 * second or third — no skipping, checked monthly, delayed only by poor
 * performance.
 */
export const JUNIOR_TIG_MONTHS: Readonly<Record<ServiceBranch, readonly number[]>> = {
  'land-forces': [6, 6, 12],
  'naval-service': [6, 6],
  'air-guard': [6, 6, 16],
}

/**
 * Classic's services, as the spec wants them (W1 resistance 3). Assembled
 * from the five tables above rather than retyped, so there is exactly one
 * copy of Classic's ladders and this cannot drift from them.
 */
export const CLASSIC_BRANCHES: readonly ServiceBranchSpec[] = (
  ['land-forces', 'naval-service', 'air-guard'] as const
).map((id) => ({
  id,
  name: BRANCH_NAMES[id],
  ranks: BRANCH_RANKS[id],
  grades: BRANCH_GRADES[id],
  competitiveFrom: COMPETITIVE_FROM[id],
  juniorTigMonths: JUNIOR_TIG_MONTHS[id],
}))

/**
 * How a specialty spends its days — which threats it is exposed to when a
 * theatre turns dangerous. 0-1000 relative weights, NOT probabilities and NOT
 * danger ratings: a convoy weight of 800 means "this job is on the roads",
 * and what the roads are like is the geopolitical state's business.
 */


export const SPECIALTIES: readonly ServiceSpecialty[] = [
  {
    id: 'rifleman', title: 'rifleman', branch: 'land-forces', requires: 'none',
    schoolMonths: 2, qualification: 'expert marksman', boardCutoffOffset: -40,
    exposure: { directCombat: 850, convoy: 300, baseAttack: 300, accident: 300 },
    civilianUnlocks: [],
  },
  {
    id: 'transport', title: 'transport driver', branch: 'land-forces', requires: 'primary',
    schoolMonths: 2, qualification: 'master driver', boardCutoffOffset: -20,
    exposure: { directCombat: 150, convoy: 850, baseAttack: 250, accident: 450 },
    civilianUnlocks: [],
  },
  {
    id: 'mechanic', title: 'field mechanic', branch: 'land-forces', requires: 'primary',
    schoolMonths: 4, qualification: 'master mechanic', boardCutoffOffset: 20,
    exposure: { directCombat: 80, convoy: 200, baseAttack: 350, accident: 400 },
    civilianUnlocks: ['machinist', 'electrician', 'carpenter'],
  },
  {
    id: 'medic', title: 'medic', branch: 'land-forces', requires: 'secondary',
    schoolMonths: 4, qualification: 'field trauma certification', boardCutoffOffset: 30,
    exposure: { directCombat: 350, convoy: 400, baseAttack: 300, accident: 250 },
    civilianUnlocks: ['nurse'],
  },
  {
    id: 'signals', title: 'signals operator', branch: 'air-guard', requires: 'secondary',
    schoolMonths: 4, qualification: 'senior signals rating', boardCutoffOffset: 40,
    exposure: { directCombat: 40, convoy: 100, baseAttack: 450, accident: 200 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'deckhand', title: 'deckhand', branch: 'naval-service', requires: 'none',
    schoolMonths: 2, qualification: 'seamanship rating', boardCutoffOffset: 0,
    exposure: { directCombat: 120, convoy: 60, baseAttack: 500, accident: 550 },
    civilianUnlocks: ['millhand'],
  },
]

export function specialtyById(id: string): ServiceSpecialty {
  const found = SPECIALTIES.find((sp) => sp.id === id)
  if (!found) throw new Error(`Unknown specialty: ${id}`)
  return found
}

/**
 * Monthly pay for a rank: the branch ladder index resolves to a pay GRADE,
 * the grade to the table. All E-1s earn the same whatever their trade — pay
 * tracks rank, exactly as in life. Never a lookup of danger.
 */
export function payForGrade(grade: number): Money {
  return (PAY_BY_GRADE[grade - 1] ?? PAY_BY_GRADE[0] ?? 0) as Money
}

/**
 * Monthly pay for a rank on a BRANCH SPEC's ladder. Takes the spec rather
 * than a branch id: the grades are the preset's, the pay table is the
 * engine's tuning, and the caller has already resolved the branch through
 * branchSpecFor. The first W1 draft kept reading BRANCH_GRADES here, which
 * meant a branch id outside Classic's union crashed the moment anyone was
 * paid — while rendering perfectly (architecture review).
 */
export function servicePayOn(branch: ServiceBranchSpec, rank: number): Money {
  const grades = branch.grades
  const grade = grades[Math.max(0, Math.min(grades.length - 1, rank))] ?? 1
  return payForGrade(grade)
}

/** Standard enlistment term, months. */
export const SERVICE_TERM_MONTHS = 48

/**
 * Board cutoffs (M-SPECOPS): promotion runs on POINTS — performance, the
 * fitness test, badges, decorations, seniority — against a per-trade cutoff.
 * Multiple roads to the same board, so a middling month is not a life
 * sentence: go to a school, hold a rating, keep the body ready.
 */
export const BOARD_CUTOFF_BASE = 550
export const BOARD_CUTOFF_STEP = 90
export const POINTS_PER_BADGE = 40
export const POINTS_PER_CAMPAIGN = 25
export const POINTS_PER_GOOD_CONDUCT = 20
export const POINTS_PER_WOUND_RECOGNITION = 15
export const POINTS_PER_COMBAT_ACTION = 15
export const POINTS_PER_VALOR = 30
export const POINTS_PER_MERITORIOUS = 30
export const POINTS_PER_LONG_SERVICE = 20
/** The awards bucket is CAPPED, as in the real points model — service is
 *  recognized, but a rack cannot buy a board on its own (review: without
 *  this, the points-optimal life is collecting wounds). */
export const MAX_DECORATION_POINTS = 125
export const MAX_SENIORITY_POINTS = 100
export const MAX_FITNESS_POINTS = 300

// ---------------------------------------------------------------------------
// Special schools and special units (M-SPECOPS)
//
// School TITLES are generic capability names (jump school, sniper school —
// every military on earth has these); UNIT names are fictional per the
// foundation §3, with the authentic structure kept: badge gates, selection
// you can fail, a tier above the tier, duty pay, and a sharper war.
// ---------------------------------------------------------------------------


export const SERVICE_SCHOOLS: readonly ServiceSchool[] = [
  {
    id: 'jump-school', title: 'Jump School', branches: ['land-forces'], specialtyIds: [],
    minRank: 1, minPerformance: 450, badge: 'parachutist', performanceBoost: 40,
  },
  {
    id: 'air-assault', title: 'the Air-Mobile Assault Course', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 1, minPerformance: 450, badge: 'air assault', performanceBoost: 40,
  },
  {
    id: 'sniper-school', title: 'Sniper School', branches: ['land-forces'], specialtyIds: ['rifleman'],
    minRank: 2, minPerformance: 600, badge: 'sniper qualified', performanceBoost: 60,
  },
  {
    id: 'combat-diver', title: 'the Combat Diver Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 2, minPerformance: 550, badge: 'combat diver', performanceBoost: 50,
  },
  {
    id: 'leaders-course', title: 'the Junior Leaders Course', branches: [], specialtyIds: [],
    minRank: 4, minPerformance: 500, badge: 'small-unit leader', performanceBoost: 50,
  },
]

export function schoolById(id: string): ServiceSchool | undefined {
  return SERVICE_SCHOOLS.find((s) => s.id === id)
}


export const SPECIAL_UNITS: readonly SpecialUnit[] = [
  {
    id: 'pathfinders', name: 'the Pathfinder Battalion', tier: 1,
    branches: ['land-forces'], minRank: 2, minPerformance: 550,
    requiredBadges: ['parachutist'], feederUnitId: null,
    selectionDenominator: 500, dutyPay: dollars(150), exposureMultiplier: 1250,
  },
  {
    id: 'task-unit-ember', name: 'Task Unit Ember', tier: 2,
    branches: ['land-forces'], minRank: 5, minPerformance: 720,
    requiredBadges: ['parachutist'], feederUnitId: 'pathfinders',
    selectionDenominator: 900, dutyPay: dollars(400), exposureMultiplier: 1500,
  },
]

export function specialUnitById(id: string): SpecialUnit | undefined {
  return SPECIAL_UNITS.find((u) => u.id === id)
}

/**
 * Up or out (M-SERVICE-PLAY): months in the same grade before the service
 * separates a passed-over member at term's end. Six years in grade without
 * advancement ends a career — honorably, but it ends.
 */
export const HIGH_YEAR_TENURE_TIG = 72

/** Below this service-connected disability, no pension (L4-M5). */
export const PENSION_THRESHOLD = 200
/** Monthly cents per point of service-connected disability. */
export const PENSION_CENTS_PER_POINT = 120

export const BASE_NAMES: readonly string[] = ['Fort Calder', 'Redharbor Station']

/**
 * The town's news station (owner-named). Every item in the News tab is
 * something the simulation actually produced — wars, crimes, recruiting
 * seasons, a death in uniform — and this is the masthead they run under,
 * so the feed reads as a broadcast rather than a list of facts.
 */
export const NEWS_STATION = 'WCJC'

// ---------------------------------------------------------------------------
// Offences (C2, owner direction: "a list of crimes... sentences based on real
// USA crime codes and penalties")
//
// GRADING follows the pattern common across US state codes — three grades of
// misdemeanor and lettered felony classes, each with a statutory ceiling:
//
//   Class C misdemeanor   up to 30 days
//   Class B misdemeanor   up to 6 months
//   Class A misdemeanor   up to 1 year
//   Class D felony        1-5 years
//   Class C felony        2-10 years
//   Class B felony        5-20 years
//
// Every state grades and names these differently and real sentencing turns on
// guidelines, priors and discretion this model does not have. These are the
// SHAPE of American penalties, not a citation — and the courthouse here is
// the Republic's, which is fictional like everything else in the world.
//
// The offences themselves are named and graded only. Nothing here describes
// how anything is done: the simulation models consequences, and a life sim
// has no business being a manual.
// ---------------------------------------------------------------------------

export type OffenceGrade =
  | 'class-c-misdemeanor'
  | 'class-b-misdemeanor'
  | 'class-a-misdemeanor'
  | 'class-d-felony'
  | 'class-c-felony'
  | 'class-b-felony'

export const GRADE_TITLES: Readonly<Record<OffenceGrade, string>> = {
  'class-c-misdemeanor': 'Class C misdemeanor',
  'class-b-misdemeanor': 'Class B misdemeanor',
  'class-a-misdemeanor': 'Class A misdemeanor',
  'class-d-felony': 'Class D felony',
  'class-c-felony': 'Class C felony',
  'class-b-felony': 'Class B felony',
}

export interface Offence {
  readonly id: string
  readonly title: string
  readonly grade: OffenceGrade
  /** Custodial range in months on conviction, within the grade's ceiling. */
  readonly minMonths: number
  readonly maxMonths: number
  /** The fine when the court's answer is money rather than custody, in cents. */
  readonly fine: number
  /** Per 1000: the chance the offence is cleared and an arrest follows. */
  readonly clearance: number
  /** What it puts in a pocket, in cents. Zero where nothing is taken. */
  readonly gainMin: number
  readonly gainMax: number
  /** Some offences are only open to someone with something to abuse. */
  readonly needsJob?: boolean
  /** True where a household is robbed and its money actually moves. */
  readonly takesFromHousehold?: boolean
}

/**
 * What a person can be charged with here. Twenty-two offences, weighted
 * toward the ordinary end — most crime is small, and a catalogue that was
 * all felonies would be a fantasy of crime rather than a model of it.
 */
export const OFFENCES: readonly Offence[] = [
  // --- Misdemeanors ------------------------------------------------------
  { id: 'disorderly-conduct', title: 'disorderly conduct', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 15_000, clearance: 620, gainMin: 0, gainMax: 0 },
  { id: 'public-intoxication', title: 'public intoxication', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 12_000, clearance: 660, gainMin: 0, gainMax: 0 },
  { id: 'trespassing', title: 'criminal trespass', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 3, fine: 20_000, clearance: 520, gainMin: 0, gainMax: 0 },
  { id: 'vandalism', title: 'criminal mischief', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 4, fine: 30_000, clearance: 400, gainMin: 0, gainMax: 0 },
  { id: 'reckless-driving', title: 'reckless driving', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 3, fine: 25_000, clearance: 540, gainMin: 0, gainMax: 0 },
  { id: 'shoplifting', title: 'petty theft', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 6, fine: 25_000, clearance: 480, gainMin: 3_000, gainMax: 18_000 },
  { id: 'bad-check', title: 'passing a bad check', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 9, fine: 35_000, clearance: 560, gainMin: 8_000, gainMax: 40_000 },
  { id: 'simple-assault', title: 'simple assault', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 40_000, clearance: 640, gainMin: 0, gainMax: 0 },
  { id: 'dui', title: 'driving under the influence', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 80_000, clearance: 600, gainMin: 0, gainMax: 0 },
  { id: 'drug-possession', title: 'possession of a controlled substance', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 50_000, clearance: 520, gainMin: 0, gainMax: 0 },
  { id: 'resisting-arrest', title: 'resisting arrest', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 40_000, clearance: 900, gainMin: 0, gainMax: 0 },
  { id: 'petty-fraud', title: 'petty fraud', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 45_000, clearance: 500, gainMin: 10_000, gainMax: 50_000 },

  // --- Felonies ----------------------------------------------------------
  { id: 'forgery', title: 'forgery', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 100_000, clearance: 480, gainMin: 30_000, gainMax: 120_000 },
  { id: 'tax-evasion', title: 'tax evasion', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 150_000, clearance: 420, gainMin: 40_000, gainMax: 200_000, needsJob: true },
  { id: 'grand-theft', title: 'grand theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 120_000, clearance: 440, gainMin: 60_000, gainMax: 250_000, takesFromHousehold: true },
  { id: 'auto-theft', title: 'motor vehicle theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 130_000, clearance: 520, gainMin: 80_000, gainMax: 300_000 },
  { id: 'embezzlement', title: 'embezzlement', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 200_000, clearance: 460, gainMin: 100_000, gainMax: 400_000, needsJob: true },
  { id: 'identity-theft', title: 'identity theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 150_000, clearance: 400, gainMin: 60_000, gainMax: 250_000 },
  { id: 'burglary', title: 'residential burglary', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 460, gainMin: 80_000, gainMax: 350_000, takesFromHousehold: true },
  { id: 'robbery', title: 'robbery', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 620, gainMin: 40_000, gainMax: 200_000, takesFromHousehold: true },
  { id: 'aggravated-assault', title: 'aggravated assault', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 700, gainMin: 0, gainMax: 0 },
  { id: 'arson', title: 'arson', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 560, gainMin: 0, gainMax: 0 },
]

export function offenceById(id: string): Offence | undefined {
  return OFFENCES.find((offence) => offence.id === id)
}

/** Felonies close doors misdemeanors do not. */
export function isFelony(grade: OffenceGrade): boolean {
  return grade.endsWith('felony')
}

/** How much schooling a level represents. Used to test whether a person qualifies. */
const EDUCATION_RANK: Readonly<Record<EducationLevel, number>> = {
  none: 0,
  primary: 1,
  secondary: 2,
  trade: 3,
  college: 4,
}

export function educationRank(level: EducationLevel): number {
  return EDUCATION_RANK[level]
}

export function meetsRequirement(has: EducationLevel, needs: EducationLevel): boolean {
  return educationRank(has) >= educationRank(needs)
}

export function occupationById(id: string): Occupation {
  const found = OCCUPATIONS.find((o) => o.id === id)
  if (!found) throw new Error(`Unknown occupation: ${id}`)
  return found
}

/**
 * Midpoint of an occupation's pay band, for comparing offers.
 * Floors, so the result is always whole cents — money never becomes fractional.
 */
export function typicalPay(occupation: Occupation): Money {
  return Math.floor((occupation.minMonthlyPay + occupation.maxMonthlyPay) / 2) as Money
}

/**
 * Crime & justice (C1). Convictions older than this stop GATING hiring and
 * enlistment — they never leave the record; gates read recency, history
 * reads everything. Lives here, in a leaf module, so crime.ts and
 * service.ts read the same number: crime.ts imports service.ts directly
 * (for discharge), so service.ts importing crime's copy back would add a
 * direct two-module cycle.
 */
export const RECORD_GATE_YEARS = 10
