/**
 * WHO OWNS THE BUSINESS (the business revamp, owner's ruling 2026-08-13:
 * *"we can do real townspeople but I also wanted to do generated firms"*).
 *
 * THE CLAIMS: the register always accounts for the whole business, however
 * many rounds are sold; a seed backer is a REAL person whose wallet really
 * pays; an institution is a firm from outside the town; every shareholder
 * owns a piece of every month afterwards; a dead backer's stake passes to
 * their children; and a business nobody has backed is untouched by any of
 * it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { walletOf } from '../src/finances.js'
import {
  capTableSums,
  foundingCapTable,
  investmentFor,
  issueShares,
  nextRoundFor,
  privateValuationOf,
  ROUNDS,
  termsFor,
} from '../src/equity.js'
import {
  businessOf,
  expandBusinessPlayer,
  investInBusinessPlayer,
  expansionOffers,
  raiseBar,
  raiseCapitalPlayer,
  setPlayer,
  startBusiness,
} from '../src/player.js'
import {
  EXPANSIONS,
  competitionPerMilleFor,
  marketWeightOf,
  shareOfTradePerMille,
  upliftPerMilleOf,
} from '../src/equity.js'
import { businessKindById, monthlyProfitFor } from '../src/business.js'
import type { Business, Shareholder } from '../src/types.js'

function aBusiness(capital: number): Business {
  return {
    id: 1 as never,
    ownerId: 2 as never,
    kindId: 'shop',
    name: 'A Shop',
    foundedTick: 0 as never,
    capital: capital as Money,
    employees: 0,
    badMonths: 0,
    closedTick: null,
    generations: 0,
  }
}

function aHolder(perMille: number, id = 'x'): Shareholder {
  return {
    id,
    personId: null,
    name: 'Somebody',
    perMille,
    investedCents: 1000 as Money,
    round: 'seed',
    sinceTick: 0 as never,
    boardSeat: false,
    preferencePerMille: 1000,
  }
}

/** A player with a shop, two years of trading behind it, and money. */
function aFounder(seed = 12345) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 45)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
  startBusiness(world, 'shop')
  /**
   * MONTH BY MONTH, CLEARING THE QUESTIONS (the same helper `growth.test.ts`
   * uses, and for the same reason).
   *
   * `advanceTicks` STOPS the moment the world raises a decision, which is
   * correct — and it means asking for twenty-four months in one call can
   * land far fewer. Business moments made that visible: this fixture was
   * quietly getting one year of trading where it asked for two, and three
   * tests failed on gates that were reading the truth.
   */
  for (let month = 0; month < 24; month += 1) {
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  ;(world.player as { pending: unknown }).pending = null
  return { world, person }
}

describe('the share register', () => {
  it('always accounts for the whole business, however many rounds are sold', () => {
    // Dilution that does not sum to a thousand is dilution that quietly
    // creates or destroys ownership. Every round, every time.
    let table = foundingCapTable()
    expect(table.founderPerMille).toBe(1000)
    expect(capTableSums(table)).toBe(true)

    for (const [index, terms] of ROUNDS.entries()) {
      table = issueShares(table, aHolder(terms.perMille, `r${String(index)}`))
      expect(capTableSums(table), `after ${terms.round} the register does not sum`).toBe(true)
      expect(table.founderPerMille).toBeGreaterThanOrEqual(0)
    }
    // And the founder has genuinely been diluted by all of it.
    expect(table.founderPerMille).toBeLessThan(1000)
    expect(table.shareholders).toHaveLength(ROUNDS.length)
  })

  it('dilutes everybody already on it, not just the founder', () => {
    // The first backer's slice shrinks when a second one buys in — that is
    // what dilution is, and sparing them would rob whoever came later.
    const first = aHolder(100, 'first')
    let table = issueShares(foundingCapTable(), first)
    expect(table.shareholders[0]?.perMille).toBe(100)

    table = issueShares(table, aHolder(200, 'second'))
    expect(table.shareholders[0]?.perMille).toBeLessThan(100)
    expect(table.shareholders[1]?.perMille).toBe(200)
    expect(capTableSums(table)).toBe(true)
  })

  it('prices a slice off what the business is actually worth', () => {
    const seed = termsFor('seed')
    expect(seed).toBeDefined()
    if (!seed) return
    expect(investmentFor(1_000_000 as Money, seed)).toBe(100_000)
    // Nothing earning is worth nothing, and cannot be sold.
    expect(investmentFor(0 as Money, seed)).toBe(1)
  })

  it('offers the rounds in order and then stops', () => {
    let table = foundingCapTable()
    const seen: string[] = []
    for (let i = 0; i < ROUNDS.length; i += 1) {
      const next = nextRoundFor(table)
      expect(next).toBeDefined()
      if (!next) break
      seen.push(next.round)
      table = issueShares(table, { ...aHolder(next.perMille, next.round), round: next.round })
    }
    expect(seen).toEqual(ROUNDS.map((r) => r.round))
    expect(nextRoundFor(table)).toBeUndefined()
  })
})

describe('raising money against a real business', () => {
  it('takes a seed backer’s money out of their own wallet, to the cent', () => {
    /**
     * THE OWNER'S RULING, AS A TEST. A seed round is a person in this town
     * — not a faceless fund — and the money is really theirs. If the
     * business gains capital nobody paid for, the round is a cheat.
     */
    const { world } = aFounder()
    expect(raiseBar(world)).toBeNull()
    const business = businessOf(world, world.player.personId as never)
    expect(business).toBeDefined()
    if (!business) return

    const capitalBefore = business.capital
    const before = new Map(
      [...world.people.values()].map((p) => {
        const w = walletOf(world, p.id)
        return [p.id, w.checking + w.savings]
      }),
    )

    expect(raiseCapitalPlayer(world).done).toBe(true)

    const table = world.capTables.get(business.id)
    expect(table).toBeDefined()
    if (!table) return
    expect(capTableSums(table)).toBe(true)

    const backer = table.shareholders[0]
    expect(backer).toBeDefined()
    if (!backer) return
    // A REAL PERSON, and their money moved.
    expect(backer.personId).not.toBeNull()
    if (backer.personId === null) return
    const after = walletOf(world, backer.personId)
    const paid = (before.get(backer.personId) ?? 0) - (after.checking + after.savings)
    expect(paid).toBe(backer.investedCents)
    // And the business is richer by exactly what they put in.
    expect((world.businesses.get(business.id)?.capital ?? 0) - capitalBefore).toBe(
      backer.investedCents,
    )
  })

  it('will not price a business with no trading behind it', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 30 * 12)
    const person = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 30)
      .sort((a, b) => a.id - b.id)[0]
    if (!person) return
    setPlayer(world, person.id)
    const wallet = walletOf(world, person.id)
    world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
    startBusiness(world, 'shop')
    // Opened this month: nobody backs that.
    expect(raiseBar(world)).toContain('Too new')
  })

  it('leaves a business nobody backed wholly its founder’s', () => {
    // The whole system is opt-in. A trade that never sells a share never
    // acquires a register, and the monthly draw is untouched by any of it.
    const { world, person } = aFounder()
    const business = businessOf(world, person.id)
    expect(business).toBeDefined()
    if (!business) return
    expect(world.capTables.has(business.id)).toBe(false)
    expect(privateValuationOf(world, business)).toBeGreaterThan(0)
  })
})

describe('growing beyond the four walls', () => {
  it('asks for years at the wheel before each rung, and says how many', () => {
    // The ladder is climbed in order and the refusals are honest about
    // what is missing — a business two years old is not held back by
    // ambition, it is held back by having nothing yet to grow.
    const { world } = aFounder()
    const offers = expansionOffers(world)
    expect(offers).toHaveLength(EXPANSIONS.length)

    const location = offers.find((o) => o.terms.kind === 'location')
    const franchise = offers.find((o) => o.terms.kind === 'franchise')
    expect(location?.bar, 'two years should be enough for a second place').toBeNull()
    expect(franchise?.bar, 'five years is not two').toContain('5 years')
  })

  it('costs real money and makes the month bigger, once', () => {
    const { world, person } = aFounder()
    const business = businessOf(world, person.id)
    expect(business).toBeDefined()
    if (!business) return
    const kind = businessKindById(business.kindId)
    if (!kind) return

    // THE TILL PAYS, so the business needs enough in it first.
    expect(investInBusinessPlayer(world, 40_000_000).done).toBe(true)
    const funded = businessOf(world, person.id)
    if (!funded) return
    const tillBefore = funded.capital
    const earnBefore = monthlyProfitFor(funded, kind, 'expansion', 40, 600, 0, 2005, 0, 0)

    expect(expandBusinessPlayer(world, 'location').done).toBe(true)

    const uplift = upliftPerMilleOf(world.expansions.get(business.id))
    expect(uplift).toBeGreaterThan(0)
    const earnAfter = monthlyProfitFor(funded, kind, 'expansion', 40, 600, 0, 2005, 0, uplift)
    expect(earnAfter).toBeGreaterThan(earnBefore)

    // Paid out of the BUSINESS, which is the whole separation.
    const paid = tillBefore - (businessOf(world, person.id)?.capital ?? 0)
    expect(paid).toBe(world.expansions.get(business.id)?.[0]?.costCents)

    // And it cannot be bought twice.
    expect(expandBusinessPlayer(world, 'location').done).toBe(false)
  })

  it('adds rungs together rather than compounding them', () => {
    // Three ways of growing make a business three times bigger, not eight.
    // Compounding is how a shop quietly becomes worth more than its town.
    const list = EXPANSIONS.map((terms, index) => ({
      kind: terms.kind,
      name: terms.title,
      sinceTick: 0 as never,
      costCents: 1 as Money,
      upliftPerMille: terms.upliftPerMille,
      index,
    }))
    const total = upliftPerMilleOf(list)
    expect(total).toBe(EXPANSIONS.reduce((sum, t) => sum + t.upliftPerMille, 0))
  })
})

describe('the market a business trades in', () => {
  it('divides the town’s custom rather than inventing customers', () => {
    /**
     * THE BUG IN THE SUPPLIED DESIGN, AS A TEST. It computed each
     * business's share on its own and never normalised, so the shares of a
     * trade did not add up to the trade — a market that invents customers.
     * Here a share is a business's weight over everybody's, so they sum to
     * the whole by construction and one shop winning IS another losing.
     */
    const weights = [300, 200, 100, 400]
    const shares = weights.map((w) => shareOfTradePerMille(w, weights))
    expect(shares.reduce((sum, s) => sum + s, 0)).toBe(1000)
    // The biggest weight takes the biggest share.
    expect(Math.max(...shares)).toBe(shares[3])
  })

  it('leaves a business alone in its trade completely alone', () => {
    expect(shareOfTradePerMille(50, [50])).toBe(1000)
    expect(competitionPerMilleFor(1000, 0)).toBe(0)
  })

  it('rewards the leader and punishes the laggard', () => {
    // The supplied formula peaked at exactly the market average, so ANY
    // deviation lost you share and undercutting was strictly a mistake.
    const leader = competitionPerMilleFor(700, 1)
    const laggard = competitionPerMilleFor(300, 1)
    expect(leader).toBeGreaterThan(0)
    expect(laggard).toBeLessThan(0)
    // An even split of a crowded trade is neither reward nor punishment.
    expect(competitionPerMilleFor(200, 4)).toBe(0)
  })

  it('counts staff and growth as strength, not just money', () => {
    const bare = { ...aBusiness(1_000_000), kindId: 'shop' }
    const alone = marketWeightOf(bare, 0, 0)
    expect(marketWeightOf(bare, 3, 0)).toBeGreaterThan(alone)
    expect(marketWeightOf(bare, 0, 550)).toBeGreaterThan(alone)
    // A closed business is no competition to anybody.
    expect(marketWeightOf({ ...bare, closedTick: 1 as never }, 5, 500)).toBe(0)
  })
})
