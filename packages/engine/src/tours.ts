/**
 * THE TOUR AS A PLACE AND AN ARC (owner's `combat_tours_revamp.md` §1).
 *
 * A tour was a flag on a record with an end date on it. The spec's
 * complaint is that it "reads like a slot machine of popups", and the
 * reason is that nothing about it had a SHAPE: month four was identical
 * to month one, and the tour ended because the calendar said so rather
 * than because anything had happened.
 *
 * What this adds is the structure above the existing scenes — which are
 * kept exactly as they are (spec: "nothing working gets removed"):
 *
 *   A NAMED OPERATION in a named place, so a tour is somewhere rather
 *     than a duration.
 *   A TEMPO, set by the theatre, the unit and the job, that decides how
 *     much war a tour actually contains. Some are garrison rotations and
 *     some are daily contact, and the quiet ones are what make the loud
 *     ones land.
 *   A FIVE-BEAT ARC — arrival, the grind, the defining event, the wind-
 *     down, going home — so a tour has a middle and an end that mean
 *     something, and the worst month is not simply a month that rolled
 *     badly.
 *   AN INTENSITY TIER, so a supply clerk and a special-unit operator do
 *     not live the same war at different volumes.
 *
 * Pure content and pure arithmetic. deployment.ts owns the tour record;
 * this decides its shape.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { World } from './types.js'

// ---------------------------------------------------------------------------
// The operation (spec §1)
// ---------------------------------------------------------------------------

/**
 * OPERATION NAMES ARE FICTIONAL, and this one is not the owner's §10
 * override being declined — the spec's own §1 asks for "a fictional
 * operation name" in a real country, because the conflicts themselves are
 * invented. An invented war fought under a real operation's name would be
 * putting words in the mouths of people who were actually there.
 */
const OPERATION_ADJECTIVES: readonly string[] = [
  'Iron', 'Steadfast', 'Silent', 'Northern', 'Enduring', 'Resolute',
  'Crimson', 'Broken', 'Distant', 'Winter', 'Granite', 'Sable',
]

const OPERATION_NOUNS: readonly string[] = [
  'Meridian', 'Anvil', 'Lantern', 'Harvest', 'Bulwark', 'Sentinel',
  'Threshold', 'Compass', 'Vigil', 'Keystone', 'Talon', 'Watchtower',
]

export function operationNameFor(seedNumber: number): string {
  const a = OPERATION_ADJECTIVES[Math.abs(seedNumber) % OPERATION_ADJECTIVES.length] ?? 'Iron'
  const b =
    OPERATION_NOUNS[Math.abs(Math.floor(seedNumber / 13)) % OPERATION_NOUNS.length] ?? 'Meridian'
  return `Operation ${a} ${b}`
}

// ---------------------------------------------------------------------------
// Intensity tiers (spec §4b)
// ---------------------------------------------------------------------------

/**
 * HOW MUCH WAR A JOB SEES.
 *
 * T0 rear, T1 combat support, T2 combat arms and aircrew, T3 special
 * units. The spec is emphatic that a player who picks the special-unit
 * path "should feel the difference immediately", and this is where that
 * becomes a number rather than a promise.
 *
 * NOBODY IS SAFE. Even T0 carries real exposure, because a rocket does not
 * check anybody's job — the frequency differs, the vulnerability does not.
 */
export type IntensityTier = 0 | 1 | 2 | 3

/** Per-mille chance of contact in a month, before the tempo has its say. */
const TIER_CONTACT: Readonly<Record<IntensityTier, number>> = {
  0: 90,
  1: 260,
  2: 520,
  3: 800,
}

/**
 * How much harder it goes when it goes wrong. Per-mille added to the
 * threat roll — a T3 operator is not merely in contact more often, the
 * contacts are worse (spec: "lethality ↑↑").
 */
const TIER_SEVERITY: Readonly<Record<IntensityTier, number>> = {
  0: 0,
  1: 60,
  2: 140,
  3: 260,
}

export function contactChanceFor(tier: IntensityTier, tempo: number): number {
  // The tempo is the theatre's; the tier is the job's. A quiet tour still
  // has a floor under it and a hot one is capped short of certainty —
  // a month in which contact is guaranteed is not a war, it is a treadmill.
  const base = TIER_CONTACT[tier]
  return Math.max(20, Math.min(920, Math.floor((base * tempo) / 500)))
}

/**
 * THE SHAPE, AS A MULTIPLIER RATHER THAN A RATE — and this is the fix for
 * a real mistake rather than a preference.
 *
 * The first version of this scaffold REPLACED the deployment loop's
 * contact rate outright. That rate carried a documented tuning bound
 * ("wound and death rates stay where they were tuned, foundation §6 bound
 * intact"), and replacing it took month one from roughly a third to
 * roughly two thirds. A soldier volunteering for an ally's war was dying
 * before his second month often enough to break a test that had passed
 * for the life of the project.
 *
 * The arc and the tier are supposed to REDISTRIBUTE a war, not inflate
 * one. So they multiply, and the multipliers are built to average near one
 * across a tour and across the roster: a rear job sees less and an
 * operator sees far more, the defining stretch is heavier and the
 * wind-down lighter, and the whole thing still costs what it was tuned to
 * cost.
 */
const TIER_FACTOR: Readonly<Record<IntensityTier, number>> = {
  0: 400,
  1: 800,
  2: 1_250,
  3: 1_900,
}

export function tierFactorPerMille(tier: IntensityTier): number {
  return TIER_FACTOR[tier]
}

/**
 * How much a theatre's temperature moves it, around one at the middle
 * setting. A garrison rotation is genuinely quiet; a hot tour is genuinely
 * hot; neither is a different game.
 */
export function tempoFactorPerMille(tempo: number): number {
  return Math.max(300, Math.min(1_700, 500 + tempo))
}

export function severityBiasFor(tier: IntensityTier): number {
  return TIER_SEVERITY[tier]
}

/**
 * WHICH TIER A JOB IS IN, from what the game already knows about it.
 *
 * Read off the specialty's own combat weight and its unit rather than a
 * second hand-maintained list — a list would drift from the roster the
 * first time anybody added a trade, and this way a new specialty lands in
 * the right tier without anybody remembering to put it there.
 */
export function tierFor(combatWeight: number, inSpecialUnit: boolean): IntensityTier {
  if (inSpecialUnit) return 3
  if (combatWeight >= 700) return 2
  if (combatWeight >= 350) return 1
  return 0
}

// ---------------------------------------------------------------------------
// Tempo (spec §1: "tempo is a dial, and it goes loud")
// ---------------------------------------------------------------------------

/**
 * HOW HOT THIS TOUR RUNS, 0-1000.
 *
 * Set by the war's own state rather than drawn freely — a tour is hot
 * because the war is, which is the difference between tempo and a random
 * number. A tour into a war going badly is a different tour, and it should
 * be, because that is Law 1.
 */
export function tempoFor(
  world: World,
  tick: Tick,
  personId: EntityId,
  tourNumber: number,
  warIntensity: number,
): number {
  const rng = openStream(world.seed, Stream.CombatResolution, personId * 41 + tourNumber, tick + 9_900)
  // The war decides most of it and the draw decides the rest: two people
  // in the same war at the same time can still have very different tours,
  // because a theatre is not one place.
  const drawn = rng.nextIntInclusive(-220, 220)
  return Math.max(60, Math.min(1_000, Math.floor(warIntensity * 0.8) + 200 + drawn))
}

export function tempoWords(tempo: number): string {
  if (tempo >= 780) return 'sustained heavy combat'
  if (tempo >= 540) return 'a hot tour'
  if (tempo >= 320) return 'regular contact'
  if (tempo >= 180) return 'mostly quiet, punctuated'
  return 'a garrison rotation'
}

// ---------------------------------------------------------------------------
// The five-beat arc (spec §1)
// ---------------------------------------------------------------------------

/**
 * WHERE IN THE TOUR SOMEBODY IS.
 *
 * The arc is what stops month four reading like month one. It is derived
 * from the calendar rather than stored, because it IS the calendar — a
 * stored copy would be a second source of truth for a number the dates
 * already answer.
 */
export type TourBeat = 'arrival' | 'grind' | 'defining' | 'winddown' | 'home'

export interface TourPhase {
  readonly beat: TourBeat
  readonly title: string
  readonly words: string
  /** Per-mille multiplier on the month's contact chance. */
  readonly contactPerMille: number
}

const PHASES: Readonly<Record<TourBeat, Omit<TourPhase, 'beat'>>> = {
  arrival: {
    title: 'Arrival · relief in place',
    words:
      'The unit you are replacing is still here for another week and they have the look of people counting days. Everything is somebody else’s system until it is yours.',
    // THE FIRST WEEKS ARE DANGEROUS FOR A REASON THAT IS NOT DRAMA: the
    // ground is unfamiliar, the patterns are not learned yet, and the
    // handover is when both units are in the same place.
    // Dangerous for a reason that is not drama — unfamiliar ground, two
    // units in the same place — and still under the grind, because the
    // grind is where most of a tour's contact actually happens.
    contactPerMille: 900,
  },
  grind: {
    title: 'The grind',
    words:
      'Patrol, sleep, patrol. Most of a war is this, and the men who have been here longest are the ones who talk about it least.',
    contactPerMille: 1_000,
  },
  defining: {
    title: 'The defining event',
    words:
      'Whatever this tour is going to be remembered for is happening now, and nobody will agree afterwards about when it started.',
    // The heaviest stretch of a tour, and the one people are asked about
    // for the rest of their lives.
    contactPerMille: 1_500,
  },
  winddown: {
    title: 'The wind-down',
    words:
      'The relief is named and the date is real. Everybody is being careful in a way nobody was in month three, which is its own kind of strain.',
    contactPerMille: 700,
  },
  home: {
    title: 'Redeployment',
    words: 'Manifest, wait, fly, wait. The war ends for you in an airport.',
    contactPerMille: 200,
  },
}

/**
 * WHICH BEAT A TOUR IS IN THIS MONTH.
 *
 * The defining event sits about two thirds through rather than at the end,
 * because a tour has to go on afterwards — the wind-down means nothing if
 * there is nothing to wind down FROM, and coming home the week after the
 * worst day of your life is a different thing from coming home a season
 * later still carrying it.
 */
export function beatFor(monthsIn: number, totalMonths: number): TourBeat {
  if (totalMonths <= 0) return 'home'
  if (monthsIn <= 0) return 'arrival'
  if (monthsIn >= totalMonths - 1) return 'home'
  const through = (monthsIn * 1_000) / totalMonths
  if (through < 120) return 'arrival'
  if (through >= 600 && through < 760) return 'defining'
  if (through >= 820) return 'winddown'
  return 'grind'
}

export function phaseFor(beat: TourBeat): TourPhase {
  const phase = PHASES[beat]
  return { beat, ...phase }
}

/**
 * THE MONTH'S ACTUAL ODDS OF CONTACT — everything above, together.
 *
 * This is the one number the deployment loop needs, and it is built from
 * the job's tier, the theatre's tempo and where in the arc the tour is.
 * All three matter and none of them alone decides it.
 */
export function monthContactChance(
  tier: IntensityTier,
  tempo: number,
  beat: TourBeat,
): number {
  const base = contactChanceFor(tier, tempo)
  return Math.max(10, Math.min(950, Math.floor((base * phaseFor(beat).contactPerMille) / 1_000)))
}

/**
 * WHAT TO MULTIPLY THE TUNED RATE BY THIS MONTH, per-mille.
 *
 * This is what the deployment loop actually uses. It keeps the existing
 * exposure model — which decides WHO is in danger and how much — and adds
 * only the shape: whose job it is, how hot the theatre is, and where in
 * the tour this month falls.
 *
 * Bounded at both ends on purpose. A rear job on a quiet tour is never
 * perfectly safe, and an operator on a hot tour in the defining stretch is
 * never certain — the first would be a lie and the second is a treadmill.
 */
export function contactShapePerMille(
  tier: IntensityTier,
  tempo: number,
  beat: TourBeat,
): number {
  const shaped = Math.floor(
    (tierFactorPerMille(tier) * tempoFactorPerMille(tempo) * phaseFor(beat).contactPerMille) /
      1_000_000,
  )
  return Math.max(120, Math.min(3_000, shaped))
}

/**
 * A LINE FOR THE SCREEN AND THE RECORD, so the tour has an identity
 * somebody can hold: what it is called, where it is, and how it ran.
 */
export function tourHeadline(operation: string, place: string, months: number, tempo: number): string {
  return `${operation}, ${place} — ${String(months)} months, ${tempoWords(tempo)}`
}
