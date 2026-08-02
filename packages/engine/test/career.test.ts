/**
 * M-ARMY2 items 5+6: the career's shape and its honest ways out.
 * Up-or-out stops at E-5; thirty years is a career; sixty-two is the last
 * year in uniform; the office takes volunteers to thirty-eight; and the
 * mistakes at base go on the record — three in five years end a career.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { enlistmentBar, enlistPerson } from '../src/service.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import { SPECIALTIES } from '../src/content.js'
import type { Person, World } from '../src/types.js'

function walkInSpecialty() {
  const specialty = SPECIALTIES.find((sp) => sp.requires === 'none')
  if (!specialty) throw new Error('no walk-in specialty')
  return specialty
}

function adultAged(world: World, min: number, max: number): Person {
  const person = livingPeople(world).find((p) => {
    const age = ageAt(p.birthTick, world.tick)
    return age >= min && age <= max && !world.service.has(p.id)
  })
  if (!person) throw new Error(`no adult aged ${min}-${max} in the founding town`)
  return person
}

/** Enlist by hand, then rewrite the record to the scenario under test. */
function soldierWith(
  world: World,
  person: Person,
  overrides: Partial<NonNullable<ReturnType<World['service']['get']>>>,
) {
  enlistPerson(world, world.tick, person, walkInSpecialty(), [])
  const record = world.service.get(person.id)
  if (!record) throw new Error('enlistment did not take')
  world.service.set(person.id, { ...record, ...overrides })
}

describe('the office takes volunteers to thirty-eight', () => {
  it('a thirty-year-old can join; a forty-year-old cannot', () => {
    const world = createWorld(makeSeed(12345), 100)
    const thirty = adultAged(world, 28, 36)
    expect(enlistmentBar(world, thirty, world.tick)).toBeNull()
    const forty = adultAged(world, 40, 55)
    expect(enlistmentBar(world, forty, world.tick)).toContain('thirty-eight')
  })
})

describe('up-or-out stops at sergeant', () => {
  it('an E-4 six years in grade is let go at term end; an E-5 is kept', () => {
    const world = createWorld(makeSeed(12345), 100)
    const junior = adultAged(world, 26, 34)
    soldierWith(world, junior, {
      rank: 3, // SPC — E-4
      rankSinceTick: (world.tick - 80) as Tick,
      termMonthsLeft: 1,
      performance: 500,
      termPerformanceSum: 500 * 47,
    })
    const senior = adultAged(world, 26, 34)
    soldierWith(world, senior, {
      rank: 5, // SGT — E-5
      rankSinceTick: (world.tick - 200) as Tick,
      termMonthsLeft: 1,
      performance: 500,
      termPerformanceSum: 500 * 47,
    })

    advanceTick(world)

    expect(world.service.get(junior.id)?.dischargeReason).toBe('high-year tenure')
    // The sergeant's term still ends however their retention roll lands —
    // but never by up-or-out.
    expect(world.service.get(senior.id)?.dischargeReason).not.toBe('high-year tenure')
  })
})

describe('thirty years is a career', () => {
  it('the three-hundred-and-sixtieth month is the last', () => {
    const world = createWorld(makeSeed(12345), 100)
    const lifer = adultAged(world, 45, 55)
    soldierWith(world, lifer, {
      rank: 5,
      enlistedAtTick: (world.tick - 360) as Tick,
      rankSinceTick: (world.tick - 12) as Tick,
      termMonthsLeft: 20,
      performance: 700,
      termPerformanceSum: 700 * 28,
    })
    advanceTick(world)
    const record = world.service.get(lifer.id)
    expect(record?.dischargedAtTick).not.toBeNull()
    expect(record?.dischargeReason).toBe('thirty years served')
    // An honourable mandatory ending keeps the term-judged medal — a
    // lifer's last term must not forfeit what high-year tenure keeps.
    const awards = world.awards.get(lifer.id) ?? []
    expect(awards.some((a) => a.kind === 'good-conduct')).toBe(true)
  })
})

describe('sixty-two is the last year in uniform', () => {
  it('mandatory retirement fires rank regardless', () => {
    const world = createWorld(makeSeed(12345), 100)
    const elder = adultAged(world, 62, 70)
    soldierWith(world, elder, {
      rank: 6,
      termMonthsLeft: 30,
    })
    advanceTick(world)
    const record = world.service.get(elder.id)
    expect(record?.dischargedAtTick).not.toBeNull()
    expect(record?.dischargeReason).toBe('retirement age')
  })
})

describe('the mistakes at base', () => {
  it('company punishments happen, stay on the record, and can end a career', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 70 * 12)
    const punished = world.events.filter((e) => e.type === 'disciplined')
    expect(punished.length).toBeGreaterThan(0)
    // Every punished person was serving (undischarged, or discharged no
    // earlier than the event) — the orderly room does not reach civilians.
    for (const event of punished) {
      const record = world.service.get(event.subjectId)
      expect(record).toBeDefined()
      if (record?.dischargedAtTick !== null) {
        expect(record!.dischargedAtTick).toBeGreaterThanOrEqual(event.tick)
      }
    }
    // Whether THIS seed produced a three-strikes discharge is the seed's
    // business; when one exists it must carry the misconduct reason and
    // three strikes inside the window behind it.
    for (const record of world.service.values()) {
      if (record.dischargeReason !== 'misconduct') continue
      const strikes = world.events.filter(
        (e) =>
          e.type === 'disciplined' &&
          e.subjectId === record.personId &&
          (record.dischargedAtTick ?? 0) - e.tick < 60,
      )
      expect(strikes.length).toBeGreaterThanOrEqual(3)
    }
  })
})
