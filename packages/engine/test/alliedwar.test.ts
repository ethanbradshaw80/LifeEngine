/**
 * M-ARMY2: fighting beside an ally.
 *
 * The review that caught this feature dead on arrival is why the first
 * test exists: a support tour must SURVIVE its next tick. Its war is not
 * one of the homeland's, so anything that looks up the war by the
 * homeland's list will close it instantly and the player who answered
 * "stay and fight" comes home a month later having seen nothing.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { specialtyById } from '../src/content.js'
import { homeland, relationKey } from '../src/geopolitics.js'
import { HEARTLAND_SPEC } from '../src/heartland.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { alliedWars, currentDeployment, volunteerForSupport } from '../src/deployment.js'
import { enlistPerson, isServing } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

/** A world where an ALLY (same bloc, at peace with us) is at war. */
function worldWithAlliedWar(seedValue = 12345): { world: World; allyId: number } {
  const world = createWorld(makeSeed(seedValue), 100)
  const home = homeland(world)
  if (!home) throw new Error('no homeland')
  if (home.bloc === null) throw new Error('homeland has no bloc')

  const ally = [...world.nations.values()].find((n) => !n.isHomeland && n.bloc === home.bloc)
  const enemy = [...world.nations.values()].find(
    (n) => !n.isHomeland && n.bloc !== home.bloc && n.id !== ally?.id,
  )
  if (!ally || !enemy) throw new Error('no ally/enemy pair in this world')

  // The ally's war — the homeland is not in it.
  const key = relationKey(ally.id, enemy.id)
  const relation = world.geoRelations.get(key)
  if (!relation) throw new Error('no relation')
  world.geoRelations.set(key, {
    ...relation,
    state: 'war',
    sinceTick: world.tick,
    warPhase: 'attrition',
  })

  // Someone trained and available to go.
  const specialty = specialtyById('rifleman')
  let enlisted = 0
  for (const person of livingPeople(world)) {
    if (enlisted >= 6) break
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 26) continue
    enlistPerson(world, world.tick, person, specialty, [])
    if (isServing(world, person.id)) enlisted++
  }
  if (enlisted === 0) throw new Error('nobody enlisted')
  return { world, allyId: ally.id }
}

describe("an ally's war", () => {
  it('is found, and excludes wars the homeland is fighting itself', () => {
    const { world, allyId } = worldWithAlliedWar()
    const options = alliedWars(world)
    expect(options.length).toBeGreaterThan(0)
    const home = homeland(world)
    for (const option of options) {
      expect(option.ally.id).toBe(allyId)
      expect(option.ally.bloc).toBe(home?.bloc)
      expect(option.war.a).not.toBe(home?.id)
      expect(option.war.b).not.toBe(home?.id)
    }
  })

  it('SURVIVES its next tick — the tour must actually run', () => {
    const { world } = worldWithAlliedWar()
    // Train the cohort past the pipeline so they can deploy.
    advanceTicks(world, 8)
    const volunteer = [...world.service.values()].find((r) => r.dischargedAtTick === null)
    if (!volunteer) throw new Error('nobody serving')

    expect(volunteerForSupport(world, world.tick, volunteer.personId)).toBe(true)
    const tour = currentDeployment(world, volunteer.personId)
    expect(tour).toBeDefined()
    expect(tour?.kind).toBe('combat')
    expect(tour?.enemyId).not.toBeNull()

    // THE REGRESSION: one month later they must still be there.
    advanceTicks(world, 1)
    const stillThere = currentDeployment(world, volunteer.personId)
    expect(stillThere, 'the support tour closed on its first tick').toBeDefined()
    expect(stillThere?.startedAtTick).toBe(tour?.startedAtTick)

    // And it runs long enough to be a tour, not a bus ride.
    advanceTicks(world, 4)
    const record = world.service.get(volunteer.personId)
    const alive = world.people.get(volunteer.personId)?.deathTick === null
    if (alive && record?.dischargedAtTick === null) {
      const open = currentDeployment(world, volunteer.personId)
      // Either still deployed, or home for a REAL reason (wounded, or the
      // ally's war ended) — never silently closed the month it opened.
      if (open === undefined) {
        const home = world.events.find(
          (e) => e.type === 'returned-home' && e.subjectId === volunteer.personId,
        )
        expect(home?.tick).toBeGreaterThan((tour?.startedAtTick ?? 0) + 1)
      }
    }
  })

  it('refuses when the homeland is fighting its own war', () => {
    const { world } = worldWithAlliedWar()
    const home = homeland(world)
    if (!home) throw new Error('no homeland')
    // Drag the homeland into a war of its own.
    const foe = [...world.nations.values()].find(
      (n) => !n.isHomeland && n.bloc !== home.bloc,
    )
    if (!foe) throw new Error('no foe')
    const key = relationKey(home.id, foe.id)
    const relation = world.geoRelations.get(key)
    if (relation) {
      world.geoRelations.set(key, {
        ...relation,
        state: 'war',
        sinceTick: world.tick,
        warPhase: 'opening',
      })
    }
    advanceTicks(world, 8)
    const soldier = [...world.service.values()].find(
      (r) => r.dischargedAtTick === null && currentDeployment(world, r.personId) === undefined,
    )
    if (!soldier) return
    // Our own war takes precedence — the support door is shut.
    expect(volunteerForSupport(world, world.tick, soldier.personId)).toBe(false)
  })
})

describe('a war stays a war, not a world war', () => {
  it('never lets more than a handful of countries pile onto one nation', () => {
    // THE OWNER, PLAYING: eleven nations declared on Belarus inside a year —
    // "not everybody at once man." Two multipliers did it. A caller asked
    // its ENTIRE bloc in one month, and every ally that joined got its own
    // war relation, which then ran its own calls to arms from a new mouth.
    //
    // One ally asked per war per month, and a hard ceiling counted across
    // every war against the same enemy. Measured at exactly 3 on all three
    // seeds; the assertion allows a little headroom rather than pinning the
    // measurement, because the ceiling is the claim, not the number.
    for (const seedValue of [12345, 999, 4242]) {
      const world = createWorld(makeSeed(seedValue), 60, HEARTLAND_SPEC)
      let peak = 0
      let peakName = ''
      for (let month = 0; month < 900; month++) {
        advanceTicks(world, 1)
        const counts = new Map<number, number>()
        for (const relation of world.geoRelations.values()) {
          if (relation.state !== 'war') continue
          for (const id of [relation.a, relation.b]) {
            counts.set(id, (counts.get(id) ?? 0) + 1)
          }
        }
        for (const [id, n] of counts) {
          if (n > peak) {
            peak = n
            peakName = world.nations.get(id as never)?.name ?? '?'
          }
        }
      }
      expect(peak, `${peakName} was fighting ${String(peak)} countries at once`).toBeLessThanOrEqual(4)
    }
  })
})

describe('the town, not just the player', () => {
  it('sends people to an ally war', () => {
    // THE OWNER, PLAYING: "NPCs don't volunteer to go to allies' wars."
    // volunteerForSupport was reachable only from the player's own verb, so
    // in every world ever generated the played character was the ONLY
    // person who ever fought alongside an ally. The town sent nobody and
    // the paper reported nobody.
    let totalSupport = 0
    for (const seedValue of [12345, 999, 4242]) {
      const world = createWorld(makeSeed(seedValue), 140, HEARTLAND_SPEC)
      advanceTicks(world, 1_800)
      const home = [...world.nations.values()].find((n) => n.isHomeland)
      if (!home) throw new Error('no homeland')
      for (const tours of world.deployments.values()) {
        for (const tour of tours) {
          // A support tour is a combat tour against somebody we are not at
          // war with — an ally's war, fought beside them.
          if (tour.kind !== 'combat') continue
          if (tour.warA === home.id || tour.warB === home.id) continue
          totalSupport += 1
        }
      }
    }
    expect(totalSupport, 'nobody in three towns ever helped an ally').toBeGreaterThan(0)
  })
})
