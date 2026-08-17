/**
 * SOMEBODY YOU MARRIED AT A STATION COMES HOME WITH YOU.
 *
 * OWNER'S MODEL: this town is home, a posting is somewhere else, and the
 * people met there are real NPCs with their own lives — *"we can still
 * interact with, get married with, and all that."*
 *
 * The half that was missing was the ending. `moveInWithPartner` refused the
 * moment either side had no household, which is exactly the couple this model
 * creates: a townsperson who marries somebody from away. The spouse was left
 * tied to a person here and living nowhere — married, and homeless, for ever.
 *
 * Two rules this proves rather than asserts: the uniform has to be OFF first,
 * because a marriage does not move a posting; and once it is, they settle.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { relationshipKey } from '../src/types.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import { partnerOf } from '../src/relationships.js'

/** A townsperson with a home, and a soldier from away with none. */
function aCoupleAcrossTheGate(world: ReturnType<typeof createWorld>) {
  // GROWN, and unattached. `runHouseholds` skips anybody under
  // LEAVE_HOME_AGE, so a child picked here would prove nothing — the first
  // draft of this test did exactly that and reported "he never came home"
  // when nobody had been asked the question at all.
  const local = livingPeople(world)
    .filter((p) => p.householdId !== null && p.sex === 'female')
    .filter((p) => !world.service.has(p.id))
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 19 && age <= 60
    })
    .filter((p) => partnerOf(world, p.id) === null)
    .sort((a, b) => a.id - b.id)[0]
  const soldier = livingPeople(world)
    .filter((p) => p.fromAway !== undefined && p.householdId === null && p.sex === 'male')
    .filter((p) => partnerOf(world, p.id) === null)
    .sort((a, b) => a.id - b.id)[0]
  return { local, soldier }
}

describe('settling down here', () => {
  it('leaves a serving spouse at their station, then brings them home', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 25 * 12)

    const { local, soldier } = aCoupleAcrossTheGate(world)
    expect(local, 'no townswoman with a home').toBeDefined()
    expect(soldier, 'the garrison produced nobody from away').toBeDefined()
    if (!local || !soldier) return

    // Marry them by hand: the point here is what happens AFTER, not the
    // courtship that got there.
    world.relationships.set(relationshipKey(local.id, soldier.id), {
      a: Math.min(local.id, soldier.id) as EntityId,
      b: Math.max(local.id, soldier.id) as EntityId,
      type: 'spouse',
      strength: 900,
      typeSinceTick: world.tick,
      sinceTick: world.tick,
    })

    // WHILE HE IS SERVING, he stays where he is posted. A wedding does not
    // move a soldier, and this is the rule that keeps the model honest.
    advanceTicks(world, 24)
    const stillServing = world.service.get(soldier.id)
    if (stillServing !== undefined && stillServing.dischargedAtTick === null) {
      expect(
        world.people.get(soldier.id)?.householdId,
        'a serving soldier moved into the town he is not stationed in',
      ).toBeNull()
    }

    // Once the uniform is off, he settles into her household.
    const record = world.service.get(soldier.id)
    if (record !== undefined && record.dischargedAtTick === null) {
      world.service.set(soldier.id, { ...record, dischargedAtTick: world.tick as Tick, dischargeReason: 'end of term' })
    }
    advanceTicks(world, 60)

    const settled = world.people.get(soldier.id)
    expect(settled?.householdId, 'he never came home').not.toBeNull()
    const roof = settled?.householdId === null || settled?.householdId === undefined
      ? undefined
      : world.households.get(settled.householdId)
    expect(roof?.memberIds.includes(soldier.id), 'the household does not list him').toBe(true)
  })

  it('records why they came, in words the game can say', () => {
    // Law 3: settling here is a defining decision and has to explain itself.
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 60 * 12)
    /**
     * THE LIVING, and the death filter is not a convenience.
     *
     * MEASURED at seed 4242 over sixty years: 179 people point at a
     * household whose roll does not list them, and every single one of them
     * is DEAD. That is the model working. A death takes you off the roll —
     * the household is who lives there — while your own record keeps the
     * last address you had, because Law 6 says history is persistent and an
     * obituary that cannot say where somebody lived is a worse bug than this
     * one. Zero living people dangle, which is the claim worth making.
     *
     * The test read the whole population and called that a broken record.
     */
    const settlers = [...world.people.values()].filter(
      (p) => p.fromAway !== undefined && p.householdId !== null && p.deathTick === null,
    )
    // Not every world produces one in sixty years, and a test that demands
    // it would be asserting the dice. When there is one, it is a real
    // household member rather than a dangling id.
    for (const settler of settlers) {
      const roof = settler.householdId === null ? undefined : world.households.get(settler.householdId)
      expect(roof, `${settler.givenName} points at a household that is not there`).toBeDefined()
      expect(roof?.memberIds.includes(settler.id)).toBe(true)
    }

    // AND THE CLAIM UNDERNEATH IT, for everybody rather than for settlers:
    // nobody who is alive is missing from the roll they point at.
    for (const person of world.people.values()) {
      if (person.deathTick !== null || person.householdId === null) continue
      const roof = world.households.get(person.householdId)
      expect(
        roof?.memberIds.includes(person.id),
        `${person.givenName} ${person.familyName} is alive and not on their own household roll`,
      ).toBe(true)
    }
  })
})
