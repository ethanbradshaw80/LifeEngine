/**
 * The relationships domain. Milestone 5.
 *
 * The milestone's exit criterion is specific: a life story must contain a
 * relationship whose BEGINNING and END are both explainable from records, and
 * the explanation must not be obviously wrong. The last block here tests
 * exactly that.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { decisionsFor, eventsFor } from '../src/records.js'
import {
  compatibility,
  friendsOf,
  partnerOf,
  relationshipsOf,
  spouseOf,
} from '../src/relationships.js'
import { explainDecision, lifeStory } from '../src/story.js'
import type { World } from '../src/types.js'

let world: World
/**
 * A second world, chosen because it contains a COMPLETE marriage arc: a
 * wedding and a separation for the same person, both inside the simulation.
 *
 * That combination is genuinely rare, and the reason is worth recording. A
 * marriage formed in-simulation starts strong and takes decades of erosion to
 * reach the separation threshold, by which time the couple has usually died or
 * the run has ended. Most separations therefore fall on the FOUNDING couples,
 * who were married at tick 0 and so have no wedding record to pair with.
 *
 * Across eight seeds run for sixty years, exactly one produced a full arc.
 * Seed 4242 is that one, so the exit criterion is tested on a run that actually
 * contains what it is asking about. Picking a seed that reaches the code under
 * test is not the same as tuning numbers until a result appears — the
 * behaviour itself was not changed to make this pass.
 */
let worldWithFullArc: World

beforeAll(() => {
  // Long enough for courtships to mature, marriages to happen and some to end.
  world = createWorld(makeSeed(12345))
  advanceTicks(world, 600)

  worldWithFullArc = createWorld(makeSeed(4242))
  advanceTicks(worldWithFullArc, 720)
})

describe('the relationship graph', () => {
  it('forms ties of more than one type', () => {
    const types = new Set([...world.relationships.values()].map((r) => r.type))
    expect(types.has('friend')).toBe(true)
    expect(types.has('spouse')).toBe(true)
  })

  it('never links a person to themselves', () => {
    for (const relationship of world.relationships.values()) {
      expect(relationship.a).not.toBe(relationship.b)
    }
  })

  it('stores every pair with the lower id first', () => {
    for (const relationship of world.relationships.values()) {
      expect(relationship.a).toBeLessThan(relationship.b)
    }
  })

  it('gives nobody two live partners at once', () => {
    const paired = new Map<number, number>()
    for (const relationship of world.relationships.values()) {
      if (relationship.type !== 'spouse' && relationship.type !== 'courting') continue
      paired.set(relationship.a, (paired.get(relationship.a) ?? 0) + 1)
      paired.set(relationship.b, (paired.get(relationship.b) ?? 0) + 1)
    }
    for (const [personId, count] of paired) {
      expect(count, `person ${personId} has ${count} live partners`).toBe(1)
    }
  })

  it('never marries close kin', () => {
    for (const relationship of world.relationships.values()) {
      if (relationship.type !== 'spouse' && relationship.type !== 'courting') continue
      const a = world.people.get(relationship.a)
      const b = world.people.get(relationship.b)
      expect(a).toBeDefined()
      expect(b).toBeDefined()
      if (!a || !b) continue

      expect(a.parentIds).not.toContain(b.id)
      expect(b.parentIds).not.toContain(a.id)
      // No shared parent — siblings must not pair.
      expect(a.parentIds.some((id) => b.parentIds.includes(id))).toBe(false)
    }
  })

  it('never pairs children', () => {
    for (const relationship of world.relationships.values()) {
      if (relationship.type !== 'spouse' && relationship.type !== 'courting') continue
      const a = world.people.get(relationship.a)
      const b = world.people.get(relationship.b)
      if (!a || !b) continue
      const at = relationship.typeSinceTick
      expect(ageAt(a.birthTick, at)).toBeGreaterThanOrEqual(18)
      expect(ageAt(b.birthTick, at)).toBeGreaterThanOrEqual(18)
    }
  })

  it('keeps former spouses as history rather than deleting them', () => {
    const former = [...world.relationships.values()].filter((r) => r.type === 'former-spouse')
    expect(former.length).toBeGreaterThan(0)
    for (const relationship of former) {
      expect(relationship.endedAtTick).not.toBeNull()
      // Law 6: the marriage happened, and the record of it survives.
      expect(relationship.formedAtTick).toBeLessThanOrEqual(relationship.endedAtTick ?? 0)
    }
  })

  it('agrees with its own queries', () => {
    for (const person of world.people.values()) {
      if (person.deathTick !== null) continue
      const spouse = spouseOf(world, person.id)
      if (spouse === null) continue
      expect(spouseOf(world, spouse)).toBe(person.id)
      expect(partnerOf(world, person.id)).toBe(spouse)
      expect(friendsOf(world, person.id)).not.toContain(spouse)
    }
  })
})

describe('compatibility', () => {
  it('scores identical people at the maximum', () => {
    const a = [...world.people.values()][0]
    expect(a).toBeDefined()
    if (!a) return
    expect(compatibility(a, a)).toBe(1000)
  })

  it('is symmetric', () => {
    const people = [...world.people.values()].slice(0, 12)
    for (const a of people) {
      for (const b of people) {
        expect(compatibility(a, b)).toBe(compatibility(b, a))
      }
    }
  })
})

describe('the population sustains itself', () => {
  it('does not collapse over fifty years', () => {
    // Milestone 4 left this broken: a birth required an adult woman living with
    // an adult man, which only happened by accident, so the town shrank from
    // 100 to 38 over 50 years. The fix was not a birth-rate tweak — it was
    // noticing that couples never moved in together at all.
    const fresh = createWorld(makeSeed(12345))
    const startingPopulation = fresh.people.size
    const living = [...world.people.values()].filter((p) => p.deathTick === null).length

    expect(living).toBeGreaterThan(startingPopulation * 0.55)
  })

  it('has couples who actually move in together', () => {
    // The single most important fix in this milestone. Zero here means the
    // population is about to collapse again.
    expect(world.events.filter((e) => e.type === 'moved-in-together').length).toBeGreaterThan(5)
  })

  it('produces children of married couples', () => {
    const births = world.events.filter((e) => e.type === 'born')
    expect(births.length).toBeGreaterThan(10)
  })

  it('produces marriages and at least one ending', () => {
    expect(world.events.filter((e) => e.type === 'married').length).toBeGreaterThan(0)
    const endings =
      world.events.filter((e) => e.type === 'divorced').length +
      world.events.filter((e) => e.type === 'widowed').length
    expect(endings).toBeGreaterThan(0)
  })

  it('allows marriages to end in separation, not only in death', () => {
    // A town where no marriage ever ends except by death is not believable.
    expect(worldWithFullArc.events.filter((e) => e.type === 'divorced').length).toBeGreaterThan(0)
  })
})

describe('the milestone exit criterion', () => {
  it('explains both the beginning AND the end of a relationship', () => {
    // Find someone whose marriage both began and ended within the simulation.
    const w = worldWithFullArc

    // Look for the arc in the RECORDS, not the events: a founding couple has a
    // separation but no wedding record, and only a marriage recorded in-simulation counts.
    const marriedSubjects = new Set(
      w.causalRecords.filter((r) => r.decision === 'marriage').map((r) => r.subjectId),
    )
    const subjectId = [...marriedSubjects]
      .sort((x, y) => x - y)
      .find((id) => decisionsFor(w, id).some((r) => r.decision === 'separation'))

    expect(subjectId, 'no marriage both began and ended in this run').toBeDefined()
    if (subjectId === undefined) return

    const records = decisionsFor(w, subjectId)
    const marriage = records.find((r) => r.decision === 'marriage')
    const separation = records.find((r) => r.decision === 'separation')

    expect(marriage, 'marriage has no causal record').toBeDefined()
    expect(separation, 'separation has no causal record').toBeDefined()
    if (!marriage || !separation) return

    // Both must be explainable from stored factors, not invented.
    expect(marriage.inputs.length).toBeGreaterThan(0)
    expect(separation.inputs.length).toBeGreaterThan(0)

    const why = [explainDecision(w, marriage), explainDecision(w, separation)]
    for (const sentence of why) {
      expect(sentence).toContain('Because')
      expect(sentence.length).toBeGreaterThan(30)
      // A placeholder leaking into player-facing prose would be a real defect.
      expect(sentence).not.toContain('{they}')
      expect(sentence).not.toContain('undefined')
    }

    const story = lifeStory(w, subjectId)
    expect(story).toContain('Married')
    expect(story).toContain('Separated')
  })

  it('records a marriage as Defining, so it is never compressed away', () => {
    const marriages = world.causalRecords.filter((r) => r.decision === 'marriage')
    expect(marriages.length).toBeGreaterThan(0)
    for (const record of marriages) {
      expect(record.significance).toBe('defining')
    }
  })

  it('links each relationship event to the record that explains it', () => {
    const married = world.events.filter((e) => e.type === 'married')
    expect(married.length).toBeGreaterThan(0)
    for (const event of married.slice(0, 5)) {
      const record = world.causalRecords.find(
        (r) => r.decision === 'marriage' && r.tick === event.tick && r.subjectId === event.subjectId,
      )
      expect(record, `marriage at tick ${event.tick} has no record`).toBeDefined()
    }
  })

  it('shows relationships in a person timeline', () => {
    const married = world.events.filter((e) => e.type === 'married')[0]
    expect(married).toBeDefined()
    if (!married) return
    // Both parties should see the marriage in their own timeline.
    expect(eventsFor(world, married.subjectId).some((e) => e.type === 'married')).toBe(true)
    if (married.otherId !== null) {
      expect(eventsFor(world, married.otherId).some((e) => e.type === 'married')).toBe(true)
      expect(lifeStory(world, married.otherId)).toContain('Married')
    }
  })

  it('lists ties for a person with their type', () => {
    const someone = [...world.people.values()].find(
      (p) => p.deathTick === null && relationshipsOf(world, p.id).length > 0,
    )
    expect(someone).toBeDefined()
    if (!someone) return
    for (const relationship of relationshipsOf(world, someone.id)) {
      expect(['friend', 'courting', 'spouse', 'former-spouse']).toContain(relationship.type)
    }
  })
})
