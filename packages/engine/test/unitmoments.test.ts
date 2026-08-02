/**
 * Unit moments — the shared cutscenes (owner's combat plan §4a).
 *
 * The claims: a unit moment is NOT a combat scene and cannot kill anybody,
 * because nobody is shooting in one; selection is played rather than rolled
 * silently, and the answer moves the odds; dropping a packet arrives
 * somewhere, with the pending slot free when it gets there; and each
 * cutscene plays once.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { createWorld } from '../src/index.js'
import { describePending, resolvePending, setPlayer, tryOutForUnit } from '../src/player.js'
import { UNIT_MOMENTS, unitMomentById } from '../src/scenes.js'
import { timelineFor } from '../src/story.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function aPlayedSoldier(world: World, performance = 800): Person {
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
  world.employment.delete(person.id)
  return person
}

describe('unit moments', () => {
  it('every moment offers all three answers and says what each one did', () => {
    for (const moment of UNIT_MOMENTS) {
      expect(moment.tell.length).toBeGreaterThan(20)
      for (const option of ['push', 'hold', 'cover'] as const) {
        expect(moment.labels[option].length).toBeGreaterThan(0)
        expect(moment.did[option].length).toBeGreaterThan(0)
      }
    }
    expect(unitMomentById('selection-day')?.id).toBe('selection-day')
    expect(unitMomentById('not-a-moment')).toBeUndefined()
  })

  it('selection is played, and the answer moves the odds without killing anybody', () => {
    // THE POINT OF THE WHOLE PIECE: a unit moment does not route through the
    // enemy-contact resolver, so no answer to one can end a life. Run the
    // hardest answer many times over and count the bodies: zero.
    let passes = 0
    let deaths = 0
    for (let s = 0; s < 60; s++) {
      const world = createWorld(makeSeed(4000 + s), 60)
      const person = aPlayedSoldier(world)
      expect(tryOutForUnit(world, 'pathfinders').reason).toBe('')
      const pending = world.player.pending
      expect(pending?.kind).toBe('unit-moment')
      if (pending) expect(describePending(world, pending)).toContain('Selection')
      resolvePending(world, 'push')
      if (world.service.get(person.id)?.unitId === 'pathfinders') passes += 1
      if (person.deathTick !== null) deaths += 1
    }
    expect(deaths).toBe(0)
    expect(passes).toBeGreaterThan(0)

    // And nursing an injury through it passes less often than emptying the
    // tank does — the spectrum is real, not decoration.
    let timid = 0
    for (let s = 0; s < 60; s++) {
      const world = createWorld(makeSeed(4000 + s), 60)
      const person = aPlayedSoldier(world)
      tryOutForUnit(world, 'pathfinders')
      resolvePending(world, 'cover')
      if (world.service.get(person.id)?.unitId === 'pathfinders') timid += 1
    }
    expect(timid).toBeLessThan(passes)
  })

  it('a dropped packet arrives at selection, with the slot free when it gets there', () => {
    const world = createWorld(makeSeed(4242), 60)
    const person = aPlayedSoldier(world)
    // Raise the packet by hand — the monthly pass offers it rarely on
    // purpose, and what is under test is where 'push' LANDS.
    world.player.pending = {
      id: world.player.nextDecisionId,
      tick: world.tick,
      kind: 'unit-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'packet-drop:pathfinders',
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['push', 'hold', 'cover'],
    }
    resolvePending(world, 'push')
    // The commitment went somewhere: selection itself is now the question.
    expect(world.player.pending?.kind).toBe('unit-moment')
    expect(world.player.pending?.occupationId).toBe('selection-day:pathfinders')
    // And the packet is on the record as its own answered moment.
    expect(world.player.log.some((entry) => entry.choice === 'packet-drop:push')).toBe(true)
  })

  it('declining the packet ends there and does not ask again', () => {
    const world = createWorld(makeSeed(4243), 60)
    const person = aPlayedSoldier(world)
    world.player.pending = {
      id: world.player.nextDecisionId,
      tick: world.tick,
      kind: 'unit-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'packet-drop:pathfinders',
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['push', 'hold', 'cover'],
    }
    resolvePending(world, 'cover')
    expect(world.player.pending).toBe(null)
    expect(world.player.log.some((entry) => entry.choice === 'packet-drop:cover')).toBe(true)
  })

  it('a second try at selection is a second roll, not the same one with better odds', () => {
    // The draw is keyed on the tick and selection can be re-entered the same
    // month. Unsalted, a player could fail on 'cover' and immediately pass on
    // 'push' off the identical roll — a free win for asking twice.
    let sameAnswerTwice = 0
    for (let s = 0; s < 40; s++) {
      const world = createWorld(makeSeed(5000 + s), 60)
      const person = aPlayedSoldier(world)
      tryOutForUnit(world, 'pathfinders')
      resolvePending(world, 'hold')
      if (world.service.get(person.id)?.unitId === 'pathfinders') continue
      tryOutForUnit(world, 'pathfinders')
      resolvePending(world, 'hold')
      if (world.service.get(person.id)?.unitId === 'pathfinders') sameAnswerTwice += 1
    }
    // Same answer, same month, different roll: some of them pass the second
    // time. With one fixed draw for the tick, none of them ever could.
    expect(sameAnswerTwice).toBeGreaterThan(0)
  })

  it('an answered moment reaches the life story instead of vanishing', () => {
    const world = createWorld(makeSeed(4244), 60)
    const person = aPlayedSoldier(world)
    world.player.pending = {
      id: world.player.nextDecisionId,
      tick: world.tick,
      kind: 'unit-moment',
      personId: person.id,
      otherId: null,
      occupationId: 'losing-one:push',
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['push', 'hold', 'cover'],
    }
    resolvePending(world, 'push')
    const line = timelineFor(world, person.id).find((entry) => entry.text.includes('ramp ceremony'))
    expect(line, 'the moment is on the timeline').toBeDefined()
    // And the Why? behind it can be reached, not just written.
    expect(line?.decision ?? null).not.toBe(null)
  })
})
