/**
 * THE AFTER-ACTION REPORT (MILITARY_DEPTH_PLAN §5.3).
 *
 * OWNER'S RULING: "I think the after action report should be how its based
 * upon in real life."
 *
 * So it is a DOCUMENT, written by somebody, for the record — not a results
 * screen addressed to the player. It has an author, a date, a unit, a place
 * and a dry institutional voice. It says what the unit was doing, what
 * happened, what it cost, and what it ASSESSED of the enemy — and assessments
 * in real reports are hedged estimates, never scores.
 *
 * THE ASYMMETRY IS THE WHOLE POINT (foundation §8, and the review asked for
 * it in exactly these terms): at the time, the character saw muzzle flashes
 * on a ridge. The record, filed eleven days later, says the position held
 * eight to ten men and that six were assessed killed. THE CHARACTER NEVER
 * KNEW. The player does. Enemy losses appear HERE and nowhere else — never in
 * the narration of the moment, which is what the character lived.
 *
 * It can also be wrong, and it is never corrected: a report is written from
 * what was known at the time. That is why the numbers are seeded on the
 * event rather than read from any truth the engine keeps.
 *
 * NO NEW STATE. The report is derived from the `saw-combat` event that
 * already exists, so every contact ever recorded — including in saves written
 * before this — has one waiting to be read.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { toDate } from './clock.js'
import { eventsFor } from './eventindex.js'
import { hash32, Stream } from './rng.js'
import { branchName, rankTitle, unitRosterOf } from './service.js'
import { bareName } from './text.js'
import type { World, WorldEvent } from './types.js'

/** Days between the contact and the filing. Reports are not written that night. */
const FILED_AFTER_DAYS = 11

export interface AfterActionReport {
  /** "AFTER-ACTION REVIEW" — the form's own name. */
  readonly title: string
  readonly unit: string
  readonly command: string
  /** The month the contact happened, in words. */
  readonly occurred: string
  /** The date the report was filed — deliberately later. */
  readonly filed: string
  readonly place: string
  /** What the unit was doing when it happened. */
  readonly narrative: string
  /** "Enemy strength assessed at 8-10." Always hedged. */
  readonly enemyStrength: string
  /** "Enemy losses assessed at 6." An ESTIMATE, and the only place it appears. */
  readonly enemyLosses: string
  /** "1 KIA, 1 WIA (evacuated, returned to duty)." */
  readonly friendly: string
  readonly signedBy: string
  readonly signedRole: string
}

/** Every contact this person has a report for, newest first. */
export function afterActionsFor(world: World, personId: EntityId): readonly WorldEvent[] {
  return eventsFor(world, personId)
    .filter((event) => event.type === 'saw-combat' && event.subjectId === personId)
    .slice()
    .sort((a, b) => b.tick - a.tick)
}

/**
 * The filed report for one contact.
 *
 * Returns null for an event that is not a contact, so a caller cannot
 * manufacture a report for something that never happened.
 */
export function afterActionFor(
  world: World,
  personId: EntityId,
  event: WorldEvent,
): AfterActionReport | null {
  if (event.type !== 'saw-combat' || event.subjectId !== personId) return null
  const record = world.service.get(personId)
  if (record === undefined) return null

  const roster = unitRosterOf(world, personId)
  const enemy = event.otherId === undefined || event.otherId === null
    ? undefined
    : world.nations.get(event.otherId)

  /**
   * THE ASSESSMENT, seeded on the contact.
   *
   * Not read from any casualty the engine actually resolved — an assessment
   * is what the unit BELIEVED, and believing wrongly is a thing reports do.
   * Seeded on the event so the same report says the same thing for ever.
   */
  const draw = hash32(world.seed, Stream.CombatResolution, personId, 55_000 + event.tick)
  const low = 4 + (draw % 9)
  const high = low + 2 + ((draw >> 4) % 4)
  const losses = Math.max(0, Math.min(high, Math.floor(low / 2) + ((draw >> 8) % 4)))

  // WHAT IT COST US, read from the record rather than assessed: the unit's
  // own losses are the one thing a report does not have to guess at.
  let killed = 0
  let hurt = 0
  for (const other of world.events) {
    if (other.tick !== event.tick) continue
    if (other.type === 'died' && other.detail === 'wounds taken in action') killed += 1
    if (other.type === 'wounded-in-action') hurt += 1
  }

  const when = toDate(world, event.tick)
  const filedTick = (event.tick + 1) as Tick
  const filedOn = toDate(world, filedTick)

  return {
    title: 'AFTER-ACTION REVIEW',
    unit: roster?.unitName ?? 'the unit',
    command: `${branchName(world, record.branch)} · ${roster?.baseName ?? 'a home station'}`,
    occurred: `${String(when.month)}/${String(when.year)}`,
    filed: `${String(filedOn.month)}/${String(filedOn.year)} (${String(FILED_AFTER_DAYS)} days)`,
    place: enemy === undefined ? 'the front' : `the ${bareName(enemy.name)} front`,
    narrative: event.detail ?? 'engaged from prepared positions',
    enemyStrength: `Enemy strength assessed at ${String(low)}-${String(high)}.`,
    enemyLosses: `Enemy losses assessed at ${String(losses)}.`,
    friendly:
      killed === 0 && hurt === 0
        ? 'Friendly: no casualties.'
        : `Friendly: ${String(killed)} KIA, ${String(hurt)} WIA.`,
    signedBy: `${rankTitle(world, record.branch, Math.min(record.rank + 2, 8), true)} ${
      roster?.members[0]?.name.split(' ').slice(-1)[0] ?? 'ADJUTANT'
    }`.toUpperCase(),
    signedRole: 'Adjutant',
  }
}
