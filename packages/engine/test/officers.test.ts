/**
 * Commissions (owner, playing: "we have no officer roles and stuff for the
 * military even tho we made stuff for those ranks and we even have a
 * college pipeline").
 *
 * He was right and it was a hole rather than a decision: every ladder was
 * enlisted end to end, so a graduate joined as a private — and the aviator
 * trade, which REQUIRES a degree, put college graduates in the ranks with
 * everybody else.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { CLASSIC_SPEC } from '../src/worldspec.js'
import { officerPayOn, servicePayOn } from '../src/content.js'
import { rankTitle } from '../src/service.js'

describe('the officer ladder', () => {
  it('exists for every branch, and is not the enlisted one', () => {
    for (const branch of CLASSIC_SPEC.branches) {
      const officers = branch.officerRanks ?? []
      expect(officers.length, `${branch.id} has no officers`).toBeGreaterThan(0)
      // A separate ladder: an officer is not a senior enlisted person.
      for (const rank of officers) {
        expect(branch.ranks, `${rank} is on both ladders`).not.toContain(rank)
      }
      expect((branch.officerGrades ?? []).length).toBe(officers.length)
    }
  })

  it('reads the ladder the person is actually on', () => {
    const world = createWorld(makeSeed(4141), 40)
    const enlisted = rankTitle(world, 'land-forces', 0, false)
    const officer = rankTitle(world, 'land-forces', 0, true)
    expect(enlisted).toBe('PVT')
    expect(officer).toBe('2LT')
    expect(enlisted).not.toBe(officer)
  })

  it('pays a commission on its own table, and does not make it a free upgrade', () => {
    const branch = CLASSIC_SPEC.branches.find((b) => b.id === 'land-forces')
    if (!branch) throw new Error('no branch')

    // A new lieutenant out-earns a new private by a lot.
    expect(officerPayOn(branch, 0)).toBeGreaterThan(servicePayOn(branch, 0))
    // But the ladders overlap: a senior sergeant's years are worth more
    // than a brand-new commission, which is what stops it being a
    // straight upgrade.
    const topEnlisted = branch.ranks.length - 1
    expect(servicePayOn(branch, topEnlisted)).toBeGreaterThan(officerPayOn(branch, 0))
  })
})
