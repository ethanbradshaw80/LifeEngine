/**
 * M-ARMY2 item 7: unit rosters. The people a soldier serves beside are real
 * simulated people at the same posting, and whoever holds the rank leads.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { squadmatesOf, unitRosterOf } from '../src/service.js'

describe('unit rosters', () => {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, 60 * 12)
  const serving = [...world.service.values()].filter((r) => r.dischargedAtTick === null)

  it('put a soldier in a squad with real, living, serving people', () => {
    expect(serving.length).toBeGreaterThan(0)
    let rostersSeen = 0
    for (const record of serving) {
      const roster = unitRosterOf(world, record.personId)
      if (!roster) continue
      rostersSeen++
      expect(roster.unitName).toMatch(/^(1st|2nd|3rd|4th) Squad, [ABCD] Company$/)
      // Everyone listed is alive, serving, and at the same posting.
      for (const member of roster.members) {
        const theirs = world.service.get(member.personId)
        expect(theirs?.dischargedAtTick).toBeNull()
        expect(theirs?.baseId).toBe(record.baseId)
        expect(theirs?.branch).toBe(record.branch)
        expect(world.people.get(member.personId)?.deathTick).toBeNull()
      }
      // The soldier is in their own squad.
      expect(roster.members.some((m) => m.personId === record.personId)).toBe(true)
    }
    expect(rostersSeen).toBeGreaterThan(0)
  })

  it('rank the roster, so the leader is whoever really holds the rank', () => {
    for (const record of serving) {
      const roster = unitRosterOf(world, record.personId)
      if (!roster || roster.members.length < 2) continue
      for (let i = 1; i < roster.members.length; i++) {
        const above = roster.members[i - 1]
        const below = roster.members[i]
        if (!above || !below) continue
        expect(above.rank).toBeGreaterThanOrEqual(below.rank)
      }
      expect(roster.members[0]?.role).toBe('squad leader')
      if (roster.members.length > 1) expect(roster.members[1]?.role).toBe('team leader')
    }
  })

  it('agree with each other — squadmates share one roster', () => {
    const withSquad = serving.find((r) => (unitRosterOf(world, r.personId)?.members.length ?? 0) > 1)
    if (!withSquad) return
    const roster = unitRosterOf(world, withSquad.personId)
    if (!roster) return
    for (const member of roster.members) {
      const theirRoster = unitRosterOf(world, member.personId)
      expect(theirRoster?.unitName).toBe(roster.unitName)
      expect(theirRoster?.members.length).toBe(roster.members.length)
    }
    // Squadmates exclude the person themselves.
    const mates = squadmatesOf(world, withSquad.personId)
    expect(mates.some((m) => m.personId === withSquad.personId)).toBe(false)
    expect(mates.length).toBe(roster.members.length - 1)
  })

  it('are stable while the posting is — a squad is not reshuffled monthly', () => {
    const someone = serving.find((r) => r.dischargedAtTick === null)
    if (!someone) return
    const before = unitRosterOf(world, someone.personId)?.unitName
    advanceTicks(world, 6)
    const record = world.service.get(someone.personId)
    // Only meaningful while they are still serving at the same base.
    if (!record || record.dischargedAtTick !== null || record.baseId !== someone.baseId) return
    expect(unitRosterOf(world, someone.personId)?.unitName).toBe(before)
  })

  it('are empty for civilians and the discharged', () => {
    const civilian = [...world.people.values()].find(
      (p) => p.deathTick === null && !world.service.has(p.id),
    )
    if (civilian) expect(unitRosterOf(world, civilian.id)).toBeNull()
    const veteran = [...world.service.values()].find((r) => r.dischargedAtTick !== null)
    if (veteran) expect(unitRosterOf(world, veteran.personId)).toBeNull()
  })
})
