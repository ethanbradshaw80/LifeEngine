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
 *   REAL, since ADR-0021 (owner direction). The foreign countries, with the
 *   alignments his own reference list gave them as their STARTING position.
 *
 *   FICTIONAL, permanently, in this preset as in every other. EVERY WAR:
 *   the engine generates conflicts from modelled pressure, and no real war,
 *   operation, battle or campaign name exists in this codebase or may be
 *   added — real countries are a setting, a real war is nobody's to invent
 *   around. Every named unit: a real one has living members, and this
 *   simulation kills, wounds and disgraces the people in it. Every
 *   decoration. The town itself, its streets and its workplaces — a real
 *   small town implies real residents and real businesses, and this world
 *   bankrupts, injures and convicts them.
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
import { REAL_NATIONS } from './realnations.js'
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
const HEARTLAND_BRANCH_NAMES: Readonly<Record<string, string>> = {
  'land-forces': 'the United States Army',
  'naval-service': 'the United States Navy',
  'air-guard': 'the United States Air Force',
}

const HEARTLAND_BRANCHES: readonly ServiceBranchSpec[] = CLASSIC_BRANCHES.map((branch) => {
  const name = HEARTLAND_BRANCH_NAMES[branch.id]
  // No catch-all. The first draft fell through to "the United States Air
  // Force", so adding a fourth branch to Classic — a legal additive change
  // under DETERMINISM §8 — would have silently shipped a SECOND air force
  // here (W2 review).
  if (name === undefined) {
    throw new Error(`American Heartland has no name for the branch '${branch.id}'`)
  }
  return { ...branch, name }
})

export const HEARTLAND_SPEC: WorldSpec = {
  id: 'american-heartland',
  name: 'American Heartland',
  description:
    'A town that does not exist, in Vermillion County, Indiana, which does. ' +
    'ALTERNATE HISTORY — read this bit: the countries are real, and EVERY WAR IN ' +
    'THIS WORLD IS INVENTED. Nothing that happens here happened. The simulation ' +
    'starts in 1970 and makes its own history from there, so a war with a real ' +
    'country is this game making something up, not an account of anything.',
  startYear: 1970,

  // Real ordinary names, no real individuals — the same model as Classic,
  // and the same pools until era tables exist. See the header.
  maleGiven: { names: MALE_GIVEN_NAMES, weights: MALE_GIVEN_WEIGHTS },
  femaleGiven: { names: FEMALE_GIVEN_NAMES, weights: FEMALE_GIVEN_WEIGHTS },
  family: { names: FAMILY_NAMES, weights: FAMILY_NAME_WEIGHTS },

  inGameNotice:
    'The countries are real. Every war here is invented — this world has made its own history since 1970.',

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
    // REAL INSTALLATIONS, from the owner's own reference list (2026-08-02),
    // filtered two ways.
    //
    // FIRST, BY ERA. This preset starts in 1970, so every name here is one
    // the installation actually carried then and carries again now: the
    // nine 2023 renamings were reverted in 2025, and "Fort Bragg", "Fort
    // Benning" and "Fort Hood" are correct at both ends of the run. Every
    // "Joint Base ..." on the list is excluded — those names date from
    // 2004-2010 and would be an anachronism for most of a century-long
    // world. So is Vandenberg Space Force Base (2021). The engine does not
    // model closures or renamings, and the preset does not pretend it
    // does; see the note in WORLD_MODES_PLAN.md.
    //
    // SECOND, BY BRANCH. This is the W2 review's must-fix: with real names,
    // posting a sailor to an army post stops being a harmless fiction and
    // becomes a false claim about a real place, written into a record that
    // is never rewritten. Every entry names the service that posts there.
    //
    // What is asserted about these places is only that people from this
    // town served at them. Nothing invented — no scandal, no incident, no
    // unit — is ever attached to one: the engine attaches misconduct to
    // PEOPLE, and no article or citation names an installation.
    bases: [
      { name: 'Fort Bragg', branches: ['land-forces'] },
      { name: 'Fort Campbell', branches: ['land-forces'] },
      { name: 'Fort Riley', branches: ['land-forces'] },
      { name: 'Naval Station Norfolk', branches: ['naval-service'] },
      { name: 'Naval Base San Diego', branches: ['naval-service'] },
      { name: 'Wright-Patterson Air Force Base', branches: ['air-guard'] },
      { name: 'Nellis Air Force Base', branches: ['air-guard'] },
    ],
    // A call sign in the American format. Invented: a real station is a
    // real business with real employees.
    //
    // WCJC in both presets by owner direction (2026-08-02) — the Heartland
    // preset had its own call sign, which meant the paper the player reads
    // changed identity depending on which world they started.
    newsStation: 'WCJC',
  },

  homelandName: 'the United States',
  /**
   * REAL COUNTRIES (owner direction, 2026-08-02; ADR-0021), with their
   * starting alignment from his own reference list.
   *
   * THE WARS ARE STILL INVENTED, and that is the whole of the line this
   * preset stands on. The engine generates every conflict from modelled
   * pressure — no real war, operation, battle or campaign name exists
   * anywhere in this codebase, and none may be added. When this world says
   * the United States is at war with Russia, it is reporting something the
   * simulation decided, in a world that has already diverged from ours, and
   * the preset says so in its own description and on the news screen.
   *
   * The alignments set the FIRST RUNG and nothing else — verified by the
   * review, which caught the first draft also putting every ally in the
   * homeland's BLOC, a thing that is never re-drawn and so would have
   * locked a seven-country alliance in place for the life of the world.
   * They decide where each pair starts relative to the homeland on tick
   * zero. The ladder starts moving in month one, and an ally can end up at
   * war.
   */
  foreignNations: REAL_NATIONS.map((nation) => ({
    name: nation.name,
    alignment: nation.alignment,
    combatRating: nation.combatRating,
  })),

  branches: HEARTLAND_BRANCHES,
  // Shared with Classic: trades, courses and units are structure, not world
  // identity — and named units are fictional in every preset by rule.
  specialties: SPECIALTIES,
  schools: SERVICE_SCHOOLS,
  units: SPECIAL_UNITS,
}
