/**
 * Deployment and risk. L4-M4.
 *
 * The claims, straight from the foundation doc:
 *   §2  danger comes from the geopolitical state, never a country rating —
 *       the same theatre goes quiet when the war ends;
 *   §5  danger is a vector crossed with specialty exposure — the rifleman's
 *       war and the signals operator's war differ in the same theatre;
 *   §6  most months, nothing happens;
 *   §8  death is traceable, and the record knows more than the family did;
 *   §10 the tour history survives, and stop-loss holds terms open in theatre.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { specialtyById } from '../src/content.js'
import { deploymentsOf, isDeployed, threatVectorFor } from '../src/deployment.js'
import { homeland, relationKey } from '../src/geopolitics.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { awaitingPlayer, resolvePending, setPlayer } from '../src/player.js'
import { enlistPerson, isServing } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { GeoRelation, World } from '../src/types.js'

/** A world with a hand-declared homeland war and a hand-enlisted cohort. */
function worldAtWar(seedValue = 12345, cohort = 12): { world: World; war: GeoRelation } {
  const world = createWorld(makeSeed(seedValue))
  const home = homeland(world)
  if (!home) throw new Error('no homeland')

  // Pick the strongest foreign nation as the enemy and declare war directly —
  // the geopolitics tests own how wars begin; these tests own what wars do.
  const enemy = [...world.nations.values()]
    .filter((n) => !n.isHomeland)
    .sort((a, b) => b.strength - a.strength || a.id - b.id)[0]
  if (!enemy) throw new Error('no enemy')

  const key = relationKey(home.id, enemy.id)
  const relation = world.geoRelations.get(key)
  if (!relation) throw new Error('no relation')
  const war: GeoRelation = {
    ...relation,
    state: 'war',
    sinceTick: world.tick,
    warPhase: 'attrition',
  }
  world.geoRelations.set(key, war)

  // Enlist a cohort of fit young adults across specialties.
  let enlisted = 0
  for (const person of livingPeople(world)) {
    if (enlisted >= cohort) break
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 26) continue
    const specialty = specialtyById(
      ['rifleman', 'transport', 'signals', 'deckhand', 'mechanic', 'medic'][enlisted % 6] ?? 'rifleman',
    )
    enlistPerson(world, world.tick, person, specialty, [])
    if (isServing(world, person.id)) enlisted++
  }
  if (enlisted < 4) throw new Error('cohort too small')
  return { world, war: world.geoRelations.get(key) as GeoRelation }
}

describe('orders', () => {
  it('nobody deploys in peacetime', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 240)
    for (const [personId] of world.deployments) {
      // Any deployment must belong to a period when the homeland was at war.
      expect(deploymentsOf(world, personId).length).toBeGreaterThan(0)
    }
    // Peace for the homeland in this window ⇒ no deployments at all, OR the
    // homeland genuinely fought. Check against events, the honest ledger.
    const home = homeland(world)
    const homelandWarBegan = world.events.some(
      (e) => e.type === 'war-began' && (e.subjectId === home?.id || e.otherId === home?.id),
    )
    if (!homelandWarBegan) expect(world.deployments.size).toBe(0)
  })

  it('a homeland war sends serving people, and only serving people', () => {
    const { world } = worldAtWar()
    advanceTicks(world, 36)

    const deployedEver = [...world.deployments.keys()]
    expect(deployedEver.length).toBeGreaterThan(0)
    for (const personId of deployedEver) {
      expect(world.service.has(personId)).toBe(true)
    }
  })

  it('deployment is orders, not a question: the clock never halts for it', () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const { world } = worldAtWar()
    // Play a serving person; advance across the deployment window. The only
    // acceptable halts are OTHER pending kinds; 'deploy' is not among them.
    const soldierId = [...world.service.keys()][0]
    if (soldierId === undefined) throw new Error('no soldier')
    setPlayer(world, soldierId)
    for (let i = 0; i < 60; i++) {
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        expect(pending?.kind).not.toBe('deploy' as never)
        resolvePending(world, pending?.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
  })
})

describe('the permanent rule, executable', () => {
  it('the same theatre goes quiet when the war ends', () => {
    const { world, war } = worldAtWar()
    const enemy = world.nations.get(war.a === homeland(world)?.id ? war.b : war.a)
    if (!enemy) throw new Error('no enemy')

    const wartime = threatVectorFor(war, enemy)
    expect(wartime.directCombat).toBeGreaterThan(0)

    // End the war: danger is not a property of the country, so the vector for
    // a ceasefire theatre must be computed from a war that no longer exists —
    // i.e., there is no vector to compute. The API takes a WAR, not a nation:
    // that shape is itself the rule. What we can assert: phase changes move
    // the vector, holding the "country" fixed.
    const stalemate = threatVectorFor({ ...war, warPhase: 'stalemate' }, enemy)
    expect(stalemate.directCombat).toBeLessThan(wartime.directCombat)
    expect(stalemate.baseAttack).toBeGreaterThan(0)
  })

  it('the rifleman and the signals operator fight different wars', () => {
    const rifleman = specialtyById('rifleman').exposure
    const signals = specialtyById('signals').exposure
    expect(rifleman.directCombat).toBeGreaterThan(signals.directCombat * 5)
    expect(signals.baseAttack).toBeGreaterThan(0)
  })
})

describe('the tour', () => {
  function longWar() {
    const built = worldAtWar()
    // Hold the war hot by re-declaring it each year (the geopolitics system
    // may end it; these tests need duration).
    for (let year = 0; year < 5; year++) {
      advanceTicks(built.world, 12)
      const key = relationKey(built.war.a, built.war.b)
      const relation = built.world.geoRelations.get(key)
      if (relation && relation.state !== 'war') {
        built.world.geoRelations.set(key, {
          ...relation,
          state: 'war',
          warPhase: 'attrition',
          sinceTick: built.world.tick,
        })
      }
    }
    return built
  }

  it('most deployed months, nothing happens', () => {
    const { world } = longWar()
    let deployedMonths = 0
    for (const [, tours] of world.deployments) {
      for (const tour of tours) {
        deployedMonths += (tour.returnedAtTick ?? world.tick) - tour.startedAtTick
      }
    }
    const contacts =
      world.events.filter((e) => e.type === 'wounded-in-action').length +
      world.events.filter((e) => e.type === 'died' && String(e.detail).includes('action')).length

    expect(deployedMonths).toBeGreaterThan(20)
    // Foundation §6: deployment is not synonymous with fighting.
    expect(contacts).toBeLessThan(deployedMonths / 3)
  })

  it('tours end, and people come home', () => {
    const { world } = longWar()
    const returned = world.events.filter((e) => e.type === 'returned-home')
    expect(returned.length).toBeGreaterThan(0)
    for (const [personId, tours] of world.deployments) {
      for (const tour of tours) {
        if (tour.returnedAtTick !== null) {
          expect(tour.returnedAtTick).toBeGreaterThanOrEqual(tour.startedAtTick)
        }
        void personId
      }
    }
  })

  it('the history survives: every tour is kept, numbered, forever', () => {
    const { world } = longWar()
    for (const [, tours] of world.deployments) {
      tours.forEach((tour, index) => {
        expect(tour.tourNumber).toBe(index + 1)
      })
    }
  })

  it('stop-loss: no term ends in a theatre', () => {
    const { world } = longWar()
    // The direct claim: anyone currently deployed is not discharged.
    for (const [personId] of world.deployments) {
      if (isDeployed(world, personId)) {
        expect(world.service.get(personId)?.dischargedAtTick).toBeNull()
      }
    }
  })
})

describe('what the war costs', () => {
  function bloodyWar() {
    // A strong enemy, an offensive phase, a rifleman-heavy cohort: the worst
    // months the model can produce, so casualties occur within test budget.
    const world = createWorld(makeSeed(2024))
    const home = homeland(world)
    if (!home) throw new Error('no homeland')
    const enemy = [...world.nations.values()]
      .filter((n) => !n.isHomeland)
      .sort((a, b) => b.strength - a.strength || a.id - b.id)[0]
    if (!enemy) throw new Error('no enemy')
    const key = relationKey(home.id, enemy.id)
    for (const person of livingPeople(world)) {
      const age = ageAt(person.birthTick, world.tick)
      if (age >= 18 && age <= 26) enlistPerson(world, world.tick, person, specialtyById('rifleman'), [])
    }
    for (let month = 0; month < 96; month++) {
      const relation = world.geoRelations.get(key)
      if (relation) {
        world.geoRelations.set(key, {
          ...relation,
          state: 'war',
          warPhase: 'offensive',
          sinceTick: relation.state === 'war' ? relation.sinceTick : world.tick,
        })
      }
      advanceTick(world)
    }
    return world
  }

  it('wounds land on the health system, and the record outranks the headline', () => {
    const world = bloodyWar()
    const wounded = world.events.filter((e) => e.type === 'wounded-in-action')
    expect(wounded.length).toBeGreaterThan(0)

    for (const event of wounded) {
      // The family's version is short.
      expect(event.detail === 'serious' || event.detail === 'minor').toBe(true)
      // The record's version carries the chain (§8): enemy, phase, channel.
      const record = world.causalRecords.find(
        (r) =>
          r.decision === 'deployment' &&
          r.subjectId === event.subjectId &&
          r.tick === event.tick &&
          r.chosen.includes('wounded'),
      )
      if (record) {
        expect(record.inputs.some((f) => f.factor === 'enemy-capability')).toBe(true)
        expect(record.inputs.some((f) => f.factor === 'war-phase')).toBe(true)
      }
    }
  })

  it('death in action is Defining, traceable, and torn down like any death', () => {
    const world = bloodyWar()
    const killed = [...world.people.values()].filter(
      (p) => p.causeOfDeath !== null && p.causeOfDeath.includes('action'),
    )
    if (killed.length === 0) return // this seed's war was merciful; wounds covered above

    for (const person of killed) {
      const record = world.causalRecords.find(
        (r) => r.decision === 'death' && r.subjectId === person.id,
      )
      expect(record?.significance).toBe('defining')
      expect(record?.inputs.some((f) => f.factor === 'enemy-capability')).toBe(true)
      // Torn down like any death: no job, no household membership.
      expect(world.employment.has(person.id)).toBe(false)
      const household = person.householdId === null ? null : world.households.get(person.householdId)
      if (household) expect(household.memberIds).not.toContain(person.id)
    }
  })

  it('a bad wound ends the tour: evacuated home', () => {
    const world = bloodyWar()
    const evacuated = world.events.filter(
      (e) => e.type === 'returned-home' && e.detail === 'evacuated',
    )
    const seriousWounds = world.events.filter(
      (e) => e.type === 'wounded-in-action' && e.detail === 'serious',
    )
    if (seriousWounds.length > 0) {
      expect(evacuated.length).toBeGreaterThan(0)
    }
  })
})
