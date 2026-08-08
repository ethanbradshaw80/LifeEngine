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
  { upTo: 175_000 as Money, perMille: 0 }, // first $14,000 — untaxed
  { upTo: 650_000 as Money, perMille: 120 }, // to $52,000 — 12%
  { upTo: 1_312_500 as Money, perMille: 220 }, // to $105,000 — 22%
  { upTo: 2_437_500 as Money, perMille: 320 }, // to $195,000 — 32%
  { upTo: null, perMille: 370 }, // above — 37%
]

/**
 * THE RATE THE BRACKETS ARE WRITTEN AT.
 *
 * The government's lever is one number for the whole schedule, and this
 * is what that number MEANS when nobody has moved it — the middle band's
 * 22%. Every bracket scales in proportion to it, so a government raising
 * taxes raises them across the board and keeps the shape progressive
 * rather than flattening it.
 */
export const BASELINE_INCOME_RATE = 220

/**
 * Income tax owed on a year's income. Marginal, band by band, floored per
 * band so the total is exact and never a float.
 *
 * `ratePerMille` is the government's lever (government plan §4, phase 2's
 * fourth). It defaults to the baseline so every existing caller and every
 * old save behaves exactly as before — the wiring changed nobody's bill
 * on the day it landed, and only a government moving the number changes
 * what anybody pays.
 */
export function incomeTaxFor(
  annualIncome: Money,
  priceLevelPerMille = 1000,
  ratePerMille = BASELINE_INCOME_RATE,
): Money {
  if (annualIncome <= 0) return 0 as Money
  let owed = 0
  let floor = 0
  for (const bracket of INCOME_TAX_BRACKETS) {
    // BRACKETS ARE INDEXED, because real ones are. Without this the bands
    // are base-year money compared against nominal income, so 1970 pays no
    // tax at all and by 2100 a labourer is in the top band — bracket creep
    // of a kind no revenue service has ever allowed to run for a century.
    const ceiling =
      bracket.upTo === null
        ? annualIncome
        : ((Math.floor((bracket.upTo * priceLevelPerMille) / 1000)) as Money)
    if (annualIncome <= floor) break
    const inBand = Math.min(annualIncome, ceiling) - floor
    if (inBand > 0) {
      // SCALED IN PROPORTION, so raising taxes raises the whole schedule
      // and keeps its shape. Flattening every band to one rate would turn
      // a progressive system into a flat one the moment a government
      // touched it, which is not what a rate change is.
      const banded = Math.floor((bracket.perMille * ratePerMille) / BASELINE_INCOME_RATE)
      owed += Math.floor((inBand * banded) / 1000)
    }
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
export function withholdingFor(
  monthlyPay: Money,
  priceLevelPerMille = 1000,
  ratePerMille = BASELINE_INCOME_RATE,
): Money {
  if (monthlyPay <= 0) return 0 as Money
  const annualised = (monthlyPay * 12) as Money
  return Math.floor(incomeTaxFor(annualised, priceLevelPerMille, ratePerMille) / 12) as Money
}

/** The marginal band a year's income sits in, for the screen. */
export function marginalRatePerMille(annualIncome: Money, priceLevelPerMille = 1000): number {
  let floor = 0
  for (const bracket of INCOME_TAX_BRACKETS) {
    const ceiling =
      bracket.upTo === null
        ? null
        : ((Math.floor((bracket.upTo * priceLevelPerMille) / 1000)) as Money)
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
export const ESTATE_TAX_EXEMPTION = 6_250_000 as Money // $500,000
export const ESTATE_TAX_PER_MILLE = 400

export function estateTaxOn(estate: Money, priceLevelPerMille = 1000): Money {
  if (estate <= ESTATE_TAX_EXEMPTION) return 0 as Money
  const exemption = Math.floor((ESTATE_TAX_EXEMPTION * priceLevelPerMille) / 1000)
  if (estate <= exemption) return 0 as Money
  return Math.floor(((estate - exemption) * ESTATE_TAX_PER_MILLE) / 1000) as Money
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
