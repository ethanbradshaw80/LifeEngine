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
  it('shows every wound that matters, and asks by the stakes', () => {
    /**
     * THE RULE THIS TEST GUARDED WAS THE THIRD REPORT (owner: "still
     * didn't get the popups of the wounds of when I got hurt"). A wound
     * at 400 got no moment at all — the player learned they were hit from
     * a feed line. The player's own wound now shows from 300 up; what
     * severity changes is the QUESTION. Under 600 there is no life to
     * fight for, so the only option is seeing it and getting it dressed.
     */
    const minor = woundedPlayer(12345, 400)
    expect(offerFieldAid(minor.world, minor.world.tick, minor.id, 400)).toBe(true)
    expect(minor.world.player.pending?.kind).toBe('first-aid')
    expect(minor.world.player.pending?.options).toEqual(['get-it-dressed'])

    const scratch = woundedPlayer(777, 250)
    expect(offerFieldAid(scratch.world, scratch.world.tick, scratch.id, 250)).toBe(false)

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

  it('never turns an accident into a combat death or a combat decoration', () => {
    // REVIEW M2: the losing branch used to label every death "wounds taken
    // in action" — so a truck rollover earned the wound decoration and a
    // record that lied about the cause. The wound event is the truth.
    let checked = 0
    for (let seedValue = 1; seedValue <= 60 && checked < 3; seedValue++) {
      const world = createWorld(makeSeed(seedValue), 100)
      const person = livingPeople(world).find((p) => p.deathTick === null)
      if (!person) continue
      setPlayer(world, person.id)
      const rng = openStream(world.seed, Stream.Health, person.id, world.tick)
      // An ACCIDENT wound: the event the engine writes for one.
      inflictWound(world, world.tick, person.id, 950, 'field-accident', rng)
      world.events.push({
        id: 90_000 + seedValue,
        tick: world.tick,
        type: 'was-injured',
        subjectId: person.id,
        otherId: null,
        placeId: null,
        detail: 'serious:a crush injury',
      })
      if (!offerFieldAid(world, world.tick, person.id, 950)) continue
      resolvePending(world, 'lie-still')
      checked++
      const dead = world.people.get(person.id)?.deathTick !== null
      if (!dead) continue
      expect(world.people.get(person.id)?.causeOfDeath).toBe('an accident on deployment')
      const awards = world.awards.get(person.id) ?? []
      expect(awards.some((a) => a.kind === 'wound-recognition')).toBe(false)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('preempts whatever question was holding the world', () => {
    /**
     * THE RULE THIS TEST USED TO GUARD WAS THE BUG (live player, on itch:
     * "I just got wounded in combat 2 times and I never got the popup").
     * A busy decision slot lost the moment forever — and fed the fatal
     * roll besides, so answering a work chat the month you were hit meant
     * NPC-grade mortality. Being shot outranks every question a month can
     * ask: the wound clears the slot and takes it.
     */
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
    expect(offerFieldAid(world, world.tick, id, 800)).toBe(true)
    expect(world.player.pending?.kind).toBe('first-aid')
  })
})
