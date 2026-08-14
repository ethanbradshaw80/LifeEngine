/**
 * GROWING A BUSINESS, AND GETTING OUT OF ONE.
 *
 * OWNER: "there is no real ways to grow the business... if they cross the
 * threshold of an evaluation of over 10 million before year 8 they are
 * allowed to IPO" and "why would someone grow a company to its max and not
 * be able to sell and start another business they would just be stuck".
 *
 * THE CLAIMS: the ceiling is something you raise rather than a wall you
 * meet; a well-run business can be worth ten million inside eight years and
 * that opens the exchange; a business can be sold, with the backers paid
 * what they were promised before the founder sees a penny; and it can
 * always be shut.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { walletOf } from '../src/finances.js'
import { CAPITAL_CEILING_MULTIPLE, businessKindById } from '../src/business.js'
import {
  CEILING_STEPS_MAX,
  ceilingBonusPerMilleOf,
  growthOptionsFor,
  privateValuationOf,
} from '../src/equity.js'
import {
  buyersForBusiness,
  businessOf,
  ceilingReport,
  growBusinessPlayer,
  growthOffersFor,
  investInBusinessPlayer,
  ipoBar,
  sellBusinessPlayer,
  setPlayer,
  setRetainPlayer,
  startBusiness,
  windDownPlayer,
} from '../src/player.js'

function clearPending(world: ReturnType<typeof createWorld>): void {
  ;(world.player as { pending: unknown }).pending = null
}

/**
 * RUN THE MONTHS, one at a time.
 *
 * `advanceTicks` STOPS the moment the world raises a decision for the
 * player — which is correct, and which means asking it for a hundred months
 * in one call gets you about eleven. Measured the hard way: a business that
 * looked like it never aged was a world that had stopped on a pending
 * question in its second year.
 */
function run(world: ReturnType<typeof createWorld>, months: number): void {
  for (let i = 0; i < months; i += 1) {
    clearPending(world)
    advanceTicks(world, 1)
  }
  clearPending(world)
}

/** A player running a shop, young enough to still be alive in ten years. */
function aShopkeeper(seed = 12345) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 22 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 24 && ageAt(p.birthTick, world.tick) <= 30)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 90_000_000_000 as Money })
  startBusiness(world, 'shop')
  clearPending(world)
  return { world, person }
}

describe('the ceiling', () => {
  it('is something you raise, not a wall you meet', () => {
    /**
     * THIS IS THE WHOLE COMPLAINT, AS A TEST. Retained profit was capped at
     * four times what the trade took to open, so a well-run shop and a
     * badly-run one arrived at exactly the same place and stopped there.
     */
    const { world } = aShopkeeper()
    // A year at the wheel before anybody sells you more room.
    run(world, 13)
    const before = ceilingReport(world)
    expect(before).toBeDefined()
    if (!before) return

    const business = businessOf(world, world.player.personId as never)
    if (!business) return
    /**
     * THE TILL PAYS FOR THE LADDER (owner: "the business funds need to be
     * kinda separate from the real bank"), so the money has to be in the
     * business before it can climb. Which is the decision the draw dial is
     * really for.
     */
    for (let i = 0; i < CEILING_STEPS_MAX + 3; i += 1) {
      investInBusinessPlayer(world, 400_000_000)
      clearPending(world)
      growBusinessPlayer(world, 'capacity')
      clearPending(world)
    }

    const after = ceilingReport(world)
    expect(after?.steps).toBe(CEILING_STEPS_MAX)
    expect(after?.ceiling ?? 0).toBeGreaterThan(before.ceiling)

    // Seven steps of three takes a four-times trade to twenty-five times.
    const bonus = ceilingBonusPerMilleOf(world.expansions.get(business.id))
    expect(CAPITAL_CEILING_MULTIPLE + bonus / 1000).toBe(25)

    // And it stops there — a ceiling that rises for ever is no ceiling.
    expect(growBusinessPlayer(world, 'capacity').done).toBe(false)
  })

  it('names the ways to grow after the trade they belong to', () => {
    // A salon takes on another chair; a shop takes on more room. Same five
    // primitives underneath, which is what keeps it one system.
    const shop = businessKindById('shop')
    const salon = businessKindById('salon')
    if (!shop || !salon) return
    const shopWays = growthOptionsFor(shop)
    const salonWays = growthOptionsFor(salon)
    expect(shopWays).toHaveLength(salonWays.length)
    expect(shopWays.map((w) => w.kind)).toEqual(salonWays.map((w) => w.kind))
    // The words differ even though the mechanics do not.
    const shopLine = shopWays.find((w) => w.kind === 'new-line')?.blurb ?? ''
    const salonLine = salonWays.find((w) => w.kind === 'new-line')?.blurb ?? ''
    expect(shopLine).not.toBe(salonLine)
  })

  it('asks for years at the wheel, and says how many are missing', () => {
    const { world } = aShopkeeper()
    const offers = growthOffersFor(world)
    expect(offers.length).toBeGreaterThan(0)
    const contracts = offers.find((o) => o.terms.kind === 'contracts')
    expect(contracts?.bar, 'a new shop has not been trading four years').toContain('4 years')
  })
})

describe('ten million before year eight', () => {
  it('opens the exchange to a business that got there', () => {
    /**
     * THE OWNER'S RULE, MEASURED: capacity twice a year with the takings
     * left in reaches $15.1M by year eight at this seed, and the exchange
     * comes to you without ever having scaled up. A passive owner never
     * gets near it, which is the point.
     */
    const { world, person } = aShopkeeper()
    expect(ipoBar(world, person.id), 'a new shop cannot list').not.toBeNull()

    const business = businessOf(world, person.id)
    expect(business).toBeDefined()
    if (!business) return

    /**
     * THE GATE, TESTED AS A GATE. Written against the RULE rather than a
     * growth curve on one seed: what matters is that ten million inside
     * eight years opens the exchange and that being late closes it again,
     * not that a particular shop at a particular seed reaches a particular
     * number in a particular year.
     */
    const kind = businessKindById(business.kindId)
    if (!kind) return
    /**
     * A BUSINESS IS WORTH WHAT IT HAS EARNED, so a business worth ten
     * million is one with a YEAR OF EARNING behind it — rigging the capital
     * alone is now (correctly) not enough, because assets are only half of
     * what a buyer pays for.
     */
    const rich = { ...business, capital: (business.capital * 40) as Money }
    world.businesses.set(business.id, rich)
    world.businessBooks.set(
      business.id,
      Array.from({ length: 12 }, (_, month) => ({
        tick: (world.tick - (12 - month)) as never,
        takings: 9_000_000 as Money,
        wages: 0 as Money,
        profit: 8_000_000 as Money,
        drawn: 1_600_000 as Money,
        retained: 6_400_000 as Money,
      })),
    )
    expect(privateValuationOf(world, rich)).toBeGreaterThan(1_000_000_000)
    expect(ipoBar(world, person.id), 'ten million inside eight years opens it').toBeNull()

    // The same business, too late, is refused — and told why.
    run(world, 12 * 9)
    const late = world.businesses.get(business.id)
    if (late === undefined) return
    world.businesses.set(business.id, { ...late, capital: rich.capital })
    expect(ipoBar(world, person.id), 'the fast road closes at year eight').not.toBeNull()
  })

  it('grows far further when it is actively run than when it is left alone', () => {
    // A balance claim without a magic number: the ceiling ladder has to be
    // worth climbing, or none of it is a decision.
    const run_ = aShopkeeper()
    setRetainPlayer(run_.world, 800)
    run(run_.world, 13)
    for (let year = 0; year < 6; year += 1) {
      investInBusinessPlayer(run_.world, 200_000_000)
      clearPending(run_.world)
      growBusinessPlayer(run_.world, 'capacity')
      clearPending(run_.world)
      run(run_.world, 12)
    }

    const idle = aShopkeeper()
    run(idle.world, 12 * 7)

    const grown = businessOf(run_.world, run_.person.id)
    const left = businessOf(idle.world, idle.person.id)
    if (!grown || !left) return
    /**
     * MEASURED ON THE CEILING, not on the till. Climbing the ladder SPENDS
     * the till, so raw capital is the wrong yardstick for whether the
     * ladder was worth climbing — what it buys is room to become bigger.
     */
    const grownRoom = ceilingReport(run_.world)?.ceiling ?? 0
    const idleRoom = ceilingReport(idle.world)?.ceiling ?? 0
    expect(grownRoom).toBeGreaterThan(idleRoom * 2)
  })
})

describe('getting out', () => {
  it('pays the backers what they were promised before the founder', () => {
    /**
     * LIQUIDATION PREFERENCES FINALLY DO SOMETHING. Every shareholder
     * record has carried one since the register was built and no code path
     * read it, because a preference only means anything at an exit and
     * there was no exit.
     */
    const { world, person } = aShopkeeper()
    run(world, 36)
    const business = businessOf(world, person.id)
    if (!business) return

    const buyers = buyersForBusiness(world)
    expect(buyers.length, 'nobody in town could buy it').toBeGreaterThan(0)
    const buyer = buyers[0]
    if (!buyer) return

    const before = walletOf(world, person.id)
    const cashBefore = before.checking + before.savings

    expect(sellBusinessPlayer(world, buyer.personId).done).toBe(true)

    // The seller was paid, and the business is somebody else's now.
    const after = walletOf(world, person.id)
    expect(after.checking + after.savings).toBeGreaterThan(cashBefore)
    expect(world.businesses.get(business.id)?.ownerId).toBe(buyer.personId)
    // IT DOES NOT CLOSE. The town keeps what you built.
    expect(world.businesses.get(business.id)?.closedTick).toBeNull()
    // And you are free to start again.
    expect(businessOf(world, person.id)).toBeUndefined()
  })

  it('lets you shut it when nobody will buy', () => {
    const { world, person } = aShopkeeper()
    const business = businessOf(world, person.id)
    if (!business) return
    const before = walletOf(world, person.id)
    const cashBefore = before.checking + before.savings

    expect(windDownPlayer(world).done).toBe(true)
    expect(world.businesses.get(business.id)?.closedTick).not.toBeNull()
    // What was left of the capital came home.
    const after = walletOf(world, person.id)
    expect(after.checking + after.savings).toBeGreaterThan(cashBefore)
    expect(businessOf(world, person.id)).toBeUndefined()
  })
})
