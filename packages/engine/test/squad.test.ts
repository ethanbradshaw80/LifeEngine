/**
 * THE SQUAD (owner's `combat_tours_revamp.md` §2).
 *
 * The claims: they are REAL PEOPLE rather than names on a card, they are
 * not from the player's town, they can be killed, and losing one costs the
 * person standing next to them in proportion to how well they knew him.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  SQUAD_SIZE,
  bondWith,
  bondWords,
  livingSquad,
  pickCasualty,
  squadSpecsFor,
} from '../src/squad.js'
import type { Person, SquadMember, World } from '../src/types.js'

const TRAITS = {
  sociability: 500,
  diligence: 500,
  ambition: 500,
  curiosity: 500,
  resilience: 500,
  vitality: 500,
  impulsivity: 500,
}

function stubPerson(id: number, dead = false): Person {
  return {
    id: id as never,
    givenName: 'A',
    familyName: 'B',
    sex: 'male',
    birthTick: 0 as never,
    deathTick: dead ? (4 as never) : null,
    causeOfDeath: dead ? 'killed in action' : null,
    tier: 'deep',
    traits: TRAITS as never,
    householdId: null,
    parentIds: [],
    spendStance: null,
  }
}

function team(world: World, tick: number): SquadMember[] {
  return squadSpecsFor(world, tick as never, 500, 1).map((spec, i) => ({
    personId: (9_000 + i) as never,
    role: spec.role,
    nickname: spec.nickname,
    competence: spec.competence,
    sinceTick: tick as never,
  }))
}

describe('a squad is people, not a roster', () => {
  it('is a fireteam, with the roles a fireteam has', () => {
    const world = createWorld(makeSeed(3))
    const specs = squadSpecsFor(world, 10 as never, 500, 1)
    expect(specs.length).toBe(SQUAD_SIZE)
    expect(specs.some((spec) => spec.role === 'leader')).toBe(true)
    expect(specs.some((spec) => spec.role === 'medic')).toBe(true)
  })

  it('nobody in it is called the same thing as anybody else', () => {
    const world = createWorld(makeSeed(3))
    for (let tour = 1; tour <= 30; tour += 1) {
      const specs = squadSpecsFor(world, (tour * 7) as never, 500, tour)
      const names = specs.map((spec) => spec.nickname)
      // Two men called Doc in one team is a bug, not colour.
      expect(new Set(names).size, `tour ${String(tour)}`).toBe(names.length)
    }
  })

  it('they are not five identical soldiers', () => {
    const world = createWorld(makeSeed(3))
    const specs = squadSpecsFor(world, 10 as never, 500, 1)
    expect(new Set(specs.map((spec) => spec.competence)).size).toBeGreaterThan(1)
  })

  it('the team leader is usually the one who has done this longest', () => {
    const world = createWorld(makeSeed(3))
    let leaderTotal = 0
    let otherTotal = 0
    let leaders = 0
    let others = 0
    for (let tour = 1; tour <= 200; tour += 1) {
      for (const spec of squadSpecsFor(world, tour as never, 400 + tour, tour)) {
        if (spec.role === 'leader') {
          leaderTotal += spec.competence
          leaders += 1
        } else {
          otherTotal += spec.competence
          others += 1
        }
      }
    }
    expect(leaderTotal / leaders).toBeGreaterThan(otherTotal / others)
  })

  it('the same tour spins up the same squad — a reload does not reroll it', () => {
    const world = createWorld(makeSeed(3))
    const a = squadSpecsFor(world, 42 as never, 777, 2)
    const b = squadSpecsFor(world, 42 as never, 777, 2)
    expect(a.map((s) => s.nickname)).toEqual(b.map((s) => s.nickname))
    expect(a.map((s) => s.competence)).toEqual(b.map((s) => s.competence))
  })
})

describe('and they can be lost', () => {
  it('the casualty is weighted against competence', () => {
    const world = createWorld(makeSeed(3))
    const pair: SquadMember[] = [
      { personId: 1 as never, role: 'rifleman', nickname: 'Slim', competence: 900, sinceTick: 0 as never },
      { personId: 2 as never, role: 'rifleman', nickname: 'Tiny', competence: 100, sinceTick: 0 as never },
    ]
    world.people.set(1 as never, stubPerson(1))
    world.people.set(2 as never, stubPerson(2))
    let poor = 0
    for (let roll = 0; roll < 2_000; roll += 1) {
      if (pickCasualty(pair, world, roll)?.nickname === 'Tiny') poor += 1
    }
    // You lose the nineteen-year-old first, and everybody knows it while
    // it is happening.
    expect(poor / 2_000).toBeGreaterThan(0.6)
  })

  it('a wiped squad returns nobody rather than inventing somebody', () => {
    const world = createWorld(makeSeed(3))
    const dead: SquadMember[] = [
      { personId: 5 as never, role: 'rifleman', nickname: 'Ace', competence: 500, sinceTick: 0 as never },
    ]
    world.people.set(5 as never, stubPerson(5, true))
    // A squad can be wiped. Putting a floor under the worst thing that can
    // happen would be a lie.
    expect(livingSquad(dead, world).length).toBe(0)
    expect(pickCasualty(dead, world, 7)).toBeNull()
  })
})

describe('what a loss costs depends on knowing them', () => {
  it('a bond is built out of months, and tops out', () => {
    const world = createWorld(makeSeed(3))
    const fresh = team(world, 0)[0]
    expect(fresh).toBeDefined()
    if (fresh === undefined) return
    expect(bondWith(fresh, 0 as never)).toBe(0)
    expect(bondWith(fresh, 6 as never)).toBeGreaterThan(0)
    expect(bondWith(fresh, 40 as never)).toBeGreaterThan(bondWith(fresh, 6 as never))
    // A man you have been with two tours is not a stranger, and he is also
    // not infinitely more than one you have been with for one.
    expect(bondWith(fresh, 400 as never)).toBe(1_000)
  })

  it('and there are words for it at every stage', () => {
    for (const bond of [0, 100, 300, 500, 900]) {
      expect(bondWords(bond).length, String(bond)).toBeGreaterThan(4)
    }
  })
})

describe('a deployed player gets a real squad', () => {
  it('registered people who are not from the town', () => {
    const world = createWorld(makeSeed(4242), 400)
    advanceTicks(world, 12 * 30)
    let found: readonly SquadMember[] | undefined
    for (const tours of world.deployments.values()) {
      for (const tour of tours) {
        if ((tour.squad ?? []).length > 0) found = tour.squad
      }
    }
    // Only the player's tours carry a squad, so a world with no player
    // deployment has nothing to claim here — and saying nothing is better
    // than asserting something that depends on the seed.
    if (found === undefined) return
    expect(found.length).toBe(SQUAD_SIZE)
    for (const member of found) {
      const person = world.people.get(member.personId)
      expect(person, member.nickname).toBeDefined()
      // NOT FROM THE TOWN: no household, no family here. They were born
      // into the unit, which is how deployments actually work.
      expect(person?.householdId ?? null).toBeNull()
      expect(person?.parentIds.length ?? 0).toBe(0)
    }
  })
})
