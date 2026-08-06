/**
 * Special schools and special units (M-SPECOPS).
 *
 * The claims: schools are capability-named, gated, and badge-granting; unit
 * selection has real gates (badge, rank, feeder, performance), can be
 * failed, allows two tries, and both outcomes go on the record; membership
 * carries duty pay; NPCs walk the same roads; and the tab verbs are logged
 * and honest.
 */

import { describe, expect, it } from 'vitest'
import { CLASSIC_SPEC } from '../src/worldspec.js'
import { unitRosterOf } from '../src/service.js'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { awaitingPlayer, requestSchool, resolvePending, setPlayer, tryOutForUnit } from '../src/player.js'
import { competitiveGates, promotionPointsFor } from '../src/service.js'
import { specialtyById } from '../src/content.js'
import { badgesOf, schoolOptionsFor, servicePayOf, unitOptionsFor } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function aPlayedSoldier(world: World, performance = 700): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 20 && age <= 40
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult')
  setPlayer(world, person.id)
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 3,
    rankSinceTick: world.tick as never,
    qualifications: [],
    enlistedAtTick: (world.tick - 30) as never,
    baseId: person.id,
    monthlyPay: 139_000 as never,
    performance,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: performance * 6,
    unitId: null,
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  world.employment.delete(person.id)
  return person
}

describe('schools', () => {
  it('are gated, badge-granting, and the door states its reason', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = aPlayedSoldier(world)

    const options = schoolOptionsFor(world, person.id)
    const jump = options.find((o) => o.id === 'jump-school')
    expect(jump?.open).toBe(true)
    // A naval course refuses a land-forces rifleman, in words.
    const diver = options.find((o) => o.id === 'combat-diver')
    expect(diver?.open).toBe(false)
    expect(diver?.reason.length).toBeGreaterThan(0)

    // A SEAT, THEN THE CLASS, THEN THE BADGE (owner spec). Asking no longer
    // hands out a qualification on the spot: you are slotted into the next
    // class on the schoolhouse's grid, you wait for it, and graduation pins
    // the badge on. So the test waits too — and it runs the tick loop to do
    // it, because the class only starts and finishes there.
    const asked = requestSchool(world, 'jump-school')
    expect(asked.attended, asked.reason).toBe(true)
    expect(world.service.get(person.id)?.schoolId).toBe('jump-school')

    const startsAt = world.service.get(person.id)?.schoolStartsAtTick ?? world.tick
    const jumpSchool = world.spec.schools.find((sc) => sc.id === 'jump-school')
    expect(jumpSchool).toBeDefined()
    const graduatesAt = startsAt + (jumpSchool?.courseMonths ?? 1)

    while (world.tick <= graduatesAt + 1) {
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }

    expect(badgesOf(world, person.id)).toContain('parachutist')
    // And the seat is given up again once the course is done.
    expect(world.service.get(person.id)?.schoolId).toBeNull()

  })
})

describe('special units', () => {
  it('selection wants the badge first, and says so', () => {
    const world = createWorld(makeSeed(12345), 100)
    aPlayedSoldier(world)
    const result = tryOutForUnit(world, 'pathfinders')
    expect(result.joined).toBe(false)
    expect(result.reason).toContain('parachutist')
  })

  it('the quiet tier draws only from the feeder unit', () => {
    // Every branch has its own chain now (owner's combat plan §1b), so a
    // land soldier is refused Task Unit Ember for the branch before the
    // feeder is even considered — and the LAND tier-2 is the one that names
    // its feeder to him.
    const world = createWorld(makeSeed(12345), 100)
    const person = aPlayedSoldier(world, 900)
    const options = unitOptionsFor(world, person.id)

    const ember = options.find((o) => o.id === 'task-unit-ember')
    expect(ember?.open).toBe(false)
    expect(ember?.reason).toContain('does not feed')

    const vanguard = options.find((o) => o.id === 'vanguard')
    expect(vanguard?.open).toBe(false)
    expect(vanguard?.reason.length).toBeGreaterThan(0)
  })

  it('selection can be failed, both outcomes are recorded, and the file allows two tries', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = aPlayedSoldier(world, 800)
    // Hand the badge over directly — the school path is tested above.
    world.awards.set(person.id, [
      {
        personId: person.id,
        kind: 'qualification-badge',
        title: 'parachutist',
        tick: world.tick,
        qualifyingEventIds: [1],
        issuedBy: 'the Land Forces',
        citation: 'rated parachutist',
        count: 1,
      },
    ])

    // Selection is a played moment now: asking opens the cutscene, and the
    // answer to it is what gets rolled against the unit's denominator.
    let joined = false
    for (let i = 0; i < 2 && !joined; i++) {
      expect(tryOutForUnit(world, 'pathfinders').reason).toBe('')
      expect(world.player.pending?.kind).toBe('unit-moment')
      resolvePending(world, 'push')
      joined = world.service.get(person.id)?.unitId === 'pathfinders'
    }
    if (joined) {
      expect(world.service.get(person.id)?.unitId).toBe('pathfinders')
      expect(world.events.some((e) => e.type === 'joined-unit')).toBe(true)
      // Membership pays: grade pay plus the unit's duty pay. Read from the
      // tables rather than typed, so a reprice moves the claim with the
      // world instead of failing it — the CLAIM is that duty pay is added,
      // not that a corporal earns a particular number this year.
      const record = world.service.get(person.id)
      const duty = CLASSIC_SPEC.units.find((u) => u.id === 'pathfinders')?.dutyPay ?? 0
      expect(duty).toBeGreaterThan(0)
      expect(servicePayOf(world, person.id)).toBe((record?.monthlyPay ?? 0) + duty)
    } else {
      // Two drops on the record; the third asking is refused by the file.
      expect(world.events.filter((e) => e.type === 'dropped-selection').length).toBe(2)
      const third = tryOutForUnit(world, 'pathfinders')
      expect(third.joined).toBe(false)
      expect(third.reason).toContain('Two selections')
      expect(world.player.pending).toBe(null)
    }
    expect(world.player.log.filter((entry) => entry.kind === 'unit-tryout').length).toBeGreaterThan(0)
  })
})

describe('promotion points', () => {
  it('several roads reach the same board — a middling evaluation is not a wall', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = aPlayedSoldier(world, 400) // a so-so evaluation, decent fitness
    const before = promotionPointsFor(world, person.id)
    expect(before.performance).toBe(200)
    expect(before.fitness).toBe(200)

    // Two schools later, the badges alone carry 80 more points.
    world.awards.set(person.id, [
      {
        personId: person.id, kind: 'qualification-badge', title: 'parachutist',
        tick: world.tick, qualifyingEventIds: [1], issuedBy: 'the Land Forces',
        citation: 'rated parachutist', count: 1,
      },
      {
        personId: person.id, kind: 'qualification-badge', title: 'air assault',
        tick: world.tick, qualifyingEventIds: [2], issuedBy: 'the Land Forces',
        citation: 'rated air assault', count: 1,
      },
    ])
    const after = promotionPointsFor(world, person.id)
    expect(after.badges).toBe(80)
    expect(after.total).toBe(before.total + 80)
  })

  it('cutoffs differ by trade, like the real monthly lists', () => {
    const world = createWorld(makeSeed(12345), 100)
    // RANK 4, NOT 3. Corporal is where the competitive ladder now starts —
    // M-PROMO made E-4 a lateral appointment, so a specialist's next step
    // has no gates to compare (the call returns null for a junior step).
    const rifleman = competitiveGates(world, specialtyById('rifleman'), 4)
    const medic = competitiveGates(world, specialtyById('medic'), 4)
    expect(rifleman).not.toBeNull()
    expect(medic).not.toBeNull()
    if (!rifleman || !medic) return
    expect(rifleman.cutoff).toBeLessThan(medic.cutoff)
  })
})

describe('fitness parity', () => {
  it('the test runs for the player whether or not they press anything', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = aPlayedSoldier(world, 700)
    // Zero the score: if the annual test were opt-in, it would stay zero.
    world.service.set(person.id, { ...world.service.get(person.id)!, fitnessScore: 0 })

    let guard = 0
    while (guard < 60 && (world.service.get(person.id)?.fitnessScore ?? 0) === 0) {
      guard++
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTicks(world, 1)
    }
    // Within a service year the mandatory test wrote a real score — and the
    // feed said so.
    expect(world.service.get(person.id)?.fitnessScore ?? 0).toBeGreaterThan(0)
    expect(world.events.some((e) => e.type === 'fitness-tested' && e.subjectId === person.id)).toBe(true)
  })
})

describe('the town serves too', () => {
  it('NPCs earn school badges across the years — the player is not special', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 900)
    const schoolTitles = new Set(['Jump School', 'the Air-Mobile Assault Course', 'Sniper School', 'the Combat Diver Course', 'the Junior Leaders Course'])
    expect(
      world.events.some((e) => e.type === 'completed-training' && schoolTitles.has(e.detail ?? '')),
    ).toBe(true)
  })
})

describe('a selected unit is a unit', () => {
  it('puts you with the people who passed it, and takes you off the old roster', () => {
    // OWNER, PLAYING: "I just got assigned to a special unit after dropping
    // a packet but my actual unit like the people in it didn't change, we
    // should be in a unit with only people who have passed that selection
    // process." The roster was built from base + branch and never read
    // `unitId`, so selection changed a badge and nothing else.
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 480)
    const serving = [...world.service.values()].filter((r) => r.dischargedAtTick === null)
    expect(serving.length).toBeGreaterThan(2)
    // THREE PEOPLE WHO ACTUALLY SHARE A ROSTER. Taking the first three in
    // map order used to work by luck — a roster is base plus branch, and
    // the twelve-year wall changed who is still serving, so the first three
    // stopped being posted together. The test is about what selection does
    // to a roster, so it has to start with people who are on one.
    const a = serving.find(
      (r) => (unitRosterOf(world, r.personId)?.members.length ?? 0) >= 3,
    )
    if (!a) throw new Error('no posting in this world holds three people')
    const roster = unitRosterOf(world, a.personId)
    const [b, c] = (roster?.members ?? [])
      .filter((m) => m.personId !== a.personId)
      .map((m) => serving.find((r) => r.personId === m.personId))
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
    if (!b || !c) throw new Error('the posting lost its people')

    const before = roster
    expect(before?.members.some((m) => m.personId === b.personId)).toBe(true)

    world.service.set(a.personId, { ...a, unitId: 'pathfinders' })
    world.service.set(c.personId, { ...c, unitId: 'pathfinders' })

    // The new roster is the unit, and ONLY the unit.
    const after = unitRosterOf(world, a.personId)
    expect(after?.unitName).not.toBe(before?.unitName)
    expect(after?.members.length).toBe(2)
    for (const member of after?.members ?? []) {
      expect(world.service.get(member.personId)?.unitId).toBe('pathfinders')
    }

    // And the squad they left no longer lists them.
    const theirs = unitRosterOf(world, b.personId)
    expect(theirs?.members.some((m) => m.personId === a.personId)).toBe(false)
    expect(theirs?.members.some((m) => m.personId === b.personId)).toBe(true)
  })
})
