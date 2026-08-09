/**
 * EACH JOB SEES ITS OWN WAR (owner's `combat_tours_revamp.md` §4).
 *
 * The spec opens with a confirmed-from-play report: a 68W medic "never
 * once got a medic scene", and concluded scenes were not MOS-gated.
 *
 * MEASURED, the diagnosis was close and not quite right, and the
 * difference decided the fix. Gating WORKED. What was wrong is that the
 * medic's pool was two scenes deep — one of them the infantry scene they
 * share — so a tour was those two alternating. Nineteen scenes were
 * carrying forty-eight specialties. The cause was depth, not wiring.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { COMBAT_SCENES, pickScene } from '../src/scenes.js'
import { MOS_SCENES } from '../src/mosscenes.js'
import { openStream, Stream } from '../src/rng.js'

const MEDIC = ['med_treat_under_fire', 'med_masscas', 'combat_rescue', 'combat_firefight']
const PILOT = ['air_emergency_landing', 'air_crash', 'air_hardlanding', 'air_flightline_fire']
const SAILOR = ['sea_general_quarters', 'sea_fire_aboard', 'sea_smallboat_attack', 'sea_manoverboard']

function drawn(tags: readonly string[], channel: string, isOfficer = false): Map<string, number> {
  const world = createWorld(makeSeed(5))
  const seen = new Map<string, number>()
  for (let i = 0; i < 3_000; i += 1) {
    const rng = openStream(world.seed, Stream.CombatResolution, i, i as never)
    const scene = pickScene(channel, null, rng, tags, isOfficer)
    if (scene !== undefined) seen.set(scene.id, (seen.get(scene.id) ?? 0) + 1)
  }
  return seen
}

describe('a medic plays a medic\'s war', () => {
  it('draws medic scenes, and more than one of them', () => {
    const seen = drawn(MEDIC, 'direct-combat-exposure')
    const medicIds = ['treat-under-fire', 'two-casualties', 'the-one-you-lose', 'the-nine-line']
    const hit = medicIds.filter((id) => (seen.get(id) ?? 0) > 0)
    // The whole point: a pool with depth, not one scene on repeat.
    expect(hit.length).toBeGreaterThan(2)
  })

  it('and is not handed somebody else\'s job', () => {
    const seen = drawn(MEDIC, 'direct-combat-exposure')
    // The leak this file was written twice to close: broad tags on role
    // scenes had a medic drawing aviation emergencies and checkpoint
    // shootings, which is the undifferentiated soup all over again.
    for (const foreign of ['taking-fire-on-final', 'flightline-fire', 'the-second-device', 'general-quarters']) {
      expect(seen.get(foreign) ?? 0, foreign).toBe(0)
    }
  })

  it('in a base attack it is entirely their own war', () => {
    const seen = drawn(MEDIC, 'base-attack-exposure')
    const total = [...seen.values()].reduce((a, b) => a + b, 0)
    const medical = ['treat-under-fire', 'two-casualties', 'the-one-you-lose', 'the-nine-line']
      .map((id) => seen.get(id) ?? 0)
      .reduce((a, b) => a + b, 0)
    expect(medical).toBe(total)
  })
})

describe('the other jobs too', () => {
  it('a pilot gets the air, and never a doorway', () => {
    const seen = drawn(PILOT, 'air-exposure')
    expect([...seen.keys()].length).toBeGreaterThan(1)
    expect(seen.get('the-breach') ?? 0).toBe(0)
    expect(seen.get('treat-under-fire') ?? 0).toBe(0)
  })

  it('a sailor gets the ship', () => {
    const seen = drawn(SAILOR, 'sea-exposure')
    const sea = ['general-quarters', 'fire-aboard'].filter((id) => (seen.get(id) ?? 0) > 0)
    expect(sea.length).toBeGreaterThan(0)
  })

  it('command scenes reach officers and nobody else', () => {
    const asOfficer = drawn(['ops_center_crisis'], 'direct-combat-exposure', true)
    const asPrivate = drawn(['ops_center_crisis'], 'direct-combat-exposure', false)
    expect(asOfficer.get('who-goes-first') ?? 0).toBeGreaterThan(0)
    // A private does not choose whether the platoon flanks.
    expect(asPrivate.get('who-goes-first') ?? 0).toBe(0)
    expect(asPrivate.get('press-or-consolidate') ?? 0).toBe(0)
  })
})

describe('the catalogue is sound', () => {
  it('is deeper than it was, and every scene is complete', () => {
    expect(COMBAT_SCENES.length).toBeGreaterThan(30)
    expect(MOS_SCENES.length).toBeGreaterThan(10)
    for (const scene of COMBAT_SCENES) {
      expect(scene.tags.length, scene.id).toBeGreaterThan(0)
      expect(scene.channels.length, scene.id).toBeGreaterThan(0)
      for (const threat of ['light', 'heavy', 'overrun'] as const) {
        expect(scene.tell[threat].length, `${scene.id}.${threat}`).toBeGreaterThan(20)
      }
      for (const choice of ['push', 'hold', 'cover'] as const) {
        expect(scene.labels[choice].length, `${scene.id}.${choice}`).toBeGreaterThan(0)
        expect(scene.did[choice].length, `${scene.id}.${choice}`).toBeGreaterThan(0)
      }
    }
  })

  it('has no duplicate ids — two scenes under one name is one lost scene', () => {
    const ids = COMBAT_SCENES.map((scene) => scene.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the tags the specialties actually ask for', () => {
    // The three that had no scene at all before this: a flight-line fire,
    // a fire aboard, and general quarters were declared by real roles and
    // nothing on the other side matched them.
    const supplied = new Set(COMBAT_SCENES.flatMap((scene) => scene.tags))
    for (const tag of ['air_flightline_fire', 'sea_fire_aboard', 'sea_general_quarters', 'sea_flightdeck_hazard']) {
      expect(supplied.has(tag), tag).toBe(true)
    }
  })
})
