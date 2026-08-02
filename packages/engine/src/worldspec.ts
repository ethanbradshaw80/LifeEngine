/**
 * The WorldSpec — what a preset decides about a world. W1 (ADR-0020,
 * docs/WORLD_MODES_PLAN.md).
 *
 * The engine has always read its world's identity from constants in
 * content.ts: one town called Haverlock, one school, one set of streets, one
 * homeland called the Republic, one pair of name pools. That is fine for one
 * world and impossible for two. The spec is the seam: everything that says
 * WHICH world this is comes from here, and nothing in engine logic branches
 * on a preset's name.
 *
 * WHAT IS NOT HERE, deliberately: balance constants. Pay tables, rents,
 * living costs, promotion cutoffs and gate thresholds are TUNING, not world
 * identity — the same rules apply in every preset and they stay engine-owned
 * (WORLD_MODES_PLAN.md, "Architecture"). Service content and START_YEAR are
 * spec-shaped too and follow in a later W1 step; this first cut takes the
 * pieces worldgen and newborn naming actually read.
 *
 * IMMUTABILITY: a world's preset is chosen at creation and never changes.
 * Places allocate before people and person ids seed trait streams, so a
 * preset with a different number of streets produces different PEOPLE from
 * the same seed (the id-shift trap, measured twice in this repo). That is
 * acceptable — the preset is an input like the seed — but it is the reason
 * a save can never be "switched" to another preset.
 */

import {
  BASE_NAMES,
  CIVIC_NAMES,
  CLASSIC_BRANCHES,
  SERVICE_SCHOOLS,
  SPECIAL_UNITS,
  SPECIALTIES,
  HOMELAND_NAME,
  NATION_NAMES,
  NEIGHBOURHOOD_NAMES,
  NEWS_STATION,
  SCHOOL_NAME,
  TOWN_NAME,
  WORKPLACE_NAMES,
} from './content.js'
import {
  FAMILY_NAME_WEIGHTS,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  FEMALE_GIVEN_WEIGHTS,
  MALE_GIVEN_NAMES,
  MALE_GIVEN_WEIGHTS,
} from './names.js'
import { HEARTLAND_SPEC } from './heartland.js'
import type { World } from './types.js'
import type {
  ServiceBranchSpec,
  ServiceSchool,
  ServiceSpecialty,
  SpecialUnit,
  WorldSpec,
} from './types.js'

/**
 * DETERMINISM.md §5 bans module-level MUTABLE state, and `readonly` is a
 * compile-time promise only. A preset is shared by reference with every
 * world in the process, so one stray write would corrupt all of them —
 * freeze makes the promise real at runtime.
 */
function freezeSpec(spec: WorldSpec): WorldSpec {
  Object.freeze(spec.maleGiven.names)
  Object.freeze(spec.maleGiven.weights)
  Object.freeze(spec.femaleGiven.names)
  Object.freeze(spec.femaleGiven.weights)
  Object.freeze(spec.family.names)
  Object.freeze(spec.family.weights)
  Object.freeze(spec.maleGiven)
  Object.freeze(spec.femaleGiven)
  Object.freeze(spec.family)
  Object.freeze(spec.gazetteer)
  Object.freeze(spec.foreignNations)
  Object.freeze(spec.gazetteer.neighbourhoods)
  Object.freeze(spec.gazetteer.workplaces)
  Object.freeze(spec.gazetteer.civic)
  Object.freeze(spec.gazetteer.bases)
  for (const branch of spec.branches) {
    // The ladders especially: DETERMINISM.md §8 makes them append-only,
    // because a record's rank is an INDEX into one and reordering a ladder
    // re-ranks every soldier in every existing save of the preset.
    Object.freeze(branch.ranks)
    Object.freeze(branch.grades)
    Object.freeze(branch.juniorTigMonths)
    Object.freeze(branch)
  }
  Object.freeze(spec.branches)
  for (const specialty of spec.specialties) {
    Object.freeze(specialty.exposure)
    Object.freeze(specialty.civilianUnlocks)
    Object.freeze(specialty)
  }
  Object.freeze(spec.specialties)
  for (const school of spec.schools) {
    Object.freeze(school.branches)
    Object.freeze(school.specialtyIds)
    Object.freeze(school)
  }
  Object.freeze(spec.schools)
  for (const unit of spec.units) {
    Object.freeze(unit.branches)
    Object.freeze(unit.requiredBadges)
    Object.freeze(unit)
  }
  Object.freeze(spec.units)
  return Object.freeze(spec)
}

export const CLASSIC_SPEC: WorldSpec = freezeSpec({
  id: 'classic',
  name: 'Classic',
  maleGiven: { names: MALE_GIVEN_NAMES, weights: MALE_GIVEN_WEIGHTS },
  femaleGiven: { names: FEMALE_GIVEN_NAMES, weights: FEMALE_GIVEN_WEIGHTS },
  family: { names: FAMILY_NAMES, weights: FAMILY_NAME_WEIGHTS },
  gazetteer: {
    townName: TOWN_NAME,
    schoolName: SCHOOL_NAME,
    neighbourhoods: NEIGHBOURHOOD_NAMES,
    workplaces: WORKPLACE_NAMES,
    civic: CIVIC_NAMES,
    bases: BASE_NAMES,
    newsStation: NEWS_STATION,
  },
  startYear: 1970,
  homelandName: HOMELAND_NAME,
  foreignNations: NATION_NAMES,
  branches: CLASSIC_BRANCHES,
  specialties: SPECIALTIES,
  schools: SERVICE_SCHOOLS,
  units: SPECIAL_UNITS,
})

/**
 * Every preset this build ships. A build carries every preset it has EVER
 * shipped, forever: a save records which one made it, and a world whose
 * content cannot be resolved is a world that cannot be loaded
 * (WORLD_MODES_PLAN.md, resistance 2).
 */
export const PRESETS: readonly WorldSpec[] = [CLASSIC_SPEC, freezeSpec(HEARTLAND_SPEC)]

/**
 * Resolve a preset id. NEVER throws: this is called with strings that came
 * out of a save file, and an unknown preset must degrade to a world that
 * loads rather than an exception in a worker. Classic is the fallback
 * because every save written before presets existed is one.
 */
export function specById(id: string | null | undefined): WorldSpec {
  if (id === null || id === undefined) return CLASSIC_SPEC
  return PRESETS.find((preset) => preset.id === id) ?? CLASSIC_SPEC
}

// ---------------------------------------------------------------------------
// Resolving a record's content ids against the world's preset
//
// EVERY one of these is TOTAL — none throws, none returns undefined. Records
// outlive content: a save can hold an id from a preset this build does not
// have, and refusing to load, or throwing inside the tick, is worse than
// serving an honest blank. This is the same doctrine as specById, and the
// W1 review's third must-fix is why the blank is a BLANK rather than a
// substitution: a stand-in from another branch re-reads rank INDEXES against
// the wrong ladder and rewrites a career.
//
// (WORLD_MODES_PLAN.md resistance 2: occupationById and specialtyById used to
// throw on exactly these ids.)
// ---------------------------------------------------------------------------

export function branchSpecFor(world: World, branchId: string): ServiceBranchSpec {
  const found = world.spec.branches.find((b) => b.id === branchId)
  if (found) return found
  // No ladder at all: no rank is invented, the board is unreachable, and the
  // career freezes where it stands instead of being re-dated.
  return {
    id: branchId,
    name: branchId,
    ranks: [],
    grades: [],
    competitiveFrom: Number.MAX_SAFE_INTEGER,
    juniorTigMonths: [],
  }
}

export function specialtyFor(world: World, specialtyId: string): ServiceSpecialty {
  const found = world.spec.specialties.find((sp) => sp.id === specialtyId)
  if (found) return found
  // A trade nobody here can name: it keeps its id as its title so the record
  // still reads, and it does nothing — no school, no unlocks, and no exposure
  // to invent danger the preset never described.
  return {
    id: specialtyId,
    title: specialtyId,
    branch: '',
    requires: 'none',
    schoolMonths: 0,
    qualification: '',
    boardCutoffOffset: 0,
    exposure: { directCombat: 0, convoy: 0, baseAttack: 0, accident: 0 },
    civilianUnlocks: [],
  }
}

/** Null, not a blank: a school id that resolves to nothing is a course that
 *  cannot be attended, and every caller already handles "no such course". */
export function schoolFor(world: World, schoolId: string): ServiceSchool | null {
  return world.spec.schools.find((school) => school.id === schoolId) ?? null
}

/** Null for the same reason as schoolFor — and `unitId` is already nullable
 *  on the record, so "no unit I can name" reads exactly like "no unit". */
export function unitFor(world: World, unitId: string): SpecialUnit | null {
  return world.spec.units.find((unit) => unit.id === unitId) ?? null
}
