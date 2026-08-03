/**
 * THE MARKET (M-ECON §5).
 *
 * An index and a handful of FICTIONAL sectors — no real company is named,
 * ever (Part F). Each sector has its own character: how hard it swings, and
 * how much of the economy's weather it feels. Defense rises in a war that
 * would flatten Consumer; Agricultural barely notices either.
 *
 * Prices are basis points from a 10,000 start, so "10,000" reads as 100 and
 * everything stays integer (ADR-0008). A holding is UNITS, and its value is
 * units × price ÷ 10,000 — which means a unit bought at 10,000 cost exactly
 * one dollar's worth of index, and the arithmetic never leaves cents.
 */

import type { Money, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { EconomyState, Holding, World } from './types.js'

export interface Sector {
  readonly id: string
  readonly title: string
  /** How far it swings per month, in basis points of itself. */
  readonly volatility: number
  /** How much of the cycle's growth it feels, per-mille. 1000 is all of it. */
  readonly beta: number
  /** What a war does to it, in basis points a month. Negative for some. */
  readonly warEffect: number
  /** Annual dividend, per-mille of value. Paid monthly, floored. */
  readonly dividendPerMille: number
}

/**
 * Four sectors, invented. Their shapes are the interesting part: a defensive
 * trade that pays you to wait, a cyclical one that does not, and a war trade
 * that moves against the others.
 */
export const SECTORS: readonly Sector[] = [
  {
    id: 'industrial',
    title: 'Industrial',
    volatility: 190,
    beta: 1300,
    warEffect: 40,
    dividendPerMille: 22,
  },
  {
    id: 'agricultural',
    title: 'Agricultural',
    volatility: 110,
    beta: 500,
    warEffect: 15,
    dividendPerMille: 38,
  },
  {
    id: 'defense',
    title: 'Defense',
    volatility: 160,
    beta: 700,
    warEffect: 120,
    dividendPerMille: 26,
  },
  {
    id: 'consumer',
    title: 'Consumer',
    volatility: 145,
    beta: 1100,
    warEffect: -35,
    dividendPerMille: 30,
  },
]

export function sectorById(id: string): Sector | undefined {
  return SECTORS.find((s) => s.id === id)
}

/** Every sector at its starting price. */
export function freshSectorPrices(): Readonly<Record<string, number>> {
  const prices: Record<string, number> = {}
  for (const sector of SECTORS) prices[sector.id] = 10_000
  return prices
}

/**
 * One month of prices.
 *
 * The trend is the economy's growth through the sector's beta; the swing is
 * its own volatility; a war leans on it either way. Floored at a thousand —
 * a sector can be gutted but this world does not model one going to zero,
 * and pretending otherwise would make a holding vanish rather than crash.
 */
export function stepSectors(
  world: World,
  tick: Tick,
  economy: EconomyState,
  atWar: boolean,
): Readonly<Record<string, number>> {
  const next: Record<string, number> = {}
  for (const sector of SECTORS) {
    const rng = openStream(world.seed, Stream.Economy, sector.id.length, tick + 88_000 + sector.volatility)
    const current = world.sectorPrices[sector.id] ?? 10_000
    const trend = Math.trunc((economy.growthPerMille * sector.beta) / 1000)
    const swing = rng.nextIntInclusive(-sector.volatility, sector.volatility)
    const war = atWar ? sector.warEffect : 0
    next[sector.id] = Math.max(
      1_000,
      current + Math.trunc((current * (trend + swing + war)) / 10_000),
    )
  }
  return next
}

/** What one holding is worth today, in cents. */
export function holdingValue(world: World, holding: Holding): Money {
  const price = world.sectorPrices[holding.sectorId] ?? 10_000
  return Math.floor((holding.units * price) / 10_000) as Money
}

/** Everything a person's holdings are worth. */
export function portfolioValue(world: World, holdings: readonly Holding[]): Money {
  let total = 0
  for (const holding of holdings) total += holdingValue(world, holding)
  return total as Money
}

/** What the whole market is doing, as one number for a screen. */
export function marketLevel(world: World): number {
  let total = 0
  for (const sector of SECTORS) total += world.sectorPrices[sector.id] ?? 10_000
  return Math.floor(total / SECTORS.length)
}

/**
 * Units bought for a sum of cents, at today's price. Floored: you get the
 * units the money actually buys, and the remainder stays as cash rather
 * than conjuring a fraction of a unit.
 */
export function unitsFor(world: World, sectorId: string, cents: Money): number {
  const price = world.sectorPrices[sectorId] ?? 10_000
  if (price <= 0) return 0
  return Math.floor((cents * 10_000) / price)
}

/** This month's dividend on a holding. Floored, so small holdings pay none. */
export function dividendOn(world: World, holding: Holding): Money {
  const sector = sectorById(holding.sectorId)
  if (!sector) return 0 as Money
  const value = holdingValue(world, holding)
  return Math.floor((value * sector.dividendPerMille) / (1000 * 12)) as Money
}
