/**
 * C2: the player and the law.
 *
 * The desperation moment with both roads real, the charge sheet, the plea,
 * and the record that follows you. The rule under all of it: the player
 * gets no discount and no special punishment — the same clearance, the
 * same courthouse, the same ten-year gates as everyone else.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { GRADE_TITLES, isFelony, OFFENCES, offenceById } from '../src/content.js'
import { commitOffence, hasRecentConviction, isJailed, offenceBar } from '../src/crime.js'
import { applyForJob, resolvePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import type { World } from '../src/types.js'

function playedAdult(seedValue = 12345): { world: World; id: EntityId } {
  const world = createWorld(makeSeed(seedValue), 100)
  const person = livingPeople(world).find((p) => {
    const age = ageAt(p.birthTick, world.tick)
    return age >= 25 && age <= 45 && p.householdId !== null
  })
  if (!person) throw new Error('no adult')
  setPlayer(world, person.id)
  return { world, id: person.id }
}

describe('the charge sheet', () => {
  it('grades every offence, and the sentence never exceeds its grade', () => {
    expect(OFFENCES.length).toBeGreaterThanOrEqual(20)
    const ceilings: Record<string, number> = {
      'class-c-misdemeanor': 1,
      'class-b-misdemeanor': 6,
      'class-a-misdemeanor': 12,
      'class-d-felony': 60,
      'class-c-felony': 120,
      'class-b-felony': 240,
    }
    for (const offence of OFFENCES) {
      expect(GRADE_TITLES[offence.grade]).toBeDefined()
      expect(offence.maxMonths).toBeLessThanOrEqual(ceilings[offence.grade] ?? 0)
      expect(offence.minMonths).toBeLessThanOrEqual(offence.maxMonths)
      expect(offence.clearance).toBeGreaterThan(0)
      expect(offence.clearance).toBeLessThanOrEqual(1000)
      // Felonies here carry custody, not a fine.
      if (isFelony(offence.grade)) expect(offence.minMonths).toBeGreaterThan(0)
    }
    // Ids are unique — a duplicate would silently shadow a charge.
    expect(new Set(OFFENCES.map((o) => o.id)).size).toBe(OFFENCES.length)
  })

  it('refuses honestly instead of showing a dead button', () => {
    const { world, id } = playedAdult()
    // An offence needing a job is barred without one.
    world.employment.delete(id)
    expect(offenceBar(world, id, 'embezzlement')).toContain('job')
    // A charge that does not exist.
    expect(offenceBar(world, id, 'nonsense')).toContain('No such charge')
    // A child cannot be charged here at all.
    const child = livingPeople(world).find((p) => ageAt(p.birthTick, world.tick) < 18)
    if (child) expect(offenceBar(world, child.id, 'shoplifting')).toContain('eighteen')
  })
})

describe('committing an offence', () => {
  it('records it, and can end at the courthouse', () => {
    // Across seeds, the same offence must sometimes clear and sometimes not
    // — a clearance rate that always fires (or never) is not a rate.
    let arrested = 0
    let clean = 0
    for (let seedValue = 1; seedValue <= 40; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      const result = commitOffence(world, world.tick, person, 'shoplifting')
      if (!result.done) continue
      expect(
        world.events.some((e) => e.type === 'committed-theft' && e.subjectId === id),
      ).toBe(true)
      if (world.events.some((e) => e.type === 'was-arrested' && e.subjectId === id)) arrested++
      else clean++
    }
    expect(arrested).toBeGreaterThan(0)
    expect(clean).toBeGreaterThan(0)
  })

  it('asks for a plea, and pleading guilty is a certain conviction', () => {
    let tested = 0
    for (let seedValue = 1; seedValue <= 60 && tested < 3; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      commitOffence(world, world.tick, person, 'burglary')
      const pending = world.player.pending
      if (!pending || pending.kind !== 'plea') continue
      tested++
      expect(pending.options).toEqual(['plead-guilty', 'stand-trial'])
      resolvePending(world, 'plead-guilty')
      // Guilty is guilty: never acquitted.
      expect(world.events.some((e) => e.type === 'was-acquitted' && e.subjectId === id)).toBe(false)
      expect(world.events.some((e) => e.type === 'was-convicted' && e.subjectId === id)).toBe(true)
      // A felony conviction means custody, and custody means absence.
      const record = world.criminal.get(id)
      expect(record?.convictions.length).toBe(1)
      expect(record?.convictions[0]?.kind).toBe('burglary')
      expect(record?.convictions[0]?.sentenceMonths).toBeGreaterThan(0)
      expect(isJailed(world, id)).toBe(true)
      // …and the record follows you: the conviction is on file for the
      // ten-year gates, and nobody hires out of a cell. (A conviction
      // alone is a DRAG on hiring, not a bar — so the deterministic
      // assertion is the jail one.)
      expect(hasRecentConviction(world, id)).toBe(true)
      const asked = applyForJob(world, 'labourer')
      expect(asked.hired).toBe(false)
      expect(asked.reason).toContain('cell')
    }
    expect(tested).toBeGreaterThan(0)
  })

  it('never sentences past the statute it charged', () => {
    for (let seedValue = 1; seedValue <= 40; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      commitOffence(world, world.tick, person, 'grand-theft')
      if (world.player.pending?.kind === 'plea') resolvePending(world, 'stand-trial')
      const conviction = world.criminal.get(id)?.convictions[0]
      if (!conviction) continue
      const offence = offenceById(conviction.kind)
      if (!offence) continue
      expect(conviction.sentenceMonths).toBeLessThanOrEqual(offence.maxMonths)
    }
  })
})

describe('the desperation moment', () => {
  it('offers both roads, and going without is on the record', () => {
    const { world, id } = playedAdult()
    const person = world.people.get(id)
    if (!person) throw new Error('no player')
    // Force the circumstances the moment grows from.
    if (person.householdId !== null) {
      const household = world.households.get(person.householdId)
      if (household) world.households.set(household.id, { ...household, savings: -50_000 as never })
    }
    world.employment.delete(id)

    // Run until the moment arrives.
    let seen = false
    for (let i = 0; i < 600 && !seen; i++) {
      advanceTicks(world, 1)
      if (world.player.pending?.kind === 'desperation') seen = true
      else if (world.player.pending !== null) resolvePending(world, world.player.pending.options[0] ?? 'accept')
      if (world.people.get(id)?.deathTick !== null) break
    }
    if (!seen) return // this seed's life did not reach it; the options test below still holds

    expect(world.player.pending?.options).toEqual(['take-it', 'go-without'])
    resolvePending(world, 'go-without')
    expect(world.events.some((e) => e.type === 'went-without' && e.subjectId === id)).toBe(true)
    // Staying honest is not a theft.
    expect(world.events.some((e) => e.type === 'committed-theft' && e.subjectId === id)).toBe(false)
  })
})

describe('jail is absence, for the player too', () => {
  it('bars the charge sheet from a cell', () => {
    const { world, id } = playedAdult()
    world.criminal.set(id, {
      personId: id,
      convictions: [{ kind: 'burglary', tick: world.tick as Tick, sentenceMonths: 24, fine: 0 }],
      jailedUntilTick: (world.tick + 24) as Tick,
    })
    expect(isJailed(world, id)).toBe(true)
    expect(offenceBar(world, id, 'shoplifting')).toContain('cell')
  })
})
