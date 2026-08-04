/**
 * WORKING FOR YOURSELF (M-CAREER §5).
 *
 * The ladder is somebody else's ladder. This is the other road: put up
 * capital, take the risk, and keep what is left — the civilian path to real
 * wealth, and the one that can genuinely fail.
 *
 * ONE SYSTEM AT TWO SCALES, deliberately. A side gig is not a different
 * mechanism from a business; it is a business with almost no capital in it,
 * run in the evenings, that will never employ anybody. Modelling them
 * separately would be two things that behave the same.
 *
 * WHAT MAKES IT REAL RATHER THAN A SECOND WAGE:
 *
 *   - The capital is REAL money, out of savings or a loan, and it is gone.
 *   - The economy is felt directly. A boom is worth more to an owner than
 *     to anybody on a salary; a slump can close the doors.
 *   - It can FAIL, and failing costs the capital and the income at once.
 *   - It PASSES DOWN. A business is the only thing in this world that keeps
 *     earning for somebody who did not build it.
 *
 * Pure content and pure arithmetic. finances moves the money.
 */

import type { Money } from '@life-engine/shared'
import type { Business, EconomyPhase } from './types.js'

export interface BusinessKind {
  readonly id: string
  readonly title: string
  /** What it takes to open the doors, in base-year cents. */
  readonly capital: Money
  /**
   * What it returns in a good month, in per-mille of the capital in it.
   * Small trades return a lot on very little; a real shop returns less on
   * far more, and the absolute numbers are the other way round.
   */
  readonly returnPerMille: number
  /** How hard the cycle hits it, per-mille. A trade rides out what a shop cannot. */
  readonly exposure: number
  /** Zero for a one-person trade. */
  readonly maxEmployees: number
}

export const BUSINESS_KINDS: readonly BusinessKind[] = [
  {
    id: 'freelance',
    title: 'freelance work',
    capital: 40_000 as Money,
    returnPerMille: 900,
    exposure: 500,
    maxEmployees: 0,
  },
  {
    id: 'market-stall',
    title: 'a market stall',
    capital: 250_000 as Money,
    returnPerMille: 420,
    exposure: 700,
    maxEmployees: 1,
  },
  {
    id: 'workshop',
    title: 'a workshop',
    capital: 900_000 as Money,
    returnPerMille: 260,
    exposure: 850,
    maxEmployees: 3,
  },
  {
    id: 'shop',
    title: 'a shop on the square',
    capital: 2_600_000 as Money,
    returnPerMille: 180,
    exposure: 1000,
    maxEmployees: 6,
  },
  {
    id: 'contracting-firm',
    title: 'a contracting firm',
    capital: 6_500_000 as Money,
    returnPerMille: 150,
    exposure: 1200,
    maxEmployees: 14,
  },
]

export function businessKindById(id: string): BusinessKind | undefined {
  return BUSINESS_KINDS.find((kind) => kind.id === id)
}

/** Months in the red before the doors shut. */
export const BUSINESS_FAILS_AFTER = 3

/**
 * HOW BIG ONE TRADE CAN GET, as a multiple of what it took to open.
 *
 * MEASURED, and it was a runaway: retained profit grew the capital, bigger
 * capital returned more profit, and a hundred-year town ended with somebody
 * holding $386 BILLION. A market stall compounding at 42 per cent a year
 * for a century is not a market stall.
 *
 * Past this ceiling the profit is all DRAWN rather than retained. There is
 * only so much capital one shop can absorb — beyond it you are running a
 * different kind of business, which is what the larger kinds are for.
 */
export const CAPITAL_CEILING_MULTIPLE = 4

/**
 * WHAT THE MONTH RETURNED, in cents. Can be negative, which is the point.
 *
 * The kind's own return on the capital in it, moved by the cycle through
 * its exposure and by how well the owner runs it. A boom is worth far more
 * to an owner than a salary is to anybody; a depression is worth far less
 * than nothing.
 */
export function monthlyProfitFor(
  business: Business,
  kind: BusinessKind,
  phase: EconomyPhase,
  growthPerMille: number,
  diligence: number,
  swing: number,
): Money {
  const base = Math.floor((business.capital * kind.returnPerMille) / 1000 / 12)
  // The cycle, through this trade's exposure to it.
  const weather = Math.floor((growthPerMille * kind.exposure) / 1000)
  const slump = phase === 'depression' ? -90 : phase === 'recession' ? -45 : 0
  // How well it is run: -100 to +100 per-mille on the base.
  const hand = Math.floor((diligence - 500) / 5)
  //
  // The multiplier can go NEGATIVE, and that is the whole difference from a
  // wage: a bad month costs you rather than paying you less. Floored at
  // -1500 per-mille so a single month cannot swallow a business whole —
  // three of them in a row closes it, which is the mechanism that does.
  //
  // MEASURED, and the first setting never let anybody fail: at a base of
  // 1000 with a +/-260 swing the multiplier practically could not go
  // negative, and three workshops run for thirty years all came through
  // trading with the capital seven to eleven times larger. A business that
  // cannot fail is a savings account with a story attached.
  //
  // Re-measured twice more. At a +/-380 swing the multiplier still could
  // not reach a losing month outside a deep slump: 72 businesses opened
  // across three towns and 67 were still trading, a 93 per cent survival
  // rate no small trade has ever had. At +/-980 the shape is right - 89
  // opened, 37 closed, 58 per cent surviving, and the ones that failed had
  // a median life of seventeen years rather than dying in their first
  // winter. The slump term still doubles, so failures cluster in the
  // downturns rather than falling on people at random.
  const perMille = Math.max(-1500, 880 + weather * 10 + slump * 2 + hand + swing)
  return Math.floor((base * perMille) / 1000) as Money
}

/** What an owner would clear a month, for a screen, before any of it is spent. */
export function employeeCostFor(business: Business, wage: Money): Money {
  return (business.employees * wage) as Money
}

/** Why they cannot open this today, or null when they can. */
export function businessBar(
  kind: BusinessKind | undefined,
  cash: Money,
  capitalNow: Money,
  alreadyOwns: boolean,
  age: number,
): string | null {
  if (!kind) return 'No such trade to go into.'
  if (age < 18) return 'Not yet eighteen.'
  if (alreadyOwns) return 'You already have one to run.'
  if (cash < capitalNow) {
    return `${sentenceCase(kind.title)} takes ${String(Math.floor(capitalNow / 100))} dollars to open, and you have ${String(Math.floor(cash / 100))}.`
  }
  return null
}

function sentenceCase(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/**
 * A NAME FOR IT. Fictional always (charter §3), and built from the owner's
 * own family name so a business that passes down still reads as theirs.
 */
export function businessNameFor(familyName: string, kindId: string, pick: number): string {
  const SHAPES: readonly string[] = [
    `${familyName} & Sons`,
    `${familyName} Brothers`,
    `The ${familyName} Company`,
    `${familyName} & Co.`,
    `${familyName}'s`,
  ]
  if (kindId === 'freelance') return `${familyName}, on their own account`
  return SHAPES[Math.abs(pick) % SHAPES.length] ?? `${familyName} & Co.`
}

/** In words, for a screen. */
export function businessHealthWords(business: Business): string {
  if (business.closedTick !== null) return 'closed'
  if (business.badMonths >= 2) return 'in trouble'
  if (business.badMonths === 1) return 'a bad month'
  return 'trading'
}
