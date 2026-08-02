/**
 * What can and cannot reach a prisoner.
 *
 * The claim: nothing can. A man held by a hostile force is not weighing a
 * job offer, not moving house, not being asked whether to rest or push on,
 * and not graduating a course. Before this, every one of those could reach
 * him, because each raise site knew about its own subject and none knew
 * about captivity.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { capture, isCaptive } from '../src/deployment.js'
import { raisePending, setPlayer } from '../src/player.js'
import { openStream, Stream } from '../src/rng.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'
import type { EntityId } from '@life-engine/shared'

function aCaptivePlayer(world: World): EntityId {
  const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody')
  setPlayer(world, person.id)
  const enemy = [...world.nations.values()].filter((n) => !n.isHomeland).sort((a, b) => a.id - b.id)[0]
  const home = [...world.nations.values()].filter((n) => n.isHomeland)[0]
  if (!enemy || !home) throw new Error('no war to have')
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
    performance: 700,
    termMonthsLeft: 6,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 4_200,
    unitId: null,
    unitSinceTick: null,
    schoolId: 'jump-school',
    schoolStartsAtTick: world.tick,
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
  capture(world, world.tick, person.id, openStream(world.seed, Stream.CombatResolution, person.id, world.tick))
  return person.id
}

describe('a prisoner', () => {
  it('cannot be asked anything at all', () => {
    const world = createWorld(makeSeed(7700), 40)
    const personId = aCaptivePlayer(world)
    for (const kind of ['job-offer', 'move-house', 'convalesce', 'courtship'] as const) {
      const landed = raisePending(world, {
        tick: world.tick,
        kind,
        personId,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
      expect(landed, `${kind} reached a prisoner`).toBe(false)
    }
    expect(world.player.pending).toBe(null)
  })

  it('does not graduate a course, and does not serve out a term, from a cell', () => {
    const world = createWorld(makeSeed(7701), 40)
    const personId = aCaptivePlayer(world)
    const before = world.service.get(personId)
    // Month by month FOR AS LONG AS THEY ARE HELD. Captivity ends on its own
    // schedule, so a fixed number of ticks would test the release instead —
    // and the claim is about the months in the cell.
    let monthsChecked = 0
    for (let i = 0; i < 12 && isCaptive(world, personId); i++) {
      advanceTicks(world, 1)
      monthsChecked += 1
      const held = world.service.get(personId)
      if (!isCaptive(world, personId)) break
      // The seat is KEPT — they are away, not out — but nothing graduates.
      expect(held?.schoolId).toBe('jump-school')
      // A cell is not a term of service: neither side of the average that
      // later grants the Good Conduct Medal moves.
      expect(held?.termMonthsLeft).toBe(before?.termMonthsLeft)
      expect(held?.termPerformanceSum).toBe(before?.termPerformanceSum)
      expect(held?.dischargedAtTick, 'nobody is discharged in enemy hands').toBe(null)
    }
    expect(monthsChecked, 'the captivity lasted at least a month to test').toBeGreaterThan(0)
    expect(
      world.events.some((e) => e.type === 'completed-training' && e.subjectId === personId),
      'nobody graduates a course from a cell',
    ).toBe(false)
  })
})
