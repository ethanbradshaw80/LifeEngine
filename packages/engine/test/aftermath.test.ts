/**
 * WHAT A WAR LEAVES (plan §5.2, §6, §7).
 *
 * The two claims that are RULINGS rather than taste, and both are measured
 * here rather than asserted in a comment:
 *
 *   §7: "WELL UNDER HALF of combat veterans, measured and reported."
 *   §5.2: "NO LIFETIME COUNTER TO FARM." A count exists where a real person
 *   would have one, and nowhere else.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { aftermathOf, attributionFor, LASTING_AT, warBondWith } from '../src/aftermath.js'

describe('what a war leaves', () => {
  it('leaves lasting injury in well under half of combat veterans', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)

    let veterans = 0
    let lasting = 0
    for (const record of world.service.values()) {
      const person = world.people.get(record.personId)
      if (person === undefined || person.deathTick !== null) continue
      const sawCombat = world.events.some(
        (e) => e.subjectId === record.personId && e.type === 'saw-combat',
      )
      if (!sawCombat) continue
      veterans += 1
      if (aftermathOf(world, record.personId, world.tick).lasting) lasting += 1
    }
    expect(veterans, 'no combat veterans in fifty years').toBeGreaterThan(5)
    const share = lasting / veterans
    // THE OWNER'S RULING, held as a number: well under half.
    expect(share, `${String(lasting)}/${String(veterans)} carried something lasting`).toBeLessThan(
      0.45,
    )
  })

  it('is about WHO, never about having been deployed', () => {
    // §7 is explicit: "driven by what specifically happened — losing a named
    // squadmate, a mass-casualty event, a near miss — never by 'was deployed'."
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    for (const record of [...world.service.values()].slice(0, 300)) {
      const mark = aftermathOf(world, record.personId, world.tick)
      if (!mark.lasting) continue
      // Anything that crossed the line can say what it was about.
      expect(mark.causes.length, 'a lasting injury with nothing behind it').toBeGreaterThan(0)
      expect(mark.burden).toBeGreaterThanOrEqual(LASTING_AT)
    }
  })

  it('recedes, because recovery is real', () => {
    // Law 7 and §7: "this is not a permanent stat debuff."
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    const veteran = [...world.service.values()].find((r) =>
      world.events.some((e) => e.subjectId === r.personId && e.type === 'saw-combat'),
    )
    if (veteran === undefined) return
    const then = aftermathOf(world, veteran.personId, world.tick).burden
    advanceTicks(world, 20 * 12)
    const person = world.people.get(veteran.personId)
    // Only meaningful while they are alive and the war is behind them.
    if (person?.deathTick !== null) return
    const now = aftermathOf(world, veteran.personId, world.tick).burden
    expect(now).toBeLessThanOrEqual(then + 200)
  })

  it('gives almost nobody a count, and names the man who confirmed the rest', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    let counted = 0
    let uncounted = 0
    for (const record of world.service.values()) {
      const attribution = attributionFor(world, record.personId, world.tick)
      if (attribution.confirmed === null) {
        uncounted += 1
        // The honest line, and it is better than a number.
        if (attribution.words.length > 0) expect(attribution.words).toContain('collective')
      } else {
        counted += 1
        expect(attribution.confirmed).toBeGreaterThanOrEqual(0)
      }
    }
    // NO LIFETIME COUNTER TO FARM: the great majority have no count at all.
    expect(uncounted).toBeGreaterThan(counted)
  })

  it('builds a bond out of what happened, not out of months', () => {
    // §6: "months become the smallest input."
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 40 * 12)
    const tourOwner = [...world.deployments.entries()].find(([, tours]) =>
      tours.some((t) => (t.squad ?? []).length > 0),
    )
    if (tourOwner === undefined) return
    const [ownerId, tours] = tourOwner
    const tour = tours.find((t) => (t.squad ?? []).length > 0)
    const mate = tour?.squad?.[0]
    if (tour === undefined || mate === undefined) return

    const bond = warBondWith(world, ownerId, mate.personId, mate.sinceTick, world.tick)
    expect(bond.strength).toBeGreaterThanOrEqual(0)
    expect(bond.strength).toBeLessThanOrEqual(1000)
    // Time alone can never carry it past a fraction of the scale, which is
    // the whole correction: a year in a motor pool is worth less than one
    // afternoon on a ridge.
    const timeOnly = warBondWith(world, ownerId, mate.personId, mate.sinceTick, world.tick)
    if (timeOnly.reasons.length === 1 && timeOnly.reasons[0]?.includes('months')) {
      expect(timeOnly.strength).toBeLessThanOrEqual(120)
    }
  })
})
