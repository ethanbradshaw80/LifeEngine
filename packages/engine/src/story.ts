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
import { spouseOf } from './relationships.js'
import { legacySummaryOf } from './legacy.js'
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
      case 'was-introduced':
        return `${year} — Introduced to ${nameOf(world, event.subjectId)} at ${event.detail ?? 'a town social'}.`
      case 'befriended':
        return `${year} — Became friends with ${nameOf(world, event.subjectId)}.`
      case 'friendship-lapsed':
        return `${year} — Drifted apart from ${nameOf(world, event.subjectId)}.`
      case 'moved-in-together':
        return `${year} — Moved in with ${nameOf(world, event.subjectId)}.`
      case 'started-courting':
        return `${year} — Began courting ${nameOf(world, event.subjectId)}.`
      case 'married':
        return `${year} — Married ${nameOf(world, event.subjectId)}.`
      case 'reconciled':
        return `${year} — ${nameOf(world, event.subjectId)} chose to stay and try again.`
      case 'divorced':
        return `${year} — Separated from ${nameOf(world, event.subjectId)}.`
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
    case 'got-raise': {
      const pay = event.detail === null ? null : Number.parseInt(event.detail, 10)
      return pay !== null && Number.isFinite(pay)
        ? `${year} — A raise: ${formatMoney(pay as never)} a month now.`
        : `${year} — A raise.`
    }
    case 'left-job':
      if (event.detail === 'retired') return `${year} — Retired at ${age}.`
      if (event.detail === 'let go') return `${year} — Lost the job.`
      if (event.detail === 'jailed') return `${year} — The job did not wait out the sentence.`
      if (event.detail === 'quit') return `${year} — Quit the job.`
      return null // job-change departures read better as the arrival line alone
    case 'was-introduced':
      return `${year} — Introduced to ${nameOf(world, event.otherId)} at ${event.detail ?? 'a town social'}.`
    case 'convalesced':
      return event.detail === 'rest'
        ? `${year} — Took to the bed and let it heal.`
        : `${year} — Worked through it.`
    case 'declined-board':
      return `${year} — Let the promotion board go by.`
    case 'kept-heads-down':
      return `${year} — Pinned down under fire; kept low and held.`
    case 'reconciled':
      return `${year} — Chose to stay and try again with ${nameOf(world, event.otherId)}.`
    case 'tended-marriage':
      return `${year} — Made time for the marriage.`
    case 'spent-time':
      return `${year} — An afternoon with ${nameOf(world, event.otherId)}.`
    case 'warned-at-work':
      return `${year} — The foreman had a word: the work was slipping.`
    case 'changed-spending':
      return event.detail === 'thrifty'
        ? `${year} — Tightened the household belt.`
        : event.detail === 'loose'
          ? `${year} — Let the money breathe a little.`
          : `${year} — Let the money find its own level.`
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
    case 'started-courting':
      return `${year} — At ${age}, began courting ${nameOf(world, event.otherId)}.`
    case 'courtship-ended':
      return `${year} — Stopped seeing ${nameOf(world, event.otherId)}.`
    case 'anniversary':
      return event.detail === 'ten years'
        ? `${year} — Ten years married to ${nameOf(world, event.otherId)}.`
        : event.detail === 'the silver'
          ? `${year} — The silver anniversary, with ${nameOf(world, event.otherId)}.`
          : `${year} — The golden anniversary, with ${nameOf(world, event.otherId)}.`
    case 'married':
      return `${year} — Married ${nameOf(world, event.otherId)} at ${age}.`
    case 'divorced':
      return `${year} — Separated from ${nameOf(world, event.otherId)}.`
    case 'widowed':
      return `${year} — ${nameOf(world, event.otherId)} died. Left widowed at ${age}.`
    case 'had-child':
      return `${year} — ${nameOf(world, event.otherId)} was born.`
    case 'was-injured': {
      const [grade, what] = (event.detail ?? '').split(':')
      const description = what && what.length > 0 ? what : 'an injury'
      return grade === 'serious'
        ? `${year} — Badly hurt: ${description}.`
        : `${year} — Hurt — ${description} — though not badly.`
    }
    case 'fell-ill': {
      const [grade, what] = (event.detail ?? '').split(':')
      const description = what && what.length > 0 ? what : 'an illness'
      return grade === 'serious'
        ? `${year} — Taken seriously ill: ${description}.`
        : `${year} — Down with ${description}.`
    }
    case 'saw-combat':
      return `${year} — ${event.detail ?? 'Contact'}.`
    case 'act-of-valor':
      return `${year} — ${event.detail !== null ? event.detail.charAt(0).toUpperCase() + event.detail.slice(1) : 'An act under fire'}.`
    case 'wounded-in-action': {
      const [grade, what] = (event.detail ?? '').split(':')
      const description = what && what.length > 0 ? what : 'wounds'
      return grade === 'serious'
        ? `${year} — Wounded in action: ${description}. It was bad.`
        : `${year} — Wounded in action: ${description}.`
    }
    case 'recovered': {
      if (event.detail?.startsWith('marked')) {
        const mark = event.detail.split(':')[1]
        return mark && mark.length > 0
          ? `${year} — Recovered — but ${mark}.`
          : `${year} — Recovered, but never quite the same.`
      }
      return `${year} — Back on ${objectPronoun(person) === 'her' ? 'her' : 'his'} feet.`
    }
    case 'enlisted':
      return `${year} — Enlisted as a ${event.detail ?? 'recruit'} at ${age}.`
    case 'promoted':
      return `${year} — Promoted to ${event.detail ?? 'a new rank'}.`
    case 'reenlisted':
      return `${year} — Signed for another term.`
    case 'discharged':
      return event.detail === 'medical'
        ? `${year} — Discharged on medical grounds at ${age}.`
        : event.detail === 'high-year tenure'
          ? `${year} — The service did not offer another term; separated at ${age}.`
          : `${year} — Left the service at ${age}.`
    case 'began-training':
      return `${year} — Reported to ${event.detail ?? 'training'}.`
    case 'completed-training':
      return `${year} — Finished ${event.detail ?? 'training'}.`
    case 'field-exercise':
      return `${year} — Out on ${event.detail ?? 'an exercise'}.`
    case 'earned-qualification':
      return `${year} — Qualified: ${event.detail ?? 'a new rating'}.`
    case 'changed-post':
      return `${year} — Posted to ${event.detail ?? 'a new station'}.`
    case 'awarded':
      return `${year} — Awarded ${event.detail ?? 'a decoration'}.`
    case 'passed-over':
      return `${year} — Went before the ${event.detail ?? 'promotion'} board; not selected.`
    case 'joined-unit':
      return `${year} — Selected for ${event.detail ?? 'a special unit'}.`
    case 'dropped-selection':
      return `${year} — Went to ${event.detail ?? 'a special unit'} selection; came back without it.`
    case 'fitness-tested':
      return `${year} — Scored ${event.detail ?? 'the standard'} on the fitness test.`
    case 'turned-down':
      return `${year} — Asked after work as ${event.detail !== null ? withArticle(event.detail) : 'something new'}; no place this time.`
    case 'granted-pension': {
      const cents = event.detail === null ? null : Number.parseInt(event.detail, 10)
      const sum = cents !== null && Number.isFinite(cents) ? formatMoney(cents as never) : 'a pension'
      return `${year} — The pension board recognized what the service left: ${sum} a month.`
    }
    case 'deployed':
      return `${year} — Deployed to ${event.detail ?? 'the front'} at ${age}.`
    case 'returned-home':
      return event.detail === 'evacuated'
        ? `${year} — Evacuated home.`
        : `${year} — Came home; the tour was done.`
    case 'committed-theft':
      return `${year} — Took what was not ${objectPronoun(person) === 'her' ? 'hers' : 'his'} to take.`
    case 'was-robbed':
      return `${year} — The house was robbed.`
    case 'was-arrested':
      return `${year} — Arrested at ${age}.`
    case 'was-convicted':
      return event.detail?.startsWith('jail:') === true
        ? `${year} — Convicted of theft; ${event.detail.slice(5)} months at the county's expense.`
        : `${year} — Convicted of theft; fined.`
    case 'was-acquitted':
      return `${year} — Acquitted at the courthouse.`
    case 'released-from-jail':
      return `${year} — Released, at ${age}. The record came home too.`
    case 'fell-behind':
      return `${year} — Money ran short; the household fell behind.`
    case 'back-in-the-black':
      return `${year} — The household got back on its feet.`
    case 'inherited': {
      const amount = event.detail === null ? null : Number.parseInt(event.detail, 10)
      const sum = amount !== null && Number.isFinite(amount) ? formatMoney(amount as never) : 'an inheritance'
      return `${year} — Inherited ${sum} from ${nameOf(world, event.otherId)}.`
    }
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
  'compatible-personality': 'they suited each other',
  'shared-home': 'they shared a home',
  'shared-workplace': 'they worked together',
  'lived-nearby': 'they lived nearby',
  'years-together': 'of how long they had been together',
  'strong-attachment': '{they} was very attached',
  'drifted-apart': 'they had drifted apart',
  'financial-strain': 'money was tight',
  'lost-work': '{they} was out of work',
  'wanted-family': '{they} wanted a family',
  'own-choice': 'they chose it themselves',
  'in-arrears': 'the household had fallen behind',
  'cheaper-rent': 'the rent was cheaper there',
  'bloc-rivalry': 'of rivalry between the powers',
  'resource-competition': 'of competition over resources',
  'regional-flashpoint': 'that border was the era’s flashpoint',
  'internal-instability': 'of unrest at home',
  'war-weariness': 'both sides were worn out',
  'heavy-casualties': 'of the cost in lives',
  'old-grudge': 'of an old grudge',
  'long-peace': 'the quiet had held a long time',
  'steady-pay': 'the pay was steady',
  'way-out-of-town': 'it was a way out of town',
  'service-tradition': 'the family had served before',
  'recruiting-drive': 'the recruiters were in town that season',
  'term-ended': 'the term was up',
  'medically-unfit': 'the body would not carry it further',
  'time-in-grade': '{they} had put in the time',
  'strong-performance': 'the work spoke for itself',
  'holds-qualification': 'the qualification counted',
  'enemy-action-wound': 'the wound came from enemy action',
  'campaign-service': '{they} served the campaign in theatre',
  'honorable-term': 'the term was served honorably',
  'qualification-earned': 'the rating was earned and recorded',
  'service-disability': 'the recorded disability was service-connected',
  desperation: 'there was nothing left to try',
  witnessed: 'somebody saw',
  'prior-record': 'the record spoke first',
  'clean-record': 'the record was clean until then',
  'jail-sentence': 'the months belonged to the county',
  'wants-a-family': 'they wanted a family',
  'under-orders': 'the orders came',
  'war-demanded-troops': 'the war needed people',
  'enemy-capability': 'the enemy could reach them',
  'war-phase': 'of where the war stood that month',
  'convoy-exposure': 'the roads were the job',
  'direct-combat-exposure': 'the front was the job',
  'base-attack-exposure': 'the base itself was a target',
  'battlefield-accident': 'of an accident under way out there',
  'battlefield-chaos': 'of how badly the moment went',
  'tour-complete': 'the tour was done',
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

  // The legacy of a finished life (Law 8). Only lines that are true: a
  // childless life shows no children line, not a zero.
  if (!alive) {
    const legacy = legacySummaryOf(world, personId)
    const legacyLines: string[] = []
    if (legacy.childCount > 0) {
      legacyLines.push(
        `${subjectPronoun(person)} raised ${legacy.childCount} ${legacy.childCount === 1 ? 'child' : 'children'}` +
          (legacy.grandchildCount > 0
            ? ` and saw ${legacy.grandchildCount} ${legacy.grandchildCount === 1 ? 'grandchild' : 'grandchildren'}.`
            : '.'),
      )
    }
    if (legacy.inherited > 0) {
      legacyLines.push(`Inherited ${formatMoney(legacy.inherited)} across a lifetime.`)
    }
    if (legacy.leftToHeirs > 0) {
      legacyLines.push(`Left ${formatMoney(legacy.leftToHeirs)} to the next generation.`)
    }
    const healthRecord = world.health.get(personId)
    if (healthRecord && healthRecord.marks.length > 0) {
      legacyLines.push(
        `${subjectPronoun(person)} carried it: ${healthRecord.marks.join('; ')}.`,
      )
    }
    if (legacy.generations >= 2) {
      legacyLines.push(`The family ${person.familyName} line runs ${legacy.generations} generations on.`)
    }
    if (legacyLines.length > 0) {
      lines.push('')
      lines.push('Legacy')
      lines.push('------')
      lines.push(...legacyLines)
    }
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

  const married = spouseOf(world, personId) !== null ? ', married' : ''
  if (occupation) return `${fullName(person)}, ${age}, ${occupation}${married}`
  const education = world.education.get(personId)
  if (education?.enrolledIn) return `${fullName(person)}, ${age}, in ${education.enrolledIn} school`
  return `${fullName(person)}, ${age}${married}`
}

/** Where the pronoun helper is needed by callers building their own prose. */
export { objectPronoun, subjectPronoun }
