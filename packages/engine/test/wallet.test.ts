import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import {
  accountsOf,
  creditPerson,
  mergeWalletsOnMarriage,
  payDownLoan,
  splitWalletOnDivorce,
  takeLoan,
  walletHolderOf,
  walletOf,
} from '../src/finances.js'
import { buyChipsPlayer, setPlayer } from '../src/player.js'
import { gamblerOf } from '../src/casino.js'
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

  it('no married non-holder ever carries a shadow ledger', () => {
    // THE INVARIANT BEHIND TWO LIVE BUG REPORTS (owner: a mortgage paid
    // off "taking nothing from my actual money"; "unlimited chips"). Every
    // liquid credit and debit routes through the wallet, so the raw record
    // of a spouse who is not the wallet holder must stay at exactly zero —
    // any balance accumulating there is income the Money tab never shows
    // and loan payoffs quietly spend.
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 10)
    let checkedSpouses = 0
    for (const person of livingPeople(world)) {
      if (walletHolderOf(world, person.id) === person.id) continue
      checkedSpouses++
      const raw = accountsOf(world, person.id)
      expect(raw.checking, `person ${String(person.id)} has shadow checking`).toBe(0)
      expect(raw.savings, `person ${String(person.id)} has shadow savings`).toBe(0)
    }
    expect(checkedSpouses, 'no married couples in ten years').toBeGreaterThan(0)
  })

  it('a loan pay-down draws the joint wallet to the cent', () => {
    const { world, a, b } = married()
    const payer = walletHolderOf(world, a) === a ? b : a
    // A real loan on the payer's own file, principal to the joint wallet.
    expect(takeLoan(world, world.tick, payer, 'personal', 500_000 as Money)).toBe(true)
    const before = walletOf(world, payer)
    const liquidBefore = Math.max(0, before.checking) + Math.max(0, before.savings)
    expect(liquidBefore).toBeGreaterThan(0)

    const paid = payDownLoan(world, world.tick, payer, 'personal', 400_000 as Money)
    expect(paid).toBeGreaterThan(0)
    const after = walletOf(world, payer)
    // Every cent paid left the couple's visible balance — no shadow money.
    expect(before.checking + before.savings - (after.checking + after.savings)).toBe(paid)
    const loan = accountsOf(world, payer).loans.find((l) => l.kind === 'personal')
    expect((loan?.balance ?? 0) < 500_000).toBe(true)
  })

  it('the cashier only credits chips for money actually taken', () => {
    const { world, a, b } = married()
    const player = walletHolderOf(world, a) === a ? b : a
    setPlayer(world, player)
    const wallet = walletOf(world, player)
    // A known joint balance, then buy more chips than the couple holds.
    world.accounts.set(wallet.personId, { ...wallet, checking: 30_000 as Money, savings: 0 as Money })
    expect(buyChipsPlayer(world, 100_000 as Money).done).toBe(false)

    // Within the balance: the tray gets exactly what the window took.
    expect(buyChipsPlayer(world, 20_000 as Money).done).toBe(true)
    expect(gamblerOf(world, player).chips).toBe(20_000)
    expect(walletOf(world, player).checking).toBe(10_000)

    // Broke: no chips, no phantom credit — the unlimited-chips exploit.
    const drained = walletOf(world, player)
    world.accounts.set(drained.personId, { ...drained, checking: 0 as Money, savings: 0 as Money })
    const refused = buyChipsPlayer(world, 20_000 as Money)
    expect(refused.done).toBe(false)
    expect(gamblerOf(world, player).chips).toBe(20_000)
  })
})
