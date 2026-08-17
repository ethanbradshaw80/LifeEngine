/**
 * BOARDS, INSPECTIONS AND THE UNIT'S GRADE (MILITARY_DEPTH_PLAN §10.7).
 *
 * Stage 3's first item, and it is first because two things already built hang
 * off it: the Meritorious Unit Commendation is supposed to be earned in PEACE
 * by a unit that did a hard job well, and the annual evaluation is supposed to
 * be able to say why a year went badly.
 *
 * THREE THINGS, and the third is the one that matters.
 *
 *   A BOARD IS A PANEL OF NAMED PEOPLE AND YOU CAN FAIL IT. Uniform,
 *   questions, three senior NCOs from your own unit who have their own
 *   opinions of you (§10.2's `regardBetween` already models exactly that, so
 *   the board reads it rather than inventing a second opinion).
 *
 *   AN INSPECTION GRADES THE UNIT, NOT YOU. That is where a unit's
 *   reputation comes from, and it is the peacetime road to the MUC.
 *
 *   THE GRADE IS DERIVED, NOT STORED. A unit's grade this year IS what its
 *   people were rated plus how it did at its last inspection — both of which
 *   are already on the record. Nothing to migrate, and a save written before
 *   this loads with its history intact.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { toDate } from './clock.js'
import { recordDecision, recordEvent } from './records.js'
import { factor } from './records.js'
import { hash32, openStream, Stream } from './rng.js'
import { rankTitle } from './service.js'
import { unitGradeOf, unitKeyOf } from './unitawards.js'
import type { World } from './types.js'

/** Inspections come round once a year, on the same grid the awards use. */
const INSPECTED_EVERY = TICKS_PER_YEAR

/** Below this a unit is failing its inspections and everybody knows. */
export const GRADE_FAILING = 400
/** At or above this the unit is in MUC territory on merit alone. */
export const GRADE_EXCELLENT = 700


/**
 * THE ANNUAL INSPECTION.
 *
 * The unit is graded, the grade goes on the record as an event every member
 * can read, and a bad one is a real thing that happened to everybody who was
 * there rather than a number nobody sees.
 */
export function runInspections(world: World, tick: Tick): void {
  if (tick <= 0 || tick % INSPECTED_EVERY !== 0) return
  const year = toDate(world, tick).year

  const keys = new Set<string>()
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    const key = unitKeyOf(world, record.personId)
    if (key !== null) keys.add(key)
  }

  for (const key of [...keys].sort()) {
    const grade = unitGradeOf(world, key, tick)
    if (grade === 0) continue
    const members: EntityId[] = []
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      if (unitKeyOf(world, record.personId) !== key) continue
      if (world.people.get(record.personId)?.deathTick !== null) continue
      members.push(record.personId)
    }
    if (members.length < 3) continue
    members.sort((a, b) => a - b)

    // THE DAY ITSELF IS DRAWN, because an inspection is a performance and a
    // good unit can have a bad morning. Seeded on the unit and the year.
    const draw = hash32(world.seed, Stream.Service, Math.abs(keyNumber(key)), 83_000 + year)
    const onTheDay = Math.max(0, Math.min(1000, grade + ((draw % 240) - 120)))
    const verdict =
      onTheDay >= GRADE_EXCELLENT
        ? 'outstanding'
        : onTheDay >= 550
          ? 'satisfactory'
          : onTheDay >= GRADE_FAILING
            ? 'marginal'
            : 'failed'

    for (const id of members) {
      recordEvent(world, tick, {
        type: 'unit-inspected',
        subjectId: id,
        detail: `${verdict}|${String(onTheDay)}|${String(year)}`,
      })
    }
  }
}

/** A stable number from a unit key, for the seeded draw. */
function keyNumber(key: string): number {
  let n = 0
  for (let i = 0; i < key.length; i += 1) n = (n * 31 + key.charCodeAt(i)) | 0
  return n
}

/** The unit's last inspection, as anybody in it would remember it. */
export function lastInspectionOf(
  world: World,
  personId: EntityId,
): { readonly verdict: string; readonly grade: number; readonly year: number } | null {
  let found: { verdict: string; grade: number; year: number; tick: Tick } | null = null
  for (const event of world.events) {
    if (event.type !== 'unit-inspected' || event.subjectId !== personId) continue
    const parts = (event.detail ?? '').split('|')
    const entry = {
      verdict: parts[0] ?? 'satisfactory',
      grade: Number(parts[1] ?? '0'),
      year: Number(parts[2] ?? '0'),
      tick: event.tick,
    }
    if (found === null || entry.tick > found.tick) found = entry
  }
  return found === null
    ? null
    : { verdict: found.verdict, grade: found.grade, year: found.year }
}

/** How senior somebody has to be before a board will look at them. */
const BOARD_FROM_RANK = 3

/**
 * THE BOARD.
 *
 * Three senior people from the unit, by name, and they can turn you down. It
 * reads §10.2's `regardBetween` for each panel member rather than inventing a
 * second opinion of you — the first sergeant who has it in for you writes your
 * evaluation AND sits on your board, which is exactly the point.
 */
export interface BoardPanel {
  readonly members: readonly { readonly personId: EntityId; readonly title: string }[]
  /** 0–1000: how the room is disposed towards them before a word is said. */
  readonly regard: number
}

export function panelFor(
  world: World,
  personId: EntityId,
  regardOf: (world: World, raterId: EntityId, ratedId: EntityId) => number,
): BoardPanel | null {
  const own = world.service.get(personId)
  if (own === undefined || own.dischargedAtTick !== null) return null
  const key = unitKeyOf(world, personId)
  if (key === null) return null

  const seniors: { personId: EntityId; rank: number }[] = []
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (record.personId === personId) continue
    if (unitKeyOf(world, record.personId) !== key) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    if (record.rank <= own.rank) continue
    seniors.push({ personId: record.personId, rank: record.rank })
  }
  if (seniors.length === 0) return null

  // The most senior three, and id order under that so the panel is stable.
  seniors.sort((a, b) => b.rank - a.rank || a.personId - b.personId)
  const sitting = seniors.slice(0, 3)

  let regard = 0
  const members = sitting.map((each) => {
    const theirs = world.service.get(each.personId)
    const them = world.people.get(each.personId)
    regard += regardOf(world, each.personId, personId)
    return {
      personId: each.personId,
      title: `${
        theirs === undefined
          ? ''
          : `${rankTitle(world, theirs.branch, theirs.rank, theirs.commissioned === true)} `
      }${them?.givenName ?? ''} ${them?.familyName ?? ''}`.trim(),
    }
  })
  return { members, regard: Math.floor(regard / Math.max(1, sitting.length)) }
}

/**
 * SOLDIER OF THE YEAR, and the ordinary promotion board.
 *
 * A board is a thing you can FAIL, which is what makes appearing before one
 * worth anything. It reads the panel's regard, the person's own record and the
 * unit's grade — a good unit's board is a harder board, because the standard
 * in the room is the standard of the room.
 */
export function runBoards(world: World, tick: Tick): void {
  if (tick <= 0 || tick % INSPECTED_EVERY !== 6) return
  const year = toDate(world, tick).year

  for (const record of [...world.service.values()].sort((a, b) => a.personId - b.personId)) {
    if (record.dischargedAtTick !== null) continue
    if (record.rank < BOARD_FROM_RANK) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue

    const room = openStream(world.seed, Stream.Service, record.personId, tick + 84_000)
    // Not everybody goes before a board every year — it is an event, not a
    // fixture, and a fixture is how peacetime becomes ten identical years.
    if (!room.chance(180, 1_000)) continue

    const key = unitKeyOf(world, record.personId)
    const grade = key === null ? 500 : unitGradeOf(world, key, tick)
    // A HARDER ROOM IN A BETTER UNIT. The bar is the standard of the people
    // sitting behind the table, so doing well in a good unit is worth more
    // and is harder, which is true and is also the interesting version.
    const bar = 420 + Math.floor(grade / 5)
    const showing = record.performance + (room.chance(1, 2) ? 40 : -40)
    const passed = showing >= bar

    recordEvent(world, tick, {
      type: 'faced-a-board',
      subjectId: record.personId,
      detail: `${passed ? 'passed' : 'failed'}|${String(year)}`,
    })
    recordDecision(world, tick, {
      subjectId: record.personId,
      decision: 'board',
      significance: passed ? 'notable' : 'defining',
      inputs: [
        factor('strong-performance', record.performance),
        factor('unit-standing', grade),
      ],
      chosen: passed
        ? 'went before the board and was recommended'
        : 'went before the board and was turned down',
      rejected: [],
      streamId: Stream.Service,
    })
  }
}
