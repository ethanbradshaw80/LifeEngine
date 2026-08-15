/**
 * WHAT A PERSON IS GOOD AT (owner's `JOBS_CAREERS.md`).
 *
 * THE CLAIMS: a skill is what the work left behind, it grows from doing the
 * job and nothing else, mastery takes a career rather than a year, the gates
 * the owner's tables write are the gates that are actually enforced, and the
 * whole thing is integer arithmetic that cannot drift over eighty years.
 */

import { describe, expect, it } from 'vitest'
import {
  SKILLS,
  SKILL_LEVEL,
  SKILL_MAX,
  afterAMonth,
  earnedThisMonth,
  gatesFailed,
  heldSkills,
  levelOf,
  meetsGates,
  skillById,
  standingOf,
} from '../src/skills.js'
import type { SkillSheet } from '../src/skills.js'

/** Months of one job before a skill reaches a level, at a given rate. */
function monthsToLevel(perMonth: number, level: number): number {
  let sheet: SkillSheet = {}
  for (let month = 1; month <= 2000; month += 1) {
    sheet = afterAMonth(sheet, [{ skill: 'leadership', perMonth }])
    if (levelOf(sheet, 'leadership') >= level) return month
  }
  return -1
}

describe('the eighteen', () => {
  it('are the ones the owner’s tables actually name', () => {
    // Taken from the spec's gates and growth lines. Not from job titles —
    // reading those as skills would have invented five the spec never asks
    // for ("Operations Director" is a job, not a competency).
    expect(SKILLS).toHaveLength(18)
    expect(skillById('leadership')).toBeDefined()
    expect(skillById('business-management')).toBeDefined()
    expect(skillById('medical-knowledge')).toBeDefined()
    // And nothing invented from a title.
    expect(skillById('operations')).toBeUndefined()
    expect(skillById('security')).toBeUndefined()
  })

  it('each say what having them means', () => {
    for (const skill of SKILLS) {
      expect(skill.label.length, `${skill.id} has no label`).toBeGreaterThan(2)
      expect(skill.blurb.length, `${skill.id} has no blurb`).toBeGreaterThan(15)
    }
  })
})

describe('a skill is what the work left behind', () => {
  it('grows only from doing the job', () => {
    const fresh: SkillSheet = {}
    // A month of nothing teaches nothing.
    expect(afterAMonth(fresh, [])).toBe(fresh)
    // A month of the work teaches its own skill and no other.
    const after = afterAMonth(fresh, [{ skill: 'welding' as never, perMonth: 0 }])
    expect(levelOf(after, 'leadership')).toBe(0)

    const led = afterAMonth(fresh, [{ skill: 'leadership', perMonth: 500 }])
    expect(led.leadership).toBe(500)
    expect(led.programming ?? 0).toBe(0)
  })

  it('takes a career to master, not ten months', () => {
    /**
     * THE TUNING THAT HAD TO HAPPEN, AND WHY.
     *
     * The spec's raw rates (0.5 to 1.2 levels a month) reach the ceiling in
     * four to ten months. Every skill gate in all seventy-five paths would
     * then be a formality, and the experience requirement would be the only
     * thing doing any work — which makes eighteen skills an elaborate way of
     * writing one number.
     *
     * Growth slows as it climbs, so the fifth level really is somebody who
     * stayed. Measured here rather than asserted in a comment.
     */
    const first = monthsToLevel(500, 1)
    const third = monthsToLevel(500, 3)
    const mastery = monthsToLevel(500, 5)
    expect(first).toBeGreaterThan(0)
    // Competent inside a couple of years at a middling rate...
    expect(third).toBeGreaterThan(first * 2)
    // ...and mastery is a decade of it, not a year.
    expect(mastery).toBeGreaterThan(60)
    expect(mastery).toBeLessThan(400)
  })

  it('slows down the higher it gets', () => {
    // The same month of work is worth less to a master than to a novice.
    expect(earnedThisMonth(0, 500)).toBe(500)
    expect(earnedThisMonth(2 * SKILL_LEVEL, 500)).toBeLessThan(500)
    expect(earnedThisMonth(4 * SKILL_LEVEL, 500)).toBeLessThan(
      earnedThisMonth(2 * SKILL_LEVEL, 500),
    )
    // But it never stops entirely — a rate that rounds to nothing still moves.
    expect(earnedThisMonth(4 * SKILL_LEVEL, 1)).toBeGreaterThan(0)
  })

  it('stops at the ceiling and stays there', () => {
    let sheet: SkillSheet = { leadership: SKILL_MAX - 1 }
    for (let i = 0; i < 50; i += 1) {
      sheet = afterAMonth(sheet, [{ skill: 'leadership', perMonth: 1200 }])
    }
    expect(sheet.leadership).toBe(SKILL_MAX)
    expect(levelOf(sheet, 'leadership')).toBe(5)
  })

  it('never mutates the sheet it was given', () => {
    const before: SkillSheet = { leadership: 1000 }
    const after = afterAMonth(before, [{ skill: 'leadership', perMonth: 500 }])
    expect(before.leadership).toBe(1000)
    expect(after.leadership).toBeGreaterThan(1000)
  })
})

describe('the gates the tables write', () => {
  it('are the gates that are enforced', () => {
    // "Leadership (4), Business Management (3)" — straight off the owner's
    // Store Manager row.
    const gates = [
      { skill: 'leadership' as const, level: 4 },
      { skill: 'business-management' as const, level: 3 },
    ]
    const shy: SkillSheet = { leadership: 3999, 'business-management': 3000 }
    expect(meetsGates(shy, gates)).toBe(false)
    // And it says WHICH one is short, so a screen can show the requirement.
    const failed = gatesFailed(shy, gates)
    expect(failed).toHaveLength(1)
    expect(failed[0]?.skill).toBe('leadership')

    const ready: SkillSheet = { leadership: 4000, 'business-management': 3200 }
    expect(meetsGates(ready, gates)).toBe(true)
    expect(gatesFailed(ready, gates)).toHaveLength(0)
  })

  it('treats a whole level as the unit, exactly as the spec writes it', () => {
    // 3.9 is not 4. The tables say "(4)" and mean it.
    expect(levelOf({ leadership: 3999 }, 'leadership')).toBe(3)
    expect(levelOf({ leadership: 4000 }, 'leadership')).toBe(4)
  })

  it('lets anybody through a job that asks for nothing', () => {
    expect(meetsGates(undefined, [])).toBe(true)
    expect(meetsGates({}, [])).toBe(true)
  })
})

describe('reading them on a screen', () => {
  it('gives a level a word', () => {
    expect(standingOf(0)).toBe('none')
    expect(standingOf(1)).toBe('novice')
    expect(standingOf(3)).toBe('capable')
    expect(standingOf(5)).toBe('expert')
  })

  it('shows what somebody has, best first, and never eighteen zeroes', () => {
    const sheet: SkillSheet = { leadership: 2400, sales: 4200, programming: 0 }
    const held = heldSkills(sheet)
    expect(held).toHaveLength(2)
    expect(held[0]?.skill.id).toBe('sales')
    expect(held[0]?.level).toBe(4)
    expect(held[1]?.skill.id).toBe('leadership')
    // Somebody who has never worked shows nothing rather than a wall of none.
    expect(heldSkills(undefined)).toHaveLength(0)
    expect(heldSkills({})).toHaveLength(0)
  })
})
