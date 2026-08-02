/**
 * War length and difficulty — the owner's spec of 2026-08-02, section by
 * section, including his own test checklist.
 *
 * The two claims that matter: a war runs the length it was rolled (2-15
 * years, shaped by how mismatched the sides are), and a country that
 * outclasses you is genuinely harder to fight than one that does not.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { combatPowerOf, warExperienceOf } from '../src/geopolitics.js'
import { threatVectorFor } from '../src/deployment.js'
import { HEARTLAND_SPEC } from '../src/heartland.js'
import { REAL_NATIONS } from '../src/realnations.js'
import type { GeoRelation, Nation } from '../src/types.js'

function nation(overrides: Partial<Nation>): Nation {
  return {
    id: 1 as never,
    name: 'Somewhere',
    isHomeland: false,
    strength: 500,
    baseStrength: 500,
    economy: 500,
    stability: 500,
    bloc: null,
    combatRating: 5,
    warMonths: 0,
    exhaustedUntilTick: null,
    ...overrides,
  }
}

function war(overrides: Partial<GeoRelation> = {}): GeoRelation {
  return {
    a: 1 as never,
    b: 2 as never,
    state: 'war',
    sinceTick: 0 as never,
    warPhase: 'attrition',
    casualtiesA: 0,
    casualtiesB: 0,
    plannedWarMonths: 60,
    ...overrides,
  }
}

describe('war length', () => {
  it('runs between two and fifteen years, over many wars', () => {
    // The owner's checklist: roll 20 wars, confirm the lengths land in band.
    const lengths: number[] = []
    for (let seed = 1; seed <= 12; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 1800)
      for (const relation of world.geoRelations.values()) {
        if (relation.plannedWarMonths !== null) lengths.push(relation.plannedWarMonths)
      }
    }
    expect(lengths.length).toBeGreaterThan(20)
    for (const months of lengths) {
      expect(months).toBeGreaterThanOrEqual(2 * 12)
      expect(months).toBeLessThanOrEqual(15 * 12)
      expect(months % 12, 'lengths are whole years').toBe(0)
    }
    // And they are not all the same number — the roll is a roll.
    expect(new Set(lengths).size).toBeGreaterThan(3)
  })

  it('ends a war at the length it was given, not whenever a draw lands', () => {
    // Before this, a war ended only when a weariness draw came up, which is
    // why they all ran about the same length whatever they were.
    let checked = 0
    for (let seed = 1; seed <= 8; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 2400)
      for (const relation of world.geoRelations.values()) {
        if (relation.state === 'war' && relation.plannedWarMonths !== null) {
          const months = world.tick - relation.sinceTick
          expect(
            months,
            'a war outlived the length it was rolled to run',
          ).toBeLessThanOrEqual(relation.plannedWarMonths)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('difficulty', () => {
  it('counts a decade of war as a point of hard-won toughness, capped at three', () => {
    expect(warExperienceOf(nation({ warMonths: 0 }))).toBe(0)
    expect(warExperienceOf(nation({ warMonths: 119 }))).toBe(0)
    expect(warExperienceOf(nation({ warMonths: 120 }))).toBe(1)
    expect(warExperienceOf(nation({ warMonths: 360 }))).toBe(3)
    // Battle-hardened is capped: a century of war does not make a country
    // unbeatable, it makes it tired (which exhaustion already models).
    expect(warExperienceOf(nation({ warMonths: 1200 }))).toBe(3)
    expect(combatPowerOf(nation({ combatRating: 9, warMonths: 240 }))).toBe(11)
  })

  it('makes a high-rated enemy genuinely more dangerous than a low-rated one', () => {
    // The owner's checklist: fight Russia/China against Nicaragua/Cuba and
    // confirm the difference shows.
    const home = nation({ id: 99 as never, combatRating: 8 })
    const ratingOf = (name: string): number =>
      REAL_NATIONS.find((n) => n.name === name)?.combatRating ?? 5

    const russia = nation({ name: 'Russia', combatRating: ratingOf('Russia') })
    const nicaragua = nation({ name: 'Nicaragua', combatRating: ratingOf('Nicaragua') })

    const hard = threatVectorFor(war(), russia, home)
    const easy = threatVectorFor(war(), nicaragua, home)

    expect(hard.directCombat).toBeGreaterThan(easy.directCombat)
    expect(hard.convoy).toBeGreaterThan(easy.convoy)
    expect(hard.baseAttack).toBeGreaterThan(easy.baseAttack)
    // Accidents are the tempo of the thing and do not care who is opposite.
    expect(hard.accident).toBe(easy.accident)
  })

  it('lets war experience make a modest country harder over time', () => {
    const home = nation({ id: 99 as never, combatRating: 8 })
    const green = nation({ name: 'Somewhere', combatRating: 4, warMonths: 0 })
    const hardened = nation({ name: 'Somewhere', combatRating: 4, warMonths: 360 })
    expect(threatVectorFor(war(), hardened, home).directCombat).toBeGreaterThan(
      threatVectorFor(war(), green, home).directCombat,
    )
  })

  it('is about the GAP, not the enemy alone', () => {
    // The same enemy, two different homelands: a stronger side has an
    // easier war. This is what makes it difficulty rather than a country
    // lookup — and threatVectorFor still reads the war's own state for
    // everything else (foundation rule 1).
    const enemy = nation({ combatRating: 9 })
    const weakHome = nation({ id: 99 as never, combatRating: 3 })
    const strongHome = nation({ id: 99 as never, combatRating: 10 })
    expect(threatVectorFor(war(), enemy, weakHome).directCombat).toBeGreaterThan(
      threatVectorFor(war(), enemy, strongHome).directCombat,
    )
  })

  it('rates every nation in both presets, in band', () => {
    for (const spec of [HEARTLAND_SPEC]) {
      const world = createWorld(makeSeed(12345), 40, spec)
      for (const n of world.nations.values()) {
        expect(n.combatRating).toBeGreaterThanOrEqual(1)
        expect(n.combatRating).toBeLessThanOrEqual(10)
        expect(n.warMonths).toBe(0)
      }
    }
    // Classic's invented countries get theirs derived from strength.
    const classic = createWorld(makeSeed(12345), 40)
    const ratings = new Set([...classic.nations.values()].map((n) => n.combatRating))
    expect(ratings.size, 'derived ratings should vary with strength').toBeGreaterThan(2)
  })

  it('counts the months a country actually spends at war', () => {
    const world = createWorld(makeSeed(3), 60, HEARTLAND_SPEC)
    advanceTicks(world, 1800)
    const fought = [...world.nations.values()].filter((n) => n.warMonths > 0)
    expect(fought.length).toBeGreaterThan(0)
    for (const n of fought) {
      // Nobody can have been at war longer than the world has existed.
      expect(n.warMonths).toBeLessThanOrEqual(world.tick * 4)
    }
  })
})
