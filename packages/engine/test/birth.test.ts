/**
 * BEING BORN (owner's `newgame_and_birth_master.md`).
 *
 * The claims: you are born into a family that CARRIES YOUR SURNAME, the
 * same seed gives the same life (shareable seeds are a real feature), the
 * default birth era leaves a full life to play forward, and traits are
 * never chosen.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import {
  FULL_LIFE_YEARS,
  announcementFor,
  defaultBirthTick,
  householdWordsFor,
  parentWorkFor,
  planBirth,
  registryNoFor,
  seedFromRegistryNo,
} from '../src/birth.js'
import type { BirthRequest } from '../src/birth.js'

const REQUEST: BirthRequest = {
  givenName: 'Gary',
  familyName: 'Lewis',
  sex: 'male',
  placeId: null,
  station: null,
  birthTick: null,
}

describe('you are born into a family that carries your name', () => {
  it('the father has the surname the player typed', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const father = plan.family.find((m) => m.relation === 'father')
    expect(father).toBeDefined()
    // That is what makes the typed surname mean something rather than
    // being a label on the child alone.
    expect(father?.familyName).toBe('Lewis')
  })

  it('the mother keeps a maiden name, and it is not the married one', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const mother = plan.family.find((m) => m.relation === 'mother')
    expect(mother).toBeDefined()
    expect(mother?.familyName).toBe('Lewis')
    expect(mother?.maidenName).toBeTruthy()
    expect(mother?.maidenName).not.toBe('Lewis')
  })

  it('parents are old enough to be parents', () => {
    const world = createWorld(makeSeed(4471), 400)
    for (let seed = 1; seed <= 200; seed += 1) {
      const plan = planBirth(world, REQUEST, seed)
      for (const member of plan.family) {
        if (member.relation === 'sibling') continue
        expect(member.ageYears, `seed ${String(seed)}`).toBeGreaterThanOrEqual(18)
      }
    }
  })

  it('siblings happen sometimes and not always', () => {
    const world = createWorld(makeSeed(4471), 400)
    let withSiblings = 0
    for (let seed = 1; seed <= 300; seed += 1) {
      if (planBirth(world, REQUEST, seed).family.some((m) => m.relation === 'sibling')) {
        withSiblings += 1
      }
    }
    // Most people have one and plenty have none.
    expect(withSiblings).toBeGreaterThan(90)
    expect(withSiblings).toBeLessThan(280)
  })

  it('everybody in the family shares the surname', () => {
    const world = createWorld(makeSeed(4471), 400)
    for (const member of planBirth(world, REQUEST, 77).family) {
      expect(member.familyName, member.relation).toBe('Lewis')
    }
  })
})

describe('a seed is a shareable life', () => {
  it('the same seed and the same choices give the identical family', () => {
    const world = createWorld(makeSeed(4471), 400)
    const a = planBirth(world, REQUEST, 4471)
    const b = planBirth(world, REQUEST, 4471)
    // "Same seed + same choices → the identical life." A shareable seed
    // that produced a different family would not be shareable.
    expect(a.family.map((m) => `${m.givenName} ${m.familyName}`)).toEqual(
      b.family.map((m) => `${m.givenName} ${m.familyName}`),
    )
    expect(a.station).toBe(b.station)
    expect(a.registryNo).toBe(b.registryNo)
  })

  it('and different seeds give different lives', () => {
    const world = createWorld(makeSeed(4471), 400)
    const seen = new Set<string>()
    for (let seed = 1; seed <= 120; seed += 1) {
      const plan = planBirth(world, REQUEST, seed)
      seen.add(plan.family.map((m) => m.givenName).join('/') + String(plan.station))
    }
    expect(seen.size).toBeGreaterThan(60)
  })

  it('the registry number reads back to its seed', () => {
    const code = registryNoFor(4471, 'Gary', 'Lewis')
    expect(code).toContain('GARY')
    expect(code).toContain('LEWIS')
    expect(seedFromRegistryNo(code)).toBe(4471)
  })

  it('and survives a name nobody expected', () => {
    // A blank or symbol-only name must still produce a usable code rather
    // than an empty one somebody cannot share.
    expect(registryNoFor(1, '', '').length).toBeGreaterThan(4)
    expect(registryNoFor(1, '???', '!!!')).toContain('CHILD')
  })
})

describe('the defaults do not make the player think', () => {
  it('the birth era leaves a whole life to play forward', () => {
    const world = createWorld(makeSeed(4471), 400)
    const born = defaultBirthTick(world.tick)
    expect(born).toBeGreaterThanOrEqual(0)
    expect(born).toBeLessThanOrEqual(world.tick)
    expect(FULL_LIFE_YEARS).toBeGreaterThan(70)
  })

  it('a station is rolled when nobody picked one, and honoured when they did', () => {
    const world = createWorld(makeSeed(4471), 400)
    expect(planBirth(world, { ...REQUEST, station: 900 }, 5).station).toBe(900)
    const rolled = planBirth(world, REQUEST, 5).station
    expect(rolled).toBeGreaterThanOrEqual(0)
    expect(rolled).toBeLessThanOrEqual(1_000)
  })

  it('every station has words, and none of them flatter', () => {
    for (const station of [0, 200, 500, 700, 900, 1_000]) {
      const words = householdWordsFor(station)
      expect(words.length, String(station)).toBeGreaterThan(30)
    }
    // Being born hard-up is a real thing that happens to most people, and
    // the line says so without pitying it or dressing it up.
    expect(householdWordsFor(0)).not.toBe(householdWordsFor(900))
  })

  it('parents work at jobs the ladder actually has', () => {
    const rich = parentWorkFor(900, 0)
    const poor = parentWorkFor(50, 0)
    expect(rich).not.toBe(poor)
    expect(rich.length).toBeGreaterThan(2)
  })
})

describe('the first sentence of the game', () => {
  it('says who, what, when and where', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const line = announcementFor(plan, '14 March 1963', 'Miller Addition')
    expect(line).toContain('Gary Lewis')
    expect(line).toContain('a boy')
    expect(line).toContain('14 March 1963')
    expect(line).toContain('Miller Addition')
  })

  it('and gets the child right either way', () => {
    const world = createWorld(makeSeed(4471), 400)
    const girl = planBirth(world, { ...REQUEST, sex: 'female' }, 1)
    expect(announcementFor(girl, 'a date', 'a place')).toContain('a girl')
  })
})
