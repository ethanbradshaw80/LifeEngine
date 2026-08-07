/**
 * The body — stats phase 2 (owner's `player_stats_spec.md`, plus his
 * direction that civilians get stats from twelve and that it should all tie
 * together).
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { flagStatus } from '../src/service.js'
import {
  disciplineOf,
  fitnessOf,
  fitnessStandardFor,
  fitnessTargetFor,
  healthStatOf,
  looksOf,
  smartsOf,
  STATS_FROM_AGE,
} from '../src/stats.js'
import { recordEvent } from '../src/records.js'

describe('a body belongs to the person, not the army', () => {
  it('gives civilians one, and gives it to them from twelve', () => {
    // BEFORE THIS, A CIVILIAN HAD NO FITNESS AT ALL — not a low one, none.
    // The number lived on the service record, so the body began at
    // enlistment and a life spent training arrived at the recruiting
    // station in the same shape as a life spent otherwise.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    let civiliansWithBodies = 0
    for (const person of livingPeople(world)) {
      const age = ageAt(person.birthTick, world.tick)
      const fitness = fitnessOf(world, person.id)
      if (age < STATS_FROM_AGE) {
        // A childhood is not a stat with a training plan attached.
        expect(fitness, 'a child was given a fitness score').toBe(0)
        continue
      }
      expect(fitness, 'somebody old enough has no body').toBeGreaterThan(0)
      if (!world.service.has(person.id)) civiliansWithBodies++
    }
    expect(civiliansWithBodies, 'no civilian has a body').toBeGreaterThan(20)
  }, 600_000)

  it('lets the body decline with age, which is the point of having one', () => {
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    expect(fitnessTargetFor(person, 25)).toBeGreaterThan(fitnessTargetFor(person, 60))
    // And a twelve-year-old is not yet an adult athlete.
    expect(fitnessTargetFor(person, 13)).toBeLessThan(fitnessTargetFor(person, 25))
    expect(fitnessTargetFor(person, 8)).toBe(0)
  })
})

describe('the standard ages with the body it measures', () => {
  it('does not flag a forty-year-old for being forty', () => {
    // THE BUG THIS PINS, and it predates the relocation. The
    // fitness-failure flag used ONE number for everybody while the body
    // drags down three points a year past thirty. Measured: nine of
    // thirty-one serving members flagged unfit, EVERY ONE of them
    // thirty-three or older. Flagged means no school, no promotion and no
    // reenlistment — the army was ejecting its own senior ranks for the
    // crime of being in their forties.
    expect(fitnessStandardFor(25)).toBeGreaterThan(fitnessStandardFor(45))
    expect(fitnessStandardFor(45)).toBeGreaterThan(fitnessStandardFor(60))
    // It never falls to nothing, though — a standard is still a standard.
    expect(fitnessStandardFor(80)).toBeGreaterThan(0)
  })

  it('leaves only the genuinely unfit flagged in a grown town', () => {
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    let serving = 0
    let unfit = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      serving++
      if (flagStatus(world, record.personId, world.tick).reasons.includes('fitness-failure')) {
        unfit++
      }
    }
    expect(serving, 'no army to measure').toBeGreaterThan(10)
    // Nine of thirty-one before the standard was age-banded; two after.
    expect(unfit / serving, 'the army is being flagged for its age').toBeLessThan(0.2)
  }, 600_000)
})

/**
 * The derived stats — phase 3. Computed on read, stored nowhere, so nothing
 * about what the world DOES changes: no migration, no version bump, no
 * golden movement.
 */
describe('the stats that are read, not stored', () => {
  it('uses the whole scale rather than a corner of it', () => {
    // THE BUG THIS PINS. Looks was first weighted against the fitness range
    // on paper — 0 to 300 — when a grown world produces about 100 to 207.
    // Combined with health's middling median it capped at 539 of 1000: the
    // best-looking person in town read 54 on the player's dial and the top
    // half of the scale was dead. A stat nobody can score well on is as
    // useless as one everybody scores the same on.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    const adults = livingPeople(world).filter((p) => ageAt(p.birthTick, world.tick) >= 18)
    expect(adults.length, 'nobody to measure').toBeGreaterThan(20)

    for (const [name, read] of [
      ['health', (id: number) => healthStatOf(world, id as never, world.tick)],
      ['looks', (id: number) => looksOf(world, id as never, world.tick)],
      ['smarts', (id: number) => smartsOf(world, id as never)],
      ['discipline', (id: number) => disciplineOf(world, id as never, world.tick)],
    ] as const) {
      const values = adults.map((p) => read(p.id))
      const low = Math.min(...values)
      const high = Math.max(...values)
      // On the 0–1000 scale, every stat must stay in bounds...
      expect(low, `${name} below the scale`).toBeGreaterThanOrEqual(0)
      expect(high, `${name} above the scale`).toBeLessThanOrEqual(1000)
      // ...and must actually reach somewhere worth reaching. A ceiling
      // below 600 means the player can never be good at this.
      expect(high, `${name} tops out at ${String(high)} — the scale is dead above it`).toBeGreaterThan(600)
      // ...and must separate people, or it is telling the player nothing.
      expect(high - low, `${name} barely varies`).toBeGreaterThan(250)
    }
  }, 600_000)

  it('reads a punished soldier as less disciplined than an unpunished one', () => {
    // The spec's own recommendation: a diligence base with a bounded band,
    // "so service can raise it and misconduct can dent it, but a lazy trait
    // still shows".
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 20 && ageAt(p.birthTick, world.tick) <= 40)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')
    const clean = disciplineOf(world, person.id, world.tick)
    recordEvent(world, world.tick, {
      type: 'disciplined',
      subjectId: person.id,
      detail: 'late for duty',
    })
    expect(disciplineOf(world, person.id, world.tick)).toBeLessThan(clean)
  })

  it('reads an ailing body as less healthy, and less handsome with it', () => {
    const world = createWorld(makeSeed(4141), 200)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 20 && ageAt(p.birthTick, world.tick) <= 40)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')
    const wellHealth = healthStatOf(world, person.id, world.tick)
    const wellLooks = looksOf(world, person.id, world.tick)
    const record = world.health.get(person.id)
    world.health.set(person.id, {
      ...(record ?? { personId: person.id }),
      ailment: 'injury',
      severity: 800,
      disability: 200,
    } as never)
    expect(healthStatOf(world, person.id, world.tick)).toBeLessThan(wellHealth)
    // Condition carries most of looks: somebody unwell looks unwell.
    expect(looksOf(world, person.id, world.tick)).toBeLessThan(wellLooks)
  })
})
