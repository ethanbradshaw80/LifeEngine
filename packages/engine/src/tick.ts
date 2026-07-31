/**
 * The tick orchestrator.
 *
 * SYSTEM ORDER IS PART OF THE SIMULATION'S BEHAVIOUR. Changing it changes
 * outcomes for every seed, so it requires a simulation-version bump. The order
 * below is chosen so that:
 *
 *   - schooling resolves before job seeking, so a graduate can be hired in the
 *     month they qualify rather than waiting one extra tick;
 *   - relationships resolve before household decisions, since who moves in with
 *     whom is decided by the relationships domain and merely acted on here;
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
import { runFinances } from './finances.js'
import { runGeopolitics } from './geopolitics.js'
import { runRelationships } from './relationships.js'
import {
  runBirths,
  runEducation,
  runEmployment,
  runHouseholds,
  runMortality,
} from './systems.js'
import type { World } from './types.js'

/** Advance the world by one month. Mutates the world in place and returns it. */
export function advanceTick(world: World): World {
  // Law 5: a pending player decision halts the clock. Answer it first.
  if (world.player.pending !== null) return world

  const next = makeTick(world.tick + 1)
  ;(world as { tick: Tick }).tick = next

  // The world turns first: nations act on the same tick the town then lives
  // through. Nothing in the town reads geopolitics yet (that starts at
  // L4-M3), so this ordering is about the future, not the present.
  runGeopolitics(world, next)

  runEducation(world, next)
  runEmployment(world, next)
  // Finances directly after employment: this month's wages land before any
  // system reads the balance, so strain and affordability see current money.
  runFinances(world, next)
  runRelationships(world, next)
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
  for (let i = 0; i < count; i++) {
    if (world.player.pending !== null) break

    const playerId = world.player.personId
    const aliveBefore = playerId !== null && world.people.get(playerId)?.deathTick === null

    advanceTick(world)

    if (world.player.pending !== null) break
    // Stop at the player's death, so the retrospective appears when it
    // happens rather than fifty years later when the button run finishes.
    if (aliveBefore && playerId !== null && world.people.get(playerId)?.deathTick !== null) break
  }
  return world
}
