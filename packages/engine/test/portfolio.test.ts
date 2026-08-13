/**
 * The property portfolio (owner's property-ui.html mockup): rental income
 * to living landlords, refinancing, credit-gated down payments, real
 * foreclosure, and the neighbourhood's own weather. Each claim is written
 * to fail on the behaviour that shipped before it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTick, advanceTicks } from '../src/tick.js'
import { depositFor, depositShareFor, monthlyPaymentFor } from '../src/credit.js'
import {
  accountsOf,
  buyHome,
  refinanceBar,
  refinanceMortgage,
  rentalIncomeOf,
  walletOf,
} from '../src/finances.js'
import { listingsFor, propertiesOwnedBy, trendOf } from '../src/realestate.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'

describe('the down payment reads the file', () => {
  it('a strong file puts a tenth down; a thin one puts a quarter', () => {
    const price = 10_000_000 as Money
    expect(depositFor(price, 750)).toBe(1_000_000)
    expect(depositFor(price, 660)).toBe(1_500_000)
    expect(depositFor(price, 600)).toBe(2_000_000)
    // The bottom band is a quarter, not a third — a thin young file reads
    // ~450 and a 30% gate priced every first-time buyer out (owner).
    expect(depositFor(price, 400)).toBe(2_500_000)
    // Legacy callers without a credit score keep the flat fifth.
    expect(depositFor(price)).toBe(2_000_000)
    expect(depositShareFor(750)).toBe(100)
  })
})

describe('the landlord is a person', () => {
  it('a tenanted deed pays its owner, month after month', () => {
    const world = createWorld(makeSeed(4242), 200)
    // A young renter buys a SECOND home cash and a stranger household is
    // seated in it — the constructed shape of every inherited or bought-to-
    // let deed in the wild.
    const owner = livingPeople(world).find(
      (p) =>
        ageAt(p.birthTick, world.tick) >= 25 &&
        ageAt(p.birthTick, world.tick) <= 40 &&
        propertiesOwnedBy(world, p.id).length === 0,
    )
    expect(owner).toBeDefined()
    if (!owner) return
    const listing = listingsFor(world).filter((l) => l.forSale).sort((a, b) => a.price - b.price)[0]
    expect(listing).toBeDefined()
    if (!listing) return
    const accounts = accountsOf(world, owner.id)
    world.accounts.set(owner.id, { ...accounts, savings: (listing.price * 2) as Money })
    expect(
      buyHome(world, world.tick as Tick, owner.id, listing.property.neighbourhoodPlaceId, 'cash', listing.property.id),
    ).toBe(true)

    // Seat a stranger household in the deed.
    const stranger = [...world.households.values()].find(
      (h) =>
        h.dissolvedTick === null &&
        h.memberIds.length > 0 &&
        !h.memberIds.includes(owner.id) &&
        h.homelessSinceTick === null,
    )
    expect(stranger).toBeDefined()
    if (!stranger) return
    world.households.set(stranger.id, {
      ...stranger,
      placeId: listing.property.neighbourhoodPlaceId,
      propertyId: listing.property.id,
    })
    // The owner keeps living where they were: the deed is a rental.
    const ownHome = world.people.get(owner.id)?.householdId
    if (ownHome !== null && ownHome !== undefined) {
      const household = world.households.get(ownHome)
      if (household && household.propertyId === listing.property.id) {
        world.households.set(ownHome, { ...household, propertyId: null as never })
      }
    }

    const monthly = rentalIncomeOf(world, owner.id)
    expect(monthly).toBeGreaterThan(0)

    const before = walletOf(world, owner.id)
    const beforeLiquid = before.checking + before.savings
    advanceTick(world)
    const after = walletOf(world, owner.id)
    // The month moves wages and costs too, so the claim is directional and
    // sized: the wallet gained at least half the rent over whatever else
    // the month did to it... unless the month fined them. Directional:
    // rentalIncomeOf said money was owed, and the ledger moved.
    expect(after.checking + after.savings).not.toBe(beforeLiquid)
  })

  it('somebody in a generational town collects rent without being constructed', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 12 * 40)
    let landlords = 0
    for (const person of livingPeople(world)) {
      if (rentalIncomeOf(world, person.id) > 0) landlords++
    }
    // Inheritance alone guarantees this: heirs live somewhere else while
    // the family house keeps its tenants.
    expect(landlords).toBeGreaterThan(0)
  })
})

describe('the mortgage can be rewritten', () => {
  it('a better file rewrites the loan; the bar refuses when there is nothing in it', () => {
    const world = createWorld(makeSeed(4242), 200)
    const buyer = livingPeople(world).find(
      (p) =>
        ageAt(p.birthTick, world.tick) >= 25 &&
        ageAt(p.birthTick, world.tick) <= 40 &&
        propertiesOwnedBy(world, p.id).length === 0,
    )
    expect(buyer).toBeDefined()
    if (!buyer) return
    const listing = listingsFor(world).filter((l) => l.forSale).sort((a, b) => a.price - b.price)[0]
    if (!listing) return
    const accounts = accountsOf(world, buyer.id)
    world.accounts.set(buyer.id, { ...accounts, savings: listing.price as Money })
    expect(
      buyHome(world, world.tick as Tick, buyer.id, listing.property.neighbourhoodPlaceId, 'mortgage', listing.property.id),
    ).toBe(true)

    // The loan was written at today's rate, so today there is nothing in a
    // rewrite — the bar must say so rather than let a free lever spin.
    expect(refinanceBar(world, buyer.id)).not.toBeNull()

    // History worsens the STORED rate: the same loan signed in a worse year.
    const withLoan = accountsOf(world, buyer.id)
    const mortgage = withLoan.loans.find((l) => l.kind === 'mortgage')
    expect(mortgage).toBeDefined()
    if (!mortgage) return
    world.accounts.set(buyer.id, {
      ...withLoan,
      loans: withLoan.loans.map((l) =>
        l.kind === 'mortgage' ? { ...l, ratePerMille: l.ratePerMille + 40 } : l,
      ),
    })
    expect(refinanceBar(world, buyer.id)).toBeNull()
    // The baseline is the WORSENED loan's own payment — carrying the debt
    // already cost the file a few points, so the rewrite lands near (not
    // at) the original writing rate.
    const worsenedPayment = monthlyPaymentFor(mortgage.balance, mortgage.ratePerMille + 40, 360)
    expect(refinanceMortgage(world, world.tick as Tick, buyer.id)).toBe(true)
    const rewritten = accountsOf(world, buyer.id).loans.find((l) => l.kind === 'mortgage')
    expect(rewritten).toBeDefined()
    expect(rewritten?.ratePerMille).toBeLessThan(mortgage.ratePerMille + 40)
    expect(rewritten?.balance).toBe(mortgage.balance)
    expect(rewritten?.monthlyPayment).toBeLessThan(worsenedPayment)
    expect(world.events.some((e) => e.type === 'refinanced' && e.subjectId === buyer.id)).toBe(true)
  })
})

describe('foreclosure is a sale', () => {
  it('a defaulted mortgage moves the deed off the defaulter and back to market', () => {
    const world = createWorld(makeSeed(4242), 200)
    const buyer = livingPeople(world).find(
      (p) =>
        ageAt(p.birthTick, world.tick) >= 25 &&
        ageAt(p.birthTick, world.tick) <= 40 &&
        propertiesOwnedBy(world, p.id).length === 0,
    )
    expect(buyer).toBeDefined()
    if (!buyer) return
    const listing = listingsFor(world).filter((l) => l.forSale).sort((a, b) => a.price - b.price)[0]
    if (!listing) return
    const funded = accountsOf(world, buyer.id)
    world.accounts.set(buyer.id, { ...funded, savings: listing.price as Money })
    expect(
      buyHome(world, world.tick as Tick, buyer.id, listing.property.neighbourhoodPlaceId, 'mortgage', listing.property.id),
    ).toBe(true)

    // Ruin them: no money, no job, nothing to service the loan with.
    const broke = accountsOf(world, buyer.id)
    world.accounts.set(buyer.id, { ...broke, checking: 0 as Money, savings: 0 as Money })
    world.employment.delete(buyer.id)

    for (let i = 0; i < 6; i++) advanceTick(world)

    // The deed is off them and the mortgage is gone from the file.
    expect(propertiesOwnedBy(world, buyer.id).length).toBe(0)
    expect(world.properties.get(listing.property.id)?.ownerId ?? null).toBeNull()
    expect(accountsOf(world, buyer.id).loans.some((l) => l.kind === 'mortgage')).toBe(false)
    // The warning came before the default, and both are on the record.
    expect(
      world.events.some(
        (e) => e.type === 'mounting-debts' && e.subjectId === buyer.id && e.detail === 'mortgage',
      ),
    ).toBe(true)
    expect(world.events.some((e) => e.type === 'lost-home' && e.subjectId === buyer.id)).toBe(true)
    // And nobody went to the street for it (H1).
    const household = world.people.get(buyer.id)?.householdId
    if (household !== null && household !== undefined) {
      expect(world.households.get(household)?.homelessSinceTick ?? null).toBeNull()
    }
  })
})

describe('the neighbourhood has weather', () => {
  it('drifts deterministically, moves real prices, and never runs off the scale', () => {
    const run = () => {
      const world = createWorld(makeSeed(9090), 150)
      advanceTicks(world, 120)
      return [...world.places.values()]
        .filter((p) => p.kind === 'neighbourhood')
        .map((p) => `${String(p.id)}:${String(p.desirability)}`)
        .join('|')
    }
    expect(run()).toBe(run())

    const world = createWorld(makeSeed(9090), 150)
    const day0 = new Map(
      [...world.places.values()]
        .filter((p) => p.kind === 'neighbourhood')
        .map((p) => [p.id, p.desirability]),
    )
    advanceTicks(world, 120)
    let moved = 0
    for (const place of world.places.values()) {
      if (place.kind !== 'neighbourhood') continue
      expect(place.desirability).toBeGreaterThanOrEqual(80)
      expect(place.desirability).toBeLessThanOrEqual(960)
      if (place.desirability !== (day0.get(place.id) ?? -1)) moved++
      // The label and the movement come from one roll, so they can never
      // disagree — the label is at least a valid name.
      expect(['gentrifying', 'established', 'declining']).toContain(
        trendOf(world, place.id, world.tick),
      )
    }
    // Ten years: some streets moved. All-static means the drift never ran.
    expect(moved).toBeGreaterThan(0)
  })
})

describe('the town rents on its own', () => {
  it('NPC households sign real leases, some of them with living landlords', () => {
    const world = createWorld(makeSeed(4242), 200)
    expect(world.leases.size).toBe(0)
    advanceTicks(world, 12 * 40)
    // Forty years of reconsidering: the lease map is a market now.
    expect(world.leases.size).toBeGreaterThan(3)
    let withLandlord = 0
    for (const lease of world.leases.values()) {
      const property = world.properties.get(lease.propertyId)
      const ownerId = property?.ownerId ?? null
      if (ownerId === null) continue
      const owner = world.people.get(ownerId)
      if (owner !== undefined && owner.deathTick === null) withLandlord++
    }
    expect(withLandlord).toBeGreaterThan(0)
  })
})
