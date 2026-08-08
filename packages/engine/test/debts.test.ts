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
import { advanceTicks, createWorld } from '../src/index.js'
import { accountsOf, creditPerson, payDownBar, payDownLoan, takeLoan } from '../src/finances.js'
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
