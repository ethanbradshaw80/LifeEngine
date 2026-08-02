/**
 * The simulation clock. One tick is one month (Law 5).
 *
 * Tick 0 is January of the world's start year — which is the PRESET's, not
 * a constant (W1): "American Heartland, but start in 1985" is a preset, and
 * a fixed 1970 in this file would have made it a rewrite. There is no
 * relationship to real-world time anywhere here — Date.now() and new Date()
 * are banned in the engine, and the whole point of a simulation clock is
 * that it advances only when the simulation says so.
 *
 * Nothing in the TICK PATH reads the calendar year: ticks are the currency
 * of the simulation and the year is a rendering of them. That is exactly why
 * this was cheap to extract now, and it is worth extracting BEFORE
 * era-weighted name pools make the year an input rather than a label.
 */

import type { Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import type { World } from './types.js'

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

export function toDate(world: World, tick: Tick): SimDate {
  return {
    year: world.spec.startYear + Math.floor(tick / TICKS_PER_YEAR),
    month: (tick % TICKS_PER_YEAR) + 1,
  }
}

export function monthName(month: number): string {
  const name = MONTH_NAMES[month - 1]
  if (name === undefined) throw new RangeError(`Month must be 1-12, got ${month}`)
  return name
}

/** e.g. "March 1974". Deterministic — no Intl, no locale. */
export function formatDate(world: World, tick: Tick): string {
  const { year, month } = toDate(world, tick)
  return `${monthName(month)} ${year}`
}

/** e.g. "1974". Useful where the month adds noise rather than meaning. */
export function formatYear(world: World, tick: Tick): string {
  return String(toDate(world, tick).year)
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
