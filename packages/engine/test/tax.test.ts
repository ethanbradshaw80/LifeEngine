/**
 * M-ECON §2 and §3. Tax and interest.
 *
 * THE CLAIMS: the schedule is progressive and exact in integer cents;
 * withholding is a payroll office's guess at a steady year, so a steady
 * year lands close to square and an unsteady one does not; and the return
 * settles the difference, both ways.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { accountsOf, netWorthOf } from '../src/finances.js'
import {
  BASE_SAVINGS_RATE_PER_MILLE,
  ESTATE_TAX_EXEMPTION,
  estateTaxOn,
  incomeTaxFor,
  marginalRatePerMille,
  monthlyInterestOn,
  salesTaxOn,
  withholdingFor,
} from '../src/tax.js'

/**
 * NOTE ON THE FIGURES. Every money literal here is BASE-YEAR money — the
 * world starts in 1970 and the brackets are 1970 brackets, indexed upward
 * by the price level at the moment a return is filed (see incomeTaxFor's
 * priceLevelPerMille). These used to be written in modern dollars against
 * modern brackets, which was consistent until the calibration made the base
 * year mean something.
 */
describe('the income tax schedule', () => {
  it('is progressive, and exact in integer cents', () => {
    expect(incomeTaxFor(0 as Money)).toBe(0)
    // The floor nobody pays on.
    expect(incomeTaxFor(175_000 as Money)).toBe(0)
    // A dollar into the second band pays that band's rate on that dollar.
    expect(incomeTaxFor(175_100 as Money)).toBe(12)

    let previousRate = -1
    for (const annual of [250_000, 500_000, 875_000, 1_500_000, 3_125_000]) {
      const owed = incomeTaxFor(annual as Money)
      expect(Number.isInteger(owed)).toBe(true)
      // Never more than the income, and the EFFECTIVE rate always climbs.
      expect(owed).toBeLessThan(annual)
      const rate = Math.round((owed / annual) * 1000)
      expect(rate).toBeGreaterThan(previousRate)
      previousRate = rate
    }
  })

  it('takes a believable bite across the salary ladder', () => {
    // A labourer keeps most of it; a doctor loses about a third.
    const labourer = incomeTaxFor(375_000 as Money) / 375_000
    const doctor = incomeTaxFor(2_250_000 as Money) / 2_250_000
    expect(labourer).toBeGreaterThan(0.05)
    expect(labourer).toBeLessThan(0.14)
    expect(doctor).toBeGreaterThan(0.22)
    expect(doctor).toBeLessThan(0.36)
  })

  it('names the marginal band the income actually sits in', () => {
    expect(marginalRatePerMille(125_000 as Money)).toBe(0)
    expect(marginalRatePerMille(375_000 as Money)).toBe(120)
    expect(marginalRatePerMille(3_750_000 as Money)).toBe(370)
  })
})

describe('withholding', () => {
  it('is the year annualised and divided back, so a steady year lands square', () => {
    const monthly = 62_500 as Money
    const withheldOverAYear = withholdingFor(monthly) * 12
    const actuallyOwed = incomeTaxFor((monthly * 12) as Money)
    // Within twelve cents: the only gap is the flooring, once per month.
    expect(Math.abs(withheldOverAYear - actuallyOwed)).toBeLessThanOrEqual(12)
  })

  it('never withholds more than the pay, and nothing from nothing', () => {
    expect(withholdingFor(0 as Money)).toBe(0)
    for (const monthly of [100_000, 250_000, 600_000, 1_500_000]) {
      const w = withholdingFor(monthly as Money)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(monthly)
      expect(Number.isInteger(w)).toBe(true)
    }
  })
})

describe('the other taxes', () => {
  it('charges sales tax on spending and nothing on nothing', () => {
    expect(salesTaxOn(0 as Money)).toBe(0)
    expect(salesTaxOn(100_000 as Money)).toBe(7_000)
    expect(Number.isInteger(salesTaxOn(33_333 as Money))).toBe(true)
  })

  it('lets an ordinary life pass whole, and taxes a fortune', () => {
    expect(estateTaxOn(ESTATE_TAX_EXEMPTION)).toBe(0)
    expect(estateTaxOn((ESTATE_TAX_EXEMPTION - 1) as Money)).toBe(0)
    const big = (ESTATE_TAX_EXEMPTION * 3) as Money
    const tax = estateTaxOn(big)
    expect(tax).toBeGreaterThan(0)
    // Only the excess is taxed, never the whole estate.
    expect(tax).toBeLessThan(big - ESTATE_TAX_EXEMPTION)
    expect(tax).toBe(Math.floor(((big - ESTATE_TAX_EXEMPTION) * 400) / 1000))
  })
})

describe('interest', () => {
  it('pays monthly on what is put by, and rounds down', () => {
    expect(monthlyInterestOn(0 as Money, BASE_SAVINGS_RATE_PER_MILLE)).toBe(0)
    // A balance too small to earn a cent earns nothing rather than
    // rounding one into existence.
    expect(monthlyInterestOn(100 as Money, BASE_SAVINGS_RATE_PER_MILLE)).toBe(0)
    const earned = monthlyInterestOn(10_000_000 as Money, BASE_SAVINGS_RATE_PER_MILLE)
    expect(earned).toBe(Math.floor((10_000_000 * BASE_SAVINGS_RATE_PER_MILLE) / 12_000))
    expect(Number.isInteger(earned)).toBe(true)
  })
})

describe('the year, in a living town', () => {
  it('files returns, and both refunds and bills happen', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 40 * 12)

    const filings = world.events.filter((e) => e.type === 'filed-taxes')
    expect(filings.length, 'nobody ever filed').toBeGreaterThan(0)

    const settled = filings.map((e) => Number(e.detail ?? '0'))
    expect(settled.some((v) => v > 0), 'nobody was ever refunded').toBe(true)
    expect(settled.some((v) => v < 0), 'nobody ever owed').toBe(true)
    for (const value of settled) expect(Number.isInteger(value)).toBe(true)
  })

  it('leaves the tax year reset behind it, and money still integral', () => {
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 40 * 12)
    for (const person of world.people.values()) {
      const a = accountsOf(world, person.id)
      expect(Number.isInteger(a.taxableYtd)).toBe(true)
      expect(Number.isInteger(a.withheldYtd)).toBe(true)
      expect(a.taxableYtd).toBeGreaterThanOrEqual(0)
      expect(a.withheldYtd).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(netWorthOf(world, person.id))).toBe(true)
    }
  })
})
