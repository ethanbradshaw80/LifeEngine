/**
 * M-ARMY2 item 8: the minutes after a serious wound.
 *
 * The rule under test is the combat-moment rule, applied to medicine: a
 * choice is never a discount on the wound. Every answer can still lose the
 * casualty, and the body's worst hour — which is what permanent damage is
 * judged on — is not undone by good hands afterwards.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { inflictWound } from '../src/health.js'
import { offerFieldAid } from '../src/deployment.js'
import { resolvePending, setPlayer } from '../src/player.js'
import { openStream, Stream } from '../src/rng.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function woundedPlayer(seedValue: number, severity: number): { world: World; id: EntityId } {
  const world = createWorld(makeSeed(seedValue), 100)
  const person = livingPeople(world).find((p) => p.deathTick === null)
  if (!person) throw new Error('empty town')
  setPlayer(world, person.id)
  const rng = openStream(world.seed, Stream.Health, person.id, world.tick)
  inflictWound(world, world.tick, person.id, severity, 'direct-combat', rng)
  return { world, id: person.id }
}

describe('the field-aid moment', () => {
  it('is offered for serious wounds and never for minor ones', () => {
    const minor = woundedPlayer(12345, 400)
    expect(offerFieldAid(minor.world, minor.world.tick, minor.id, 400)).toBe(false)
    expect(minor.world.player.pending).toBeNull()

    const serious = woundedPlayer(12345, 780)
    expect(offerFieldAid(serious.world, serious.world.tick, serious.id, 780)).toBe(true)
    expect(serious.world.player.pending?.kind).toBe('first-aid')
    expect(serious.world.player.pending?.options).toEqual([
      'press-the-wound',
      'call-for-help',
      'lie-still',
    ])
  })

  it('never lowers the peak the body already hit', () => {
    const { world, id } = woundedPlayer(12345, 820)
    const peakBefore = world.health.get(id)?.peakSeverity ?? 0
    offerFieldAid(world, world.tick, id, 820)
    resolvePending(world, 'press-the-wound')
    const after = world.health.get(id)
    // Either they died (record stands) or they held on — either way the
    // worst hour is not rewritten, because lasting damage is judged on it.
    expect(after?.peakSeverity ?? 0).toBeGreaterThanOrEqual(peakBefore)
  })

  it('leaves every answer able to lose a grave wound', () => {
    // Across many seeds, each option must produce at least one death at a
    // grave severity — no answer is a safe button.
    for (const option of ['press-the-wound', 'call-for-help', 'lie-still']) {
      let deaths = 0
      for (let seedValue = 1; seedValue <= 60; seedValue++) {
        const { world, id } = woundedPlayer(seedValue, 960)
        if (!offerFieldAid(world, world.tick, id, 960)) continue
        resolvePending(world, option)
        if (world.people.get(id)?.deathTick !== null) deaths++
      }
      expect(deaths, `${option} never lost anyone`).toBeGreaterThan(0)
    }
  })

  it('records the choice, and the answer reaches the timeline', () => {
    let recorded = 0
    for (let seedValue = 1; seedValue <= 30 && recorded === 0; seedValue++) {
      const { world, id } = woundedPlayer(seedValue, 700)
      if (!offerFieldAid(world, world.tick, id, 700)) continue
      resolvePending(world, 'call-for-help')
      const survived = world.people.get(id)?.deathTick === null
      if (!survived) continue
      expect(world.events.some((e) => e.type === 'field-aid' && e.subjectId === id)).toBe(true)
      expect(
        world.causalRecords.some(
          (r) =>
            r.subjectId === id &&
            r.decision === 'convalescence' &&
            r.inputs.some((i) => i.factor === 'own-choice'),
        ),
      ).toBe(true)
      recorded++
    }
    expect(recorded).toBeGreaterThan(0)
  })

  it('does not fire while another question holds the world', () => {
    const { world, id } = woundedPlayer(12345, 800)
    world.player.pending = {
      id: 999,
      tick: world.tick as Tick,
      kind: 'retirement',
      personId: id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['retire', 'keep-working'],
    }
    expect(offerFieldAid(world, world.tick, id, 800)).toBe(false)
    expect(world.player.pending?.kind).toBe('retirement')
  })
})
