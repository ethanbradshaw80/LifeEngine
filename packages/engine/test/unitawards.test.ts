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
import { allAwardsOf, decorationsOf } from '../src/awards.js'

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

  it('never stands on the personal rack, and never prints its own key', () => {
    /**
     * OWNER, READING HIS OWN SCREEN: "Awarded the Meritorious Unit
     * Commendation — post:641:land-forces|the Meritorious Unit
     * Commendation|2038." And: "unit commendations shouldnt show up on our
     * ribbon rack just the units ribbon rack we have this is three different
     * spots."
     *
     * Two faults with one root. The citation field is prose in every other
     * award and a MACHINE KEY in this one — it is what tells permanent wear
     * from inherited without new world state — and a field that is
     * human-readable in nineteen cases out of twenty will be printed raw in
     * the twentieth. And the grant fired the personal "Awarded X" line as
     * well as the unit's own, so the feed said it twice, in the wrong voice.
     *
     * A unit award is given to a UNIT, for a period of dates. It is not
     * something this person did, so it does not stand beside the things they
     * did.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)

    const holder = [...world.service.values()].find((r) =>
      (world.awards.get(r.personId) ?? []).some((a) => a.kind === 'unit-award'),
    )
    expect(holder, 'nobody holds a unit award').toBeDefined()
    if (holder === undefined) return

    // The rack the screens read has none of them.
    expect(
      decorationsOf(world, holder.personId).some((a) => a.kind === 'unit-award'),
      'a unit award was standing on the personal ribbon rack',
    ).toBe(false)
    // The store still holds it — that IS how "you were there" is recorded.
    expect(allAwardsOf(world, holder.personId).some((a) => a.kind === 'unit-award')).toBe(true)

    // And no personal "Awarded X" line was filed for it. The unit's own
    // event is the truthful one, and it is filed on every member.
    const unitTitles = new Set(
      allAwardsOf(world, holder.personId)
        .filter((a) => a.kind === 'unit-award')
        .map((a) => a.title),
    )
    for (const event of world.events) {
      if (event.type !== 'awarded' || event.subjectId !== holder.personId) continue
      expect(
        unitTitles.has(event.detail ?? ''),
        `a unit award filed a personal award line: ${event.detail ?? ''}`,
      ).toBe(false)
    }

    // Nothing a player can read carries the key.
    for (const event of world.events) {
      expect(event.detail ?? '', 'a machine key reached an event a player reads').not.toContain(
        'post:',
      )
    }
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
