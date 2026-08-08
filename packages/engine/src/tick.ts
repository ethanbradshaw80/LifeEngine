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
import { compactHistory } from './compaction.js'
import { tick as makeTick } from '@life-engine/shared'
import { runCrime } from './crime.js'
import { runProperties, seatHouseholds } from './realestate.js'
import { runStats } from './stats.js'
import { runWellbeing } from './wellbeing.js'
import { runFinances } from './finances.js'
import { stepEconomy } from './economy.js'
import { stepSectors } from './market.js'
import type { EconomyState } from './types.js'
import { activeWars, homeland, runGeopolitics } from './geopolitics.js'
import { runSchools, runWartimeService } from './service.js'
import { runCallsToArms } from './coalition.js'
import { runHealth } from './health.js'
import { runService } from './service.js'
import { runDeployments } from './deployment.js'
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
  // AFTER the wars have advanced, never before: the distress that decides
  // whether a country calls for help is this month's, not last month's
  // (ADR-0022). Sequenced HERE rather than at the end of runGeopolitics
  // because geopolitics importing coalition would close a cycle — the tick
  // loop is the orchestrator, which is what the import ratchet was telling
  // us when it failed.
  runCallsToArms(world, next)

  // M-ECON §4. THE WEATHER FIRST, because everything below lives in it:
  // hiring and layoffs read the phase, prices read the drift, savings read
  // the rate. A month's economy is settled before anybody acts in it.
  const home = homeland(world)
  const atWar =
    home !== undefined && activeWars(world).some((w) => w.a === home.id || w.b === home.id)
  ;(world as { economy: EconomyState }).economy = stepEconomy(world, next, atWar)
  ;(world as { sectorPrices: Readonly<Record<string, number>> }).sectorPrices = stepSectors(
    world,
    next,
    world.economy,
    atWar,
  )

  runEducation(world, next)
  // Health before employment: a body broken this month affects this month's
  // work, and a recovery clears the way for this month's hiring.
  runHealth(world, next)
  runEmployment(world, next)
  // Service after employment: a person who failed to find civilian work this
  // month hears the recruiter with this month's ears.
  runService(world, next)
  // The schoolhouse keeps its own calendar: classes start and finish on
  // the grid, whoever is in them.
  runSchools(world, next)
  runWartimeService(world, next)
  // The war reaches for the serving after the service system has kept its
  // own books for the month (enlistments, promotions, terms).
  runDeployments(world, next)
  // Finances directly after employment: this month's wages land before any
  // system reads the balance, so strain and affordability see current money.
  runFinances(world, next)
  // Crime after finances: the ledger that makes theft thinkable is this
  // month's ledger, and stolen money lands before relationships and
  // households read the balance (C1).
  runCrime(world, next)
  runRelationships(world, next)
  runHouseholds(world, next)
  // A NEW HOUSEHOLD NEEDS A DOOR, not just a street. Households form every
  // month — a marriage, a child grown and gone — and seating only at
  // worldgen meant they never got an address: measured at twenty years, 181
  // of 296 homes read as empty because half the town was doorless. Cheap,
  // because it only ever looks at households that have no home yet.
  seatHouseholds(world)
  // A year in a house is a year of wear.
  runProperties(world, next)
  runBirths(world, next)
  // LAST OF THE LIVING SYSTEMS, and deliberately: wellbeing reads the
  // month's own events, so everything that could have happened must have
  // happened before it looks. Mortality follows, because the dead are not
  // asked how they feel.
  // The body first, then how the life feels about it.
  runStats(world, next)
  runWellbeing(world, next)
  runMortality(world, next)

  // LAST, AND RARELY. History compression (Law 6): the ledger is the only
  // thing in this world that grows without bound, and handing it to the
  // interface costs more than simulating the month does. Runs after
  // everything else so nothing this month reads a ledger that moved under
  // it, and only touches people who have been dead for a generation.
  compactHistory(world, next)

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
