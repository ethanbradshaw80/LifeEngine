/**
 * W2 — the American Heartland preset.
 *
 * Half of this file tests that the preset WORKS. The other half tests that
 * it obeys the rulings in docs/WORLD_MODES_PLAN.md, because those are the
 * ones nobody notices breaking: a fictional town is only fictional until
 * someone adds a real one to the list, and "foreign nations stay fictional"
 * is a promise that has to be enforced rather than remembered.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { formatYear } from '../src/clock.js'
import { CLASSIC_SPEC, PRESETS, branchSpecFor, specById } from '../src/worldspec.js'
import { HEARTLAND_COUNTY, HEARTLAND_SPEC, HEARTLAND_STATE } from '../src/heartland.js'
import { homeland } from '../src/geopolitics.js'
import { livingPeople } from '../src/systems.js'

describe('the preset is a world that runs', () => {
  it('is registered, resolvable, and distinct from Classic', () => {
    expect(PRESETS.map((p) => p.id)).toContain('american-heartland')
    expect(specById('american-heartland')).toBe(HEARTLAND_SPEC)
    expect(HEARTLAND_SPEC.id).not.toBe(CLASSIC_SPEC.id)
  })

  it('lives a century — births, work, marriages, service, death', () => {
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 1200)

    expect(livingPeople(world).length).toBeGreaterThan(50)
    for (const type of ['born', 'died', 'hired', 'married', 'enlisted'] as const) {
      expect(world.events.some((e) => e.type === type), `no ${type} in a century`).toBe(true)
    }
    // And it is Ashcroft, not Haverlock.
    expect(world.town.name).toBe('Ashcroft')
    expect(homeland(world)?.name).toBe('the United States')
  })

  it('starts in its own year and dates itself from there', () => {
    const world = createWorld(makeSeed(4242), 40, HEARTLAND_SPEC)
    expect(formatYear(world, world.tick)).toBe(String(HEARTLAND_SPEC.startYear))
  })

  it('serves in the real branches, on the same ladders', () => {
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 900)
    const records = [...world.service.values()]
    expect(records.length).toBeGreaterThan(0)

    const names = new Set(HEARTLAND_SPEC.branches.map((b) => b.name))
    expect(names).toContain('the United States Army')
    for (const record of records) {
      const branch = branchSpecFor(world, record.branch)
      expect(names.has(branch.name), `${branch.name} is not one of this preset's`).toBe(true)
      expect(branch.ranks.length).toBeGreaterThan(0)
      // The structure is Classic's, because it was always the real one.
      const classic = CLASSIC_SPEC.branches.find((b) => b.id === record.branch)
      expect(branch.ranks).toEqual(classic?.ranks)
    }
  })
})

describe('the rulings, enforced rather than remembered', () => {
  it('names no real town, street or business', () => {
    // The ruling: a real small town implies real residents, and a real
    // business implies real employees — and this world bankrupts, injures
    // and convicts the people in it. The county and state ARE real, and
    // are the only real places here.
    const g = HEARTLAND_SPEC.gazetteer
    expect(HEARTLAND_STATE).toBe('Indiana')
    expect(HEARTLAND_COUNTY).toBe('Vermillion County')
    expect(g.townName).toBe('Ashcroft')

    // Nothing in the town is named for the county or the state, which is
    // the shape a real-place slip would take.
    const invented = [...g.neighbourhoods, ...g.workplaces, ...g.civic, g.townName]
    for (const name of invented) {
      expect(name.includes(HEARTLAND_STATE), `${name} borrows the state's name`).toBe(false)
    }
    // The school and the county courthouse may carry the county's name —
    // civic institutions are named for their county in life.
    expect(g.schoolName).toContain('Vermillion County')
  })

  it('keeps every foreign nation fictional, exactly as Classic does', () => {
    // The line that does not move in any preset: a generated war against a
    // real country writes fabricated history onto permanent records, and
    // makes real casualties a mechanic (R-14).
    expect(HEARTLAND_SPEC.foreignNations).toEqual(CLASSIC_SPEC.foreignNations)

    const world = createWorld(makeSeed(12345), 60, HEARTLAND_SPEC)
    const foreign = [...world.nations.values()].filter((n) => !n.isHomeland).map((n) => n.name)
    const fictional = new Set(CLASSIC_SPEC.foreignNations)
    for (const name of foreign) {
      expect(fictional.has(name), `${name} is not one of the invented nations`).toBe(true)
    }
    // Exactly one homeland, and it is the real one.
    const homelands = [...world.nations.values()].filter((n) => n.isHomeland)
    expect(homelands.length).toBe(1)
    expect(homelands[0]?.name).toBe('the United States')
  })

  it('keeps every named unit and decoration fictional', () => {
    // Real units carry real casualty history and living members.
    expect(HEARTLAND_SPEC.units).toEqual(CLASSIC_SPEC.units)
    expect(HEARTLAND_SPEC.schools).toEqual(CLASSIC_SPEC.schools)
    for (const unit of HEARTLAND_SPEC.units) {
      expect(['the Pathfinder Battalion', 'Task Unit Ember']).toContain(unit.name)
    }
  })

  it('names the branches and nothing else about them', () => {
    // Nominative use of a service's name is one thing; insignia, emblems
    // and seals are licensed and this project ships none. The spec has
    // nowhere to put artwork, and this test is here so it stays that way.
    for (const branch of HEARTLAND_SPEC.branches) {
      expect(Object.keys(branch).sort()).toEqual(
        ['competitiveFrom', 'grades', 'id', 'juniorTigMonths', 'name', 'ranks'].sort(),
      )
    }
  })

  it('leaves Classic completely alone', () => {
    // A second preset must not touch the first. Classic's own test asserts
    // its golden hash; this asserts the CONTENT it is built from.
    expect(CLASSIC_SPEC.gazetteer.townName).toBe('Haverlock')
    expect(CLASSIC_SPEC.homelandName).toBe('the Republic')
    expect(CLASSIC_SPEC.branches.map((b) => b.name)).toEqual([
      'the Land Forces',
      'the Naval Service',
      'the Air Guard',
    ])
    expect(CLASSIC_SPEC.startYear).toBe(1970)
  })

  it('is frozen like every shipped preset', () => {
    // DETERMINISM.md §8: a shipped preset's content is frozen and
    // additive-only, and rank ladders are append-only because records hold
    // INDEXES into them.
    expect(Object.isFrozen(HEARTLAND_SPEC)).toBe(true)
    expect(Object.isFrozen(HEARTLAND_SPEC.branches)).toBe(true)
    for (const branch of HEARTLAND_SPEC.branches) {
      expect(Object.isFrozen(branch.ranks)).toBe(true)
      expect(Object.isFrozen(branch.grades)).toBe(true)
    }
  })
})
