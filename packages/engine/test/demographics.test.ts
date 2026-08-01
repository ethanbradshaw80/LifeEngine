/**
 * Demographics (D1) — the read-side measures.
 *
 * The claims: yearly rows reconcile exactly with the population they claim
 * to describe (births - deaths = growth, year over year, to the person);
 * the funnel partitions adults with nobody counted twice or dropped; the
 * fertility window constants match the ones systems.ts actually rolls; and
 * none of it consumes a draw — measuring the town must not change it.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import {
  FERTILITY_MAX_AGE,
  FERTILITY_MIN_AGE,
  fertilityCohort,
  partneringFunnel,
  populationAt,
  yearlyDemographics,
} from '../src/demographics.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { serialize } from '../src/snapshot.js'
import { CHILDBEARING_MAX_AGE, CHILDBEARING_MIN_AGE, livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

let world: World

beforeAll(() => {
  world = createWorld(makeSeed(12345), 100)
  advanceTicks(world, 900)
})

describe('yearly rows', () => {
  it('reconcile to the person: growth equals births minus deaths, every year', () => {
    const rows = yearlyDemographics(world)
    expect(rows.length).toBeGreaterThan(70)
    for (let i = 1; i < rows.length; i++) {
      const previous = rows[i - 1]
      const row = rows[i]
      if (!previous || !row) throw new Error('gap in years')
      expect(row.year).toBe(previous.year + 1)
      expect(row.population - previous.population).toBe(row.births - row.deaths)
    }
  })

  it('current population agrees with the living list', () => {
    expect(populationAt(world, world.tick)).toBe(livingPeople(world).length)
  })
})

describe('the funnel', () => {
  it('partitions adults exactly', () => {
    const funnel = partneringFunnel(world)
    expect(funnel.courtingNow + funnel.marriedNow + funnel.singleNow).toBe(funnel.adults)
    expect(funnel.neverPartnered).toBeLessThanOrEqual(funnel.singleNow)
  })
})

describe('the cohort', () => {
  it('window constants match what systems.ts rolls', () => {
    expect(FERTILITY_MIN_AGE).toBe(CHILDBEARING_MIN_AGE)
    expect(FERTILITY_MAX_AGE).toBe(CHILDBEARING_MAX_AGE)
  })

  it('childless women never exceed the cohort', () => {
    const cohort = fertilityCohort(world)
    expect(cohort.childlessWomen).toBeLessThanOrEqual(cohort.completedWomen)
    expect(cohort.totalChildren).toBeGreaterThanOrEqual(0)
  })
})

describe('founders are not miscounted', () => {
  // A young world is the regression window for the D1 review findings:
  // founders are still inside 18-45, founder marriages predate the event
  // log (worldgen writes spouse edges with no wedding event), and founder
  // grandmothers carry children worldgen never recorded.
  it('a 20-year world partitions cleanly and its completed cohort is empty', () => {
    const young = createWorld(makeSeed(777), 100)
    advanceTicks(young, 240)
    const funnel = partneringFunnel(young)
    expect(funnel.courtingNow + funnel.marriedNow + funnel.singleNow).toBe(funnel.adults)
    expect(funnel.neverPartnered).toBeLessThanOrEqual(funnel.singleNow)
    // The fertility window is 23 years long, so at 20 years NOBODY can have
    // lived one entirely inside the record — any nonzero count here means
    // pre-record founders are leaking back into the cohort.
    expect(fertilityCohort(young).completedWomen).toBe(0)
  })
})

describe('measuring is not steering', () => {
  it('running every query leaves the world byte-identical', () => {
    const before = serialize(world)
    yearlyDemographics(world)
    partneringFunnel(world)
    fertilityCohort(world)
    populationAt(world, world.tick)
    expect(serialize(world)).toBe(before)
  })
})
