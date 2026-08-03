/**
 * The service contract — the paperwork that bookends a career.
 *
 * The owner's spec, §6b and §6c: an ENLISTMENT contract the day you sign and
 * a REENLISTMENT contract every time you sign again, one document with two
 * variants. The title, the form number, and which lines print differ; the
 * oath does not, because there is only one of those.
 *
 * Together with the deployment orders this makes paperwork the spine of a
 * service life: a contract at the start, a contract at each renewal, orders
 * when the country sends you somewhere. A career accumulates documents
 * rather than a list of events.
 *
 * Everything is READ FROM THE RECORD except the document's own details — the
 * contract number, the officer who administers the oath — which come off a
 * seeded stream keyed to the tick, so a replay produces identical paper. The
 * clock is monthly, so the dates are months: a day would be a precision this
 * world does not have, which is the lesson the orders sheet already learned.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import { toDate } from './clock.js'
import type { World } from './types.js'
import { specialtyTitleCased } from './content.js'
import { branchSpecFor, specialtyFor } from './worldspec.js'

/**
 * Two variants only. The far bookend — what a career ENDS with — is the
 * DD-214 and the retirement certificate in separation.ts: a summary of a
 * whole life in uniform, which is a different document from a contract and
 * earned its own module rather than a third branch through this one.
 */
export type ContractVariant = 'enlistment' | 'reenlistment'

export interface ServiceContract {
  readonly variant: ContractVariant
  /** "ENLISTMENT CONTRACT" / "REENLISTMENT CONTRACT". */
  readonly title: string
  /** "FORM RA-1" / "FORM RA-4". */
  readonly form: string
  readonly contractNo: string
  readonly controlNo: string
  readonly command: string
  readonly dated: string
  /** "INITIAL ENLISTMENT — FIRST TERM" / "REENLISTMENT — THIRD TERM". */
  readonly headline: string
  readonly name: string
  /** "Second Lieutenant (O-1)". */
  readonly grade: string
  readonly specialty: string
  readonly station: string
  readonly termYears: number
  readonly termText: string
  readonly from: string
  readonly to: string
  readonly branch: string
  /** The elected option in words, or null when the contract carries none. */
  readonly option: string | null
  /** Zero where none is paid — the line hides rather than printing $0. */
  readonly bonus: Money
  /** True when this is an officer's appointment rather than an enlistment. */
  readonly commissioned: boolean
  /** "Oath of Enlistment" / "Oath of Reenlistment" / "Oath of Office". */
  readonly oathHeading: string
  /** "I enlist in" / "I reenlist in" / "I accept appointment in". */
  readonly undertaking: string
  /** "Recruit's signature" / "Member's signature" / "Officer's signature". */
  readonly signatureLabel: string
  readonly oath: string
  readonly signedBy: string
  readonly administeredBy: string
  /** The witness's line under the signature block. */
  readonly administeredTitle: string
  /** "4-YEAR", for the stamp. */
  readonly stamp: string
}

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

const ORDINALS = [
  'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH',
]

/** The witnessing officer's rank — senior, and never the signer's own. */
const WITNESS_TITLES = [
  'Captain, Adjutant',
  'Major, Personnel Officer',
  'Lieutenant Colonel, Commanding',
  'Chief Warrant Officer, Retention',
]

function stamped(world: World, tick: Tick, monthsAhead = 0): string {
  const { year, month } = toDate(world, (tick + monthsAhead) as Tick)
  return `${MONTHS[month - 1] ?? 'JANUARY'} ${String(year)}`
}

/** What the elected option says on the paper, in the words of the paper. */
export function optionText(option: string, bonus: Money): string | null {
  switch (option) {
    case 'bonus':
      return bonus > 0 ? 'Selective reenlistment bonus, paid on execution of this contract.' : null
    case 'school':
      return 'A guaranteed seat at the next advanced course this member qualifies for.'
    case 'stability':
      return 'Station of choice: no involuntary reassignment for twenty-four months.'
    case 'reclass':
      return 'Reclassification: retraining into another specialty of this branch.'
    default:
      return null
  }
}

/**
 * Draw the contract as of this tick. Undefined when there is no serving
 * record to write one against — which is also the UI's cue to fall back to
 * the plain dialog rather than print a document full of blanks.
 */
export function contractFor(
  world: World,
  tick: Tick,
  personId: EntityId,
  variant: ContractVariant,
  terms: {
    readonly termYears: number
    readonly option: string
    readonly bonus: Money
    /** §6: who administers the oath, when the player chose somebody real. */
    readonly administratorId?: EntityId | null
  },
): ServiceContract | undefined {
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  // A contract is written for somebody SERVING. The document for a career
  // that has ended is the DD-214.
  if (!person || !record || record.dischargedAtTick !== null) return undefined

  const branch = branchSpecFor(world, record.branch)
  const commissioned = record.commissioned === true
  const ladder = commissioned ? (branch.officerRanks ?? branch.ranks) : branch.ranks
  const grades = commissioned ? (branch.officerGrades ?? branch.grades) : branch.grades
  const index = Math.max(0, Math.min(ladder.length - 1, record.rank))
  const rankTitle = ladder[index] ?? '—'
  const grade = grades[index]
  const specialty = specialtyFor(world, record.specialtyId)
  const trade = specialtyTitleCased(specialty, commissioned)
  const station = world.places.get(record.baseId)?.name ?? 'the garrison'

  const rng = openStream(world.seed, Stream.Employment, personId, tick + 9100)
  const sequence = 1000 + rng.nextInt(0, 8999)
  const officerFamily = rng.pickWeighted(
    [...world.spec.family.names],
    [...world.spec.family.weights],
  )
  const officerInitial = rng.pick([
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W',
  ])
  const witness = rng.pick(WITNESS_TITLES)

  // The chosen administrator, if they are still here to do it. A person who
  // died or was discharged between the choice and the ceremony falls back to
  // the adjutant rather than being named on paper they cannot sign.
  const chosen =
    terms.administratorId === undefined || terms.administratorId === null
      ? undefined
      : world.people.get(terms.administratorId)
  const chosenRecord =
    terms.administratorId === undefined || terms.administratorId === null
      ? undefined
      : world.service.get(terms.administratorId)
  const administrator =
    chosen && chosen.deathTick === null && chosenRecord && chosenRecord.dischargedAtTick === null
      ? chosen
      : undefined
  const administratorTitle =
    administrator && chosenRecord
      ? `${
          (chosenRecord.commissioned === true
            ? (branchSpecFor(world, chosenRecord.branch).officerRanks ?? [])
            : branchSpecFor(world, chosenRecord.branch).ranks)[chosenRecord.rank] ?? ''
        }, ${specialtyFor(world, chosenRecord.specialtyId).title}`
      : null

  const { year } = toDate(world, tick)
  const reenlistment = variant === 'reenlistment'
  const spelled = SPELLED[terms.termYears] ?? String(terms.termYears)
  // Which contract of the career this is: every signing already left an
  // event, so the ledger counts them rather than a field that could drift.
  const priors = world.events.filter(
    (e) => e.subjectId === personId && e.type === 'reenlisted',
  ).length
  // Past the words, count in figures rather than repeating the last word
  // the list happens to hold: a fourteenth term printed as "EIGHTH TERM"
  // for the rest of a long career.
  // A first REENLISTMENT is a second TERM, which is why this counts from
  // two. Ninth and beyond print as figures — the words run out at eighth,
  // and repeating the last one made a fourteenth term read "EIGHTH TERM"
  // for the rest of a long career. (9th through 20th are all "TH"; a
  // twenty-first term is forty years of contracts and does not arise.)
  const termNumber = priors + 2
  const ordinal = ORDINALS[termNumber - 1] ?? `${String(termNumber)}TH`
  const initials = station
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase()

  return {
    variant,
    // AN OFFICER DOES NOT ENLIST (military review, should-fix 7). The
    // document had the grade and the headline right and then called a
    // lieutenant a recruit in every other line. Same family, third form.
    title: commissioned
      ? reenlistment
        ? 'OFFICER SERVICE AGREEMENT'
        : 'OFFICER APPOINTMENT'
      : reenlistment
        ? 'REENLISTMENT CONTRACT'
        : 'ENLISTMENT CONTRACT',
    form: commissioned ? 'FORM RA-2' : reenlistment ? 'FORM RA-4' : 'FORM RA-1',
    contractNo: `${reenlistment ? 'RE' : 'EN'}-${String(year)}-${String(sequence)}`,
    controlNo: `${initials === '' ? 'HQ' : initials}-${String(sequence)}-${String(year).slice(-2)}`,
    command: branch.name,
    dated: stamped(world, tick),
    headline: reenlistment
        ? `${commissioned ? 'CONTINUED SERVICE' : 'REENLISTMENT'} — ${ordinal} TERM`
      : commissioned
        ? 'INITIAL APPOINTMENT — COMMISSIONED SERVICE'
        : 'INITIAL ENLISTMENT — FIRST TERM',
    name: `${person.familyName.toUpperCase()}, ${person.givenName}`,
    grade: grade === undefined
      ? rankTitle
      : `${rankTitle} (${commissioned ? 'O' : 'E'}-${String(grade)})`,
    specialty: trade,
    station,
    termYears: terms.termYears,
    termText: `${spelled} (${String(terms.termYears)}) years`,
    from: stamped(world, tick),
    to: stamped(world, tick, terms.termYears * 12),
    branch: branch.name,
    option: optionText(terms.option, terms.bonus),
    bonus: terms.option === 'bonus' ? terms.bonus : (0 as Money),
    // THE COUNTRY IS THE PRESET'S, never a name typed into engine prose — a
    // soldier of the United States does not swear to the Republic.
    oath:
      `I, ${person.givenName} ${person.familyName}, do solemnly swear that I will support and ` +
      `defend ${world.spec.homelandName} against all enemies, foreign and domestic; that I will ` +
      `bear true faith and allegiance to the same; and that I will obey the orders of those ` +
      `appointed over me, according to the Code of Military Justice. So help me.`,
    commissioned,
    oathHeading: commissioned
        ? 'Oath of Office'
      : reenlistment
        ? 'Oath of Reenlistment'
        : 'Oath of Enlistment',
    undertaking: commissioned
      ? reenlistment
        ? 'I agree to continue in commissioned service in'
        : 'I accept appointment as a commissioned officer in'
      : reenlistment
        ? 'I reenlist in'
        : 'I enlist in',
    signatureLabel: commissioned
      ? "Officer's signature"
      : reenlistment
        ? "Member's signature"
        : "Recruit's signature",
    signedBy: `${person.givenName.charAt(0)}. ${person.familyName.toUpperCase()}`,
    // §6. A NAME THE PLAYER KNOWS, where one was chosen. The drawn officer
    // stays for a first enlistment, when there is no unit to choose from.
    administeredBy: administrator
      ? `${administrator.givenName.charAt(0)}. ${administrator.familyName.toUpperCase()}`
      : `${officerInitial}. ${officerFamily.toUpperCase()}`,
    administeredTitle: administratorTitle ?? witness,
    stamp: `${String(terms.termYears)}-YEAR`,
  }
}
