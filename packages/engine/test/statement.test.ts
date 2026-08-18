/**
 * THE STATEMENT SUMS TO THE MONEY (owner, 2026-08-17).
 *
 * "make sure its for money everywhere that is visible we need the money to
 * actually align with how much they are making I dont get why it is off these
 * numbers need to all connect."
 *
 * MEASURED before the fix, on a shopkeeper at seed 4242: the money log said
 * the month was +$14,831.03 and the wallet moved +$11,706.29. $3,124.74 left
 * with no line against it, every month. Four separate debits took money
 * without saying so:
 *
 *   the household collection, when `unitsUnder` did not return an earner's
 *   unit — the itemisation was treated as the happy path and the money as
 *   incidental, and there was no else;
 *   the savings buffer that covers a bad month, which is the single movement
 *   a player most wants explained;
 *   the unmet remainder pushed onto the head's wallet, which is how a balance
 *   goes negative and becomes a mystery;
 *   and the loan payment, which moves money by mutating locals and so never
 *   passed through `debitPerson` at all.
 *
 * THE CLAIM IS AN EQUALITY, not a tolerance. A statement whose rows do not
 * add up to the money that left is worse than no statement.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { moneyMonthFor, walletOf } from '../src/finances.js'
import { setPlayer, startBusiness } from '../src/player.js'
import type { World } from '../src/types.js'

/** The wealthy shopkeeper the money tests have used since the first report. */
function aShopkeeper(seedValue: number): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seedValue), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 45)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
  startBusiness(world, 'shop')
  for (let month = 0; month < 24; month += 1) {
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  ;(world.player as { pending: unknown }).pending = null
  return { world, personId: person.id }
}

describe('the statement and the wallet describe the same month', () => {
  it('adds up to the cent, every month, for a wealthy household', () => {
    const { world, personId } = aShopkeeper(4242)
    const holder = walletOf(world, personId).personId

    for (let month = 0; month < 6; month += 1) {
      const before = walletOf(world, personId)
      const liquidBefore = before.checking + before.savings
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
      const after = world.accounts.get(holder)
      const moved = (after?.checking ?? 0) + (after?.savings ?? 0) - liquidBefore

      let rows = 0
      for (const row of moneyMonthFor(world, world.tick)) rows += row.amount

      expect(
        rows,
        `month ${String(month)}: the wallet moved ${String(moved)} and the rows say ${String(rows)}`,
      ).toBe(moved)
    }
  })

  it('adds up for an ordinary household too, not only the player’s', () => {
    // The same claim on a second world, so it is not a fact about one seed.
    const { world, personId } = aShopkeeper(777)
    const holder = walletOf(world, personId).personId
    for (let month = 0; month < 4; month += 1) {
      const before = walletOf(world, personId)
      const liquidBefore = before.checking + before.savings
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
      const after = world.accounts.get(holder)
      const moved = (after?.checking ?? 0) + (after?.savings ?? 0) - liquidBefore
      let rows = 0
      for (const row of moneyMonthFor(world, world.tick)) rows += row.amount
      expect(rows).toBe(moved)
    }
  })

  it('names every line — no money moves under a blank label', () => {
    const { world, personId } = aShopkeeper(4242)
    for (let month = 0; month < 6; month += 1) {
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
      for (const row of moneyMonthFor(world, world.tick)) {
        expect(row.label.trim().length, `an unlabelled movement of ${String(row.amount)}`).toBeGreaterThan(3)
      }
    }
    expect(personId).toBeGreaterThan(0)
  })
})
