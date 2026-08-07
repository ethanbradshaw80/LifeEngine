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
import type {
  Accounts,
  SpendStance,
  Bankruptcy,
  BankruptcyChapter,
  Holding,
  Household,
  Loan,
  LoanKind,
  Person,
  World,
} from './types.js'
import { pensionOf, servicePayOf, survivorPensionOf } from './service.js'
import {
  assistanceOf,
  shelterCostFor,
  statePensionOf,
  UNEMPLOYMENT_MONTHS,
  unemploymentOf,
} from './safetynet.js'
import {
  chaptersOpenTo,
  creditPenaltyOf,
  HOMESTEAD_EXEMPTION,
  isInsolvent,
  medianMonthlyIncome,
  PLAN_MONTHS_MIN,
  planMonthsFor,
  planPaymentFor,
  planPayoffBar,
  planPayoffFor,
  PROPERTY_EXEMPTION,
  distressDebtOf,
  totalOwedBy,
  underStay,
} from './bankruptcy.js'
import { placesOfKind } from './worldgen.js'
import {
  BUSINESS_FAILS_AFTER,
  BUSINESS_KINDS,
  CAPITAL_CEILING_MULTIPLE,
  businessKindById,
  businessNameFor,
  monthlyProfitFor,
} from './business.js'

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
      monthsWorked: 0,
      lastMonthlyPay: 0 as Money,
      unemploymentUntilTick: null,
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

/**
 * MONEY ON HAND — what a person could actually spend this afternoon.
 *
 * Deliberately NOT net worth: a house, a portfolio and a retirement account
 * are wealth, but none of them buys groceries, and a glance-level chip that
 * says $300,000 to somebody who cannot make rent is lying to them. Net worth
 * lives on the Bank, where there is room to explain what it is made of.
 */
export function moneyOnHand(world: World, personId: EntityId): Money {
  const a = accountsOf(world, personId)
  return (a.checking + a.savings) as Money
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
  return creditScoreOf(
    world,
    a.loans,
    a.defaults,
    a.monthsPaid,
    creditPenaltyOf(world, personId, world.tick),
  )
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
/** How the house is being paid for. */
export type HomePurchaseMethod = 'cash' | 'mortgage'

/**
 * ADR-0035, owner: "when you go to the bank to buy a house it makes you buy
 * it as a mortgage no matter what and then it forces you into a repayment
 * plan and there is no way to pay for the actual house."
 *
 * He is right and it was worse than an omission. `buyHome` took a mortgage
 * unconditionally, and the mortgage's own eligibility check ran BEFORE any
 * money changed hands — so somebody sitting on the full price in savings
 * could be refused the house entirely because the bank would not lend to
 * them. Cash is not a lesser way to buy a house.
 *
 * The bar pattern, as everywhere else: the buttons and the refusals read
 * this, so a greyed row and an honest "no" cannot disagree.
 */
export function homePurchaseBar(
  world: World,
  personId: EntityId,
  placeId: EntityId,
  method: HomePurchaseMethod,
): string | null {
  const place = world.places.get(placeId)
  if (!place) return 'No such address.'
  const accounts = accountsOf(world, personId)
  if (accounts.homePlaceId !== null) return 'You already own a home.'
  const price = homePriceFor(rentAt(world, place.desirability))
  const cash = (accounts.savings + accounts.checking) as Money
  if (method === 'cash') {
    return cash >= price
      ? null
      : `Outright costs ${String(Math.ceil((price - cash) / 100))} dollars more than you have.`
  }
  return loanBar(world, 'mortgage', creditOf(world, personId), accounts.loans, cash, price)
}

export function buyHome(
  world: World,
  tick: Tick,
  personId: EntityId,
  placeId: EntityId,
  /** Defaults to a mortgage, which is what every existing caller meant. */
  method: HomePurchaseMethod = 'mortgage',
): boolean {
  const place = world.places.get(placeId)
  if (!place) return false
  const accounts = accountsOf(world, personId)
  if (homePurchaseBar(world, personId, placeId, method) !== null) return false
  const price = homePriceFor(rentAt(world, place.desirability))
  // PAYING CASH PAYS THE WHOLE PRICE. A mortgage pays the deposit now and
  // owes the rest; there is no third thing.
  const nowDue = method === 'cash' ? price : depositFor(price)

  // The money comes out of savings first, then checking.
  const fromSavings = Math.min(nowDue, accounts.savings)
  const fromChecking = nowDue - fromSavings
  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings - fromSavings) as Money,
    checking: (accounts.checking - fromChecking) as Money,
    homePlaceId: placeId,
    homePurchasePrice: price,
  })
  if (method === 'mortgage') {
    const borrowed = (price - nowDue) as Money
    takeLoan(world, tick, personId, 'mortgage', borrowed)
    // takeLoan credits savings with the principal; a mortgage never touches
    // the buyer's hands, so it goes straight back out to the seller.
    const after = accountsOf(world, personId)
    setAccounts(world, { ...after, savings: (after.savings - borrowed) as Money })
  }

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
    chosen:
      method === 'cash'
        ? `bought a home outright in ${place.name}`
        : `bought a home in ${place.name}`,
    rejected: method === 'cash' ? ['renting', 'a mortgage'] : ['renting'],
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
  const person = world.people.get(personId)
  // M-SAFETY §4. The state pension is earned income deferred, and it is
  // taxed like the wage it was earned from — which is why it belongs here
  // and the two untaxed floors below do not.
  const statePension =
    person === undefined
      ? (0 as Money)
      : statePensionOf(world, person, accountsOf(world, personId), world.tick)
  return ((job?.monthlyPay ?? 0) +
    servicePayOf(world, personId) +
    pensionOf(world, personId) +
    survivorPensionOf(world, personId) +
    statePension) as Money
}

/**
 * M-SAFETY §4. THE TWO UNTAXED FLOORS, monthly.
 *
 * Unemployment insurance is a share of the last wage for a bounded stretch
 * after a layoff. Public assistance is whatever it takes to bring an adult
 * up to a bare floor, and it is computed against what they would otherwise
 * have IN HAND — net of tax and including the insurance — because a floor
 * measured against gross is not a floor.
 *
 * Neither is withheld from. Taxing a floor down through itself would make
 * the floor a fiction, and the fiction is what let arrears free-fall.
 */
export function supportOf(world: World, personId: EntityId, tick: Tick): Money {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 0 as Money
  const accounts = accountsOf(world, personId)
  const insurance = unemploymentOf(world, personId, accounts, tick)
  const gross = personalIncome(world, personId)
  const inHand = (gross - withholdingFor(gross, world.economy.priceLevelPerMille) + insurance) as Money
  return (insurance + assistanceOf(world, person, inHand, tick)) as Money
}

/**
 * Move money into a person's checking, from a wage or anywhere else.
 * Exported because pay is not the only thing that lands there.
 */
export function creditPerson(world: World, personId: EntityId, amount: Money): number {
  if (amount <= 0) return 0
  const accounts = accountsOf(world, personId)
  setAccounts(world, { ...accounts, checking: (accounts.checking + amount) as Money })
  return amount
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
    total += gross - withholdingFor(gross, world.economy.priceLevelPerMille) + supportOf(world, memberId, world.tick)
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
  // M-SAFETY §3. NO ROOF, NO RENT. This is the single largest reason the
  // old model could free-fall: a household that could not pay rent went on
  // being charged it, for ever, and the arrears compounded on a bill nobody
  // was sending. Losing housing is terrible in every other way the model
  // has — health, work, relationships, exposure to crime — but it does not
  // go on billing you for a house you are not in.
  if (household.homelessSinceTick !== null) {
    let shelter = 0
    for (const memberId of household.memberIds) {
      const member = world.people.get(memberId)
      if (!member || member.deathTick !== null) continue
      shelter += shelterCostFor(world)
    }
    return shelter as Money
  }
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
 * M-MONEY2. The posture a unit carries its money at: the eldest adult's,
 * because a couple share one and somebody has to have set it.
 */
export function stanceOfUnit(world: World, unit: readonly EntityId[]): SpendStance | null {
  const adults = unit
    .map((id) => world.people.get(id))
    .filter((person): person is Person => person !== undefined && person.deathTick === null)
    .filter((person) => ageAt(person.birthTick, world.tick) >= ADULT_COST_AGE)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  for (const adult of adults) {
    if (adult.spendStance !== null) return adult.spendStance
  }
  return null
}

/**
 * M-MONEY2. THE PEOPLE WHOSE MONEY IS GENUINELY SHARED.
 *
 * OWNER, PLAYING: "It should show just your money, if you have a wife then
 * your wife's money. This is a life simulator — why would my parents
 * control my spending when I'm a grown man after 18?"
 *
 * He is right, and it was a modelling shortcut rather than a decision: the
 * HOUSEHOLD was the only economic unit in the world, so a twenty-six-year-
 * old still at home had his lifestyle spending governed by his father's
 * spend stance and his month reported as the roof's month.
 *
 * A household is a BUILDING. The unit that actually shares money is a
 * person, their spouse or partner, and the children who depend on them.
 * Three adults under one roof are three units if none of them are married
 * to each other, and they split the rent between them rather than pooling
 * their lives.
 *
 * Returns the unit's members, the person first, ALWAYS non-empty.
 */
export function financialUnitOf(world: World, personId: EntityId): readonly EntityId[] {
  const person = world.people.get(personId)
  if (!person) return [personId]
  const unit: EntityId[] = [personId]

  // A partner shares it. Anybody else's marriage does not.
  //
  // Read inline off the relationship graph rather than through
  // relationships.ts: that module already reads finances (arrears strains a
  // marriage), and the import ratchet is right to refuse the edge back.
  // Same reasoning as health reading homelessness inline.
  for (const tie of world.relationships.values()) {
    if (tie.endedAtTick !== null) continue
    if (tie.type !== 'spouse' && tie.type !== 'courting') continue
    const other = tie.a === personId ? tie.b : tie.b === personId ? tie.a : null
    if (other === null) continue
    if (world.people.get(other)?.deathTick !== null) continue
    if (!unit.includes(other)) unit.push(other)
  }

  // AND THE CHILDREN WHO DEPEND ON THEM — their own, in the same house,
  // and not yet standing on their own money.
  //
  // "Dependent" is about INCOME, not only about age. The first version cut
  // at ADULT_COST_AGE, which is sixteen — so a sixteen-year-old at school
  // became their own economic unit carrying an adult's living costs against
  // no income at all, and every household with a teenager in it went short
  // every single month. MEASURED: the town fell from 159 people at a
  // hundred and fifty years to 50, with marriages halved, because families
  // were quietly starving. A child at home with no wage is their parents'
  // to feed at sixteen exactly as at six.
  //
  // The moment they earn — a job, service pay, a pension of their own —
  // they become their own unit, which is the thing the owner actually
  // asked for: at eighteen with a wage, your money is yours.
  for (const other of world.people.values()) {
    if (other.deathTick !== null) continue
    if (other.householdId !== person.householdId) continue
    if (!other.parentIds.some((parentId) => unit.includes(parentId))) continue
    const grown = ageAt(other.birthTick, world.tick) >= 18
    if (grown && personalIncome(world, other.id) > 0) continue
    unit.push(other.id)
  }
  return unit
}

/**
 * M-MONEY2. Every unit under one roof, each listed once, in a stable order.
 * The settle walks these rather than the household as a whole.
 */
export function unitsUnder(world: World, household: Household): readonly (readonly EntityId[])[] {
  const seen = new Set<EntityId>()
  const units: (readonly EntityId[])[] = []
  for (const memberId of [...household.memberIds].sort((a, b) => a - b)) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null || seen.has(memberId)) continue
    const unit = financialUnitOf(world, memberId).filter(
      (id) => household.memberIds.includes(id) && !seen.has(id),
    )
    if (unit.length === 0) continue
    for (const id of unit) seen.add(id)
    units.push(unit)
  }
  return units
}

/** What this unit earns in a month, net of tax and including the floors. */
export function unitIncome(world: World, unit: readonly EntityId[]): Money {
  let total = 0
  for (const id of unit) {
    const gross = personalIncome(world, id)
    total += gross - withholdingFor(gross, world.economy.priceLevelPerMille) + supportOf(world, id, world.tick)
  }
  return total as Money
}

/**
 * M-MONEY2. WHAT THIS UNIT OWES THIS MONTH.
 *
 * Its own mouths, plus its share of the rent. The rent is split between the
 * units under the roof BY INCOME, which is how a house of adults actually
 * works — the one earning most carries most of it — and it means a grown
 * child at home contributes without being absorbed.
 */
export function unitCosts(world: World, household: Household, unit: readonly EntityId[]): Money {
  if (household.homelessSinceTick !== null) {
    let shelter = 0
    for (const id of unit) {
      const member = world.people.get(id)
      if (member && member.deathTick === null) shelter += shelterCostFor(world)
    }
    return shelter as Money
  }

  let mouths = 0
  for (const id of unit) {
    const member = world.people.get(id)
    if (!member || member.deathTick !== null) continue
    const criminal = world.criminal.get(id)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      continue
    }
    mouths +=
      ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE
        ? livingCostAt(world, LIVING_COST_ADULT)
        : livingCostAt(world, LIVING_COST_CHILD)
  }

  const place = world.places.get(household.placeId)
  const rent = place ? rentAt(world, place.desirability) : 0
  const units = unitsUnder(world, household)
  if (units.length === 0) return mouths as Money
  let totalIncome = 0
  for (const other of units) totalIncome += unitIncome(world, other)
  const mine = unitIncome(world, unit)
  // Nobody earning: the rent splits evenly rather than falling on one head.
  const share =
    totalIncome > 0
      ? Math.floor((rent * mine) / totalIncome)
      : Math.floor(rent / units.length)
  return (mouths + share) as Money
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
  // The roof's total, which is the sum of what the units under it spend.
  // Kept because the ledger and the arrears rule both want a household
  // figure; the DECISION lives one level down now.
  let total = 0
  for (const unit of unitsUnder(world, household)) {
    total += discretionaryForUnit(world, household, unit)
  }
  return total as Money
}

/**
 * M-MONEY2. WHAT ONE UNIT SPENDS ON ITSELF.
 *
 * Its own surplus, at its own posture. A grown son's spending is decided by
 * HIS diligence and HIS stance, not his father's — which is the whole point
 * of there being units at all.
 */
export function discretionaryForUnit(
  world: World,
  household: Household,
  unit: readonly EntityId[],
): Money {
  if (household.savings < 0) return 0 as Money
  // M-SAFETY §2. A HOUSEHOLD UNDER A PLAN IS ON A COURT-SUPERVISED BUDGET.
  //
  // MEASURED, and it is what made plans unkeepable: a filing set the
  // arrears to zero, discretionary spending switched straight back on, and
  // it ate the very surplus the plan was computed from. 155 plans were
  // dismissed against 2 completed. A chapter 13 budget is supervised
  // precisely so that this cannot happen.
  for (const memberId of unit) {
    if (underStay(world, memberId, world.tick)) return 0 as Money
  }

  const income = unitIncome(world, unit)
  const basics = unitCosts(world, household, unit)
  const surplus = income - basics
  if (surplus <= 0) return 0 as Money

  let diligenceTotal = 0
  let adults = 0
  for (const memberId of unit) {
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
  // THE UNIT'S OWN POSTURE — the eldest adult in it sets it, and a couple
  // share one. This read `household.spendStance`, which is how a father's
  // thrift came to govern a grown son's money.
  const stance = stanceOfUnit(world, unit)
  if (stance === 'thrifty') spendPerMille = Math.max(690, spendPerMille - 150)
  else if (stance === 'loose') spendPerMille = Math.min(975, spendPerMille + 55)

  return Math.floor((surplus * spendPerMille) / 1000) as Money
}

/**
 * M-MONEY2. The player sets how THEY carry their money.
 *
 * P2 put this on the household, which is how a father's posture came to
 * govern a grown son's spending. Finances still owns the write; the caller
 * still owns the story. Null returns them to the character-driven default.
 */
export function setSpendStance(
  world: World,
  tick: Tick,
  personId: EntityId,
  stance: SpendStance | null,
): void {
  const person = world.people.get(personId)
  if (!person || person.spendStance === stance) return
  world.people.set(personId, { ...person, spendStance: stance })
  const household = person.householdId === null ? undefined : world.households.get(person.householdId)
  recordEvent(world, tick, {
    type: 'changed-spending',
    subjectId: personId,
    detail: stance ?? 'as-it-comes',
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'spending',
    significance: 'notable',
    inputs: [
      factor('own-choice', 1000),
      ...((household?.savings ?? 0) < 0 ? [factor('in-arrears', 700)] : []),
    ],
    chosen:
      stance === 'thrifty'
        ? 'tightened their belt'
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
  /**
   * M-SAFETY §4. The state pension, unemployment insurance and public
   * assistance, per person. The pension is taxed like the wage it was
   * earned from; the other two arrive whole.
   */
  readonly statePension: readonly LedgerEntry[]
  readonly support: readonly LedgerEntry[]
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
  /**
   * M-SAFETY §3. No roof: rent is zero and the living line is what a
   * shelter costs. Exposed so the screen can say WHY the month suddenly
   * looks cheap, which is the least it owes somebody in that state.
   */
  readonly homeless: boolean
  readonly costs: Money
  readonly lifestyle: Money
  /** M-ECON §3: what the state takes on the lifestyle line. */
  readonly salesTax: Money
  readonly net: Money
  readonly savings: Money
  readonly inArrears: boolean
}

export function householdLedger(world: World, household: Household): HouseholdLedger {
  const wages: LedgerEntry[] = []
  const servicePay: LedgerEntry[] = []
  const pensions: LedgerEntry[] = []
  const survivorPay: LedgerEntry[] = []
  const statePension: LedgerEntry[] = []
  const support: LedgerEntry[] = []

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
    const member = world.people.get(memberId)
    const state =
      member === undefined
        ? 0
        : statePensionOf(world, member, accountsOf(world, memberId), world.tick)
    if (state !== 0) statePension.push({ personId: memberId, amount: state as Money })
    const floor = supportOf(world, memberId, world.tick)
    if (floor !== 0) support.push({ personId: memberId, amount: floor })
  }

  // Exactly the rows above, added up: what the household EARNS before tax.
  const grossTotal = [...wages, ...servicePay, ...pensions, ...survivorPay, ...statePension].reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )
  // The untaxed floors, which arrive whole and are therefore NOT part of
  // what withholding is computed from.
  const supportTotal = support.reduce((sum, entry) => sum + entry.amount, 0)

  // Same iteration as householdCosts, including the jail exemption AND the
  // homelessness case — the two must agree to the cent or the itemisation
  // stops summing to the month the tick loop actually spends.
  const homeless = household.homelessSinceTick !== null
  const place = world.places.get(household.placeId)
  const rent = (homeless ? 0 : place ? rentAt(world, place.desirability) : 0) as Money
  let adults = 0
  let children = 0
  let jailed = 0
  let living = 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    living++
    const criminal = world.criminal.get(memberId)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      jailed++
      continue
    }
    if (ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE) adults++
    else children++
  }
  const livingCosts = (
    homeless
      ? living * shelterCostFor(world)
      : adults * livingCostAt(world, LIVING_COST_ADULT) +
        children * livingCostAt(world, LIVING_COST_CHILD)
  ) as Money

  return {
    wages,
    servicePay,
    pensions,
    survivorPay,
    statePension,
    support,
    income: householdIncome(world, household),
    // M-ECON §3. The rows above are what people EARN; the income line is
    // what arrives. This is the difference, on its own line, the way a
    // payslip shows it — without it the itemisation stopped summing.
    //
    // Derived from the SAME two numbers the rows and the total come from,
    // rather than recomputed from a third source: the first version summed
    // withholding independently and drifted from the rows whenever the two
    // walked the members differently.
    // M-SAFETY §4: the floors are subtracted back out before the difference
    // is taken. Without that this went NEGATIVE the moment a household's
    // support exceeded its withholding, which is exactly what a floor under
    // somebody with no wages does.
    taxWithheld: (grossTotal - (householdIncome(world, household) - supportTotal)) as Money,
    rent,
    adults,
    children,
    jailed,
    livingCosts,
    homeless,
    costs: householdCosts(world, household),
    lifestyle: discretionaryFor(world, household),
    salesTax: salesTaxOn(discretionaryFor(world, household)),
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
  // SALES TAX IS PART OF WHAT LEAVES. Found by playing: the settle charges
  // costs + spending + salesTaxOn(spending), and this left the tax out, so
  // the chip told a captain he cleared $804 a month when the month actually
  // cleared less. The two must be computed from the same expression or the
  // number on the glance is a small lie every month for a lifetime.
  const spending = discretionaryFor(world, household)
  return (householdIncome(world, household) -
    householdCosts(world, household) -
    spending -
    salesTaxOn(spending)) as Money
}

/**
 * M-MONEY2. The same figure for ONE UNIT — what these people, and only
 * these people, clear this month. This is what a screen should show a
 * grown adult about their own life.
 */
export function unitMonthlyNet(world: World, household: Household, unit: readonly EntityId[]): Money {
  const spending = discretionaryForUnit(world, household, unit)
  return (unitIncome(world, unit) -
    unitCosts(world, household, unit) -
    spending -
    salesTaxOn(spending)) as Money
}

/**
 * WHAT ONE PERSON'S OWN MONEY DOES THIS MONTH.
 *
 * Found by playing, three times now.
 *
 * FIRST: the glance chip stacked a person's balance on the household's
 * monthly net, so it read "$1,337.58, +$804 a month" to a man whose own
 * money was growing by a tenth of that.
 *
 * SECOND: a retired man of 66 read "+$0.00 a month" while his savings paid
 * the roof, because only the wage half of the settle was mirrored.
 *
 * THIRD, and the reason this reads off a UNIT now (owner: "why would my
 * parents control my spending when I'm a grown man"): it was computed
 * against the whole household, so a grown child at home was shown a month
 * that belonged to his parents.
 *
 * The unit's income, less the unit's costs and its own lifestyle, split
 * inside the unit by who earned it.
 */
export function personalMonthlyNet(world: World, personId: EntityId): Money {
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return 0 as Money
  const household = world.households.get(person.householdId)
  if (!household) return 0 as Money

  const unit = financialUnitOf(world, personId)
  const income = unitIncome(world, unit)
  const spending = discretionaryForUnit(world, household, unit)
  const owed = (unitCosts(world, household, unit) + spending + salesTaxOn(spending)) as Money
  const left = income - owed

  // Inside the unit, split by who brought it in — a couple where one earns
  // everything is one purse, and the number shown to either of them is the
  // purse's. A unit of one is the whole of it.
  const gross = personalIncome(world, personId)
  const mine = (gross - withholdingFor(gross, world.economy.priceLevelPerMille) +
    supportOf(world, personId, world.tick)) as Money
  if (income <= 0) return (left > 0 ? left : Math.floor(left / Math.max(1, unit.length))) as Money
  return Math.floor((left * mine) / income) as Money
}

/**
 * M-SAFETY §3. Is this person sleeping rough or in a shelter?
 *
 * Read by health, hiring, relationships and crime — the state is only worth
 * modelling because it is felt everywhere, and a homelessness that cost
 * nothing but rent would be a discount rather than a disaster.
 */
export function isHomeless(world: World, personId: EntityId): boolean {
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return false
  return world.households.get(person.householdId)?.homelessSinceTick !== null
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
      // M-ECON §3. WITHHELD AT SOURCE, because that is what a wage feels
      // like: the money that arrives is what is left. The yearly return
      // settles the difference, which is the only moment tax is a decision.
      const withheld = withholdingFor(gross, world.economy.priceLevelPerMille)
      // M-SAFETY §4. The two untaxed floors arrive whole, alongside the wage.
      //
      // AND THEY ARRIVE FOR PEOPLE WITH NO WAGE AT ALL, which is the entire
      // point of a floor. Measured: the skip below used to read
      // `if (gross <= 0) continue`, so somebody living on assistance was
      // never credited it and never counted as contributing — their whole
      // month became arrears while householdIncome cheerfully reported the
      // money. A household with $647 coming in went $250 further behind
      // every month, and every repayment plan built on it was dismissed.
      const support = supportOf(world, memberId, tick)
      if (gross <= 0 && support <= 0) continue
      const earned = (gross - withheld + support) as Money
      const accounts = accountsOf(world, memberId)
      // THE WORK RECORD A PENSION IS BUILT FROM. A month with a wage or
      // service pay in it counts; a month on a floor does not, because the
      // floors are what a working record is not.
      const wage = (world.employment.get(memberId)?.monthlyPay ?? 0) + servicePayOf(world, memberId)
      setAccounts(world, {
        ...accounts,
        checking: (accounts.checking + earned) as Money,
        taxableYtd: (accounts.taxableYtd + gross) as Money,
        withheldYtd: (accounts.withheldYtd + withheld) as Money,
        monthsWorked: wage > 0 ? accounts.monthsWorked + 1 : accounts.monthsWorked,
        lastMonthlyPay: wage > 0 ? (wage as Money) : accounts.lastMonthlyPay,
      })
      earners.push({ personId: memberId, income: earned })
      income += earned
    }

    // M-ECON §3. SALES TAX rides on what a household spends on ITSELF —
    // not on the rent or the food-and-warmth it cannot choose not to buy.
    //
    // M-MONEY2: SUMMED OVER THE UNITS UNDER THE ROOF, each charged for its
    // own mouths, its own share of the rent and its own lifestyle. It used
    // to be one figure for the whole house, which is what pooled a grown
    // adult's money with his parents'.
    let spending = 0
    let owed = 0
    for (const unit of unitsUnder(world, household)) {
      const theirs = discretionaryForUnit(world, household, unit)
      spending += theirs
      owed += unitCosts(world, household, unit) + theirs + salesTaxOn(theirs as Money)
    }

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

  runNpcVentures(world, tick)
  runBusinesses(world, tick)
  runPlans(world, tick)
  runInsolvency(world, tick)
  rehouseIfAble(world, tick)
  pushArrearsHouseholdsToCheaperRent(world, tick)
}

/**
 * INSOLVENCY IS RESOLVED THROUGH A SYSTEM, ALWAYS (M-SAFETY §1-2).
 *
 * THIS REPLACES A HACK OF MY OWN. The last build capped runaway arrears by
 * writing them off after two years. It stopped the number being absurd and
 * left the mechanism dishonest: debt does not evaporate on a timer, and a
 * silent reset is not a recovery path, it is a hack wearing one. The
 * owner's instruction was to overrule it and build the real thing, which
 * this is - and the write-off, and the `debt-written-off` event with it,
 * are gone.
 *
 * A household that is genuinely insolvent - owing more than eighteen months
 * of everything its people earn, or owing anything at all with nothing
 * coming in - goes onto the bankruptcy track. The player is ASKED which
 * chapter, where more than one is open to them; NPCs are routed on the same
 * numbers, which is the parity rule.
 */
function runInsolvency(world: World, tick: Tick): void {
  // The means test is against what this town actually earns, so it moves
  // with the economy instead of being a number typed once.
  const spare: number[] = []
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null) continue
    spare.push(householdIncome(world, household) - householdCosts(world, household))
  }
  const townMedian = medianMonthlyIncome(spare)

  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    if (household.dissolvedTick !== null) continue

    // WHO IS ACTUALLY INSOLVENT UNDER THIS ROOF.
    //
    // Not only the household that cannot make rent. A person can be square
    // with their landlord and buried in loans, and that person is exactly
    // who a repayment plan is for — measured, the first version looked only
    // at arrears, and so chapter 13 never once fired in four centuries
    // while chapter 7 fired 195 times. Both roads have to be real.
    const arrears = Math.max(0, -household.savings)
    const debtors = [...household.memberIds]
      .map((id) => world.people.get(id))
      .filter((member): member is Person => member !== undefined && member.deathTick === null)
      .filter((member) => totalDebtOf(accountsOf(world, member.id).loans) > 0)
    if (arrears <= 0 && debtors.length === 0) continue

    const head =
      arrears > 0
        ? eldestMember(world, household)
        : debtors.sort(
            (a, b) =>
              totalDebtOf(accountsOf(world, b.id).loans) -
                totalDebtOf(accountsOf(world, a.id).loans) || a.id - b.id,
          )[0]
    if (!head) continue
    // A filing already running is doing this job. Let the plan run.
    if (underStay(world, head.id, tick)) continue

    // ASKED AND ANSWERED. Somebody who said they would trade their way out
    // is not asked again for a year. Scoped to the person, because the log
    // is never cleared on succession and an unscoped read would let one
    // life's refusal silence the question for every heir after them — the
    // trap this file has now fallen into five times (ADR-0033).
    const refusedAt = world.player.log
      .filter(
        (entry) =>
          entry.kind === 'bankruptcy' &&
          entry.choice === 'ride-it-out' &&
          entry.personId === head.id,
      )
      .reduce((latest, entry) => (entry.tick > latest ? entry.tick : latest), -1)
    if (refusedAt >= 0 && tick - refusedAt < 12) continue

    const accounts = accountsOf(world, head.id)
    // WHAT THEY CANNOT SERVICE, not what they owe. A mortgage in good
    // standing is not insolvency (owner, playing) — the missed payments on
    // it are, and those are counted.
    const owed = distressDebtOf(accounts, household.savings)
    const income = householdIncome(world, household)
    const costs = householdCosts(world, household)
    if (!isInsolvent(owed, income, costs)) continue

    const open = chaptersOpenTo(world, head.id, income - costs, townMedian, tick)
    if (open.length === 0) {
      // THE COURTHOUSE IS SHUT TO THEM - they filed too recently. That
      // cannot mean the debt free-falls instead: measured, it took a run to
      // -$680,582 with the bankruptcy system already in. What actually
      // happens to somebody who cannot file and cannot pay is that they
      // lose the housing, which stops the rent that was compounding.
      if (household.homelessSinceTick === null) loseHousing(world, tick, household, head)
      continue
    }

    if (head.id === world.player.personId) {
      const raised = raisePending(world, {
        tick,
        kind: 'bankruptcy',
        personId: head.id,
        otherId: null,
        occupationId: open.join('/'),
        workplaceId: null,
        monthlyPay: owed,
        placeId: null,
        // AND THEY CAN SAY NO (owner: "we should have to actually file
        // ourselves for bankruptcy"). The court does not drag anybody
        // through its door; a person in trouble is entitled to try to
        // trade their way out of it, and plenty do.
        //
        // Refusing is not free and is not meant to be. Nothing is
        // discharged, no stay goes up, the arrears keep compounding and
        // the housing is still at the end of that road. But the question
        // does not come back next month: a prompt that will not take no
        // for an answer is not a choice, it is a delay. A year, and then
        // the court asks again if they are still under.
        options: [...open.map((chapter) => `chapter-${String(chapter)}`), 'ride-it-out'],
      })
      if (raised) continue
    }

    // NPCs, and a player whose slot was full: the court routes them. Where
    // both are open the honest default is the one that keeps the home - a
    // plan is what a person with income is actually put on.
    fileBankruptcy(world, tick, head.id, open.includes(13) ? 13 : 7)
  }
}

/**
 * THE FILING ITSELF. Money moves here, because this module is the only
 * thing that may move it.
 *
 * Chapter 7 liquidates what is not exempt and discharges the rest, at once.
 * Chapter 13 opens a plan: nothing is discharged today, the stay goes up,
 * and the payments come out month by month until the term is served.
 */
export function fileBankruptcy(
  world: World,
  tick: Tick,
  personId: EntityId,
  chapter: BankruptcyChapter,
): Bankruptcy | undefined {
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return undefined
  const household = world.households.get(person.householdId)
  if (!household) return undefined

  const accounts = accountsOf(world, personId)
  const arrears = Math.max(0, -household.savings)
  const owed = totalOwedBy(accounts, household.savings)
  if (owed <= 0) return undefined
  // THE PLAN IS SIZED ON THE FILER'S OWN SPARE MONEY, not the household's.
  //
  // MEASURED, and this was the whole reason plans could not be kept: the
  // payment came out of ONE person's checking while being computed from
  // what the WHOLE roof had spare. Where the filer was not the main earner,
  // the payment took money their share of the rent needed, the settle could
  // not collect it, and the arrears the plan existed to end started
  // rebuilding the month it began. 150 plans dismissed against 2 completed.
  const disposable = personalMonthlyNet(world, personId)

  let filing: Bankruptcy
  if (chapter === 13) {
    const months = planMonthsFor(owed, disposable)
    filing = {
      personId,
      chapter: 13,
      filedAtTick: tick,
      owed,
      planMonthly: planPaymentFor(owed, disposable, months),
      planEndsAtTick: (tick + months) as Tick,
      dischargedAtTick: null,
      discharged: 0 as Money,
    }
    // THE STAY GOES UP AND THE ARREARS STOP RUNNING. The debt is not gone -
    // it is on a schedule, which is the whole difference from the write-off.
    world.households.set(household.id, { ...household, savings: 0 as Money })
    noteArrearsCrossing(world, tick, household.id, household.savings)
  } else {
    // Chapter 7. What is not exempt is sold; the homestead allowance and
    // essential property come through, so nobody is stripped to nothing.
    const liquid = (accounts.checking + accounts.savings) as Money
    const exempt = Math.min(liquid, PROPERTY_EXEMPTION)
    const sold = Math.max(0, liquid - exempt)
    const homeValue = homeValueOf(world, personId)
    const keepsHome = homeValue <= HOMESTEAD_EXEMPTION
    setAccounts(world, {
      ...accounts,
      checking: 0 as Money,
      savings: exempt as Money,
      // A brokerage account is not exempt. The retirement account is,
      // which is the whole reason it exists.
      holdings: [],
      brokerage: 0 as Money,
      // Unsecured debt is discharged. A mortgage on a home they keep is
      // secured and survives - that is the difference between the two.
      loans: keepsHome ? accounts.loans.filter((loan) => loan.kind === 'mortgage') : [],
      homePlaceId: keepsHome ? accounts.homePlaceId : null,
      homePurchasePrice: keepsHome ? accounts.homePurchasePrice : (0 as Money),
    })
    world.households.set(household.id, { ...household, savings: 0 as Money })
    noteArrearsCrossing(world, tick, household.id, household.savings)
    filing = {
      personId,
      chapter: 7,
      filedAtTick: tick,
      owed,
      planMonthly: 0 as Money,
      planEndsAtTick: null,
      dischargedAtTick: tick,
      discharged: Math.max(0, owed - sold) as Money,
    }
  }

  world.bankruptcies.set(personId, [...(world.bankruptcies.get(personId) ?? []), filing])
  recordEvent(world, tick, {
    type: 'filed-bankruptcy',
    subjectId: personId,
    detail: `${String(chapter)}:${String(owed)}`,
  })
  if (filing.dischargedAtTick !== null) {
    recordEvent(world, tick, {
      type: 'debt-discharged',
      subjectId: personId,
      detail: String(filing.discharged),
    })
  }
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'spending',
    significance: 'defining',
    inputs: [
      factor('own-choice', 700),
      factor('in-arrears', Math.min(1000, Math.floor(arrears / 1000))),
    ],
    chosen: chapter === 7 ? 'filed for liquidation' : 'filed a repayment plan',
    rejected: [chapter === 7 ? 'a repayment plan' : 'liquidation'],
    streamId: Stream.Economy,
  })
  return filing
}

/**
 * How far behind a household may fall while a plan is running before the
 * court gives up on it. Half a year of its own costs: enough that a bad
 * month does not end a plan, little enough that it cannot hide a spiral.
 */
const PLAN_FAILURE_MONTHS = 6

/**
 * A PLAN RUNNING. The payment comes out each month, and when the term is
 * served whatever is left is discharged and the file is clean.
 */
function runPlans(world: World, tick: Tick): void {
  for (const personId of [...world.bankruptcies.keys()].sort((a, b) => a - b)) {
    const filings = world.bankruptcies.get(personId) ?? []
    const index = filings.findIndex(
      (entry) => entry.dischargedAtTick === null && entry.planEndsAtTick !== null,
    )
    if (index < 0) continue
    const filing = filings[index]
    if (!filing) continue

    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) {
      // Death ends a plan. The debt does not follow anybody else.
      const ended = { ...filing, dischargedAtTick: tick, discharged: 0 as Money }
      world.bankruptcies.set(
        personId,
        filings.map((entry, i) => (i === index ? ended : entry)),
      )
      continue
    }

    const accounts = accountsOf(world, personId)
    const fromChecking = Math.max(0, Math.min(filing.planMonthly, accounts.checking))
    const fromSavings = Math.max(0, Math.min(filing.planMonthly - fromChecking, accounts.savings))
    if (fromChecking + fromSavings > 0) {
      setAccounts(world, {
        ...accounts,
        checking: (accounts.checking - fromChecking) as Money,
        savings: (accounts.savings - fromSavings) as Money,
        // Months met under a plan build the file back the same way months
        // met on a loan do. It is the same thing: a record of paying.
        monthsPaid: accounts.monthsPaid + 1,
      })
    }

    // THE PLAN CAN FAIL, and it must be able to. Measured: without this a
    // household under a stay went on falling behind for the whole three to
    // five years of its plan - rent does not stop for a court - and one run
    // still reached -$680,582 with the bankruptcy system already in.
    //
    // A real plan is DISMISSED when the debtor cannot keep up with it. The
    // stay lifts, nothing is discharged, and next month the ordinary track
    // takes over: liquidation if the means test now passes, and the housing
    // if it does not. That is the honest failure mode, and it is bounded.
    const household =
      person.householdId === null ? undefined : world.households.get(person.householdId)
    if (household !== undefined) {
      const behind = Math.max(0, -household.savings)
      if (behind > householdCosts(world, household) * PLAN_FAILURE_MONTHS) {
        const dismissed = { ...filing, dischargedAtTick: tick, discharged: 0 as Money }
        world.bankruptcies.set(
          personId,
          filings.map((entry, i) => (i === index ? dismissed : entry)),
        )
        recordEvent(world, tick, {
          type: 'plan-dismissed',
          subjectId: personId,
          detail: String(behind),
        })
        continue
      }
    }

    if (tick < (filing.planEndsAtTick ?? 0)) continue

    // TERM SERVED. What is left is discharged and they walk out of it clean,
    // which is the recovery path Law 7 asks for.
    const done = {
      ...filing,
      dischargedAtTick: tick,
      discharged: dischargedAtEndOf(filing),
    }
    world.bankruptcies.set(
      personId,
      filings.map((entry, i) => (i === index ? done : entry)),
    )
    recordEvent(world, tick, {
      type: 'plan-completed',
      subjectId: personId,
      detail: String(filing.owed),
    })
    recordEvent(world, tick, {
      type: 'debt-discharged',
      subjectId: personId,
      detail: String(done.discharged),
    })
  }
}

/**
 * What a completed plan writes off: everything the plan base did not cover.
 *
 * BUG, found while building the early payoff (ADR-0038). This used
 * `PLAN_MONTHS_MIN` — a flat 36 — for every plan, but `planMonthsFor`
 * returns anything from 36 to 60. A sixty-month plan therefore credited the
 * filer with 36 months of payments they had actually made 60 of, and the
 * life story told them a larger sum had been discharged than really was.
 * The longer the plan, the bigger the overstatement: at the sixty-month end
 * it claimed two extra years of payments had been forgiven.
 *
 * The plan's real length is on the filing — `planEndsAtTick` minus
 * `filedAtTick` — and that is what was paid into it.
 */
function dischargedAtEndOf(filing: Bankruptcy): Money {
  const months =
    filing.planEndsAtTick === null
      ? PLAN_MONTHS_MIN
      : Math.max(0, filing.planEndsAtTick - filing.filedAtTick)
  return Math.max(0, filing.owed - filing.planMonthly * months) as Money
}

/**
 * ADR-0038. SETTLE THE PLAN AND WALK OUT OF IT.
 *
 * Pays every remaining scheduled payment at once and discharges the filing.
 * What is discharged is what the plan would have wiped at its natural end,
 * so the record reads the same either way — the person paid the base and
 * the court let the rest go.
 *
 * THE FILING ITSELF DOES NOT VANISH. It sits on the file for its seven
 * years exactly as before, and the credit penalty runs its course. Paying
 * early buys the months back and stops the money leaving; it does not buy
 * a clean history, because that is not a thing money buys.
 */
export function payOffPlan(world: World, tick: Tick, personId: EntityId): boolean {
  const filings = world.bankruptcies.get(personId) ?? []
  const index = filings.findIndex(
    (entry) => entry.dischargedAtTick === null && entry.planEndsAtTick !== null,
  )
  if (index < 0) return false
  const filing = filings[index]
  if (!filing) return false

  const accounts = accountsOf(world, personId)
  const cash = (accounts.checking + accounts.savings) as Money
  if (planPayoffBar(filing, cash, tick) !== null) return false

  const due = planPayoffFor(filing, tick)
  const fromChecking = Math.min(due, accounts.checking)
  const fromSavings = due - fromChecking
  setAccounts(world, {
    ...accounts,
    checking: (accounts.checking - fromChecking) as Money,
    savings: (accounts.savings - fromSavings) as Money,
    // Settling in full is the strongest month of paying there is.
    monthsPaid: accounts.monthsPaid + 1,
  })

  const settled = {
    ...filing,
    dischargedAtTick: tick,
    // The same figure either way: settling early pays the remaining months
    // up front, so the same plan base was paid and the same balance falls
    // away. Somebody who pays it off should not read a different number in
    // their own life story than somebody who waited it out.
    discharged: dischargedAtEndOf(filing),
  }
  world.bankruptcies.set(
    personId,
    filings.map((entry, i) => (i === index ? settled : entry)),
  )
  recordEvent(world, tick, {
    type: 'plan-completed',
    subjectId: personId,
    detail: String(filing.owed),
  })
  recordEvent(world, tick, {
    type: 'debt-discharged',
    subjectId: personId,
    detail: String(settled.discharged),
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'spending',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('steady-pay', Math.floor(due / 1000))],
    chosen: 'paid the plan off and closed the bankruptcy',
    rejected: ['serving out the plan'],
    streamId: Stream.Economy,
  })
  return true
}

/**
 * M-SAFETY §3. THE ROOF GOES.
 *
 * No rent is charged from here (householdCosts drops to a shelter figure),
 * which is what stops the free-fall at its source. Everything else about it
 * is bad: health, work, relationships and exposure to crime all read the
 * state. What it is NOT is a dead end - `rehouseIfAble` below is checked
 * every month, and income buys a room back.
 */
function loseHousing(world: World, tick: Tick, household: Household, head: Person): void {
  if (household.homelessSinceTick !== null) return
  world.households.set(household.id, {
    ...household,
    homelessSinceTick: tick,
    // The arrears stop here. There is no longer a rent to be behind on, and
    // carrying the old balance forward would be billing them for a house
    // they were put out of.
    savings: 0 as Money,
  })
  noteArrearsCrossing(world, tick, household.id, household.savings)
  recordEvent(world, tick, {
    type: 'lost-housing',
    subjectId: head.id,
    placeId: household.placeId,
    detail: String(household.id),
  })
  recordDecision(world, tick, {
    subjectId: head.id,
    decision: 'move',
    significance: 'defining',
    inputs: [factor('in-arrears', 1000), factor('cheaper-rent', 0)],
    chosen: 'lost the housing',
    rejected: ['somewhere cheaper to go'],
    streamId: Stream.Economy,
  })
}

/**
 * M-SAFETY §3. THE WAY BACK IN.
 *
 * The bottom of the ladder is a rung, not a hole. A household with enough
 * coming in to carry the cheapest street in town takes it - and because the
 * safety net puts a floor under everybody, that is a state which is actually
 * reachable from destitution rather than in theory only.
 */
function rehouseIfAble(world: World, tick: Tick): void {
  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) return
  const cheapest = [...neighbourhoods].sort((a, b) => a.desirability - b.desirability)[0]
  if (!cheapest) return

  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    if (household.dissolvedTick !== null || household.homelessSinceTick === null) continue
    const income = householdIncome(world, household)
    // Enough to carry the WHOLE month at that address - the rent and every
    // mouth in the house - not merely the rent and one adult. Measured: the
    // looser test re-housed families into months they could not carry, and
    // they lost it again within the year. A door back has to be a door to
    // somewhere they can stay.
    let mouths = 0
    for (const memberId of household.memberIds) {
      const member = world.people.get(memberId)
      if (!member || member.deathTick !== null) continue
      mouths +=
        ageAt(member.birthTick, tick) >= ADULT_COST_AGE
          ? livingCostAt(world, LIVING_COST_ADULT)
          : livingCostAt(world, LIVING_COST_CHILD)
    }
    if (income < rentAt(world, cheapest.desirability) + mouths) continue

    const head = eldestMember(world, household)
    world.households.set(household.id, {
      ...household,
      homelessSinceTick: null,
      placeId: cheapest.id,
      savings: 0 as Money,
    })
    // The crossing is an invariant of the FIELD, not of runFinances: any
    // writer that moves savings across zero owes the event. Leaving it out
    // here produced two `fell-behind` events in a row with no recovery
    // between them, and arrearsHistoryOf read that as one impossible spell.
    noteArrearsCrossing(world, tick, household.id, household.savings)
    if (head) {
      recordEvent(world, tick, {
        type: 'rehoused',
        subjectId: head.id,
        placeId: cheapest.id,
        detail: String(tick - household.homelessSinceTick),
      })
      recordDecision(world, tick, {
        subjectId: head.id,
        decision: 'move',
        significance: 'major',
        inputs: [factor('own-choice', 600), factor('cheaper-rent', 1000)],
        chosen: `took a place in ${cheapest.name}`,
        rejected: ['staying where they were'],
        streamId: Stream.Economy,
      })
    }
  }
}

/**
 * M-CAREER §5. THE CAPITAL GOES IN AND THE DOORS OPEN.
 *
 * Money out of savings then checking — it is spent, not staked, and there
 * is no version of this where it comes back untouched.
 */
export function openBusiness(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  kindId: string,
  capital: Money,
): boolean {
  const owner = world.people.get(ownerId)
  if (!owner || capital <= 0) return false
  const accounts = accountsOf(world, ownerId)
  if (accounts.savings + accounts.checking < capital) return false

  const fromSavings = Math.min(capital, accounts.savings)
  const fromChecking = capital - fromSavings
  setAccounts(world, {
    ...accounts,
    savings: (accounts.savings - fromSavings) as Money,
    checking: (accounts.checking - fromChecking) as Money,
  })

  const id = world.nextEntityId as EntityId
  world.nextEntityId += 1
  const rng = openStream(world.seed, Stream.Career, ownerId, tick + 11_500)
  world.businesses.set(id, {
    id,
    ownerId,
    kindId,
    name: businessNameFor(owner.familyName, kindId, rng.nextIntInclusive(0, 999)),
    foundedTick: tick,
    capital,
    employees: 0,
    badMonths: 0,
    closedTick: null,
    generations: 0,
  })
  recordEvent(world, tick, {
    type: 'opened-business',
    subjectId: ownerId,
    detail: world.businesses.get(id)?.name ?? kindId,
  })
  recordDecision(world, tick, {
    subjectId: ownerId,
    decision: 'employment-change',
    significance: 'defining',
    inputs: [factor('own-choice', 1000), factor('ambition', owner.traits.ambition)],
    chosen: `opened ${world.businesses.get(id)?.name ?? 'a business'}`,
    rejected: ['working for somebody else'],
    streamId: Stream.Career,
  })
  return true
}

/**
 * M-CAREER §5. A BUSINESS PASSES DOWN.
 *
 * The only thing in this world that keeps earning for somebody who did not
 * build it. Called from the estate, because that is where everything else a
 * person leaves is handed on — and if there is no heir it simply closes,
 * which is what happens to most of them.
 */
export function passOnBusinesses(world: World, tick: Tick, deceasedId: EntityId): void {
  // The eldest living child, or nobody. Worked out here rather than passed
  // in, because this is called on EVERY death — not only the ones that
  // empty a household, which is where distributeEstate lives and is
  // exactly the gap a test caught: a business went on trading for decades
  // under an owner who had died in a house with other people in it.
  const heirId =
    [...world.people.values()]
      .filter((person) => person.deathTick === null && person.parentIds.includes(deceasedId))
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]?.id ?? null
  for (const business of [...world.businesses.values()].sort((a, b) => a.id - b.id)) {
    if (business.ownerId !== deceasedId || business.closedTick !== null) continue
    if (heirId === null) {
      world.businesses.set(business.id, { ...business, closedTick: tick })
      recordEvent(world, tick, {
        type: 'business-closed',
        subjectId: deceasedId,
        detail: business.name,
      })
      continue
    }
    world.businesses.set(business.id, {
      ...business,
      ownerId: heirId,
      generations: business.generations + 1,
    })
    recordEvent(world, tick, {
      type: 'inherited-business',
      subjectId: heirId,
      otherId: deceasedId,
      detail: business.name,
    })
  }
}

/**
 * M-CAREER §5. THE TOWN'S OWN ENTREPRENEURS.
 *
 * The player is not the only person who can go into business. An ambitious
 * adult with enough put by to cover a trade's capital AND a year of living
 * afterwards will take the risk — rarely, because most people do not.
 *
 * Without this the register held exactly one business per world, the
 * player's, which would make "business owners both succeed and fail" a
 * claim about a sample of one.
 */
function runNpcVentures(world: World, tick: Tick): void {
  if (tick % 6 !== 3) return // twice a year, on a fixed month
  for (const person of [...world.people.values()].sort((a, b) => a.id - b.id)) {
    if (person.deathTick !== null || person.id === world.player.personId) continue
    const age = ageAt(person.birthTick, tick)
    if (age < 24 || age > 62) continue
    if (person.traits.ambition < 620) continue
    if ([...world.businesses.values()].some((b) => b.ownerId === person.id && b.closedTick === null)) {
      continue
    }
    const accounts = accountsOf(world, person.id)
    const cash = (accounts.savings + accounts.checking) as Money
    const keepBy = livingCostAt(world, LIVING_COST_ADULT) * 12
    // The biggest trade they could open and still have a year to live on.
    const kind = [...BUSINESS_KINDS]
      .sort((a, b) => b.capital - a.capital)
      .find((entry) => cash - keepBy >= atTodaysPrices(world, entry.capital))
    if (!kind) continue

    const rng = openStream(world.seed, Stream.Career, person.id, tick + 11_900)
    if (!rng.chance(35 + Math.floor(person.traits.ambition / 20), 1000)) continue
    openBusiness(world, tick, person.id, kind.id, atTodaysPrices(world, kind.capital) as Money)
  }
}

/**
 * M-CAREER §5. THE MONTH A BUSINESS HAD.
 *
 * Profit lands in the owner's own checking, which is what makes it income
 * rather than a score. A loss comes out of the CAPITAL first — a business
 * absorbs its own bad months, which is what capital is for — and only what
 * the capital cannot absorb touches the owner. Three consecutive months in
 * the red and the doors shut.
 */
function runBusinesses(world: World, tick: Tick): void {
  for (const id of [...world.businesses.keys()].sort((a, b) => a - b)) {
    const business = world.businesses.get(id)
    if (!business || business.closedTick !== null) continue
    const owner = world.people.get(business.ownerId)
    const kind = businessKindById(business.kindId)
    if (!kind) continue

    // A dead owner's business waits for probate — distributeEstate hands it
    // on. It does not trade in the meantime.
    if (!owner || owner.deathTick !== null) continue

    const rng = openStream(world.seed, Stream.Career, business.id, tick + 11_000)
    const swing = rng.nextIntInclusive(-980, 980)
    const profit = monthlyProfitFor(
      business,
      kind,
      world.economy.phase,
      world.economy.growthPerMille,
      owner.traits.diligence,
      swing,
    )

    if (profit >= 0) {
      // A share is drawn as income and the rest is retained, which is how a
      // business grows into a bigger one without a second mechanism.
      //
      // UP TO A CEILING. Unbounded retention compounds: measured, a century
      // of it left one owner holding $386 billion. Past four times what the
      // trade took to open, the whole profit is drawn instead — there is
      // only so much capital one shop can absorb.
      const ceiling = (atTodaysPrices(world, kind.capital) * CAPITAL_CEILING_MULTIPLE) as Money
      const room = Math.max(0, ceiling - business.capital)
      const retained = Math.min(Math.floor((profit * 300) / 1000), room)
      const drawn = (profit - retained) as Money
      creditPerson(world, business.ownerId, drawn)
      world.businesses.set(business.id, {
        ...business,
        capital: (business.capital + retained) as Money,
        badMonths: 0,
      })
      continue
    }

    const loss = -profit
    const fromCapital = Math.min(loss, business.capital)
    const badMonths = business.badMonths + 1
    if (badMonths >= BUSINESS_FAILS_AFTER || fromCapital < loss) {
      // IT CLOSES. What is left of the capital comes back to the owner, and
      // it is always less than went in.
      world.businesses.set(business.id, {
        ...business,
        capital: 0 as Money,
        badMonths,
        closedTick: tick,
      })
      creditPerson(world, business.ownerId, Math.max(0, business.capital - loss) as Money)
      recordEvent(world, tick, {
        type: 'business-closed',
        subjectId: business.ownerId,
        detail: business.name,
      })
      recordDecision(world, tick, {
        subjectId: business.ownerId,
        decision: 'employment-change',
        significance: 'major',
        inputs: [
          factor('economy-turned', Math.min(1000, Math.abs(world.economy.growthPerMille) * 40)),
          factor('poor-performance', 1000 - owner.traits.diligence),
        ],
        chosen: `closed ${business.name}`,
        rejected: ['carrying it another month'],
        streamId: Stream.Career,
      })
      continue
    }
    world.businesses.set(world.businesses.get(business.id)!.id, {
      ...business,
      capital: (business.capital - fromCapital) as Money,
      badMonths,
    })
  }
}

/**
 * M-SAFETY §4. THE INSURANCE STARTS. Called by the layoff, and only by the
 * layoff — the qualifying condition is the whole point of it.
 */
export function startUnemployment(world: World, personId: EntityId, tick: Tick): void {
  const accounts = accountsOf(world, personId)
  if (accounts.lastMonthlyPay <= 0) return
  setAccounts(world, {
    ...accounts,
    unemploymentUntilTick: (tick + UNEMPLOYMENT_MONTHS) as Tick,
  })
  recordEvent(world, tick, { type: 'drew-unemployment', subjectId: personId })
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
      625,
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

    const owed = incomeTaxFor(accounts.taxableYtd, world.economy.priceLevelPerMille)
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
    const head = eldestMember(world, household)
    if (!head) continue

    // M-SAFETY §2. THE AUTOMATIC STAY. Nobody is moved out over money while
    // a filing is running - that is what a stay is for.
    if (underStay(world, head.id, tick)) continue

    const target = cheaper[0]
    if (!target) {
      // M-SAFETY §3. ALREADY AT THE BOTTOM OF TOWN. This used to be where
      // the model gave up - "nothing to sell but time" - and the arrears
      // simply went on compounding on a rent nobody could pay. They lose
      // the housing instead, which is a real state with real consequences
      // and, unlike an infinite debt, a way back out of it.
      loseHousing(world, tick, household, head)
      continue
    }

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
  const passing = (gross - estateTaxOn(gross, world.economy.priceLevelPerMille)) as Money
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
    monthsWorked: 0,
    lastMonthlyPay: 0 as Money,
    unemploymentUntilTick: null,
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
