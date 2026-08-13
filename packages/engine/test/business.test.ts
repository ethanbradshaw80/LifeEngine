/**
 * M-CAREER §5. Working for yourself.
 *
 * THE ACCEPTANCE TARGET THE SPEC NAMES: business owners both succeed and
 * fail. Plus the claims that make it a business rather than a second wage —
 * real capital that is genuinely gone, a direct line to the economy, and a
 * thing that passes down.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { accountsOf, moneyOnHand, openBusiness } from '../src/finances.js'
import { atTodaysPrices } from '../src/economy.js'
import {
  BUSINESS_FAILS_AFTER,
  BUSINESS_KINDS,
  businessBar,
  businessHealthWords,
  businessKindById,
  businessNameFor,
  kindAvailableIn,
  kindDemandPerMille,
  monthlyProfitFor,
} from '../src/business.js'
import type { Business } from '../src/types.js'

function aBusiness(capital: number): Business {
  return {
    id: 1 as never,
    ownerId: 2 as never,
    kindId: 'workshop',
    name: 'Test & Co.',
    foundedTick: 0 as Tick,
    capital: capital as Money,
    employees: 0,
    badMonths: 0,
    closedTick: null,
    generations: 0,
  }
}

describe('the trades you can go into', () => {
  it('cost more and return less the bigger they are', () => {
    let lastCapital = -1
    let lastReturn = 10_000
    for (const kind of [...BUSINESS_KINDS].sort((a, b) => a.capital - b.capital)) {
      expect(kind.capital).toBeGreaterThan(lastCapital)
      // A small trade returns a lot on very little; a shop returns less on
      // far more, and the absolute money is the other way round.
      expect(kind.returnPerMille).toBeLessThanOrEqual(lastReturn)
      lastCapital = kind.capital
      lastReturn = kind.returnPerMille
    }
  })

  it('refuse in plain words when they cannot be opened', () => {
    const kind = businessKindById('shop')
    expect(businessBar(undefined, 0 as Money, 0 as Money, false, 40)).toContain('No such trade')
    expect(businessBar(kind, 0 as Money, 100 as Money, false, 12)).toContain('eighteen')
    expect(businessBar(kind, 999_999_999 as Money, 100 as Money, true, 40)).toContain('already')
    expect(businessBar(kind, 100 as Money, 500_000 as Money, false, 40)).toContain('dollars to open')
    expect(businessBar(kind, 999_999 as Money, 500_000 as Money, false, 40)).toBeNull()
  })

  it('only exist inside their own era, and the refusal says which', () => {
    /**
     * THE OWNER'S RULING (2026-08-13): "businesses should be able to
     * populate over the years so if SaaS isn't in 1970 just make it
     * available only after a certain year." Both ends of the window, and
     * the refusal has to name the year or the player is guessing.
     */
    const software = businessKindById('software-company')
    const video = businessKindById('video-rental')
    const shop = businessKindById('shop')
    expect(software).toBeDefined()
    expect(video).toBeDefined()
    if (!software || !video || !shop) return

    // Not yet invented.
    expect(kindAvailableIn(software, 1970)).toBe(false)
    expect(kindAvailableIn(software, 2010)).toBe(true)
    // Had its day.
    expect(kindAvailableIn(video, 1980)).toBe(false)
    expect(kindAvailableIn(video, 1990)).toBe(true)
    expect(kindAvailableIn(video, 2015)).toBe(false)
    // A trade with no era is always open.
    expect(kindAvailableIn(shop, 1970)).toBe(true)
    expect(kindAvailableIn(shop, 2120)).toBe(true)

    // And the bar SAYS so, with the year in it.
    const tooEarly = businessBar(software, 999_999_999 as Money, 100 as Money, false, 40, 1975)
    expect(tooEarly).toContain('2002')
    const tooLate = businessBar(video, 999_999_999 as Money, 100 as Money, false, 40, 2015)
    expect(tooLate).toContain('2007')
    // In its own year it opens like anything else.
    expect(businessBar(video, 999_999_999 as Money, 100 as Money, false, 40, 1990)).toBeNull()
    // A caller that passes no year keeps the old four answers exactly.
    expect(businessBar(software, 999_999_999 as Money, 100 as Money, false, 40)).toBeNull()
  })

  it('lets a retiring trade fade over a decade rather than closing overnight', () => {
    // Law 7: the last video shop in town grinds down while its owner
    // decides what to do. It does not evaporate the morning the world
    // changed, and it never quite reaches zero.
    const video = businessKindById('video-rental')
    if (!video) return
    expect(kindDemandPerMille(video, 2000)).toBe(1000)
    expect(kindDemandPerMille(video, 2007)).toBe(1000)
    const oneYearOn = kindDemandPerMille(video, 2008)
    const fiveYearsOn = kindDemandPerMille(video, 2012)
    expect(oneYearOn).toBeLessThan(1000)
    expect(fiveYearsOn).toBeLessThan(oneYearOn)
    expect(kindDemandPerMille(video, 2030)).toBe(200)
    // A trade with no end never fades.
    const shop = businessKindById('shop')
    if (shop) expect(kindDemandPerMille(shop, 2120)).toBe(1000)
  })

  it('are named for the family that owns them, and never for a real firm', () => {
    for (const pick of [0, 1, 2, 3, 4, 99]) {
      expect(businessNameFor('Whitlock', 'shop', pick)).toContain('Whitlock')
    }
    expect(businessNameFor('Baldwin', 'freelance', 0)).toContain('Baldwin')
  })
})

describe('a month of trading', () => {
  it('can lose money, which is the whole difference from a wage', () => {
    const kind = businessKindById('workshop')
    expect(kind).toBeDefined()
    if (!kind) return
    const business = aBusiness(1_000_000)
    const best = monthlyProfitFor(business, kind, 'expansion', 25, 900, 980)
    const worst = monthlyProfitFor(business, kind, 'depression', -30, 100, -980)
    expect(best).toBeGreaterThan(0)
    expect(worst).toBeLessThan(0)
    expect(Number.isInteger(best)).toBe(true)
    expect(Number.isInteger(worst)).toBe(true)
  })

  it('is worth more in a boom than in a slump, on the same hand', () => {
    const kind = businessKindById('shop')
    if (!kind) return
    const business = aBusiness(3_000_000)
    const boom = monthlyProfitFor(business, kind, 'expansion', 25, 600, 0)
    const slump = monthlyProfitFor(business, kind, 'recession', -20, 600, 0)
    expect(boom).toBeGreaterThan(slump)
  })

  it('is worth more in a good pair of hands', () => {
    const kind = businessKindById('market-stall')
    if (!kind) return
    const business = aBusiness(300_000)
    expect(monthlyProfitFor(business, kind, 'expansion', 5, 900, 0)).toBeGreaterThan(
      monthlyProfitFor(business, kind, 'expansion', 5, 200, 0),
    )
  })

  it('says how it is going, in words', () => {
    expect(businessHealthWords(aBusiness(100))).toBe('trading')
    expect(businessHealthWords({ ...aBusiness(100), badMonths: 1 })).toBe('a bad month')
    expect(businessHealthWords({ ...aBusiness(100), badMonths: 2 })).toBe('in trouble')
    expect(businessHealthWords({ ...aBusiness(100), closedTick: 5 as Tick })).toBe('closed')
    expect(BUSINESS_FAILS_AFTER).toBe(3)
  })
})

describe('opening one', () => {
  it('takes the capital out of their own money, and it is gone', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 240)
    const kind = businessKindById('market-stall')
    if (!kind) return
    const capital = atTodaysPrices(world, kind.capital) as Money
    const owner = [...world.people.values()]
      .filter((p) => p.deathTick === null)
      .sort((a, b) => moneyOnHand(world, b.id) - moneyOnHand(world, a.id))[0]
    expect(owner).toBeDefined()
    if (!owner) return

    const before = moneyOnHand(world, owner.id)
    if (before < capital) return // this seed produced nobody who could
    expect(openBusiness(world, world.tick as Tick, owner.id, 'market-stall', capital)).toBe(true)
    expect(moneyOnHand(world, owner.id)).toBe(before - capital)

    const business = [...world.businesses.values()].find(
      (entry) => entry.ownerId === owner.id && entry.kindId === 'market-stall',
    )
    expect(business?.capital).toBe(capital)
    expect(business?.closedTick).toBeNull()
    expect(world.events.some((e) => e.type === 'opened-business')).toBe(true)
    // And a cause on the record, like every other defining choice.
    expect(
      world.causalRecords.some((r) => r.subjectId === owner.id && r.chosen.startsWith('opened ')),
    ).toBe(true)
  })

  it('refuses when the money is not there', () => {
    const world = createWorld(makeSeed(4141), 100)
    const person = [...world.people.values()][0]
    if (!person) return
    world.accounts.set(person.id, {
      ...accountsOf(world, person.id),
      savings: 0 as Money,
      checking: 0 as Money,
    })
    expect(openBusiness(world, world.tick as Tick, person.id, 'shop', 9_999_999 as Money)).toBe(false)
  })
})

describe('over a lifetime of the town', () => {
  it('sees owners both succeed and fail', () => {
    // THE SPEC'S OWN ACCEPTANCE TARGET, measured across three seeds and
    // seventy-five years: 89 businesses opened, 37 closed, 58 per cent
    // surviving, the failures with a median life of seventeen years. The
    // first setting had a 93 per cent survival rate, which no small trade
    // has ever had.
    let opened = 0
    let closed = 0
    let trading = 0
    for (const seedValue of [12345, 4141, 777]) {
      const world = createWorld(makeSeed(seedValue), 100)
      advanceTicks(world, 900)
      for (const event of world.events) {
        if (event.type === 'opened-business') opened++
        if (event.type === 'business-closed') closed++
      }
      for (const business of world.businesses.values()) {
        if (business.closedTick === null) trading++
      }
    }
    expect(opened, 'nobody in town ever went into business').toBeGreaterThan(20)
    expect(closed, 'no business ever failed').toBeGreaterThan(5)
    expect(trading, 'every business failed').toBeGreaterThan(5)
    const survival = (trading / opened) * 100
    expect(survival).toBeGreaterThan(30)
    expect(survival).toBeLessThan(85)
  })

  it('hands one down rather than closing it, where there is an heir', () => {
    let inherited = 0
    for (const seedValue of [12345, 4141, 777]) {
      const world = createWorld(makeSeed(seedValue), 100)
      advanceTicks(world, 900)
      for (const event of world.events) {
        if (event.type === 'inherited-business') inherited++
      }
      for (const business of world.businesses.values()) {
        // Whoever holds it is alive, or it is shut. A business owned by a
        // dead man for forty years would be a leak.
        if (business.closedTick !== null) continue
        expect(world.people.get(business.ownerId)?.deathTick ?? null).toBeNull()
      }
    }
    expect(inherited, 'no business ever passed to a child').toBeGreaterThan(0)
  })

  it('keeps every balance an integer', () => {
    const world = createWorld(makeSeed(777), 100)
    advanceTicks(world, 600)
    for (const business of world.businesses.values()) {
      expect(Number.isInteger(business.capital)).toBe(true)
      expect(business.capital).toBeGreaterThanOrEqual(0)
    }
  })
})
