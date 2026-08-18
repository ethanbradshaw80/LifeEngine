/**
 * TAKEOVERS (owner, 2026-08-13: "is there a thing where If someone has so
 * much money that they can just buy up all the shares of a stock and do a
 * takeover? or own a certain percentage? isnt that a thing in real life").
 *
 * THE CLAIMS: how much of a company you hold is a number the game knows
 * and can say out loud; a quarter blocks and a half controls; the price
 * runs away from you as you buy, so control costs MORE than the market
 * capitalisation and is a decision rather than arithmetic; and the money
 * comes out of the same wallet everything else does.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { accountsOf, walletOf } from '../src/finances.js'
import {
  BLOCKING_STAKE_PER_MILLE,
  CONTROL_STAKE_PER_MILLE,
  controlPremiumPerMille,
  costToReachPerMille,
  marketCapOf,
  priceToBuyerOf,
  stakePerMilleOf,
  stakeWords,
  stockById,
} from '../src/market.js'
import {
  setPlayer,
  stakesOf,
  startBusiness,
  takeStakePlayer,
  takeoverBar,
} from '../src/player.js'

/** A player with more money than sense, and a market to spend it in. */
function aBuyer(seed = 4242) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 25 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 50)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000_000 as Money })
  ;(world.player as { pending: unknown }).pending = null
  const stockId = Object.keys(world.stockPrices).sort()[0]
  if (stockId === undefined) throw new Error('no listings')
  return { world, person, stockId }
}

describe('how much of it you hold', () => {
  it('is a number the game knows, and it did not before', () => {
    /**
     * THE WHOLE COMPLAINT AS A TEST. Every stock has always carried
     * `sharesOutstanding` and every holding its `units`, and nothing
     * anywhere divided one by the other — a player could own nine tenths
     * of a company and the game would not notice.
     */
    const { world, person, stockId } = aBuyer()
    expect(stakePerMilleOf(world, accountsOf(world, person.id).holdings, stockId)).toBe(0)
    expect(stakesOf(world)).toHaveLength(0)

    expect(takeStakePlayer(world, stockId, 120).done).toBe(true)
    const held = stakePerMilleOf(world, accountsOf(world, person.id).holdings, stockId)
    expect(held).toBeGreaterThanOrEqual(100)

    const view = stakesOf(world).find((entry) => entry.stockId === stockId)
    expect(view).toBeDefined()
    expect(view?.perMille).toBe(held)
    expect(view?.controlling).toBe(false)
  })

  it('has words for what a stake of that size actually is', () => {
    expect(stakeWords(0)).toBe('nothing')
    expect(stakeWords(50)).toBe('a small holding')
    expect(stakeWords(150)).toBe('a significant holding')
    expect(stakeWords(BLOCKING_STAKE_PER_MILLE)).toBe('a blocking stake')
    expect(stakeWords(CONTROL_STAKE_PER_MILLE)).toBe('a controlling stake')
    expect(stakeWords(900)).toBe('a controlling stake')
  })
})

describe('the price runs away from you', () => {
  it('charges nothing extra for a small holding and a great deal for control', () => {
    // Below a tenth nobody has noticed you are buying.
    expect(controlPremiumPerMille(0)).toBe(0)
    expect(controlPremiumPerMille(99)).toBe(0)
    // Past that it rises, and keeps rising.
    expect(controlPremiumPerMille(250)).toBeGreaterThan(0)
    expect(controlPremiumPerMille(500)).toBeGreaterThan(controlPremiumPerMille(250))
    expect(controlPremiumPerMille(900)).toBeGreaterThan(controlPremiumPerMille(500) * 2)
  })

  it('makes the last tenth dearer than the first', () => {
    const { world, stockId } = aBuyer()
    const first = costToReachPerMille(world, stockId, 0, 100)
    const last = costToReachPerMille(world, stockId, 900, 1000)
    expect(first).toBeGreaterThan(0)
    expect(last, 'buying the tail of a company should hurt').toBeGreaterThan(first * 2)
  })

  it('costs more than the market capitalisation to take the lot', () => {
    /**
     * THE POINT OF THE WHOLE MECHANISM. A takeover priced at exactly the
     * market cap would be arithmetic — anybody with the money would simply
     * do it, and there would be no decision in it anywhere.
     */
    const { world, stockId } = aBuyer()
    const stock = stockById(world, stockId)
    expect(stock, 'the listing has to exist for this to mean anything').toBeDefined()
    if (!stock) return
    /**
     * READ THE CAPITALISATION FROM THE ENGINE'S OWN FUNCTION.
     *
     * The first version of this test computed it by hand — and made the
     * SAME unit mistake the code under test had made, so a whole company
     * priced at a hundredth of its worth sailed through green. A probe
     * caught it. Compare against the simulation's own arithmetic or the
     * test is only checking that you can repeat yourself.
     */
    const marketCap = marketCapOf(world, stock)
    expect(marketCap).toBeGreaterThan(0)
    const everything = costToReachPerMille(world, stockId, 0, 1000)
    expect(everything).toBeGreaterThan(marketCap)
    // And not absurdly so — a takeover has to stay reachable to be a
    // decision. Measured at 1.35x across the listings.
    expect(everything).toBeLessThan(marketCap * 3)
  })

  it('quotes a dearer share to somebody who already holds a lot of it', () => {
    const { world, stockId } = aBuyer()
    expect(priceToBuyerOf(world, stockId, 600)).toBeGreaterThan(priceToBuyerOf(world, stockId, 0))
  })
})

describe('buying your way to control', () => {
  it('takes the money out of the wallet, to the cent', () => {
    // H0: liquid money lives on the wallet holder's record, and a takeover
    // is not exempt from that.
    const { world, person, stockId } = aBuyer()
    const before = walletOf(world, person.id).savings
    const result = takeStakePlayer(world, stockId, CONTROL_STAKE_PER_MILLE)
    expect(result.done).toBe(true)
    const after = walletOf(world, person.id).savings
    expect(after).toBeLessThan(before)

    /**
     * THE FIGURE IT REPORTS IS THE FIGURE IT TOOK, to the cent.
     *
     * "Less than before" is the assertion that lets a shadow ledger
     * through — this codebase has now had that bug six times, most
     * recently when paying off a mortgage moved nothing at all. The
     * sentence the player reads is checked against the money that
     * actually left the wallet.
     */
    const said = Number((result.reason.match(/\$([\d,]+\.\d\d)/)?.[1] ?? '0').replace(/,/g, ''))
    expect(said).toBeGreaterThan(0)
    expect(Math.round(said * 100)).toBe(before - after)

    const held = stakePerMilleOf(world, accountsOf(world, person.id).holdings, stockId)
    expect(held).toBeGreaterThanOrEqual(CONTROL_STAKE_PER_MILLE)
    // And the player is TOLD, rather than being sent back to the screen in
    // silence (owner: "make sure when we click on something... it actually
    // reports feedback back").
    expect(result.reason).toContain('%')
  })

  it('records the moment control changed hands', () => {
    const { world, person, stockId } = aBuyer()
    takeStakePlayer(world, stockId, CONTROL_STAKE_PER_MILLE)
    const taken = world.events.filter(
      (event) => event.type === 'took-control' && event.subjectId === person.id,
    )
    expect(taken.length).toBe(1)
  })

  it('refuses when the money is not there, and says so plainly', () => {
    const { world, person, stockId } = aBuyer()
    const wallet = walletOf(world, person.id)
    world.accounts.set(wallet.personId, { ...wallet, savings: 1_000 as Money })
    const bar = takeoverBar(world, stockId, CONTROL_STAKE_PER_MILLE)
    expect(bar).not.toBeNull()
    expect(bar).toContain('savings')
    // THE BAR AND THE VERB READ THE SAME FUNCTION, so a greyed row and a
    // refusal can never disagree.
    expect(takeStakePlayer(world, stockId, CONTROL_STAKE_PER_MILLE).done).toBe(false)
  })

  it('will not sell you what you already have', () => {
    const { world, stockId } = aBuyer()
    takeStakePlayer(world, stockId, 300)
    expect(takeoverBar(world, stockId, 100)).toContain('already')
  })
})

describe('somebody comes for what you floated', () => {
  it('lets the richest person in town build a stake in the player’s company', () => {
    /**
     * THE HALF THAT MAKES IT A STORY (owner: "isnt that a thing in real
     * life"). The same arc pointed the other way — and the reason to keep
     * a holding after the bell instead of selling the lot.
     */
    const { world, person, stockId } = aBuyer()
    // A business of the player's, on the exchange.
    startBusiness(world, 'shop')
    ;(world.player as { pending: unknown }).pending = null
    const business = [...world.businesses.values()].find((b) => b.ownerId === person.id)
    expect(business).toBeDefined()
    if (!business) return
    world.businesses.set(business.id, { ...business, listedStockId: stockId })

    // Somebody in town with the money to act on it.
    const rival = livingPeople(world)
      .filter((p) => p.id !== person.id && ageAt(p.birthTick, world.tick) >= 30)
      .sort((a, b) => a.id - b.id)[0]
    expect(rival).toBeDefined()
    if (!rival) return
    const purse = walletOf(world, rival.id)
    world.accounts.set(purse.personId, { ...purse, savings: 800_000_000_000 as Money })

    const before = stakePerMilleOf(world, accountsOf(world, rival.id).holdings, stockId)
    // A year is enough for the one pass a year to come round.
    for (let month = 0; month < 14; month += 1) {
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
    }
    const after = stakePerMilleOf(world, accountsOf(world, rival.id).holdings, stockId)
    expect(after, 'nobody came for it').toBeGreaterThan(before)

    // And if they got past half, BOTH sides of that moment are on the
    // record — it happened to two people.
    if (after >= CONTROL_STAKE_PER_MILLE) {
      expect(world.events.some((e) => e.type === 'lost-control' && e.subjectId === person.id)).toBe(
        true,
      )
      expect(world.events.some((e) => e.type === 'took-control')).toBe(true)
    }
  })

  it('never lets the player’s own household be the raider', () => {
    /**
     * THE BUG THAT BROKE THE TEST ABOVE, pinned on its own so it cannot come
     * back quietly.
     *
     * The pass reads the WALLET to pick the richest person in town, which is
     * right — a married couple raid from one purse. But the player's spouse
     * draws on the PLAYER'S wallet, so with a rich player the richest
     * non-player in town was reliably somebody in the player's own house.
     * Measured at seed 4242: it picked person 156, wallet holder 36 — the
     * player — already holding the whole company. The player bought their own
     * company from themselves, no money left the household, and the 100 per
     * cent holding made the pass `continue` every year after, so no genuine
     * rival ever got near it.
     */
    const { world, person, stockId } = aBuyer()
    startBusiness(world, 'shop')
    ;(world.player as { pending: unknown }).pending = null
    const business = [...world.businesses.values()].find((b) => b.ownerId === person.id)
    expect(business).toBeDefined()
    if (!business) return
    world.businesses.set(business.id, { ...business, listedStockId: stockId })

    const playerPurse = walletOf(world, person.id).personId
    for (let month = 0; month < 14; month += 1) {
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
    }

    // Nobody drawing on the player's own wallet may hold a slice of the
    // player's own float that they did not buy themselves.
    for (const other of livingPeople(world)) {
      if (other.id === person.id) continue
      if (walletOf(world, other.id).personId !== playerPurse) continue
      expect(
        stakePerMilleOf(world, accountsOf(world, other.id).holdings, stockId),
        `${String(other.id)} raided the player's company out of the player's own purse`,
      ).toBe(0)
    }
  })
})
