/**
 * THE CAREER PATHS (owner's `JOBS_CAREERS.md`, 2026-08-14).
 *
 * Seventy-five ladders, each with four or five rungs, each rung gated on
 * skills, months at the level below, schooling and — for some — a licence.
 * This is the SHAPE; the paths themselves arrive in `pathcontent.ts`, and
 * the owner's ruling was foundation first, so the first slice covers every
 * category and the rest pours into the same table afterwards.
 *
 * WHAT THIS REPLACES. `careers.ts` has nine tracks and twenty-nine rungs
 * gated on one number, `performance`. That system is not deleted — the
 * town's existing jobs still hang off it, and ripping it out would put
 * every NPC in the world out of work mid-save. The paths sit BESIDE it and
 * take over the surfaces a player touches, exactly as the business module
 * extended rather than replaced.
 *
 * THREE THINGS THE OWNER'S TABLES NEEDED THAT THE ENGINE DID NOT HAVE, and
 * each is deliberate:
 *
 *   SALARIES ARE DEFLATED. The spec is written in present-day money and
 *   this world starts in 1970 with wages of $292 a month for a shop clerk.
 *   Entered literally, a junior developer would have earned twenty-five
 *   times the town's median and every business in the game would have been
 *   unable to make payroll. See `SPEC_DEFLATOR`.
 *
 *   LICENCES ARE REAL. A CDL, a cosmetology licence, a gaming licence: they
 *   cost money and months, and no amount of skill substitutes for one.
 *
 *   ERAS ARE HONOURED. There were no software developers in 1970. The
 *   business module already solved this and the same shape is reused, so a
 *   path that has not arrived is not offered and one whose day has passed
 *   stops taking entrants.
 *
 * Pure content and arithmetic. Nothing here moves a person between jobs.
 */

import type { Money } from '@life-engine/shared'
import type { EducationLevel, LicenceId } from './types.js'
import type { SkillGate, SkillGrowth } from './skills.js'

/**
 * PRESENT-DAY DOLLARS PER BASE-YEAR DOLLAR.
 *
 * NOT PICKED FROM THE AIR — read off the wage table this game already has,
 * at the two bands where most of a life is actually lived:
 *
 *   the owner's Cashier at $20,000 a year against the engine's shop clerk
 *   at $292-458 a month ($3,504-5,496 a year) — a factor of about 4.4;
 *   his Accountant at $55,000 against the engine's accountant at
 *   $646-1,104 a month ($7,752-13,248) — about 5.2.
 *
 * Five sits between them and lands every other band of the spec inside the
 * world that already exists: a junior developer at $1,083 a month beside
 * the engine's engineer at $792-1,312, and a VP of Engineering at $4,167
 * comfortably below the chief executive at $8,333-20,833 — which is the
 * right order, and was not true before deflation.
 *
 * The spec's RELATIVE ordering is untouched. Only the denomination changes.
 */
export const SPEC_DEFLATOR = 5

/**
 * A YEARLY SALARY FROM THE SPEC, as monthly base-year cents.
 *
 * The one conversion every rung goes through, so a figure can never enter
 * the table in the wrong denomination.
 */
export function fromSpecSalary(annualSpecDollars: number): Money {
  return Math.round((annualSpecDollars * 100) / SPEC_DEFLATOR / 12) as Money
}

export interface Licence {
  readonly id: LicenceId
  readonly title: string
  /** What it costs to sit, in BASE-YEAR cents (already deflated). */
  readonly cost: Money
  /** Months of study before it is held. */
  readonly months: number
  /** What it is for, in one line. */
  readonly blurb: string
}

/**
 * THE LICENCES, with the owner's own costs and durations deflated.
 *
 * His figures are present-day ($1,500 for a CDL, $20,000-40,000 for
 * aviation training), so they go through the same divisor every salary
 * does. A CDL at $300 of 1970 money against a truck driver's $467 a month
 * is about three weeks' wages, which is the right weight for a thing you
 * can decide to go and get.
 */
export const LICENCES: readonly Licence[] = [
  { id: 'cdl', title: 'a commercial driving licence', cost: fromSpecSalary(1_500 * 12), months: 2, blurb: 'The papers to drive the big rigs.' },
  { id: 'real-estate', title: 'a real estate licence', cost: fromSpecSalary(300 * 12), months: 3, blurb: 'The papers to sell other people’s houses.' },
  { id: 'insurance', title: 'an insurance licence', cost: fromSpecSalary(200 * 12), months: 2, blurb: 'The papers to write policies.' },
  { id: 'cosmetology', title: 'a cosmetology licence', cost: fromSpecSalary(1_200 * 12), months: 9, blurb: 'The papers to cut and colour for money.' },
  { id: 'aviation', title: 'a commercial pilot’s licence', cost: fromSpecSalary(30_000 * 12), months: 21, blurb: 'Hours in the air, and the rating that comes with them.' },
  { id: 'fitness', title: 'a fitness certification', cost: fromSpecSalary(400 * 12), months: 3, blurb: 'The papers to train people properly.' },
  { id: 'firefighter', title: 'a firefighter certification', cost: fromSpecSalary(500 * 12), months: 3, blurb: 'The academy, and what it takes to pass it.' },
  { id: 'gaming', title: 'a gaming licence', cost: fromSpecSalary(600 * 12), months: 2, blurb: 'The background check the floor requires.' },
  { id: 'massage', title: 'a massage licence', cost: fromSpecSalary(1_000 * 12), months: 8, blurb: 'The hours of training the board asks for.' },
  { id: 'grooming', title: 'grooming training', cost: fromSpecSalary(800 * 12), months: 5, blurb: 'Learning the coats, and the animals under them.' },
  { id: 'heavy-equipment', title: 'a heavy equipment licence', cost: fromSpecSalary(1_800 * 12), months: 3, blurb: 'The ticket to operate the big machines.' },
  { id: 'pharmacy', title: 'a pharmacy technician certificate', cost: fromSpecSalary(900 * 12), months: 6, blurb: 'The certification the counter requires.' },
  { id: 'medical-tech', title: 'a medical technician certificate', cost: fromSpecSalary(1_100 * 12), months: 8, blurb: 'The certification the lab requires.' },
]

export function licenceById(id: string): Licence | undefined {
  return LICENCES.find((licence) => licence.id === id)
}

/** One rung of one ladder. */
export interface PathLevel {
  readonly id: string
  /** What it says on the door. */
  readonly title: string
  /** 1-5, the spec's own numbering. */
  readonly level: number
  /** Monthly pay in BASE-YEAR cents, through `fromSpecSalary`. */
  readonly monthlyPay: Money
  /** Months at the level below before this one will have you. */
  readonly monthsRequired: number
  /** What you must already be good at. */
  readonly needs: readonly SkillGate[]
  /** The schooling this rung asks for, beyond the path's own entry. */
  readonly needsLevel?: EducationLevel
  /** The papers this rung asks for. */
  readonly needsLicence?: LicenceId
  /** What a month here teaches. */
  readonly teaches: readonly SkillGrowth[]
  /**
   * What the work does to a person, -2 to 2, straight from the spec's
   * "Stress/Happiness Impact" row.
   */
  readonly stress: number
  readonly happiness: number
  readonly blurb: string
}

export interface CareerPathCategory {
  readonly id: string
  readonly label: string
}

/** The fifteen bubbles across the top of the owner's mockup. */
export const PATH_CATEGORIES: readonly CareerPathCategory[] = [
  { id: 'retail-service', label: 'Retail & Service' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'technology', label: 'Technology' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'finance-business', label: 'Finance & Business' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'public-service', label: 'Public Service' },
  { id: 'trades', label: 'Trades & Skilled' },
  { id: 'creative', label: 'Creative' },
  { id: 'education', label: 'Education' },
  { id: 'law', label: 'Law' },
  { id: 'personal-services', label: 'Personal Services' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'management', label: 'Business & Mgmt' },
]

export interface CareerPath {
  readonly id: string
  readonly name: string
  readonly categoryId: string
  readonly blurb: string
  /** The schooling the FIRST rung asks for. */
  readonly requires: EducationLevel
  /**
   * WHEN THIS WORK EXISTS. Calendar years, read the same way the business
   * module reads them — there were no software developers in 1970 and no
   * switchboard operators now. Absent means the trade has no era.
   */
  readonly availableFrom?: number
  readonly retiredAfter?: number
  readonly levels: readonly PathLevel[]
}

/** Every gate a person fails on this rung, in the spec's own order. */
export interface PathBar {
  readonly kind: 'education' | 'skill' | 'months' | 'licence' | 'era'
  readonly said: string
}

/** Is this work on offer in this year at all? */
export function pathAvailableIn(path: CareerPath, year: number): boolean {
  if (path.availableFrom !== undefined && year < path.availableFrom) return false
  if (path.retiredAfter !== undefined && year > path.retiredAfter) return false
  return true
}

export function pathById(paths: readonly CareerPath[], id: string): CareerPath | undefined {
  return paths.find((path) => path.id === id)
}

export function levelOfPath(path: CareerPath, level: number): PathLevel | undefined {
  return path.levels.find((entry) => entry.level === level)
}

/** The rung above the one held, or undefined at the top of the ladder. */
export function nextLevel(path: CareerPath, level: number): PathLevel | undefined {
  return levelOfPath(path, level + 1)
}

/**
 * A LADDER MUST BE CLIMBABLE FROM ITS OWN BOTTOM RUNG.
 *
 * THE BUG THIS EXISTS TO MAKE IMPOSSIBLE, found by a validator rather than
 * by reading: every one of the first fifteen paths was a dead end. A
 * cashier's rung taught Customer Service and Sales; the shift-lead rung
 * above it demanded Leadership 2 — which nothing below it taught, so the
 * second rung of the very first ladder could never be reached by anybody,
 * ever. Seventy-four of those across the table, and not one visible by eye.
 *
 * The owner's document is not wrong about this; it is written at a
 * different grain. His "Skill Growth" line is for the PATH — "Customer
 * Service (0.5), Sales (0.3-0.4), Leadership (0.5-0.6), Business Management
 * (0.4-0.7)" — while his per-rung tables name only what that rung chiefly
 * develops. Transcribing the tables faithfully therefore loses the rest.
 *
 * So a rung also teaches, at a TRICKLE, whatever the rung above it demands
 * and nothing below has taught. Slow on purpose: a cashier does pick up a
 * little leadership covering a shift, but they will not out-learn somebody
 * who is actually doing the job. The explicit tables still say what the
 * work is mainly about; this only guarantees the ladder connects.
 *
 * Applied once, at module load, to every path — so the sixty still to be
 * transcribed are covered by construction rather than by remembering.
 */
export const TRICKLE_PER_MONTH = 220

export function climbable(path: CareerPath): CareerPath {
  const taught = new Set<string>()
  const levels = path.levels.map((level, at) => {
    for (const growth of level.teaches) taught.add(growth.skill)
    const above = path.levels[at + 1]
    if (above === undefined) return level
    const missing = above.needs
      .filter((need) => !taught.has(need.skill))
      .map((need) => ({ skill: need.skill, perMonth: TRICKLE_PER_MONTH }))
    if (missing.length === 0) return level
    for (const growth of missing) taught.add(growth.skill)
    return { ...level, teaches: [...level.teaches, ...missing] }
  })
  return { ...path, levels }
}

/** Every gate on this ladder that nothing at or below it teaches. */
export function deadEndsIn(path: CareerPath): readonly string[] {
  const taught = new Set<string>()
  const found: string[] = []
  for (const level of path.levels) {
    for (const need of level.needs) {
      if (!taught.has(need.skill)) found.push(`${level.id} needs ${need.skill}`)
    }
    for (const growth of level.teaches) taught.add(growth.skill)
  }
  return found
}
