/**
 * The three-option combat scene (owner's combat plan §2).
 *
 * The invariant the whole system hangs on: EVERY CELL KEEPS THE FATAL TAIL.
 * The bravest answer must not be the only one that can kill you, and the
 * most careful must not be the only one that cannot — that is what makes it
 * a decision under risk rather than a difficulty slider.
 */

import { describe, expect, it } from 'vitest'
import { COMBAT_SCENES, decodeScene, encodeScene, outcomeFor, pickScene, rollThreat, SCENE_OPTIONS, sceneById } from '../src/scenes.js'
import type { Threat } from '../src/scenes.js'
import { openStream, Stream } from '../src/rng.js'
import { seed as makeSeed } from '@life-engine/shared'

const THREATS: readonly Threat[] = ['light', 'heavy', 'overrun']

describe('the matrix', () => {
  it('never makes any answer safe — every cell can still kill', () => {
    for (const choice of SCENE_OPTIONS) {
      for (const threat of THREATS) {
        const outcome = outcomeFor(choice, threat)
        expect(outcome.gate, `${choice}/${threat} cannot go wrong at all`).toBeGreaterThan(0)
        // The severity floor feeds a roll whose tail reaches the fatal band,
        // so a floor above zero means the tail is live in this cell.
        expect(outcome.severityFloor, `${choice}/${threat} has no severity`).toBeGreaterThan(0)
      }
    }
  })

  it('makes caution safer and boldness costlier, at every threat level', () => {
    for (const threat of THREATS) {
      const push = outcomeFor('push', threat)
      const hold = outcomeFor('hold', threat)
      const cover = outcomeFor('cover', threat)
      expect(push.gate).toBeGreaterThan(hold.gate)
      expect(hold.gate).toBeGreaterThan(cover.gate)
      expect(push.severityFloor).toBeGreaterThan(cover.severityFloor)
    }
  })

  it('makes a worse moment worse whatever you answer', () => {
    for (const choice of SCENE_OPTIONS) {
      expect(outcomeFor(choice, 'overrun').gate).toBeGreaterThan(outcomeFor(choice, 'heavy').gate)
      expect(outcomeFor(choice, 'heavy').gate).toBeGreaterThan(outcomeFor(choice, 'light').gate)
    }
  })

  it('offers valor only where something was risked', () => {
    // Pushing is always an act. Holding is an act only when the line was
    // about to break. Covering never is — and that is not a judgement, it
    // is what a citation can honestly describe.
    for (const threat of THREATS) {
      expect(outcomeFor('push', threat).valorInN).toBeGreaterThan(0)
      expect(outcomeFor('cover', threat).valorInN).toBe(0)
    }
    expect(outcomeFor('hold', 'light').valorInN).toBe(0)
    expect(outcomeFor('hold', 'overrun').valorInN).toBeGreaterThan(0)
    // And it is rarer the less was at stake.
    expect(outcomeFor('push', 'overrun').valorInN).toBeLessThan(outcomeFor('push', 'light').valorInN)
  })
})

describe('the scenes', () => {
  it('tell the player how bad it is, in every scene and at every level', () => {
    // THE READ. Without a distinct tell per level the matrix is a lottery.
    for (const scene of COMBAT_SCENES) {
      const tells = new Set(THREATS.map((t) => scene.tell[t]))
      expect(tells.size, `${scene.id} does not distinguish its threat levels`).toBe(3)
      for (const t of THREATS) {
        expect(scene.tell[t].length, `${scene.id}/${t} has no tell`).toBeGreaterThan(20)
      }
    }
  })

  it('name all three answers, and say what was done for the record', () => {
    for (const scene of COMBAT_SCENES) {
      for (const choice of SCENE_OPTIONS) {
        expect(scene.labels[choice].length, `${scene.id} has no label for ${choice}`).toBeGreaterThan(2)
        expect(scene.did[choice].length, `${scene.id} has no record line for ${choice}`).toBeGreaterThan(5)
      }
      // Three answers, three distinct things done — otherwise the record
      // cannot tell them apart later.
      expect(new Set(SCENE_OPTIONS.map((c) => scene.did[c])).size).toBe(3)
    }
  })

  it('picks a scene that fits the channel that found them', () => {
    const rng = openStream(makeSeed(1), Stream.CombatResolution, 1, 1)
    const convoy = pickScene('convoy-exposure', null, rng)
    expect(convoy?.channels).toContain('convoy-exposure')
    const base = pickScene('base-attack-exposure', null, rng)
    expect(base?.channels).toContain('base-attack-exposure')
    // An unknown channel still yields a scene rather than nothing: a
    // contact the player is in must always have words.
    expect(pickScene('something-new', null, rng)).toBeDefined()
  })

  it('rolls all three threat levels, and worse ones under pressure', () => {
    const seen = new Set<Threat>()
    let heavyOrWorse = 0
    let calmHeavyOrWorse = 0
    for (let i = 0; i < 400; i++) {
      const rng = openStream(makeSeed(i), Stream.CombatResolution, i, i)
      seen.add(rollThreat(20, null, rng))
      const hot = openStream(makeSeed(i), Stream.CombatResolution, i, i + 1)
      if (rollThreat(900, null, hot) !== 'light') heavyOrWorse++
      const calm = openStream(makeSeed(i), Stream.CombatResolution, i, i + 2)
      if (rollThreat(0, null, calm) !== 'light') calmHeavyOrWorse++
    }
    expect(seen.size, 'not every threat level is reachable').toBe(3)
    expect(heavyOrWorse, 'a hot channel should produce worse moments').toBeGreaterThan(
      calmHeavyOrWorse,
    )
  })

  it('survives a round trip through the pending field', () => {
    for (const scene of COMBAT_SCENES) {
      for (const threat of THREATS) {
        const decoded = decodeScene(encodeScene(scene.id, threat))
        expect(decoded.sceneId).toBe(scene.id)
        expect(decoded.threat).toBe(threat)
      }
    }
    // A pending written before scenes existed still reads as something.
    const legacy = decodeScene(null)
    expect(sceneById(legacy.sceneId)).toBeDefined()
    expect(THREATS).toContain(legacy.threat)
  })
})

describe('unit scenes', () => {
  it('exist for every unit a player can actually be selected into', async () => {
    // A unit you can join and never see is a line on a record. Each one that
    // takes people has scenes of its own (owner's combat plan §4).
    const { SPECIAL_UNITS } = await import('../src/content.js')
    const withScenes = new Set(
      COMBAT_SCENES.filter((s) => s.unitId !== null).map((s) => s.unitId),
    )
    for (const unit of SPECIAL_UNITS) {
      // Tier 2 feeds off tier 1 and shares its work; what must not happen is
      // a whole branch with nothing of its own.
      if (unit.tier === 1 || unit.tier === 3) {
        expect(withScenes.has(unit.id), `${unit.name} has no scenes of its own`).toBe(true)
      }
    }
  })

  it('lean toward the sharp end, because that is the work', () => {
    const unitScenes = COMBAT_SCENES.filter((s) => s.unitId !== null)
    expect(unitScenes.length).toBeGreaterThan(5)
    for (const scene of unitScenes) {
      expect(scene.biasToward, `${scene.id} is a unit scene with no bias`).not.toBeNull()
    }
    // And the ordinary scenes do not: an ordinary contact is an ordinary
    // contact whoever is standing in it.
    for (const scene of COMBAT_SCENES.filter((s) => s.unitId === null)) {
      expect(scene.biasToward).toBeNull()
    }
  })

  it('are preferred while you serve there, and never reach anyone else', () => {
    const rng = openStream(makeSeed(3), Stream.CombatResolution, 3, 3)
    for (let i = 0; i < 40; i++) {
      const picked = pickScene('direct-combat-exposure', 'pathfinders', rng)
      expect(picked?.unitId, 'a pathfinder got somebody else’s scene').toBe('pathfinders')
    }
    for (let i = 0; i < 40; i++) {
      const picked = pickScene('direct-combat-exposure', null, rng)
      expect(picked?.unitId, 'a line soldier got a unit scene').toBeNull()
    }
  })
})
