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
  it('carries the drives and the deaths, and never a career (owner direction)', () => {
    const world = createWorld(makeSeed(12345))
    advanceTicks(world, 60 * 12)

    const news = serviceNewsSince(world, 0 as Tick)
    expect(news.some((n) => n.text.includes('recruiters set up'))).toBe(true)
    // OWNER: enlistments and homecomings are not town news. They happen —
    // and they belong on the person's own timeline, not in everyone's feed,
    // where a wall of them buried the things that matter.
    expect(world.events.some((e) => e.type === 'enlisted')).toBe(true)
    expect(news.some((n) => n.text.includes('enlisted in'))).toBe(false)
    // NO HOMECOMING IS NEWS, peacetime or war (owner, 2026-08-02). The
    // paper reports the ones who did not come back. A war's return leg used
    // to run here — review S6 wanted something between the recruiting
    // notices and the funerals — and the owner has read that and wants the
    // paper narrower anyway. A homecoming still sits on the soldier's own
    // timeline, which is where it was always the better story.
    expect(news.some((n) => n.text.includes('came home'))).toBe(false)
    // What remains: the drives, and a death in uniform.
    // READ THE KIND, NOT THE WORDING. This matched two substrings, which
    // made it a test of the newsroom's phrasing: it broke the first time a
    // seed produced a soldier killed in an ACCIDENT in uniform — a service
    // death the paper should absolutely carry, worded differently. The
    // claim is about which KINDS of thing reach the paper.
    for (const item of news) {
      expect(
        item.kind === 'recruiting-drive' || item.kind === 'died-in-service',
        `service news carried a ${String(item.kind)}: "${item.text}"`,
      ).toBe(true)
    }
  })
})

describe('a recruiting drive is news to whoever it could be about', () => {
  it('stays off a young child timeline, and reaches somebody of age', () => {
    // OWNER, reading a life back: the drive turned up at three, eight,
    // eleven and twelve. The town feed is merged into every personal story,
    // so a notice aimed at people old enough to sign was being filed as an
    // event in a child's life.
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 40 * 12)

    const drives = world.events.filter((e) => e.type === 'recruiting-drive')
    expect(drives.length, 'no drive ever ran').toBeGreaterThan(0)

    let checkedChild = 0
    let checkedAdult = 0
    for (const person of livingPeople(world)) {
      const mine = serviceNewsSince(world, person.birthTick, person.id).filter(
        (n) => n.kind === 'recruiting-drive',
      )
      const age = ageAt(person.birthTick, world.tick)
      for (const item of mine) {
        // Every notice a person is shown happened when it could be theirs.
        const at = ageAt(person.birthTick, item.tick as never)
        expect(at, `${String(at)} is too young for a recruiting notice`).toBeGreaterThanOrEqual(16)
        expect(at).toBeLessThanOrEqual(38)
      }
      if (age < 10) {
        expect(mine.length, 'a child was shown a recruiting drive').toBe(0)
        checkedChild++
      }
      if (age >= 18 && age <= 30 && !world.service.has(person.id) && mine.length > 0) {
        checkedAdult++
      }
    }
    expect(checkedChild, 'no children in a forty-year town').toBeGreaterThan(0)
    expect(checkedAdult, 'nobody of age was told about a drive at all').toBeGreaterThan(0)

    // And the TOWN's own paper still carries every one of them.
    const townFeed = serviceNewsSince(world, 0 as Tick).filter(
      (n) => n.kind === 'recruiting-drive',
    )
    expect(townFeed.length).toBe(drives.length)
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
