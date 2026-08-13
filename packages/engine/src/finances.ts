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
import { LIVING_COST_ADULT, LIVING_COST_CHILD, PRIVATE_SCHOOL_TUITION, rentFor } from './content.js'
import { ageAt, toDate } from './clock.js'
import { raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { spouseOf } from './relationships.js'
import { outOfPocketFor } from './benefits.js'
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
import {
  SECTORS,
  dividendOn,
  holdingKeyOf,
  holdingValue,
  portfolioValue,
  sharesFor,
  stockById,
  unitsFor,
} from './market.js'
import { openStream, Stream } from './rng.js'
import {
  DEPOSIT_MONTHS,
  LEASE_MONTHS,
  isVacant,
  leaseBar,
  propertiesOwnedBy,
  rentOf as propertyRentOf,
  runNeighbourhoodDrift,
  saleProceedsOf,
  setOwner,
  useRentCurve,
  valueOf as propertyValueOf,
} from './realestate.js'
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
import { sportsWageOf } from './sports.js'
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
  COMPANY_CEILING_MULTIPLE,
  founderSalaryOf,
  businessKindById,
  businessNameFor,
  kindAvailableIn,
  monthlyProfitFor,
} from './business.js'

/** Months of arrears before a household is pushed toward cheaper rent. */
const ARREARS_PATIENCE_MONTHS = 4
// Referenced only by the retired eviction machinery; kept for the record.
void ARREARS_PATIENCE_MONTHS

/** An adult is a full mouth to feed from this age. */
const ADULT_COST_AGE = 16

// ---------------------------------------------------------------------------
// Queries — the read side other systems and the UI use
// ---------------------------------------------------------------------------

/**
 * ONE PERSON'S ACCOUNTS. Absent means zero — reading is total, so nothing
 * has to create an account before somebody is paid.
 */
/**
 * THE WEDDING MERGE (H0). Two wallets become one on the day: the liquid
 * money of the higher-id spouse moves onto the joint record, one recorded
 * transfer, to the cent. Everything else stays where it was.
 */
export function mergeWalletsOnMarriage(world: World, a: EntityId, b: EntityId): void {
  const holder = a < b ? a : b
  const other = a < b ? b : a
  const from = accountsOf(world, other)
  const into = accountsOf(world, holder)
  if (from.checking === 0 && from.savings === 0) return
  setAccounts(world, {
    ...into,
    checking: (into.checking + from.checking) as Money,
    savings: (into.savings + from.savings) as Money,
  })
  setAccounts(world, { ...from, checking: 0 as Money, savings: 0 as Money })
}

/**
 * THE DIVORCE SPLIT (H0, owner-confirmed): liquid money 50/50, the odd
 * cent to the one who keeps the deed — somebody has to get it, and the
 * house is the bigger half of most settlements anyway. Deeds, loans and
 * pensions never moved, so there is nothing else to divide.
 */
export function splitWalletOnDivorce(world: World, a: EntityId, b: EntityId): void {
  const holder = a < b ? a : b
  const other = a < b ? b : a
  const joint = accountsOf(world, holder)
  const otherRecord = accountsOf(world, other)
  /**
   * POOL BOTH SIDES FIRST. A couple married before the merge existed — a
   * founding couple, or a live save — can still carry liquid on the
   * non-holder record; a split that only read the joint record stranded
   * that half (a conservation test caught exactly this). Every cent on
   * either record goes into the pool, and the pool splits.
   */
  const liquid = joint.checking + joint.savings + otherRecord.checking + otherRecord.savings
  const half = Math.floor(liquid / 2)
  setAccounts(world, {
    ...joint,
    checking: (liquid - half) as Money,
    savings: 0 as Money,
  })
  setAccounts(world, { ...otherRecord, checking: half as Money, savings: 0 as Money })
}

/**
 * SURVIVORSHIP (H0). When the wallet HOLDER dies married, the joint pot
 * passes whole to the survivor before the estate does anything else — the
 * money was already both of theirs. When the non-holder dies, the pot is
 * already where it belongs.
 */
export function passWalletToSurvivor(world: World, deceased: EntityId, survivor: EntityId): void {
  // THE SURVIVOR INHERITS THE ACCOUNT WHOLE (H0 §1) — not just the joint
  // liquid. A higher-id spouse's raw record still carries their personal
  // brokerage and retirement, and moving only checking and savings left
  // those stranded on a dead person's ledger forever.
  const from = accountsOf(world, deceased)
  const into = accountsOf(world, survivor)
  if (
    from.checking === 0 && from.savings === 0 && from.brokerage === 0 &&
    from.retirement === 0 && from.holdings.length === 0 && from.retirementHoldings.length === 0
  ) {
    return
  }
  // POSITIONS MERGE BY KEY, never concatenate: the sell path finds ONE fund
  // position per sector, so a widow holding her own agricultural fund and
  // her late husband's as two rows could only ever sell the first of them.
  const mergeHoldings = (mine: readonly Holding[], theirs: readonly Holding[]): Holding[] => {
    const merged = [...mine]
    for (const holding of theirs) {
      const at = merged.findIndex(
        (h) => h.sectorId === holding.sectorId && h.stockId === holding.stockId,
      )
      if (at === -1) {
        merged.push(holding)
      } else {
        const existing = merged[at]
        if (existing !== undefined) {
          merged[at] = {
            ...existing,
            units: existing.units + holding.units,
            costBasis: (existing.costBasis + holding.costBasis) as Money,
          }
        }
      }
    }
    return merged.sort((a, b) =>
      holdingKeyOf(a) < holdingKeyOf(b) ? -1 : holdingKeyOf(a) > holdingKeyOf(b) ? 1 : 0,
    )
  }
  setAccounts(world, {
    ...into,
    checking: (into.checking + from.checking) as Money,
    savings: (into.savings + from.savings) as Money,
    brokerage: (into.brokerage + from.brokerage) as Money,
    retirement: (into.retirement + from.retirement) as Money,
    holdings: mergeHoldings(into.holdings, from.holdings),
    retirementHoldings: mergeHoldings(into.retirementHoldings, from.retirementHoldings),
  })
  setAccounts(world, {
    ...from,
    checking: 0 as Money,
    savings: 0 as Money,
    brokerage: 0 as Money,
    retirement: 0 as Money,
    holdings: [],
    retirementHoldings: [],
  })
}

/**
 * HOW FAR BEHIND THIS HOUSEHOLD IS (H0). Arrears are a negative balance on
 * the HEAD COUPLE'S wallet now — visible on the player's own Money tab —
 * not a number on a building. Positive return = cents behind; zero = square.
 */
export function arrearsOf(world: World, household: Household): Money {
  const head = eldestMember(world, household)
  if (head === undefined) return 0 as Money
  const wallet = walletOf(world, head.id)
  const liquid = wallet.checking + wallet.savings
  return (liquid < 0 ? -liquid : 0) as Money
}

/**
 * THE WALLET — where this person's LIQUID money actually lives (H0, the
 * owner's rule: "what's your money is yours and if you get married y'all
 * combine that").
 *
 * A married couple is one wallet: both spouses resolve to the LOWER
 * personId's account record for checking and savings, derived from the
 * marriage itself — no stored link to drift, no second entity to migrate.
 * Everything that is not liquid money stays on the person's own record:
 * pension months, tax year, the home deed, loans. The rule is about money,
 * and blanket-routing the whole record would hand one spouse the other's
 * seniority.
 *
 * Every liquid movement (creditPerson / debitPerson) and every liquid read
 * must go through here. Reading accountsOf directly for a balance is now a
 * bug by definition.
 */
export function walletHolderOf(world: World, personId: EntityId): EntityId {
  const spouse = spouseOf(world, personId)
  if (spouse === null) return personId
  return (spouse < personId ? spouse : personId) as EntityId
}

export function walletOf(world: World, personId: EntityId): Accounts {
  return accountsOf(world, walletHolderOf(world, personId))
}

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
  // H0: a married couple's liquid money is ONE balance, and either of them
  // can spend it this afternoon — so this reads the WALLET, not the raw
  // record. Reading the raw record made a higher-id spouse look penniless
  // while every credit routed to the joint account.
  const a = walletOf(world, personId)
  return (a.checking + a.savings) as Money
}

/** Everything a person holds in money. Property and debt join it later. */
/**
 * THIS PERSON'S SHARE OF THE LIQUID MONEY (H0).
 *
 * A married couple hold ONE balance, on the lower-id spouse's record. Net
 * worth has to answer two questions at once without lying to either:
 * summed across a household it must not count that balance twice, and read
 * for one person it must not report a spouse as penniless. So the joint
 * money splits down the middle — the same rule a divorce uses — with the
 * odd cent to the holder, which means the two halves always add back to
 * exactly the joint total.
 *
 * MEASURED BUG THIS FIXES: a married non-holder's net worth counted their
 * own LOANS but none of the couple's cash, so borrowing $8,000 read as
 * minus $8,000 of wealth.
 */
function liquidShareOf(world: World, personId: EntityId): number {
  const wallet = walletOf(world, personId)
  const joint = wallet.checking + wallet.savings
  const spouse = spouseOf(world, personId)
  const shared = spouse !== null && walletHolderOf(world, spouse) === wallet.personId
  if (!shared) return joint
  const half = Math.floor(joint / 2)
  return personId === wallet.personId ? joint - half : half
}

export function netWorthOf(world: World, personId: EntityId): Money {
  const a = accountsOf(world, personId)
  return (liquidShareOf(world, personId) +
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
 * A YEAR OF TUITION, PAID OR BORROWED (education master §3).
 *
 * THE SINGLE-WRITER SEAM. Education decides who owes a year and how much;
 * this decides where the money comes from, because finances owns cents and
 * debt and the schoolhouse owns neither. Education calls this and is told
 * what happened; it never touches an account.
 *
 * Savings first, and only the shortfall is borrowed — somebody who can
 * pay for a year pays for it, which is what makes a wealthy family's
 * degree genuinely cheaper than a poor one's rather than just faster.
 *
 * CHARGED BY THE YEAR, NOT BY THE COURSE, and that is not a detail: a
 * person who leaves after one year must owe one year. Billing the whole
 * degree at enrolment would make dropping out in the first term cost
 * exactly as much as finishing, which would be a lie the moment the
 * dropout path exists.
 *
 * Returns the amount that had to be borrowed, so the caller can say so.
 */
export function chargeTuition(
  world: World,
  tick: Tick,
  personId: EntityId,
  amount: Money,
): Money {
  if (amount <= 0) return 0 as Money
  const paid = debitPerson(world, personId, amount)
  const shortfall = (amount - paid) as Money
  if (shortfall <= 0) return 0 as Money

  const accounts = accountsOf(world, personId)
  const existing = accounts.loans.find((loan) => loan.kind === 'student')
  if (existing === undefined) {
    // takeLoan puts the principal in savings; the tuition is then taken
    // straight back out of it. Routing it this way rather than inventing
    // a second path means the debt is recorded exactly as every other
    // loan in the game is, with one rate fixed at one signing.
    if (!takeLoan(world, tick, personId, 'student', shortfall)) return 0 as Money
    debitPerson(world, personId, shortfall)
    return shortfall
  }

  // A SECOND YEAR ON THE SAME DEBT. The rate stays the one signed in the
  // first year — a loan does not re-price, which is the whole reason the
  // month you signed matters — and the payment is re-struck over whatever
  // term is left so the thing still finishes.
  const monthsLeft = Math.max(12, existing.maturesAtTick - tick)
  const principal = (existing.principal + shortfall) as Money
  const balance = (existing.balance + shortfall) as Money
  setAccounts(world, {
    ...accounts,
    loans: accounts.loans.map((loan) =>
      loan.kind === 'student'
        ? {
            ...loan,
            principal,
            balance,
            monthlyPayment: monthlyPaymentFor(balance, loan.ratePerMille, monthsLeft),
          }
        : loan,
    ),
  })
  recordEvent(world, tick, {
    type: 'took-loan',
    subjectId: personId,
    detail: 'student:' + String(shortfall),
  })
  return shortfall
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
  // PRINCIPAL TO THE WALLET, LOAN TO THE FILE (H0). Wallet first, file
  // re-read after — for an unmarried borrower they are one record.
  {
    const wallet = walletOf(world, personId)
    setAccounts(world, { ...wallet, savings: (wallet.savings + principal) as Money })
  }
  setAccounts(world, {
    ...accountsOf(world, personId),
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
  // OWNING ONE NO LONGER STOPS YOU BUYING ANOTHER. The bar that said "you
  // already own a home" was the single-home model talking; what stops a
  // second purchase now is the money, which is the honest constraint.
  const price = homePriceFor(rentAt(world, place.desirability))
  const cash = (accounts.savings + accounts.checking) as Money
  if (method === 'cash') {
    return cash >= price
      ? null
      : `Outright costs ${String(Math.ceil((price - cash) / 100))} dollars more than you have.`
  }
  return loanBar(world, 'mortgage', creditOf(world, personId), accounts.loans, cash, price)
}


/**
 * SIGN A LEASE (real estate §4).
 *
 * Money moves here because this module owns cents — `realestate.ts` decided
 * whether the tenancy is allowed and what it costs, and asked. That seam is
 * the whole reason a housing market cannot quietly become a second economy.
 *
 * The deposit is taken and HELD, not spent: it comes back at the end if the
 * place is left sound, which is what a deposit is. Recording it as an
 * ordinary expense would have been quietly taking a month's rent from every
 * tenant in the game.
 */
export function signLease(
  world: World,
  tick: Tick,
  personId: EntityId,
  propertyId: string,
): boolean {
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return false
  const household = world.households.get(person.householdId)
  if (!household) return false
  const property = world.properties.get(propertyId)
  if (!property) return false
  // The bar reads the WALLET the debit will draw on (H0) — reading the raw
  // record judged a married signer by a ledger the money does not live on.
  const wallet = walletOf(world, personId)
  const cash = (wallet.savings + wallet.checking) as Money
  if (leaseBar(world, household.id, propertyId, cash) !== null) return false

  const rent = propertyRentOf(world, property)
  const deposit = (rent * DEPOSIT_MONTHS) as Money
  debitPerson(world, personId, (rent + deposit) as Money)

  world.leases.set(household.id, {
    propertyId,
    householdId: household.id,
    monthlyRent: rent,
    depositCents: deposit,
    startedAtTick: tick,
    endsAtTick: (tick + LEASE_MONTHS) as Tick,
  })
  world.households.set(household.id, {
    ...household,
    placeId: property.neighbourhoodPlaceId,
    propertyId,
  })
  recordEvent(world, tick, {
    type: 'signed-lease',
    subjectId: personId,
    placeId: property.neighbourhoodPlaceId,
    detail: property.address,
  })
  return true
}

/**
 * END A TENANCY. The deposit comes back where the home was kept — condition
 * is the landlord's test and the property carries it, so this reads the
 * same number a repair would have raised.
 */
export function endLease(world: World, tick: Tick, householdId: EntityId): boolean {
  const lease = world.leases.get(householdId)
  if (!lease) return false
  const household = world.households.get(householdId)
  const property = world.properties.get(lease.propertyId)
  world.leases.delete(householdId)
  if (household !== undefined) {
    world.households.set(householdId, { ...household, propertyId: null })
  }
  // Returned in full where the place is sound, withheld where it is not.
  // 500 is the middle of the condition scale — a wreck is not a deposit
  // somebody gets back.
  const sound = property === undefined || property.condition >= 500
  if (sound && household !== undefined) {
    const head = [...household.memberIds][0]
    if (head !== undefined) creditPerson(world, head, lease.depositCents)
  }
  recordEvent(world, tick, {
    type: 'ended-lease',
    subjectId: [...(household?.memberIds ?? [])][0] ?? householdId,
    detail: sound ? 'deposit returned' : 'deposit withheld',
  })
  return true
}


/**
 * AN INFORMAL RENTER, for the leasing passes: a seated household that does
 * not own the roof it is under and holds no lease on it — the worldgen
 * arrangement, paying the street's going rate to nobody in particular.
 */
function isInformalRenter(world: World, household: Household): boolean {
  if (household.dissolvedTick !== null || household.memberIds.length === 0) return false
  if (household.homelessSinceTick !== null) return false
  if (world.leases.has(household.id)) return false
  if (typeof household.propertyId !== 'string') return true
  const property = world.properties.get(household.propertyId)
  const ownerId = property?.ownerId ?? null
  return ownerId === null || !household.memberIds.includes(ownerId)
}

/**
 * THE TOWN RENTS ON ITS OWN (owner: "why did you not add a renting system
 * to npc's?"). Every so often an informal renter looks at the market and
 * signs a real lease on a vacant home they can afford — which is what
 * fills a landlord's empty house without anybody clicking, and what makes
 * the lease map a living market instead of a player-only ledger.
 *
 * Seeded and slow: a household reconsiders roughly once every three years,
 * and the signing itself still passes `leaseBar` — no cash for the
 * deposit, no lease, exactly like everybody else.
 */
function runNpcLeasing(world: World, tick: Tick): void {
  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    if (!isInformalRenter(world, household)) continue
    const head = household.memberIds
      .map((id) => world.people.get(id))
      .filter((p): p is Person => p !== undefined && p.deathTick === null)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (head === undefined || head.id === world.player.personId) continue
    const rng = openStream(world.seed, Stream.Career, household.id, tick + 71_700)
    if (!rng.chance(1, 36)) continue
    const income = householdIncome(world, household)
    if (income <= 0) continue
    // A home they would actually take: affordable, and not a hovel far
    // below their means. Sorted by id so the walk is reproducible.
    const candidates = [...world.properties.values()]
      .filter((property) => {
        if (!isVacant(world, property.id)) return false
        const rent = propertyRentOf(world, property)
        return rent * 3 <= income && rent * 8 >= income
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const pick = candidates[0]
    if (pick === undefined) continue
    signLease(world, tick, head.id, pick.id)
  }
}

/**
 * FIND A TENANT for a vacant deed — the landlord's own verb (owner's
 * mockup: manage the portfolio, live in one, rent out the other). Walks the
 * town's informal renters for the first household that can afford the place
 * and signs them on the spot; scarcity is real — some months nobody in
 * town wants your house at that rent.
 */
export function findTenantBar(world: World, ownerId: EntityId, propertyId: string): string | null {
  const property = world.properties.get(propertyId)
  if (!property) return 'No such address.'
  if (property.ownerId !== ownerId) return 'Not your deed.'
  const owner = world.people.get(ownerId)
  const ownHousehold = owner?.householdId === null || owner === undefined
    ? undefined
    : world.households.get(owner.householdId)
  if (ownHousehold?.propertyId === propertyId) return 'You live here.'
  if (!isVacant(world, propertyId)) return 'Somebody already lives there.'
  return null
}

export function findTenant(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  propertyId: string,
): { done: boolean; reason: string } {
  const bar = findTenantBar(world, ownerId, propertyId)
  if (bar !== null) return { done: false, reason: bar }
  const property = world.properties.get(propertyId)
  if (!property) return { done: false, reason: 'No such address.' }
  const rent = propertyRentOf(world, property)
  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    if (!isInformalRenter(world, household)) continue
    if (household.memberIds.includes(ownerId)) continue
    const head = household.memberIds
      .map((id) => world.people.get(id))
      .filter((p): p is Person => p !== undefined && p.deathTick === null)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (head === undefined || head.id === world.player.personId) continue
    if (householdIncome(world, household) < rent * 3) continue
    if (signLease(world, tick, head.id, propertyId)) return { done: true, reason: '' }
  }
  return { done: false, reason: 'Nobody in town is looking at that rent this month.' }
}

/** End the tenancy on a deed you own — lease or informal occupancy alike. */
export function endTenancyOn(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  propertyId: string,
): { done: boolean; reason: string } {
  const property = world.properties.get(propertyId)
  if (!property) return { done: false, reason: 'No such address.' }
  if (property.ownerId !== ownerId) return { done: false, reason: 'Not your deed.' }
  const tenant = [...world.households.values()].find(
    (h) => h.dissolvedTick === null && h.propertyId === propertyId && !h.memberIds.includes(ownerId),
  )
  if (tenant === undefined) return { done: false, reason: 'Nobody lives there.' }
  if (world.leases.has(tenant.id)) {
    endLease(world, tick, tenant.id)
  } else {
    // An informal occupancy simply ends: they stay in the neighbourhood at
    // the going arrangement — no street, ever (H1).
    world.households.set(tenant.id, { ...tenant, propertyId: null })
    const head = tenant.memberIds[0]
    if (head !== undefined) {
      recordEvent(world, tick, { type: 'moved-house', subjectId: head, placeId: tenant.placeId })
    }
  }
  return { done: true, reason: '' }
}

/** Move your own household into a house you own. */
export function moveIntoOwnHome(
  world: World,
  tick: Tick,
  personId: EntityId,
  propertyId: string,
): { done: boolean; reason: string } {
  const property = world.properties.get(propertyId)
  if (!property) return { done: false, reason: 'No such address.' }
  if (property.ownerId !== personId) return { done: false, reason: 'Not your deed.' }
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return { done: false, reason: 'There is no household to move.' }
  const household = world.households.get(person.householdId)
  if (!household) return { done: false, reason: 'There is no household to move.' }
  if (household.propertyId === propertyId) return { done: false, reason: 'You already live there.' }
  if (!isVacant(world, propertyId)) return { done: false, reason: 'Your tenant lives there — end the tenancy first.' }
  // Leaving a rental ends the lease properly, deposit and all.
  if (world.leases.has(household.id)) endLease(world, tick, household.id)
  const fresh = world.households.get(household.id) ?? household
  world.households.set(household.id, {
    ...fresh,
    placeId: property.neighbourhoodPlaceId,
    propertyId: property.id,
  })
  recordEvent(world, tick, {
    type: 'moved-house',
    subjectId: personId,
    placeId: property.neighbourhoodPlaceId,
  })
  return { done: true, reason: '' }
}

/**
 * SELL THE HOUSE (real estate §5).
 *
 * Pay off whatever is left on the mortgage, take the agent's fee, and the
 * rest is yours — which may be a fortune or may be nothing. Housing becomes
 * real wealth here, or a real loss.
 *
 * UNDERWATER IS ALLOWED TO HURT. Where the debt exceeds the price the
 * seller still owes the difference, and it stays as debt rather than being
 * quietly forgiven. That is what "underwater" means, and the arrears and
 * bankruptcy machinery already knows what to do with a debt somebody cannot
 * pay.
 */
export function sellHome(
  world: World,
  tick: Tick,
  personId: EntityId,
  /**
   * WHICH house. Optional, and defaults to the one they live in — which is
   * what every caller meant while a person could own exactly one.
   *
   * With a portfolio that default is dangerous: "sell" with no argument
   * would have sold whichever house the family happened to be standing in
   * rather than the one whose button was pressed. The id travels now.
   */
  sellPropertyId?: string,
): boolean {
  const person = world.people.get(personId)
  if (!person || person.householdId === null) return false
  const household = world.households.get(person.householdId)
  const accounts = accountsOf(world, personId)
  const propertyId = sellPropertyId ?? household?.propertyId
  if (typeof propertyId !== 'string') return false
  const deed = world.properties.get(propertyId)
  // YOU CANNOT SELL WHAT YOU DO NOT OWN. The old check asked whether the
  // seller owned *a* home; with several it has to ask about THIS one.
  if (deed === undefined || deed.ownerId !== personId) return false

  const { price, fee, net } = saleProceedsOf(world, propertyId)
  if (price <= 0) return false
  // THE MORTGAGE IS THE RESIDENCE'S. Settling it out of the proceeds of a
  // different house would be paying off a loan the buyer never touched —
  // and would clear the debt on a home the seller still lives in.
  const isResidence = household?.propertyId === propertyId
  const mortgage = isResidence ? accounts.loans.find((l) => l.kind === 'mortgage') : undefined
  const owed = (mortgage?.balance ?? 0) as Money

  // The mortgage is settled out of the proceeds first — a buyer's money
  // never reaches a seller who still owes on the place.
  const toSeller = net - owed
  // PROCEEDS TO THE WALLET (H0), the file changes on the personal record.
  if (toSeller > 0) creditPerson(world, personId, toSeller as Money)
  setAccounts(world, {
    ...accountsOf(world, personId),
    loans: isResidence ? accounts.loans.filter((l) => l.kind !== 'mortgage') : accounts.loans,
    // Only give up the residence marker when the residence is what sold.
    homePlaceId: isResidence ? null : accounts.homePlaceId,
    homePurchasePrice: isResidence ? (0 as Money) : accounts.homePurchasePrice,
    ...(toSeller >= 0
      ? {}
      : // Underwater: the shortfall follows them as a personal debt rather
        // than evaporating, because somebody is still owed it.
        {
          loans: [
            ...accounts.loans.filter((l) => l.kind !== 'mortgage'),
            ...(mortgage === undefined
              ? []
              : [{ ...mortgage, kind: 'personal' as const, balance: (-toSeller) as Money }]),
          ],
        }),
  })
  // The deed goes, always. The family only moves out if it was their home.
  setOwner(world, propertyId, null)
  if (household !== undefined && isResidence) {
    world.households.set(household.id, { ...household, propertyId: null })
  }
  recordEvent(world, tick, {
    type: 'sold-home',
    subjectId: personId,
    detail: String(Math.max(0, toSeller)),
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'spending',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('steady-pay', Math.floor(price / 1000))],
    chosen: toSeller >= 0 ? 'sold the house' : 'sold the house at a loss',
    rejected: ['staying put'],
    streamId: Stream.Economy,
  })
  void fee
  return true
}

/**
 * PAY DOWN A DEBT — any debt (owner, playing: "theres no way to even pay
 * the mortgage", "no way to pay off student loans either").
 *
 * Loans amortised monthly and there was NO WAY TO SETTLE ONE. You could
 * watch a balance fall for thirty years and never hand over a lump sum,
 * which is not how anybody with money in the bank behaves.
 *
 * One function for every kind, because paying off a mortgage and paying
 * off a student loan are the same act — the difference is only which
 * balance it lands on. Returns what was actually paid.
 *
 * Savings first, then checking, the way every other outgoing here works.
 * Overpaying is impossible: you cannot hand over more than is owed, and
 * the remainder stays yours.
 */
export function payDownLoan(
  world: World,
  tick: Tick,
  personId: EntityId,
  kind: LoanKind,
  amount: Money,
): Money {
  if (amount <= 0) return 0 as Money
  const loan = accountsOf(world, personId).loans.find((l) => l.kind === kind)
  if (loan === undefined) return 0 as Money

  // THE LOAN IS PERSONAL; THE MONEY IS THE WALLET'S (H0). Paying from the
  // raw record let a married player settle a mortgage out of the shadow
  // ledger without their visible balance moving a cent.
  const wallet = walletOf(world, personId)
  const owed = loan.balance as number
  const wanted = Math.min(amount, owed)
  const available = Math.max(0, wallet.savings) + Math.max(0, wallet.checking)
  const paid = Math.min(wanted, available)
  if (paid <= 0) return 0 as Money

  const fromSavings = Math.min(paid, Math.max(0, wallet.savings))
  const fromChecking = paid - fromSavings
  setAccounts(world, {
    ...wallet,
    savings: (wallet.savings - fromSavings) as Money,
    checking: (wallet.checking - fromChecking) as Money,
  })

  const left = (owed - paid) as Money
  // CLEARED, or smaller. A loan paid to zero is gone from the file — and
  // its monthly payment goes with it, which is the point of doing this.
  // Re-read AFTER the wallet write: when the payer holds the wallet these
  // are one record, and a stale copy would undo the debit.
  const accounts = accountsOf(world, personId)
  const remaining =
    left <= 0
      ? accounts.loans.filter((l) => l.kind !== kind)
      : accounts.loans.map((l) => (l.kind === kind ? { ...l, balance: left } : l))
  setAccounts(world, { ...accounts, loans: remaining })
  recordEvent(world, tick, {
    type: left <= 0 ? 'paid-off-loan' : 'paid-down-loan',
    subjectId: personId,
    detail: kind,
  })
  return paid as Money
}

/**
 * Why this debt cannot be paid down, or null. The bar pattern: the button
 * greys from the same answer the verb refuses with.
 */
export function payDownBar(world: World, personId: EntityId, kind: LoanKind): string | null {
  const accounts = accountsOf(world, personId)
  const loan = accounts.loans.find((l) => l.kind === kind)
  if (loan === undefined) return 'You do not carry that debt.'
  if (accounts.savings + accounts.checking <= 0) return 'There is nothing to pay it with.'
  return null
}

export function buyHome(
  world: World,
  tick: Tick,
  personId: EntityId,
  placeId: EntityId,
  /** Defaults to a mortgage, which is what every existing caller meant. */
  method: HomePurchaseMethod = 'mortgage',
  /**
   * The SPECIFIC home, since real estate phase 2. Optional so that every
   * existing caller keeps its exact meaning — buying "into a neighbourhood"
   * still works and still prices off the street. When a property is named,
   * its own value is the price and the household moves into that door.
   */
  propertyId?: string,
): boolean {
  const place = world.places.get(placeId)
  if (!place) return false
  if (homePurchaseBar(world, personId, placeId, method) !== null) return false
  const property = propertyId === undefined ? undefined : world.properties.get(propertyId)
  // A NAMED HOME IS PRICED AS ITSELF. A three-bed in good repair and the
  // flat next door are not the same money, which is the entire reason
  // properties exist.
  const price = property === undefined
    ? homePriceFor(rentAt(world, place.desirability))
    : propertyValueOf(world, property)
  // PAYING CASH PAYS THE WHOLE PRICE. A mortgage pays the deposit now and
  // owes the rest; there is no third thing.
  const nowDue = method === 'cash' ? price : depositFor(price, creditOf(world, personId))

  // The money comes out of the WALLET (H0) — savings first, then checking.
  // The deed stays on the buyer's own record: houses are personal, the
  // couple's cash is not.
  const wallet = walletOf(world, personId)
  const fromSavings = Math.min(nowDue, Math.max(0, wallet.savings))
  const fromChecking = nowDue - fromSavings
  setAccounts(world, {
    ...wallet,
    savings: (wallet.savings - fromSavings) as Money,
    checking: (wallet.checking - fromChecking) as Money,
  })
  setAccounts(world, {
    ...accountsOf(world, personId),
    homePlaceId: placeId,
    homePurchasePrice: price,
  })
  // THE DOOR, NOT JUST THE STREET. Recorded on the household because a home
  // is where a FAMILY lives, not where one earner's bank account points.
  if (property !== undefined) {
    setOwner(world, property.id, personId)
    const person = world.people.get(personId)
    const household = person?.householdId === null || person === undefined
      ? undefined
      : world.households.get(person.householdId)
    // A SECOND HOUSE IS NOT A MOVE — but a FIRST one is.
    //
    // The rule is "do they already own where they live", not "do they live
    // anywhere". Every household is seated in a home at worldgen, so asking
    // the second question meant a first-time buyer never moved into the
    // house they had just bought: they stayed in the place they were seated
    // in, and "sell your home" then defaulted to a house they did not own.
    // Buying a rental while owning your home still leaves you where you are.
    const livesIn =
      household === undefined || typeof household.propertyId !== 'string'
        ? undefined
        : world.properties.get(household.propertyId)
    const alreadyOwnsHome = livesIn !== undefined && livesIn.ownerId === personId
    if (household !== undefined && !alreadyOwnsHome) {
      world.households.set(household.id, {
        ...household,
        placeId: property.neighbourhoodPlaceId,
        propertyId: property.id,
      })
    }
  }
  if (method === 'mortgage') {
    const borrowed = (price - nowDue) as Money
    takeLoan(world, tick, personId, 'mortgage', borrowed)
    // takeLoan credits the wallet with the principal; a mortgage never
    // touches the buyer's hands, so it goes straight back out to the seller.
    const after = walletOf(world, personId)
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

    // THE MONEY IS THE WALLET'S (H0). A married earner's pay lives on the
    // joint record, so that is what the month's debt service draws on —
    // reading the raw record would put every married non-holder straight
    // into default the moment wages started routing to the wallet.
    const wallet = walletOf(world, personId)
    let checking = wallet.checking as number
    let savings = wallet.savings as number
    let monthsPaid = accounts.monthsPaid
    let defaults = accounts.defaults
    let homePlaceId = accounts.homePlaceId
    let homePurchasePrice = accounts.homePurchasePrice
    const remaining: Loan[] = []

    // STILL AT SCHOOL, STILL NOT PAYING. A student loan defers while the
    // person it paid for is enrolled, which is what makes it possible to
    // study at all — a four-year course billing from month one would
    // simply be a bill somebody with no wages cannot meet, and the
    // arrears machinery would put every student in the town into default
    // in their first year.
    //
    // INTEREST STILL ACCRUES. Deferred is not free, and a graduate who
    // took the longest course owes more than one who took the shortest.
    const stillEnrolled = world.education.get(personId)?.enrolledIn !== null &&
      world.education.get(personId)?.enrolledIn !== undefined

    /**
     * THE AUTOMATIC STAY COVERS THE DEBTS IN THE PLAN. While a chapter 13
     * runs, the plan payment IS the payment on every debt the plan
     * consolidated — this loop was collecting the same loans monthly on
     * top of it, so a filer paid twice for the privilege of going
     * bankrupt. Frozen entirely under the stay: no collection, no
     * interest, no missed-month marks — the discharge at the end clears
     * these loans, so their balance during the plan is a number nobody
     * will ever be asked for. Student loans and mortgages ride OUTSIDE
     * the plan (they survive it) and keep their ordinary rules.
     */
    const underStay = (world.bankruptcies.get(personId) ?? []).some(
      (filing) =>
        filing.chapter === 13 &&
        filing.dischargedAtTick === null &&
        filing.planEndsAtTick !== null,
    )

    for (const loan of accounts.loans) {
      if (underStay && survivesChapter13(loan) === false) {
        remaining.push(loan)
        continue
      }
      // A CHARGED-OFF STUDENT DEBT STOPS GROWING. Three missed months put
      // any loan in default; for this one the debt SURVIVES it (below),
      // and a surviving debt that also kept compounding for the rest of a
      // life would be the permanent trap Law 7 exists to forbid. It stays,
      // it is still owed, it stops running away.
      const chargedOff = loan.kind === 'student' && loan.missedMonths >= 3
      const interest = chargedOff
        ? 0
        : Math.floor((loan.balance * loan.ratePerMille) / 12_000)
      if (loan.kind === 'student' && stillEnrolled) {
        remaining.push({ ...loan, balance: (loan.balance + interest) as Money })
        continue
      }
      const due = Math.min(loan.monthlyPayment, (loan.balance + interest) as Money)
      const fromChecking = Math.max(0, Math.min(due, checking))
      const fromSavings = Math.max(0, Math.min(due - fromChecking, savings))
      const paid = fromChecking + fromSavings

      if (paid < due) {
        // Missed. Interest still accrues — that is what makes falling
        // behind compound rather than pause.
        const missed = loan.missedMonths + 1
        if (missed >= 3) {
          // THE DEBT SURVIVES THE DEFAULT, for a student loan only.
          //
          // Every other loan here is CLOSED by defaulting — the lender
          // writes it off and the record carries the mark. Letting that
          // happen to this one would have made default the cheap way out
          // of an education, and MEASURED it was: 71 defaults against 61
          // loans paid off, more than half of all borrowers walking away.
          // A debt most people escape is not the weighty consequence the
          // college choice is supposed to carry, and it would have made
          // the bankruptcy ruling above meaningless — why file when you
          // can simply stop paying?
          //
          // So it stays on the file, charged off and no longer growing,
          // and every month the money is there it is still collected.
          if (loan.kind === 'student') {
            if (loan.missedMonths < 3) {
              defaults += 1
              recordEvent(world, tick, {
                type: 'defaulted',
                subjectId: personId,
                detail: loan.kind + ':' + String(loan.balance),
              })
            }
            remaining.push({ ...loan, balance: (loan.balance + interest) as Money, missedMonths: missed })
            continue
          }
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
            // FORECLOSURE IS A SALE, not an evaporation (housing spec §H2.5).
            // The deed used to stay with the defaulter forever — "lost the
            // home" while the registry still named them the owner. The bank
            // sells at a distressed price, keeps what it is owed, and any
            // surplus is the family's — that is how foreclosure actually
            // works, and the surplus is what softens Law 7's landing. The
            // household stays put and pays rent like anybody else: no
            // street, ever (H1).
            const surplus = forecloseHome(world, personId, (loan.balance + interest) as Money)
            if (surplus > 0) savings += surplus
          }
          continue // the debt is closed by the default; the record carries it
        }
        // THE WARNING MOMENT (spec: foreclosure joins the same machinery as
        // every other slide). The second miss is the formal letter, so the
        // third — the default itself — never arrives unannounced.
        if (loan.kind === 'mortgage' && missed === 2) {
          recordEvent(world, tick, {
            type: 'mounting-debts',
            subjectId: personId,
            detail: 'mortgage',
          })
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

    // Two writers, two records: money to the wallet, the file to the raw
    // record. When the payer holds the wallet these are one record, so the
    // wallet write happens FIRST and the file write re-reads it — a stale
    // spread here would silently undo the month's collections.
    setAccounts(world, {
      ...wallet,
      checking: checking as Money,
      savings: savings as Money,
    })
    setAccounts(world, {
      ...accountsOf(world, personId),
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
    // A PROFESSIONAL ATHLETE'S PAY IS PAY. It has to be here, in the
    // ledger row below, and in the pension record — the same trio that has
    // drifted apart four times in this project. `atTodaysPrices` because
    // the contract is written in base-year cents like every other wage.
    atTodaysPrices(world, sportsWageOf(world, personId)) +
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
  const inHand = (gross - withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille) + insurance) as Money
  return (insurance + assistanceOf(world, person, inHand, tick)) as Money
}

/**
 * Move money into a person's checking, from a wage or anywhere else.
 * Exported because pay is not the only thing that lands there.
 */
/**
 * Take money from somebody, checking first and savings behind it.
 *
 * The mirror of creditPerson, and it lives here for the same reason: this
 * module owns the accounts. A caller that reached in and wrote them itself
 * would be a second writer, and `setAccounts` stays unexported so nobody
 * can. Returns what was actually taken, which may be less than asked.
 */
export function debitPerson(world: World, personId: EntityId, amount: Money): Money {
  if (amount <= 0) return 0 as Money
  // H0: the couple's money is one pot. The debit lands on the wallet.
  const accounts = walletOf(world, personId)
  const fromChecking = Math.max(0, Math.min(amount, accounts.checking))
  const fromSavings = Math.max(0, Math.min(amount - fromChecking, accounts.savings))
  if (fromChecking + fromSavings <= 0) return 0 as Money
  setAccounts(world, {
    ...accounts,
    checking: (accounts.checking - fromChecking) as Money,
    savings: (accounts.savings - fromSavings) as Money,
  })
  return (fromChecking + fromSavings) as Money
}

export function creditPerson(world: World, personId: EntityId, amount: Money): number {
  if (amount <= 0) return 0
  // H0: earnings land in the couple's one pot.
  const accounts = walletOf(world, personId)
  const beforeLiquid = accounts.checking + accounts.savings
  setAccounts(world, { ...accounts, checking: (accounts.checking + amount) as Money })
  // Digging out is an event, the same as falling in was. The wallet dug
  // out the honest way — money arrived — and the record says so once, at
  // the crossing, not every month it stays dry.
  if (beforeLiquid < 0 && beforeLiquid + amount >= 0) {
    const holder = world.people.get(accounts.personId)
    recordEvent(world, world.tick, {
      type: 'back-in-the-black',
      subjectId: accounts.personId,
      // The household key, so the spell reader can pair this recovery with
      // the fall that opened it.
      ...(holder?.householdId !== null && holder !== undefined
        ? { detail: String(holder.householdId) }
        : {}),
    })
  }
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
    total += gross - withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille) + supportOf(world, memberId, world.tick)
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

  // H0: what nobody could cover goes on the head couple's wallet, below
  // zero if it must — the same place every other unmet obligation lands.
  const head = eldestMember(world, household)
  if (head !== undefined) {
    const wallet = walletOf(world, head.id)
    const beforeLiquid = (wallet.checking + wallet.savings) as Money
    setAccounts(world, { ...wallet, checking: (wallet.checking - owing) as Money })
    noteWalletArrearsCrossing(world, tick, household.id, beforeLiquid, (beforeLiquid - owing) as Money)
  }
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
// H0: money coming into "the household" is money coming to the head
  // couple's wallet — a building cannot be paid.
  const head = eldestMember(world, household)
  if (head === undefined) return 0
  const wallet = walletOf(world, head.id)
  const beforeLiquid = (wallet.checking + wallet.savings) as Money
  setAccounts(world, { ...wallet, checking: (wallet.checking + amount) as Money })
  noteWalletArrearsCrossing(world, tick, household.id, beforeLiquid, (beforeLiquid + amount) as Money)
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
/** The fell-behind / dug-out events, keyed to the WALLET's zero crossing. */
function noteWalletArrearsCrossing(
  world: World,
  tick: Tick,
  householdId: EntityId,
  before: Money,
  after: Money,
): void {
  const household = world.households.get(householdId)
  if (!household) return
  const head = eldestMember(world, household)
  if (!head) return
  /**
   * SUBJECT IS THE WALLET HOLDER; DETAIL IS THE HOUSEHOLD KEY. The spell
   * reader (`arrearsHistoryOf`) pairs falls with recoveries by
   * `detail === String(household.id)` — an event without the key is
   * invisible to it, and a fall keyed to one spouse with a recovery keyed
   * to the other never pairs. Both lessons were bought with failing
   * pairing tests during H0.
   */
  const holder = walletOf(world, head.id)
  if (before >= 0 && after < 0) {
    recordEvent(world, tick, { type: 'fell-behind', subjectId: holder.personId, detail: String(householdId) })
  } else if (before < 0 && after >= 0) {
    recordEvent(world, tick, { type: 'back-in-the-black', subjectId: holder.personId, detail: String(householdId) })
  }
}

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

// REAL ESTATE READS THE RENT CURVE THROUGH A HANDOVER, not an import.
// `realestate.ts` needs what a street costs; importing this module to get it
// closed a cycle the ratchet refuses, so the money module — which already
// owns the price level — hands the function over instead and the dependency
// points one way. Same seam the wellbeing module needed.
useRentCurve(rentAt)

export function livingCostAt(world: World, base: number): Money {
  return atTodaysPrices(world, base) as Money
}

/**
 * WHAT THIS PERSON'S SCHOOLING COSTS THE HOUSEHOLD THIS MONTH.
 *
 * One function because THREE places have to agree to the cent:
 * `householdCosts` (what actually leaves the account), `unitCosts` (how a
 * split household divides it) and the itemised ledger (what the player is
 * shown). The first version put the tuition in only the first of them,
 * and both of the others silently stopped summing to it — which is
 * exactly the invariant those two tests exist to catch.
 */
function inHalls(world: World, personId: EntityId): boolean {
  return world.education.get(personId)?.inHalls === true
}

function tuitionFor(world: World, personId: EntityId): Money {
  const record = world.education.get(personId)
  if (record?.schooling !== 'private' || record.enrolledIn === null) return 0 as Money
  return livingCostAt(world, PRIVATE_SCHOOL_TUITION)
}

/**
 * IS THIS WHOLE HOUSEHOLD AWAY AT COLLEGE?
 *
 * Extracted so the roof cost and the itemisation cannot answer it
 * differently. A dead member counts as away — they are not in the house
 * either, and treating them as present would keep a roof billed by a
 * corpse.
 */
function everybodyInHalls(world: World, household: Household): boolean {
  return (
    household.memberIds.length > 0 &&
    household.memberIds.every((id) => {
      const member = world.people.get(id)
      if (!member || member.deathTick !== null) return true
      return world.education.get(id)?.inHalls === true
    })
  )
}

/**
 * WHAT THE ROOF COSTS THIS HOUSEHOLD THIS MONTH — the one answer.
 *
 * THE FOURTH TIME THIS TRIO HAS DRIFTED, and the first time it is fixed
 * structurally rather than by hand. `householdCosts`, `unitCosts` and
 * `householdLedger` each walked the roof separately; the ledger's copy
 * still charged the neighbourhood's going rate to a household that held a
 * LEASE, to one that OWNED the place outright, and to one whose members
 * were all away in halls. MEASURED: a household in halls billed $1,003.44
 * a month in the itemisation and nothing at all by the tick loop, so the
 * screen showed a family a bill that was never taken from them.
 *
 * The previous three fixes were comments asking the next person to keep
 * the copies in step. Comments do not keep anything in step. This is a
 * function, and drift is now a compile-time impossibility rather than a
 * discipline.
 */
function roofCostFor(world: World, household: Household): Money {
  // No roof, and no rent for one — the caller bills shelter instead.
  if (household.homelessSinceTick !== null) return 0 as Money
  // Halls were paid for with the fees; billing again is billing twice.
  if (everybodyInHalls(world, household)) return 0 as Money
  // A tenancy is an agreement about a SPECIFIC home, so the number is the
  // property's rather than the postcode's.
  const lease = world.leases.get(household.id)
  if (lease !== undefined) return lease.monthlyRent
  // An owner pays no rent. The mortgage is the loan system's to charge, and
  // street rent on top bills one roof twice.
  const home =
    typeof household.propertyId === 'string' ? world.properties.get(household.propertyId) : undefined
  const ownerId = home?.ownerId
  if (ownerId !== undefined && ownerId !== null && household.memberIds.includes(ownerId)) {
    return 0 as Money
  }
  const place = world.places.get(household.placeId)
  return (place ? rentAt(world, place.desirability) : 0) as Money
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
  // WHAT THE ROOF ACTUALLY COSTS THIS HOUSEHOLD (owner, playing: "if you
  // are renting because you can't get a loan on a house you're renting").
  //
  // Three cases, and only one of them existed before:
  //
  //   a LEASE — pay what the lease says. A tenancy is an agreement about a
  //     specific home, so the number is the property's, not the postcode's.
  //   an OWNER — pay no rent. The mortgage is charged by the loan system,
  //     and charging street rent on top was billing a homeowner twice for
  //     the same roof.
  //   neither — the old behaviour, the neighbourhood's going rate, which is
  //     the right answer for anybody housed without a tracked agreement.
  // A HOUSEHOLD OF NOTHING BUT STUDENTS IN HALLS PAYS NO RENT.
  //
  // This is the bug the owner hit: move out at eighteen with a job, enrol
  // in college, full-time study ends the job, and a household head with
  // zero income is downsized every single month — street to street until
  // the town runs out and the housing is lost. They are not living there;
  // they are in halls, and halls were already paid for with the fees.
  if (everybodyInHalls(world, household)) return 0 as Money
  let total: number = roofCostFor(world, household)
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
    // IN HALLS IS ABSENCE, the same way a cell is. The institution is
    // feeding and housing them and it was billed with the tuition, so
    // charging the household again would be charging twice for one bed.
    if (inHalls(world, memberId)) continue
    total +=
      ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE
        ? livingCostAt(world, LIVING_COST_ADULT)
        : livingCostAt(world, LIVING_COST_CHILD)
    // TUITION, FOR A CHILD IN A PRIVATE CLASSROOM. Billed here rather than
    // by the schoolhouse for the single-writer reason: education decides
    // WHO is in private school, finances decides what leaves the account.
    // Charging it through the household bill also means it lands in the
    // arrears machinery for free — a family that stops affording it falls
    // behind on it exactly the way they fall behind on rent, instead of
    // the fees quietly evaporating.
    total += tuitionFor(world, memberId)
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
  // THE HOUSEHOLD ALREADY KNOWS WHO IS IN IT (owner, playing: "when you age
  // up it takes pretty long to load now").
  //
  // This walked EVERY PERSON IN THE WORLD to find the two-to-six who share a
  // roof, and `financialUnitOf` is called per household member — so the cost
  // was people x members, quadratic in the population, every month.
  //
  // MEASURED by instrumenting the tick: `runFinances` was 64% of the whole
  // month (544ms of 851ms) at world-year 55, far ahead of anything else.
  // `memberIds` is the same answer without the search.
  const householdMembers =
    person.householdId === null
      ? []
      : (world.households.get(person.householdId)?.memberIds ?? [])
  for (const otherId of householdMembers) {
    const other = world.people.get(otherId)
    if (other === undefined || other.deathTick !== null) continue
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
    total += gross - withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille) + supportOf(world, id, world.tick)
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
/**
 * THE HOUSEHOLD-LEVEL FACTS a unit's rent share is worked out from: how many
 * units are under the roof, what they earn between them, and what this one
 * earns. Computed once per household by the monthly loop and handed down.
 */
export interface UnitShape {
  readonly unitCount: number
  readonly totalIncome: number
  readonly mine: number
}

/** The original derivation, kept verbatim for callers that have no bundle. */
export function unitShapeFor(
  world: World,
  household: Household,
  unit: readonly EntityId[],
): UnitShape {
  const units = unitsUnder(world, household)
  let totalIncome = 0
  for (const other of units) totalIncome += unitIncome(world, other)
  return { unitCount: units.length, totalIncome, mine: unitIncome(world, unit) }
}

export function unitCosts(
  world: World,
  household: Household,
  unit: readonly EntityId[],
  precomputed?: UnitShape,
): Money {
  if (household.homelessSinceTick !== null) {
    let shelter = 0
    for (const id of unit) {
      const member = world.people.get(id)
      if (member && member.deathTick === null) shelter += shelterCostFor(world)
    }
    return shelter as Money
  }

  // A HOUSEHOLD OF NOTHING BUT STUDENTS IN HALLS PAYS NOTHING, and
  // `householdCosts` says so with an early return — so this must too, or
  // the head unit would carry a rent the household is not being charged.
  if (everybodyInHalls(world, household)) return 0 as Money

  let mouths = 0
  for (const id of unit) {
    const member = world.people.get(id)
    if (!member || member.deathTick !== null) continue
    const criminal = world.criminal.get(id)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      continue
    }
    // AND HALLS HERE TOO. `householdCosts` skips a student in halls; if
    // this did not, the parts would stop summing to the whole — which is
    // the third time that trio has had to be kept in step, after the
    // tuition line and the jail exemption before it.
    if (inHalls(world, id)) continue
    mouths +=
      ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE
        ? livingCostAt(world, LIVING_COST_ADULT)
        : livingCostAt(world, LIVING_COST_CHILD)
    // The tuition follows the CHILD into whichever unit they are counted
    // in, so the parts still sum to the whole.
    mouths += tuitionFor(world, id)
  }

  // THE SAME ROOF NUMBER `householdCosts` CHARGES — lease rent for a
  // tenancy, nothing for an owner, the going rate for the untracked. The
  // postcode rate that used to sit here is what pulled the trio apart the
  // sixth time: a household on a lease (or in a house it OWNS) was being
  // split a bill nobody was sending.
  const rent = roofCostFor(world, household)
  /**
   * THE HOUSEHOLD'S SHAPE, COMPUTED ONCE WHEN THE CALLER ALREADY KNOWS IT
   * (owner, playing: "when you age up it takes pretty long to load now...
   * need the delay to be less, that's the main thing, for the game to
   * actually run").
   *
   * These three lines were the single most expensive thing in the month.
   * `unitCosts` is called ONCE PER UNIT, and each call re-derived every unit
   * under the roof and every unit's income — so a household with three units
   * did that work nine times, and `unitsUnder` itself walks the members.
   *
   * MEASURED by instrumenting the tick: `runFinances` was 64% of the whole
   * month, `discretionaryForUnit` was 499ms of it, and `unitCosts` was 373ms
   * of THAT — the deepest and hottest thing in the loop.
   *
   * The precomputed bundle is optional and the fallback below is the
   * original code verbatim, so the OTHER two cost functions — `householdCosts`
   * and `householdLedger` — are untouched. That trio has drifted apart four
   * times in this project; an optimization is not worth a fifth.
   *
   * SAFE TO HOIST because a unit's income cannot change during the loop that
   * spends it: `personalIncome` reads wages, service pay, sports pay and the
   * state pension, and the pension reads `accounts.monthsWorked`, which is
   * written in the EARNER loop that has already finished. The discretionary
   * loop only moves `checking`, which none of them read.
   */
  const shape = precomputed ?? unitShapeFor(world, household, unit)
  if (shape.unitCount === 0) return mouths as Money
  /**
   * THE ROOF IS THE HEAD COUPLE'S BILL (H0, owner's rule #3: grown kids
   * keep their own wallets and live free — which is what makes moving out
   * a real decision with a real price). The income-proportional split is
   * retired: the unit containing the household's eldest member carries
   * the whole rent; every other unit under the roof carries none.
   */
  const head = eldestMember(world, household)
  const isHeadUnit = head !== undefined && unit.includes(head.id)
  const share = isHeadUnit ? rent : 0
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
  // THE SHAPE ONCE, NOT PER UNIT. See `unitCosts` for the measurement.
  const units = unitsUnder(world, household)
  const incomes = units.map((one) => unitIncome(world, one))
  let totalIncome = 0
  for (const each of incomes) totalIncome += each
  let total = 0
  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i]
    if (unit === undefined) continue
    total += discretionaryForUnit(world, household, unit, {
      unitCount: units.length,
      totalIncome,
      mine: incomes[i] ?? 0,
    })
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
  precomputed?: UnitShape,
): Money {
  if (arrearsOf(world, household) > 0) return 0 as Money
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
  const basics = unitCosts(world, household, unit, precomputed)
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
  /** What a team pays them. Its own row so a screen never calls a
   *  basketball salary "service pay". */
  readonly sportsPay: readonly LedgerEntry[]
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
  /** Private-school fees for this household's children, this month. */
  readonly tuition: Money
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
  const sportsPay: LedgerEntry[] = []
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
    const sport = atTodaysPrices(world, sportsWageOf(world, memberId))
    if (sport !== 0) sportsPay.push({ personId: memberId, amount: sport as Money })
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
  const grossTotal = [
    ...wages,
    ...servicePay,
    ...sportsPay,
    ...pensions,
    ...survivorPay,
    ...statePension,
  ].reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )
  // The untaxed floors, which arrive whole and are therefore NOT part of
  // what withholding is computed from.
  const supportTotal = support.reduce((sum, entry) => sum + entry.amount, 0)

  // Same iteration as householdCosts, including the jail exemption AND the
  // homelessness case — the two must agree to the cent or the itemisation
  // stops summing to the month the tick loop actually spends. The ROOF is
  // no longer walked here at all: it comes from the one function both use.
  const homeless = household.homelessSinceTick !== null
  const rent = roofCostFor(world, household)
  let adults = 0
  let children = 0
  let jailed = 0
  let living = 0
  let tuition = 0 as Money
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    living++
    const criminal = world.criminal.get(memberId)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      jailed++
      continue
    }
    if (inHalls(world, memberId)) continue
    if (ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE) adults++
    else children++
    tuition = (tuition + tuitionFor(world, memberId)) as Money
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
    sportsPay,
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
    // School fees on their own row rather than buried in living costs: a
    // family paying it should be able to see what it is costing them.
    tuition,
    homeless,
    costs: householdCosts(world, household),
    lifestyle: discretionaryFor(world, household),
    salesTax: salesTaxOn(discretionaryFor(world, household)),
    net: monthlyNetOf(world, household),
    savings: (arrearsOf(world, household) > 0 ? -arrearsOf(world, household) : 0) as Money,
    inArrears: arrearsOf(world, household) > 0,
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
  const mine = (gross - withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille) +
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
  return household !== undefined && arrearsOf(world, household) > 0
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
  const households = [...world.households.values()]

  for (const household of households) {
    if (household.dissolvedTick !== null) continue
    if (household.memberIds.length === 0) continue

    // H0: no carried `before` term — the wallet itself carries the past.
    // The old pot needed the monthly loop to claw arrears back through the
    // collection; the wallet digs out the honest way, by wages landing in
    // the negative. Keeping the term double-charged every behind household
    // (the surplus test caught it as discretionary spending hitting zero).

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
      const withheld = withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille)
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
      const wage =
        (world.employment.get(memberId)?.monthlyPay ?? 0) +
        servicePayOf(world, memberId) +
        sportsWageOf(world, memberId)
      // THE WORK RECORD IS PERSONAL, THE MONEY IS THE WALLET'S (H0). Tax
      // years and pension months belong to the person who worked them; the
      // pay itself belongs to the couple. Writing the cash to the raw
      // record built a shadow ledger for every married earner whose wallet
      // lives on their spouse's record — income the Money tab never showed,
      // which loan payoffs then quietly spent (owner, playing: "it just let
      // me pay it off and took nothing from my actual money").
      setAccounts(world, {
        ...accounts,
        taxableYtd: (accounts.taxableYtd + gross) as Money,
        withheldYtd: (accounts.withheldYtd + withheld) as Money,
        monthsWorked: wage > 0 ? accounts.monthsWorked + 1 : accounts.monthsWorked,
        lastMonthlyPay: wage > 0 ? (wage as Money) : accounts.lastMonthlyPay,
      })
      creditPerson(world, memberId, earned)
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
    // THE SHAPE ONCE PER HOUSEHOLD. This loop was the hottest code in the
    // month: it derived the household twice per unit — once inside
    // `discretionaryForUnit` and again for the `unitCosts` line below — and
    // each derivation re-walked every unit under the roof.
    const units = unitsUnder(world, household)
    const incomes = units.map((one) => unitIncome(world, one))
    let totalIncome = 0
    for (const each of incomes) totalIncome += each
    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i]
      if (unit === undefined) continue
      const shape = { unitCount: units.length, totalIncome, mine: incomes[i] ?? 0 }
      const theirs = discretionaryForUnit(world, household, unit, shape)
      spending += theirs
      owed += unitCosts(world, household, unit, shape) + theirs + salesTaxOn(theirs as Money)
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
    let shortfall = owed - collected
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

    /**
     * WHAT COULD NOT BE MET GOES ON THE HEAD COUPLE'S WALLET (H0 stage 2,
     * owner: "you go into the negatives"). The building's ledger is
     * retired: the unmet remainder pushes the head's own balance negative,
     * where the player can SEE it, pay it down, and — at −$500k — meet the
     * bankruptcy paperwork. household.savings freezes at zero forever;
     * the migration moves any live balances.
     */
    const unmet = Math.max(0, owed - collected) as Money
    if (unmet > 0) {
      const head = eldestMember(world, household)
      if (head !== undefined) {
        const wallet = walletOf(world, head.id)
        const beforeLiquid = wallet.checking + wallet.savings
        const afterLiquid = beforeLiquid - unmet
        setAccounts(world, { ...wallet, checking: (wallet.checking - unmet) as Money })
        noteWalletArrearsCrossing(world, tick, household.id, beforeLiquid as Money, afterLiquid as Money)
        // THE SLIDE'S TWO WARNINGS (H1): the letters at −$50k, the calls at
        // −$250k — each once, at its crossing, so the −$500k paperwork is
        // the third knock and not the first.
        if (beforeLiquid > -5_000_000 && afterLiquid <= -5_000_000) {
          recordEvent(world, tick, { type: 'mounting-debts', subjectId: wallet.personId, detail: 'letters' })
        }
        if (beforeLiquid > -25_000_000 && afterLiquid <= -25_000_000) {
          recordEvent(world, tick, { type: 'mounting-debts', subjectId: wallet.personId, detail: 'calls' })
        }
      }
    } else {
      // Dug out this month? The crossing event fires off the wallet's own
      // movement inside the collection above; nothing to do here.
    }
    if (household.savings !== 0) {
      world.households.set(household.id, { ...household, savings: 0 as Money })
    }
  }

  runNpcLeasing(world, tick)
  runLandlords(world, tick)
  runNpcVentures(world, tick)
  runNpcHomeBuying(world, tick)
  // The street's own weather moves before anybody prices against it next
  // month — a gentrifying block appreciates under its owners and a fading
  // one cheapens honestly (housing spec, Verdant layer).
  runNeighbourhoodDrift(world, tick)
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
  /**
   * COMPUTED ONCE, USED TWICE (profiled at world-year 200: this function
   * was the single most expensive item in the month at 768ms per twelve
   * ticks, and half of it was computing every household's income and costs
   * for the median here and then AGAIN, identically, in the action loop
   * below).
   *
   * SAFE TO CACHE, and verified rather than assumed: the action loop's
   * mutations — bankruptcy filings, voided holdings, written debts — touch
   * nothing these two functions read. `householdIncome` is wages, service
   * pay, sports pay and pensions; `householdCosts` is rent, living costs
   * and tuition. None of those move when another household files. The
   * golden fingerprints are the proof: they were pinned before this cache
   * and pass unchanged with it, which is only possible if every reused
   * value equals what the recomputation returned.
   */
  const cached = new Map<number, { income: Money; costs: Money }>()
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null) continue
    const held = cached.get(household.id)
    const income = held?.income ?? householdIncome(world, household)
    const costs = held?.costs ?? householdCosts(world, household)
    cached.set(household.id, { income, costs })
    spare.push(income - costs)
  }
  const townMedian = medianMonthlyIncome(spare)

  for (const household of [...world.households.values()]) {
    if (household.dissolvedTick !== null) continue

    // WHO IS ACTUALLY INSOLVENT UNDER THIS ROOF.
    //
    // Not only the household that cannot make rent. A person can be square
    // with their landlord and buried in loans, and that person is exactly
    // who a repayment plan is for — measured, the first version looked only
    // at arrears, and so chapter 13 never once fired in four centuries
    // while chapter 7 fired 195 times. Both roads have to be real.
    const arrears = arrearsOf(world, household)
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
    const owed = distressDebtOf(accounts, (-arrearsOf(world, household)) as Money)
    const income = householdIncome(world, household)
    const costs = householdCosts(world, household)
    /**
     * THE −$500,000 FENCE (H1, owner: "you go into the negatives until
     * you hit 500k where then it'll trigger the bankruptcy paperwork").
     * The ordinary insolvency test keeps asking in loan crises as it
     * always has; the fence guarantees the ask fires whatever the ratios
     * say once the wallet itself is half a million down.
     */
    const deepUnder = arrearsOf(world, household) >= 50_000_000
    if (!deepUnder && !isInsolvent(owed, income, costs)) continue

    const open = chaptersOpenTo(world, head.id, income - costs, townMedian, tick)
    if (open.length === 0) {
      /**
       * THE COURTHOUSE IS SHUT AND THE ROOF STAYS ANYWAY (H1, owner: "get
       * rid of the streets idea... you go into the negatives"). This used
       * to evict — the measured alternative was a free-fall to -$680,582 —
       * but that measurement predates the −$500k filing fence. The debt
       * rides the wallet until the court reopens; nobody sleeps outside
       * over money.
       */
      continue
    }

    if (head.id === world.player.personId) {
      raisePending(world, {
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
      /**
       * AND THE COURT WAITS FOR AN ANSWER (live player, on itch, carrying
       * a chapter 7 he never chose: "debt doesn't automatically mean file
       * for bankruptcy").
       *
       * The ask was built and the owner's rule was written right above it
       * — "they can say no" — but the fallthrough beneath treated a player
       * whose decision slot happened to be FULL as if they were an NPC and
       * filed for them. Being in the middle of answering a school moment
       * the month the court came calling was enough to be liquidated
       * without ever seeing the question.
       *
       * The player is NEVER routed automatically. Slot full this month?
       * The court comes back next month — the criteria that brought it
       * will still be standing, and so will the question.
       */
      continue
    }

    // NPCs: the court routes them. Where both are open the honest default
    // is the one that keeps the home — a plan is what a person with income
    // is actually put on.
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
  const arrears = arrearsOf(world, household)
  const owed = totalOwedBy(accounts, (-arrears) as Money)
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
    // H0: the arrears ARE the wallet's negative; the filing folds them into
    // the plan's `owed`, so the wallet comes back to zero here — the same
    // money, moved from a hole into a schedule.
    {
      const wallet = walletOf(world, personId)
      const liquid = wallet.checking + wallet.savings
      if (liquid < 0) {
        setAccounts(world, { ...wallet, checking: (wallet.checking - liquid) as Money })
      }
    }
    world.households.set(household.id, { ...household, savings: 0 as Money })
  } else {
    // Chapter 7. What is not exempt is sold; the homestead allowance and
    // essential property come through, so nobody is stripped to nothing.
    const liquid = (accounts.checking + accounts.savings) as Money
    // H1 filers arrive with NEGATIVE liquid — arrears are the reason they
    // are here. Unclamped, that negative flowed through `exempt` straight
    // into the savings bucket, and the wallet-hole discharge below then
    // mirrored it into conjured positive checking. Nothing is exempt from
    // a hole; the floor is zero.
    const exempt = Math.max(0, Math.min(liquid, PROPERTY_EXEMPTION))
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
      //
      // AND A STUDENT LOAN SURVIVES EITHER WAY. The spec asks for this
      // ruling to be made and documented, so: it is the realistic one,
      // and it is the more interesting one. A discharged education debt
      // would make bankruptcy the obvious end of every degree and drain
      // the choice at eighteen of its weight. This way the debt is the
      // long consequence it is meant to be — the balance of the bargain
      // struck in credit.ts, where the same loan is the ONE product in
      // this game that nobody is refused for having no money.
      loans: accounts.loans.filter(
        (loan) => loan.kind === 'student' || (keepsHome && loan.kind === 'mortgage'),
      ),
      homePlaceId: keepsHome ? accounts.homePlaceId : null,
      homePurchasePrice: keepsHome ? accounts.homePurchasePrice : (0 as Money),
    })
    // H0: the liquidation discharges the wallet's hole along with the
    // loans — the fresh start is a zero, not a negative.
    {
      const wallet = walletOf(world, personId)
      const liquid = wallet.checking + wallet.savings
      if (liquid < 0) {
        setAccounts(world, { ...wallet, checking: (wallet.checking - liquid) as Money })
      }
    }
    world.households.set(household.id, { ...household, savings: 0 as Money })
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

    // The plan collects from the WALLET (H0) — the same place every other
    // monthly obligation draws — and the paying record stays personal.
    const wallet = walletOf(world, personId)
    const fromChecking = Math.max(0, Math.min(filing.planMonthly, wallet.checking))
    const fromSavings = Math.max(0, Math.min(filing.planMonthly - fromChecking, wallet.savings))
    if (fromChecking + fromSavings > 0) {
      setAccounts(world, {
        ...wallet,
        checking: (wallet.checking - fromChecking) as Money,
        savings: (wallet.savings - fromSavings) as Money,
      })
      const own = accountsOf(world, personId)
      // Months met under a plan build the file back the same way months
      // met on a loan do. It is the same thing: a record of paying.
      setAccounts(world, { ...own, monthsPaid: own.monthsPaid + 1 })
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
      const behind = arrearsOf(world, household)
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
    applyPlanDischargeToLoans(world, personId)
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
/**
 * WHICH LOANS RIDE THROUGH A CHAPTER 13 UNTOUCHED.
 *
 * The same two survivors chapter 7 keeps, for the same documented reasons:
 * a STUDENT loan survives every bankruptcy in this game (the ruling above
 * fileBankruptcy — the education debt is the long consequence the college
 * choice is meant to carry), and a MORTGAGE is secured by the home itself.
 * Everything else was consolidated into the plan the day it was filed.
 */
function survivesChapter13(loan: Loan): boolean {
  return loan.kind === 'student' || loan.kind === 'mortgage'
}

/**
 * THE DISCHARGE ACTUALLY DISCHARGES (live player, on itch: "there is no
 * way to pay off your chapter 13 debt, every time I click payoff amount it
 * pays like a percentage and just keeps the rest of the debt causing the
 * player to fall into a constant cycle of switching street").
 *
 * He was right, and the mechanism was bookkeeping without consequence.
 * Chapter 7 clears `accounts.loans` at the filing — the filter is right
 * there in fileBankruptcy. Chapter 13 never touched the loans ANYWHERE in
 * its lifecycle: not at filing, not at term's end, not at early payoff.
 * The filing recorded a `discharged` figure, the life story printed it,
 * and the loans sat in the accounts still being collected. A player paid
 * the plan in full and walked out owing everything the plan was supposed
 * to settle.
 *
 * ONE writer for both discharge sites — term served and early payoff —
 * because two copies of this filter is how chapter 7 and chapter 13
 * drifted apart in the first place.
 */
function applyPlanDischargeToLoans(world: World, personId: EntityId): void {
  const accounts = accountsOf(world, personId)
  const kept = accounts.loans.filter(survivesChapter13)
  if (kept.length === accounts.loans.length) return
  setAccounts(world, { ...accounts, loans: kept })
}

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
  applyPlanDischargeToLoans(world, personId)
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
/**
 * RETIRED (H1). Nobody loses housing over money anymore — arrears ride the
 * wallet to the bankruptcy paperwork. The function is gone rather than
 * dormant so no future pass can quietly call it back into service.
 */

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

  for (const household of [...world.households.values()]) {
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
/**
 * THE HOUSE PASSES (H2 — "the house your grandfather bought" is now a
 * sentence the game can truthfully say). The eldest living child takes the
 * deed, the same heir rule the businesses use; with no heir the home goes
 * back to the town's stock. The mortgage does NOT follow the house — the
 * estate's cash settled what it settled, and burdening an heir with a dead
 * man's loan would make every inheritance a trap.
 */
/**
 * THE LANDLORD IS A PERSON (owner's property-ui mockup: "Monthly Rental
 * Income"). A household's roof money used to vanish into the void whatever
 * the deed said; now, where the roof over a family is a home some living
 * person owns, the month's roof lands in that owner's wallet. The void
 * landlord remains only for homes nobody owns — the market keeps those.
 *
 * Conservation: the tenant household is billed exactly this number through
 * `householdCosts`, and under H1 an unpayable month rides as their own
 * negative balance — so the rent is always "paid", in cash or in debt,
 * and crediting the owner moves money rather than minting it.
 */
function runLandlords(world: World, tick: Tick): void {
  void tick
  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    if (household.dissolvedTick !== null || household.memberIds.length === 0) continue
    if (household.homelessSinceTick !== null) continue
    if (everybodyInHalls(world, household)) continue
    if (typeof household.propertyId !== 'string') continue
    const property = world.properties.get(household.propertyId)
    const ownerId = property?.ownerId ?? null
    if (property === undefined || ownerId === null) continue
    const owner = world.people.get(ownerId)
    if (owner === undefined || owner.deathTick !== null) continue
    // Living in your own house is shelter, not income.
    if (household.memberIds.includes(ownerId)) continue
    const rent = roofCostFor(world, household)
    if (rent > 0) creditPerson(world, ownerId, rent)
  }
}

/**
 * Why the mortgage cannot be rewritten today, or null (the bar pattern).
 * The one honest reason to refinance is a better rate, and the file is
 * what earns it — so the bar and the button read the same comparison.
 */
export function refinanceBar(world: World, personId: EntityId): string | null {
  const accounts = accountsOf(world, personId)
  const mortgage = accounts.loans.find((l) => l.kind === 'mortgage')
  if (mortgage === undefined) return 'There is no mortgage to rewrite.'
  if (mortgage.missedMonths > 0) return 'The bank will not rewrite a loan that is behind.'
  const offered = offeredRatePerMille(world, creditOf(world, personId), 'mortgage')
  if (offered >= mortgage.ratePerMille) {
    return `The bank offers ${String(offered / 10)}% against your ${String(mortgage.ratePerMille / 10)}% — nothing worth signing.`
  }
  return null
}

/** Rewrite the mortgage at today's file: same balance, fresh thirty years. */
export function refinanceMortgage(world: World, tick: Tick, personId: EntityId): boolean {
  if (refinanceBar(world, personId) !== null) return false
  const accounts = accountsOf(world, personId)
  const mortgage = accounts.loans.find((l) => l.kind === 'mortgage')
  if (mortgage === undefined) return false
  const rate = offeredRatePerMille(world, creditOf(world, personId), 'mortgage')
  const rewritten: Loan = {
    ...mortgage,
    ratePerMille: rate,
    monthlyPayment: monthlyPaymentFor(mortgage.balance, rate, 360),
    takenAtTick: tick,
    maturesAtTick: (tick + 360) as Tick,
  }
  setAccounts(world, {
    ...accounts,
    loans: accounts.loans.map((l) => (l.kind === 'mortgage' ? rewritten : l)),
  })
  recordEvent(world, tick, {
    type: 'refinanced',
    subjectId: personId,
    detail: `${String(mortgage.ratePerMille)}:${String(rate)}`,
  })
  return true
}

/** What a person's tenanted properties bring in a month — the screen's read. */
export function rentalIncomeOf(world: World, personId: EntityId): Money {
  let total = 0
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null || household.memberIds.length === 0) continue
    if (household.homelessSinceTick !== null) continue
    if (everybodyInHalls(world, household)) continue
    if (typeof household.propertyId !== 'string') continue
    const property = world.properties.get(household.propertyId)
    if (property === undefined || property.ownerId !== personId) continue
    if (household.memberIds.includes(personId)) continue
    total += roofCostFor(world, household)
  }
  return total as Money
}

/**
 * The bank's sale. Distressed — 85 cents on the dollar is what a forced
 * sale fetches — the lender recovers up to what it is owed, and whatever
 * is left over belongs to the family. Returns the surplus in cents; the
 * caller (the loan loop) puts it into their savings, because the loop is
 * mid-write on that very record. The deed goes back to the market.
 */
function forecloseHome(world: World, personId: EntityId, owed: Money): Money {
  const person = world.people.get(personId)
  const household =
    person === undefined || person.householdId === null
      ? undefined
      : world.households.get(person.householdId)
  const owned = propertiesOwnedBy(world, personId)
  if (owned.length === 0) return 0 as Money
  // The mortgage secures the RESIDENCE where they own it; otherwise the
  // first deed on the registry goes.
  const home =
    (household !== undefined && typeof household.propertyId === 'string'
      ? owned.find((p) => p.id === household.propertyId)
      : undefined) ?? owned[0]
  if (home === undefined) return 0 as Money
  const distressed = Math.floor((propertyValueOf(world, home) * 850) / 1_000)
  setOwner(world, home.id, null)
  return Math.max(0, distressed - owed) as Money
}

export function passOnHomes(world: World, tick: Tick, deceasedId: EntityId): void {
  const deceased = accountsOf(world, deceasedId)
  if (deceased.homePlaceId === null) return
  // THE WIDOW KEEPS THE HOUSE. A surviving spouse inherits the home before
  // any child does — this must run before relationships turns the marriage
  // to widowhood, which performDeath's ordering guarantees. Only when no
  // spouse survives does it pass down a generation, eldest child first.
  const spouse = spouseOf(world, deceasedId)
  const survivor = spouse === null ? undefined : world.people.get(spouse)
  const heirId =
    survivor !== undefined && survivor.deathTick === null
      ? survivor.id
      : ([...world.people.values()]
          .filter((person) => person.deathTick === null && person.parentIds.includes(deceasedId))
          .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]?.id ?? null)

  for (const property of world.properties.values()) {
    if (property.ownerId !== deceasedId) continue
    setOwner(world, property.id, heirId)
    if (heirId !== null) {
      recordEvent(world, tick, {
        type: 'inherited-home',
        subjectId: heirId,
        otherId: deceasedId,
        detail: property.address,
      })
    }
  }
  if (heirId !== null) {
    const heir = accountsOf(world, heirId)
    setAccounts(world, {
      ...heir,
      homePlaceId: deceased.homePlaceId,
      homePurchasePrice: deceased.homePurchasePrice,
    })
  }
  setAccounts(world, { ...deceased, homePlaceId: null, homePurchasePrice: 0 as Money })
}

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
/**
 * NPCS BUY HOMES (H2). The founding sixty-two percent decays without this:
 * every death and every new household pulls the town back toward renting,
 * and thirty years in, "most families own" quietly stops being true. A
 * renting household whose head has sustained surplus and the price in hand
 * considers the house they already live in — seeded, character-shaped,
 * never universal. Law 2: they are buying homes for their own lives, not
 * to keep a statistic company.
 */
function runNpcHomeBuying(world: World, tick: Tick): void {
  for (const household of [...world.households.values()]) {
    if (household.dissolvedTick !== null || household.propertyId === undefined || household.propertyId === null) continue
    const property = world.properties.get(household.propertyId)
    if (property === undefined || (property.ownerId ?? null) !== null) continue
    const head = eldestMember(world, household)
    if (head === undefined || head.id === world.player.personId) continue
    const wallet = walletOf(world, head.id)
    const price = propertyValueOf(world, property)
    // The whole price in hand plus a season's cushion — an NPC pays cash,
    // and one that would be broke the day after does not sign.
    if (wallet.checking + wallet.savings < price + Math.floor(price / 4)) continue
    const rng = openStream(world.seed, Stream.Career, head.id, tick + 77_100)
    if (!rng.chance(Math.max(20, Math.floor(head.traits.diligence / 8)), 1_000)) continue
    buyHome(world, tick, head.id, household.placeId, 'cash', property.id)
  }
}

function runNpcVentures(world: World, tick: Tick): void {
  if (tick % 6 !== 3) return // twice a year, on a fixed month
  for (const person of [...world.people.values()]) {
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
    // WHAT THEY COULD OPEN AND STILL HAVE A YEAR TO LIVE ON, and that
    // EXISTS in this year. Nobody opens a computer shop in 1971, and
    // nobody opens a video rental in 2015 (the owner's era ruling); the
    // town's own founders obey the same calendar the player's founding
    // screen shows.
    const year = toDate(world, tick).year
    const affordable = [...BUSINESS_KINDS]
      .filter(
        (entry) =>
          kindAvailableIn(entry, year) && cash - keepBy >= atTodaysPrices(world, entry.capital),
      )
      .sort((a, b) => a.capital - b.capital)
    if (affordable.length === 0) continue

    const rng = openStream(world.seed, Stream.Career, person.id, tick + 11_900)
    /**
     * AMBITION REACHES; IT DOES NOT MAXIMISE (Law 2 — people are not a
     * strategy, they are themselves).
     *
     * This used to take the BIGGEST trade the money allowed. With five
     * kinds that was a reasonable shorthand. With twenty it made a
     * monoculture: MEASURED over 150 years at seed 12345, software
     * companies were 28 of 47 businesses in the whole town — every
     * moneyed founder after 2002 opened the same thing — and a video
     * rental shop was never opened once, because something bigger was
     * always affordable during its twenty-five years.
     *
     * So ambition sets where in the range they AIM, and a seeded jitter
     * means two equally driven people in the same year do not open the
     * same shop.
     */
    const top = affordable.length - 1
    const reach = Math.max(0, Math.min(1000, person.traits.ambition - 600)) / 400
    const aimed = Math.floor(top * Math.min(1, reach))
    const jitter = rng.nextIntInclusive(-2, 2)
    const kind = affordable[Math.max(0, Math.min(top, aimed + jitter))]
    if (!kind) continue
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
      toDate(world, tick).year,
    )

    if (profit >= 0) {
      // A share is drawn as income and the rest is retained, which is how a
      // business grows into a bigger one without a second mechanism.
      //
      // UP TO A CEILING. Unbounded retention compounds: measured, a century
      // of it left one owner holding $386 billion. Past four times what the
      // trade took to open, the whole profit is drawn instead — there is
      // only so much capital one shop can absorb.
      //
      // A SCALED COMPANY HAS A DIFFERENT CEILING, AND A DIFFERENT SPLIT
      // (careers overhaul, Fix 3B). Both halves matter and they are the
      // whole reason to scale up:
      //
      //   the CEILING lifts, so there is somewhere for the money to go —
      //     without it, scaling up would be a title and no growth;
      //   the SPLIT inverts. An owner-operator draws the profit and retains
      //     a slice. A founder-chief-executive takes a SALARY and leaves the
      //     rest in the company, where it becomes capital, and capital is
      //     what the valuation is made of. That is how a company grows into
      //     something worth taking public, and it is a genuine trade: less
      //     money in your hand each month, far more of it on paper.
      const scaled = business.scaledAtTick != null
      const ceiling = (atTodaysPrices(world, kind.capital) *
        (scaled ? COMPANY_CEILING_MULTIPLE : CAPITAL_CEILING_MULTIPLE)) as Money
      const room = Math.max(0, ceiling - business.capital)
      const retained = scaled
        ? Math.min(Math.max(0, profit - founderSalaryOf(business, kind)), room)
        : Math.min(Math.floor((profit * 300) / 1000), room)
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
  // BOTH SIDES OF THE WINDOW ARE THE WALLET'S (H0): a married couple move
  // money between the accounts they actually share.
  const accounts = walletOf(world, personId)
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
/**
 * BUY SHARES IN A NAMED COMPANY (spec §7).
 *
 * Deliberately a sibling of `buyInvestment` rather than a parameter on
 * it: the two differ in what they price against and in nothing else, and
 * a boolean flag threaded through the existing one would have made every
 * caller decide something it does not care about.
 *
 * The rules it shares are the ones that matter — money comes out of
 * savings and only what the shares actually cost, the remainder stays as
 * cash rather than vanishing, and positions merge by their own key so a
 * purchase of Vantek can never fold into the Technology fund.
 */
/**
 * SHARES THAT ARRIVE WITHOUT BEING BOUGHT (careers overhaul, Fix 3C).
 *
 * A founder does not purchase their own stake at the IPO — they already
 * owned the company; the float turns that ownership into shares. So there
 * is no cash leg, which is exactly why this cannot be `buyShares` with a
 * zero price: that would set a cost basis of nothing and tax the entire
 * value as a gain the first time they sold a single share.
 *
 * The COST BASIS is what the company was worth to them when it listed,
 * which is the honest answer and the one that makes selling down behave
 * like selling down rather than like a windfall.
 */
export function grantShares(
  world: World,
  personId: EntityId,
  stockId: string,
  sectorId: string,
  shares: number,
  basis: Money,
): void {
  if (shares <= 0) return
  const accounts = accountsOf(world, personId)
  const existing = accounts.holdings.find((h) => h.stockId === stockId)
  const merged: Holding = {
    sectorId,
    stockId,
    units: (existing?.units ?? 0) + shares,
    costBasis: ((existing?.costBasis ?? 0) + basis) as Money,
  }
  const rest = accounts.holdings.filter((h) => h.stockId !== stockId)
  setAccounts(world, {
    ...accounts,
    holdings: [...rest, merged].sort((a, b) =>
      holdingKeyOf(a) < holdingKeyOf(b) ? -1 : holdingKeyOf(a) > holdingKeyOf(b) ? 1 : 0,
    ),
  })
}

/**
 * A COMPANY FAILED AND THE PAPER IS WORTH NOTHING (owner: "some companies
 * fail and some succeed").
 *
 * Called by the tick loop when the market delists something. It lives HERE
 * rather than in market.ts because accounts are finances' to write and
 * always have been — the market may kill a company, but only this module
 * may reach into somebody's savings (Law 12).
 *
 * The holding is REMOVED rather than zeroed. A share in a company that no
 * longer exists is not an asset worth nothing, it is not an asset, and
 * leaving a zero-valued row in the portfolio would show a dead company in
 * somebody's holdings for the rest of their life.
 *
 * NO LOSS IS REALISED. There is nothing to realise: the tax system taxes
 * disposals, and this is not a disposal. Whether a wipe-out should be
 * deductible is a real question with a real answer in tax law, and
 * inventing one here would be inventing tax policy nobody asked for.
 */
export function voidHoldingsIn(world: World, stockId: string): number {
  let touched = 0
  for (const personId of world.people.keys()) {
    const accounts = world.accounts.get(personId)
    if (accounts === undefined) continue
    const held = accounts.holdings.some((h) => h.stockId === stockId)
    const retired = accounts.retirementHoldings.some((h) => h.stockId === stockId)
    if (!held && !retired) continue
    touched += 1
    setAccounts(world, {
      ...accounts,
      holdings: accounts.holdings.filter((h) => h.stockId !== stockId),
      retirementHoldings: accounts.retirementHoldings.filter((h) => h.stockId !== stockId),
    })
  }
  return touched
}

export function buyShares(
  world: World,
  tick: Tick,
  personId: EntityId,
  stockId: string,
  cents: Money,
  intoRetirement = false,
): Money {
  const stock = stockById(world, stockId)
  if (stock === undefined) return 0 as Money
  const accounts = accountsOf(world, personId)
  // MONEY FROM THE WALLET, POSITIONS ON THE PERSONAL FILE (H0).
  const wallet = walletOf(world, personId)
  const affordable = Math.min(cents, Math.max(0, wallet.savings)) as Money
  if (affordable <= 0) return 0 as Money
  const shares = sharesFor(world, stockId, affordable)
  if (shares <= 0) return 0 as Money
  const spent = Math.floor((shares * (world.stockPrices[stockId] ?? 10_000)) / 10_000) as Money

  const which = intoRetirement ? accounts.retirementHoldings : accounts.holdings
  const existing = which.find((h) => h.stockId === stockId)
  const merged: Holding = {
    sectorId: stock.sectorId,
    stockId,
    units: (existing?.units ?? 0) + shares,
    costBasis: ((existing?.costBasis ?? 0) + spent) as Money,
  }
  const rest = which.filter((h) => h.stockId !== stockId)
  const updated = [...rest, merged].sort((a, b) =>
    holdingKeyOf(a) < holdingKeyOf(b) ? -1 : holdingKeyOf(a) > holdingKeyOf(b) ? 1 : 0,
  )
  // Wallet first, file re-read after — one record when unmarried.
  setAccounts(world, { ...wallet, savings: (wallet.savings - spent) as Money })
  setAccounts(world, {
    ...accountsOf(world, personId),
    holdings: intoRetirement ? accounts.holdings : updated,
    retirementHoldings: intoRetirement ? updated : accounts.retirementHoldings,
  })
  recordEvent(world, tick, {
    type: 'bought-investment',
    subjectId: personId,
    detail: stock.ticker + ':' + String(spent),
  })
  return spent
}

/**
 * SELL SHARES, at today's price. The gain over the cost basis is realized
 * and taxed exactly as a fund sale is — the retirement account is the
 * only thing that changes that, and it changes it the same way here.
 */
export function sellShares(
  world: World,
  tick: Tick,
  personId: EntityId,
  stockId: string,
  fromRetirement = false,
): Money {
  const accounts = accountsOf(world, personId)
  const which = fromRetirement ? accounts.retirementHoldings : accounts.holdings
  const holding = which.find((h) => h.stockId === stockId)
  if (!holding || holding.units <= 0) return 0 as Money

  const proceeds = holdingValue(world, holding)
  const gain = Math.max(0, proceeds - holding.costBasis)
  const tax = fromRetirement ? 0 : capitalGainsTaxOn(gain as Money)
  const net = (proceeds - tax) as Money
  const rest = which.filter((h) => h.stockId !== stockId)
  // TAXABLE PROCEEDS TO THE WALLET; a retirement sale stays INSIDE the
  // retirement account, exactly as the fund path (sellInvestment) rules —
  // this used to pay sheltered proceeds into savings, an untaxed door out
  // of the shelter that the fund path had already closed.
  if (fromRetirement) {
    setAccounts(world, {
      ...accounts,
      retirement: (accounts.retirement + net) as Money,
      retirementHoldings: rest,
    })
  } else {
    const wallet = walletOf(world, personId)
    setAccounts(world, { ...wallet, savings: (wallet.savings + net) as Money })
    setAccounts(world, { ...accountsOf(world, personId), holdings: rest })
  }
  recordEvent(world, tick, {
    type: 'sold-investment',
    subjectId: personId,
    detail: (stockById(world, stockId)?.ticker ?? stockId) + ':' + String(net),
  })
  return net
}

export function buyInvestment(
  world: World,
  tick: Tick,
  personId: EntityId,
  sectorId: string,
  cents: Money,
  intoRetirement = false,
): Money {
  const accounts = accountsOf(world, personId)
  // MONEY FROM THE WALLET, POSITIONS ON THE PERSONAL FILE (H0).
  const wallet = walletOf(world, personId)
  const affordable = Math.min(cents, Math.max(0, wallet.savings)) as Money
  if (affordable <= 0) return 0 as Money
  const units = unitsFor(world, sectorId, affordable)
  if (units <= 0) return 0 as Money
  // Only what the units actually cost leaves the account; the rounding
  // remainder stays as savings rather than vanishing.
  const spent = Math.floor((units * (world.sectorPrices[sectorId] ?? 10_000)) / 10_000) as Money

  const which = intoRetirement ? accounts.retirementHoldings : accounts.holdings
  // THE FUND POSITION ONLY. `h.sectorId === sectorId` alone would have
  // matched a holding of Vantek when buying the Technology fund, and
  // merged a company into it.
  const existing = which.find((h) => h.stockId === undefined && h.sectorId === sectorId)
  const merged: Holding = {
    sectorId,
    units: (existing?.units ?? 0) + units,
    costBasis: ((existing?.costBasis ?? 0) + spent) as Money,
  }
  const rest = which.filter((h) => h.stockId !== undefined || h.sectorId !== sectorId)
  const updated = [...rest, merged].sort((a, b) =>
    holdingKeyOf(a) < holdingKeyOf(b) ? -1 : holdingKeyOf(a) > holdingKeyOf(b) ? 1 : 0,
  )

  // Wallet first, file re-read after — one record when unmarried.
  setAccounts(world, { ...wallet, savings: (wallet.savings - spent) as Money })
  setAccounts(world, {
    ...accountsOf(world, personId),
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
  const holding = which.find((h) => h.stockId === undefined && h.sectorId === sectorId)
  if (!holding || holding.units <= 0) return 0 as Money

  const proceeds = holdingValue(world, holding)
  const gain = Math.max(0, proceeds - holding.costBasis)
  // Capital gains, on what was actually made, and never inside retirement.
  const tax = fromRetirement ? 0 : capitalGainsTaxOn(gain as Money)
  const net = (proceeds - tax) as Money
  // AND ONLY THE FUND POSITION IS REMOVED. Filtering on sectorId alone
  // would have sold every company holding in that sector along with it,
  // crediting only the fund's proceeds — the shares would simply vanish.
  const rest = which.filter((h) => h.stockId !== undefined || h.sectorId !== sectorId)

  // TAXABLE PROCEEDS TO THE WALLET (H0); sheltered ones stay inside the
  // personal retirement account.
  if (fromRetirement) {
    setAccounts(world, {
      ...accounts,
      retirement: (accounts.retirement + net) as Money,
      retirementHoldings: rest,
    })
  } else {
    const wallet = walletOf(world, personId)
    setAccounts(world, { ...wallet, savings: (wallet.savings + net) as Money })
    setAccounts(world, { ...accountsOf(world, personId), holdings: rest })
  }
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
    // Taxable dividends land in the WALLET (H0); the tax year and the
    // sheltered compounding stay on the personal file.
    setAccounts(world, {
      ...accounts,
      retirement: (accounts.retirement + sheltered) as Money,
      taxableYtd: (accounts.taxableYtd + taxable) as Money,
    })
    if (taxable > 0) {
      const wallet = walletOf(world, personId)
      setAccounts(world, { ...wallet, savings: (wallet.savings + taxable) as Money })
    }
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
  for (const person of [...world.people.values()]) {
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
  for (const person of [...world.people.values()]) {
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

    /**
     * THE SHOCK HAS TO FIT THE LIFE IT LANDS ON (playtest, Jack Baldwin: a
     * lifelong renter was handed "The roof has been leaking... $233,605.24
     * to put it right" — "structural repair costs are a landlord's
     * responsibility for a renter... and the amount itself is wildly out of
     * scale").
     *
     * Both halves were real. The kind was rolled with no ownership check,
     * so renters drew repair bills for roofs they do not own. And every
     * shock was sized as a share of liquid wealth — right for a scam, which
     * takes what it finds, and absurd for a roof, which costs what roofs
     * cost whether you are rich or broke.
     */
    const owns = propertiesOwnedBy(world, person.id).length > 0
    let kind = SHOCK_KINDS[rng.nextIntInclusive(0, SHOCK_KINDS.length - 1)] ?? 'medical'
    if (kind === 'repairs' && !owns) kind = rng.chance(1, 2) ? 'medical' : 'scam'

    let bill: Money
    if (kind === 'repairs') {
      // A REAL TRADESMAN'S NUMBER, at today's prices — not a wealth share.
      bill = atTodaysPrices(world, rng.nextIntInclusive(60_000, 450_000) as Money) as Money
    } else if (kind === 'medical') {
      // THROUGH THE RESOLVER, like every other care cost (M-BENEFITS §3:
      // "every care action is paid through the resolver"). This shock
      // predates the coverage system and was billing gross — an insured
      // person's surprise bill is their share, an uninsured person's is
      // the whole thing, and that difference is the entire point of
      // carrying insurance.
      const gross = atTodaysPrices(world, rng.nextIntInclusive(150_000, 1_200_000) as Money) as Money
      bill = outOfPocketFor(world, person.id, gross, false, tick)
      if (bill <= 0) continue
    } else {
      // A scam takes what it finds: a fifth to a third of liquid money.
      bill = Math.max(625, Math.floor((worth * rng.nextIntInclusive(200, 340)) / 1000)) as Money
    }

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
  // A BILL IS PAID FROM THE WALLET (H0) — the couple's money, not a
  // shadow ledger on one spouse's file.
  const accounts = walletOf(world, personId)
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

    const owed = incomeTaxFor(accounts.taxableYtd, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille)
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
  /**
   * RETIRED AS AN AUTOMATIC PASS (H1, owner: "get rid of the streets
   * idea... we are still getting caught up in the lost the housing,
   * nowhere cheaper to go, and switching new roofs"). The forced march
   * down the rent ladder — even at one move a year — was the churn the
   * players kept reporting, and under H0/H1 it defends nothing: arrears
   * ride the wallet to the −$500k paperwork instead of compounding on a
   * building. Moving somewhere cheaper is the PLAYER'S choice from the
   * housing screen now; an NPC household's only forced move is one a
   * court orders.
   *
   * The husk stays so the call site reads as a decision, not an accident.
   */
  void world
  void tick
}

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

/**
 * Called by mortality on every death without a surviving spouse (H0 — money
 * is personal, so the will no longer waits for the building to empty). The
 * deceased's money passes to their living children, split equally, eldest
 * taking the remainder cent. Debts die with the person: a negative estate
 * passes nothing rather than billing the children — grief is not a ledger.
 *
 * This is the first piece of generational legacy: a family that saved leaves
 * its children genuinely better off, and the record says where it came from.
 */
export function distributeEstate(world: World, tick: Tick, deceased: Person): void {
  // M-ECON §1. AN ESTATE IS A PERSON'S MONEY, not a building's. It used to
  // be whatever the roof happened to hold, which meant a widow's savings
  // passed as "the household's" and a lodger's did not exist at all.
  const estate = accountsOf(world, deceased.id)
  // The portfolio is liquidated into the estate — the closing block below
  // empties the holdings arrays, and deleting positions UNVALUED would be
  // burning real money at every funeral.
  const gross = (estate.checking +
    estate.savings +
    estate.brokerage +
    estate.retirement +
    portfolioValue(world, estate.holdings) +
    portfolioValue(world, estate.retirementHoldings)) as Money
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

    // Into the heir's WALLET savings (H0) — an inheritance is money
    // somebody has, and a married heir's money lives on the joint record.
    const heirWallet = walletOf(world, heir.id)
    setAccounts(world, { ...heirWallet, savings: (heirWallet.savings + amount) as Money })
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
