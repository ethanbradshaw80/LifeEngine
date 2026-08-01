/**
 * P1 — the record reads back (PLAYER_EXPERIENCE_AUDIT.md §P1).
 *
 * The claims: every event that has a decision behind it can reach that
 * decision (the Why? mappings verified at the type level and against a
 * grown world); a father's timeline carries his child's birth; the four
 * player choices that used to vanish leave feed events; and a colliding
 * question no longer burns a one-shot flag.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { raisePending } from '../src/player.js'
import { decisionForEvent, eventsFor } from '../src/records.js'
import type { World } from '../src/types.js'

function grown(ticks: number, seedValue = 12345): World {
  const world = createWorld(makeSeed(seedValue))
  advanceTicks(world, ticks)
  return world
}

describe('the father sees his child born', () => {
  it("every birth lands a had-child on BOTH parents' timelines", () => {
    const world = grown(600)
    const births = world.events.filter((e) => e.type === 'born')
    expect(births.length).toBeGreaterThan(0)
    for (const birth of births) {
      const child = world.people.get(birth.subjectId)
      if (!child) continue
      for (const parentId of child.parentIds) {
        const carried = eventsFor(world, parentId).some(
          (e) => e.type === 'had-child' && e.subjectId === parentId && e.otherId === child.id,
        )
        expect(carried).toBe(true)
      }
    }
  })
})

describe('the Why? mappings resolve against a grown world', () => {
  it('enlisted and deployed events find their decisions', () => {
    // started-school maps too, but only the PLAYER's fork records an
    // education decision — an NPC's compulsory schooling is rightly
    // unexplained, so it is not asserted here.
    const world = grown(900)
    for (const type of ['enlisted', 'deployed'] as const) {
      const events = world.events.filter((e) => e.type === type)
      // The world must actually contain these to make the claim meaningful.
      expect(events.length).toBeGreaterThan(0)
      for (const event of events) {
        const decision = decisionForEvent(world, event)
        expect(decision).not.toBeNull()
      }
    }
  })
})

describe('a colliding question is not a silent loss', () => {
  it('raisePending reports whether it landed', () => {
    const world = createWorld(makeSeed(777))
    const spec = {
      tick: world.tick,
      kind: 'retirement',
      personId: [...world.people.keys()][0],
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['retire', 'keep-working'],
    } as const
    expect(raisePending(world, spec as never)).toBe(true)
    expect(raisePending(world, spec as never)).toBe(false) // slot held
  })
})
