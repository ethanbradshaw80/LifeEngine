/**
 * WHO OWNS THE BUSINESS (the business revamp, owner's ruling 2026-08-13).
 *
 * A trade starts wholly the founder's. Money can be raised against it, and
 * every share sold is a share of everything it will ever earn — which is
 * the whole of the decision. Nobody is forced to raise; a business that
 * never takes a penny from anybody stays at a thousand per-mille and this
 * module never touches it.
 *
 * THE OWNER'S RULING ON WHO INVESTS: *"we can do real townspeople but I
 * also wanted to do generated firms"*. Scale decides which, which is also
 * how it works in life.
 *
 *   - A SEED round is a person. The dentist, the man who sold his hardware
 *     store, possibly your wife's brother. The money leaves THEIR wallet,
 *     to the cent, and when they die their stake passes to their children.
 *     You know them, and that is the point.
 *   - SERIES A AND BEYOND are firms — fictional, out of town, faceless.
 *     Institutional money, correctly impersonal, and a board seat with it.
 *
 * Per-mille throughout, integer, exactly like every other share in this
 * engine. Pure arithmetic: finances moves the money.
 */

import type { Money } from '@life-engine/shared'
import type {
  Business,
  CapTable,
  Expansion,
  ExpansionKind,
  InvestmentRound,
  Shareholder,
} from './types.js'
import { annualRevenueOf, businessKindById, valuationMultipleFor } from './business.js'

/** A business nobody has raised against: the founder holds all of it. */
export function foundingCapTable(): CapTable {
  return { founderPerMille: 1000, shareholders: [] }
}

/**
 * WHAT THE BUSINESS IS WORTH, for the purpose of selling a piece of it.
 *
 * Revenue times the trade's own multiple — the same machinery the IPO
 * already uses, applied a stage earlier. A private trade is worth what its
 * earnings are worth to somebody else, and no more.
 */
export function privateValuationOf(world: { readonly tick: number }, business: Business): Money {
  void world
  const kind = businessKindById(business.kindId)
  if (kind === undefined || business.closedTick !== null) return 0 as Money
  const revenue = annualRevenueOf(business, kind)
  return Math.floor((revenue * valuationMultipleFor(business.kindId)) / 1000) as Money
}

/** What each round buys, and what it costs the founder. */
export interface RoundTerms {
  readonly round: InvestmentRound
  readonly title: string
  /** The slice the money buys, per-mille of the whole. */
  readonly perMille: number
  /** A seat at the table — institutions take one, an angel does not. */
  readonly boardSeat: boolean
  /** What they get back before anybody else, per-mille of what they put in. */
  readonly preferencePerMille: number
}

export const ROUNDS: readonly RoundTerms[] = [
  {
    round: 'seed',
    title: 'a local backer',
    perMille: 100,
    boardSeat: false,
    preferencePerMille: 1000,
  },
  {
    round: 'series-a',
    title: 'a first institutional round',
    perMille: 200,
    boardSeat: true,
    preferencePerMille: 1500,
  },
  {
    round: 'series-b',
    title: 'a growth round',
    perMille: 180,
    boardSeat: true,
    preferencePerMille: 2000,
  },
  {
    round: 'series-c',
    title: 'a late round',
    perMille: 150,
    boardSeat: true,
    preferencePerMille: 2500,
  },
]

export function termsFor(round: InvestmentRound): RoundTerms | undefined {
  return ROUNDS.find((entry) => entry.round === round)
}

/** The next round this business could take, or undefined when it is done raising. */
export function nextRoundFor(table: CapTable): RoundTerms | undefined {
  const taken = new Set(table.shareholders.map((holder) => holder.round))
  return ROUNDS.find((entry) => !taken.has(entry.round))
}

/**
 * WHAT THE MONEY COSTS TO RAISE. The investor pays the slice's worth of
 * the business as it stands — a bigger business sells the same slice for
 * more, which is the entire reason to wait.
 */
export function investmentFor(valuation: Money, terms: RoundTerms): Money {
  return Math.max(1, Math.floor((valuation * terms.perMille) / 1000)) as Money
}

/**
 * ISSUE THE SHARES.
 *
 * Everybody already on the register is diluted in proportion, the founder
 * included — that is what dilution IS, and doing it any other way would
 * quietly rob whoever came first. Conserving by construction: the slices
 * are scaled by the same factor and the new one takes exactly what it
 * bought, so the register still sums to a thousand.
 */
export function issueShares(table: CapTable, holder: Shareholder): CapTable {
  const keep = 1000 - holder.perMille
  const diluted = table.shareholders.map((existing) => ({
    ...existing,
    perMille: Math.floor((existing.perMille * keep) / 1000),
  }))
  const issued = [...diluted, holder]
  // THE ROUNDING GOES TO THE FOUNDER, so the register sums to exactly a
  // thousand and the odd per-mille is not quietly created or destroyed.
  const held = issued.reduce((sum, entry) => sum + entry.perMille, 0)
  return { founderPerMille: Math.max(0, 1000 - held), shareholders: issued }
}

/** Does the register still account for the whole business? */
export function capTableSums(table: CapTable): boolean {
  const held = table.shareholders.reduce((sum, entry) => sum + entry.perMille, 0)
  return table.founderPerMille + held === 1000
}

/** What this slice of a month's drawing is worth, in cents. */
export function shareOf(amount: Money, perMille: number): Money {
  return Math.floor((amount * perMille) / 1000) as Money
}

/** How the board would vote, by the weight of what they hold. */
export function boardWeightFor(table: CapTable): number {
  return table.shareholders
    .filter((holder) => holder.boardSeat)
    .reduce((sum, holder) => sum + holder.perMille, 0)
}

// ---------------------------------------------------------------------------
// Growing beyond the four walls
// ---------------------------------------------------------------------------

/** What each way of growing costs and what it buys. */
export interface ExpansionTerms {
  readonly kind: ExpansionKind
  readonly title: string
  readonly blurb: string
  /** Cost as a share of what the trade took to open, per-mille. */
  readonly costPerMille: number
  /** What it adds to the monthly earning, per-mille. */
  readonly upliftPerMille: number
  /** Years of trading before anybody would consider it. */
  readonly yearsTrading: number
  /** Consecutive profitable months before it is worth trying. */
  readonly goodMonths: number
}

/**
 * THE LADDER, in the order a real business climbs it.
 *
 * A second location is the ordinary next step and the cheapest. Franchising
 * needs a name worth licensing, so it asks for far longer at the wheel and
 * pays a smaller, safer royalty. Owning the supplier is the most expensive
 * and the most valuable, because it takes a bite out of everything the
 * business will ever buy.
 */
export const EXPANSIONS: readonly ExpansionTerms[] = [
  {
    kind: 'location',
    title: 'Open a second place',
    blurb: 'Another set of doors, trading on its own, under the same name.',
    costPerMille: 700,
    upliftPerMille: 550,
    yearsTrading: 2,
    goodMonths: 12,
  },
  {
    kind: 'supply-chain',
    title: 'Buy your supplier',
    blurb: 'Own what you buy from, and take the margin they were charging you.',
    costPerMille: 1200,
    upliftPerMille: 400,
    yearsTrading: 3,
    goodMonths: 18,
  },
  {
    kind: 'franchise',
    title: 'License the name',
    blurb: 'Let somebody else run one and pay you for the sign above the door.',
    costPerMille: 500,
    upliftPerMille: 300,
    yearsTrading: 5,
    goodMonths: 24,
  },
]

export function expansionTermsFor(kind: ExpansionKind): ExpansionTerms | undefined {
  return EXPANSIONS.find((entry) => entry.kind === kind)
}

/**
 * WHAT THE EXPANSIONS ADD TOGETHER, per-mille of the ordinary month.
 *
 * Additive rather than compounding, deliberately: three ways of growing
 * should make a business three times bigger, not eight times. Compounding
 * here is how a shop quietly becomes worth more than the town.
 */
export function upliftPerMilleOf(list: readonly Expansion[] | undefined): number {
  if (list === undefined || list.length === 0) return 0
  return list.reduce((sum, entry) => sum + entry.upliftPerMille, 0)
}
