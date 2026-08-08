/**
 * Careers overhaul, Fixes 1 and 2 — you climb a ladder, you are not
 * handed the top of one.
 *
 * The owner's complaint: "offered doctor at $200k leaving the army".
 * Hiring filtered occupations by SCHOOLING ALONE, so anything a person's
 * education qualified them for could be handed over — including the top
 * of a ladder they had never set foot on.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { isEntryWork, meritedRung, placeOf, promotionBar } from '../src/careers.js'
import { livingPeople } from '../src/systems.js'
import { OCCUPATIONS } from '../src/content.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 60 * 12)

describe('where a career can start', () => {
  it('calls work with no ladder entry, and a ladder entry only at its bottom', () => {
    expect(isEntryWork('labourer')).toBe(true) // on no ladder at all
    expect(isEntryWork('apprentice')).toBe(true) // rung 0 of the trades
    expect(isEntryWork('contractor')).toBe(false) // the top of them
    expect(isEntryWork('chief-of-medicine')).toBe(false)
    expect(isEntryWork('police-chief')).toBe(false)
  })

  it('lets a record merit one step, never a leap', () => {
    // A senior associate taking a manager's job at a rival firm is real
    // and is not a gift. Being handed chief of medicine is.
    const place = placeOf('sergeant')
    expect(place).toBeDefined()
    if (place === undefined) return
    // Poor reviews: they merit where they stand and no further.
    expect(meritedRung('sergeant', 100)).toBe(place.rung)
    // Strong reviews: one above, and only one.
    expect(meritedRung('sergeant', 1000)).toBe(place.rung + 1)
  })
})

describe('the ladders are climbed, not gifted', () => {
  it('never puts somebody at the top of a ladder without the rungs below', () => {
    // MEASURED before the fix: 20 chiefs of police in a town of 400, and
    // 114 people sitting at rung 2 or above — nearly all of them hired
    // straight in. The number that matters is not how many are senior but
    // how they got there.
    // THE CLAIM IS ABOUT THE FIRST JOB, not about how somebody got senior.
    //
    // The first version of this asserted that anybody at rung 2+ must
    // have a promotion on the record, and a police chief failed it —
    // legitimately. Moving employer into a rung your own reviews already
    // merit is a real thing and the spec sanctions it explicitly
    // ("applying elsewhere at a rung your experience already merits"), so
    // a career can climb by changing firms rather than by waiting.
    //
    // What the entry-rung rule actually promises is narrower and is the
    // whole of the bug: NOBODY IS HIRED INTO THE MIDDLE OF A LADDER OFF
    // THE STREET. Their first job in the world has to be a bottom rung.
    const firstJob = new Map<number, string>()
    for (const event of world.events) {
      if (event.type !== 'hired' || event.detail === null) continue
      if (!firstJob.has(event.subjectId)) firstJob.set(event.subjectId, event.detail)
    }
    expect(firstJob.size).toBeGreaterThan(20)
    for (const [personId, title] of firstJob) {
      // The event carries the TITLE; map it back to the occupation.
      const occupation = OCCUPATIONS.find((o) => o.title === title)
      if (occupation === undefined) continue
      expect(
        isEntryWork(occupation.id),
        `person ${String(personId)} started their working life as ${title}`,
      ).toBe(true)
    }
  })

  it('keeps the top of a ladder rare', () => {
    // Twenty police chiefs was the tell that the ladder meant nothing.
    let chiefs = 0
    for (const job of world.employment.values()) {
      const person = world.people.get(job.personId)
      if (person === undefined || person.deathTick !== null) continue
      if (job.occupationId === 'police-chief') chiefs += 1
    }
    expect(chiefs).toBeLessThan(14)
  })
})

describe('performance is caused, and the ladder is climbable', () => {
  it('lets an ordinary career reach the middle of a ladder', () => {
    // MEASURED, and it is why this fix exists: performance drifted toward
    // DILIGENCE ALONE, so the median settled at 497 against a median rung
    // asking 660. Sixty-two per cent of everybody on a ladder was stuck
    // on the reviews gate permanently, by arithmetic — the town had no
    // contractors, no chief of medicine and no partners, and the roles
    // had only ever been filled by hiring strangers into them.
    const perfs: number[] = []
    for (const job of world.employment.values()) {
      const person = world.people.get(job.personId)
      if (person === undefined || person.deathTick !== null) continue
      if (placeOf(job.occupationId) === undefined) continue
      perfs.push(job.performance)
    }
    expect(perfs.length).toBeGreaterThan(20)
    const median = [...perfs].sort((a, b) => a - b)[Math.floor(perfs.length / 2)] ?? 0
    // Near the bar rather than far below it: a typical worker should be
    // nearly promotable and a good one should clear it.
    expect(median).toBeGreaterThan(560)
  })

  it('rewards time in the trade, not just the trait somebody was born with', () => {
    // Two people with the same diligence should not have identical
    // careers when one has done the job for fifteen years (Law 10:
    // unequal, but caused).
    const veterans = [...world.employment.values()].filter(
      (job) => world.tick - job.startedAtTick > 12 * 12,
    )
    const rookies = [...world.employment.values()].filter(
      (job) => world.tick - job.startedAtTick < 3 * 12,
    )
    expect(veterans.length).toBeGreaterThan(0)
    expect(rookies.length).toBeGreaterThan(0)
    const mean = (a: readonly { performance: number }[]): number =>
      a.reduce((sum, job) => sum + job.performance, 0) / a.length
    expect(mean(veterans)).toBeGreaterThan(mean(rookies))
  })

  it('still leaves people stuck, because a bar nobody fails is not a bar', () => {
    let blocked = 0
    for (const job of world.employment.values()) {
      const place = placeOf(job.occupationId)
      if (place === undefined) continue
      const months = world.tick - job.rungSinceTick
      if (promotionBar(place.track, place.rung, job.performance, months) !== null) blocked += 1
    }
    expect(blocked).toBeGreaterThan(0)
  })
})

describe('the town stops handing the player work', () => {
  it('raises no unsolicited job offer', () => {
    // The player applies from the job board and sits the interview that
    // already existed. NPCs are unaffected — the town keeps staffing
    // itself, it simply stops staffing the player.
    const world2 = createWorld(makeSeed(909), 300)
    const someone = livingPeople(world2).find((p) => p.deathTick === null)
    expect(someone).toBeDefined()
    if (someone === undefined) return
    world2.player.personId = someone.id
    advanceTicks(world2, 40 * 12)
    const offers = world2.player.log.filter((entry) => entry.kind === 'job-offer')
    expect(offers).toHaveLength(0)
  })
})
