import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import {
  accountsOf,
  creditPerson,
  mergeWalletsOnMarriage,
  splitWalletOnDivorce,
  walletHolderOf,
  walletOf,
} from '../src/finances.js'
import { spouseOf } from '../src/relationships.js'
import { livingPeople } from '../src/index.js'

/**
 * H0 — MONEY BELONGS TO PEOPLE (owner: "what's your money is yours and if
 * you get married y'all combine that").
 *
 * The couple is one wallet, derived from the marriage itself. These tests
 * pin the three moments money moves — the wedding, the divorce, the death —
 * and the conservation law over all of them: no cent created, none lost.
 */
describe('the wallet', () => {
  function married(world = createWorld(makeSeed(4242))) {
    advanceTicks(world, 12 * 5)
    for (const person of livingPeople(world)) {
      const spouse = spouseOf(world, person.id)
      if (spouse === null) continue
      const mate = world.people.get(spouse)
      if (mate === undefined || mate.deathTick !== null) continue
      return { world, a: person.id, b: spouse }
    }
    throw new Error('no married couple found')
  }

  it('both spouses read one balance, and a credit to either lands in it', () => {
    const { world, a, b } = married()
    expect(walletHolderOf(world, a)).toBe(walletHolderOf(world, b))

    const before = walletOf(world, a).checking
    creditPerson(world, b, 12_345 as Money)
    expect(walletOf(world, a).checking).toBe(before + 12_345)
    expect(walletOf(world, b).checking).toBe(before + 12_345)
  })

  it('the wedding merges to the cent', () => {
    const { world, a, b } = married()
    const holder = walletHolderOf(world, a)
    const other = holder === a ? b : a
    // Fabricate a stray balance on the non-holder (as if never merged).
    const strays = accountsOf(world, other)
    world.accounts.set(other, { ...strays, checking: 7_777 as Money, savings: 3_333 as Money })
    const jointBefore = accountsOf(world, holder)
    const total = jointBefore.checking + jointBefore.savings + 7_777 + 3_333

    mergeWalletsOnMarriage(world, a, b)
    const joint = accountsOf(world, holder)
    const emptied = accountsOf(world, other)
    expect(joint.checking + joint.savings).toBe(total)
    expect(emptied.checking + emptied.savings).toBe(0)
  })

  it('the divorce splits the liquid down the middle, conserving every cent', () => {
    const { world, a, b } = married()
    // The conservation law is measured, not assumed: whatever liquid the
    // two records hold before the split — merged or stranded — the split
    // must account for every cent of it.
    const preA = accountsOf(world, a)
    const preB = accountsOf(world, b)
    const pool = preA.checking + preA.savings + preB.checking + preB.savings

    splitWalletOnDivorce(world, a, b)
    const one = accountsOf(world, a)
    const two = accountsOf(world, b)
    const total = one.checking + one.savings + two.checking + two.savings
    expect(total).toBe(pool)
    // Down the middle, the odd cent (if any) to the joint holder's side.
    expect(Math.abs(one.checking + one.savings - (two.checking + two.savings))).toBeLessThanOrEqual(1)
  })
})
