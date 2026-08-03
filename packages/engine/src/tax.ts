/**
 * TAX AND INTEREST (M-ECON §2, §3).
 *
 * Pure arithmetic on integer cents. Nothing here reads the world or draws;
 * it says what a sum of money owes and what a balance earns, and finances.ts
 * — the single writer — moves the money.
 *
 * WHY WITHHOLDING RATHER THAN A YEARLY BILL: pay should arrive already
 * smaller, because that is what a wage feels like. The yearly return then
 * settles the difference, which is the only moment tax is a decision rather
 * than a fact, and the only moment it is worth a screen.
 */

import type { Money } from '@life-engine/shared'

/**
 * Progressive brackets, on ANNUAL income, in integer cents.
 *
 * Fictional rates for a fictional republic, shaped like a real progressive
 * schedule: a floor nobody pays on, then bands that bite harder. Calibrated
 * against the salary ladder of §7 — a labourer keeps most of it, a doctor
 * loses about a third.
 *
 * `upTo` is the top of the band; the last has none.
 */
export interface TaxBracket {
  readonly upTo: Money | null
  /** Rate in per-mille, so the arithmetic stays integer. */
  readonly perMille: number
}

export const INCOME_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 1_400_000 as Money, perMille: 0 }, // first $14,000 — untaxed
  { upTo: 5_200_000 as Money, perMille: 120 }, // to $52,000 — 12%
  { upTo: 10_500_000 as Money, perMille: 220 }, // to $105,000 — 22%
  { upTo: 19_500_000 as Money, perMille: 320 }, // to $195,000 — 32%
  { upTo: null, perMille: 370 }, // above — 37%
]

/**
 * Income tax owed on a year's income. Marginal, band by band, floored per
 * band so the total is exact and never a float.
 */
export function incomeTaxFor(annualIncome: Money): Money {
  if (annualIncome <= 0) return 0 as Money
  let owed = 0
  let floor = 0
  for (const bracket of INCOME_TAX_BRACKETS) {
    const ceiling = bracket.upTo ?? annualIncome
    if (annualIncome <= floor) break
    const inBand = Math.min(annualIncome, ceiling) - floor
    if (inBand > 0) owed += Math.floor((inBand * bracket.perMille) / 1000)
    floor = ceiling
    if (bracket.upTo === null) break
  }
  return owed as Money
}

/**
 * What comes out of one month's pay.
 *
 * The withholding table is the year's tax on twelve times this month,
 * divided back by twelve — which is exactly how a payroll office does it,
 * and why a year of steady pay lands close to square while a year with a
 * raise or a spell out of work does not. That gap is the refund or the bill.
 */
export function withholdingFor(monthlyPay: Money): Money {
  if (monthlyPay <= 0) return 0 as Money
  const annualised = (monthlyPay * 12) as Money
  return Math.floor(incomeTaxFor(annualised) / 12) as Money
}

/** The marginal band a year's income sits in, for the screen. */
export function marginalRatePerMille(annualIncome: Money): number {
  let floor = 0
  for (const bracket of INCOME_TAX_BRACKETS) {
    const ceiling = bracket.upTo
    if (ceiling === null || annualIncome <= ceiling) return bracket.perMille
    floor = ceiling
  }
  void floor
  return INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1]?.perMille ?? 0
}

/**
 * SALES TAX, on what a household actually spends on itself.
 *
 * Not on rent or on food-and-warmth — the necessities a household cannot
 * choose not to buy — because a sales tax that falls on those is a
 * different and much crueller instrument, and this world does not model the
 * exemptions that make it bearable.
 */
export const SALES_TAX_PER_MILLE = 70

export function salesTaxOn(spending: Money): Money {
  if (spending <= 0) return 0 as Money
  return Math.floor((spending * SALES_TAX_PER_MILLE) / 1000) as Money
}

/**
 * ESTATE TAX, on what passes to the heirs.
 *
 * An exemption large enough that an ordinary life passes whole — the tax
 * exists to be felt by a fortune, not by a family home's worth of savings.
 */
export const ESTATE_TAX_EXEMPTION = 50_000_000 as Money // $500,000
export const ESTATE_TAX_PER_MILLE = 400

export function estateTaxOn(estate: Money): Money {
  if (estate <= ESTATE_TAX_EXEMPTION) return 0 as Money
  return Math.floor(((estate - ESTATE_TAX_EXEMPTION) * ESTATE_TAX_PER_MILLE) / 1000) as Money
}

/**
 * CAPITAL GAINS, on what a sale actually made.
 *
 * Flatter and lower than income tax, which is both how these are usually
 * written and what makes the risk worth taking at all.
 */
export const CAPITAL_GAINS_PER_MILLE = 180

export function capitalGainsTaxOn(gain: Money): Money {
  if (gain <= 0) return 0 as Money
  return Math.floor((gain * CAPITAL_GAINS_PER_MILLE) / 1000) as Money
}

/**
 * SAVINGS INTEREST, monthly, at an annual rate given in per-mille.
 *
 * The rate is the economy's, and the central bank moves it (§4). Until that
 * exists this is the base rate and it does not move. Floored, so a balance
 * too small to earn a cent earns nothing rather than rounding one into
 * existence.
 */
export const BASE_SAVINGS_RATE_PER_MILLE = 35

export function monthlyInterestOn(balance: Money, annualRatePerMille: number): Money {
  if (balance <= 0 || annualRatePerMille <= 0) return 0 as Money
  return Math.floor((balance * annualRatePerMille) / (1000 * 12)) as Money
}
