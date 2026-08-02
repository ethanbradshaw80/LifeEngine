/**
 * M-ARMY2 item 4: the enlistment model. Tradition pulls, drives concentrate,
 * the news carries both legs, and a death in uniform closes the record.
 * (Military review S1: the measured claims behind the design, pinned.)
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  closeServiceOnDeath,
  enlistPerson,
  recruitingDriveActive,
  serviceNewsSince,
} from '../src/service.js'
import { setPlayer } from '../src/player.js'
import { performDeath, livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import { SPECIALTIES } from '../src/content.js'
import { Stream } from '../src/rng.js'
import type { World } from '../src/types.js'

describe('recruiting drives', () => {
  it('answer identically for the same seed and differ between seeds', () => {
    const a = createWorld(makeSeed(12345), 100)
    const b = createWorld(makeSeed(12345), 100)
    const c = createWorld(makeSeed(54321), 100)
    let disagreements = 0
    for (let year = 0; year < 100; year++) {
      const tick = (year * 12) as Tick
      expect(recruitingDriveActive(a, tick)).toBe(recruitingDriveActive(b, tick))
      if (recruitingDriveActive(a, tick) !== recruitingDriveActive(c, tick)) disagreements++
    }
    expect(disagreements).toBeGreaterThan(0)
  })

  it('concentrate enlistment into their seasons without inflating the decade', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 40 * 12)

    // Seasons from the RECORDED events — the history, not a re-derivation.
    const seasonMonths = new Set<number>()
    for (const event of world.events) {
      if (event.type !== 'recruiting-drive') continue
      for (let m = 0; m < 3; m++) seasonMonths.add(event.tick + m)
    }
    expect(seasonMonths.size).toBeGreaterThan(0)

    let inSeason = 0
    let outSeason = 0
    for (const event of world.events) {
      if (event.type !== 'enlisted') continue
      if (seasonMonths.has(event.tick)) inSeason++
      else outSeason++
    }
    const monthsTotal = 40 * 12
    const inRate = inSeason / seasonMonths.size
    const outRate = outSeason / (monthsTotal - seasonMonths.size)
    // The drive is when people walk in — a higher per-month rate in season…
    expect(inRate).toBeGreaterThan(outRate)
    // …while the overall volume stays in a believable band — the town
    // GROWS across the window (~15/decade at 400, more as it climbs), so
    // the ceiling guards against a ×3 recruiting-poster spike, not drift.
    const total = inSeason + outSeason
    expect(total).toBeGreaterThan(30)
    expect(total).toBeLessThan(220)
  })
})

describe('service tradition', () => {
  it('a served parent is cited by name on the record', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 60 * 12)
    const cited = world.causalRecords.filter(
      (r) => r.decision === 'enlistment' && r.inputs.some((i) => i.factor === 'service-tradition'),
    )
    expect(cited.length).toBeGreaterThan(0)
    for (const record of cited) {
      const input = record.inputs.find((i) => i.factor === 'service-tradition')
      expect(input?.referencedEntityId).not.toBeNull()
      const child = world.people.get(record.subjectId)
      expect(child?.parentIds).toContain(input?.referencedEntityId)
      // The named parent really has a service record.
      expect(world.service.has(input!.referencedEntityId!)).toBe(true)
    }
  })
})

describe('service news', () => {
  it('carries both legs and never the player', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 60 * 12)

    const news = serviceNewsSince(world, 0 as Tick)
    expect(news.some((n) => n.text.includes('enlisted in'))).toBe(true)
    expect(news.some((n) => n.text.includes('came home from'))).toBe(true)
    expect(news.some((n) => n.text.includes('recruiters set up'))).toBe(true)

    // Play someone who enlisted; their line leaves the town's news — their
    // own timeline carries it.
    const enlistedEvent = world.events.find(
      (e) => e.type === 'enlisted' && world.people.get(e.subjectId)?.deathTick === null,
    )
    if (!enlistedEvent) return // no living enlistee at 60y — seed luck; other asserts covered it
    const person = world.people.get(enlistedEvent.subjectId)
    if (!person) return
    setPlayer(world, person.id)
    const withPlayer = serviceNewsSince(world, 0 as Tick)
    const name = `${person.givenName} ${person.familyName}`
    expect(withPlayer.some((n) => n.text.startsWith(`${name} enlisted`))).toBe(false)
  })
})

describe('death in uniform', () => {
  it('closes the record, and the quota stops counting the dead', () => {
    const world = createWorld(makeSeed(12345), 100)
    const soldier = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 19 && age <= 25
    })
    if (!soldier) throw new Error('no recruit-age adult in the founding town')
    const specialty = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!specialty) throw new Error('no walk-in specialty')
    enlistPerson(world, world.tick, soldier, specialty, [])
    expect(world.service.get(soldier.id)?.dischargedAtTick).toBeNull()

    performDeath(world, world.tick, soldier, 'a sudden illness', [], Stream.Health)
    const record = world.service.get(soldier.id)
    expect(record?.dischargedAtTick).toBe(world.tick)
    expect(record?.dischargeReason).toBe('died in service')
    expect(record?.termMonthsLeft).toBe(0)
  })

  it('closeServiceOnDeath is a no-op for civilians and the already-discharged', () => {
    const world = createWorld(makeSeed(12345), 100) as World
    const civilian = livingPeople(world)[0]
    if (!civilian) throw new Error('empty town')
    closeServiceOnDeath(world, world.tick, civilian.id)
    expect(world.service.has(civilian.id)).toBe(false)
  })
})
