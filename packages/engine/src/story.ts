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

import { unitMomentById } from './scenes.js'
import type { EntityId, Tick } from '@life-engine/shared'
import { formatMoney, TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt, formatYear } from './clock.js'
import { occupationById, offenceById } from './content.js'
import { branchName, rankTitle, serviceAtTick } from './service.js'
import { homeland } from './geopolitics.js'
import { decisionForEvent, decisionsFor, eventsFor } from './records.js'
import { eventById } from './eventindex.js'
import { spouseOf } from './relationships.js'
import { legacySummaryOf } from './legacy.js'
import { withArticle } from './text.js'
import { schoolMomentById } from './schoolmoments.js'
import { majorById } from './content.js'
import { graftById, officeById } from './government.js'
import { workMomentById } from './workmoments.js'
import type { CausalRecord, FactorId, Person, World, WorldEvent } from './types.js'
import { specialtyFor, unitFor } from './worldspec.js'

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

/**
 * W1 resistance 4/5: these events carry IDS now, not display names — a name
 * is a preset's content and must not be minted into a permanent record. The
 * words are made here, at render time.
 *
 * Both helpers fall back to the detail AS WRITTEN when it is not an id they
 * know, because saves made before W1 hold the name itself. Old stories keep
 * naming the unit and the rank they always named; nothing is migrated and
 * nothing is lost.
 */
/**
 * What a unit moment's "moment-id:answer" detail says in words. The catalogue
 * owns the phrasing; this only picks the one that was answered.
 */
/**
 * The citation behind an 'awarded' event, or null if the decoration is no
 * longer on the record. Matched on the title the event already carries, so
 * one person's three medals in a month each read their own words.
 */
function citationFor(world: World, event: WorldEvent): string | null {
  if (event.detail === null) return null
  const award = (world.awards.get(event.subjectId) ?? []).find((a) => a.title === event.detail)
  return award?.citation ?? null
}

function unitMomentWordsFor(detail: string | null): string {
  const said = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1)
  if (detail === null) return said('answered the unit')
  const cut = detail.lastIndexOf(':')
  if (cut === -1) return said('answered the unit')
  const moment = unitMomentById(detail.slice(0, cut))
  const answer = detail.slice(cut + 1)
  if (!moment || (answer !== 'push' && answer !== 'hold' && answer !== 'cover')) return said('answered the unit')
  return said(moment.did[answer])
}

function unitWordsFor(world: World, detail: string | null): string {
  if (detail === null) return 'a special unit'
  return unitFor(world, detail)?.name ?? detail
}

function rankWordsFor(world: World, event: WorldEvent): string {
  if (event.detail === null) return 'promotion'
  const rank = Number.parseInt(event.detail, 10)
  if (!Number.isInteger(rank) || String(rank) !== event.detail) return event.detail
  // THE BRANCH THEY WERE IN THAT MONTH, not the one they are in now.
  // Reading the current record renamed a returning veteran's earlier
  // promotions into their new branch's ladder.
  const at = serviceAtTick(world, event.subjectId, event.tick)
  return at ? rankTitle(world, at.branch, rank, at.commissioned) : 'promotion'
}

/** An offence id as words. Never the raw id — that is a database key. */
function offenceWords(id: string | null | undefined): string {
  if (id === null || id === undefined || id === '') return 'a crime'
  return offenceById(id)?.title ?? id
}

/**
 * The conviction handed down on this tick, for the event that reports it.
 *
 * `describeOutcome` already did this inline; the life story did not, and
 * called everything theft. One function now, so the two cannot drift.
 */
function convictionAt(
  world: World,
  personId: EntityId,
  tick: Tick,
): { readonly kind: string; readonly sentenceMonths: number; readonly fine: number } | undefined {
  return [...(world.criminal.get(personId)?.convictions ?? [])]
    .reverse()
    .find((c) => c.tick === tick)
}

function describeEvent(world: World, person: Person, event: WorldEvent): string | null {
  const year = formatYear(world, event.tick)
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
      if (event.detail === 'laid off') return `${year} — Laid off; the work dried up.`
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
    case 'disciplined':
      return `${year} — Took a company punishment: ${event.detail ?? 'a mark on the file'}.`
    case 'field-aid':
      return `${year} — ${event.detail ?? 'Worked a wound in the field'}.`
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
      return `${year} — Enlisted as ${withArticle(event.detail ?? 'recruit')} at ${age}.`
    case 'promoted':
      return `${year} — Promoted to ${event.detail ?? 'a new rank'}.`
    case 'money-shock': {
      const [what, amount] = (event.detail ?? ':').split(':')
      const sum = formatMoney(Number(amount ?? 0) as never)
      if (what === 'scam') return `${year} — Money went out of the account that ${they.toLowerCase()} never sent: ${sum}.`
      if (what === 'repairs') return `${year} — The house needed ${sum} of work that would not wait.`
      return `${year} — A hospital bill for ${sum}.`
    }
    case 'took-loan': {
      const [kind, amount] = (event.detail ?? ':').split(':')
      return `${year} — Took out ${kind === 'mortgage' ? 'a mortgage' : kind === 'auto' ? 'a car loan' : 'a loan'} of ${formatMoney(Number(amount ?? 0) as never)}.`
    }
    case 'paid-off-loan':
      return `${year} — Paid off ${event.detail === 'mortgage' ? 'the mortgage' : 'the loan'}.`
    case 'defaulted':
      return `${year} — Defaulted; the debt went to the file.`
    case 'bought-home':
      return `${year} — Bought a home in ${placeName(world, event.placeId)}.`
    case 'lost-home':
      return `${year} — Lost the house.`
    case 'bought-investment':
      return null // a portfolio is a balance, not a life event
    case 'sold-investment':
      return null
    case 'filed-taxes':
      return null
    case 'reenlisted':
      // §6: named where the oath was administered by somebody from the unit.
      return event.otherId === null
        ? `${year} — Signed for another term.`
        : `${year} — Signed for another term, sworn in by ${nameOf(world, event.otherId)}.`
    case 'discharged':
      // Every ending names itself. A thirty-year career and a career ended
      // at the orderly room are not "left the service" (review S5); Law 8
      // asks the retrospective to say what actually happened.
      switch (event.detail) {
        case 'medical':
          return `${year} — Discharged on medical grounds at ${age}.`
        case 'high-year tenure':
          return `${year} — The service did not offer another term; separated at ${age}.`
        case 'barred from reenlistment':
          return `${year} — The record barred another term; separated at ${age}.`
        case 'misconduct':
          return `${year} — Put out of the service at ${age}; the file had filled.`
        case 'thirty years served':
          return `${year} — Thirty years done. Retired at ${age}.`
        case 'retirement age':
          return `${year} — Reached the age the service keeps nobody past; retired at ${age}.`
        case 'twenty years served':
          return `${year} — Twenty years in, and took the retirement at ${age}.`
        default:
          return `${year} — Left the service at ${age}.`
      }
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
    case 'awarded': {
      // WHAT IT WAS FOR, not just what it was. The citation is written at
      // the moment of the grant and says what the person did; reading it
      // back here is the difference between "Awarded the Bronze Star" and
      // knowing why it turned up months after a homecoming.
      const citation = citationFor(world, event)
      return citation === null
        ? `${year} — Awarded ${event.detail ?? 'a decoration'}.`
        : `${year} — Awarded ${event.detail ?? 'a decoration'} — ${citation}.`
    }
    case 'left-course': {
      const words =
        event.detail === 'graduate'
          ? 'the graduate programme'
          : event.detail === 'trade'
            ? 'the trade school'
            : 'university'
      return `${year} — Left ${words} without finishing. The fees still stand.`
    }
    case 'stood-for-office': {
      const office = officeById(event.detail ?? '')
      return office === undefined
        ? `${year} — Stood for office.`
        : `${year} — Stood for ${office.title}.`
    }
    case 'debated': {
      const [, how] = (event.detail ?? ':').split(':')
      return how === 'badly'
        ? `${year} — A debate that did not go well.`
        : `${year} — Won the room at a debate.`
    }
    case 'paid-down-loan': {
      return `${year} \u2014 Paid a lump off the ${event.detail ?? 'debt'}.`
    }
    case 'took-graft': {
      const offer = graftById(event.detail ?? '')
      return offer === undefined
        ? `${year} \u2014 Took money that was not theirs to take.`
        : `${year} \u2014 ${offer.title}, and took the money.`
    }
    case 'investigated': {
      return `${year} \u2014 Investigated, and out of office.`
    }
    case 'set-policy': {
      return `${year} \u2014 Set the town's policy in office.`
    }
    case 'took-office': {
      const office = officeById(event.detail ?? '')
      return office === undefined
        ? `${year} — Took office.`
        : `${year} — Elected ${office.title}.`
    }
    case 'voted': {
      // Not every ballot is a life event, but the first one is, and a
      // timeline that never mentions politics in a game about a town
      // governing itself would be strange.
      // No allowlist entry: unlike a company's news, whose whole content
      // is in the detail, "voted" is a real thing to have done even when
      // the record does not say in which race.
      const office = officeById(event.detail ?? '')
      return office === undefined
        ? `${year} — Voted.`
        : `${year} — Voted in the race for ${office.title}.`
    }
    case 'won-funding': {
      switch (event.detail) {
        case 'merit':
          return `${year} \u2014 Won a scholarship on the strength of the record.`
        case 'need':
          return `${year} \u2014 Awarded assistance with the fees.`
        case 'rotc':
          return `${year} \u2014 Signed for ROTC: the fees paid, a commission owed.`
        case 'gi-bill':
          return `${year} \u2014 Went back to school on the service's money.`
        default:
          return `${year} \u2014 Found a way to pay for the fees.`
      }
    }
    case 'took-student-loan': {
      const where = event.detail === 'trade' ? 'the trade school' : 'university'
      return `${year} — Borrowed to pay for a year at ${where}.`
    }
    case 'chose-major': {
      // No allowlist entry for this one: unlike a work moment, whose whole
      // content is in the detail, "settled on a field" is a real thing to
      // have happened even when the record does not say which.
      const major = majorById(event.detail)
      return major === undefined
        ? `${year} — Settled on a field of study.`
        : `${year} — Started reading ${major.title}.`
    }
    case 'school-moment': {
      // Only the ones that MOVED something reach a timeline. A quiet term
      // is not a life event, and the feed is for what changed (Law 6).
      const [momentId, , result] = (event.detail ?? '::').split(':')
      const moment = schoolMomentById(momentId ?? '')
      if (moment === undefined) return null
      return result === 'bad'
        ? `${year} — ${moment.title}, at school, and it went badly.`
        : `${year} — ${moment.title}, at school.`
    }
    case 'work-moment': {
      // M-CAREER §3. Only the ones that MOVED something reach a timeline —
      // a steady month at work is not a life event, and the feed is for
      // what changed (Law 6, history compressed).
      const [momentId, , result] = (event.detail ?? '::').split(':')
      const moment = workMomentById(momentId ?? '')
      if (moment === undefined) return null
      return result === 'bad'
        ? `${year} — ${moment.title} at work, and it did not go well.`
        : `${year} — ${moment.title} at work.`
    }
    case 'passed-over':
      return `${year} — Went before the ${rankWordsFor(world, event)} board; not selected.`
    case 'unit-moment':
      return `${year} — ${unitMomentWordsFor(event.detail)}.`
    case 'aerial-mission':
      return `${year} — Flew a mission under fire.`
    case 'received-orders':
      return `${year} — Received orders${event.detail === null ? '' : ` for ${event.detail}`}.`
    case 'was-captured':
      return `${year} — Taken prisoner by ${event.detail ?? 'a hostile force'}.`
    case 'repatriated': {
      const held = Number(event.detail ?? '0')
      return `${year} — Came home after ${held <= 1 ? 'a month' : `${String(held)} months`} held prisoner.`
    }
    case 'died-in-captivity': {
      const held = Number(event.detail ?? '0')
      return `${year} — Died in captivity, ${held <= 1 ? 'within a month' : `${String(held)} months`} after being taken.`
    }
    case 'joined-unit':
      return `${year} — Selected for ${unitWordsFor(world, event.detail)}.`
    case 'dropped-selection':
      return `${year} — Went to ${unitWordsFor(world, event.detail)} selection; came back without it.`
    case 'fitness-tested':
      return `${year} — Scored ${event.detail ?? 'the standard'} on the fitness test.`
    case 'turned-down':
      return `${year} — Asked after work as ${event.detail !== null ? withArticle(event.detail) : 'something new'}; no place this time.`
    case 'granted-pension': {
      const cents = event.detail === null ? null : Number.parseInt(event.detail, 10)
      const sum = cents !== null && Number.isFinite(cents) ? formatMoney(cents as never) : 'a pension'
      // A survivor's share names whose service earned it.
      if (event.otherId !== null) {
        return `${year} — ${nameOf(world, event.otherId)}'s service kept paying: ${sum} a month.`
      }
      return `${year} — The pension board recognized what the service left: ${sum} a month.`
    }
    case 'deployed':
      // A rotation's detail already reads "a rotation to Osmark", so the
      // wartime preposition would stack into nonsense (review S5).
      return event.detail !== null && event.detail.startsWith('a rotation')
        ? `${year} — Posted abroad at ${age}: ${event.detail}.`
        : `${year} — Deployed to ${event.detail ?? 'the front'} at ${age}.`
    case 'returned-home':
      switch (event.detail) {
        case 'evacuated':
          return `${year} — Evacuated home.`
        case 'recalled':
          return `${year} — Recalled home; ${homeland(world)?.name ?? 'the homeland'} had gone to war.`
        case 'host at war':
          return `${year} — Brought home early; the host country had gone to war.`
        case 'rotation complete':
          return `${year} — Came home; the rotation was done.`
        case 'stayed to fight':
          return `${year} — The rotation ended where it stood: stayed on to fight beside the host.`
        default:
          return `${year} — Came home; the tour was done.`
      }
    case 'committed-offence': {
      const charge = offenceById((event.detail ?? '').split(':')[0] ?? '')?.title
      return `${year} — Charged with ${charge ?? 'an offence'}.`
    }
    case 'committed-theft': {
      // C2 details read "<offence-id>:<cents>"; C1's carry cents alone.
      const parts = (event.detail ?? '').split(':')
      const offence = parts.length > 1 ? offenceById(parts[0] ?? '') : undefined
      if (offence) return `${year} — Committed ${offence.title}.`
      return `${year} — Took what was not ${objectPronoun(person) === 'her' ? 'hers' : 'his'} to take.`
    }
    case 'went-without':
      return `${year} — Went without, when taking would have been easy.`
    case 'was-robbed':
      return `${year} — The house was robbed.`
    case 'was-arrested':
      return `${year} — Arrested at ${age}.`
    case 'was-convicted': {
      // THE OFFENCE WAS HARDCODED. Every conviction in every life story read
      // "convicted of theft" — assault, fraud, arson, all of it — while
      // `describeOutcome` a few hundred lines below did the same job
      // correctly off the conviction record. Twenty-three graded offences
      // and the story could name exactly one of them.
      const crime = convictionAt(world, event.subjectId, event.tick)
      const named = crime === undefined ? 'a crime' : (offenceById(crime.kind)?.title ?? crime.kind)
      return event.detail?.startsWith('jail:') === true
        ? `${year} — Convicted of ${named}; ${event.detail.slice(5)} months at the county's expense.`
        : `${year} — Convicted of ${named}; fined.`
    }
    case 'was-acquitted':
      return `${year} — Acquitted at the courthouse.`
    // ---- THE COURT, WHICH USED TO HAPPEN OFFSTAGE -------------------
    //
    // Twenty-eight person-level events were recorded and rendered nowhere:
    // the whole arc from the charge to the end of probation, the officer's
    // commission, the refused deployment, and the victim's own choices. The
    // ledger had all of it and the life story showed none of it. Failure
    // shape 3, at scale — see the ratchet test that now pins it.
    case 'charged':
      return `${year} — Charged with ${offenceWords(event.detail)}.`
    case 'charge-declined':
      return `${year} — The prosecutor declined the ${offenceWords(event.detail)} charge. It ended there.`
    case 'escalated-charge': {
      const [, worse] = (event.detail ?? '').split(':')
      return `${year} — The charge was raised to ${offenceWords(worse ?? null)}.`
    }
    case 'arraigned':
      return `${year} — Arraigned on the ${offenceWords(event.detail)} charge.`
    case 'plea-deal-offered': {
      const [offence, months] = (event.detail ?? '').split(':')
      const n = Number(months)
      return Number.isFinite(n) && n > 0
        ? `${year} — Offered a deal on the ${offenceWords(offence ?? null)} charge: ${String(n)} months.`
        : `${year} — Offered a deal on the ${offenceWords(offence ?? null)} charge.`
    }
    case 'took-plea-deal': {
      const [, agreed] = (event.detail ?? '').split(':')
      return `${year} — Took the deal, and pleaded to ${offenceWords(agreed ?? null)}.`
    }
    case 'stood-trial':
      return `${year} — Went to trial rather than take what was offered.`
    case 'testified':
      return `${year} — Took the stand.`
    case 'stayed-silent':
      return `${year} — Said nothing at trial, which is a right and costs something to use.`
    case 'pleaded-self-defense':
      return `${year} — Argued it was self-defence.`
    case 'ruled-justified':
      return `${year} — The court found it justified. No conviction.`
    case 'verdict':
      return `${year} — The verdict came in.`
    // ---- what a sentence is actually made of ------------------------
    case 'placed-on-probation': {
      const months = Number(event.detail ?? 0)
      return Number.isFinite(months) && months > 0
        ? `${year} — Put on probation for ${String(months)} months.`
        : `${year} — Put on probation.`
    }
    case 'completed-probation':
      return `${year} — Finished probation clean.`
    case 'violated-probation': {
      const [, months] = (event.detail ?? '').split(':')
      const n = Number(months)
      return Number.isFinite(n) && n > 0
        ? `${year} — Broke probation; ${String(n)} months to serve.`
        : `${year} — Broke probation.`
    }
    case 'community-service':
      return `${year} — Ordered to work it off in the community.`
    case 'ordered-restitution': {
      const owed = Number(event.detail ?? 0)
      return Number.isFinite(owed) && owed > 0
        ? `${year} — Ordered to pay back ${formatMoney(owed as never)}.`
        : `${year} — Ordered to pay it back.`
    }
    case 'paid-restitution':
      return `${year} — Paid back what was taken.`
    case 'conviction-expunged':
      return `${year} — The record was sealed. It stops answering for itself.`
    // ---- the other side of a crime ----------------------------------
    case 'was-assaulted':
      return `${year} — Assaulted, at ${age}.`
    case 'reported-crime':
      return `${year} — Reported it to the police.`
    case 'declined-to-report':
      return `${year} — Did not report it.`
    case 'used-lethal-force': {
      const [, how] = (event.detail ?? '').split(':')
      return how === 'lethal'
        ? `${year} — Killed somebody defending the house.`
        : `${year} — Fought off an intruder.`
    }
    // ---- the uniform ------------------------------------------------
    // M-PROMO. A billet is a job, not a rank — and the taking and the
    // handing on are both worth a line, because the title changes on both.
    case 'dropped-from-training': {
      const [course, how] = (event.detail ?? ':').split(':')
      return how === 'injured'
        ? `${year} — Hurt at ${course ?? 'the course'} and sent back to the unit.`
        : `${year} — Washed out of ${course ?? 'the course'}.`
    }
    case 'recycled-in-training':
      return `${year} — Recycled at ${event.detail ?? 'the course'}; back a phase, and going again.`
    case 'saw-a-doctor':
      return `${year} — Saw a doctor about it.`
    case 'sold-home': {
      const net = Number(event.detail ?? 0)
      return net > 0
        ? `${year} — Sold the house, and walked away with ${formatMoney(net as never)}.`
        : `${year} — Sold the house for less than was owed on it.`
    }
    case 'signed-lease':
      return `${year} — Took the lease on ${event.detail ?? 'a place'}.`
    case 'ended-lease':
      return `${year} — Gave up the tenancy${event.detail === 'deposit withheld' ? ' — the deposit did not come back.' : '.'}`
    case 'billet-taken':
      return `${year} — Made ${event.detail ?? 'a leadership billet'}.`
    case 'billet-ended':
      return `${year} — Handed on the ${event.detail ?? 'billet'} and went back to the rank.`
    case 'commissioned':
      // A COMMISSION LEFT NO TRACE AT ALL. The one thing that changes what
      // a service career even is, and the story did not mention it.
      return event.detail === null
        ? `${year} — Commissioned.`
        : `${year} — Commissioned: ${event.detail}.`
    case 'barred-from-reenlistment':
      return `${year} — The service would not write another contract. ${event.detail ?? ''}`.trimEnd()
    case 'refused-orders':
      return `${year} — Refused the orders. They were for ${event.detail ?? 'the front'}.`
    case 'wartime-service':
      return `${year} — Served in wartime.`
    case 'took-a-seat':
      return `${year} — Took a seat at ${event.detail ?? 'the schoolhouse'}.`
    case 'released-from-jail':
      return `${year} — Released, at ${age}. The record came home too.`
    case 'fell-behind':
      return `${year} — Money ran short; the household fell behind.`
    case 'back-in-the-black':
      return `${year} — The household got back on its feet.`
    case 'debt-written-off':
      // M-SAFETY: no longer written by anything. Kept so saves made before
      // the bankruptcy build still read back (Law 6 — unrecorded history
      // stays unrecorded, but recorded history stays readable).
      return `${year} — The arrears were written off.`
    case 'filed-bankruptcy': {
      const [chapter, owed] = (event.detail ?? ':').split(':')
      const sum = formatMoney(Number(owed ?? 0) as never)
      return chapter === '7'
        ? `${year} — Filed for liquidation, owing ${sum}. What could be sold was sold.`
        : `${year} — Filed a repayment plan with the court, owing ${sum}.`
    }
    case 'plan-completed':
      return `${year} — The repayment plan was served out to its last month.`
    case 'plan-dismissed':
      return `${year} — The repayment plan was dismissed. It could not be kept up with.`
    case 'debt-discharged': {
      const sum = formatMoney(Number(event.detail ?? 0) as never)
      return `${year} — ${sum} of debt discharged. A clean sheet, and a file that will say so for years.`
    }
    case 'lost-housing':
      return `${year} — Lost the housing. Nowhere cheaper left to go.`
    case 'rehoused': {
      const months = Number(event.detail ?? 0)
      return Number.isFinite(months) && months > 0
        ? `${year} — Back under a roof, in ${placeName(world, event.placeId)}, after ${String(months)} months without one.`
        : `${year} — Back under a roof, in ${placeName(world, event.placeId)}.`
    }
    case 'laid-off':
      return null // 'left-job' already tells this one; two lines would be two events
    case 'drew-unemployment':
      return null // a balance, not a life event
    case 'drew-assistance':
      return null
    case 'opened-business':
      return `${year} — Opened ${event.detail ?? 'a business'}.`
    case 'business-closed':
      return `${year} — ${event.detail ?? 'The business'} closed its doors.`
    case 'inherited-business':
      return `${year} — Took on ${event.detail ?? 'the family business'} from ${nameOf(world, event.otherId)}.`
    case 'promoted-at-work':
      return `${year} — Promoted to ${occupationById(event.detail ?? '').title}.`
    case 'passed-over':
      return null // a year that did not turn is not an event on a timeline
    case 'state-pension-began':
      return `${year} — The state pension began.`
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
  'economy-turned': 'the economy had turned',
  'cheaper-rent': 'the rent was cheaper there',
  'bloc-rivalry': 'of rivalry between the powers',
  'resource-competition': 'of competition over resources',
  'regional-flashpoint': 'that border was the era’s flashpoint',
  'internal-instability': 'of unrest at home',
  'war-weariness': 'both sides were worn out',
  'alliance-obligation': 'an ally called and the alliance held',
  reluctant: 'they went, but not willingly',
  'ally-in-distress': 'the ally was losing and asked for help',
  'heavy-casualties': 'of the cost in lives',
  'old-grudge': 'of an old grudge',
  'long-peace': 'the quiet had held a long time',
  'steady-pay': 'the pay was steady',
  'way-out-of-town': 'it was a way out of town',
  'service-tradition': 'the family had served before',
  'holds-a-degree': 'the degree opened the officer route',
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
  'threat-level': 'how bad the moment was',
  'unit-standard': 'the standard the unit holds people to',
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

  return `${formatYear(world, record.tick)}: ${who} ${record.chosen}.${because}${alternative}`
}

/**
 * WHAT CAME OF IT (owner direction: the Why "doesn't actually answer why...
 * it needs to describe the outcome of that event").
 *
 * A causal record answers what pushed a person into a decision. That is
 * genuinely half the question, and on its own it reads as a tautology —
 * "he went to the school because he chose to go to the school". This
 * answers the other half: what the event actually PRODUCED, read from the
 * state it produced. An award names the act that earned it; a school names
 * the rating it left behind; a sentence names the months.
 *
 * Returns null where an event produced nothing beyond itself — and null is
 * the honest answer there, not an invented consequence.
 */
export function describeOutcome(world: World, event: WorldEvent): string | null {
  const person = world.people.get(event.subjectId)
  if (!person) return null
  const they = subjectPronoun(person).toLowerCase()
  const at = (tick: Tick): number => ageAt(person.birthTick, tick)

  /** Awards granted to this person in the same month. */
  const awardsAt = (tick: Tick) =>
    (world.awards.get(event.subjectId) ?? []).filter((award) =>
      award.qualifyingEventIds.some((id) => eventById(world, id)?.tick === tick),
    )

  switch (event.type) {
    case 'completed-training': {
      // The owner's own example: a school should say what it left behind.
      const earned = awardsAt(event.tick).filter((a) => a.kind === 'qualification-badge')
      const badge = earned[0]
      const record = world.service.get(event.subjectId)
      if (badge) {
        return `Finished the course and came away with ${withArticle(badge.title)} — a rating that counts toward every promotion board from here on.`
      }
      if (record) {
        return `Finished the course. The trade got sharper for it, and the file says so at the next board.`
      }
      return null
    }

    case 'earned-qualification': {
      return `The rating is on the record for good: ${event.detail ?? 'a qualification'}, worth points at every board ${they} goes before.`
    }

    case 'awarded': {
      // OWNER: an award should describe the act that earned it.
      const award = (world.awards.get(event.subjectId) ?? []).find((a) => a.title === event.detail)
      if (!award) return null
      const qualifyingId = award.qualifyingEventIds[award.qualifyingEventIds.length - 1]
      const qualifying =
        qualifyingId === undefined ? undefined : world.events.find((e) => e.id === qualifyingId)
      const act =
        qualifying === undefined
          ? null
          : qualifying.type === 'act-of-valor'
            ? `for ${qualifying.detail ?? 'going forward under fire'}`
            : qualifying.type === 'wounded-in-action'
              ? `for wounds taken in action — ${(qualifying.detail ?? '').split(':')[1] ?? 'hit in the field'}`
              : qualifying.type === 'died'
                ? 'awarded posthumously'
                : qualifying.type === 'returned-home'
                  ? 'for the tour just ended'
                  : qualifying.type === 'saw-combat'
                    ? `for ${qualifying.detail ?? 'contact with the enemy'}`
                    : qualifying.type === 'reenlisted' || qualifying.type === 'discharged'
                      ? 'for the term served'
                      : null
      const cite = award.citation.length > 0 ? ` The citation reads: ${award.citation}.` : ''
      return act === null
        ? `${award.title}${cite}`
        : `${award.title}, ${act}.${cite}`
    }

    case 'promoted': {
      const record = world.service.get(event.subjectId)
      if (!record) return null
      return `${event.detail ?? 'The next grade'} from this month — the pay goes with it, and the clock on the next board starts again at zero.`
    }

    case 'disciplined': {
      const marks = world.events.filter(
        (e) =>
          e.type === 'disciplined' &&
          e.subjectId === event.subjectId &&
          e.tick <= event.tick &&
          event.tick - e.tick < 60,
      ).length
      return marks >= 3
        ? 'The third mark inside five years. The career ended at the orderly room.'
        : `Mark ${String(marks)} on the file. A third inside five years ends the career.`
    }

    case 'was-convicted': {
      const conviction = [...(world.criminal.get(event.subjectId)?.convictions ?? [])]
        .reverse()
        .find((c) => c.tick === event.tick)
      if (!conviction) return null
      const offence = offenceById(conviction.kind)
      const sentence =
        conviction.sentenceMonths > 0
          ? `${String(conviction.sentenceMonths)} months`
          : `a fine of ${formatMoney(conviction.fine as never)}`
      return `Convicted of ${offence?.title ?? conviction.kind} and given ${sentence}. It stays on the record for good and closes doors for ten years.`
    }

    case 'was-acquitted':
      return 'The charge did not stick. Nothing goes on the record — the arrest happened, and that was all it was.'

    case 'hired': {
      const job = world.employment.get(event.subjectId)
      if (!job) return null
      const where = world.places.get(job.workplaceId)?.name
      return `Taken on at ${formatMoney(job.monthlyPay)} a month${where === undefined ? '' : ` at ${where}`}.`
    }

    case 'got-raise': {
      const cents = event.detail === null ? null : Number.parseInt(event.detail, 10)
      return cents === null || !Number.isFinite(cents)
        ? null
        : `The pay went to ${formatMoney(cents as never)} a month — the year's work, priced.`
    }

    case 'wounded-in-action':
    case 'was-injured': {
      const record = world.health.get(event.subjectId)
      const mark = record?.marks[record.marks.length - 1]
      const body = (event.detail ?? '').split(':')[1]
      return mark === undefined
        ? body === undefined
          ? null
          : `${body[0]?.toUpperCase() ?? ''}${body.slice(1)}. ${they === 'she' ? 'She' : 'He'} came through it.`
        : `${body === undefined ? 'Hurt badly' : `${body[0]?.toUpperCase() ?? ''}${body.slice(1)}`} — and it left something: ${mark}.`
    }

    case 'deployed': {
      const tours = world.deployments.get(event.subjectId) ?? []
      const tour = tours.find((t) => t.startedAtTick === event.tick)
      if (!tour) return null
      return tour.kind === 'rotation'
        ? `A six-month posting abroad, ${they === 'she' ? 'her' : 'his'} ${ordinal(tour.tourNumber)} time away.`
        : `A ten-month tour, ${they === 'she' ? 'her' : 'his'} ${ordinal(tour.tourNumber)}.`
    }

    case 'returned-home': {
      const tours = world.deployments.get(event.subjectId) ?? []
      const tour = tours.find((t) => t.returnedAtTick === event.tick)
      if (!tour) return null
      const months = event.tick - tour.startedAtTick
      const medals = awardsAt(event.tick)
      const earned =
        medals.length > 0 ? ` It brought ${joinClauses(medals.map((m) => m.title))}.` : ''
      return `${String(months)} month${months === 1 ? '' : 's'} away, and home at ${String(at(event.tick))}.${earned}`
    }

    case 'enlisted': {
      const record = world.service.get(event.subjectId)
      if (!record) return null
      return `Signed on at ${String(at(event.tick))} as ${withArticle(specialtyFor(world, record.specialtyId).title)}, ${branchName(world, record.branch)}.`
    }

    case 'discharged': {
      const record = world.service.get(event.subjectId)
      if (!record || record.dischargedAtTick === null) return null
      const years = Math.max(1, Math.floor((record.dischargedAtTick - record.enlistedAtTick) / TICKS_PER_YEAR))
      return `${String(years)} year${years === 1 ? '' : 's'} in uniform, finishing as ${rankTitle(world, record.branch, record.rank, record.commissioned === true)}.`
    }

    case 'granted-pension': {
      const cents = event.detail === null ? null : Number.parseInt(event.detail, 10)
      return cents === null || !Number.isFinite(cents)
        ? null
        : `${formatMoney(cents as never)} a month, for life.`
    }

    default:
      return null
  }
}

function ordinal(n: number): string {
  if (n === 1) return 'first'
  if (n === 2) return 'second'
  if (n === 3) return 'third'
  return `${String(n)}th`
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
  /**
   * What came of it, or null where the event produced nothing beyond
   * itself. Shown FIRST in the Why?, because "what happened next" is what
   * the question usually means (owner direction).
   */
  readonly outcome: string | null
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
      year: formatYear(world, event.tick),
      // The year prefix is already in the rendered line; strip it so the UI can
      // lay the date out in its own column.
      text: text.replace(/^\d+ — /, ''),
      decision: event.subjectId === personId ? decisionForEvent(world, event) : null,
      outcome: event.subjectId === personId ? describeOutcome(world, event) : null,
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
  const born = `Born ${formatYear(world, person.birthTick)} in ${world.town.name}.`
  const status = alive
    ? `Aged ${age} as of ${formatYear(world, world.tick)}.`
    : `Died ${formatYear(world, person.deathTick!)}, aged ${age}, of ${person.causeOfDeath}.`
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
  // The uniform is the work, and the town list should say so (owner: the
  // Working tab read as though nobody was ever in the service). Rank and
  // trade, the way the person would answer the question.
  const service = world.service.get(personId)
  if (service && service.dischargedAtTick === null) {
    const trade = specialtyFor(world, service.specialtyId).title
    return `${fullName(person)}, ${age}, ${rankTitle(world, service.branch, service.rank, service.commissioned === true)} — ${trade}${married}`
  }
  if (occupation) return `${fullName(person)}, ${age}, ${occupation}${married}`
  const education = world.education.get(personId)
  if (education?.enrolledIn) return `${fullName(person)}, ${age}, in ${education.enrolledIn} school`
  return `${fullName(person)}, ${age}${married}`
}

/** Where the pronoun helper is needed by callers building their own prose. */
export { objectPronoun, subjectPronoun }
