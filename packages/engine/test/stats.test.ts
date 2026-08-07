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
import { fitnessOf, fitnessStandardFor, fitnessTargetFor, STATS_FROM_AGE } from '../src/stats.js'

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
