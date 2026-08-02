/**
 * History compaction (Law 6): "history is summarized and compressed, not
 * stored as unlimited raw detail."
 *
 * The claims: the ledger stops growing without bound; a life stays legible
 * a century after it ended; and nothing about a living person is ever
 * touched, because the simulation reads the ledger to make decisions.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { timelineFor } from '../src/story.js'

describe('compaction', () => {
  it('drops the texture of the long dead and keeps the life', () => {
    const world = createWorld(makeSeed(12345), 140)
    advanceTicks(world, 1_800) // a hundred and fifty years

    const longDead = [...world.people.values()]
      .filter((p) => p.deathTick !== null && world.tick - p.deathTick > 600)
      .sort((a, b) => a.id - b.id)
    expect(longDead.length, 'a century and a half buries people').toBeGreaterThan(20)

    // THE LIFE SURVIVES. Every one of them still has a birth and a death on
    // the record — a descendant reading an ancestor's page finds a life,
    // not a gap.
    for (const person of longDead.slice(0, 40)) {
      const events = world.events.filter((e) => e.subjectId === person.id)
      // The founding generation is created with the world and has no birth
      // event to keep — they were already alive when it started. Anybody
      // BORN here keeps their birth forever.
      if (person.birthTick >= 0 && person.parentIds.length > 0) {
        expect(
          events.some((e) => e.type === 'born'),
          `${person.givenName} ${person.familyName} lost their birth`,
        ).toBe(true)
      }
      expect(
        events.some((e) => e.type === 'died'),
        `${person.givenName} ${person.familyName} lost their death`,
      ).toBe(true)
      // And the timeline still renders something readable.
      expect(timelineFor(world, person.id).length).toBeGreaterThan(0)
    }

    // THE TEXTURE GOES. Nobody dead a century still carries the month they
    // made a friend or took a pay rise.
    const oldest = longDead.filter((p) => world.tick - (p.deathTick ?? 0) > 1_200)
    const dropped = world.events.filter(
      (e) =>
        oldest.some((p) => p.id === e.subjectId) &&
        (e.type === 'befriended' || e.type === 'got-raise' || e.type === 'friendship-lapsed'),
    )
    expect(dropped.length, 'the ordinary months of the long dead are still here').toBe(0)
  })

  it('never touches a living person', () => {
    const world = createWorld(makeSeed(999), 140)
    advanceTicks(world, 1_200)

    // Whatever a living person has on the ledger, they keep — the
    // simulation reads it to make decisions, so it must not move.
    const living = [...world.people.values()].filter((p) => p.deathTick === null)
    const before = new Map(
      living.map((p) => [p.id, world.events.filter((e) => e.subjectId === p.id).length]),
    )
    advanceTicks(world, 120) // crosses a compaction boundary
    for (const person of living) {
      if (world.people.get(person.id)?.deathTick !== null) continue // died meanwhile
      const now = world.events.filter((e) => e.subjectId === person.id).length
      expect(now, `${person.givenName} lost history while alive`).toBeGreaterThanOrEqual(
        before.get(person.id) ?? 0,
      )
    }
  })
})
