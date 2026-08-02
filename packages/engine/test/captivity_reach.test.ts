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
import { relationKey } from '../src/geopolitics.js'
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
  // A REAL WAR, or the captivity is over on the first month: the peace-time
  // release door is wide by design, and a fixture without a war tests that
  // door instead of the cell. (This is why the first draft of this test
  // passed with nothing asserted.)
  const key = relationKey(home.id, enemy.id)
  const relation = world.geoRelations.get(key)
  if (!relation) throw new Error('no relation')
  world.geoRelations.set(key, {
    ...relation,
    state: 'war',
    sinceTick: world.tick,
    warPhase: 'attrition',
  })
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

    // THE CONTROL. Without this an always-false raisePending would pass the
    // block above and nobody would notice the game had stopped asking
    // anything at all.
    const free = createWorld(makeSeed(7700), 40)
    const freePerson = livingPeople(free).sort((a, b) => a.id - b.id)[0]
    if (!freePerson) throw new Error('nobody')
    setPlayer(free, freePerson.id)
    expect(
      raisePending(free, {
        tick: free.tick,
        kind: 'job-offer',
        personId: freePerson.id,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      }),
      'a free player can still be asked things',
    ).toBe(true)
  })

  it('does not graduate a course, and does not serve out a term, from a cell', () => {
    const world = createWorld(makeSeed(7701), 40)
    const personId = aCaptivePlayer(world)
    const before = world.service.get(personId)
    // Month by month FOR AS LONG AS THEY ARE HELD. Captivity ends on its own
    // schedule, so a fixed number of ticks would test the release instead —
    // and the claim is about the months in the cell.
    let assertionsMade = 0
    for (let i = 0; i < 12 && isCaptive(world, personId); i++) {
      advanceTicks(world, 1)
      const held = world.service.get(personId)
      // COUNT ASSERTIONS, NOT MONTHS. Counting the month before checking
      // whether they were still held let a release on the first month pass
      // this test with nothing asserted at all.
      if (!isCaptive(world, personId)) break
      assertionsMade += 1
      // The seat is KEPT — they are away, not out — but nothing graduates.
      expect(held?.schoolId).toBe('jump-school')
      // A cell is not a term of service: neither side of the average that
      // later grants the Good Conduct Medal moves.
      expect(held?.termMonthsLeft).toBe(before?.termMonthsLeft)
      expect(held?.termPerformanceSum).toBe(before?.termPerformanceSum)
      expect(held?.dischargedAtTick, 'nobody is discharged in enemy hands').toBe(null)
    }
    expect(assertionsMade, 'the captivity lasted long enough to assert anything').toBeGreaterThan(0)
    expect(
      world.events.some((e) => e.type === 'completed-training' && e.subjectId === personId),
      'nobody graduates a course from a cell',
    ).toBe(false)

    // AND NOT ON THE WAY HOME EITHER. Skipping the months away left the
    // class date stale, so the month after release the course graduated on
    // its own — a badge for something nobody sat in. Run well past the
    // release and check the seat was re-slotted rather than cashed.
    advanceTicks(world, 24)
    const graduations = world.events.filter(
      (e) => e.type === 'completed-training' && e.subjectId === personId,
    )
    for (const graduation of graduations) {
      const started = world.events.find(
        (e) => e.type === 'began-training' && e.subjectId === personId && e.tick < graduation.tick,
      )
      expect(started, `graduated ${graduation.detail ?? '?'} without ever starting it`).toBeDefined()
    }
  })
})
