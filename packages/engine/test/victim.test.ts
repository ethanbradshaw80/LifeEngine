/**
 * The victim's side as a moment (C3 §6).
 *
 * Being robbed was already modelled — the money moved, the event landed —
 * but it happened TO the player rather than asking them anything, which is
 * the one thing a crime against you ought to do.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { answerVictimMoment } from '../src/crime.js'
import { livingPeople } from '../src/systems.js'

describe('being robbed', () => {
  it('records the choice either way — including letting it go', () => {
    // The desperation moment settled this principle: a choice that leaves
    // no trace is not a choice.
    const world = createWorld(makeSeed(5500), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')

    answerVictimMoment(world, world.tick, person, 'burglary', 40_000, false)
    expect(
      world.events.some((e) => e.type === 'declined-to-report' && e.subjectId === person.id),
    ).toBe(true)
    expect(
      world.causalRecords.some(
        (r) => r.subjectId === person.id && r.chosen.includes('let it go'),
      ),
      'letting it go is on the record',
    ).toBe(true)
  })

  it('reporting is a real act with real odds, not a formality', () => {
    const world = createWorld(makeSeed(5501), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')

    answerVictimMoment(world, world.tick, person, 'burglary', 40_000, true)
    expect(world.events.some((e) => e.type === 'reported-crime' && e.subjectId === person.id)).toBe(
      true,
    )
    // With no thief on the ledger to find, a report cannot invent one — it
    // improves the odds, it does not manufacture an arrest.
    expect(
      world.events.some((e) => e.type === 'was-arrested'),
      'a report conjured a suspect out of nothing',
    ).toBe(false)
  })
})
