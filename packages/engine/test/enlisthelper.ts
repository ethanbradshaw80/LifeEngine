/**
 * Walking the recruiting station, for tests.
 *
 * M-ENLIST turned "pick a job" into a pipeline — commission fork, branch,
 * entry test, then the job — and a dozen tests that only ever wanted to get
 * somebody into uniform were suddenly answering four questions instead of
 * one. This is that walk, in one place, so the shape of the pipeline lives
 * in the engine and not copy-pasted through the suite.
 *
 * It answers only the enlistment steps. Anything else it finds pending it
 * leaves alone and stops, because a test that hits something unexpected
 * should see the unexpected thing, not have it silently clicked through.
 */

import { resolvePending } from '../src/player.js'
import type { World } from '../src/types.js'

/** The steps this helper knows how to answer on the way to a trade. */
const PIPELINE = new Set(['commission', 'branch-choice', 'entry-test', 'officer-preference'])

export interface WalkOptions {
  /** Which side of the commission fork, when the fork is offered. */
  readonly path?: 'officer' | 'enlisted'
  /** The branch to sign with. Defaults to whichever is offered first. */
  readonly branchId?: string
}

/**
 * Answer the pipeline until a trade menu (or a commission's contract) is up.
 *
 * Returns the kind left pending, so a caller can assert on it.
 */
export function walkToSpecialty(world: World, options: WalkOptions = {}): string | null {
  // A bound, not a schedule: the pipeline is four steps and a loop that
  // cannot end is worse than a test that fails.
  for (let step = 0; step < 8; step++) {
    const pending = world.player.pending
    if (!pending) return null
    if (!PIPELINE.has(pending.kind)) return pending.kind

    let answer = pending.options[0] ?? ''
    if (pending.kind === 'commission' && options.path !== undefined) {
      answer = options.path
    }
    if (pending.kind === 'branch-choice' && options.branchId !== undefined) {
      if (pending.options.includes(options.branchId)) answer = options.branchId
    }
    resolvePending(world, answer)
  }
  return world.player.pending?.kind ?? null
}

/**
 * Walk all the way in: the pipeline, then the trade, then the oath.
 *
 * `specialtyId` is a preference — if the test asks for a trade this branch
 * and this test score do not open, the first one they DO open is taken,
 * because the point of most of these tests is to have a serving person.
 */
export function signUp(
  world: World,
  options: WalkOptions & { specialtyId?: string; stopAtOath?: boolean } = {},
): void {
  const kind = walkToSpecialty(world, options)
  if (kind !== 'specialty') return
  const pending = world.player.pending
  if (!pending) return
  const wanted = options.specialtyId
  const answer =
    wanted !== undefined && pending.options.includes(wanted) ? wanted : (pending.options[0] ?? '')
  resolvePending(world, answer)
  if (options.stopAtOath === true) return
  if (world.player.pending?.kind === 'service-contract') {
    resolvePending(world, 'take-the-oath')
  }
}
