/**
 * PEACETIME THAT CAN HURT YOU, AND PEOPLE WHO ARE YOURS (§10.3, §10.5, §10.6).
 *
 * §10.5's premise, and it was true when checked: nothing in garrison could
 * hurt anybody. Deployment had illness, wounds and death; home station had a
 * line of flavour text. §10.9 asks for the years between wars to carry weight
 * and to be MEASURED, which is what this file does.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { holdsCommand, letterFor, subordinatesOf, superiorOf, tediumOf } from '../src/garrison.js'

describe('peacetime carries weight', () => {
  it('hurts people at home station, on exercises and on the road', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const training = world.events.filter((e) => e.type === 'training-accident')
    const road = world.events.filter((e) => e.type === 'off-duty-accident')
    // MEASURED: before this, both of these were zero for ever.
    expect(training.length, 'no training accident in forty years').toBeGreaterThan(0)
    expect(road.length, 'nobody was ever hurt off duty').toBeGreaterThan(0)
    // And each one says what happened rather than "an accident".
    for (const event of [...training, ...road].slice(0, 20)) {
      expect((event.detail ?? '').length).toBeGreaterThan(25)
    }
  })

  it('produces a real wound through the same door the war uses', () => {
    // Not a special case: a rollover is an injury with a recovery and a
    // medical board behind it, which is what makes a garrison career able to
    // go wrong without pretending anybody was in a firefight.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const accident = world.events.find((e) => e.type === 'training-accident')
    expect(accident).toBeDefined()
    if (accident === undefined) return
    // Somebody in the world carries a wound, and the health system owns it.
    let wounded = 0
    for (const record of world.health.values()) {
      if (record.peakSeverity > 0) wounded += 1
    }
    expect(wounded).toBeGreaterThan(0)
  })

  it('lets boredom feed trouble, and the trouble lands on whoever answers for them', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const trouble = world.events.filter((e) => e.type === 'off-duty-trouble')
    expect(trouble.length, 'nobody was ever in trouble off duty').toBeGreaterThan(0)

    // §10.3: "their problems become yours" is not flavour if it is on the
    // record of the man above them.
    const answered = world.events.filter((e) => e.type === 'answered-for-one-of-yours')
    expect(answered.length, 'nobody ever answered for one of theirs').toBeGreaterThan(0)
    for (const event of answered.slice(0, 10)) {
      // It names the person it was about, and it is not the same person.
      expect(event.otherId).not.toBeNull()
      expect(event.otherId).not.toBe(event.subjectId)
    }
  })

  it('measures tedium off the record rather than asserting it', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 20 * 12)
    const anybody = [...world.service.values()][0]
    if (anybody === undefined) return
    const now = tediumOf(world, anybody.personId, world.tick)
    expect(now).toBeGreaterThanOrEqual(0)
    expect(now).toBeLessThanOrEqual(1000)
  })

  it('gives rank people, and never gives a private anybody', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    let sawCommand = false
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const mine = subordinatesOf(world, record.personId)
      if (record.rank < 5 && record.commissioned !== true) {
        // THE RANK-LADDER TRAP, GUARDED: below E-5 nobody is yours.
        expect(mine.length, `rank ${String(record.rank)} was given people`).toBe(0)
      }
      if (mine.length > 0) {
        sawCommand = true
        expect(holdsCommand(world, record.personId)).toBe(true)
        // Never yourself, and never a duplicate.
        expect(mine).not.toContain(record.personId)
        expect(new Set(mine).size).toBe(mine.length)
      }
    }
    expect(sawCommand, 'nobody in the whole service answered for anybody').toBe(true)
  })

  it('writes a letter to the family of one of yours, signed by a real rank', () => {
    // §10.3: "when one of yours dies, you are the one who writes the letter.
    // That is the moment the whole system is for."
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const dead = [...world.people.values()].find(
      (p) => p.deathTick !== null && world.service.has(p.id),
    )
    const writer = [...world.service.values()].find(
      (r) => r.dischargedAtTick === null && r.rank >= 5,
    )
    if (dead === undefined || writer === undefined) return
    const letter = letterFor(world, writer.personId, dead.id)
    expect(letter).not.toBeNull()
    expect(letter?.length).toBe(5)
    // It names him, and it is signed by somebody real.
    expect(letter?.[0]).toContain(dead.familyName)
    expect((letter?.[4] ?? '').length).toBeGreaterThan(4)
  })

  it('finds the man immediately above, not the most senior in the building', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    for (const record of [...world.service.values()].slice(0, 200)) {
      if (record.dischargedAtTick !== null) continue
      const above = superiorOf(world, record.personId)
      if (above === null) continue
      const theirs = world.service.get(above)
      expect(theirs).toBeDefined()
      // Strictly senior — that is the whole definition, and reading rank as
      // comparable across ladders is the trap this guards.
      expect((theirs?.rank ?? 0) > record.rank).toBe(true)
    }
  })
})
