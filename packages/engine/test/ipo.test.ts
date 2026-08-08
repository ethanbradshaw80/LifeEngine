/**
 * THE CAPSTONE: careers -> business -> stock market (careers overhaul,
 * Fix 3B and 3C).
 *
 * The claims: a trade grows into a company, a company big enough can be
 * floated, the float pays the founder real money AND leaves them holding
 * real shares, the listed company then behaves like every other stock in
 * the world, and it can DIE — because a market where nothing fails is a
 * price list (owner: "some companies fail and some succeed").
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { setPlayer, scaleUpPlayer, takePublicPlayer, ipoBar, businessOf } from '../src/player.js'
import {
  SCALE_UP_YEARS,
  businessKindById,
  valuationOf,
  annualRevenueOf,
  founderSalaryOf,
  CAPITAL_CEILING_MULTIPLE,
  COMPANY_CEILING_MULTIPLE,
} from '../src/business.js'
import {
  IPO_MIN_VALUATION,
  allStocks,
  stockById,
  stocksInSector,
  runDelistings,
  DELIST_BELOW,
} from '../src/market.js'
import { accountsOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import type { Business, World } from '../src/types.js'

/**
 * A world with a player running a company big enough to float.
 *
 * BUILT RATHER THAN HOPED FOR. A contracting firm that survives eight years
 * and hits its capital ceiling is rare enough that waiting for the town to
 * produce one would be a test that passes or fails on the seed. The
 * SITUATION is constructed; everything the test then asserts is the real
 * code's answer to it.
 */
function withCompany(seed: number): { world: World; business: Business } {
  const world = createWorld(makeSeed(seed), 400)
  advanceTicks(world, 12 * 30)
  // SOMEBODY WHO DOES NOT ALREADY RUN SOMETHING. `businessOf` returns the
  // first trading business a person owns, so picking an existing owner
  // would quietly test their business rather than the one built below —
  // which is exactly what happened the first time this was written.
  const owners = new Set(
    [...world.businesses.values()].filter((b) => b.closedTick === null).map((b) => b.ownerId),
  )
  const person = livingPeople(world).find((p) => p.deathTick === null && !owners.has(p.id))
  if (person === undefined) throw new Error('no living person without a business')
  setPlayer(world, person.id)

  const kind = businessKindById('contracting-firm')
  if (kind === undefined) throw new Error('no such kind')
  const business: Business = {
    id: 900_001 as Business['id'],
    ownerId: person.id,
    kindId: 'contracting-firm',
    name: 'Ashcombe Contracting',
    foundedTick: (world.tick - 12 * (SCALE_UP_YEARS + 2)) as Business['foundedTick'],
    // Well past its own ceiling, which is what the scale-up gate asks.
    // At the company ceiling — a fully grown one, which is what the IPO
    // threshold is calibrated against.
    capital: (kind.capital * COMPANY_CEILING_MULTIPLE) as Money,
    employees: 12,
    badMonths: 0,
    closedTick: null,
    generations: 0,
  }
  world.businesses.set(business.id, business)
  return { world, business }
}

describe('a trade becomes a company', () => {
  it('scales up, and the salary replaces the draw', () => {
    const { world, business } = withCompany(7788)
    const kind = businessKindById(business.kindId)
    if (kind === undefined) throw new Error('no kind')

    // Before: no valuation and no salary. A trade is not a company.
    expect(valuationOf(business, kind)).toBe(0)
    expect(founderSalaryOf(business, kind)).toBe(0)

    expect(scaleUpPlayer(world).done).toBe(true)
    const grown = businessOf(world, world.player.personId ?? 0)
    expect(grown).toBeDefined()
    if (grown === undefined) return
    expect(grown.scaledAtTick).not.toBeNull()
    expect(valuationOf(grown, kind)).toBeGreaterThan(0)
    expect(founderSalaryOf(grown, kind)).toBeGreaterThan(0)
    // The valuation is revenue times a multiple, and revenue is the bigger
    // of the two — a company is not worth one year of takings.
    expect(valuationOf(grown, kind)).toBeGreaterThan(annualRevenueOf(grown, kind))
  })

  it('refuses to scale a business that is too young or too small', () => {
    const { world, business } = withCompany(7788)
    const kind = businessKindById(business.kindId)
    if (kind === undefined) throw new Error('no kind')

    // Too young: founded this month.
    world.businesses.set(business.id, { ...business, foundedTick: world.tick })
    expect(scaleUpPlayer(world).done).toBe(false)

    // Old enough, but it never grew into what it already is.
    world.businesses.set(business.id, {
      ...business,
      capital: (kind.capital / 2) as Money,
    })
    expect(scaleUpPlayer(world).done).toBe(false)
  })
})

describe('taking it public', () => {
  it('a trade cannot list, and the refusal says why', () => {
    const { world } = withCompany(7788)
    const bar = ipoBar(world, world.player.personId ?? 0)
    expect(bar).not.toBeNull()
    expect(bar).toContain('company')
  })

  it('pays the founder AND leaves them holding the rest', () => {
    const { world, business } = withCompany(7788)
    expect(scaleUpPlayer(world).done).toBe(true)
    const personId = world.player.personId
    expect(personId).not.toBeNull()
    if (personId === null) return

    const kind = businessKindById(business.kindId)
    if (kind === undefined) return
    const grown = businessOf(world, personId)
    if (grown === undefined) return
    expect(valuationOf(grown, kind)).toBeGreaterThanOrEqual(IPO_MIN_VALUATION)

    const cashBefore = accountsOf(world, personId).savings + accountsOf(world, personId).checking
    const listedBefore = allStocks(world).length

    expect(ipoBar(world, personId)).toBeNull()
    expect(takePublicPlayer(world).done).toBe(true)

    // 1. THE MARKET listed it, and the same lookup every other stock uses
    //    finds it. This is the whole architectural claim of the phase.
    expect(allStocks(world).length).toBe(listedBefore + 1)
    const after = businessOf(world, personId)
    expect(after?.listedStockId).toBeDefined()
    const stockId = after?.listedStockId ?? ''
    const stock = stockById(world, stockId)
    expect(stock).toBeDefined()
    if (stock === undefined) return
    // It listed into a real sector, alongside real peers.
    expect(stocksInSector(world, stock.sectorId).some((x) => x.id === stockId)).toBe(true)
    // And it has a price and a history, so the chart is not empty.
    expect(world.stockPrices[stockId]).toBeGreaterThan(0)
    expect((world.stockHistory[stockId] ?? []).length).toBeGreaterThan(0)

    // 2. FINANCES paid them for the slice they sold.
    const cashAfter = accountsOf(world, personId).savings + accountsOf(world, personId).checking
    expect(cashAfter).toBeGreaterThan(cashBefore)

    // 3. And the rest is SHARES they hold, in their own portfolio.
    const holding = accountsOf(world, personId).holdings.find((h) => h.stockId === stockId)
    expect(holding).toBeDefined()
    expect(holding?.units ?? 0).toBeGreaterThan(0)
    // With a real cost basis — not zero, which would tax the whole stake
    // as a gain the first time they sold a single share.
    expect(holding?.costBasis ?? 0).toBeGreaterThan(0)
    // They kept control.
    expect(after?.founderStakePerMille ?? 0).toBeGreaterThan(500)
  })

  it('cannot be floated twice', () => {
    const { world } = withCompany(7788)
    expect(scaleUpPlayer(world).done).toBe(true)
    expect(takePublicPlayer(world).done).toBe(true)
    expect(takePublicPlayer(world).done).toBe(false)
    expect(ipoBar(world, world.player.personId ?? 0)).toBe('It is already public.')
  })

  it('the listed company keeps trading like any other stock', () => {
    const { world } = withCompany(7788)
    expect(scaleUpPlayer(world).done).toBe(true)
    expect(takePublicPlayer(world).done).toBe(true)
    const stockId = businessOf(world, world.player.personId ?? 0)?.listedStockId ?? ''

    advanceTicks(world, 24)
    // A price that moves, a history that grows, and analyst coverage — the
    // three things that would silently not happen if any market pass had
    // been left iterating the fixed table.
    expect((world.stockHistory[stockId] ?? []).length).toBeGreaterThan(1)
    expect(world.analystViews.get(stockId)).toBeDefined()
  })
})

describe('and it can fail', () => {
  /**
   * OWNER: "some companies fail and some succeed type thing."
   *
   * The situation is BUILT — waiting for a real company to fall ninety-five
   * per cent over six straight months would be a test that runs for a
   * simulated century and still might not fire.
   */
  it('a company the market gave up on comes off the board, and the shares go with it', () => {
    const { world } = withCompany(7788)
    expect(scaleUpPlayer(world).done).toBe(true)
    expect(takePublicPlayer(world).done).toBe(true)
    const personId = world.player.personId ?? 0
    const stockId = businessOf(world, personId)?.listedStockId ?? ''
    expect(accountsOf(world, personId).holdings.some((h) => h.stockId === stockId)).toBe(true)

    // Six straight months on the floor, and WELL below it rather than just
    // under. The tick loop steps every price before it checks for
    // delistings, so a company sitting a hair under the line can be lifted
    // back over it by one good month and never delist — which is correct
    // behaviour, and would make this test depend on the seed.
    const dead = Math.floor(DELIST_BELOW / 10)
    ;(world as { stockPrices: Record<string, number> }).stockPrices = {
      ...world.stockPrices,
      [stockId]: dead,
    }
    ;(world as { stockHistory: Record<string, readonly number[]> }).stockHistory = {
      ...world.stockHistory,
      [stockId]: [dead, dead, dead, dead, dead, dead],
    }

    // DRIVEN THROUGH THE TICK LOOP, not by calling runDelistings here. The
    // market takes the company off the board and FINANCES voids the paper,
    // and the point is that BOTH halves happen — calling the market's half
    // directly delists it and leaves the holding behind, which is precisely
    // the bug this test exists to catch.
    advanceTicks(world, 1)
    expect(stockById(world, stockId)).toBeUndefined()
    expect(accountsOf(world, personId).holdings.some((h) => h.stockId === stockId)).toBe(false)
  })

  it('a healthy listing is left alone', () => {
    const { world } = withCompany(7788)
    expect(scaleUpPlayer(world).done).toBe(true)
    expect(takePublicPlayer(world).done).toBe(true)
    expect(runDelistings(world, world.tick).length).toBe(0)
  })

  it('never delists one of the world\'s own thirty-three', () => {
    const { world } = withCompany(7788)
    // Put EVERY fixed company on the floor and hold it there. Not one of
    // them may be removed: they are the backdrop the whole economy is
    // calibrated against, every holding in them would point at nothing, and
    // a sector would quietly lose a company for no gain. Nothing this town
    // floated is in this world, so a correct pass removes nothing at all.
    const floor: Record<string, number> = { ...world.stockPrices }
    const history: Record<string, readonly number[]> = { ...world.stockHistory }
    for (const stock of allStocks(world)) {
      floor[stock.id] = 10
      history[stock.id] = [10, 10, 10, 10, 10, 10]
    }
    ;(world as { stockPrices: Record<string, number> }).stockPrices = floor
    ;(world as { stockHistory: Record<string, readonly number[]> }).stockHistory = history
    const before = allStocks(world).length
    expect(runDelistings(world, world.tick).length).toBe(0)
    expect(allStocks(world).length).toBe(before)
  })
})
