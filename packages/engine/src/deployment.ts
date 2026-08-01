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
import { grantCampaignMedal, grantWoundRecognition } from './awards.js'
import { specialtyById, specialUnitById } from './content.js'
import { activeWars, homeland } from './geopolitics.js'
import { inflictWound } from './health.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import { isServing } from './service.js'
import { performDeath } from './systems.js'
import type { Deployment, GeoRelation, Nation, Person, World } from './types.js'

/** Planned tour length, months. */
const TOUR_MONTHS = 10
/** Share of the serving force deployed at the height of a war, per mille. */
const DEPLOYED_SHARE_CAP = 600

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

export function threatVectorFor(war: GeoRelation, enemy: Nation): ThreatVector {
  const phase = war.warPhase ?? 'attrition'
  // Phase shapes WHERE the danger lives, not only how much of it there is:
  // offensives sharpen the front, attrition grinds the roads, stalemates
  // shell the bases. Enemy strength scales everything — a capable enemy
  // reaches rear areas a weak one cannot (foundation §5).
  const intensity =
    phase === 'opening' ? 130 : phase === 'offensive' ? 150 : phase === 'attrition' ? 100 : 70
  const reach = 40 + Math.floor(enemy.strength / 2) // 40..540

  return {
    directCombat: Math.floor((reach * intensity * (phase === 'offensive' ? 14 : 9)) / 1000),
    convoy: Math.floor((reach * intensity * (phase === 'attrition' ? 13 : 8)) / 1000),
    baseAttack: Math.floor((reach * intensity * (phase === 'stalemate' ? 12 : 6)) / 1000),
    // Operational tempo hurts by itself: vehicles, weather, fatigue.
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
  if (homelandWars.length > 0) issueOrders(world, tick, home, homelandWars)
}

/** Who is serving and not deployed, in id order. */
function deployablePeople(world: World): Person[] {
  const eligible: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (!isServing(world, person.id)) continue
    if (isDeployed(world, person.id)) continue
    // Nobody deploys out of the schoolhouse: the training pipeline (basic,
    // then the trade school) finishes before orders can find you. Without
    // this gate a recruit could "finish basic training" in a theatre.
    const record = world.service.get(person.id)
    if (record) {
      const trained = 2 + specialtyById(record.specialtyId).schoolMonths
      if (world.tick - record.enlistedAtTick < trained) continue
    }
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
    const history = world.deployments.get(person.id) ?? []
    const deployment: Deployment = {
      personId: person.id,
      warA: war.a,
      warB: war.b,
      enemyId,
      startedAtTick: tick,
      endsAtTick: (tick + TOUR_MONTHS) as Tick,
      returnedAtTick: null,
      tourNumber: history.length + 1,
    }
    world.deployments.set(person.id, [...history, deployment])

    const enemy = world.nations.get(enemyId)
    recordEvent(world, tick, {
      type: 'deployed',
      subjectId: person.id,
      otherId: enemyId,
      detail: enemy ? `the ${enemy.name} front` : 'the front',
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'deployment',
      significance: 'defining',
      inputs: [
        factor('under-orders', 1000),
        factor('war-demanded-troops', Math.min(1000, (world.nations.get(enemyId)?.strength ?? 300))),
      ],
      chosen: `deployed to ${enemy ? `the ${enemy.name} front` : 'the front'}`,
      rejected: [],
      streamId: Stream.CombatResolution,
    })
  }
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
  const trained = 2 + specialtyById(record.specialtyId).schoolMonths
  if (tick - record.enlistedAtTick < trained) return false

  const enemyId = war.a === home.id ? war.b : war.a
  const history = world.deployments.get(personId) ?? []
  const deployment: Deployment = {
    personId,
    warA: war.a,
    warB: war.b,
    enemyId,
    startedAtTick: tick,
    endsAtTick: (tick + TOUR_MONTHS) as Tick,
    returnedAtTick: null,
    tourNumber: history.length + 1,
  }
  world.deployments.set(personId, [...history, deployment])

  const enemy = world.nations.get(enemyId)
  recordEvent(world, tick, {
    type: 'deployed',
    subjectId: personId,
    otherId: enemyId,
    detail: enemy ? `the ${enemy.name} front` : 'the front',
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'deployment',
    significance: 'defining',
    inputs: [
      factor('own-choice', 1000),
      factor('war-demanded-troops', Math.min(1000, world.nations.get(enemyId)?.strength ?? 300)),
    ],
    chosen: `volunteered for ${enemy ? `the ${enemy.name} front` : 'the front'}`,
    rejected: ['to wait for orders'],
    streamId: Stream.CombatResolution,
  })
  return true
}

/** A month in theatre for everyone out there — and the way home at tour's end. */
function resolveTours(world: World, tick: Tick, wars: GeoRelation[]): void {
  const deployedIds: EntityId[] = []
  for (const [personId] of world.deployments) {
    if (isDeployed(world, personId)) deployedIds.push(personId)
  }
  deployedIds.sort((a, b) => a - b)

  for (const personId of deployedIds) {
    const person = world.people.get(personId)
    const deployment = currentDeployment(world, personId)
    if (!person || person.deathTick !== null || !deployment) continue

    const war = wars.find((w) => w.a === deployment.warA && w.b === deployment.warB)
    const record = world.service.get(personId)

    // The war ended, or the tour did: home. A discharged record mid-tour
    // cannot happen (stop-loss holds the term open), but guard anyway.
    if (!war || tick >= deployment.endsAtTick || !record || record.dischargedAtTick !== null) {
      closeTour(world, tick, personId, deployment)
      continue
    }

    const enemy = world.nations.get(deployment.enemyId)
    if (!enemy) continue

    const threat = threatVectorFor(war, enemy)
    const exposure = specialtyById(record.specialtyId).exposure
    const rng = openStream(world.seed, Stream.CombatResolution, personId, tick + 7000)

    // A special unit's tour points at the fight (M-SPECOPS): the unit
    // multiplies the DIRECT-COMBAT exposure — a fact about what the job is,
    // never about where it is. The permanent rule stands.
    const unit = record.unitId === null ? undefined : specialUnitById(record.unitId)
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
    // before summing. The old raw-product sum saturated its cap for anyone
    // at the sharp end, which flattened the vector: a rifleman facing a weak
    // enemy in a stalemate contacted like one facing a strong enemy in an
    // offensive. Normalized, the differences the vector models survive to
    // the outcome — ~15% a month for the worst case, low single digits for
    // rear-echelon work, and the cap is a backstop rather than the answer.
    const totalWeight = channels.reduce((sum, c) => sum + Math.floor(c.weight / 1000), 0)
    const contactPerMille = Math.min(200, Math.floor(totalWeight / 8))
    if (!rng.chance(Math.max(1, contactPerMille), 1_000)) continue

    const channel = rng.pickWeighted(
      channels.map((c) => c.id),
      channels.map((c) => Math.max(1, c.weight)),
    )
    const isAccident = channel === 'battlefield-accident'

    // Severity of the month that went wrong. Fatal only at the far tail.
    const severity = rng.nextBellInt(300, 1000)
    const fatal = severity >= 940 && rng.chance(isAccident ? 1 : 2, 5)

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
      otherId: deployment.enemyId,
      detail: `${severity >= 600 ? 'serious' : 'minor'}:${wound.description}`,
    })
    // The decoration follows the wound at the same tick, referencing it.
    // For an accident the event is 'was-injured' and the grant refuses —
    // which is the eligibility rule doing its job, not a missing case.
    grantWoundRecognition(world, tick, personId, woundEvent, enemy.name)
    if (!isAccident) {
      recordDecision(world, tick, {
        subjectId: personId,
        decision: 'deployment',
        significance: 'defining',
        inputs: chain,
        chosen: `was wounded in action on the ${enemy.name} front`,
        rejected: [],
        streamId: Stream.CombatResolution,
      })
    }
    if (severity >= 600) {
      closeTour(world, tick, personId, deployment, true)
    }
  }
}

function closeTour(
  world: World,
  tick: Tick,
  personId: EntityId,
  deployment: Deployment,
  medical = false,
): void {
  const history = world.deployments.get(personId) ?? []
  world.deployments.set(
    personId,
    history.map((tour) =>
      tour.startedAtTick === deployment.startedAtTick ? { ...tour, returnedAtTick: tick } : tour,
    ),
  )
  const person = world.people.get(personId)
  if (person && person.deathTick === null) {
    const homecoming = recordEvent(world, tick, {
      type: 'returned-home',
      subjectId: personId,
      detail: medical ? 'evacuated' : 'tour complete',
    })
    // Campaign credit is judged when the tour closes: three months in
    // theatre qualifies, and a tour ended by evacuation qualifies at any
    // length (the casualty waiver). A second tour in the same war adds a
    // device to the same medal.
    const enemyName = world.nations.get(deployment.enemyId)?.name
    if (enemyName !== undefined) {
      grantCampaignMedal(
        world, tick, personId, homecoming, enemyName,
        tick - deployment.startedAtTick, medical,
      )
    }
  }
}
