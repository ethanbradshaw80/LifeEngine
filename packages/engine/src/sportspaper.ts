/**
 * THE PAPER AN ATHLETE SIGNS (owner, playing: "make a contract UI how we
 * did for deployments and stuff so that its realistic — college offers
 * along with endorsement deals and stuff").
 *
 * Same family as the service contract and the orders sheet, and the same
 * rule, which is the whole reason those screens work: EVERY VALUE ON THE
 * DOCUMENT IS BUILT HERE. The component prints and computes nothing, so
 * there is no way for the paper to say something the world does not.
 *
 * Three documents, because an athlete signs three genuinely different
 * things and they read nothing alike:
 *
 *   A LETTER OF INTENT is a promise about school. The money on it is
 *     tuition somebody else is paying, and the thing being bought is four
 *     years of your life at eighteen.
 *   A PLAYING CONTRACT is a job with a term on it and a number that
 *     depends entirely on where you were taken.
 *   AN ENDORSEMENT is not a job at all. It buys your NAME, it can be
 *     withdrawn the week you embarrass anybody, and the paper says so.
 *
 * Every organisation named is fictional (charter §3).
 */

import type { Money, Tick } from '@life-engine/shared'
import { toDate } from './clock.js'
import type { AthleteRecord, World } from './types.js'
import { endorsementsFor, overallOf, positionById, recordWords, rulesFor } from './sports.js'

export type PaperVariant = 'letter' | 'playing' | 'endorsement'

/**
 * ONE SHAPE FOR THREE PAPERS. Lines with nothing to say do not print — a
 * contract with no bonus shows no bonus line rather than a proud $0,
 * which is how a real form behaves.
 */
export interface SportsPaper {
  readonly variant: PaperVariant
  readonly title: string
  readonly form: string
  readonly documentNo: string
  /** The body that issues it — a league office, a university, a brand. */
  readonly issuer: string
  readonly issuerSub: string
  readonly dated: string
  readonly headline: string
  readonly name: string
  /** "Shooting Guard (SG)" or "Lightweight". */
  readonly role: string
  readonly party: string
  readonly termYears: number
  readonly termText: string
  readonly from: string
  readonly to: string
  /** Cents a month, at today's prices. Zero prints no line. */
  readonly monthly: Money
  /** Cents, paid once. Zero prints no line. */
  readonly bonus: Money
  /** The numbered clauses, already in the order they print. */
  readonly clauses: readonly string[]
  /** The undertaking above the signature, in the paper's own voice. */
  readonly undertaking: string
  readonly stamp: string
  readonly stampNote: string
  readonly signerTitle: string
  readonly witness: string
}

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

function stamped(world: World, tick: Tick, monthsAhead = 0): string {
  const { year, month } = toDate(world, (tick + monthsAhead) as Tick)
  return `${MONTHS[month - 1] ?? 'JANUARY'} ${String(year)}`
}

function spelled(years: number): string {
  const word = SPELLED[years] ?? String(years)
  return `${word} (${String(years)}) year${years === 1 ? '' : 's'}`
}

/** A document number that is stable for the same signing on the same seed. */
function documentNo(tick: Tick, personId: number, salt: number): string {
  const n = Math.abs((personId * 7919 + tick * 131 + salt) % 900_000) + 100_000
  return String(n)
}

function roleOf(record: AthleteRecord): string {
  const position = positionById(record.positionId)
  if (position === undefined) return 'Player'
  return record.sport === 'combat'
    ? position.title
    : `${position.title} (${position.short})`
}

/**
 * THE LETTER OF INTENT.
 *
 * The money is tuition, and it is worth saying out loud on the paper what
 * a scholarship actually is: somebody else pays for the education, and in
 * exchange you play for them. The clause about it being renewable YEARLY
 * is the true and unpleasant part — a scholarship is not four years, it is
 * one year four times, and a player who gets hurt finds that out.
 */
export function letterOfIntentFor(
  world: World,
  record: AthleteRecord,
  name: string,
  programme: string,
  blurb: string,
  ride: string,
  tuition: Money,
): SportsPaper {
  const full = ride === 'full'
  const partial = ride === 'partial'
  const monthly = full ? tuition : partial ? (Math.floor(tuition / 2) as Money) : (0 as Money)
  return {
    variant: 'letter',
    title: 'NATIONAL LETTER OF INTENT',
    form: 'FORM NLI-1',
    documentNo: documentNo(world.tick, record.personId, 11),
    issuer: programme,
    issuerSub: blurb.replace(/^a /, '').toUpperCase(),
    dated: stamped(world, world.tick),
    headline: full
      ? 'ATHLETIC SCHOLARSHIP — FULL GRANT-IN-AID'
      : partial
        ? 'ATHLETIC SCHOLARSHIP — PARTIAL GRANT-IN-AID'
        : 'PREFERRED WALK-ON — NO ATHLETIC AID',
    name,
    role: roleOf(record),
    party: programme,
    termYears: 1,
    termText: spelled(1),
    from: stamped(world, world.tick),
    to: stamped(world, world.tick, 12),
    monthly,
    bonus: 0 as Money,
    clauses: [
      `The student-athlete named above accepts a place in the athletics programme of ${programme}.`,
      full
        ? 'The institution undertakes to meet tuition, room and board in full for the academic year.'
        : partial
          ? 'The institution undertakes to meet one half of tuition for the academic year. The remainder is the family’s.'
          : 'No athletic aid is awarded. Tuition remains payable in full by the student-athlete.',
      // THE CLAUSE THAT IS ACTUALLY TRUE AND ALMOST NOBODY KNOWS.
      'This award is made for ONE ACADEMIC YEAR and is renewable at the sole discretion of the institution. It is not a four-year guarantee.',
      'The student-athlete agrees to maintain academic eligibility. Athletic participation does not survive academic failure.',
    ],
    undertaking: `I intend to enrol at ${programme} and to represent it in competition.`,
    stamp: full ? 'FULL RIDE' : partial ? 'PARTIAL' : 'WALK-ON',
    stampNote: 'AWARD',
    signerTitle: 'Student-Athlete',
    witness: 'Director of Athletics',
  }
}

/**
 * THE PLAYING CONTRACT.
 *
 * A draft pick's deal is not negotiated and the paper does not pretend it
 * was — the scale decides it, which is why the clause says so. A veteran
 * deal is a different document in tone even though it is the same form.
 */
export function playingContractFor(
  world: World,
  record: AthleteRecord,
  name: string,
  monthly: Money,
): SportsPaper {
  const rules = rulesFor(record.sport)
  const rookie = record.seasons < 1
  const drafted = record.draftPick !== null
  const years = rookie ? (rules.draftPicks >= 200 ? 4 : 2) : 3
  const combat = record.sport === 'combat'

  return {
    variant: 'playing',
    title: combat ? 'PROMOTIONAL AGREEMENT' : 'UNIFORM PLAYER CONTRACT',
    form: combat ? 'FORM PA-1' : 'FORM UPC-1',
    documentNo: documentNo(world.tick, record.personId, 23),
    issuer: record.teamName === '' ? 'the club' : record.teamName,
    issuerSub: rules.title.toUpperCase(),
    dated: stamped(world, world.tick),
    headline: combat
      ? `PROFESSIONAL — RECORD ${recordWords(record)}`
      : rookie
        ? drafted
          ? `ROOKIE SCALE — SELECTION NO. ${String(record.draftPick ?? 0)}`
          : 'UNDRAFTED FREE AGENT — CAMP INVITATION'
        : `VETERAN AGREEMENT — SEASON ${String(record.seasons + 1)}`,
    name,
    role: roleOf(record),
    party: record.teamName === '' ? 'the club' : record.teamName,
    termYears: years,
    termText: spelled(years),
    from: stamped(world, world.tick),
    to: stamped(world, world.tick, years * 12),
    monthly,
    // A first-round pick is paid to sign; nobody else is.
    bonus:
      drafted && rookie && (record.draftPick ?? 99) <= 30
        ? (Math.floor(monthly * 8) as Money)
        : (0 as Money),
    clauses: combat
      ? [
          `The fighter agrees to appear in bouts promoted by ${record.teamName} for the term of this agreement.`,
          'Purses are payable per bout. This agreement guarantees no bouts and no minimum number of appearances.',
          'The promotion may terminate this agreement following consecutive losses.',
        ]
      : [
          `The player agrees to render skilled services to ${record.teamName === '' ? 'the club' : record.teamName} for the term of this contract.`,
          rookie && drafted
            ? 'Compensation is fixed by the rookie scale according to selection number and is not subject to negotiation.'
            : 'Compensation is as stated above and was agreed between the parties.',
          drafted || !rookie
            ? 'The club may trade this contract to another club, which assumes it entire.'
            : 'This is an invitation to training camp. The club may release the player at any time and owes nothing on release.',
          'The player agrees to maintain condition. Injury sustained in play does not void this contract; injury sustained otherwise may.',
        ],
    undertaking: combat
      ? `I agree to fight for ${record.teamName} under the terms above.`
      : `I agree to play for ${record.teamName === '' ? 'the club' : record.teamName} under the terms above.`,
    stamp: rookie && !drafted ? 'NO GUARANTEE' : `${String(years)} YR`,
    stampNote: 'TERM',
    signerTitle: combat ? 'Fighter' : 'Player',
    witness: combat ? 'Matchmaker' : 'General Manager',
  }
}

/**
 * THE ENDORSEMENT.
 *
 * NOT A JOB. It buys the right to use somebody's name, and the clause
 * that matters is the morals one — the money goes the week you embarrass
 * them, which is the exact mechanism the scandal arc runs on. Putting it
 * on the paper means the player was told.
 */
const BRANDS: readonly string[] = [
  'Meridian Athletic',
  'Brackenwell Sportswear',
  'Calver Energy',
  'Northgate Motors',
  'Harvest Foods',
]

export function endorsementFor(
  world: World,
  record: AthleteRecord,
  name: string,
  monthly: Money,
): SportsPaper {
  const fame = record.fame ?? 0
  const brand = BRANDS[Math.abs(record.personId + fame) % BRANDS.length] ?? 'Meridian Athletic'
  const years = fame >= 700 ? 4 : fame >= 500 ? 3 : 2
  return {
    variant: 'endorsement',
    title: 'ENDORSEMENT AGREEMENT',
    form: 'FORM EA-1',
    documentNo: documentNo(world.tick, record.personId, 37),
    issuer: brand,
    issuerSub: 'MARKETING DEPARTMENT',
    dated: stamped(world, world.tick),
    headline: fame >= 700 ? 'PRINCIPAL ENDORSER' : 'BRAND AMBASSADOR',
    name,
    role: roleOf(record),
    party: brand,
    termYears: years,
    termText: spelled(years),
    from: stamped(world, world.tick),
    to: stamped(world, world.tick, years * 12),
    monthly,
    bonus: Math.floor(monthly * 3) as Money,
    clauses: [
      `${brand} is granted the right to use the endorser’s name and likeness in advertising for the term.`,
      'The endorser agrees to a stated number of appearance days each year.',
      // THE CLAUSE THE WHOLE SCANDAL ARC HANGS ON.
      'MORALS. The company may terminate this agreement immediately, and without further payment, upon conduct by the endorser which in the company’s sole judgement brings it into disrepute.',
      'This agreement confers no employment and no benefits of employment.',
    ],
    undertaking: `I grant ${brand} the use of my name on the terms above.`,
    stamp: `${String(years)} YR`,
    stampNote: 'TERM',
    signerTitle: 'Endorser',
    witness: 'Brand Director',
  }
}

/** What a player would be offered right now, or null. */
export function endorsementOfferFor(record: AthleteRecord): Money {
  if (record.level !== 'pro') return 0 as Money
  if ((record.endorsements ?? 0) > 0) return 0 as Money
  return endorsementsFor(record.fame ?? 0)
}

/** The rating the paper quotes, so the document and the screen agree. */
export function paperOverallOf(record: AthleteRecord): number {
  return overallOf(record)
}
