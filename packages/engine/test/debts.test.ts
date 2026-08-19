/**
 * Settling a debt, and buying a house outright.
 *
 * Three things the owner hit while playing, and they are one bug wearing
 * three hats: money moved every month and there was no verb to SETTLE it.
 *
 *   "there isnt a way to buy the house outright either... the slider
 *    didnt do anything and I had to take a mortgage out"
 *   "theres no way to even pay the mortgage"
 *   "No way to pay off student loans either"
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { accountsOf, creditPerson, payDownBar, payDownLoan, takeLoan, walletOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'

function anAdult(world: ReturnType<typeof createWorld>) {
  return livingPeople(world).find((p) => world.tick - p.birthTick > 30 * 12)
}

describe('paying a debt down', () => {
  it('takes a lump off the balance', () => {
    const world = createWorld(makeSeed(4141), 200)
    advanceTicks(world, 25 * 12)
    const person = anAdult(world)
    expect(person).toBeDefined()
    if (person === undefined) return

    creditPerson(world, person.id, 5_000_000 as never)
    expect(takeLoan(world, world.tick, person.id, 'personal', 2_000_000 as never)).toBe(true)
    const owed = accountsOf(world, person.id).loans.find((l) => l.kind === 'personal')?.balance ?? 0
    expect(owed).toBeGreaterThan(0)

    const paid = payDownLoan(world, world.tick, person.id, 'personal', 500_000 as never)
    expect(paid).toBe(500_000)
    const after = accountsOf(world, person.id).loans.find((l) => l.kind === 'personal')?.balance ?? 0
    expect(after).toBe(owed - 500_000)
  })

  it('clears the loan outright, and the monthly payment with it', () => {
    // The whole point of settling: the payment stops. A loan paid to zero
    // leaves the file rather than sitting there at nought.
    const world = createWorld(makeSeed(4141), 200)
    advanceTicks(world, 25 * 12)
    const person = anAdult(world)
    if (person === undefined) return

    creditPerson(world, person.id, 9_000_000 as never)
    takeLoan(world, world.tick, person.id, 'student', 1_200_000 as never)
    const owed = accountsOf(world, person.id).loans.find((l) => l.kind === 'student')?.balance ?? 0
    const paid = payDownLoan(world, world.tick, person.id, 'student', (owed * 2) as never)
    // You cannot hand over more than is owed.
    expect(paid).toBe(owed)
    expect(accountsOf(world, person.id).loans.some((l) => l.kind === 'student')).toBe(false)
  })

  it('pays what it can, and no more than there is', () => {
    const world = createWorld(makeSeed(4141), 200)
    advanceTicks(world, 25 * 12)
    const person = anAdult(world)
    if (person === undefined) return

    creditPerson(world, person.id, 3_000_000 as never)
    takeLoan(world, world.tick, person.id, 'auto', 2_500_000 as never)
    const purse = accountsOf(world, person.id)
    const available = purse.savings + purse.checking
    const paid = payDownLoan(world, world.tick, person.id, 'auto', (available * 3) as never)
    expect(paid).toBeLessThanOrEqual(available)
    expect(paid).toBeGreaterThan(0)
    // Never overdrawn by it.
    const after = accountsOf(world, person.id)
    expect(after.savings + after.checking).toBeGreaterThanOrEqual(0)
  })

  it('says why when there is nothing to pay, or nothing to pay it with', () => {
    const world = createWorld(makeSeed(4141), 200)
    advanceTicks(world, 25 * 12)
    const person = anAdult(world)
    if (person === undefined) return
    // No such debt.
    expect(payDownBar(world, person.id, 'mortgage')).toContain('do not carry')
  })
})

/**
 * THE BAR AND THE VERB MUST ANSWER FROM THE SAME PLACE.
 *
 * OWNER, playing: "I'm getting a 'there is nothing to pay with' on my student
 * loan when I obviously have the money."
 *
 * He did have it. H0 splits a person's finances in two — MONEY lives on the
 * household's wallet holder, POSITIONS (loans, holdings) live on the person's
 * own file — and `payDownBar` read the personal file for both. Anybody who
 * was not the holder of their own wallet was told they were penniless, while
 * `payDownLoan` behind the button would have paid the debt without complaint.
 *
 * This is the bar pattern's whole reason for existing, failing: the greyed
 * button and the refusal have to come from one answer.
 */
describe('a bar never refuses what its verb would do', () => {
  it('lets a household member pay a debt from the household wallet', () => {
    const world = createWorld(makeSeed(31_337), 120)
    advanceTicks(world, 25 * 12)

    // Somebody who shares a wallet they do not hold — the exact shape of the
    // report. Without one, this test proves nothing, so it says so.
    const member = livingPeople(world).find((person) => {
      const own = accountsOf(world, person.id)
      const purse = walletOf(world, person.id)
      return purse.personId !== person.id && own.savings + own.checking <= 0
    })
    expect(member, 'no household member with an empty personal file — nothing tested').toBeDefined()
    if (!member) return

    // Money in the wallet, and a debt on his own file.
    const purse = walletOf(world, member.id)
    world.accounts.set(purse.personId, {
      ...purse,
      savings: 4_000_000 as Money,
      checking: 500_000 as Money,
    })
    // The debt is placed directly rather than borrowed: `takeLoan` runs a
    // credit gate that has nothing to do with the claim being tested, and a
    // test that fails for a second reason proves neither.
    const own = accountsOf(world, member.id)
    world.accounts.set(member.id, {
      ...own,
      loans: [
        ...own.loans,
        {
          kind: 'student',
          balance: 1_200_000 as Money,
          principal: 1_200_000 as Money,
          ratePerMille: 45,
          monthlyPayment: 20_000 as Money,
          takenAtTick: world.tick,
          maturesAtTick: (world.tick + 120) as never,
          missedMonths: 0,
        },
      ],
    })
    expect(accountsOf(world, member.id).loans.some((l) => l.kind === 'student')).toBe(true)

    // The button must not refuse.
    expect(
      payDownBar(world, member.id, 'student'),
      'the bar refused a man whose wallet is full',
    ).toBeNull()

    // And the verb must actually do it, which is what makes the bar honest.
    const paid = payDownLoan(world, world.tick, member.id, 'student', 300_000 as Money)
    expect(paid, 'the verb paid nothing the bar had allowed').toBeGreaterThan(0)
  })
})
