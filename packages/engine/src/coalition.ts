/**
 * The call to arms, and how coalitions form. ADR-0022, from the owner's
 * war/deployment/difficulty spec of 2026-08-02.
 *
 * A war used to be a pair of countries, forever: an alliance meant nothing
 * and a world war was impossible. Now a belligerent that is losing calls on
 * its allies, and the ones that answer declare against the same enemy — so a
 * coalition is built out of ORDINARY PAIRWISE WARS, each with its own reason
 * on the record. Nothing in the war model changed to allow it.
 *
 * WHEN THE CALL GOES OUT is the owner's own answer to the spec's open
 * question, and it is better than the timer the spec proposed: "completely
 * random but it should be before year 5 if the war is really that bad — it
 * should trigger ally help when they are losing the war or taking more
 * deaths and need additional help." So the trigger is DISTRESS, measured
 * from what the war is doing to the country: the casualty deficit against
 * its enemy, the strength ground off its peacetime baseline, and how long it
 * has dragged on. The odds rise with it, and a genuinely bad war has called
 * before its fifth year.
 *
 * EVERY NATION RUNS THIS, the homeland included. The player does not decide
 * whether their country joins a war — no head-of-state seat exists in this
 * design and Law 2 is why (ADR-0022 §4). They decide whether THEY go.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { combatPowerOf, relationBetween, relationKey } from './geopolitics.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { GeoRelation, Nation, World } from './types.js'

// --- Tunables (the spec's table, with the two it left to measurement) ------

/** A war must be under way this long before anybody asks for help. */
const MIN_CALL_MONTHS = 12

/**
 * How many countries may be fighting one enemy at once, coalition included.
 *
 * THREE. The owner, watching eleven nations declare on Belarus in a single
 * year: "not everybody at once man." A great-power alliance does not empty
 * itself into every quarrel one member picks — it sends somebody. Beyond
 * this nobody else is asked, however badly the war is going, which is also
 * why the ceiling has to count the ENEMY'S side of every war rather than
 * one relation: an ally who joins is a new war of its own, and without the
 * count those new wars each opened their own recruiting drive.
 */
const MAX_BELLIGERENTS = 3
/** Below this a country is coping and does not go asking. */
const MIN_CALL_DISTRESS = 150
/** Distress at which the call is certain — "if the war is really that bad". */
const SEVERE_DISTRESS = 600
/** By this month, a severely distressed war has definitely called (year 5). */
const LATEST_SEVERE_CALL_MONTHS = 60
/** How often the same ally is asked again while the war continues. */
const CALL_REPEAT_MONTHS = 12
/** What declining does to the relationship, on the 0-1000 scale. */
const DECLINE_RELATION_HIT = 10
/** Score an ally needs before it joins. Tuned by measurement — see below. */
const JOIN_THRESHOLD = 520
/** Subtracted per war the ally is already fighting. */
const MULTI_WAR_PENALTY = 260

/**
 * How badly this war is going for one side, 0-1000.
 *
 * Three things, all of them facts about the war rather than draws: how far
 * behind on the dead this side is, how much of its peacetime weight has been
 * ground away, and how long it has been going. A country that is winning
 * comfortably scores near zero and never calls.
 */
export function distressOf(world: World, war: GeoRelation, sideId: EntityId): number {
  const side = world.nations.get(sideId)
  if (!side) return 0
  const ownLosses = sideId === war.a ? war.casualtiesA : war.casualtiesB
  const enemyLosses = sideId === war.a ? war.casualtiesB : war.casualtiesA

  // Losing the exchange is the loudest signal — this is "taking more deaths".
  const deficit = Math.max(0, ownLosses - enemyLosses)
  const bleeding = Math.min(500, Math.floor(deficit / 60))
  // What the war has cost the country itself.
  const ground = Math.min(300, Math.floor(((side.baseStrength - side.strength) * 300) / Math.max(1, side.baseStrength)))
  // And the simple weight of a long war.
  const months = world.tick - war.sinceTick
  const dragging = Math.min(200, Math.floor(months * 2))

  return Math.min(1000, bleeding + ground + dragging)
}

/** Allies of a nation: the standing alliance a bloc represents (ADR-0022 §3). */
export function alliesOf(world: World, nationId: EntityId): Nation[] {
  const nation = world.nations.get(nationId)
  if (!nation || nation.bloc === null) return []
  return [...world.nations.values()]
    .filter((other) => other.id !== nationId && other.bloc === nation.bloc)
    .sort((x, y) => x.id - y.id)
}

/** Was this ally asked about this war recently? Events are the ledger. */
function calledRecently(world: World, callerId: EntityId, allyId: EntityId, tick: Tick): boolean {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event) continue
    if (tick - event.tick > CALL_REPEAT_MONTHS) return false
    if (event.type === 'call-to-arms' && event.subjectId === callerId && event.otherId === allyId) {
      return true
    }
  }
  return false
}

/**
 * Would this ally join? The spec's formula, with its two open constants
 * measured rather than guessed (see the arc's commit message).
 *
 * A close ally with a dangerous enemy at the door joins; one that is worn
 * out or already fighting two wars stays home. Nothing here is scripted and
 * nothing is special-cased by country.
 */
export function joinScoreFor(
  world: World,
  allyId: EntityId,
  askerId: EntityId,
  enemyId: EntityId,
  tick: Tick,
): number {
  const ally = world.nations.get(allyId)
  const enemy = world.nations.get(enemyId)
  if (!ally || !enemy) return 0

  // How close they stand. A standing alliance is worth most of it; the rest
  // is how the two are actually getting on.
  const asker = world.nations.get(askerId)
  const sameBloc = asker !== undefined && ally.bloc !== null && ally.bloc === asker.bloc
  const state = relationBetween(world, allyId, askerId)?.state ?? 'peace'
  const closeness =
    (sameBloc ? 500 : 0) + (state === 'peace' ? 200 : state === 'tension' ? 60 : 0)

  // A dangerous enemy is a reason to fight it beside somebody (the spec's
  // threatLevel term).
  const threat = combatPowerOf(enemy) * 22

  // Worn out: still resting from the last war, or fresh out of a long one.
  const resting = ally.exhaustedUntilTick !== null && tick < ally.exhaustedUntilTick ? 300 : 0
  const weariness = resting + Math.min(200, Math.floor(ally.warMonths / 3))

  // Already stretched thin.
  const fighting = [...world.geoRelations.values()].filter(
    (r) => r.state === 'war' && (r.a === allyId || r.b === allyId),
  ).length

  return closeness + threat - weariness - fighting * MULTI_WAR_PENALTY
}

/**
 * How many countries are at war with this one right now.
 *
 * Counts every war relation the enemy is in, on either side, because a
 * coalition is not one relation: each ally that joins declares its own war,
 * and the ceiling has to see all of them or it sees nothing.
 */
function belligerentsAgainst(world: World, enemyId: EntityId): number {
  let count = 0
  for (const relation of world.geoRelations.values()) {
    if (relation.state !== 'war') continue
    if (relation.a === enemyId || relation.b === enemyId) count += 1
  }
  return count
}

/**
 * The monthly pass: who is in trouble, who they ask, and who answers.
 *
 * Called from the geopolitics tick, after wars have advanced — the distress
 * that decides a call is this month's, not last month's.
 */

export function runCallsToArms(world: World, tick: Tick): void {
  // Ascending pair order, as everywhere: processing order must be reproducible.
  const wars = [...world.geoRelations.values()]
    .filter((relation) => relation.state === 'war')
    .sort((x, y) => x.a - y.a || x.b - y.b)

  for (const war of wars) {
    const months = tick - war.sinceTick
    if (months < MIN_CALL_MONTHS) continue

    for (const sideId of [war.a, war.b]) {
      const enemyId = sideId === war.a ? war.b : war.a
      const distress = distressOf(world, war, sideId)
      // A country that is coping does not go asking. Without a floor, every
      // belligerent asked every ally every year of every war — measured at
      // 3.8 calls a year, which is chatter rather than a moment.
      if (distress < MIN_CALL_DISTRESS) continue

      // "Completely random, but before year 5 if the war is really that
      // bad" — the odds climb with distress, and severe distress stops
      // being a draw at all once the fifth year is in sight.
      const rng = openStream(world.seed, Stream.Geopolitics, sideId * 7919 + enemyId, tick)
      const desperate = distress >= SEVERE_DISTRESS && months >= LATEST_SEVERE_CALL_MONTHS
      if (!desperate && !rng.chance(distress, 24_000)) continue

      const caller = world.nations.get(sideId)
      const enemy = world.nations.get(enemyId)
      if (!caller || !enemy) continue

      // THE FIGHT IS ALREADY BIG ENOUGH. Counted across every war against
      // this enemy, not just this one relation, because each ally that
      // joins becomes its own war and would otherwise start recruiting too.
      if (belligerentsAgainst(world, enemyId) >= MAX_BELLIGERENTS) continue

      for (const ally of alliesOf(world, sideId)) {
        if (ally.id === enemyId) continue
        // Already in it, on either side.
        const existing = relationBetween(world, ally.id, enemyId)
        if (existing?.state === 'war') continue
        if (calledRecently(world, sideId, ally.id, tick)) continue

        recordEvent(world, tick, {
          type: 'call-to-arms',
          subjectId: sideId,
          otherId: ally.id,
          detail: `${caller.name} asked ${ally.name} for help against ${enemy.name}`,
        })

        const score = joinScoreFor(world, ally.id, sideId, enemyId, tick)
        if (score >= JOIN_THRESHOLD) {
          joinWar(world, tick, ally, caller, enemy, score, distress)
        } else {
          declineCall(world, tick, ally, caller, enemy, score)
        }
        // ONE ASKED, THEN STOP. A country picks up the telephone once a
        // month, not eight times in an afternoon — and the whole bloc
        // arriving together is exactly what made a border war look like a
        // world war. The next ally, if the war is still going badly, gets
        // asked next month.
        break
      }
    }
  }
}

/**
 * An ally answers. It declares against the same enemy — an ordinary war,
 * with its own relation, its own casualties and its own length — and the
 * record says whose war it joined and why.
 */
function joinWar(
  world: World,
  tick: Tick,
  ally: Nation,
  caller: Nation,
  enemy: Nation,
  score: number,
  distress: number,
): void {
  const key = relationKey(ally.id, enemy.id)
  const existing = world.geoRelations.get(key)
  if (!existing) return

  world.geoRelations.set(key, {
    ...existing,
    state: 'war',
    sinceTick: tick,
    warPhase: 'opening',
    casualtiesA: 0,
    casualtiesB: 0,
    // A war joined in support runs as long as it runs: the ally is in until
    // it ends (ADR-0022 §6), and the length is the one the ORIGINAL war is
    // already living out, so a coalition ends together.
    plannedWarMonths: world.geoRelations.get(relationKey(caller.id, enemy.id))?.plannedWarMonths ?? null,
  })

  recordEvent(world, tick, {
    type: 'joined-war',
    subjectId: ally.id,
    otherId: enemy.id,
    detail: `${ally.name} joined the war against ${enemy.name} alongside ${caller.name}`,
  })
  recordDecision(world, tick, {
    subjectId: ally.id,
    decision: 'geopolitics',
    significance: 'defining',
    inputs: [
      factor('alliance-obligation', Math.min(1000, score)),
      factor('ally-in-distress', distress),
    ],
    chosen: `joined ${caller.name}'s war against ${enemy.name}`,
    rejected: [`to stay out of it`],
    streamId: Stream.Geopolitics,
  })
}

/** Or it does not, and the asking costs something between them. */
function declineCall(
  world: World,
  tick: Tick,
  ally: Nation,
  caller: Nation,
  enemy: Nation,
  score: number,
): void {
  const key = relationKey(ally.id, caller.id)
  const between = world.geoRelations.get(key)
  // Declining chills the friendship: a pair at peace slips toward tension
  // once the asking has been refused enough times. The engine's relations
  // are rungs rather than a number, so the hit is recorded and applied at
  // the rung — no invented scale.
  if (between && between.state === 'peace') {
    const refusals = world.events.filter(
      (e) => e.type === 'declined-call' && e.subjectId === ally.id && e.otherId === caller.id,
    ).length
    if (refusals + 1 >= 2) {
      world.geoRelations.set(key, { ...between, state: 'tension', sinceTick: tick })
    }
  }

  recordEvent(world, tick, {
    type: 'declined-call',
    subjectId: ally.id,
    otherId: caller.id,
    detail: `${ally.name} stayed out of ${caller.name}'s war against ${enemy.name}`,
  })
  recordDecision(world, tick, {
    subjectId: ally.id,
    decision: 'geopolitics',
    // MAJOR, so the road not taken survives: records keep their rejected
    // alternatives only from 'major' up (Law 6 compression), and for a
    // refusal the alternative IS the story. C2's review made exactly this
    // call about the honest road out of a theft.
    significance: 'major',
    inputs: [
      factor('own-choice', Math.max(0, JOIN_THRESHOLD - score)),
      factor('war-weariness', DECLINE_RELATION_HIT * 10),
    ],
    chosen: `stayed out of ${caller.name}'s war`,
    rejected: [`to join against ${enemy.name}`],
    streamId: Stream.Geopolitics,
  })
}
