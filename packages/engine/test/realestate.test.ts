/**
 * Real estate phase 1 — a home is an object, not a street.
 *
 * The owner's diagnosis of the old model: "you don't choose a home, you
 * choose a street, and value/rent are just a function of that street."
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { propertiesIn, rentOf, valueOf } from '../src/realestate.js'
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
