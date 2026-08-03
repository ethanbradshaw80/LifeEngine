/**
 * The crime scene (owner's spec).
 *
 * THE BUG IT FIXES, in one line: "Clicking 'Do it' currently jumps straight
 * to the result — the screen blanks and money is added." The money moved
 * before anything was decided, so the biggest choice in the crime module
 * was a button with no moment attached to it.
 *
 * THE CLAIM UNDER TEST is therefore mostly about ORDER: nothing happens
 * until the room is answered, and what happens after depends on the answer.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { OFFENCES, offenceById } from '../src/content.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { commitOffence } from '../src/crime.js'
import {
  CRIME_SCENE_OPTIONS,
  crimeOutcomeFor,
  crimeSceneFor,
  dangerFor,
  decodeCrimeScene,
  encodeCrimeScene,
} from '../src/crimescene.js'
import type { CrimeDanger } from '../src/crimescene.js'
import { resolvePending, setPlayer } from '../src/player.js'
import { openStream, Stream } from '../src/rng.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function playedAdult(seedValue = 12345): { world: World; id: EntityId } {
  const world = createWorld(makeSeed(seedValue), 100)
  advanceTicks(world, 24)
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 22 && age <= 45
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult')
  setPlayer(world, person.id)
  return { world, id: person.id }
}

function savingsOf(world: World, id: EntityId): number {
  const householdId = world.people.get(id)?.householdId
  if (householdId === null || householdId === undefined) return 0
  return world.households.get(householdId)?.savings ?? 0
}

describe('the scene comes first', () => {
  it('takes nothing and records nothing until the room is answered', () => {
    const { world, id } = playedAdult()
    const person = world.people.get(id)
    if (!person) throw new Error('no player')
    const before = savingsOf(world, id)
    const eventsBefore = world.events.length

    const result = commitOffence(world, world.tick, person, 'burglary')
    expect(result.done).toBe(true)

    // THE WHOLE BUG: this used to be where the money had already landed.
    expect(world.player.pending?.kind).toBe('crime-scene')
    expect(savingsOf(world, id)).toBe(before)
    expect(world.events.length).toBe(eventsBefore)
    expect(world.events.some((e) => e.type === 'committed-theft')).toBe(false)

    // And the room is one of the three, with the three answers.
    const state = decodeCrimeScene(world.player.pending?.occupationId ?? null)
    expect(['quiet', 'occupied', 'hot']).toContain(state.danger)
    expect(world.player.pending?.options).toEqual([...CRIME_SCENE_OPTIONS])
  })

  it('backing out takes nothing, loses nothing, and is on the record', () => {
    const { world, id } = playedAdult()
    const person = world.people.get(id)
    if (!person) throw new Error('no player')
    const before = savingsOf(world, id)
    // Counted as a DELTA: the person may have a past of their own from the
    // years before the player took them over.
    const countOf = (type: string) =>
      world.events.filter((e) => e.type === type && e.subjectId === id).length
    const theftsBefore = countOf('committed-theft')
    const arrestsBefore = countOf('was-arrested')

    commitOffence(world, world.tick, person, 'burglary')
    resolvePending(world, 'bail')

    expect(savingsOf(world, id)).toBe(before)
    expect(countOf('committed-theft')).toBe(theftsBefore)
    expect(countOf('was-arrested')).toBe(arrestsBefore)
    // A life that turned around in a dark house should be able to say so.
    expect(
      world.causalRecords.some(
        (r) => r.subjectId === id && r.decision === 'crime' && r.chosen.startsWith('backed out'),
      ),
    ).toBe(true)
  })

  it('going through with it moves the money and writes the crime', () => {
    // Across seeds, because the room is rolled and 'press' means different
    // things in different rooms.
    let took = 0
    let arrested = 0
    for (let seedValue = 1; seedValue <= 40; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      const before = savingsOf(world, id)
      const result = commitOffence(world, world.tick, person, 'burglary')
      if (!result.done || world.player.pending?.kind !== 'crime-scene') continue
      resolvePending(world, 'press')
      if (savingsOf(world, id) > before) took++
      if (world.events.some((e) => e.type === 'was-arrested' && e.subjectId === id)) arrested++
    }
    // Some jobs pay and some end badly — a scene where one of those never
    // happens is not a scene.
    expect(took).toBeGreaterThan(0)
    expect(arrested).toBeGreaterThan(0)
  })

  it('reaches the courthouse rather than losing the arrest', () => {
    // The trap this fell into once already: executeOffence raises the plea
    // pending, and running it inside resolvePending has raisePending refuse
    // while the answered scene still holds the slot — the arrest vanishes.
    let sawCourt = 0
    for (let seedValue = 1; seedValue <= 60 && sawCourt < 2; seedValue++) {
      const { world, id } = playedAdult(seedValue)
      const person = world.people.get(id)
      if (!person) continue
      commitOffence(world, world.tick, person, 'burglary')
      if (world.player.pending?.kind !== 'crime-scene') continue
      resolvePending(world, 'press')
      if (world.events.some((e) => e.type === 'was-arrested' && e.subjectId === id)) {
        expect(world.player.pending?.kind, 'arrested with no courthouse').toBe('plea')
        sawCourt++
      }
    }
    expect(sawCourt, 'no seed reached the courthouse at all').toBeGreaterThan(0)
  })
})

describe('the room and what it means', () => {
  it('rolls all three rooms, and a dangerous trade goes hot more often', () => {
    const seen = new Set<CrimeDanger>()
    let quietHot = 0
    let physicalHot = 0
    const quietOffence = OFFENCES.find((o) => o.danger === undefined || o.danger === 'discovery')
    const physical = OFFENCES.find((o) => o.danger === 'physical')
    if (!quietOffence || !physical) throw new Error('the catalogue lost its danger kinds')

    for (let i = 0; i < 400; i++) {
      const rng = openStream(makeSeed(99), Stream.Crime, i as EntityId, i as Tick)
      const a = dangerFor(quietOffence, rng)
      seen.add(a)
      if (a === 'hot') quietHot++
      const rng2 = openStream(makeSeed(99), Stream.Crime, i as EntityId, i as Tick)
      if (dangerFor(physical, rng2) === 'hot') physicalHot++
    }
    expect(seen.size, 'a room that is always the same is not a roll').toBe(3)
    expect(physicalHot).toBeGreaterThan(quietHot)
  })

  it('bailing is always empty-handed and always safe', () => {
    for (const danger of ['quiet', 'occupied', 'hot'] as const) {
      const outcome = crimeOutcomeFor(danger, 'bail')
      expect(outcome.kind).toBe('bailed')
      expect(outcome.lootPerMille).toBe(0)
      expect(outcome.clearancePerMille).toBe(0)
    }
  })

  it('pressing on pays more and costs more, in every room', () => {
    for (const danger of ['quiet', 'occupied', 'hot'] as const) {
      const press = crimeOutcomeFor(danger, 'press')
      const cool = crimeOutcomeFor(danger, 'cool')
      // Never a discount: pressing on is always at least as exposed.
      expect(press.clearancePerMille).toBeGreaterThanOrEqual(cool.clearancePerMille)
      if (danger !== 'hot') {
        expect(press.lootPerMille).toBeGreaterThan(cool.lootPerMille)
      }
    }
    // And the room the player was warned about is the one that shoots back.
    expect(crimeOutcomeFor('hot', 'press').kind).toBe('wounded')
    expect(crimeOutcomeFor('hot', 'cool').kind).toBe('caught')
    expect(crimeOutcomeFor('quiet', 'press').kind).toBe('clean')
  })

  it('draws a readable room for every offence in the catalogue', () => {
    for (const offence of OFFENCES) {
      for (const danger of ['quiet', 'occupied', 'hot'] as const) {
        const scene = crimeSceneFor(offence, danger)
        expect(scene.tell.length).toBeGreaterThan(20)
        expect(scene.options.map((o) => o.id)).toEqual([...CRIME_SCENE_OPTIONS])
        for (const option of scene.options) {
          expect(option.title.length).toBeGreaterThan(0)
          expect(option.detail.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('round-trips what the pending carries', () => {
    for (const danger of ['quiet', 'occupied', 'hot'] as const) {
      const decoded = decodeCrimeScene(encodeCrimeScene('burglary', danger))
      expect(decoded.offenceId).toBe('burglary')
      expect(decoded.danger).toBe(danger)
    }
    // A corrupt or absent value reads as the safe end, never as a crash.
    expect(decodeCrimeScene(null).danger).toBe('quiet')
    expect(offenceById(decodeCrimeScene(null).offenceId)).toBeUndefined()
  })
})
