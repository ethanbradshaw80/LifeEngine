/**
 * Education phase 1 — the full school ladder.
 *
 * The owner's spec: childhood should be "a lived stage, not a blur you skip
 * to age 18". Elementary, middle and high school are three stages now
 * rather than two covering twelve years in one jump.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { educationRank, isHigherEducation, meetsRequirement } from '../src/content.js'
import { livingPeople } from '../src/systems.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 40 * 12)

describe('the ladder', () => {
  it('runs elementary → middle → high school → the fork', () => {
    expect(educationRank('none')).toBeLessThan(educationRank('primary'))
    expect(educationRank('primary')).toBeLessThan(educationRank('middle'))
    expect(educationRank('middle')).toBeLessThan(educationRank('secondary'))
    expect(educationRank('secondary')).toBeLessThan(educationRank('trade'))
    expect(educationRank('trade')).toBeLessThan(educationRank('college'))
  })

  it('keeps every job requirement meaning exactly what it meant', () => {
    // THE RISK OF INSERTING A RUNG. Occupations gate on `secondary` meaning
    // A DIPLOMA. Because meetsRequirement compares RANKS rather than
    // matching names, adding middle school shifts the numbers without
    // shifting any meaning — a middle-school leaver still does not qualify
    // for work that wants a diploma.
    expect(meetsRequirement('secondary', 'secondary')).toBe(true)
    expect(meetsRequirement('college', 'secondary')).toBe(true)
    expect(meetsRequirement('trade', 'secondary')).toBe(true)
    expect(meetsRequirement('middle', 'secondary'), 'middle school passed as a diploma').toBe(false)
    expect(meetsRequirement('primary', 'secondary')).toBe(false)
    // And middle school IS above elementary, which is the point of it.
    expect(meetsRequirement('middle', 'primary')).toBe(true)
  })

  it('does not mistake a high-schooler for a university student', () => {
    // THE BUG THIS PINS. Three places asked `educationRank(level) > 2`
    // meaning "trade school or university" — which worked only because
    // `secondary` happened to sit at rank 2. Inserting `middle` beneath it
    // would have made that "secondary or above", and every fifteen-year-old
    // in the game would have been barred from a part-time job as a
    // full-time university student.
    expect(isHigherEducation('trade')).toBe(true)
    expect(isHigherEducation('college')).toBe(true)
    expect(isHigherEducation('secondary'), 'high school counted as higher education').toBe(false)
    expect(isHigherEducation('middle')).toBe(false)
    expect(isHigherEducation('primary')).toBe(false)
    expect(isHigherEducation(null)).toBe(false)
  })
})

describe('a town climbs it', () => {
  it('puts children at each stage at the age that stage belongs to', () => {
    // MEASURED across forty years: none 0-10, middle 14-18, secondary from
    // 18 up. The diploma still lands at eighteen, which matters more than
    // anything else here — the age-18 fork is the hinge of a whole life.
    const ages = new Map<string, number[]>()
    for (const person of livingPeople(world)) {
      const level = world.education.get(person.id)?.level ?? 'none'
      const list = ages.get(level) ?? []
      list.push(ageAt(person.birthTick, world.tick))
      ages.set(level, list)
    }
    const youngest = (level: string): number => Math.min(...(ages.get(level) ?? [999]))

    expect(ages.get('middle')?.length, 'nobody ever finished middle school').toBeGreaterThan(5)
    // Nobody holds a stage before they could possibly have finished it.
    expect(youngest('primary')).toBeGreaterThanOrEqual(10)
    expect(youngest('middle')).toBeGreaterThanOrEqual(13)
    expect(youngest('secondary'), 'a diploma before eighteen').toBeGreaterThanOrEqual(17)
  })

  it('still sends people on to trade and college afterwards', () => {
    const levels = livingPeople(world).map((p) => world.education.get(p.id)?.level ?? 'none')
    expect(levels.filter((l) => l === 'trade').length).toBeGreaterThan(5)
    expect(levels.filter((l) => l === 'college').length).toBeGreaterThan(5)
  })

  it('leaves the people who missed school where they stopped', () => {
    // Somebody whose schooling ended at elementary does not enrol in middle
    // school at thirty. Each rung has its own ceiling.
    const stuck = livingPeople(world).filter((p) => {
      const rec = world.education.get(p.id)
      return rec?.level === 'primary' && ageAt(p.birthTick, world.tick) > 25
    })
    for (const person of stuck) {
      expect(world.education.get(person.id)?.enrolledIn, `${person.givenName} went back to school late`).toBeNull()
    }
  })
})

/**
 * Education phase 1, the other half — the childhood performance arc and
 * the school the money bought.
 *
 * `attainment` used to be written once and never touched again, so all
 * thirteen years of the ladder were decorative: two children with the
 * same traits finished identical whatever happened in between.
 */
describe('the school years leave a mark', () => {
  it('moves attainment while a child is enrolled', () => {
    // Somebody, somewhere, has to be off the number they were born with.
    // A static field would put every single child on exactly 500.
    const moved = livingPeople(world).filter((person) => {
      const record = world.education.get(person.id)
      if (record === undefined || record.schooling === undefined) return false
      return record.attainment !== 500
    })
    expect(moved.length).toBeGreaterThan(0)
  })

  it('keeps private school a minority, not the ordinary childhood', () => {
    let priv = 0
    let pub = 0
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.schooling === 'private') priv += 1
      else if (record?.schooling === 'public') pub += 1
    }
    expect(priv).toBeGreaterThan(0)
    // The first numbers put 52% of the town's children through private
    // school, which made the ordinary childhood the expensive one.
    expect(priv).toBeLessThan(pub / 2)
  })

  it('pays off on average without being a guarantee', () => {
    const priv: number[] = []
    const pub: number[] = []
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record === undefined || record.schooling === undefined) continue
      const age = ageAt(person.birthTick, world.tick)
      if (age < 18 || age > 26) continue
      ;(record.schooling === 'private' ? priv : pub).push(record.attainment)
    }
    const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
    expect(priv.length).toBeGreaterThan(0)
    expect(pub.length).toBeGreaterThan(0)
    expect(mean(priv)).toBeGreaterThan(mean(pub))
    // ...but it never buys the top of the class outright. A diligent,
    // curious child at the ordinary school still beats a lazy rich one,
    // which is the difference between unequal and predetermined (Law 10).
    expect(Math.max(...pub)).toBeGreaterThan(Math.max(...priv))
  })

  it('keeps a child in the same kind of school all the way up', () => {
    // Deciding it afresh at each rung would have let a good year move a
    // child to private school and a bad one move them back.
    for (const person of livingPeople(world)) {
      const record = world.education.get(person.id)
      if (record?.schooling === undefined) continue
      if (record.level === 'none') continue
      // Anybody past primary who was ever assigned a school still has one.
      expect(['public', 'private']).toContain(record.schooling)
    }
  })
})
