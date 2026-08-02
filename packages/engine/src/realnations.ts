/**
 * Real foreign nations, for presets that name them (ADR-0021).
 *
 * THE LINE THIS FILE SITS ON. Which COUNTRIES are real is a preset's choice.
 * Which WARS happen is never anybody's: every conflict in this engine is
 * generated from modelled pressure, and no real war, operation, battle or
 * campaign name may ever appear here or anywhere downstream. A world that
 * says "the United States is at war with Russia" is saying something the
 * simulation invented five minutes ago, and the preset says so where the
 * player can see it (MILITARY_AND_WAR_FOUNDATION §3, ADR-0021).
 *
 * THE ALIGNMENTS ARE A STARTING POSITION, NOT A JUDGEMENT. They came from
 * the owner's own reference list (2026-08-02), which introduced them as "a
 * gameplay label from a US perspective — a starting point you can change",
 * and that is exactly what they are used for: where the ladder begins on
 * tick zero. The simulation moves every relation from the first month, and
 * where any pair ends up after fifty years is the simulation's doing. The
 * game asserts nothing about how these countries actually get along.
 *
 * Classic does not use this file. It invents its whole world, which is the
 * point of keeping it.
 */

/**
 * Where a nation starts relative to the homeland. Not a ranking, not a
 * verdict — the first rung, and only the first.
 */
export type Alignment = 'ally' | 'neutral' | 'rival'

export interface RealNation {
  readonly name: string
  readonly alignment: Alignment
  /**
   * 1-10, how hard this country is to fight. THE OWNER'S OWN TABLE
   * (2026-08-02) and his own words about it: "A gameplay balance value, NOT
   * a real-world stat — tune freely."
   *
   * That framing is carried here because it is the honest description of
   * what the number is: an input to how dangerous a generated war feels,
   * tuned for play. It is not an assessment of anybody's armed forces, the
   * game never shows it as one, and nothing else in the engine reads it.
   *
   * NOT IMPLEMENTED, deliberately: the spec offered an optional attrition
   * bonus for one named country on the grounds of terrain and insurgency.
   * A balance number applied evenly is one thing; singling out a single
   * real country for a mechanic about occupying it is another, and the
   * engine models neither terrain nor insurgency to hang it on.
   */
  readonly combatRating: number
}

/**
 * The owner's list, verbatim in membership and in labels, with 'hostile'
 * carried over as 'rival': the engine's word for "this pair starts further
 * up the ladder", which is all the label can honestly mean here.
 *
 * ORDER IS LOAD-BEARING (DETERMINISM §8): nations are allocated in this
 * order, ids follow allocation, and ids seed draws. Append only; never
 * reorder.
 */
export const REAL_NATIONS: readonly RealNation[] = [
  { name: 'the United Kingdom', alignment: 'ally', combatRating: 8 },
  { name: 'Canada', alignment: 'ally', combatRating: 6 },
  { name: 'France', alignment: 'ally', combatRating: 8 },
  { name: 'Germany', alignment: 'ally', combatRating: 7 },
  { name: 'Japan', alignment: 'ally', combatRating: 7 },
  { name: 'South Korea', alignment: 'ally', combatRating: 6 },
  { name: 'Australia', alignment: 'ally', combatRating: 6 },
  { name: 'India', alignment: 'neutral', combatRating: 7 },
  { name: 'Mexico', alignment: 'neutral', combatRating: 4 },
  { name: 'Russia', alignment: 'rival', combatRating: 9 },
  { name: 'China', alignment: 'rival', combatRating: 9 },
  { name: 'North Korea', alignment: 'rival', combatRating: 6 },
  { name: 'Iran', alignment: 'rival', combatRating: 6 },
  { name: 'Cuba', alignment: 'rival', combatRating: 3 },
  { name: 'Venezuela', alignment: 'rival', combatRating: 4 },
  { name: 'Syria', alignment: 'rival', combatRating: 4 },
  { name: 'Belarus', alignment: 'rival', combatRating: 4 },
  { name: 'Afghanistan', alignment: 'rival', combatRating: 4 },
  { name: 'Nicaragua', alignment: 'rival', combatRating: 2 },
  { name: 'Myanmar', alignment: 'rival', combatRating: 3 },
  { name: 'Eritrea', alignment: 'rival', combatRating: 3 },
]

export const REAL_NATION_NAMES: readonly string[] = REAL_NATIONS.map((n) => n.name)

/** The alignment a preset gave a nation, or neutral for one it did not. */
export function alignmentOf(name: string): Alignment {
  return REAL_NATIONS.find((nation) => nation.name === name)?.alignment ?? 'neutral'
}
