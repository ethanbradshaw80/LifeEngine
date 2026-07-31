/**
 * Determinism tests. See docs/DETERMINISM.md §9.
 *
 * Law 11 is an engineering requirement, not an aspiration: same seed, same
 * version, same decisions must produce byte-identical results. These tests are
 * the thing that makes every other guarantee checkable — without them a bug
 * report cannot be reproduced and a refactor cannot be shown to change nothing.
 *
 * On CROSS-PROCESS coverage: the golden-seed test below compares against a
 * constant committed to the repository. Every `npm test` runs in a fresh Node
 * process, so a passing golden test IS a cross-process check — a value that
 * only reproduced within one process would fail here the next time CI ran.
 *
 * CROSS-ENVIRONMENT coverage (Node vs. a real browser) is provided by the web
 * app, which recomputes this same constant in the browser and displays whether
 * it matches. That is the check that catches a banned Math.sin slipping in,
 * since transcendental precision is where engines legitimately differ.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { serialize, worldHash, worldHashHex } from '../src/snapshot.js'
import { lifeStory } from '../src/story.js'

/** The milestone's reference run: seed 12345, 100 people, 120 monthly ticks. */
export const GOLDEN_SEED = 12345
export const GOLDEN_TICKS = 120

/**
 * Committed fingerprint of the reference run.
 *
 * If this changes, simulation behaviour changed. That is sometimes correct —
 * but it always requires a SIMULATION_VERSION bump, never a quiet edit of this
 * constant. Quietly updating it converts "reproducible" into "reproducible
 * except when it isn't", which is worthless.
 *
 * Last changed at Milestone 5, with SIMULATION_VERSION raised to 2: the
 * relationships domain replaced the placeholder friendship model, so every
 * seed produces a different world than it did under v1.
 */
export const GOLDEN_HASH_HEX = 'c67a53ef'

function runReference() {
  const world = createWorld(makeSeed(GOLDEN_SEED))
  advanceTicks(world, GOLDEN_TICKS)
  return world
}

describe('golden seed', () => {
  it('reproduces the committed fingerprint', () => {
    expect(worldHashHex(runReference())).toBe(GOLDEN_HASH_HEX)
  })
})

describe('double run', () => {
  it('produces byte-identical state from the same seed', () => {
    expect(serialize(runReference())).toBe(serialize(runReference()))
  })

  it('produces identical hashes along the way, not only at the end', () => {
    const a = createWorld(makeSeed(GOLDEN_SEED))
    const b = createWorld(makeSeed(GOLDEN_SEED))

    // Sampled every 10 ticks rather than every tick. Hashing serializes the
    // whole world, so checking all 120 costs far more than it catches — a
    // divergence is still localized to a 10-month window, which is enough to
    // bisect from.
    for (let i = 1; i <= GOLDEN_TICKS; i++) {
      advanceTicks(a, 1)
      advanceTicks(b, 1)
      if (i % 10 === 0) {
        expect(worldHash(a), `diverged by tick ${i}`).toBe(worldHash(b))
      }
    }
  })
})

describe('seed sensitivity', () => {
  it('produces a different world from a different seed', () => {
    const a = createWorld(makeSeed(GOLDEN_SEED))
    const b = createWorld(makeSeed(GOLDEN_SEED + 1))
    advanceTicks(a, 60)
    advanceTicks(b, 60)
    expect(worldHash(a)).not.toBe(worldHash(b))
  })
})

describe('resumption', () => {
  it('gives the same result whether run in one pass or several', () => {
    const straight = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(straight, 120)

    const staged = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(staged, 37)
    advanceTicks(staged, 1)
    advanceTicks(staged, 82)

    // Proves the tick carries no hidden state between calls — a prerequisite
    // for save/load at Milestone 4 and for running in a Web Worker.
    expect(worldHash(staged)).toBe(worldHash(straight))
  })
})

describe('serialization', () => {
  it('is stable across repeated calls', () => {
    const world = runReference()
    expect(serialize(world)).toBe(serialize(world))
  })

  it('carries a header with schema, simulation version, seed and userId', () => {
    const world = runReference()
    const text = serialize(world)
    expect(text).toContain('"schemaVersion":1')
    expect(text).toContain('"simulationVersion":2')
    expect(text).toContain('"userId":"local"')
    expect(text).toContain(`"seed":${GOLDEN_SEED}`)
  })
})

describe('narrative determinism', () => {
  it('renders the same life story from the same seed', () => {
    const a = runReference()
    const b = runReference()
    const [firstPerson] = [...a.people.keys()].sort((x, y) => x - y)
    expect(firstPerson).toBeDefined()
    if (firstPerson === undefined) return
    expect(lifeStory(a, firstPerson)).toBe(lifeStory(b, firstPerson))
  })
})
