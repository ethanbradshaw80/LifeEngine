/**
 * THE SEPARATION DOCUMENTS — the last bookend.
 *
 * The owner's spec: when a career ends, retention does not offer another
 * term. You out-process, and you get your paperwork. Two documents, both
 * assembled from the record rather than written for the occasion:
 *
 *   the DD-214 (Form RA-214)   everyone who gets out
 *   the retirement certificate  twenty years and over, alongside it
 *
 * WHY IT FEELS EARNED: nothing here is composed. The awards are the awards,
 * the schools are the courses actually completed, the tours are the tours,
 * and the character of service follows how the career actually ended. A
 * player who did nothing gets a thin sheet, and that is the honest result.
 *
 * This replaces the plain certificate of service that stood here for an
 * afternoon — the spec's version is a summary of a whole life in uniform
 * rather than a line saying it happened.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { decorationsOf } from './awards.js'
import { toDate } from './clock.js'
import { eventsFor } from './eventindex.js'
import { openStream, Stream } from './rng.js'
import type { World } from './types.js'
import { BRANCH_OFFICER_RANKS_SPELLED, BRANCH_RANKS_SPELLED, specialtyTitleCased } from './content.js'
import { branchSpecFor, specialtyFor } from './worldspec.js'

/**
 * The tours, read straight off the world.
 *
 * NOT via deployment.ts's `deploymentsOf`, which is the same one-line map
 * read: importing it would close a cycle (player → separation → deployment
 * → player, the import ratchet caught it). This module is a leaf on
 * purpose — it only ever READS a finished record, so it should not be
 * reaching into the systems that wrote it.
 */
function toursOf(world: World, personId: EntityId) {
  return world.deployments.get(personId) ?? []
}

/** What the stamp says, and how the paper is read ten years later. */
export type CharacterOfService = 'HONORABLE' | 'GENERAL' | 'UNDER OTHER THAN HONORABLE'

export interface SeparationRecord {
  readonly contractNo: string
  readonly controlNo: string
  readonly command: string
  readonly name: string
  readonly grade: string
  readonly branch: string
  readonly specialty: string
  readonly enteredService: string
  readonly separated: string
  /** "11 years, 9 months" — the clock is monthly, so it stops at months. */
  readonly totalService: string
  readonly character: CharacterOfService
  readonly reason: string
  readonly reentryCode: string
  /** Empty where there is nothing to list — the block hides rather than lying. */
  readonly awards: readonly string[]
  readonly schools: readonly string[]
  readonly tours: readonly string[]
  readonly remarks: string
  readonly retirementEligible: boolean
  readonly yearsServed: number
}

export interface RetirementCertificate {
  readonly command: string
  /** "Sergeant First Class Mary Whitlock" — rank spelled, not abbreviated. */
  readonly name: string
  readonly branch: string
  /** "the fourteenth of June, 2082". */
  readonly date: string
  /** "twenty-two years". */
  readonly years: string
  readonly signedBy: string
  readonly adjutant: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const ORDINAL_DAYS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
]

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty']
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]

/** "twenty-two". A certificate does not print a numeral. */
function spelled(n: number): string {
  if (n < 20) return ONES[n] ?? String(n)
  const tens = Math.floor(n / 10)
  const ones = n % 10
  const word = TENS[tens] ?? String(n)
  return ones === 0 ? word : `${word}-${ONES[ones] ?? String(ones)}`
}

/**
 * HOW THE CAREER ENDED, in the two things a later reader cares about: the
 * character of service, and whether the door is open again.
 *
 * One table, because these two must never disagree — a file that reads
 * HONORABLE and bars reentry, or the reverse, is a document arguing with
 * itself. The reasons are the ones `discharge()` actually writes.
 */
export function separationTermsFor(
  reason: string,
  yearsServed: number,
): { character: CharacterOfService; reentry: string; authority: string } {
  switch (reason) {
    case 'misconduct':
      return {
        character: 'UNDER OTHER THAN HONORABLE',
        reentry: 'RE-4 (ineligible)',
        authority: 'Separation for cause — conduct',
      }
    case 'medical':
      return {
        character: 'HONORABLE',
        reentry: 'RE-4 (ineligible — medical)',
        authority: 'Medical separation; unfit for further service',
      }
    case 'high-year tenure':
      return {
        // Not a punishment: the service simply had no further billet at this
        // grade, and the file says so rather than implying a failing.
        character: 'HONORABLE',
        reentry: 'RE-4 (ineligible — high-year tenure)',
        authority: 'High-year tenure; no further service at grade',
      }
    case 'twenty years served':
    case 'thirty years served':
      return {
        character: 'HONORABLE',
        reentry: 'RE-4 (retired)',
        authority: 'Voluntary retirement; length of service',
      }
    case 'retirement age':
      return {
        character: 'HONORABLE',
        reentry: 'RE-4 (retired — age)',
        authority: 'Mandatory retirement; age in service',
      }
    case 'died in service':
      return {
        character: 'HONORABLE',
        reentry: 'N/A',
        authority: 'Deceased while on active service',
      }
    default:
      // End of term. A short first term separating voluntarily is ordinary
      // and stays RE-1; the door is open.
      return {
        character: yearsServed >= 1 ? 'HONORABLE' : 'GENERAL',
        reentry: yearsServed >= 1 ? 'RE-1 (eligible)' : 'RE-3 (waiver required)',
        authority: 'Completion of required service (end of term)',
      }
  }
}

function stamped(world: World, tick: Tick, short: boolean): string {
  const { year, month } = toDate(world, tick)
  const names = short ? SHORT_MONTHS : MONTHS
  return `${names[month - 1] ?? 'Jan'} ${String(year)}`
}

/**
 * The DD-214, as of this tick. Undefined when the record is still open —
 * this is a document about a career that has ENDED, and one written for an
 * unfinished one would be a claim the record does not support.
 */
export function separationFor(
  world: World,
  personId: EntityId,
): SeparationRecord | undefined {
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || !record || record.dischargedAtTick === null) return undefined

  const branch = branchSpecFor(world, record.branch)
  const commissioned = record.commissioned === true
  const ladder = commissioned ? (branch.officerRanks ?? branch.ranks) : branch.ranks
  const grades = commissioned ? (branch.officerGrades ?? branch.grades) : branch.grades
  const index = Math.max(0, Math.min(ladder.length - 1, record.rank))
  const grade = grades[index]

  const months = Math.max(0, record.dischargedAtTick - record.enlistedAtTick)
  const years = Math.floor(months / 12)
  const spareMonths = months % 12
  const terms = separationTermsFor(record.dischargeReason ?? 'end of term', years)

  // THE AWARDS ARE THE AWARDS. Decorations first, then the badges — the
  // order a rack is read in — and a device prints as the count it is.
  const decorations = decorationsOf(world, personId)
  const awards = [
    ...decorations.filter((a) => a.kind !== 'qualification-badge'),
    ...decorations.filter((a) => a.kind === 'qualification-badge'),
  ].map((a) => (a.count > 1 ? `${a.title} (×${String(a.count)})` : a.title))

  // Military education: the COURSES actually finished, in order, without
  // repeats. Initial entry training is not one of them — everybody who ever
  // wore the uniform did it, so listing it says nothing and pushes the real
  // schools down the block. A DD-214's education line is what somebody was
  // sent away to learn.
  const ENTRY_TRAINING = new Set(['basic training', 'the commissioning course'])
  const schools: string[] = []
  for (const event of eventsFor(world, personId)) {
    if (event.type !== 'completed-training' || event.detail === null) continue
    if (ENTRY_TRAINING.has(event.detail)) continue
    if (!schools.includes(event.detail)) schools.push(event.detail)
  }

  // Campaigns and service abroad: combat tours grouped by the enemy faced,
  // rotations named by the host. A tour nobody can name is still a tour.
  const combat = new Map<string, number>()
  const rotations = new Set<string>()
  for (const tour of toursOf(world, personId)) {
    if (tour.kind === 'rotation') {
      const host = tour.hostId === null ? undefined : world.nations.get(tour.hostId)
      rotations.add(`posting to ${host?.name ?? 'an allied station'}`)
      continue
    }
    const enemy = tour.enemyId === null ? undefined : world.nations.get(tour.enemyId)
    const front = `service against ${enemy?.name ?? 'a foreign power'}`
    combat.set(front, (combat.get(front) ?? 0) + 1)
  }
  const tours = [
    ...[...combat].map(([front, n]) => (n > 1 ? `${front} (${String(n)} tours)` : front)),
    ...rotations,
  ]

  // Remarks: what the record holds that the blocks above do not say.
  const remarks: string[] = []
  const wounds = eventsFor(world, personId).filter((e) => e.type === 'wounded-in-action').length
  if (wounds > 0) {
    remarks.push(
      `Wounded in action${wounds > 1 ? ` on ${String(wounds)} occasions` : ''}.`,
    )
  }
  const captured = toursOf(world, personId).some((t) => t.capturedAtTick !== null)
  if (captured) remarks.push('Held prisoner of war.')
  if (terms.character === 'HONORABLE') remarks.push('Member served honorably.')

  const rng = openStream(world.seed, Stream.Employment, personId, record.dischargedAtTick + 9700)
  const sequence = 100 + rng.nextInt(0, 899)
  const { year } = toDate(world, record.dischargedAtTick)

  return {
    contractNo: `SR-${String(year)}-${String(sequence).padStart(4, '0')}`,
    controlNo: `${branch.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}-SR-${String(sequence).padStart(4, '0')}-${String(year).slice(-2)}`,
    command: branch.name,
    name: `${person.familyName.toUpperCase()}, ${person.givenName}`,
    grade: grade === undefined
      ? (ladder[index] ?? '—')
      : `${ladder[index] ?? '—'} (${commissioned ? 'O' : 'E'}-${String(grade)})`,
    branch: branch.name,
    specialty: specialtyTitleCased(specialtyFor(world, record.specialtyId), commissioned),
    enteredService: stamped(world, record.enlistedAtTick, true),
    separated: stamped(world, record.dischargedAtTick, true),
    totalService: `${String(years)} year${years === 1 ? '' : 's'}${
      spareMonths > 0 ? `, ${String(spareMonths)} month${spareMonths === 1 ? '' : 's'}` : ''
    }`,
    character: terms.character,
    reason: terms.authority,
    reentryCode: terms.reentry,
    awards,
    schools,
    tours,
    remarks: remarks.join(' '),
    retirementEligible: months >= 240,
    yearsServed: years,
  }
}

/**
 * The retirement certificate. Undefined below twenty years — the whole
 * point of it is that a full career earns something a short one does not.
 */
export function retirementCertificateFor(
  world: World,
  personId: EntityId,
): RetirementCertificate | undefined {
  const person = world.people.get(personId)
  const record = world.service.get(personId)
  if (!person || !record || record.dischargedAtTick === null) return undefined
  const months = record.dischargedAtTick - record.enlistedAtTick
  if (months < 240) return undefined
  // AND NOT FOR A CAREER THAT ENDED BADLY. Twenty years is the threshold,
  // not the qualification: a member put out for misconduct was being handed
  // a certificate thanking them for "honor, courage and unfailing devotion"
  // in the same month their DD-214 was stamped UNDER OTHER THAN HONORABLE.
  // An honour that length of service alone can buy is not an honour.
  const terms = separationTermsFor(record.dischargeReason ?? 'end of term', Math.floor(months / 12))
  if (terms.character !== 'HONORABLE') return undefined

  const branch = branchSpecFor(world, record.branch)
  const commissioned = record.commissioned === true
  const ladder = commissioned ? (branch.officerRanks ?? branch.ranks) : branch.ranks
  const index = Math.max(0, Math.min(ladder.length - 1, record.rank))
  // SPELLED, not abbreviated. This is the one document that is not a form,
  // and "SSG Debra Spencer" reads like one. Falls back to the abbreviation
  // for a preset that ships no spelled list — better a short rank than an
  // invented one.
  const spelledLadder = commissioned
    ? BRANCH_OFFICER_RANKS_SPELLED[record.branch as keyof typeof BRANCH_OFFICER_RANKS_SPELLED]
    : BRANCH_RANKS_SPELLED[record.branch as keyof typeof BRANCH_RANKS_SPELLED]
  const rankWords = spelledLadder?.[index] ?? ladder[index] ?? ''

  const rng = openStream(world.seed, Stream.Employment, personId, record.dischargedAtTick + 9800)
  const names = [...world.spec.family.names]
  const weights = [...world.spec.family.weights]
  const initials = ['A', 'B', 'C', 'D', 'E', 'H', 'J', 'K', 'L', 'M', 'R', 'S', 'T', 'W']
  const general = `${rng.pick(initials)}. ${rng.pickWeighted(names, weights).toUpperCase()}`
  const adjutant = `${rng.pick(initials)}. ${rng.pickWeighted(names, weights).toUpperCase()}`

  const { year, month } = toDate(world, record.dischargedAtTick)
  // The clock is monthly, so the day is the first — said as a day rather
  // than invented as a date the simulation does not have.
  return {
    command: branch.name,
    name: `${rankWords} ${person.givenName} ${person.familyName}`.trim(),
    branch: branch.name,
    date: `the ${ORDINAL_DAYS[1] ?? 'first'} of ${MONTHS[month - 1] ?? 'January'}, ${String(year)}`,
    years: `${spelled(Math.floor(months / 12))} years`,
    signedBy: `${general} · GEN`,
    adjutant: `${adjutant} · COL`,
  }
}
