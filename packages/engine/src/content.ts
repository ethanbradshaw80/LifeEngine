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
]

export const CIVIC_NAMES: readonly string[] = ['the town hall', 'the public library']

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
]

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
