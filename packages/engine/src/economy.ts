/**
 * THE MACROECONOMY (M-ECON §4).
 *
 * A state machine on its own seeded stream, modelled on the conflict machine
 * in geopolitics.ts for the same reason: an economy that drifts through
 * phases over years, deterministically, is something the player LIVES in
 * rather than a number on a screen.
 *
 *   Expansion → Peak → Recession → Depression → Recovery → Expansion
 *
 * Depression is reachable only from Recession and only rarely, which is the
 * owner's brief: recessions noticeable and fairly common, depressions rare
 * but severe and survivable. Recovery always follows a downturn, so no world
 * can be stuck at the bottom forever.
 *
 * WHAT IT MOVES: hiring and layoffs, wages, the price level, the central
 * bank's rate, and the market index. Those effects live in the systems that
 * own those things — this module says what the weather IS, and the tick
 * loop asks it.
 *
 * Everything is integer: rates and growth in per-mille, the index in basis
 * points from a 10,000 start.
 */

import type { Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { EconomyState, EconomyPhase, World } from './types.js'

/** Where the index starts, in basis points. 10,000 reads as "100". */
export const MARKET_INDEX_START = 10_000

/** The rate the central bank returns to when nothing is wrong. */
export const NEUTRAL_RATE_PER_MILLE = 35

/** How long a phase runs before it may turn, in months. */
const MIN_PHASE_MONTHS: Readonly<Record<EconomyPhase, number>> = {
  expansion: 36,
  peak: 8,
  recession: 10,
  depression: 18,
  recovery: 12,
}

/**
 * Chance per month, per thousand, that a phase ends once it is old enough.
 *
 * Expansions are long and end reluctantly; a peak is by definition brief.
 * The numbers are chosen so a century holds several recessions and about
 * one depression — measured, not guessed, and pinned by a test.
 */
const TURN_CHANCE_PER_MILLE: Readonly<Record<EconomyPhase, number>> = {
  expansion: 22,
  peak: 110,
  recession: 55,
  depression: 45,
  recovery: 70,
}

/**
 * How likely a recession deepens rather than recovers. MEASURED. At 90 a century saw one depression in three runs of it, which
 * is not "rare but real" — it is a thing most players would never meet. At
 * 250 a recession deepens about one time in four, which against seven or
 * eight recessions a century is roughly one depression every few decades:
 * the owner's brief, and rare enough to still be an event.
 */
const DEPRESSION_CHANCE_PER_MILLE = 250

export function freshEconomy(): EconomyState {
  return {
    phase: 'expansion',
    phaseSinceTick: 0 as Tick,
    growthPerMille: 25,
    inflationPerMille: 20,
    unemploymentPerMille: 45,
    ratePerMille: NEUTRAL_RATE_PER_MILLE,
    marketIndex: MARKET_INDEX_START,
    priceLevelPerMille: 1000,
  }
}

/** The shape of each phase: what growth, inflation and joblessness look like. */
const PHASE_TARGETS: Readonly<
  Record<EconomyPhase, { growth: number; inflation: number; unemployment: number }>
> = {
  expansion: { growth: 30, inflation: 22, unemployment: 40 },
  peak: { growth: 12, inflation: 45, unemployment: 32 },
  recession: { growth: -18, inflation: 12, unemployment: 90 },
  depression: { growth: -55, inflation: -8, unemployment: 190 },
  recovery: { growth: 22, inflation: 10, unemployment: 70 },
}

/** Drift a value a third of the way toward its target, in integers. */
function drift(current: number, target: number): number {
  const gap = target - current
  if (gap === 0) return current
  const step = Math.trunc(gap / 3)
  return step === 0 ? current + Math.sign(gap) : current + step
}

/**
 * Which phase follows this one, or null to stay.
 *
 * A recession either deepens into a depression or turns to recovery; both
 * depression and recovery lead back up. Nothing else is reachable, so the
 * cycle cannot wander into a shape nobody designed.
 */
function nextPhase(phase: EconomyPhase, deepen: boolean): EconomyPhase {
  switch (phase) {
    case 'expansion':
      return 'peak'
    case 'peak':
      return 'recession'
    case 'recession':
      return deepen ? 'depression' : 'recovery'
    case 'depression':
      return 'recovery'
    default:
      return 'expansion'
  }
}

/**
 * One month of weather.
 *
 * WAR TIES IN (§4): a homeland at war runs its factories hot — production
 * and prices both rise — which is why the caller passes it. It does not
 * change the phase; it leans on the numbers inside whatever phase there is.
 */
export function stepEconomy(
  world: World,
  tick: Tick,
  atWar: boolean,
): EconomyState {
  const current = world.economy
  const rng = openStream(world.seed, Stream.Economy, 0, tick + 77_000)

  let phase = current.phase
  let phaseSinceTick = current.phaseSinceTick
  const age = tick - current.phaseSinceTick
  if (age >= MIN_PHASE_MONTHS[phase] && rng.chance(TURN_CHANCE_PER_MILLE[phase], 1000)) {
    phase = nextPhase(phase, rng.chance(DEPRESSION_CHANCE_PER_MILLE, 1000))
    phaseSinceTick = tick
  }

  const target = PHASE_TARGETS[phase]
  // A war is work: it lifts output and pushes prices, in whatever weather.
  const growthPerMille = drift(current.growthPerMille, target.growth + (atWar ? 12 : 0))
  const inflationPerMille = drift(current.inflationPerMille, target.inflation + (atWar ? 18 : 0))
  const unemploymentPerMille = Math.max(
    5,
    drift(current.unemploymentPerMille, Math.max(5, target.unemployment - (atWar ? 15 : 0))),
  )

  // THE CENTRAL BANK. Raises against inflation, cuts against a slump, and
  // otherwise returns toward neutral. Never below zero and never absurd.
  const wanted = Math.max(
    0,
    Math.min(
      140,
      NEUTRAL_RATE_PER_MILLE + (inflationPerMille - 20) * 2 - Math.max(0, -growthPerMille),
    ),
  )
  const ratePerMille = drift(current.ratePerMille, wanted)

  // PRICES ONLY EVER DRIFT UP OR DOWN BY THE MONTH'S INFLATION, compounding
  // over decades — which is what makes a 2062 dollar a different thing from
  // a 2090 one. Floored at the starting level: this world has no model for
  // a collapse in the price level and should not pretend to.
  const priceLevelPerMille = Math.max(
    1000,
    current.priceLevelPerMille +
      Math.trunc((current.priceLevelPerMille * inflationPerMille) / 12_000),
  )

  // THE MARKET leads the cycle and overshoots it in both directions, which
  // is why a portfolio can be gutted by a depression and why it recovers
  // before the jobs do. The draw is the month's noise, not the trend.
  const trend = Math.trunc((growthPerMille * 3) / 2)
  const noise = rng.nextIntInclusive(-45, 45)
  const marketIndex = Math.max(
    1_000,
    current.marketIndex + Math.trunc((current.marketIndex * (trend + noise)) / 10_000),
  )

  return {
    phase,
    phaseSinceTick,
    growthPerMille,
    inflationPerMille,
    unemploymentPerMille,
    ratePerMille,
    marketIndex,
    priceLevelPerMille,
  }
}

/** In words, for a screen. */
export function economyPhaseWords(phase: EconomyPhase): string {
  switch (phase) {
    case 'expansion':
      return 'the economy is growing'
    case 'peak':
      return 'the economy is running hot'
    case 'recession':
      return 'the economy is in recession'
    case 'depression':
      return 'the economy is in depression'
    default:
      return 'the economy is recovering'
  }
}

/**
 * What a price costs TODAY, given the drift since the world began. One
 * helper, so rent and living costs move together and nothing invents its
 * own inflation.
 */
export function atTodaysPrices(world: World, base: number): number {
  return Math.floor((base * world.economy.priceLevelPerMille) / 1000)
}
