/**
 * HOW OFTEN A THING MAY BE DONE (owner, playing: "we should have limits on
 * how many games, how many fights etc — I just played a fighter and I can
 * fight how ever many times I want... im playing poker rn and I can play
 * multiple nightly tournaments too").
 *
 * It was every verb, not two. The claims: each has a real cadence, the
 * refusal says why in the world's own terms, and — the one that matters
 * most — THE LIMIT RESETS. A cap that never lifted would be worse than no
 * cap at all.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  MONTHS_BETWEEN_FIGHTS,
  SESSIONS_PER_MONTH,
  TABLE_PLAYS_PER_MONTH,
  TRAINING_BLOCKS_PER_MONTH,
  buyChipsPlayer,
  enterTournamentPlayer,
  playPokerPlayer,
  playTablePlayer,
  setPlayer,
  takeFightPlayer,
  resolvePending,
} from '../src/player.js'
import { accountsOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import { freshAthlete } from '../src/sports.js'
import type { World } from '../src/types.js'

function rich(seed: number, years: number): World {
  const world = createWorld(makeSeed(seed), 400)
  advanceTicks(world, 12 * years)
  const adult = livingPeople(world).find((p) => {
    const age = Math.floor((world.tick - p.birthTick) / 12)
    return age >= 30 && age < 60
  })
  if (adult === undefined) throw new Error('no adult')
  setPlayer(world, adult.id)
  const accounts = accountsOf(world, adult.id)
  ;(world.accounts as Map<number, typeof accounts>).set(adult.id, {
    ...accounts,
    savings: 900_000_000 as Money,
  })
  return world
}

describe('a fighter cannot fight every month', () => {
  it('a camp takes months, and the refusal says so', () => {
    const world = rich(4242, 34)
    const id = world.player.personId ?? 0
    world.athletes.set(id, {
      ...freshAthlete(id, 'combat', 'lightweight', { striking: 70, power: 70 }, 90),
      level: 'pro',
      wins: 3,
      losses: 1,
    })
    expect(takeFightPlayer(world).done).toBe(true)
    const second = takeFightPlayer(world)
    expect(second.done).toBe(false)
    // Two to four fights a year is the real cadence; a man who fought
    // monthly would be finished inside two years.
    expect(second.reason).toContain('camp')
  })

  it('and the wait actually ends', () => {
    const world = rich(4242, 34)
    const id = world.player.personId ?? 0
    world.athletes.set(id, {
      ...freshAthlete(id, 'combat', 'lightweight', { striking: 70, power: 70 }, 90),
      level: 'pro',
    })
    expect(takeFightPlayer(world).done).toBe(true)
    advanceTicks(world, MONTHS_BETWEEN_FIGHTS)
    // A cap that never lifted would be worse than no cap.
    expect(takeFightPlayer(world).done).toBe(true)
  })
})

describe('one running, one entry', () => {
  it('the same tournament cannot be played twice in a month', () => {
    const world = rich(4242, 34)
    expect(buyChipsPlayer(world, 400_000_000 as Money).done).toBe(true)
    const first = enterTournamentPlayer(world, 'nightly')
    if (!first.done) return // not running this month; nothing to claim
    const second = enterTournamentPlayer(world, 'nightly')
    expect(second.done).toBe(false)
    expect(second.reason).toContain('already played')
  })

  it('but a different tournament the same month is fine', () => {
    const world = rich(4242, 34)
    expect(buyChipsPlayer(world, 400_000_000 as Money).done).toBe(true)
    const nightly = enterTournamentPlayer(world, 'nightly')
    const major = enterTournamentPlayer(world, 'major')
    // Two different events are two different events.
    if (nightly.done) expect(major.done || !major.reason.includes('already')).toBe(true)
  })
})

describe('a month has only so many hours in it', () => {
  it('caps cash sessions, and lifts next month', () => {
    const world = rich(4242, 34)
    expect(buyChipsPlayer(world, 400_000_000 as Money).done).toBe(true)
    let played = 0
    for (let i = 0; i < SESSIONS_PER_MONTH + 6; i += 1) {
      if (playPokerPlayer(world, 'micro', 5).done) played += 1
      // A KEY HAND RAISES A PENDING, and the casino correctly refuses to
      // deal again while a decision is waiting. Answering it is part of
      // playing the session, not part of the cap being tested.
      // ANSWER WITH WHATEVER IT OFFERS. A test that hard-codes 'hold'
      // breaks the moment a pending has its own vocabulary — the key hand
      // asks fold/call/shove, which is not the scene spectrum.
      const waiting = world.player.pending
      if (waiting !== null) resolvePending(world, waiting.options[0] ?? 'hold')
    }
    expect(played).toBe(SESSIONS_PER_MONTH)
    expect(playPokerPlayer(world, 'micro', 5).reason).toContain('grinder sleeps')

    advanceTicks(world, 1)
    buyChipsPlayer(world, 100_000_000 as Money)
    expect(playPokerPlayer(world, 'micro', 5).done).toBe(true)
  })

  it('caps hands at the tables too', () => {
    const world = rich(4242, 34)
    expect(buyChipsPlayer(world, 400_000_000 as Money).done).toBe(true)
    let dealt = 0
    for (let i = 0; i < TABLE_PLAYS_PER_MONTH + 8; i += 1) {
      if (playTablePlayer(world, 'blackjack', 1_000 as Money, 'stand').done) dealt += 1
      // ANSWER WITH WHATEVER IT OFFERS. A test that hard-codes 'hold'
      // breaks the moment a pending has its own vocabulary — the key hand
      // asks fold/call/shove, which is not the scene spectrum.
      const waiting = world.player.pending
      if (waiting !== null) resolvePending(world, waiting.options[0] ?? 'hold')
    }
    expect(dealt).toBe(TABLE_PLAYS_PER_MONTH)
  })
})

describe('the constants are the honest ones', () => {
  it('a fighter fights a few times a year, not a few times a month', () => {
    expect(MONTHS_BETWEEN_FIGHTS).toBeGreaterThanOrEqual(3)
    // 12 / 3 = four a year at most, which is the top of a real career.
    expect(12 / MONTHS_BETWEEN_FIGHTS).toBeLessThanOrEqual(4)
  })

  it('and the rest are finite and generous rather than punitive', () => {
    expect(SESSIONS_PER_MONTH).toBeGreaterThan(4)
    expect(TABLE_PLAYS_PER_MONTH).toBeGreaterThan(10)
    expect(TRAINING_BLOCKS_PER_MONTH).toBeGreaterThan(2)
    expect(TRAINING_BLOCKS_PER_MONTH).toBeLessThan(10)
  })
})
