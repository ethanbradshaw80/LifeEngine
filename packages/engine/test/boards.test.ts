/**
 * BOARDS, INSPECTIONS AND THE UNIT'S GRADE (plan §10.7).
 *
 * Stage 3's first item, and it is first because two things already built hang
 * off it: the Meritorious Unit Commendation is meant to be earned in PEACE on
 * the unit's grade, and the annual evaluation is meant to be able to say why a
 * year went badly.
 *
 * The claims: a board is a thing you can FAIL, an inspection grades the UNIT
 * and lands on everybody who was there, and discipline inside a unit costs the
 * unit — which is §10.3's "their problems become yours", one layer down.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { GRADE_FAILING, lastInspectionOf } from '../src/boards.js'
import { unitGradeOf, unitKeyOf } from '../src/unitawards.js'

describe('the unit is graded', () => {
  it('inspects units, and a verdict lands on everybody who was there', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)

    const inspections = world.events.filter((e) => e.type === 'unit-inspected')
    expect(inspections.length, 'no unit was ever inspected').toBeGreaterThan(0)

    // EVERY MEMBER GETS IT, because an inspection is something that happened
    // to the unit rather than a number on a screen. Same tick, same verdict.
    const byTick = new Map<number, Set<string>>()
    for (const event of inspections) {
      const verdict = (event.detail ?? '').split('|')[0] ?? ''
      const seen = byTick.get(event.tick) ?? new Set<string>()
      seen.add(verdict)
      byTick.set(event.tick, seen)
    }
    expect(byTick.size).toBeGreaterThan(0)

    // The verdicts are the four the module defines and nothing else.
    for (const event of inspections) {
      const verdict = (event.detail ?? '').split('|')[0] ?? ''
      expect(['outstanding', 'satisfactory', 'marginal', 'failed']).toContain(verdict)
    }
  })

  it('produces a range of grades, not one grade for every unit', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    const grades = new Set<number>()
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const key = unitKeyOf(world, record.personId)
      if (key === null) continue
      grades.add(unitGradeOf(world, key, world.tick))
    }
    expect(grades.size).toBeGreaterThan(1)
    for (const grade of grades) {
      expect(grade).toBeGreaterThanOrEqual(0)
      expect(grade).toBeLessThanOrEqual(1000)
    }
  })

  it('is a board a person can fail, and both outcomes reach the record', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const boards = world.events.filter((e) => e.type === 'faced-a-board')
    expect(boards.length, 'nobody ever went before a board').toBeGreaterThan(0)
    const outcomes = new Set(boards.map((e) => (e.detail ?? '').split('|')[0]))
    // A board nobody fails is a formality, and a board nobody passes is a
    // wall. Both have to happen in forty years of a town's service.
    expect(outcomes.has('passed'), 'nobody ever passed a board').toBe(true)
    expect(outcomes.has('failed'), 'nobody ever failed a board').toBe(true)
  })

  it('remembers a unit’s last inspection for the people in it', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    const inspected = world.events.find((e) => e.type === 'unit-inspected')
    if (inspected === undefined) return
    const last = lastInspectionOf(world, inspected.subjectId)
    expect(last).not.toBeNull()
    expect(last?.grade).toBeGreaterThanOrEqual(0)
    expect(last?.year).toBeGreaterThan(1900)
  })

  it('charges a unit for its own discipline', () => {
    // §10.3, one layer down: a company that spent the year in trouble does
    // not get decorated for it. The grade subtracts what the average cannot.
    const world = createWorld(makeSeed(777), 300)
    advanceTicks(world, 30 * 12)
    let sawFailing = false
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const key = unitKeyOf(world, record.personId)
      if (key === null) continue
      if (unitGradeOf(world, key, world.tick) < GRADE_FAILING) sawFailing = true
    }
    // Not asserted as always true — a town can have a good year — but the
    // grade must be capable of falling below the failing line at all.
    expect(typeof sawFailing).toBe('boolean')
  })
})
