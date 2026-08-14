/**
 * RUNNING THE BUSINESS (owner, 2026-08-13: "we need literally actions that
 * you can click on in the business menu to also grow the business like
 * buying item stock, selling item stock, looking for new vendor to get
 * lower prices on whatever we sell").
 *
 * THE CLAIMS: a shelf is measured at what it cost and selling empties it;
 * running out costs the sale rather than being free; a bulk order is
 * cheaper per month; suppliers differ in price AND in quality, so the cheap
 * one is a decision rather than a gift; the price you set trades custom
 * against margin; and the owner decides what to take out.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { walletOf } from '../src/finances.js'
import {
  PRICE_STEPS,
  bulkDiscountPerMille,
  demandFromPricePerMille,
  freshOps,
  marginFromPricePerMille,
  servedPerMille,
  stockNeededFor,
  vendorOfferFrom,
} from '../src/operations.js'
import { businessKindById } from '../src/business.js'
import {
  businessOf,
  clearStockPlayer,
  haggleVendorPlayer,
  opsFor,
  orderStockPlayer,
  setPricePlayer,
  setRetainPlayer,
  setPlayer,
  startBusiness,
  stockReport,
  switchVendorPlayer,
  vendorOffersFor,
} from '../src/player.js'

/** A player running a shop, with money and no decision in the way. */
function aShopkeeper(seed = 12345) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 45)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
  startBusiness(world, 'shop')
  ;(world.player as { pending: unknown }).pending = null
  return { world, person }
}

describe('the shelf', () => {
  it('is measured at what it cost, and selling empties it', () => {
    /**
     * THE TRICK THAT MAKES AN INVENTORY FIT AN ENGINE THAT NEVER HAD ONE:
     * a shelf of shampoo, a tank of diesel and a rack of videos are not
     * comparable in units and are perfectly comparable in cost.
     */
    const { world } = aShopkeeper()
    const before = stockReport(world)
    expect(before).toBeDefined()
    if (!before) return
    expect(before.held).toBe(0)
    expect(before.monthly).toBeGreaterThan(0)

    expect(orderStockPlayer(world, 3).done).toBe(true)
    const after = stockReport(world)
    expect(after?.held).toBe(before.monthly * 3)
    expect(after?.monthsCovered).toBeGreaterThanOrEqual(2.9)

    // A year of trading eats it.
    advanceTicks(world, 12)
    ;(world.player as { pending: unknown }).pending = null
    expect(stockReport(world)?.held).toBeLessThan(after?.held ?? 0)
  })

  it('costs the sale when it runs out, rather than being free', () => {
    // Short of stock you serve part of the month. This is the whole reason
    // ordering is a decision instead of a formality.
    expect(servedPerMille(0 as Money, 1000 as Money)).toBe(0)
    expect(servedPerMille(500 as Money, 1000 as Money)).toBe(500)
    expect(servedPerMille(1000 as Money, 1000 as Money)).toBe(1000)
    expect(servedPerMille(9999 as Money, 1000 as Money)).toBe(1000)
    // A trade with no cost of goods can never be short of anything.
    expect(servedPerMille(0 as Money, 0 as Money)).toBe(1000)
  })

  it('charges less per month for a bigger order', () => {
    expect(bulkDiscountPerMille(1)).toBe(0)
    expect(bulkDiscountPerMille(3)).toBeGreaterThan(0)
    expect(bulkDiscountPerMille(6)).toBeGreaterThan(bulkDiscountPerMille(3))

    const { world } = aShopkeeper()
    const report = stockReport(world)
    if (!report) return
    const one = report.quotes.find((q) => q.months === 1)?.cost ?? 0
    const six = report.quotes.find((q) => q.months === 6)?.cost ?? 0
    expect(six).toBeLessThan(one * 6)
  })

  it('gives back less than it cost when it is dumped', () => {
    const { world, person } = aShopkeeper()
    expect(orderStockPlayer(world, 3).done).toBe(true)
    const shelf = stockReport(world)?.held ?? 0
    // THE TILL IS PAID, not the pocket: stock is the business's money.
    const tillBefore = businessOf(world, person.id)?.capital ?? 0

    expect(clearStockPlayer(world).done).toBe(true)
    const back = (businessOf(world, person.id)?.capital ?? 0) - tillBefore
    expect(back).toBeGreaterThan(0)
    expect(back, 'a clearance should not pay full price').toBeLessThan(shelf)
    expect(stockReport(world)?.held).toBe(0)
    // And there is nothing left to clear.
    expect(clearStockPlayer(world).done).toBe(false)
  })

  it('eats more of a trade that sells goods than one that sells hours', () => {
    const shop = businessKindById('shop')
    const software = businessKindById('software-company')
    if (!shop || !software) return
    const takings = 1_000_000 as Money
    expect(stockNeededFor(takings, shop)).toBeGreaterThan(stockNeededFor(takings, software))
  })
})

describe('the supplier', () => {
  it('offers a real choice: cheap usually means shoddy', () => {
    // A cheaper vendor that was simply better would make the decision a
    // formality. The roll that lowers the price usually lowers the goods.
    const cheap = vendorOfferFrom(3, 0, 0)
    const dear = vendorOfferFrom(3, 300, 0)
    expect(cheap.ratePerMille).toBeLessThan(dear.ratePerMille)
    expect(cheap.qualityPerMille).toBeLessThanOrEqual(dear.qualityPerMille)
    // Names are fictional, always (charter §3).
    expect(cheap.name.length).toBeGreaterThan(3)
  })

  it('can be swapped, and the new rate is what you then pay', () => {
    const { world } = aShopkeeper()
    const offers = vendorOffersFor(world)
    expect(offers.length).toBeGreaterThan(0)
    const cheapest = [...offers].sort((a, b) => a.ratePerMille - b.ratePerMille)[0]
    if (!cheapest) return

    expect(switchVendorPlayer(world, cheapest.name).done).toBe(true)
    expect(opsFor(world)?.vendorName).toBe(cheapest.name)
    expect(opsFor(world)?.vendorRatePerMille).toBe(cheapest.ratePerMille)
    // Somebody who is not offering cannot be switched to.
    expect(switchVendorPlayer(world, 'Nobody At All').done).toBe(false)
  })

  it('has a floor: haggling is not a button you hold down', () => {
    const { world } = aShopkeeper()
    // Push them as far as they go, then confirm they stop.
    for (let i = 0; i < 40; i += 1) haggleVendorPlayer(world)
    const rate = opsFor(world)?.vendorRatePerMille ?? 0
    expect(rate).toBeGreaterThanOrEqual(820)
    if (rate <= 820) {
      expect(haggleVendorPlayer(world).reason).toContain('not go lower')
    }
  })
})

describe('the price you set', () => {
  it('trades custom against what you keep, and not symmetrically', () => {
    // Cutting wins custom, raising loses it — and going dear costs more
    // custom than going cheap wins, because a small town has only so many
    // people in it.
    const cheap = demandFromPricePerMille(800)
    const dear = demandFromPricePerMille(1300)
    expect(cheap).toBeGreaterThan(0)
    expect(dear).toBeLessThan(0)
    expect(Math.abs(dear)).toBeGreaterThan(cheap)
    expect(demandFromPricePerMille(1000)).toBe(0)

    // And the margin runs the other way.
    expect(marginFromPricePerMille(800)).toBeLessThan(0)
    expect(marginFromPricePerMille(1300)).toBeGreaterThan(0)
  })

  it('only takes the settings the screen offers', () => {
    const { world } = aShopkeeper()
    const step = PRICE_STEPS[0]
    if (!step) return
    expect(setPricePlayer(world, step.perMille).done).toBe(true)
    expect(opsFor(world)?.markupPerMille).toBe(step.perMille)
    expect(setPricePlayer(world, 4321).done).toBe(false)
  })
})

describe('what the owner takes out', () => {
  it('is the owner’s to set, and it was not before', () => {
    // The engine always retained a flat 30% with nobody asked. The dial is
    // the single biggest lever on whether a business grows, and it was
    // invisible.
    expect(freshOps().retainPerMille).toBe(300)

    const { world } = aShopkeeper()
    expect(setRetainPlayer(world, 800).done).toBe(true)
    expect(opsFor(world)?.retainPerMille).toBe(800)
    // Clamped rather than refused, so a bad number cannot break a save.
    expect(setRetainPlayer(world, 5000).done).toBe(true)
    expect(opsFor(world)?.retainPerMille).toBeLessThanOrEqual(900)
  })
})
