/**
 * THINGS THAT HAPPEN TO A BUSINESS (owner: "It feels like every business is
 * dull and nothing to do until you IPO we need to add things to make it
 * better").
 *
 * THE CLAIMS: a moment actually reaches somebody running a shop; it does
 * not arrive while the business is already drowning; a moment that needs
 * staff never lands on a business with none; every answer does something
 * real and takes it out of the TILL rather than the owner's pocket; and
 * standing still is allowed.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { walletOf } from '../src/finances.js'
import {
  BUSINESS_MOMENTS,
  MATCH_PRICE_STEP,
  NURSE_SPOILS_PER_MILLE,
  businessMomentById,
  businessMomentsFor,
} from '../src/moments.js'
import { freshOps } from '../src/operations.js'
import {
  businessOf,
  opsFor,
  orderStockPlayer,
  resolvePending,
  setPlayer,
  startBusiness,
} from '../src/player.js'

/** A player running a shop, with money and nothing in the way. */
function aShopkeeper(seed = 12345) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 26 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 26 && ageAt(p.birthTick, world.tick) <= 42)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 9_000_000_000 as Money })
  startBusiness(world, 'shop')
  ;(world.player as { pending: unknown }).pending = null
  return { world, person }
}

/** Run months, stopping the moment the business asks something. */
function runUntilMoment(world: ReturnType<typeof createWorld>, months: number): boolean {
  for (let i = 0; i < months; i += 1) {
    if (world.player.pending?.kind === 'business-moment') return true
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  return world.player.pending?.kind === 'business-moment'
}

describe('a business that happens to you', () => {
  it('actually sends something to somebody running a shop', () => {
    /**
     * THE COMPLAINT AS A TEST. The operations loop gave an owner things to
     * DO; nothing ever arrived on its own, so a private business was a
     * screen you visited rather than a thing you ran.
     */
    const { world } = aShopkeeper()
    expect(runUntilMoment(world, 12 * 8), 'nothing ever happened to the business').toBe(true)

    const pending = world.player.pending
    expect(pending?.kind).toBe('business-moment')
    const moment = businessMomentById(pending?.occupationId ?? '')
    expect(moment, 'the moment names something real').toBeDefined()
    expect(pending?.options.length ?? 0).toBeGreaterThanOrEqual(2)
    // It is about the business the player actually runs.
    expect(pending?.workplaceId).toBe(businessOf(world, world.player.personId as never)?.id)
  })

  it('never asks for staff nobody has', () => {
    // A wage demand needs somebody to make it, and a contract that would
    // clear the shelf needs a shelf.
    const bare = businessMomentsFor(freshOps(), 0)
    expect(bare.length).toBeGreaterThan(0)
    expect(bare.some((moment) => moment.needsStaff === true)).toBe(false)
    expect(bare.some((moment) => moment.needsStock === true)).toBe(false)

    const staffed = businessMomentsFor({ ...freshOps(), stockCents: 5_000_00 as Money }, 3)
    expect(staffed.length).toBe(BUSINESS_MOMENTS.length)
  })

  it('gives every moment at least two ways out, and none of them free', () => {
    // The rule the content had to pass: where one answer is obviously
    // right it is not a decision.
    for (const moment of BUSINESS_MOMENTS) {
      expect(moment.options.length).toBeGreaterThanOrEqual(2)
      expect(moment.question.length).toBeGreaterThan(20)
    }
  })
})

describe('what an answer costs', () => {
  it('cuts the price when you match a rival, and it stays cut', () => {
    const { world } = aShopkeeper()
    const before = opsFor(world)?.markupPerMille ?? 1000
    // Put the moment in front of the player directly, so the test is about
    // the ANSWER rather than about waiting for a seeded roll.
    const business = businessOf(world, world.player.personId as never)
    if (!business) return
    ;(world.player as { pending: unknown }).pending = {
      id: 1,
      tick: world.tick,
      kind: 'business-moment',
      personId: world.player.personId,
      otherId: null,
      occupationId: 'rival-undercuts',
      workplaceId: business.id,
      monthlyPay: null,
      placeId: null,
      options: ['match-them', 'hold-your-price', 'put-the-word-out'],
    }
    resolvePending(world, 'match-them')
    expect(opsFor(world)?.markupPerMille).toBe(before - MATCH_PRICE_STEP)
  })

  it('takes the money out of the till, not the owner’s pocket', () => {
    /**
     * THE OWNER'S RULING ("the business funds need to be kinda separate
     * from the real bank"), applied to a kind of spending that did not
     * exist when he made it.
     */
    const { world, person } = aShopkeeper()
    const business = businessOf(world, person.id)
    if (!business) return
    const tillBefore = business.capital
    const pocketBefore = walletOf(world, person.id).savings

    ;(world.player as { pending: unknown }).pending = {
      id: 2,
      tick: world.tick,
      kind: 'business-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'equipment-breaks',
      workplaceId: business.id,
      monthlyPay: null,
      placeId: null,
      options: ['repair-it', 'replace-it', 'nurse-it-along'],
    }
    resolvePending(world, 'replace-it')

    expect(businessOf(world, person.id)?.capital ?? 0).toBeLessThan(tillBefore)
    expect(walletOf(world, person.id).savings, 'the pocket was not touched').toBe(pocketBefore)
    // New kit is a refit — the place works better for years.
    expect(opsFor(world)?.refitAtTick).not.toBeNull()
  })

  it('spoils the shelf when you nurse it along instead of paying', () => {
    // The free answer is not free. It is just paid for later.
    const { world, person } = aShopkeeper()
    const business = businessOf(world, person.id)
    if (!business) return
    expect(orderStockPlayer(world, 3).done).toBe(true)
    const shelf = opsFor(world)?.stockCents ?? 0
    expect(shelf).toBeGreaterThan(0)

    ;(world.player as { pending: unknown }).pending = {
      id: 3,
      tick: world.tick,
      kind: 'business-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'equipment-breaks',
      workplaceId: business.id,
      monthlyPay: null,
      placeId: null,
      options: ['repair-it', 'replace-it', 'nurse-it-along'],
    }
    resolvePending(world, 'nurse-it-along')

    const after = opsFor(world)?.stockCents ?? 0
    expect(after).toBeLessThan(shelf)
    expect(after).toBe(Math.floor((shelf * (1000 - NURSE_SPOILS_PER_MILLE)) / 1000))
  })

  it('lets you stand still, and does not punish it twice', () => {
    const { world, person } = aShopkeeper()
    const business = businessOf(world, person.id)
    if (!business) return
    const tillBefore = business.capital
    const priceBefore = opsFor(world)?.markupPerMille

    ;(world.player as { pending: unknown }).pending = {
      id: 4,
      tick: world.tick,
      kind: 'business-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'rival-undercuts',
      workplaceId: business.id,
      monthlyPay: null,
      placeId: null,
      options: ['match-them', 'hold-your-price', 'put-the-word-out'],
    }
    resolvePending(world, 'hold-your-price')

    expect(businessOf(world, person.id)?.capital).toBe(tillBefore)
    expect(opsFor(world)?.markupPerMille).toBe(priceBefore)
    // It still happened, and the record says so.
    expect(world.events.some((event) => event.type === 'business-moment')).toBe(true)
  })
})
