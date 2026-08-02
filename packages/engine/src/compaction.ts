/**
 * History compaction (Law 6).
 *
 * "History is summarized and compressed, not stored as unlimited raw
 * detail." Until now nothing compressed anything: every event a world ever
 * recorded stayed in the ledger forever, so a world played into its second
 * century carried tens of thousands of them.
 *
 * THE COST IS NOT THE SIMULATION. Measured at year 2124 of a Heartland
 * world — 36,134 events, 8,857 causal records, 631 people — a month of
 * simulation took 5.9ms and handing the world to the interface took
 * 85.7ms, because the whole thing is structure-cloned across the worker
 * boundary on every action. The clone grows with the ledger and nothing
 * else does. That is the lag: the owner, playing into the 2140s, "it takes
 * a pretty long time to actually respond... feels very laggy and slow".
 *
 * WHAT IS KEPT, ALWAYS. Anything that makes a life legible a century later:
 * being born, dying, marrying, separating, having children, service and
 * what it cost, decorations, convictions, and the moments a player answered
 * for. A descendant reading an ancestor's page still finds a life.
 *
 * WHAT GOES. The texture of an ordinary month — a job taken, a house moved
 * into, a contact that hurt nobody — but ONLY for people who have been dead
 * for a generation, and only once it is old enough that no system is still
 * reading it. Nothing about a living person is ever touched, so nothing the
 * simulation reads to make a decision can move under it.
 */

import type { Tick } from '@life-engine/shared'
import type { EventType, World } from './types.js'

/** How long somebody must have been dead before their texture is dropped. */
const GRACE_YEARS = 25

/** In months, so the arithmetic below stays in ticks. */
const GRACE_TICKS = GRACE_YEARS * 12

/** Run this rarely — it walks the ledger, and the ledger is the big thing. */
const COMPACT_EVERY = 120

/**
 * The events a life is still legible without. Everything NOT in here is
 * kept forever, so adding a new event type is safe by default: it survives
 * compaction until somebody decides otherwise.
 */
const DROPPABLE: ReadonlySet<EventType> = new Set<EventType>([
  // A SERVICE RECORD IS NOT TEXTURE. 'began-training' and 'started-school'
  // were dropped in the first draft and a test caught it at once: an
  // enlistment that never begins is not a record anybody can read, and the
  // same is true of a school that finishes without starting. What follows
  // is the ordinary churn that a life a century old genuinely reads fine
  // without.
  //
  // MEASURED, so the list is the ledger's actual weight rather than a
  // guess. At year 2124: befriended 5,719, friendship-lapsed 4,117,
  // got-raise 3,875, field-exercise 1,881, hired 1,558, started-school
  // 1,325 — the social and working churn of ordinary months, which is
  // exactly what a life a century old is still legible without.
  'befriended',
  'friendship-lapsed',
  'got-raise',
  'field-exercise',
  'hired',
  'anniversary',
  'left-job',
  'turned-down',
  'moved-house',
  'saw-combat',
  'changed-post',
  'fitness-tested',
  'was-robbed',
  'fell-behind',
  'back-in-the-black',
  'recruiting-drive',
  'passed-over',
  'aerial-mission',
  'unit-moment',
  'received-orders',
  'dropped-selection',
  'released-from-jail',
])

/**
 * Whether this person's texture may be dropped: dead, and dead long enough
 * that no system is still asking questions about them.
 */
function longGone(world: World, personId: number, tick: Tick): boolean {
  const person = world.people.get(personId as never)
  if (!person) return true // no longer in the world at all
  if (person.deathTick === null) return false
  return tick - person.deathTick > GRACE_TICKS
}

/**
 * Drop the droppable texture of the long dead. Returns how many events went,
 * which the caller may record; the world is mutated in place.
 *
 * DETERMINISTIC: it reads only the ledger and the death dates already in the
 * world, and it never draws. Two worlds with the same history compact
 * identically.
 */
export function compactHistory(world: World, tick: Tick): number {
  if (tick % COMPACT_EVERY !== 0 || tick === 0) return 0

  // AN AWARD'S EVIDENCE OUTLIVES EVERYTHING. A decoration names the event
  // that earned it, and the rule this project keeps hardest is that no
  // award exists which cannot be traced to what earned it. Compaction found
  // five tests defending exactly that, and they were right: a saw-combat or
  // a completed-training is ordinary texture until a medal hangs off it.
  const evidence = new Set<number>()
  for (const awards of world.awards.values()) {
    for (const award of awards) {
      for (const eventId of award.qualifyingEventIds) evidence.add(eventId)
    }
  }

  const before = world.events.length
  const kept = world.events.filter((event) => {
    if (evidence.has(event.id)) return true
    if (!DROPPABLE.has(event.type)) return true
    if (tick - event.tick <= GRACE_TICKS) return true
    if (!longGone(world, event.subjectId, tick)) return true
    // A second person in the event keeps it alive too — it is on their page
    // as much as on the subject's.
    if (event.otherId !== null && !longGone(world, event.otherId, tick)) return true
    return false
  })
  // In place: the World holds these arrays as readonly properties, so the
  // arrays themselves are what changes, not the world's shape.
  if (kept.length !== before) world.events.splice(0, before, ...kept)

  // THE RECORDS STAY. The first draft dropped them by the same rule and
  // broke the thing they exist for: an event that SURVIVES compaction —
  // enlisting, deploying, dying — still owes an answer to "why?", and its
  // record is the only place that answer lives (Law 3). Dropping records
  // for the long dead left surviving events explaining nothing, which two
  // tests caught immediately.
  //
  // They are also the smaller half: at year 2124, 8,857 records against
  // 36,134 events. The ledger is where the weight is.

  return before - kept.length
}
