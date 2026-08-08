/**
 * The stock market revamp — the company layer (spec §1-§4, §6, §9).
 *
 * The owner's diagnosis: "the engine is fine; the experience is missing."
 * You could buy units of four sectors and there was nothing to tap into.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  HISTORY_MONTHS,
  REFERENCE_PE,
  SECTORS,
  STOCKS,
  betaOf,
  dividendYieldOf,
  marketCapOf,
  peRatioOf,
  ratingOf,
  stockById,
  upsidePerMille,
  yearRangeOf,
} from '../src/market.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 40 * 12)

describe('the catalogue', () => {
  it('puts fictional companies in real sectors (charter §3)', () => {
    expect(STOCKS.length).toBeGreaterThan(25)
    const sectorIds = new Set(SECTORS.map((s) => s.id))
    for (const stock of STOCKS) {
      expect(sectorIds, `${stock.ticker} is in no sector`).toContain(stock.sectorId)
      expect(stock.ticker).toMatch(/^[A-Z]{4}$/)
      expect(stock.blurb.length).toBeGreaterThan(20)
    }
    // Tickers and ids are both keys; a duplicate of either is a bug that
    // would silently merge two companies' prices.
    expect(new Set(STOCKS.map((s) => s.id)).size).toBe(STOCKS.length)
    expect(new Set(STOCKS.map((s) => s.ticker)).size).toBe(STOCKS.length)
  })

  it('keeps the four original sector ids, whatever their titles now say', () => {
    // Every holding in every existing save is keyed by one of these
    // strings. Renaming even one would orphan somebody's portfolio.
    const ids = SECTORS.map((s) => s.id)
    for (const original of ['industrial', 'agricultural', 'defense', 'consumer']) {
      expect(ids).toContain(original)
    }
  })
})

describe('prices', () => {
  it('gives every company a price and a bounded history', () => {
    for (const stock of STOCKS) {
      expect(world.stockPrices[stock.id]).toBeGreaterThan(0)
      const history = world.stockHistory[stock.id] ?? []
      // Law 6: summarised, not hoarded. Forty years is 480 months.
      expect(history.length).toBeLessThanOrEqual(HISTORY_MONTHS)
      expect(history.length).toBeGreaterThan(0)
    }
  })

  it('never lets a company go to zero', () => {
    // A holding should be able to crash without VANISHING — the same
    // ruling the sector floor already makes.
    for (const stock of STOCKS) {
      expect(world.stockPrices[stock.id] ?? 0).toBeGreaterThanOrEqual(500)
    }
  })

  it('spreads them out, which is the whole reason to have them', () => {
    // If every company tracked its sector exactly there would be no point
    // owning one instead of the fund. MEASURED over forty years: the best
    // ran to 32x par and the worst sat below it.
    const prices = STOCKS.map((s) => world.stockPrices[s.id] ?? 0)
    expect(Math.max(...prices)).toBeGreaterThan(Math.min(...prices) * 4)
  })

  it('moves a company with its sector, not independently of it', () => {
    // The sector engine survives this revamp rather than being replaced.
    // Two names in one sector should share the sector's direction more
    // often than not, even with their own noise on top.
    const tech = STOCKS.filter((s) => s.sectorId === 'technology')
    expect(tech.length).toBeGreaterThan(1)
    const histories = tech.map((s) => world.stockHistory[s.id] ?? [])
    let together = 0
    let apart = 0
    const [a, b] = histories
    if (a === undefined || b === undefined) return
    for (let i = 1; i < Math.min(a.length, b.length); i++) {
      const moveA = (a[i] ?? 0) - (a[i - 1] ?? 0)
      const moveB = (b[i] ?? 0) - (b[i - 1] ?? 0)
      if (moveA === 0 || moveB === 0) continue
      if (moveA > 0 === moveB > 0) together += 1
      else apart += 1
    }
    expect(together).toBeGreaterThan(apart)
  })
})

describe('fundamentals', () => {
  it('derives them all, storing none', () => {
    for (const stock of STOCKS) {
      expect(marketCapOf(world, stock)).toBeGreaterThan(0)
      expect(betaOf(stock)).toBeGreaterThan(0)
      expect(dividendYieldOf(stock)).toBeGreaterThanOrEqual(0)
      const range = yearRangeOf(world, stock)
      expect(range.low).toBeLessThanOrEqual(range.high)
      const price = world.stockPrices[stock.id] ?? 0
      expect(price).toBeGreaterThanOrEqual(range.low)
      expect(price).toBeLessThanOrEqual(range.high)
    }
  })

  it('keeps P/E in a range a person would recognise', () => {
    // MEASURED at 229 the first time — the catalogue's earnings were an
    // order of magnitude too small against market cap, and because the
    // analyst panel scores value as cheap-against-a-reference, every
    // company then read as maximally cheap and 30 of 33 rated a Buy. A
    // fundamentals bug became a sentiment bug two functions downstream.
    const ratios = STOCKS.map((s) => peRatioOf(world, s)).filter((v) => v > 0)
    const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)] ?? 0
    expect(median).toBeGreaterThan(500) // P/E 5
    expect(median).toBeLessThan(6_000) // P/E 60
  })
})

describe('the analyst panel', () => {
  it('publishes a view on every company', () => {
    for (const stock of STOCKS) {
      const view = world.analystViews.get(stock.id)
      expect(view, `no view for ${stock.ticker}`).toBeDefined()
      if (view === undefined) continue
      expect(view.buy + view.hold + view.sell).toBe(view.analysts)
      expect(view.analysts).toBeGreaterThanOrEqual(12)
      expect(view.targetLow).toBeLessThanOrEqual(view.targetAvg)
      expect(view.targetAvg).toBeLessThanOrEqual(view.targetHigh)
    }
  })

  it('disagrees with itself, because a panel that does not is one opinion', () => {
    // Without a per-analyst bias every analyst reaches the same verdict
    // from the same inputs. MEASURED bimodal at one point — 17 Strong
    // Sells and a single Hold across 33 names — when the fundamentals
    // swamped the bias.
    let mixed = 0
    for (const stock of STOCKS) {
      const view = world.analystViews.get(stock.id)
      if (view === undefined) continue
      if (view.buy > 0 && view.sell > 0) mixed += 1
      else if (view.hold > 0 && (view.buy > 0 || view.sell > 0)) mixed += 1
    }
    expect(mixed).toBeGreaterThan(STOCKS.length / 2)
  })

  it('spreads its verdicts across the scale', () => {
    const seen = new Set<string>()
    for (const stock of STOCKS) {
      const view = world.analystViews.get(stock.id)
      if (view !== undefined) seen.add(ratingOf(view))
    }
    // Not all one thing. The first tuning put 32 of 33 on Buy or better.
    expect(seen.size).toBeGreaterThan(2)
  })

  it('sets a target the upside is measured from', () => {
    for (const stock of STOCKS) {
      const view = world.analystViews.get(stock.id)
      if (view === undefined) continue
      const upside = upsidePerMille(world, view)
      // A target is an opinion, not a fantasy: no doubling, no zeroing.
      expect(upside).toBeGreaterThan(-1_000)
      expect(upside).toBeLessThan(1_000)
    }
  })

  it('has a reference P/E the whole market is priced against', () => {
    expect(REFERENCE_PE).toBeGreaterThan(0)
    expect(stockById('vntk')).toBeDefined()
    expect(stockById('nope')).toBeUndefined()
  })
})
