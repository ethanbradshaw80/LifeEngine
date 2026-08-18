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

  it('never prints a negative number at a player', () => {
    /**
     * OWNER'S SCREENSHOT: "The light goes in -30 minutes."
     *
     * `hash32` returns UNSIGNED — 0 to 4,294,967,295 — and every shift in this
     * module was the SIGNED `>>`, which converts to int32 first. Any draw
     * above 2^31 came back negative and took the enemy count, the distance,
     * the support minutes and the array indices with it. One character per
     * line, and it was visible in the first scene he read.
     */
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 12)
    const anybody = [...world.people.values()][0]
    if (anybody === undefined) return

    for (let month = 0; month < 400; month += 1) {
      for (const threat of ['light', 'heavy', 'overrun'] as const) {
        const shape = situationFor(world, anybody.id, month as Tick, threat)
        expect(shape.countLow, 'a negative enemy count').toBeGreaterThan(0)
        expect(shape.countHigh).toBeGreaterThanOrEqual(shape.countLow)
        expect(shape.distance, 'a negative distance').toBeGreaterThan(0)
        expect(shape.strength).toBeGreaterThan(0)
        expect(shape.lightMinutes, 'negative minutes of light').toBeGreaterThanOrEqual(0)
        if (shape.gunsMinutes !== null) expect(shape.gunsMinutes).toBeGreaterThan(0)
        if (shape.airMinutes !== null) expect(shape.airMinutes).toBeGreaterThan(0)
        // The ground and the weather are drawn by index, so a negative index
        // silently became the fallback string every time.
        expect(shape.ground.length).toBeGreaterThan(5)

        // AND NOTHING IN THE WRITTEN PARAGRAPH CARRIES A MINUS SIGN.
        const words = situationWords(shape, 'Contact.')
        expect(words, words).not.toMatch(/-\d/)
        for (const option of optionsFor(shape)) {
          expect(option.cost, option.cost).not.toMatch(/-\d/)
          expect(option.intention, option.intention).not.toMatch(/-\d/)
        }
      }
    }
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
