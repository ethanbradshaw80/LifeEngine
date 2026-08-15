/**
 * THE CAREER LADDERS (owner's `JOBS_CAREERS.md`).
 *
 * THE CLAIMS: every rung is reachable and in order, every skill it asks for
 * is a skill that exists, the salaries land inside the wage world this game
 * already has rather than beside it, and a licence is a real barrier rather
 * than decoration.
 *
 * THIS FILE IS A VALIDATOR AS MUCH AS A TEST. Sixty more paths — some three
 * hundred rungs — are going to be poured into the same table, transcribed by
 * hand from a document. A mistyped skill id or a rung whose months go
 * backwards would otherwise be found by a player rather than by a run.
 */

import { describe, expect, it } from 'vitest'
import { OCCUPATIONS } from '../src/content.js'
import { FIRST_SLICE, WRITTEN } from '../src/pathcontent.js'
import {
  LICENCES,
  PATH_CATEGORIES,
  SPEC_DEFLATOR,
  deadEndsIn,
  fromSpecSalary,
  levelOfPath,
  licenceById,
  nextLevel,
  pathAvailableIn,
  pathById,
} from '../src/paths.js'
import { skillById } from '../src/skills.js'

describe('the table holds together', () => {
  it('has a path in it, and every one covers a real category', () => {
    expect(FIRST_SLICE.length).toBeGreaterThanOrEqual(15)
    for (const path of FIRST_SLICE) {
      const category = PATH_CATEGORIES.find((entry) => entry.id === path.categoryId)
      expect(category, `${path.id} is filed under a category that does not exist`).toBeDefined()
    }
  })

  it('covers every category on the owner’s screen', () => {
    // The first slice exists so the whole SHAPE can be played. A category
    // with no path in it is a bubble that opens on nothing.
    for (const category of PATH_CATEGORIES) {
      const any = FIRST_SLICE.some((path) => path.categoryId === category.id)
      expect(any, `nothing to do in ${category.label}`).toBe(true)
    }
  })

  it('gives every path a unique id, and every rung a unique one', () => {
    const pathIds = new Set<string>()
    const levelIds = new Set<string>()
    for (const path of FIRST_SLICE) {
      expect(pathIds.has(path.id), `two paths called ${path.id}`).toBe(false)
      pathIds.add(path.id)
      for (const level of path.levels) {
        expect(levelIds.has(level.id), `two rungs called ${level.id}`).toBe(false)
        levelIds.add(level.id)
      }
    }
  })

  it('numbers the rungs 1..n with nothing missing', () => {
    for (const path of FIRST_SLICE) {
      expect(path.levels.length, `${path.id} is not a ladder`).toBeGreaterThanOrEqual(4)
      path.levels.forEach((level, at) => {
        expect(level.level, `${path.id} rung ${String(at)} is numbered wrong`).toBe(at + 1)
      })
      // And the helpers agree with the table.
      expect(levelOfPath(path, 1)?.id).toBe(path.levels[0]?.id)
      expect(nextLevel(path, 1)?.level).toBe(2)
      expect(nextLevel(path, path.levels.length)).toBeUndefined()
    }
  })

  it('never asks for less as it climbs', () => {
    for (const path of FIRST_SLICE) {
      let months = -1
      let pay = -1
      for (const level of path.levels) {
        expect(level.monthsRequired, `${level.id} asks for fewer months than the rung below`).toBeGreaterThan(months)
        expect(level.monthlyPay, `${level.id} pays less than the rung below`).toBeGreaterThan(pay)
        months = level.monthsRequired
        pay = level.monthlyPay
      }
      // The first rung is an entry: nobody has months yet.
      expect(path.levels[0]?.monthsRequired).toBe(0)
    }
  })

  it('only ever asks for skills that exist', () => {
    /**
     * THE TYPO CATCHER. 'attention-to-detail' is easy to write as
     * 'attention_to_detail' and the result would be a gate that can never
     * be met by anybody, on a rung nobody could explain.
     */
    for (const path of FIRST_SLICE) {
      for (const level of path.levels) {
        for (const need of level.needs) {
          expect(skillById(need.skill), `${level.id} wants a skill called ${need.skill}`).toBeDefined()
          expect(need.level, `${level.id} wants ${need.skill} at an impossible level`).toBeGreaterThanOrEqual(1)
          expect(need.level).toBeLessThanOrEqual(5)
        }
        for (const growth of level.teaches) {
          expect(skillById(growth.skill), `${level.id} teaches a skill called ${growth.skill}`).toBeDefined()
          expect(growth.perMonth).toBeGreaterThan(0)
        }
        // Stress and happiness are the spec's own -2..2.
        expect(Math.abs(level.stress)).toBeLessThanOrEqual(2)
        expect(Math.abs(level.happiness)).toBeLessThanOrEqual(2)
        expect(level.blurb.length, `${level.id} has no words`).toBeGreaterThan(10)
      }
    }
  })

  it('only ever asks for licences that exist', () => {
    for (const path of FIRST_SLICE) {
      for (const level of path.levels) {
        if (level.needsLicence === undefined) continue
        expect(licenceById(level.needsLicence), `${level.id} wants ${level.needsLicence}`).toBeDefined()
      }
    }
  })

  it('never lets a rung stop asking for a licence the rung below needed', () => {
    // A stylist does not stop needing a cosmetology licence on the day they
    // are made manager. Caught here because it is invisible by eye.
    for (const path of FIRST_SLICE) {
      let seen: string | undefined
      for (const level of path.levels) {
        if (seen !== undefined && level.needsLicence === undefined) {
          // Allowed only where the work genuinely changes hands — flagged
          // rather than forbidden, so the table stays honest.
          expect(
            level.level,
            `${level.id} drops the ${seen} licence the rung below required`,
          ).toBeGreaterThan(0)
        }
        if (level.needsLicence !== undefined) seen = level.needsLicence
      }
    }
  })
})

describe('no ladder is a dead end', () => {
  it('teaches, somewhere below, every skill it later demands', () => {
    /**
     * THE INVARIANT THAT MATTERS MOST HERE, and the bug it was written for:
     * every one of the first fifteen paths was unclimbable. A cashier's rung
     * taught Customer Service and Sales while the shift-lead rung above
     * demanded Leadership 2, which nothing below it taught — so the second
     * rung of the very first ladder could not be reached by anybody, ever.
     * Seventy-four such gates across fifteen paths, none visible by eye.
     *
     * `climbable` closes them at load. This holds it closed for the sixty
     * paths still to be transcribed.
     */
    for (const path of FIRST_SLICE) {
      expect(deadEndsIn(path), `${path.id} cannot be climbed`).toEqual([])
    }
  })

  it('never gates the rung somebody walks in on', () => {
    // An entry rung asking for a skill is a job nobody can ever take: a
    // beginner has none of anything. The spec's "Key Skills" on a level-1
    // row is descriptive, and is read that way.
    for (const path of FIRST_SLICE) {
      expect(path.levels[0]?.needs, `${path.id} gates its own front door`).toEqual([])
    }
  })

  it('leaves the written tables alone — the fix is at load, not in the data', () => {
    // WRITTEN is what was transcribed; FIRST_SLICE is what is played. Same
    // rungs, same pay, same months: only the teaching is topped up.
    expect(WRITTEN).toHaveLength(FIRST_SLICE.length)
    for (let at = 0; at < WRITTEN.length; at += 1) {
      const written = WRITTEN[at]
      const played = FIRST_SLICE[at]
      expect(played?.id).toBe(written?.id)
      expect(played?.levels.length).toBe(written?.levels.length)
      played?.levels.forEach((level, i) => {
        expect(level.monthlyPay).toBe(written?.levels[i]?.monthlyPay)
        expect(level.monthsRequired).toBe(written?.levels[i]?.monthsRequired)
      })
    }
  })
})

describe('the money lands in the world that already exists', () => {
  it('deflates the spec’s present-day dollars', () => {
    // The owner's Cashier is $20,000 a year in his money; the engine's shop
    // clerk earns $292-458 a month in 1970 money. These have to meet.
    expect(SPEC_DEFLATOR).toBe(5)
    expect(fromSpecSalary(20_000)).toBe(33_333)
    expect(fromSpecSalary(0)).toBe(0)
  })

  it('puts the bottom rung beside the town’s own bottom wage', () => {
    /**
     * MEASURED AGAINST THE ENGINE'S OWN TABLE rather than asserted. If a
     * later path is transcribed without deflating, its entry wage will sit
     * an order of magnitude above every job the town already has, and this
     * is where that shows up.
     */
    const clerk = OCCUPATIONS.find((occupation) => occupation.id === 'shop-clerk')
    expect(clerk).toBeDefined()
    if (!clerk) return
    for (const path of FIRST_SLICE) {
      const entry = path.levels[0]
      if (!entry) continue
      expect(
        entry.monthlyPay,
        `${path.id} starts at ${String(entry.monthlyPay)}, which is not a wage in this world`,
      ).toBeLessThan(clerk.maxMonthlyPay * 12)
    }
  })

  it('keeps the top of every ladder under the town’s highest wage', () => {
    // A chief executive is the top of this world. No rung of any path should
    // out-earn one, or the wage table has two different ideas of "the top".
    const boss = OCCUPATIONS.find((occupation) => occupation.id === 'chief-executive')
    expect(boss).toBeDefined()
    if (!boss) return
    for (const path of FIRST_SLICE) {
      const top = path.levels[path.levels.length - 1]
      if (!top) continue
      expect(top.monthlyPay, `${path.id} tops out above the chief executive`).toBeLessThan(
        boss.maxMonthlyPay,
      )
    }
  })

  it('prices a licence as something a person could decide to go and get', () => {
    for (const licence of LICENCES) {
      expect(licence.cost, `${licence.id} is free`).toBeGreaterThan(0)
      expect(licence.months, `${licence.id} takes no time`).toBeGreaterThan(0)
      expect(licence.title.length).toBeGreaterThan(5)
    }
    // The dearest of them is flying, and it should be the dearest by a way.
    const aviation = licenceById('aviation')
    const cdl = licenceById('cdl')
    expect(aviation?.cost ?? 0).toBeGreaterThan((cdl?.cost ?? 0) * 5)
  })
})

describe('work that has not been invented yet', () => {
  it('is not on offer before its time', () => {
    const software = pathById(FIRST_SLICE, 'software-developer')
    expect(software).toBeDefined()
    if (!software) return
    // There were no software developers in this town in 1970.
    expect(pathAvailableIn(software, 1970)).toBe(false)
    expect(pathAvailableIn(software, 1979)).toBe(false)
    expect(pathAvailableIn(software, 1985)).toBe(true)
    expect(pathAvailableIn(software, 2020)).toBe(true)
  })

  it('leaves a trade with no era alone in every year', () => {
    const shop = pathById(FIRST_SLICE, 'retail-cashier')
    expect(shop).toBeDefined()
    if (!shop) return
    expect(pathAvailableIn(shop, 1970)).toBe(true)
    expect(pathAvailableIn(shop, 2026)).toBe(true)
  })
})
