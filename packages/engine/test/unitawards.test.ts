/**
 * UNIT AWARDS, AND THE MECHANIC THAT MAKES THEM WORTH HAVING.
 *
 * OWNER: "unit awards are different from people awards." They are, and the
 * difference is two real rules: the award goes to the UNIT for a PERIOD OF
 * DATES, and wear is PERMANENT for anybody present during that period but
 * TEMPORARY for anybody who arrived after — worn only while they stay.
 *
 * Two soldiers wearing the same ribbon, one who earned it and one who
 * inherited it, and both of them know which.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { unitAwardsFor, unitHonoursOf, unitKeyOf } from '../src/unitawards.js'

describe('unit awards', () => {
  it('are earned, and the town earns some', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    let decorated = 0
    for (const awards of world.awards.values()) {
      if (awards.some((a) => a.kind === 'unit-award')) decorated += 1
    }
    expect(decorated, 'no unit in the whole town was ever decorated').toBeGreaterThan(0)
  })

  it('can be earned without a war, which is the point of the third one', () => {
    /**
     * The Meritorious Unit Commendation is awarded for sustained outstanding
     * service COMBAT OR NOT. It is the answer to "the military is only worth
     * playing during a war" — a maintenance company can be decorated.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    let meritorious = 0
    for (const awards of world.awards.values()) {
      for (const a of awards) {
        if (a.kind === 'unit-award' && a.title.includes('Meritorious')) meritorious += 1
      }
    }
    expect(meritorious, 'only wars ever decorated a unit').toBeGreaterThan(0)
  })

  it('is worn for life by those present, and only borrowed by those who came later', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)

    let sawPermanent = false
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const standing = unitAwardsFor(world, record.personId)
      if (standing.length === 0) continue
      const key = unitKeyOf(world, record.personId)
      if (key === null) continue
      const honours = unitHonoursOf(world, key)

      for (const worn of standing) {
        if (worn.permanent) {
          sawPermanent = true
          // A permanent one is on their OWN record — they were there.
          expect(
            (world.awards.get(record.personId) ?? []).some(
              (a) =>
                a.kind === 'unit-award' &&
                a.title === worn.title &&
                Number(a.citation.split('|')[2] ?? '0') === worn.year,
            ),
          ).toBe(true)
        } else {
          // A borrowed one belongs to the unit they are standing in now, and
          // is NOT on their own record.
          expect(honours.some((h) => h.title === worn.title && h.year === worn.year)).toBe(true)
          /**
           * TITLE AND YEAR TOGETHER. The same decoration can be held twice
           * over for different periods — earned with the unit in 1985 and
           * inherited from its 1992 citation — so comparing titles alone
           * called a legitimately borrowed ribbon a corrupted record.
           */
          expect(
            (world.awards.get(record.personId) ?? []).some(
              (a) =>
                a.kind === 'unit-award' &&
                a.title === worn.title &&
                Number(a.citation.split('|')[2] ?? '0') === worn.year,
            ),
            'an inherited award was written onto a personal record',
          ).toBe(false)
        }
      }
    }
    expect(sawPermanent, 'nobody was present for their own unit’s award').toBe(true)
  })

  it('keeps a permanent award after leaving the unit, and drops a borrowed one', () => {
    // The rule that makes it belonging rather than decoration: post out and
    // an inherited ribbon comes off; one you earned never does.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const holder = [...world.service.values()].find((r) =>
      (world.awards.get(r.personId) ?? []).some((a) => a.kind === 'unit-award'),
    )
    expect(holder, 'nobody holds a unit award').toBeDefined()
    if (holder === undefined) return

    const before = unitAwardsFor(world, holder.personId).filter((a) => a.permanent).length
    // Move them to another station entirely.
    const elsewhere = [...world.places.values()].find(
      (p) => p.kind === 'base' && p.id !== holder.baseId,
    )
    if (elsewhere === undefined) return
    world.service.set(holder.personId, { ...holder, baseId: elsewhere.id, unitId: null })

    const after = unitAwardsFor(world, holder.personId).filter((a) => a.permanent).length
    expect(after, 'a permanent unit award was lost by moving posting').toBe(before)
  })
})
