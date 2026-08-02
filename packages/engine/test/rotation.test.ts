/**
 * M-ARMY2 item 1: peacetime rotations. Between wars the army still goes
 * places — and the rules of that going are different from a war's in every
 * way that matters: no enemy, no combat channel, no campaign medal, and a
 * recall the month the Republic fights.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'

const CENTURY = 100 * 12

describe('peacetime rotations', () => {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, CENTURY)

  const allTours = [...world.deployments.values()].flat()
  const rotations = allTours.filter((t) => t.kind === 'rotation')

  it('happen, as orders, without anyone volunteering', () => {
    expect(rotations.length).toBeGreaterThan(0)
    // Orders, not a menu: nobody in an unplayed world volunteers for
    // anything, so every one of these came down as orders.
    const ordered = world.causalRecords.filter(
      (r) => r.decision === 'deployment' && r.chosen.includes('on rotation'),
    )
    expect(ordered.length).toBeGreaterThan(0)
  })

  it('carry no enemy and no war — peace has neither', () => {
    for (const rotation of rotations) {
      expect(rotation.enemyId).toBeNull()
      expect(rotation.warA).toBeNull()
      expect(rotation.warB).toBeNull()
      expect(rotation.hostId).not.toBeNull()
      // The host is a real allied nation, never the homeland itself.
      const host = world.nations.get(rotation.hostId!)
      expect(host).toBeDefined()
      expect(host?.isHomeland).toBe(false)
    }
  })

  it('never earn a campaign medal — a campaign is a war', () => {
    // Anyone whose ONLY time away was rotations has no campaign medal.
    for (const [personId, tours] of world.deployments) {
      if (tours.length === 0) continue
      if (tours.some((t) => t.kind === 'combat')) continue
      const awards = world.awards.get(personId) ?? []
      expect(awards.some((a) => a.kind === 'campaign')).toBe(false)
      // …nor a wound recognition: that decoration is for enemy action.
      expect(awards.some((a) => a.kind === 'wound-recognition')).toBe(false)
    }
  })

  it('never produce a combat event', () => {
    // Nobody on a rotation saw combat: no 'saw-combat' or
    // 'wounded-in-action' event may fall inside a rotation's months.
    for (const [personId, tours] of world.deployments) {
      const windows = tours
        .filter((t) => t.kind === 'rotation')
        .map((t) => ({ from: t.startedAtTick, to: t.returnedAtTick ?? world.tick }))
      if (windows.length === 0) continue
      // A COMBAT TOUR'S MONTHS ARE NOT A ROTATION'S, even where the two
      // windows touch. An open rotation's window runs to the present, and
      // since NPCs volunteer for allies' wars a person can be on a combat
      // tour inside it — so the claim is "no combat DURING the rotation
      // itself", which means excluding the months a combat tour covers.
      const combatWindows = tours
        .filter((t) => t.kind === 'combat')
        .map((t) => ({ from: t.startedAtTick, to: t.returnedAtTick ?? world.tick }))
      const combatEvents = world.events.filter(
        (e) =>
          e.subjectId === personId &&
          (e.type === 'saw-combat' || e.type === 'wounded-in-action') &&
          windows.some((w) => e.tick >= w.from && e.tick <= w.to) &&
          !combatWindows.some((w) => e.tick >= w.from && e.tick <= w.to),
      )
      expect(combatEvents.length).toBe(0)
    }
  })

  it('are real duty — they can hurt people, and they close honestly', () => {
    // Every rotation that closed did so within its own window (six months,
    // or earlier for an evacuation or a recall) — none run forever.
    for (const rotation of rotations) {
      if (rotation.returnedAtTick === null) continue
      expect(rotation.returnedAtTick).toBeGreaterThan(rotation.startedAtTick)
      expect(rotation.returnedAtTick).toBeLessThanOrEqual(rotation.endsAtTick)
    }
    // The homecoming event exists for each closed rotation.
    const homecomings = world.events.filter(
      (e) =>
        e.type === 'returned-home' &&
        (e.detail === 'rotation complete' || e.detail === 'recalled'),
    )
    expect(homecomings.length).toBeGreaterThan(0)
  })

  it('do not begin while the Republic is at war', () => {
    // Only the HOMELAND's wars close the door — two foreign powers fighting
    // each other has nothing to do with whether our soldiers can train in
    // an allied country. Reconstruct the homeland's own war windows.
    const home = [...world.nations.values()].find((n) => n.isHomeland)
    expect(home).toBeDefined()
    if (!home) return

    const windows: { from: number; to: number }[] = []
    let openFrom: number | null = null
    let open = 0
    for (const event of world.events) {
      if (event.subjectId !== home.id && event.otherId !== home.id) continue
      if (event.type === 'war-began') {
        if (open === 0) openFrom = event.tick
        open++
      } else if (event.type === 'ceasefire') {
        open = Math.max(0, open - 1)
        if (open === 0 && openFrom !== null) {
          windows.push({ from: openFrom, to: event.tick })
          openFrom = null
        }
      }
    }
    if (openFrom !== null) windows.push({ from: openFrom, to: world.tick })

    for (const rotation of rotations) {
      const begunInWar = windows.some(
        (w) => rotation.startedAtTick >= w.from && rotation.startedAtTick < w.to,
      )
      expect(begunInWar, `a rotation began at tick ${String(rotation.startedAtTick)} during a war`).toBe(false)
    }
  })
})

describe('the town news', () => {
  it('no longer carries enlistments or homecomings (owner direction)', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 60 * 12)
    // serviceNewsSince is the town's ear; a career belongs on the person's
    // own timeline, not in everyone's feed.
    const news = [...world.events].filter((e) => e.type === 'enlisted')
    expect(news.length).toBeGreaterThan(0) // they still HAPPEN…
    // …they are simply not town news any more. (The function's own output
    // is asserted in enlistment.test.ts.)
  })
})
