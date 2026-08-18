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
import { deploymentsOf } from './deployment.js'
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
  /** The named operation, where the tour has one. */
  readonly operation: string | null
  /** What the unit had been told to do that day. */
  readonly mission: string
  /** What the unit was doing when it happened. */
  readonly narrative: string
  /** The dry, timed spine of a real report: three or four lines, no adjectives. */
  readonly sequence: readonly string[]
  /** "Enemy strength assessed at 8-10." Always hedged. */
  readonly enemyStrength: string
  /** "Enemy losses assessed at 6." An ESTIMATE, and the only place it appears. */
  readonly enemyLosses: string
  /** "1 KIA, 1 WIA (evacuated, returned to duty)." */
  readonly friendly: string
  /** The friendly casualties BY NAME. Empty on a contact that cost nothing. */
  readonly casualties: readonly string[]
  /** What the unit says should change. Mundane on purpose — real ones are. */
  readonly recommendations: string
  readonly signedBy: string
  readonly signedRole: string
}

/**
 * THE CONTENT POOLS.
 *
 * A report is not written in the voice of the man who lived it, and that is
 * the whole reason it exists as a separate document: it is flat, procedural
 * and a little bureaucratic, and reading it after the story feed's account of
 * the same afternoon is the point.
 *
 * Everything below is drawn seeded on the contact, so a filed report says the
 * same thing for ever.
 */
const MISSIONS: readonly (readonly string[])[] = [
  // Tier 0 — the rear, and it is a job like any other.
  [
    'Base support operations in the rear area.',
    'Convoy escort along the main supply route.',
    'Security of the logistics area during resupply.',
  ],
  // Tier 1
  [
    'Route security along the northern approach.',
    'Perimeter security of the forward operating position.',
    'Security patrol of the assigned sector.',
  ],
  // Tier 2
  [
    'Deliberate patrol of the assigned sector.',
    'Screening operations forward of the main body.',
    'Occupation of an observation position overwatching the valley road.',
  ],
  // Tier 3
  [
    'Movement to contact along the assigned axis of advance.',
    'Clearance of the objective and consolidation on it.',
    'Reconnaissance in force forward of the phase line.',
  ],
]

const OPENINGS: readonly string[] = [
  'Element departed the forward position in order of march.',
  'Element crossed the line of departure on foot.',
  'Element occupied its position and established observation.',
  'Element halted for a security halt short of the objective.',
]

const CONTACTS: readonly string[] = [
  'Element received effective small-arms fire from the near side of the wadi.',
  'Lead element received fire from a treeline to the front, range approximately 200 metres.',
  'Element took indirect fire on the position; three rounds impacted inside the perimeter.',
  'Element observed movement to the flank and was engaged from a prepared position.',
  'Lead vehicle struck a device; the element dismounted and returned fire.',
]

const RESPONSES: readonly string[] = [
  'Element returned fire and manoeuvred a team to the flank.',
  'Element established a base of fire and requested support.',
  'Element went to ground behind the near bank and returned fire by team.',
  'Element suppressed the position and closed on it.',
]

const ENDINGS: readonly string[] = [
  'Fire superiority established. Enemy withdrew to the northeast.',
  'Contact broke off. Element consolidated and conducted a headcount.',
  'Element broke contact and withdrew to the rally point.',
  'Position cleared. Element consolidated and evacuated casualties.',
]

const RECOMMENDATIONS: readonly string[] = [
  'Radio discipline on the company net requires correction.',
  'Sector sketches to be updated before the next rotation.',
  'Resupply of 40mm was inadequate to the length of the engagement.',
  'Rehearsal of the casualty drill to be conducted at the next stand-down.',
  'Reporting timelines were not met; the first contact report was eleven minutes late.',
  'Nothing further. The drill was as rehearsed.',
]

function pick<T>(pool: readonly T[], draw: number): T | undefined {
  return pool.length === 0 ? undefined : pool[draw % pool.length]
}

/** "0712." Reports are timed to the minute, and the minutes are not round. */
function stamp(draw: number, minutesOn: number): string {
  const start = 5 * 60 + (draw % 600)
  const at = (start + minutesOn) % (24 * 60)
  const hour = Math.floor(at / 60)
  const minute = at % 60
  return `${hour < 10 ? '0' : ''}${String(hour)}${minute < 10 ? '0' : ''}${String(minute)}`
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
  const high = low + 2 + ((draw >>> 4) % 4)
  const losses = Math.max(0, Math.min(high, Math.floor(low / 2) + ((draw >>> 8) % 4)))

  /**
   * WHAT IT COST US, read from the record rather than assessed: the unit's
   * own losses are the one thing a report does not have to guess at.
   *
   * AND ONLY OURS. The first pass counted every casualty in the WORLD that
   * month, so a report of a firefight in one theatre silently included a man
   * hit six hundred miles away. The unit is the squad plus the roster, which
   * is exactly who was there.
   */
  const tour = deploymentsOf(world, personId).find(
    (each) =>
      each.startedAtTick <= event.tick &&
      (each.returnedAtTick === null || each.returnedAtTick >= event.tick),
  )
  const present = new Set<EntityId>([personId])
  for (const mate of tour?.squad ?? []) present.add(mate.personId)
  for (const member of roster?.members ?? []) present.add(member.personId)

  const named: string[] = []
  let killed = 0
  let hurt = 0
  for (const other of world.events) {
    if (other.tick !== event.tick) continue
    if (!present.has(other.subjectId)) continue
    const fell = other.type === 'died' && other.detail === 'wounds taken in action'
    const wounded = other.type === 'wounded-in-action'
    if (!fell && !wounded) continue
    if (fell) killed += 1
    else hurt += 1
    // BY NAME, because that is what a casualty line in a real report is.
    const them = world.people.get(other.subjectId)
    const theirs = world.service.get(other.subjectId)
    if (them === undefined) continue
    const rank =
      theirs === undefined
        ? ''
        : `${rankTitle(world, theirs.branch, theirs.rank, theirs.commissioned === true)} `
    named.push(
      `${rank}${them.familyName.toUpperCase()}, ${
        fell ? 'killed in action' : 'wounded, evacuated to the field hospital'
      }.`,
    )
  }

  const when = toDate(world, event.tick)
  const filedTick = (event.tick + 1) as Tick
  const filedOn = toDate(world, filedTick)

  /**
   * WHO SIGNED IT.
   *
   * The first version built a rank out of the subject's own — rank + 2, read
   * off the OFFICER ladder — and produced "COL WILLIAMS · Adjutant" at the
   * foot of a squad's report. That is the rank-ladder trap again: a rank is
   * an index into whichever ladder somebody is on, and adding two to it means
   * nothing. It is also the wrong man. A report is signed by whoever answers
   * for the unit, and the roster is ALREADY sorted with that person first —
   * so the signature is a real person, at the rank he really holds, in the
   * job he really does. Usually the squad leader; sometimes, when you are the
   * senior man, you.
   */
  const signer = roster?.members[0]
  const surname = signer?.name.split(' ').slice(-1)[0] ?? ''
  const narrative = event.detail ?? 'engaged from prepared positions'

  /**
   * THE SPINE OF THE DOCUMENT, drawn on its own salts so that two contacts in
   * the same month do not read identically. Timed to the minute and stripped
   * of adjectives, because that is what the form does to an afternoon: the
   * story feed keeps what it felt like, and this keeps what was recorded.
   */
  const shape = hash32(world.seed, Stream.CombatResolution, personId, 56_000 + event.tick)
  const tier = Math.max(0, Math.min(3, tour?.tier ?? 1))
  const opened = stamp(shape, 0)
  const met = stamp(shape, 22 + (shape % 40))
  const answered = stamp(shape, 26 + ((shape >>> 3) % 44))
  const ended = stamp(shape, 61 + ((shape >>> 6) % 90))
  const sequence = [
    `${opened}. ${pick(OPENINGS, shape) ?? OPENINGS[0] ?? ''}`,
    `${met}. ${pick(CONTACTS, shape >>> 5) ?? CONTACTS[0] ?? ''}`,
    `${answered}. ${pick(RESPONSES, shape >>> 9) ?? RESPONSES[0] ?? ''}`,
    `${ended}. ${pick(ENDINGS, shape >>> 13) ?? ENDINGS[0] ?? ''}`,
  ]

  return {
    title: 'AFTER-ACTION REVIEW',
    unit: roster?.unitName ?? 'the unit',
    command: `${branchName(world, record.branch)} · ${roster?.baseName ?? 'a home station'}`,
    occurred: `${String(when.month)}/${String(when.year)}`,
    filed: `${String(filedOn.month)}/${String(filedOn.year)} (${String(FILED_AFTER_DAYS)} days)`,
    place: enemy === undefined ? 'the front' : `the ${bareName(enemy.name)} front`,
    operation: tour?.operation ?? null,
    mission: pick(MISSIONS[tier] ?? MISSIONS[1] ?? [], shape >>> 17) ?? 'Operations as assigned.',
    narrative: narrative.endsWith('.') ? narrative : `${narrative}.`,
    sequence,
    enemyStrength: `Enemy strength assessed at ${String(low)}-${String(high)}.`,
    enemyLosses: `Enemy losses assessed at ${String(losses)}.`,
    friendly:
      killed === 0 && hurt === 0
        ? 'Friendly: no casualties.'
        : `Friendly: ${String(killed)} KIA, ${String(hurt)} WIA.`,
    casualties: named,
    /**
     * AND WHAT SHOULD CHANGE. Real recommendations are almost always small
     * and administrative — radio discipline, a rehearsal, an ammunition
     * count — which is exactly why they sell the document as a document.
     * A contact that cost somebody gets the drill rehearsed rather than
     * "nothing further".
     */
    recommendations:
      killed + hurt > 0
        ? (pick(RECOMMENDATIONS.slice(0, 5), shape >>> 21) ?? RECOMMENDATIONS[0] ?? '')
        : (pick(RECOMMENDATIONS, shape >>> 21) ?? RECOMMENDATIONS[0] ?? ''),
    signedBy:
      signer === undefined
        ? `${rankTitle(world, record.branch, record.rank, record.commissioned === true)} ${
            world.people.get(personId)?.familyName ?? ''
          }`.trim().toUpperCase()
        : `${signer.rankTitle} ${surname}`.trim().toUpperCase(),
    signedRole: signer?.role ?? 'Reporting',
  }
}
