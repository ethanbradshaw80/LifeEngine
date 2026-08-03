/**
 * Household finances. M-MONEY.
 *
 * One pot per roof. Every month: wages in, rent and living costs out. The
 * balance is the household's savings, and it is allowed to go negative —
 * arrears is a modelled state with consequences, not an error.
 *
 * OWNERSHIP (DOMAIN_MAP §2): this system is the only writer of
 * `household.savings`. Everything else — stakes text, relationship strain,
 * affordability gates — reads it.
 *
 * What money DOES here, so the stakes in every other decision bite:
 *
 *   - A household that cannot cover the month falls behind (event), and
 *     sustained arrears pushes a move somewhere cheaper — asked, if the
 *     player lives there; automatic otherwise.
 *   - Arrears strains a marriage (relationships reads `inArrears`).
 *   - Moving out and moving up are gated on genuinely affording the rent.
 *   - When the last member of a household dies, what is left passes to the
 *     deceased's living children — the first piece of generational legacy.
 *
 * All arithmetic is integer cents (ADR-0008). No floating point anywhere.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { LIVING_COST_ADULT, LIVING_COST_CHILD, rentFor } from './content.js'
import { ageAt, toDate } from './clock.js'
import { raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { atTodaysPrices } from './economy.js'
import {
  creditScoreOf,
  depositFor,
  homePriceFor,
  loanBar,
  loanTermsFor,
  maturityOf,
  monthlyPaymentFor,
  offeredRatePerMille,
  totalDebtOf,
} from './credit.js'
import { SECTORS, dividendOn, holdingValue, portfolioValue, unitsFor } from './market.js'
import { openStream, Stream } from './rng.js'
import {
  BASE_SAVINGS_RATE_PER_MILLE,
  estateTaxOn,
  incomeTaxFor,
  monthlyInterestOn,
  salesTaxOn,
  withholdingFor,
  capitalGainsTaxOn,
} from './tax.js'
import type { Accounts, Holding, Household, Loan, LoanKind, Person, World } from './types.js'
import { pensionOf, servicePayOf, survivorPensionOf } from './service.js'
import { placesOfKind } from './worldgen.js'

/** Months of arrears before a household is pushed toward cheaper rent. */
const ARREARS_PATIENCE_MONTHS = 4

/** An adult is a full mouth to feed from this age. */
const ADULT_COST_AGE = 16

// ---------------------------------------------------------------------------
// Queries — the read side other systems and the UI use
// ---------------------------------------------------------------------------

/**
 * ONE PERSON'S ACCOUNTS. Absent means zero — reading is total, so nothing
 * has to create an account before somebody is paid.
 */
export function accountsOf(world: World, personId: EntityId): Accounts {
  return (
    world.accounts.get(personId) ?? {
      personId,
      checking: 0 as Money,
      savings: 0 as Money,
      brokerage: 0 as Money,
      retirement: 0 as Money,
      taxableYtd: 0 as Money,
      withheldYtd: 0 as Money,
      holdings: [],
      retirementHoldings: [],
      loans: [],
      homePlaceId: null,
      homePurchasePrice: 0 as Money,
      monthsPaid: 0,
      defaults: 0,
    }
  )
}

/**
 * What the people under one roof hold between them — what a burglar would
 * find, and what a lawyer's fee can come out of. The household's own balance
 * is obligations, not wealth, so this is the honest answer to "can this
 * house afford it".
 */
export function householdWealth(world: World, household: Household): Money {
  let total = 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    total += netWorthOf(world, memberId)
  }
  return total as Money
}

/** Everything a person holds in money. Property and debt join it later. */
export function netWorthOf(world: World, personId: EntityId): Money {
  const a = accountsOf(world, personId)
  return (a.checking +
    a.savings +
    a.brokerage +
    a.retirement +
    portfolioValue(world, a.holdings) +
    portfolioValue(world, a.retirementHoldings) +
    homeValueOf(world, personId) -
    totalDebtOf(a.loans)) as Money
}

/**
 * M-ECON §6. What their home is worth TODAY — the purchase price carried
 * forward at the price level, so a house bought in 1975 is worth 1975's
 * money in today's terms rather than a figure frozen at the closing.
 */
export function homeValueOf(world: World, personId: EntityId): Money {
  const accounts = accountsOf(world, personId)
  if (accounts.homePlaceId === null) return 0 as Money
  const place = world.places.get(accounts.homePlaceId)
  if (!place) return 0 as Money
  return homePriceFor(rentAt(world, place.desirability))
}

/** The score, read from the history rather than stored beside it. */
export function creditOf(world: World, personId: EntityId): number {
  const a = accountsOf(world, personId)
  return creditScoreOf(world, a.loans, a.defaults, a.monthsPaid)
}

/**
 * M-ECON §6. TAKE A LOAN. The money lands in savings, the debt lands on the
 * file, and the rate is fixed at the month it was signed.
 */
export function takeLoan(
  world: World,
  tick: Tick,
  personId: EntityId,
  kind: LoanKind,
  principal: Money,
): boolean {
  if (principal <= 0) return false
  const accounts = accountsOf(world, personId)
  if (accounts.loans.some((l) => l.kind === kind)) return false
  const rate = offeredRatePerMille(world, creditOf(world, personId), kind)
  const months = loanTermsFor(kind)?.months ?? 48
  const loan: Loan = {
    kind,
    principal,
    balance: principal,
    ratePerMille: rate,
    monthlyPayment: monthlyPaymentFor(principal, rate, months),
    takenAtTick: tick,
    maturesAtTick: maturityOf(tick, kind),
    missedMonths: 0,
  }
  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings + principal) as Money,
    loans: [...accounts.loans, loan],
  })
  recordEvent(world, tick, {
    type: 'took-loan',
    subjectId: personId,
    detail: kind + ':' + String(principal),
  })
  return true
}

/**
 * BUY A HOME. The deposit and the mortgage together, because one without
 * the other is not a purchase. Returns false when it cannot be done, which
 * the caller reports rather than pretending.
 */
export function buyHome(
  world: World,
  tick: Tick,
  personId: EntityId,
  placeId: EntityId,
): boolean {
  const place = world.places.get(placeId)
  if (!place) return false
  const accounts = accountsOf(world, personId)
  if (accounts.homePlaceId !== null) return false
  const price = homePriceFor(rentAt(world, place.desirability))
  const deposit = depositFor(price)
  const cash = (accounts.savings + accounts.checking) as Money
  if (loanBar(world, 'mortgage', creditOf(world, personId), accounts.loans, cash, price) !== null) {
    return false
  }

  // The deposit comes out of savings first, then checking.
  const fromSavings = Math.min(deposit, accounts.savings)
  const fromChecking = deposit - fromSavings
  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings - fromSavings) as Money,
    checking: (accounts.checking - fromChecking) as Money,
    homePlaceId: placeId,
    homePurchasePrice: price,
  })
  const borrowed = (price - deposit) as Money
  takeLoan(world, tick, personId, 'mortgage', borrowed)
  // takeLoan credits savings with the principal; a mortgage never touches
  // the buyer's hands, so it goes straight back out to the seller.
  const after = accountsOf(world, personId)
  setAccounts(world, { ...after, savings: (after.savings - borrowed) as Money })

  recordEvent(world, tick, {
    type: 'bought-home',
    subjectId: personId,
    placeId,
    detail: String(price),
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'move',
    significance: 'major',
    inputs: [factor('own-choice', 1000)],
    chosen: 'bought a home in ' + place.name,
    rejected: ['renting'],
    streamId: Stream.Economy,
  })
  return true
}

/**
 * M-ECON §6. THE MONTH'S DEBT SERVICE.
 *
 * Paid from checking, then savings. A month that cannot be met is MISSED,
 * and three consecutive misses is a default: the balance is written off
 * against the security where there is any — the house goes — and the file
 * carries it for years afterwards through the score.
 */
function serviceDebts(world: World, tick: Tick): void {
  for (const personId of [...world.accounts.keys()].sort((a, b) => a - b)) {
    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) continue
    const accounts = accountsOf(world, personId)
    if (accounts.loans.length === 0) continue

    let checking = accounts.checking as number
    let savings = accounts.savings as number
    let monthsPaid = accounts.monthsPaid
    let defaults = accounts.defaults
    let homePlaceId = accounts.homePlaceId
    let homePurchasePrice = accounts.homePurchasePrice
    const remaining: Loan[] = []

    for (const loan of accounts.loans) {
      const interest = Math.floor((loan.balance * loan.ratePerMille) / 12_000)
      const due = Math.min(loan.monthlyPayment, (loan.balance + interest) as Money)
      const fromChecking = Math.max(0, Math.min(due, checking))
      const fromSavings = Math.max(0, Math.min(due - fromChecking, savings))
      const paid = fromChecking + fromSavings

      if (paid < due) {
        // Missed. Interest still accrues — that is what makes falling
        // behind compound rather than pause.
        const missed = loan.missedMonths + 1
        if (missed >= 3) {
          defaults += 1
          recordEvent(world, tick, {
            type: 'defaulted',
            subjectId: personId,
            detail: loan.kind + ':' + String(loan.balance),
          })
          if (loan.kind === 'mortgage' && homePlaceId !== null) {
            recordEvent(world, tick, { type: 'lost-home', subjectId: personId, placeId: homePlaceId })
            homePlaceId = null
            homePurchasePrice = 0 as Money
          }
          continue // the debt is closed by the default; the record carries it
        }
        remaining.push({
          ...loan,
          balance: (loan.balance + interest) as Money,
          missedMonths: missed,
        })
        continue
      }

      checking -= fromChecking
      savings -= fromSavings
      monthsPaid += 1
      const balance = (loan.balance + interest - paid) as Money
      if (balance <= 0) {
        recordEvent(world, tick, { type: 'paid-off-loan', subjectId: personId, detail: loan.kind })
        continue
      }
      remaining.push({ ...loan, balance, missedMonths: 0 })
    }

    setAccounts(world, {
      ...accounts,
      checking: checking as Money,
      savings: savings as Money,
      loans: remaining,
      monthsPaid,
      defaults,
      homePlaceId,
      homePurchasePrice,
    })
  }
}



/** finances is the single writer; this is the only door to that map. */
function setAccounts(world: World, accounts: Accounts): void {
  world.accounts.set(accounts.personId, accounts)
}

/** What this person earns in a month, from every source. */
export function personalIncome(world: World, personId: EntityId): Money {
  const job = world.employment.get(personId)
  return ((job?.monthlyPay ?? 0) +
    servicePayOf(world, personId) +
    pensionOf(world, personId) +
    survivorPensionOf(world, personId)) as Money
}

/**
 * Move money into a person's checking, from a wage or anywhere else.
 * Exported because pay is not the only thing that lands there.
 */
export function creditPerson(world: World, personId: EntityId, amount: Money): void {
  if (amount === 0) return
  const accounts = accountsOf(world, personId)
  setAccounts(world, { ...accounts, checking: (accounts.checking + amount) as Money })
}

/**
 * What actually reaches the kitchen table in a month — NET of withholding.
 *
 * MEASURED, and it matters: this used to be gross, while the money that
 * arrives is net. Everything downstream — what a household spends on
 * itself, whether it can afford a street, what it has left — was therefore
 * computed against income nobody ever received. With tax withheld at source
 * the error stopped being cosmetic: spending ninety per cent of a GROSS
 * surplus plus sales tax consumed the whole net one, and a forty-year town
 * ended with a median adult net worth of $463 and a third of its adults
 * holding nothing at all.
 *
 * Service pay reaches the same table (L4-M3), and so does the disability
 * pension a veteran's service left them owed (L4-M5) — and what a dead
 * spouse's service still pays the household they left.
 */
export function householdIncome(world: World, household: Household): Money {
  let total = 0
  for (const memberId of household.memberIds) {
    const gross = personalIncome(world, memberId)
    total += gross - withholdingFor(gross)
  }
  return total as Money
}

/**
 * Move money between two households (C1). Finances is the ONLY writer of
 * household.savings, so crime asks rather than reaching in. Clamped to what
 * the source actually holds above zero; returns the cents that moved.
 */
export function transferBetweenHouseholds(
  world: World,
  _tick: Tick,
  fromHouseholdId: EntityId,
  toHouseholdId: EntityId,
  cents: number,
): number {
  if (fromHouseholdId === toHouseholdId) return 0
  const from = world.households.get(fromHouseholdId)
  const to = world.households.get(toHouseholdId)
  if (!from || !to || cents <= 0) return 0
  // M-ECON §1. A THEFT TAKES FROM PEOPLE. The pot is gone, so this walks
  // the household's adults and takes from their savings first, then their
  // checking — a burglar finds what a house holds, and what a house holds is
  // what the people in it have put by. Eldest first, so it is reproducible.
  const holders = from.memberIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

  let moved = 0
  for (const holder of holders) {
    if (moved >= cents) break
    const accounts = accountsOf(world, holder.id)
    const fromSavings = Math.max(0, Math.min(cents - moved, accounts.savings))
    const fromChecking = Math.max(
      0,
      Math.min(cents - moved - fromSavings, accounts.checking),
    )
    if (fromSavings + fromChecking <= 0) continue
    setAccounts(world, {
      ...accounts,
      savings: (accounts.savings - fromSavings) as Money,
      checking: (accounts.checking - fromChecking) as Money,
    })
    moved += fromSavings + fromChecking
  }
  if (moved <= 0) return 0

  // And it lands on the thief's side of town, in the pocket of whoever is
  // eldest there — the same rule, from the other end.
  const receivers = to.memberIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  const receiver = receivers[0]
  if (receiver !== undefined) creditPerson(world, receiver.id, moved as Money)
  return moved
}

/**
 * Charge a household (a court's fine). May push it into arrears — that is
 * the honest cost of a fine a family cannot afford, and the arrears
 * machinery already knows what to do with it.
 */
export function chargeHousehold(world: World, tick: Tick, householdId: EntityId, cents: number): void {
  const household = world.households.get(householdId)
  if (!household || cents <= 0) return

  // M-ECON §1. A FINE IS PAID BY PEOPLE. It used to come off the pot, which
  // absorbed it; with the pot gone the household sits at exactly zero, so
  // charging it there put the family into arrears and the monthly loop
  // pulled them straight back out — a fell-behind and a caught-up in the
  // same tick, for a parking fine. Taken from the adults instead, eldest
  // first, checking then savings. Only what nobody could cover becomes
  // arrears, which is what arrears is for.
  let owing = cents
  const adults = household.memberIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  for (const adult of adults) {
    if (owing <= 0) break
    const accounts = accountsOf(world, adult.id)
    const fromChecking = Math.max(0, Math.min(owing, accounts.checking))
    const fromSavings = Math.max(0, Math.min(owing - fromChecking, accounts.savings))
    if (fromChecking + fromSavings <= 0) continue
    setAccounts(world, {
      ...accounts,
      checking: (accounts.checking - fromChecking) as Money,
      savings: (accounts.savings - fromSavings) as Money,
    })
    owing -= fromChecking + fromSavings
  }
  if (owing <= 0) return

  world.households.set(household.id, { ...household, savings: (household.savings - owing) as Money })
  noteArrearsCrossing(world, tick, household.id, household.savings)
}

/**
 * Put money into a household from OUTSIDE the town's own ledgers — a till
 * emptied, a forged cheque, tax not paid. Returns the cents credited so a
 * caller can record what was actually gained.
 *
 * Finances stays the single writer of savings (DOMAIN_MAP §2). C2 first
 * tried to do this by negating chargeHousehold, which moved nothing (that
 * function guards `cents <= 0`) and returned `-undefined` — NaN into an
 * event detail and into a serialized field. Crediting needs its own door.
 */
export function creditHousehold(
  world: World,
  tick: Tick,
  householdId: EntityId,
  cents: number,
): number {
  const household = world.households.get(householdId)
  if (!household || !Number.isFinite(cents) || cents <= 0) return 0
  const amount = Math.floor(cents)
  world.households.set(household.id, {
    ...household,
    savings: (household.savings + amount) as Money,
  })
  noteArrearsCrossing(world, tick, household.id, household.savings)
  return amount
}

/**
 * The fell-behind / back-in-the-black crossing is an invariant of the FIELD,
 * not of runFinances: any writer that moves savings across zero owes the
 * event, or the story shows a fall with no recovery (or the reverse). Every
 * writer in this module calls it with the balance it started from. (The
 * separation split in relationships.ts predates this helper and does not —
 * a known corner, not a rule.)
 */
function noteArrearsCrossing(world: World, tick: Tick, householdId: EntityId, before: Money): void {
  const household = world.households.get(householdId)
  if (!household) return
  const after = household.savings
  if (before >= 0 === after >= 0) return
  const head = eldestMember(world, household)
  if (!head) return
  recordEvent(world, tick, {
    type: after < 0 ? 'fell-behind' : 'back-in-the-black',
    subjectId: head.id,
    // The crossing is a fact about the HOUSEHOLD; the subject is only
    // whoever headed it that month. Naming the household here is what lets
    // the read side pair the spells correctly — see arrearsHistoryOf.
    detail: String(householdId),
  })
}

/**
 * M-ECON §4. A price, at TODAY'S prices.
 *
 * Rent and living costs are static content — the ratio the whole economy is
 * calibrated against — and inflation is the drift on top. One helper, so a
 * 2062 dollar and a 2090 dollar differ everywhere at once and nothing
 * invents its own inflation.
 */
export function rentAt(world: World, desirability: number): Money {
  return atTodaysPrices(world, rentFor(desirability)) as Money
}

export function livingCostAt(world: World, base: number): Money {
  return atTodaysPrices(world, base) as Money
}

export function householdCosts(world: World, household: Household): Money {
  const place = world.places.get(household.placeId)
  let total = place ? rentAt(world, place.desirability) : 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    // Jail is absence (C1): the county feeds them, not the kitchen table.
    // Read inline rather than importing crime (finances must not gain a
    // cycle with a module that calls its transfer helper).
    const criminal = world.criminal.get(memberId)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      continue
    }
    total +=
      ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE
        ? livingCostAt(world, LIVING_COST_ADULT)
        : livingCostAt(world, LIVING_COST_CHILD)
  }
  return total as Money
}

/**
 * Discretionary spending: the life between rent and the bank.
 *
 * M-GAME's stat chip exposed what the ledger had been doing quietly: with
 * only rent and living costs modelled, a working couple banked ~80% of its
 * income and a six-year-old's family held $414,605 by 1977. Correct
 * arithmetic, absurd life. People spend most of what clears the basics —
 * on the car, the kitchen, the holidays this simulation does not itemize —
 * and save the rest.
 *
 * The rate is a household trait, not a constant: thriftier households (by
 * average adult diligence) keep more. Range: spend 83.7%–92% of surplus,
 * i.e. save 8–16%. Deterministic, integer arithmetic, no draw — spending
 * habits are character, not luck.
 *
 * A household in arrears spends NOTHING discretionary: families tighten
 * belts, which is also what makes digging out of debt possible at all.
 */
export function discretionaryFor(world: World, household: Household): Money {
  if (household.savings < 0) return 0 as Money

  const income = householdIncome(world, household)
  const basics = householdCosts(world, household)
  const surplus = income - basics
  if (surplus <= 0) return 0 as Money

  let diligenceTotal = 0
  let adults = 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    if (ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE) {
      diligenceTotal += member.traits.diligence
      adults++
    }
  }
  const avgDiligence = adults > 0 ? Math.floor(diligenceTotal / adults) : 500
  let spendPerMille = 920 - Math.floor(avgDiligence / 12) // 920 down to 837

  // P2: a chosen posture moves the rate the way character otherwise would —
  // a bounded lean, not a cheat code. Null (every NPC household) keeps the
  // formula exactly as it was.
  if (household.spendStance === 'thrifty') spendPerMille = Math.max(690, spendPerMille - 150)
  else if (household.spendStance === 'loose') spendPerMille = Math.min(975, spendPerMille + 55)

  return Math.floor((surplus * spendPerMille) / 1000) as Money
}

/**
 * P2. The player sets the household's spending posture. Finances owns the
 * write (single writer of household money behaviour); the caller owns the
 * story. Null returns the household to its character-driven default.
 */
export function setSpendStance(
  world: World,
  tick: Tick,
  householdId: EntityId,
  stance: Household['spendStance'],
  subjectId: EntityId,
): void {
  const household = world.households.get(householdId)
  if (!household || household.spendStance === stance) return
  world.households.set(householdId, { ...household, spendStance: stance })
  recordEvent(world, tick, {
    type: 'changed-spending',
    subjectId,
    detail: stance ?? 'as-it-comes',
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'spending',
    significance: 'notable',
    inputs: [
      factor('own-choice', 1000),
      ...(household.savings < 0 ? [factor('in-arrears', 700)] : []),
    ],
    chosen:
      stance === 'thrifty'
        ? 'tightened the household belt'
        : stance === 'loose'
          ? 'let the money breathe'
          : 'let the money find its own level',
    rejected: [],
    streamId: Stream.Economy,
  })
}

// ---------------------------------------------------------------------------
// The ledger (P3) — the same month, itemized
//
// The Money tab shows a household's month line by line. Every number below is
// a DECOMPOSITION of householdIncome / householdCosts / discretionaryFor, not
// a second calculation of them: a test asserts the parts sum to the wholes to
// the cent for every household in a simulated town. If the two ever disagree
// the ledger is wrong, because those three functions are what the tick loop
// actually spends.
// ---------------------------------------------------------------------------

/** One named person's contribution to one line of the month. */
export interface LedgerEntry {
  readonly personId: EntityId
  readonly amount: Money
}

export interface HouseholdLedger {
  /** Income, split by where it comes from. Only non-zero entries appear. */
  readonly wages: readonly LedgerEntry[]
  readonly servicePay: readonly LedgerEntry[]
  readonly pensions: readonly LedgerEntry[]
  readonly survivorPay: readonly LedgerEntry[]
  readonly income: Money
  /** M-ECON §3: earned minus arrived. The rows above are gross. */
  readonly taxWithheld: Money
  /** Costs. `rent` + `livingCosts` === `costs`, always. */
  readonly rent: Money
  readonly adults: number
  readonly children: number
  /** Members the county is feeding this month (jailed), fed by nobody here. */
  readonly jailed: number
  readonly livingCosts: Money
  readonly costs: Money
  readonly lifestyle: Money
  readonly net: Money
  readonly savings: Money
  readonly inArrears: boolean
}

export function householdLedger(world: World, household: Household): HouseholdLedger {
  const wages: LedgerEntry[] = []
  const servicePay: LedgerEntry[] = []
  const pensions: LedgerEntry[] = []
  const survivorPay: LedgerEntry[] = []

  // Same iteration as householdIncome, kept deliberately parallel.
  for (const memberId of household.memberIds) {
    // `!== 0`, not `> 0`: the point of the filter is to drop rows that say
    // nothing, and a component that ever goes negative (a clawback, a
    // garnishment) must still appear or the lines stop summing to the total.
    const job = world.employment.get(memberId)
    if (job && job.monthlyPay !== 0) wages.push({ personId: memberId, amount: job.monthlyPay })
    const duty = servicePayOf(world, memberId)
    if (duty !== 0) servicePay.push({ personId: memberId, amount: duty as Money })
    const pension = pensionOf(world, memberId)
    if (pension !== 0) pensions.push({ personId: memberId, amount: pension as Money })
    const survivor = survivorPensionOf(world, memberId)
    if (survivor !== 0) survivorPay.push({ personId: memberId, amount: survivor as Money })
  }

  // Exactly the rows above, added up: what the household EARNS before tax.
  const grossTotal = [...wages, ...servicePay, ...pensions, ...survivorPay].reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )

  // Same iteration as householdCosts, including the jail exemption.
  const place = world.places.get(household.placeId)
  const rent = (place ? rentAt(world, place.desirability) : 0) as Money
  let adults = 0
  let children = 0
  let jailed = 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    const criminal = world.criminal.get(memberId)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      jailed++
      continue
    }
    if (ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE) adults++
    else children++
  }
  const livingCosts = (adults * livingCostAt(world, LIVING_COST_ADULT) +
    children * livingCostAt(world, LIVING_COST_CHILD)) as Money

  return {
    wages,
    servicePay,
    pensions,
    survivorPay,
    income: householdIncome(world, household),
    // M-ECON §3. The rows above are what people EARN; the income line is
    // what arrives. This is the difference, on its own line, the way a
    // payslip shows it — without it the itemisation stopped summing.
    //
    // Derived from the SAME two numbers the rows and the total come from,
    // rather than recomputed from a third source: the first version summed
    // withholding independently and drifted from the rows whenever the two
    // walked the members differently.
    taxWithheld: (grossTotal - householdIncome(world, household)) as Money,
    rent,
    adults,
    children,
    jailed,
    livingCosts,
    costs: householdCosts(world, household),
    lifestyle: discretionaryFor(world, household),
    net: monthlyNetOf(world, household),
    savings: household.savings,
    inArrears: household.savings < 0,
  }
}

/** A stretch of months the household spent behind. Open if it still is. */
export interface ArrearsSpell {
  readonly fromTick: Tick
  readonly toTick: Tick | null
}

/**
 * The hard months, read back out of the record.
 *
 * Keyed on the household id the crossing event carries, NOT on the people
 * under the roof. The first draft read it by current member and the review
 * caught what that does: crossings travel with a person. A 19-year-old who
 * falls behind in their own place and then moves in with a partner carries
 * those events into the partner's household, where an unmatched fell-behind
 * pairs with the NEW household's recovery and renders one long spell that
 * happened to nobody. Law 3 — the record is what happened, and pairing two
 * households' crossings is fabrication however true each event is.
 *
 * Events written before this milestone carry no household id and are
 * skipped: unrecorded history stays unrecorded (Law 6), and the empty state
 * says only that there is nothing on the record.
 */
export function arrearsHistoryOf(world: World, household: Household): readonly ArrearsSpell[] {
  const key = String(household.id)
  const crossings = world.events
    .filter(
      (e) => (e.type === 'fell-behind' || e.type === 'back-in-the-black') && e.detail === key,
    )
    .sort((a, b) => a.tick - b.tick || a.id - b.id)

  const spells: ArrearsSpell[] = []
  let open: Tick | null = null
  for (const event of crossings) {
    if (event.type === 'fell-behind') {
      if (open === null) open = event.tick
    } else if (open !== null) {
      spells.push({ fromTick: open, toTick: event.tick })
      open = null
    }
  }
  if (open !== null) spells.push({ fromTick: open, toTick: null })
  return spells
}

/** This month's true change in savings, mirroring runFinances exactly. */
export function monthlyNetOf(world: World, household: Household): Money {
  return (householdIncome(world, household) -
    householdCosts(world, household) -
    discretionaryFor(world, household)) as Money
}

export function inArrears(world: World, householdId: EntityId | null): boolean {
  if (householdId === null) return false
  const household = world.households.get(householdId)
  return household !== undefined && household.savings < 0
}

/**
 * Can this income carry this rent with a margin left to live on? The margin
 * is one adult's living costs — an affordability rule of thumb, not a law of
 * nature, and deliberately a little forgiving.
 */
export function canAfford(income: Money, desirability: number): boolean {
  // Deliberately at BASE prices, not today's: this is the affordability rule
  // of thumb the moving system uses, and both sides of the comparison drift
  // together, so applying inflation here would cancel out and only add a
  // way for the two readings to disagree.
  return income >= rentFor(desirability) + LIVING_COST_ADULT
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runFinances(world: World, tick: Tick): void {
  payInterest(world)
  runMoneyShocks(world, tick)
  serviceDebts(world, tick)
  payDividends(world)
  runNpcInvesting(world, tick)
  runTaxSeason(world, tick)

  // Ascending id order, as everywhere: processing order must be reproducible.
  const households = [...world.households.values()].sort((a, b) => a.id - b.id)

  for (const household of households) {
    if (household.dissolvedTick !== null) continue
    if (household.memberIds.length === 0) continue

    const before = household.savings

    // M-ECON §1. THE MONTH, IN THE ORDER IT ACTUALLY HAPPENS.
    //
    // 1. Every earner is PAID, into their own checking.
    // 2. The household's obligations — rent, living costs, and what the
    //    household spends on itself — are met from the earners in
    //    PROPORTION to what each brings in. A person who earns nothing
    //    contributes nothing; a person who earns most carries most.
    // 3. Whatever an earner has left is THEIRS and stays in their checking.
    //
    // What the pot did instead was pool everything and pay out of the pool,
    // so no one under the roof had any money of their own and a surplus
    // belonged to a building.
    const earners: { personId: EntityId; income: number }[] = []
    let income = 0
    for (const memberId of [...household.memberIds].sort((a, b) => a - b)) {
      const member = world.people.get(memberId)
      if (!member || member.deathTick !== null) continue
      const gross = personalIncome(world, memberId)
      if (gross <= 0) continue
      // M-ECON §3. WITHHELD AT SOURCE, because that is what a wage feels
      // like: the money that arrives is what is left. The yearly return
      // settles the difference, which is the only moment tax is a decision.
      const withheld = withholdingFor(gross)
      const earned = (gross - withheld) as Money
      const accounts = accountsOf(world, memberId)
      setAccounts(world, {
        ...accounts,
        checking: (accounts.checking + earned) as Money,
        taxableYtd: (accounts.taxableYtd + gross) as Money,
        withheldYtd: (accounts.withheldYtd + withheld) as Money,
      })
      earners.push({ personId: memberId, income: earned })
      income += earned
    }

    // M-ECON §3. SALES TAX rides on what the household spends on ITSELF —
    // not on the rent or the food-and-warmth it cannot choose not to buy.
    const spending = discretionaryFor(world, household)
    const owed = (householdCosts(world, household) + spending + salesTaxOn(spending)) as Money

    // Taken pro rata, in integer cents, with the rounding remainder on the
    // largest earner so the shares always sum to exactly what is owed.
    let collected = 0
    if (income > 0 && owed > 0) {
      earners.sort((a, b) => b.income - a.income || a.personId - b.personId)
      let left: number = owed
      for (let i = 0; i < earners.length; i++) {
        const earner = earners[i]
        if (earner === undefined) continue
        const share =
          i === earners.length - 1 ? left : Math.floor((owed * earner.income) / income)
        const accounts = accountsOf(world, earner.personId)
        // Never more than they have: a shortfall is the household's, which
        // is what arrears means.
        const taken = Math.max(0, Math.min(share, accounts.checking))
        setAccounts(world, { ...accounts, checking: (accounts.checking - taken) as Money })
        collected += taken
        left -= share
      }
    }

    // STILL SHORT? THE BUFFER IS PEOPLE'S SAVINGS.
    //
    // The pot used to absorb a bad month, and without something in its place
    // a household went into arrears the first time anything went wrong — the
    // first build of this collapsed a hundred-and-fifty-year town from 110
    // people to 35, because every family was permanently behind. What
    // actually absorbs a bad month is what the people in the house have put
    // by, so that is what is drawn on: checking first, then savings, eldest
    // first, before any of it becomes arrears.
    let shortfall = owed - collected + Math.max(0, -before)
    if (shortfall > 0) {
      const members = [...household.memberIds]
        .map((id) => world.people.get(id))
        .filter((person): person is Person => person !== undefined && person.deathTick === null)
        .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
      for (const member of members) {
        if (shortfall <= 0) break
        const accounts = accountsOf(world, member.id)
        const fromChecking = Math.max(0, Math.min(shortfall, accounts.checking))
        const fromSavings = Math.max(0, Math.min(shortfall - fromChecking, accounts.savings))
        if (fromChecking + fromSavings <= 0) continue
        setAccounts(world, {
          ...accounts,
          checking: (accounts.checking - fromChecking) as Money,
          savings: (accounts.savings - fromSavings) as Money,
        })
        collected += fromChecking + fromSavings
        shortfall -= fromChecking + fromSavings
      }
    }

    // What could not be met is arrears, and what could is square. A surplus
    // never accumulates here — it is already sitting in people's checking.
    const after = Math.min(0, before + collected - owed) as Money
    world.households.set(household.id, { ...household, savings: after })

    // The month it tips over is worth an event; every month it stays down is
    // not. Same on the way back up. Events mark changes, not states.
    noteArrearsCrossing(world, tick, household.id, before)
  }

  pushArrearsHouseholdsToCheaperRent(world, tick)
}

/**
 * M-ECON §2. SAVINGS EARN. Monthly, on what is actually put by, at the
 * economy's rate — which the central bank will move once it exists (§4).
 * Floored, so a balance too small to earn a cent earns nothing rather than
 * rounding one into existence.
 */
function payInterest(world: World): void {
  for (const personId of [...world.accounts.keys()].sort((a, b) => a - b)) {
    const accounts = accountsOf(world, personId)
    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) continue
    const interest = monthlyInterestOn(accounts.savings, savingsRateOf(world))
    if (interest <= 0) continue
    setAccounts(world, {
      ...accounts,
      savings: (accounts.savings + interest) as Money,
      // Interest is income and is taxed like it, but nothing is withheld
      // from a bank — it lands on the return, which is where a saver meets
      // it in life too.
      taxableYtd: (accounts.taxableYtd + interest) as Money,
    })
  }
}

/**
 * M-ECON §1. Between a person's OWN two accounts. Clamped to what the
 * source holds, and returns what actually moved.
 */
export function moveBetweenOwnAccounts(
  world: World,
  personId: EntityId,
  cents: Money,
  toSavings: boolean,
): Money {
  const accounts = accountsOf(world, personId)
  const from = toSavings ? accounts.checking : accounts.savings
  const moved = Math.max(0, Math.min(cents, from)) as Money
  if (moved <= 0) return 0 as Money
  setAccounts(world, {
    ...accounts,
    checking: (accounts.checking + (toSavings ? -moved : moved)) as Money,
    savings: (accounts.savings + (toSavings ? moved : -moved)) as Money,
  })
  return moved
}

/**
 * M-ECON §5. BUY. Cash out of savings, units in, at today's price.
 *
 * The cost basis is what was actually paid, because that is the only thing
 * that makes a later sale a GAIN rather than a number. Returns the cents
 * that moved — zero if they could not afford it, which is a refusal and not
 * an error.
 */
export function buyInvestment(
  world: World,
  tick: Tick,
  personId: EntityId,
  sectorId: string,
  cents: Money,
  intoRetirement = false,
): Money {
  const accounts = accountsOf(world, personId)
  const affordable = Math.min(cents, accounts.savings) as Money
  if (affordable <= 0) return 0 as Money
  const units = unitsFor(world, sectorId, affordable)
  if (units <= 0) return 0 as Money
  // Only what the units actually cost leaves the account; the rounding
  // remainder stays as savings rather than vanishing.
  const spent = Math.floor((units * (world.sectorPrices[sectorId] ?? 10_000)) / 10_000) as Money

  const which = intoRetirement ? accounts.retirementHoldings : accounts.holdings
  const existing = which.find((h) => h.sectorId === sectorId)
  const merged: Holding = {
    sectorId,
    units: (existing?.units ?? 0) + units,
    costBasis: ((existing?.costBasis ?? 0) + spent) as Money,
  }
  const rest = which.filter((h) => h.sectorId !== sectorId)
  const updated = [...rest, merged].sort((a, b) => (a.sectorId < b.sectorId ? -1 : 1))

  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings - spent) as Money,
    holdings: intoRetirement ? accounts.holdings : updated,
    retirementHoldings: intoRetirement ? updated : accounts.retirementHoldings,
  })
  recordEvent(world, tick, {
    type: 'bought-investment',
    subjectId: personId,
    detail: sectorId + ':' + String(spent),
  })
  return spent
}

/**
 * SELL, at today's price. The gain over the cost basis is REALIZED, and a
 * realized gain is taxed (§3) — which is exactly why the retirement account
 * is worth having: the same sale inside it is not.
 */
export function sellInvestment(
  world: World,
  tick: Tick,
  personId: EntityId,
  sectorId: string,
  fromRetirement = false,
): Money {
  const accounts = accountsOf(world, personId)
  const which = fromRetirement ? accounts.retirementHoldings : accounts.holdings
  const holding = which.find((h) => h.sectorId === sectorId)
  if (!holding || holding.units <= 0) return 0 as Money

  const proceeds = holdingValue(world, holding)
  const gain = Math.max(0, proceeds - holding.costBasis)
  // Capital gains, on what was actually made, and never inside retirement.
  const tax = fromRetirement ? 0 : capitalGainsTaxOn(gain as Money)
  const net = (proceeds - tax) as Money
  const rest = which.filter((h) => h.sectorId !== sectorId)

  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings + (fromRetirement ? 0 : net)) as Money,
    retirement: (accounts.retirement + (fromRetirement ? net : 0)) as Money,
    holdings: fromRetirement ? accounts.holdings : rest,
    retirementHoldings: fromRetirement ? rest : accounts.retirementHoldings,
  })
  recordEvent(world, tick, {
    type: 'sold-investment',
    subjectId: personId,
    detail: sectorId + ':' + String(proceeds) + ':' + String(gain),
  })
  return net
}

/**
 * M-ECON §5. DIVIDENDS, monthly, on everything held.
 *
 * Into savings for a brokerage holding — it is income, and it is taxed like
 * income on the return. Inside retirement it compounds untaxed, which is
 * the account's entire purpose over lives this long.
 */
function payDividends(world: World): void {
  for (const personId of [...world.accounts.keys()].sort((a, b) => a - b)) {
    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) continue
    const accounts = accountsOf(world, personId)
    let taxable = 0
    let sheltered = 0
    for (const holding of accounts.holdings) taxable += dividendOn(world, holding)
    for (const holding of accounts.retirementHoldings) sheltered += dividendOn(world, holding)
    if (taxable <= 0 && sheltered <= 0) continue
    setAccounts(world, {
      ...accounts,
      savings: (accounts.savings + taxable) as Money,
      retirement: (accounts.retirement + sheltered) as Money,
      taxableYtd: (accounts.taxableYtd + taxable) as Money,
    })
  }
}

/**
 * NPC PARITY (Part F): the town invests too, silently, on the same maths.
 *
 * A person with savings well beyond a year of living puts a slice into the
 * market — deterministically, by who they are rather than by a draw, so the
 * same person in the same world always does the same thing. Without this
 * the market would exist and nobody would be in it.
 */
function runNpcInvesting(world: World, tick: Tick): void {
  if (tick % 12 !== 6) return // once a year, in the same month
  for (const person of [...world.people.values()].sort((a, b) => a.id - b.id)) {
    if (person.deathTick !== null) continue
    if (person.id === world.player.personId) continue
    if (ageAt(person.birthTick, tick) < 22) continue
    const accounts = accountsOf(world, person.id)
    const spare = accounts.savings - LIVING_COST_ADULT * 12
    if (spare <= 0) continue
    // The ambitious put more in, and everybody keeps a year's living by.
    const share = 150 + Math.floor(person.traits.ambition / 5)
    const stake = Math.floor((spare * share) / 1000) as Money
    if (stake <= 0) continue
    const sector = SECTORS[person.id % SECTORS.length]
    if (sector === undefined) continue
    // A third of it into the retirement account, which is what it is for.
    buyInvestment(world, tick, person.id, sector.id, Math.floor(stake / 3) as Money, true)
    buyInvestment(world, tick, person.id, sector.id, Math.floor((stake * 2) / 3) as Money, false)
  }
}

/**
 * M-ECON §8. THE MONTHS MONEY GOES WRONG.
 *
 * A medical bill, a scam, a market crash somebody actually feels. These are
 * not the cycle — the cycle is weather and happens to everyone — these are
 * the individual shocks that make a balance sheet a story.
 *
 * The player is ASKED where there is a real choice (pay it now, or carry
 * it); NPCs are simply charged, on the same numbers, which is the parity
 * rule. Nothing here is a punishment for playing badly: a bill arrives
 * because bodies and banks exist.
 */
const SHOCK_KINDS = ['medical', 'scam', 'repairs'] as const

function runMoneyShocks(world: World, tick: Tick): void {
  for (const person of [...world.people.values()].sort((a, b) => a.id - b.id)) {
    if (person.deathTick !== null) continue
    if (ageAt(person.birthTick, tick) < 20) continue
    const accounts = accountsOf(world, person.id)
    const worth = (accounts.checking + accounts.savings) as Money
    if (worth <= 0) continue

    const rng = openStream(world.seed, Stream.Economy, person.id, tick + 61_000)
    // RARE, and measured. At four per thousand a month this fired roughly
    // every twenty years per person and, at the size below, quietly cost a
    // hundred-and-fifty-year town a tenth of its people — which is a tax
    // wearing a shock's clothes. Halved, so it lands perhaps twice in a
    // long life and is remembered when it does.
    if (!rng.chance(2, 1000)) continue

    const kind = SHOCK_KINDS[rng.nextIntInclusive(0, SHOCK_KINDS.length - 1)] ?? 'medical'
    // Sized against what they HAVE, so it stings without being a wipe-out:
    // a fifth to two thirds of liquid money.
    // A fifth to a third of liquid money: enough to hurt and to be worth a
    // decision, never enough to end a life on its own (Law 7).
    const bill = Math.max(
      5_000,
      Math.floor((worth * rng.nextIntInclusive(200, 340)) / 1000),
    ) as Money

    if (person.id === world.player.personId) {
      const raised = raisePending(world, {
        tick,
        kind: 'money-shock',
        personId: person.id,
        otherId: null,
        occupationId: kind,
        workplaceId: null,
        monthlyPay: bill,
        placeId: null,
        options: ['pay-now', 'pay-over-time'],
      })
      if (raised) continue
    }

    // NPCs, and a player whose slot was full: it simply happens.
    applyMoneyShock(world, tick, person.id, kind, bill, false)
  }
}

/**
 * The shock itself. Paying now takes it out of what they hold; carrying it
 * writes a personal loan instead — the same debt machinery everything else
 * uses, at whatever rate their file earns them.
 */
export function applyMoneyShock(
  world: World,
  tick: Tick,
  personId: EntityId,
  kind: string,
  bill: Money,
  overTime: boolean,
): void {
  if (overTime) {
    takeLoan(world, tick, personId, 'personal', bill)
  }
  const accounts = accountsOf(world, personId)
  const fromChecking = Math.max(0, Math.min(bill, accounts.checking))
  const fromSavings = Math.max(0, Math.min(bill - fromChecking, accounts.savings))
  setAccounts(world, {
    ...accounts,
    checking: (accounts.checking - fromChecking) as Money,
    savings: (accounts.savings - fromSavings) as Money,
  })
  recordEvent(world, tick, {
    type: 'money-shock',
    subjectId: personId,
    detail: kind + ':' + String(bill),
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'spending',
    significance: 'notable',
    inputs: [factor('own-choice', overTime ? 1000 : 400)],
    chosen: overTime ? 'carried the bill' : 'paid the bill',
    rejected: overTime ? ['paying it outright'] : ['spreading it out'],
    streamId: Stream.Economy,
  })
}

/**
 * The economy's savings rate — the central bank's, once it exists (§4).
 * Falls back to the base only for a world built before the cycle did.
 */
export function savingsRateOf(world: World): number {
  return world.economy?.ratePerMille ?? BASE_SAVINGS_RATE_PER_MILLE
}

/**
 * M-ECON §3. THE RETURN, once a year, in January.
 *
 * Withholding is a table's guess at a steady year. A year with a raise in
 * it, or a spell out of work, or a first year of interest, is not steady —
 * so the return settles the difference and the difference is real money:
 * a refund into checking, or a bill out of it.
 *
 * NPCs file silently. The player is shown it (§3), which the caller raises.
 */
function runTaxSeason(world: World, tick: Tick): void {
  if (toDate(world, tick).month !== 1) return

  for (const personId of [...world.accounts.keys()].sort((a, b) => a - b)) {
    const accounts = accountsOf(world, personId)
    if (accounts.taxableYtd <= 0 && accounts.withheldYtd <= 0) continue
    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) continue

    const owed = incomeTaxFor(accounts.taxableYtd)
    const settled = (accounts.withheldYtd - owed) as Money

    // A refund is money back; a bill comes out of checking and may overdraw
    // it, which is exactly what an unexpected tax bill does.
    setAccounts(world, {
      ...accounts,
      checking: (accounts.checking + settled) as Money,
      taxableYtd: 0 as Money,
      withheldYtd: 0 as Money,
    })
    recordEvent(world, tick, {
      type: 'filed-taxes',
      subjectId: personId,
      detail: String(settled),
    })
  }
}

function eldestMember(world: World, household: Household): Person | undefined {
  let eldest: Person | undefined
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    if (!eldest || member.birthTick < eldest.birthTick || (member.birthTick === eldest.birthTick && member.id < eldest.id)) {
      eldest = member
    }
  }
  return eldest
}

/**
 * A household deep in arrears moves somewhere cheaper — the classic hard
 * month, made mechanical. "Deep" means the hole exceeds PATIENCE months of
 * the shortfall, so one bad month never uproots a family.
 *
 * If the player lives there, they are asked (the same move-house question,
 * pointed downhill — describePending words it from the stakes). Declining is
 * allowed; the arrears, and this question, will keep coming.
 */
function pushArrearsHouseholdsToCheaperRent(world: World, tick: Tick): void {
  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) return

  const households = [...world.households.values()].sort((a, b) => a.id - b.id)
  for (const household of households) {
    if (household.dissolvedTick !== null || household.savings >= 0) continue

    const income = householdIncome(world, household)
    const costs = householdCosts(world, household)
    const monthlyShortfall = costs - income
    if (monthlyShortfall <= 0) continue // income now covers the month; digging out
    if (-household.savings < monthlyShortfall * ARREARS_PATIENCE_MONTHS) continue

    const current = world.places.get(household.placeId)
    if (!current) continue
    const cheaper = neighbourhoods
      .filter((p) => p.desirability < current.desirability - 60)
      .sort((a, b) => a.desirability - b.desirability)
    const target = cheaper[0]
    if (!target) continue // already at the bottom of town; nothing to sell but time

    const head = eldestMember(world, household)
    if (!head) continue

    const playerId = world.player.personId
    if (playerId !== null && household.memberIds.includes(playerId)) {
      // ONLY IF IT LANDED. raisePending refuses while another question is up
      // — and, since the captivity guard, every month a played character is
      // held. Continuing regardless meant the household never downsized for
      // the whole captivity while rent and debt kept running. The prisoner
      // cannot be asked; the family can still act, so an unasked month falls
      // through to the automatic move below.
      const asked = raisePending(world, {
        tick,
        kind: 'move-house',
        personId: playerId,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: target.id,
        options: [
          'accept',
          'decline',
          // P2: every cheaper street is on the table, not only the cheapest.
          ...cheaper
            .filter((p) => p.id !== target.id)
            .sort((x, y) => x.id - y.id)
            .map((p) => `to-${String(p.id)}`),
        ],
      })
      if (asked) continue
    }

    world.households.set(household.id, { ...household, placeId: target.id })
    recordEvent(world, tick, { type: 'moved-house', subjectId: head.id, placeId: target.id })
    recordDecision(world, tick, {
      subjectId: head.id,
      decision: 'move',
      significance: 'major',
      inputs: [
        factor('in-arrears', Math.min(1000, Math.floor(-household.savings / 1000))),
        factor('cheaper-rent', current.desirability - target.desirability),
      ],
      chosen: `moved to ${target.name} to make ends meet`,
      rejected: [`to stay in ${current.name}`],
      streamId: Stream.Economy,
    })
  }
}

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

/**
 * Called by mortality when a death empties a household. Whatever the pot held
 * passes to the deceased's living children, split equally, eldest taking the
 * remainder cent. Debts die with the household: a negative estate passes
 * nothing rather than billing the children — grief is not a ledger.
 *
 * This is the first piece of generational legacy: a family that saved leaves
 * its children genuinely better off, and the record says where it came from.
 */
export function distributeEstate(world: World, tick: Tick, deceased: Person, household: Household): void {
  // M-ECON §1. AN ESTATE IS A PERSON'S MONEY, not a building's. It used to
  // be whatever the roof happened to hold, which meant a widow's savings
  // passed as "the household's" and a lodger's did not exist at all.
  const estate = accountsOf(world, deceased.id)
  const gross = (estate.checking + estate.savings + estate.brokerage + estate.retirement) as Money
  if (gross <= 0) return
  // M-ECON §3. THE ESTATE IS TAXED before it is divided — an exemption
  // large enough that an ordinary life passes whole, so this is felt by a
  // fortune and not by a family.
  const passing = (gross - estateTaxOn(gross)) as Money
  if (passing <= 0) return

  const heirs: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (person.parentIds.includes(deceased.id)) heirs.push(person)
  }
  if (heirs.length === 0) return
  heirs.sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

  const share = Math.floor(passing / heirs.length)
  let remainder: number = passing - share * heirs.length

  for (const heir of heirs) {
    const amount = (share + remainder) as Money
    remainder = 0
    if (amount <= 0) continue

    // Into the heir's OWN savings — an inheritance is money somebody has,
    // not a credit against the rent of whatever house they sleep in.
    const accounts = accountsOf(world, heir.id)
    setAccounts(world, { ...accounts, savings: (accounts.savings + amount) as Money })
    recordEvent(world, tick, {
      type: 'inherited',
      subjectId: heir.id,
      otherId: deceased.id,
      detail: String(amount),
    })
  }

  // The deceased's accounts are closed by the passing.
  setAccounts(world, {
    personId: deceased.id,
    checking: 0 as Money,
    savings: 0 as Money,
    brokerage: 0 as Money,
    retirement: 0 as Money,
    taxableYtd: 0 as Money,
    withheldYtd: 0 as Money,
    holdings: [],
    retirementHoldings: [],
    loans: [],
    homePlaceId: null,
    homePurchasePrice: 0 as Money,
    monthsPaid: 0,
    defaults: 0,
  })
  // The household itself keeps only what it owes, which death does not clear.
  void household
}

/** Deterministic starting savings for a founding household: some months of
 *  wages, varied by the worldgen stream so households start unequal (Law 10). */
export function foundingSavings(world: World, household: Household): Money {
  const income = householdIncome(world, household)
  const rng = openStream(world.seed, Stream.Economy, household.id, 0)
  const months = rng.nextIntInclusive(1, 9)
  const base = income > 0 ? income * months : rng.nextIntInclusive(20_000, 220_000)
  return base as Money
}

/**
 * The founding town's money, put where money now lives: in the SAVINGS of
 * the adults who would have earned it. Split evenly, eldest carrying the odd
 * cents — the same rule the save migration uses, for the same reason. There
 * is no record of who earned which part of a household that has not been
 * simulated yet, so an even split invents nothing.
 */
export function seedFoundingAccounts(world: World, household: Household, amount: Money): void {
  if (amount <= 0) return
  const adults = household.memberIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
    .filter((p) => ageAt(p.birthTick, world.tick) >= ADULT_COST_AGE)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  if (adults.length === 0) return

  const share = Math.floor(amount / adults.length)
  let remainder: number = amount - share * adults.length
  for (const adult of adults) {
    const accounts = accountsOf(world, adult.id)
    setAccounts(world, {
      ...accounts,
      savings: (accounts.savings + share + remainder) as Money,
    })
    remainder = 0
  }
}
