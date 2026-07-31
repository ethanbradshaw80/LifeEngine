/**
 * Behavioural tests: does the simulation produce plausible lives?
 *
 * Determinism tests prove the world is reproducible. These prove it is not
 * reproducibly nonsense — nobody employed at eight years old, no births
 * without parents, no deaths without a recorded cause.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed, TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { decisionsFor, eventsFor } from '../src/records.js'
import { livingPeople } from '../src/systems.js'
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES } from '../src/content.js'
import { lifeStory, personSummary } from '../src/story.js'
import type { World } from '../src/types.js'

const SEED = 12345
const TICKS = 120
const WORKING_AGE = 18

let world: World

beforeAll(() => {
  world = createWorld(makeSeed(SEED))
  advanceTicks(world, TICKS)
})

describe('population', () => {
  it('starts with roughly the requested number of people', () => {
    const fresh = createWorld(makeSeed(SEED))
    expect(fresh.people.size).toBeGreaterThanOrEqual(95)
    expect(fresh.people.size).toBeLessThanOrEqual(105)
  })

  it('still has a living population after ten years', () => {
    const living = livingPeople(world)
    expect(living.length).toBeGreaterThan(50)
  })

  it('has both births and deaths over ten years', () => {
    const births = world.events.filter((e) => e.type === 'born')
    const deaths = world.events.filter((e) => e.type === 'died')
    expect(births.length).toBeGreaterThan(0)
    expect(deaths.length).toBeGreaterThan(0)
  })

  it('does not collapse or explode', () => {
    // A stability check: emergent systems can run away (R-07). Ten years should
    // not double the town or halve it.
    const fresh = createWorld(makeSeed(SEED))
    const ratio = world.people.size / fresh.people.size
    expect(ratio).toBeGreaterThan(0.9)
    expect(ratio).toBeLessThan(1.6)
  })
})

describe('invariants that must never break', () => {
  it('employs nobody below working age', () => {
    for (const [personId] of world.employment) {
      const person = world.people.get(personId)
      expect(person).toBeDefined()
      if (!person) continue
      expect(ageAt(person.birthTick, world.tick)).toBeGreaterThanOrEqual(WORKING_AGE)
    }
  })

  it('employs nobody who is dead', () => {
    for (const [personId] of world.employment) {
      expect(world.people.get(personId)?.deathTick).toBeNull()
    }
  })

  it('gives every death a cause and a causal record', () => {
    const dead = [...world.people.values()].filter((p) => p.deathTick !== null)
    expect(dead.length).toBeGreaterThan(0)

    for (const person of dead) {
      expect(person.causeOfDeath).not.toBeNull()
      const records = decisionsFor(world, person.id).filter((r) => r.decision === 'death')
      // Law 3: death is never an unexplained hidden roll.
      expect(records.length, `${person.givenName} died with no causal record`).toBe(1)
      expect(records[0]?.inputs.length).toBeGreaterThan(0)
    }
  })

  it('gives everyone born during the run two parents', () => {
    const births = world.events.filter((e) => e.type === 'born')
    for (const birth of births) {
      const child = world.people.get(birth.subjectId)
      expect(child?.parentIds.length).toBe(2)
    }
  })

  it('gives everyone a given name matching their sex', () => {
    // Newborns once drew their name list and their sex independently, which
    // produced girls called Peter. Found by reading a life story.
    for (const person of world.people.values()) {
      const expected = person.sex === 'female' ? FEMALE_GIVEN_NAMES : MALE_GIVEN_NAMES
      expect(
        expected as readonly string[],
        `${person.givenName} is ${person.sex}`,
      ).toContain(person.givenName)
    }
  })

  it('never lets a person be their own parent', () => {
    for (const person of world.people.values()) {
      expect(person.parentIds).not.toContain(person.id)
    }
  })

  it('keeps household membership consistent with each person', () => {
    for (const person of livingPeople(world)) {
      if (person.householdId === null) continue
      const household = world.households.get(person.householdId)
      expect(household, `household ${person.householdId} missing`).toBeDefined()
      expect(household?.memberIds).toContain(person.id)
    }
  })

  it('has no live relationship referencing a dead person', () => {
    for (const relationship of world.relationships.values()) {
      // Former spouses are history and are kept deliberately: a widow's
      // marriage still happened.
      if (relationship.type === 'former-spouse') continue
      expect(world.people.get(relationship.a)?.deathTick).toBeNull()
      expect(world.people.get(relationship.b)?.deathTick).toBeNull()
    }
  })

  it('never reuses an entity id', () => {
    const ids = [...world.people.keys()]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records no event before the world began', () => {
    for (const event of world.events) {
      expect(event.tick).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('lives are varied, not uniform', () => {
  it('produces a range of occupations', () => {
    const held = new Set([...world.employment.values()].map((e) => e.occupationId))
    expect(held.size).toBeGreaterThan(3)
  })

  it('produces a range of pay', () => {
    const pay = [...world.employment.values()].map((e) => e.monthlyPay)
    expect(pay.length).toBeGreaterThan(5)
    expect(Math.max(...pay)).toBeGreaterThan(Math.min(...pay))
  })

  it('produces people who left home and formed households', () => {
    const left = world.events.filter((e) => e.type === 'left-home')
    expect(left.length).toBeGreaterThan(0)
  })

  it('forms relationships', () => {
    expect(world.relationships.size).toBeGreaterThan(10)
  })

  it('sends some people to further education', () => {
    const started = world.events.filter(
      (e) => e.type === 'started-school' && (e.detail === 'college' || e.detail === 'trade'),
    )
    expect(started.length).toBeGreaterThan(0)
  })
})

describe('life stories', () => {
  function longestLivedAdult() {
    const adults = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 25)
      .sort((a, b) => eventsFor(world, b.id).length - eventsFor(world, a.id).length)
    return adults[0]
  }

  it('renders a story with a beginning, a life, and reasons', () => {
    const person = longestLivedAdult()
    expect(person).toBeDefined()
    if (!person) return

    const story = lifeStory(world, person.id)
    expect(story).toContain(person.givenName)
    expect(story).toContain('Life')
    expect(story.split('\n').length).toBeGreaterThan(8)
  })

  it('explains decisions using only recorded factors', () => {
    const withDecisions = livingPeople(world).find((p) => decisionsFor(world, p.id).length > 0)
    expect(withDecisions).toBeDefined()
    if (!withDecisions) return

    const story = lifeStory(world, withDecisions.id)
    expect(story).toContain('Why')
    expect(story).toContain('Because')
  })

  it('summarizes a person in one line', () => {
    const person = livingPeople(world)[0]
    expect(person).toBeDefined()
    if (!person) return
    const summary = personSummary(world, person.id)
    expect(summary).toContain(person.givenName)
    expect(summary.split('\n').length).toBe(1)
  })

  it('admits when there is no record rather than inventing one', () => {
    // A newborn has made no decisions. The honest answer is "no record".
    const babies = livingPeople(world).filter(
      (p) => ageAt(p.birthTick, world.tick) < 1 && decisionsFor(world, p.id).length === 0,
    )
    if (babies.length === 0) return
    const baby = babies[0]
    if (!baby) return
    const story = lifeStory(world, baby.id)
    expect(story).not.toContain('Why')
  })
})

describe('ageing', () => {
  it('ages everyone by ten years over 120 ticks', () => {
    const fresh = createWorld(makeSeed(SEED))
    const firstId = [...fresh.people.keys()].sort((a, b) => a - b)[0]
    expect(firstId).toBeDefined()
    if (firstId === undefined) return

    const before = fresh.people.get(firstId)
    const after = world.people.get(firstId)
    expect(before).toBeDefined()
    expect(after).toBeDefined()
    if (!before || !after) return

    const ageBefore = ageAt(before.birthTick, fresh.tick)
    const ageAfter = ageAt(after.birthTick, world.tick)
    expect(ageAfter - ageBefore).toBe(TICKS / TICKS_PER_YEAR)
  })
})
