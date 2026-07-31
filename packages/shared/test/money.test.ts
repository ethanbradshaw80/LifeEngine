import { describe, expect, it } from 'vitest'
import {
  addMoney,
  applyBasisPoints,
  dollars,
  formatMoney,
  money,
  multiplyMoney,
  subtractMoney,
  tick,
  yearsBetween,
} from '../src/index.js'

describe('money is exact integer arithmetic (ADR-0008)', () => {
  it('does not suffer the classic floating-point error', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in floating point.
    // In cents it is simply 10 + 20 === 30.
    expect(addMoney(money(10), money(20))).toBe(30)
  })

  it('stays exact when accumulating many times', () => {
    let total = money(0)
    for (let i = 0; i < 10_000; i++) {
      total = addMoney(total, money(1))
    }
    expect(total).toBe(10_000)
  })

  it('converts whole dollars to cents', () => {
    expect(dollars(50)).toBe(5000)
  })

  it('rejects fractional cents', () => {
    expect(() => money(10.5)).toThrow(RangeError)
  })

  it('rejects fractional dollars, pointing at money()', () => {
    expect(() => dollars(10.5)).toThrow(RangeError)
  })

  it('subtracts into negative balances', () => {
    expect(subtractMoney(money(100), money(250))).toBe(-150)
  })

  it('multiplies by whole factors', () => {
    expect(multiplyMoney(dollars(1200), 12)).toBe(1_440_000)
  })
})

describe('applyBasisPoints', () => {
  it('applies a whole percentage', () => {
    // 5% of $1,000.00 is $50.00
    expect(applyBasisPoints(dollars(1000), 500)).toBe(5000)
  })

  it('rounds half away from zero', () => {
    // 1 bp of 5 cents = 0.005 -> rounds to 1... verified explicitly below
    expect(applyBasisPoints(money(100), 50)).toBe(1) // 0.5% of 100c = 0.5c -> 1c
    expect(applyBasisPoints(money(-100), 50)).toBe(-1)
  })

  it('is deterministic across repeated application', () => {
    const once = applyBasisPoints(dollars(100), 325)
    const again = applyBasisPoints(dollars(100), 325)
    expect(once).toBe(again)
  })
})

describe('formatMoney', () => {
  it('formats without Intl, deterministically', () => {
    expect(formatMoney(money(123_456))).toBe('$1,234.56')
    expect(formatMoney(money(0))).toBe('$0.00')
    expect(formatMoney(money(5))).toBe('$0.05')
    expect(formatMoney(money(100))).toBe('$1.00')
    expect(formatMoney(money(-123_456))).toBe('-$1,234.56')
    expect(formatMoney(money(100_000_000))).toBe('$1,000,000.00')
  })
})

describe('tick arithmetic', () => {
  it('counts whole years, truncating', () => {
    expect(yearsBetween(tick(0), tick(11))).toBe(0)
    expect(yearsBetween(tick(0), tick(12))).toBe(1)
    expect(yearsBetween(tick(0), tick(1439))).toBe(119)
  })

  it('rejects fractional ticks', () => {
    expect(() => tick(1.5)).toThrow(RangeError)
  })
})
