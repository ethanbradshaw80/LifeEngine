/**
 * The ledger delta, which exists because the main thread was being sent the
 * whole of history every time a month passed.
 *
 * THE CLAIM UNDER TEST is not "it is faster" — it is that the reassembled
 * ledger is EXACTLY the worker's, every time, including across the one
 * thing that rewrites history: compaction. A bug here does not throw; it
 * quietly loses somebody's life, which is the worst kind of bug this
 * project can have.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { applyLedgerDelta, createLedgerTracker } from './ledgerdelta.js'
import type { HeldLedger } from './ledgerdelta.js'

/** One round trip: the worker sends, the main thread reassembles. */
function roundTrip(
  tracker: ReturnType<typeof createLedgerTracker>,
  held: HeldLedger,
  world: World,
): { held: HeldLedger; mode: 'full' | 'append'; sent: number } {
  const delta = tracker.since(world)
  const applied = applyLedgerDelta(held, delta)
  // Every round trip in these tests asserts the checksum too: a delta that
  // does not add up must never reach a render or a save.
  expect(applied.intact).toBe(true)
  return {
    held: applied.held,
    mode: delta.mode,
    sent: delta.events.length + delta.causalRecords.length,
  }
}

function expectMatches(held: HeldLedger, world: World): void {
  expect(held.events.map((e) => e.id)).toEqual(world.events.map((e) => e.id))
  expect(held.causalRecords.map((r) => r.id)).toEqual(world.causalRecords.map((r) => r.id))
}

describe('the ledger delta', () => {
  it('reassembles exactly the worker ledger, month after month', () => {
    const world = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    let held: HeldLedger = { events: [], causalRecords: [] }

    // The first send is everything; there is nothing on the other side yet.
    const first = roundTrip(tracker, held, world)
    expect(first.mode).toBe('full')
    held = first.held
    expectMatches(held, world)

    // Then forty years, a month at a time — which is how it is actually
    // used. A test that never advances the tick loop tests nothing.
    for (let month = 0; month < 40 * 12; month++) {
      advanceTicks(world, 1)
      const step = roundTrip(tracker, held, world)
      held = step.held
      expectMatches(held, world)
    }
  })

  it('sends the tail, not the history, once the world is deep', () => {
    const world = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    let held: HeldLedger = { events: [], causalRecords: [] }
    advanceTicks(world, 60 * 12)
    held = roundTrip(tracker, held, world).held

    const ledgerSize = world.events.length + world.causalRecords.length
    expect(ledgerSize).toBeGreaterThan(2000)

    // A single month after sixty years of history should cost a handful of
    // rows, not thousands. This is the whole point of the change.
    advanceTicks(world, 1)
    const step = roundTrip(tracker, held, world)
    expect(step.mode).toBe('append')
    expect(step.sent).toBeLessThan(100)
    expectMatches(step.held, world)
  })

  it('resends everything when compaction rewrites history', () => {
    const world = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    let held: HeldLedger = { events: [], causalRecords: [] }
    advanceTicks(world, 30 * 12)
    held = roundTrip(tracker, held, world).held

    // Compaction (Law 6) drops entries from the MIDDLE, so index arithmetic
    // alone would happily append onto a ledger that no longer matches.
    // Simulate one by hand: the check is the id, not the length.
    const survivors = world.events.filter((_, i) => i % 3 !== 0)
    ;(world as unknown as { events: unknown[] }).events = survivors
    advanceTicks(world, 1)

    const step = roundTrip(tracker, held, world)
    expect(step.mode).toBe('full')
    expectMatches(step.held, world)
  })

  it('refuses a delta that does not add up, rather than rendering it', () => {
    const world = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    advanceTicks(world, 5 * 12)
    const delta = tracker.since(world)

    // A message that arrives short — the shape a desync would take.
    const truncated = { ...delta, events: delta.events.slice(0, -3) }
    const applied = applyLedgerDelta({ events: [], causalRecords: [] }, truncated)
    expect(applied.intact).toBe(false)
  })

  it('treats an unrecognised mode as a replacement, never an append', () => {
    // Worker messages are cast, not validated (R-23). The wrong answer has
    // to be one wasted clone, not a duplicated history.
    const world = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    advanceTicks(world, 5 * 12)
    const delta = tracker.since(world)
    const corrupt = { ...delta, mode: 'nonsense' as 'full' }

    const held: HeldLedger = { events: [...world.events], causalRecords: [...world.causalRecords] }
    const applied = applyLedgerDelta(held, corrupt)
    expect(applied.intact).toBe(true)
    expect(applied.held.events.length).toBe(world.events.length)
  })

  it('keeps ledger ids strictly increasing, which is what the check rests on', () => {
    // The prefix check is sound only because ids rise with array order: an
    // unchanged id at a given index then PROVES the whole prefix survived
    // compaction. Nothing else asserts that, so this does.
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 60 * 12)
    for (const list of [world.events, world.causalRecords]) {
      for (let i = 1; i < list.length; i++) {
        expect(list[i]!.id).toBeGreaterThan(list[i - 1]!.id)
      }
    }
  })

  it('starts clean for a different world', () => {
    const first = createWorld(makeSeed(12345), 100)
    const tracker = createLedgerTracker()
    let held: HeldLedger = { events: [], causalRecords: [] }
    advanceTicks(first, 10 * 12)
    held = roundTrip(tracker, held, first).held
    expect(held.events.length).toBeGreaterThan(0)

    // A new town, or a loaded save. Without the reset the old town's
    // history would be prepended to the new one's.
    tracker.reset()
    const second = createWorld(makeSeed(999), 100)
    advanceTicks(second, 5 * 12)
    const step = roundTrip(tracker, held, second)
    expect(step.mode).toBe('full')
    expectMatches(step.held, second)
  })
})
