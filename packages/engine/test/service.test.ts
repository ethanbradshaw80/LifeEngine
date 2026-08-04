/**
 * Military service as a peacetime career. L4-M3.
 *
 * The claims: people enlist at believable rates and serve real careers
 * (promotion, terms, discharge, reenlistment); the serving hold no civilian
 * job and their pay reaches the household; records survive discharge; the
 * medically unfit are barred or discharged; veterans carry their trade home;
 * and the player's enlistment path runs choice by choice.
 */

import { describe, expect, it } from 'vitest'
import { placeOf } from '../src/careers.js'
import { meetsRequirement, occupationById } from '../src/content.js'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { BRANCH_RANKS,
  BRANCH_OFFICER_RANKS, CLASSIC_BRANCHES, servicePayOn, specialtyById } from '../src/content.js'
import type { ServiceBranch } from '../src/content.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { awaitingPlayer, resolvePending, setPlayer } from '../src/player.js'
import { isServing, isVeteran, veteranUnlocks } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function grownWorld(ticks = 600): World {
  const world = createWorld(makeSeed(12345), 100)
  advanceTicks(world, ticks)
  return world
}

describe('the peacetime career', () => {
  it('some people enlist, serve, and leave across fifty years', () => {
    const world = grownWorld()
    const enlisted = world.events.filter((e) => e.type === 'enlisted').length
    const discharged = world.events.filter((e) => e.type === 'discharged').length

    expect(enlisted).toBeGreaterThan(2)
    expect(discharged).toBeGreaterThan(0)
    // Service is a road some take, not the road everyone takes.
    const everyone = world.people.size
    expect(enlisted).toBeLessThan(everyone / 4)
  })

  it('promotions happen, in order, within each branch ladder', () => {
    const world = grownWorld(900)
    const promoted = world.events.filter((e) => e.type === 'promoted')
    expect(promoted.length).toBeGreaterThan(0)

    // BOTH LADDERS ARE RANKS. Officers promote now — before the commission
    // fork the officer half of every branch was unreachable, so this set
    // only had to hold the enlisted titles.
    const allTitles = new Set([
      ...Object.values(BRANCH_RANKS).flat(),
      ...Object.values(BRANCH_OFFICER_RANKS).flat(),
    ])
    for (const event of promoted) {
      expect(allTitles.has(event.detail ?? ''), `${event.detail ?? ''} is not a rank`).toBe(true)
    }
    for (const record of world.service.values()) {
      const ladder =
        record.commissioned === true
          ? BRANCH_OFFICER_RANKS[record.branch as ServiceBranch]
          : BRANCH_RANKS[record.branch as ServiceBranch]
      expect(record.rank).toBeGreaterThanOrEqual(0)
      expect(record.rank).toBeLessThan(ladder.length)
    }
  })

  it('NEVER skips a rank — every promotion is exactly one step', () => {
    // The owner watched a rifleman get "spotted at corporal" without ever
    // being PV2. This is the regression test for that playtest finding.
    const world = grownWorld(900)
    const byPerson = new Map<number, string[]>()
    for (const event of world.events) {
      if (event.type !== 'promoted') continue
      const list = byPerson.get(event.subjectId) ?? []
      list.push(event.detail ?? '')
      byPerson.set(event.subjectId, list)
    }
    expect(byPerson.size).toBeGreaterThan(0)
    for (const [personId, titles] of byPerson) {
      const record = world.service.get(personId as never)
      if (!record) continue
      // The ladder this person is on — an officer's steps are not the
      // enlisted ones, and reading the wrong list made every officer
      // promotion look like a skipped rank.
      const ladder =
        record.commissioned === true
          ? BRANCH_OFFICER_RANKS[record.branch as ServiceBranch]
          : BRANCH_RANKS[record.branch as ServiceBranch]
      let previous = 0 // everyone starts at the bottom
      for (const title of titles) {
        const index = ladder.indexOf(title)
        expect(index, `${title} is not on the ${record.branch} ladder`).toBeGreaterThan(-1)
        // Never MORE than one step up. Equal-or-lower is legal since
        // M-ARMY2's company punishments can bust a stripe — the ladder is
        // then climbed again, one step at a time, which is the guarantee.
        expect(index, `promotion skipped a rank: ${titles.join(' → ')}`).toBeLessThanOrEqual(previous + 1)
        previous = index
      }
    }
  })

  it('junior promotion runs on time in grade, monthly, not an annual jump', () => {
    const world = createWorld(makeSeed(12345), 100)
    const teen = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) < 18)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (!teen) throw new Error('no teenager')
    // A diligent soldier, so the time-based gates are what we measure.
    world.people.set(teen.id, { ...teen, traits: { ...teen.traits, diligence: 700 } })
    setPlayer(world, teen.id)

    for (let i = 0; i < 200 && !awaitingPlayer(world); i++) advanceTick(world)
    resolvePending(world, 'enlist')
    resolvePending(world, world.player.pending?.options[0] ?? 'rifleman')
    const enlistedAt = world.service.get(teen.id)?.enlistedAtTick ?? world.tick

    // Serve nine months, answering nothing else the safest way.
    while (world.tick - enlistedAt < 9) {
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }

    const record = world.service.get(teen.id)
    expect(record).toBeDefined()
    // E-1 to E-2 lands at ~6 months in grade — not at the one-year review.
    expect(record?.rank).toBe(1)
  })

  it('a term is a lived four years: training, school, a posting on the record', () => {
    const world = grownWorld(900)
    const enlistees = new Set(
      world.events.filter((e) => e.type === 'enlisted').map((e) => e.subjectId),
    )
    expect(enlistees.size).toBeGreaterThan(0)

    for (const personId of enlistees) {
      const events = world.events.filter((e) => e.subjectId === personId)
      const began = events.filter((e) => e.type === 'began-training')
      // Everyone reports somewhere the day they sign — and WHICH somewhere
      // is the ladder they signed onto. An officer does not go to basic.
      const commissioned = world.service.get(personId)?.commissioned === true
      expect(began.some((e) => e.detail === (commissioned ? 'the commissioning course' : 'basic training'))).toBe(
        true,
      )
    }

    // Across a fifty-year town, the texture of service exists: schools finish,
    // postings move, exercises happen.
    expect(world.events.some((e) => e.type === 'completed-training')).toBe(true)
    expect(world.events.some((e) => e.type === 'changed-post')).toBe(true)
    expect(world.events.some((e) => e.type === 'field-exercise')).toBe(true)
  })

  it('pay tracks the pay grade, and SPC and CPL earn the same E-4 pay', () => {
    const land = CLASSIC_BRANCHES.find((b) => b.id === 'land-forces')
    const navy = CLASSIC_BRANCHES.find((b) => b.id === 'naval-service')
    if (!land || !navy) throw new Error('classic must ship these branches')
    expect(servicePayOn(land, 3)).toBe(servicePayOn(land, 4))
    // Sergeant out-earns specialist; the table rises with grade.
    expect(servicePayOn(land, 5)).toBeGreaterThan(servicePayOn(land, 4))
    // All branches pay the same at the bottom: pay is rank, not trade.
    expect(servicePayOn(navy, 0)).toBe(servicePayOn(land, 0))
  })

  it('the serving hold no civilian job, and their pay reaches home', () => {
    const world = grownWorld()
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      expect(world.employment.has(record.personId)).toBe(false)
      expect(record.monthlyPay).toBeGreaterThan(0)
    }
  })

  it('records survive discharge — the artifact a descendant finds', () => {
    const world = grownWorld(900)
    const veterans = [...world.service.values()].filter((r) => r.dischargedAtTick !== null)
    expect(veterans.length).toBeGreaterThan(0)
    for (const record of veterans) {
      // The whole record is still there: branch, specialty, when, why.
      expect(record.enlistedAtTick).toBeLessThan(record.dischargedAtTick ?? 0)
      expect(record.dischargeReason).not.toBeNull()
      expect(specialtyById(record.specialtyId).title.length).toBeGreaterThan(0)
    }
  })

  it('nobody serves on past a broken body', () => {
    const world = grownWorld(900)
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      expect(world.health.get(record.personId)?.disability ?? 0).toBeLessThan(400)
    }
  })

  it('reenlistment keeps some careers long', () => {
    const world = grownWorld(900)
    const reenlisted = world.events.filter((e) => e.type === 'reenlisted').length
    expect(reenlisted).toBeGreaterThan(0)
  })
})

describe('veterans', () => {
  it('carry their trade home', () => {
    const world = createWorld(makeSeed(12345), 100)
    // Hand-build a discharged field mechanic with primary schooling only.
    const person = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 19 && age <= 40 && world.education.get(p.id)?.level === 'primary'
    })
    expect(person).toBeDefined()
    if (!person) return

    world.service.set(person.id, {
      personId: person.id,
      branch: 'land-forces',
      specialtyId: 'mechanic',
      rank: 2,
      rankSinceTick: -12 as never,
      qualifications: [],
      enlistedAtTick: -48 as never,
      baseId: person.id,
      monthlyPay: 150_000 as never,
      performance: 600,
      termMonthsLeft: 0,
      dischargedAtTick: 0 as never,
      dischargeReason: 'end of term',
      termPerformanceSum: 0,
      unitId: null,
      unitSinceTick: null,
      schoolId: null,
      schoolStartsAtTick: null,
      fitnessScore: 0,
      fitnessTestedAtTick: null,
      priorSpecialtyIds: [],
      specialtyChangedAtTick: null,
    })

    expect(isVeteran(world, person.id)).toBe(true)
    expect(veteranUnlocks(world, person.id)).toContain('machinist')

    // Run years: the veteran may be hired into a trade occupation their
    // schooling alone would never reach. Assert no crash and, when hired into
    // one, that it is from the unlocked set or normally eligible.
    advanceTicks(world, 120)
    const job = world.employment.get(person.id)
    if (job) {
      // THE CLAIM, READ FROM THE RULES rather than from a list.
      //
      // This used to name seven occupations by hand, which made it a test of
      // the catalogue: it broke the moment M-CAREER added no-schooling jobs
      // the list had never heard of (a nurse's aide), and again when a rung
      // above one became reachable by promotion. What it is actually about
      // is that a veteran holds a job their schooling or their unlocks
      // ALLOW — so it asks the same two functions the hiring path asks.
      const level = world.education.get(person.id)?.level ?? 'none'
      const unlocks = veteranUnlocks(world, person.id)
      const reachable = (id: string): boolean =>
        meetsRequirement(level, occupationById(id).requires) || unlocks.includes(id)
      const place = placeOf(job.occupationId)
      const climbedTo =
        place !== undefined && place.track.rungs.some((rung) => reachable(rung.occupationId))
      expect(
        reachable(job.occupationId) || climbedTo,
        `unreachable job: ${job.occupationId}`,
      ).toBe(true)
    }
  })
})

describe('the player in uniform', () => {
  function playAnEighteenYearOld(world: World) {
    const teen = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) < 18)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (!teen) throw new Error('no teenager')
    setPlayer(world, teen.id)
    return teen
  }

  it('the fork at eighteen offers the uniform, and the specialty follows', () => {
    const world = createWorld(makeSeed(12345), 100)
    const teen = playAnEighteenYearOld(world)

    // Advance to the education question.
    for (let i = 0; i < 200 && !awaitingPlayer(world); i++) advanceTick(world)
    expect(world.player.pending?.kind).toBe('education')
    expect(world.player.pending?.options).toContain('enlist')

    resolvePending(world, 'enlist')
    // The follow-up question is immediate: which uniform.
    expect(world.player.pending?.kind).toBe('specialty')
    const options = world.player.pending?.options ?? []
    expect(options.length).toBeGreaterThan(0)

    resolvePending(world, options[0] ?? 'rifleman')
    expect(isServing(world, teen.id)).toBe(true)
    expect(world.employment.has(teen.id)).toBe(false)

    // The enlistment is Defining and owned: their own choice, on the record.
    const record = world.causalRecords.find(
      (r) => r.subjectId === teen.id && r.decision === 'enlistment',
    )
    expect(record?.significance).toBe('defining')
    expect(record?.inputs.some((f) => f.factor === 'own-choice')).toBe(true)
  })

  it('the term ends in a real question, and leaving makes a veteran', () => {
    const world = createWorld(makeSeed(12345), 100)
    const teen = playAnEighteenYearOld(world)

    for (let i = 0; i < 200 && !awaitingPlayer(world); i++) advanceTick(world)
    resolvePending(world, 'enlist')
    resolvePending(world, world.player.pending?.options[0] ?? 'rifleman')
    expect(isServing(world, teen.id)).toBe(true)

    // Serve out the term, answering anything else with its safest option.
    let guard = 0
    while (guard < 2_000) {
      guard++
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        if (pending.kind === 'reenlist') break
        resolvePending(world, pending.options[pending.options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
    expect(world.player.pending?.kind).toBe('reenlist')

    // The window's answers are 'reenlist' or 'separate' now — the contract
    // flow replaced stay/leave.
    resolvePending(world, 'separate')
    expect(isServing(world, teen.id)).toBe(false)
    expect(isVeteran(world, teen.id)).toBe(true)

    const record = world.service.get(teen.id)
    expect(record?.dischargeReason).toBe('end of term')
  })
})
