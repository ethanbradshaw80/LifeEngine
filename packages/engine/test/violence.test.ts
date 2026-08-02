/**
 * Violence has somebody on the other end of it (C3 §11).
 *
 * Until C3 every offence was a thing that happened to a household's
 * savings. An assault is not: it happens to a PERSON, with a body and a
 * household and a life that carries on afterwards — or does not.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { offenceById } from '../src/content.js'

describe('violent crime', () => {
  it('lands on a real person, and the charge follows the outcome', () => {
    let assaults = 0
    let killings = 0
    let escalations = 0
    for (const seedValue of [12345, 999, 4242]) {
      const world = createWorld(makeSeed(seedValue), 140)
      advanceTicks(world, 600)

      for (const event of world.events) {
        if (event.type !== 'was-assaulted') continue
        assaults += 1
        // A victim who is a real, simulated person — not a number taken off
        // a household.
        expect(world.people.get(event.subjectId), 'assaulted nobody').toBeDefined()
        expect(event.otherId, 'assaulted by nobody').not.toBeNull()
        expect(event.subjectId).not.toBe(event.otherId)
        // And the charge on the other end exists.
        expect(offenceById(event.detail ?? ''), `unknown charge ${event.detail ?? ''}`).toBeDefined()
      }

      killings += world.events.filter(
        (e) => e.type === 'died' && (e.detail ?? '').includes('violence at the hands'),
      ).length

      for (const event of world.events) {
        if (event.type !== 'escalated-charge') continue
        escalations += 1
        // C3 §11: a death during a felony is a different charge. Both ends
        // of the escalation are real charges, and the new one is worse.
        const [from, to] = (event.detail ?? '').split(':')
        const before = offenceById(from ?? '')
        const after = offenceById(to ?? '')
        expect(before, `escalated from ${from ?? '?'}, which does not exist`).toBeDefined()
        expect(after, `escalated to ${to ?? '?'}, which does not exist`).toBeDefined()
        expect(after?.maxMonths ?? 0).toBeGreaterThan(before?.maxMonths ?? 0)
      }
    }

    expect(assaults, 'nobody was ever assaulted in three towns').toBeGreaterThan(0)
    // Killing is rare, and it stays rare. This is deliberately above the
    // real rate — at the real one a playthrough would never see a homicide
    // and a third of the catalogue would be invisible — and well below the
    // first draft, which produced eight across this same sample.
    expect(killings, 'a bloodbath').toBeLessThan(15)
    expect(escalations, 'more escalations than killings').toBeLessThanOrEqual(killings)
  })
})
