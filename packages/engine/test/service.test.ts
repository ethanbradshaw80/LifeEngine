/**
 * Military service as a peacetime career. L4-M3.
 *
 * The claims: people enlist at believable rates and serve real careers
 * (promotion, terms, discharge, reenlistment); the serving hold no civilian
 * job and their pay reaches the household; records survive discharge; the
 * medically unfit are barred or discharged; veterans carry their trade home;
 * and the player's enlistment path runs choice by choice.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { RANKS, specialtyById } from '../src/content.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { awaitingPlayer, resolvePending, setPlayer } from '../src/player.js'
import { isServing, isVeteran, veteranUnlocks } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function grownWorld(ticks = 600): World {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, ticks)
  return world
}

describe('the peacetime career', () => {
  it('some people enlist, serve, and leave across fifty years', () => {
    const world = grownWorld()
    const enlisted = world.events.filter((e) => e.type === 'enlisted').length
    const discharged = world.events.filter((e) => e.type === 'discharged').length

    expect(enlisted).toBeGreaterThan(2)
    expect(discharged).toBeGreaterThan(0)
    // Service is a road some take, not the road everyone takes.
    const everyone = world.people.size
    expect(enlisted).toBeLessThan(everyone / 4)
  })

  it('promotions happen, in order, within the rank table', () => {
    const world = grownWorld(900)
    const promoted = world.events.filter((e) => e.type === 'promoted')
    expect(promoted.length).toBeGreaterThan(0)
    for (const event of promoted) {
      expect(RANKS).toContain(event.detail)
    }
    for (const record of world.service.values()) {
      expect(record.rank).toBeGreaterThanOrEqual(0)
      expect(record.rank).toBeLessThan(RANKS.length)
    }
  })

  it('the serving hold no civilian job, and their pay reaches home', () => {
    const world = grownWorld()
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      expect(world.employment.has(record.personId)).toBe(false)
      expect(record.monthlyPay).toBeGreaterThan(0)
    }
  })

  it('records survive discharge — the artifact a descendant finds', () => {
    const world = grownWorld(900)
    const veterans = [...world.service.values()].filter((r) => r.dischargedAtTick !== null)
    expect(veterans.length).toBeGreaterThan(0)
    for (const record of veterans) {
      // The whole record is still there: branch, specialty, when, why.
      expect(record.enlistedAtTick).toBeLessThan(record.dischargedAtTick ?? 0)
      expect(record.dischargeReason).not.toBeNull()
      expect(specialtyById(record.specialtyId).title.length).toBeGreaterThan(0)
    }
  })

  it('nobody serves on past a broken body', () => {
    const world = grownWorld(900)
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      expect(world.health.get(record.personId)?.disability ?? 0).toBeLessThan(400)
    }
  })

  it('reenlistment keeps some careers long', () => {
    const world = grownWorld(900)
    const reenlisted = world.events.filter((e) => e.type === 'reenlisted').length
    expect(reenlisted).toBeGreaterThan(0)
  })
})

describe('veterans', () => {
  it('carry their trade home', () => {
    const world = createWorld(makeSeed(12345))
    // Hand-build a discharged field mechanic with primary schooling only.
    const person = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 19 && age <= 40 && world.education.get(p.id)?.level === 'primary'
    })
    expect(person).toBeDefined()
    if (!person) return

    world.service.set(person.id, {
      personId: person.id,
      branch: 'land-forces',
      specialtyId: 'mechanic',
      rank: 2,
      enlistedAtTick: -48 as never,
      baseId: person.id,
      monthlyPay: 150_000 as never,
      performance: 600,
      termMonthsLeft: 0,
      dischargedAtTick: 0 as never,
      dischargeReason: 'end of term',
    })

    expect(isVeteran(world, person.id)).toBe(true)
    expect(veteranUnlocks(world, person.id)).toContain('machinist')

    // Run years: the veteran may be hired into a trade occupation their
    // schooling alone would never reach. Assert no crash and, when hired into
    // one, that it is from the unlocked set or normally eligible.
    advanceTicks(world, 120)
    const job = world.employment.get(person.id)
    if (job) {
      const allowed = new Set(['machinist', 'electrician', 'carpenter', 'labourer', 'shop-clerk', 'millhand', 'cook'])
      expect(allowed.has(job.occupationId)).toBe(true)
    }
  })
})

describe('the player in uniform', () => {
  function playAnEighteenYearOld(world: World) {
    const teen = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) < 18)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (!teen) throw new Error('no teenager')
    setPlayer(world, teen.id)
    return teen
  }

  it('the fork at eighteen offers the uniform, and the specialty follows', () => {
    const world = createWorld(makeSeed(12345))
    const teen = playAnEighteenYearOld(world)

    // Advance to the education question.
    for (let i = 0; i < 200 && !awaitingPlayer(world); i++) advanceTick(world)
    expect(world.player.pending?.kind).toBe('education')
    expect(world.player.pending?.options).toContain('enlist')

    resolvePending(world, 'enlist')
    // The follow-up question is immediate: which uniform.
    expect(world.player.pending?.kind).toBe('specialty')
    const options = world.player.pending?.options ?? []
    expect(options.length).toBeGreaterThan(0)

    resolvePending(world, options[0] ?? 'rifleman')
    expect(isServing(world, teen.id)).toBe(true)
    expect(world.employment.has(teen.id)).toBe(false)

    // The enlistment is Defining and owned: their own choice, on the record.
    const record = world.causalRecords.find(
      (r) => r.subjectId === teen.id && r.decision === 'enlistment',
    )
    expect(record?.significance).toBe('defining')
    expect(record?.inputs.some((f) => f.factor === 'own-choice')).toBe(true)
  })

  it('the term ends in a real question, and leaving makes a veteran', () => {
    const world = createWorld(makeSeed(12345))
    const teen = playAnEighteenYearOld(world)

    for (let i = 0; i < 200 && !awaitingPlayer(world); i++) advanceTick(world)
    resolvePending(world, 'enlist')
    resolvePending(world, world.player.pending?.options[0] ?? 'rifleman')
    expect(isServing(world, teen.id)).toBe(true)

    // Serve out the term, answering anything else with its safest option.
    let guard = 0
    while (guard < 2_000) {
      guard++
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        if (pending.kind === 'reenlist') break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
    expect(world.player.pending?.kind).toBe('reenlist')

    resolvePending(world, 'leave')
    expect(isServing(world, teen.id)).toBe(false)
    expect(isVeteran(world, teen.id)).toBe(true)

    const record = world.service.get(teen.id)
    expect(record?.dischargeReason).toBe('end of term')
  })
})
