/**
 * M-ECON §1. The money belongs to people.
 *
 * WHAT THIS REPLACES: one pot per roof. Every wage went into it and
 * everything was paid out of it, so a working adult's money was not theirs,
 * an inheritance came from a building, and a personal surplus had nowhere
 * to exist. The household now keeps only its SHARED OBLIGATIONS.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  accountsOf,
  householdCosts,
  householdWealth,
  netWorthOf,
  personalIncome,
} from '../src/finances.js'
import type { World } from '../src/types.js'

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
    const behind = [...world.households.values()].filter((h) => h.savings < 0)
    // Some households struggle — that is Law 10, and every consequence that
    // reads arrears depends on this still happening.
    expect(behind.length).toBeGreaterThan(0)
    expect(world.events.some((e) => e.type === 'fell-behind')).toBe(true)
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

  it('takes the household from earners in proportion to what they earn', () => {
    // A household where one person earns and another does not: the earner
    // carries it, and the non-earner is not overdrawn to pay for a roof
    // they cannot fund.
    const world = grown(4141, 120)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null) continue
      if (householdCosts(world, household) <= 0) continue
      for (const memberId of household.memberIds) {
        const member = world.people.get(memberId)
        if (!member || member.deathTick !== null) continue
        if (personalIncome(world, memberId) > 0) continue
        // Nobody's own accounts are driven negative by the household: a
        // shortfall is the HOUSEHOLD's arrears, which is what that is for.
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
