/**
 * YOU DEPLOY WITH YOUR OWN UNIT.
 *
 * THE OWNER'S REPORT: "you never actually deploy with someone from your unit
 * even when it says your unit is taking volunteers."
 *
 * He was right, and it was two parallel roads rather than a missing feature.
 * The home-station roster has always been real people. The deployment squad
 * was a SEPARATE system that invented five strangers per tour and threw them
 * away at the end, so a player could serve a decade in a unit and never once
 * deploy with anybody in it.
 *
 * A NOTE ON HOW THIS IS TESTED, because the first draft of it was worthless.
 * It drove the whole tick loop and waited for the simulation to cut orders,
 * and when no war happened to be running it returned early and PASSED,
 * proving nothing. It now calls the seam directly, which tests the claim
 * rather than the weather.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { unitRosterOf } from '../src/service.js'
import { squadFromUnit } from '../src/deployment.js'
import { BRANCH_GRADES } from '../src/content.js'
import type { World } from '../src/types.js'

/** Somebody serving in a unit with people in it. */
function aSoldierWithAUnit(world: World) {
  return [...world.service.values()]
    .sort((a, b) => a.personId - b.personId)
    .find((r) => {
      if (r.dischargedAtTick !== null) return false
      if (world.people.get(r.personId)?.deathTick !== null) return false
      return (unitRosterOf(world, r.personId)?.members.length ?? 0) >= 5
    })
}

describe('the squad is your unit', () => {
  it('fills the fireteam from the roster rather than inventing strangers', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 12 * 12)
    const record = aSoldierWithAUnit(world)
    expect(record, 'no unit in this world holds five people').toBeDefined()
    if (record === undefined) return

    const roster = unitRosterOf(world, record.personId)
    const onRoster = new Set((roster?.members ?? []).map((m) => m.personId))
    const squad = squadFromUnit(world, world.tick, record.personId, 1)

    expect(squad.length, 'he deployed with nobody').toBeGreaterThan(0)
    const fromUnit = squad.filter((m) => onRoster.has(m.personId)).length
    expect(
      fromUnit,
      `only ${String(fromUnit)} of ${String(squad.length)} came from his own unit`,
    ).toBe(squad.length)

    expect(squad.some((m) => m.personId === record.personId), 'he is in his own squad').toBe(false)
    expect(new Set(squad.map((m) => m.personId)).size, 'somebody is in it twice').toBe(squad.length)
  })

  it('is a fireteam, not the five most senior people in the company', () => {
    /**
     * MEASURED, and it is why this test exists: taking the roster's first
     * five handed the player ranks 7, 7, 7, 3 and 6 — every senior NCO in
     * the company out on one patrol. `rosterFrom` sorts by who answers for
     * the rest, so "the first five" is "the most senior five".
     *
     * One leads, the rest are junior to them.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 12 * 12)
    const record = aSoldierWithAUnit(world)
    if (record === undefined) return

    const squad = squadFromUnit(world, world.tick, record.personId, 1)
    const leader = squad.find((m) => m.role === 'leader')
    const others = squad.filter((m) => m.role !== 'leader')
    expect(leader, 'nobody is leading it').toBeDefined()
    if (leader === undefined || others.length === 0) return

    /**
     * SENIORITY IS THE ROSTER'S ORDER, NOT `record.rank`.
     *
     * A first version of this check compared ranks directly and reported "the
     * leader is rank 1 and the team averages 2.3" as a failure when nothing
     * was wrong: rank is an INDEX INTO WHICHEVER LADDER somebody is on, so a
     * second lieutenant at rank 0 outranks a sergeant first class at rank 6.
     * `rosterFrom` sorts by real authority, so position in it is the honest
     * comparison.
     */
    const order = (unitRosterOf(world, record.personId)?.members ?? []).map((m) => m.personId)
    const placeOf = (id: number): number => {
      const at = order.indexOf(id as never)
      return at === -1 ? order.length : at
    }
    const leaderPlace = placeOf(leader.personId)
    const averageOther = others.reduce((sum, m) => sum + placeOf(m.personId), 0) / others.length
    expect(
      leaderPlace,
      `the leader sits at ${String(leaderPlace)} in the roster and the team averages ${averageOther.toFixed(1)}`,
    ).toBeLessThan(averageOther)
  })

  it('is led by an NCO, never by a private', () => {
    /**
     * OWNER, LOOKING AT THE SCREEN: "Pittman is a PV2 why would be be squad
     * leader". He was right, and no test caught it because the earlier ones
     * only asked whether the leader was SENIOR TO THE OTHERS — which a
     * private is, when the other four are also privates.
     *
     * A fireteam leader is a SERGEANT. E-4 is not enough and the first
     * version of this test said it was: BRANCH_GRADES notes that "SPC and CPL
     * share E-4 — the corporal is the same grade wearing the stripes of an
     * NCO", so a grade-4 line still handed teams to specialists. Measured
     * before raising it: 70 of 88 squads were led by an E-4. E-5 can only be
     * a sergeant, so it is the only honest line the grades can express.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 12 * 12)
    const record = aSoldierWithAUnit(world)
    if (record === undefined) return

    const squad = squadFromUnit(world, world.tick, record.personId, 1)
    const leader = squad.find((m) => m.role === 'leader')
    if (leader === undefined) return
    const theirs = world.service.get(leader.personId)
    if (theirs === undefined || theirs.commissioned === true) return

    const grades = BRANCH_GRADES[theirs.branch as 'land-forces'] ?? []
    const grade = grades[theirs.rank] ?? 0
    // Unless the whole station is junior — in which case somebody still has
    // to lead, and the senior man of the team takes it.
    const anyNco = [...world.service.values()].some((r) => {
      if (r.dischargedAtTick !== null || r.baseId !== theirs.baseId) return false
      const g = (BRANCH_GRADES[r.branch as 'land-forces'] ?? [])[r.rank] ?? 0
      return g >= 5 || r.commissioned === true
    })
    if (!anyNco) return
    expect(grade, `a fireteam led by an E-${String(grade)}`).toBeGreaterThanOrEqual(5)
  })

  it('stands you next to the same people on a later tour', () => {
    // THE POINT OF THE WHOLE STAGE. Squadmates were invented per tour, so a
    // second tour was five new strangers and the first five stopped
    // mattering. A unit persists, so its people do.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 12 * 12)
    const record = aSoldierWithAUnit(world)
    if (record === undefined) return

    const first = squadFromUnit(world, world.tick, record.personId, 1)
    const second = squadFromUnit(world, world.tick, record.personId, 2)
    const known = new Set(first.map((m) => m.personId))
    const familiar = second.filter((m) => known.has(m.personId)).length
    expect(
      familiar,
      'the second tour was people he had never met — the squad is still per-tour',
    ).toBeGreaterThan(0)
  })

  it('names its competence off the record, not a die', () => {
    // A squadmate who is good at this is good at it for a reason the game
    // can point at: what the service already thinks of them, lifted by the
    // grade they have reached.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 12 * 12)
    const record = aSoldierWithAUnit(world)
    if (record === undefined) return

    for (const mate of squadFromUnit(world, world.tick, record.personId, 1)) {
      const theirs = world.service.get(mate.personId)
      if (theirs === undefined) continue
      expect(mate.competence).toBe(
        Math.max(120, Math.min(1000, theirs.performance + theirs.rank * 25)),
      )
    }
  })
})
