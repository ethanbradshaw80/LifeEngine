/**
 * The orders sheet.
 *
 * The claims: every field is read from the record rather than invented; the
 * paperwork's own details (order number, adjutant, the day of the month)
 * are deterministic, so a replay produces the identical sheet; and the
 * variants differ where they should — a volunteer is not threatened with
 * AWOL, because nobody ordered them.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { ordersSheetFor } from '../src/deployment.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'
import type { EntityId } from '@life-engine/shared'

function aSoldier(world: World): EntityId {
  const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody')
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 3,
    rankSinceTick: world.tick,
    qualifications: [],
    enlistedAtTick: world.tick,
    baseId: person.id,
    monthlyPay: 139_000 as never,
    performance: 600,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 3_600,
    unitId: null,
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  return person.id
}

describe('orders', () => {
  it('reads the record, and says the same thing every time it is read', () => {
    const world = createWorld(makeSeed(6100), 40)
    const personId = aSoldier(world)
    const person = world.people.get(personId)
    const enemy = [...world.nations.values()].filter((n) => !n.isHomeland).sort((a, b) => a.id - b.id)[0]
    if (!person || !enemy) throw new Error('no world to order in')

    const sheet = ordersSheetFor(world, world.tick, personId, 'involuntary', enemy.id)
    expect(sheet).toBeDefined()
    if (!sheet) return

    // Read from the record, not written by the sheet.
    expect(sheet.name).toContain(person.familyName.toUpperCase())
    expect(sheet.name).toContain(person.givenName)
    expect(sheet.specialty).toBe('rifleman')
    expect(sheet.enemy).toBe(enemy.name)
    expect(sheet.tourMonths).toBeGreaterThan(0)

    // DETERMINISTIC. Rendering twice must not reissue the orders under a new
    // number, and a replay of the same tick must produce the same document.
    const again = ordersSheetFor(world, world.tick, personId, 'involuntary', enemy.id)
    expect(again).toEqual(sheet)

    const replay = createWorld(makeSeed(6100), 40)
    aSoldier(replay)
    expect(ordersSheetFor(replay, replay.tick, personId, 'involuntary', enemy.id)).toEqual(sheet)
  })

  it('does not threaten a volunteer with a charge for going', () => {
    const world = createWorld(makeSeed(6101), 40)
    const personId = aSoldier(world)
    const enemy = [...world.nations.values()].filter((n) => !n.isHomeland).sort((a, b) => a.id - b.id)[0]
    if (!enemy) throw new Error('no enemy')

    const ordered = ordersSheetFor(world, world.tick, personId, 'involuntary', enemy.id)
    const volunteered = ordersSheetFor(world, world.tick, personId, 'voluntary', enemy.id)
    expect(ordered?.carriesAwolWarning).toBe(true)
    expect(volunteered?.carriesAwolWarning).toBe(false)
    expect(volunteered?.variantLine).toContain('VOLUNTARY')

    // And a peacetime posting is not a war: its own title, its own line.
    const rotation = ordersSheetFor(world, world.tick, personId, 'rotation', enemy.id)
    expect(rotation?.title).toBe('ROTATION ORDERS')
    expect(rotation?.carriesAwolWarning).toBe(false)
  })

  it('refuses to write orders for somebody who is not serving', () => {
    const world = createWorld(makeSeed(6102), 40)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')
    expect(ordersSheetFor(world, world.tick, person.id, 'involuntary', null)).toBeUndefined()
  })
})
