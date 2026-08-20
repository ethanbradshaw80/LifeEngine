/**
 * Real estate phase 1 — a home is an object, not a street.
 *
 * The owner's diagnosis of the old model: "you don't choose a home, you
 * choose a street, and value/rent are just a function of that street."
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import {
  downPaymentFor,
  equityOf,
  improveProperty,
  renovationCostOf,
  saleProceedsOf,
  portfolioValueOf,
  propertiesOwnedBy,
  leaseBar,
  leaseOf,
  listingsFor,
  ownershipCostOf,
  propertiesIn,
  rentOf,
  valueOf,
} from '../src/realestate.js'
import { accountsOf, buyHome, endLease, sellHome, signLease, walletOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import { placesOfKind } from '../src/worldgen.js'

const world = createWorld(makeSeed(4141), 400)
const hoods = placesOfKind(world, 'neighbourhood')

describe('the town has a housing stock', () => {
  it('builds more homes than households, so a town can move', () => {
    // MEASURED, AND THE FIRST GUESS WAS USELESS. A flat six per
    // neighbourhood gave 48 homes for 224 households — four fifths of the
    // town with nowhere to live. The stock is sized to the town now.
    const households = [...world.households.values()].filter((h) => h.dissolvedTick === null).length
    expect(households).toBeGreaterThan(20)
    expect(world.properties.size, 'fewer homes than households').toBeGreaterThan(households)
    // And not absurdly more — scarcity has to mean something.
    expect(world.properties.size).toBeLessThan(households * 3)
  })

  it('gives every home a coherent shape', () => {
    for (const property of world.properties.values()) {
      // THE BUG THIS PINS: `>>` is a SIGNED shift, and hash32 returns a full
      // 32-bit value — so every salt above 2^31 came back negative and a
      // house was generated with a condition of minus eighty-nine.
      expect(property.condition, `${property.address} condition`).toBeGreaterThanOrEqual(0)
      expect(property.condition, `${property.address} condition`).toBeLessThanOrEqual(1000)
      expect(property.beds, `${property.address} beds`).toBeGreaterThan(0)
      expect(property.baths, `${property.address} baths`).toBeGreaterThan(0)
      expect(property.sqft, `${property.address} sqft`).toBeGreaterThan(0)
      expect(property.yearBuilt).toBeGreaterThan(1900)
      expect(property.address).toMatch(/^\d+ \w/)
      // A flat has no garden; a house does.
      if (property.type === 'apartment' || property.type === 'condo') {
        expect(property.lotSqft).toBe(0)
      } else {
        expect(property.lotSqft).toBeGreaterThan(0)
      }
    }
  })

  it('prices a home by its neighbourhood AND by what it is', () => {
    // The whole point of having properties: two homes on the same street
    // are not the same asset.
    for (const place of hoods) {
      const props = propertiesIn(world, place.id)
      if (props.length < 2) continue
      const values = props.map((p) => valueOf(world, p))
      const spread = Math.max(...values) - Math.min(...values)
      expect(spread, `${place.name} prices every home the same`).toBeGreaterThan(0)
      for (const value of values) expect(value).toBeGreaterThan(0)
    }
  })

  it('still reads the neighbourhood underneath — a good street costs more', () => {
    const byDesirability = [...hoods].sort((a, b) => a.desirability - b.desirability)
    const worst = byDesirability[0]
    const best = byDesirability[byDesirability.length - 1]
    if (!worst || !best || worst.id === best.id) return
    const median = (placeId: number): number => {
      const v = propertiesIn(world, placeId as never).map((p) => valueOf(world, p)).sort((a, b) => a - b)
      return v[Math.floor(v.length / 2)] ?? 0
    }
    expect(median(best.id), 'the best street is not dearer than the worst').toBeGreaterThan(median(worst.id))
  })

  it('charges rent in proportion to what the home is worth', () => {
    for (const property of world.properties.values()) {
      const rent = rentOf(world, property)
      expect(rent).toBeGreaterThan(0)
      // A year's rent is a fraction of the price, not a multiple of it.
      expect(rent * 12).toBeLessThan(valueOf(world, property))
    }
  })

  it('lays out the same town twice from one seed', () => {
    const twin = createWorld(makeSeed(4141), 400)
    expect(twin.properties.size).toBe(world.properties.size)
    for (const [id, property] of world.properties) {
      expect(twin.properties.get(id)).toEqual(property)
    }
  })
})

describe('the market', () => {
  it('does not offer a home somebody is living in', () => {
    // THE BUG THIS PINS. Occupancy is read off the households, so a town
    // whose families had a street but no ADDRESS read as 296 empty houses:
    // the entire stock for sale, no scarcity, and a player able to buy the
    // home a family was sitting in.
    const lived = new Set(
      [...world.households.values()]
        .filter((h) => h.dissolvedTick === null && typeof h.propertyId === 'string')
        .map((h) => h.propertyId),
    )
    expect(lived.size, 'nobody has an address').toBeGreaterThan(50)
    for (const listing of listingsFor(world)) {
      expect(lived.has(listing.property.id), `${listing.property.address} is lived in`).toBe(false)
    }
  })

  it('gives every founding household a door', () => {
    const doorless = [...world.households.values()].filter(
      (h) => h.dissolvedTick === null && (h.propertyId === undefined || h.propertyId === null),
    )
    expect(doorless.length, 'a household has a street but no address').toBe(0)
  })

  it('leaves something on the market to buy', () => {
    const listings = listingsFor(world)
    expect(listings.length, 'nothing for sale anywhere').toBeGreaterThan(5)
    expect(listings.some((l) => l.forSale)).toBe(true)
    expect(listings.some((l) => l.forRent)).toBe(true)
  })

  it('filters the way a buyer would', () => {
    const all = listingsFor(world)
    const cheapest = Math.min(...all.map((l) => l.price))
    const budget = listingsFor(world, { maxPrice: (cheapest * 1.5) as never })
    expect(budget.length).toBeGreaterThan(0)
    expect(budget.length).toBeLessThan(all.length)
    for (const l of budget) expect(l.price).toBeLessThanOrEqual(cheapest * 1.5)

    const big = listingsFor(world, { minBeds: 4 })
    for (const l of big) expect(l.property.beds).toBeGreaterThanOrEqual(4)
  })

  it('tells the truth about what owning costs a month', () => {
    // Spec §3: show the breakdown, "so the real cost is honest, not just
    // P&I". A player who budgets for the mortgage and is then surprised by
    // tax and upkeep was misled by the interface, not by the market.
    const listing = listingsFor(world).find((l) => l.forSale)
    if (!listing) throw new Error('nothing for sale')
    const cost = ownershipCostOf(world, listing.property, 90_000 as never)
    expect(cost.mortgage).toBe(90_000)
    expect(cost.propertyTax).toBeGreaterThan(0)
    expect(cost.insurance).toBeGreaterThan(0)
    expect(cost.maintenance).toBeGreaterThan(0)
    expect(cost.total).toBe(
      cost.mortgage + cost.propertyTax + cost.insurance + cost.hoa + cost.maintenance,
    )
    // The extras are real but not ruinous — they should not double the bill.
    expect(cost.total).toBeLessThan(cost.mortgage * 2)
  })

  it('charges a service charge only where there is a building to service', () => {
    for (const listing of listingsFor(world)) {
      const cost = ownershipCostOf(world, listing.property, 0 as never)
      const managed = listing.property.type === 'condo' || listing.property.type === 'apartment'
      if (managed) expect(cost.hoa).toBeGreaterThan(0)
      else expect(cost.hoa, `${listing.property.address} is a house with an HOA`).toBe(0)
    }
  })
})

describe('renting is an agreement about a home', () => {
  /** A fresh world per test — these mutate. */
  function aTenant() {
    const w = createWorld(makeSeed(4141), 400)
    const person = livingPeople(w)
      .filter((p) => p.householdId !== null)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')
    const listing = listingsFor(w).find((l) => l.forRent)
    if (!listing) throw new Error('nothing to rent')
    return { w, person, listing }
  }

  it('takes the first month and a deposit, and holds the deposit', () => {
    // A DEPOSIT IS HELD, NOT SPENT. Recording it as an ordinary expense
    // would have been quietly taking an extra month's rent from every
    // tenant in the game.
    const { w, person, listing } = aTenant()
    const before = accountsOf(w, person.id)
    const cashBefore = before.checking + before.savings
    expect(signLease(w, w.tick, person.id, listing.property.id)).toBe(true)

    const lease = leaseOf(w, person.householdId as never)
    expect(lease).toBeDefined()
    expect(lease?.monthlyRent).toBe(listing.monthlyRent)
    expect(lease?.depositCents).toBe(listing.monthlyRent)

    const after = accountsOf(w, person.id)
    expect(cashBefore - (after.checking + after.savings)).toBe(listing.monthlyRent * 2)
  })

  it('moves the household into that actual home', () => {
    const { w, person, listing } = aTenant()
    signLease(w, w.tick, person.id, listing.property.id)
    const household = w.households.get(person.householdId as never)
    expect(household?.propertyId).toBe(listing.property.id)
    expect(household?.placeId).toBe(listing.property.neighbourhoodPlaceId)
    // And the home is off the market.
    expect(listingsFor(w).some((l) => l.property.id === listing.property.id)).toBe(false)
  })

  it('refuses in words when the money is not there', () => {
    const { w, person, listing } = aTenant()
    const bar = leaseBar(w, person.householdId as never, listing.property.id, 1 as never)
    expect(bar).not.toBeNull()
    expect(bar).toContain('dollars')
  })

  it('will not let two households take the same home', () => {
    const { w, person, listing } = aTenant()
    expect(signLease(w, w.tick, person.id, listing.property.id)).toBe(true)
    const other = livingPeople(w)
      .filter((p) => p.householdId !== null && p.householdId !== person.householdId)
      .sort((a, b) => a.id - b.id)[0]
    if (!other) return
    expect(leaseBar(w, other.householdId as never, listing.property.id, 10_000_000 as never)).toContain(
      'lives there',
    )
  })

  it('gives the deposit back when the place was kept', () => {
    const { w, person, listing } = aTenant()
    signLease(w, w.tick, person.id, listing.property.id)
    const before = accountsOf(w, person.id)
    endLease(w, w.tick, person.householdId as never)
    const after = accountsOf(w, person.id)
    const sound = (w.properties.get(listing.property.id)?.condition ?? 0) >= 500
    if (sound) {
      expect(after.checking + after.savings).toBeGreaterThan(before.checking + before.savings)
    }
    expect(leaseOf(w, person.householdId as never)).toBeUndefined()
    // And it is back on the market.
    expect(listingsFor(w).some((l) => l.property.id === listing.property.id)).toBe(true)
  })
})

describe('the down payment is a choice above the floor', () => {
  it('never goes under what a lender wants, however little you offer', () => {
    const price = 10_000_000 as never
    const floor = 2_000_000 as never
    // A lender wants a fifth at minimum, and the slider does not overrule it.
    expect(downPaymentFor(price, 0, floor)).toBe(floor)
    expect(downPaymentFor(price, 50, floor)).toBe(floor)
  })

  it('lets a buyer put more down than the minimum', () => {
    const price = 10_000_000 as never
    const floor = 2_000_000 as never
    expect(downPaymentFor(price, 350, floor)).toBe(3_500_000)
    expect(downPaymentFor(price, 500, floor)).toBe(5_000_000)
    // And never more than the house costs.
    expect(downPaymentFor(price, 1_000, floor)).toBe(price)
  })
})

describe('a house is wealth, or a loss', () => {
  function aBuyer() {
    const w = createWorld(makeSeed(4141), 400)
    // A renter, since H2's founding tenure — see aBuyerWithMoney. And a
    // YOUNG one: these tests hold the house for ten simulated years, and
    // the lowest-id renter turned out to be sixty-eight — dead at tick 94,
    // house passed to the heir, and "pays off the mortgage out of the
    // sale" was suddenly a test of probate.
    const person = livingPeople(w)
      .filter(
        (p) =>
          p.householdId !== null &&
          ageAt(p.birthTick, w.tick) >= 25 &&
          ageAt(p.birthTick, w.tick) <= 45 &&
          accountsOf(w, p.id).homePlaceId === null &&
          propertiesOwnedBy(w, p.id).length === 0,
      )
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody rents')
    const listing = listingsFor(w)
      .filter((l) => l.forSale)
      .sort((a, b) => a.price - b.price)[0]
    if (!listing) throw new Error('nothing for sale')
    // BOTH, for the reason in credit.test.ts's `fund`.
    const acc = accountsOf(w, person.id)
    w.accounts.set(person.id, { ...acc, savings: (listing.price * 2) as never })
    const purse = walletOf(w, person.id)
    if (purse.personId !== person.id) w.accounts.set(purse.personId, { ...purse, savings: (listing.price * 2) as never })
    return { w, person, listing }
  }

  it('builds equity from paying down AND from the market', () => {
    // MEASURED: bought at $19,500, and ten years later worth $24,584 with
    // $15,099 still owed — equity $9,485, up from the $3,900 deposit. Both
    // halves are doing work: the principal falls and the value rises.
    const { w, person, listing } = aBuyer()
    expect(
      buyHome(w, w.tick, person.id, listing.property.neighbourhoodPlaceId, 'mortgage', listing.property.id),
    ).toBe(true)
    const owed0 = accountsOf(w, person.id).loans.find((l) => l.kind === 'mortgage')?.balance ?? 0
    const equity0 = equityOf(w, listing.property.id, owed0 as never)
    expect(equity0).toBeGreaterThan(0)

    advanceTicks(w, 10 * 12)
    const owed1 = accountsOf(w, person.id).loans.find((l) => l.kind === 'mortgage')?.balance ?? 0
    expect(owed1, 'the mortgage never went down').toBeLessThan(owed0)
    expect(equityOf(w, listing.property.id, owed1 as never)).toBeGreaterThan(equity0)
  }, 300_000)

  it('tells the seller the NET, not the headline', () => {
    // A gross price is not a net one. A player who sells expecting the
    // headline and receives five per cent less was lied to by the screen.
    const { w, listing } = aBuyer()
    const { price, fee, net } = saleProceedsOf(w, listing.property.id)
    expect(price).toBeGreaterThan(0)
    expect(fee).toBeGreaterThan(0)
    expect(net).toBe(price - fee)
    expect(fee).toBeLessThan(price / 10)
  })

  it('pays off the mortgage out of the sale and hands over the rest', () => {
    const { w, person, listing } = aBuyer()
    buyHome(w, w.tick, person.id, listing.property.neighbourhoodPlaceId, 'mortgage', listing.property.id)
    advanceTicks(w, 10 * 12)
    const before = accountsOf(w, person.id)
    const owed = before.loans.find((l) => l.kind === 'mortgage')?.balance ?? 0
    const { net } = saleProceedsOf(w, listing.property.id)

    expect(sellHome(w, w.tick, person.id, listing.property.id)).toBe(true)
    const after = accountsOf(w, person.id)
    expect(after.loans.some((l) => l.kind === 'mortgage'), 'still owes a mortgage').toBe(false)
    expect(after.homePlaceId, 'still owns a home').toBeNull()
    // Proceeds land in the WALLET (H0) — measured as liquid, not a bucket.
    expect(
      after.checking + after.savings - (before.checking + before.savings),
    ).toBe(net - owed)
    // And the home is back on the market for somebody else.
    expect(listingsFor(w).some((l) => l.property.id === listing.property.id)).toBe(true)
  }, 300_000)

  it('wears a house down over the years, so upkeep is worth paying for', () => {
    const w = createWorld(makeSeed(4141), 400)
    const id = [...w.properties.keys()].sort()[0]
    if (id === undefined) throw new Error('no stock')
    const before = w.properties.get(id)?.condition ?? 0
    advanceTicks(w, 20 * 12)
    const after = w.properties.get(id)?.condition ?? 0
    expect(after, 'a house never ages').toBeLessThan(before)
    // Worn, not vanished — a wreck is still recoverable by somebody who
    // will spend on it, which is what makes renovation a real choice.
    expect(after).toBeGreaterThanOrEqual(0)
  }, 300_000)

  it('prices the work by what the finished home is worth', () => {
    const w = createWorld(makeSeed(4141), 400)
    const worn = [...w.properties.values()].sort((a, b) => a.condition - b.condition)[0]
    if (!worn) throw new Error('no stock')
    const cost = renovationCostOf(w, worn.id, 950)
    expect(cost).toBeGreaterThan(0)
    // Doing nothing costs nothing.
    expect(renovationCostOf(w, worn.id, worn.condition)).toBe(0)
    expect(improveProperty(w, worn.id, 950)).toBe(true)
    expect(w.properties.get(worn.id)?.condition).toBe(950)
    // And a better house is worth more, which is the whole return on it.
    expect(renovationCostOf(w, worn.id, 950)).toBe(0)
  })
})

describe('a portfolio, not a single home', () => {
  function aBuyerWithMoney() {
    const w = createWorld(makeSeed(4141), 400)
    // A RENTER, explicitly, since H2's founding tenure: sixty-two percent
    // of the town now owns from day zero, and these tests' clean-slate
    // premise was only ever true by accident. The premise is real for the
    // renting third, so the buyer comes from there.
    const person = livingPeople(w)
      .filter(
        (p) =>
          p.householdId !== null &&
          accountsOf(w, p.id).homePlaceId === null &&
          propertiesOwnedBy(w, p.id).length === 0,
      )
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody rents')
    const acc2 = accountsOf(w, person.id)
    w.accounts.set(person.id, { ...acc2, savings: 500_000_000 as never })
    const purse2 = walletOf(w, person.id)
    if (purse2.personId !== person.id) w.accounts.set(purse2.personId, { ...purse2, savings: 500_000_000 as never })
    return { w, person }
  }

  it('lets one person hold the deed to several homes', () => {
    // OWNERSHIP USED TO BE ONE FIELD on one person's bank accounts — a
    // NEIGHBOURHOOD, not a house — so buying a second silently overwrote
    // the first. The deed belongs on the property.
    const { w, person } = aBuyerWithMoney()
    const forSale = listingsFor(w).filter((l) => l.forSale).slice(0, 3)
    expect(forSale.length).toBe(3)
    for (const l of forSale) {
      expect(
        buyHome(w, w.tick, person.id, l.property.neighbourhoodPlaceId, 'cash', l.property.id),
      ).toBe(true)
    }
    const mine = propertiesOwnedBy(w, person.id)
    expect(mine.length, 'a second purchase overwrote the first').toBe(3)
    expect(portfolioValueOf(w, person.id)).toBeGreaterThan(0)
  })

  it('moves you into your FIRST home and leaves you put for the rest', () => {
    // THE BUG THIS PINS. The rule was "move in if you have nowhere", but
    // every household is seated in a home at worldgen — so a first-time
    // buyer never moved into the house they had just bought, and "sell your
    // home" then defaulted to a house they did not own. The question is
    // whether they already OWN where they live.
    const { w, person } = aBuyerWithMoney()
    const forSale = listingsFor(w).filter((l) => l.forSale).slice(0, 2)
    const first = forSale[0]
    const second = forSale[1]
    if (!first || !second) throw new Error('need two')

    buyHome(w, w.tick, person.id, first.property.neighbourhoodPlaceId, 'cash', first.property.id)
    expect(w.households.get(person.householdId as never)?.propertyId).toBe(first.property.id)

    buyHome(w, w.tick, person.id, second.property.neighbourhoodPlaceId, 'cash', second.property.id)
    expect(
      w.households.get(person.householdId as never)?.propertyId,
      'buying a second house moved the family into it',
    ).toBe(first.property.id)
  })

  it('keeps an owner’s empty second home off the open market', () => {
    // An occupancy-only vacancy test would let the next buyer take it out
    // from under them the moment anybody owned two.
    const { w, person } = aBuyerWithMoney()
    const forSale = listingsFor(w).filter((l) => l.forSale).slice(0, 2)
    const second = forSale[1]
    if (!second) throw new Error('need two')
    buyHome(w, w.tick, person.id, second.property.neighbourhoodPlaceId, 'cash', second.property.id)
    expect(listingsFor(w).some((l) => l.property.id === second.property.id)).toBe(false)
  })

  it('sells the house you named, not the one you are standing in', () => {
    const { w, person } = aBuyerWithMoney()
    const forSale = listingsFor(w).filter((l) => l.forSale).slice(0, 2)
    const home = forSale[0]
    const rental = forSale[1]
    if (!home || !rental) throw new Error('need two')
    buyHome(w, w.tick, person.id, home.property.neighbourhoodPlaceId, 'cash', home.property.id)
    buyHome(w, w.tick, person.id, rental.property.neighbourhoodPlaceId, 'cash', rental.property.id)

    expect(sellHome(w, w.tick, person.id, rental.property.id)).toBe(true)
    // The one they live in is untouched, and still theirs.
    expect(w.households.get(person.householdId as never)?.propertyId).toBe(home.property.id)
    expect(propertiesOwnedBy(w, person.id).map((p) => p.id)).toEqual([home.property.id])
  })

  it('will not sell what somebody else owns', () => {
    const { w, person } = aBuyerWithMoney()
    const other = listingsFor(w).filter((l) => l.forSale)[0]
    if (!other) throw new Error('nothing for sale')
    expect(sellHome(w, w.tick, person.id, other.property.id)).toBe(false)
  })
})
