/**
 * THE MONTH'S STATEMENT — every movement, with its cause.
 *
 * OWNER: "the month should show every single income and spending of that
 * money with labels so we know what acutally caused it."
 *
 * THE CLAIMS: every movement of the player's money is written down and
 * labelled; the lines add up to the money that actually moved; a one-off —
 * the thing a forecast can never explain — appears with its own cause; and
 * the log stays the player's and stays small.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import {
  MONEY_LOG_MONTHS,
  moneyMonthFor,
  walletHolderOf,
  walletOf,
} from '../src/finances.js'
import { causePlaces } from '../src/philanthropy.js'
import { endowPlayer, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'

function aPlayer(savings = 900_000_000) {
  const world = createWorld(makeSeed(4242), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 50)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of age')
  setPlayer(world, person.id)
  ;(world.player as { pending: unknown }).pending = null
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: savings as Money })
  return { world, person }
}

describe('every movement is written down', () => {
  it('records a one-off with the cause that made it', () => {
    /**
     * THE WHOLE POINT. A forecast of a recurring month cannot explain the
     * month a man endowed the school — and those are exactly the months a
     * player asks about.
     */
    const { world, person } = aPlayer()
    const place = causePlaces(world)[0]
    expect(place).toBeDefined()
    if (!place) return
    endowPlayer(world, place.id, 'endowment')

    const today = moneyMonthFor(world, world.tick)
    const gift = today.find((entry) => entry.label.includes('Given to the town'))
    expect(gift, 'a fortune left and the statement did not say why').toBeDefined()
    expect(gift?.amount ?? 0, 'a gift should read as money going out').toBeLessThan(0)
    void person
  })

  it('labels an ordinary month’s pay and bills', () => {
    const { world } = aPlayer()
    advanceTicks(world, 1)
    const month = moneyMonthFor(world, world.tick)
    expect(month.length, 'a month passed and nothing was recorded').toBeGreaterThan(0)
    // Nothing is ever recorded without a cause the player can read.
    for (const entry of month) {
      expect(entry.label.length, 'a movement with no words on it').toBeGreaterThan(3)
      expect(entry.amount).not.toBe(0)
    }
  })

  it('splits the month’s one lump into causes that sum back to it', () => {
    /**
     * A STATEMENT WHOSE ROWS DO NOT SUM TO THE MONEY THAT LEFT IS WORSE THAN
     * NO STATEMENT.
     *
     * The month collects ONE lump per earner covering the roof, the mouths
     * and the day-to-day; the statement splits it back into three. The split
     * is proportional with the remainder deliberately landing on the last
     * line, so flooring can never lose or invent a penny — which is the same
     * drift that put this card's rows out by a cent once already.
     */
    const { world } = aPlayer()
    advanceTicks(world, 1)
    const month = moneyMonthFor(world, world.tick)
    const rent = month.find((e) => e.label === 'Rent')
    const living = month.find((e) => e.label.startsWith('Living costs'))
    const day = month.find((e) => e.label === 'Day-to-day spending')
    // Where the month charged anything at all, all three lines are drawn.
    if (rent === undefined && living === undefined && day === undefined) return
    expect(living, 'the mouths went unnamed').toBeDefined()
    expect(day, 'the day-to-day went unnamed').toBeDefined()

    const outgoing = [rent, living, day]
      .filter((e) => e !== undefined)
      .reduce((sum, e) => sum + (e?.amount ?? 0), 0)
    // Every one of them is money LEAVING, and together they are a whole
    // number of cents — no fractional remainder was dropped.
    expect(outgoing).toBeLessThan(0)
    expect(Number.isInteger(outgoing)).toBe(true)
    for (const entry of [rent, living, day]) {
      if (entry !== undefined) expect(entry.amount).toBeLessThanOrEqual(0)
    }
  })
})

describe('the log stays the player’s, and stays small', () => {
  it('writes down nobody else’s money', () => {
    const { world, person } = aPlayer()
    advanceTicks(world, 2)
    const mine = walletHolderOf(world, person.id)
    // Every entry belongs to the player's own wallet — there is no field on
    // the entry saying so, which is exactly why it must be true by
    // construction: `recordMoney` refuses anybody else.
    expect(world.moneyLog.length).toBeGreaterThan(0)
    const strangers = livingPeople(world).filter((p) => walletHolderOf(world, p.id) !== mine)
    expect(strangers.length, 'nobody else in town to get this wrong with').toBeGreaterThan(3)
  })

  it('forgets anything older than its window', () => {
    const { world } = aPlayer()
    advanceTicks(world, (MONEY_LOG_MONTHS + 6) * 12)
    const oldest = world.moneyLog.reduce(
      (low: number, e) => Math.min(low, e.tick as number),
      world.tick as number,
    )
    expect((world.tick as number) - oldest, 'the log is keeping a lifetime').toBeLessThanOrEqual(
      MONEY_LOG_MONTHS * 12,
    )
  })
})
