/**
 * M-ECON §5. The market.
 *
 * THE CLAIMS, which are the spec's acceptance targets: four sectors move
 * differently from one another; over a long run the market trends up but
 * takes real drawdowns; buying and selling conserve money to the cent; a
 * retirement account is never taxed on its gains and a brokerage is; and
 * every price is an integer drawn from a seeded stream, so two worlds on
 * the same seed hold identical portfolios.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  SECTORS,
  holdingValue,
  marketLevel,
  portfolioValue,
  sectorById,
  unitsFor,
} from '../src/market.js'
import { accountsOf, buyInvestment, sellInvestment } from '../src/finances.js'
import { ageAt } from '../src/clock.js'
import type { Tick } from '@life-engine/shared'

/**
 * Put money in a person's savings for a fixture.
 *
 * Written straight onto the map rather than through finances, deliberately:
 * finances is the single WRITER of money in the simulation and it does not
 * expose a "just give them some" door. A test setting up a starting balance
 * is not the simulation, so it does not get one either.
 */
function fund(world: ReturnType<typeof createWorld>, personId: number, savings: number): void {
  world.accounts.set(personId as never, {
    ...accountsOf(world, personId as never),
    savings: savings as Money,
  })
}

/** The first adult in the town, so a test has somebody to bank for. */
function anAdult(world: ReturnType<typeof createWorld>) {
  // The YOUNGEST adult, not the eldest: the retirement test grows a
  // portfolio for thirty years, and an elder picked at sixty dies inside
  // the window — the estate now settles on every death (H0), so a dead
  // fixture's accounts are honestly empty rather than conveniently intact.
  const person = [...world.people.values()]
    .filter((p) => p.deathTick === null && ageAt(p.birthTick, world.tick) >= 25)
    .sort((a, b) => b.birthTick - a.birthTick || a.id - b.id)[0]
  expect(person).toBeDefined()
  return person!
}

describe('the sectors', () => {
  it('are real sectors, fictional companies, and shaped differently', () => {
    // WAS `toHaveLength(4)`. The stock revamp (§2) moves the sectors
    // toward the real GICS set so the market reads like one, and the
    // count is no longer the interesting claim — the ORIGINAL FOUR IDS
    // SURVIVING is, because every holding in every existing save is keyed
    // by one of those strings and renaming one would orphan a portfolio.
    expect(SECTORS.length).toBeGreaterThanOrEqual(4)
    const ids = SECTORS.map((s) => s.id)
    for (const original of ['industrial', 'agricultural', 'defense', 'consumer']) {
      expect(ids, `${original} was renamed; existing holdings are keyed by it`).toContain(original)
    }
    expect(new Set(ids).size).toBe(ids.length)
    const betas = new Set(SECTORS.map((s) => s.beta))
    const vols = new Set(SECTORS.map((s) => s.volatility))
    expect(betas.size).toBeGreaterThan(1)
    expect(vols.size).toBeGreaterThan(1)
    // One of them must move AGAINST the others in a war, or the four are
    // just one asset wearing four names.
    expect(SECTORS.some((s) => s.warEffect < 0)).toBe(true)
    expect(SECTORS.some((s) => s.warEffect > 0)).toBe(true)
  })

  it('start level and then diverge', () => {
    const world = createWorld(makeSeed(90210), 60)
    const start = SECTORS.map((s) => world.sectorPrices[s.id])
    expect(new Set(start).size).toBe(1)

    advanceTicks(world, 240)
    const after = SECTORS.map((s) => world.sectorPrices[s.id] ?? 0)
    expect(new Set(after).size).toBe(SECTORS.length)
    for (const price of after) expect(Number.isInteger(price)).toBe(true)
  })
})

describe('the market over a long run', () => {
  it('trends up, and takes drawdowns on the way', () => {
    const world = createWorld(makeSeed(31415), 80)
    const opening = marketLevel(world)
    let peak = opening
    let worst = 0
    for (let month = 0; month < 900; month++) {
      advanceTicks(world, 1)
      const level = marketLevel(world)
      peak = Math.max(peak, level)
      worst = Math.max(worst, (peak - level) / peak)
    }
    expect(marketLevel(world)).toBeGreaterThan(opening)
    // A market that never falls is a savings account with extra steps.
    // Measured on this seed: 0.19 worst peak-to-trough.
    expect(worst).toBeGreaterThan(0.05)
  })
})

describe('buying and selling', () => {
  it('conserves money to the cent, less the units that would not divide', () => {
    const world = createWorld(makeSeed(5150), 60)
    const person = anAdult(world)
    fund(world, person.id, 1_000_000)

    const spent = buyInvestment(world, world.tick, person.id, 'industrial', 400_000 as Money)
    const after = accountsOf(world, person.id)
    expect(spent).toBeGreaterThan(0)
    expect(after.savings).toBe(1_000_000 - spent)

    const holding = after.holdings.find((h) => h.sectorId === 'industrial')
    expect(holding).toBeDefined()
    // What was paid buys what the price says it buys, with no fractional unit.
    expect(holding!.units).toBe(unitsFor(world, 'industrial', spent as Money))
    expect(Number.isInteger(holding!.units)).toBe(true)
    // Sold back the same month, before any price moved, it comes back whole.
    const worth = holdingValue(world, holding!)
    const got = sellInvestment(world, world.tick, person.id, 'industrial')
    expect(got).toBe(worth)
  })

  it('refuses what savings cannot cover, rather than going negative', () => {
    const world = createWorld(makeSeed(2718), 60)
    const person = anAdult(world)
    fund(world, person.id, 0)
    expect(buyInvestment(world, world.tick, person.id, 'defense', 500_000 as Money)).toBe(0)
    expect(accountsOf(world, person.id).savings).toBe(0)
  })

  it('sells nothing it does not hold', () => {
    const world = createWorld(makeSeed(1729), 60)
    const person = anAdult(world)
    expect(sellInvestment(world, world.tick, person.id, 'consumer')).toBe(0)
  })
})

describe('a retirement account', () => {
  it('is kept apart from the brokerage, and its gains are never taxed', () => {
    const world = createWorld(makeSeed(8675309), 60)
    const person = anAdult(world)
    fund(world, person.id, 2_000_000)

    // The same money, the same sector, the same month — into both accounts,
    // so the only difference at the end is the tax treatment.
    buyInvestment(world, world.tick, person.id, 'agricultural', 500_000 as Money, true)
    buyInvestment(world, world.tick, person.id, 'agricultural', 500_000 as Money, false)
    const held = accountsOf(world, person.id)
    expect(held.retirementHoldings).toHaveLength(1)
    expect(held.holdings).toHaveLength(1)
    expect(held.holdings[0]!.units).toBe(held.retirementHoldings[0]!.units)

    // Thirty years of prices, then sell both out. Measured POSITION BY
    // POSITION: a living person invests on their own over thirty years now,
    // so the whole-portfolio number includes sectors this test never
    // bought — the claim is about the agricultural fund and its twin.
    advanceTicks(world, 360)
    const grown = accountsOf(world, person.id)
    const agFund = (holdings: readonly (typeof grown.holdings)[number][]) =>
      holdings.find((h) => h.stockId === undefined && h.sectorId === 'agricultural')
    const shelteredPosition = agFund(grown.retirementHoldings)
    const taxablePosition = agFund(grown.holdings)
    expect(shelteredPosition).toBeDefined()
    expect(taxablePosition).toBeDefined()
    const shelteredGross = holdingValue(world, shelteredPosition!)
    const taxableGross = holdingValue(world, taxablePosition!)
    expect(shelteredGross).toBeGreaterThan(500_000) // it grew, or the test proves nothing

    const retirementBefore = accountsOf(world, person.id).retirement
    const sheltered = sellInvestment(world, world.tick, person.id, 'agricultural', true)
    const taxable = sellInvestment(world, world.tick, person.id, 'agricultural', false)

    // Retirement keeps every cent, and keeps it INSIDE the account.
    expect(sheltered).toBe(shelteredGross)
    expect(accountsOf(world, person.id).retirement).toBe(retirementBefore + shelteredGross)
    // The brokerage pays the revenue service on the way out.
    expect(taxable).toBeLessThan(taxableGross)
    expect(agFund(accountsOf(world, person.id).holdings)).toBeUndefined()
  })
})

describe('every price is deterministic', () => {
  it('two worlds on one seed hold the identical portfolio a century later', () => {
    const run = (): { level: number; worth: number } => {
      const world = createWorld(makeSeed(4242), 60)
      const person = anAdult(world)
      fund(world, person.id, 1_000_000)
      buyInvestment(world, world.tick as Tick, person.id, 'consumer', 600_000 as Money)
      advanceTicks(world, 600)
      return {
        level: marketLevel(world),
        worth: portfolioValue(world, accountsOf(world, person.id).holdings),
      }
    }
    expect(run()).toEqual(run())
  })

  it('names a sector for every price it carries', () => {
    const world = createWorld(makeSeed(606), 40)
    for (const id of Object.keys(world.sectorPrices)) expect(sectorById(id)).toBeDefined()
  })
})
