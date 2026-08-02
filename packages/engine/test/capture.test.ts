/**
 * Capture, captivity, and the Prisoner of War Medal (ADR-0025).
 *
 * The claims: a war can take prisoners at all; a captive's tour does not end
 * on the calendar; captivity ends in repatriation or in death and never in
 * silence; the medal is granted from the capture itself, so it reaches the
 * man who dies held as well as the one who walks out; and no other event
 * can mint it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { capture, capturedSince, currentDeployment } from '../src/deployment.js'
import { grantPow, POW_TITLE } from '../src/awards.js'
import { decorationsOf } from '../src/awards.js'
import { openStream, Stream } from '../src/rng.js'
import { advanceTicks } from '../src/index.js'
import { timelineFor } from '../src/story.js'
import { livingPeople } from '../src/systems.js'
import type { EntityId } from '@life-engine/shared'
import type { World } from '../src/types.js'

/** Put somebody on an open combat tour against a real enemy. */
function aDeployedSoldier(world: World): EntityId {
  const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody')
  const enemy = [...world.nations.values()].sort((a, b) => a.id - b.id)[1]
  if (!enemy) throw new Error('no enemy')
  const home = [...world.nations.values()].sort((a, b) => a.id - b.id)[0]
  if (!home) throw new Error('no homeland')
  // A decoration is issued BY a branch, so the record has to exist for the
  // medal to have anywhere to come from.
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 3,
    rankSinceTick: world.tick,
    qualifications: [],
    enlistedAtTick: world.tick,
    baseId: person.id,
    monthlyPay: 139_000 as never,
    performance: 600,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 3_600,
    unitId: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  world.deployments.set(person.id, [
    {
      personId: person.id,
      kind: 'combat',
      warA: home.id,
      warB: enemy.id,
      enemyId: enemy.id,
      hostId: null,
      startedAtTick: world.tick,
      endsAtTick: (world.tick + 9) as never,
      returnedAtTick: null,
      tourNumber: 1,
      capturedAtTick: null,
    },
  ])
  return person.id
}

describe('capture', () => {
  it('takes a prisoner, and the tour stops running on the calendar', () => {
    const world = createWorld(makeSeed(7100), 40)
    const personId = aDeployedSoldier(world)
    const rng = openStream(world.seed, Stream.CombatResolution, personId, world.tick)

    expect(capture(world, world.tick, personId, rng)).toBe(true)
    expect(capturedSince(world, personId)).toBe(world.tick)
    // The tour is still open — that is the point. A prisoner does not come
    // home because the orders said this month.
    expect(currentDeployment(world, personId)?.returnedAtTick).toBe(null)
    expect(world.events.some((e) => e.type === 'was-captured' && e.subjectId === personId)).toBe(true)

    // The medal is on the record at the moment of capture, not on the way
    // out — a man who dies held earned it the same as one who walks out.
    expect(decorationsOf(world, personId).some((award) => award.title === POW_TITLE)).toBe(true)

    // And it is legible: the timeline says what happened, with the Why?
    // behind it reachable.
    const line = timelineFor(world, personId).find((entry) => entry.text.includes('Taken prisoner'))
    expect(line, 'the capture is on the timeline').toBeDefined()
    expect(line?.decision ?? null).not.toBe(null)
  })

  it('cannot take somebody twice, or take somebody who is not out there', () => {
    const world = createWorld(makeSeed(7101), 40)
    const personId = aDeployedSoldier(world)
    const rng = openStream(world.seed, Stream.CombatResolution, personId, world.tick)
    expect(capture(world, world.tick, personId, rng)).toBe(true)
    expect(capture(world, world.tick, personId, rng)).toBe(false)

    const other = livingPeople(world).sort((a, b) => a.id - b.id)[1]
    if (!other) throw new Error('nobody')
    expect(capture(world, world.tick, other.id, rng)).toBe(false)
  })

  it('captivity ends — in a repatriation or a death, never in silence', () => {
    // Run the months forward and count how each held soldier came out. The
    // claim under test is that NOBODY is still held at the end: a captivity
    // with no door out is a bug that would only show up years later.
    let repatriated = 0
    let died = 0
    let stillHeld = 0
    for (let s = 0; s < 25; s++) {
      const world = createWorld(makeSeed(7200 + s), 40)
      const personId = aDeployedSoldier(world)
      const rng = openStream(world.seed, Stream.CombatResolution, personId, world.tick)
      capture(world, world.tick, personId, rng)
      advanceTicks(world, 600)
      const out = world.events.filter(
        (e) => e.subjectId === personId && (e.type === 'repatriated' || e.type === 'died-in-captivity'),
      )
      if (out.some((e) => e.type === 'repatriated')) repatriated += 1
      else if (out.some((e) => e.type === 'died-in-captivity')) died += 1
      else stillHeld += 1
    }
    expect(stillHeld, 'nobody is held forever').toBe(0)
    expect(repatriated, 'most come home').toBeGreaterThan(died)
  })

  it('the medal refuses any event that is not a capture', () => {
    const world = createWorld(makeSeed(7300), 40)
    advanceTicks(world, 24) // the ledger needs something in it to test against
    const personId = aDeployedSoldier(world)
    const notACapture = world.events.find((e) => e.type !== 'was-captured')
    expect(notACapture).toBeDefined()
    if (notACapture) expect(grantPow(world, world.tick, personId, notACapture)).toBe(null)
  })
})
