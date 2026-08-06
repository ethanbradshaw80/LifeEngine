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
import type { BaseSpec, NationSpec, OfficerRole, ServiceBranchSpec } from './types.js'
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
  { id: 'labourer', title: 'labourer', requires: 'none', minMonthlyPay: dollars(354), maxMonthlyPay: dollars(604) },
  { id: 'cook', title: 'cook', requires: 'none', minMonthlyPay: dollars(292), maxMonthlyPay: dollars(479) },
  { id: 'shop-clerk', title: 'shop clerk', requires: 'primary', minMonthlyPay: dollars(292), maxMonthlyPay: dollars(458) },
  { id: 'millhand', title: 'mill hand', requires: 'primary', minMonthlyPay: dollars(375), maxMonthlyPay: dollars(625) },
  // Lower-middle — $50k to $70k.
  { id: 'clerk', title: 'office clerk', requires: 'secondary', minMonthlyPay: dollars(354), maxMonthlyPay: dollars(562) },
  { id: 'bookkeeper', title: 'bookkeeper', requires: 'secondary', minMonthlyPay: dollars(417), maxMonthlyPay: dollars(646) },
  { id: 'constable', title: 'constable', requires: 'secondary', minMonthlyPay: dollars(573), maxMonthlyPay: dollars(938) },
  { id: 'carpenter', title: 'carpenter', requires: 'trade', minMonthlyPay: dollars(500), maxMonthlyPay: dollars(875) },
  { id: 'machinist', title: 'machinist', requires: 'trade', minMonthlyPay: dollars(438), maxMonthlyPay: dollars(688) },
  { id: 'nurse', title: 'nurse', requires: 'trade', minMonthlyPay: dollars(812), maxMonthlyPay: dollars(1_250) },
  // Middle — $70k to $100k.
  { id: 'foreman', title: 'foreman', requires: 'secondary', minMonthlyPay: dollars(573), maxMonthlyPay: dollars(896) },
  { id: 'electrician', title: 'electrician', requires: 'trade', minMonthlyPay: dollars(500), maxMonthlyPay: dollars(875) },
  { id: 'teacher', title: 'teacher', requires: 'college', minMonthlyPay: dollars(604), maxMonthlyPay: dollars(1_021) },
  // Upper-middle — $100k to $150k.
  { id: 'accountant', title: 'accountant', requires: 'college', minMonthlyPay: dollars(646), maxMonthlyPay: dollars(1_104) },
  { id: 'pharmacist', title: 'pharmacist', requires: 'college', minMonthlyPay: dollars(1_198), maxMonthlyPay: dollars(1_667) },
  { id: 'engineer', title: 'engineer', requires: 'college', minMonthlyPay: dollars(792), maxMonthlyPay: dollars(1_312) },
  // Professional — $150k and up.
  { id: 'doctor', title: 'doctor', requires: 'college', minMonthlyPay: dollars(2_135), maxMonthlyPay: dollars(3_646) },

  // --- M-CAREER §1. THE RUNGS ABOVE, AND THE ONES BELOW ------------------
  //
  // Civilian work used to be seventeen jobs and no ladder. These are the
  // positions those jobs lead TO and come FROM, so a career is a climb
  // rather than a wage. Every one is an ordinary occupation — hiring, pay,
  // tax and the ledger do not know a rung from a job, which is the point.
  //
  // Priced on the same real annual scale as everything above (M-ECON §7),
  // each rung a real step up from the one below it.
  { id: 'apprentice', title: 'apprentice', requires: 'trade', minMonthlyPay: dollars(344), maxMonthlyPay: dollars(521) },
  { id: 'master-tradesman', title: 'master tradesman', requires: 'trade', minMonthlyPay: dollars(604), maxMonthlyPay: dollars(1_000) },
  { id: 'site-foreman', title: 'site foreman', requires: 'trade', minMonthlyPay: dollars(875), maxMonthlyPay: dollars(1_375) },
  { id: 'contractor', title: 'contractor', requires: 'trade', minMonthlyPay: dollars(990), maxMonthlyPay: dollars(1_823) },

  { id: 'shift-lead', title: 'shift lead', requires: 'primary', minMonthlyPay: dollars(375), maxMonthlyPay: dollars(583) },
  { id: 'assistant-manager', title: 'assistant manager', requires: 'primary', minMonthlyPay: dollars(438), maxMonthlyPay: dollars(688) },
  { id: 'store-manager', title: 'store manager', requires: 'primary', minMonthlyPay: dollars(521), maxMonthlyPay: dollars(833) },
  { id: 'district-manager', title: 'district manager', requires: 'secondary', minMonthlyPay: dollars(708), maxMonthlyPay: dollars(1_125) },

  { id: 'associate', title: 'associate', requires: 'secondary', minMonthlyPay: dollars(521), maxMonthlyPay: dollars(812) },
  { id: 'senior-associate', title: 'senior associate', requires: 'secondary', minMonthlyPay: dollars(688), maxMonthlyPay: dollars(1_125) },
  { id: 'manager', title: 'manager', requires: 'secondary', minMonthlyPay: dollars(812), maxMonthlyPay: dollars(1_354) },
  { id: 'director', title: 'director', requires: 'college', minMonthlyPay: dollars(1_229), maxMonthlyPay: dollars(1_854) },
  { id: 'vice-president', title: 'vice president', requires: 'college', minMonthlyPay: dollars(1_615), maxMonthlyPay: dollars(2_448) },
  { id: 'executive', title: 'executive', requires: 'college', minMonthlyPay: dollars(1_927), maxMonthlyPay: dollars(3_333) },

  { id: 'lead-hand', title: 'lead hand', requires: 'none', minMonthlyPay: dollars(458), maxMonthlyPay: dollars(708) },
  { id: 'superintendent', title: 'superintendent', requires: 'secondary', minMonthlyPay: dollars(917), maxMonthlyPay: dollars(1_438) },
  { id: 'plant-manager', title: 'plant manager', requires: 'secondary', minMonthlyPay: dollars(1_125), maxMonthlyPay: dollars(1_750) },

  { id: 'aide', title: "nurse's aide", requires: 'none', minMonthlyPay: dollars(333), maxMonthlyPay: dollars(521) },
  { id: 'charge-nurse', title: 'charge nurse', requires: 'trade', minMonthlyPay: dollars(917), maxMonthlyPay: dollars(1_333) },
  { id: 'nurse-manager', title: 'nurse manager', requires: 'trade', minMonthlyPay: dollars(1_021), maxMonthlyPay: dollars(1_510) },

  { id: 'resident', title: 'resident physician', requires: 'college', minMonthlyPay: dollars(625), maxMonthlyPay: dollars(792) },
  { id: 'chief-of-medicine', title: 'chief of medicine', requires: 'college', minMonthlyPay: dollars(2_604), maxMonthlyPay: dollars(3_958) },

  { id: 'department-head', title: 'department head', requires: 'college', minMonthlyPay: dollars(708), maxMonthlyPay: dollars(1_094) },
  { id: 'assistant-principal', title: 'assistant principal', requires: 'college', minMonthlyPay: dollars(812), maxMonthlyPay: dollars(1_167) },
  { id: 'principal', title: 'principal', requires: 'college', minMonthlyPay: dollars(990), maxMonthlyPay: dollars(1_438) },

  { id: 'sergeant', title: 'police sergeant', requires: 'secondary', minMonthlyPay: dollars(812), maxMonthlyPay: dollars(1_312) },
  { id: 'police-chief', title: 'chief of police', requires: 'secondary', minMonthlyPay: dollars(1_042), maxMonthlyPay: dollars(1_583) },

  { id: 'senior-accountant', title: 'senior accountant', requires: 'college', minMonthlyPay: dollars(812), maxMonthlyPay: dollars(1_271) },
  { id: 'partner', title: 'partner', requires: 'college', minMonthlyPay: dollars(1_458), maxMonthlyPay: dollars(2_396) },
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
export const RENT_FLOOR = dollars(119)
/** Added rent per point of neighbourhood desirability (0-1000 scale). */
const RENT_PER_DESIRABILITY_CENTS = 13

/** Monthly cost of keeping an adult fed, clothed and warm. */
export const LIVING_COST_ADULT = dollars(119)
/** Children cost less per head. School is public and free. */
export const LIVING_COST_CHILD = dollars(65)

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
/**
 * M-PROMO phase 1 (owner's `promotions_all_branches.md`).
 *
 * THE LADDERS STOPPED SHORT. The land forces topped out at MSG (E-8) and
 * the other two at their E-7 — so a naval career ended at Chief and an air
 * career at Master Sergeant, with the two grades above them simply absent.
 * The spec's tables run every branch to E-9, and every later phase of the
 * promotions work (the senior selection boards, the PME that gates each
 * step, the command billets) needs those rungs to exist before it has
 * anything to gate.
 *
 * Nothing here reads a hardcoded length — the promotion path, the pay
 * lookup and the article 15 paper all work off `ranks.length`, so the
 * ladders can grow without chasing constants.
 */
export const BRANCH_RANKS: Readonly<Record<ServiceBranch, readonly string[]>> = {
  'land-forces': ['PVT', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', 'SGM'],
  'naval-service': ['SR', 'SA', 'SN', 'PO3', 'PO2', 'PO1', 'CPO', 'SCPO', 'MCPO'],
  'air-guard': ['AB', 'Amn', 'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt'],
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
    'Sergeant', 'Staff Sergeant', 'Sergeant First Class', 'Master Sergeant', 'Sergeant Major',
  ],
  'naval-service': [
    'Seaman Recruit', 'Seaman Apprentice', 'Seaman', 'Petty Officer Third Class',
    'Petty Officer Second Class', 'Petty Officer First Class', 'Chief Petty Officer',
    'Senior Chief Petty Officer', 'Master Chief Petty Officer',
  ],
  'air-guard': [
    'Airman Basic', 'Airman', 'Airman First Class', 'Senior Airman', 'Staff Sergeant',
    'Technical Sergeant', 'Master Sergeant', 'Senior Master Sergeant', 'Chief Master Sergeant',
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
  // SPC and CPL share E-4 — the corporal is the same grade wearing the
  // stripes of an NCO, which is why the twelve-year wall reads GRADE and
  // not rank index (ADR-0032).
  'land-forces': [1, 2, 3, 4, 4, 5, 6, 7, 8, 9],
  'naval-service': [1, 2, 3, 4, 5, 6, 7, 8, 9],
  'air-guard': [1, 2, 3, 4, 5, 6, 7, 8, 9],
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
  dollars(600), // O-1 — over an E-5 sergeant, under an E-6
  dollars(700), // O-2 — under an E-7
  dollars(862), // O-3 — now past the top enlisted grade
  dollars(1_038), // O-4
  dollars(1_225), // O-5
  dollars(1_475), // O-6
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
  dollars(325), // E-1
  dollars(362), // E-2
  dollars(400), // E-3
  dollars(450), // E-4
  dollars(538), // E-5
  dollars(625), // E-6
  dollars(738), // E-7
  dollars(850), // E-8
  // E-9. EXTRAPOLATED, NOT PRICED. Every figure above it was set against
  // real compensation data; this one continues the curve those figures
  // make (the step from E-8 grows the way E-6→E-7→E-8 grew) because the
  // grade did not exist when the table was repriced. It wants checking
  // against a real senior-enlisted figure before anybody leans on it.
  dollars(985), // E-9
]

/**
 * The first ladder index that takes a promotion board. Everything below is
 * time-in-grade — near-automatic, the way junior enlisted promotion works.
 */
/**
 * The first rung that has to be COMPETED for. Below it, promotion is time
 * and a commander's signature.
 *
 * M-PROMO (owner's `army_promotions_fix.md`, headline correction): "No
 * board for Specialist/Corporal (E-4)." The land forces sat at 4, which is
 * CPL — so making corporal meant clearing a promotion-points cutoff, a
 * board in all but name. The doc is explicit that E-2 through E-4 are
 * automatic on time and that CORPORAL IS A LATERAL APPOINTMENT the
 * commander names you into. Sergeant is the first rung anybody competes
 * for. The doc is master and overrides the earlier billet-timing direction
 * that put CPL on the competitive path.
 *
 * THE THREE BRANCHES GENUINELY DIFFER HERE, which is the whole point of
 * the promotions work: the navy's E-4 (PO3) really is won on an
 * advancement exam, so 3 is correct for it; the air force's E-4 (SrA) is
 * automatic and its E-5 (SSgt) is the first WAPS rung, so 4 is correct
 * there. Only the land forces were wrong.
 */
export const COMPETITIVE_FROM: Readonly<Record<ServiceBranch, number>> = {
  'land-forces': 5, // SGT and above — E-4 is time, not a board
  'naval-service': 3, // PO3 and above — the advancement exam starts at E-4
  'air-guard': 4, // SSgt and above — SrA is automatic
}

/**
 * Months in grade before the next junior promotion is due, indexed by the
 * CURRENT rank. E-1→E-2 at ~6 months, E-3 by the first year, E-4 around the
 * second or third — no skipping, checked monthly, delayed only by poor
 * performance.
 */
export const JUNIOR_TIG_MONTHS: Readonly<Record<ServiceBranch, readonly number[]>> = {
  // Indexed by the rank being promoted OUT of. The fourth entry is the one
  // the CPL correction needs: SPC → CPL is now a junior step and would
  // otherwise fall to the six-month default, making corporal arrive faster
  // than specialist did.
  'land-forces': [6, 6, 12, 12],
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
  // M-ENLIST §5c. HOW EACH SERVICE HANDS OUT OFFICER JOBS, and they really
  // do differ — this is one of the few places the three services are not
  // the same shape with different words.
  //
  //   the naval service SELECTS a community: you pick, and the competitive
  //     ones pick you back.
  //   the ground service BRANCHES on merit: you list what you want and it
  //     weighs that against what it needs, so a first choice is a hope.
  //   the air service ASSIGNS by need, and a flying seat is competed for.
  officerAccession: (
    { 'land-forces': 'merit-branch', 'naval-service': 'community-select', 'air-guard': 'needs-assigned' } as const
  )[id],
  // M-ENLIST §5b. What a moment looks like when a job has no pool of its own.
  combatFlavor: (
    { 'land-forces': 'ground', 'naval-service': 'sea', 'air-guard': 'air' } as const
  )[id],
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
    code: '11B', field: 'combat', minAptitude: 31,
    bonusCents: dollars(8_000) as Money, combatWeight: 850,
    sceneTags: ['combat_firefight', 'combat_breach', 'combat_convoy_ambush', 'combat_patrol_ied', 'base_defense'],
    schoolMonths: 2, qualification: 'expert marksman', boardCutoffOffset: -40,
    exposure: { directCombat: 850, convoy: 300, baseAttack: 300, accident: 300 },
    civilianUnlocks: [],
  },
  {
    id: 'transport', title: 'transport driver', officerTitle: 'transport officer', branch: 'land-forces', requires: 'primary',
    code: '88M', field: 'logistics', minAptitude: 35,
    bonusCents: dollars(4_000) as Money, combatWeight: 400,
    sceneTags: ['combat_convoy_ambush', 'combat_patrol_ied', 'base_defense', 'work_maint_fault'],
    schoolMonths: 2, qualification: 'master driver', boardCutoffOffset: -20,
    exposure: { directCombat: 150, convoy: 850, baseAttack: 250, accident: 450 },
    civilianUnlocks: [],
  },
  {
    id: 'mechanic', title: 'field mechanic', officerTitle: 'maintenance officer', branch: 'land-forces', requires: 'primary',
    code: '91B', field: 'technical', minAptitude: 45,
    bonusCents: dollars(5_000) as Money, combatWeight: 300,
    sceneTags: ['work_critical_repair', 'work_maint_fault', 'base_defense', 'combat_convoy_ambush'],
    schoolMonths: 4, qualification: 'master mechanic', boardCutoffOffset: 20,
    exposure: { directCombat: 80, convoy: 200, baseAttack: 350, accident: 400 },
    civilianUnlocks: ['machinist', 'electrician', 'carpenter'],
  },
  {
    id: 'medic', title: 'medic', officerTitle: 'medical service officer', branch: 'land-forces', requires: 'secondary',
    code: '68W', field: 'medical', minAptitude: 55,
    bonusCents: dollars(10_000) as Money, combatWeight: 600,
    sceneTags: ['med_treat_under_fire', 'med_masscas', 'combat_rescue', 'combat_firefight'],
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
    code: '15A', field: 'aviation', minAptitude: 70,
    bonusCents: dollars(12_000) as Money, combatWeight: 400,
    sceneTags: ['air_emergency_landing', 'air_crash', 'air_hardlanding', 'air_flightline_fire'],
    schoolMonths: 12, qualification: 'aviator wings', boardCutoffOffset: 60,
    exposure: { directCombat: 220, convoy: 0, baseAttack: 300, accident: 700 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'aircrew', title: 'aircrew', officerTitle: 'air operations officer', branch: 'air-guard', requires: 'secondary',
    code: '15U', field: 'aviation', minAptitude: 60,
    bonusCents: dollars(9_000) as Money, combatWeight: 420,
    sceneTags: ['air_flightline_fire', 'air_hardlanding', 'work_maint_fault', 'base_defense'],
    schoolMonths: 6, qualification: 'aircrew wings', boardCutoffOffset: 40,
    exposure: { directCombat: 260, convoy: 0, baseAttack: 320, accident: 620 },
    civilianUnlocks: ['machinist'],
  },
  {
    id: 'signals', title: 'signals operator', officerTitle: 'signals officer', branch: 'air-guard', requires: 'secondary',
    code: '25B', field: 'technical', minAptitude: 65,
    bonusCents: dollars(7_000) as Money, combatWeight: 250,
    sceneTags: ['comms_blackout', 'cyber_incident', 'ops_center_crisis', 'base_defense'],
    schoolMonths: 4, qualification: 'senior signals rating', boardCutoffOffset: 40,
    exposure: { directCombat: 40, convoy: 100, baseAttack: 450, accident: 200 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'deckhand', title: 'deckhand', officerTitle: 'deck officer', branch: 'naval-service', requires: 'none',
    code: 'BM', field: 'combat', minAptitude: 31,
    bonusCents: dollars(5_000) as Money, combatWeight: 400,
    sceneTags: ['sea_general_quarters', 'sea_fire_aboard', 'sea_smallboat_attack', 'sea_manoverboard'],
    schoolMonths: 2, qualification: 'seamanship rating', boardCutoffOffset: 0,
    exposure: { directCombat: 120, convoy: 60, baseAttack: 500, accident: 550 },
    civilianUnlocks: ['millhand'],
  },
  // --- M-ENLIST §3. THE REST OF THE CATALOGUE --------------------------
  //
  // Real codes and titles, on the owner's explicit override for JOBS. Named
  // units stay fictional everywhere — that is the line the charter draws
  // (§3), and it is the right one: a job code is a job title, a named unit
  // is a body of real people with real casualties and living members.
  //
  // The branch IDS stay the preset's own ('land-forces' rather than
  // 'army'), so Classic keeps its fictional services and Real World Mode
  // keeps its real ones — one catalogue of jobs, whichever world you play.
  //
  // THE GATES AND BONUSES ARE GAME BALANCE, NOT FACT. They are not real
  // line-score minimums and not real bonus figures, and the spec says so
  // plainly. Bonuses are BASE-YEAR cents like every other wage (v88).
  {
    id: 'combat-engineer', title: 'combat engineer', officerTitle: 'engineer officer',
    branch: 'land-forces', requires: 'primary',
    code: '12B', field: 'combat', minAptitude: 40,
    bonusCents: dollars(6_000) as Money, combatWeight: 650,
    sceneTags: ['combat_breach', 'combat_patrol_ied', 'combat_firefight', 'base_defense'],
    schoolMonths: 3, qualification: 'demolitions rating', boardCutoffOffset: -20,
    exposure: { directCombat: 620, convoy: 380, baseAttack: 300, accident: 480 },
    civilianUnlocks: ['carpenter', 'labourer'],
  },
  {
    id: 'supply', title: 'supply specialist', officerTitle: 'logistics officer',
    branch: 'land-forces', requires: 'primary',
    code: '92Y', field: 'logistics', minAptitude: 40,
    bonusCents: dollars(3_000) as Money, combatWeight: 200,
    sceneTags: ['base_defense', 'work_maint_fault', 'combat_convoy_ambush'],
    schoolMonths: 2, qualification: 'supply rating', boardCutoffOffset: 10,
    exposure: { directCombat: 60, convoy: 220, baseAttack: 380, accident: 240 },
    civilianUnlocks: ['bookkeeper', 'clerk'],
  },
  {
    id: 'military-police', title: 'military police', officerTitle: 'provost officer',
    branch: 'land-forces', requires: 'secondary',
    code: '31B', field: 'combat', minAptitude: 45,
    bonusCents: dollars(5_000) as Money, combatWeight: 450,
    sceneTags: ['base_defense', 'combat_firefight', 'combat_patrol_ied'],
    schoolMonths: 3, qualification: 'law enforcement rating', boardCutoffOffset: 0,
    exposure: { directCombat: 400, convoy: 260, baseAttack: 520, accident: 260 },
    civilianUnlocks: ['constable'],
  },
  {
    id: 'intel-analyst', title: 'intelligence analyst', officerTitle: 'intelligence officer',
    branch: 'land-forces', requires: 'secondary',
    code: '35F', field: 'intel', minAptitude: 90,
    bonusCents: dollars(12_000) as Money, combatWeight: 300,
    sceneTags: ['ops_center_crisis', 'cyber_incident', 'comms_blackout', 'base_defense'],
    schoolMonths: 6, qualification: 'all-source rating', boardCutoffOffset: 50,
    exposure: { directCombat: 90, convoy: 120, baseAttack: 420, accident: 180 },
    civilianUnlocks: ['clerk', 'bookkeeper'],
  },
  {
    id: 'gunners-mate', title: "gunner's mate", officerTitle: 'weapons officer',
    branch: 'naval-service', requires: 'primary',
    code: 'GM', field: 'ordnance', minAptitude: 45,
    bonusCents: dollars(7_000) as Money, combatWeight: 500,
    sceneTags: ['sea_general_quarters', 'sea_smallboat_attack', 'munitions_mishap', 'sea_fire_aboard'],
    schoolMonths: 3, qualification: 'ordnance rating', boardCutoffOffset: 0,
    exposure: { directCombat: 300, convoy: 40, baseAttack: 480, accident: 520 },
    civilianUnlocks: ['machinist'],
  },
  {
    id: 'corpsman', title: 'hospital corpsman', officerTitle: 'medical officer',
    branch: 'naval-service', requires: 'secondary',
    code: 'HM', field: 'medical', minAptitude: 55,
    bonusCents: dollars(11_000) as Money, combatWeight: 550,
    sceneTags: ['med_masscas', 'med_treat_under_fire', 'combat_rescue', 'sea_general_quarters'],
    schoolMonths: 5, qualification: 'corpsman rating', boardCutoffOffset: 30,
    exposure: { directCombat: 320, convoy: 200, baseAttack: 380, accident: 300 },
    civilianUnlocks: ['nurse', 'aide'],
  },
  {
    id: 'master-at-arms', title: 'master-at-arms', officerTitle: 'security officer',
    branch: 'naval-service', requires: 'primary',
    code: 'MA', field: 'combat', minAptitude: 40,
    bonusCents: dollars(5_000) as Money, combatWeight: 450,
    sceneTags: ['base_defense', 'sea_general_quarters', 'sea_smallboat_attack'],
    schoolMonths: 3, qualification: 'security rating', boardCutoffOffset: 0,
    exposure: { directCombat: 260, convoy: 60, baseAttack: 520, accident: 280 },
    civilianUnlocks: ['constable'],
  },
  {
    id: 'electronics-tech', title: 'electronics technician', officerTitle: 'systems officer',
    branch: 'naval-service', requires: 'secondary',
    code: 'ET', field: 'technical', minAptitude: 75,
    bonusCents: dollars(9_000) as Money, combatWeight: 200,
    sceneTags: ['sea_fire_aboard', 'comms_blackout', 'work_critical_repair', 'sea_general_quarters'],
    schoolMonths: 6, qualification: 'electronics rating', boardCutoffOffset: 40,
    exposure: { directCombat: 60, convoy: 20, baseAttack: 420, accident: 420 },
    civilianUnlocks: ['electrician', 'machinist'],
  },
  {
    id: 'cryptologic-tech', title: 'cryptologic technician', officerTitle: 'cryptologic officer',
    branch: 'naval-service', requires: 'secondary',
    code: 'CTN', field: 'intel', minAptitude: 90,
    bonusCents: dollars(13_000) as Money, combatWeight: 250,
    sceneTags: ['cyber_incident', 'ops_center_crisis', 'comms_blackout', 'sea_fire_aboard'],
    schoolMonths: 7, qualification: 'cryptologic rating', boardCutoffOffset: 55,
    exposure: { directCombat: 40, convoy: 20, baseAttack: 400, accident: 220 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'security-forces', title: 'security forces airman', officerTitle: 'security forces officer',
    branch: 'air-guard', requires: 'primary',
    code: '3P0', field: 'combat', minAptitude: 40,
    bonusCents: dollars(5_000) as Money, combatWeight: 500,
    sceneTags: ['base_defense', 'combat_firefight', 'combat_patrol_ied'],
    schoolMonths: 3, qualification: 'air base defence rating', boardCutoffOffset: 0,
    exposure: { directCombat: 380, convoy: 180, baseAttack: 620, accident: 260 },
    civilianUnlocks: ['constable'],
  },
  {
    id: 'aircraft-maintainer', title: 'aircraft maintainer', officerTitle: 'maintenance officer',
    branch: 'air-guard', requires: 'secondary',
    code: '2A3', field: 'technical', minAptitude: 55,
    bonusCents: dollars(8_000) as Money, combatWeight: 300,
    sceneTags: ['air_flightline_fire', 'work_maint_fault', 'work_critical_repair', 'air_hardlanding'],
    schoolMonths: 5, qualification: 'crew chief rating', boardCutoffOffset: 30,
    exposure: { directCombat: 60, convoy: 40, baseAttack: 380, accident: 600 },
    civilianUnlocks: ['machinist', 'electrician'],
  },
  {
    id: 'munitions', title: 'munitions systems specialist', officerTitle: 'munitions officer',
    branch: 'air-guard', requires: 'primary',
    code: '2W0', field: 'ordnance', minAptitude: 50,
    bonusCents: dollars(7_000) as Money, combatWeight: 350,
    sceneTags: ['munitions_mishap', 'air_flightline_fire', 'base_defense', 'work_maint_fault'],
    schoolMonths: 4, qualification: 'munitions rating', boardCutoffOffset: 20,
    exposure: { directCombat: 80, convoy: 60, baseAttack: 420, accident: 640 },
    civilianUnlocks: ['machinist'],
  },
  {
    id: 'aeromedical', title: 'aeromedical technician', officerTitle: 'flight medical officer',
    branch: 'air-guard', requires: 'secondary',
    code: '4N0', field: 'medical', minAptitude: 55,
    bonusCents: dollars(9_000) as Money, combatWeight: 400,
    sceneTags: ['med_masscas', 'combat_rescue', 'med_treat_under_fire', 'air_hardlanding'],
    schoolMonths: 5, qualification: 'aeromedical rating', boardCutoffOffset: 30,
    exposure: { directCombat: 140, convoy: 120, baseAttack: 360, accident: 420 },
    civilianUnlocks: ['nurse', 'aide'],
  },
  {
    id: 'cyber-ops', title: 'cyberspace operator', officerTitle: 'cyberspace operations officer',
    branch: 'air-guard', requires: 'secondary',
    code: '3D0', field: 'technical', minAptitude: 80,
    bonusCents: dollars(11_000) as Money, combatWeight: 150,
    sceneTags: ['cyber_incident', 'comms_blackout', 'ops_center_crisis', 'work_critical_repair'],
    schoolMonths: 6, qualification: 'cyber operations rating', boardCutoffOffset: 50,
    exposure: { directCombat: 20, convoy: 20, baseAttack: 340, accident: 160 },
    civilianUnlocks: ['clerk', 'engineer'],
  },
]


/**
 * M-ENLIST §5c. THE OFFICER CATALOGUE.
 *
 * A separate list from the trades because an officer holds a separate kind
 * of job: an infantryman is 11B and the officer commanding them is 11A, and
 * the second job is the first one's command rather than a senior version of
 * it. Real codes, on the owner's override for jobs; named units stay
 * fictional everywhere.
 *
 * `competitive` marks the seats a branch selects for rather than assigns —
 * flying and special warfare — and those run a seeded board on top of
 * whatever the branch's accession rule already does.
 *
 * THE CODES ARE DRAFTED FROM GENERAL KNOWLEDGE and are the spec's own
 * "verify before shipping" list. They are job titles, not claims about a
 * real organisation's current structure.
 */
export const OFFICER_ROLES: readonly OfficerRole[] = [
  // --- the ground service ------------------------------------------------
  {
    id: 'of-infantry', code: '11A', title: 'infantry officer', field: 'combat',
    branch: 'land-forces', combatWeight: 800,
    sceneTags: ['combat_firefight', 'combat_breach', 'combat_convoy_ambush', 'combat_patrol_ied'],
    exposure: { directCombat: 820, convoy: 320, baseAttack: 320, accident: 300 },
    civilianUnlocks: ['constable'],
  },
  {
    id: 'of-armor', code: '19A', title: 'armor officer', field: 'combat',
    branch: 'land-forces', combatWeight: 700,
    sceneTags: ['combat_firefight', 'combat_convoy_ambush', 'combat_patrol_ied', 'work_maint_fault'],
    exposure: { directCombat: 700, convoy: 420, baseAttack: 300, accident: 420 },
    civilianUnlocks: ['machinist'],
  },
  {
    id: 'of-artillery', code: '13A', title: 'field artillery officer', field: 'combat',
    branch: 'land-forces', combatWeight: 600,
    sceneTags: ['combat_firefight', 'base_defense', 'munitions_mishap', 'ops_center_crisis'],
    exposure: { directCombat: 520, convoy: 300, baseAttack: 380, accident: 420 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-aviation', code: '15A', title: 'aviation officer', field: 'aviation',
    branch: 'land-forces', combatWeight: 500, competitive: true, minAptitude: 70,
    sceneTags: ['air_emergency_landing', 'air_crash', 'air_hardlanding', 'air_flightline_fire'],
    exposure: { directCombat: 260, convoy: 0, baseAttack: 300, accident: 720 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-engineer', code: '12A', title: 'engineer officer', field: 'combat',
    branch: 'land-forces', combatWeight: 550,
    sceneTags: ['combat_breach', 'combat_patrol_ied', 'work_critical_repair', 'base_defense'],
    exposure: { directCombat: 520, convoy: 360, baseAttack: 320, accident: 460 },
    civilianUnlocks: ['engineer', 'carpenter'],
  },
  {
    id: 'of-signal', code: '25A', title: 'signal officer', field: 'technical',
    branch: 'land-forces', combatWeight: 250,
    sceneTags: ['comms_blackout', 'cyber_incident', 'ops_center_crisis', 'base_defense'],
    exposure: { directCombat: 80, convoy: 140, baseAttack: 400, accident: 200 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-intelligence', code: '35D', title: 'military intelligence officer', field: 'intel',
    branch: 'land-forces', combatWeight: 300, minAptitude: 80,
    sceneTags: ['ops_center_crisis', 'cyber_incident', 'comms_blackout', 'base_defense'],
    exposure: { directCombat: 100, convoy: 140, baseAttack: 420, accident: 180 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'of-logistics', code: '90A', title: 'logistics officer', field: 'logistics',
    branch: 'land-forces', combatWeight: 250,
    sceneTags: ['combat_convoy_ambush', 'base_defense', 'work_maint_fault', 'ops_center_crisis'],
    exposure: { directCombat: 90, convoy: 460, baseAttack: 340, accident: 300 },
    civilianUnlocks: ['bookkeeper', 'accountant'],
  },
  {
    id: 'of-provost', code: '31A', title: 'military police officer', field: 'combat',
    branch: 'land-forces', combatWeight: 400,
    sceneTags: ['base_defense', 'combat_firefight', 'combat_patrol_ied', 'ops_center_crisis'],
    exposure: { directCombat: 360, convoy: 260, baseAttack: 500, accident: 260 },
    civilianUnlocks: ['constable', 'sergeant'],
  },
  {
    id: 'of-medical-corps', code: '60A', title: 'medical corps officer', field: 'medical',
    branch: 'land-forces', combatWeight: 400, minAptitude: 75,
    sceneTags: ['med_masscas', 'med_treat_under_fire', 'combat_rescue', 'base_defense'],
    exposure: { directCombat: 200, convoy: 240, baseAttack: 360, accident: 240 },
    civilianUnlocks: ['doctor', 'nurse'],
  },

  // --- the naval service --------------------------------------------------
  {
    id: 'of-surface-warfare', code: '1110', title: 'surface warfare officer', field: 'combat',
    branch: 'naval-service', combatWeight: 450,
    sceneTags: ['sea_general_quarters', 'sea_smallboat_attack', 'sea_fire_aboard', 'sea_manoverboard'],
    exposure: { directCombat: 300, convoy: 40, baseAttack: 480, accident: 520 },
    civilianUnlocks: ['manager'],
  },
  {
    id: 'of-naval-aviator', code: '1310', title: 'naval aviator', field: 'aviation',
    branch: 'naval-service', combatWeight: 550, competitive: true, minAptitude: 75,
    sceneTags: ['air_emergency_landing', 'air_crash', 'sea_flightdeck_hazard', 'air_hardlanding'],
    exposure: { directCombat: 280, convoy: 0, baseAttack: 300, accident: 760 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-flight-officer', code: '1320', title: 'naval flight officer', field: 'aviation',
    branch: 'naval-service', combatWeight: 500, minAptitude: 70,
    sceneTags: ['air_emergency_landing', 'sea_flightdeck_hazard', 'air_hardlanding', 'ops_center_crisis'],
    exposure: { directCombat: 260, convoy: 0, baseAttack: 300, accident: 700 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-submarine', code: '1120', title: 'submarine officer', field: 'technical',
    branch: 'naval-service', combatWeight: 300, minAptitude: 85,
    sceneTags: ['sea_fire_aboard', 'sea_general_quarters', 'work_critical_repair', 'comms_blackout'],
    exposure: { directCombat: 140, convoy: 0, baseAttack: 380, accident: 560 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-special-warfare', code: '1130', title: 'special warfare officer', field: 'combat',
    branch: 'naval-service', combatWeight: 850, competitive: true, minAptitude: 75,
    sceneTags: ['combat_firefight', 'combat_breach', 'combat_rescue', 'sea_smallboat_attack'],
    exposure: { directCombat: 880, convoy: 220, baseAttack: 300, accident: 420 },
    civilianUnlocks: ['constable'],
  },
  {
    id: 'of-supply-corps', code: '3100', title: 'supply corps officer', field: 'logistics',
    branch: 'naval-service', combatWeight: 200,
    sceneTags: ['sea_fire_aboard', 'ops_center_crisis', 'work_maint_fault', 'sea_general_quarters'],
    exposure: { directCombat: 60, convoy: 60, baseAttack: 400, accident: 320 },
    civilianUnlocks: ['accountant', 'bookkeeper'],
  },
  {
    id: 'of-naval-intelligence', code: '1830', title: 'naval intelligence officer', field: 'intel',
    branch: 'naval-service', combatWeight: 250, minAptitude: 80,
    sceneTags: ['ops_center_crisis', 'cyber_incident', 'comms_blackout', 'sea_general_quarters'],
    exposure: { directCombat: 60, convoy: 20, baseAttack: 400, accident: 220 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'of-cryptologic-warfare', code: '1810', title: 'cryptologic warfare officer', field: 'intel',
    branch: 'naval-service', combatWeight: 200, minAptitude: 85,
    sceneTags: ['cyber_incident', 'comms_blackout', 'ops_center_crisis', 'sea_fire_aboard'],
    exposure: { directCombat: 40, convoy: 20, baseAttack: 380, accident: 200 },
    civilianUnlocks: ['engineer', 'clerk'],
  },

  // --- the air service ----------------------------------------------------
  {
    id: 'of-pilot', code: '11X', title: 'pilot', field: 'aviation',
    branch: 'air-guard', combatWeight: 600, competitive: true, minAptitude: 78,
    sceneTags: ['air_emergency_landing', 'air_crash', 'air_hardlanding', 'air_flightline_fire'],
    exposure: { directCombat: 300, convoy: 0, baseAttack: 280, accident: 780 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-combat-systems', code: '12X', title: 'combat systems officer', field: 'aviation',
    branch: 'air-guard', combatWeight: 520, minAptitude: 72,
    sceneTags: ['air_emergency_landing', 'air_hardlanding', 'ops_center_crisis', 'air_flightline_fire'],
    exposure: { directCombat: 260, convoy: 0, baseAttack: 300, accident: 700 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-air-battle-manager', code: '13B', title: 'air battle manager', field: 'technical',
    branch: 'air-guard', combatWeight: 300, minAptitude: 70,
    sceneTags: ['ops_center_crisis', 'comms_blackout', 'air_emergency_landing', 'base_defense'],
    exposure: { directCombat: 120, convoy: 0, baseAttack: 340, accident: 440 },
    civilianUnlocks: ['manager'],
  },
  {
    id: 'of-air-intelligence', code: '14N', title: 'intelligence officer', field: 'intel',
    branch: 'air-guard', combatWeight: 250, minAptitude: 80,
    sceneTags: ['ops_center_crisis', 'cyber_incident', 'comms_blackout', 'base_defense'],
    exposure: { directCombat: 60, convoy: 40, baseAttack: 380, accident: 180 },
    civilianUnlocks: ['clerk'],
  },
  {
    id: 'of-cyber-ops', code: '17X', title: 'cyberspace operations officer', field: 'technical',
    branch: 'air-guard', combatWeight: 180, minAptitude: 82,
    sceneTags: ['cyber_incident', 'comms_blackout', 'ops_center_crisis', 'work_critical_repair'],
    exposure: { directCombat: 20, convoy: 20, baseAttack: 340, accident: 160 },
    civilianUnlocks: ['engineer'],
  },
  {
    id: 'of-security-forces', code: '31P', title: 'security forces officer', field: 'combat',
    branch: 'air-guard', combatWeight: 480,
    sceneTags: ['base_defense', 'combat_firefight', 'combat_patrol_ied', 'ops_center_crisis'],
    exposure: { directCombat: 400, convoy: 200, baseAttack: 600, accident: 260 },
    civilianUnlocks: ['constable', 'sergeant'],
  },
  {
    id: 'of-logistics-readiness', code: '21R', title: 'logistics readiness officer', field: 'logistics',
    branch: 'air-guard', combatWeight: 220,
    sceneTags: ['work_maint_fault', 'base_defense', 'ops_center_crisis', 'air_flightline_fire'],
    exposure: { directCombat: 60, convoy: 300, baseAttack: 360, accident: 340 },
    civilianUnlocks: ['manager', 'bookkeeper'],
  },
  {
    id: 'of-flight-surgeon', code: '48G', title: 'flight surgeon', field: 'medical',
    branch: 'air-guard', combatWeight: 300, minAptitude: 78,
    sceneTags: ['med_masscas', 'combat_rescue', 'air_hardlanding', 'med_treat_under_fire'],
    exposure: { directCombat: 120, convoy: 100, baseAttack: 340, accident: 380 },
    civilianUnlocks: ['doctor'],
  },
]

export function officerRoleById(id: string): OfficerRole | undefined {
  return OFFICER_ROLES.find((role) => role.id === id)
}

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
/**
 * THE JOBS A CRIMINAL RECORD CLOSES (ADR-0033, owner: "it also doesn't seem
 * like convictions are affecting people's ability to get jobs").
 *
 * He was right. The record dragged the odds that an opportunity turned up
 * at all, and did nothing else — so a convicted felon could still be hired
 * as the town constable, teach its children, or count its money.
 *
 * These are the roles that in practice require a clean record: a licence, a
 * badge, a duty of care, or somebody else's money. Everything NOT on this
 * list stays open, which is the important half — Law 7 says failure creates
 * a chapter, not a dead end, and a man with a conviction can still lay
 * bricks, cook, drive, and run a crew.
 */
export const TRUST_SENSITIVE_OCCUPATIONS: readonly string[] = [
  // Sworn. A conviction and a badge do not go together anywhere.
  'constable', 'sergeant', 'police-chief',
  // Children.
  'teacher', 'department-head', 'assistant-principal', 'principal',
  // Licensed care. The licence is the gate, not the employer.
  'nurse', 'charge-nurse', 'nurse-manager', 'aide',
  'doctor', 'resident', 'chief-of-medicine', 'pharmacist',
  // Other people's money.
  'bookkeeper', 'accountant', 'senior-accountant', 'partner',
]

export function isTrustSensitive(occupationId: string): boolean {
  return TRUST_SENSITIVE_OCCUPATIONS.includes(occupationId)
}

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
    category: 'skill', difficulty: 40, seatScarcity: 120, maxAttempts: 3,
    minFitness: 380,
  },
  {
    id: 'flight-school', title: 'Flight School', branches: ['air-guard'], specialtyIds: ['aviator'],
    minRank: 1, minPerformance: 500, badge: 'senior aviator', performanceBoost: 60,
    courseMonths: 9, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 380, seatScarcity: 620, maxAttempts: 2, recycleAllowed: true,
    minAptitude: 620, minFitness: 420, pointsBonus: 30,
  },
  {
    id: 'air-assault', title: 'Air Assault School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 1, minPerformance: 450, badge: 'air assault', performanceBoost: 40,
    courseMonths: 1, classCadenceMonths: 3, seatsPerClass: 4,
    category: 'skill', difficulty: 170, seatScarcity: 160, maxAttempts: 3,
    minFitness: 420,
  },
  {
    id: 'sniper-school', title: 'Sniper School', branches: ['land-forces'], specialtyIds: ['rifleman'],
    minRank: 2, minPerformance: 600, badge: 'sniper qualified', performanceBoost: 60,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 420, seatScarcity: 520, maxAttempts: 2, recycleAllowed: true,
    minTimeInServiceMonths: 24, minAptitude: 560, minFitness: 480, pointsBonus: 20,
  },
  {
    id: 'pathfinder-school', title: 'Pathfinder School', branches: ['land-forces'], specialtyIds: [],
    minRank: 2, minPerformance: 550, badge: 'pathfinder', performanceBoost: 50,
    courseMonths: 1, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 300, seatScarcity: 400, maxAttempts: 2, recycleAllowed: true,
    minFitness: 450, prereqBadges: ['parachutist'],
  },
  {
    id: 'freefall', title: 'Military Freefall School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 3, minPerformance: 620, badge: 'military freefall', performanceBoost: 55,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 260, seatScarcity: 460, maxAttempts: 2,
    minFitness: 470, prereqBadges: ['parachutist'],
  },
  {
    id: 'sere', title: 'SERE School', branches: [], specialtyIds: [],
    minRank: 2, minPerformance: 520, badge: 'SERE qualified', performanceBoost: 45,
    courseMonths: 1, classCadenceMonths: 4, seatsPerClass: 3,
    category: 'skill', difficulty: 200, seatScarcity: 300, maxAttempts: 2,
    minTimeInServiceMonths: 18,
  },
  {
    id: 'combat-diver', title: 'the Combat Diver Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 2, minPerformance: 550, badge: 'combat diver', performanceBoost: 50,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 460, seatScarcity: 540, maxAttempts: 2, recycleAllowed: true,
    minFitness: 520, pointsBonus: 20,
  },
  {
    id: 'eod', title: 'EOD School', branches: [], specialtyIds: [],
    minRank: 2, minPerformance: 620, badge: 'explosive ordnance disposal', performanceBoost: 60,
    courseMonths: 6, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 400, seatScarcity: 500, maxAttempts: 2, recycleAllowed: true,
    minAptitude: 640, minFitness: 430, pointsBonus: 25,
  },
  {
    id: 'combat-medic', title: 'the Combat Medic Course', branches: [], specialtyIds: ['medic'],
    minRank: 2, minPerformance: 560, badge: 'combat medic', performanceBoost: 55,
    courseMonths: 4, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 240, seatScarcity: 340, maxAttempts: 3,
    minAptitude: 580,
  },
  {
    id: 'jumpmaster', title: 'Jumpmaster School', branches: ['land-forces', 'air-guard'], specialtyIds: [],
    minRank: 4, minPerformance: 620, badge: 'jumpmaster', performanceBoost: 55,
    courseMonths: 1, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'skill', difficulty: 330, seatScarcity: 430, maxAttempts: 2, recycleAllowed: true,
    minTimeInServiceMonths: 36, prereqBadges: ['parachutist'],
  },
  {
    id: 'mountain-warfare', title: 'the Mountain Warfare Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 2, minPerformance: 540, badge: 'mountain warfare', performanceBoost: 45,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 3,
    category: 'skill', difficulty: 230, seatScarcity: 330, maxAttempts: 3,
    minFitness: 450,
  },
  {
    id: 'ranger-school', title: 'Ranger School', branches: ['land-forces'], specialtyIds: [],
    minRank: 3, minPerformance: 650, badge: 'ranger', performanceBoost: 70,
    courseMonths: 2, classCadenceMonths: 4, seatsPerClass: 2,
    category: 'skill', difficulty: 500, seatScarcity: 560, maxAttempts: 2, recycleAllowed: true,
    minTimeInServiceMonths: 24, minFitness: 520, pointsBonus: 40,
  },
  {
    id: 'leaders-course', title: 'the Junior Leaders Course', branches: [], specialtyIds: [],
    minRank: 4, minPerformance: 500, badge: 'small-unit leader', performanceBoost: 50,
    courseMonths: 1, classCadenceMonths: 4, seatsPerClass: 3,
    category: 'pme', difficulty: 70, seatScarcity: 220, maxAttempts: 4,
  },
  {
    id: 'sf-qualification', title: 'the Special Forces Qualification Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 4, minPerformance: 700, badge: 'special forces', performanceBoost: 80,
    courseMonths: 12, classCadenceMonths: 12, seatsPerClass: 1,
    category: 'selection', difficulty: 620, seatScarcity: 780, maxAttempts: 2, recycleAllowed: true,
    minTimeInServiceMonths: 36, minAptitude: 620, minFitness: 540, pointsBonus: 50,
  },
  // ---- PROFESSIONAL MILITARY EDUCATION (M-PROMO) ----------------------
  //
  // The schools that gate PROMOTION, as distinct from the accession schools
  // that get you in and the skill courses that pin a badge on. Each one
  // gates its own pay grade, the classic mapping the owner's spec
  // recommends (see ServiceSchool.gatesGrade for why, and for the 2024
  // caveat).
  //
  // Real course names are nominative use and fine per charter §3. Their
  // crests and patches are NOT reproduced — the marks are invented, the way
  // every other badge in this game is.
  //
  // Low difficulty by design: the spec is explicit that PME rarely washes
  // anybody out, and that the real challenge is getting the seat in time to
  // promote. The scarcity is where the pressure lives.
  //
  // AND THE ENTRY BAR SITS BELOW THE PROMOTION IT GATES. MEASURED, and the
  // first numbers were a death spiral: a course needing 470 performance to
  // walk into gated a rank that used to be won on promotion POINTS, where
  // seniority, badges and decorations could carry a middling evaluation. So
  // the ordinary soldier could no longer make sergeant at all, sat at
  // corporal until high-year tenure removed him, and the town's NCO ranks
  // emptied — 45 tenure discharges in one forty-year run, and one sergeant
  // left standing out of fifteen serving. A school is education. The
  // selection happens at the board, which is where it belongs.

  // Army — the NCO Professional Development System.
  {
    id: 'blc', title: 'the Basic Leader Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 4, minPerformance: 400, badge: 'basic leader', performanceBoost: 45,
    courseMonths: 1, classCadenceMonths: 2, seatsPerClass: 6,
    category: 'pme', difficulty: 60, seatScarcity: 200, maxAttempts: 4, gatesGrade: 5,
  },
  {
    id: 'alc', title: 'the Advanced Leader Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 5, minPerformance: 470, badge: 'advanced leader', performanceBoost: 50,
    courseMonths: 2, classCadenceMonths: 3, seatsPerClass: 4,
    category: 'pme', difficulty: 70, seatScarcity: 260, maxAttempts: 4, gatesGrade: 6,
  },
  {
    id: 'slc', title: 'the Senior Leader Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 6, minPerformance: 530, badge: 'senior leader', performanceBoost: 55,
    courseMonths: 2, classCadenceMonths: 4, seatsPerClass: 3,
    category: 'pme', difficulty: 80, seatScarcity: 340, maxAttempts: 3, gatesGrade: 7,
  },
  {
    id: 'mlc', title: 'the Master Leader Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 7, minPerformance: 580, badge: 'master leader', performanceBoost: 60,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'pme', difficulty: 90, seatScarcity: 430, maxAttempts: 3, gatesGrade: 8,
  },
  {
    id: 'smc', title: 'the Sergeants Major Course', branches: ['land-forces'], specialtyIds: [],
    minRank: 8, minPerformance: 630, badge: 'sergeants major course', performanceBoost: 70,
    courseMonths: 10, classCadenceMonths: 12, seatsPerClass: 1,
    category: 'pme', difficulty: 100, seatScarcity: 560, maxAttempts: 2, gatesGrade: 9,
  },

  // Navy — the Leader Development continuum, then the academy.
  {
    id: 'fldc', title: 'the Foundational Leader Development Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 2, minPerformance: 380, badge: 'foundational leader', performanceBoost: 40,
    courseMonths: 1, classCadenceMonths: 2, seatsPerClass: 6,
    category: 'pme', difficulty: 50, seatScarcity: 180, maxAttempts: 4, gatesGrade: 4,
  },
  {
    id: 'ildc', title: 'the Intermediate Leader Development Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 3, minPerformance: 400, badge: 'intermediate leader', performanceBoost: 45,
    courseMonths: 1, classCadenceMonths: 3, seatsPerClass: 5,
    category: 'pme', difficulty: 60, seatScarcity: 240, maxAttempts: 4, gatesGrade: 5,
  },
  {
    id: 'aldc', title: 'the Advanced Leader Development Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 4, minPerformance: 470, badge: 'advanced leader development', performanceBoost: 50,
    courseMonths: 2, classCadenceMonths: 4, seatsPerClass: 4,
    category: 'pme', difficulty: 70, seatScarcity: 300, maxAttempts: 4, gatesGrade: 6,
  },
  {
    id: 'cpo-ldc', title: 'the Chief Petty Officer Leader Development Course', branches: ['naval-service'], specialtyIds: [],
    minRank: 5, minPerformance: 540, badge: 'chief petty officer course', performanceBoost: 60,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 3,
    category: 'pme', difficulty: 85, seatScarcity: 400, maxAttempts: 3, gatesGrade: 7,
  },
  {
    id: 'sea', title: 'the Senior Enlisted Academy', branches: ['naval-service'], specialtyIds: [],
    minRank: 6, minPerformance: 590, badge: 'senior enlisted academy', performanceBoost: 70,
    courseMonths: 3, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'pme', difficulty: 95, seatScarcity: 500, maxAttempts: 3, gatesGrade: 8,
  },

  // Air — Airman Leadership School, then the academies.
  {
    id: 'als', title: 'Airman Leadership School', branches: ['air-guard'], specialtyIds: [],
    minRank: 3, minPerformance: 400, badge: 'airman leadership', performanceBoost: 45,
    courseMonths: 1, classCadenceMonths: 2, seatsPerClass: 6,
    category: 'pme', difficulty: 60, seatScarcity: 200, maxAttempts: 4, gatesGrade: 5,
  },
  {
    id: 'ncoa', title: 'the NCO Academy', branches: ['air-guard'], specialtyIds: [],
    minRank: 5, minPerformance: 520, badge: 'nco academy', performanceBoost: 55,
    courseMonths: 2, classCadenceMonths: 4, seatsPerClass: 4,
    category: 'pme', difficulty: 75, seatScarcity: 320, maxAttempts: 3, gatesGrade: 7,
  },
  {
    id: 'sncoa', title: 'the Senior NCO Academy', branches: ['air-guard'], specialtyIds: [],
    minRank: 6, minPerformance: 570, badge: 'senior nco academy', performanceBoost: 65,
    courseMonths: 2, classCadenceMonths: 6, seatsPerClass: 2,
    category: 'pme', difficulty: 90, seatScarcity: 440, maxAttempts: 3, gatesGrade: 8,
  },
  {
    id: 'clc', title: 'the Chief Leadership Course', branches: ['air-guard'], specialtyIds: [],
    minRank: 7, minPerformance: 620, badge: 'chief leadership', performanceBoost: 70,
    courseMonths: 2, classCadenceMonths: 12, seatsPerClass: 1,
    category: 'pme', difficulty: 100, seatScarcity: 560, maxAttempts: 2, gatesGrade: 9,
  },
]

/**
 * M-PROMO. THE LEADERSHIP BILLETS — a title over a pay grade, not a rank.
 *
 * Keyed by branch, then by the pay grade the billet sits at. Held for a
 * tour and then given up, at which point the holder is a master sergeant
 * again (owner's spec §3: "revert on leaving the billet").
 *
 * The air force's First Sergeant is a special duty rather than a command
 * seat and is held lower down the ladder, which is why it sits at E-7 here
 * while the command billets sit at the top of each ladder.
 */
export const BRANCH_BILLETS: Readonly<
  Record<ServiceBranch, Readonly<Record<number, { readonly abbr: string; readonly title: string }>>>
> = {
  'land-forces': {
    8: { abbr: '1SG', title: 'First Sergeant' },
    9: { abbr: 'CSM', title: 'Command Sergeant Major' },
  },
  'naval-service': {
    9: { abbr: 'CMC', title: 'Command Master Chief' },
  },
  'air-guard': {
    7: { abbr: 'First Sergeant', title: 'First Sergeant' },
    9: { abbr: 'CCM', title: 'Command Chief Master Sergeant' },
  },
}

/** How long a billet is held before it goes to somebody else. */
export const BILLET_TOUR_MONTHS = 36

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
    selectionDenominator: 500, dutyPay: dollars(45), exposureMultiplier: 1250,
  },
  {
    id: 'trident', name: 'the Trident Detachment', tier: 1,
    branches: ['naval-service'], minRank: 2, minPerformance: 560,
    requiredBadges: ['combat diver'], feederUnitId: null,
    selectionDenominator: 520, dutyPay: dollars(45), exposureMultiplier: 1250,
  },
  {
    id: 'guardian-flight', name: 'the Guardian Flight', tier: 1,
    branches: ['air-guard'], minRank: 2, minPerformance: 560,
    requiredBadges: ['military freefall'], feederUnitId: null,
    selectionDenominator: 520, dutyPay: dollars(45), exposureMultiplier: 1200,
  },
  {
    // The pack's aviation unit. Tier 2 and fed by the Guardian Flight: the
    // people who fly the quiet tier's aircraft come from the quiet tier.
    id: 'nighthawks', name: 'the Nighthawk Squadron', tier: 2,
    branches: ['air-guard'], minRank: 4, minPerformance: 700,
    requiredBadges: ['senior aviator'], feederUnitId: 'guardian-flight',
    selectionDenominator: 900, dutyPay: dollars(119), exposureMultiplier: 1450,
  },
  {
    id: 'vanguard', name: 'the Vanguard Group', tier: 2,
    branches: ['land-forces'], minRank: 4, minPerformance: 700,
    requiredBadges: ['special forces'], feederUnitId: 'pathfinders',
    selectionDenominator: 850, dutyPay: dollars(104), exposureMultiplier: 1450,
  },
  {
    id: 'task-unit-ember', name: 'Task Unit Ember', tier: 2,
    branches: ['naval-service'], minRank: 5, minPerformance: 720,
    requiredBadges: ['combat diver'], feederUnitId: 'trident',
    selectionDenominator: 900, dutyPay: dollars(119), exposureMultiplier: 1500,
  },
  {
    id: 'grey-section', name: 'the Grey Section', tier: 3,
    branches: [], minRank: 6, minPerformance: 800,
    requiredBadges: [], feederUnitId: null,
    selectionDenominator: 1400, dutyPay: dollars(75), exposureMultiplier: 1600,
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
