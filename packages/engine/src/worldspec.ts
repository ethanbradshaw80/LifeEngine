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
  NATION_NAMES,
  NEIGHBOURHOOD_NAMES,
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
import type { WorldSpec } from './types.js'

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
  for (const branch of spec.branches) Object.freeze(branch)
  Object.freeze(spec.branches)
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
  },
  foreignNations: NATION_NAMES,
  branches: CLASSIC_BRANCHES,
})

/**
 * Every preset this build ships. A build carries every preset it has EVER
 * shipped, forever: a save records which one made it, and a world whose
 * content cannot be resolved is a world that cannot be loaded
 * (WORLD_MODES_PLAN.md, resistance 2).
 */
export const PRESETS: readonly WorldSpec[] = [CLASSIC_SPEC]

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
