/**
 * THE SITUATION, AND THE OPTIONS IT SUPPORTS (plan §4.1, §4.2, §4.4b).
 *
 * OWNER, TWICE: "make sure we are being descriptive in the combat scenes"
 * and then "these arent very descriptive or in depth like how we discussed".
 *
 * The claims worth defending are structural rather than literary — a test
 * cannot check that prose is good, but it can check the three things that
 * made twenty-four scenes read as one:
 *
 *   1. The same scene is a DIFFERENT PROBLEM on different months.
 *   2. An option only exists when the situation supports it.
 *   3. A filed situation never changes, because a contact is a fact.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { optionsFor, situationFor, situationWords, spectrumOf } from '../src/situation.js'

describe('the situation', () => {
  it('makes the same scene a different problem every month', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 12)
    const anybody = [...world.people.values()][0]
    expect(anybody).toBeDefined()
    if (anybody === undefined) return

    const reads = new Set<string>()
    for (let month = 0; month < 24; month += 1) {
      const shape = situationFor(world, anybody.id, month as Tick, 'heavy')
      reads.add(situationWords(shape, 'Contact.'))
    }
    // Twenty-four contacts, and near enough twenty-four different problems.
    // The old model produced ONE read per threat level, for ever.
    expect(reads.size).toBeGreaterThan(20)
  })

  it('never offers fire support with no radio, and never fewer than three answers', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 12)
    const anybody = [...world.people.values()][0]
    if (anybody === undefined) return

    let sawRadioless = false
    let sawSupport = false
    for (let month = 0; month < 200; month += 1) {
      for (const threat of ['light', 'heavy', 'overrun'] as const) {
        const shape = situationFor(world, anybody.id, month as Tick, threat)
        const options = optionsFor(shape)

        // ALWAYS A REAL DECISION. Four to six is the spec; three is the floor
        // that says the menu never collapses back to what it replaced.
        expect(options.length).toBeGreaterThanOrEqual(3)
        expect(options.length).toBeLessThanOrEqual(6)

        const callsForFire = options.some((o) => o.id === 'hold:guns' || o.id === 'hold:air')
        if (!shape.radio) {
          sawRadioless = true
          expect(callsForFire, 'called for fire with a dead radio').toBe(false)
        }
        if (callsForFire) {
          sawSupport = true
          expect(shape.radio).toBe(true)
          expect(shape.gunsMinutes !== null || shape.airMinutes !== null).toBe(true)
        }

        // GETTING THE WOUNDED OUT is not an option when nobody is hit.
        const casualty = options.some((o) => o.id === 'cover:casualty')
        if (casualty) expect(shape.downNow).not.toBeNull()
        if (shape.downNow === null) expect(casualty).toBe(false)

        // Every option is written, not labelled: an intention and a price.
        for (const option of options) {
          expect(option.intention.length).toBeGreaterThan(20)
          expect(option.cost.length).toBeGreaterThan(20)
          expect(['push', 'hold', 'cover']).toContain(option.spectrum)
        }
      }
    }
    // Both halves of the gate actually occur, or the test proves nothing.
    expect(sawRadioless, 'no radio ever failed in 600 contacts').toBe(true)
    expect(sawSupport, 'support was never available in 600 contacts').toBe(true)
  })

  it('says the same thing for ever, because a contact is a fact', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 24)
    const anybody = [...world.people.values()][0]
    if (anybody === undefined) return
    const first = situationFor(world, anybody.id, 12 as Tick, 'heavy')
    advanceTicks(world, 36)
    const later = situationFor(world, anybody.id, 12 as Tick, 'heavy')
    expect(later).toEqual(first)
  })

  it('resolves a variant as its spectrum, and an old bare answer unchanged', () => {
    // The save compatibility claim: a pending written before options had
    // variants carries 'push', and it must still be a push.
    expect(spectrumOf('push:draw')).toBe('push')
    expect(spectrumOf('cover:casualty')).toBe('cover')
    expect(spectrumOf('hold:guns')).toBe('hold')
    expect(spectrumOf('push')).toBe('push')
    expect(spectrumOf('hold')).toBe('hold')
    expect(spectrumOf('cover')).toBe('cover')
    // Anything unrecognisable is the careful answer, never the brave one.
    expect(spectrumOf('nonsense')).toBe('hold')
  })
})
