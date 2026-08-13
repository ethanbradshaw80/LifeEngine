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
import type { Business, CapTable, Shareholder, InvestmentRound } from './types.js'
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
