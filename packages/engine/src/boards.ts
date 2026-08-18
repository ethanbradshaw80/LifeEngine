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
import { eventsFor } from './eventindex.js'
import { recordEvent } from './records.js'
import { hash32, Stream } from './rng.js'
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
  // A READ, not a tick cost — but it is one person's history, so it goes
  // through the index like every other one-person history in the engine.
  let found: { verdict: string; grade: number; year: number; tick: Tick } | null = null
  for (const event of eventsFor(world, personId)) {
    if (event.type !== 'unit-inspected') continue
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

/**
 * THE PROMOTION BOARD WAS ALREADY BUILT, AND I BUILT A SECOND ONE.
 *
 * OWNER: "remove this from the feed we already have a board thing set up."
 *
 * He is right, and it was worse than a noisy feed line. `service.ts` has
 * `boardStandingFor`, with its own screen on the Career tab that explains what
 * a board wants of you and how far off it you are. `runBoards` here added a
 * SECOND board, on a different schedule, with a different bar, writing its own
 * event — two systems answering the same question, which is exactly what Law
 * 12 forbids and the kind of thing a player feels as incoherence long before
 * anybody finds it in the code.
 *
 * Deleted rather than hidden. What stays in this file is the INSPECTION, which
 * grades the UNIT rather than the person and which nothing else does — it is
 * what the peacetime Meritorious Unit Commendation is earned on (§10.7).
 */
