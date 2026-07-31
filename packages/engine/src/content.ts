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
import type { EducationLevel, Occupation } from './types.js'

export const MALE_GIVEN_NAMES: readonly string[] = [
  'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul',
  'Steven', 'Andrew', 'Kenneth', 'George', 'Edward', 'Brian', 'Ronald', 'Timothy',
  'Jason', 'Jeffrey', 'Ryan', 'Gary', 'Nicholas', 'Eric', 'Stephen', 'Larry',
]

export const FEMALE_GIVEN_NAMES: readonly string[] = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Margaret', 'Betty', 'Sandra',
  'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol',
  'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Helen',
  'Sharon', 'Cynthia', 'Kathleen',
]

export const FAMILY_NAMES: readonly string[] = [
  'Abbott', 'Alderman', 'Ashfield', 'Barlow', 'Brennan', 'Calloway', 'Chandler',
  'Corbin', 'Delaney', 'Doherty', 'Eastwood', 'Fairbanks', 'Ferris', 'Gaines',
  'Halloran', 'Hargrove', 'Ingram', 'Kettering', 'Lambert', 'Lindqvist',
  'Marsden', 'Mercer', 'Nakamura', 'Okafor', 'Pennington', 'Prescott', 'Quill',
  'Rasmussen', 'Redfern', 'Sandoval', 'Stroud', 'Tavares', 'Thorne', 'Underhill',
  'Vance', 'Vasquez', 'Whitlock', 'Winslow', 'Yardley', 'Zielinski',
]

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
 * Foreign nations, all invented (fictional-world constraint,
 * MILITARY_AND_WAR_FOUNDATION §3). Chosen to sound like places without
 * sounding like any place in particular.
 */
export const NATION_NAMES: readonly string[] = [
  'Varenia', 'Costmara', 'Belgrave', 'Tyrene', 'Osmark', 'Halvia',
  'Rondesia', 'Quillar', 'Verros', 'Nortavia', 'Sundermark', 'Ashkelon',
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

/** Enlisted ranks, junior to senior. One track for M3; officers arrive later. */
export const RANKS: readonly string[] = [
  'recruit', 'private', 'specialist', 'corporal', 'sergeant', 'master sergeant',
]

/**
 * How a specialty spends its days — which threats it is exposed to when a
 * theatre turns dangerous. 0-1000 relative weights, NOT probabilities and NOT
 * danger ratings: a convoy weight of 800 means "this job is on the roads",
 * and what the roads are like is the geopolitical state's business.
 */
export interface ExposureProfile {
  readonly directCombat: number
  readonly convoy: number
  readonly baseAttack: number
  readonly accident: number
}

export interface ServiceSpecialty {
  readonly id: string
  readonly title: string
  readonly branch: ServiceBranch
  readonly requires: EducationLevel
  /** Monthly base pay at the lowest rank, in cents. */
  readonly basePay: Money
  readonly exposure: ExposureProfile
  /** Civilian occupations this specialty's training unlocks for veterans. */
  readonly civilianUnlocks: readonly string[]
}

export const SPECIALTIES: readonly ServiceSpecialty[] = [
  {
    id: 'rifleman', title: 'rifleman', branch: 'land-forces', requires: 'none',
    basePay: dollars(1150),
    exposure: { directCombat: 850, convoy: 300, baseAttack: 300, accident: 300 },
    civilianUnlocks: [],
  },
  {
    id: 'transport', title: 'transport driver', branch: 'land-forces', requires: 'primary',
    basePay: dollars(1200),
    exposure: { directCombat: 150, convoy: 850, baseAttack: 250, accident: 450 },
    civilianUnlocks: [],
  },
  {
    id: 'mechanic', title: 'field mechanic', branch: 'land-forces', requires: 'primary',
    basePay: dollars(1350),
    exposure: { directCombat: 80, convoy: 200, baseAttack: 350, accident: 400 },
    civilianUnlocks: ['machinist', 'electrician', 'carpenter'],
  },
  {
    id: 'medic', title: 'medic', branch: 'land-forces', requires: 'secondary',
    basePay: dollars(1450),
    exposure: { directCombat: 350, convoy: 400, baseAttack: 300, accident: 250 },
    civilianUnlocks: ['nurse'],
  },
  {
    id: 'signals', title: 'signals operator', branch: 'air-guard', requires: 'secondary',
    basePay: dollars(1400),
    exposure: { directCombat: 40, convoy: 100, baseAttack: 450, accident: 200 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'deckhand', title: 'deckhand', branch: 'naval-service', requires: 'none',
    basePay: dollars(1200),
    exposure: { directCombat: 120, convoy: 60, baseAttack: 500, accident: 550 },
    civilianUnlocks: ['millhand'],
  },
]

export function specialtyById(id: string): ServiceSpecialty {
  const found = SPECIALTIES.find((sp) => sp.id === id)
  if (!found) throw new Error(`Unknown specialty: ${id}`)
  return found
}

/** Pay rises a fixed step per rank — a pay TABLE, not a lookup of danger. */
export function servicePay(specialty: ServiceSpecialty, rank: number): Money {
  return (specialty.basePay + rank * dollars(180)) as Money
}

/** Standard enlistment term, months. */
export const SERVICE_TERM_MONTHS = 48

export const BASE_NAMES: readonly string[] = ['Fort Calder', 'Redharbor Station']

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
