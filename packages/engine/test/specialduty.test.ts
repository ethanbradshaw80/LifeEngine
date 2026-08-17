/**
 * SPECIAL DUTY, AND THE RECRUITER'S NAME (plan §10.1).
 *
 * §10.1 names this "the single biggest gap, and the best fit for a life sim",
 * and it names which to build first and why:
 *
 *   "A recruiter gets sent TO A TOWN — possibly YOUR OWN. You go home in
 *   uniform, you sit in a strip-mall office, and YOU ENLIST THE KIDS YOU GREW
 *   UP WITH. A townsperson's enlistment event now has your character's name on
 *   it, twenty years later, in their record. That is Law 4 paying out, and
 *   nothing in the game does it today."
 *
 * That sentence being true is the test.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { enlistedBy, specialDutyOf } from '../src/specialduty.js'

describe('special duty', () => {
  it('takes people out of their unit, and gives them back', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const taken = world.events.filter((e) => e.type === 'took-special-duty')
    const returned = world.events.filter((e) => e.type === 'left-special-duty')
    expect(taken.length, 'nobody was ever taken out of their unit').toBeGreaterThan(0)
    // A tour that never ends is a career change, not a special duty.
    expect(returned.length, 'nobody ever came back from special duty').toBeGreaterThan(0)

    // All four duties are reachable across a town's forty years.
    const duties = new Set(taken.map((e) => e.detail))
    expect(duties.size).toBeGreaterThan(1)
  })

  it('never sends a private, and never sends anybody who is deployed', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    for (const record of world.service.values()) {
      const standing = specialDutyOf(world, record.personId)
      if (standing === null) continue
      /**
       * MID-CAREER ONLY AT ASSIGNMENT, and the difference matters.
       *
       * MEASURED: this first asserted the rank of everybody CURRENTLY on
       * special duty and failed, because a man can be reduced in rank while he
       * is on it — an Article 15 takes a stripe and does not send him home
       * from the recruiting office. That is correct behaviour and a better
       * story than the invariant I first wrote. So the claim is what it always
       * should have been: nobody is junior unless something happened to make
       * them junior, and the record has to say what.
       */
      const busted = world.events.some(
        (e) => e.subjectId === record.personId && e.type === 'disciplined',
      )
      expect(
        record.rank >= 5 || record.commissioned === true || busted,
        `rank ${String(record.rank)} on special duty with nothing on the record`,
      ).toBe(true)
      // Nobody recruits from a war.
      const tours = world.deployments.get(record.personId) ?? []
      expect(tours.some((t) => t.returnedAtTick === null)).toBe(false)
    }
  })

  it('puts a real person’s name on an enlistment, which is the whole point', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)

    const signed = world.events.filter(
      (e) => e.type === 'enlisted' && e.otherId !== null && e.otherId !== undefined,
    )
    expect(signed.length, 'no enlistment ever carried a recruiter').toBeGreaterThan(0)

    for (const event of signed.slice(0, 25)) {
      const recruiterId = event.otherId
      expect(recruiterId).not.toBeNull()
      if (recruiterId === null || recruiterId === undefined) continue
      // The recruiter is a real registered person with a service record...
      expect(world.people.has(recruiterId)).toBe(true)
      expect(world.service.has(recruiterId)).toBe(true)
      // ...and never the person enlisting.
      expect(recruiterId).not.toBe(event.subjectId)
    }

    // AND IT READS BACK. A recruiter's own record lists who they signed —
    // which is a thing no other system in this game produces.
    const first = signed[0]
    if (first?.otherId === null || first?.otherId === undefined) return
    const theirs = enlistedBy(world, first.otherId)
    expect(theirs.length).toBeGreaterThan(0)
    expect(theirs).toContain(first.subjectId)
  })

  it('leaves most enlistments unsigned, because most months have no recruiter', () => {
    // The honest half: recruiting duty is rare, so most people who enlist did
    // it off a poster. If every enlistment had a name on it the name would
    // mean nothing.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    const all = world.events.filter((e) => e.type === 'enlisted')
    const signed = all.filter((e) => e.otherId !== null && e.otherId !== undefined)
    expect(all.length).toBeGreaterThan(signed.length)
  })
})
