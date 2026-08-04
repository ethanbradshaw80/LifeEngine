/**
 * CIVILIAN CAREERS (M-CAREER §1-2). The ladder, and the climb.
 *
 * WHAT WAS WRONG. Civilian work was flat: a list of jobs with pay bands, and
 * an employment record that went hired → annual raise → fired. The military
 * career next to it has ranks, a promotion board, schools, tours and awards.
 * A shop clerk had a wage and nothing else, for fifty years.
 *
 * THE PARALLEL THIS BUILDS, one for one:
 *
 *   rank ladder          → the job-title LADDER, per track
 *   the promotion board  → the annual REVIEW
 *   time in grade        → months in the rung
 *   the specialty        → the TRACK you are on
 *   up-or-out            → stagnation, a warning, and being let go
 *
 * A TRACK IS A LIST OF RUNGS and each rung is a real occupation, so hiring,
 * pay, taxes and the ledger all keep working exactly as they did — a rung
 * is not a new kind of thing, it is a position of an existing one. What is
 * new is that the occupations now know what comes NEXT.
 *
 * Pure content and pure reads. employment.ts moves people between rungs;
 * finances pays them.
 */

import type { Money } from '@life-engine/shared'
import type { EducationLevel } from './types.js'

/** What a rung asks of you before it opens. */
export interface Rung {
  /** The occupation this rung IS. Everything downstream keys off it. */
  readonly occupationId: string
  /** Performance the review wants, 0-1000. Zero on an entry rung. */
  readonly needsPerformance: number
  /** Months you have to have stood on the rung below it. */
  readonly needsMonths: number
  /**
   * A rung where the ladder FORKS — the point a career stops being one
   * thing. Named for the screen; the fork itself is the tracks that list
   * this rung as their entry.
   */
  readonly branchPoint?: boolean
}

export interface CareerTrack {
  readonly id: string
  readonly title: string
  /** The schooling the FIRST rung asks for. Higher rungs ask for the climb. */
  readonly requires: EducationLevel
  readonly rungs: readonly Rung[]
}

/**
 * THE TRACKS. Eight of them, covering the town's work from the mill floor to
 * the corner office, each gated by the schooling its entry rung needs.
 *
 * The pay is NOT here — it is on the occupation, in content.ts, where every
 * other wage in the world lives. A ladder that carried its own pay table
 * would be a second source of truth for the same number.
 */
export const CAREER_TRACKS: readonly CareerTrack[] = [
  {
    id: 'trades',
    title: 'the trades',
    requires: 'trade',
    rungs: [
      { occupationId: 'apprentice', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'carpenter', needsPerformance: 480, needsMonths: 24 },
      { occupationId: 'master-tradesman', needsPerformance: 600, needsMonths: 48, branchPoint: true },
      { occupationId: 'site-foreman', needsPerformance: 680, needsMonths: 48 },
      { occupationId: 'contractor', needsPerformance: 760, needsMonths: 60 },
    ],
  },
  {
    id: 'retail',
    title: 'shops and service',
    requires: 'none',
    rungs: [
      { occupationId: 'shop-clerk', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'shift-lead', needsPerformance: 460, needsMonths: 18 },
      { occupationId: 'assistant-manager', needsPerformance: 560, needsMonths: 30 },
      { occupationId: 'store-manager', needsPerformance: 660, needsMonths: 36, branchPoint: true },
      { occupationId: 'district-manager', needsPerformance: 750, needsMonths: 60 },
    ],
  },
  {
    id: 'office',
    title: 'the office',
    requires: 'secondary',
    rungs: [
      { occupationId: 'clerk', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'associate', needsPerformance: 500, needsMonths: 24 },
      { occupationId: 'senior-associate', needsPerformance: 580, needsMonths: 36 },
      { occupationId: 'manager', needsPerformance: 680, needsMonths: 36, branchPoint: true },
      { occupationId: 'director', needsPerformance: 760, needsMonths: 48 },
      { occupationId: 'vice-president', needsPerformance: 820, needsMonths: 60 },
      { occupationId: 'executive', needsPerformance: 880, needsMonths: 72 },
    ],
  },
  {
    id: 'industrial',
    title: 'the mill floor',
    requires: 'none',
    rungs: [
      { occupationId: 'labourer', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'millhand', needsPerformance: 440, needsMonths: 18 },
      { occupationId: 'lead-hand', needsPerformance: 540, needsMonths: 30 },
      { occupationId: 'foreman', needsPerformance: 640, needsMonths: 36, branchPoint: true },
      { occupationId: 'superintendent', needsPerformance: 730, needsMonths: 48 },
      { occupationId: 'plant-manager', needsPerformance: 800, needsMonths: 60 },
    ],
  },
  {
    id: 'medical',
    title: 'nursing',
    requires: 'trade',
    rungs: [
      { occupationId: 'aide', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'nurse', needsPerformance: 520, needsMonths: 24 },
      { occupationId: 'charge-nurse', needsPerformance: 620, needsMonths: 36 },
      { occupationId: 'nurse-manager', needsPerformance: 720, needsMonths: 48 },
    ],
  },
  {
    id: 'physician',
    title: 'medicine',
    requires: 'college',
    rungs: [
      { occupationId: 'resident', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'doctor', needsPerformance: 600, needsMonths: 36 },
      { occupationId: 'chief-of-medicine', needsPerformance: 800, needsMonths: 84 },
    ],
  },
  {
    id: 'education',
    title: 'the school',
    requires: 'college',
    rungs: [
      { occupationId: 'teacher', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'department-head', needsPerformance: 580, needsMonths: 36 },
      { occupationId: 'assistant-principal', needsPerformance: 680, needsMonths: 48 },
      { occupationId: 'principal', needsPerformance: 780, needsMonths: 60 },
    ],
  },
  {
    id: 'civil',
    title: 'the county',
    requires: 'secondary',
    rungs: [
      { occupationId: 'constable', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'sergeant', needsPerformance: 560, needsMonths: 36 },
      { occupationId: 'police-chief', needsPerformance: 740, needsMonths: 72 },
    ],
  },
  {
    id: 'professional',
    title: 'the professions',
    requires: 'college',
    rungs: [
      { occupationId: 'bookkeeper', needsPerformance: 0, needsMonths: 0 },
      { occupationId: 'accountant', needsPerformance: 540, needsMonths: 24 },
      { occupationId: 'senior-accountant', needsPerformance: 660, needsMonths: 36 },
      { occupationId: 'partner', needsPerformance: 800, needsMonths: 60 },
    ],
  },
]

export function trackById(id: string): CareerTrack | undefined {
  return CAREER_TRACKS.find((track) => track.id === id)
}

/** The track an occupation sits on, and where on it. Total across the table. */
export function placeOf(occupationId: string): { track: CareerTrack; rung: number } | undefined {
  for (const track of CAREER_TRACKS) {
    const rung = track.rungs.findIndex((entry) => entry.occupationId === occupationId)
    if (rung >= 0) return { track, rung }
  }
  return undefined
}

/** The rung above, or undefined at the top of a ladder. */
export function nextRungOf(track: CareerTrack, rung: number): Rung | undefined {
  return track.rungs[rung + 1]
}

/**
 * WHY THIS PERSON IS NOT BEING PROMOTED, in words, or null when they are
 * ready. The same shape as `offenceBar` and `moveBar`: a live screen and an
 * honest refusal must read from one function, or they will disagree.
 */
export function promotionBar(
  track: CareerTrack,
  rung: number,
  performance: number,
  monthsInRung: number,
): string | null {
  const next = nextRungOf(track, rung)
  if (!next) return 'There is nothing above this on the ladder.'
  if (monthsInRung < next.needsMonths) {
    const left = next.needsMonths - monthsInRung
    return `Not long enough in the job — ${String(left)} more ${left === 1 ? 'month' : 'months'}.`
  }
  if (performance < next.needsPerformance) {
    return 'Your reviews are not where they would need to be.'
  }
  return null
}

/**
 * How the review reads a year. Performance and time both count, the way the
 * promotion board counts points — and a boom opens doors a slump keeps
 * shut, which is the economy's hand on a career.
 */
export function reviewScoreFor(
  performance: number,
  monthsInRung: number,
  growthPerMille: number,
): number {
  const seniority = Math.min(200, monthsInRung * 2)
  const weather = Math.max(-120, Math.min(120, growthPerMille * 4))
  return performance + seniority + weather
}

/** In words, for a screen. */
export function standingWords(performance: number): string {
  if (performance >= 800) return 'well regarded'
  if (performance >= 640) return 'strong'
  if (performance >= 460) return 'steady'
  if (performance >= 300) return 'shaky'
  return 'on thin ice'
}

/** What the next rung would pay, as a share of this one. For the screen. */
export function rungTitleOf(occupationId: string, fallback: string): string {
  return placeOf(occupationId) === undefined ? fallback : fallback
}

/** Every track whose entry rung this schooling opens. */
export function tracksOpenTo(level: EducationLevel): readonly CareerTrack[] {
  const order: readonly EducationLevel[] = ['none', 'primary', 'secondary', 'trade', 'college']
  const have = order.indexOf(level)
  return CAREER_TRACKS.filter((track) => {
    const want = order.indexOf(track.requires)
    // Trade school and secondary are siblings rather than a line: a trade
    // qualifies for the trades and for anything below secondary, and a
    // secondary certificate does not qualify for the trades.
    if (track.requires === 'trade') return level === 'trade' || level === 'college'
    return have >= want
  })
}

/** The pay a rung is worth relative to the rung below, for the ladder screen. */
export function rungGapPerMille(a: Money, b: Money): number {
  if (a <= 0) return 0
  return Math.round(((b - a) * 1000) / a)
}
