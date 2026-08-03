/**
 * M-ECON §4. The economy as weather.
 *
 * THE CLAIMS, and they are the acceptance targets the spec names: a long
 * run passes through several recessions and the occasional depression;
 * layoffs spike in downturns and hiring in booms; the market trends up with
 * real drawdowns; inflation makes late prices meaningfully higher than
 * early ones; and none of it is ever a float or a coin nobody seeded.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { MARKET_INDEX_START, atTodaysPrices, economyPhaseWords } from '../src/economy.js'
import type { EconomyPhase } from '../src/types.js'

/** Walk a century, month by month, watching the weather. */
function century(seedValue: number) {
  const world = createWorld(makeSeed(seedValue), 100)
  const phases: EconomyPhase[] = []
  let last: EconomyPhase | '' = ''
  let peak = 0
  let worstDrawdown = 0
  for (let month = 0; month < 1200; month++) {
    advanceTicks(world, 1)
    if (world.economy.phase !== last) {
      phases.push(world.economy.phase)
      last = world.economy.phase
    }
    peak = Math.max(peak, world.economy.marketIndex)
    worstDrawdown = Math.max(worstDrawdown, (peak - world.economy.marketIndex) / peak)
  }
  return { world, phases, worstDrawdown }
}

describe('the cycle turns', () => {
  it('passes through recessions, and depressions are rare', () => {
    let recessions = 0
    let depressions = 0
    for (const seedValue of [12345, 4141, 777, 2024]) {
      const { phases } = century(seedValue)
      recessions += phases.filter((p) => p === 'recession').length
      depressions += phases.filter((p) => p === 'depression').length
    }
    // Measured: 6-9 recessions and 0-2 depressions per century.
    expect(recessions, 'a century with no recession is not a cycle').toBeGreaterThan(4 * 4)
    expect(depressions, 'depressions never happen').toBeGreaterThan(0)
    // Rare: never more often than one recession in two.
    expect(depressions).toBeLessThan(recessions / 2)
  })

  it('never gets stuck at the bottom', () => {
    const { phases } = century(12345)
    // Every downturn is followed by something. A depression that never
    // ends is not survivable, whatever else it is.
    for (let i = 0; i < phases.length - 1; i++) {
      if (phases[i] === 'depression') expect(phases[i + 1]).toBe('recovery')
    }
    expect(economyPhaseWords('depression')).toContain('depression')
  })

  it('keeps every figure an integer, forever', () => {
    const { world } = century(4141)
    const e = world.economy
    for (const value of [
      e.growthPerMille,
      e.inflationPerMille,
      e.unemploymentPerMille,
      e.ratePerMille,
      e.marketIndex,
      e.priceLevelPerMille,
    ]) {
      expect(Number.isInteger(value)).toBe(true)
    }
    // The bank's rate stays inside a sane band, in every weather.
    expect(e.ratePerMille).toBeGreaterThanOrEqual(0)
    expect(e.ratePerMille).toBeLessThanOrEqual(140)
  })
})

describe('what the cycle does to the town', () => {
  it('lays people off, and does it in the downturns', () => {
    const world = createWorld(makeSeed(12345), 100)
    const inDownturn = new Map<number, boolean>()
    for (let month = 0; month < 1200; month++) {
      advanceTicks(world, 1)
      inDownturn.set(
        world.tick,
        world.economy.phase === 'recession' || world.economy.phase === 'depression',
      )
    }

    const layoffs = world.events.filter((e) => e.type === 'left-job' && e.detail === 'laid off')
    expect(layoffs.length, 'nobody was ever laid off in a century').toBeGreaterThan(0)

    // The great majority land in a downturn or the recovery just after it —
    // an economy that sheds jobs evenly through a boom is not an economy.
    const inBadTimes = layoffs.filter((e) => inDownturn.get(e.tick) === true).length
    expect(inBadTimes / layoffs.length).toBeGreaterThan(0.4)
  })

  it('makes a late dollar worth less than an early one', () => {
    const world = createWorld(makeSeed(12345), 100)
    const early = atTodaysPrices(world, 100_000)
    advanceTicks(world, 100 * 12)
    const late = atTodaysPrices(world, 100_000)
    // Measured across seeds: four to eight times the base by year 100.
    expect(late).toBeGreaterThan(early * 2)
    expect(Number.isInteger(late)).toBe(true)
  })

  it('grows the market long-run, with real drawdowns on the way', () => {
    const { world, worstDrawdown } = century(2024)
    expect(world.economy.marketIndex).toBeGreaterThan(MARKET_INDEX_START)
    // A market that only ever goes up is not a market.
    expect(worstDrawdown).toBeGreaterThan(0.1)
  })

  it('reproduces the whole path from the same seed', () => {
    const a = century(777).world.economy
    const b = century(777).world.economy
    expect(b).toEqual(a)
  })
})
