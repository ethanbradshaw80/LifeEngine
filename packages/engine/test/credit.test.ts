/**
 * M-ECON §6. Debt, credit, and a house.
 *
 * THE CLAIMS, which are the spec's acceptance targets: a level payment
 * actually clears a loan within its term, computed in integers with no
 * `Math.pow` anywhere near it; a score is DERIVED from the record rather
 * than stored beside it; a poor file makes borrowing dear before it makes
 * it impossible; three missed months is a default and a defaulted mortgage
 * takes the house; and paying steadily opens the door again — because a
 * score that only ever falls is a punishment, not a door (C3 §5).
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  CREDIT_MAX,
  CREDIT_MIN,
  CREDIT_START,
  LOAN_TERMS,
  creditScoreOf,
  creditWords,
  depositFor,
  homeEquityOf,
  homePriceFor,
  loanBar,
  loanTermsFor,
  monthlyPaymentFor,
  offeredRatePerMille,
  totalDebtOf,
} from '../src/credit.js'
import { accountsOf, buyHome, creditOf, homeValueOf, takeLoan } from '../src/finances.js'
import type { Loan } from '../src/types.js'

function fund(world: ReturnType<typeof createWorld>, personId: number, savings: number): void {
  world.accounts.set(personId as never, {
    ...accountsOf(world, personId as never),
    savings: savings as Money,
  })
}

function anAdult(world: ReturnType<typeof createWorld>) {
  const person = [...world.people.values()]
    .filter((p) => p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick)[0]
  expect(person).toBeDefined()
  return person!
}

/** Amortise the loan by hand, the same way serviceDebts does, and see. */
function monthsToClear(principal: number, ratePerMille: number, payment: number): number {
  let balance = principal
  for (let month = 1; month <= 1200; month++) {
    balance += Math.floor((balance * ratePerMille) / 12_000)
    balance -= payment
    if (balance <= 0) return month
  }
  return Infinity
}

describe('the monthly payment', () => {
  it('clears the loan inside its term, at every rate the world can produce', () => {
    for (const terms of LOAN_TERMS) {
      for (const rate of [0, 30, 60, 120, 240, 400]) {
        const principal = 2_500_000
        const payment = monthlyPaymentFor(principal as Money, rate, terms.months)
        expect(payment).toBeGreaterThan(0)
        expect(Number.isInteger(payment)).toBe(true)
        expect(monthsToClear(principal, rate, payment)).toBeLessThanOrEqual(terms.months)
        // And it is the SMALLEST such payment — one cent less must not clear
        // it, or the borrower is being overcharged every month for decades.
        if (payment > 1) {
          expect(monthsToClear(principal, rate, payment - 1)).toBeGreaterThan(terms.months)
        }
      }
    }
  })

  it('is nothing on nothing', () => {
    expect(monthlyPaymentFor(0 as Money, 60, 48)).toBe(0)
    expect(monthlyPaymentFor(100_000 as Money, 60, 0)).toBe(0)
  })

  it('is the plain division when the money is free', () => {
    expect(monthlyPaymentFor(120_000 as Money, 0, 12)).toBe(10_000)
  })
})

describe('the score', () => {
  it('starts in the middle and is bounded at both ends', () => {
    const world = createWorld(makeSeed(4004), 40)
    expect(creditScoreOf(world, [], 0, 0)).toBe(CREDIT_START)
    expect(creditScoreOf(world, [], 12, 0)).toBe(CREDIT_MIN)
    expect(creditScoreOf(world, [], 0, 100_000)).toBeLessThanOrEqual(CREDIT_MAX)
  })

  it('is built by paying and broken by defaulting', () => {
    const world = createWorld(makeSeed(4004), 40)
    const paying = creditScoreOf(world, [], 0, 240)
    const defaulted = creditScoreOf(world, [], 1, 240)
    expect(paying).toBeGreaterThan(CREDIT_START)
    expect(defaulted).toBeLessThan(paying)
  })

  it('reopens the door: a default recovers if the record keeps paying', () => {
    // C3 §5's rule, applied to money. The interesting thing about a shut
    // door is that it can be walked back through.
    const world = createWorld(makeSeed(4004), 40)
    const justAfter = creditScoreOf(world, [], 1, 24)
    const yearsLater = creditScoreOf(world, [], 1, 420)
    expect(yearsLater).toBeGreaterThan(justAfter)
    expect(creditWords(yearsLater)).not.toBe(creditWords(justAfter))
  })

  it('is derived, never stored — it moves when the loans do', () => {
    const world = createWorld(makeSeed(1006), 60)
    const person = anAdult(world)
    const clean = creditOf(world, person.id)
    fund(world, person.id, 5_000_000)
    takeLoan(world, world.tick, person.id, 'personal', 3_000_000 as Money)
    expect(creditOf(world, person.id)).toBeLessThan(clean)
  })
})

describe('the rate offered', () => {
  it('makes a bad file expensive before it makes it impossible', () => {
    const world = createWorld(makeSeed(2020), 40)
    const good = offeredRatePerMille(world, 800, 'personal')
    const poor = offeredRatePerMille(world, 600, 'personal')
    expect(poor).toBeGreaterThan(good)
    // Still a number, still a loan somebody could sign.
    expect(poor).toBeLessThan(600)
  })

  it('prices a secured loan below an unsecured one, always', () => {
    const world = createWorld(makeSeed(2020), 40)
    expect(offeredRatePerMille(world, 700, 'mortgage')).toBeLessThan(
      offeredRatePerMille(world, 700, 'auto'),
    )
    expect(offeredRatePerMille(world, 700, 'auto')).toBeLessThan(
      offeredRatePerMille(world, 700, 'personal'),
    )
  })
})

describe('the bar on a loan', () => {
  it('refuses a file below the line, and says the number', () => {
    const world = createWorld(makeSeed(3003), 40)
    const bar = loanBar(world, 'mortgage', 500, [], 90_000_000 as Money, 20_000_000 as Money)
    expect(bar).not.toBeNull()
    expect(bar).toContain('620')
  })

  it('wants the file-gated share down on a house', () => {
    const world = createWorld(makeSeed(3003), 40)
    const price = 20_000_000 as Money
    // Legacy callers keep the flat fifth; a named file gets the ladder.
    expect(depositFor(price)).toBe(4_000_000)
    expect(depositFor(price, 760)).toBe(2_000_000)
    const bar = loanBar(world, 'mortgage', 760, [], 100_000 as Money, price)
    expect(bar).toContain('10%')
    expect(bar).toContain('$20,000.00')
    expect(loanBar(world, 'mortgage', 760, [], depositFor(price, 760), price)).toBeNull()
  })

  it('will not write a second of the same kind', () => {
    const world = createWorld(makeSeed(3003), 40)
    const loan: Loan = {
      kind: 'auto',
      principal: 100_000 as Money,
      balance: 100_000 as Money,
      ratePerMille: 90,
      monthlyPayment: 5_000 as Money,
      takenAtTick: 0 as never,
      maturesAtTick: 60 as never,
      missedMonths: 0,
    }
    expect(loanBar(world, 'auto', 760, [loan], 900_000 as Money, 0 as Money)).toContain('already')
  })
})

describe('taking a loan', () => {
  it('lands the money in savings and the debt on the file, at a fixed rate', () => {
    const world = createWorld(makeSeed(7007), 60)
    const person = anAdult(world)
    fund(world, person.id, 0)
    expect(takeLoan(world, world.tick, person.id, 'personal', 1_200_000 as Money)).toBe(true)

    const accounts = accountsOf(world, person.id)
    expect(accounts.savings).toBe(1_200_000)
    expect(accounts.loans).toHaveLength(1)
    const loan = accounts.loans[0]!
    expect(loan.balance).toBe(1_200_000)
    expect(totalDebtOf(accounts.loans)).toBe(1_200_000)
    const signedAt = loan.ratePerMille

    // The central bank moves; the signed loan does not. That is the whole
    // reason the month you sign matters.
    advanceTicks(world, 120)
    const later = accountsOf(world, person.id).loans.find((l) => l.kind === 'personal')
    if (later) expect(later.ratePerMille).toBe(signedAt)
  })

  it('pays itself off, and the balance never runs away', () => {
    const world = createWorld(makeSeed(7007), 60)
    const person = anAdult(world)
    fund(world, person.id, 8_000_000)
    takeLoan(world, world.tick, person.id, 'auto', 1_000_000 as Money)
    const months = loanTermsFor('auto')!.months

    let worst = 0
    for (let month = 0; month < months + 6; month++) {
      advanceTicks(world, 1)
      if (world.people.get(person.id)?.deathTick !== null) return
      const loan = accountsOf(world, person.id).loans.find((l) => l.kind === 'auto')
      if (!loan) break
      worst = Math.max(worst, loan.balance)
    }
    expect(worst).toBeLessThanOrEqual(1_000_000 + 100_000)
    expect(accountsOf(world, person.id).loans.find((l) => l.kind === 'auto')).toBeUndefined()
  })
})

describe('a house', () => {
  it('is priced off what the street rents for, so the two move together', () => {
    expect(homePriceFor(100_000 as Money)).toBeGreaterThan(homePriceFor(80_000 as Money))
    expect(homePriceFor(0 as Money)).toBe(0)
  })

  it('is bought with a deposit and a mortgage, and shows as equity', () => {
    const world = createWorld(makeSeed(9009), 60)
    const person = anAdult(world)
    const household = person.householdId === null ? null : world.households.get(person.householdId)
    expect(household).toBeTruthy()
    fund(world, person.id, 90_000_000)

    expect(buyHome(world, world.tick, person.id, household!.placeId)).toBe(true)
    const accounts = accountsOf(world, person.id)
    expect(accounts.homePlaceId).toBe(household!.placeId)
    expect(accounts.loans.some((l) => l.kind === 'mortgage')).toBe(true)

    const value = homeValueOf(world, person.id)
    expect(value).toBeGreaterThan(0)
    // Day one, the equity is the deposit — not the whole house.
    const equity = homeEquityOf(accounts.loans, value)
    expect(equity).toBeGreaterThan(0)
    expect(equity).toBeLessThan(value)

    // And it cannot be bought twice.
    expect(buyHome(world, world.tick, person.id, household!.placeId)).toBe(false)
  })
})
