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
import { advanceTicks, createWorld } from '../src/index.js'
import { SPECIALTIES } from '../src/content.js'
import { CLASSIC_SPEC } from '../src/worldspec.js'
import {
  BRANCH_OFFICER_RANKS_SPELLED,
  BRANCH_RANKS_SPELLED,
  officerPayOn,
  servicePayOn,
} from '../src/content.js'
import { competitiveGates, meetsRankGate, rankTitle, unitRosterOf } from '../src/service.js'

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

  it('has a spelled name for every rank on every ladder', () => {
    // The certificate reads the spelled list by index. A list that is
    // shorter than its ladder silently falls back to the abbreviation for
    // exactly the senior ranks a certificate is most likely to name.
    for (const branch of CLASSIC_SPEC.branches) {
      const id = branch.id as keyof typeof BRANCH_RANKS_SPELLED
      expect(BRANCH_RANKS_SPELLED[id]?.length, `${branch.id} enlisted`).toBe(branch.ranks.length)
      expect(BRANCH_OFFICER_RANKS_SPELLED[id]?.length, `${branch.id} officer`).toBe(
        (branch.officerRanks ?? []).length,
      )
      for (const name of [...BRANCH_RANKS_SPELLED[id], ...BRANCH_OFFICER_RANKS_SPELLED[id]]) {
        expect(name.length, `${name} is not spelled out`).toBeGreaterThan(4)
      }
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

  it('is a career, not two rungs — officers reach the middle of it', () => {
    // MUST-FIX (military review): competitiveGates read the ENLISTED ladder
    // for everybody, so a commissioned member at 1LT cleared neither the
    // junior gate nor the board gate and stopped there forever. Six officer
    // ranks, one reachable. A test that never advances the tick loop would
    // not have caught it, so this one runs a town for eighty years.
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 80 * 12)

    const officers = [...world.service.values()].filter((r) => r.commissioned === true)
    expect(officers.length, 'nobody was commissioned in eighty years').toBeGreaterThan(0)
    const highest = Math.max(...officers.map((r) => r.rank))
    expect(highest, 'the officer ladder still dead-ends').toBeGreaterThan(1)

    // And the promotions are recorded under OFFICER titles, not enlisted
    // ones — the record is permanent and used to read "made PV2" for a new
    // first lieutenant.
    const officerIds = new Set(officers.map((r) => r.personId))
    const enlistedTitles = new Set(CLASSIC_SPEC.branches.flatMap((b) => b.ranks))
    for (const event of world.events) {
      if (event.type !== 'promoted' || !officerIds.has(event.subjectId)) continue
      expect(enlistedTitles.has(event.detail ?? ''), `officer promoted to ${event.detail ?? ''}`).toBe(
        false,
      )
    }
  })

  it('costs two more years than an enlistment, so it is not a free upgrade', () => {
    // Otherwise the commission is +55% pay for the same commitment.
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 60 * 12)
    for (const record of world.service.values()) {
      if (record.commissioned !== true) continue
      expect(record.termMonths).toBe(72)
    }
  })

  it('is offered a board, on its own ladder', () => {
    // OWNER, playing an officer: "cant get promoted". The player's board
    // read the ENLISTED gate for a commissioned member — a lieutenant asked
    // whether index 2 cleared an enlisted competitiveFrom of four, got
    // null, and was never offered a board at all. NPC officers promoted in
    // the same town, which is what made it look like bad luck.
    const world = createWorld(makeSeed(4141), 100)
    const specialty = SPECIALTIES.find((sp) => sp.branch === 'land-forces')
    if (!specialty) throw new Error('no land specialty')

    for (let rank = 0; rank < 5; rank++) {
      const asOfficer = competitiveGates(world, specialty, rank, true)
      const asEnlisted = competitiveGates(world, specialty, rank, false)
      // Every officer step above the first is a board with a real wait.
      if (rank >= 1) {
        expect(asOfficer, `officer rank ${String(rank)} has no board`).not.toBeNull()
        expect(asOfficer?.tigNeeded).toBeGreaterThan(0)
      }
      // And the two ladders answer differently — reading the wrong one is
      // exactly the bug.
      if (asOfficer !== null && asEnlisted !== null) {
        expect(asOfficer.tigNeeded).not.toBe(asEnlisted.tigNeeded)
      }
    }
  })

  it('clears the enlisted rank gates on schools and units', () => {
    // OWNER: "cant attend schools". minRank is an index into the ENLISTED
    // ladder, and an officer's rank indexes a different one — so a second
    // lieutenant sat at 0 and was refused every course opening at 1.
    for (let minRank = 0; minRank <= 4; minRank++) {
      expect(meetsRankGate({ rank: 0, commissioned: true }, minRank)).toBe(true)
    }
    // The enlisted rule is untouched.
    expect(meetsRankGate({ rank: 0, commissioned: false }, 2)).toBe(false)
    expect(meetsRankGate({ rank: 3, commissioned: false }, 2)).toBe(true)
  })

  it('leads the squad it is posted to, and is listed first', () => {
    // OWNER: "not being properly listed or assigned to squads". The roster
    // sorted on the ladder INDEX, so a 2LT at 0 came below a master
    // sergeant at 8 and a sergeant was named leader over their officer.
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 40 * 12)

    let checked = 0
    for (const record of world.service.values()) {
      if (record.commissioned !== true || record.dischargedAtTick !== null) continue
      const roster = unitRosterOf(world, record.personId)
      if (!roster || roster.members.length < 2) continue
      checked++
      expect(roster.members[0]?.personId, 'an officer is not at the head of their own roster').toBe(
        record.personId,
      )
      expect(roster.members[0]?.role).toBe('platoon leader')
      // And they are listed under an OFFICER's rank, not a private's.
      const officerRanks = CLASSIC_SPEC.branches.find((b) => b.id === record.branch)?.officerRanks ?? []
      expect(officerRanks).toContain(roster.members[0]?.rankTitle)
    }
    expect(checked, 'no commissioned member shared a squad in eighty years').toBeGreaterThan(0)
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
