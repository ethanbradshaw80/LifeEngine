/**
 * COMING BACK IS RARE, AND NOT A DECADE LATER.
 *
 * OWNER, PLAYING: "It seems like a lot of people join and then get out and
 * then later on rejoin again this seems to be a bug too."
 *
 * MEASURED before changing anything, across two seeds and fifty years: 6-9%
 * of everybody who ever served came back for a second spell, at a MEDIAN GAP
 * OF NINE YEARS, signing again between 32 and 38. The model thirded a
 * returning veteran's propensity and never once asked how long he had been
 * out — so a man who left at 24 could wander back at 38 as though he had
 * never gone.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'

/** Every enlistment tick, per person, from the ledger. */
function spellsIn(world: ReturnType<typeof createWorld>): Map<number, number[]> {
  const spells = new Map<number, number[]>()
  for (const event of world.events) {
    if (event.type !== 'enlisted') continue
    const list = spells.get(event.subjectId) ?? []
    list.push(event.tick)
    spells.set(event.subjectId, list)
  }
  return spells
}

describe('re-entering the service', () => {
  it('is a small minority of the people who ever serve', () => {
    const world = createWorld(makeSeed(4242), 400)
    advanceTicks(world, 50 * 12)
    const spells = spellsIn(world)
    expect(spells.size, 'nobody enlisted at all').toBeGreaterThan(20)

    const returned = [...spells.values()].filter((ticks) => ticks.length > 1).length
    const share = returned / spells.size
    // It must still be POSSIBLE — prior-service re-entry is real, and a rule
    // that forbade it outright would be its own kind of wrong.
    expect(share, `${(share * 100).toFixed(0)}% came back`).toBeLessThan(0.04)
  })

  it('never happens after the break has become a life', () => {
    /**
     * THE HALF THAT MATTERS. A short gap is a man changing his mind; six
     * years out is a career, a family and a mortgage. The door closes.
     */
    const world = createWorld(makeSeed(4242), 400)
    advanceTicks(world, 50 * 12)

    for (const [id, ticks] of spellsIn(world)) {
      if (ticks.length < 2) continue
      const sorted = [...ticks].sort((a, b) => a - b)
      // The discharge that ended the previous spell.
      for (let i = 1; i < sorted.length; i += 1) {
        const cameBack = sorted[i] ?? 0
        let left = -1
        for (const event of world.events) {
          if (event.subjectId !== id || event.type !== 'discharged') continue
          if (event.tick < cameBack && event.tick > left) left = event.tick
        }
        if (left < 0) continue
        const out = cameBack - left
        expect(
          out,
          `#${String(id)} came back ${String(Math.floor(out / 12))} years after getting out`,
        ).toBeLessThanOrEqual(72)
      }
    }
  })
})
