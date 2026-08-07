/**
 * BANKRUPTCY (M-SAFETY §2), and the end of the arrears trap.
 *
 * WHAT THIS REPLACES, and it is worth naming because it was mine: the last
 * build capped runaway arrears by simply WRITING THEM OFF after two years.
 * That stopped the number being absurd and left the mechanism dishonest —
 * debt does not evaporate on a timer, and a silent reset is not a recovery
 * path, it is a hack wearing one. The owner's instruction was explicit:
 * overrule it, and build the real thing.
 *
 * OVERRIDES A STANDING RULE, on the owner's written authority: the Law-7
 * write-off is gone, and with it the assumption that this world has no
 * safety net. Both were load-bearing for the old arrears model. Everything
 * else in the charter stands.
 *
 * WHAT IT IS INSTEAD. Insolvency is now RESOLVED THROUGH A SYSTEM, always,
 * and the system is modelled on the structure of United States bankruptcy
 * law — public law, and fine to model. Every name in it is generic.
 *
 *   CHAPTER 13 — reorganisation, for somebody who still has income. A court
 *   approves a plan of three to five years. They keep the home and the
 *   basics, catch up on a schedule, and what remains at the end is
 *   resolved. The file carries it for seven years.
 *
 *   CHAPTER 7 — liquidation, for somebody with little or no income, and
 *   means-tested against the town's own median. What is not exempt is sold,
 *   most unsecured debt is discharged, and it is a genuine fresh start at
 *   zero. The file carries it for ten, and it cannot be filed again for
 *   eight.
 *
 * Both put an AUTOMATIC STAY over repossession and forced moves while they
 * run. Both are a public record — the county's, and the paper's.
 *
 * THE CREDIT EFFECT MIRRORS THE CRIMINAL RECORD (C3 §5), deliberately: a
 * filing is a DOOR, not a punishment. It shuts hard, it stays shut for
 * years, and then it opens again — which is the only reason modelling it is
 * worth doing at all.
 *
 * Pure reads and pure arithmetic; finances.ts moves the money.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { totalDebtOf } from './credit.js'
import type { Accounts, Bankruptcy, BankruptcyChapter, World } from './types.js'

/** How long each chapter sits on the file, and how long before a refiling. */
export const CHAPTER_7_FILE_YEARS = 10
export const CHAPTER_13_FILE_YEARS = 7
export const CHAPTER_7_REFILE_YEARS = 8
export const CHAPTER_13_REFILE_YEARS = 2

/** A chapter 13 plan runs three to five years. Five is the long, hard one. */
export const PLAN_MONTHS_MIN = 36
export const PLAN_MONTHS_MAX = 60

/**
 * WHAT A FILING PROTECTS. A homestead allowance and essential property come
 * through chapter 7 untouched — nobody is stripped to nothing, which is
 * true of the real thing and is what makes it a fresh start rather than an
 * execution.
 */
export const HOMESTEAD_EXEMPTION = 312_500 as Money
export const PROPERTY_EXEMPTION = 50_000 as Money

/** Everything ever filed by this person, oldest first. */
export function filingsOf(world: World, personId: EntityId): readonly Bankruptcy[] {
  return world.bankruptcies.get(personId) ?? []
}

/** The one still running, if any: a plan not yet finished. */
export function openFilingOf(world: World, personId: EntityId): Bankruptcy | undefined {
  return filingsOf(world, personId).find(
    (filing) => filing.dischargedAtTick === null && filing.planEndsAtTick !== null,
  )
}

/**
 * THE AUTOMATIC STAY. While a filing is running, nothing may be repossessed
 * and nobody may be pushed out of their home over money.
 */
export function underStay(world: World, personId: EntityId, tick: Tick): boolean {
  const open = openFilingOf(world, personId)
  return open !== undefined && (open.planEndsAtTick ?? 0) > tick
}

/** Years since the most recent filing, or null if there has never been one. */
export function yearsSinceFiling(world: World, personId: EntityId, tick: Tick): number | null {
  const filings = filingsOf(world, personId)
  const last = filings[filings.length - 1]
  if (!last) return null
  return Math.floor((tick - last.filedAtTick) / TICKS_PER_YEAR)
}

/**
 * What the file still says. Zero once it has aged off, which is the door
 * opening again.
 */
export function creditPenaltyOf(world: World, personId: EntityId, tick: Tick): number {
  let worst = 0
  for (const filing of filingsOf(world, personId)) {
    const years = Math.floor((tick - filing.filedAtTick) / TICKS_PER_YEAR)
    const carries = filing.chapter === 7 ? CHAPTER_7_FILE_YEARS : CHAPTER_13_FILE_YEARS
    if (years >= carries) continue
    // Heavy at first and fading over the years it is carried, so paying
    // steadily afterwards visibly buys the file back.
    const full = filing.chapter === 7 ? 240 : 170
    const left = Math.max(0, carries - years)
    worst = Math.max(worst, Math.ceil((full * left) / carries))
  }
  return worst
}

/** Why they cannot file today, or null when they can. */
export function refilingBar(
  world: World,
  personId: EntityId,
  chapter: BankruptcyChapter,
  tick: Tick,
): string | null {
  for (const filing of filingsOf(world, personId)) {
    const years = Math.floor((tick - filing.filedAtTick) / TICKS_PER_YEAR)
    const wait = filing.chapter === 7 ? CHAPTER_7_REFILE_YEARS : CHAPTER_13_REFILE_YEARS
    if (years < wait) {
      return `You filed ${years === 0 ? 'this year' : `${String(years)} years ago`}. The court will not hear another for ${String(wait - years)} more.`
    }
  }
  void chapter
  return null
}

/**
 * THE MEANS TEST, on DISPOSABLE income — what is left after the month, not
 * what came in.
 *
 * MEASURED, and the first version was wrong in a way that showed up
 * immediately: testing gross household income against the town median put
 * every insolvent household onto a repayment plan, including the ones with
 * nothing whatever to pay a plan from. 460 plans were dismissed against 31
 * completed. A plan somebody cannot keep is not a plan.
 *
 * Disposable income is the number the real test turns on too, and it sorts
 * the two chapters the way they are meant to sort: nothing left over at the
 * end of the month means liquidation, something left over means a plan.
 */
export function medianMonthlyIncome(incomes: readonly number[]): number {
  if (incomes.length === 0) return 0
  const sorted = [...incomes].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return Math.floor(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
}

export function passesMeansTest(disposable: number, townMedianDisposable: number): boolean {
  // Nothing left at the end of the month: there is no plan to be made, and
  // liquidation is the only honest answer.
  if (disposable <= 0) return true
  return disposable * 2 <= townMedianDisposable
}

/**
 * WHICH CHAPTERS ARE OPEN TO THIS PERSON.
 *
 * Chapter 13 needs something left at the end of the month — there is no
 * plan to approve without it. Chapter 7 needs the means test. Somebody with
 * nothing gets the fresh start; somebody comfortable gets the plan; and the
 * ordinary case in the middle is offered both and has to choose, which is
 * the interesting one.
 */
export function chaptersOpenTo(
  world: World,
  personId: EntityId,
  disposable: number,
  townMedianDisposable: number,
  tick: Tick,
): readonly BankruptcyChapter[] {
  const open: BankruptcyChapter[] = []
  if (
    passesMeansTest(disposable, townMedianDisposable) &&
    refilingBar(world, personId, 7, tick) === null
  ) {
    open.push(7)
  }
  if (disposable > 0 && refilingBar(world, personId, 13, tick) === null) open.push(13)
  return open
}

/**
 * The monthly payment a plan would demand: what is owed, spread over its
 * term, but never more than a third of what they bring in — a plan the
 * court would not approve is not a plan, it is a second bankruptcy.
 */
export function planPaymentFor(owed: Money, disposable: number, months: number): Money {
  if (owed <= 0 || months <= 0) return 0 as Money
  const even = Math.ceil(owed / months)
  // Two thirds of what is genuinely spare, never more. The other third is
  // what stops the plan being the thing that breaks them.
  const affordable = Math.floor((Math.max(0, disposable) * 2) / 3)
  return Math.max(1, Math.min(even, Math.max(1, affordable))) as Money
}

/**
 * How long the plan runs. Enough months to clear it at what they can afford,
 * bounded to the three-to-five-year range a court will approve.
 */
export function planMonthsFor(owed: Money, disposable: number): number {
  const affordable = Math.max(1, Math.floor((Math.max(0, disposable) * 2) / 3))
  const needed = Math.ceil(owed / affordable)
  return Math.max(PLAN_MONTHS_MIN, Math.min(PLAN_MONTHS_MAX, needed))
}

/**
 * EVERYTHING THIS PERSON OWES — their loans plus their share of the roof's
 * arrears. Both are resolved by a filing, because both are what actually
 * has them.
 */
export function totalOwedBy(accounts: Accounts, householdArrears: Money): Money {
  return (totalDebtOf(accounts.loans) + Math.max(0, -householdArrears)) as Money
}

/**
 * WHAT ACTUALLY MAKES SOMEBODY INSOLVENT — which is not the same as what
 * they owe.
 *
 * Owner, playing: *"whenever you put a mortgage on a house it automatically
 * makes you bankrupt... a mortgage shouldn't trigger that unless you're
 * behind on payments."* He is right, and the bug was as blunt as it sounds:
 * insolvency compared TOTAL DEBT against six months of income, and a
 * mortgage principal is years of income by construction. Signing for a
 * house — the single most normal financial act in the game — declared you
 * insolvent the same month, every time.
 *
 * A MORTGAGE IS SECURED AGAINST A HOUSE YOU OWN. Owing two hundred thousand
 * on a home worth two hundred thousand is not distress; it is a Tuesday.
 * What is distress is being BEHIND on it, and the loan already records
 * exactly that in `missedMonths`. So the payments you have missed count and
 * the principal does not.
 *
 * Unsecured debt still counts in full, because there is nothing standing
 * behind it. An auto loan is secured too, in fairness, but a car is worth
 * less every month it is driven and the model does not track its value —
 * counting it whole is the conservative reading, and it is left as one
 * deliberately rather than by oversight.
 */
export function distressDebtOf(accounts: Accounts, householdArrears: Money): Money {
  let total = Math.max(0, -householdArrears)
  for (const loan of accounts.loans) {
    if (loan.kind === 'mortgage') {
      total += loan.missedMonths * loan.monthlyPayment
      continue
    }
    total += loan.balance
  }
  return total as Money
}

/**
 * WHEN A FILING BECOMES THE ONLY HONEST ANSWER.
 *
 * Not a fixed number of dollars — a number of MONTHS of their own income.
 * Somebody who owes four years of everything they earn is not going to pay
 * it, and pretending otherwise is what produced the −$606,276.
 */
export const INSOLVENT_MONTHS_OF_INCOME = 6

export function isInsolvent(owed: Money, monthlyIncome: Money, monthlyCosts: Money): boolean {
  if (owed <= 0) return false
  // No income at all and a real debt: insolvent by definition, because
  // there is no month in any future that reduces it.
  if (monthlyIncome <= 0) return owed > monthlyCosts
  return owed > monthlyIncome * INSOLVENT_MONTHS_OF_INCOME
}

/** In words, for a screen and for the paper. */
/**
 * ADR-0038, owner: "there is still no way to payoff your bankruptcy."
 *
 * He is right, and the gap was bigger than the missing button. A chapter 13
 * plan was ENTIRELY INVISIBLE once it started: no screen said what the
 * payment was, how many months were left, or what the court was holding.
 * The money simply left the account every month for three to five years and
 * the only way out was to wait — or to fall far enough behind that the plan
 * was dismissed, which is the bad ending.
 *
 * A real plan can be paid off early — pay the plan base and the court
 * discharges you. That is the recovery Law 7 asks for, and it is the one
 * thing a player who has clawed their way back to money should be able to
 * spend it on.
 */

/** Months still to run on this plan, or 0 when it is not running. */
export function planMonthsLeft(filing: Bankruptcy | undefined, tick: Tick): number {
  if (!filing || filing.dischargedAtTick !== null || filing.planEndsAtTick === null) return 0
  return Math.max(0, filing.planEndsAtTick - tick)
}

/**
 * WHAT IT COSTS TO WALK OUT TODAY: every remaining scheduled payment.
 *
 * Not the whole of `owed` — the plan base is what the court asked for, and
 * the months already paid were paid. Paying the rest is settling the plan,
 * not the original debt, which is exactly what an early payoff is.
 */
export function planPayoffFor(filing: Bankruptcy | undefined, tick: Tick): Money {
  if (!filing) return 0 as Money
  return (filing.planMonthly * planMonthsLeft(filing, tick)) as Money
}

/**
 * Why the plan cannot be settled today, or null when it can.
 *
 * The bar pattern: the Bank's button and the verb's refusal read this one
 * function, so a greyed row and an honest "no" cannot disagree.
 */
export function planPayoffBar(
  filing: Bankruptcy | undefined,
  cash: Money,
  tick: Tick,
): string | null {
  if (!filing) return 'No plan is running.'
  // THE CHAPTER COMES FIRST. A chapter 7 is discharged at filing, so the
  // discharged check below is true of it — and "no plan is running" is a
  // true sentence that explains nothing. Say which filing it was.
  if (filing.chapter === 7) {
    return 'Chapter 7 discharged at filing. There is no plan to pay off.'
  }
  if (filing.dischargedAtTick !== null) return 'No plan is running.'
  const due = planPayoffFor(filing, tick)
  if (due <= 0) return 'The plan has run its term. The discharge is due anyway.'
  if (cash < due) {
    return `Settling the plan costs ${String(Math.ceil(due / 100))} dollars; you have ${String(Math.floor(cash / 100))}.`
  }
  return null
}

export function chapterWords(chapter: BankruptcyChapter): string {
  return chapter === 7 ? 'a liquidation' : 'a repayment plan'
}

export function chapterTitle(chapter: BankruptcyChapter): string {
  return chapter === 7 ? 'Chapter 7 — liquidation' : 'Chapter 13 — repayment plan'
}
