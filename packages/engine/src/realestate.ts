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

import type { EntityId, Money } from '@life-engine/shared'
import { homePriceFor } from './credit.js'
import { hash32 } from './rng.js'
import type { Property, PropertyType, World } from './types.js'

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
