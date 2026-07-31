/**
 * Named harm. M-WOUNDS.
 *
 * The claims: every ailment has a name and, for injuries, a place; the cause
 * shapes the kind (a convoy strike is not a mill accident); the permanent
 * marks are words that accumulate and never vanish; and no player-facing
 * text leaks a raw category or an undefined.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { describeAilment, markFor, pickInjury } from '../src/wounds.js'
import { Rng } from '../src/rng.js'
import { advanceTicks, createWorld, lifeStory } from '../src/index.js'
import { livingPeople } from '../src/systems.js'

describe('the tables', () => {
  it('every context yields plausible kinds with plausible sites', () => {
    const rng = new Rng(42)
    for (const context of ['machinery', 'mishap', 'direct-combat', 'convoy', 'base-attack', 'field-accident'] as const) {
      for (let i = 0; i < 30; i++) {
        const { kind, site } = pickInjury(rng, context)
        const text = describeAilment('injury', kind, site)
        expect(text.length).toBeGreaterThan(5)
        expect(text).not.toContain('undefined')
        if (context === 'direct-combat') {
          expect(['gunshot', 'shrapnel', 'laceration']).toContain(kind)
        }
        if (context === 'machinery') {
          expect(['crush', 'laceration', 'fracture']).toContain(kind)
        }
      }
    }
  })

  it('every kind and site has real words, and every mark reads as a sentence fragment', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 200; i++) {
      const { kind, site } = pickInjury(rng, i % 2 === 0 ? 'convoy' : 'mishap')
      expect(describeAilment('injury', kind, site)).not.toContain('undefined')
      const mark = markFor('injury', kind, site)
      expect(mark.length).toBeGreaterThan(10)
      expect(mark).not.toContain('undefined')
    }
    // Unnamed history (migrated records) still reads honestly.
    expect(describeAilment('injury', null, null)).toBe('an injury')
    expect(describeAilment('illness', null, null)).toBe('an illness')
  })
})

describe('the lived record', () => {
  it('events carry the specifics, and stories tell them', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 900)

    const injured = world.events.filter((e) => e.type === 'was-injured')
    expect(injured.length).toBeGreaterThan(0)
    for (const event of injured) {
      const [grade, what] = String(event.detail).split(':')
      expect(grade === 'serious' || grade === 'minor').toBe(true)
      expect((what ?? '').length).toBeGreaterThan(4)
    }

    const ill = world.events.filter((e) => e.type === 'fell-ill')
    for (const event of ill) {
      const what = String(event.detail).split(':')[1] ?? ''
      expect(what).not.toBe('an illness') // named, not generic, for new cases
    }
  })

  it('marks accumulate in words and appear in the story of a marked life', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 1200)

    const marked = [...world.health.values()].filter((r) => r.marks.length > 0)
    expect(marked.length).toBeGreaterThan(0)
    for (const record of marked) {
      expect(record.disability).toBeGreaterThan(0)
      for (const mark of record.marks) {
        expect(mark.length).toBeGreaterThan(10)
      }
    }

    // A dead, marked person's retrospective carries the words.
    const dead = [...world.people.values()].find(
      (p) => p.deathTick !== null && (world.health.get(p.id)?.marks.length ?? 0) > 0,
    )
    if (dead) {
      const story = lifeStory(world, dead.id)
      const mark = world.health.get(dead.id)?.marks[0] ?? ''
      expect(story).toContain(mark)
    }
  })

  it('no living person has marks without the disability to explain them', () => {
    const world = createWorld(makeSeed(2024))
    advanceTicks(world, 900)
    for (const record of world.health.values()) {
      if (record.marks.length > 0) expect(record.disability).toBeGreaterThan(0)
    }
    void livingPeople
  })
})
