import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld, worldHashHex } from '../src/index.js'

/**
 * THE BANNER'S BASELINE HAS TO BE THE REAL ONE.
 *
 * `App.tsx` recomputes a seeded world in the BROWSER and compares it to a
 * hardcoded hash, which is the only check that catches a banned
 * `Math.sin/cos/pow` reaching engine code — those are precision-defined by
 * the implementation, so a simulation can reproduce perfectly under Node and
 * still diverge in a real browser.
 *
 * The constant carried a comment saying "KEEP THIS IN STEP WITH THE TEST"
 * and nothing whatsoever enforced it. It went stale the moment
 * SIMULATION_VERSION moved, and the owner was shown "DETERMINISM CHECK
 * FAILED — this browser disagrees with Node" for a divergence that did not
 * exist. A false alarm on the one invariant that must never be ignored is
 * worse than no alarm: it teaches you to dismiss the banner.
 *
 * So the comment is now a test. If the engine's behaviour changes, this
 * fails in Node long before anybody sees a red banner in a browser.
 */
describe('the in-app determinism banner', () => {
  it('checks against the hash the engine actually produces', () => {
    const source = readFileSync(new URL('../../../apps/web/src/App.tsx', import.meta.url), 'utf8')
    const seedMatch = /const GOLDEN_SEED = (\d+)/.exec(source)
    const ticksMatch = /const GOLDEN_TICKS = (\d+)/.exec(source)
    const hashMatch = /const GOLDEN_HASH_HEX = '([0-9a-f]+)'/.exec(source)

    // If the constants are renamed, this test must fail loudly rather than
    // quietly stop checking anything.
    expect(seedMatch, 'GOLDEN_SEED not found in App.tsx').not.toBeNull()
    expect(ticksMatch, 'GOLDEN_TICKS not found in App.tsx').not.toBeNull()
    expect(hashMatch, 'GOLDEN_HASH_HEX not found in App.tsx').not.toBeNull()
    if (!seedMatch || !ticksMatch || !hashMatch) return

    const world = createWorld(makeSeed(Number(seedMatch[1])))
    advanceTicks(world, Number(ticksMatch[1]))
    expect(worldHashHex(world)).toBe(hashMatch[1])
  })
})
