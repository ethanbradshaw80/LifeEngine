/**
 * THINGS THAT HAPPEN TO A BUSINESS (owner, across this build: "It feels
 * like every business is dull and nothing to do until you IPO we need to
 * add things to make it better").
 *
 * The operations loop answered half of that — a shelf, a supplier, a price,
 * all of them things the OWNER decides to touch. This is the other half:
 * the things that arrive whether you wanted them or not. A rival opens up
 * and undercuts you. The man who has worked for you for nine years asks for
 * more. Your supplier goes under in the same week the van does.
 *
 * WHY THIS AND NOT MORE BUTTONS. A business you have to tend is a chore; a
 * business that HAPPENS TO YOU is a story. Board votes gave that to a
 * listed company, and a listed company is perhaps five per cent of the time
 * anybody spends owning something. This is the ninety-five.
 *
 * THE RULE EVERY MOMENT HERE HAD TO PASS: no option is free and none is
 * obviously right. Where one answer is plainly best it is not a decision,
 * it is a toll gate with extra steps.
 *
 * THE QUESTIONS ARE WRITTEN WITH PLACEHOLDERS — {stock}, {store},
 * {supplier}, {customers} — and each trade reads its own way through
 * `inTradeWords` (owner: "how can a software company 'stock the shelfs'").
 * One moment, twenty vocabularies.
 *
 * Pure content and arithmetic. `finances.ts` decides when one arrives and
 * `player.ts` carries out what was chosen, because they own the ledger and
 * the verbs respectively (Law 12).
 */

import type { BusinessOps } from './types.js'

export type MomentId =
  | 'rival-undercuts'
  | 'wage-demand'
  | 'supplier-fails'
  | 'big-order'
  | 'equipment-breaks'
  | 'hand-in-the-till'

export interface BusinessMoment {
  readonly id: MomentId
  /** What arrives, in the words the owner would hear it in. */
  readonly question: string
  /** Every way out of it. Two or three, never more — this is a moment. */
  readonly options: readonly string[]
  /** True where it only makes sense if somebody works for you. */
  readonly needsStaff?: boolean
  /** True where it only makes sense if the trade actually holds stock. */
  readonly needsStock?: boolean
}

/**
 * THE MOMENTS THEMSELVES.
 *
 * Deliberately ordinary. None of these is a disaster or a windfall — they
 * are the weeks that make up running something, and the reason a shop is
 * interesting is that they keep coming.
 */
export const BUSINESS_MOMENTS: readonly BusinessMoment[] = [
  {
    id: 'rival-undercuts',
    question:
      'Somebody has opened up down the road doing what you do, and they have gone in cheaper than you. Your {customers} have noticed.',
    options: ['match-them', 'hold-your-price', 'put-the-word-out'],
  },
  {
    id: 'wage-demand',
    question:
      'Your best hand has been offered more elsewhere and has come to you before taking it. They would rather stay.',
    options: ['pay-them-more', 'let-them-walk'],
    needsStaff: true,
  },
  {
    id: 'supplier-fails',
    question:
      'Your {supplier} has gone under. The last invoice is unpaid and there is no {stock} coming this month.',
    options: ['find-another', 'pay-the-premium'],
  },
  {
    id: 'big-order',
    question:
      'A contract has come in far larger than anything you normally take. It would clear out {store} and it would not wait.',
    options: ['take-it', 'turn-it-down'],
    needsStock: true,
  },
  {
    id: 'equipment-breaks',
    question:
      'The thing the whole place runs on has failed. It can be patched, or properly replaced, or nursed along and hoped over.',
    options: ['repair-it', 'replace-it', 'nurse-it-along'],
  },
  {
    id: 'hand-in-the-till',
    question:
      'The takings have not matched the book for three months. It is one of your own, and you know which one.',
    options: ['have-it-out', 'let-it-go'],
    needsStaff: true,
  },
]

export function businessMomentById(id: string): BusinessMoment | undefined {
  return BUSINESS_MOMENTS.find((moment) => moment.id === id)
}

/**
 * WHICH MOMENTS COULD LAND ON THIS BUSINESS RIGHT NOW.
 *
 * A wage demand needs somebody to make it, and a contract that would clear
 * the shelf needs a shelf. Filtering here rather than at the raise site
 * keeps the conditions beside the content they belong to.
 */
export function businessMomentsFor(ops: BusinessOps | undefined, staff: number): readonly BusinessMoment[] {
  return BUSINESS_MOMENTS.filter((moment) => {
    if (moment.needsStaff === true && staff <= 0) return false
    if (moment.needsStock === true && (ops?.stockCents ?? 0) <= 0) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// What each answer is worth
// ---------------------------------------------------------------------------

/** A raise that keeps somebody, per-mille on their wage. */
export const RAISE_PER_MILLE = 120
/** What a rival's price war costs you if you match it, per-mille of markup. */
export const MATCH_PRICE_STEP = 100
/** What putting the word out costs, per-mille of the capital in the business. */
export const ADVERT_COST_PER_MILLE = 50
/** What a failed supplier's replacement charges over the going rate. */
export const PREMIUM_RATE_PER_MILLE = 1080
/** What a big contract pays, per-mille of the stock it consumes. */
export const BIG_ORDER_PER_MILLE = 1750
/** A patch, and a proper replacement, as a share of the capital in it. */
export const REPAIR_COST_PER_MILLE = 80
export const REPLACE_COST_PER_MILLE = 220
/** What nursing it along spoils, per-mille of the shelf. */
export const NURSE_SPOILS_PER_MILLE = 250
/** What a thief has already had, per-mille of the capital, and what confronting recovers. */
export const THEFT_PER_MILLE = 60
export const RECOVERED_PER_MILLE = 500
