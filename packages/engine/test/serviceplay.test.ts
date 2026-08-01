/**
 * Career engagement (M-SERVICE-PLAY).
 *
 * The claims, straight from the owner's playtests: nobody sits at SPC for
 * forty years (high-year tenure separates the passed-over, honorably); the
 * player's competitive stripes come only through the board question — put in
 * for, not received; schools exist and raise the standing the board reads;
 * a hand can be raised for the rotation when the Republic fights; and the
 * tab verbs (apply for work, walk into the recruiter) resolve honestly and
 * are part of the deterministic record.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { volunteerForDeployment } from '../src/deployment.js'
import { relationKey } from '../src/geopolitics.js'
import { advanceTick, advanceTicks, createWorld, worldHash } from '../src/index.js'
import {
  applyForJob,
  awaitingPlayer,
  raisePending,
  requestEnlistment,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { isDeployed } from '../src/deployment.js'
import { isVeteran } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function anAdult(world: World, maxAge = 40): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 20 && age <= maxAge
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  return person
}

function putInUniform(
  world: World,
  personId: EntityId,
  overrides: Partial<{
    rank: number
    rankSinceTick: number
    enlistedAtTick: number
    termMonthsLeft: number
    performance: number
    termPerformanceSum: number
  }> = {},
): void {
  world.service.set(personId, {
    personId,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: overrides.rank ?? 3,
    rankSinceTick: (overrides.rankSinceTick ?? world.tick) as never,
    qualifications: [],
    enlistedAtTick: (overrides.enlistedAtTick ?? world.tick - 30) as never,
    baseId: personId,
    monthlyPay: 139_000 as never,
    performance: overrides.performance ?? 700,
    termMonthsLeft: overrides.termMonthsLeft ?? 24,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: overrides.termPerformanceSum ?? 700 * 6,
    unitId: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
  })
  world.employment.delete(personId)
}

describe('high-year tenure — up or out', () => {
  it('separates a long-passed-over member at term end, honorably', () => {
    const world = createWorld(makeSeed(12345))
    const npc = anAdult(world)
    putInUniform(world, npc.id, {
      rank: 3, // SPC, below the top
      rankSinceTick: world.tick - 80, // six-plus years in grade
      termMonthsLeft: 1,
      performance: 450,
      termPerformanceSum: 450 * 47,
    })

    advanceTick(world)

    const record = world.service.get(npc.id)
    expect(record?.dischargedAtTick).not.toBeNull()
    expect(record?.dischargeReason).toBe('high-year tenure')
    expect(isVeteran(world, npc.id)).toBe(true)
    // The term itself was served in full and honorably: the medal stands.
    const decorations = world.awards.get(npc.id) ?? []
    expect(decorations.some((a) => a.kind === 'good-conduct')).toBe(true)
  })

  it('across a long world, nobody serves forever in the same grade', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 900)
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const ladderTopped = record.rank >= 8 // MSG can stay
      const tig = world.tick - record.rankSinceTick
      if (!ladderTopped) {
        // TIG can exceed the 72-month line only until the current term ends.
        expect(tig).toBeLessThan(72 + 48)
      }
    }
  })
})

describe("the player's board", () => {
  function aPlayedSoldier(world: World): Person {
    const person = anAdult(world)
    setPlayer(world, person.id)
    putInUniform(world, person.id, {
      rank: 3, // SPC: the next step (CPL) is competitive
      rankSinceTick: world.tick - 12, // exactly at the gate — asked this month
      enlistedAtTick: world.tick - 30,
      performance: 700,
    })
    return person
  }

  it('asks, and either answer of the board goes on the record', () => {
    const world = createWorld(makeSeed(12345))
    const person = aPlayedSoldier(world)

    // The cadence guarantees an ask within a year of eligibility; other
    // questions (a courtship, a school slot) may arrive first — decline them.
    let guard = 0
    while (guard < 30 && world.player.pending?.kind !== 'promotion-board') {
      guard++
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
    expect(world.player.pending?.kind).toBe('promotion-board')

    resolvePending(world, 'put-in')
    const promoted = world.events.some((e) => e.type === 'promoted' && e.subjectId === person.id)
    const passedOver = world.events.some((e) => e.type === 'passed-over' && e.subjectId === person.id)
    expect(promoted || passedOver).toBe(true)
    expect(promoted && passedOver).toBe(false)
    // Either way there is a causal record of the board, owned by the choice.
    const record = world.causalRecords.find(
      (r) => r.subjectId === person.id && r.decision === 'promotion',
    )
    expect(record?.inputs.some((f) => f.factor === 'own-choice')).toBe(true)
  })

  it('never promotes the player past a competitive rank without the board', () => {
    const world = createWorld(makeSeed(12345))
    const person = aPlayedSoldier(world)

    // Thirty months of soldiering, declining every question that comes.
    let guard = 0
    while (guard < 400 && world.tick - (world.service.get(person.id)?.enlistedAtTick ?? 0) < 60) {
      guard++
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
    // Passed on every board: still an SPC. The stripes wait for the asking.
    expect(world.service.get(person.id)?.rank).toBe(3)
    // And every pass was a choice ON THE RECORD, as the stakes promise.
    expect(
      world.causalRecords.some(
        (r) => r.subjectId === person.id && r.decision === 'promotion' && r.chosen === 'let the board go by',
      ),
    ).toBe(true)
  })

  it('a school raises the standing, on the record', () => {
    const world = createWorld(makeSeed(12345))
    const person = anAdult(world)
    setPlayer(world, person.id)
    putInUniform(world, person.id, { performance: 480 })

    raisePending(world, {
      tick: world.tick,
      kind: 'attend-school',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['attend', 'pass'],
    })
    resolvePending(world, 'attend')

    const record = world.service.get(person.id)
    expect(record?.performance).toBe(540)
    expect(world.events.some((e) => e.type === 'completed-training' && e.detail === 'an advanced course')).toBe(true)
    // 540 >= 500: the course also earned the trade's rating and its badge.
    expect(record?.qualifications).toContain('expert marksman')
    expect((world.awards.get(person.id) ?? []).some((a) => a.kind === 'qualification-badge')).toBe(true)
  })
})

describe('volunteering for the rotation', () => {
  function aWarAndASoldier(world: World): Person {
    const nations = [...world.nations.values()]
    const home = nations.find((n) => n.isHomeland)
    const enemy = nations.find((n) => !n.isHomeland)
    if (!home || !enemy) throw new Error('no nations')
    const key = relationKey(home.id, enemy.id)
    const relation = world.geoRelations.get(key)
    if (!relation) throw new Error('no relation')
    world.geoRelations.set(key, { ...relation, state: 'war', warPhase: 'attrition', sinceTick: world.tick })

    const person = anAdult(world)
    setPlayer(world, person.id)
    putInUniform(world, person.id, { enlistedAtTick: world.tick - 30 })
    return person
  }

  it('puts a trained hand on the next tour, by own choice, on the record', () => {
    const world = createWorld(makeSeed(12345))
    const person = aWarAndASoldier(world)

    expect(volunteerForDeployment(world, world.tick, person.id)).toBe(true)
    expect(isDeployed(world, person.id)).toBe(true)

    const record = world.causalRecords.find(
      (r) => r.subjectId === person.id && r.decision === 'deployment',
    )
    expect(record?.inputs.some((f) => f.factor === 'own-choice')).toBe(true)
    expect(record?.chosen).toContain('volunteered')
  })

  it('refuses the untrained and the unwarred', () => {
    const world = createWorld(makeSeed(12345))
    const person = anAdult(world)
    putInUniform(world, person.id, { enlistedAtTick: world.tick - 1 }) // still in basic
    // No war at all:
    expect(volunteerForDeployment(world, world.tick, person.id)).toBe(false)
  })
})

describe('tab verbs', () => {
  it('applying for work is logged, answered honestly, and deterministic', () => {
    const a = createWorld(makeSeed(12345))
    const b = createWorld(makeSeed(12345))
    for (const world of [a, b]) {
      const person = anAdult(world)
      setPlayer(world, person.id)
      const result = applyForJob(world, 'labourer')
      // Either hired (event 'hired') or turned down (event 'turned-down') —
      // both are real answers, both in the story.
      const hired = world.events.some((e) => e.type === 'hired' && e.subjectId === person.id)
      const refused = world.events.some((e) => e.type === 'turned-down' && e.subjectId === person.id)
      expect(result.hired ? hired : refused || result.reason.length > 0).toBe(true)
      expect(world.player.log.some((entry) => entry.kind === 'job-application')).toBe(true)

      // One asking a month: the second application is refused before the
      // roll, and writes nothing new.
      const eventsBefore = world.events.length
      const again = applyForJob(world, 'cook')
      expect(again.hired).toBe(false)
      expect(again.reason).toContain('One asking')
      expect(world.events.length).toBe(eventsBefore)
    }
    expect(worldHash(a)).toBe(worldHash(b))
  })

  it('an unqualified application is refused with the reason, not a roll', () => {
    const world = createWorld(makeSeed(12345))
    const person = anAdult(world)
    setPlayer(world, person.id)
    const education = world.education.get(person.id)
    if (education?.level === 'college') return // this seed's adult is a scholar; nothing to test
    const result = applyForJob(world, 'doctor')
    expect(result.hired).toBe(false)
    expect(result.reason).toContain('college')
    expect(world.events.some((e) => e.type === 'turned-down')).toBe(false)
  })

  it('walking into the recruiting office asks the uniform question, or explains the no', () => {
    const world = createWorld(makeSeed(12345))
    const teen = livingPeople(world)
      .filter((p) => {
        const age = ageAt(p.birthTick, world.tick)
        return age >= 18 && age <= 24
      })
      .sort((x, y) => x.id - y.id)[0]
    if (!teen) throw new Error('no candidate')
    setPlayer(world, teen.id)

    const result = requestEnlistment(world)
    if (result.asked) {
      expect(world.player.pending?.kind).toBe('specialty')
      expect(world.player.log.some((entry) => entry.kind === 'walk-in-enlist')).toBe(true)
      resolvePending(world, world.player.pending?.options[0] ?? 'rifleman')
      expect(world.service.has(teen.id)).toBe(true)
    } else {
      expect(result.reason.length).toBeGreaterThan(0)
    }

    // A veteran cannot enlist again, and hears why. (Young enough that the
    // age bar does not answer first.)
    const world2 = createWorld(makeSeed(12345))
    const vet = anAdult(world2, 25)
    setPlayer(world2, vet.id)
    putInUniform(world2, vet.id)
    world2.service.set(vet.id, {
      ...world2.service.get(vet.id)!,
      dischargedAtTick: world2.tick as never,
      dischargeReason: 'end of term',
    })
    const again = requestEnlistment(world2)
    expect(again.asked).toBe(false)
    expect(again.reason).toContain('One service career')
  })
})
