/**
 * Health. L4-M2.
 *
 * The claims: bodies break and mend at believable rates; disability is
 * permanent and only accumulates; severe ailments gate work; most fatal
 * accidents now wound instead; and the player's convalescence choice has
 * modelled consequences either way.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { freshHealth, isSeverelyAiling } from '../src/health.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { awaitingPlayer, resolvePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function grownWorld(ticks = 600): World {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, ticks)
  return world
}

describe('bodies break and mend', () => {
  it('ailments occur, and most of them clear', () => {
    const world = grownWorld()
    const injured = world.events.filter((e) => e.type === 'was-injured').length
    const fellIll = world.events.filter((e) => e.type === 'fell-ill').length
    const recovered = world.events.filter((e) => e.type === 'recovered').length

    expect(injured + fellIll).toBeGreaterThan(5)
    expect(recovered).toBeGreaterThan(0)
    // Recovery keeps rough pace with onset: the town is not filling with the sick.
    expect(recovered).toBeGreaterThanOrEqual(Math.floor((injured + fellIll) * 0.5))
  })

  it('keeps severity in bounds', () => {
    const world = grownWorld()
    for (const record of world.health.values()) {
      expect(record.severity).toBeGreaterThanOrEqual(0)
      expect(record.severity).toBeLessThanOrEqual(1000)
      expect(record.disability).toBeGreaterThanOrEqual(0)
      expect(record.disability).toBeLessThanOrEqual(1000)
      if (record.ailment === null) expect(record.severity).toBe(0)
    }
  })

  it('disability only ever accumulates', () => {
    // Track one world across time: nobody's disability may ever decrease.
    const world = createWorld(makeSeed(2024))
    const seen = new Map<number, number>()
    for (let step = 0; step < 30; step++) {
      advanceTicks(world, 24)
      for (const record of world.health.values()) {
        const previous = seen.get(record.personId) ?? 0
        expect(
          record.disability,
          `person ${record.personId} healed a permanent mark`,
        ).toBeGreaterThanOrEqual(previous)
        seen.set(record.personId, record.disability)
      }
    }
  })

  it('some recoveries leave a permanent mark over a long run', () => {
    const world = grownWorld(1200)
    const marked = [...world.health.values()].filter((r) => r.disability > 0)
    expect(marked.length).toBeGreaterThan(0)
  })
})

describe('accidents wound more often than they kill', () => {
  it('serious injuries outnumber accident deaths', () => {
    const world = grownWorld(1200)
    const accidentDeaths = world.events.filter(
      (e) => e.type === 'died' && e.detail === 'an accident',
    ).length
    const seriousInjuries = world.events.filter(
      (e) => e.type === 'was-injured' && e.detail === 'serious',
    ).length

    expect(seriousInjuries).toBeGreaterThan(0)
    // The 2-in-3 redirect: wounds should clearly outnumber accident deaths.
    expect(seriousInjuries).toBeGreaterThan(accidentDeaths)
  })

  it('the population still holds its historical bands', () => {
    const world = grownWorld(600)
    const living = livingPeople(world).length
    expect(living).toBeGreaterThan(50) // fewer accident deaths must not shrink the town
    expect(living).toBeLessThan(220) // nor balloon it
  })
})

describe('the body gates the work', () => {
  it('a severely ailing person is not hired', () => {
    const world = createWorld(makeSeed(12345))
    // Hand-build: strike every jobless young adult with a severe injury, run a
    // month, assert none of them were hired while still severely ailing.
    const struck: import('@life-engine/shared').EntityId[] = []
    for (const person of livingPeople(world)) {
      const age = ageAt(person.birthTick, world.tick)
      if (age >= 20 && age <= 50 && !world.employment.has(person.id)) {
        world.health.set(person.id, {
          ...freshHealth(person.id),
          ailment: 'injury',
          severity: 980,
          peakSeverity: 980,
          sinceTick: 0 as Tick,
        })
        struck.push(person.id)
      }
    }
    expect(struck.length).toBeGreaterThan(3)

    advanceTick(world)
    for (const personId of struck) {
      if (isSeverelyAiling(world, personId)) {
        expect(
          world.employment.has(personId),
          `person ${personId} hired while badly hurt`,
        ).toBe(false)
      }
    }
  })
})

describe('the convalescence choice', () => {
  function strikeThePlayer(world: World) {
    const adult = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 25 && age <= 45
    })
    if (!adult) throw new Error('no adult to strike')
    setPlayer(world, adult.id)
    world.health.set(adult.id, {
      ...freshHealth(adult.id),
      ailment: 'injury',
      severity: 700,
      peakSeverity: 700,
      sinceTick: world.tick,
    })
    return adult
  }

  it('asks once, and only once, per ailment', () => {
    const world = createWorld(makeSeed(12345))
    strikeThePlayer(world)

    advanceTick(world)
    expect(awaitingPlayer(world)).toBe(true)
    expect(world.player.pending?.kind).toBe('convalesce')

    resolvePending(world, 'push-on')
    // The same ailment never asks again.
    for (let i = 0; i < 6 && !awaitingPlayer(world); i++) advanceTick(world)
    if (world.player.pending) expect(world.player.pending.kind).not.toBe('convalesce')
  })

  it('resting heals a real step; pushing on does not', () => {
    const restWorld = createWorld(makeSeed(12345))
    const restAdult = strikeThePlayer(restWorld)
    advanceTick(restWorld)
    expect(restWorld.player.pending?.kind).toBe('convalesce')
    resolvePending(restWorld, 'rest')
    const afterRest = restWorld.health.get(restAdult.id)?.severity ?? 0

    const pushWorld = createWorld(makeSeed(12345))
    const pushAdult = strikeThePlayer(pushWorld)
    advanceTick(pushWorld)
    expect(pushWorld.player.pending?.kind).toBe('convalesce')
    resolvePending(pushWorld, 'push-on')
    const afterPush = pushWorld.health.get(pushAdult.id)?.severity ?? 0

    expect(afterRest).toBeLessThan(afterPush)

    // And the choice is on the record, honestly worded.
    const record = restWorld.causalRecords.find(
      (r) => r.decision === 'convalescence' && r.subjectId === restAdult.id,
    )
    expect(record?.chosen).toContain('heal')
  })
})
