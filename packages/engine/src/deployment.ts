/**
 * Deployment and risk: the war finds you. L4-M4.
 *
 * THE PERMANENT RULE, now executable (MILITARY_AND_WAR_FOUNDATION §2, §5):
 * danger is COMPUTED, per theatre per month, from the simulated geopolitical
 * state — the enemy's capability, the war's phase — crossed with what the
 * deployed person's specialty does all day (the exposure profile). It is a
 * VECTOR of separate threats. No number in this file is stored per country,
 * and no country has a rating. If the war ends, the same theatre is quiet.
 *
 * MOST MONTHS, NOTHING HAPPENS (foundation §6): the resolution rates are
 * tuned so a tour's typical month is duty, not contact. When something does
 * happen, it lands on the health system's model (a wound is a wound whether a
 * mill or a mortar made it) or, rarely, ends a life through the same
 * performDeath every other death uses — combat gets no cheaper machinery.
 *
 * ASYMMETRIC INFORMATION (foundation §8): the event a family reads is short —
 * what could be known. The causal record carries the chain: enemy capability,
 * war phase, the channel of exposure, the seeded uncertainty. The player who
 * asks "why?" later sees what the soldier could not.
 *
 * Draws on Stream.CombatResolution — stream 10, the last one reserved in
 * Milestone 1, claimed here.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { grantAirMedal, grantPow, grantCampaignMedal, grantCombatAction, grantWoundRecognition,
  grantOverseas,
} from './awards.js'

/** How a contact reads, by the channel that found them. Flat, specific. */
const CONTACT_FLAVORS: Readonly<Record<'direct-combat-exposure' | 'convoy-exposure' | 'base-attack-exposure', readonly string[]>> = {
  'direct-combat-exposure': [
    'Took fire on patrol; gave it back',
    'A firefight at the checkpoint before dawn',
    'Contact in the treeline; it broke off by dark',
    'An ambush walked into, and fought out of',
    'A sniper worked the road for a week',
    'House to house in a village with no name',
    'A night raid; the guns spoke for an hour',
  ],
  'convoy-exposure': [
    'The convoy took fire on the route',
    'A device on the road; the trucks limped home',
    'Small arms on the resupply run',
    'The lead truck found the mine',
    'Drones over the column all day',
    'An overpass ambush; the convoy ran the gap',
    'A checkpoint on the route that was not ours',
  ],
  'base-attack-exposure': [
    'Mortars on the outpost after dark',
    'Rockets into the base perimeter',
    'A probe at the wire, driven off',
    'A drone dropped its small bomb on the motor pool',
    'Sappers in the wire at midnight',
    'Counter-battery all night; nobody slept',
    'The siren, the shelter, the counting after',
  ],
}
import { activeWars, combatPowerOf, homeland, isAtWar, relationBetween } from './geopolitics.js'
import { inflictFieldIllness, inflictWound } from './health.js'
import { raisePending } from './player.js'
import { encodeScene, pickScene, rollThreat, SCENE_OPTIONS } from './scenes.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import { boostServicePerformance, isServing, squadmatesOf } from './service.js'
import { performDeath } from './systems.js'
import type { Deployment, GeoRelation, Nation, Person, World } from './types.js'
import { specialtyFor, unitFor } from './worldspec.js'
import { bareName } from './text.js'

/** Planned tour length, months. */
const TOUR_MONTHS = 10
/** Share of the serving force deployed at the height of a war, per mille. */
const DEPLOYED_SHARE_CAP = 600

// --- M-ARMY2 peacetime rotations (owner direction) -------------------------
/** A rotation is shorter than a war tour: six months with an ally. */
const ROTATION_MONTHS = 6
/** Share of the serving force posted abroad in peacetime, per mille. */
const ROTATION_SHARE_CAP = 220
/** Monthly chance per 10k that a given soldier's name comes up. */
const ROTATION_CALL_RATE = 110
/**
 * Peacetime tempo: the number the accident channel is scaled by, standing
 * where a war's threat vector stands. It is deliberately far below any
 * wartime intensity — and it is the ONLY channel a rotation has. Peace has
 * no enemy, so there is no combat, convoy or base-attack weight to cross
 * (the permanent rule: danger is computed from the geopolitical state,
 * and the state here is peace).
 */
const ROTATION_TEMPO = 34
/** What a rotation month actually looks like when it looks like anything. */
const ROTATION_FLAVORS: readonly string[] = [
  'A joint exercise with the host battalion',
  'Weeks on a range that belonged to someone else',
  'A live-fire problem run against an allied company',
  'Winter warfare training in unfamiliar country',
  'A port call, and the work either side of it',
  'Standing a watch a long way from home',
  'An airfield rotation; the same duty under a different sky',
]

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function deploymentsOf(world: World, personId: EntityId): readonly Deployment[] {
  return world.deployments.get(personId) ?? []
}

export function currentDeployment(world: World, personId: EntityId): Deployment | undefined {
  const all = world.deployments.get(personId)
  if (!all) return undefined
  const last = all[all.length - 1]
  return last !== undefined && last.returnedAtTick === null ? last : undefined
}

export function isDeployed(world: World, personId: EntityId): boolean {
  // The dead are not deployed, whatever their tour record says this tick —
  // without this, a death in theatre outside the combat resolver (disease,
  // the town's own mortality) held a quota slot forever (review).
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return false
  return currentDeployment(world, personId) !== undefined
}

/**
 * The month's threat vector for a theatre: the geopolitical state, read at
 * this moment. Integer weights per channel; specialty exposure crosses them.
 */
export interface ThreatVector {
  readonly directCombat: number
  readonly convoy: number
  readonly baseAttack: number
  readonly accident: number
}

export function threatVectorFor(war: GeoRelation, enemy: Nation, home?: Nation): ThreatVector {
  const phase = war.warPhase ?? 'attrition'
  // Phase shapes WHERE the danger lives, not only how much of it there is:
  // offensives sharpen the front, attrition grinds the roads, stalemates
  // shell the bases. Enemy strength scales everything — a capable enemy
  // reaches rear areas a weak one cannot (foundation §5).
  const intensity =
    phase === 'opening' ? 130 : phase === 'offensive' ? 150 : phase === 'attrition' ? 100 : 70
  const reach = 40 + Math.floor(enemy.strength / 2) // 40..540

  // HOW BADLY THE ENEMY OUTCLASSES US (owner spec). Strength above is a
  // country's current CAPACITY and it erodes as its wars grind on; combat
  // power is what it is like to fight — its rating plus what its wars
  // taught it. The difference between the two sides is what a month in
  // theatre feels like, so it scales the whole vector: even against a
  // stronger side, +/-12 lands between roughly half and double.
  //
  // Still a VECTOR, not a country lookup (foundation rule 1): this scales a
  // threat that is computed from the war's own state, and no channel is
  // ever read off a country's identity.
  const delta = home === undefined ? 0 : combatPowerOf(enemy) - combatPowerOf(home)
  const overmatch = Math.max(400, Math.min(2000, 1000 + delta * 90))
  const scaled = (base: number): number => Math.floor((base * overmatch) / 1000)

  return {
    directCombat: scaled(Math.floor((reach * intensity * (phase === 'offensive' ? 14 : 9)) / 1000)),
    convoy: scaled(Math.floor((reach * intensity * (phase === 'attrition' ? 13 : 8)) / 1000)),
    baseAttack: scaled(Math.floor((reach * intensity * (phase === 'stalemate' ? 12 : 6)) / 1000)),
    // Operational tempo hurts by itself: vehicles, weather, fatigue — and it
    // does not care who is on the other side.
    accident: 25 + Math.floor(intensity / 3),
  }
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runDeployments(world: World, tick: Tick): void {
  const home = homeland(world)
  if (!home) return

  const homelandWars = activeWars(world).filter((war) => war.a === home.id || war.b === home.id)

  resolveTours(world, tick, homelandWars)
  // War calls first and calls louder. In peacetime the army still goes
  // places: the alliance is kept warm by people, not paper (M-ARMY2).
  if (homelandWars.length > 0) issueOrders(world, tick, home, homelandWars)
  else issueRotations(world, tick, home)
}

/**
 * Allies who could host a rotation: the same bloc, at peace with the
 * Republic, and not fighting anyone themselves — a peacetime posting into
 * somebody else's shooting war is not a peacetime posting. Sorted by id.
 */
function rotationHosts(world: World, home: Nation): Nation[] {
  if (home.bloc === null) return []
  const hosts: Nation[] = []
  for (const nation of world.nations.values()) {
    if (nation.id === home.id || nation.bloc !== home.bloc) continue
    if (isAtWar(world, nation.id)) continue
    const relation = relationBetween(world, home.id, nation.id)
    if (relation !== undefined && relation.state !== 'peace') continue
    hosts.push(nation)
  }
  hosts.sort((a, b) => a.id - b.id)
  return hosts
}

/** Whether a peacetime posting is available at all — the Service tab's
 *  volunteer button reads this to answer honestly. */
export function rotationAvailable(world: World): boolean {
  const home = homeland(world)
  if (!home) return false
  if (activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return false
  return rotationHosts(world, home).length > 0
}

/**
 * M-ARMY2 (owner direction). Wars an ALLY is fighting and the Republic is
 * not. Same bloc, at peace with us — the alliance's war, which our people
 * can be sent to support without the Republic itself being a belligerent.
 *
 * This is what replaced the "three wars at once" idea: rather than forcing
 * the homeland into constant war, the alliance gives a soldier somewhere
 * real to go. Danger still comes from the war's own state — the ally's
 * enemy, the ally's war phase — so the permanent rule is untouched.
 */
export function alliedWars(world: World): { war: GeoRelation; ally: Nation; enemy: Nation }[] {
  const home = homeland(world)
  if (!home || home.bloc === null) return []
  const found: { war: GeoRelation; ally: Nation; enemy: Nation }[] = []
  for (const war of activeWars(world)) {
    if (war.a === home.id || war.b === home.id) continue
    for (const [allyId, enemyId] of [
      [war.a, war.b],
      [war.b, war.a],
    ] as const) {
      const ally = world.nations.get(allyId)
      const enemy = world.nations.get(enemyId)
      if (!ally || !enemy || ally.bloc !== home.bloc) continue
      const standing = relationBetween(world, home.id, ally.id)
      if (standing !== undefined && standing.state !== 'peace') continue
      found.push({ war, ally, enemy })
    }
  }
  found.sort((x, y) => x.ally.id - y.ally.id || x.enemy.id - y.enemy.id)
  return found
}

/** Whether there is an ally's war a soldier could ask to join. */
export function supportDeploymentAvailable(world: World): boolean {
  const home = homeland(world)
  if (!home) return false
  if (activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return false
  return alliedWars(world).length > 0
}

/**
 * Go and fight alongside an ally. A real combat tour — the ally's enemy is
 * the enemy, the ally's war phase drives the danger, and every casualty
 * rule that applies to the Republic's own wars applies here. What differs
 * is the record: this was asked for, not ordered.
 */
export function volunteerForSupport(world: World, tick: Tick, personId: EntityId): boolean {
  // Our own war comes first. A soldier does not go to an ally's front
  // while the Republic is fighting for itself — the orders system has a
  // prior claim on them (test: the support door is shut in our own war).
  const home = homeland(world)
  if (!home) return false
  if (activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return false
  const chosen = alliedWars(world)[0]
  if (!chosen) return false

  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || person.deathTick !== null) return false
  if (!record || record.dischargedAtTick !== null) return false
  if (isDeployed(world, personId)) return false
  if (!isPipelineTrained(world, tick, record)) return false

  startCombatTour(world, tick, personId, chosen.war, chosen.enemy.id, [
    factor('own-choice', 1000),
    factor('war-demanded-troops', Math.min(1000, chosen.enemy.strength)),
  ], `volunteered for the ${chosen.enemy.name} front alongside ${chosen.ally.name}`, [
    'to stay at the home station',
  ])
  return true
}

/** The shared rotation opener: orders and volunteers use one door. */
function startRotation(
  world: World,
  tick: Tick,
  personId: EntityId,
  host: Nation,
  inputs: readonly ReturnType<typeof factor>[],
  chosen: string,
  rejected: readonly string[],
): void {
  const history = world.deployments.get(personId) ?? []
  const rotation: Deployment = {
    personId,
    kind: 'rotation',
    warA: null,
    warB: null,
    enemyId: null,
    hostId: host.id,
    startedAtTick: tick,
    endsAtTick: (tick + ROTATION_MONTHS) as Tick,
    returnedAtTick: null,
    tourNumber: history.length + 1,
    capturedAtTick: null,
  }
  world.deployments.set(personId, [...history, rotation])

  recordEvent(world, tick, {
    type: 'deployed',
    subjectId: personId,
    otherId: host.id,
    detail: `a rotation to ${host.name}`,
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'deployment',
    significance: 'notable',
    inputs: [...inputs],
    chosen,
    rejected: [...rejected],
    streamId: Stream.CombatResolution,
  })
}

/**
 * Peacetime postings go out. Like orders, not a question — the army sends
 * who it sends — but a smaller share of the force and a shorter time away.
 */
function issueRotations(world: World, tick: Tick, home: Nation): void {
  const hosts = rotationHosts(world, home)
  if (hosts.length === 0) return
  const serving = countServing(world)
  if (serving === 0) return
  if (countDeployed(world) * 1000 >= serving * ROTATION_SHARE_CAP) return

  for (const person of deployablePeople(world)) {
    const rng = openStream(world.seed, Stream.CombatResolution, person.id, tick + 611)
    if (!rng.chanceInTenThousand(ROTATION_CALL_RATE)) continue
    const host = rng.pick(hosts)
    startRotation(
      world, tick, person.id, host,
      [factor('under-orders', 1000)],
      `posted to ${host.name} on rotation`,
      [],
    )
  }
}

/**
 * A hand raised for a peacetime rotation. The Service tab's volunteer verb
 * answers this in the years between wars, so the button is not a dead end
 * for a whole career.
 */
export function volunteerForRotation(world: World, tick: Tick, personId: EntityId): boolean {
  const home = homeland(world)
  if (!home) return false
  if (activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return false
  const hosts = rotationHosts(world, home)
  if (hosts.length === 0) return false

  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || person.deathTick !== null) return false
  if (!record || record.dischargedAtTick !== null) return false
  if (isDeployed(world, personId)) return false
  if (!isPipelineTrained(world, tick, record)) return false

  const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 612)
  const host = rng.pick(hosts)
  startRotation(
    world, tick, personId, host,
    [factor('own-choice', 1000)],
    `volunteered for the rotation to ${host.name}`,
    ['to stay at the home station'],
  )
  return true
}

/** Who is serving and not deployed, in id order. */
/** Whether the CURRENT trade's schooling is behind them: the enlistment
 *  pipeline (basic + school), or — after a P2 retrain — the new school
 *  counted from the change. One rule for orders and volunteers alike. */
function isPipelineTrained(
  world: World,
  tick: Tick,
  record: NonNullable<ReturnType<World['service']['get']>>,
): boolean {
  const schoolMonths = specialtyFor(world, record.specialtyId).schoolMonths
  if (record.specialtyChangedAtTick !== null) {
    return tick - record.specialtyChangedAtTick >= schoolMonths
  }
  return tick - record.enlistedAtTick >= 2 + schoolMonths
}

function deployablePeople(world: World): Person[] {
  const eligible: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (!isServing(world, person.id)) continue
    if (isDeployed(world, person.id)) continue
    // Nobody deploys out of the schoolhouse: the training pipeline (basic,
    // then the trade school) finishes before orders can find you. Without
    // this gate a recruit could "finish basic training" in a theatre — and
    // a P2 retrain restarts the clock for the NEW trade's school, or a
    // reclassed soldier would carry the new exposure profile the same month
    // (military review S2).
    const record = world.service.get(person.id)
    if (record && !isPipelineTrained(world, world.tick, record)) continue
    eligible.push(person)
  }
  eligible.sort((a, b) => a.id - b.id)
  return eligible
}

function countDeployed(world: World): number {
  let deployed = 0
  for (const [personId] of world.deployments) {
    if (isDeployed(world, personId)) deployed++
  }
  return deployed
}

function countServing(world: World): number {
  let serving = 0
  for (const record of world.service.values()) {
    if (record.dischargedAtTick === null) serving++
  }
  return serving
}

/**
 * Orders go out while the Republic fights. Not a choice — deployment is the
 * army's decision, and the record says so honestly ('under-orders'). The
 * player is not asked; they are told, in the feed, like everyone who ever
 * got orders.
 */
function issueOrders(world: World, tick: Tick, home: Nation, wars: GeoRelation[]): void {
  const serving = countServing(world)
  if (serving === 0) return
  const deployed = countDeployed(world)
  if (deployed * 1000 >= serving * DEPLOYED_SHARE_CAP) return

  for (const person of deployablePeople(world)) {
    const rng = openStream(world.seed, Stream.CombatResolution, person.id, tick)
    // The draft board's arithmetic: a hotter war calls more names.
    const war = wars[rng.nextInt(0, wars.length)]
    if (!war) continue
    const phase = war.warPhase ?? 'attrition'
    const callRate = phase === 'opening' || phase === 'offensive' ? 340 : 200
    if (!rng.chanceInTenThousand(callRate)) continue

    const enemyId = war.a === home.id ? war.b : war.a
    const enemy = world.nations.get(enemyId)

    // THE PLAYER IS TOLD, AND THEN ASKED WHETHER THEY OBEY (ADR-0022 §5,
    // owner direction). Orders are not a choice about whether the army
    // wants you — that part is already decided, and the clock halts here
    // rather than deploying them behind their own back. What they can do is
    // go, ask to be excused, or refuse, and the last one ends a career.
    if (person.id === world.player.personId) {
      raisePending(world, {
        tick,
        kind: 'deployment-order',
        personId: person.id,
        otherId: enemyId,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['go', 'request-exemption', 'refuse'],
      })
      continue
    }

    startCombatTour(
      world, tick, person.id, war, enemyId,
      [
        factor('under-orders', 1000),
        factor('war-demanded-troops', Math.min(1000, enemy?.strength ?? 300)),
      ],
      `deployed to ${enemy ? `the ${bareName(enemy.name)} front` : 'the front'}`,
      [],
    )
  }
}

/**
 * One door into a war, for orders, for volunteers, and for going to an
 * ally's war — so a tour is a tour whatever put someone on the boat, and
 * only the record's factors say which it was.
 */
function startCombatTour(
  world: World,
  tick: Tick,
  personId: EntityId,
  war: GeoRelation,
  enemyId: EntityId,
  inputs: readonly ReturnType<typeof factor>[],
  chosen: string,
  rejected: readonly string[],
): void {
  const history = world.deployments.get(personId) ?? []
  const deployment: Deployment = {
    personId,
    kind: 'combat',
    warA: war.a,
    warB: war.b,
    enemyId,
    hostId: null,
    startedAtTick: tick,
    endsAtTick: (tick + TOUR_MONTHS) as Tick,
    returnedAtTick: null,
    tourNumber: history.length + 1,
    capturedAtTick: null,
  }
  world.deployments.set(personId, [...history, deployment])

  const enemy = world.nations.get(enemyId)
  recordEvent(world, tick, {
    type: 'deployed',
    subjectId: personId,
    otherId: enemyId,
    detail: enemy ? `the ${bareName(enemy.name)} front` : 'the front',
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'deployment',
    significance: 'defining',
    inputs: [...inputs],
    chosen,
    rejected: [...rejected],
    streamId: Stream.CombatResolution,
  })
}

/**
 * A hand raised for the rotation (M-SERVICE-PLAY). Same tour machinery as
 * orders — the war a volunteer gets is no kinder — but the record says
 * 'own-choice' where orders say 'under-orders', because that difference is
 * the truth of the moment and a life story should keep it. Returns false
 * when there is no war, no training, or no standing to go.
 */
export function volunteerForDeployment(world: World, tick: Tick, personId: EntityId): boolean {
  const home = homeland(world)
  if (!home) return false
  const wars = activeWars(world).filter((w) => w.a === home.id || w.b === home.id)
  const war = wars[0]
  if (!war) return false

  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || person.deathTick !== null) return false
  if (!record || record.dischargedAtTick !== null) return false
  if (isDeployed(world, personId)) return false
  if (!isPipelineTrained(world, tick, record)) return false

  const enemyId = war.a === home.id ? war.b : war.a
  const enemy = world.nations.get(enemyId)
  startCombatTour(
    world, tick, personId, war, enemyId,
    [
      factor('own-choice', 1000),
      factor('war-demanded-troops', Math.min(1000, enemy?.strength ?? 300)),
    ],
    `volunteered for ${enemy ? `the ${bareName(enemy.name)} front` : 'the front'}`,
    ['to wait for orders'],
  )
  return true
}

/**
 * The player's answer to "your host has gone to war". Staying closes the
 * rotation and opens a real tour against the ally's enemy; going home just
 * closes the rotation. Called from resolvePending so both roads run through
 * the same machinery the automatic path uses.
 */
export function answerSupportDeployment(
  world: World,
  tick: Tick,
  personId: EntityId,
  stay: boolean,
): void {
  const deployment = currentDeployment(world, personId)
  if (!deployment || deployment.kind !== 'rotation' || deployment.hostId === null) return
  const hostId = deployment.hostId
  const support = alliedWars(world).find((option) => option.ally.id === hostId)
  if (!stay || support === undefined) {
    closeTour(world, tick, personId, deployment, false, 'host at war')
    return
  }
  closeTour(world, tick, personId, deployment, false, 'stayed to fight')
  startCombatTour(
    world, tick, personId, support.war, support.enemy.id,
    [factor('own-choice', 1000), factor('war-demanded-troops', support.enemy.strength)],
    `stayed on to fight beside ${support.ally.name}`,
    ['to go home'],
  )
}

/**
 * M-ARMY2 (owner direction). The minutes after a serious wound, which the
 * simulation already had numbers for and never let anyone live through.
 *
 * Raised for the PLAYER when their own wound is serious, and for a player
 * MEDIC when a squadmate goes down beside them. Returns whether a question
 * landed, so the caller knows the outcome is now the answer's business.
 *
 * The wound itself is already inflicted and its peak already recorded —
 * what the answer decides is whether it is survived and what it leaves
 * behind. A choice is never a discount on being shot.
 */
/**
 * Whether the wound about to be inflicted will stop the world for a
 * decision. The monthly resolver asks this BEFORE its own fatal roll: when
 * a moment is coming, the answer carries the whole mortal tail, so field
 * aid is never a surcharge on top of a death roll that already happened
 * (review S3 — the player's wounds were half again as lethal as anyone
 * else's, and standing near a player medic was dangerous).
 */
export function fieldAidWillBeOffered(
  world: World,
  casualtyId: EntityId,
  severity: number,
  pendingSlotFree = true,
): boolean {
  const playerId = world.player.personId
  if (playerId === null || severity < 600) return false
  if (pendingSlotFree && world.player.pending !== null) return false
  if (casualtyId === playerId) {
    const person = world.people.get(playerId)
    return person !== undefined && person.deathTick === null
  }
  const record = world.service.get(playerId)
  if (!record || record.dischargedAtTick !== null || record.specialtyId !== 'medic') return false
  if (!isDeployed(world, playerId)) return false
  const casualty = world.people.get(casualtyId)
  if (!casualty || casualty.deathTick !== null) return false
  if (!squadmatesOf(world, playerId).some((mate) => mate.personId === casualtyId)) return false
  // Same war, same tour — a medic's hands do not reach another front
  // (review S6). Squad membership is a base fact; being there is not.
  const mine = currentDeployment(world, playerId)
  const theirs = currentDeployment(world, casualtyId)
  if (!mine || !theirs) return false
  return mine.warA === theirs.warA && mine.warB === theirs.warB && mine.enemyId === theirs.enemyId
}

export function offerFieldAid(
  world: World,
  tick: Tick,
  casualtyId: EntityId,
  severity: number,
): boolean {
  const playerId = world.player.personId
  if (playerId === null || world.player.pending !== null) return false
  if (!fieldAidWillBeOffered(world, casualtyId, severity)) return false

  if (casualtyId === playerId) {
    return raisePending(world, {
      tick,
      kind: 'first-aid',
      personId: playerId,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['press-the-wound', 'call-for-help', 'lie-still'],
    })
  }

  // The medic's moment: their own trade, their own squad, their own war —
  // every gate already checked by fieldAidWillBeOffered above.
  return raisePending(world, {
    tick,
    kind: 'treat-casualty',
    personId: playerId,
    otherId: casualtyId,
    occupationId: null,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: ['work-the-wound', 'drag-them-out', 'call-the-evac'],
  })
}

/** Medical evacuation from outside the monthly resolver — a combat-moment
 *  wound bad enough that the war is over for them this tour. */
export function evacuateHome(world: World, tick: Tick, personId: EntityId): void {
  const deployment = currentDeployment(world, personId)
  if (deployment) closeTour(world, tick, personId, deployment, true)
}

/** A month in theatre for everyone out there — and the way home at tour's end. */
// ---------------------------------------------------------------------------
// CAPTURE (ADR-0025). The third thing a bad day can end in.
//
// Until now a month that went wrong ended in a wound or a death, which
// makes every war a war where nobody is ever taken. Capture is rarer than
// either and worse than most: the tour stops running on the calendar, the
// clock outside keeps going, and how it ends is not the prisoner's to
// decide. The Prisoner of War Medal is grantable because of this branch and
// only because of it — the owner's rule is that no award exists that
// cannot be earned.
// ---------------------------------------------------------------------------

/** Held right now — an open tour with a capture on it. */
export function isCaptive(world: World, personId: EntityId): boolean {
  return currentDeployment(world, personId)?.capturedAtTick !== null &&
    currentDeployment(world, personId) !== undefined
}

/** When they were taken, or null. */
export function capturedSince(world: World, personId: EntityId): Tick | null {
  return currentDeployment(world, personId)?.capturedAtTick ?? null
}

/**
 * Take somebody prisoner. Returns false when there is nothing to take them
 * from — no open tour, no enemy, or already held.
 */
export function capture(world: World, tick: Tick, personId: EntityId, rng: ReturnType<typeof openStream>): boolean {
  const deployment = currentDeployment(world, personId)
  if (!deployment || deployment.capturedAtTick !== null || deployment.enemyId === null) return false
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return false
  const enemy = world.nations.get(deployment.enemyId)

  const tours = world.deployments.get(personId) ?? []
  world.deployments.set(
    personId,
    tours.map((tour) =>
      tour.returnedAtTick === null && tour.startedAtTick === deployment.startedAtTick
        ? { ...tour, capturedAtTick: tick }
        : tour,
    ),
  )

  const captured = recordEvent(world, tick, {
    type: 'was-captured',
    subjectId: personId,
    ...(deployment.enemyId !== null ? { otherId: deployment.enemyId } : {}),
    detail: enemy?.name ?? 'a hostile force',
  })
  // Law 3: being taken is not a choice, and the record says so plainly
  // rather than inventing a decision the prisoner never made.
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'deployment',
    significance: 'defining',
    inputs: [factor('battlefield-chaos', 900), factor('enemy-capability', enemy?.strength ?? 500)],
    chosen: `was taken prisoner by ${enemy?.name ?? 'a hostile force'}`,
    rejected: [],
    streamId: Stream.CombatResolution,
  })
  grantPow(world, tick, personId, captured)
  // A captive is not on the roster the war can spend. Whatever the moment
  // did to their body stays; the fighting stops for them here.
  rng.nextInt(0, 1)
  return true
}

/**
 * One month held. Nothing here is the prisoner's decision — that is what
 * makes it captivity — so it is resolved rather than asked.
 *
 * Two doors out. The war ending is by far the wider one: prisoners go home
 * when the shooting stops, and a captivity that outlives its war by decades
 * would be a different and much darker system than this one models.
 */
function resolveCaptivityMonth(
  world: World,
  tick: Tick,
  person: Person,
  deployment: Deployment,
  warOngoing: boolean,
): void {
  const held = tick - (deployment.capturedAtTick ?? tick)
  const rng = openStream(world.seed, Stream.CombatResolution, person.id, tick + 8801)

  // Dying held. Rare per month, worse the longer it runs, and worse still
  // while the war gives nobody a reason to look after prisoners.
  const mortality = Math.min(60, 6 + Math.floor(held / 2)) + (warOngoing ? 0 : -3)
  if (rng.chance(Math.max(1, mortality), 1_000)) {
    performDeath(
      world, tick, person, 'died in captivity',
      [factor('battlefield-chaos', 700), factor('own-choice', 0)],
      Stream.CombatResolution,
    )
    recordEvent(world, tick, {
      type: 'died-in-captivity',
      subjectId: person.id,
      ...(deployment.enemyId !== null ? { otherId: deployment.enemyId } : {}),
      detail: String(held),
    })
    closeTour(world, tick, person.id, deployment, true)
    return
  }

  // Home. The war's end opens the gate; before that it is escape, exchange
  // or a raid, and none of those is common.
  const release = warOngoing ? 12 : 400
  if (held >= 1 && rng.chance(release, 1_000)) {
    recordEvent(world, tick, {
      type: 'repatriated',
      subjectId: person.id,
      ...(deployment.enemyId !== null ? { otherId: deployment.enemyId } : {}),
      detail: String(held),
    })
    const tours = world.deployments.get(person.id) ?? []
    world.deployments.set(
      person.id,
      tours.map((tour) =>
        tour.returnedAtTick === null && tour.startedAtTick === deployment.startedAtTick
          ? { ...tour, capturedAtTick: null }
          : tour,
      ),
    )
    closeTour(world, tick, person.id, currentDeployment(world, person.id) ?? deployment, true)
    evacuateHome(world, tick, person.id)
  }
}

function resolveTours(world: World, tick: Tick, wars: GeoRelation[]): void {
  // Open tours directly, NOT isDeployed — the dead fail isDeployed now,
  // and their tours are exactly the ones the block below must close.
  const deployedIds: EntityId[] = []
  for (const [personId, tours] of world.deployments) {
    if (tours.some((t) => t.returnedAtTick === null)) deployedIds.push(personId)
  }
  deployedIds.sort((a, b) => a - b)

  for (const personId of deployedIds) {
    const person = world.people.get(personId)
    const deployment = currentDeployment(world, personId)
    if (!person || !deployment) continue

    // Died in theatre outside this resolver — disease, or the mortality
    // every month carries. The tour still closes and the campaign credit
    // is still judged (the casualty waiver): the record does not leave
    // people "still there" forever (review).
    if (person.deathTick !== null) {
      closeTour(world, tick, personId, deployment, true)
      for (let i = world.events.length - 1; i >= 0; i--) {
        const died = world.events[i]
        if (!died || died.type !== 'died' || died.subjectId !== personId) continue
        const enemyName =
          deployment.enemyId === null ? undefined : world.nations.get(deployment.enemyId)?.name
        if (enemyName !== undefined) {
          grantCampaignMedal(world, tick, personId, died, enemyName, tick - deployment.startedAtTick, true)
        }
        break
      }
      continue
    }

    // HELD. Before the calendar, before the war lookup, before any of the
    // month's rolls: a prisoner is not fighting, is not accruing contact,
    // and does not come home because the orders said this month.
    if (deployment.capturedAtTick !== null) {
      const theirWar =
        deployment.warA === null || deployment.warB === null
          ? undefined
          : relationBetween(world, deployment.warA, deployment.warB)
      resolveCaptivityMonth(world, tick, person, deployment, theirWar?.state === 'war')
      continue
    }

    // A peacetime posting runs on its own rules: no enemy, no campaign, and
    // the way home is the calendar or a recall (M-ARMY2).
    if (deployment.kind === 'rotation') {
      resolveRotationMonth(world, tick, person, deployment, wars.length > 0)
      continue
    }

    // The tour's OWN war, looked up by its own pair — not filtered to the
    // homeland's wars (review M1). A support tour answers an ALLY's war,
    // which by definition is not one of ours, so the old filtered lookup
    // never found it and closed the tour on the first tick: the player
    // answered "stay and fight" and came home a month later, having seen
    // nothing. One lookup now serves every kind of tour.
    const ongoing =
      deployment.warA === null || deployment.warB === null
        ? undefined
        : relationBetween(world, deployment.warA, deployment.warB)
    const war = ongoing !== undefined && ongoing.state === 'war' ? ongoing : undefined
    const record = world.service.get(personId)

    // The war ended, or the tour did: home. A discharged record mid-tour
    // cannot happen (stop-loss holds the term open), but guard anyway.
    if (!war || tick >= deployment.endsAtTick || !record || record.dischargedAtTick !== null) {
      closeTour(world, tick, personId, deployment)
      continue
    }

    // A combat tour always has one; the null-check is the type system asking
    // the question the rotation branch above already answered.
    const enemyId = deployment.enemyId
    if (enemyId === null) continue
    const enemy = world.nations.get(enemyId)
    if (!enemy) continue

    // The homeland's own power is half the comparison: a war is as hard as
    // the gap between the two sides, not as hard as the enemy alone.
    const threat = threatVectorFor(war, enemy, homeland(world))
    const exposure = specialtyFor(world, record.specialtyId).exposure
    const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 7000)

    // The theatre's oldest killer never fired a shot: disease (M-HARM).
    // Field fever and dysentery are service-connected — line of duty — and
    // carry the same recovery, marking and mortality as any illness.
    if (rng.chance(8, 1_000)) {
      const fieldSeverity = rng.nextBellInt(250, 750)
      const sick = inflictFieldIllness(world, tick, personId, fieldSeverity, rng)
      if (sick !== null) {
        recordEvent(world, tick, {
          type: 'fell-ill',
          subjectId: personId,
          detail: `${fieldSeverity >= 600 ? 'serious' : 'minor'}:${sick.description}`,
        })
      }
    }

    // A special unit's tour points at the fight (M-SPECOPS): the unit
    // multiplies the DIRECT-COMBAT exposure — a fact about what the job is,
    // never about where it is. The permanent rule stands.
    const unit = record.unitId === null ? undefined : unitFor(world, record.unitId)
    const unitMult = unit?.exposureMultiplier ?? 1000

    // One channel is checked per month — the month's dominant hazard, chosen
    // by the crossed weights. Most draws land on nothing at all.
    const channels = [
      { id: 'direct-combat-exposure' as const, weight: Math.floor((threat.directCombat * exposure.directCombat * unitMult) / 1000) },
      { id: 'convoy-exposure' as const, weight: threat.convoy * exposure.convoy },
      { id: 'base-attack-exposure' as const, weight: threat.baseAttack * exposure.baseAttack },
      { id: 'battlefield-accident' as const, weight: threat.accident * exposure.accident },
    ]
    // Exposure is a 0-1000 share of each threat, so normalize the cross
    // before summing — the vector's differences survive to the outcome.
    const totalWeight = channels.reduce((sum, c) => sum + Math.floor(c.weight / 1000), 0)

    // CONTACT IS NOT CASUALTY (owner: five tours as a tier-one rifleman,
    // "not even pop shots"). A month in a war zone can hold fire without
    // holding a wound — most do. Contact events run at four times the old
    // rate and go in the feed as the tour's texture; only the smaller share
    // below escalates to the casualty path, so wound and death rates stay
    // where they were tuned (foundation §6 bound intact).
    // A trade with NO exposure profile at all — the blank that a specialty
    // id this build cannot resolve returns — means no contact, not a floor
    // of it. The Math.max(1, …) below exists so a low-exposure trade is
    // never perfectly safe; a trade the preset never described is not
    // low-exposure, it is unknown, and inventing danger for it invents
    // history (second W1 review).
    if (totalWeight <= 0) continue
    const contactPerMille = Math.min(600, Math.floor(totalWeight / 2))
    if (!rng.chance(Math.max(1, contactPerMille), 1_000)) continue

    const channel = rng.pickWeighted(
      channels.map((c) => c.id),
      channels.map((c) => Math.max(1, c.weight)),
    )
    const isAccident = channel === 'battlefield-accident'

    // The contact itself, on the record — flavored by the channel that
    // found them, and what combat-action recognition reads. Accidents are
    // not contact; they only exist here as the casualty share below.
    if (!isAccident) {
      const flavors = CONTACT_FLAVORS[channel]
      const sawCombat = recordEvent(world, tick, {
        type: 'saw-combat',
        subjectId: personId,
        otherId: enemyId,
        detail: rng.pick(flavors),
      })
      grantCombatAction(world, tick, personId, sawCombat, enemy.name)

      // AVIATION (ADR-0026). What contact means for the aircrew is a
      // mission flown into it — so the same month that gives a rifleman a
      // firefight gives them a sortie, and the Air Medal follows the
      // sortie. Repeatable on purpose: the clusters are the usual case.
      if (record.specialtyId === 'aviator' || record.specialtyId === 'aircrew') {
        const mission = recordEvent(world, tick, {
          type: 'aerial-mission',
          subjectId: personId,
          otherId: enemyId,
          detail: record.specialtyId === 'aviator' ? 'flew the aircraft' : 'crewed the aircraft',
        })
        grantAirMedal(world, tick, personId, mission, enemy.name)
      }

      // Sometimes the month's contact arrives as the PLAYER'S moment: the
      // squad pinned, and a choice that is genuinely theirs (M-HARM, owner
      // direction). The month's danger then resolves through the answer —
      // not through the automatic casualty path below.
      // Owner: "not very many interactive scenes where it's life or death
      // and me choosing." A contact is exactly that moment, and most of
      // them should reach the player rather than resolving over their head.
      if (
        personId === world.player.personId &&
        world.player.pending === null &&
        rng.chance(3, 5)
      ) {
        // THE SCENE, AND HOW BAD IT IS (owner's combat plan §2). The
        // channel that found them picks the scene — the threat vector
        // already decided whether this was a road, a wire or a doorway —
        // and the threat level is rolled from that channel's own weight,
        // so "overrun" means the war is going badly rather than that a die
        // came up. The player is TOLD which before answering: it is a
        // read, not a coin flip.
        const unitId = world.service.get(personId)?.unitId ?? null
        const scene = pickScene(channel, unitId, rng)
        if (scene !== undefined) {
          const weight = channels.find((c) => c.id === channel)?.weight ?? 0
          const threat = rollThreat(Math.floor(weight / 1000), scene.biasToward, rng)
          raisePending(world, {
            tick,
            kind: 'combat-moment',
            personId,
            otherId: enemyId,
            occupationId: encodeScene(scene.id, threat),
            workplaceId: null,
            monthlyPay: null,
            placeId: null,
            options: [...SCENE_OPTIONS],
          })
          continue
        }
      }
    }

    // Most contact ends with everyone walking away.
    if (!rng.chance(250, 1_000)) continue

    // Severity of the month that went wrong, and whether it kills.
    //
    // MEASURED (owner: "we had a war and I didn't see anybody die to any
    // combat exposure"): a 20-year attrition war with 40 enlisted produced
    // 75-85 contacts and 25 wounded per town — and ZERO dead, on all three
    // seeds. The old gate wanted severity >= 940 from a bell curve centred
    // at 650, which is roughly a one-in-a-thousand draw, then took two
    // fifths of that. A war nobody dies in is not a war.
    //
    // The threshold now sits inside the serious band, so the deaths come
    // out of the wounds that were already grave: about a tenth of
    // casualties, which the same measurement puts at two or three
    // townspeople across a long war. Accidents keep their lower share.
    const severity = rng.nextBellInt(300, 1000)
    // When the wound will stop the world for a decision, the DECISION
    // carries the mortal tail — rolling here as well would make the
    // player's wounds (and any wound a player medic can reach) far more
    // lethal than the same wound on anyone else (review S3).
    const aidComing = fieldAidWillBeOffered(world, personId, severity)
    const fatal = !aidComing && severity >= 720 && rng.chance(isAccident ? 1 : 2, 5)

    const phaseFactor = factor('war-phase', war.warPhase === 'offensive' || war.warPhase === 'opening' ? 800 : 450)
    const chain = [
      factor(channel, Math.max(1, Math.floor(channels.find((c) => c.id === channel)!.weight / 200))),
      factor('enemy-capability', enemy.strength),
      phaseFactor,
      factor('battlefield-chaos', severity),
    ]

    if (fatal) {
      // The short fact the family gets; the chain the record keeps (§8).
      performDeath(
        world, tick, person,
        isAccident ? 'an accident on deployment' : 'wounds taken in action',
        chain, Stream.CombatResolution,
      )
      closeTour(world, tick, personId, currentDeployment(world, personId) ?? deployment, true)

      // Posthumous recognition, at the moment, referencing the death itself.
      // Wound recognition ONLY for enemy action — the grant refuses an
      // accident's death event; campaign credit for either (they served the
      // campaign, and dying there waives the duration rule).
      for (let i = world.events.length - 1; i >= 0; i--) {
        const died = world.events[i]
        if (!died || died.type !== 'died' || died.subjectId !== personId) continue
        grantWoundRecognition(world, tick, personId, died, enemy.name)
        grantCampaignMedal(
          world, tick, personId, died, enemy.name,
          tick - deployment.startedAtTick, true,
        )
        break
      }
      continue
    }

    // TAKEN. A bad month against a capable enemy, where the fighting was
    // enemy contact rather than an accident — an accident does not hand
    // anybody over. Rarer than a wound by an order of magnitude, and it
    // replaces the wound rather than adding to it: the capture IS what
    // happened to them this month.
    if (!isAccident && severity >= 650 && rng.chance(1, 14)) {
      if (capture(world, tick, personId, rng)) continue
    }

    // Wounded — and wounded SPECIFICALLY (M-WOUNDS): the channel that found
    // them shapes the harm. A convoy strike is blast and shrapnel; a base
    // attack burns. The health system carries it from here — evacuation home
    // when it is bad enough that the war is over for them this tour.
    const context =
      channel === 'direct-combat-exposure'
        ? ('direct-combat' as const)
        : channel === 'convoy-exposure'
          ? ('convoy' as const)
          : channel === 'base-attack-exposure'
            ? ('base-attack' as const)
            : ('field-accident' as const)
    const wound = inflictWound(world, tick, personId, severity, context, rng)
    const woundEvent = recordEvent(world, tick, {
      type: isAccident ? 'was-injured' : 'wounded-in-action',
      subjectId: personId,
      otherId: enemyId,
      detail: `${severity >= 600 ? 'serious' : 'minor'}:${wound.description}`,
    })
    // The decoration follows the wound at the same tick, referencing it.
    // For an accident the event is 'was-injured' and the grant refuses —
    // which is the eligibility rule doing its job, not a missing case.
    grantWoundRecognition(world, tick, personId, woundEvent, enemy.name)
    // Hit and still conscious — the minutes that decide it, if this is the
    // player's own wound or one their medic's hands can reach (M-ARMY2).
    offerFieldAid(world, tick, personId, severity)
    if (!isAccident) {
      recordDecision(world, tick, {
        subjectId: personId,
        decision: 'deployment',
        significance: 'defining',
        inputs: chain,
        chosen: `was wounded in action on the ${bareName(enemy.name)} front`,
        rejected: [],
        streamId: Stream.CombatResolution,
      })
    }
    if (severity >= 600) {
      closeTour(world, tick, personId, deployment, true)
    }
  }
}

/**
 * A month of a peacetime posting. What can happen here is what can happen
 * to soldiers in peace: they train hard, in unfamiliar country, with real
 * vehicles and live ammunition, and sometimes it goes wrong. There is no
 * enemy — so there is no combat channel at all, and no campaign medal at
 * the end. What the months earn is the work itself, and the record of
 * having gone (M-ARMY2, owner: "can still get hurt over there").
 */
function resolveRotationMonth(
  world: World,
  tick: Tick,
  person: Person,
  deployment: Deployment,
  homelandAtWar: boolean,
): void {
  const personId = person.id
  const record = world.service.get(personId)

  // The Republic went to war while they were out. The posting ends and the
  // orders system takes it from there.
  if (homelandAtWar) {
    closeTour(world, tick, personId, deployment, false, 'recalled')
    return
  }

  // THE PERMANENT RULE, every month, not just at issue (review M2): the
  // host was at peace when the orders were cut, but nations decide their
  // own quarrels. A country that has since gone to war is not a peacetime
  // posting, and this resolver — which has no threat vector and no combat
  // channel at all — must not keep pretending it is.
  //
  // OWNER DIRECTION: and that is a moment, not just a bus home. The
  // country you are standing in has gone to war. You can go home, or you
  // can stay and fight beside them — a real tour, with the ally's enemy
  // and the ally's war phase driving every casualty rule the Republic's
  // own wars use. The player is ASKED; an NPC's answer is their own.
  if (deployment.hostId !== null && isAtWar(world, deployment.hostId)) {
    const hostId = deployment.hostId
    const support = alliedWars(world).find((option) => option.ally.id === hostId)
    if (support === undefined) {
      // Not a war we could support (the host left the bloc, or turned on
      // us). Nothing to decide: they come home.
      closeTour(world, tick, personId, deployment, false, 'host at war')
      return
    }
    if (personId === world.player.personId) {
      if (world.player.pending !== null) return // ask next month; the posting holds
      raisePending(world, {
        tick,
        kind: 'support-deployment',
        personId,
        otherId: support.enemy.id,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: hostId,
        options: ['stay-and-fight', 'go-home'],
      })
      return
    }
    const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 613)
    if (rng.chance(1, 4)) {
      closeTour(world, tick, personId, deployment, false, 'stayed to fight')
      startCombatTour(
        world, tick, personId, support.war, support.enemy.id,
        [factor('own-choice', 1000), factor('war-demanded-troops', Math.min(1000, support.enemy.strength))],
        `stayed on to fight beside ${support.ally.name}`,
        ['to go home'],
      )
    } else {
      closeTour(world, tick, personId, deployment, false, 'host at war')
    }
    return
  }
  if (tick >= deployment.endsAtTick || !record || record.dischargedAtTick !== null) {
    closeTour(world, tick, personId, deployment)
    return
  }

  const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 6100)
  const exposure = specialtyFor(world, record.specialtyId).exposure
  const host = deployment.hostId === null ? undefined : world.nations.get(deployment.hostId)

  // Strange water, close quarters, a barracks full of people from two
  // armies. Lower than a theatre's rate, and service-connected all the same.
  if (rng.chance(3, 1_000)) {
    const severity = rng.nextBellInt(200, 650)
    const sick = inflictFieldIllness(world, tick, personId, severity, rng)
    if (sick !== null) {
      recordEvent(world, tick, {
        type: 'fell-ill',
        subjectId: personId,
        detail: `${severity >= 600 ? 'serious' : 'minor'}:${sick.description}`,
      })
    }
  }

  // The texture of the posting — what a rotation actually IS, in the feed.
  if (rng.chance(1, 5)) {
    recordEvent(world, tick, {
      type: 'field-exercise',
      subjectId: personId,
      ...(host !== undefined ? { otherId: host.id } : {}),
      detail: rng.pick(ROTATION_FLAVORS),
    })
  }

  // The one channel peace has. Crossed with what the trade does all day,
  // exactly as a theatre's channels are — and computed per TEN THOUSAND,
  // because per-mille integer-floored every trade to the same 1 and threw
  // the cross away (review M1: personnel in the same place must not draw
  // the same experience). Signals 6, a deckhand 18.
  const accidentPerTenThousand = Math.floor((ROTATION_TEMPO * exposure.accident) / 1_000)
  if (!rng.chanceInTenThousand(accidentPerTenThousand)) return

  const severity = rng.nextBellInt(250, 1000)
  const chain = [
    factor('battlefield-accident', accidentPerTenThousand),
    factor('under-orders', 400),
    factor('battlefield-chaos', severity),
  ]

  // Rarely, and only at the tail — but it is real, and it is the same death
  // every other death uses. A vehicle on a wet road, a range gone wrong.
  if (severity >= 900 && rng.chance(1, 4)) {
    performDeath(world, tick, person, 'an accident on rotation', chain, Stream.CombatResolution)
    closeTour(world, tick, personId, currentDeployment(world, personId) ?? deployment, true)
    return
  }

  const wound = inflictWound(world, tick, personId, severity, 'field-accident', rng)
  recordEvent(world, tick, {
    type: 'was-injured',
    subjectId: personId,
    detail: `${severity >= 600 ? 'serious' : 'minor'}:${wound.description}`,
  })
  // The harm goes on the record with its causes (review S7): this injury can
  // mark a body permanently and can carry a service pension, and Law 3 does
  // not make an exception for the ones that happen away from a war.
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'deployment',
    significance: severity >= 600 ? 'defining' : 'notable',
    inputs: chain,
    chosen: `was hurt on the rotation to ${host?.name ?? 'an allied country'}`,
    rejected: [],
    streamId: Stream.CombatResolution,
  })
  // Hurt badly enough and the posting is over — home, the same as a theatre.
  // No wound recognition: that decoration is for enemy action, and there is
  // no enemy here (the grant would refuse it anyway; not asking is honest).
  if (severity >= 600) closeTour(world, tick, personId, deployment, true)
}

function closeTour(
  world: World,
  tick: Tick,
  personId: EntityId,
  deployment: Deployment,
  medical = false,
  reason?: string,
): void {
  const history = world.deployments.get(personId) ?? []
  world.deployments.set(
    personId,
    history.map((tour) =>
      tour.startedAtTick === deployment.startedAtTick ? { ...tour, returnedAtTick: tick } : tour,
    ),
  )
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return

  const homecoming = recordEvent(world, tick, {
    type: 'returned-home',
    subjectId: personId,
    detail: reason ?? (medical ? 'evacuated' : deployment.kind === 'rotation' ? 'rotation complete' : 'tour complete'),
  })

  // THE OVERSEAS SERVICE RIBBON (awards pack): a tour outside the homeland,
  // whether or not anybody shot at you. That is the point of it — it says
  // you went, not that you fought — so it hangs off the homecoming itself
  // and covers the peacetime rotations too.
  grantOverseas(world, tick, personId, homecoming)

  if (deployment.kind === 'rotation') {
    // No campaign medal — a campaign is a war. What a completed rotation
    // earns is what the work earns: a better standing at the next board.
    // A recall or an evacuation is not a completed rotation.
    if (reason === undefined && !medical) boostServicePerformance(world, personId, 25)
    return
  }

  // Campaign credit is judged when the tour closes: three months in
  // theatre qualifies, and a tour ended by evacuation qualifies at any
  // length (the casualty waiver). A second tour in the same war adds a
  // device to the same medal.
  const enemyName =
    deployment.enemyId === null ? undefined : world.nations.get(deployment.enemyId)?.name
  if (enemyName !== undefined) {
    grantCampaignMedal(
      world, tick, personId, homecoming, enemyName,
      tick - deployment.startedAtTick, medical,
    )
  }
}


// ---------------------------------------------------------------------------
// Answering orders (ADR-0022 §5)
// ---------------------------------------------------------------------------

/**
 * The player goes. Same door the ordered NPC walks through, so a played
 * tour is the same tour — the record says 'under-orders' either way, and
 * 'reluctantly' only when they tried to get out of it first.
 */
export function deployUnderOrders(
  world: World,
  personId: EntityId,
  enemyId: EntityId,
  extraInputs: readonly ReturnType<typeof factor>[] = [],
): boolean {
  const home = homeland(world)
  if (!home) return false
  const war = activeWars(world).find(
    (candidate) =>
      (candidate.a === home.id && candidate.b === enemyId) ||
      (candidate.b === home.id && candidate.a === enemyId),
  )
  if (!war) return false
  const enemy = world.nations.get(enemyId)

  startCombatTour(
    world,
    world.tick,
    personId,
    war,
    enemyId,
    [
      factor('under-orders', 1000),
      factor('war-demanded-troops', Math.min(1000, enemy?.strength ?? 300)),
      ...extraInputs,
    ],
    `deployed to ${enemy ? `the ${bareName(enemy.name)} front` : 'the front'}`,
    [],
  )
  return true
}
