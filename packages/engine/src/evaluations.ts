/**
 * THE ANNUAL EVALUATION (MILITARY_DEPTH_PLAN §10.2).
 *
 * A career is decided by a stack of reports written about you by somebody who
 * outranks you, and until now this engine had none. Promotion read a single
 * `performance` integer that drifted on its own, so nobody ever wrote you up,
 * nobody ever had it in for you, and there was nothing to read back in thirty
 * years.
 *
 * WHAT THIS ADDS, and deliberately no more:
 *
 *   - once a year, on your own anniversary so the force is not all rated in
 *     the same month, somebody NAMED writes a mark on you
 *   - who that is comes from the unit roster — the person immediately senior
 *     to you, which is who actually writes it
 *   - what he thinks of you is STABLE. Seeded on the pair, so the first
 *     sergeant who has it in for you has it in for you next year too, and a
 *     good officer keeps being a good officer. That is the whole point: a bad
 *     rater has to be a thing that happens to a career, not a coin flip.
 *   - the mark feeds back into performance, so the opinion has teeth
 *   - and it is on the record for ever, readable by a descendant
 *
 * WHAT IT DOES NOT DO, on purpose. The plan's §15 wanted this to REPLACE
 * `performance` as the thing promotion reads. It does not, and the
 * independent review is why: that is a shipped mechanic with live saves
 * behind it, and swapping the input wholesale is a rebalance rather than a
 * feature. The evaluation MOVES performance instead. Promotion still reads
 * one number, and that number is now the product of named people's opinions
 * rather than drift.
 *
 * `service.ts` remains the only writer of service records (Law 12): this
 * module decides and calls `boostServicePerformance`, and never writes one
 * itself.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { eventsFor } from './eventindex.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { hash32, Stream } from './rng.js'
import { boostServicePerformance, unitRosterOf } from './service.js'
import type { World } from './types.js'
import { markWords } from './text.js'
import { BRANCH_GRADES } from './content.js'

/**
 * HOW FAR A RATER'S REGARD CAN BEND A MARK, either way.
 *
 * Deliberately smaller than the range of real performance: a report is an
 * opinion about work that was actually done, and a rater who could halve or
 * double it would be writing fiction. A hundred and twenty points is enough
 * to cost somebody a promotion cycle and not enough to invent a career.
 */
const REGARD_SWING = 120

/** How much of the gap between the mark and the record the year closes. */
const MARK_BITE_PER_MILLE = 350

/**
 * WHO IS RATED AT ALL (owner: "only SGT and above are receiving these
 * evaluations").
 *
 * He is right, and it is how it actually works: a formal annual report starts
 * at sergeant. Below that a soldier is counselled by his team leader, which
 * is a different thing on a different form and does not decide a career.
 *
 * E-5 is the line, read from the GRADE rather than the ladder index — SPC and
 * CPL are both E-4 and only one of them wears an NCO's stripes, which is
 * exactly the distinction `BRANCH_GRADES` exists to carry. Officers are rated
 * from their first day, because they are.
 */
const RATED_FROM_GRADE = 5

/** Somebody's pay grade; officers sit above every enlisted one. */
function gradeOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  if (record === undefined) return 0
  if (record.commissioned === true) return 100 + record.rank
  return (BRANCH_GRADES as Record<string, readonly number[] | undefined>)[record.branch]?.[record.rank] ?? record.rank + 1
}

export interface Evaluation {
  readonly tick: Tick
  readonly raterId: EntityId | null
  readonly mark: number
}

/**
 * WHAT THIS RATER THINKS OF THIS PERSON, -REGARD_SWING..+REGARD_SWING.
 *
 * Seeded on the PAIR and nothing else — not the tick, not the year. So it
 * does not re-roll, which is what makes "he has it in for me" a fact about a
 * posting rather than weather. Change either man and it is a different
 * number, which is also true: people get on, or they do not.
 */
export function regardBetween(world: World, raterId: EntityId, subjectId: EntityId): number {
  const draw = hash32(world.seed, Stream.Service, raterId * 7919 + subjectId, 61_000)
  return (draw % (REGARD_SWING * 2 + 1)) - REGARD_SWING
}

/** Every evaluation ever written on somebody, oldest first. */
export function evaluationsOf(world: World, personId: EntityId): readonly Evaluation[] {
  const found: Evaluation[] = []
  for (const event of eventsFor(world, personId)) {
    if (event.type !== 'evaluated' || event.subjectId !== personId) continue
    found.push({
      tick: event.tick,
      raterId: event.otherId ?? null,
      mark: Number(event.detail ?? '0'),
    })
  }
  return found.sort((a, b) => a.tick - b.tick)
}

/**
 * WHO WRITES IT: the man immediately senior to you in your own unit.
 *
 * `rosterFrom` already sorts by real authority — never `record.rank`, which
 * is an index into whichever ladder somebody is on and would have a sergeant
 * rating a lieutenant. Null where somebody is the senior person present,
 * which is a real situation and produces an unrated year rather than a
 * fabricated rater.
 */
export function raterFor(world: World, personId: EntityId): EntityId | null {
  const roster = unitRosterOf(world, personId)
  if (roster === null) return null
  const order = roster.members
  const mine = order.findIndex((m) => m.personId === personId)
  if (mine <= 0) return null

  /**
   * A SUPERIOR, not merely the next name up (owner: "we need to make sure its
   * our superiors that are ratings us").
   *
   * The roster is sorted by authority, but adjacent people can SHARE a grade
   * — two sergeants stand next to each other and neither writes the other's
   * report. So this walks up until it finds somebody who genuinely outranks
   * the subject, and returns null rather than settling for a peer.
   */
  const mineGrade = gradeOf(world, personId)
  for (let i = mine - 1; i >= 0; i -= 1) {
    const candidate = order[i]
    if (candidate === undefined) continue
    if (gradeOf(world, candidate.personId) > mineGrade) return candidate.personId
  }
  return null
}

/**
 * Write this month's reports.
 *
 * Runs after the service pass so a promotion this month is already on the
 * record the rater is describing.
 */
export function runEvaluations(world: World, tick: Tick): void {
  for (const record of world.service.values()) {
    if (record.dischargedAtTick === null) {
      const person = world.people.get(record.personId)
      if (person === undefined || person.deathTick !== null) continue

      // ON THEIR OWN ANNIVERSARY. Rating the whole force in one month would
      // make every January a cliff and every other month silent.
      const served = tick - record.enlistedAtTick
      if (served <= 0 || served % TICKS_PER_YEAR !== 0) continue

      // SERGEANTS AND ABOVE. Below that the year passes uncounted, which is
      // true of the real form and keeps a private's career from being
      // decided by paperwork nobody would have written.
      if (gradeOf(world, record.personId) < RATED_FROM_GRADE) continue

      const raterId = raterFor(world, record.personId)
      if (raterId === null) continue

      const regard = regardBetween(world, raterId, record.personId)
      const mark = Math.max(0, Math.min(1000, record.performance + regard))

      recordEvent(world, tick, {
        type: 'evaluated',
        subjectId: record.personId,
        otherId: raterId,
        detail: String(mark),
      })
      /**
       * LAW 3, and the review asked for it by name: a report that moves a
       * career has to be able to say what it was made of. The two inputs are
       * the work and the man writing about it, which is exactly the honest
       * account of an evaluation.
       */
      recordDecision(world, tick, {
        subjectId: record.personId,
        decision: 'evaluation',
        significance: 'notable',
        inputs: [
          factor('strong-performance', record.performance),
          factor('rater-regard', Math.abs(regard) * 4, raterId),
        ],
        chosen: markWords(mark),
        rejected: [],
        streamId: Stream.Service,
      })

      // THE OPINION HAS TEETH. The record moves toward the mark rather than
      // being replaced by it — one bad year is a setback, not a new career.
      const bite = Math.round(((mark - record.performance) * MARK_BITE_PER_MILLE) / 1000)
      if (bite !== 0) boostServicePerformance(world, record.personId, bite)
    }
  }
}
