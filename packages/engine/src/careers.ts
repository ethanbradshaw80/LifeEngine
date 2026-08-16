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
import { educationRank, rungPlaceOf } from './content.js'
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
  /**
   * SCHOOLING THIS RUNG REQUIRES BEYOND THE TRACK'S OWN (Fix 2).
   *
   * A track gates its ENTRY on a level; this gates a rung inside it. The
   * distinction matters for exactly the case the spec names: medicine
   * takes you at `college` as a resident, and no amount of good reviews
   * turns a resident into a physician without medical school. "A degree
   * alone never makes a doctor."
   *
   * Absent on almost every rung — most of a ladder is climbed on the
   * work, not on paper.
   */
  readonly needsLevel?: EducationLevel
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
      // THE TOP OF THE BUILDING (careers overhaul, Fix 3A).
      //
      // The gates are the harshest in the game on purpose: six years as an
      // executive who was already the best-reviewed person on the floor,
      // AND the graduate degree. Almost nobody arrives here, which is what
      // makes it worth arriving at — a chief executive that a good career
      // reaches by default is a job title rather than an achievement.
      //
      // This rung is on the OFFICE ladder alone. The other road to the same
      // chair is founding a company and scaling it (Fix 3B), which is how
      // somebody who started on a mill floor gets there — and it is a
      // better story than a fourth staircase in a building they do not own.
      {
        occupationId: 'chief-executive',
        needsPerformance: 940,
        needsMonths: 72,
        needsLevel: 'graduate',
      },
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
      // MEDICAL SCHOOL. The spec's own example, and the reason rung-level
      // credentials exist at all: a residency is where a doctor is made,
      // and the paper that makes it is not the same paper that got them
      // through the door.
      { occupationId: 'doctor', needsPerformance: 600, needsMonths: 36, needsLevel: 'graduate' },
      { occupationId: 'chief-of-medicine', needsPerformance: 800, needsMonths: 84, needsLevel: 'graduate' },
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
/**
 * IS THIS WHERE A CAREER STARTS? (careers overhaul, Fix 1.)
 *
 * The owner's complaint: "offered doctor at $200k leaving the army". The
 * hiring pass filtered occupations by SCHOOLING alone, so anything a
 * person's education qualified them for could be handed to them —
 * including the top of a ladder they had never set foot on. That is what
 * made the ladders decorative: why climb five rungs when the town will
 * hand you the fifth?
 *
 * Work that sits on no ladder — a labourer, a cook — is entry by
 * definition and stays open. Everything on a ladder is enterable only at
 * its bottom, and the way up is the climb.
 */
export function isEntryWork(occupationId: string): boolean {
  /**
   * AND THE OWNER'S LADDERS OBEY THE SAME RULE (jobs revamp).
   *
   * Their rungs became ordinary occupations so pay comparisons would stop
   * treating them as worthless — but `placeOf` only knows the OLD tracks, so
   * without this every rung including a vice-presidency answered "not on a
   * ladder, therefore entry work", and the town would have handed school
   * leavers the top of a five-rung climb. That is the exact disease Fix 1
   * was written to cure, re-entering by a new door.
   */
  const rung = rungPlaceOf(occupationId)
  if (rung !== undefined) return rung.rung === 0
  const place = placeOf(occupationId)
  return place === undefined || place.rung === 0
}

/**
 * The rung this person's EXPERIENCE already merits — what they could be
 * hired into elsewhere without it being a gift.
 *
 * Somebody who is already a senior associate can take a manager's job at
 * a rival firm; that is a real thing that happens and is not the same as
 * a school leaver being handed one. Bounded to one rung above where they
 * actually stand.
 */
export function meritedRung(occupationId: string, performance: number): number {
  /**
   * A LADDER RUNG IS WORTH ITS OWN HEIGHT, and no more.
   *
   * The paths gate on skills and months rather than on `performance`, so
   * there is no equivalent of "your reviews already clear the next rung's
   * bar" to read here. Somebody four rungs up a path can therefore be
   * approached for work at that standing, but not above it — a poach is a
   * step, never a leap, which is the rule this function exists to hold.
   */
  const onPath = rungPlaceOf(occupationId)
  if (onPath !== undefined) return onPath.rung

  const place = placeOf(occupationId)
  if (place === undefined) return 0
  const next = nextRungOf(place.track, place.rung)
  if (next === undefined) return place.rung
  return performance >= next.needsPerformance ? place.rung + 1 : place.rung
}

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
  discipline?: number,
  /** What they actually hold. Omitted where the caller has no record. */
  level?: EducationLevel,
): string | null {
  const next = nextRungOf(track, rung)
  if (!next) return 'There is nothing above this on the ladder.'
  // THE CREDENTIAL COMES FIRST, before time and before reviews, because
  // it is the only one of the three that no amount of the others buys.
  // Telling somebody their reviews are short when the real answer is
  // "you have not been to medical school" would be a lie by omission.
  if (next.needsLevel !== undefined && level !== undefined) {
    if (educationRank(level) < educationRank(next.needsLevel)) {
      return next.needsLevel === 'graduate'
        ? 'That rung wants a postgraduate qualification you do not hold.'
        : 'That rung wants schooling you do not have.'
    }
  }
  if (monthsInRung < next.needsMonths) {
    const left = next.needsMonths - monthsInRung
    return `Not long enough in the job — ${String(left)} more ${left === 1 ? 'month' : 'months'}.`
  }
  if (performance < next.needsPerformance) {
    return 'Your reviews are not where they would need to be.'
  }
  // STATS PHASE 6c, the RETENTION half. A bar rather than a weight, because
  // this one is categorical: somebody whose conduct is genuinely poor is
  // not handed the next rung, however good last year's numbers were.
  //
  // Set LOW on purpose. Discipline is diligence-anchored, so an ordinary
  // person sits near 500 and this never touches them; it speaks only about
  // the bottom of the distribution, where the marks and the convictions
  // are. A bar high enough to catch ordinary people would be a second
  // performance gate wearing a different name.
  if (discipline !== undefined && discipline < 260) {
    return 'Your conduct record is in the way of it.'
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
  person?: { readonly smarts: number; readonly discipline: number },
): number {
  const seniority = Math.min(200, monthsInRung * 2)
  const weather = Math.max(-120, Math.min(120, growthPerMille * 4))
  // STATS PHASE 6c. The spec: "Smarts + Discipline gate the ladder and
  // retention." This is the ladder half.
  //
  // A REVIEW IS A JUDGEMENT ABOUT A PERSON, not only about a year's output.
  // Performance is what the job saw; smarts and discipline are what the
  // person brought to it, and a promotion board weighs both. Bounded either
  // way at about a fifth of the score so it colours the decision without
  // deciding it — the same restraint the partnering weight needed after it
  // was measured and found to be running the whole show.
  //
  // Optional so every existing caller keeps its meaning; the one that
  // matters passes it.
  const character =
    person === undefined
      ? 0
      : Math.floor((person.smarts - 500) / 8) + Math.floor((person.discipline - 500) / 8)
  return performance + seniority + weather + character
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

/**
 * Every track whose entry rung this schooling opens.
 *
 * THE ORDERING COMES FROM `educationRank` AND NOWHERE ELSE. This kept a
 * private copy of it — `['none','primary','secondary','trade','college']`
 * — and the copy drifted the moment the education module inserted
 * `middle` and appended `graduate`: `indexOf` returned -1 for both, and
 * `-1 >= 0` is false for every track, so a middle-school leaver AND a
 * PhD holder each qualified for NO CAREER TRACK AT ALL. An advanced
 * degree opened fewer doors than dropping out of primary school.
 *
 * Nothing caught it because this function has no caller yet and its test
 * only checks 'none' and 'secondary' — the two levels that happen to sit
 * in the stale array. It is the same mistake as the `educationRank() > 2`
 * literals the education module found: a second copy of an ordering,
 * kept by hand, next to the one that maintains itself.
 */
export function tracksOpenTo(level: EducationLevel): readonly CareerTrack[] {
  const have = educationRank(level)
  return CAREER_TRACKS.filter((track) => {
    // Trade school and secondary are siblings rather than a line: a trade
    // qualifies for the trades and for anything below secondary, and a
    // secondary certificate does not qualify for the trades. A degree
    // above trade school counts the same way college already did.
    if (track.requires === 'trade') {
      return level === 'trade' || level === 'college' || level === 'graduate'
    }
    return have >= educationRank(track.requires)
  })
}

/** The pay a rung is worth relative to the rung below, for the ladder screen. */
export function rungGapPerMille(a: Money, b: Money): number {
  if (a <= 0) return 0
  return Math.round(((b - a) * 1000) / a)
}
