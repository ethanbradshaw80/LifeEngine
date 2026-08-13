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
import { advanceTicks, createWorld } from '../src/index.js'
import {
  FULL_LIFE_YEARS,
  announcementFor,
  defaultBirthTick,
  householdWordsFor,
  parentWorkFor,
  planBirth,
  registryNoFor,
  seedFromRegistryNo,
  registerBirth,
} from '../src/birth.js'
import type { BirthRequest } from '../src/birth.js'
import { accountsOf } from '../src/finances.js'

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
  it('YOU ARE BORN AT AGE ZERO, which is the whole point of a birth', () => {
    const world = createWorld(makeSeed(4471), 400)
    // THE BUG THIS PINS, found by playing rather than by testing: this
    // used to return the world's tick minus twenty-four years, so "Begin
    // life" dropped the player in as a twenty-four-year-old and the entire
    // education module was unreachable from the front door.
    expect(defaultBirthTick(world.tick)).toBe(world.tick)
  })

  it('and the registered child really is a newborn', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    expect(childId).not.toBeNull()
    if (childId === null) return
    const child = world.people.get(childId)
    expect(child).toBeDefined()
    if (child === undefined) return
    // Zero months old. The previous test asserted only that the birth tick
    // was somewhere between zero and now — true of a newborn AND of a
    // twenty-four-year-old, which is exactly why it passed while the
    // feature was broken. An assertion that cannot fail on the bug is not
    // a test of the bug.
    const ageMonths = world.tick - child.birthTick
    expect(ageMonths).toBe(0)
  })

  it('there is still a whole life ahead to play', () => {
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

describe('the family is real, not set dressing', () => {
  it('registers everybody the certificate names', () => {
    const world = createWorld(makeSeed(4471), 400)
    const before = world.people.size
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    expect(childId).not.toBeNull()
    if (childId === null) return
    // Everybody on the document exists in the world.
    expect(world.people.size).toBe(before + plan.family.length + 1)
    const child = world.people.get(childId)
    expect(child?.givenName).toBe('Gary')
    expect(child?.familyName).toBe('Lewis')
  })

  it('the child has real parents, and they are the ones on the certificate', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    if (childId === null) return
    const child = world.people.get(childId)
    expect(child?.parentIds.length).toBe(2)
    const parents = (child?.parentIds ?? []).map((id) => world.people.get(id))
    expect(parents.every((p) => p !== undefined)).toBe(true)
    // The father carries the name.
    expect(parents.some((p) => p?.sex === 'male' && p.familyName === 'Lewis')).toBe(true)
    expect(parents.some((p) => p?.sex === 'female')).toBe(true)
  })

  it('siblings are the parents\' children too', () => {
    const world = createWorld(makeSeed(4471), 400)
    // Find a seed that produces a sibling.
    for (let seed = 1; seed <= 40; seed += 1) {
      const plan = planBirth(world, REQUEST, seed)
      if (!plan.family.some((m) => m.relation === 'sibling')) continue
      const childId = registerBirth(world, plan, seed)
      if (childId === null) return
      const child = world.people.get(childId)
      const household = world.households.get(child?.householdId ?? (0 as never))
      const siblings = (household?.memberIds ?? [])
        .map((id) => world.people.get(id))
        .filter((p) => p !== undefined && p.id !== childId && p.parentIds.length > 0)
      // Without this a brother is a stranger who shares a surname and a
      // roof, and every kinship read in the game disagrees with the
      // certificate.
      expect(siblings.length).toBeGreaterThan(0)
      return
    }
  })

  it('the parents are older than the child, by the years the document says', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    if (childId === null) return
    const child = world.people.get(childId)
    const father = plan.family.find((m) => m.relation === 'father')
    const registered = (child?.parentIds ?? [])
      .map((id) => world.people.get(id))
      .find((p) => p?.sex === 'male')
    expect(father).toBeDefined()
    expect(registered).toBeDefined()
    if (father === undefined || registered === undefined || child === undefined) return
    // The certificate says the father was twenty-nine when you were born,
    // and the world has to agree with the certificate.
    const gap = Math.round((child.birthTick - registered.birthTick) / 12)
    expect(gap).toBe(father.ageYears)
  })

  it('a household exists, and money follows the station', () => {
    const world = createWorld(makeSeed(4471), 400)
    const poor = registerBirth(world, planBirth(world, { ...REQUEST, station: 50 }, 11), 11)
    const rich = registerBirth(world, planBirth(world, { ...REQUEST, station: 950 }, 12), 12)
    if (poor === null || rich === null) return
    const poorHome = world.households.get(world.people.get(poor)?.householdId ?? (0 as never))
    const richHome = world.households.get(world.people.get(rich)?.householdId ?? (0 as never))
    expect(poorHome).toBeDefined()
    expect(richHome).toBeDefined()
    // A silver-spoon birth that started with the same balance as a
    // hard-up one would make the dial a label. H0: the station money lives
    // on the HEAD PARENT'S WALLET now — the household pot is retired and
    // frozen at zero, so comparing pots would compare two zeros.
    expect(richHome?.savings ?? -1).toBe(0)
    expect(poorHome?.savings ?? -1).toBe(0)
    const liquidOf = (home: typeof poorHome): number =>
      (home?.memberIds ?? []).reduce((total, id) => {
        const member = world.people.get(id)
        if (!member || member.deathTick !== null) return total
        const a = accountsOf(world, id)
        return total + a.checking + a.savings
      }, 0)
    expect(liquidOf(richHome)).toBeGreaterThan(liquidOf(poorHome))
  })

  it('the same seed registers the same family twice over', () => {
    const a = createWorld(makeSeed(4471), 400)
    const b = createWorld(makeSeed(4471), 400)
    const ca = registerBirth(a, planBirth(a, REQUEST, 999), 999)
    const cb = registerBirth(b, planBirth(b, REQUEST, 999), 999)
    if (ca === null || cb === null) return
    const namesOf = (world: typeof a, id: typeof ca): string[] => {
      const person = world.people.get(id)
      const home = world.households.get(person?.householdId ?? (0 as never))
      return (home?.memberIds ?? [])
        .map((m) => world.people.get(m))
        .map((p) => `${p?.givenName ?? ''} ${p?.familyName ?? ''}`)
    }
    expect(namesOf(a, ca)).toEqual(namesOf(b, cb))
  })

  it('and the family keeps living after the birth', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    if (childId === null) return
    const before = world.people.get(childId)?.birthTick ?? 0
    advanceTicks(world, 24)
    // They persist, age, and can die — the spec's own words.
    const child = world.people.get(childId)
    expect(child).toBeDefined()
    expect(child?.birthTick).toBe(before)
    expect(world.tick).toBeGreaterThan(before)
  })
})


describe('a life born at the front door actually gets lived', () => {
  /**
   * THE BUG A PLAYER FOUND IN ONE SITTING: "I just started a life and
   * never went through any school."
   *
   * It was TWO bugs stacked, and the first hid the second. The birth tick
   * was backdated twenty-four years, so you began as an adult; and even
   * once that was fixed the child had NO EDUCATION RECORD, and
   * `runEducation` opens with `if (!record) continue` — so the schools
   * could not see them and never would, for life.
   */
  it('goes to school, all the way up the ladder', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    expect(childId).not.toBeNull()
    if (childId === null) return

    const seen = new Set<string>()
    for (let year = 0; year < 20; year += 1) {
      advanceTicks(world, 12)
      const record = world.education.get(childId)
      if (record?.enrolledIn != null) seen.add(record.enrolledIn)
      if (record != null && record.level !== 'none') seen.add(record.level)
    }
    // A childhood is primary, then middle, then secondary. If any of these
    // is missing the front door has quietly skipped part of a life.
    expect(seen.has('primary'), 'never went to primary').toBe(true)
    expect(seen.has('middle'), 'never went to middle school').toBe(true)
    expect(seen.has('secondary'), 'never went to secondary').toBe(true)
  })

  it('and everybody in the family is visible to the schools', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    if (childId === null) return
    const child = world.people.get(childId)
    const home = world.households.get(child?.householdId ?? (0 as never))
    // A parent with no schooling on file reads as unqualified for every
    // job in the game, so the record matters for them too.
    for (const id of home?.memberIds ?? []) {
      expect(world.education.get(id), `member ${String(id)} has no education record`).toBeDefined()
    }
  })

  it('the parents left school and the newborn has not started', () => {
    const world = createWorld(makeSeed(4471), 400)
    const plan = planBirth(world, REQUEST, 4471)
    const childId = registerBirth(world, plan, 4471)
    if (childId === null) return
    expect(world.education.get(childId)?.level).toBe('none')
    const child = world.people.get(childId)
    for (const parentId of child?.parentIds ?? []) {
      // Adults are not blank slates — worldgen decides what they finished.
      expect(world.education.get(parentId)).toBeDefined()
    }
  })
})
