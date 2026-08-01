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
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTicks, createWorld } from '../src/index.js'
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
    const world = createWorld(makeSeed(12345))
    const person = aPlayedSoldier(world)

    const options = schoolOptionsFor(world, person.id)
    const jump = options.find((o) => o.id === 'jump-school')
    expect(jump?.open).toBe(true)
    // A naval course refuses a land-forces rifleman, in words.
    const diver = options.find((o) => o.id === 'combat-diver')
    expect(diver?.open).toBe(false)
    expect(diver?.reason.length).toBeGreaterThan(0)

    // Ask until a slot comes through (1-in-3 per request, one per half-year).
    let attended = false
    for (let i = 0; i < 12 && !attended; i++) {
      const result = requestSchool(world, 'jump-school')
      attended = result.attended
      if (!attended) {
        advanceTicks(world, 6)
        while (awaitingPlayer(world)) {
          const pending = world.player.pending
          if (!pending) break
          resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        }
      }
    }
    expect(attended).toBe(true)
    expect(badgesOf(world, person.id)).toContain('parachutist')
    expect(world.events.some((e) => e.type === 'completed-training' && e.detail === 'Jump School')).toBe(true)
    expect(world.player.log.some((entry) => entry.kind === 'school-request')).toBe(true)
  })
})

describe('special units', () => {
  it('selection wants the badge first, and says so', () => {
    const world = createWorld(makeSeed(12345))
    aPlayedSoldier(world)
    const result = tryOutForUnit(world, 'pathfinders')
    expect(result.joined).toBe(false)
    expect(result.reason).toContain('parachutist')
  })

  it('the quiet tier draws only from the feeder unit', () => {
    const world = createWorld(makeSeed(12345))
    const person = aPlayedSoldier(world, 900)
    const options = unitOptionsFor(world, person.id)
    const ember = options.find((o) => o.id === 'task-unit-ember')
    expect(ember?.open).toBe(false)
    expect(ember?.reason).toContain('Pathfinder')
  })

  it('selection can be failed, both outcomes are recorded, and the file allows two tries', () => {
    const world = createWorld(makeSeed(12345))
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

    let joined = false
    for (let i = 0; i < 2 && !joined; i++) {
      joined = tryOutForUnit(world, 'pathfinders').joined
    }
    if (joined) {
      expect(world.service.get(person.id)?.unitId).toBe('pathfinders')
      expect(world.events.some((e) => e.type === 'joined-unit')).toBe(true)
      // Membership pays: grade pay plus the unit's duty pay.
      expect(servicePayOf(world, person.id)).toBe(139_000 + 15_000)
    } else {
      // Two drops on the record; the third asking is refused by the file.
      expect(world.events.filter((e) => e.type === 'dropped-selection').length).toBe(2)
      const third = tryOutForUnit(world, 'pathfinders')
      expect(third.joined).toBe(false)
      expect(third.reason).toContain('Two selections')
    }
    expect(world.player.log.filter((entry) => entry.kind === 'unit-tryout').length).toBeGreaterThan(0)
  })
})

describe('promotion points', () => {
  it('several roads reach the same board — a middling evaluation is not a wall', () => {
    const world = createWorld(makeSeed(12345))
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
    const rifleman = competitiveGates(specialtyById('rifleman'), 3)
    const medic = competitiveGates(specialtyById('medic'), 3)
    expect(rifleman).not.toBeNull()
    expect(medic).not.toBeNull()
    if (!rifleman || !medic) return
    expect(rifleman.cutoff).toBeLessThan(medic.cutoff)
  })
})

describe('fitness parity', () => {
  it('the test runs for the player whether or not they press anything', () => {
    const world = createWorld(makeSeed(12345))
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
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 900)
    const schoolTitles = new Set(['Jump School', 'the Air-Mobile Assault Course', 'Sniper School', 'the Combat Diver Course', 'the Junior Leaders Course'])
    expect(
      world.events.some((e) => e.type === 'completed-training' && schoolTitles.has(e.detail ?? '')),
    ).toBe(true)
  })
})
