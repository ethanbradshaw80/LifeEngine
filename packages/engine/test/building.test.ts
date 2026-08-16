/**
 * BUILDING RATHER THAN BUYING — the second money sink.
 *
 * THE REPORT (owner): "houses run out, you dont even get like more expensive
 * houses options to you once you make stupid money like that."
 *
 * MEASURED before a line was written: a forty-year town holds 112 properties
 * of which TWO are estates, the dearest building in the county is worth
 * $615,191, and `generateProperties` runs ONCE at worldgen so not one new
 * house is raised in eighty years.
 *
 * THE CLAIMS: a fortune can raise what the market cannot sell; it costs more
 * than it is worth, so this is a way to spend money rather than to grow it;
 * the same decision in the same world always builds the same house; and the
 * town's own streets are untouched by the fact that the option exists.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { walletOf } from '../src/finances.js'
import {
  buildOffersFor,
  commissionBar,
  commissionBuildPlayer,
  setPlayer,
} from '../src/player.js'
import { buildCostFor, plannedBuild, propertiesOwnedBy, valueOf } from '../src/realestate.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function aBuilder(savings = 9_000_000_00) {
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

function aStreet(world: World) {
  for (const id of world.town.placeIds) {
    const place = world.places.get(id)
    if (place?.kind === 'neighbourhood') return place
  }
  throw new Error('no streets')
}

let world: World
let personId: number

beforeEach(() => {
  const made = aBuilder()
  world = made.world
  personId = made.person.id
})

describe('a fortune can raise what the market cannot sell', () => {
  it('builds something dearer than anything standing', () => {
    const dearestStanding = [...world.properties.values()]
      .map((p) => valueOf(world, p))
      .reduce((top, v) => Math.max(top, v), 0)
    const manor = buildOffersFor(world).find((o) => o.type === 'manor' && o.bar === null)
    expect(manor, 'a manor is out of reach even to a millionaire').toBeDefined()
    expect(manor?.worth ?? 0, 'the top tier is no better than the market').toBeGreaterThan(
      dearestStanding,
    )
  })

  it('puts the deed in their hands, new and never lived in', () => {
    const street = aStreet(world)
    const before = propertiesOwnedBy(world, personId as never).length
    const done = commissionBuildPlayer(world, street.id, 'manor')
    expect(done.done, done.reason).toBe(true)
    const owned = propertiesOwnedBy(world, personId as never)
    expect(owned.length).toBe(before + 1)
    const built = owned.find((p) => p.type === 'manor')
    expect(built?.condition, 'a new house is not a new house').toBe(1000)
    expect(built?.boughtForCents ?? 0).toBeGreaterThan(0)
  })
})

describe('it is a way to spend money, not to make it', () => {
  it('always costs more than the thing is worth', () => {
    /**
     * THE PREMIUM IS THE WHOLE SINK. Without it, commissioning would be a
     * machine for turning cash into MORE value than the cash — the exact
     * shape of the "start a business worth 553k for 9k" exploit already
     * closed once in this codebase.
     */
    for (const offer of buildOffersFor(world)) {
      expect(offer.cost, `${offer.type} on ${offer.street} builds at a profit`).toBeGreaterThan(
        offer.worth,
      )
    }
  })

  it('takes the money out of the wallet, to the cent', () => {
    /**
     * THE WALLET, NOT THE HALF-SHARE — and this test caught the difference.
     * Under H0 a married couple keep ONE pot; `debitPerson` spends that pot,
     * so the first version of this assertion measured `liquidShareOf` and
     * found exactly HALF the cost gone. The money was right and the reading
     * was wrong, which is the same confusion behind the owner's "you have
     * zero / my money is 1.9 million" report.
     */
    const street = aStreet(world)
    const purse = () => {
      const w = walletOf(world, personId as never)
      return w.checking + w.savings
    }
    const before = purse()
    const planned = plannedBuild(world, street.id, 'estate', 2000)
    expect(planned).toBeDefined()
    if (!planned) return
    const cost = buildCostFor(world, planned)
    expect(commissionBuildPlayer(world, street.id, 'estate').done).toBe(true)
    expect(before - purse()).toBe(cost)
  })

  it('refuses what they cannot cover, and the verb agrees with the screen', () => {
    const broke = aBuilder(0)
    const street = aStreet(broke.world)
    const bar = commissionBar(broke.world, broke.person.id, street.id, 'manor')
    expect(bar).not.toBeNull()
    expect(bar).toContain('comes to')
    expect(commissionBuildPlayer(broke.world, street.id, 'manor').done).toBe(false)
  })
})

describe('it does not disturb the town', () => {
  it('builds the same house from the same decision, every time', () => {
    // No RNG is consumed — `generateProperties` consumes none either, and a
    // draw here would shift every later roll in the world.
    const a = plannedBuild(world, aStreet(world).id, 'manor', 1999)
    const b = plannedBuild(world, aStreet(world).id, 'manor', 1999)
    expect(a?.id).toBe(b?.id)
    expect(a?.address).toBe(b?.address)
  })

  it('never builds on a plot that is already taken', () => {
    const street = aStreet(world)
    expect(commissionBuildPlayer(world, street.id, 'house').done).toBe(true)
    // The next build on that street is a DIFFERENT plot, not a refusal.
    const second = commissionBuildPlayer(world, street.id, 'house')
    expect(second.done, second.reason).toBe(true)
    const built = propertiesOwnedBy(world, personId as never).filter((p) => p.type === 'house')
    expect(new Set(built.map((p) => p.id)).size).toBe(built.length)
  })

  it('leaves no manor standing in a town nobody built one in', () => {
    // The tier exists in the type and in NO street's stock: `typesFor` never
    // returns it. A player who never builds sees exactly the town that was
    // always there, which is why adding the tier moved no golden.
    const untouched = createWorld(makeSeed(4242), 100)
    advanceTicks(untouched, 30 * 12)
    const manors = [...untouched.properties.values()].filter((p) => p.type === 'manor')
    expect(manors).toEqual([])
  })

  it('leaves a record the retrospective can read', () => {
    const street = aStreet(world)
    commissionBuildPlayer(world, street.id, 'estate')
    const event = world.events.find((e) => e.type === 'built-home' && e.subjectId === personId)
    expect(event, 'nothing was written down').toBeDefined()
    const why = world.causalRecords.find(
      (r) => r.subjectId === personId && r.chosen.startsWith('built'),
    )
    expect(why, 'a house with no cause on the record').toBeDefined()
  })
})
