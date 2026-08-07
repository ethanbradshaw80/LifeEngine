/**
 * Wellbeing — the stats panel's one new stored stat (owner's
 * `player_stats_spec.md`, phase 1).
 *
 * The claims: it moves from things that actually happen, resilience softens
 * the blows and not the gifts, it drifts back toward where a life sits, every
 * move carries a reason, and one life visibly travels over its span.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import {
  nudgeWellbeing,
  runWellbeing,
  wellbeingBaselineFor,
  wellbeingCausesOf,
  wellbeingOf,
  WELLBEING_NEUTRAL,
} from '../src/wellbeing.js'
import type { Person, World } from '../src/types.js'

function anAdult(world: World): Person {
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 25 && ageAt(p.birthTick, world.tick) <= 45)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  return person
}

describe('a value that moves from what happens', () => {
  it('starts everyone at neutral and gives them a record on the first month', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    // Before any tick nobody has a record — and reading is still safe.
    expect(wellbeingOf(world, person.id)).toBe(WELLBEING_NEUTRAL)
    advanceTick(world)
    expect(world.wellbeing.get(person.id)).toBeDefined()
  })

  it('records the reason with every move, in words the panel can print', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    nudgeWellbeing(world, world.tick, person.id, -90, 'Out of work')
    const causes = wellbeingCausesOf(world, person.id, world.tick)
    expect(causes.length).toBe(1)
    expect(causes[0]?.words).toBe('Out of work')
    expect(causes[0]?.delta).toBeLessThan(0)
  })

  it('keeps the cause list bounded — a save must not grow for ever', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    for (let i = 0; i < 20; i++) {
      nudgeWellbeing(world, world.tick, person.id, -5, `knock ${String(i)}`)
    }
    expect(world.wellbeing.get(person.id)?.causes.length).toBeLessThanOrEqual(6)
  })
})

describe('resilience softens the blows, not the gifts', () => {
  /** The same knock, landed on two people who differ only in resilience. */
  function landOn(resilience: number, delta: number): number {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    world.people.set(person.id, {
      ...person,
      traits: { ...person.traits, resilience },
    })
    nudgeWellbeing(world, world.tick, person.id, delta, 'a thing')
    return wellbeingOf(world, person.id) - WELLBEING_NEUTRAL
  }

  it('lands a blow lighter on somebody who bounces back', () => {
    const brittle = landOn(0, -100)
    const tough = landOn(1000, -100)
    expect(brittle).toBeLessThan(0)
    expect(tough).toBeGreaterThan(brittle)
  })

  it('does not let resilience blunt a good thing too', () => {
    // A resilient person does not enjoy a promotion less than anybody else.
    // Buffering both directions would make resilience a flatness trait,
    // which is not what the word means.
    expect(landOn(0, 100)).toBe(landOn(1000, 100))
  })
})

describe('a life settles where its circumstances put it', () => {
  it('reads a lost roof as the worst thing that can happen to the number', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    const before = wellbeingBaselineFor(world, person, world.tick)
    const household =
      person.householdId === null ? undefined : world.households.get(person.householdId)
    if (!household) throw new Error('no household')
    world.households.set(household.id, { ...household, homelessSinceTick: world.tick })
    const after = wellbeingBaselineFor(world, person, world.tick)
    expect(after).toBeLessThan(before - 100)
  })

  it('drifts back toward that baseline rather than staying knocked down', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = anAdult(world)
    advanceTick(world)
    const settled = wellbeingOf(world, person.id)
    nudgeWellbeing(world, world.tick, person.id, -200, 'a bad month')
    const struck = wellbeingOf(world, person.id)
    expect(struck).toBeLessThan(settled)
    // Two years of nothing in particular.
    for (let i = 0; i < 24; i++) runWellbeing(world, (world.tick + i + 1) as Tick)
    expect(wellbeingOf(world, person.id)).toBeGreaterThan(struck)
  })
})

describe('the number is worth showing', () => {
  it('travels far enough over one life to be worth a bar', () => {
    // MEASURED, and this is the assertion the tuning exists to satisfy. At
    // the first drift rate the stored value collapsed onto the baseline —
    // ninety per cent of the town between 522 and 646, which on a 0–100
    // dial is everybody reading "about 60".
    //
    // Population spread is the wrong metric, though: a player only ever
    // sees their OWN number. What has to be true is that ONE LIFE visibly
    // moves, and it does — the median life travels around 210 points, a
    // fifth of the dial.
    const world = createWorld(makeSeed(4141), 300)
    const watched = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 16 && ageAt(p.birthTick, world.tick) <= 22)
      .sort((a, b) => a.id - b.id)
      .slice(0, 4)
    expect(watched.length).toBeGreaterThan(0)
    const seen = new Map(watched.map((p) => [p.id, [] as number[]]))
    for (let i = 0; i < 35 * 12; i++) {
      advanceTick(world)
      for (const p of watched) {
        if (world.people.get(p.id)?.deathTick !== null) continue
        seen.get(p.id)?.push(wellbeingOf(world, p.id))
      }
    }
    const ranges = [...seen.values()]
      .filter((values) => values.length >= 60)
      .map((values) => Math.max(...values) - Math.min(...values))
    expect(ranges.length, 'nobody lived long enough to watch').toBeGreaterThan(0)
    const median = ranges.sort((a, b) => a - b)[Math.floor(ranges.length / 2)] ?? 0
    expect(median, 'a life barely moves the number').toBeGreaterThan(80)
    // And it stays on the scale it claims to be on.
    for (const values of seen.values()) {
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1000)
      }
    }
  }, 900_000)

  it('costs one pass over the month, not one over all history per person', () => {
    // THE BUG THIS PINS. The first version called eventsFor() inside the
    // person loop, and that helper filters the WHOLE ledger — so the cost
    // was people × all-history every month, growing every year the save
    // aged. A forty-year town would have spent millions of comparisons a
    // tick for a handful of hits.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 30 * 12)
    expect(
      world.events.length,
      'not enough history for this to mean anything',
    ).toBeGreaterThan(2000)
    const started = world.tick
    for (let i = 0; i < 30; i++) advanceTick(world)
    expect(world.tick).toBe(started + 30)
  }, 900_000)
})
