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
import type { BaseSpec, NationSpec, ServiceBranchSpec } from './types.js'
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
// CLASSIC's nations, all invented. Since ADR-0021 a preset MAY name real
// countries (american-heartland does), so the rule is no longer "no real
// foreign name on a record" — it is: NO REAL CONFLICT, EVER, and no real
// decoration's name. 'Ashkelon' was here until L4-M5's review caught it — a
// real city and a real conflict SITE, about to be minted onto campaign
// medals. That instinct was right and still is: a real place-name that
// carries a real battle with it is the thing to keep out, which is also why
// the campaign decoration stopped being named after its enemy at v42.
/**
 * The homeland's name, Classic's. It carries its own article because the
 * sentences that render it do not know whether the preset's homeland is
 * "the Republic" or "Ruritania" (W1).
 */
export const HOMELAND_NAME = 'the Republic'

export const NATION_NAMES: readonly NationSpec[] = [
  // No alignment: Classic has no opinion about its own invented countries,
  // so the simulation decides where every pair starts, as it always has.
  { name: 'Varenia', alignment: null, combatRating: null },
  { name: 'Costmara', alignment: null, combatRating: null },
  { name: 'Belgrave', alignment: null, combatRating: null },
  { name: 'Tyrene', alignment: null, combatRating: null },
  { name: 'Osmark', alignment: null, combatRating: null },
  { name: 'Halvia', alignment: null, combatRating: null },
  { name: 'Rondesia', alignment: null, combatRating: null },
  { name: 'Quillar', alignment: null, combatRating: null },
  { name: 'Verros', alignment: null, combatRating: null },
  { name: 'Nortavia', alignment: null, combatRating: null },
  { name: 'Sundermark', alignment: null, combatRating: null },
  { name: 'Veskarn', alignment: null, combatRating: null },
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
/**
 * The town's trades, priced on a REAL ANNUAL SCALE (M-ECON §7).
 *
 * These were monthly figures that read as a 1950s pay packet — a doctor on
 * $3,600 a month against a $500 rent. Everything downstream was calibrated
 * against that, so the whole ladder moves together here and the rents and
 * living costs below move with it.
 *
 * Stored MONTHLY in integer cents, because that is how the world pays and
 * accounts (ADR-0008). The annual figure in each comment is what the screen
 * shows — `annualPay` is the one place that multiplication happens.
 */
export const OCCUPATIONS: readonly Occupation[] = [
  // Working class — $30k to $50k.
  { id: 'labourer', title: 'labourer', requires: 'none', minMonthlyPay: dollars(2_833), maxMonthlyPay: dollars(4_833) },
  { id: 'cook', title: 'cook', requires: 'none', minMonthlyPay: dollars(2_333), maxMonthlyPay: dollars(3_833) },
  { id: 'shop-clerk', title: 'shop clerk', requires: 'primary', minMonthlyPay: dollars(2_333), maxMonthlyPay: dollars(3_667) },
  { id: 'millhand', title: 'mill hand', requires: 'primary', minMonthlyPay: dollars(3_000), maxMonthlyPay: dollars(5_000) },
  // Lower-middle — $50k to $70k.
  { id: 'clerk', title: 'office clerk', requires: 'secondary', minMonthlyPay: dollars(2_833), maxMonthlyPay: dollars(4_500) },
  { id: 'bookkeeper', title: 'bookkeeper', requires: 'secondary', minMonthlyPay: dollars(3_333), maxMonthlyPay: dollars(5_167) },
  { id: 'constable', title: 'constable', requires: 'secondary', minMonthlyPay: dollars(4_583), maxMonthlyPay: dollars(7_500) },
  { id: 'carpenter', title: 'carpenter', requires: 'trade', minMonthlyPay: dollars(4_000), maxMonthlyPay: dollars(7_000) },
  { id: 'machinist', title: 'machinist', requires: 'trade', minMonthlyPay: dollars(3_500), maxMonthlyPay: dollars(5_500) },
  { id: 'nurse', title: 'nurse', requires: 'trade', minMonthlyPay: dollars(6_500), maxMonthlyPay: dollars(10_000) },
  // Middle — $70k to $100k.
  { id: 'foreman', title: 'foreman', requires: 'secondary', minMonthlyPay: dollars(4_583), maxMonthlyPay: dollars(7_167) },
  { id: 'electrician', title: 'electrician', requires: 'trade', minMonthlyPay: dollars(4_000), maxMonthlyPay: dollars(7_000) },
  { id: 'teacher', title: 'teacher', requires: 'college', minMonthlyPay: dollars(4_833), maxMonthlyPay: dollars(8_167) },
  // Upper-middle — $100k to $150k.
  { id: 'accountant', title: 'accountant', requires: 'college', minMonthlyPay: dollars(5_167), maxMonthlyPay: dollars(8_833) },
  { id: 'pharmacist', title: 'pharmacist', requires: 'college', minMonthlyPay: dollars(9_583), maxMonthlyPay: dollars(13_333) },
  { id: 'engineer', title: 'engineer', requires: 'college', minMonthlyPay: dollars(6_333), maxMonthlyPay: dollars(10_500) },
  // Professional — $150k and up.
  { id: 'doctor', title: 'doctor', requires: 'college', minMonthlyPay: dollars(17_083), maxMonthlyPay: dollars(29_167) },

  // --- M-CAREER §1. THE RUNGS ABOVE, AND THE ONES BELOW ------------------
  //
  // Civilian work used to be seventeen jobs and no ladder. These are the
  // positions those jobs lead TO and come FROM, so a career is a climb
  // rather than a wage. Every one is an ordinary occupation — hiring, pay,
  // tax and the ledger do not know a rung from a job, which is the point.
  //
  // Priced on the same real annual scale as everything above (M-ECON §7),
  // each rung a real step up from the one below it.
  { id: 'apprentice', title: 'apprentice', requires: 'trade', minMonthlyPay: dollars(2_750), maxMonthlyPay: dollars(4_167) },
  { id: 'master-tradesman', title: 'master tradesman', requires: 'trade', minMonthlyPay: dollars(4_833), maxMonthlyPay: dollars(8_000) },
  { id: 'site-foreman', title: 'site foreman', requires: 'trade', minMonthlyPay: dollars(7_000), maxMonthlyPay: dollars(11_000) },
  { id: 'contractor', title: 'contractor', requires: 'trade', minMonthlyPay: dollars(7_917), maxMonthlyPay: dollars(14_583) },

  { id: 'shift-lead', title: 'shift lead', requires: 'primary', minMonthlyPay: dollars(3_000), maxMonthlyPay: dollars(4_667) },
  { id: 'assistant-manager', title: 'assistant manager', requires: 'primary', minMonthlyPay: dollars(3_500), maxMonthlyPay: dollars(5_500) },
  { id: 'store-manager', title: 'store manager', requires: 'primary', minMonthlyPay: dollars(4_167), maxMonthlyPay: dollars(6_667) },
  { id: 'district-manager', title: 'district manager', requires: 'secondary', minMonthlyPay: dollars(5_667), maxMonthlyPay: dollars(9_000) },

  { id: 'associate', title: 'associate', requires: 'secondary', minMonthlyPay: dollars(4_167), maxMonthlyPay: dollars(6_500) },
  { id: 'senior-associate', title: 'senior associate', requires: 'secondary', minMonthlyPay: dollars(5_500), maxMonthlyPay: dollars(9_000) },
  { id: 'manager', title: 'manager', requires: 'secondary', minMonthlyPay: dollars(6_500), maxMonthlyPay: dollars(10_833) },
  { id: 'director', title: 'director', requires: 'college', minMonthlyPay: dollars(9_833), maxMonthlyPay: dollars(14_833) },
  { id: 'vice-president', title: 'vice president', requires: 'college', minMonthlyPay: dollars(12_917), maxMonthlyPay: dollars(19_583) },
  { id: 'executive', title: 'executive', requires: 'college', minMonthlyPay: dollars(15_417), maxMonthlyPay: dollars(26_667) },

  { id: 'lead-hand', title: 'lead hand', requires: 'none', minMonthlyPay: dollars(3_667), maxMonthlyPay: dollars(5_667) },
  { id: 'superintendent', title: 'superintendent', requires: 'secondary', minMonthlyPay: dollars(7_333), maxMonthlyPay: dollars(11_500) },
  { id: 'plant-manager', title: 'plant manager', requires: 'secondary', minMonthlyPay: dollars(9_000), maxMonthlyPay: dollars(14_000) },

  { id: 'aide', title: "nurse's aide", requires: 'none', minMonthlyPay: dollars(2_667), maxMonthlyPay: dollars(4_167) },
  { id: 'charge-nurse', title: 'charge nurse', requires: 'trade', minMonthlyPay: dollars(7_333), maxMonthlyPay: dollars(10_667) },
  { id: 'nurse-manager', title: 'nurse manager', requires: 'trade', minMonthlyPay: dollars(8_167), maxMonthlyPay: dollars(12_083) },

  { id: 'resident', title: 'resident physician', requires: 'college', minMonthlyPay: dollars(5_000), maxMonthlyPay: dollars(6_333) },
  { id: 'chief-of-medicine', title: 'chief of medicine', requires: 'college', minMonthlyPay: dollars(20_833), maxMonthlyPay: dollars(31_667) },

  { id: 'department-head', title: 'department head', requires: 'college', minMonthlyPay: dollars(5_667), maxMonthlyPay: dollars(8_750) },
  { id: 'assistant-principal', title: 'assistant principal', requires: 'college', minMonthlyPay: dollars(6_500), maxMonthlyPay: dollars(9_333) },
  { id: 'principal', title: 'principal', requires: 'college', minMonthlyPay: dollars(7_917), maxMonthlyPay: dollars(11_500) },

  { id: 'sergeant', title: 'police sergeant', requires: 'secondary', minMonthlyPay: dollars(6_500), maxMonthlyPay: dollars(10_500) },
  { id: 'police-chief', title: 'chief of police', requires: 'secondary', minMonthlyPay: dollars(8_333), maxMonthlyPay: dollars(12_667) },

  { id: 'senior-accountant', title: 'senior accountant', requires: 'college', minMonthlyPay: dollars(6_500), maxMonthlyPay: dollars(10_167) },
  { id: 'partner', title: 'partner', requires: 'college', minMonthlyPay: dollars(11_667), maxMonthlyPay: dollars(19_167) },
]

/**
 * SHOW PAY YEARLY, PAY IT MONTHLY (M-ECON §7). One helper, so no screen
 * invents its own multiplication and no accounting ever sees a yearly
 * figure.
 */
export function annualPay(monthly: Money): Money {
  return (monthly * 12) as Money
}

// ---------------------------------------------------------------------------
// Prices
//
// One price level for the whole run — there is no inflation model yet, and
// wages are likewise flat. What matters at this layer is the RATIO of rent
// and living costs to wages, because that is what makes a job offer or a
// move genuinely consequential.
// ---------------------------------------------------------------------------

/** Cheapest conceivable monthly rent, for the least desirable street. */
export const RENT_FLOOR = dollars(950)
/** Added rent per point of neighbourhood desirability (0-1000 scale). */
const RENT_PER_DESIRABILITY_CENTS = 105

/** Monthly cost of keeping an adult fed, clothed and warm. */
export const LIVING_COST_ADULT = dollars(950)
/** Children cost less per head. School is public and free. */
export const LIVING_COST_CHILD = dollars(520)

/**
 * Monthly rent for a neighbourhood. Desirability 150 → ~$1,108; 950 → ~$1,948.
 *
 * Scaled with the salary ladder (M-ECON §7). What matters is the RATIO: a
 * labourer on $2,500 a month can still take the bottom of town and a
 * two-earner college household the top, which is the shape the moving and
 * arrears systems were built against.
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
 * The same ranks, SPELLED OUT — for the one document that is not a form.
 *
 * A certificate of retirement reading "SSG Debra Spencer" looks like
 * paperwork, which is exactly what it is not: it is the thanks at the end
 * of twenty years, and it says the whole rank the way it would be read
 * aloud. Everywhere else keeps the abbreviation, because everywhere else IS
 * a form.
 *
 * Same order and length as BRANCH_RANKS; a preset without one falls back to
 * the abbreviation rather than inventing a title for somebody's rank.
 */
export const BRANCH_RANKS_SPELLED: Readonly<Record<ServiceBranch, readonly string[]>> = {
  'land-forces': [
    'Private', 'Private Second Class', 'Private First Class', 'Specialist', 'Corporal',
    'Sergeant', 'Staff Sergeant', 'Sergeant First Class', 'Master Sergeant',
  ],
  'naval-service': [
    'Seaman Recruit', 'Seaman Apprentice', 'Seaman', 'Petty Officer Third Class',
    'Petty Officer Second Class', 'Petty Officer First Class', 'Chief Petty Officer',
  ],
  'air-guard': [
    'Airman Basic', 'Airman', 'Airman First Class', 'Senior Airman', 'Staff Sergeant',
    'Technical Sergeant', 'Master Sergeant',
  ],
}

export const BRANCH_OFFICER_RANKS_SPELLED: Readonly<Record<ServiceBranch, readonly string[]>> = {
  'land-forces': [
    'Second Lieutenant', 'First Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel',
  ],
  'naval-service': [
    'Ensign', 'Lieutenant Junior Grade', 'Lieutenant', 'Lieutenant Commander', 'Commander',
    'Captain',
  ],
  'air-guard': [
    'Second Lieutenant', 'First Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel',
  ],
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

/**
 * THE OFFICER LADDER (owner, playing: "we have no officer roles and stuff
 * for the military even tho we made stuff for those ranks and we even have
 * a college pipeline").
 *
 * He is right, and it was a hole rather than a decision: the ladders above
 * are enlisted from end to end — private to master sergeant, E-1 to E-8 —
 * so a person with a degree joined as a private and the aviator trade,
 * which REQUIRES a degree, put college graduates in the ranks with
 * everybody else. Every army this is modelled on commissions them.
 *
 * A separate ladder, because that is what it is: an officer is not a senior
 * enlisted person, they enter somewhere else and go somewhere else. The
 * grades are O-1 upward and the pay reads them from their own table.
 */
export const BRANCH_OFFICER_RANKS: Readonly<Record<ServiceBranch, readonly string[]>> = {
  'land-forces': ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL'],
  'naval-service': ['ENS', 'LTJG', 'LT', 'LCDR', 'CDR', 'CAPT'],
  'air-guard': ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col'],
}

/** O-grade for each officer ladder index. */
export const BRANCH_OFFICER_GRADES: Readonly<Record<ServiceBranch, readonly number[]>> = {
  'land-forces': [1, 2, 3, 4, 5, 6],
  'naval-service': [1, 2, 3, 4, 5, 6],
  'air-guard': [1, 2, 3, 4, 5, 6],
}

/**
 * Officer pay by O-grade, in cents a month.
 *
 * A new lieutenant out-earns a sergeant and is out-earned by a first
 * sergeant's years — the ladders overlap, which is true and is what stops
 * a commission being a straight upgrade.
 */
const OFFICER_PAY_BY_GRADE: readonly Money[] = [
  // REPRICED with the enlisted table, against the same real compensation
  // figures, and holding the SAME SHAPE the old comment described - because
  // that shape turns out to be what the real pay charts do.
  //
  // The ladders overlap. A new lieutenant out-earns a sergeant and is
  // out-earned by a staff sergeant and by every senior NCO above them; the
  // officer table passes the top of the enlisted one at CAPTAIN. That is
  // both this world's rule and the actual arrangement, and a test holds it.
  dollars(4_800), // O-1 — over an E-5 sergeant, under an E-6
  dollars(5_600), // O-2 — under an E-7
  dollars(6_900), // O-3 — now past the top enlisted grade
  dollars(8_300), // O-4
  dollars(9_800), // O-5
  dollars(11_800), // O-6
]

export function officerPayOn(branch: ServiceBranchSpec, rank: number): Money {
  const grades = branch.officerGrades ?? []
  if (grades.length === 0) return dollars(1_700)
  const grade = grades[Math.max(0, Math.min(grades.length - 1, rank))] ?? 1
  return OFFICER_PAY_BY_GRADE[Math.max(0, Math.min(OFFICER_PAY_BY_GRADE.length - 1, grade - 1))] ?? dollars(1_700)
}

/** Monthly pay by pay grade, E-1 first. A pay table, not base+step. */
const PAY_BY_GRADE: readonly number[] = [
  // REPRICED against real United States military compensation (owner, on
  // the civilian reprice: "did you fix officer and enlisted pay?" - I had
  // not). The old table topped out at $2,360 a month, so a master sergeant
  // with twenty years earned less than a shop clerk and a full colonel
  // earned less than a teacher.
  //
  // These are BASIC PAY PLUS ALLOWANCES, not basic pay alone. The real
  // thing pays a soldier partly in an untaxed housing and subsistence
  // allowance, and this engine has one `monthlyPay` per person that the
  // ledger taxes like a wage - so the honest single number is regular
  // military compensation rather than the basic-pay column, which on its
  // own would understate a serving life by about a third.
  dollars(2_600), // E-1
  dollars(2_900), // E-2
  dollars(3_200), // E-3
  dollars(3_600), // E-4
  dollars(4_300), // E-5
  dollars(5_000), // E-6
  dollars(5_900), // E-7
  dollars(6_800), // E-8
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
  officerRanks: BRANCH_OFFICER_RANKS[id],
  officerGrades: BRANCH_OFFICER_GRADES[id],
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
    id: 'rifleman', title: 'rifleman', officerTitle: 'infantry officer', branch: 'land-forces', requires: 'none',
    schoolMonths: 2, qualification: 'expert marksman', boardCutoffOffset: -40,
    exposure: { directCombat: 850, convoy: 300, baseAttack: 300, accident: 300 },
    civilianUnlocks: [],
  },
  {
    id: 'transport', title: 'transport driver', officerTitle: 'transport officer', branch: 'land-forces', requires: 'primary',
    schoolMonths: 2, qualification: 'master driver', boardCutoffOffset: -20,
    exposure: { directCombat: 150, convoy: 850, baseAttack: 250, accident: 450 },
    civilianUnlocks: [],
  },
  {
    id: 'mechanic', title: 'field mechanic', officerTitle: 'maintenance officer', branch: 'land-forces', requires: 'primary',
    schoolMonths: 4, qualification: 'master mechanic', boardCutoffOffset: 20,
    exposure: { directCombat: 80, convoy: 200, baseAttack: 350, accident: 400 },
    civilianUnlocks: ['machinist', 'electrician', 'carpenter'],
  },
  {
    id: 'medic', title: 'medic', officerTitle: 'medical service officer', branch: 'land-forces', requires: 'secondary',
    schoolMonths: 4, qualification: 'field trauma certification', boardCutoffOffset: 30,
    exposure: { directCombat: 350, convoy: 400, baseAttack: 300, accident: 250 },
    civilianUnlocks: ['nurse'],
  },
  {
    // AVIATION (ADR-0026). The exposure profile is the honest shape of the
    // job rather than a flat "dangerous": an aircraft is rarely in a
    // firefight and is never in a convoy, but the machine itself is the
    // hazard — accidents are the aviator's real killer, in this simulation
    // as in the world.
    id: 'aviator', title: 'aviator', officerTitle: 'aviator', branch: 'air-guard', requires: 'college',
    schoolMonths: 12, qualification: 'aviator wings', boardCutoffOffset: 60,
    exposure: { directCombat: 220, convoy: 0, baseAttack: 300, accident: 700 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'aircrew', title: 'aircrew', officerTitle: 'air operations officer', branch: 'air-guard', requires: 'secondary',
    schoolMonths: 6, qualification: 'aircrew wings', boardCutoffOffset: 40,
    exposure: { directCombat: 260, convoy: 0, baseAttack: 320, accident: 620 },
    civilianUnlocks: ['machinist'],
  },
  {
    id: 'signals', title: 'signals operator', officerTitle: 'signals officer', branch: 'air-guard', requires: 'secondary',
    schoolMonths: 4, qualification: 'senior signals rating', boardCutoffOffset: 40,
    exposure: { directCombat: 40, convoy: 100, baseAttack: 450, accident: 200 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'deckhand', title: 'deckhand', officerTitle: 'deck officer', branch: 'naval-service', requires: 'none',
    schoolMonths: 2, qualification: 'seamanship rating', boardCutoffOffset: 0,
    exposure: { directCombat: 120, convoy: 60, baseAttack: 500, accident: 550 },
    civilianUnlocks: ['millhand'],
  },
]

/**
 * What to call this trade for the person holding it. One resolver, so the
 * contract, the orders, the record and the menu cannot disagree about what
 * somebody's job is called.
 */
export function specialtyTitleFor(specialty: ServiceSpecialty, commissioned: boolean): string {
  return commissioned ? (specialty.officerTitle ?? specialty.title) : specialty.title
}

/**
 * The trade as a DOCUMENT writes it — "Rifleman", not "rifleman".
 *
 * The catalogue stores lowercase because prose reads "enlisted as a
 * rifleman", which is right in a sentence and wrong in a form field. A
 * DD-214 that says "PRIMARY SPECIALTY: rifleman" looks like a bug on the
 * one page a player keeps.
 */
export function specialtyTitleCased(specialty: ServiceSpecialty, commissioned: boolean): string {
  const title = specialtyTitleFor(specialty, commissioned)
  return title.replace(/(^|\s)(\w)/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
}

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
// The awards pack's ribbons. All inside MAX_DECORATION_POINTS, which is what
// stops a rack of ribbons out-weighing the work: the cap is the reason a
// board still reads performance first.
export const POINTS_PER_COMBAT_MERIT = 25
export const POINTS_PER_COMMENDATION = 15
export const POINTS_PER_ACHIEVEMENT = 10
export const POINTS_PER_NCO_DEVELOPMENT = 10
export const POINTS_PER_NATIONAL_DEFENSE = 5
export const POINTS_PER_OVERSEAS = 5
export const POINTS_PER_SERVICE_RIBBON = 3
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


/**
 * The school houses. REAL NAMES BY OWNER OVERRIDE (ADR-0023, 2026-08-02):
 * a school is a course of instruction and naming one asserts nothing about
 * anybody. A REVIEWER MAY NOT RENAME THESE BACK — two reviews in this repo
 * have already renamed schools by reflex for being close to real ones, and
 * the ADR exists to stop a third.
 *
 * Units are the other half of that ruling and stay fictional, permanently.
 *
 * Every school runs on class cycles: a course length, a cadence between
 * class start dates, and seats. The dates sit on a fixed grid off tick 0,
 * so "the next class starts in four months" is the same fact in every
 * replay of a world.
 */
export const SERVICE_SCHOOLS: readonly ServiceSchool[] = [
  {
    id: 'jump-school', title: 'Airborne School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 1, minPerformance: 450, badge: 'parachutist', performanceBoost: 40,
    courseMonths: 1, classCadenceMonths: 2, seatsPerClass: 4,
  },
  {
    id: 'flight-school', title: 'Flight School', branches: ['air-guard'], specialtyIds: ['aviator'],
    minRank: 1, minPerformance: 500, badge: 'senior aviator', performanceBoost: 60,
    courseMonths: 9, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'air-assault', title: 'Air Assault School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 1, minPerformance: 450, badge: 'air assault', performanceBoost: 40,
    courseMonths: 1, classCadenceMonths: 3, seatsPerClass: 4,
  },
  {
    id: 'sniper-school', title: 'Sniper School', branches: ['land-forces'], specialtyIds: ['rifleman'],
    minRank: 2, minPerformance: 600, badge: 'sniper qualified', performanceBoost: 60,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'pathfinder-school', title: 'Pathfinder School', branches: ['land-forces'], specialtyIds: [],
    minRank: 2, minPerformance: 550, badge: 'pathfinder', performanceBoost: 50,
    courseMonths: 1, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'freefall', title: 'Military Freefall School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 3, minPerformance: 620, badge: 'military freefall', performanceBoost: 55,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'sere', title: 'SERE School', branches: [], specialtyIds: [],
    minRank: 2, minPerformance: 520, badge: 'SERE qualified', performanceBoost: 45,
    courseMonths: 1, classCadenceMonths: 4, seatsPerClass: 3,
  },
  {
    id: 'combat-diver', title: 'the Combat Diver Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 2, minPerformance: 550, badge: 'combat diver', performanceBoost: 50,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'eod', title: 'EOD School', branches: [], specialtyIds: [],
    minRank: 2, minPerformance: 620, badge: 'explosive ordnance disposal', performanceBoost: 60,
    courseMonths: 6, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'combat-medic', title: 'the Combat Medic Course', branches: [], specialtyIds: ['medic'],
    minRank: 2, minPerformance: 560, badge: 'combat medic', performanceBoost: 55,
    courseMonths: 4, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'jumpmaster', title: 'Jumpmaster School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 4, minPerformance: 620, badge: 'jumpmaster', performanceBoost: 55,
    courseMonths: 1, classCadenceMonths: 6, seatsPerClass: 2,
  },
  {
    id: 'mountain-warfare', title: 'the Mountain Warfare Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 2, minPerformance: 540, badge: 'mountain warfare', performanceBoost: 45,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 3,
  },
  {
    id: 'ranger-school', title: 'Ranger School', branches: ['land-forces'], specialtyIds: [],
    minRank: 3, minPerformance: 650, badge: 'ranger', performanceBoost: 70,
    courseMonths: 2, classCadenceMonths: 4, seatsPerClass: 2,
  },
  {
    id: 'leaders-course', title: 'the Junior Leaders Course', branches: [], specialtyIds: [],
    minRank: 4, minPerformance: 500, badge: 'small-unit leader', performanceBoost: 50,
    courseMonths: 1, classCadenceMonths: 4, seatsPerClass: 3,
  },
  {
    id: 'sf-qualification', title: 'the Special Forces Qualification Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 4, minPerformance: 700, badge: 'special forces', performanceBoost: 80,
    courseMonths: 12, classCadenceMonths: 12, seatsPerClass: 1,
  },
]

export function schoolById(id: string): ServiceSchool | undefined {
  return SERVICE_SCHOOLS.find((s) => s.id === id)
}


/**
 * The special units. FICTIONAL NAMES, permanently, in every preset — the
 * half of the owner's override that did not move (ADR-0023, ADR-0024): a
 * school is a course of instruction, a decoration is a thing a government
 * awards, but a unit is a body of living people with a record of its own
 * dead.
 *
 * EVERY BRANCH GETS AN ENTRY UNIT (owner's combat plan §1b), so the Drop a
 * Packet tab is never empty for anybody. The chain is real: an entry unit
 * asks for the badge its road is paved with, the tier above draws from the
 * unit below, and the one at the top draws from either.
 */
export const SPECIAL_UNITS: readonly SpecialUnit[] = [
  {
    id: 'pathfinders', name: 'the Pathfinder Battalion', tier: 1,
    branches: ['land-forces'], minRank: 2, minPerformance: 550,
    requiredBadges: ['parachutist'], feederUnitId: null,
    selectionDenominator: 500, dutyPay: dollars(360), exposureMultiplier: 1250,
  },
  {
    id: 'trident', name: 'the Trident Detachment', tier: 1,
    branches: ['naval-service'], minRank: 2, minPerformance: 560,
    requiredBadges: ['combat diver'], feederUnitId: null,
    selectionDenominator: 520, dutyPay: dollars(360), exposureMultiplier: 1250,
  },
  {
    id: 'guardian-flight', name: 'the Guardian Flight', tier: 1,
    branches: ['air-guard'], minRank: 2, minPerformance: 560,
    requiredBadges: ['military freefall'], feederUnitId: null,
    selectionDenominator: 520, dutyPay: dollars(360), exposureMultiplier: 1200,
  },
  {
    // The pack's aviation unit. Tier 2 and fed by the Guardian Flight: the
    // people who fly the quiet tier's aircraft come from the quiet tier.
    id: 'nighthawks', name: 'the Nighthawk Squadron', tier: 2,
    branches: ['air-guard'], minRank: 4, minPerformance: 700,
    requiredBadges: ['senior aviator'], feederUnitId: 'guardian-flight',
    selectionDenominator: 900, dutyPay: dollars(950), exposureMultiplier: 1450,
  },
  {
    id: 'vanguard', name: 'the Vanguard Group', tier: 2,
    branches: ['land-forces'], minRank: 4, minPerformance: 700,
    requiredBadges: ['special forces'], feederUnitId: 'pathfinders',
    selectionDenominator: 850, dutyPay: dollars(830), exposureMultiplier: 1450,
  },
  {
    id: 'task-unit-ember', name: 'Task Unit Ember', tier: 2,
    branches: ['naval-service'], minRank: 5, minPerformance: 720,
    requiredBadges: ['combat diver'], feederUnitId: 'trident',
    selectionDenominator: 900, dutyPay: dollars(950), exposureMultiplier: 1500,
  },
  {
    id: 'grey-section', name: 'the Grey Section', tier: 3,
    branches: [], minRank: 6, minPerformance: 800,
    requiredBadges: [], feederUnitId: null,
    selectionDenominator: 1400, dutyPay: dollars(600), exposureMultiplier: 1600,
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

export const BASE_NAMES: readonly BaseSpec[] = [
  // Joint use, as they have been since L4-M3: no branch tag, so every
  // service posts here. Same names, same order — no place id moves.
  { name: 'Fort Calder', branches: [] },
  { name: 'Redharbor Station', branches: [] },
]

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
  | 'class-e-felony'
  | 'class-d-felony'
  | 'class-c-felony'
  | 'class-b-felony'
  | 'class-a-felony'
  | 'capital'

export const GRADE_TITLES: Readonly<Record<OffenceGrade, string>> = {
  'class-c-misdemeanor': 'Class C misdemeanor',
  'class-b-misdemeanor': 'Class B misdemeanor',
  'class-a-misdemeanor': 'Class A misdemeanor',
  'class-e-felony': 'Class E felony',
  'class-d-felony': 'Class D felony',
  'class-c-felony': 'Class C felony',
  'class-b-felony': 'Class B felony',
  'class-a-felony': 'Class A felony',
  capital: 'capital offense',
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
  /**
   * C3 §9. WHERE THE DANGER OF DOING IT LIVES, which is what the player's
   * commission scene is built from: a confrontation, the heat, or the
   * paper trail. Not how bad the charge is — how it goes wrong.
   */
  readonly danger?: OffenceDanger
  /** Force against a person. Gates expungement and the fade (C3 §5). */
  readonly violent?: boolean
  /**
   * What this becomes when somebody dies during it — the felony-murder
   * road. An offence id, resolved through offenceById.
   */
  readonly escalatesTo?: string
  /** Months a plea cannot bargain below (C3 §13). */
  readonly mandatoryMin?: number
}

/**
 * C3 §9. The three ways a crime goes wrong, and the three shapes the
 * player's commission scene takes.
 *
 * 'physical' is somebody in the room — the confrontation. 'police' is the
 * street and the siren — the heat. 'discovery' is a ledger somebody else
 * will read one day — the paper trail. A charge has exactly one, because a
 * scene has to pick one.
 */
export type OffenceDanger = 'police' | 'physical' | 'discovery'

/**
 * What a person can be charged with here. Twenty-two offences, weighted
 * toward the ordinary end — most crime is small, and a catalogue that was
 * all felonies would be a fantasy of crime rather than a model of it.
 */
export const OFFENCES: readonly Offence[] = [
  // --- Misdemeanors ------------------------------------------------------
  { id: 'disorderly-conduct', title: 'disorderly conduct', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 15_000, clearance: 620, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'public-intoxication', title: 'public intoxication', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 12_000, clearance: 660, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'trespassing', title: 'criminal trespass', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 3, fine: 20_000, clearance: 520, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'vandalism', title: 'criminal mischief', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 4, fine: 30_000, clearance: 400, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'reckless-driving', title: 'reckless driving', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 3, fine: 25_000, clearance: 540, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'shoplifting', title: 'petty theft', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 6, fine: 25_000, clearance: 480, gainMin: 3_000, gainMax: 18_000, danger: 'police' },
  { id: 'bad-check', title: 'passing a bad check', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 9, fine: 35_000, clearance: 560, gainMin: 8_000, gainMax: 40_000, danger: 'discovery' },
  { id: 'simple-assault', title: 'simple assault', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 40_000, clearance: 640, gainMin: 0, gainMax: 0, danger: 'physical' },
  { id: 'dui', title: 'driving under the influence', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 80_000, clearance: 600, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'drug-possession', title: 'possession of a controlled substance', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 50_000, clearance: 520, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'resisting-arrest', title: 'resisting arrest', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 40_000, clearance: 900, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'petty-fraud', title: 'petty fraud', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 45_000, clearance: 500, gainMin: 10_000, gainMax: 50_000, danger: 'discovery' },

  // --- Felonies ----------------------------------------------------------
  { id: 'forgery', title: 'forgery', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 100_000, clearance: 480, gainMin: 30_000, gainMax: 120_000, danger: 'discovery' },
  { id: 'tax-evasion', title: 'tax evasion', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 150_000, clearance: 420, gainMin: 40_000, gainMax: 200_000, needsJob: true, danger: 'discovery' },
  { id: 'grand-theft', title: 'grand theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 120_000, clearance: 440, gainMin: 60_000, gainMax: 250_000, takesFromHousehold: true, danger: 'physical' },
  { id: 'auto-theft', title: 'motor vehicle theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 130_000, clearance: 520, gainMin: 80_000, gainMax: 300_000, danger: 'physical' },
  { id: 'embezzlement', title: 'embezzlement', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 200_000, clearance: 460, gainMin: 100_000, gainMax: 400_000, needsJob: true, danger: 'discovery' },
  { id: 'identity-theft', title: 'identity theft', grade: 'class-c-felony', minMonths: 12, maxMonths: 120, fine: 150_000, clearance: 400, gainMin: 60_000, gainMax: 250_000, danger: 'discovery' },
  { id: 'burglary', title: 'residential burglary', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 460, gainMin: 80_000, gainMax: 350_000, takesFromHousehold: true, danger: 'physical' },
  { id: 'robbery', title: 'robbery', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 620, gainMin: 40_000, gainMax: 200_000, takesFromHousehold: true, danger: 'physical' },
  { id: 'aggravated-assault', title: 'aggravated assault', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 700, gainMin: 0, gainMax: 0, danger: 'physical' },
  { id: 'arson', title: 'arson', grade: 'class-b-felony', minMonths: 24, maxMonths: 240, fine: 0, clearance: 560, gainMin: 0, gainMax: 0, danger: 'physical' },
  // --- C3 §10: the catalogue grows -----------------------------------------
  // Added by the owner's C3 doc. The existing twenty-three are untouched;
  // these fill in the ends the first pass left out — the traffic and public
  // order a small town actually sees, the fraud that hides in paperwork,
  // and the violent end the first pass deliberately deferred.
  //
  // The grades, sentences and fines are the doc's table. Clearance follows
  // the pattern already here: a thing done in the street is cleared far
  // more often than a thing done in a ledger.

  // Public order and traffic
  { id: 'disturbing-peace', title: 'disturbing the peace', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 15_000, clearance: 640, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'loitering', title: 'loitering and prowling', grade: 'class-c-misdemeanor', minMonths: 0, maxMonths: 1, fine: 10_000, clearance: 600, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'obstruction', title: 'obstruction of justice', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 50_000, clearance: 700, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'evading-police', title: 'evading the police', grade: 'class-a-misdemeanor', minMonths: 3, maxMonths: 12, fine: 50_000, clearance: 760, gainMin: 0, gainMax: 0, danger: 'physical' },
  { id: 'contempt', title: 'contempt of court', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 6, fine: 25_000, clearance: 900, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'suspended-license', title: 'driving on a suspended license', grade: 'class-b-misdemeanor', minMonths: 0, maxMonths: 3, fine: 30_000, clearance: 560, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'hit-and-run-property', title: 'hit and run', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 60_000, clearance: 460, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'hit-and-run-injury', title: 'hit and run causing injury', grade: 'class-e-felony', minMonths: 12, maxMonths: 48, fine: 200_000, clearance: 540, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'vehicular-assault', title: 'vehicular assault', grade: 'class-c-felony', minMonths: 24, maxMonths: 96, fine: 0, clearance: 620, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'vehicular-manslaughter', title: 'vehicular manslaughter', grade: 'class-b-felony', minMonths: 36, maxMonths: 180, fine: 0, clearance: 720, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },

  // Drugs
  { id: 'possession-with-intent', title: 'possession with intent to distribute', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 100_000, clearance: 420, gainMin: 20_000, gainMax: 90_000, danger: 'police' },
  { id: 'drug-trafficking', title: 'drug trafficking', grade: 'class-b-felony', minMonths: 36, maxMonths: 240, fine: 250_000, clearance: 380, gainMin: 80_000, gainMax: 400_000, danger: 'physical', mandatoryMin: 36 },
  { id: 'drug-manufacturing', title: 'manufacturing a controlled substance', grade: 'class-b-felony', minMonths: 36, maxMonths: 240, fine: 250_000, clearance: 400, gainMin: 60_000, gainMax: 300_000, danger: 'physical' },

  // Property and theft
  { id: 'receiving-stolen', title: 'receiving stolen property', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 80_000, clearance: 440, gainMin: 20_000, gainMax: 120_000, danger: 'police' },
  { id: 'commercial-burglary', title: 'commercial burglary', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 0, clearance: 480, gainMin: 40_000, gainMax: 200_000, danger: 'physical' },
  { id: 'armed-robbery', title: 'armed robbery', grade: 'class-a-felony', minMonths: 60, maxMonths: 300, fine: 0, clearance: 660, gainMin: 60_000, gainMax: 300_000, danger: 'physical', violent: true, mandatoryMin: 60, escalatesTo: 'felony-murder' },
  { id: 'extortion', title: 'extortion', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 180_000, clearance: 400, gainMin: 50_000, gainMax: 250_000, danger: 'discovery' },
  { id: 'looting', title: 'looting', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 0, clearance: 500, gainMin: 40_000, gainMax: 200_000, danger: 'physical' },

  // Fraud and white collar
  { id: 'credit-card-fraud', title: 'credit card fraud', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 120_000, clearance: 380, gainMin: 30_000, gainMax: 150_000, danger: 'discovery' },
  { id: 'money-laundering', title: 'money laundering', grade: 'class-b-felony', minMonths: 36, maxMonths: 240, fine: 300_000, clearance: 300, gainMin: 100_000, gainMax: 500_000, danger: 'discovery', needsJob: true },
  { id: 'insurance-fraud', title: 'insurance fraud', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 180_000, clearance: 340, gainMin: 60_000, gainMax: 300_000, danger: 'discovery' },
  { id: 'wire-fraud', title: 'wire fraud', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 250_000, clearance: 320, gainMin: 80_000, gainMax: 400_000, danger: 'discovery' },
  { id: 'bribery', title: 'bribery', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 200_000, clearance: 360, gainMin: 50_000, gainMax: 250_000, danger: 'discovery', needsJob: true },

  // Violence and homicide
  { id: 'battery', title: 'battery', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 45_000, clearance: 660, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'domestic-violence', title: 'domestic violence', grade: 'class-c-felony', minMonths: 24, maxMonths: 120, fine: 100_000, clearance: 700, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'assault-deadly-weapon', title: 'assault with a deadly weapon', grade: 'class-b-felony', minMonths: 36, maxMonths: 240, fine: 0, clearance: 680, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, mandatoryMin: 36, escalatesTo: 'attempted-murder' },
  { id: 'attempted-murder', title: 'attempted murder', grade: 'class-a-felony', minMonths: 120, maxMonths: 360, fine: 0, clearance: 760, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, mandatoryMin: 120, escalatesTo: 'murder-second' },
  { id: 'kidnapping', title: 'kidnapping', grade: 'class-a-felony', minMonths: 60, maxMonths: 360, fine: 0, clearance: 720, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, escalatesTo: 'felony-murder' },
  { id: 'involuntary-manslaughter', title: 'involuntary manslaughter', grade: 'class-b-felony', minMonths: 36, maxMonths: 180, fine: 0, clearance: 780, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'voluntary-manslaughter', title: 'voluntary manslaughter', grade: 'class-a-felony', minMonths: 60, maxMonths: 360, fine: 0, clearance: 800, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'murder-second', title: 'murder in the second degree', grade: 'class-a-felony', minMonths: 180, maxMonths: 600, fine: 0, clearance: 820, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, mandatoryMin: 180 },
  { id: 'murder-first', title: 'murder in the first degree', grade: 'capital', minMonths: 300, maxMonths: 900, fine: 0, clearance: 840, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, mandatoryMin: 300 },
  { id: 'felony-murder', title: 'felony murder', grade: 'capital', minMonths: 300, maxMonths: 900, fine: 0, clearance: 840, gainMin: 0, gainMax: 0, danger: 'physical', violent: true, mandatoryMin: 300 },

  // Weapons
  { id: 'unlawful-firearm', title: 'unlawful possession of a firearm', grade: 'class-d-felony', minMonths: 12, maxMonths: 60, fine: 80_000, clearance: 520, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'concealed-weapon', title: 'carrying a concealed weapon', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 40_000, clearance: 500, gainMin: 0, gainMax: 0, danger: 'police' },
  { id: 'brandishing', title: 'brandishing a weapon', grade: 'class-a-misdemeanor', minMonths: 0, maxMonths: 12, fine: 45_000, clearance: 620, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
  { id: 'unlawful-discharge', title: 'unlawful discharge of a firearm', grade: 'class-e-felony', minMonths: 12, maxMonths: 48, fine: 90_000, clearance: 640, gainMin: 0, gainMax: 0, danger: 'physical', violent: true },
]

export function offenceById(id: string): Offence | undefined {
  return OFFENCES.find((offence) => offence.id === id)
}

/** Felonies close doors misdemeanors do not. A capital offense is one. */
export function isFelony(grade: OffenceGrade): boolean {
  return grade.endsWith('felony') || grade === 'capital'
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

/**
 * An occupation by id. TOTAL — it does not throw (W1 resistance 2).
 *
 * Occupation ids live in saved employment records and in 'hired' /
 * 'turned-down' event details, so this is called with strings that came out
 * of a file. Throwing on an unrecognized one kills the worker mid-tick and
 * takes the whole world with it; an unknown trade reads as its own id,
 * pays nothing and requires nothing, which is honest about what the build
 * knows. Occupations are shared content in every preset (WORLD_MODES_PLAN
 * rules job titles real everywhere), so this only ever fires for a save
 * written by a later build.
 */
export function occupationById(id: string): Occupation {
  return (
    OCCUPATIONS.find((o) => o.id === id) ?? {
      id,
      title: id,
      requires: 'none',
      minMonthlyPay: 0 as Money,
      maxMonthlyPay: 0 as Money,
    }
  )
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
