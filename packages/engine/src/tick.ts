/**
 * The tick orchestrator.
 *
 * SYSTEM ORDER IS PART OF THE SIMULATION'S BEHAVIOUR. Changing it changes
 * outcomes for every seed, so it requires a simulation-version bump. The order
 * below is chosen so that:
 *
 *   - schooling resolves before job seeking, so a graduate can be hired in the
 *     month they qualify rather than waiting one extra tick;
 *   - friendships form before household decisions, since partnering draws on
 *     the friendship graph;
 *   - births happen before mortality, so a child born this month exists even
 *     if a parent dies in the same month;
 *   - mortality runs LAST, so someone who dies this month still did whatever
 *     they were going to do first.
 *
 * The tick is synchronous throughout. No async, no promises, no timers —
 * interleaving order is not guaranteed and would break reproducibility.
 */

import type { Tick } from '@life-engine/shared'
import { tick as makeTick } from '@life-engine/shared'
import {
  runBirths,
  runEducation,
  runEmployment,
  runFriendship,
  runHouseholds,
  runMortality,
} from './systems.js'
import type { World } from './types.js'

/** Advance the world by one month. Mutates the world in place and returns it. */
export function advanceTick(world: World): World {
  const next = makeTick(world.tick + 1)
  ;(world as { tick: Tick }).tick = next

  runEducation(world, next)
  runEmployment(world, next)
  runFriendship(world, next)
  runHouseholds(world, next)
  runBirths(world, next)
  runMortality(world, next)

  return world
}

/** Advance by a number of months. */
export function advanceTicks(world: World, count: number): World {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`advanceTicks expects a non-negative integer, got ${count}`)
  }
  for (let i = 0; i < count; i++) advanceTick(world)
  return world
}
