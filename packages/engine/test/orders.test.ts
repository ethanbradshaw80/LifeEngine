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
import { advanceTicks, createWorld } from '../src/index.js'
import { toDate } from '../src/clock.js'
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
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  return person.id
}

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

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
    expect(sheet.specialty).toBe('Rifleman')
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

  it('claims no date the world does not have', () => {
    // THE CLOCK IS MONTHLY. The first draft drew a day of the month off the
    // seeded stream — deterministic, but "14 JUNE 1981" beside a game that
    // only knows June 1981 reads as simply wrong, which is how the owner
    // read it. The sheet says exactly what the game's own clock says.
    const world = createWorld(makeSeed(6103), 40)
    advanceTicks(world, 137)
    const personId = aSoldier(world)
    const enemy = [...world.nations.values()].filter((n) => !n.isHomeland).sort((a, b) => a.id - b.id)[0]
    if (!enemy) throw new Error('no enemy')
    const sheet = ordersSheetFor(world, world.tick, personId, 'involuntary', enemy.id)
    const { year, month } = toDate(world, world.tick)
    expect(sheet?.issued).toBe(`${MONTHS[month - 1] ?? ''} ${String(year)}`)
    // And the report-by is this month or the next — never a day, never a
    // date behind the orders.
    expect(sheet?.reportBy).toMatch(/^[A-Z]+ \d{4}$/)
    expect(sheet?.issued).not.toMatch(/\d{2} /)
  })

  it('refuses to write orders for somebody who is not serving', () => {
    const world = createWorld(makeSeed(6102), 40)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('nobody')
    expect(ordersSheetFor(world, world.tick, person.id, 'involuntary', null)).toBeUndefined()
  })

  it('prints a pay grade the world actually has', () => {
    // `rank` is the LADDER INDEX, not the grade — the ladder doubles up, a
    // specialist and a corporal are both E-4 — so `rank + 1` drifted one
    // high from that point on and printed an E-9 for a world whose ladder
    // stops at eight. The test's old fixture used rank 3, where the
    // off-by-one happened to cancel, which is why it went unseen.
    const world = createWorld(makeSeed(6104), 40)
    const personId = aSoldier(world)
    const enemy = [...world.nations.values()].filter((n) => !n.isHomeland).sort((a, b) => a.id - b.id)[0]
    if (!enemy) throw new Error('no enemy')
    const branch = world.spec.branches.find((b) => b.id === 'land-forces')
    if (!branch) throw new Error('no branch')

    for (let rank = 0; rank < branch.ranks.length; rank++) {
      const record = world.service.get(personId)
      if (!record) throw new Error('no record')
      world.service.set(personId, { ...record, rank })
      const sheet = ordersSheetFor(world, world.tick, personId, 'involuntary', enemy.id)
      const grade = branch.grades[rank]
      expect(sheet?.rank, `rank index ${String(rank)}`).toContain(`(E-${String(grade ?? 0)})`)
      // And never a grade the pay table does not hold. The ladders reach
      // E-9 since M-PROMO phase 1; the pay table was extended with them.
      expect(grade).toBeLessThanOrEqual(9)
    }
  })
})
