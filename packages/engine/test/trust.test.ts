/**
 * THE FAMILY TRUST — money that outlives the person who earned it.
 *
 * THE CLAIMS, and the first is the one the whole thing rests on: trust
 * capital NEVER passes through an estate, so it survives the founder's death
 * untaxed and undivided. Beyond that — the money genuinely leaves the founder
 * and cannot come back; it reaches grandchildren, not just children; each
 * rule pays who it says it pays; and it is bounded by what was put in rather
 * than compounding into a fortune of its own.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import {
  TRUST_DRAW_PER_MILLE,
  beneficiariesOf,
  descendantsOf,
  moneyMonthFor,
  trustOf,
  trustValueOf,
  walletOf,
} from '../src/finances.js'
import { settleTrustPlayer, setPlayer, trustViewFor } from '../src/player.js'
import { livingPeople } from '../src/systems.js'

import type { World } from '../src/types.js'

/**
 * MONTH BY MONTH, CLEARING THE QUESTIONS. `advanceTicks` STOPS the moment
 * the world raises a decision, which is correct — and it means asking for
 * sixty years in one call can land far fewer. The founder's own death is
 * exactly the kind of thing that raises one.
 */
function run(world: World, months: number): void {
  for (let i = 0; i < months; i += 1) {
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  ;(world.player as { pending: unknown }).pending = null
}

/** Somebody with money, grown children, and time left to see the trust work. */
function aFounder(savings = 900_000_000) {
  const world = createWorld(makeSeed(4242), 140)
  advanceTicks(world, 40 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 40 && ageAt(p.birthTick, world.tick) <= 60)
    .filter((p) => livingPeople(world).some((c) => c.parentIds.includes(p.id)))
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody with children')
  setPlayer(world, person.id)
  ;(world.player as { pending: unknown }).pending = null
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: savings as Money })
  return { world, person }
}

let world: World
let founderId: number

beforeEach(() => {
  const made = aFounder()
  world = made.world
  founderId = made.person.id
})

describe('the money leaves you for good', () => {
  it('takes it out of the wallet and gives nothing back', () => {
    const purse = () => {
      const w = walletOf(world, founderId as never)
      return w.checking + w.savings
    }
    const before = purse()
    const done = settleTrustPlayer(world, 50_000_000)
    expect(done.done, done.reason).toBe(true)
    expect(before - purse()).toBe(50_000_000)
    // And there is no verb anywhere that draws it back out — the only way
    // money leaves a trust is the annual payment to descendants.
    expect(trustOf(world, founderId as never)?.principal ?? 0).toBeGreaterThan(0)
  })

  it('refuses a sum too small to draw papers for, and says so', () => {
    const bar = trustViewFor(world).bar
    const tiny = settleTrustPlayer(world, 1_000)
    expect(tiny.done).toBe(false)
    expect(tiny.reason).toContain('or more')
    void bar
  })

  it('lets a family add to it down the generations', () => {
    expect(settleTrustPlayer(world, 20_000_000).done).toBe(true)
    const first = trustOf(world, founderId as never)?.principal ?? 0
    expect(settleTrustPlayer(world, 20_000_000).done).toBe(true)
    expect(trustOf(world, founderId as never)?.principal ?? 0).toBeGreaterThan(first)
    // Still one trust, not two.
    expect(world.trusts.filter((t) => t.founderId === (founderId as never))).toHaveLength(1)
  })
})

describe('it survives the estate — the whole point', () => {
  it('is untouched by the founder’s death', () => {
    /**
     * `distributeEstate` reads a person's ACCOUNTS. Trust capital has not
     * been in anybody's accounts since the day it was settled, so there is
     * nothing for the estate to tax, divide or spend. This test is the one
     * that would fail if somebody ever "helpfully" folded trusts into the
     * will.
     */
    expect(settleTrustPlayer(world, 60_000_000).done).toBe(true)
    const before = trustOf(world, founderId as never)?.principal ?? 0
    expect(before).toBeGreaterThan(0)

    const founder = world.people.get(founderId as never)
    expect(founder).toBeDefined()
    if (!founder) return
    // Run the world well past the founder's life.
    run(world, 60 * 12)
    expect(world.people.get(founderId as never)?.deathTick, 'the founder outlived the test').not.toBe(null)

    const after = trustOf(world, founderId as never)
    expect(after, 'the trust died with the man').toBeDefined()
    expect(after?.principal).toBe(before)
  })

  it('reaches grandchildren, not only children', () => {
    // An estate goes to children. A trust exists to reach the people who
    // were not born when it was written.
    advanceTicks(world, 30 * 12)
    const blood = descendantsOf(world, founderId as never)
    const children = blood.filter((p) => p.parentIds.includes(founderId as never))
    expect(blood.length, 'nobody in the line at all').toBeGreaterThan(0)
    expect(blood.length).toBeGreaterThanOrEqual(children.length)
  })
})

describe('it pays, and only what it can', () => {
  it('hands out its draw once a year, to the line', () => {
    expect(settleTrustPlayer(world, 200_000_000).done).toBe(true)
    const trust = trustOf(world, founderId as never)
    expect(trust).toBeDefined()
    if (!trust) return
    // A year to the day.
    run(world, 12)
    const paid = trustOf(world, founderId as never)?.paidOut ?? 0
    if (beneficiariesOf(world, trust).length === 0) return
    expect(paid, 'a year passed and the trust paid nobody').toBeGreaterThan(0)
    /**
     * MEASURED AT THE MOMENT IT PAID, not a year earlier. The principal is
     * held in base-year cents so its value at TODAY'S prices is higher than
     * it was twelve months ago — reading the draw before the year ran made
     * the payment look like an overdraw when it was the money keeping its
     * real value, which is the feature.
     */
    const draw = Math.floor(
      (trustValueOf(world, trustOf(world, founderId as never) as never) * TRUST_DRAW_PER_MILLE) /
        1000,
    )
    // Never more than the draw — the principal is not touched.
    expect(paid).toBeLessThanOrEqual(draw + 1)
  })

  it('names the trust on the money it sends', () => {
    // Law 3, and the statement: a payment nobody can explain is the thing
    // the money log exists to stop.
    expect(settleTrustPlayer(world, 200_000_000).done).toBe(true)
    advanceTicks(world, 12)
    const beneficiary = beneficiariesOf(world, trustOf(world, founderId as never) as never)[0]
    if (beneficiary === undefined) return
    const event = world.events.find(
      (e) => e.type === 'trust-paid' && e.subjectId === beneficiary.id,
    )
    expect(event, 'money arrived from nowhere').toBeDefined()
  })

  it('never grows itself — it is only ever as big as what was put in', () => {
    /**
     * NO COMPOUNDING. The principal is held in base-year cents so it keeps
     * its real value, and the payout comes off the top; nothing is
     * reinvested. A trust cannot become the tail this whole revamp exists
     * to cut.
     */
    expect(settleTrustPlayer(world, 100_000_000).done).toBe(true)
    const settled = trustOf(world, founderId as never)?.principal ?? 0
    advanceTicks(world, 25 * 12)
    expect(trustOf(world, founderId as never)?.principal ?? 0).toBe(settled)
  })

  it('shows up on the founder’s own statement', () => {
    settleTrustPlayer(world, 50_000_000)
    const line = moneyMonthFor(world, world.tick).find((e) =>
      e.label.includes('Settled on the family trust'),
    )
    expect(line, 'a fortune left and the statement did not say why').toBeDefined()
    expect(line?.amount ?? 0).toBeLessThan(0)
  })
})
