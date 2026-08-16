/**
 * THE CASINO AND POKER (owner's `casino_poker_master_1.md`).
 *
 * The claims, in the order they matter:
 *
 *   the HOUSE WINS at blackjack and slots, always, and playing well
 *     narrows the edge without ever flipping it;
 *   POKER CAN BE BEATEN, because you play the other people rather than the
 *     house — and a player level with the field still LOSES, to the rake,
 *     which is the most misunderstood fact about the game;
 *   VARIANCE IS REAL, so even a crusher has losing sessions constantly;
 *   CHIPS ARE THE WALL (owner: "chips you buy from a cashier that is
 *     separate funds from everything") — nothing at a table can reach the
 *     rent, and getting to the rent takes a second deliberate act;
 *   and gambling CAN RUIN SOMEBODY, with a recovery path that always
 *     works (Law 7).
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Money, Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  STAKES,
  playTable,
  TOURNAMENTS,
  expectedReturnPerMille,
  gamblerOf,
  holdLevelOf,
  paytableFor,
  playSession,
  playTournament,
  prizeFor,
  stakeById,
  keyHandFor,
  keyHandOutcome,
} from '../src/casino.js'
import {
  buyChipsPlayer,
  cashOutPlayer,
  playTablePlayer,
  playPokerPlayer,
  seekHelpPlayer,
  setPlayer,
  walletOf,
  resolvePending,
} from '../src/player.js'
import { accountsOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function playerAged(seed: number, years: number): World {
  const world = createWorld(makeSeed(seed), 400)
  advanceTicks(world, 12 * years)
  const adult = livingPeople(world).find((p) => {
    const age = Math.floor((world.tick - p.birthTick) / 12)
    return age >= 30 && age < 60
  })
  if (adult === undefined) throw new Error('no adult')
  setPlayer(world, adult.id)
  const accounts = accountsOf(world, adult.id)
  // Give them something to lose, so the test is about the casino rather
  // than about whether this particular person happened to have savings.
  ;(world.accounts as Map<number, typeof accounts>).set(adult.id, {
    ...accounts,
    savings: 50_000_000 as Money,
  })
  return world
}

describe('the house always wins', () => {
  it('every table on the floor returns less than it takes', () => {
    for (const game of ['blackjack', 'slots'] as const) {
      const expected = expectedReturnPerMille(paytableFor(game))
      // Under 1,000 per-mille is the edge. This is read off the paytable
      // rather than from a constant beside it, which is how the first
      // version managed to state one edge and implement another.
      expect(expected, game).toBeLessThan(1_000)
      expect(expected, game).toBeGreaterThan(700)
    }
  })

  it('blackjack is a slow bleed and slots is a fast one', () => {
    const bj = expectedReturnPerMille(paytableFor('blackjack'))
    const slots = expectedReturnPerMille(paytableFor('slots'))
    expect(bj).toBeGreaterThan(slots)
  })

  it('a long run at either game loses money, and slots loses it faster', () => {
    // MEASURED OVER A REAL SAMPLE. The first version of this test played
    // three hundred hands and asserted the tray shrank — but three hundred
    // hands of blackjack is roughly one part expectation to six parts
    // noise, so it failed on a winning streak that meant nothing. An edge
    // is a claim about the long run and has to be tested as one.
    const world = createWorld(makeSeed(99))
    const holdOf = (game: 'blackjack' | 'slots'): number => {
      let net = 0
      let wagered = 0
      // A HUNDRED THOUSAND, because the top prize is rare enough that a
      // smaller sample measures whether it happened to land rather than
      // what the machine does.
      for (let i = 0; i < 100_000; i += 1) {
        const r = playTable(world, 500 as Tick, i as EntityId, game, 10_000 as Money, 'stand', 500, i)
        net += r.net
        wagered += r.wagered
      }
      return -net / wagered
    }
    const blackjack = holdOf('blackjack')
    const slots = holdOf('slots')
    expect(blackjack).toBeGreaterThan(0)
    expect(slots).toBeGreaterThan(blackjack)
    // And blackjack's edge stays small enough to be a real game.
    expect(blackjack).toBeLessThan(0.05)
  })

  it('two hands in the same month are not the same hand', () => {
    // The stream is keyed on the hand as well as the person and the month.
    // Without that a player sat at a table all month was dealt one card
    // over and over.
    const world = createWorld(makeSeed(7))
    const seen = new Set<number>()
    for (let visit = 0; visit < 40; visit += 1) {
      seen.add(playTable(world, 12 as Tick, 500 as EntityId, 'blackjack', 10_000 as Money, 'stand', 500, visit).returned)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('poker is the one you can beat', () => {
  const mid = stakeById('mid')

  it('a player level with the field still loses, to the rake', () => {
    if (mid === undefined) return
    const world = createWorld(makeSeed(11))
    let net = 0
    // Six thousand sessions: the rake is eight per-mille an hour and the
    // swing is a hundred times that, so a small sample says nothing.
    for (let i = 0; i < 6_000; i += 1) {
      net += playSession(world, i as Tick, (900 + i) as EntityId, mid, mid.buyIn, mid.fieldStrength, 5, i).net
    }
    expect(net).toBeLessThan(0)
  })

  it('a player better than the field wins, and a worse one loses', () => {
    if (mid === undefined) return
    const world = createWorld(makeSeed(11))
    const run = (skill: number): number => {
      let net = 0
      for (let i = 0; i < 6_000; i += 1) {
        net += playSession(world, i as Tick, (900 + i) as EntityId, mid, mid.buyIn, skill, 5, i).net
      }
      return net
    }
    expect(run(mid.fieldStrength + 250)).toBeGreaterThan(0)
    expect(run(mid.fieldStrength - 250)).toBeLessThan(0)
  })

  it('even a winning player loses a great many sessions', () => {
    if (mid === undefined) return
    const world = createWorld(makeSeed(11))
    let losing = 0
    const N = 1_000
    for (let i = 0; i < N; i += 1) {
      if (playSession(world, i as Tick, (900 + i) as EntityId, mid, mid.buyIn, 850, 5, i).net < 0) losing += 1
    }
    // If a good player won most nights nobody would sit down with them
    // twice, and the game would not exist.
    expect(losing / N).toBeGreaterThan(0.3)
    expect(losing / N).toBeLessThan(0.55)
  })

  it('the stakes ladder gets harder all the way up', () => {
    for (let i = 1; i < STAKES.length; i += 1) {
      const below = STAKES[i - 1]
      const here = STAKES[i]
      if (below === undefined || here === undefined) continue
      expect(here.fieldStrength).toBeGreaterThan(below.fieldStrength)
      expect(here.buyIn).toBeGreaterThan(below.buyIn)
    }
  })
})

describe('tournaments pay top-heavy, and the whole pool', () => {
  it('gives away everything it takes in', () => {
    const pool = 1_000_000_000
    const paidTo = 40
    let handed = 0
    for (let place = 1; place <= paidTo; place += 1) {
      handed += prizeFor(pool, place, paidTo, 180)
    }
    // Rounding loses a few cents across forty places; nothing else may.
    expect(handed).toBeGreaterThan(pool - paidTo)
    expect(handed).toBeLessThanOrEqual(pool)
  })

  it('first place is worth many min-cashes', () => {
    const first = prizeFor(1_000_000_000, 1, 40, 180)
    const min = prizeFor(1_000_000_000, 40, 40, 180)
    expect(first).toBeGreaterThan(min * 20)
  })

  it('the main event is a lottery: tiny odds, a life-changing prize', () => {
    // WHAT THE SPEC ACTUALLY CLAIMS — "rare, huge fields, small odds,
    // life-changing payouts, the poker dream, HONESTLY PRICED". Odds and
    // prize size, which is what is tested here.
    //
    // An earlier version of this test asserted the main event had the
    // WORST return on investment of the three, and that was my invention
    // rather than the spec's. It is also not obviously true: a strong
    // player genuinely does beat a soft field, and the extra comes out of
    // everybody else in it, which is how poker works.
    const world = createWorld(makeSeed(11))
    const oddsOf = (id: string): { win: number; prize: number } => {
      const event = TOURNAMENTS.find((t) => t.id === id)
      if (event === undefined) return { win: 1, prize: 0 }
      let wins = 0
      const N = 4_000
      for (let i = 0; i < N; i += 1) {
        if (playTournament(world, i as Tick, (800 + i) as EntityId, event, event.buyIn, 820, i).finish === 1) {
          wins += 1
        }
      }
      const paidTo = Math.max(1, Math.floor((event.field * 125) / 1_000))
      return { win: wins / N, prize: prizeFor(event.buyIn * event.field, 1, paidTo, event.topPerMille) }
    }
    const nightly = oddsOf('nightly')
    const main = oddsOf('main')
    // Winning it is far harder...
    expect(main.win).toBeLessThan(nightly.win)
    // ...and worth vastly more. That is the entire trade.
    expect(main.prize).toBeGreaterThan(nightly.prize * 100)
  })

  it('an average player loses exactly the rake, at every event', () => {
    // THE ANCHOR UNDER ALL OF IT. If somebody with no edge came out ahead,
    // the tournament would be printing money and every other number here
    // would be meaningless. Computed over every finishing position rather
    // than sampled, so it is exact.
    for (const event of TOURNAMENTS) {
      const paidTo = Math.max(1, Math.floor((event.field * 125) / 1_000))
      const pool = Math.floor((event.buyIn * event.field * 920) / 1_000)
      let handed = 0
      for (let place = 1; place <= paidTo; place += 1) {
        handed += prizeFor(pool, place, paidTo, event.topPerMille)
      }
      const meanReturn = handed / event.field / event.buyIn
      expect(meanReturn, event.id).toBeLessThan(1)
      expect(meanReturn, event.id).toBeGreaterThan(0.9)
    }
  })

  it('no event is a printing press, even for a very good player', () => {
    const world = createWorld(makeSeed(11))
    for (const event of TOURNAMENTS) {
      let net = 0
      const N = 4_000
      for (let i = 0; i < N; i += 1) {
        net += playTournament(world, i as Tick, (800 + i) as EntityId, event, event.buyIn, 900, i).net
      }
      expect(net / (N * event.buyIn), event.id).toBeLessThan(1)
    }
  })
})

describe('chips are the wall', () => {
  it('a table cannot reach money that is not on it', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    expect(buyChipsPlayer(world, 1_000_000 as Money).done).toBe(true)
    const walletAfterBuying = walletOf(world, personId)

    // NO TICKS ADVANCE HERE, deliberately. The first version of this test
    // advanced a month between spins and then failed because wages and
    // interest had moved the wallet — it was measuring the economy, not the
    // wall. What is being claimed is narrow and exact: playing does not
    // touch an account.
    for (let i = 0; i < 60; i += 1) {
      playTablePlayer(world, 'slots', 500_000 as Money, 'stand')
    }
    expect(walletOf(world, personId)).toBe(walletAfterBuying)
    // And the tray can never go below nothing.
    expect(gamblerOf(world, personId).chips).toBeGreaterThanOrEqual(0)
  })

  it('refuses a bet bigger than the tray, and says where the cashier is', () => {
    const world = playerAged(4242, 34)
    expect(buyChipsPlayer(world, 10_000 as Money).done).toBe(true)
    const result = playTablePlayer(world, 'blackjack', 5_000_000 as Money, 'stand')
    expect(result.done).toBe(false)
    expect(result.reason).toContain('cashier')
  })

  it('cashing out puts it back, to the cent', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    const before = walletOf(world, personId)
    expect(buyChipsPlayer(world, 2_500_000 as Money).done).toBe(true)
    expect(walletOf(world, personId)).toBe(before - 2_500_000)
    const out = cashOutPlayer(world)
    expect(out.done).toBe(true)
    expect(walletOf(world, personId)).toBe(before)
    expect(gamblerOf(world, personId).chips).toBe(0)
  })

  it('will not sell chips to somebody who cannot pay', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    const accounts = accountsOf(world, personId)
    ;(world.accounts as Map<number, typeof accounts>).set(personId, {
      ...accounts,
      savings: 0 as Money,
      checking: 0 as Money,
    })
    expect(buyChipsPlayer(world, 10_000 as Money).done).toBe(false)
  })
})

describe('it can take hold, and it can be walked back', () => {
  it('going back to the window again and again is what tightens it', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    expect(holdLevelOf(gamblerOf(world, personId))).toBe('none')
    // Buying in for a large share of everything, over and over, inside the
    // same month — which is what chasing looks like from the outside.
    for (let i = 0; i < 40; i += 1) {
      buyChipsPlayer(world, 8_000_000 as Money)
      cashOutPlayer(world)
    }
    expect(gamblerOf(world, personId).hold).toBeGreaterThan(0)
  })

  it('one ordinary night is not a problem, and is never described as one', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    // A small buy-in against a large wallet: what most people do.
    expect(buyChipsPlayer(world, 20_000 as Money).done).toBe(true)
    expect(holdLevelOf(gamblerOf(world, personId))).toBe('none')
  })

  it('asking for help is open to anybody, and always works', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    for (let i = 0; i < 60; i += 1) {
      buyChipsPlayer(world, 9_000_000 as Money)
      cashOutPlayer(world)
    }
    const deep = gamblerOf(world, personId).hold
    expect(deep).toBeGreaterThan(0)

    expect(seekHelpPlayer(world).done).toBe(true)
    expect(gamblerOf(world, personId).inRecoverySinceTick).not.toBeNull()

    // Time away, and it comes down. Law 7: there is no state here somebody
    // cannot walk back from.
    advanceTicks(world, 60)
    expect(gamblerOf(world, personId).hold).toBeLessThan(deep)
  })

  it('recovery is faster than merely not playing', () => {
    const build = (): { world: World; personId: number } => {
      const world = playerAged(4242, 34)
      const personId = (world.player.personId as EntityId)
      for (let i = 0; i < 60; i += 1) {
        buyChipsPlayer(world, 9_000_000 as Money)
        cashOutPlayer(world)
      }
      return { world, personId }
    }
    const drifting = build()
    const trying = build()
    expect(seekHelpPlayer(trying.world).done).toBe(true)
    advanceTicks(drifting.world, 24)
    advanceTicks(trying.world, 24)
    expect(gamblerOf(trying.world, trying.personId as EntityId).hold).toBeLessThan(
      gamblerOf(drifting.world, drifting.personId as EntityId).hold,
    )
  })
})

describe('poker skill is earned', () => {
  it('nobody starts with any, and playing is what builds it', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    expect(gamblerOf(world, personId).pokerSkill).toBe(0)
    expect(buyChipsPlayer(world, 30_000_000 as Money).done).toBe(true)
    for (let i = 0; i < 20; i += 1) {
      advanceTicks(world, 1)
      playPokerPlayer(world, 'micro', 6)
    }
    expect(gamblerOf(world, personId).pokerSkill).toBeGreaterThan(0)
    expect(gamblerOf(world, personId).hoursPlayed).toBeGreaterThan(0)
  })
})

describe('the key hand', () => {
  /**
   * FIND A NIGHT WITH A BIG POT IN IT rather than assuming one. A hand
   * comes up about a quarter of sessions, so hard-coding a seed and hoping
   * is a test that fails for a reason that is not a bug — which is exactly
   * what the first version of this did.
   */
  function someHand(): NonNullable<ReturnType<typeof keyHandFor>> {
    const world = createWorld(makeSeed(3))
    for (let i = 0; i < 500; i += 1) {
      const hand = keyHandFor(world, i as never, (700 + i) as EntityId, i, 600)
      if (hand !== null) return hand
    }
    throw new Error('no key hand in five hundred sessions')
  }

  /**
   * THE ONE THAT MATTERS MOST: the choice shifts an ALREADY-SEEDED outcome
   * and does not add randomness (spec §5). Concretely — if you were behind,
   * calling loses, every time, on that seed. Somebody reloading to answer
   * differently gets a different result from THEIR CHOICE and never from a
   * fresh roll of the dice.
   */
  it('the same draw decides it whichever way you answer', () => {
    const hand = someHand()

    // One roll, three answers. Behind or ahead is settled before the
    // player speaks.
    const behind = hand.aheadPerMille + 50
    expect(keyHandOutcome(hand, 'call', behind)).toBeLessThan(0)
    expect(keyHandOutcome(hand, 'shove', behind)).toBeLessThan(0)
    const ahead = Math.max(0, hand.aheadPerMille - 50)
    expect(keyHandOutcome(hand, 'call', ahead)).toBeGreaterThan(0)
    expect(keyHandOutcome(hand, 'shove', ahead)).toBeGreaterThan(0)
  })

  it('folding costs something, and less than being wrong', () => {
    const hand = someHand()
    const fold = keyHandOutcome(hand, 'fold', 0)
    const wrongCall = keyHandOutcome(hand, 'call', hand.aheadPerMille + 50)
    // Passing is never free — the pot was partly yours already.
    expect(fold).toBeLessThan(0)
    // But it is cheaper than putting the rest in behind.
    expect(fold).toBeGreaterThan(wrongCall)
  })

  it('shoving risks more in both directions than calling', () => {
    const hand = someHand()
    const ahead = Math.max(0, hand.aheadPerMille - 50)
    const behind = hand.aheadPerMille + 50
    expect(keyHandOutcome(hand, 'shove', ahead)).toBeGreaterThan(
      keyHandOutcome(hand, 'call', ahead),
    )
    expect(keyHandOutcome(hand, 'shove', behind)).toBeLessThan(
      keyHandOutcome(hand, 'call', behind),
    )
  })

  it('does not come up every session — it would be wallpaper', () => {
    const world = createWorld(makeSeed(3))
    let fired = 0
    for (let i = 0; i < 600; i += 1) {
      if (keyHandFor(world, i as never, (400 + i) as EntityId, i, 500) !== null) fired += 1
    }
    expect(fired / 600).toBeGreaterThan(0.1)
    expect(fired / 600).toBeLessThan(0.45)
  })

  it('a better player finds themselves ahead in big pots more often', () => {
    const world = createWorld(makeSeed(3))
    const meanAhead = (skill: number): number => {
      let total = 0
      let n = 0
      for (let i = 0; i < 2_000; i += 1) {
        const hand = keyHandFor(world, i as never, (400 + i) as EntityId, i, skill)
        if (hand !== null) {
          total += hand.aheadPerMille
          n += 1
        }
      }
      return n === 0 ? 0 : total / n
    }
    expect(meanAhead(850)).toBeGreaterThan(meanAhead(250))
  })
})

describe('the results screens have something to show', () => {
  it('a session leaves a recap on the record', () => {
    const world = playerAged(4242, 34)
    const personId = (world.player.personId as EntityId)
    expect(buyChipsPlayer(world, 30_000_000 as Money).done).toBe(true)
    // Play until one lands without a key hand holding it open.
    for (let i = 0; i < 12; i += 1) {
      advanceTicks(world, 1)
      playPokerPlayer(world, 'micro', 5)
      if (world.player.pending !== null) resolvePending(world, 'fold')
    }
    const summary = gamblerOf(world, personId).lastSession
    expect(summary).toBeDefined()
    if (summary === undefined) return
    expect(summary.hours).toBeGreaterThan(0)
    expect(summary.stakeTitle.length).toBeGreaterThan(0)
  })
})
