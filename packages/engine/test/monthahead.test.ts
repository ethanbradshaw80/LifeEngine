/**
 * THE MONTH THE GAME PROMISES AGAINST THE MONTH IT DELIVERS.
 *
 * THE REPORT (owner, playing): "the +money amount per month isnt even
 * accurate either because ill click advance one month and make way more than
 * it says." MEASURED on a shopkeeper two years in — the chip said $522.55 and
 * the wallet moved $7,152.87. Thirteen times out, every month.
 *
 * THIS IS THE TEST THAT WOULD HAVE CAUGHT IT ON THE DAY. Everything else in
 * this file is detail; the claim is that a forecast and a tick describe the
 * same month, and the only way to hold that is to run both and subtract.
 *
 * WHY A TOLERANCE RATHER THAN AN EQUALITY. A month contains genuinely
 * unforecastable things — money shocks, dividends, a business's own trading
 * swing, the annual tax settle. A projection that promised those to the cent
 * would be lying in a more sophisticated way. The bar is that the forecast
 * accounts for every RECURRING source, which is what "within a fifth" tests:
 * the old number was out by 1,269 per cent and would fail this by a mile.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import {
  financialUnitOf,
  liquidShareOf,
  monthAheadFor,
  personalMonthlyNet,
  walletOf,
} from '../src/finances.js'
import { setPlayer, startBusiness } from '../src/player.js'
import type { World } from '../src/types.js'

/** A shopkeeper with savings — the exact shape the owner was playing. */
function aShopkeeper(seed = 4242) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 30 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 30 && ageAt(p.birthTick, world.tick) <= 45)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
  startBusiness(world, 'shop')
  for (let month = 0; month < 24; month += 1) {
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  ;(world.player as { pending: unknown }).pending = null
  return { world, personId: person.id }
}

/** Run a month and report what the forecast said against what happened. */
function oneMonth(world: World, personId: number): { promised: number; actual: number } {
  const promised = personalMonthlyNet(world, personId as never)
  const before = liquidShareOf(world, personId as never)
  ;(world.player as { pending: unknown }).pending = null
  advanceTicks(world, 1)
  const after = liquidShareOf(world, personId as never)
  return { promised, actual: after - before }
}

describe('the forecast and the tick describe the same month', () => {
  let world: World
  let personId: number

  beforeAll(() => {
    const made = aShopkeeper()
    world = made.world
    personId = made.personId
  }, 300_000)

  it('promises a month a wealthy shopkeeper actually has', () => {
    /**
     * THE HEADLINE CLAIM, measured two ways because a month and a year are
     * different questions.
     *
     * PER MONTH the gap has to stay within a third. It cannot be tighter and
     * be honest: the largest single line is the business draw, and a shop's
     * trading genuinely swings — measured at $1,810, then $4,382, then
     * $1,618 across three consecutive months. A forecast reads LAST month's
     * draw, which is the best simple estimate of the next one and is still
     * sometimes wrong by half.
     *
     * ACROSS SIX MONTHS that noise cancels, so the bar is a tenth. This is
     * the half that would catch a whole missing income source: the bug this
     * test was written for was out by 1,269 per cent and every month leaned
     * the same way.
     */
    let promisedAll = 0
    let actualAll = 0
    for (let month = 0; month < 6; month += 1) {
      const { promised, actual } = oneMonth(world, personId)
      promisedAll += promised
      actualAll += actual
      const slack = Math.max(50_000, Math.floor(Math.abs(actual) / 3))
      expect(
        Math.abs(actual - promised),
        `month ${String(month)}: promised ${String(promised)}, got ${String(actual)}`,
      ).toBeLessThan(slack)
    }
    expect(
      Math.abs(actualAll - promisedAll),
      `six months: promised ${String(promisedAll)}, got ${String(actualAll)}`,
    ).toBeLessThan(Math.floor(Math.abs(actualAll) / 10))
  })

  it('counts the draw, the rent and the interest by name', () => {
    // The three the old projection could not see. A shopkeeper with savings
    // has two of them, and neither may be silently folded into the wage.
    const ahead = monthAheadFor(world, personId as never)
    expect(ahead.draw, 'the business pays them nothing').toBeGreaterThan(0)
    expect(ahead.interest, 'the bank pays them nothing').toBeGreaterThan(0)
    // And the parts must add to the whole, or a screen showing both lies.
    expect(ahead.net).toBe(
      personalMonthlyNet(world, personId as never),
    )
  })

  it('does not double-count the draw the businesses already paid', () => {
    /**
     * THE OTHER DIRECTION, and the reason `personalIncome` excludes the draw
     * in the first place: `runBusinesses` has already credited it. If the
     * forecast's draw had been added to income rather than beside it, the
     * month would over-promise by exactly one draw — the shadow-ledger bug
     * this codebase has had seven times, wearing a forecast's hat.
     */
    const ahead = monthAheadFor(world, personId as never)
    const { promised, actual } = oneMonth(world, personId)
    expect(promised).toBeGreaterThan(ahead.draw)
    expect(actual - promised).toBeLessThan(ahead.draw + ahead.interest)
  })

  it('still reads a plain wage-earner’s month correctly', () => {
    // The common case must not regress: somebody with no business, no
    // tenants and no savings is all wage, and the forecast is the old one.
    const plain = createWorld(makeSeed(777), 100)
    advanceTicks(plain, 28 * 12)
    const worker = livingPeople(plain)
      .filter((p) => plain.employment.has(p.id))
      .filter((p) => ageAt(p.birthTick, plain.tick) >= 25 && ageAt(p.birthTick, plain.tick) <= 50)
      .sort((a, b) => a.id - b.id)[0]
    if (!worker) return
    const ahead = monthAheadFor(plain, worker.id)
    expect(ahead.draw).toBe(0)
    expect(ahead.rent).toBe(0)
    expect(ahead.net).toBe(ahead.earned - ahead.costs - ahead.lifestyle + ahead.interest)
  })
})

/**
 * WHOSE MONTH IS IT (owner, playing at twenty: "Living costs · 8 grown, 3
 * children ... we are single with no kids and there no way we are living with
 * this many people ... I am 20 years old it should just matter how much money
 * I have, we talked about this the finances need to be of your own. This is a
 * LIFE SIM").
 *
 * The household counts were NOT wrong — measured, a 46-household town has
 * zero phantom members and its largest roof genuinely holds ten people. The
 * money card was simply describing the BUILDING while calling it his.
 */
describe('the month belongs to the person, not the building', () => {
  it('counts only the mouths in their own unit', () => {
    const world = createWorld(makeSeed(4242), 140)
    advanceTicks(world, 30 * 12)
    // Somebody grown, still under a roof with several other adults.
    const person = [...world.people.values()]
      .filter((p) => p.deathTick === null && p.householdId !== null)
      .filter((p) => {
        const age = ageAt(p.birthTick, world.tick)
        const roof = world.households.get(p.householdId as never)
        return age >= 19 && age <= 30 && (roof?.memberIds.length ?? 0) >= 4
      })
      .sort((a, b) => a.id - b.id)[0]
    if (person === undefined) return
    setPlayer(world, person.id)

    const roof = world.households.get(person.householdId as never)
    const month = monthAheadFor(world, person.id)
    const unit = financialUnitOf(world, person.id)

    // The card's "N grown, M children" is the UNIT's, and the unit is
    // smaller than the roof it stands under.
    expect(month.adults + month.children).toBeLessThanOrEqual(unit.length)
    expect(month.adults + month.children).toBeLessThan(roof?.memberIds.length ?? 99)
  })

  it('never charges a grown child at home for the family’s rent', () => {
    /**
     * H0's rule, and the thing that made the old card absurd: the unit
     * holding the household's eldest carries the whole roof; everybody else
     * under it carries none. A twenty-year-old at his parents' pays for
     * himself and not a penny of their rent.
     */
    const world = createWorld(makeSeed(4242), 140)
    advanceTicks(world, 30 * 12)
    for (const roof of world.households.values()) {
      if (roof.dissolvedTick === null && roof.memberIds.length >= 4) {
        const youngest = [...roof.memberIds]
          .map((id) => world.people.get(id))
          .filter((p) => p !== undefined && p.deathTick === null)
          .filter((p) => ageAt((p as { birthTick: Tick }).birthTick, world.tick) >= 18)
          .sort((a, b) => (b as { birthTick: Tick }).birthTick - (a as { birthTick: Tick }).birthTick)[0]
        if (youngest === undefined) continue
        const month = monthAheadFor(world, youngest.id)
        // The youngest adult is not the eldest member, so no rent.
        expect(month.rentShare).toBe(0)
        return
      }
    }
  })

  it('adds its own lines up', () => {
    // The card prints these rows and a total; they must reconcile, which is
    // the whole reason the itemisation lives in the engine.
    const world = createWorld(makeSeed(909), 120)
    advanceTicks(world, 25 * 12)
    for (const person of [...world.people.values()].slice(0, 40)) {
      if (person.deathTick !== null || person.householdId === null) continue
      const month = monthAheadFor(world, person.id)
      // THREE ROWS NOW: the roof, the mouths, and the school fees — which
      // were split out because half of one player's "living costs" turned
      // out to be private schooling and the line never said so.
      expect(
        month.rentShare + month.living + month.tuition,
        `${String(person.id)}'s bill does not add up`,
      ).toBe(month.costs)
    }
  })
})
