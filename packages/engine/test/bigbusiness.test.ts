/**
 * WHAT HAPPENS WHEN A BUSINESS GETS BIG (owner, playing, 2026-08-14).
 *
 * Five reports in one message, and each is a claim here:
 *
 *   "I also have a company right now worth 75 million that is in the
 *    freelance cannot IPO or sell because nobody has the money to afford
 *    it, all companies should be able to IPO and stuff and be able to be
 *    sold to an NPC"
 *   "You still need to count the income we draw from the company as income
 *    net worth included this is an asset"
 *   "when someone starts to have a big company say like worth 2 million
 *    they shouldnt be able to work a full time job too"
 *   "it feels so easy to scale a business"
 *   "the 1 month 2 month thing is a little much"
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import {
  businessDemandsAllHours,
  businessDrawOf,
  businessWorthOf,
  netWorthOf,
  walletOf,
} from '../src/finances.js'
import { BUSINESS_IS_FULL_TIME_AT, earningBaseOf, scaleUpBar, businessKindById } from '../src/business.js'
import {
  buyersForBusiness,
  businessOf,
  jobBar,
  sellBusinessPlayer,
  setPlayer,
  startBusiness,
} from '../src/player.js'

function clearPending(world: ReturnType<typeof createWorld>): void {
  ;(world.player as { pending: unknown }).pending = null
}

function run(world: ReturnType<typeof createWorld>, months: number): void {
  for (let i = 0; i < months; i += 1) {
    clearPending(world)
    advanceTicks(world, 1)
  }
  clearPending(world)
}

/** A player running the named trade, with money behind them. */
function founder(kind: string, seed = 12345) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 22 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 24 && ageAt(p.birthTick, world.tick) <= 32)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 90_000_000_000 as Money })
  startBusiness(world, kind)
  clearPending(world)
  return { world, person }
}

/** Make the player's business worth roughly `cents` by giving it a track record. */
function makeItWorth(world: ReturnType<typeof createWorld>, personId: number, monthly: number) {
  const business = businessOf(world, personId as never)
  if (!business) throw new Error('no business')
  world.businessBooks.set(
    business.id,
    Array.from({ length: 12 }, (_, month) => ({
      tick: (world.tick - (12 - month)) as never,
      takings: (monthly * 2) as Money,
      wages: 0 as Money,
      profit: monthly as Money,
      drawn: Math.floor(monthly * 0.7) as Money,
      retained: Math.floor(monthly * 0.3) as Money,
    })),
  )
  return business
}

describe('a business too big for the town', () => {
  it('can still become a company, whatever trade it is', () => {
    /**
     * THE TRAP, EXACTLY AS REPORTED. Scaling up was gated on a WHITELIST of
     * two trades — a shop and a contracting firm — so a freelance business
     * worth seventy-five million could not incorporate. And a trade cannot
     * list on an exchange. Both doors, shut, on the same business.
     */
    const { world, person } = founder('freelance')
    const business = businessOf(world, person.id)
    expect(business).toBeDefined()
    if (!business) return
    const kind = businessKindById(business.kindId)
    if (!kind) return

    // Old and big enough: the two gates that remain, and they are real.
    const grown = {
      ...business,
      foundedTick: (world.tick - 12 * 9) as never,
      capital: (kind.capital * 8) as Money,
    }
    expect(scaleUpBar(grown, kind, world.tick)).toBeNull()

    // The years gate still bites on a young one.
    const young = { ...grown, foundedTick: world.tick as never }
    expect(scaleUpBar(young, kind, world.tick)).not.toBeNull()
  })

  it('can always be sold, because a buyer from away can always pay', () => {
    /**
     * "nobody has the money to afford it". A town of a few hundred people
     * does not contain a seventy-five-million-dollar cheque, so the list
     * came back empty and there was no road out at all.
     */
    const { world, person } = founder('freelance')
    // Worth far more than anybody in town could hold.
    makeItWorth(world, person.id, 800_000_000)

    const buyers = buyersForBusiness(world)
    expect(buyers.length, 'a business this size must still have a buyer').toBeGreaterThan(0)
    const outside = buyers.find((buyer) => buyer.firm !== undefined)
    expect(outside, 'somebody from away should be bidding').toBeDefined()
    if (!outside) return

    const before = walletOf(world, person.id)
    const cashBefore = before.checking + before.savings
    expect(sellBusinessPlayer(world, outside.personId).done).toBe(true)

    // The seller was paid, the business kept trading, and it is not theirs.
    const after = walletOf(world, person.id)
    expect(after.checking + after.savings).toBeGreaterThan(cashBefore)
    expect(businessOf(world, person.id)).toBeUndefined()
  })
})

describe('the business on the balance sheet', () => {
  it('counts towards what they are worth', () => {
    // "net worth included this is an asset" — and it counted for nothing.
    const { world, person } = founder('shop')
    const bare = netWorthOf(world, person.id)
    makeItWorth(world, person.id, 50_000_000)
    expect(businessWorthOf(world, person.id)).toBeGreaterThan(0)
    expect(netWorthOf(world, person.id)).toBeGreaterThan(bare)
  })

  it('counts what it pays out as income', () => {
    const { world, person } = founder('shop')
    expect(businessDrawOf(world, person.id)).toBe(0)
    makeItWorth(world, person.id, 50_000_000)
    expect(businessDrawOf(world, person.id)).toBeGreaterThan(0)
  })

  it('taxes that income, where it used to be free money', () => {
    // A draw was credited and nothing else — no tax year, no return. A
    // business owner paid tax on nothing while a wage earner paid on
    // everything.
    const { world, person } = founder('shop')
    run(world, 6)
    const owner = businessOf(world, person.id)
    if (!owner) return
    expect(world.accounts.get(person.id)?.taxableYtd ?? 0).toBeGreaterThan(0)
  })
})

describe('a business is a job', () => {
  it('shuts the door on other work once it is big enough', () => {
    const { world, person } = founder('shop')
    expect(businessDemandsAllHours(world, person.id)).toBe(false)

    // Past the owner's two million and it takes every hour there is.
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    expect(businessDemandsAllHours(world, person.id)).toBe(true)
    const bar = jobBar(world, 'clerk')
    expect(bar).not.toBeNull()
    expect(bar).toContain('business')
  })

  it('walks them out of the job they already had, and says so in the feed', () => {
    const { world, person } = founder('shop')
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    world.employment.set(person.id, {
      occupationId: 'clerk',
      workplaceId: 1 as never,
      monthlyPay: 200_000 as Money,
      sinceTick: world.tick,
      performance: 500,
    } as never)
    run(world, 2)
    expect(world.employment.get(person.id)).toBeUndefined()
    expect(
      world.events.some((e) => e.type === 'left-job' && e.detail === 'the-business'),
    ).toBe(true)
  })
})

describe('scaling is not multiplication', () => {
  it('earns less on each dollar past the size the trade naturally is', () => {
    /**
     * MEASURED BEFORE AND AFTER, as the owner asked. An active player
     * climbing the ladder every year reached $23.7M and $34.6M inside ten
     * years against a $10M gate — the gate was a formality. Earnings were
     * LINEAR in capital for ever: ten times the money made ten times the
     * profit, on the same square, in the same small town.
     */
    const founding = 1_000_000
    // Up to four times founding, every dollar works.
    expect(earningBaseOf(founding * 4, founding)).toBe(founding * 4)
    // Past that it tapers, twice.
    const wide = earningBaseOf(founding * 10, founding)
    expect(wide).toBeLessThan(founding * 10)
    expect(wide).toBeGreaterThan(founding * 4)
    const huge = earningBaseOf(founding * 40, founding)
    expect(huge).toBeLessThan(founding * 40)

    // Growing is still WORTH doing — it just stops being multiplication.
    expect(huge).toBeGreaterThan(wide)
    const marginalEarly = earningBaseOf(founding * 5, founding) - earningBaseOf(founding * 4, founding)
    const marginalLate = earningBaseOf(founding * 41, founding) - earningBaseOf(founding * 40, founding)
    expect(marginalLate).toBeLessThan(marginalEarly)
  })
})
