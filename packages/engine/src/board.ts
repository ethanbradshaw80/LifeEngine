/**
 * THE BOARDROOM (owner, playing, 2026-08-14: "Never got any board memeber
 * moments eithers wild having any percentage of stock in a company, never
 * got board member moments when we sold off our own stake in the company
 * either").
 *
 * He was right twice over. The engine has known about board SEATS since the
 * cap table was built — `ROUNDS` marks which investors get one, and
 * `boardViewFor` asks whether they would back a decision — and none of that
 * ever reached the player as a moment. Owning a quarter of a listed company
 * did nothing at all. Selling down the company you founded did nothing at
 * all. A stake was a number that changed a valuation.
 *
 * A SEAT IS ONLY WORTH HAVING IF IT ASKS YOU SOMETHING. That is the whole
 * design: past a blocking stake the company stops being a line in a
 * portfolio and starts sending you decisions with money on both sides.
 *
 * Pure content and arithmetic — the shape of a moment, who is entitled to
 * one, and what each answer is worth. `finances.ts` raises them and moves
 * the money, because it owns the ledger (Law 12).
 */

import type { Money } from '@life-engine/shared'
import { BLOCKING_STAKE_PER_MILLE, CONTROL_STAKE_PER_MILLE } from './market.js'

/** What the board has put in front of you. */
export type BoardMatterId =
  | 'buyback'
  | 'dividend-cut'
  | 'merger'
  | 'chief-executive'
  | 'expansion'

export interface BoardMatter {
  readonly id: BoardMatterId
  /** What the papers say, in the words a shareholder would read. */
  readonly question: string
  /** The two ways to vote, as verbs. */
  readonly options: readonly [string, string]
  /**
   * What backing it does to the share price, per-mille, and what refusing
   * does. Both signed, and deliberately not mirror images: some proposals
   * are good ideas the market likes either way, and some are the board
   * helping itself.
   */
  readonly backedPerMille: number
  readonly refusedPerMille: number
  /**
   * True where a vote in favour CASHES YOU OUT — the company is bought and
   * every share becomes money at the offer.
   */
  readonly paysOut?: boolean
  /** What a buyer is paying over the market, per-mille. Merger only. */
  readonly offerPremiumPerMille?: number
}

/**
 * THE MATTERS A BOARD ACTUALLY PUTS TO A VOTE.
 *
 * Each one is a real trade rather than a right answer, which is the test
 * every one of these had to pass: if a choice is obviously correct it is
 * not a decision, it is a tax on clicking.
 */
export const BOARD_MATTERS: readonly BoardMatter[] = [
  {
    id: 'buyback',
    question:
      'The board wants to spend the year’s cash buying back its own shares rather than putting it into the business.',
    options: ['back-it', 'vote-against'],
    // Fewer shares about, so the price firms — and nothing was built.
    backedPerMille: 70,
    refusedPerMille: 15,
  },
  {
    id: 'dividend-cut',
    question:
      'The board wants to stop the dividend for a year and put the money into a new plant instead.',
    options: ['back-it', 'vote-against'],
    // The market likes the plant more than it liked the cheque.
    backedPerMille: 95,
    refusedPerMille: -20,
  },
  {
    id: 'merger',
    question:
      'A larger company has offered to buy the whole business at a premium. The board is split and wants the shareholders to decide.',
    options: ['take-the-offer', 'stay-independent'],
    backedPerMille: 0,
    // Turning down a bid disappoints everyone who was hoping for one.
    refusedPerMille: -60,
    paysOut: true,
    offerPremiumPerMille: 280,
  },
  {
    id: 'chief-executive',
    question:
      'The chief executive wants a package that would be the largest in the company’s history. They have had three good years and another firm is asking after them.',
    options: ['approve-it', 'refuse-it'],
    // Keeping a good one costs money; losing one costs more.
    backedPerMille: -25,
    refusedPerMille: -70,
  },
  {
    id: 'expansion',
    question:
      'The board wants to borrow heavily to open in three new states at once. It is faster than the company has ever moved.',
    options: ['back-it', 'vote-against'],
    // Debt cuts both ways, and the market knows it.
    backedPerMille: 120,
    refusedPerMille: 0,
  },
]

export function boardMatterById(id: string): BoardMatter | undefined {
  return BOARD_MATTERS.find((matter) => matter.id === id)
}

/**
 * IS THIS HOLDING BIG ENOUGH TO GET A SEAT?
 *
 * A blocking stake is the door. Below it you are a shareholder who receives
 * a dividend and an annual report; at or above it the company has to care
 * what you think, because you can stop things.
 */
export function hasBoardSeat(stakePerMille: number): boolean {
  return stakePerMille >= BLOCKING_STAKE_PER_MILLE
}

/**
 * DOES YOUR VOTE DECIDE IT?
 *
 * Past control the answer is simply yours. Below that you are one voice of
 * several, and the rest of the register votes its own way — modelled as a
 * threshold on the matter's own merits rather than a coin, so the same
 * board in the same year always does the same thing (Law 11).
 */
export function voteCarries(
  stakePerMille: number,
  backing: boolean,
  mood: number,
): boolean {
  if (stakePerMille >= CONTROL_STAKE_PER_MILLE) return true
  /**
   * THE REST OF THE ROOM. `mood` is a seeded per-mille reading of how the
   * other holders lean, and your stake is added to whichever side you took
   * — so a blocking stake genuinely tips close votes and cannot force one.
   */
  const others = backing ? mood : 1000 - mood
  return others + stakePerMille >= 500
}

/** What the shares are worth per unit after a matter is settled. */
export function priceAfter(price: number, movePerMille: number): number {
  return Math.max(1, Math.floor((price * (1000 + movePerMille)) / 1000))
}

/** What a bid pays for a holding worth this much at the market. */
export function offerFor(value: Money, premiumPerMille: number): Money {
  return Math.floor((value * (1000 + premiumPerMille)) / 1000) as Money
}
