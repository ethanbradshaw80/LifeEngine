/**
 * ONE ADULT ON THEIR OWN IS A HOUSEHOLD.
 *
 * OWNER, PLAYING: "It doesnt count a single person with no kids as a
 * household so I cant move in or rent anywhere it just says home -".
 *
 * It was a trap rather than a rule, and it was locked from every side.
 * Households are only ever formed by splitting OFF an existing one —
 * `leaveHome` reads the parental roof and moves out of it — so somebody with
 * no household had no way to acquire one. Renting asked for a household.
 * Moving asked for a household. And the pass that makes households skipped
 * him for not having one.
 *
 * A soldier in barracks, a veteran who separated and settled here, the last
 * of a family: all of them stood outside the housing system for ever, with
 * the screen saying "Home —".
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { lookForPlace, moveBar, setPlayer } from '../src/player.js'
import { placesOfKind } from '../src/worldgen.js'
import { livingPeople } from '../src/systems.js'

/** Somebody grown, alive, and with no household at all. */
function anAdultWithNoHome(world: ReturnType<typeof createWorld>): EntityId | undefined {
  return livingPeople(world)
    .filter((p) => p.householdId === null)
    .filter((p) => world.tick - p.birthTick >= 20 * 12)
    .sort((a, b) => a.id - b.id)[0]?.id
}

describe('a household of one', () => {
  it('does not refuse to move somebody who has no home', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)
    const personId = anAdultWithNoHome(world)
    expect(personId, 'everybody in this world has a home').toBeDefined()
    if (personId === undefined) return

    const street = placesOfKind(world, 'neighbourhood').sort((a, b) => a.id - b.id)[0]
    expect(street).toBeDefined()
    if (street === undefined) return

    // The bar used to say "There is no household to move." — to the one
    // person for whom moving is the entire point.
    expect(
      moveBar(world, personId, street.id, world.tick),
      'refused the move for want of the thing the move creates',
    ).toBeNull()
  })

  it('opens a household the day they take an address', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)
    const personId = anAdultWithNoHome(world)
    if (personId === undefined) return
    const street = placesOfKind(world, 'neighbourhood').sort((a, b) => a.id - b.id)[0]
    if (street === undefined) return

    setPlayer(world, personId)
    ;(world.player as { pending: unknown }).pending = null
    const moved = lookForPlace(world, street.id)
    expect(moved.moved, `refused: ${moved.reason}`).toBe(true)

    const after = world.people.get(personId)
    expect(after?.householdId, 'still no household after moving in').not.toBeNull()
    const home = after?.householdId === null || after?.householdId === undefined
      ? undefined
      : world.households.get(after.householdId)
    expect(home, 'the household id points at nothing').toBeDefined()
    expect(home?.memberIds, 'the household does not contain them').toContain(personId)
    expect(home?.placeId, 'the household is not on the street they moved to').toBe(street.id)
    expect(home?.dissolvedTick).toBeNull()
  })

  it('leaves everybody else exactly where they were', () => {
    // The new door must not disturb the ordinary path: people who already
    // have a household still move house rather than acquiring a second one.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 25 * 12)
    const settled = livingPeople(world)
      .filter((p) => p.householdId !== null)
      .sort((a, b) => a.id - b.id)[0]
    if (settled === undefined) return
    const before = settled.householdId
    const street = placesOfKind(world, 'neighbourhood').sort((a, b) => b.id - a.id)[0]
    if (street === undefined) return

    setPlayer(world, settled.id)
    ;(world.player as { pending: unknown }).pending = null
    lookForPlace(world, street.id)
    expect(world.people.get(settled.id)?.householdId, 'a second household was opened').toBe(before)
  })
})
