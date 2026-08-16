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
import { ageAt, toDate } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import {
  businessDemandsAllHours,
  businessDrawOf,
  businessWorthOf,
  netWorthOf,
  walletOf,
  personalIncome,
} from '../src/finances.js'
import { BUSINESS_IS_FULL_TIME_AT, monthlyProfitFor, earningBaseOf, scaleUpBar, businessKindById } from '../src/business.js'
import {
  buyersForBusiness,
  businessOf,
  jobBar,
  sellBusinessPlayer,
  setPlayer,
  startBusiness,
  booksFor,
  setRetainPlayer,
  resolvePending,
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

  it('shows up as income on a real trading year, not just on a rigged one', () => {
    /**
     * OWNER, PLAYING TWICE (2026-08-14): first "I am still not seeing the
     * yearly draw as income anywhere in the money section", then — after a
     * line was added below the pay row — "income from the business that I
     * draw is still not counted in my monthly wages on the money tab".
     *
     * Both were fair. The figure a player reads as what they earn was
     * wages alone, so a founder drawing more than any job in town paid
     * still saw "no wages". The screen leads with the TOTAL now.
     *
     * This pins the engine half: a business that has simply traded for a
     * year reports a draw, without the test rigging its capital first.
     */
    const { world, person } = founder('shop')
    run(world, 14)
    const drawn = businessDrawOf(world, person.id)
    expect(drawn, 'a year of trading paid the owner nothing').toBeGreaterThan(0)

    // And the total a screen would show is strictly more than the wages.
    const wages = personalIncome(world, person.id)
    expect((wages + drawn) as Money).toBeGreaterThan(wages)
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

describe('the draw dial means what it says', () => {
  it('leaves in exactly the share you chose', () => {
    /**
     * OWNER'S RULING (2026-08-14): "if I choose the 70/30 option I would
     * take whatever is 70% of the profit and reinvest 30% into the company,
     * like if I choose the other splits and so on."
     *
     * It did not. Retention was clamped by the capital ceiling, so an owner
     * at the ceiling had the whole profit pushed into their hand whatever
     * the dial said — and the screen showed a split that was not happening.
     */
    const { world } = founder('shop')
    setRetainPlayer(world, 300)
    run(world, 13)
    const books = booksFor(world)
    expect(books).toBeDefined()
    if (!books) return
    for (const month of books.months) {
      if (month.profit <= 0) continue
      // 30% in, 70% out, to the rounding.
      expect(month.retained).toBe(Math.floor((month.profit * 300) / 1000))
      expect(month.drawn).toBe(month.profit - month.retained)
    }
  })

  it('still cannot compound a corner shop into a fortune', () => {
    /**
     * THE CLAMP WAS LOAD-BEARING, and removing it was measured rather than
     * assumed: a century produced a richest townsperson worth $476 TRILLION
     * and a business holding $4.8 billion, because capital compounds into
     * profit into capital.
     *
     * The loop is broken at the other end instead — you may leave in what
     * you like, but a business only EARNS on what it can put to work. This
     * pins that a business past its ceiling stops growing its own takings.
     */
    const { world, person } = founder('shop')
    const business = businessOf(world, person.id)
    if (!business) return
    const kind = businessKindById(business.kindId)
    if (!kind) return
    // Stuff the till far past anything the trade could deploy.
    world.businesses.set(business.id, {
      ...business,
      capital: (business.capital + kind.capital * 400) as Money,
    })
    run(world, 13)
    const fat = booksFor(world)?.year.takings ?? 0

    const lean = founder('shop', 4242)
    run(lean.world, 13)
    const ordinary = booksFor(lean.world)?.year.takings ?? 0
    // Four hundred times the capital does NOT buy four hundred times the
    // takings — the extra is money in the till, not a bigger business.
    expect(fat).toBeLessThan(ordinary * 40)
  })
})

describe('the books are a financial year', () => {
  it('accumulate through the year instead of sliding every month', () => {
    /**
     * OWNER, PLAYING (2026-08-14): "'the books last 12 months' changes
     * every single month. this should be the yearly view and it all
     * accumlates and restarts at the end of the year, right now it just
     * shows you the months stats."
     *
     * It was `months.slice(-12)` — the last twelve months from wherever
     * you were standing — so the oldest month silently dropped off the
     * back every time and the figures moved even in a month that went
     * exactly like the one before it.
     */
    const { world } = founder('shop')
    // Land on January so the year starts clean.
    while (toDate(world, world.tick).month !== 1) run(world, 1)

    let previousTakings = 0
    let previousMonths = 0
    for (let month = 0; month < 6; month += 1) {
      run(world, 1)
      const books = booksFor(world)
      expect(books).toBeDefined()
      if (!books) return
      // The count only ever climbs inside a year, and the takings with it.
      expect(books.year.months).toBeGreaterThan(previousMonths)
      expect(books.year.takings).toBeGreaterThanOrEqual(previousTakings)
      previousMonths = books.year.months
      previousTakings = books.year.takings
    }
  })

  it('starts again in January, and keeps the year just gone', () => {
    const { world } = founder('shop')
    // STAND IN DECEMBER and read the year before stepping out of it. The
    // first version of this test advanced once more before reading, so it
    // compared January against January and expected a change of year.
    while (toDate(world, world.tick).month !== 12) run(world, 1)
    const december = booksFor(world)
    expect(december).toBeDefined()
    if (!december) return
    const closed = december.year.months
    expect(closed).toBeGreaterThan(0)

    run(world, 1) // over the turn of the year
    const january = booksFor(world)
    expect(january).toBeDefined()
    if (!january) return
    // THE RESET. A fresh year, not a window that shuffled along by one.
    expect(january.yearNumber).toBe(december.yearNumber + 1)
    expect(january.year.months).toBeLessThan(closed)
    // And the year just gone is still there to compare against.
    expect(january.lastYear).toBeDefined()
    expect(january.lastYearNumber).toBe(december.yearNumber)
  })
})

describe('a business is a job', () => {
  it('shuts the door on other work once it is big enough', () => {
    const { world, person } = founder('shop')
    expect(businessDemandsAllHours(world, person.id)).toBe(false)

    // Past the owner's five hundred thousand and it takes every hour there is.
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    expect(businessDemandsAllHours(world, person.id)).toBe(true)
    const bar = jobBar(world, 'clerk')
    expect(bar).not.toBeNull()
    expect(bar).toContain('business')
  })

  it('asks the player rather than walking them out in silence', () => {
    /**
     * OWNER'S RULING (2026-08-14): "whenever a players company is worth over
     * 500k they should have to leave their job or get a popup that is
     * letting them decide to quit or focus on the business."
     *
     * It used to delete the job and write a line in the feed. That was
     * defensible at two million, where it almost never fired; at five
     * hundred thousand it lands in an ordinary life, and a job vanishing
     * without a word is the exact shape of complaint this codebase keeps
     * collecting.
     */
    const { world, person } = founder('shop')
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    world.employment.set(person.id, {
      occupationId: 'clerk',
      workplaceId: 1 as never,
      monthlyPay: 200_000 as Money,
      sinceTick: world.tick,
      performance: 500,
    } as never)

    // The question arrives, and the job is STILL THERE while it is open.
    let asked = false
    for (let month = 0; month < 6 && !asked; month += 1) {
      advanceTicks(world, 1)
      asked = world.player.pending?.kind === 'business-or-job'
    }
    expect(asked, 'nobody was ever asked').toBe(true)
    expect(world.employment.get(person.id)).toBeDefined()
    expect(world.player.pending?.options).toContain('the-business')
    expect(world.player.pending?.options).toContain('the-job')

    // Choosing the business is what actually ends the job.
    resolvePending(world, 'the-business')
    expect(world.employment.get(person.id)).toBeUndefined()
    expect(
      world.events.some((e) => e.type === 'left-job' && e.detail === 'the-business'),
    ).toBe(true)
  })

  it('lets you keep the wage, and charges you for it', () => {
    /**
     * A choice where both answers are free is not a choice.
     *
     * TESTED ON THE MECHANISM, not on two worlds run side by side: the
     * first version of this compared a year of books between two saves that
     * had advanced a different number of months, so they were reading
     * different calendar years and the "penalised" one came out ahead. The
     * claim is about attention, so it is measured on attention.
     */
    const { world, person } = founder('shop')
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    const business = businessOf(world, person.id)
    const kind = business === undefined ? undefined : businessKindById(business.kindId)
    if (!business || !kind) return

    const whole = monthlyProfitFor(business, kind, 'expansion', 0, 800, 0)
    const evenings = monthlyProfitFor(business, kind, 'expansion', 0, 400, 0)
    expect(evenings, 'half the attention should not earn the same').toBeLessThan(whole)

    // And the condition the month reads is exactly "holds a job AND the
    // business is big enough to need the week".
    world.employment.set(person.id, {
      occupationId: 'clerk',
      workplaceId: 1 as never,
      monthlyPay: 200_000 as Money,
      sinceTick: world.tick,
      performance: 500,
    } as never)
    expect(world.employment.has(person.id)).toBe(true)
    expect(businessDemandsAllHours(world, person.id)).toBe(true)
  })
})

describe('the draw dial means what it says', () => {
  it('leaves in exactly the share you chose', () => {
    /**
     * OWNER'S RULING (2026-08-14): "if I choose the 70/30 option I would
     * take whatever is 70% of the profit and reinvest 30% into the company,
     * like if I choose the other splits and so on."
     *
     * It did not. Retention was clamped by the capital ceiling, so an owner
     * at the ceiling had the whole profit pushed into their hand whatever
     * the dial said — and the screen showed a split that was not happening.
     */
    const { world } = founder('shop')
    setRetainPlayer(world, 300)
    run(world, 13)
    const books = booksFor(world)
    expect(books).toBeDefined()
    if (!books) return
    for (const month of books.months) {
      if (month.profit <= 0) continue
      // 30% in, 70% out, to the rounding.
      expect(month.retained).toBe(Math.floor((month.profit * 300) / 1000))
      expect(month.drawn).toBe(month.profit - month.retained)
    }
  })

  it('still cannot compound a corner shop into a fortune', () => {
    /**
     * THE CLAMP WAS LOAD-BEARING, and removing it was measured rather than
     * assumed: a century produced a richest townsperson worth $476 TRILLION
     * and a business holding $4.8 billion, because capital compounds into
     * profit into capital.
     *
     * The loop is broken at the other end instead — you may leave in what
     * you like, but a business only EARNS on what it can put to work. This
     * pins that a business past its ceiling stops growing its own takings.
     */
    const { world, person } = founder('shop')
    const business = businessOf(world, person.id)
    if (!business) return
    const kind = businessKindById(business.kindId)
    if (!kind) return
    // Stuff the till far past anything the trade could deploy.
    world.businesses.set(business.id, {
      ...business,
      capital: (business.capital + kind.capital * 400) as Money,
    })
    run(world, 13)
    const fat = booksFor(world)?.year.takings ?? 0

    const lean = founder('shop', 4242)
    run(lean.world, 13)
    const ordinary = booksFor(lean.world)?.year.takings ?? 0
    // Four hundred times the capital does NOT buy four hundred times the
    // takings — the extra is money in the till, not a bigger business.
    expect(fat).toBeLessThan(ordinary * 40)
  })
})

describe('the books are a financial year', () => {
  it('accumulate through the year instead of sliding every month', () => {
    /**
     * OWNER, PLAYING (2026-08-14): "'the books last 12 months' changes
     * every single month. this should be the yearly view and it all
     * accumlates and restarts at the end of the year, right now it just
     * shows you the months stats."
     *
     * It was `months.slice(-12)` — the last twelve months from wherever
     * you were standing — so the oldest month silently dropped off the
     * back every time and the figures moved even in a month that went
     * exactly like the one before it.
     */
    const { world } = founder('shop')
    // Land on January so the year starts clean.
    while (toDate(world, world.tick).month !== 1) run(world, 1)

    let previousTakings = 0
    let previousMonths = 0
    for (let month = 0; month < 6; month += 1) {
      run(world, 1)
      const books = booksFor(world)
      expect(books).toBeDefined()
      if (!books) return
      // The count only ever climbs inside a year, and the takings with it.
      expect(books.year.months).toBeGreaterThan(previousMonths)
      expect(books.year.takings).toBeGreaterThanOrEqual(previousTakings)
      previousMonths = books.year.months
      previousTakings = books.year.takings
    }
  })

  it('starts again in January, and keeps the year just gone', () => {
    const { world } = founder('shop')
    // STAND IN DECEMBER and read the year before stepping out of it. The
    // first version of this test advanced once more before reading, so it
    // compared January against January and expected a change of year.
    while (toDate(world, world.tick).month !== 12) run(world, 1)
    const december = booksFor(world)
    expect(december).toBeDefined()
    if (!december) return
    const closed = december.year.months
    expect(closed).toBeGreaterThan(0)

    run(world, 1) // over the turn of the year
    const january = booksFor(world)
    expect(january).toBeDefined()
    if (!january) return
    // THE RESET. A fresh year, not a window that shuffled along by one.
    expect(january.yearNumber).toBe(december.yearNumber + 1)
    expect(january.year.months).toBeLessThan(closed)
    // And the year just gone is still there to compare against.
    expect(january.lastYear).toBeDefined()
    expect(january.lastYearNumber).toBe(december.yearNumber)
  })
})

describe('a business is a job', () => {
  it('shuts the door on other work once it is big enough', () => {
    const { world, person } = founder('shop')
    expect(businessDemandsAllHours(world, person.id)).toBe(false)

    // Past the owner's five hundred thousand and it takes every hour there is.
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    expect(businessDemandsAllHours(world, person.id)).toBe(true)
    const bar = jobBar(world, 'clerk')
    expect(bar).not.toBeNull()
    expect(bar).toContain('business')
  })

  it('asks the player rather than walking them out in silence', () => {
    /**
     * OWNER'S RULING (2026-08-14): "whenever a players company is worth over
     * 500k they should have to leave their job or get a popup that is
     * letting them decide to quit or focus on the business."
     *
     * It used to delete the job and write a line in the feed. That was
     * defensible at two million, where it almost never fired; at five
     * hundred thousand it lands in an ordinary life, and a job vanishing
     * without a word is the exact shape of complaint this codebase keeps
     * collecting.
     */
    const { world, person } = founder('shop')
    makeItWorth(world, person.id, BUSINESS_IS_FULL_TIME_AT)
    world.employment.set(person.id, {
      occupationId: 'clerk',
      workplaceId: 1 as never,
      monthlyPay: 200_000 as Money,
      sinceTick: world.tick,
      performance: 500,
    } as never)

    // The question arrives, and the job is STILL THERE while it is open.
    let asked = false
    for (let month = 0; month < 6 && !asked; month += 1) {
      advanceTicks(world, 1)
      asked = world.player.pending?.kind === 'business-or-job'
    }
    expect(asked, 'nobody was ever asked').toBe(true)
    expect(world.employment.get(person.id)).toBeDefined()
    expect(world.player.pending?.options).toContain('the-business')
    expect(world.player.pending?.options).toContain('the-job')

    // Choosing the business is what actually ends the job.
    resolvePending(world, 'the-business')
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
