/**
 * UNIT AWARDS (MILITARY_DEPTH_PLAN §9.1).
 *
 * OWNER: "find out real life unit awards and figure a way to incorporate it
 * into the game because unit awards are different from people awards."
 *
 * They are, and the difference is sharper than it looks. Two real mechanics
 * carry all the weight:
 *
 * ONE — THE AWARD GOES TO THE UNIT, FOR A PERIOD OF DATES. Not to a person,
 * for an act. The citation names the unit and names the years. And the
 * Meritorious Unit Commendation can be earned for outstanding service over a
 * sustained period COMBAT OR NOT — which is why a maintenance company or a
 * hospital can be decorated, and the answer to "the military is only worth
 * playing during a war".
 *
 * TWO — PERMANENT VERSUS TEMPORARY WEAR, and this is the mechanic. Assigned
 * and PRESENT during the cited period, and you wear it for the rest of your
 * life; it is on your record at your funeral. Arrive afterwards and you wear
 * it only while you are in that unit — post out and it comes off your chest.
 *
 * Two soldiers stand next to each other wearing the same ribbon, one earned
 * it and one inherited it, and both of them know which. That is belonging,
 * encoded for free.
 *
 * HOW IT IS STORED, and why there is no new world state: a unit's honours ARE
 * the awards its people were given. Granting to everybody present writes the
 * permanent half directly, and the temporary half is then a READ — the awards
 * your current unit holds that you do not. Nothing to migrate, nothing to
 * drift, and a save written before this loads unchanged.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { grantUnitAward } from './awards.js'
import { toDate } from './clock.js'
import { eventsFor } from './eventindex.js'
import { activeWars, homeland } from './geopolitics.js'
import { recordEvent } from './records.js'
import { hash32, Stream } from './rng.js'
import type { World } from './types.js'

/**
 * WHICH UNIT SOMEBODY IS IN, as a stable string.
 *
 * A selected unit is its own name wherever its people are; everybody else is
 * their station and branch, which is exactly what `rosterFrom` uses to build
 * the roster they serve on.
 */
export function unitKeyOf(world: World, personId: EntityId): string | null {
  const record = world.service.get(personId)
  // SERVING, not discharged — the condition was inverted on the first pass
  // and returned null for every single person still in uniform, so not one
  // unit existed to decorate.
  if (record === undefined || record.dischargedAtTick !== null) return null
  if (record.unitId !== null) return `unit:${record.unitId}`
  return `post:${String(record.baseId)}:${record.branch}`
}

/** Everybody serving in this unit right now, in id order. */
function membersOf(world: World, key: string): EntityId[] {
  const found: EntityId[] = []
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    if (unitKeyOf(world, record.personId) !== key) continue
    found.push(record.personId)
  }
  return found.sort((a, b) => a - b)
}

/** A unit's honours: every unit award anybody has ever been given for it. */
export function unitHonoursOf(
  world: World,
  key: string,
): readonly { readonly title: string; readonly year: number }[] {
  const seen = new Map<string, { title: string; year: number }>()
  for (const awards of world.awards.values()) {
    for (const award of awards) {
      if (award.kind !== 'unit-award') continue
      if (!award.citation.startsWith(`${key}|`)) continue
      const parts = award.citation.split('|')
      const year = Number(parts[2] ?? '0')
      const stamp = `${award.title}:${String(year)}`
      if (!seen.has(stamp)) seen.set(stamp, { title: award.title, year })
    }
  }
  return [...seen.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
}

/**
 * WHAT A UNIT IS WORTH THIS YEAR, 0–1000.
 *
 * Read from its people: how they are rated, what it cost them, and whether
 * anybody has been in trouble. A unit is not a stat — it is the people in it,
 * which is the whole premise of §9.0.
 */
export function unitGradeOf(world: World, key: string, tick: Tick): number {
  let performance = 0
  let people = 0
  let punished = 0
  const members: EntityId[] = []
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (unitKeyOf(world, record.personId) !== key) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    performance += record.performance
    people += 1
    members.push(record.personId)
  }
  if (people === 0) return 0

  /**
   * THROUGH THE INDEX, per member, rather than over every event in the world.
   * `members.includes` inside a full-world scan is a second linear factor on
   * top of a linear scan — the same shape that took `tediumOf` past a
   * fifteen-minute timeout.
   */
  for (const id of members) {
    for (const event of eventsFor(world, id)) {
      if (event.tick < tick - INSPECTED_EVERY || event.tick > tick) continue
      // Discipline inside the unit is the unit's problem, which is exactly
      // what §10.3 means by "their problems become yours".
      if (event.type === 'disciplined' || event.type === 'was-convicted') punished += 1
    }
  }

  const average = Math.floor(performance / people)
  const discipline = Math.min(300, punished * 60)
  return Math.max(0, Math.min(1000, average - discipline))
}

export interface UnitAwardStanding {
  readonly title: string
  readonly year: number
  /** Present during the cited period: worn for life. Otherwise inherited. */
  readonly permanent: boolean
}

/**
 * WHAT THIS PERSON WEARS, and by which right.
 *
 * Permanent entries are the ones on their own record — they were there.
 * Temporary entries are their unit's honours that they do not hold, worn only
 * while they remain in it.
 */
export function unitAwardsFor(world: World, personId: EntityId): readonly UnitAwardStanding[] {
  const mine = new Map<string, UnitAwardStanding>()
  for (const award of world.awards.get(personId) ?? []) {
    if (award.kind !== 'unit-award') continue
    const year = Number(award.citation.split('|')[2] ?? '0')
    mine.set(`${award.title}:${String(year)}`, { title: award.title, year, permanent: true })
  }
  const key = unitKeyOf(world, personId)
  if (key !== null) {
    for (const honour of unitHonoursOf(world, key)) {
      const stamp = `${honour.title}:${String(honour.year)}`
      if (mine.has(stamp)) continue
      mine.set(stamp, { title: honour.title, year: honour.year, permanent: false })
    }
  }
  return [...mine.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
}

/**
 * THE THREE AWARDS, in precedence order, with the real criteria.
 *
 * The naval and air services carry their own equivalents; branch parity is
 * content rather than mechanism and is deliberately left for later.
 */
const PRESIDENTIAL = 'the Presidential Unit Citation'
const VALOROUS = 'the Valorous Unit Award'
const MERITORIOUS = 'the Meritorious Unit Commendation'

/** A unit is considered once a year, on a fixed grid. */
const CONSIDERED_EVERY = TICKS_PER_YEAR

/** One year of events is the window a grade is read over. */
const INSPECTED_EVERY = TICKS_PER_YEAR

/**
 * Decorate the units that earned it this year.
 *
 * WAR IS NOT THE ONLY ROAD, and that is the point of the third award: a unit
 * that did a hard job well for a sustained period is decorated whether or not
 * anybody shot at it.
 */
export function runUnitAwards(world: World, tick: Tick): void {
  if (tick <= 0 || tick % CONSIDERED_EVERY !== 0) return
  const year = toDate(world, tick).year
  const home = homeland(world)
  const atWar =
    home !== undefined && activeWars(world).some((w) => w.a === home.id || w.b === home.id)

  const keys = new Set<string>()
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    const key = unitKeyOf(world, record.personId)
    if (key !== null) keys.add(key)
  }

  for (const key of [...keys].sort()) {
    const members = membersOf(world, key)
    if (members.length < 3) continue

    // WHAT THE UNIT DID THIS YEAR, read from its own people rather than
    // asserted: how well they were rated, and what it cost them.
    let performance = 0
    let wounded = 0
    let killed = 0
    for (const id of members) {
      performance += world.service.get(id)?.performance ?? 0
    }
    // Through the index, per member — same reason as the grade above: a
    // `members.includes` inside a full-world scan is two linear factors.
    for (const id of members) {
      for (const event of eventsFor(world, id)) {
        if (event.tick < tick - CONSIDERED_EVERY || event.tick > tick) continue
        if (event.type === 'wounded-in-action') wounded += 1
        if (event.type === 'died') killed += 1
      }
    }
    /**
     * THE PEACETIME ROAD IS THE UNIT'S GRADE (plan §10.7, and the MUC has
     * always been meant to hang off it). It used to be the raw average of
     * what everybody was rated, which cannot be failed and cannot be earned;
     * the grade subtracts the unit's discipline, so a company that spent the
     * year in trouble does not get decorated for it.
     */
    const average = unitGradeOf(world, key, tick)

    /**
     * SEEDED ON THE UNIT AND THE YEAR, so a decoration is a fact about that
     * year rather than something that re-rolls when anything is recomputed.
     */
    const draw = hash32(world.seed, Stream.Service, Math.abs(hashKey(key)), 77_000 + year)
    const title =
      atWar && killed > 0 && wounded >= 2 && draw % 1000 < 220
        ? PRESIDENTIAL
        : atWar && wounded > 0 && draw % 1000 < 420
          ? VALOROUS
          : average >= 620 && draw % 1000 < 260
            ? MERITORIOUS
            : null
    if (title === null) continue

    // ALREADY HELD FOR THIS YEAR? A unit is decorated once for a period.
    if (unitHonoursOf(world, key).some((h) => h.title === title && h.year === year)) continue

    /**
     * ONE EVENT EACH, not one event for the unit.
     *
     * The first pass filed a single `unit-awarded` event against the senior
     * man and cited it on everybody's record — and awards.test.ts caught it
     * at once: "expected 37 to be 222". The invariant it defends is a good
     * one and it is Law 3's, not a formality — an award on YOUR record has to
     * cite an event about YOU, or the game cannot explain why you hold it
     * without pointing at somebody else's life. It is also how every personal
     * decoration in the game already works.
     *
     * The event still says the same thing in every feed, because the thing
     * that happened is the same thing: the unit was decorated, and you were
     * in it.
     */
    for (const id of members) {
      const cited = recordEvent(world, tick, {
        type: 'unit-awarded',
        subjectId: id,
        detail: `${title}|${String(year)}`,
      })
      grantUnitAward(world, tick, id, title, `${key}|${title}|${String(year)}`, cited)
    }
  }
}

/** A stable number from a unit key, for the seeded draw. */
function hashKey(key: string): number {
  let n = 0
  for (let i = 0; i < key.length; i += 1) n = (n * 31 + key.charCodeAt(i)) | 0
  return n
}
