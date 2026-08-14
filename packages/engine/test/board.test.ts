/**
 * THE BOARDROOM (owner, playing, 2026-08-14: "Never got any board memeber
 * moments eithers wild having any percentage of stock in a company, never
 * got board member moments when we sold off our own stake in the company
 * either").
 *
 * THE CLAIMS: a blocking stake actually brings a question; below it nothing
 * arrives; control decides the vote and a blocking stake only tips it; the
 * answer moves the share price and sometimes turns the whole holding into
 * money; and selling down through a threshold is a moment rather than a
 * silent change of number.
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
  stakePerMilleOf,
} from '../src/market.js'
import {
  BOARD_MATTERS,
  boardMatterById,
  hasBoardSeat,
  offerFor,
  priceAfter,
  voteCarries,
} from '../src/board.js'
import { resolvePending, sellSharesPlayer, setPlayer, takeStakePlayer } from '../src/player.js'

/** A player rich enough to buy a seat at any table in town. */
function aShareholder(seed = 4242) {
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

/** Run months one at a time, clearing anything that is not a board vote. */
function runUntilBoardVote(world: ReturnType<typeof createWorld>, months: number): boolean {
  for (let i = 0; i < months; i += 1) {
    const pending = world.player.pending
    if (pending !== null && pending.kind === 'board-vote') return true
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  return world.player.pending?.kind === 'board-vote'
}

describe('a seat at the table', () => {
  it('opens at a blocking stake and not before', () => {
    expect(hasBoardSeat(0)).toBe(false)
    expect(hasBoardSeat(BLOCKING_STAKE_PER_MILLE - 1)).toBe(false)
    expect(hasBoardSeat(BLOCKING_STAKE_PER_MILLE)).toBe(true)
    expect(hasBoardSeat(CONTROL_STAKE_PER_MILLE)).toBe(true)
  })

  it('actually sends a question to somebody who holds a quarter of a company', () => {
    /**
     * THE COMPLAINT, AS A TEST. Every piece of this existed — seats on the
     * cap table, a board view, a pending-decision system — and no path
     * connected a shareholding to a question. This is that path.
     */
    const { world, stockId } = aShareholder()
    expect(takeStakePlayer(world, stockId, BLOCKING_STAKE_PER_MILLE).done).toBe(true)
    expect(runUntilBoardVote(world, 26), 'no board ever asked anything').toBe(true)

    const pending = world.player.pending
    expect(pending?.kind).toBe('board-vote')
    // It names a real matter and a real company, and offers two ways to vote.
    const [matterId, votedOn] = (pending?.occupationId ?? '').split(':')
    expect(boardMatterById(matterId ?? '')).toBeDefined()
    expect(votedOn).toBe(stockId)
    expect(pending?.options).toHaveLength(2)
  })

  it('sends nothing at all to a small holder', () => {
    // Below the threshold the company does not have to care what you think,
    // and pestering a passive investor with votes would be noise.
    const { world } = aShareholder()
    expect(runUntilBoardVote(world, 26)).toBe(false)
  })
})

describe('the vote', () => {
  it('is simply yours past control, and only a nudge below it', () => {
    const matter = BOARD_MATTERS[0]
    expect(matter).toBeDefined()
    if (!matter) return
    // Control carries whatever you want, however the room leans.
    expect(voteCarries(CONTROL_STAKE_PER_MILLE, true, 0)).toBe(true)
    expect(voteCarries(CONTROL_STAKE_PER_MILLE, false, 1000)).toBe(true)
    // A blocking stake tips a close room and cannot force a hostile one.
    expect(voteCarries(BLOCKING_STAKE_PER_MILLE, true, 400)).toBe(true)
    expect(voteCarries(BLOCKING_STAKE_PER_MILLE, true, 100)).toBe(false)
  })

  it('moves the share price on what the meeting decided', () => {
    const { world, stockId } = aShareholder()
    takeStakePlayer(world, stockId, CONTROL_STAKE_PER_MILLE)
    expect(runUntilBoardVote(world, 26)).toBe(true)
    const pending = world.player.pending
    if (!pending) return
    const [matterId] = (pending.occupationId ?? '').split(':')
    const matter = boardMatterById(matterId ?? '')
    if (!matter) return

    const before = world.stockPrices[stockId] ?? 10_000
    const heldBefore = stakePerMilleOf(world, accountsOf(world, world.player.personId as never).holdings, stockId)
    expect(heldBefore).toBeGreaterThanOrEqual(CONTROL_STAKE_PER_MILLE)

    // Back it. With control, backing it is what happens.
    resolvePending(world, matter.options[0])
    const after = world.stockPrices[stockId] ?? 10_000

    if (matter.paysOut === true) {
      // A bid taken: the holding became money and the shares are gone.
      const held = stakePerMilleOf(world, accountsOf(world, world.player.personId as never).holdings, stockId)
      expect(held).toBe(0)
    } else if (matter.backedPerMille !== 0) {
      expect(after).not.toBe(before)
      expect(after > before).toBe(matter.backedPerMille > 0)
    }
    // And it is on the record either way.
    expect(world.events.some((event) => event.type === 'board-voted')).toBe(true)
  })

  it('prices a bid above the market, which is what makes it a bid', () => {
    expect(offerFor(1_000_000 as Money, 280)).toBe(1_280_000)
    expect(offerFor(1_000_000 as Money, 0)).toBe(1_000_000)
    // And a price move never takes a share to nothing.
    expect(priceAfter(10_000, -2000)).toBeGreaterThan(0)
    expect(priceAfter(10_000, 100)).toBe(11_000)
  })
})

describe('selling down what you built', () => {
  it('tells you when the seat is gone, instead of changing a number in silence', () => {
    const { world, stockId } = aShareholder()
    takeStakePlayer(world, stockId, CONTROL_STAKE_PER_MILLE)
    ;(world.player as { pending: unknown }).pending = null

    const result = sellSharesPlayer(world, stockId, false)
    expect(result.done).toBe(true)
    // Selling the lot crosses BOTH thresholds; the loss of control is the
    // one worth saying out loud.
    expect(result.reason).toContain('no longer control')
    expect(
      world.events.some((event) => event.type === 'left-the-board'),
      'leaving a board is a thing that happened to somebody',
    ).toBe(true)
  })

  it('says what came back, which it never used to', () => {
    // The verb returned an empty string on success, so a sale reported
    // nothing at all — the same silence the business verbs had.
    const { world, stockId } = aShareholder()
    takeStakePlayer(world, stockId, 120)
    const result = sellSharesPlayer(world, stockId, false)
    expect(result.done).toBe(true)
    expect(result.reason).toContain('back')
  })
})
