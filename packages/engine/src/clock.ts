/**
 * The simulation clock. One tick is one month (Law 5).
 *
 * Tick 0 is January of START_YEAR. There is no relationship to real-world
 * time anywhere in this file — Date.now() and new Date() are banned in the
 * engine, and the whole point of a simulation clock is that it advances only
 * when the simulation says so.
 */

import type { Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'

/** The simulated world begins here. Arbitrary, but fixed. */
export const START_YEAR = 1970

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export interface SimDate {
  readonly year: number
  /** 1-12. */
  readonly month: number
}

export function toDate(tick: Tick): SimDate {
  return {
    year: START_YEAR + Math.floor(tick / TICKS_PER_YEAR),
    month: (tick % TICKS_PER_YEAR) + 1,
  }
}

export function monthName(month: number): string {
  const name = MONTH_NAMES[month - 1]
  if (name === undefined) throw new RangeError(`Month must be 1-12, got ${month}`)
  return name
}

/** e.g. "March 1974". Deterministic — no Intl, no locale. */
export function formatDate(tick: Tick): string {
  const { year, month } = toDate(tick)
  return `${monthName(month)} ${year}`
}

/** e.g. "1974". Useful where the month adds noise rather than meaning. */
export function formatYear(tick: Tick): string {
  return String(toDate(tick).year)
}

/** Age in whole years at a given tick. Truncates, as ages do. */
export function ageAt(birthTick: Tick, atTick: Tick): number {
  return Math.floor((atTick - birthTick) / TICKS_PER_YEAR)
}

/**
 * True in the person's birth month — used for once-a-year checks.
 *
 * Computed as elapsed-months-since-birth, not by comparing raw modulos: the
 * founding generation has NEGATIVE birth ticks (born before the simulation
 * began), and JavaScript's % keeps the sign, so `birthTick % 12` is negative
 * for them and a raw comparison never matches. Written in Milestone 1, first
 * USED at M-DEPTH for the retirement question — where a test with a played
 * 64-year-old founder caught it immediately.
 */
export function isBirthdayMonth(birthTick: Tick, atTick: Tick): boolean {
  return (atTick - birthTick) % TICKS_PER_YEAR === 0
}
