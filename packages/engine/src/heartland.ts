/**
 * The American Heartland preset. W2 (ADR-0020, docs/WORLD_MODES_PLAN.md).
 *
 * A small town in a real American county, in the real United States, with
 * real service branches — and with every ruling in WORLD_MODES_PLAN.md's
 * table applied line by line. What is REAL here, what is FICTIONAL, and why:
 *
 *   REAL. The state and the county (public facts, and the charter has always
 *   said "a realistic simulated United States"). The homeland: the United
 *   States. The service branches, BY NAME ONLY — nominative use in an
 *   expressive work — never their insignia, emblems or seals, which are
 *   licensed. The two installations, which are facts about government
 *   property, named as they were in this preset's own era.
 *
 *   FICTIONAL, permanently, in this preset as in every other. Every FOREIGN
 *   nation and every war: generated wars against real countries would put
 *   fabricated history onto permanent records, and real casualties would
 *   become a mechanic (R-14, MILITARY_AND_WAR_FOUNDATION §3 as amended).
 *   Every named unit, for the same reason at human scale: a real one has
 *   living members, and this simulation kills, wounds and disgraces the
 *   people in it. Every decoration. The town itself, its streets and its
 *   workplaces — a real small town implies real residents and real
 *   businesses, and this world bankrupts, injures and convicts them.
 *
 * NOT DONE, and deliberately not faked: the plan asks for ERA-WEIGHTED name
 * pools. This preset reuses the 1990-census-derived pools that Classic
 * uses, because era-specific frequency data is data — inventing plausible
 * 1940s weights would be inventing a fact, and the whole point of the
 * weighting is that it is true. The pools are correct-shaped and the
 * weights are honest for the decade they came from; supplying era tables is
 * a content task, not an engineering one.
 */

import {
  CLASSIC_BRANCHES,
  NATION_NAMES,
  SERVICE_SCHOOLS,
  SPECIAL_UNITS,
  SPECIALTIES,
} from './content.js'
import {
  FAMILY_NAME_WEIGHTS,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  FEMALE_GIVEN_WEIGHTS,
  MALE_GIVEN_NAMES,
  MALE_GIVEN_WEIGHTS,
} from './names.js'
import type { ServiceBranchSpec, WorldSpec } from './types.js'

/**
 * The real frame. Vermillion County, Indiana is a real place; Ashcroft is
 * not, and no street or business below is either.
 */
export const HEARTLAND_STATE = 'Indiana'
export const HEARTLAND_COUNTY = 'Vermillion County'

/**
 * The services, by their real names, with the ladders this engine has
 * carried since M-GAMEDEPTH — which were modelled on the real US enlisted
 * structure by owner direction from the start. Nothing about the mechanics
 * changes here; only what the branches are called.
 *
 * NO INSIGNIA, EVER. Rank abbreviations are the vocabulary of a structure,
 * not artwork; emblems and seals are licensed and this project ships none.
 */
const HEARTLAND_BRANCHES: readonly ServiceBranchSpec[] = CLASSIC_BRANCHES.map((branch) => ({
  ...branch,
  name:
    branch.id === 'land-forces'
      ? 'the United States Army'
      : branch.id === 'naval-service'
        ? 'the United States Navy'
        : 'the United States Air Force',
}))

export const HEARTLAND_SPEC: WorldSpec = {
  id: 'american-heartland',
  name: 'American Heartland',
  startYear: 1970,

  // Real ordinary names, no real individuals — the same model as Classic,
  // and the same pools until era tables exist. See the header.
  maleGiven: { names: MALE_GIVEN_NAMES, weights: MALE_GIVEN_WEIGHTS },
  femaleGiven: { names: FEMALE_GIVEN_NAMES, weights: FEMALE_GIVEN_WEIGHTS },
  family: { names: FAMILY_NAMES, weights: FAMILY_NAME_WEIGHTS },

  gazetteer: {
    // A fictional town in a real county. The plan's ruling: a real small
    // town implies real residents.
    townName: 'Ashcroft',
    schoolName: 'Vermillion County Consolidated School',
    // Street names a Midwest county seat would plausibly carry, all
    // invented — a real address implies real occupants.
    neighbourhoods: [
      'Sycamore Street',
      'The Flats',
      'Dutch Hill',
      'Miller Addition',
      'Oakhurst',
      'Depot Row',
      'Prairie View',
      'Cedar Bend',
    ],
    // Invented businesses. The charter forbids real companies, and this
    // world bankrupts and injures the people who work in them.
    workplaces: [
      'the grain elevator',
      'the Wabash foundry',
      'Halloran Implement',
      "Rennick's grocery",
      'the county hospital',
      'the packing plant',
      'the lumber yard',
      'the diner on Main',
      'First County Savings',
      'the courthouse',
    ],
    civic: ['the county courthouse', 'the Carnegie library'],
    // Real installations, named as they stood in this preset's era. The
    // 2023 renamings are not modelled: a world that starts in 1970 should
    // use 1970's names, and renaming an installation mid-simulation is a
    // history this engine does not have.
    bases: ['Fort Benjamin Harrison', 'Grissom Air Force Base'],
    // A call sign in the American format for the region. Invented: a real
    // station is a real business with real employees.
    newsStation: 'WVCA',
  },

  homelandName: 'the United States',
  // FICTIONAL, permanently, in every preset. Not a shortcut — a generated
  // war against a real country would write fabricated history onto
  // permanent records, and real casualties would become a mechanic.
  foreignNations: NATION_NAMES,

  branches: HEARTLAND_BRANCHES,
  // Shared with Classic: trades, courses and units are structure, not world
  // identity — and named units are fictional in every preset by rule.
  specialties: SPECIALTIES,
  schools: SERVICE_SCHOOLS,
  units: SPECIAL_UNITS,
}
