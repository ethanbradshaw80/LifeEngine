/**
 * A per-person view of the ledger.
 *
 * The ledger is one long append-only array, and a dozen systems ask it the
 * same shape of question every month: "what has happened to THIS person?"
 * Each of those asks walked all of it. At year 2124 that is 34,000 events
 * per question, per serving person, per month — the selection history alone
 * (`dropped-selection`, twice per career, ever) was a full scan for every
 * soldier in the town every single month.
 *
 * This is DERIVED STATE and nothing else: it is never saved, never sent
 * across the worker boundary, and never read to make a decision that the
 * ledger itself could not answer identically. It is rebuilt whenever the
 * ledger's length changes in a way an append cannot explain — which is what
 * history compaction does — so it cannot drift from the truth.
 *
 * Determinism is untouched. The index changes the COST of a question, not
 * its answer: `eventsFor` returns the same events in the same order the
 * filter did, and nothing here draws.
 */

import type { EntityId } from '@life-engine/shared'
import type { WorldEvent, World } from './types.js'

interface Index {
  /** Where the ledger was when this index was last brought up to date. */
  consumed: number
  readonly byPerson: Map<EntityId, WorldEvent[]>
  /**
   * By event id, for the callers that hold an id and need the event.
   *
   * MEASURED: an award cites the events that earned it, and rendering one
   * line of a timeline resolved each of those ids with a scan of the whole
   * ledger. At 150 simulated years that made `describeOutcome` 30 ms of a
   * 33 ms timeline — the largest main-thread cost left once the worker
   * stopped re-sending history. Same answer, one lookup.
   */
  readonly byId: Map<number, WorldEvent>
}

/**
 * Keyed by world, so two worlds in one process (tests do this constantly)
 * never see each other's index, and a discarded world takes its index with
 * it rather than leaking.
 */
const INDEXES = new WeakMap<World, Index>()

function indexFor(world: World): Index {
  const existing = INDEXES.get(world)
  // An append is the common case: extend from where we left off. Anything
  // else — a compaction, a load — is a rebuild, because the array we were
  // tracking is no longer the array in front of us.
  if (existing !== undefined && existing.consumed <= world.events.length) {
    for (let i = existing.consumed; i < world.events.length; i++) {
      const event = world.events[i]
      if (event === undefined) continue
      const own = existing.byPerson.get(event.subjectId)
      if (own === undefined) existing.byPerson.set(event.subjectId, [event])
      else own.push(event)
      existing.byId.set(event.id, event)
    }
    existing.consumed = world.events.length
    return existing
  }

  const byPerson = new Map<EntityId, WorldEvent[]>()
  const byId = new Map<number, WorldEvent>()
  for (const event of world.events) {
    const own = byPerson.get(event.subjectId)
    if (own === undefined) byPerson.set(event.subjectId, [event])
    else own.push(event)
    byId.set(event.id, event)
  }
  const built: Index = { consumed: world.events.length, byPerson, byId }
  INDEXES.set(world, built)
  return built
}

/**
 * Every event whose SUBJECT is this person, oldest first — the same events
 * `world.events.filter((e) => e.subjectId === id)` returns, in the same
 * order.
 *
 * Note the subject only. An event with this person as `otherId` belongs to
 * somebody else's page; callers that want those still ask the ledger, and
 * they are rare enough not to matter.
 */
export function eventsFor(world: World, personId: EntityId): readonly WorldEvent[] {
  return indexFor(world).byPerson.get(personId) ?? []
}

/**
 * The event with this id, or undefined. The same answer
 * `world.events.find((e) => e.id === id)` gives, without the scan.
 */
export function eventById(world: World, id: number): WorldEvent | undefined {
  return indexFor(world).byId.get(id)
}

/**
 * Drop the index for a world. Only needed where a world's ledger is
 * rewritten wholesale outside the tick — a load, or a test that edits
 * history by hand. Appends and compaction both handle themselves.
 */
export function forgetEventIndex(world: World): void {
  INDEXES.delete(world)
}
