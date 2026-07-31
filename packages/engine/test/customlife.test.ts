/**
 * Custom lives (M-GAMEDEPTH).
 *
 * The claims: a custom life is born to a real couple through the SAME birth
 * machinery as every other child; the player's inputs (name, sex, family
 * name) are honoured where given and drawn by the world where left blank;
 * the spec is part of the deterministic record (same seed + same spec ⇒
 * byte-identical world); and no household the simulation would refuse a
 * child gets one by menu.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import {
  advanceTicks,
  createCustomLife,
  createWorld,
  motherCandidates,
  worldHash,
} from '../src/index.js'
import type { World } from '../src/types.js'

function freshWorld(seedValue = 12345): World {
  return createWorld(makeSeed(seedValue))
}

describe('custom lives', () => {
  it('births the requested child into a real couple and hands over the seat', () => {
    const world = freshWorld()
    const candidates = motherCandidates(world)
    expect(candidates.length).toBeGreaterThan(0)

    const motherId = candidates[0]
    if (motherId === undefined) throw new Error('no candidate')
    const childId = createCustomLife(world, {
      givenName: 'Ada',
      familyName: null,
      sex: 'female',
      motherId,
    })
    expect(childId).not.toBeNull()
    if (childId === null) return

    const child = world.people.get(childId)
    expect(child?.givenName).toBe('Ada')
    expect(child?.sex).toBe('female')
    expect(child?.parentIds).toContain(motherId)
    expect(child?.birthTick).toBe(world.tick)
    // The family name is the couple's, not invented.
    expect(child?.familyName.length).toBeGreaterThan(0)

    // The seat changed hands and the input is in the deterministic record.
    expect(world.player.personId).toBe(childId)
    const entry = world.player.log.at(-1)
    expect(entry?.kind).toBe('custom-birth')
    expect(entry?.choice).toContain('Ada')

    // A real birth: the born event exists like anyone else's.
    expect(world.events.some((e) => e.type === 'born' && e.subjectId === childId)).toBe(true)
  })

  it('replays exactly: same seed + same spec is the same world, decades on', () => {
    const a = freshWorld()
    const b = freshWorld()
    const motherA = motherCandidates(a)[0]
    const motherB = motherCandidates(b)[0]
    expect(motherA).toBe(motherB)
    if (motherA === undefined || motherB === undefined) throw new Error('no candidate')

    const childA = createCustomLife(a, { givenName: 'Ada', familyName: 'Voss', sex: 'female', motherId: motherA })
    const childB = createCustomLife(b, { givenName: 'Ada', familyName: 'Voss', sex: 'female', motherId: motherB })
    expect(childA).toBe(childB)

    advanceTicks(a, 240)
    advanceTicks(b, 240)
    expect(worldHash(a)).toBe(worldHash(b))
  })

  it('lets the world decide whatever was left blank — deterministically', () => {
    const a = freshWorld()
    const b = freshWorld()
    const motherA = motherCandidates(a)[0]
    if (motherA === undefined) throw new Error('no candidate')

    const spec = { givenName: null, familyName: null, sex: null, motherId: motherA }
    const childA = createCustomLife(a, spec)
    const childB = createCustomLife(b, spec)
    expect(childA).not.toBeNull()
    expect(childA).toBe(childB)
    if (childA === null) return

    const person = a.people.get(childA)
    expect(person !== undefined && person.givenName.length > 0).toBe(true)
    expect(worldHash(a)).toBe(worldHash(b))
  })

  it('refuses a birth the simulation would refuse, leaving no trace', () => {
    const world = freshWorld()
    const aMan = [...world.people.values()].find((p) => p.sex === 'male')
    if (aMan === undefined) throw new Error('an all-female town?')

    const before = worldHash(world)
    const result = createCustomLife(world, {
      givenName: 'Nobody',
      familyName: null,
      sex: null,
      motherId: aMan.id,
    })
    expect(result).toBeNull()
    expect(world.player.log.length).toBe(0)
    expect(world.player.personId).toBeNull()
    expect(worldHash(world)).toBe(before)
  })

  it('only offers mothers the automatic birth roll could pick', () => {
    const world = freshWorld()
    for (const id of motherCandidates(world)) {
      const person = world.people.get(id)
      expect(person?.sex).toBe('female')
      expect(person?.deathTick).toBeNull()
    }
  })
})
