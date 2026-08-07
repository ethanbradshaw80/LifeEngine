/**
 * A mortgage is not insolvency (owner, playing: "whenever you put a mortgage
 * on a house it automatically makes you bankrupt... a mortgage shouldn't
 * trigger that unless you're behind on payments").
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { distressDebtOf, isInsolvent, totalOwedBy } from '../src/bankruptcy.js'
import { accountsOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import type { Loan } from '../src/types.js'

function aMortgage(missedMonths: number): Loan {
  return {
    kind: 'mortgage',
    principal: 20_000_000 as Money,
    balance: 19_400_000 as Money,
    ratePerMille: 62,
    monthlyPayment: 120_000 as Money,
    takenAtTick: 0 as Tick,
    maturesAtTick: 360 as Tick,
    missedMonths,
  }
}

describe('the house you are paying for is not a debt you cannot pay', () => {
  it('leaves a mortgage in good standing out of the insolvency test', () => {
    // THE BUG. Insolvency compared TOTAL DEBT against six months of income,
    // and a mortgage principal is years of income by construction — so
    // signing for a house declared you insolvent the same month, every
    // time. The most ordinary financial act in the game was a guaranteed
    // bankruptcy.
    const world = createWorld(makeSeed(4141), 120)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    const base = accountsOf(world, person.id)
    world.accounts.set(person.id, { ...base, loans: [aMortgage(0)] })

    const accounts = accountsOf(world, person.id)
    const income = 400_000 as Money
    const costs = 300_000 as Money

    // The old reading: the whole principal, and insolvent on the spot.
    expect(isInsolvent(totalOwedBy(accounts, 0 as Money), income, costs)).toBe(true)
    // The honest one: nothing is owed that is not being paid.
    expect(isInsolvent(distressDebtOf(accounts, 0 as Money), income, costs)).toBe(false)
  })

  it('counts the payments actually missed, and only those', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    const base = accountsOf(world, person.id)

    world.accounts.set(person.id, { ...base, loans: [aMortgage(3)] })
    const behind = distressDebtOf(accountsOf(world, person.id), 0 as Money)
    expect(behind).toBe(360_000) // three payments, not the principal

    world.accounts.set(person.id, { ...base, loans: [aMortgage(0)] })
    expect(distressDebtOf(accountsOf(world, person.id), 0 as Money)).toBe(0)
  })

  it('still counts unsecured debt in full — nothing stands behind it', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    const base = accountsOf(world, person.id)
    const personal: Loan = {
      kind: 'personal',
      principal: 900_000 as Money,
      balance: 800_000 as Money,
      ratePerMille: 140,
      monthlyPayment: 30_000 as Money,
      takenAtTick: 0 as Tick,
      maturesAtTick: 60 as Tick,
      missedMonths: 0,
    }
    world.accounts.set(person.id, { ...base, loans: [personal] })
    expect(distressDebtOf(accountsOf(world, person.id), 0 as Money)).toBe(800_000)
  })

  it('counts what the roof is behind on, mortgage or not', () => {
    const world = createWorld(makeSeed(4141), 120)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    const base = accountsOf(world, person.id)
    world.accounts.set(person.id, { ...base, loans: [aMortgage(0)] })
    // Arrears are the household's own hole and have never been secured
    // against anything.
    expect(distressDebtOf(accountsOf(world, person.id), -250_000 as Money)).toBe(250_000)
  })
})
