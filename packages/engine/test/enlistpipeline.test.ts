/**
 * M-ENLIST acceptance (§7). The recruiting station, end to end.
 *
 * Four claims the whole rework rests on:
 *   the test is replayable, so an eligible-job list is replayable;
 *   a locked job SAYS WHY, in the same words the greyed row uses;
 *   the pipeline reaches a real record on both roads, enlisted and officer;
 *   and the scene pool a person meets follows the job they actually hold.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { createWorld } from '../src/index.js'
import { requestEnlistment, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import { OFFICER_ROLES, SPECIALTIES } from '../src/content.js'
import {
  aptitudeWords,
  assignOfficerRole,
  eligibleJobs,
  entryTestScore,
  jobsOfBranch,
  mosBar,
  officerRolesOf,
  sceneTagsFor,
} from '../src/enlistment.js'
import type { Person, World } from '../src/types.js'
import { signUp, walkToSpecialty } from './enlisthelper.js'

function anAdult(world: World): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 22 && age <= 30
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  return person
}

function aWalkIn(seed: number, degree: boolean): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seed), 100)
  const person = anAdult(world)
  setPlayer(world, person.id)
  world.employment.delete(person.id)
  world.education.set(person.id, {
    personId: person.id,
    level: degree ? 'college' : 'secondary',
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: 600,
  })
  return { world, personId: person.id }
}

describe('the entry test', () => {
  it('is the same score every time the same world asks', () => {
    // Law 11. If this drifted, the job list would differ between the screen
    // that showed it and the resolve that acted on it.
    const { world, personId } = aWalkIn(4141, false)
    const first = entryTestScore(world, personId)
    for (let i = 0; i < 20; i++) {
      expect(entryTestScore(world, personId)).toBe(first)
    }
    // And the same seed in a fresh world agrees.
    const again = aWalkIn(4141, false)
    expect(entryTestScore(again.world, again.personId)).toBe(first)
  })

  it('spreads across the range, and a degree moves it up', () => {
    const scores: number[] = []
    const graduates: number[] = []
    for (let seed = 1; seed <= 40; seed++) {
      const plain = aWalkIn(seed, false)
      scores.push(entryTestScore(plain.world, plain.personId))
      const grad = aWalkIn(seed, true)
      graduates.push(entryTestScore(grad.world, grad.personId))
    }
    // The bands overlap on purpose — a sharp school leaver out-tests a dull
    // graduate — but the schooling has to move the average or the degree is
    // decoration.
    expect(Math.min(...scores)).toBeLessThan(60)
    expect(Math.max(...scores)).toBeGreaterThan(55)
    const meanPlain = scores.reduce((a, b) => a + b, 0) / scores.length
    const meanGrad = graduates.reduce((a, b) => a + b, 0) / graduates.length
    expect(meanGrad).toBeGreaterThan(meanPlain)
  })

  it('says what the score opens, at every band', () => {
    const said = new Set<string>()
    for (let score = 1; score <= 99; score++) said.add(aptitudeWords(score))
    // Six bands, six sentences — a band with no words of its own would
    // silently read as the band below it.
    expect(said.size).toBe(6)
    for (const words of said) expect(words.length).toBeGreaterThan(10)
  })
})

describe('a locked job says why', () => {
  it('names the score it wanted and the score they got', () => {
    const hard = SPECIALTIES.find((sp) => (sp.minAptitude ?? 0) >= 70)
    if (!hard) throw new Error('no gated trade left in the catalogue')
    const bar = mosBar(hard, 40, 'college')
    expect(bar).toContain(String(hard.minAptitude))
    expect(bar).toContain('40')
  })

  it('names the schooling when that is the thing missing', () => {
    const degreeJob = SPECIALTIES.find((sp) => sp.requires === 'college')
    if (!degreeJob) throw new Error('no degree trade left in the catalogue')
    // Score high enough that only the schooling can be the reason.
    expect(mosBar(degreeJob, 99, 'secondary')).toBe('Needs a degree.')
    expect(mosBar(degreeJob, 99, 'college')).toBeNull()
  })

  it('opens exactly the jobs the bar does not shut, and no others', () => {
    // The list and the refusal are one function or they can disagree, which
    // is the bug this pattern exists to prevent.
    for (const branchId of ['land-forces', 'naval-service', 'air-guard']) {
      for (const score of [20, 45, 65, 85, 95]) {
        const open = eligibleJobs(SPECIALTIES, branchId, score, 'secondary')
        for (const job of jobsOfBranch(SPECIALTIES, branchId)) {
          const shut = mosBar(job, score, 'secondary') !== null
          expect(open.includes(job), `${job.id} at ${String(score)}`).toBe(!shut)
        }
      }
    }
  })

  it('leaves somebody with a low score a service that will take them', () => {
    // Law 7 in miniature: a bad test is a narrower service, not a closed
    // door. The branches are NOT all equally open at the bottom — the air
    // service starts at 40 and the ground service at 31, which is true to
    // life — so the claim is that SOMETHING is open, and the branch menu
    // (see branchesOpenTo) is what stops the shut ones being offered.
    const anywhere = ['land-forces', 'naval-service', 'air-guard'].flatMap((branchId) =>
      eligibleJobs(SPECIALTIES, branchId, 31, 'none'),
    )
    expect(anywhere.length).toBeGreaterThan(0)
    // And the branch that shut is honestly shut, not silently empty.
    expect(eligibleJobs(SPECIALTIES, 'air-guard', 31, 'none').length).toBe(0)
  })
})

describe('the station reaches a record', () => {
  it('signs an enlisted walk-in onto a real trade', () => {
    const { world, personId } = aWalkIn(4141, false)
    requestEnlistment(world)
    signUp(world)

    const record = world.service.get(personId)
    expect(record).toBeDefined()
    expect(record?.commissioned).toBe(false)
    expect(record?.track).toBe('enlisted')
    // The trade they were given is one their own score opens.
    const specialty = SPECIALTIES.find((sp) => sp.id === record?.specialtyId)
    expect(specialty).toBeDefined()
    if (specialty) expect(mosBar(specialty, record?.aptitude ?? 0, 'secondary')).toBeNull()
  })

  it('commissions a graduate into a role, with the trade under it', () => {
    const { world, personId } = aWalkIn(4141, true)
    requestEnlistment(world)
    signUp(world, { path: 'officer' })

    const record = world.service.get(personId)
    expect(record?.commissioned).toBe(true)
    expect(record?.track).toBe('officer')
    expect(record?.officerRoleId).toBeDefined()
    // The role is one this branch actually has.
    const role = OFFICER_ROLES.find((r) => r.id === record?.officerRoleId)
    expect(role).toBeDefined()
    if (role && record) {
      expect(officerRolesOf(OFFICER_ROLES, record.branch).includes(role)).toBe(true)
    }
    // And there is still a trade underneath, because everything already
    // built on the specialty has to keep working.
    expect(SPECIALTIES.some((sp) => sp.id === record?.specialtyId)).toBe(true)
  })

  it('asks the branch before the test, and the test before the trade', () => {
    const { world } = aWalkIn(4141, false)
    requestEnlistment(world)
    // The order is the point: you cannot be told what a score opens before
    // you have one, and a score means nothing until a service is chosen.
    expect(world.player.pending?.kind).toBe('branch-choice')
    expect(walkToSpecialty(world)).toBe('specialty')
  })

  it('gives the same person the same walk on a replay', () => {
    const first = aWalkIn(9001, true)
    requestEnlistment(first.world)
    signUp(first.world, { path: 'officer' })

    const second = aWalkIn(9001, true)
    requestEnlistment(second.world)
    signUp(second.world, { path: 'officer' })

    expect(JSON.stringify(second.world.service.get(second.personId))).toBe(
      JSON.stringify(first.world.service.get(first.personId)),
    )
  })
})

describe('the officer assignment', () => {
  it('honours a first choice when the candidate is good enough for it', () => {
    const { world, personId } = aWalkIn(4141, true)
    const branch = world.spec.branches.find((b) => b.id === 'land-forces')
    if (!branch) throw new Error('no ground service')
    const roles = officerRolesOf(OFFICER_ROLES, 'land-forces')
    const easiest = roles.slice().sort((a, b) => (a.minAptitude ?? 0) - (b.minAptitude ?? 0))[0]
    if (!easiest) throw new Error('no officer roles')

    const assignment = assignOfficerRole(
      world,
      personId,
      branch,
      OFFICER_ROLES,
      [easiest.id, ...roles.filter((r) => r.id !== easiest.id).map((r) => r.id)],
      95,
    )
    expect(assignment.role?.id).toBe(easiest.id)
    expect(assignment.wasFirstChoice).toBe(true)
    // A granted first choice has nothing to explain. The reason exists for
    // the assignment they did NOT ask for.
    expect(assignment.reason).toBe('')
  })

  it('never assigns a role the candidate cannot hold', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { world, personId } = aWalkIn(seed, true)
      for (const branch of world.spec.branches) {
        const roles = officerRolesOf(OFFICER_ROLES, branch.id)
        if (roles.length === 0) continue
        const assignment = assignOfficerRole(
          world,
          personId,
          branch,
          OFFICER_ROLES,
          roles.map((r) => r.id),
          60,
        )
        if (assignment.role) {
          expect(assignment.role.minAptitude ?? 0).toBeLessThanOrEqual(60)
        }
      }
    }
  })
})

describe('scene pools', () => {
  it('prefer the officer role, then the trade, then the branch', () => {
    const world = createWorld(makeSeed(3), 100)
    const rifleman = SPECIALTIES.find((sp) => sp.id === 'rifleman')
    const branch = world.spec.branches.find((b) => b.id === 'naval-service')
    const role = OFFICER_ROLES.find((r) => r.sceneTags.length > 0)
    if (!rifleman || !branch || !role) throw new Error('the catalogue moved')

    // The role wins over the trade under it.
    expect(sceneTagsFor(rifleman, role, branch)).toEqual(role.sceneTags)
    // No role: the trade.
    expect(sceneTagsFor(rifleman, undefined, branch)).toEqual(rifleman.sceneTags)
    // Neither: the branch's own flavour, so nobody is ever tagless.
    const fallback = sceneTagsFor(undefined, undefined, branch)
    expect(fallback.length).toBeGreaterThan(0)
    expect(fallback.some((tag) => tag.startsWith('sea_'))).toBe(true)
  })
})
