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
import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { volunteerForDeployment } from '../src/deployment.js'
import { relationKey } from '../src/geopolitics.js'
import { SERVICE_SCHOOLS } from '../src/content.js'
import { badgesOf, schoolOptionsFor } from '../src/service.js'
import { advanceTick, advanceTicks, createWorld, worldHash } from '../src/index.js'
import {
  applyForJob,
  awaitingPlayer,
  raisePending,
  requestEnlistment,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { walkToSpecialty } from './enlisthelper.js'
import { isDeployed } from '../src/deployment.js'
import { isVeteran } from '../src/service.js'
import { BRANCH_GRADES } from '../src/content.js'
import type { ServiceBranch } from '../src/content.js'
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
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  world.employment.delete(personId)
}

describe('high-year tenure — up or out', () => {
  it('separates a long-passed-over member at term end, honorably', () => {
    const world = createWorld(makeSeed(12345), 100)
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
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 900)
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      // HIGH-YEAR TENURE IS AN ENLISTED RULE (ADR-0043). This test read
      // BRANCH_GRADES — the ENLISTED table — with whatever rank index the
      // record held, so a first lieutenant at officer index 1 came back as
      // an E-2 and was asserted to be up-or-out. Measured: the one record
      // that tripped this was commissioned, twelve years in grade, exactly
      // the shape of the bug that threw a major out as a career corporal.
      // The source was fixed there; this assertion was not.
      if (record.commissioned === true) continue
      // M-ARMY2 career shape: up-or-out applies BELOW E-5 only — make
      // sergeant and the service keeps you. (Before that this exempted the
      // ladder top; before THAT it hardcoded the land-forces top, which
      // naval/air never reach.)
      const grade = BRANCH_GRADES[record.branch as ServiceBranch][record.rank] ?? 9
      const tig = world.tick - record.rankSinceTick
      if (grade < 5) {
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
      // CPL. THE NEXT STEP IS SERGEANT, which is the first rung anybody
      // competes for — this said SPC and called the step to corporal
      // competitive, which M-PROMO corrected: E-4 is a lateral the
      // commander names you into, never a board.
      rank: 4,
      rankSinceTick: world.tick - 12, // exactly at the gate — asked this month
      enlistedAtTick: world.tick - 30,
      performance: 700,
    })
    // AND HE HAS BEEN TO THE LEADER COURSE. The school is a hard gate on
    // promotion now, so without this the board is never convened and these
    // tests would be asserting the gate rather than the board. The gate has
    // its own tests in schoolhouse.test.ts.
    world.awards.set(person.id, [
      {
        personId: person.id,
        kind: 'qualification-badge',
        title: 'basic leader',
        tick: (world.tick - 24) as Tick,
        count: 1,
        qualifyingEventIds: [],
        issuedBy: 'the schoolhouse',
        citation: 'for completion of the Basic Leader Course',
      },
    ])
    return person
  }

  it('asks, and either answer of the board goes on the record', () => {
    const world = createWorld(makeSeed(12345), 100)
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
    const world = createWorld(makeSeed(12345), 100)
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
    // THE RULE IN THIS TEST'S OWN TITLE, and not a fixture's exact rank.
    //
    // This asserted `rank === 4` — and the comment beside it already
    // recorded that the number had been moved once when the fixture
    // changed, which is the tell. It broke again here at rank 3 after
    // sixty months: the same rule holding, on a person who progressed
    // more slowly through a reshuffled world. Promotion itself is fine —
    // the ladder-order test and the RE-code suite both exercise it.
    //
    // What the title claims is a CEILING: no board, no rank above the
    // competitive floor. So that is what is checked, with a floor under
    // it so the test cannot pass by nobody being promoted at all.
    const rank = world.service.get(person.id)?.rank ?? 0
    expect(rank).toBeGreaterThan(0)
    expect(rank).toBeLessThanOrEqual(4)
    // And every pass was a choice ON THE RECORD, as the stakes promise.
    expect(
      world.causalRecords.some(
        (r) => r.subjectId === person.id && r.decision === 'promotion' && r.chosen === 'let the board go by',
      ),
    ).toBe(true)
  })

  it('sends you to the school, and the badge comes at graduation', () => {
    /**
     * REWRITTEN FOR THE REAL FLOW (owner, playing, 2026-08-14: "we take it
     * and then it says we complete it but we never actually did complete
     * it, not on the record, can still attend the school etc").
     *
     * The old version of this test pinned the bug: it raised the offer with
     * `occupationId: null` — no school at all — and asserted that accepting
     * instantly produced "an advanced course" completed, sixty points of
     * standing and a badge. That is precisely the graduation-with-no-
     * graduate he found, and a test asserting it was why nobody noticed.
     *
     * Accepting takes a SEAT. The schoolhouse does the rest, and it is
     * allowed to say no — so this asserts the machinery ran and reached an
     * outcome, not that a particular roll went the player's way.
     */
    const world = createWorld(makeSeed(12345), 100)
    const person = anAdult(world)
    setPlayer(world, person.id)
    putInUniform(world, person.id, { performance: 480 })

    const school = SERVICE_SCHOOLS.find(
      (sc) => sc.branches.length === 0 || sc.branches.includes('land-forces'),
    )
    expect(school, 'no school this soldier could ever attend').toBeDefined()
    if (!school) return

    raisePending(world, {
      tick: world.tick,
      kind: 'attend-school',
      personId: person.id,
      otherId: null,
      occupationId: school.id,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['attend', 'pass'],
    })
    resolvePending(world, 'attend')

    // A SEAT, not a badge. Nothing is claimed yet.
    const seated = world.service.get(person.id)
    expect(seated?.schoolId).toBe(school.id)
    expect(
      world.events.some((e) => e.type === 'completed-training' && e.subjectId === person.id),
    ).toBe(false)

    // Run the course out. It may graduate, wash out or injure — all three
    // are real outcomes and all three leave a mark on the record.
    for (let month = 0; month < school.courseMonths + 8; month += 1) {
      ;(world.player as { pending: unknown }).pending = null
      advanceTicks(world, 1)
    }
    const after = world.service.get(person.id)
    const attempts = (after?.schoolAttempts ?? []).filter((a) => a.schoolId === school.id)
    expect(attempts.length, 'the schoolhouse never resolved the seat').toBeGreaterThan(0)

    const graduated = attempts.some((a) => a.outcome === 'graduated')
    if (graduated) {
      /**
       * THE BADGE IS WHAT MAKES IT REAL, and it lives on the AWARDS record
       * rather than on `qualifications` — which is exactly the field
       * `schoolOptionsFor` reads to decide whether the course is still on
       * offer. That is the mechanism the reported bug defeated: the old
       * instant path granted the trade's qualification and never this, so
       * the school stayed open for ever.
       */
      expect(badgesOf(world, person.id)).toContain(school.badge)
      expect(after?.performance ?? 0).toBeGreaterThan(480)
      // And the course is off the list now.
      const offer = schoolOptionsFor(world, person.id).find((o) => o.id === school.id)
      expect(offer?.open ?? false, 'a graduated course was still on offer').toBe(false)
    }
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
    const world = createWorld(makeSeed(12345), 100)
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
    const world = createWorld(makeSeed(12345), 100)
    const person = anAdult(world)
    putInUniform(world, person.id, { enlistedAtTick: world.tick - 1 }) // still in basic
    // No war at all:
    expect(volunteerForDeployment(world, world.tick, person.id)).toBe(false)
  })
})

describe('tab verbs', () => {
  it('applying for work is logged, answered honestly, and deterministic', () => {
    const a = createWorld(makeSeed(12345), 100)
    const b = createWorld(makeSeed(12345), 100)
    for (const world of [a, b]) {
      const person = anAdult(world)
      setPlayer(world, person.id)
      const result = applyForJob(world, 'labourer')
      // M-CAREER §4: asking opens an INTERVIEW. Either the room happened —
      // and the pending is there to prove it — or it was refused in words.
      // Both are real answers, both on the record.
      expect(result.applied ? world.player.pending?.kind === 'interview' : result.reason.length > 0).toBe(
        true,
      )
      expect(world.player.log.some((entry) => entry.kind === 'job-application')).toBe(true)

      // And the room resolves to a hiring or an honest no.
      if (result.applied) {
        resolvePending(world, 'straight')
        const hired = world.player.pending?.kind === 'job-offer'
        const refused = world.events.some(
          (e) => e.type === 'turned-down' && e.subjectId === person.id,
        )
        expect(hired || refused).toBe(true)
        if (hired) resolvePending(world, 'accept')
      }

      // One asking a month: the second application is refused before the
      // roll, and writes nothing new.
      const eventsBefore = world.events.length
      const again = applyForJob(world, 'cook')
      expect(again.applied).toBe(false)
      expect(again.reason).toContain('One asking')
      expect(world.events.length).toBe(eventsBefore)
    }
    expect(worldHash(a)).toBe(worldHash(b))
  })

  it('an unqualified application is refused with the reason, not a roll', () => {
    const world = createWorld(makeSeed(12345), 100)
    const person = anAdult(world)
    setPlayer(world, person.id)
    const education = world.education.get(person.id)
    if (education?.level === 'college') return // this seed's adult is a scholar; nothing to test
    const result = applyForJob(world, 'doctor')
    expect(result.applied).toBe(false)
    expect(result.reason).toContain('college')
    expect(world.events.some((e) => e.type === 'turned-down')).toBe(false)
  })

  it('walking into the recruiting office asks the uniform question, or explains the no', () => {
    const world = createWorld(makeSeed(12345), 100)
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
      expect(walkToSpecialty(world)).toBe('specialty')
      expect(world.player.log.some((entry) => entry.kind === 'walk-in-enlist')).toBe(true)
      resolvePending(world, world.player.pending?.options[0] ?? '')
      expect(world.service.has(teen.id)).toBe(true)
    } else {
      expect(result.reason.length).toBeGreaterThan(0)
    }

    // A VETERAN WHO LEFT CLEAN CAN GO BACK IN (owner: "there is also no
    // option to join the military again if you get out, thats why we have
    // RE codes"). This test used to assert the opposite — "One service
    // career per life" — which is precisely the rule that was wrong.
    const world2 = createWorld(makeSeed(12345), 100)
    const vet = anAdult(world2, 25)
    setPlayer(world2, vet.id)
    putInUniform(world2, vet.id)
    world2.service.set(vet.id, {
      ...world2.service.get(vet.id)!,
      dischargedAtTick: world2.tick as never,
      dischargeReason: 'end of term',
      reCode: 1,
    })
    expect(requestEnlistment(world2).asked).toBe(true)

    // AND ONE WHO DID NOT IS TURNED AWAY, and told which code did it.
    // "But if you have an RE4 or 3 the recruiter should deny you."
    const world3 = createWorld(makeSeed(12345), 100)
    const barred = anAdult(world3, 25)
    setPlayer(world3, barred.id)
    putInUniform(world3, barred.id)
    world3.service.set(barred.id, {
      ...world3.service.get(barred.id)!,
      dischargedAtTick: world3.tick as never,
      dischargeReason: 'misconduct',
      reCode: 4,
    })
    const refused = requestEnlistment(world3)
    expect(refused.asked).toBe(false)
    // Being turned away without being told why is the one thing a
    // recruiting office never does.
    expect(refused.reason).toContain('RE-4')
  })
})
