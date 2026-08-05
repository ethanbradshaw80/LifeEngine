/**
 * THE ARTICLE 15 — nonjudicial punishment, as a paper you sign.
 *
 * The discipline itself already existed and is NOT rebuilt here: the
 * M-ARMY2 misconduct pass in service.ts produces the `'disciplined'` event,
 * busts the stripe, and ends a career on the third mark inside five years.
 * What it never had was a document. A demotion arrived as one line in the
 * story log — the single most consequential thing that can happen to a
 * serving player short of a wound, delivered with less ceremony than a
 * promotion board.
 *
 * So this is the same family as the contract, the orders sheet and the
 * DD-214: an engine builder that returns plain data, and a component that
 * writes nothing. Everything on the page is read from the record or from a
 * seeded stream keyed to the tick, so a replay produces identical paper.
 *
 * The crest on it is an invented device, never a real seal (charter §3).
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import { toDate } from './clock.js'
import { FAMILY_NAMES } from './names.js'
import { branchSpecFor } from './worldspec.js'
import type { World } from './types.js'

const STAMP_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const

/** The orders sheet's date shape: this world has months, not days. */
function stamped(world: World, tick: Tick): string {
  const { year, month } = toDate(world, tick)
  return `${STAMP_MONTHS[month - 1] ?? 'JANUARY'} ${String(year)}`
}

/** How long the file remembers a mark — service.ts uses the same span. */
const WINDOW_MONTHS = 60
const STRIKES_END_A_CAREER = 3

export interface Article15 {
  /** "Record of Nonjudicial Punishment · Article 15, UCMJ" */
  readonly title: string
  readonly command: string
  readonly station: string
  readonly articleNo: string
  readonly controlNo: string
  readonly dated: string
  readonly name: string
  /** "SPC (reduced from SGT)" where a stripe was lost; plain grade if not. */
  readonly grade: string
  /** True when this punishment took a grade — the paper stamps REDUCED. */
  readonly reduced: boolean
  readonly offence: string
  readonly offenceDate: string
  /** The numbered body of the paper, in order. */
  readonly findings: readonly string[]
  /** How many marks stand inside five years, counting this one. */
  readonly markNumber: number
  readonly marksAllowed: number
  readonly acknowledgment: string
  readonly imposedBy: string
  readonly memberSignature: string
}

const ACKNOWLEDGMENT =
  'I have been afforded the opportunity to be heard, to examine the evidence, ' +
  'and to present matters in my defense. I understand this proceeding and my right of appeal.'

/**
 * What to call a rank on this ladder.
 *
 * Read INLINE rather than imported from service.ts: that module imports
 * player.ts for `raisePending`, and player.ts imports this one to render
 * the paper — a cycle the import ratchet catches immediately. Same trick
 * health.ts and finances.ts already use, and the read is two lines.
 */
function titleOn(world: World, branch: string, rank: number, commissioned: boolean): string {
  const spec = branchSpecFor(world, branch)
  const ladder = commissioned ? (spec.officerRanks ?? []) : spec.ranks
  if (ladder.length === 0) return `#${String(rank)}`
  return ladder[Math.max(0, Math.min(ladder.length - 1, rank))] ?? ladder[0] ?? 'PVT'
}

/** Initials and surname, the way a signature block reads. */
function signatureOf(given: string, family: string): string {
  const initial = given.slice(0, 1).toUpperCase()
  return `${initial}. ${family}`
}

/**
 * Build the paper for the punishment imposed on this person at this tick.
 *
 * Returns undefined when there is no such punishment — the caller has a
 * pending referring to a tick, and a record that has since been rewritten
 * must not produce a document about a thing that did not happen.
 */
export function article15For(
  world: World,
  personId: EntityId,
  disciplineTick: Tick,
): Article15 | undefined {
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || !record) return undefined

  const event = world.events.find(
    (e) => e.type === 'disciplined' && e.subjectId === personId && e.tick === disciplineTick,
  )
  if (!event) return undefined

  // The detail carries the infraction, and " — busted a stripe" where one
  // was lost. The paper needs them apart.
  const detail = event.detail ?? 'a mark on the file'
  const reduced = detail.includes('busted a stripe')
  const offence = reduced ? (detail.split(' — ')[0] ?? detail) : detail

  const spec = branchSpecFor(world, record.branch)
  const commissioned = record.commissioned === true
  const nowGrade = titleOn(world, record.branch, record.rank, commissioned)
  // The grade BEFORE the bust is one rung up the same ladder. Read rather
  // than remembered: the record only keeps where they are now.
  const wasGrade = reduced
    ? titleOn(world, record.branch, Math.min(record.rank + 1, spec.ranks.length - 1), commissioned)
    : nowGrade

  const marks = world.events.filter(
    (e) =>
      e.type === 'disciplined' &&
      e.subjectId === personId &&
      e.tick <= disciplineTick &&
      disciplineTick - e.tick < WINDOW_MONTHS,
  ).length

  // The document's own details — its number, and who imposed it — come off
  // a seeded stream keyed to the tick, so the same month always prints the
  // same paper.
  const rng = openStream(world.seed, Stream.Service, personId, disciplineTick + 7_700)
  const articleNo = String(1_000 + rng.nextInt(0, 9_000))

  const base = record.baseId === null ? undefined : world.places.get(record.baseId)
  const unit = record.unitId === null ? undefined : world.spec.units.find((u) => u.id === record.unitId)

  // The imposing commander is a rank and a name, not a person in the world:
  // a company commander is not modelled, and inventing a real one would put
  // an unowned person on a document. Seeded, so it is the same on a replay.
  const commanderInitial = String.fromCharCode(65 + rng.nextInt(0, 26))
  const commanderName = rng.pick(FAMILY_NAMES)

  const findings: string[] = [
    `You are notified that nonjudicial punishment is imposed for ${offence}, in violation of the Uniform Code of Military Justice.`,
  ]
  findings.push(
    reduced
      ? `Punishment imposed: reduction one grade (${wasGrade} to ${nowGrade}); forfeiture of pay; extra duty and restriction.`
      : 'Punishment imposed: forfeiture of pay; extra duty and restriction.',
  )
  findings.push(
    marks >= STRIKES_END_A_CAREER
      ? 'This is the third entry in your record inside five years. The career ends here.'
      : `This is entry ${String(marks)} in your record inside five years. A third ends a career.`,
  )

  return {
    title: 'Record of Nonjudicial Punishment · Article 15, UCMJ',
    command: unit?.name ?? spec.name,
    station: base?.name ?? 'Station unrecorded',
    articleNo: `ART. 15 · NO. ${articleNo}`,
    controlNo: articleNo,
    dated: stamped(world, disciplineTick),
    name: `${person.familyName}, ${person.givenName}`,
    grade: reduced ? `${nowGrade} (reduced from ${wasGrade})` : nowGrade,
    reduced,
    offence,
    offenceDate: stamped(world, disciplineTick),
    findings,
    markNumber: marks,
    marksAllowed: STRIKES_END_A_CAREER,
    acknowledgment: ACKNOWLEDGMENT,
    imposedBy: `CPT ${commanderInitial}. ${commanderName}`,
    memberSignature: signatureOf(person.givenName, person.familyName),
  }
}
