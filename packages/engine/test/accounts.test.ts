/**
 * M-ECON §1. The money belongs to people.
 *
 * WHAT THIS REPLACES: one pot per roof. Every wage went into it and
 * everything was paid out of it, so a working adult's money was not theirs,
 * an inheritance came from a building, and a personal surplus had nowhere
 * to exist. The household now keeps only its SHARED OBLIGATIONS.
 */

import { describe, expect, it } from 'vitest'
import { ageAt } from '../src/clock.js'
import { chooseSpendStance, setPlayer } from '../src/player.js'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  accountsOf,
  householdCosts,
  householdWealth,
  netWorthOf,
  personalIncome,
  unitCosts,
  unitsUnder,
  moneyOnHand,
  walletHolderOf,
  walletOf,
} from '../src/finances.js'
import type { Person, World } from '../src/types.js'
import { partnerOf } from '../src/relationships.js'

function grown(seedValue = 12345, ticks = 240): World {
  const world = createWorld(makeSeed(seedValue), 100)
  advanceTicks(world, ticks)
  return world
}

describe('the household holds obligations, not wealth', () => {
  it('never accumulates a surplus of its own', () => {
    const world = grown()
    for (const household of world.households.values()) {
      // Zero when the month was met, negative when it was not. A positive
      // balance here would mean the pot had quietly come back.
      expect(household.savings).toBeLessThanOrEqual(0)
      expect(Number.isInteger(household.savings)).toBe(true)
    }
  })

  it('still falls behind when a month cannot be met', () => {
    const world = grown()
    // Some households struggle — that is Law 10, and every consequence that
    // reads arrears depends on this still happening.
    //
    // THE CLAIM IS ABOUT THE RECORD, NOT ABOUT ONE INSTANT. M-SAFETY put a
    // courthouse and three floors under this: arrears is now usually
    // resolved within months of appearing, so a snapshot of any single tick
    // can legitimately find nobody behind at that moment. What must remain
    // true is that households DO fall behind, which the events say.
    const fellBehind = world.events.filter((e) => e.type === 'fell-behind')
    expect(fellBehind.length).toBeGreaterThan(0)
    // And the state is reachable and readable when it is happening.
    for (const household of world.households.values()) {
      expect(household.savings).toBeLessThanOrEqual(0)
    }
  })
})

describe('people hold the money', () => {
  it('pays the earner, and what is left over stays theirs', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 12)

    let earnersWithMoney = 0
    for (const person of world.people.values()) {
      if (person.deathTick !== null) continue
      if (personalIncome(world, person.id) <= 0) continue
      const accounts = accountsOf(world, person.id)
      expect(Number.isInteger(accounts.checking)).toBe(true)
      expect(Number.isInteger(accounts.savings)).toBe(true)
      if (accounts.checking + accounts.savings > 0) earnersWithMoney++
    }
    expect(earnersWithMoney, 'nobody who earns has any money of their own').toBeGreaterThan(0)
  })

  it('bills the roof to the head and overdraws nobody else for it (H0)', () => {
    // The roof is the head couple's bill and a bad month drives THEIR
    // wallet negative — that is where arrears live now. Everybody else
    // under the roof keeps their own money and is never overdrawn for a
    // house that was not theirs to fund.
    const world = grown(4141, 120)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null) continue
      if (householdCosts(world, household) <= 0) continue
      const head = [...household.memberIds]
        .map((id) => world.people.get(id))
        .filter((p): p is Person => p !== undefined && p.deathTick === null)
        .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
      const headWallet = head === undefined ? -1 : walletHolderOf(world, head.id)
      for (const memberId of household.memberIds) {
        const member = world.people.get(memberId)
        if (!member || member.deathTick !== null) continue
        if (walletHolderOf(world, memberId) === headWallet) continue
        expect(accountsOf(world, memberId).checking).toBeGreaterThanOrEqual(0)
        expect(accountsOf(world, memberId).savings).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('keeps every account an integer, and never conjures money', () => {
    const world = grown(777, 360)
    for (const person of world.people.values()) {
      const a = accountsOf(world, person.id)
      for (const value of [a.checking, a.savings, a.brokerage, a.retirement]) {
        expect(Number.isInteger(value)).toBe(true)
      }
      // H1: debt is a NEGATIVE CHECKING balance — that is the design, not a
      // leak. Every other bucket still never goes below zero.
      for (const value of [a.savings, a.brokerage, a.retirement]) {
        expect(value).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('adds up: a household is worth what its people hold', () => {
    const world = grown(4141, 180)
    for (const household of world.households.values()) {
      const summed = household.memberIds
        .filter((id) => world.people.get(id)?.deathTick === null)
        .reduce((total, id) => total + netWorthOf(world, id), 0)
      expect(householdWealth(world, household)).toBe(summed)
    }
  })
})

describe('an estate is a person', () => {
  it('passes the dead person money, and closes their accounts', () => {
    const world = grown(12345, 600)
    const inherited = world.events.filter((e) => e.type === 'inherited')
    expect(inherited.length, 'nobody inherited in fifty years').toBeGreaterThan(0)
    for (const event of inherited) {
      // The person it came FROM is dead and holds nothing.
      if (event.otherId === null) continue
      expect(world.people.get(event.otherId)?.deathTick).not.toBeNull()
      expect(netWorthOf(world, event.otherId)).toBe(0)
      // And what arrived is a real, positive, integer sum.
      const amount = Number(event.detail ?? '0')
      expect(Number.isInteger(amount)).toBe(true)
      expect(amount).toBeGreaterThan(0)
    }
  })
})

describe('determinism holds through the split', () => {
  it('reproduces every balance from the same seed', () => {
    const a = grown(2024, 180)
    const b = grown(2024, 180)
    for (const person of a.people.values()) {
      expect(netWorthOf(b, person.id)).toBe(netWorthOf(a, person.id))
    }
    for (const household of a.households.values()) {
      expect(b.households.get(household.id)?.savings).toBe(household.savings)
    }
  })
})

describe('a household is a building, not a purse (M-MONEY2)', () => {
  it('makes a grown earner their own unit, and leaves a child in their parents’', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 300)
    let checkedGrown = 0
    let checkedChild = 0
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null) continue
      for (const unit of unitsUnder(world, household)) {
        for (const memberId of unit) {
          const member = world.people.get(memberId)
          if (!member) continue
          const age = ageAt(member.birthTick, world.tick)
          // A CHILD, or a grown adult with no wage of their own, is in a
          // unit with a parent. Dependency is about income, not birthdays.
          if (age < 18) {
            const withParent = unit.some((id) => member.parentIds.includes(id))
            if (member.parentIds.some((id) => household.memberIds.includes(id))) {
              expect(withParent, `a child of the house in nobody's unit`).toBe(true)
              checkedChild++
            }
          }
          // A grown EARNER is never a dependant of their parents.
          if (age >= 18 && personalIncome(world, memberId) > 0) {
            expect(
              unit.some((id) => member.parentIds.includes(id)),
              'a grown earner is still in their parents’ purse',
            ).toBe(false)
            checkedGrown++
          }
        }
      }
    }
    expect(checkedGrown).toBeGreaterThan(0)
    expect(checkedChild).toBeGreaterThan(0)
  })

  it('splits the roof between the units and never charges it twice', () => {
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 240)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null || household.memberIds.length === 0) continue
      const units = unitsUnder(world, household)
      // Every living member is in exactly one unit.
      const seen = new Set<number>()
      for (const unit of units) {
        for (const id of unit) {
          expect(seen.has(id), 'somebody is in two units at once').toBe(false)
          seen.add(id)
        }
      }
      for (const memberId of household.memberIds) {
        if (world.people.get(memberId)?.deathTick !== null) continue
        expect(seen.has(memberId), 'a living member is in no unit').toBe(true)
      }
      // And the parts sum to the whole, to the cent.
      const summed = units.reduce((total, unit) => total + unitCosts(world, household, unit), 0)
      expect(Math.abs(summed - householdCosts(world, household))).toBeLessThanOrEqual(units.length)
    }
  })

  it('lets a grown adult set their own posture under their parents’ roof', () => {
    const world = createWorld(makeSeed(777), 100)
    advanceTicks(world, 360)
    const grown = [...world.people.values()].find(
      (p) =>
        p.deathTick === null &&
        ageAt(p.birthTick, world.tick) >= 18 &&
        p.householdId !== null &&
        p.parentIds.some((id) => world.households.get(p.householdId!)?.memberIds.includes(id)),
    )
    if (!grown) return
    setPlayer(world, grown.id)
    // The old rule refused this outright: "the purse is your parents' to
    // carry". It is their own money now.
    expect(chooseSpendStance(world, 'thrifty').set).toBe(true)
    expect(world.people.get(grown.id)?.spendStance).toBe('thrifty')
    // And it did NOT change their parents'.
    const parent = grown.parentIds.map((id) => world.people.get(id)).find((p) => p !== undefined)
    if (parent) expect(world.people.get(parent.id)?.spendStance).not.toBe('thrifty')
  })
})

/**
 * THE SCREENS MUST AGREE ABOUT WHAT SOMEBODY HAS (owner, playing,
 * 2026-08-14: "now my 'you have' and 'the bank' disagree, it shows I have
 * zero money to put into the account but my money is 1.9 million").
 *
 * H0 keeps a married couple's liquid money as ONE balance on the lower-id
 * spouse's record. Every screen and every verb must read it from the same
 * place, or the half of a couple who does not hold the wallet is shown as
 * penniless while the family is not — and, worse, the buttons grey out
 * against a balance they were never going to spend.
 */
describe('one purse, one number', () => {
  it('reports the same liquid money to both spouses', () => {
    const world = createWorld(makeSeed(24680), 120)
    advanceTicks(world, 30 * 12)
    const married = [...world.people.values()].find(
      (person) => person.deathTick === null && partnerOf(world, person.id) !== null,
    )
    expect(married, 'nobody married in this world').toBeDefined()
    if (!married) return
    const spouse = partnerOf(world, married.id)
    expect(spouse).not.toBeNull()
    if (spouse === null) return

    // Put a known sum in the shared purse.
    const purse = walletOf(world, married.id)
    world.accounts.set(purse.personId, { ...purse, savings: 190_000_000 as Money, checking: 0 as Money })

    // BOTH of them see it, whichever record it physically lives on.
    expect(moneyOnHand(world, married.id)).toBe(190_000_000)
    expect(moneyOnHand(world, spouse)).toBe(190_000_000)

    // And the accounts a screen would render are the SAME accounts for both,
    // which is what the Bank screen got wrong: it read the raw record.
    expect(walletOf(world, married.id).savings).toBe(190_000_000)
    expect(walletOf(world, spouse).savings).toBe(190_000_000)
    expect(walletOf(world, married.id).personId).toBe(walletOf(world, spouse).personId)
  })
})
