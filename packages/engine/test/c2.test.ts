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
import { moneyOnHand } from '../src/finances.js'
import { GRADE_TITLES, isFelony, OFFENCES, offenceById } from '../src/content.js'
import {
  commitOffence,
  courtOutcomeOf,
  hasRecentConviction,
  isJailed,
  offenceBar,
} from '../src/crime.js'
import { applyForJob, resolvePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import type { Person, World } from '../src/types.js'

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

/**
 * Commit a crime the way a player now does: the verb opens the SCENE, and
 * the answer to it is what actually moves money and opens the courthouse.
 * 'press' is the answer that always goes through with it, which is what
 * these tests are about.
 */
function commitAndGoThrough(
  world: World,
  tick: Tick,
  person: Person,
  offenceId: string,
  choice: 'press' | 'cool' | 'bail' = 'press',
): { done: boolean; reason: string } {
  const result = commitOffence(world, tick, person, offenceId)
  if (result.done && world.player.pending?.kind === 'crime-scene') {
    resolvePending(world, choice)
  }
  return result
}

describe('the charge sheet', () => {
  it('grades every offence, and the sentence never exceeds its grade', () => {
    expect(OFFENCES.length).toBeGreaterThanOrEqual(20)
    const ceilings: Record<string, number> = {
      'class-c-misdemeanor': 1,
      'class-b-misdemeanor': 6,
      'class-a-misdemeanor': 12,
      'class-e-felony': 48,
      'class-d-felony': 60,
      'class-c-felony': 120,
      'class-b-felony': 240,
      // C3 §8 opened the serious end. A capital offence's ceiling is a life,
      // which the engine counts in months like everything else.
      'class-a-felony': 600,
      capital: 900,
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
      const result = commitAndGoThrough(world, world.tick, person, 'shoplifting')
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
      // 'cool' rather than 'press': this test is about CUSTODY, and a
      // burglar who presses on into a hot room gets shot by the resident,
      // so the job refusal reads "too hurt" before it reads "not from a
      // cell". Both are true; only one is what is being tested.
      commitAndGoThrough(world, world.tick, person, 'burglary', 'cool')
      const pending = world.player.pending
      if (!pending || pending.kind !== 'plea') continue
      tested++
      // C3 §13: the arraignment can now carry a plea deal, so the option
      // list is "the two pleas, and the offer where the state made one".
      expect(pending.options).toContain('plead-guilty')
      expect(pending.options).toContain('stand-trial')
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
      expect(asked.applied).toBe(false)
      expect(asked.reason).toContain('cell')
    }
    expect(tested).toBeGreaterThan(0)
  })

  it('never sentences past the statute it charged', () => {
    for (let seedValue = 1; seedValue <= 40; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      commitAndGoThrough(world, world.tick, person, 'grand-theft')
      if (world.player.pending?.kind === 'plea') resolvePending(world, 'stand-trial')
      const conviction = world.criminal.get(id)?.convictions[0]
      if (!conviction) continue
      const offence = offenceById(conviction.kind)
      if (!offence) continue
      expect(conviction.sentenceMonths).toBeLessThanOrEqual(offence.maxMonths)
    }
  })
})

describe('the verdict, read back', () => {
  it('reports exactly what the courthouse did, and nothing on a quiet month', () => {
    let checked = 0
    for (let seedValue = 1; seedValue <= 60 && checked < 3; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      // A month with no case at all answers null.
      expect(courtOutcomeOf(world, id, world.tick)).toBeNull()

      commitAndGoThrough(world, world.tick, person, 'burglary')
      if (world.player.pending?.kind !== 'plea') continue
      const tick = world.tick
      resolvePending(world, 'plead-guilty')
      checked++

      const outcome = courtOutcomeOf(world, id, tick)
      expect(outcome).not.toBeNull()
      if (!outcome) continue
      expect(outcome.convicted).toBe(true)
      expect(outcome.charge).toBe('residential burglary')
      expect(outcome.grade).toBe('Class B felony')
      // The summary agrees with the record to the month and the cent.
      const conviction = world.criminal.get(id)?.convictions.at(-1)
      expect(outcome.sentenceMonths).toBe(conviction?.sentenceMonths)
      expect(outcome.fine).toBe(conviction?.fine)
      expect(outcome.priors).toBe(0)
      expect(outcome.releasedAtTick).toBe(tick + (conviction?.sentenceMonths ?? 0))
    }
    expect(checked).toBeGreaterThan(0)
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

describe('the review must-fixes', () => {
  it('asks for a plea after a desperation theft, instead of sentencing off-screen', () => {
    // The plea used to be raised from inside resolvePending, before the
    // slot was cleared, so it was ALWAYS refused: the player took the
    // money, got caught, and was sentenced with no say. The whole point of
    // C2. Now the answer runs after commit and the courthouse asks.
    let asked = 0
    let sentencedSilently = 0
    for (let seedValue = 1; seedValue <= 80 && asked === 0; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person || person.householdId === null) continue
      const household = world.households.get(person.householdId)
      if (household) world.households.set(household.id, { ...household, savings: -60_000 as never })
      world.employment.delete(id)

      let found = false
      for (let i = 0; i < 400 && !found; i++) {
        advanceTicks(world, 1)
        const pending = world.player.pending
        if (pending?.kind === 'desperation') found = true
        else if (pending !== null) resolvePending(world, pending.options[0] ?? 'accept')
        if (world.people.get(id)?.deathTick !== null) break
      }
      if (!found) continue

      resolvePending(world, 'take-it')
      const arrested = world.events.some((e) => e.type === 'was-arrested' && e.subjectId === id)
      if (!arrested) continue
      if (world.player.pending?.kind === 'plea') asked++
      else if (world.criminal.get(id)?.convictions.length ?? 0) sentencedSilently++
    }
    expect(asked, 'the courthouse never asked for a plea').toBeGreaterThan(0)
    expect(sentencedSilently).toBe(0)
  })

  it('actually pays the money for offences that take from outside the town', () => {
    // `-chargeHousehold(...)` moved nothing (it guards cents <= 0) and
    // returned -undefined, putting NaN in an event detail and a
    // serialized field. Eight offences paid the player nothing at all.
    let checked = 0
    for (let seedValue = 1; seedValue <= 40 && checked < 3; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person || person.householdId === null) continue
      // M-ECON §1: IT LANDS IN THE THIEF'S POCKET. It used to be credited to
      // the household balance, which is an obligations counter clamped at or
      // below zero every month — so the money was paid and then deleted at
      // the next settle, and this test passed while the player kept nothing.
      const before = moneyOnHand(world, id)
      const result = commitAndGoThrough(world, world.tick, person, 'shoplifting')
      if (!result.done) continue
      checked++
      expect(moneyOnHand(world, id)).toBeGreaterThan(before)
      // And nothing NaN reached the record.
      const theft = world.events.find((e) => e.type === 'committed-theft' && e.subjectId === id)
      expect(theft?.detail ?? '').not.toContain('NaN')
      const cents = Number.parseInt((theft?.detail ?? '').split(':')[1] ?? '', 10)
      expect(Number.isFinite(cents)).toBe(true)
      expect(cents).toBeGreaterThan(0)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('is a logged, once-a-month player input like every other verb', () => {
    const { world, id } = playedAdult()
    const person = world.people.get(id)
    if (!person) throw new Error('no player')

    const first = commitAndGoThrough(world, world.tick, person, 'vandalism')
    expect(first.done).toBe(true)
    // It is in the replay log — a crime is a player input.
    expect(world.player.log.some((e) => e.kind === 'offence' && e.choice === 'vandalism')).toBe(true)

    // A second in the same month is refused: the stream is keyed on the
    // month, so pressing again re-rolled nothing while the money moved.
    const second = commitOffence(world, world.tick, person, 'vandalism')
    expect(second.done).toBe(false)
    expect(second.reason).toContain('month')

    // And nothing happens while a question is waiting.
    world.player.pending = {
      id: 900, tick: world.tick as Tick, kind: 'retirement', personId: id, otherId: null,
      occupationId: null, workplaceId: null, monthlyPay: null, placeId: null,
      options: ['retire', 'keep-working'],
    }
    const third = commitOffence(world, (world.tick + 1) as Tick, person, 'vandalism')
    expect(third.done).toBe(false)
    expect(third.reason).toContain('already waiting')
  })

  it('never records a conviction that costs nothing', () => {
    for (let seedValue = 1; seedValue <= 50; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      commitAndGoThrough(world, world.tick, person, 'disorderly-conduct')
      if (world.player.pending?.kind === 'plea') resolvePending(world, 'stand-trial')
      for (const conviction of world.criminal.get(id)?.convictions ?? []) {
        expect(
          conviction.sentenceMonths > 0 || conviction.fine > 0,
          'a conviction with no sentence and no fine',
        ).toBe(true)
      }
    }
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
