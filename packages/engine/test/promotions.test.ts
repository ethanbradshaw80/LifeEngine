/**
 * M-PROMO — the three promotion systems, the billets, and the shape they
 * make together. From the owner's `army_promotions_fix.md` and
 * `promotions_all_branches.md`.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { BRANCH_BILLETS, BRANCH_GRADES, BRANCH_RANKS, COMPETITIVE_FROM } from '../src/content.js'
import { isSeniorBand } from '../src/service.js'

describe('the three systems, by band', () => {
  it('competes for nothing below the first NCO rung in the land forces', () => {
    // The headline correction: "No board for Specialist/Corporal (E-4)."
    // COMPETITIVE_FROM sat at 4 — corporal — so making E-4 meant clearing a
    // promotion-points cutoff, which is a board in all but name.
    const ladder = BRANCH_RANKS['land-forces']
    const grades = BRANCH_GRADES['land-forces']
    const first = COMPETITIVE_FROM['land-forces']
    expect(ladder[first]).toBe('SGT')
    expect(grades[first]).toBe(5)
    // And everything below it is E-4 or lower.
    for (let rank = 0; rank < first; rank++) {
      expect(grades[rank], `${ladder[rank] ?? '?'} should not be competed for`).toBeLessThanOrEqual(4)
    }
  })

  it('puts the navy and the air force on their own schedules', () => {
    // The branches genuinely differ, which is the point of the doc: the
    // navy's E-4 IS won on an advancement exam; the air force's is not.
    expect(BRANCH_GRADES['naval-service'][COMPETITIVE_FROM['naval-service']]).toBe(4)
    expect(BRANCH_GRADES['air-guard'][COMPETITIVE_FROM['air-guard']]).toBe(5)
  })

  it('hands the senior grades to a board, not to a cutoff', () => {
    expect(isSeniorBand(6)).toBe(false)
    expect(isSeniorBand(7)).toBe(true)
    expect(isSeniorBand(9)).toBe(true)
  })
})

describe('the ladders reach the top', () => {
  it('runs every branch to E-9', () => {
    for (const branch of ['land-forces', 'naval-service', 'air-guard'] as const) {
      const grades = BRANCH_GRADES[branch]
      expect(grades[grades.length - 1], `${branch} stops short`).toBe(9)
      expect(BRANCH_RANKS[branch].length).toBe(grades.length)
    }
  })

  it('names a billet at the grades that carry one', () => {
    // 1SG and CSM are POSITIONS at E-8/E-9, not missing pay grades — the
    // spec is emphatic, and modelling them as ranks would have been the
    // wrong fix.
    expect(BRANCH_BILLETS['land-forces'][8]?.abbr).toBe('1SG')
    expect(BRANCH_BILLETS['land-forces'][9]?.abbr).toBe('CSM')
    expect(BRANCH_BILLETS['naval-service'][9]?.abbr).toBe('CMC')
    for (const branch of ['land-forces', 'naval-service', 'air-guard'] as const) {
      for (const key of Object.keys(BRANCH_BILLETS[branch])) {
        // A billet must sit ON a grade the ladder actually has.
        expect(BRANCH_GRADES[branch]).toContain(Number(key))
      }
    }
  })
})

describe('the force has a shape', () => {
  it('makes a pyramid rather than an army of chiefs', () => {
    // MEASURED. With the PME gate in and the selection board still absent,
    // seventeen of thirty-three serving sat at E-7 or above — an army with
    // no privates in it. The fixed number of seats is what makes a ladder a
    // pyramid, and this is the assertion that holds it.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    const byGrade = new Map<number, number>()
    let serving = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null || record.commissioned === true) continue
      serving++
      const grade = BRANCH_GRADES[record.branch as 'land-forces'][record.rank] ?? 0
      byGrade.set(grade, (byGrade.get(grade) ?? 0) + 1)
    }
    expect(serving, 'no army at all').toBeGreaterThan(5)
    const junior = (byGrade.get(3) ?? 0) + (byGrade.get(4) ?? 0)
    const senior = (byGrade.get(7) ?? 0) + (byGrade.get(8) ?? 0) + (byGrade.get(9) ?? 0)
    expect(junior, 'more chiefs than indians').toBeGreaterThan(senior)
  }, 300_000)

  // WHAT IS NOT ASSERTED HERE, AND WHY. That the E-8/E-9 rungs and the
  // leadership billets are reachable at all was verified by measurement, in
  // a town of 2,500 over forty years:
  //
  //   161 serving | E1:10 E2:11 E3:37 E4:38 E5:15 E6:25 E7:16 E8:7 E9:2
  //   billets: 1SG, 1SG, CCM, First Sergeant
  //
  // That run costs more than ten minutes, which is more than the whole
  // suite, so it is not in it. A four-hundred-person town fields about
  // twenty soldiers and rates neither a sergeant major nor a command
  // billet — correctly, since the seats are a fraction of the force.
})
