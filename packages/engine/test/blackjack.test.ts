import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import {
  cardAt,
  cardValue,
  dealerFinish,
  decodeHand,
  encodeHand,
  handTotal,
  hitHand,
  openingHand,
  settleHand,
} from '../src/casino.js'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import { gamblerOf } from '../src/casino.js'
import { dealBlackjack, resolvePending, setPlayer } from '../src/player.js'
import type { Money } from '@life-engine/shared'

/**
 * A HAND OF BLACKJACK THAT ACTUALLY EXISTS.
 *
 * The owner, playing: "there is no popup for when you do blackjack, you
 * should enter the room choose what you bet then a hand comes out and you
 * play blackjack".
 *
 * What was there offered Stand / Hit / Double as three buttons, each of
 * which resolved a WHOLE HAND from its own label. No cards existed anywhere
 * in the model — you picked a strategy and were told how it went.
 *
 * This is the model behind a real table, and the table that plays it. The
 * scoring tests came first and the flow tests at the bottom came with the
 * wiring — an untested foundation is worse than no foundation.
 */
const SEED = makeSeed(4242)
const WHO = 1 as EntityId
const WHEN = 0 as Tick

describe('scoring a hand', () => {
  it('counts faces as ten and an ace high', () => {
    expect(cardValue(13)).toBe(10)
    expect(cardValue(10)).toBe(10)
    expect(cardValue(1)).toBe(11)
    expect(cardValue(7)).toBe(7)
  })

  it('softens aces one at a time rather than busting', () => {
    // THE RULE PEOPLE ACTUALLY GET WRONG. Two aces is twelve, not
    // twenty-two — the second one drops to a one the moment it has to.
    expect(handTotal([1, 1])).toBe(12)
    expect(handTotal([1, 10])).toBe(21)
    expect(handTotal([1, 5, 10])).toBe(16)
    expect(handTotal([1, 1, 9])).toBe(21)
  })

  it('busts when it genuinely cannot be saved', () => {
    expect(handTotal([10, 10, 5])).toBe(25)
  })
})

describe('dealing', () => {
  it('is deterministic — the same seed deals the same card', () => {
    // Law 11. If this ever stops holding, replays diverge at the table.
    expect(cardAt(SEED, WHO, WHEN, 0)).toBe(cardAt(SEED, WHO, WHEN, 0))
  })

  it('deals different cards to different positions in the shoe', () => {
    const shoe = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => cardAt(SEED, WHO, WHEN, i))
    // Not a uniqueness claim — a real shoe repeats ranks. What must not
    // happen is every position returning the same card, which is what a
    // mis-salted stream would do.
    expect(new Set(shoe).size).toBeGreaterThan(1)
  })

  it('opens with two for the player and one showing for the house', () => {
    const hand = openingHand(SEED, WHO, WHEN, 5_000)
    expect(hand.player).toHaveLength(2)
    expect(hand.dealer).toHaveLength(1)
    expect(hand.position).toBe(3)
  })

  it('takes the next card in the shoe on a hit, never a repeat', () => {
    const hand = openingHand(SEED, WHO, WHEN, 5_000)
    const after = hitHand(SEED, WHO, WHEN, hand)
    expect(after.player).toHaveLength(3)
    expect(after.position).toBe(hand.position + 1)
    expect(after.player[2]).toBe(cardAt(SEED, WHO, WHEN, hand.position))
  })
})

describe('the house', () => {
  it('draws to sixteen and stands on seventeen, always', () => {
    // THE ENTIRE SOURCE OF THE HOUSE EDGE, and it has no choices in it.
    for (let s = 0; s < 30; s += 1) {
      const hand = openingHand(makeSeed(s), WHO, WHEN, 5_000)
      const finished = dealerFinish(makeSeed(s), WHO, WHEN, hand)
      const total = handTotal(finished.dealer)
      expect(total).toBeGreaterThanOrEqual(17)
    }
  })
})

describe('settling', () => {
  const base = { wager: 1_000, position: 9, doubled: false }

  it('pays a natural three to two', () => {
    expect(settleHand({ ...base, player: [1, 13], dealer: [10, 8] })).toBe(1_500)
  })

  it('does not pay a natural against the house holding one too', () => {
    expect(settleHand({ ...base, player: [1, 13], dealer: [1, 10] })).toBe(0)
  })

  it('takes the stake when the player busts, whatever the house has', () => {
    // Busting loses BEFORE the house plays — that is the edge, and a model
    // that paid a busted player against a busted house would erase it.
    expect(settleHand({ ...base, player: [10, 9, 8], dealer: [10, 9, 8] })).toBe(-1_000)
  })

  it('pays when the house busts', () => {
    expect(settleHand({ ...base, player: [10, 8], dealer: [10, 9, 8] })).toBe(1_000)
  })

  it('pushes on a tie', () => {
    expect(settleHand({ ...base, player: [10, 8], dealer: [10, 8] })).toBe(0)
  })

  it('doubles both what is won and what is lost', () => {
    expect(settleHand({ ...base, doubled: true, player: [10, 8], dealer: [10, 7] })).toBe(2_000)
    expect(settleHand({ ...base, doubled: true, player: [10, 7], dealer: [10, 8] })).toBe(-2_000)
  })
})

describe('carrying a hand through a pending decision', () => {
  it('survives the round trip', () => {
    // The hand rides in the pending decision's detail string, the same way
    // engagement beats do — that is what lets a hand be played across
    // several actions with no schema change.
    const hand = { wager: 2_500, player: [1, 7, 13], dealer: [9, 4], position: 6, doubled: true }
    const back = decodeHand(encodeHand(hand))
    expect(back).toEqual(hand)
  })

  it('refuses nonsense rather than inventing a hand', () => {
    expect(decodeHand(null)).toBeNull()
    expect(decodeHand('rubbish')).toBeNull()
  })
})

describe('playing a hand at the table', () => {
  /** A player old enough, sat down, with chips in front of them. */
  function atTheTable() {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 30)
    const person = [...world.people.values()].find(
      (p) => p.deathTick === null && ageAt(p.birthTick, world.tick) >= 25,
    )
    if (person === undefined) return null
    setPlayer(world, person.id)
    const record = gamblerOf(world, person.id)
    world.gamblers.set(person.id, { ...record, chips: 500_000 as Money })
    return { world, personId: person.id }
  }

  it('deals a hand instead of resolving one', () => {
    // THE WHOLE BUG IN ONE ASSERTION. The old table settled the entire hand
    // the instant you pressed a button; there was never a moment where a
    // hand existed and you had a choice about it. Now there is.
    const table = atTheTable()
    expect(table).not.toBeNull()
    if (table === null) return
    const { world } = table

    expect(dealBlackjack(world, 5_000 as Money).done).toBe(true)
    expect(world.player.pending?.kind).toBe('blackjack-hand')

    const hand = decodeHand(world.player.pending?.occupationId ?? null)
    expect(hand).not.toBeNull()
    expect(hand?.player).toHaveLength(2)
    expect(hand?.dealer).toHaveLength(1)
  })

  it('settles the chips when the player stands', () => {
    const table = atTheTable()
    if (table === null) return
    const { world, personId } = table
    const before = gamblerOf(world, personId).chips

    dealBlackjack(world, 5_000 as Money)
    resolvePending(world, 'stand')

    // The hand is over and the slot is free.
    expect(world.player.pending).toBeNull()
    // AND IT WAS ACTUALLY PLAYED. Chips can legitimately end level — a push
    // is a real outcome — so the claim is on the RECORD rather than the
    // balance: this hand went through the books.
    const record = gamblerOf(world, personId)
    expect(record.lifetimeWagered).toBeGreaterThan(0)
    expect(record.lastPlayedTick).toBe(world.tick)
    void before
  })

  it('keeps the hand alive on a hit that does not bust', () => {
    // The re-raise is the part that makes this a GAME rather than a single
    // button — and it happens after commit frees the slot, which is easy to
    // get wrong and silent when you do.
    const table = atTheTable()
    if (table === null) return
    const { world } = table

    dealBlackjack(world, 5_000 as Money)
    const opening = decodeHand(world.player.pending?.occupationId ?? null)
    if (opening === null || handTotal(opening.player) >= 21) return

    resolvePending(world, 'hit')
    const after = decodeHand(world.player.pending?.occupationId ?? null)
    if (world.player.pending !== null) {
      // Still playing: they drew a card and were asked again.
      expect(world.player.pending.kind).toBe('blackjack-hand')
      expect(after?.player.length).toBe(opening.player.length + 1)
      // AND DOUBLING IS GONE, which is the real rule.
      expect(world.player.pending.options).not.toContain('double')
    }
  })
})

describe('the shoe between deals', () => {
  it('does not serve the same hand twice in a month', () => {
    /**
     * THE EXPLOIT THIS GUARDS (found by playing, in the browser): the shoe
     * was salted by tick alone, so every deal inside one month produced
     * identical cards. Win a hand, redeal, win the same hand — thirty times,
     * the whole monthly cadence, for free money.
     */
    const hands = [0, 1, 2, 3, 4].map((deal) =>
      openingHand(SEED, WHO, WHEN, 2_000, deal).player.join(','),
    )
    expect(new Set(hands).size).toBeGreaterThan(1)
  })

  it('still replays exactly — the Nth deal is always the Nth deal', () => {
    expect(openingHand(SEED, WHO, WHEN, 2_000, 3)).toEqual(openingHand(SEED, WHO, WHEN, 2_000, 3))
  })
})
