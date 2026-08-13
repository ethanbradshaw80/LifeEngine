/**
 * DEBT, CREDIT AND HOMES (M-ECON §6).
 *
 * Pure arithmetic and pure reads. finances.ts moves the money; this says
 * what a loan costs, what a score is, and what a door opens to.
 *
 * THE PATTERN IT MIRRORS is the criminal-record gate (C3 §5): a score is not
 * a punishment, it is a DOOR, and the interesting thing about a door is that
 * it can be walked back through. A default shuts it for years and paying
 * steadily opens it again, which is the only reason a credit score is worth
 * modelling at all.
 */

import { formatMoney } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import type { Loan, LoanKind, World } from './types.js'

/** Where a life with no history starts. Not perfect, not bad. */
export const CREDIT_START = 650
export const CREDIT_MIN = 300
export const CREDIT_MAX = 850

/**
 * What each kind of borrowing is, and what it costs above the central
 * bank's rate. A mortgage is cheap because a house secures it; an unsecured
 * personal loan is dear because nothing does.
 */
export interface LoanTerms {
  readonly kind: LoanKind
  readonly title: string
  /** Added to the bank rate, in per-mille. */
  readonly spreadPerMille: number
  readonly months: number
  readonly minCredit: number
}

export const LOAN_TERMS: readonly LoanTerms[] = [
  { kind: 'personal', title: 'a personal loan', spreadPerMille: 95, months: 48, minCredit: 580 },
  { kind: 'auto', title: 'a car loan', spreadPerMille: 55, months: 60, minCredit: 560 },
  { kind: 'mortgage', title: 'a mortgage', spreadPerMille: 22, months: 360, minCredit: 620 },
  /**
   * A STUDENT LOAN, AND ITS MINIMUM CREDIT IS THE FLOOR OF THE SCALE.
   *
   * That is not an oversight. Every other product here is gated on a
   * score, and an eighteen-year-old has no file — gating this one the
   * same way would mean the poorest children in the town were the ones
   * who could not borrow to escape being poor, which is a dead end
   * (Law 7) dressed up as realism. Nobody is refused an education here
   * for want of a credit history.
   *
   * The price of that is on the other side: see the bankruptcy ruling in
   * finances.ts. It is cheap to get and very hard to be rid of.
   */
  { kind: 'student', title: 'a student loan', spreadPerMille: 40, months: 240, minCredit: CREDIT_MIN },
]

export function loanTermsFor(kind: LoanKind): LoanTerms | undefined {
  return LOAN_TERMS.find((t) => t.kind === kind)
}

/**
 * The rate this person is actually offered.
 *
 * The bank's rate, plus the product's spread, plus what the file says about
 * them — a poor score does not close every door, it makes them expensive,
 * which is how it works and is far more interesting than a refusal.
 */
export function offeredRatePerMille(world: World, credit: number, kind: LoanKind): number {
  const terms = loanTermsFor(kind)
  if (!terms) return 0
  const shortfall = Math.max(0, 720 - credit)
  const penalty = Math.floor(shortfall / 4)
  return world.economy.ratePerMille + terms.spreadPerMille + penalty
}

/**
 * A level monthly payment, in integer cents.
 *
 * Amortised the honest way — interest on the balance, the rest off the
 * principal — but the PAYMENT is computed once, from a series, so a loan
 * actually finishes. Integer throughout: the last payment carries whatever
 * the rounding left, which is what a real final statement does too.
 */
export function monthlyPaymentFor(principal: Money, annualRatePerMille: number, months: number): Money {
  if (principal <= 0 || months <= 0) return 0 as Money
  if (annualRatePerMille <= 0) return Math.ceil(principal / months) as Money

  // NO CLOSED FORM, DELIBERATELY. The textbook payment is
  // (P × r) / (1 − (1+r)^−n), and `Math.pow` is banned in this engine
  // because ECMAScript leaves its precision implementation-defined — the
  // same loan could amortise differently in two browsers, which is exactly
  // the class of bug determinism exists to prevent.
  //
  // So the payment is SEARCHED FOR instead, against an integer simulation
  // of the loan: the smallest whole-cent payment that clears the balance
  // within its term. Bisection over a bounded range, every step integer,
  // and the same answer on every machine forever.
  const owes = (payment: number): boolean => {
    let balance = principal as number
    for (let month = 0; month < months; month++) {
      balance += Math.floor((balance * annualRatePerMille) / 12_000)
      balance -= payment
      if (balance <= 0) return false
    }
    return balance > 0
  }

  // A payment of the whole principal always clears it; a payment of one
  // cent essentially never does. Bisect between them.
  let low = 1
  let high = Math.max(1, principal as number)
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2)
    if (owes(mid)) low = mid + 1
    else high = mid
  }
  return Math.max(1, low) as Money
}

/** What a person still owes, across every loan. */
export function totalDebtOf(loans: readonly Loan[]): Money {
  let total = 0
  for (const loan of loans) total += loan.balance
  return total as Money
}

/** What the house is worth minus what is owed on it. */
export function homeEquityOf(loans: readonly Loan[], homeValue: Money): Money {
  const mortgage = loans.find((l) => l.kind === 'mortgage')
  return Math.max(0, homeValue - (mortgage?.balance ?? 0)) as Money
}

/**
 * The score, DERIVED — never stored, so it cannot drift from the history
 * that justifies it (Law 3). Read from what actually happened: months paid
 * without missing, defaults on the record, and how much is owed.
 */
export function creditScoreOf(
  world: World,
  loans: readonly Loan[],
  defaults: number,
  monthsPaid: number,
  /** M-SAFETY §2: what a bankruptcy on the file still costs, and it fades. */
  filingPenalty = 0,
): number {
  void world
  let score = CREDIT_START
  // A record of paying is the thing that builds it, slowly.
  score += Math.min(140, Math.floor(monthsPaid / 3))
  // A default is the thing that breaks it, hard and for a long time.
  score -= defaults * 120
  // And carrying a lot, right now, costs some of it.
  const owed = totalDebtOf(loans)
  score -= Math.min(90, Math.floor(owed / 5_000_00))
  for (const loan of loans) if (loan.missedMonths > 0) score -= Math.min(80, loan.missedMonths * 25)
  // A filing is the heaviest single thing a file can carry, and it FADES —
  // the same door the criminal record uses (C3 §5). Shut hard, then open.
  score -= filingPenalty
  return Math.max(CREDIT_MIN, Math.min(CREDIT_MAX, score))
}

/** In words, for a screen. */
export function creditWords(score: number): string {
  if (score >= 780) return 'excellent'
  if (score >= 700) return 'good'
  if (score >= 620) return 'fair'
  if (score >= 550) return 'poor'
  return 'bad'
}

/**
 * What a home on this street costs to buy — a multiple of what it rents
 * for, which is how a housing market actually prices itself and means the
 * two move together with inflation without a second price list.
 */
export const HOME_PRICE_MONTHS_OF_RENT = 190

export function homePriceFor(monthlyRent: Money): Money {
  return (monthlyRent * HOME_PRICE_MONTHS_OF_RENT) as Money
}

/** The deposit a lender wants: a fifth, and no less. */
export function depositFor(price: Money, credit?: number): Money {
  // CREDIT-GATED (housing spec, Verdant layer): the file decides the down
  // payment the bank will accept, the same way it decides the rate. No
  // credit given (legacy callers) keeps the old flat fifth. The ladder is
  // deliberately gentle at the bottom — a thin young file reads ~450, and
  // asking a first-time buyer for a third of the house priced everybody
  // under thirty out of the market (owner feedback).
  const perMille = credit === undefined ? 200 : depositShareFor(credit)
  return Math.max(1, Math.ceil((price * perMille) / 1_000)) as Money
}

/** The down-payment share in per-mille, for a screen that wants to say "10%". */
export function depositShareFor(credit: number): number {
  return credit >= 700 ? 100 : credit >= 620 ? 150 : credit >= 540 ? 200 : 250
}

/** Why this loan is refused, or null when it is not. */
export function loanBar(
  world: World,
  kind: LoanKind,
  credit: number,
  loans: readonly Loan[],
  cash: Money,
  price: Money,
): string | null {
  const terms = loanTermsFor(kind)
  if (!terms) return 'The bank does not write that.'
  if (credit < terms.minCredit) {
    return `The file is not strong enough for ${terms.title} — ${String(terms.minCredit)} is the line, and yours reads ${String(credit)}.`
  }
  if (loans.some((l) => l.kind === kind)) return 'You already carry one of those.'
  if (kind === 'mortgage') {
    const deposit = depositFor(price, credit)
    if (cash < deposit) {
      return `The bank wants ${String(depositShareFor(credit) / 10)}% down on your file. That is ${formatMoney(deposit)}, and you have ${formatMoney(cash)}.`
    }
  }
  void world
  return null
}

/** Tick at which a loan taken now would be paid off. */
export function maturityOf(tick: Tick, kind: LoanKind): Tick {
  return (tick + (loanTermsFor(kind)?.months ?? 48)) as Tick
}
