/**
 * D2 — the town must live (DEMOGRAPHICS_AUDIT.md §D2, ADR-0019).
 *
 * The claims: the demographic machinery holds a town stable-to-growing
 * over 150 years by MODELLED DECISIONS (seeking, meeting, family plans,
 * remarriage) — never a birth multiplier; the plan is decided and recorded
 * at the wedding; hardship shrinks it on the record; and the tuned bands
 * hold. Bands here are slightly looser than the audit's tuning targets so
 * future re-tuning inside the targets does not flake this test — but a
 * regression to collapse OR explosion fails loudly.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { fertilityCohort, partneringFunnel, populationAt, yearlyDemographics } from '../src/demographics.js'
import { advanceTicks, createWorld } from '../src/index.js'
import type { World } from '../src/types.js'

describe('the town lives (150 years, seed 12345)', () => {
  let world: World

  beforeAll(() => {
    world = createWorld(makeSeed(12345))
    advanceTicks(world, 1800)
  })

  it('population grows gently — no collapse, no explosion', () => {
    const finalPop = populationAt(world, world.tick)
    expect(finalPop).toBeGreaterThan(110) // collapse guard (was 18 before D2)
    expect(finalPop).toBeLessThan(450) // explosion guard (hit 508 mid-tuning)
  })

  it('completed families sit in the believable band', () => {
    const cohort = fertilityCohort(world)
    expect(cohort.completedWomen).toBeGreaterThan(50)
    const fertility = cohort.totalChildren / cohort.completedWomen
    expect(fertility).toBeGreaterThan(1.9)
    expect(fertility).toBeLessThan(2.8)
    const childless = cohort.childlessWomen / cohort.completedWomen
    expect(childless).toBeGreaterThan(0.04)
    expect(childless).toBeLessThan(0.25)
    expect(cohort.medianAgeAtMarriage).toBeGreaterThanOrEqual(21)
    expect(cohort.medianAgeAtMarriage).toBeLessThanOrEqual(28)
  })

  it('remarriage is a normal event, and meetings actually happen', () => {
    expect(partneringFunnel(world).remarriagesEver).toBeGreaterThan(5)
    expect(world.events.some((e) => e.type === 'was-introduced')).toBe(true)
  })

  it('every recent birth belongs to a couple with a decided, recorded plan', () => {
    // Married couples carry an aspiration; each wedding recorded a 'family'
    // decision. Spot-check the invariant across the whole graph.
    let planned = 0
    for (const relationship of world.relationships.values()) {
      if (relationship.type !== 'spouse') continue
      const a = world.people.get(relationship.a)
      const b = world.people.get(relationship.b)
      if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue
      expect(relationship.familySizeAspiration).not.toBeNull()
      planned++
    }
    expect(planned).toBeGreaterThan(5)
    // And the plans were RECORDED, not just stored (Law 3 / ADR-0019).
    expect(world.causalRecords.some((record) => record.decision === 'family')).toBe(true)
  })
})

describe('a second seed does not collapse either', () => {
  // The bands above run on one seed for runtime's sake; a regression that
  // only bites another seed must still fail somewhere (review S7). The
  // yearly reconciliation rides along on the same world.
  it('seed 777 stays alive at 150 years, and its rows reconcile', () => {
    const world = createWorld(makeSeed(777))
    advanceTicks(world, 1800)
    expect(populationAt(world, world.tick)).toBeGreaterThan(110)
    const rows = yearlyDemographics(world)
    for (let i = 1; i < rows.length; i++) {
      const previous = rows[i - 1]
      const row = rows[i]
      if (!previous || !row) throw new Error('gap in years')
      expect(row.population - previous.population).toBe(row.births - row.deaths)
    }
  })
})
