/**
 * Crime and justice. C1 (CRIME_PLAN.md).
 *
 * The claims: theft has modelled motive and moves REAL money through the
 * finances-owned helper (conservation to the cent); the chain
 * theft → arrest → verdict is fully recorded; jail is absence (no work, no
 * wage, the county feeds them); the record gates hiring and the recruiting
 * office but never rewrites history; and the world does not become a den of
 * thieves — crime stays rare because desperation is rare.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { criminalRecordOf, hasRecentConviction, isJailed, gateStrengthOf } from '../src/crime.js'
import { accountsOf, householdWealth, transferBetweenHouseholds } from '../src/finances.js'
import { advanceTicks, createWorld, enlistmentBar } from '../src/index.js'
import { worldHashHex } from '../src/snapshot.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function grownWorld(ticks = 600): World {
  const world = createWorld(makeSeed(12345), 100)
  advanceTicks(world, ticks)
  return world
}

describe('the money', () => {
  it('moves to the cent, and never conjures', () => {
    // M-ECON §1: a theft moves PEOPLE'S money, so conservation is checked
    // across what the people under each roof hold.
    const world = createWorld(makeSeed(12345), 100)
    const households = [...world.households.values()].filter(
      (h) => householdWealth(world, h) > 50_000,
    )
    const [a, b] = households
    if (!a || !b) throw new Error('a poor town')
    const totalBefore = householdWealth(world, a) + householdWealth(world, b)

    const moved = transferBetweenHouseholds(world, world.tick, a.id, b.id, 30_000)
    expect(moved).toBe(30_000)
    expect(householdWealth(world, a) + householdWealth(world, b)).toBe(totalBefore)

    // Clamped to what the source actually HOLDS IN CASH: no negative theft.
    // Since H2 a founding household usually owns its home, and the house is
    // in `householdWealth` — a burglar does not carry off the deed, so the
    // ceiling is the people's liquid money, not their net worth.
    const liquidOf = (h: typeof a): number =>
      h.memberIds.reduce((total, id) => {
        const member = world.people.get(id)
        if (!member || member.deathTick !== null) return total
        const accounts = accountsOf(world, id)
        return total + Math.max(0, accounts.savings) + Math.max(0, accounts.checking)
      }, 0)
    const left = liquidOf(a)
    const drained = transferBetweenHouseholds(world, world.tick, a.id, b.id, 99_999_999)
    expect(drained).toBe(left)
    expect(liquidOf(a)).toBe(0)
  })
})

describe('the chain', () => {
  it('every conviction cites an arrest, and an offence, on the same person', () => {
    const world = grownWorld(900)
    const convictions = world.events.filter((e) => e.type === 'was-convicted')
    for (const conviction of convictions) {
      expect(
        world.events.some(
          (e) => e.type === 'was-arrested' && e.subjectId === conviction.subjectId && e.tick === conviction.tick,
        ),
      ).toBe(true)
      // AN OFFENCE, not specifically a theft: a town's docket is mostly
      // drink, tempers and cars, and NPCs draw from the whole table now.
      // The chain itself is the claim — nobody is convicted of nothing.
      expect(
        world.events.some(
          (e) =>
            (e.type === 'committed-theft' || e.type === 'committed-offence') &&
            e.subjectId === conviction.subjectId &&
            e.tick === conviction.tick,
        ),
      ).toBe(true)
      // And the map agrees with the events.
      const record = criminalRecordOf(world, conviction.subjectId)
      expect(record).toBeDefined()
      expect(record?.convictions.some((c) => c.tick === conviction.tick)).toBe(true)
    }
  })

  it('crime exists and stays rare — a town, not a den', () => {
    const world = grownWorld(900)
    // BOTH KINDS. C3 gave NPCs the whole catalogue, so most of what a town
    // does is a 'committed-offence' and the plain C1 theft is now the
    // minority case — a seed can produce none at all.
    const thefts = world.events.filter(
      (e) => e.type === 'committed-theft' || e.type === 'committed-offence',
    ).length
    expect(thefts).toBeGreaterThan(0)
    // BOUND RAISED WITH THE MEASUREMENT, not to get a green result. This
    // counted THEFTS ONLY when C1 was theft-only; it now counts the whole
    // docket, which C3 §16 deliberately widened after the owner found that
    // fifty years of a hundred and forty people produced one to three
    // crimes and almost no convictions.
    //
    // Measured at 211 across seventy-five years and ~a hundred people —
    // about 2.8 offences a year, against a real small-town rate of roughly
    // 2-3 per hundred people per year. The ceiling still catches "a den":
    // one a week would be 3,900.
    expect(thefts).toBeLessThan(400)
  })
})

describe('determinism under crime', () => {
  // The committed golden window (120 ticks) contains no theft, so without
  // this net every C1 draw sits OUTSIDE the byte-level determinism tests
  // (review round 2): a regression in victim-sort totality or draw order
  // would pass golden and only corrupt long games. Two independent runs
  // over a window that provably contains crime must agree to the byte.
  it('two runs agree to the byte across a window that contains crime', () => {
    const a = grownWorld(900)
    const b = grownWorld(900)
    // The window must PROVABLY contain crime — of either kind, since C3.
    expect(
      a.events.some((e) => e.type === 'committed-theft' || e.type === 'committed-offence'),
    ).toBe(true)
    expect(worldHashHex(a)).toBe(worldHashHex(b))
  })
})

describe('jail is absence, and the record follows', () => {
  it('nobody works from a cell, and the door closes at the recruiting office', () => {
    const world = grownWorld(900)
    for (const [personId, record] of world.criminal) {
      if (record.jailedUntilTick !== null && world.tick < record.jailedUntilTick) {
        expect(world.employment.has(personId)).toBe(false)
      }
    }
    // A recent conviction bars enlistment, in words — and "recent" is now
    // the HARD window specifically (C3 §5). A misdemeanor four years old no
    // longer shuts this door, which is the whole point of grading the gate,
    // so the assertion asks about a conviction inside its own hard window.
    const convicted = [...world.criminal.values()].find((r) =>
      r.convictions.some((c) => gateStrengthOf(c, world.tick) === 'hard'),
    )
    if (convicted) {
      const person = livingPeople(world).find((p) => p.id === convicted.personId)
      if (person) {
        const bar = enlistmentBar(world, person, world.tick)
        expect(bar).not.toBeNull()
      }
    }

    // And an old, light conviction does NOT — a door that got heavier, not
    // one that shut.
    const faded = [...world.criminal.values()].find(
      (r) =>
        r.convictions.length > 0 &&
        r.convictions.every((c) => gateStrengthOf(c, world.tick) === 'none') &&
        (r.probationUntilTick ?? null) === null &&
        r.jailedUntilTick === null,
    )
    if (faded) {
      const person = livingPeople(world).find((p) => p.id === faded.personId)
      // Age and the one-career rule can still bar them; what must not is
      // the record.
      if (person) {
        expect(enlistmentBar(world, person, world.tick)).not.toBe(
          'The record at the courthouse answers first.',
        )
      }
    }
  })

  it('history never shortens; gates read recency', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = livingPeople(world)[0]
    if (!person) throw new Error('empty town')
    world.criminal.set(person.id, {
      personId: person.id,
      convictions: [{ kind: 'theft', tick: (world.tick - 200) as never, sentenceMonths: 6, fine: 0 }],
      jailedUntilTick: null,
    })
    // Sixteen years on: the conviction still EXISTS but no longer gates.
    expect(criminalRecordOf(world, person.id)?.convictions.length).toBe(1)
    expect(hasRecentConviction(world, person.id)).toBe(false)
    expect(isJailed(world, person.id)).toBe(false)
  })
})
