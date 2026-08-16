import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import {
  baCompensationFor,
  coverageOf,
  disabilityRatingFor,
  inTheBA,
  outOfPocketFor,
} from '../src/benefits.js'
import { personalIncome } from '../src/finances.js'
import { setBaRating } from '../src/health.js'
import type { Money, Tick } from '@life-engine/shared'

/**
 * THE BA, AND THE CHECK THAT WAS NEVER CASHED.
 *
 * `health.ts` has recorded a `granted-pension` event since L4-M5 — the board
 * recognizes the disability, writes the causal record, prints the monthly
 * figure into the event detail — and no money ever moved. A man discharged
 * without a leg drew nothing from it for the rest of his life.
 */
describe('the BA', () => {
  /** A discharged veteran carrying a service-connected disability. */
  function veteran(serviceDisability: number) {
    const world = createWorld(makeSeed(707), 100)
    const personId = [...world.people.keys()][0]!
    const health = world.health.get(personId)!
    world.health.set(personId, {
      ...health,
      disability: serviceDisability,
      serviceDisability,
      permanent: [{ kind: 'amputation', site: 'leg', sinceTick: world.tick }],
    })
    world.service.set(personId, {
      ...(world.service.get(personId) ?? ({} as never)),
      personId,
      dischargedAtTick: world.tick as Tick,
    } as never)
    return { world, personId }
  }

  it('enrols a discharged veteran with a service-connected disability', () => {
    const { world, personId } = veteran(450)
    expect(inTheBA(world, personId)).toBe(true)
    expect(coverageOf(world, personId, world.tick).source).toBe('ba')
  })

  it('states the rating as a percentage, the way a board does', () => {
    const { world, personId } = veteran(450)
    expect(disabilityRatingFor(world, personId)).toBe(45)
  })

  it('actually pays — this is the money that never moved', () => {
    const { world, personId } = veteran(450)
    expect(baCompensationFor(world, personId, world.tick)).toBeGreaterThan(0)
  })

  it('and the payment reaches personal income, not just an event', () => {
    // THE CLAIM THAT MATTERS. A compensation function that returns a number
    // nobody spends is exactly the bug this module was written to fix, and a
    // test that only checked `baCompensationFor` would pass on it.
    const { world, personId } = veteran(450)
    const withPension = personalIncome(world, personId)

    const health = world.health.get(personId)!
    world.health.set(personId, { ...health, serviceDisability: 0 })
    const without = personalIncome(world, personId)

    expect(withPension).toBeGreaterThan(without)
  })

  it('pays nothing below the threshold the board uses', () => {
    const { world, personId } = veteran(100)
    expect(inTheBA(world, personId)).toBe(false)
    expect(baCompensationFor(world, personId, world.tick)).toBe(0)
  })
})

describe('the coverage resolver', () => {
  it('charges a service-connected veteran nothing for their care', () => {
    const world = createWorld(makeSeed(707), 100)
    const personId = [...world.people.keys()][0]!
    const health = world.health.get(personId)!
    world.health.set(personId, { ...health, serviceDisability: 450 })
    world.service.set(personId, {
      ...(world.service.get(personId) ?? ({} as never)),
      personId,
      dischargedAtTick: world.tick as Tick,
    } as never)

    const bill = 1_200_000 as Money
    expect(outOfPocketFor(world, personId, bill, true, world.tick)).toBe(0)
    // NOT EVERYTHING IS FREE. Non-service-connected care still costs a
    // veteran something, or the BA would be a cheat code rather than a
    // benefit.
    expect(outOfPocketFor(world, personId, bill, false, world.tick)).toBeGreaterThan(0)
  })

  it('makes the uninsured pay the whole bill', () => {
    /**
     * BUILT, NOT SEARCHED FOR. The first version of this hunted a real town
     * for an uninsured person and asserted on whoever it found — which meant
     * the test's subject depended on the town's demographics, and it quietly
     * passed by finding nobody at all. What is under test is the RESOLVER,
     * so the situation is constructed and the claim is exact.
     */
    const world = createWorld(makeSeed(707), 100)
    advanceTicks(world, 12 * 30)
    const personId = [...world.people.keys()].find((id) => {
      const person = world.people.get(id)
      if (person === undefined || person.deathTick !== null) return false
      return ageAt(person.birthTick, world.tick) >= 18 && ageAt(person.birthTick, world.tick) < 65
    })
    expect(personId).toBeDefined()
    if (personId === undefined) return

    // No job, no service, and money behind them — the between-jobs gap the
    // spec calls out: too solvent for PublicCare, too young for SeniorCare.
    world.employment.delete(personId)
    const person = world.people.get(personId)!
    if (person.householdId !== null) {
      const household = world.households.get(person.householdId)
      if (household !== undefined) {
        world.households.set(household.id, { ...household, savings: 500_000 as Money })
      }
    }

    expect(coverageOf(world, personId, world.tick).source).toBe('uninsured')
    const bill = 500_000 as Money
    expect(outOfPocketFor(world, personId, bill, false, world.tick)).toBe(bill)
  })

  it('never charges more than the out-of-pocket maximum', () => {
    const world = createWorld(makeSeed(707), 100)
    advanceTicks(world, 12 * 30)
    const personId = [...world.people.keys()].find((id) => world.employment.has(id))
    expect(personId).toBeDefined()
    if (personId === undefined) return
    const coverage = coverageOf(world, personId, world.tick)
    // The catastrophe cap is the thing that stops one bad year ending a
    // life, and it has to hold at any bill size.
    const ruinous = 900_000_000 as Money
    expect(outOfPocketFor(world, personId, ruinous, false, world.tick)).toBeLessThanOrEqual(
      coverage.outOfPocketMax,
    )
  })
})

describe('the stored grant (spec 3a, the schema half)', () => {
  it('a grant never lowers what a veteran already had', () => {
    const world = createWorld(makeSeed(707), 100)
    const personId = [...world.people.keys()][0]!
    const health = world.health.get(personId)!
    world.health.set(personId, { ...health, serviceDisability: 400, baRating: 500 })
    // A worse roll than the standing rating must change nothing: the
    // writer is monotone upward, which is what makes filing safe to click.
    setBaRating(world, personId, 300)
    expect(world.health.get(personId)?.baRating).toBe(500)
    // And the money reads the higher of carried and granted.
    expect(disabilityRatingFor(world, personId)).toBe(50)
  })

  it('the granted rating raises the pension, not a second payment', () => {
    const world = createWorld(makeSeed(707), 100)
    const personId = [...world.people.keys()][0]!
    const health = world.health.get(personId)!
    world.health.set(personId, { ...health, serviceDisability: 300, baRating: null })
    world.service.set(personId, {
      ...(world.service.get(personId) ?? ({} as never)),
      personId,
      dischargedAtTick: world.tick as Tick,
    } as never)
    const before = personalIncome(world, personId)
    setBaRating(world, personId, 450)
    const after = personalIncome(world, personId)
    // The board recognized more than the raw record; the one pension pays
    // it. No new payment path exists — that mistake was already made once.
    expect(after).toBeGreaterThan(before)
  })
})
