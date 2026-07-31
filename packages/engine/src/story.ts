/**
 * Rendering a life as readable prose.
 *
 * This is the "explanation projection" of docs/CAUSAL_RECORDS.md §2: generated
 * on demand from stored facts, never stored itself. Storing generated sentences
 * would double the data and let the text drift out of sync with the records it
 * describes.
 *
 * The hard rule (§6): never invent a factor that is not in the record, and
 * never reorder factors for narrative effect. Weight order is the truth. If
 * there is no record, "no record of why" is the correct answer — a plausible
 * fabrication is worse than an admission.
 *
 * This file matters more than it looks. The milestone's exit criterion is that
 * a generated life reads as a coherent, plausible life. If the text is not
 * worth reading, no interface will rescue it.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { ageAt, formatYear } from './clock.js'
import { occupationById } from './content.js'
import { decisionForEvent, decisionsFor, eventsFor } from './records.js'
import { withArticle } from './text.js'
import type { CausalRecord, FactorId, Person, World, WorldEvent } from './types.js'

export function fullName(person: Person): string {
  return `${person.givenName} ${person.familyName}`
}

function nameOf(world: World, id: EntityId | null): string {
  if (id === null) return 'someone'
  const person = world.people.get(id)
  return person ? fullName(person) : 'someone'
}

function placeName(world: World, id: EntityId | null): string {
  if (id === null) return 'town'
  return world.places.get(id)?.name ?? 'town'
}

function subjectPronoun(person: Person): string {
  return person.sex === 'female' ? 'She' : 'He'
}

function objectPronoun(person: Person): string {
  return person.sex === 'female' ? 'her' : 'him'
}


/** One readable line per event. */
function describeEvent(world: World, person: Person, event: WorldEvent): string | null {
  const year = formatYear(event.tick)
  const age = ageAt(person.birthTick, event.tick)
  const they = subjectPronoun(person)

  // Events where this person is the "other" party read from their side. The
  // wording matches the subject-side phrasing exactly — a timeline that
  // alternates between "Became friends with X" and "She became friends with X"
  // reads as though two different things happened.
  if (event.subjectId !== person.id) {
    switch (event.type) {
      case 'befriended':
        return `${year} — Became friends with ${nameOf(world, event.subjectId)}.`
      case 'friendship-lapsed':
        return `${year} — Drifted apart from ${nameOf(world, event.subjectId)}.`
      case 'moved-in-together':
        return `${year} — Moved in with ${nameOf(world, event.subjectId)}.`
      case 'had-child':
        return null // rendered from the parent's side
      default:
        return null
    }
  }

  switch (event.type) {
    case 'born':
      return `${year} — Born in ${placeName(world, event.placeId)}.`
    case 'started-school':
      return event.detail === 'college' || event.detail === 'trade'
        ? `${year} — At ${age}, ${they.toLowerCase()} began ${event.detail === 'college' ? 'college' : 'trade school'}.`
        : `${year} — Started ${event.detail} school at ${age}.`
    case 'finished-school':
      return `${year} — Finished ${event.detail === 'college' ? 'college' : event.detail} at ${age}.`
    case 'hired':
      return `${year} — Took work as ${withArticle(event.detail ?? 'labourer')} at ${placeName(world, event.placeId)}.`
    case 'left-job':
      if (event.detail === 'retired') return `${year} — Retired at ${age}.`
      if (event.detail === 'let go') return `${year} — Lost the job.`
      return null // job-change departures read better as the arrival line alone
    case 'befriended':
      return `${year} — Became friends with ${nameOf(world, event.otherId)}.`
    case 'friendship-lapsed':
      return `${year} — Drifted apart from ${nameOf(world, event.otherId)}.`
    case 'left-home':
      return `${year} — At ${age}, moved out to ${placeName(world, event.placeId)}.`
    case 'moved-in-together':
      return `${year} — Moved in with ${nameOf(world, event.otherId)}.`
    case 'moved-house':
      return `${year} — Moved to ${placeName(world, event.placeId)}.`
    case 'had-child':
      return `${year} — ${nameOf(world, event.otherId)} was born.`
    case 'died':
      return `${year} — Died at ${age}, of ${event.detail}.`
    default:
      return null
  }
}

/** Plain-English phrasing for a stored factor. Never invented — one per FactorId. */
const FACTOR_PHRASES: Readonly<Record<FactorId, string>> = {
  'qualified-for-role': '{they} was qualified for it',
  'higher-pay': 'the pay was better',
  ambition: '{they} wanted to get on',
  'poor-performance': 'the work had not been going well',
  'no-local-vacancy': 'there was nothing else going in town',
  'reached-adulthood': '{they} was old enough',
  'has-income': '{they} had steady wages',
  'close-friendship': '{they} was close to someone',
  'household-crowded': 'the house was crowded',
  'better-neighbourhood': 'it was a better part of town',
  'can-afford-move': '{they} could afford it',
  'old-age': 'age',
  frailty: 'poor health',
  accident: 'an accident',
}

function joinClauses(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * Explain one decision from its record. Factors are rendered in stored weight
 * order — the top three only, because a fifty-factor list explains nothing.
 */
export function explainDecision(world: World, record: CausalRecord): string {
  const person = world.people.get(record.subjectId)
  const who = person ? fullName(person) : 'They'
  const they = person ? subjectPronoun(person).toLowerCase() : 'they'

  const ranked = [...record.inputs].sort((a, b) => b.weight - a.weight)
  const reasons = ranked.slice(0, 3).map((input) => {
    const phrase = FACTOR_PHRASES[input.factor].replace('{they}', they)
    return input.referencedEntityId !== null
      ? `${phrase} (${nameOf(world, input.referencedEntityId)})`
      : phrase
  })

  // Death reads as noun phrases -- "Because of age and poor health" -- where
  // other decisions read as clauses. Forcing one shape on both produces
  // "Because age, and poor health", which is not a sentence.
  const isDeath = record.decision === 'death'
  const because =
    reasons.length > 0 ? ` Because ${isDeath ? 'of ' : ''}${joinClauses(reasons)}.` : ''

  const alternative =
    record.rejected.length > 0 ? ` The alternative was ${record.rejected[0]}.` : ''

  return `${formatYear(record.tick)}: ${who} ${record.chosen}.${because}${alternative}`
}

/**
 * Answer "why did this happen?" for a person's most recent decision of a type.
 * Returns an honest admission when nothing was recorded — see §6.
 */
export function explainWhy(
  world: World,
  personId: EntityId,
  decision: CausalRecord['decision'],
): string {
  const records = decisionsFor(world, personId).filter((r) => r.decision === decision)
  const latest = records[records.length - 1]
  if (latest === undefined) {
    return 'There is no record of why. The simulation did not observe that decision.'
  }
  return explainDecision(world, latest)
}

// ---------------------------------------------------------------------------
// Structured timeline
//
// lifeStory() returns one block of text, which is right for reading or export.
// The interface needs the same content as data so it can attach a "Why?"
// control to the entries that actually have an explanation.
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  readonly eventId: number
  readonly tick: Tick
  readonly year: string
  /** One readable sentence describing what happened. */
  readonly text: string
  /** The decision behind it, or null if this was not a choice. */
  readonly decision: CausalRecord | null
}

/**
 * A person's life as structured entries, oldest first.
 *
 * `decision` is null for events that were not decisions — being born, a
 * friendship lapsing, a child arriving. The interface must show no "Why?"
 * control for those rather than inventing a reason.
 */
export function timelineFor(world: World, personId: EntityId): TimelineEntry[] {
  const person = world.people.get(personId)
  if (!person) return []

  const entries: TimelineEntry[] = []
  for (const event of eventsFor(world, personId)) {
    const text = describeEvent(world, person, event)
    if (text === null) continue
    entries.push({
      eventId: event.id,
      tick: event.tick,
      year: formatYear(event.tick),
      // The year prefix is already in the rendered line; strip it so the UI can
      // lay the date out in its own column.
      text: text.replace(/^\d+ — /, ''),
      decision: event.subjectId === personId ? decisionForEvent(world, event) : null,
    })
  }
  return entries
}

/** A person's life, as prose. The milestone's exit criterion. */
export function lifeStory(world: World, personId: EntityId): string {
  const person = world.people.get(personId)
  if (!person) return `No person with id ${personId}.`

  const lines: string[] = []
  const alive = person.deathTick === null
  const age = ageAt(person.birthTick, alive ? world.tick : person.deathTick!)

  lines.push(fullName(person))
  lines.push('='.repeat(fullName(person).length))
  lines.push('')

  // Opening summary.
  const born = `Born ${formatYear(person.birthTick)} in ${world.town.name}.`
  const status = alive
    ? `Aged ${age} as of ${formatYear(world.tick)}.`
    : `Died ${formatYear(person.deathTick!)}, aged ${age}, of ${person.causeOfDeath}.`
  lines.push(`${born} ${status}`)

  const job = world.employment.get(personId)
  if (job && alive) {
    const occupation = occupationById(job.occupationId)
    lines.push(
      `Works as ${withArticle(occupation.title)}, earning ${formatMoney(job.monthlyPay)} a month.`,
    )
  }

  const education = world.education.get(personId)
  if (education && education.level !== 'none') {
    lines.push(`Schooling: ${education.level}.`)
  }

  // Employment and household are cleared on death, so a living person's
  // household is the current one. Past tense for the dead: "Lives in Cedar
  // Flats" under a death notice is the kind of detail that breaks the spell.
  const household = person.householdId === null ? null : world.households.get(person.householdId)
  if (household) {
    const others = household.memberIds.filter((id) => id !== personId)
    const place = placeName(world, household.placeId)
    const names = others.map((id) => nameOf(world, id)).join(', ')
    if (alive) {
      lines.push(others.length > 0 ? `Lives in ${place} with ${names}.` : `Lives alone in ${place}.`)
    } else {
      lines.push(others.length > 0 ? `Lived in ${place} with ${names}.` : `Lived alone in ${place}.`)
    }
  }

  if (person.parentIds.length > 0) {
    lines.push(`Child of ${person.parentIds.map((id) => nameOf(world, id)).join(' and ')}.`)
  }

  lines.push('')
  lines.push('Life')
  lines.push('----')

  const timeline = eventsFor(world, personId)
    .map((event) => describeEvent(world, person, event))
    .filter((line): line is string => line !== null)

  if (timeline.length === 0) {
    lines.push('Nothing of note has happened yet.')
  } else {
    lines.push(...timeline)
  }

  const decisions = decisionsFor(world, personId)
  if (decisions.length > 0) {
    lines.push('')
    lines.push('Why')
    lines.push('---')
    for (const record of decisions) {
      lines.push(explainDecision(world, record))
    }
  }

  return lines.join('\n')
}

/** One-line summary, for listing many people at once. */
export function personSummary(world: World, personId: EntityId): string {
  const person = world.people.get(personId)
  if (!person) return `unknown person ${personId}`

  const alive = person.deathTick === null
  const age = ageAt(person.birthTick, alive ? world.tick : person.deathTick!)
  const job = world.employment.get(personId)
  const occupation = job ? occupationById(job.occupationId).title : null

  if (!alive) return `${fullName(person)}, died at ${age} (${person.causeOfDeath})`
  if (occupation) return `${fullName(person)}, ${age}, ${occupation}`
  const education = world.education.get(personId)
  if (education?.enrolledIn) return `${fullName(person)}, ${age}, in ${education.enrolledIn} school`
  return `${fullName(person)}, ${age}`
}

/** Where the pronoun helper is needed by callers building their own prose. */
export { objectPronoun, subjectPronoun }
