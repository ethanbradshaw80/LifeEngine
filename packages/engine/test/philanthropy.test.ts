/**
 * GIVING IT AWAY — the first of the money sinks.
 *
 * THE CLAIMS: the money is genuinely GONE (a sink that quietly returns value
 * is not a sink); the town is better for it in a way that is a real field
 * rather than a cosmetic one; the family name goes on ONCE and outlives the
 * person who bought it; and every refusal on the screen is the same function
 * the verb enforces.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { walletOf } from '../src/finances.js'
import { causesFor, endowPlayer, giveBar, setPlayer } from '../src/player.js'
import { causePlaces, giftTermsFor } from '../src/philanthropy.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function aGiver(savings = 900_000_000) {
  const world = createWorld(makeSeed(4242), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 50)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of age')
  setPlayer(world, person.id)
  ;(world.player as { pending: unknown }).pending = null
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: savings as Money })
  return { world, person }
}

let world: World
let personId: number

beforeEach(() => {
  const made = aGiver()
  world = made.world
  personId = made.person.id
})

describe('there is somewhere to give', () => {
  it('offers the town’s own institutions and nobody’s business', () => {
    const causes = causesFor(world)
    expect(causes.length).toBeGreaterThan(0)
    for (const cause of causes) {
      const place = world.places.get(cause.placeId as never)
      expect(place).toBeDefined()
      // A foundry is somebody's livelihood, not a public good.
      expect(place?.kind === 'school' || place?.kind === 'civic').toBe(true)
      expect(cause.offers).toHaveLength(3)
    }
  })

  it('says the price at TODAY’S money, not the base year', () => {
    // The gifts are written in base-year cents like every other price in
    // this world; a player in 2005 must be quoted 2005's number.
    const cause = causesFor(world)[0]
    expect(cause).toBeDefined()
    const gift = cause?.offers.find((o) => o.tier === 'gift')
    const base = giftTermsFor('gift')?.cost ?? 0
    expect(gift?.cost ?? 0).toBeGreaterThan(base)
  })
})

describe('the money is actually gone', () => {
  it('takes it out of the wallet and does not give it back', () => {
    const place = causePlaces(world)[0]
    expect(place).toBeDefined()
    if (!place) return
    // The couple's pot, which is what `debitPerson` actually spends under H0.
    const purse = () => {
      const w = walletOf(world, personId as never)
      return w.checking + w.savings
    }
    const before = purse()
    const done = endowPlayer(world, place.id, 'wing')
    expect(done.done, done.reason).toBe(true)
    expect(purse()).toBeLessThan(before)
  })

  it('refuses when it cannot be covered, and says the price', () => {
    const poor = aGiver(0)
    const place = causePlaces(poor.world)[0]
    expect(place).toBeDefined()
    if (!place) return
    const bar = giveBar(poor.world, poor.person.id, place.id, 'endowment')
    expect(bar).not.toBeNull()
    expect(bar).toContain('It takes')
    // AND THE VERB AGREES WITH THE SCREEN — the bar pattern. A card that
    // says you cannot and a button that lets you would be the bug.
    expect(endowPlayer(poor.world, place.id, 'endowment').done).toBe(false)
  })
})

describe('the town is better for it', () => {
  it('lifts the place, and a gift alone does not', () => {
    const place = causePlaces(world)[0]
    if (!place) return
    const before = place.desirability
    endowPlayer(world, place.id, 'gift')
    expect(world.places.get(place.id)?.desirability, 'a cheque changed the bricks').toBe(before)
    endowPlayer(world, place.id, 'wing')
    expect(world.places.get(place.id)?.desirability).toBeGreaterThan(before)
  })

  it('never pushes a place past the top of the scale', () => {
    const place = causePlaces(world)[0]
    if (!place) return
    world.places.set(place.id, { ...place, desirability: 990 })
    endowPlayer(world, place.id, 'endowment')
    expect(world.places.get(place.id)?.desirability).toBeLessThanOrEqual(1000)
  })
})

describe('the name outlives the person', () => {
  it('puts the family name over the door, and keeps the place’s own name', () => {
    /**
     * BOTH, DELIBERATELY. Half this town's machinery matches places BY NAME
     * — `workplaceNamesFor` seats a teacher at "the public library" by
     * string — so renaming it would quietly stop education careers finding
     * anywhere to work.
     */
    const place = causePlaces(world)[0]
    if (!place) return
    const wasCalled = place.name
    const done = endowPlayer(world, place.id, 'endowment')
    expect(done.done, done.reason).toBe(true)
    const after = world.places.get(place.id)
    expect(after?.name, 'the town lost the place it knew').toBe(wasCalled)
    expect(after?.endowedBy).toBe(world.people.get(personId as never)?.familyName)
  })

  it('goes on once — a later fortune cannot buy over it', () => {
    const place = causePlaces(world)[0]
    if (!place) return
    expect(endowPlayer(world, place.id, 'endowment').done).toBe(true)
    const second = endowPlayer(world, place.id, 'endowment')
    expect(second.done).toBe(false)
    expect(second.reason).toContain('once')
  })

  it('survives the person who bought it', () => {
    // Law 8. The whole argument for this being the first sink built.
    const place = causePlaces(world)[0]
    if (!place) return
    endowPlayer(world, place.id, 'endowment')
    const name = world.places.get(place.id)?.endowedBy
    advanceTicks(world, 40 * 12)
    expect(world.places.get(place.id)?.endowedBy, 'the name came off the door').toBe(name)
  })

  it('leaves a record the retrospective can read', () => {
    // Law 3: everything important has a cause on the record.
    const place = causePlaces(world)[0]
    if (!place) return
    endowPlayer(world, place.id, 'endowment')
    const event = world.events.find((e) => e.type === 'endowed' && e.subjectId === personId)
    expect(event, 'nothing was written down').toBeDefined()
    const why = world.causalRecords.find(
      (r) => r.subjectId === personId && r.decision === 'philanthropy',
    )
    expect(why, 'a gift with no cause on the record').toBeDefined()
    expect(why?.chosen).toContain('endowed')
  })
})
