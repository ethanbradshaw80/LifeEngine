/**
 * Plea deals (C3 §13).
 *
 * The honest inversion the doc asks players to feel: a WEAK case bargains
 * and a strong one does not have to. The state's leverage is the evidence,
 * and where it has plenty there is nothing for the defendant to buy.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { describePleaDeal, pleaDealFor } from '../src/crime.js'
import { offenceById } from '../src/content.js'
import { livingPeople } from '../src/systems.js'

describe('the prosecutor', () => {
  it('never bargains away a capital charge', () => {
    const world = createWorld(makeSeed(7000), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    const murder = offenceById('murder-first')
    if (!person || !murder) throw new Error('no world')
    expect(pleaDealFor(world, person.id, murder, world.tick)).toBeNull()
  })

  it('never offers below a mandatory minimum', () => {
    // That floor is the legislature saying the bargain stops here, and it
    // is the one term a deal must not cross.
    const world = createWorld(makeSeed(7001), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')

    for (const id of ['armed-robbery', 'assault-deadly-weapon', 'drug-trafficking', 'attempted-murder']) {
      const offence = offenceById(id)
      if (!offence) throw new Error(`${id} missing`)
      const deal = pleaDealFor(world, person.id, offence, world.tick)
      if (deal === null) continue
      // Either it drops to a lesser charge — which has its own floor — or
      // it stays on this one and respects this one's.
      const agreed = offenceById(deal.offenceId)
      expect(agreed, 'bargained to a charge that does not exist').toBeDefined()
      expect(deal.months).toBeGreaterThanOrEqual(agreed?.mandatoryMin ?? 0)
    }
  })

  it('a charge bargain actually drops the grade, and says so in words', () => {
    const world = createWorld(makeSeed(7002), 60)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')

    let sawCharge = 0
    for (const id of ['burglary', 'grand-theft', 'simple-assault', 'wire-fraud', 'auto-theft']) {
      const offence = offenceById(id)
      if (!offence) continue
      const deal = pleaDealFor(world, person.id, offence, world.tick)
      if (deal === null || deal.kind !== 'charge') continue
      sawCharge += 1
      const agreed = offenceById(deal.offenceId)
      // The whole point: the grade falls, and everything the grade drives
      // falls with it.
      expect(agreed?.maxMonths ?? 0).toBeLessThan(offence.maxMonths)
      expect(describePleaDeal(deal)).toContain(agreed?.title ?? '')
    }
    expect(sawCharge, 'no charge bargain was ever offered').toBeGreaterThan(0)
  })
})
