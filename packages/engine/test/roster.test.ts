/**
 * M-ARMY2 item 7: unit rosters. The people a soldier serves beside are real
 * simulated people at the same posting, and whoever holds the rank leads.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { CLASSIC_SPEC } from '../src/worldspec.js'
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
      // A LINE SQUAD, OR A NAMED UNIT SOMEBODY WAS SELECTED FOR. This
      // asserted the squad pattern for everybody, which held only while
      // NPCs never went to school: since M-PROMO the town's soldiers earn
      // badges, and a badge is what a special unit selects on. The first
      // air-guard soldier to make the Guardian Flight turned this red.
      const special = world.spec.units.some((u) => u.name === roster.unitName)
      if (!special) {
        expect(roster.unitName).toMatch(/^(1st|2nd|3rd|4th) Squad, [ABCD] Company$/)
      }
      // Everyone listed is alive and serving. THE POSTING IS ONLY A LINE
      // SQUAD'S RULE: rosterFrom matches a special unit on unitId alone, so
      // a named unit legitimately draws its people from wherever they are
      // posted — that is what makes it a unit rather than a squad.
      //
      // A previous pass fixed the unit NAME assertion for special units and
      // left these membership ones matching on base, which held only while
      // nobody in the town had ever made a named unit.
      for (const member of roster.members) {
        const theirs = world.service.get(member.personId)
        expect(theirs?.dischargedAtTick).toBeNull()
        expect(world.people.get(member.personId)?.deathTick).toBeNull()
        if (!special) {
          expect(theirs?.baseId).toBe(record.baseId)
          expect(theirs?.branch).toBe(record.branch)
        }
      }
      // The soldier is in their own squad.
      expect(roster.members.some((m) => m.personId === record.personId)).toBe(true)
    }
    expect(rostersSeen).toBeGreaterThan(0)
  })

  it('rank the roster by who actually answers for the rest', () => {
    // NOT by the ladder index. Both ladders start at zero, so an index
    // comparison put a second lieutenant below a master sergeant and named
    // the sergeant their leader. Authority is the pay grade, with every
    // officer above every enlisted member.
    const authority = (personId: number): number => {
      const r = world.service.get(personId as never)
      if (!r) return -1
      const branch = CLASSIC_SPEC.branches.find((b) => b.id === r.branch)
      if (r.commissioned === true) return 100 + ((branch?.officerGrades ?? [])[r.rank] ?? r.rank + 1)
      return (branch?.grades ?? [])[r.rank] ?? r.rank + 1
    }

    for (const record of serving) {
      const roster = unitRosterOf(world, record.personId)
      if (!roster || roster.members.length < 2) continue
      for (let i = 1; i < roster.members.length; i++) {
        const above = roster.members[i - 1]
        const below = roster.members[i]
        if (!above || !below) continue
        expect(authority(above.personId)).toBeGreaterThanOrEqual(authority(below.personId))
      }
      // And a unit with an officer in it is led by the officer.
      const ledByOfficer =
        world.service.get(roster.members[0]?.personId as never)?.commissioned === true
      expect(roster.members[0]?.role).toBe(ledByOfficer ? 'platoon leader' : 'squad leader')
      expect(roster.members[1]?.role).toBe(ledByOfficer ? 'platoon sergeant' : 'team leader')
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
