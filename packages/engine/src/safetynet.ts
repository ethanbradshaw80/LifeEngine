/**
 * THE FLOORS UNDER A LIFE (M-SAFETY §4).
 *
 * WHY THIS EXISTS. Playing the economy build turned up two facts that were
 * not design decisions, they were absences:
 *
 *   - There was no state pension, so EVERY non-veteran retirement ended in
 *     destitution. A man who retired at 66 with $134,703 put by was broke
 *     inside eight years, which made "retire or keep working" a trap rather
 *     than a choice.
 *   - There was no floor of any kind under a household that stopped
 *     earning, so arrears free-fell. One reached −$606,276 over
 *     seventy-nine months with no month in any future that could clear it.
 *
 * Real economies do not let people free-fall, and a simulation that does is
 * not being harsh, it is being wrong (Law 10). Three floors, and they are
 * what makes an unrecoverable spiral impossible:
 *
 *   THE STATE PENSION — a modest monthly income from retirement age for
 *   anyone with a work history, scaling with the months they worked.
 *   UNEMPLOYMENT INSURANCE — a share of the last wage, for a bounded number
 *   of months, and only after a LAYOFF. Being sacked for cause does not
 *   qualify, and neither does walking out.
 *   PUBLIC ASSISTANCE — a bare income floor for an adult with almost
 *   nothing coming in, whatever the reason.
 *
 * NAMES ARE GENERIC AND FICTIONAL, deliberately (charter §3). This world
 * models the STRUCTURE of a safety net — which is public policy, and fine
 * to model — and borrows no trademarked program name or restricted dataset.
 *
 * FUNDING: these are paid for out of the income tax already withheld at
 * source in tax.ts. The world does not run a separate government budget, so
 * there is no fund to run dry — that would be a government module, and this
 * is not one. What is modelled is what reaches a person.
 *
 * Pure reads and pure arithmetic. finances.ts remains the single writer of
 * money; this says only what a person is owed.
 */

import type { Money, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { atTodaysPrices } from './economy.js'
import type { Accounts, Person, World } from './types.js'

/** The age the state pension starts. The same age the retirement moment uses. */
export const STATE_PENSION_AGE = 65

/**
 * What the pension is worth, in BASE-YEAR cents, before the price level is
 * applied. A floor everybody with a working life gets, plus a slice for the
 * years actually worked, capped.
 *
 * MEASURED against the living costs in content.ts rather than picked: an
 * adult's living costs are the number a pension has to be read against, and
 * a full career lands a pension a little above them. A short working life
 * lands below, and that difference is the whole point — this is a floor,
 * not a wage.
 */
export const STATE_PENSION_FLOOR = 11_250 as Money
export const STATE_PENSION_PER_YEAR_WORKED = 425
export const STATE_PENSION_MAX_YEARS = 40

/**
 * The state pension, monthly, at today's prices.
 *
 * Zero for anybody who never worked: this is an earned floor, and the
 * unearned one is public assistance below.
 */
export function statePensionOf(world: World, person: Person, accounts: Accounts, tick: Tick): Money {
  if (person.deathTick !== null) return 0 as Money
  if (ageAt(person.birthTick, tick) < STATE_PENSION_AGE) return 0 as Money
  const years = Math.min(STATE_PENSION_MAX_YEARS, Math.floor(accounts.monthsWorked / 12))
  if (years < 1) return 0 as Money
  const base = STATE_PENSION_FLOOR + years * STATE_PENSION_PER_YEAR_WORKED
  return atTodaysPrices(world, base as Money) as Money
}

/** How long unemployment insurance runs, and what share of the last wage. */
export const UNEMPLOYMENT_MONTHS = 6
export const UNEMPLOYMENT_PER_MILLE = 450

/**
 * Unemployment insurance, monthly.
 *
 * A share of what they were earning, for a bounded stretch, and only while
 * they are genuinely out of work — take a job and it stops, which is the
 * shape of the real thing and the reason it does not become a wage.
 */
export function unemploymentOf(world: World, personId: number, accounts: Accounts, tick: Tick): Money {
  if (accounts.unemploymentUntilTick === null) return 0 as Money
  if (tick >= accounts.unemploymentUntilTick) return 0 as Money
  if (world.employment.has(personId as never)) return 0 as Money
  return Math.floor((accounts.lastMonthlyPay * UNEMPLOYMENT_PER_MILLE) / 1000) as Money
}

/**
 * The floor under everybody else, in base-year cents.
 *
 * Deliberately bare — enough that a household cannot fall for ever, not
 * enough that anybody would choose it. It is what makes the −$606,276
 * spiral arithmetically impossible: below this line, money comes IN.
 */
export const ASSISTANCE_FLOOR = 7_750 as Money

/**
 * Public assistance, monthly: whatever it takes to bring an adult's own
 * income up to the floor, and nothing when they are already above it.
 *
 * `otherIncome` is everything else they have coming in this month, which the
 * caller has already worked out — this function does not reach back into
 * finances, because finances is what calls it.
 */
export function assistanceOf(world: World, person: Person, otherIncome: Money, tick: Tick): Money {
  if (person.deathTick !== null) return 0 as Money
  // Children are fed by the household they live in, not by the county.
  if (ageAt(person.birthTick, tick) < 18) return 0 as Money
  const floor = atTodaysPrices(world, ASSISTANCE_FLOOR)
  return Math.max(0, floor - otherIncome) as Money
}

/**
 * What a shelter costs to keep somebody alive in for a month, at today's
 * prices. A household with no roof still eats; this is the bare figure that
 * replaces rent and full living costs while they have nowhere.
 */
export const SHELTER_COST = 3_000 as Money

export function shelterCostFor(world: World): Money {
  return atTodaysPrices(world, SHELTER_COST) as Money
}

/** In words, for a screen. */
export function safetyNetWords(kind: 'pension' | 'unemployment' | 'assistance'): string {
  if (kind === 'pension') return 'the state pension'
  if (kind === 'unemployment') return 'unemployment insurance'
  return 'public assistance'
}
