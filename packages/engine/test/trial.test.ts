/**
 * The court case as three playable scenes (C3 §15b).
 *
 * The owner, playing: "I just click stand trial and then I get convicted."
 * Standing trial was one hidden roll behind a button.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { acquits, decodeCase, encodeCase, evidenceFor, nextStage, sceneFor } from '../src/trial.js'
import { offenceById } from '../src/content.js'
import { livingPeople } from '../src/systems.js'

describe('a court case', () => {
  it('runs counsel, the state, the defence, the closing, then the verdict', () => {
    // Five stops, in order, ending at the verdict — the scene the whole
    // case is building to rather than a line in the log.
    const order = ['counsel', 'state', 'defense', 'closing', 'verdict'] as const
    for (let i = 0; i < order.length - 1; i++) {
      expect(nextStage(order[i]!)).toBe(order[i + 1])
    }
    expect(nextStage('verdict')).toBeNull()
  })

  it('assembles the evidence from the record rather than inventing it', () => {
    const world = createWorld(makeSeed(8800), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    const burglary = offenceById('burglary')
    if (!person || !burglary) throw new Error('no world')

    const thin = evidenceFor(world, person.id, burglary, world.tick)
    // Nothing has happened to this person, so the state has almost nothing
    // — and it says so in words the scene can print.
    expect(thin.pieces.length).toBeGreaterThan(0)
    expect(thin.strength).toBeGreaterThanOrEqual(50)
    expect(thin.strength).toBeLessThanOrEqual(950)

    // A violent charge carries the weapon; a thin one does not.
    const assault = offenceById('assault-deadly-weapon')
    if (assault) {
      const heavy = evidenceFor(world, person.id, assault, world.tick)
      expect(heavy.strength).toBeGreaterThan(thin.strength)
      expect(heavy.pieces.join(' ')).toContain('weapon')
    }
  })

  it('every scene offers real choices, and the verdict is the state against the defence', () => {
    const world = createWorld(makeSeed(8801), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    const offence = offenceById('grand-theft')
    if (!person || !offence) throw new Error('no world')
    const evidence = evidenceFor(world, person.id, offence, world.tick)

    for (const stage of ['counsel', 'state', 'defense', 'closing'] as const) {
      const scene = sceneFor(stage, offence, evidence)
      expect(scene.options.length, `${stage} has no choices`).toBe(3)
      expect(scene.tell.length).toBeGreaterThan(20)
      for (const option of scene.options) {
        expect(option.label.length).toBeGreaterThan(0)
        expect(option.says.length).toBeGreaterThan(0)
      }
    }

    // A good defence beats a thin case; no defence loses a strong one. And
    // neither end is ever a certainty — that is the floor and the ceiling.
    const always = { chance: (n: number, d: number) => n / d > 0.5 }
    const thinCase = { strength: 200, pieces: [] }
    const strongCase = { strength: 900, pieces: [] }
    expect(acquits(thinCase, 400, always)).toBe(true)
    expect(acquits(strongCase, 0, always)).toBe(false)
  })

  it('carries its state on the pending without losing anything', () => {
    const encoded = encodeCase('burglary', 'defense', 310, 200, 45_000)
    const state = decodeCase(encoded)
    expect(state.offenceId).toBe('burglary')
    expect(state.stage).toBe('defense')
    expect(state.defence).toBe(310)
    expect(state.sympathy).toBe(200)
    expect(state.taken).toBe(45_000)
    // And a malformed string does not crash the courthouse.
    expect(decodeCase(null).stage).toBe('counsel')
    expect(decodeCase('nonsense').stage).toBe('counsel')
  })
})
