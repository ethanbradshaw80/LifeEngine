/**
 * Real estate — a home is a place you chose, not a street you moved to.
 *
 * From the owner's `real_estate_revamp.md`. His diagnosis of the old model
 * is exact: *"you don't choose a home, you choose a street, and value/rent
 * are just a function of that street."* Owning was one field —
 * `accounts.homePlaceId` — pointing at a neighbourhood, and a house was
 * worth whatever the rent formula said that neighbourhood was worth today.
 * There was nothing to shop, compare, outgrow, improve, or sell.
 *
 * THE PROPERTY IS THE OBJECT NOW. A real thing with an address, a size, a
 * condition and a history, sitting inside a neighbourhood so the whole
 * desirability model keeps working underneath it.
 *
 * SINGLE-WRITER. This module owns properties, listings and leases. It never
 * writes cents — `finances.ts` owns cash and mortgages, `credit.ts` owns
 * rates, `tax.ts` owns property tax. Real estate asks; the money systems
 * answer. That boundary is what stops a housing market from quietly
 * becoming a second economy.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { homePriceFor } from './credit.js'
import { hash32 } from './rng.js'
import type { Household, Person,Lease, Property, PropertyType, World } from './types.js'

/**
 * How many homes a town builds, against how many households it has.
 *
 * MEASURED, AND THE FIRST GUESS WAS USELESS. A flat six per neighbourhood
 * gave 48 homes for 224 households — four fifths of the town could not have
 * lived anywhere. The comment justifying it cited "sixty homes against
 * roughly a hundred and twenty households", and BOTH numbers were invented.
 *
 * So the stock is sized to the town instead of guessed: a third more homes
 * than households. Enough slack that there is always something on the
 * market and the good streets can fill up, not so much that a house is
 * worthless for want of anyone to want it.
 */
const HOMES_PER_HOUSEHOLD_PER_MILLE = 1_300
/** Even an empty hamlet has a few. */
const MIN_HOMES_PER_NEIGHBOURHOOD = 4

/** What each type does to size and price, before the neighbourhood speaks. */
const TYPE_SHAPE: Readonly<
  Record<PropertyType, { readonly beds: readonly number[]; readonly sqft: number; readonly factor: number }>
> = {
  apartment: { beds: [1, 1, 2], sqft: 700, factor: 62 },
  condo: { beds: [1, 2, 2], sqft: 950, factor: 78 },
  townhouse: { beds: [2, 3, 3], sqft: 1_350, factor: 96 },
  house: { beds: [3, 3, 4], sqft: 1_700, factor: 118 },
  estate: { beds: [4, 5, 6], sqft: 3_200, factor: 205 },
}

/** Street names, so an address reads like an address. */
const STREETS = [
  'Maple Court', 'Canal Street', 'Orchard Lane', 'Bellweather Road', 'Hollis Avenue',
  'Kestrel Way', 'Quarry Hill', 'Fenwick Street', 'Alder Close', 'Marchmont Row',
  'Sycamore Drive', 'Pilgrim Lane', 'Draycott Street', 'Fairhaven Road', 'Linnet Walk',
] as const

/** Which types a neighbourhood of this desirability actually holds. */
function typesFor(desirability: number): readonly PropertyType[] {
  if (desirability >= 780) return ['house', 'house', 'estate', 'townhouse', 'condo', 'house']
  if (desirability >= 560) return ['house', 'townhouse', 'house', 'condo', 'townhouse', 'house']
  if (desirability >= 340) return ['townhouse', 'condo', 'house', 'apartment', 'condo', 'townhouse']
  return ['apartment', 'condo', 'apartment', 'townhouse', 'apartment', 'condo']
}

/**
 * WHAT A HOME IS WORTH.
 *
 * The neighbourhood sets the floor — the existing desirability-to-rent-to-
 * price chain, untouched, so nothing about the old model is thrown away.
 * The property then modifies it: a five-bedroom on a good street is not the
 * same asset as a one-bed flat on the same street, which is the whole point
 * of having properties at all.
 *
 * Condition is a real multiplier and not a rounding error: a wreck is worth
 * meaningfully less than the same house kept well, which is what makes
 * repairs and renovations worth paying for.
 */
export function valueOf(world: World, property: Property): Money {
  const place = world.places.get(property.neighbourhoodPlaceId)
  if (!place) return 0 as Money
  // The neighbourhood's own number, at today's prices.
  const base = homePriceFor(rentBaseFor(world, place.desirability))
  const shaped = Math.floor((base * TYPE_SHAPE[property.type].factor) / 100)
  const sized = Math.floor((shaped * (700 + property.sqft)) / 2_400)
  // 0-1000 condition maps to a 0.72x - 1.12x band. A ruin is not worthless
  // — the land is still there — and a perfect house is not worth double.
  const conditioned = Math.floor((sized * (720 + Math.floor((property.condition * 400) / 1000))) / 1000)
  return Math.max(1, conditioned) as Money
}

/**
 * The neighbourhood's monthly rent, read through the finance system's own
 * curve. Kept as a thin indirection so this module never reimplements the
 * price level — `finances.ts` owns what a dollar is worth this year.
 */
let rentBaseFor: (world: World, desirability: number) => Money = () => 0 as Money

/**
 * Wire the rent curve in at startup.
 *
 * WHY THE INDIRECTION: `finances.ts` already imports half the world, and
 * having real estate import it directly closed a cycle the import ratchet
 * refused — the same seam the wellbeing module needed. The finance module
 * hands its curve over instead, so the dependency points one way.
 */
export function useRentCurve(fn: (world: World, desirability: number) => Money): void {
  rentBaseFor = fn
}

/** What this property rents for a month, if it is rented rather than owned. */
export function rentOf(world: World, property: Property): Money {
  // A rent is roughly a two-hundredth of the value — the same relationship
  // `homePriceFor` already encodes, read backwards so a bigger, better-kept
  // home costs more to rent as well as to buy.
  return Math.max(1, Math.floor(valueOf(world, property) / 220)) as Money
}

/**
 * Build a town's housing stock, deterministically.
 *
 * Every property is derived from the neighbourhood id and its index, so the
 * same seed lays out the same streets in the same order for ever. No RNG
 * stream is consumed: this is worldgen shape, not a draw, and burning
 * numbers here would shift every later roll in the world.
 */
export function generateProperties(world: World, neighbourhoodIds: readonly EntityId[]): void {
  const ids = [...neighbourhoodIds].sort((a, b) => a - b)
  if (ids.length === 0) return
  const households = [...world.households.values()].filter((h) => h.dissolvedTick === null).length
  const wanted = Math.ceil((households * HOMES_PER_HOUSEHOLD_PER_MILLE) / 1_000 / ids.length)
  const perNeighbourhood = Math.max(MIN_HOMES_PER_NEIGHBOURHOOD, wanted)
  for (const placeId of ids) {
    const place = world.places.get(placeId)
    if (!place) continue
    const types = typesFor(place.desirability)
    for (let i = 0; i < perNeighbourhood; i++) {
      // UNSIGNED SHIFTS, ALWAYS. `hash32` returns a full 32-bit value, and
      // `>>` is signed — anything above 2^31 came back negative, which is
      // how a house ended up with a condition of MINUS eighty-nine.
      const salt = hash32(placeId * 1_000 + i) >>> 0
      const type = types[i % types.length] ?? 'house'
      const shape = TYPE_SHAPE[type]
      const beds = shape.beds[salt % shape.beds.length] ?? 3
      const property: Property = {
        id: `${String(placeId)}-${String(i)}`,
        neighbourhoodPlaceId: placeId,
        address: `${String((salt % 180) + 1)} ${STREETS[(salt >>> 8) % STREETS.length] ?? 'Maple Court'}`,
        type,
        beds,
        baths: Math.max(1, Math.floor(beds / 2) + ((salt >>> 4) % 2)),
        // Size follows the bedrooms rather than being rolled independently,
        // because a two-bed that is bigger than a five-bed reads as a bug.
        sqft: shape.sqft + beds * 110 + ((salt >>> 12) % 6) * 60,
        lotSqft: type === 'apartment' || type === 'condo' ? 0 : shape.sqft * 2 + ((salt >>> 16) % 5) * 800,
        yearBuilt: 1950 + ((salt >>> 20) % 70),
        // Most homes are ordinary. A few are wrecks and a few are perfect,
        // and those are the interesting ones to shop for.
        condition: 380 + ((salt >>> 5) % 520),
      }
      world.properties.set(property.id, property)
    }
  }
}

/** Everything this person holds the deed to, dearest first. */
export function propertiesOwnedBy(world: World, personId: EntityId): readonly Property[] {
  return [...world.properties.values()]
    .filter((p) => p.ownerId === personId)
    .sort((a, b) => valueOf(world, b) - valueOf(world, a) || (a.id < b.id ? -1 : 1))
}

/** What the whole portfolio is worth. */
export function portfolioValueOf(world: World, personId: EntityId): Money {
  let total = 0
  for (const property of propertiesOwnedBy(world, personId)) total += valueOf(world, property)
  return total as Money
}

/** Set or clear a deed. The single writer for who owns what. */
export function setOwner(world: World, propertyId: string, ownerId: EntityId | null): void {
  const property = world.properties.get(propertyId)
  if (!property) return
  world.properties.set(propertyId, { ...property, ownerId })
}

/** Everything in a neighbourhood, oldest id first — a stable order. */
export function propertiesIn(world: World, placeId: EntityId): readonly Property[] {
  return [...world.properties.values()]
    .filter((p) => p.neighbourhoodPlaceId === placeId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Who lives there, or nobody. Read off the households rather than stored. */
export function occupantOf(world: World, propertyId: string): EntityId | null {
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null) continue
    if (household.propertyId === propertyId) return household.id
  }
  return null
}

/** Free to take — nobody is living in it. */
export function isVacant(world: World, propertyId: string): boolean {
  return occupantOf(world, propertyId) === null
}

// ---------------------------------------------------------------------------
// The marketplace (phase 2).
// ---------------------------------------------------------------------------

/**
 * What the market is showing, and on what terms.
 *
 * A listing is DERIVED, not stored. A property is on the market when it is
 * empty, and empty is a fact about the households — so there is nothing to
 * keep in sync and nothing that can drift out of it. The alternative, a
 * stored listing table, would need reconciling against occupancy every
 * month for ever, and the first month it disagreed would put a family's
 * home up for sale underneath them.
 */
export interface Listing {
  readonly property: Property
  readonly price: Money
  readonly monthlyRent: Money
  /** True where the seller would rather rent it out than sell. */
  readonly forRent: boolean
  readonly forSale: boolean
}

/**
 * Everything for sale or rent right now, dearest first.
 *
 * WHY THE WHOLE STOCK RATHER THAN A ROTATION: the spec asks for "a rotating
 * set of listings... refreshed over time so the market feels alive". A
 * rotation is what you build when the stock is enormous and the screen is
 * small. Here the stock IS the market — a few hundred homes, most of them
 * lived in — and the rotation happens on its own as people move, die and
 * inherit. Inventing a second layer of churn on top would be simulating
 * an estate agent's website rather than a town.
 */
export function listingsFor(world: World, options?: {
  readonly maxPrice?: Money
  readonly minBeds?: number
  readonly type?: PropertyType
  readonly neighbourhoodPlaceId?: EntityId
}): readonly Listing[] {
  const out: Listing[] = []
  for (const property of world.properties.values()) {
    if (!isVacant(world, property.id)) continue
    // AND NOT SOMEBODY ELSE'S EMPTY SECOND HOME. An owner's vacant property
    // is theirs to let or sell, not stock for the next buyer to take out
    // from under them — which is what an occupancy-only test would have done
    // the moment anybody owned two.
    if (property.ownerId !== undefined && property.ownerId !== null) continue
    if (options?.minBeds !== undefined && property.beds < options.minBeds) continue
    if (options?.type !== undefined && property.type !== options.type) continue
    if (
      options?.neighbourhoodPlaceId !== undefined &&
      property.neighbourhoodPlaceId !== options.neighbourhoodPlaceId
    ) {
      continue
    }
    const price = valueOf(world, property)
    if (options?.maxPrice !== undefined && price > options.maxPrice) continue
    out.push({
      property,
      price,
      monthlyRent: rentOf(world, property),
      // THE CHEAP END OF THE STOCK IS THE RENTAL MARKET. Somebody owns the
      // flats and lets them; the big houses on the good streets are sold.
      // A single rule rather than a stored flag, so it cannot disagree with
      // itself.
      forRent: property.type === 'apartment' || property.type === 'condo',
      forSale: property.type !== 'apartment',
    })
  }
  return out.sort((a, b) => b.price - a.price || (a.property.id < b.property.id ? -1 : 1))
}

/** One listing, or nothing if it is lived in. */
export function listingOf(world: World, propertyId: string): Listing | null {
  const property = world.properties.get(propertyId)
  if (!property || !isVacant(world, propertyId)) return null
  return listingsFor(world).find((l) => l.property.id === propertyId) ?? null
}

/**
 * THE TRUE MONTHLY COST of owning, broken out (spec §3).
 *
 * "Show the breakdown so the real cost is honest, not just P&I." A player
 * who budgets for the mortgage and is then surprised by tax and upkeep has
 * been misled by the interface, not by the market.
 *
 * Pure arithmetic over numbers the caller supplies — this module does not
 * reach into the tax or credit systems, it reports what they would charge.
 */
export interface OwnershipCost {
  readonly mortgage: Money
  readonly propertyTax: Money
  readonly insurance: Money
  readonly hoa: Money
  readonly maintenance: Money
  readonly total: Money
}

/**
 * A year's property tax, as a share of value.
 *
 * THE GOVERNMENT SETS THIS NOW (government plan §4, phase 2's first
 * lever). It was a constant; it is whatever the town has voted for, and
 * `freshPolicy` starts it at the 11 this constant used to be so that
 * wiring it changed nobody's bill on the day it landed.
 *
 * Read straight off `world.policy` rather than through government.ts:
 * the value is state, the module that owns it is a writer, and importing
 * it here would close a cycle for a number this can simply look at.
 */
function propertyTaxPerMille(world: World): number {
  return Math.max(0, world.policy.propertyTaxPerMille)}
/** Insurance, likewise — a small yearly share of what it would cost to rebuild. */
const INSURANCE_PER_MILLE_YEARLY = 4
/** What a managed building charges, per month, for the common parts. */
const HOA_PER_MILLE_MONTHLY = 1
/** What a house quietly costs to keep standing, per month. */
const MAINTENANCE_PER_MILLE_MONTHLY = 1

export function ownershipCostOf(
  world: World,
  property: Property,
  monthlyMortgage: Money,
): OwnershipCost {
  const value = valueOf(world, property)
  const propertyTax = Math.floor((value * propertyTaxPerMille(world)) / 1_000 / 12) as Money
  const insurance = Math.floor((value * INSURANCE_PER_MILLE_YEARLY) / 1_000 / 12) as Money
  // Only a managed building has a service charge; a house on its own lot
  // does not, and pretending otherwise would be charging for nothing.
  const hoa = (property.type === 'condo' || property.type === 'apartment'
    ? Math.floor((value * HOA_PER_MILLE_MONTHLY) / 1_000)
    : 0) as Money
  const maintenance = Math.floor((value * MAINTENANCE_PER_MILLE_MONTHLY) / 1_000) as Money
  return {
    mortgage: monthlyMortgage,
    propertyTax,
    insurance,
    hoa,
    maintenance,
    total: (monthlyMortgage + propertyTax + insurance + hoa + maintenance) as Money,
  }
}

/**
 * Put every household through a door.
 *
 * WITHOUT THIS THERE IS NO MARKET. Occupancy is read off the households, so
 * a town whose families have a street but no ADDRESS reads as two hundred
 * and ninety-six empty houses — the entire stock for sale, no scarcity, and
 * a player able to buy the home a family is sitting in. Measured exactly
 * that way before this existed.
 *
 * Deterministic and order-independent: households in id order take
 * properties in id order within their own neighbourhood. A household whose
 * street has run out of homes keeps its street and stays doorless rather
 * than being moved somewhere it never chose — `placeId` remains the
 * authority and this only ever narrows it.
 */
export function seatHouseholds(world: World): void {
  const taken = new Set<string>()
  for (const household of world.households.values()) {
    if (household.dissolvedTick === null && typeof household.propertyId === 'string') {
      taken.add(household.propertyId)
    }
  }
  const households = [...world.households.values()]
    .filter((h) => h.dissolvedTick === null && (h.propertyId === undefined || h.propertyId === null))
    .sort((a, b) => a.id - b.id)

  for (const household of households) {
    const free = propertiesIn(world, household.placeId).find((p) => !taken.has(p.id))
    if (free === undefined) continue
    taken.add(free.id)
    world.households.set(household.id, { ...household, propertyId: free.id })
  }
}

// ---------------------------------------------------------------------------
// Leases (phase 4) and the down payment (phase 3).
// ---------------------------------------------------------------------------

/** A tenancy runs a year and then comes up for renewal. */
export const LEASE_MONTHS = 12
/** The deposit, as months of rent. Returned if the place is left sound. */
export const DEPOSIT_MONTHS = 1

/**
 * THE FOUNDING TENURE (H2, owner: "have a house if their parents own, some
 * people just rent"). Roughly 62 percent of founding households own the
 * home they were seated in — the real 1970 US owner-occupancy figure, so
 * realism and the players' ask agree for once — assigned by MEANS, not by
 * lot: the town's better-off own first (Law 10: unequal, but caused).
 * Founding owners own outright; 1970 tenures were long and the mortgage
 * era of this town starts with the lives the player watches, not before.
 *
 * No draws. Ranking by seeded founding savings keeps the whole pass
 * deterministic without consuming a single stream value.
 */
export function foundOwnership(world: World): void {
  const ranked: { household: Household; head: Person; means: number }[] = []
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null || household.propertyId === undefined || household.propertyId === null) continue
    const head = [...household.memberIds]
      .map((id) => world.people.get(id))
      .filter((p): p is Person => p !== undefined && p.deathTick === null)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (head === undefined) continue
    const wallet = world.accounts.get(head.id) ?? world.accounts.get(Math.min(...household.memberIds) as EntityId)
    const means = (wallet?.checking ?? 0) + (wallet?.savings ?? 0)
    ranked.push({ household, head, means })
  }
  ranked.sort((a, b) => b.means - a.means || a.household.id - b.household.id)
  const owners = Math.floor((ranked.length * 62) / 100)
  for (let i = 0; i < owners; i += 1) {
    const entry = ranked[i]
    if (entry === undefined || entry.household.propertyId === undefined || entry.household.propertyId === null) continue
    const property = world.properties.get(entry.household.propertyId)
    if (property === undefined) continue
    setOwner(world, property.id, entry.head.id)
    const accounts = world.accounts.get(entry.head.id)
    if (accounts !== undefined) {
      world.accounts.set(entry.head.id, {
        ...accounts,
        homePlaceId: entry.household.placeId,
        homePurchasePrice: valueOf(world, property),
      })
    }
  }
}

export function leaseOf(world: World, householdId: EntityId): Lease | undefined {
  return world.leases.get(householdId)
}

/** What a household actually pays for its roof this month. */
export function housingCostOf(world: World, householdId: EntityId): Money {
  const lease = world.leases.get(householdId)
  if (lease !== undefined) return lease.monthlyRent
  return 0 as Money
}

/**
 * Why this household cannot take this home, or null.
 *
 * The bar pattern: the screen's greyed row and the verb's refusal read one
 * function, so they cannot disagree about who may rent what.
 */
export function leaseBar(
  world: World,
  householdId: EntityId,
  propertyId: string,
  cash: Money,
): string | null {
  const property = world.properties.get(propertyId)
  if (!property) return 'No such address.'
  if (!isVacant(world, propertyId)) return 'Somebody lives there.'
  if (world.leases.has(householdId)) return 'You are already on a lease.'
  const rent = rentOf(world, property)
  const upFront = (rent * (DEPOSIT_MONTHS + 1)) as Money
  if (cash < upFront) {
    return `The first month and the deposit come to ${String(Math.ceil(upFront / 100))} dollars; you have ${String(Math.floor(cash / 100))}.`
  }
  return null
}

/**
 * DOWN PAYMENT (spec §3): the player sets how much they put in.
 *
 * A lender wants a fifth at least — `depositFor` already says so and this
 * does not overrule it. What this adds is the CHOICE above that floor: more
 * down means less borrowed, a smaller payment and less interest over thirty
 * years, at the cost of everything you no longer have in the bank. That
 * trade is the whole reason to show the slider.
 */
export function downPaymentFor(price: Money, sharePerMille: number, floor: Money): Money {
  const wanted = Math.floor((price * Math.max(0, Math.min(1_000, sharePerMille))) / 1_000)
  return Math.max(floor, Math.min(price, wanted)) as Money
}

// ---------------------------------------------------------------------------
// Equity, selling, and the cost of keeping a house standing (phases 5-6).
// ---------------------------------------------------------------------------

/** A realtor's cut of the sale. Tuned, not sourced. */
const REALTOR_PER_MILLE = 55

/**
 * WHAT THE HOUSE IS ACTUALLY WORTH TO YOU — value less what is still owed.
 *
 * This is the number that makes housing wealth rather than shelter, and it
 * is the one that can go NEGATIVE. A downturn or a wrecked condition can
 * leave somebody owing more than the place would fetch, which the spec asks
 * for by name ("underwater") and which the bankruptcy machinery already
 * knows how to be unkind about.
 */
export function equityOf(world: World, propertyId: string, mortgageBalance: Money): number {
  const property = world.properties.get(propertyId)
  if (!property) return 0
  return valueOf(world, property) - mortgageBalance
}

/**
 * What a seller would actually get, after the agent takes their cut.
 *
 * A gross price is not a net one, and a player who sells expecting the
 * headline number and receives five per cent less has been lied to by the
 * screen. The fee comes off here so every caller sees the true figure.
 */
export function saleProceedsOf(world: World, propertyId: string): {
  readonly price: Money
  readonly fee: Money
  readonly net: Money
} {
  const property = world.properties.get(propertyId)
  const price = (property === undefined ? 0 : valueOf(world, property)) as Money
  const fee = Math.floor((price * REALTOR_PER_MILLE) / 1_000) as Money
  return { price, fee, net: (price - fee) as Money }
}

/**
 * A YEAR IN A HOUSE IS A YEAR OF WEAR.
 *
 * Condition falls slowly and for everybody, owner or tenant, because a roof
 * does not know who is under it. This is what gives repairs and renovations
 * something to fix, and what makes the condition term in `valueOf` mean
 * something over a lifetime rather than being a number set at worldgen and
 * never touched again.
 *
 * TUNED: about twelve points a year, so a house left alone for fifty years
 * loses roughly six hundred of its thousand — derelict but not vanished,
 * and recoverable by somebody willing to spend on it.
 */
export function runProperties(world: World, tick: Tick): void {
  // Once a year, not every month: a monthly write over the whole stock is
  // three hundred map writes a tick for a number that moves imperceptibly.
  if (tick % 12 !== 3) return
  for (const property of [...world.properties.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const next = Math.max(0, property.condition - 12)
    if (next === property.condition) continue
    world.properties.set(property.id, { ...property, condition: next })
  }
}

/** What it costs to put a property back into good order. */
export function renovationCostOf(world: World, propertyId: string, targetCondition: number): Money {
  const property = world.properties.get(propertyId)
  if (!property) return 0 as Money
  const gap = Math.max(0, Math.min(1_000, targetCondition) - property.condition)
  if (gap === 0) return 0 as Money
  // Work costs a share of what the finished house is worth — a kitchen in a
  // mansion costs more than a kitchen in a flat, which is true.
  return Math.max(1, Math.floor((valueOf(world, property) * gap) / 4_000)) as Money
}

/** Put work into a home. The money is the caller's to move. */
export function improveProperty(world: World, propertyId: string, targetCondition: number): boolean {
  const property = world.properties.get(propertyId)
  if (!property) return false
  const next = Math.max(property.condition, Math.min(1_000, targetCondition))
  if (next === property.condition) return false
  world.properties.set(propertyId, { ...property, condition: next })
  return true
}
