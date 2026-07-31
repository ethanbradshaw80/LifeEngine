/**
 * Shared primitive types for The Life Engine.
 *
 * This package depends on NOTHING. It contains types and pure functions only —
 * never behaviour, never state, never I/O. See docs/DOMAIN_MAP.md §4 rule 3.
 */

// ---------------------------------------------------------------------------
// Branded primitives
//
// These are plain numbers at runtime with zero cost, but TypeScript treats them
// as distinct types. That means passing a Tick where an EntityId is expected is
// a compile error rather than a bug that surfaces 200 ticks later.
// ---------------------------------------------------------------------------

declare const brand: unique symbol

type Brand<T, B> = T & { readonly [brand]: B }

/** Stable identifier for a simulated entity. Never reused, even after death. */
export type EntityId = Brand<number, 'EntityId'>

/** A point in simulation time. One tick is one month. */
export type Tick = Brand<number, 'Tick'>

/**
 * Money, stored as integer minor units (cents). See ADR-0008.
 * Never a floating-point value — 0.1 + 0.2 !== 0.3, and money must be exact.
 */
export type Money = Brand<number, 'Money'>

/** The world seed. Everything random derives from this. See docs/DETERMINISM.md §1. */
export type Seed = Brand<number, 'Seed'>

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function entityId(value: number): EntityId {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`EntityId must be a non-negative integer, got ${value}`)
  }
  return value as EntityId
}

export function tick(value: number): Tick {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Tick must be a non-negative integer, got ${value}`)
  }
  return value as Tick
}

/** Construct Money from integer cents. */
export function money(cents: number): Money {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money must be a safe integer number of cents, got ${cents}`)
  }
  return cents as Money
}

/** Convenience: construct Money from whole dollars. */
export function dollars(amount: number): Money {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`dollars() takes whole dollars; use money() for cents. Got ${amount}`)
  }
  return money(amount * 100)
}

export function seed(value: number): Seed {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Seed must be an integer, got ${value}`)
  }
  return value as Seed
}

// ---------------------------------------------------------------------------
// Money arithmetic
//
// Exposed as functions so that every operation stays in integer space. There is
// deliberately no divide() — division forces a rounding decision, and those must
// be made explicitly at the call site rather than hidden here.
// ---------------------------------------------------------------------------

export function addMoney(a: Money, b: Money): Money {
  return money(a + b)
}

export function subtractMoney(a: Money, b: Money): Money {
  return money(a - b)
}

/** Multiply money by a whole number (e.g. 12 monthly payments). */
export function multiplyMoney(amount: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new RangeError(`multiplyMoney factor must be an integer, got ${factor}`)
  }
  return money(amount * factor)
}

/**
 * Apply a rate expressed in basis points (1 bp = 0.01%), rounding half away
 * from zero. Basis points keep percentages in integer space: 5% is 500 bp.
 */
export function applyBasisPoints(amount: Money, basisPoints: number): Money {
  if (!Number.isInteger(basisPoints)) {
    throw new RangeError(`basisPoints must be an integer, got ${basisPoints}`)
  }
  const scaled = amount * basisPoints
  const rounded =
    scaled >= 0 ? Math.floor(scaled / 10_000 + 0.5) : Math.ceil(scaled / 10_000 - 0.5)
  return money(rounded)
}

// ---------------------------------------------------------------------------
// Tick arithmetic
// ---------------------------------------------------------------------------

export const TICKS_PER_YEAR = 12

export function addTicks(t: Tick, count: number): Tick {
  if (!Number.isInteger(count)) {
    throw new RangeError(`addTicks count must be an integer, got ${count}`)
  }
  return tick(t + count)
}

export function ticksBetween(from: Tick, to: Tick): number {
  return to - from
}

/** Whole years elapsed between two ticks. Truncates, as ages do. */
export function yearsBetween(from: Tick, to: Tick): number {
  return Math.floor((to - from) / TICKS_PER_YEAR)
}

// ---------------------------------------------------------------------------
// Formatting
//
// These produce plain ASCII strings with no locale involvement. Locale-aware
// formatting is a UI concern — Intl is banned in the engine because its output
// varies by environment. See docs/DETERMINISM.md §5.
// ---------------------------------------------------------------------------

/** Format money as e.g. "$1,234.56". Deterministic; no Intl. */
export function formatMoney(amount: Money): string {
  const negative = amount < 0
  const abs = Math.abs(amount)
  const whole = Math.floor(abs / 100)
  const cents = abs % 100

  let grouped = ''
  const digits = String(whole)
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ','
    grouped += digits[i]
  }

  return `${negative ? '-' : ''}$${grouped}.${String(cents).padStart(2, '0')}`
}
