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
import { describeAilment, pickFatalInjury } from './wounds.js'
import { raisePending } from './player.js'
import { encodeScene, pickScene, rollThreat, SCENE_OPTIONS } from './scenes.js'
import { beatsFor, encodeSequence } from './engagement.js'
import {
  beatFor,
  contactShapePerMille,
  severityBiasFor,
  operationNameFor,
  tempoFor,
  tierFor,
} from './tours.js'
import type { IntensityTier } from './tours.js'
import { bondWith, pickCasualty, squadSpecsFor } from './squad.js'
import type { SquadMember } from './types.js'
import { rollTraits } from './worldgen.js'
import { freshHealth } from './health.js'
import { toDate } from './clock.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { Rng } from './rng.js'
import { nudgeWellbeing } from './wellbeing.js'
import { officerRoleById, specialtyTitleCased } from './content.js'
import { sceneTagsFor } from './enlistment.js'
import { boostServicePerformance, branchName, isServing, rankTitle, squadmatesOf, unitRosterOf } from './service.js'
import { performDeath } from './systems.js'
import type { Deployment, GeoRelation, Nation, Person, ServiceRecord, World } from './types.js'
import { branchSpecFor, specialtyFor, unitFor } from './worldspec.js'
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
 * Per ten thousand per month: who volunteers for an ally's war.
 *
 * A third of the peacetime rotation rate. A rotation is duty somebody is
 * posted to; this is a person choosing to go and fight in a war their
 * country is not in, which is rarer and ought to be.
 */
const SUPPORT_VOLUNTEER_RATE = 35

/** Per 1000 of the serving who may be away on an ally's war at once. */
const SUPPORT_SHARE_CAP = 80
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
  // THE FLOOR IS A WAR, NOT A WALKOVER (owner, playing: five years deployed
  // to a weaker enemy, "never saw combat one time as a medic, zero pop
  // ups"). MEASURED at the old floor of 400: twelve five-year medic tours
  // produced 25 contacts and 11 moments between them, and one tour in
  // twelve had nothing happen at all. Outclassing somebody makes a war less
  // dangerous; it does not make it a posting. The ceiling is untouched — a
  // stronger enemy is as bad as it ever was.
  const overmatch = Math.max(700, Math.min(2000, 1000 + delta * 90))
  const scaled = (base: number): number => Math.floor((base * overmatch) / 1000)

  return {
    directCombat: scaled(Math.floor((reach * intensity * (phase === 'offensive' ? 14 : 9)) / 1000)),
    convoy: scaled(Math.floor((reach * intensity * (phase === 'attrition' ? 13 : 8)) / 1000)),
    baseAttack: scaled(Math.floor((reach * intensity * (phase === 'stalemate' ? 12 : 6)) / 1000)),
    // Operational tempo hurts by itself: vehicles, weather, fatigue — and it
    // does not care who is on the other side.
    //
    // RAISED (owner: "fix the accident deaths too"). Measured at 25 + a
    // third of intensity, four fifteen-year wars produced ZERO accident
    // deaths — the channel wounded people and never killed one, in a model
    // where non-hostile deaths are historically a fifth to a third of a
    // war's dead. A helicopter goes down, a truck rolls, ordnance goes off
    // on the wrong side of the wire.
    accident: 90 + intensity,
  }
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE ORDERS SHEET (owner's deployment-orders spec).
//
// Orders used to be a sentence. A tour is the largest thing that happens to
// a serving person, and it began with the world moving on — so this is the
// paper: who you are, where you are going, what it is called, when you have
// to be there, and who signed it.
//
// Everything on it is READ FROM THE RECORD except the paperwork's own
// details — the order number, the control number, the adjutant's name, the
// day of the month — which come off a seeded stream keyed to the tick, so a
// replay produces the identical sheet. The simulation's clock is monthly; a
// day of the month is the document's, not the world's, and it is drawn
// rather than invented per render.
// ---------------------------------------------------------------------------

export type OrdersVariant = 'involuntary' | 'voluntary' | 'rotation'

export interface OrdersSheet {
  readonly variant: OrdersVariant
  /** "INVOLUNTARY — GENERAL MOBILIZATION" and the like. */
  readonly variantLine: string
  readonly title: string
  readonly command: string
  readonly ordersNo: string
  readonly controlNo: string
  /** "14 MARCH 2066" — the document's own date. */
  readonly issued: string
  readonly name: string
  readonly rank: string
  readonly specialty: string
  readonly unit: string
  readonly assignedTo: string
  readonly enemy: string
  readonly frontName: string
  readonly tourMonths: number
  readonly tourText: string
  readonly reportBy: string
  readonly reportByShort: string
  readonly authority: string
  readonly signedBy: string
  readonly signedRole: string
  /** False on a volunteer's copy: nobody ordered them, so nobody threatens. */
  readonly carriesAwolWarning: boolean
}

const ORDER_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const SPELLED = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen',
]

/**
 * A date the sheet is allowed to claim.
 *
 * THE CLOCK IS MONTHLY, so the sheet says months. The first draft drew a
 * day of the month off the seeded stream — deterministic, but a date the
 * world does not have, and it read as simply wrong beside the game's own
 * "June 1981". Paperwork may be flavour; a date is a fact.
 */
/**
 * The pay grade behind a rank, read from the branch's own ladder.
 *
 * NOT `rank + 1`. The ladder doubles up — a specialist and a corporal are
 * both E-4 — so the index and the grade part company partway up, and the
 * sheet was printing an E-9 for a world whose ladder stops at eight.
 */
function payGradeOf(
  branch: ReturnType<typeof branchSpecFor>,
  rank: number,
  commissioned: boolean,
): string {
  // AND FROM THE RIGHT TABLE (military review, must-fix 3). Both the letter
  // and the number were enlisted-only, so the most-read document in the
  // game printed "2LT (E-1)" on a new officer's first set of orders.
  const grades = commissioned ? (branch.officerGrades ?? branch.grades) : branch.grades
  return `${commissioned ? 'O' : 'E'}-${String(grades[rank] ?? rank + 1)}`
}

function stampDate(world: World, tick: Tick, monthsAhead: number, short: boolean): string {
  const { year, month } = toDate(world, (tick + monthsAhead) as Tick)
  const name = ORDER_MONTHS[month - 1] ?? 'JANUARY'
  return `${short ? name.slice(0, 3) : name} ${String(year)}`
}

/**
 * The sheet for a person's orders, as of this tick. Returns undefined when
 * there is nothing to write orders about — no record, or no war to send
 * them to on a combat variant.
 */
export function ordersSheetFor(
  world: World,
  tick: Tick,
  personId: EntityId,
  variant: OrdersVariant,
  enemyId: EntityId | null,
): OrdersSheet | undefined {
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || !record || record.dischargedAtTick !== null) return undefined

  const branch = branchSpecFor(world, record.branch)
  const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 8900)
  const enemy = enemyId === null ? undefined : world.nations.get(enemyId)
  const base = world.places.get(record.baseId)
  const unit = record.unitId === null ? undefined : unitFor(world, record.unitId)
  const specialty = specialtyFor(world, record.specialtyId)
  const garrison = base?.name ?? 'the garrison'

  // Report this month, or the next one. The lead time is the only thing
  // here the calendar does not already decide — and it has to be a real
  // draw: nextInt(0, 1) can only return zero, so the first version of this
  // described a variety it never produced.
  const lead = rng.nextInt(0, 2)
  const sequence = 100 + rng.nextInt(0, 899)
  const generalOrder = 10 + rng.nextInt(0, 89)
  const officerFamily = rng.pickWeighted(
    [...world.spec.family.names],
    [...world.spec.family.weights],
  )
  const officerInitial = rng.pick([
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W',
  ])
  const { year } = toDate(world, tick)

  const tourMonths = variant === 'rotation' ? ROTATION_MONTHS : TOUR_MONTHS
  const spelledTour = SPELLED[tourMonths] ?? String(tourMonths)
  const frontName =
    variant === 'rotation'
      ? `${enemy?.name ?? 'an allied country'}`
      : `the ${bareName(enemy?.name ?? 'the enemy')} front`

  return {
    variant,
    variantLine:
      variant === 'voluntary'
        ? "VOLUNTARY — AT MEMBER'S REQUEST"
        : variant === 'rotation'
          ? 'PEACETIME ROTATION — ALLIED POSTING'
          : 'INVOLUNTARY — GENERAL MOBILIZATION',
    title: variant === 'rotation' ? 'ROTATION ORDERS' : 'DEPLOYMENT ORDERS',
    command: `${branchName(world, record.branch)} Command · ${garrison}`,
    ordersNo: `${variant === 'rotation' ? 'R' : 'D'}-${String(year)}-${String(sequence).padStart(4, '0')}`,
    controlNo: `${garrison.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}-${String(sequence).padStart(4, '0')}-${String(year).slice(-2)}`,
    issued: stampDate(world, tick, 0, false),
    name: `${person.familyName.toUpperCase()}, ${person.givenName}`,
    rank: `${rankTitle(world, record.branch, record.rank, record.commissioned === true)} (${payGradeOf(branch, record.rank, record.commissioned === true)})`,
    specialty: specialtyTitleCased(specialty, record.commissioned === true),
    unit: unit?.name ?? `${garrison} garrison`,
    assignedTo: variant === 'rotation' ? `${enemy?.name ?? 'an ally'} — allied posting` : frontName,
    enemy: enemy?.name ?? 'the enemy',
    frontName,
    tourMonths,
    tourText: `${spelledTour} (${String(tourMonths)}) months`,
    reportBy: stampDate(world, tick, lead, false),
    reportByShort: stampDate(world, tick, lead, true),
    authority: `General Order ${String(generalOrder)}, ${garrison} Command`,
    signedBy: `${officerInitial}. ${officerFamily.toUpperCase()}`,
    signedRole: `Adjutant · ${garrison} Command`,
    carriesAwolWarning: variant === 'involuntary',
  }
}

export function runDeployments(world: World, tick: Tick): void {
  const home = homeland(world)
  if (!home) return

  const homelandWars = activeWars(world).filter((war) => war.a === home.id || war.b === home.id)

  resolveTours(world, tick, homelandWars)
  // War calls first and calls louder. In peacetime the army still goes
  // places: the alliance is kept warm by people, not paper (M-ARMY2).
  if (homelandWars.length > 0) issueOrders(world, tick, home, homelandWars)
  else {
    // AND SOMEBODY GOES TO THE ALLY'S WAR (owner, playing: "NPCs don't
    // volunteer to go to allies' wars"). volunteerForSupport was reachable
    // only from the player's own verb, so in every world ever generated the
    // played character was the ONLY person who ever fought alongside an
    // ally. The town sent nobody, the paper reported nobody, and a war next
    // door was somebody else's entirely.
    issueSupportVolunteers(world, tick)
    issueRotations(world, tick, home)
  }
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
export function startRotation(
  world: World,
  tick: Tick,
  personId: EntityId,
  host: Nation,
  inputs: readonly ReturnType<typeof factor>[],
  chosen: string,
  rejected: readonly string[],
): void {
  const history = world.deployments.get(personId) ?? []
  const rotationRecord = world.service.get(personId)
  const rotationSpecialty = world.spec.specialties.find(
    (sp) => sp.id === rotationRecord?.specialtyId,
  )
  const rotationNumber = history.length + 1
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
    tourNumber: rotationNumber,
    capturedAtTick: null,
    operation: operationNameFor(personId * 17 + rotationNumber),
    // A PEACETIME ROTATION IS QUIET AND IS NOT SAFE. There is no enemy, so
    // the tempo floor is low — but it is a floor rather than a zero,
    // because accidents and the occasional incident do not need a war.
    tempo: 90,
    tier: tierFor(rotationSpecialty?.combatWeight ?? 300, rotationRecord?.unitId != null),
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
/**
 * Who puts their hand up for an ally's war.
 *
 * VOLUNTEERING, NOT ORDERS, and the rate says so: this is a fraction of
 * what a call-up takes, because nobody is being made to go. It runs only in
 * the months the Republic is not fighting for itself — the same prior claim
 * volunteerForSupport respects, since a soldier does not go to somebody
 * else's front while their own country is at war.
 */
/** How many are away on an ally's war right now. */
function supportToursOpen(world: World): number {
  let open = 0
  for (const [personId, tours] of world.deployments) {
    const current = tours.find((t) => t.returnedAtTick === null)
    if (current === undefined || current.kind !== 'combat') continue
    // An ally's war is a combat tour whose war is not one of ours.
    const home = homeland(world)
    if (!home) continue
    if (current.warA === home.id || current.warB === home.id) continue
    if (world.people.get(personId)?.deathTick !== null) continue
    open += 1
  }
  return open
}

function issueSupportVolunteers(world: World, tick: Tick): void {
  const wars = alliedWars(world)
  if (wars.length === 0) return
  const serving = countServing(world)
  if (serving === 0) return
  // ITS OWN SMALL ALLOWANCE, not the rotation cap. Sharing that cap was why
  // the first version of this still sent nobody: peacetime rotations keep
  // it saturated, so an ally's war never found a slot. This is a separate,
  // much smaller share — an army helping a neighbour does not empty the
  // barracks, but it does send somebody.
  const onSupport = supportToursOpen(world)
  if (onSupport * 1000 >= serving * SUPPORT_SHARE_CAP) return

  for (const person of deployablePeople(world)) {
    if (person.id === world.player.personId) continue // the player has a verb
    const rng = openStream(world.seed, Stream.CombatResolution, person.id, tick + 612)
    if (!rng.chanceInTenThousand(SUPPORT_VOLUNTEER_RATE)) continue
    volunteerForSupport(world, tick, person.id)
  }
}

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
    // THE PLAYER READS THEIR OWN ORDERS. A peacetime posting is half a year
    // of somebody's life; it should not begin with the world moving on.
    // The RATE is unchanged and is already what the owner asked for:
    // ROTATION_CALL_RATE puts a given person at roughly one posting every
    // five to seven years.
    if (person.id === world.player.personId) {
      if (world.player.pending !== null) continue
      recordEvent(world, tick, {
        type: 'received-orders',
        subjectId: person.id,
        otherId: host.id,
        detail: `a rotation to ${host.name}`,
      })
      raisePending(world, {
        tick,
        kind: 'deployment-order',
        personId: person.id,
        otherId: host.id,
        occupationId: 'rotation',
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['go'],
      })
      continue
    }
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
    // A CAPTIVE DOES NOT HOLD A SLOT (ADR-0025 §2). He is not on the roster
    // the war can spend, so counting him against the cap would let one
    // prisoner permanently reduce how many others could be sent.
    if (isDeployed(world, personId) && !isCaptive(world, personId)) deployed++
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
      // THE GUARD COMES FIRST. raisePending refuses while another question
      // is already up, and the two systems ahead of this one in the tick
      // raise player questions during exactly the wars that cut orders. The
      // event used to be written before the ask, so a refused ask left a
      // permanent "received orders" on the timeline with no sheet, no tour
      // and no refusal behind it. Orders that cannot be delivered are not
      // orders yet; the next month's roll cuts them again.
      if (world.player.pending !== null) continue
      // The moment goes on the record WITH the sheet — a set of orders is a
      // thing that happened to somebody even if they refuse it, and
      // especially if they do.
      recordEvent(world, tick, {
        type: 'received-orders',
        subjectId: person.id,
        otherId: enemyId,
        detail: enemy === undefined ? 'the front' : `the ${bareName(enemy.name)} front`,
      })
      raisePending(world, {
        tick,
        kind: 'deployment-order',
        personId: person.id,
        otherId: enemyId,
        occupationId: 'involuntary',
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
 * SPIN UP A SQUAD (combat revamp §2).
 *
 * REAL REGISTERED PEOPLE, not names on a card — that is the whole point,
 * and it is what makes "their death notifies their own kin" possible at
 * all. They get traits, a health record and an id like anybody else.
 *
 * THEY ARE NOT FROM THE TOWN. The spec is explicit: "it will not usually
 * be people from the player's town or existing social graph, because
 * that's not how deployments work." They are born into the unit, they have
 * no household here, and the town's marriage and jobs passes must never
 * pick them up — which is what `householdId: null` and no employment
 * record already mean everywhere else in this engine.
 *
 * ONLY FOR THE PLAYER. Spinning five people up for every NPC who deploys
 * would add hundreds to a world that already carries several hundred, for
 * a squad nobody will ever be shown. NPCs deploy exactly as they did.
 */
/**
 * THE SQUAD IS YOUR UNIT'S (MILITARY_DEPTH_PLAN §6, and the owner's report:
 * "you never actually deploy with someone from your unit even when it says
 * your unit is taking volunteers").
 *
 * He was right, and it was two parallel roads rather than a missing feature.
 * The home-station roster has always been real — `rosterFrom` builds it from
 * living, serving people and sorts them by who answers for the rest. The
 * deployment squad was a SEPARATE system that invented five strangers per
 * tour and threw them away at the end. A player could spend a decade in a
 * unit and never once deploy with anybody in it.
 *
 * Now the unit supplies the squad. Which means, for free:
 *   - the people beside you are people you have served with at home
 *   - they PERSIST between tours, because the unit does — the same man is
 *     the same man on your third tour, older and senior
 *   - when one is killed it is somebody with a name, a rank, a trade and a
 *     hometown the player has already seen on a roster
 *   - and a unit that advertises for volunteers can actually supply them
 *
 * INVENTING IS THE FALLBACK, NOT THE RULE. A thin station may not have five
 * people to spare, and a squad of two is not a squad — so the remainder is
 * spun up as before. That path is now the exception it always should have
 * been.
 *
 * THE ROLES COME OFF THE PEOPLE. A medic is somebody whose trade is
 * medicine, and the team leader is whoever the roster already names as its
 * leader — not a die. Competence is read from the service record rather than
 * drawn, so the man who is good at this is good at it for a reason the game
 * can point at.
 */
export function squadFromUnit(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  tourNumber: number,
): readonly SquadMember[] {
  const roster = unitRosterOf(world, ownerId)
  const specs = squadSpecsFor(world, tick, ownerId, tourNumber)
  if (roster === null) return spinUpSquad(world, tick, ownerId, tourNumber, specs)

  /**
   * A FIRETEAM IS NOT THE UNIT'S FIVE MOST SENIOR PEOPLE.
   *
   * `rosterFrom` sorts by who answers for the rest, so taking the first five
   * handed the player a team of ranks 7, 7, 7, 3 and 6 — every senior NCO in
   * the company out on one patrol, which is both unbelievable and the
   * opposite of how a fireteam is built.
   *
   * One person leads it and the rest are junior. So the leader billet is
   * filled from the senior end and everything else from the junior end,
   * which also gives the squad the shape the spec cares about: "the
   * difference between the man who is good at this and the one who is
   * nineteen and frightened is most of what a squad IS."
   */
  const mates = roster.members.filter((m) => m.personId !== ownerId)
  const juniorFirst = [...mates].reverse()
  const taken: SquadMember[] = []
  const used = new Set<EntityId>()

  for (const spec of specs) {
    // A medic billet wants a medic. Fall through to whoever is left when the
    // unit has none — a rifle squad without one is a real situation.
    const wanted =
      spec.role === 'medic'
        ? juniorFirst.find((m) => !used.has(m.personId) && /medic|corpsman/i.test(m.specialtyTitle))
        : spec.role === 'leader'
          ? mates.find((m) => !used.has(m.personId))
          : undefined
    const pick = wanted ?? juniorFirst.find((m) => !used.has(m.personId))
    if (pick === undefined) break
    used.add(pick.personId)
    const record = world.service.get(pick.personId)
    taken.push({
      personId: pick.personId,
      role: spec.role,
      nickname: spec.nickname,
      // EARNED, not drawn: what the service already thinks of them, lifted
      // by the grade they have reached.
      competence: Math.max(
        120,
        Math.min(1000, (record?.performance ?? 500) + (record?.rank ?? 0) * 25),
      ),
      sinceTick: record?.unitSinceTick ?? tick,
    })
  }

  if (taken.length >= specs.length) return taken
  // THE STATION COULD NOT FILL IT. Spin up only the shortfall, so a thin
  // garrison still puts a whole fireteam around the player.
  const short = specs.slice(taken.length)
  return [...taken, ...spinUpSquad(world, tick, ownerId, tourNumber, short)]
}

function spinUpSquad(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  tourNumber: number,
  only?: readonly ReturnType<typeof squadSpecsFor>[number][],
): readonly SquadMember[] {
  const specs = only ?? squadSpecsFor(world, tick, ownerId, tourNumber)
  const rng = openStream(world.seed, Stream.CombatResolution, ownerId * 59 + tourNumber, tick + 7_300)
  const members: SquadMember[] = []

  for (const spec of specs) {
    const id = world.nextEntityId as EntityId
    world.nextEntityId += 1
    const traitRng = openStream(world.seed, Stream.PersonTraits, id, 0)
    // Soldiers in a fireteam are young, and that is not decoration: it is
    // why losing one lands the way it does.
    const age = rng.nextIntInclusive(19, 31)
    const person: Person = {
      id,
      givenName: rng.pickWeighted(world.spec.maleGiven.names, world.spec.maleGiven.weights),
      familyName: rng.pickWeighted(world.spec.family.names, world.spec.family.weights),
      sex: 'male',
      birthTick: (tick - age * 12) as Tick,
      deathTick: null,
      causeOfDeath: null,
      // The engine has ONE tier today, and adding a second for these would
      // be a new concept every demographic pass has to learn. What keeps
      // them out of the town is what already keeps anybody out: no
      // household, no job, no place. They are soldiers in a unit.
      tier: 'deep',
      traits: rollTraits(traitRng),
      householdId: null,
      parentIds: [],
      spendStance: null,
    }
    world.people.set(id, person)
    world.health.set(id, freshHealth(id))
    members.push({
      personId: id,
      role: spec.role,
      nickname: spec.nickname,
      competence: spec.competence,
      sinceTick: tick,
    })
  }
  return members
}


/**
 * SOMEBODY IN THE TEAM IS HIT (combat revamp §2: they "can be wounded,
 * medevac'd, or KIA from seeded outcomes and YOUR decisions. Losing one is
 * a permanent story beat and reshapes the squad").
 *
 * WEIGHTED AGAINST COMPETENCE, which is not cruelty for its own sake: the
 * man who is good at this survives what kills the man who is not, so a
 * squad's losses are not random. You lose the nineteen-year-old first, and
 * everybody knows it while it is happening.
 *
 * The death is a REAL DEATH — the same `performDeath` every other death in
 * this world runs through — so it reaches the ledger, the story, and
 * whatever kin they have. That is the whole reason they are registered
 * people rather than names.
 */
function hitSquadmate(
  world: World,
  tick: Tick,
  person: Person,
  deployment: Deployment,
  rng: Rng,
  threatSeverity: number,
): void {
  const squad = deployment.squad ?? []
  if (squad.length === 0) return
  const casualty = pickCasualty(squad, world, rng.nextIntInclusive(0, 100_000))
  if (casualty === null) return
  const mate = world.people.get(casualty.personId)
  if (mate === undefined || mate.deathTick !== null) return

  // KILLED, OR HIT AND EVACUATED. The severity of the moment decides which,
  // and most of the time it is the second — men are wounded far more often
  // than they are killed, and a model where every casualty dies is a model
  // that has never looked at a casualty list.
  const fatal = rng.chance(Math.max(120, Math.min(620, threatSeverity)), 1_000)
  const bond = bondWith(casualty, tick)

  if (fatal) {
    performDeath(
      world, tick, mate, 'killed in action',
      [factor('battlefield-chaos', 800), factor('witnessed', Math.min(1000, bond))],
      Stream.CombatResolution,
    )
    recordEvent(world, tick, {
      type: 'squadmate-killed',
      subjectId: person.id,
      otherId: mate.id,
      detail: casualty.nickname,
    })
    // THE ONE WATCHING PAYS FOR IT TOO, and in proportion to how well they
    // knew him. This is the mechanism the trauma work will read.
    nudgeWellbeing(
      world, tick, person.id,
      -30 - Math.floor(bond / 25),
      `losing ${casualty.nickname}`,
    )
    return
  }

  /**
   * THE WOUND IS REAL (live player, on itch: combat "always says 1 person
   * wounded and 8/10 times its me").
   *
   * He was seeing the truth: a squadmate being "wounded" was a feed line
   * and a mood hit — no `inflictWound`, no health record, no recovery, no
   * mark. The player was the only person in the squad whose wounds
   * actually existed, so every evacuation and every decoration was
   * theirs. The roster's status dots read the health record and said "in
   * the fight" about a man the feed had just called wounded.
   *
   * A hit squadmate now takes the same wound anybody takes, through the
   * same single writer, scaled off the moment's severity — so he heals,
   * carries marks, and can be medically discharged by the same rules as
   * the player he serves beside (Law 2).
   */
  inflictWound(
    world, tick, mate.id,
    Math.max(200, Math.min(850, threatSeverity + rng.nextInt(-120, 121))),
    'direct-combat', rng,
  )
  recordEvent(world, tick, {
    type: 'squadmate-wounded',
    subjectId: person.id,
    otherId: mate.id,
    detail: casualty.nickname,
  })
  nudgeWellbeing(world, tick, person.id, -8 - Math.floor(bond / 90), `${casualty.nickname} being hit`)
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
  // THE TOUR'S OWN SHAPE (combat revamp §1). A tour is a place with a name
  // and a temperature rather than a duration — the tempo comes from the
  // WAR's own intensity, so a tour into a war going badly is a different
  // tour, which is Law 1 rather than flavour.
  const record = world.service.get(personId)
  const specialty = world.spec.specialties.find((sp) => sp.id === record?.specialtyId)
  const tourNumber = history.length + 1
  // HOW BAD THE WAR ITSELF IS, read off its phase — the same three-step
  // the casualty model already uses, so the tempo and the losses agree
  // about what kind of war this is rather than each having an opinion.
  const warIntensity =
    war.warPhase === 'opening' || war.warPhase === 'offensive'
      ? 900
      : war.warPhase === 'attrition'
        ? 620
        : 320
  const tempo = tempoFor(world, tick, personId, tourNumber, warIntensity)
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
    tourNumber,
    capturedAtTick: null,
    operation: operationNameFor(personId * 31 + tourNumber + Number(war.a) * 7),
    tempo,
    tier: tierFor(specialty?.combatWeight ?? 300, record?.unitId != null),
    // THE PLAYER'S ONLY. Five real people per NPC tour would add hundreds
    // to the world for a squad nobody is ever shown.
    ...(personId === world.player.personId
      ? { squad: squadFromUnit(world, tick, personId, tourNumber) }
      : {}),
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
/**
 * Whether volunteering would actually be accepted right now.
 *
 * The same gates volunteerForDeployment enforces, asked BEFORE the orders
 * sheet is cut — showing somebody paper the army will not honour is worse
 * than not offering it.
 */
export function canVolunteerForDeployment(world: World, tick: Tick, personId: EntityId): boolean {
  const home = homeland(world)
  if (!home) return false
  if (!activeWars(world).some((w) => w.a === home.id || w.b === home.id)) return false
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || person.deathTick !== null) return false
  if (!record || record.dischargedAtTick !== null) return false
  if (isDeployed(world, personId)) return false
  return isPipelineTrained(world, tick, record)
}

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
/**
 * Out there AND able to act. A prisoner still has an open tour, so
 * `isDeployed` says yes for him — and this predicate is used to promise the
 * player a decision. Promising one that cannot be raised suppressed a
 * casualty's fatal roll on a decision nobody was ever asked (review S3's
 * invariant, broken by the captivity guard).
 */
function isDeployedAndFree(world: World, personId: EntityId): boolean {
  return isDeployed(world, personId) && !isCaptive(world, personId)
}

/**
 * M-ENLIST §5b. The scene pool this record can meet — the officer's role
 * first, then the trade, then the branch's own flavour.
 *
 * Wrapped here rather than called inline so the deployment month has one
 * answer to "whose day is this", and `sceneTagsFor` keeps its three
 * arguments for the places that already have the pieces in hand.
 */
function sceneTagsForRecord(world: World, record: ServiceRecord): readonly string[] {
  return sceneTagsFor(
    world.spec.specialties.find((sp) => sp.id === record.specialtyId),
    record.officerRoleId === undefined ? undefined : officerRoleById(record.officerRoleId),
    world.spec.branches.find((b) => b.id === record.branch),
  )
}

/**
 * M-ENLIST §5. The odds a month's contact arrives as the player's decision,
 * per mille. See the note at the call site for why this is not the same
 * question as how dangerous the job is.
 */
function momentChanceFor(world: World, specialtyId: string): number {
  const weight = world.spec.specialties.find((sp) => sp.id === specialtyId)?.combatWeight
  if (weight === undefined) return 600
  return 400 + Math.floor((Math.max(0, Math.min(1000, weight)) * 400) / 1000)
}

export function fieldAidWillBeOffered(
  world: World,
  casualtyId: EntityId,
  severity: number,
  pendingSlotFree = true,
): boolean {
  const playerId = world.player.personId
  if (playerId === null) return false
  /**
   * THE PLAYER SEES EVERY WOUND THAT MATTERS (owner, THIRD report: "still
   * didn't get the popups of the wounds of when I got hurt"). The 600
   * floor meant a kind-capped wound — a gash at 560, a concussion at 520 —
   * never opened a moment at all: the player learned they had been hit
   * from a feed line. Their own wound now shows from 300 up; what changes
   * with severity is the QUESTION, not the visibility — under 600 there is
   * no life to fight for, only a wound to see and get dressed. A
   * squadmate's wound keeps the 600 bar: the medic scene is for the
   * minutes that decide it, not for every scrape in the platoon.
   */
  if (severity < (casualtyId === playerId ? 300 : 600)) return false
  if (pendingSlotFree && world.player.pending !== null) return false
  if (casualtyId === playerId) {
    const person = world.people.get(playerId)
    return person !== undefined && person.deathTick === null
  }
  const record = world.service.get(playerId)
  if (!record || record.dischargedAtTick !== null || record.specialtyId !== 'medic') return false
  if (!isDeployedAndFree(world, playerId)) return false
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
  if (playerId === null) return false
  /**
   * BEING SHOT PREEMPTS THE SLOT (live player, on itch: "I just got
   * wounded in combat 2 times and I never got the popup showing where I
   * was hit and the options").
   *
   * A busy decision slot used to LOSE this moment forever — and worse:
   * `aidComing` came back false, which fed the FATAL roll, so a player
   * answering a work chat the month they were hit faced NPC-grade
   * mortality instead of the minutes that decide it. The state of a UI
   * queue was changing whether a man lived.
   *
   * A serious wound now clears whatever was waiting and takes the slot.
   * The displaced kinds that matter re-raise themselves (orders,
   * separations, boards); a displaced work chat is a work chat, and being
   * shot outranks it in any life.
   */
  if (world.player.pending !== null && (casualtyId === playerId || world.player.pending.kind !== 'first-aid')) {
    if (!fieldAidWillBeOffered(world, casualtyId, severity, false)) return false
    world.player.pending = null
  } else if (!fieldAidWillBeOffered(world, casualtyId, severity)) {
    return false
  }

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
      options:
        severity >= 600
          ? ['press-the-wound', 'call-for-help', 'lie-still']
          : ['get-it-dressed'],
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
  return capturedSince(world, personId) !== null
}

/** When they were taken, or null. */
export function capturedSince(world: World, personId: EntityId): Tick | null {
  return currentDeployment(world, personId)?.capturedAtTick ?? null
}

/**
 * Take somebody prisoner. Returns false when there is nothing to take them
 * from — no open tour, no enemy, or already held.
 */
export function capture(world: World, tick: Tick, personId: EntityId, _rng: ReturnType<typeof openStream>): boolean {
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
  // MEASURED, THEN TUNED. The first numbers made captivity more lethal than
  // the historical range by a wide margin: 40 wartime captivities ran out at
  // 33% home, 67% dead, median 31 months held. Most prisoners come home.
  const mortality = Math.min(25, 3 + Math.floor(held / 6)) + (warOngoing ? 0 : -1)
  if (rng.chance(Math.max(1, mortality), 1_000)) {
    performDeath(
      world, tick, person, 'hardship in captivity',
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
    // The campaign is judged for him too. closeTour returns early on a dead
    // man, so the grant is made here by hand — exactly as the in-theatre and
    // combat death paths do it. A prisoner served the campaign; dying held
    // waives the duration rule the same way dying in the field does, and
    // leaving it out quietly gave his estate less than the man beside him.
    if (deployment.enemyId !== null) {
      const captor = world.nations.get(deployment.enemyId)
      for (let i = world.events.length - 1; i >= 0; i--) {
        const died = world.events[i]
        if (!died || died.type !== 'died' || died.subjectId !== person.id) continue
        if (captor !== undefined) {
          grantCampaignMedal(
            world, tick, person.id, died, captor.name, tick - deployment.startedAtTick, true,
          )
        }
        break
      }
    }
    return
  }

  // Home. The war's end opens the gate; before that it is escape, exchange
  // or a raid, and none of those is common.
  const release = warOngoing ? 35 : 400
  if (held >= 1 && rng.chance(release, 1_000)) {
    recordEvent(world, tick, {
      type: 'repatriated',
      subjectId: person.id,
      ...(deployment.enemyId !== null ? { otherId: deployment.enemyId } : {}),
      detail: String(held),
    })
    // The stamp STAYS. A closed tour that was a captivity is a different
    // tour from one that was not, and the record is the only place that
    // difference survives — clearing it on the way home made a repatriated
    // man look like anybody who came back on schedule.
    closeTour(world, tick, person.id, deployment, true)
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
      // He died held, of something the captivity resolver did not do to him
      // — the town's own mortality, or an illness. The captivity still has
      // to END somewhere: without this the record reads "was captured" and
      // then nothing, forever.
      if (deployment.capturedAtTick !== null) {
        recordEvent(world, tick, {
          type: 'died-in-captivity',
          subjectId: personId,
          ...(deployment.enemyId !== null ? { otherId: deployment.enemyId } : {}),
          detail: String(tick - deployment.capturedAtTick),
        })
      }
      closeTour(world, tick, personId, deployment, true)
      for (let i = world.events.length - 1; i >= 0; i--) {
        const died = world.events[i]
        if (!died || died.type !== 'died' || died.subjectId !== personId) continue
        const enemyName =
          deployment.enemyId === null ? undefined : world.nations.get(deployment.enemyId)?.name
        if (enemyName !== undefined) {
          grantCampaignMedal(
            world, tick, personId, died, enemyName, tick - deployment.startedAtTick, true,
          )
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
    // THE MONTH'S ODDS ARE THE TOUR'S NOW (combat revamp §1, §4b): the
    // job's tier, the theatre's tempo, and WHERE IN THE ARC this month
    // falls, all together. The old flat halving of the exposure weight
    // made month four identical to month one and a supply clerk's war the
    // same shape as an operator's at lower volume.
    //
    // The channel weights still decide WHAT finds them; this decides
    // whether anything does.
    const beat = beatFor(
      tick - deployment.startedAtTick,
      deployment.endsAtTick - deployment.startedAtTick,
    )
    //
    // THE TUNED RATE IS KEPT AND SHAPED, not replaced. The first version
    // replaced it and broke the foundation §6 bound above: month one went
    // from about a third to about two thirds, and support volunteers
    // started dying before their second month.
    const tuned = Math.min(600, Math.floor(totalWeight / 2))
    const shaped =
      deployment.tempo === undefined || deployment.tier === undefined
        ? tuned
        : Math.min(
            900,
            Math.floor(
              (tuned * contactShapePerMille(deployment.tier as IntensityTier, deployment.tempo, beat)) /
                1_000,
            ),
          )
    if (!rng.chance(Math.max(1, shaped), 1_000)) continue

    const channel = rng.pickWeighted(
      channels.map((c) => c.id),
      channels.map((c) => Math.max(1, c.weight)),
    )
    const isAccident = channel === 'battlefield-accident'

    // THE SQUAD IS IN THIS TOO (combat revamp §2). A contact that reaches
    // the player reaches the people standing next to them, and losing one
    // is the thing the whole squad model exists to make possible. Rarer
    // than the player's own exposure — five men are not five times as
    // likely to be hit as one, they are in cover together — and weighted
    // against competence, so a squad loses the nineteen-year-old first.
    if ((deployment.squad ?? []).length > 0 && rng.chance(230, 1_000)) {
      hitSquadmate(
        world,
        tick,
        person,
        deployment,
        rng,
        200 + severityBiasFor((deployment.tier ?? 1) as IntensityTier),
      )
    }

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
      // ONLY THE CHANNEL THAT MEANS THEY WENT UP. A base attack is a night
      // in a shelter and a convoy is a road; neither is a sortie, and both
      // were minting the Air Medal with a citation that named a flight.
      if (
        channel === 'direct-combat-exposure' &&
        (record.specialtyId === 'aviator' || record.specialtyId === 'aircrew')
      ) {
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
      // M-ENLIST §5. HOW MUCH OF THIS JOB IS FIGHTING (`combatWeight`).
      //
      // The exposure vector already decides how OFTEN a trade meets the
      // enemy; this decides how often meeting them is a decision the person
      // makes rather than a month that happens around them. A rifleman's
      // contact is nearly always his to answer. A supply clerk in the same
      // convoy is mostly a passenger, and pretending otherwise made every
      // trade feel like the infantry.
      //
      // 400-800 per mille, landing on the old flat 600 at combatWeight 500,
      // so the average trade is unchanged and the ends are honest. NOBODY
      // reaches zero: a clerk who is shot at still gets asked sometimes.
      /**
       * EVERY TOUR GETS ITS SCENE (playtest §5: the marquee combat "shows
       * up, but not on every deployment... consistently '1 hit and
       * evacuated'" — and idea #9's exact ask: "guarantee at least one
       * multi-beat interactive scene per deployment tour").
       *
       * A contact only became a played scene on a trade-weighted roll, and
       * the roll could miss every contact of a tour — so the game's best
       * system sat out entire deployments and the abstract resolution
       * carried them. Past the tour's midpoint with no scene yet fired,
       * the next contact that reaches the player IS the scene.
       *
       * The roll is still drawn first, unconditionally — short-circuiting
       * it when the guarantee applies would shift every later draw on the
       * stream and change outcomes that have nothing to do with this.
       */
      const rolledScene = rng.chance(momentChanceFor(world, record.specialtyId), 1_000)
      const pastMidTour =
        tick - deployment.startedAtTick >=
        Math.floor((deployment.endsAtTick - deployment.startedAtTick) / 2)
      let hadSceneThisTour = false
      for (let i = world.player.log.length - 1; i >= 0; i -= 1) {
        const entry = world.player.log[i]
        if (entry === undefined || entry.tick < deployment.startedAtTick) break
        if (entry.kind === 'combat-moment') {
          hadSceneThisTour = true
          break
        }
      }
      if (
        personId === world.player.personId &&
        world.player.pending === null &&
        (rolledScene || (pastMidTour && !hadSceneThisTour))
      ) {
        // THE SCENE, AND HOW BAD IT IS (owner's combat plan §2). The
        // channel that found them picks the scene — the threat vector
        // already decided whether this was a road, a wire or a doorway —
        // and the threat level is rolled from that channel's own weight,
        // so "overrun" means the war is going badly rather than that a die
        // came up. The player is TOLD which before answering: it is a
        // read, not a coin flip.
        const unitId = record.unitId
        // M-ENLIST §5b. The trade the person actually holds decides which of
        // the channel's scenes is theirs. A signaller's worst day and a
        // rifleman's are not the same day.
        const scene = pickScene(
          channel,
          unitId,
          rng,
          sceneTagsForRecord(world, record),
          record.commissioned,
        )
        if (scene !== undefined) {
          const weight = channels.find((c) => c.id === channel)?.weight ?? 0
          const threat = rollThreat(Math.floor(weight / 1000), scene.biasToward, rng)
          // THE WHOLE SEQUENCE, not one popup (combat revamp §3). The beats
          // are decided here, at contact, and carried on the pending — a
          // contact that re-planned itself between beats would let a reload
          // shop for a shorter firefight.
          const arc = beatFor(
            tick - deployment.startedAtTick,
            deployment.endsAtTick - deployment.startedAtTick,
          )
          const beats = beatsFor(threat, arc === 'defining')
          raisePending(world, {
            tick,
            kind: 'combat-moment',
            personId,
            otherId: enemyId,
            occupationId: encodeSequence(scene.id, threat, 0, beats),
            workplaceId: null,
            monthlyPay: null,
            placeId: null,
            options: [...SCENE_OPTIONS],
          })
          continue
        }
      }
    }

    // M-ENLIST §5b. THE ACCIDENT CAN BE A MOMENT TOO, but only where the
    // person's own trade has one written for it.
    //
    // Accidents used to resolve entirely over the player's head, which for
    // most trades is right — a rollover is not a decision anybody gets to
    // make. For an aviator it is exactly backwards: accidents are what
    // actually kills them, and the one month their job puts a real choice
    // in front of them was the one month they were never asked. So the gate
    // is the tag, not the channel: no tagged scene, no moment, same as
    // before.
    if (
      isAccident &&
      personId === world.player.personId &&
      world.player.pending === null &&
      rng.chance(3, 5)
    ) {
      const tags = sceneTagsForRecord(world, record)
      const scene = pickScene(channel, record.unitId, rng, tags, record.commissioned)
      if (scene !== undefined && scene.tags.some((tag) => tags.includes(tag))) {
        const weight = channels.find((c) => c.id === channel)?.weight ?? 0
        const threat = rollThreat(Math.floor(weight / 1000), scene.biasToward, rng)
        raisePending(world, {
          tick,
          kind: 'combat-moment',
          personId,
          // Nobody is shooting: the moment has no enemy on the other side of
          // it, and the record must not invent one.
          otherId: null,
          occupationId: encodeScene(scene.id, threat),
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: [...SCENE_OPTIONS],
        })
        continue
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
    // The slot no longer decides mortality: the moment preempts it, so
    // aid is coming whenever the wound qualifies at all.
    const aidComing = fieldAidWillBeOffered(world, personId, severity, false)
    // MEASURED, THEN WIDENED (owner: "people die in war man... we should
    // still be dying if we get shot in the head"). At severity 720 the four
    // fifteen-year wars ran 177 contacts, 35 wounded and 7 killed — a
    // wounded-to-killed ratio near 5:1, where the real ones sit closer to
    // 2.5:1. The fatal band starts lower now. Contact is still not casualty
    // and most months hold neither.
    // AN ACCIDENT IS NOT GENTLER THAN A FIREFIGHT. It used to be a fifth as
    // likely to kill where enemy contact was two fifths, which is backwards
    // for the things that actually cause it — a rollover, an aircraft going
    // in, a round cooking off. The same odds now, because the vehicle does
    // not care whose war it is.
    const fatal = !aidComing && severity >= 640 && rng.chance(2, 5)

    const phaseFactor = factor('war-phase', war.warPhase === 'offensive' || war.warPhase === 'opening' ? 800 : 450)
    const chain = [
      factor(channel, Math.max(1, Math.floor(channels.find((c) => c.id === channel)!.weight / 200))),
      factor('enemy-capability', enemy.strength),
      phaseFactor,
      factor('battlefield-chaos', severity),
    ]

    // The channel that found them shapes the harm, dead or alive — so the
    // map is read before the fatal branch, which needs it too.
    const context =
      channel === 'direct-combat-exposure'
        ? ('direct-combat' as const)
        : channel === 'convoy-exposure'
          ? ('convoy' as const)
          : channel === 'base-attack-exposure'
            ? ('base-attack' as const)
            : ('field-accident' as const)

    if (fatal) {
      // WHAT KILLED THEM, ON THE RECORD (newsroom spec §1). A fatal hit
      // used to record no wound at all — only survivable ones did — so the
      // paper could say "wounds taken in action" and never what the wound
      // was. The same draw the wound system uses, written as an event, so
      // the story can read the shoulder and the artery rather than a
      // summary. It inflicts nothing: they are already dead.
      const mortal = pickFatalInjury(rng, context)
      recordEvent(world, tick, {
        type: isAccident ? 'was-injured' : 'wounded-in-action',
        subjectId: personId,
        otherId: enemyId,
        detail: `fatal:${describeAilment('injury', mortal.kind, mortal.site)}`,
      })

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
    // MEASURED, because the owner could not find it: "I know it's rare but
    // I haven't seen it at all." He was right. Across six worlds and a
    // hundred years each — 670 tours, 115 of them against an enemy, 62
    // contacts and 16 wounds — this fired EXACTLY ONCE. A capture once in
    // six centuries is not rare, it is unreachable, and the owner's own
    // rule is that no award exists that cannot be earned (ADR-0026).
    //
    // Widened at both ends: a bad contact rather than only the worst kind,
    // and one in eight of those rather than one in fourteen. Being taken is
    // still the rarest thing that happens on a tour and still rarer than a
    // wound by a wide margin — see the measurement in captivity_reach.
    if (!isAccident && severity >= 480 && rng.chance(1, 8)) {
      if (capture(world, tick, personId, rng)) continue
    }

    // Wounded — and wounded SPECIFICALLY (M-WOUNDS): the channel that found
    // them shapes the harm. A convoy strike is blast and shrapnel; a base
    // attack burns. The health system carries it from here — evacuation home
    // when it is bad enough that the war is over for them this tour.
    const wound = inflictWound(world, tick, personId, severity, context, rng)
    // THE LABEL READS THE WOUND, not the dice. Severity is capped by KIND
    // inside inflictWound now — hearing damage cannot be graver than
    // hearing damage — and a record that still said "serious" off the
    // pre-cap draw would put a lie in the story and the paper.
    const woundEvent = recordEvent(world, tick, {
      type: isAccident ? 'was-injured' : 'wounded-in-action',
      subjectId: personId,
      otherId: enemyId,
      detail: `${wound.severity >= 600 ? 'serious' : 'minor'}:${wound.description}`,
    })
    // The decoration follows the wound at the same tick, referencing it.
    // For an accident the event is 'was-injured' and the grant refuses —
    // which is the eligibility rule doing its job, not a missing case.
    //
    // AND NOT FOR HEARING DAMAGE (live player: decorated "for something
    // like blown out hearing"). The real criteria draw the same line — a
    // wound of the eardrums from blast, with nothing else, does not
    // qualify. Every other enemy-action wound still does; the gate is the
    // KIND, known right here where the wound was rolled, not a parse of
    // the description downstream.
    if (wound.kind !== 'hearing-damage') {
      grantWoundRecognition(world, tick, personId, woundEvent, enemy.name)
    }
    // Hit and still conscious — the minutes that decide it, if this is the
    // player's own wound or one their medic's hands can reach (M-ARMY2).
    // The moment describes the wound the record KEEPS — kind-capped — not
    // the raw draw. A hearing wound capped to minor must not open a
    // life-or-death scene the health record contradicts.
    offerFieldAid(world, tick, personId, wound.severity)
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
  // WIDENED with the deployment accidents (owner). At 900 on a curve that
  // rarely reaches it, times a quarter, a peacetime posting was very nearly
  // survivable by construction — and peacetime training kills people every
  // year in every real army.
  if (severity >= 820 && rng.chance(1, 3)) {
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

/**
 * Where somebody has been, tallied: "Chile ×2, Korea ×1".
 *
 * Read from the CLOSED TOURS themselves rather than parsed back out of a
 * citation string, so the words on the ribbon and the record underneath
 * cannot drift apart. `of` picks which side of the tour counts — the host
 * of a rotation, or the enemy of a campaign.
 */
export function tourTally(world: World, personId: EntityId, of: 'host' | 'enemy'): string {
  const counts = new Map<string, number>()
  for (const tour of world.deployments.get(personId) ?? []) {
    if (tour.returnedAtTick === null) continue
    if (of === 'host' && tour.kind !== 'rotation') continue
    if (of === 'enemy' && tour.kind !== 'combat') continue
    const nationId = of === 'host' ? tour.hostId : tour.enemyId
    if (nationId === null) continue
    const name = world.nations.get(nationId)?.name
    if (name === undefined) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, n]) => (n === 1 ? name : `${name} ×${String(n)}`))
    .join(', ')
}

export function closeTour(
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

  // ONE AWARD PER DEPLOYMENT (owner, 2026-08-02). A tour used to close with
  // the Overseas Service Ribbon AND the Expeditionary Medal, both handed
  // over the same month for the same trip and described almost the same way
  // — which read as the game giving out two of one thing. The peacetime
  // posting earns the ribbon that says you went; the war earns the medal
  // that says which campaign. Each is worn again, with a device and its
  // place named in the citation, for every tour after the first.
  if (deployment.kind === 'rotation') {
    grantOverseas(world, tick, personId, homecoming, tourTally(world, personId, 'host'))
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
  const campaign =
    enemyName === undefined
      ? null
      : grantCampaignMedal(
          world, tick, personId, homecoming, enemyName,
          tick - deployment.startedAtTick, medical,
        )

  // ONE AWARD PER DEPLOYMENT MEANS ONE, NOT ZERO. A combat tour too short
  // for campaign credit — the war ended, the record closed — used to earn
  // the Overseas Service Ribbon and, once the ribbon moved to the rotation
  // branch, earned nothing at all. Going is still going: the ribbon is the
  // floor when the campaign does not qualify.
  if (campaign === null) {
    grantOverseas(world, tick, personId, homecoming, tourTally(world, personId, 'enemy'))
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
