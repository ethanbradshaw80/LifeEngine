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
  { name: 'the United Kingdom', alignment: 'ally' },
  { name: 'Canada', alignment: 'ally' },
  { name: 'France', alignment: 'ally' },
  { name: 'Germany', alignment: 'ally' },
  { name: 'Japan', alignment: 'ally' },
  { name: 'South Korea', alignment: 'ally' },
  { name: 'Australia', alignment: 'ally' },
  { name: 'India', alignment: 'neutral' },
  { name: 'Mexico', alignment: 'neutral' },
  { name: 'Russia', alignment: 'rival' },
  { name: 'China', alignment: 'rival' },
  { name: 'North Korea', alignment: 'rival' },
  { name: 'Iran', alignment: 'rival' },
  { name: 'Cuba', alignment: 'rival' },
  { name: 'Venezuela', alignment: 'rival' },
  { name: 'Syria', alignment: 'rival' },
  { name: 'Belarus', alignment: 'rival' },
  { name: 'Afghanistan', alignment: 'rival' },
  { name: 'Nicaragua', alignment: 'rival' },
  { name: 'Myanmar', alignment: 'rival' },
  { name: 'Eritrea', alignment: 'rival' },
]

export const REAL_NATION_NAMES: readonly string[] = REAL_NATIONS.map((n) => n.name)

/** The alignment a preset gave a nation, or neutral for one it did not. */
export function alignmentOf(name: string): Alignment {
  return REAL_NATIONS.find((nation) => nation.name === name)?.alignment ?? 'neutral'
}
