/**
 * THE CRIME AS IT HAPPENS.
 *
 * The owner, playing: "Clicking 'Do it' currently jumps straight to the
 * result: the screen blanks and money is added, or it teleports to the court
 * popup. There's no scene."
 *
 * He is right, and the shape of the bug is worth naming: the money moved
 * BEFORE anything was decided. A burglary resolved in one call — take the
 * cash, roll for clearance, open the court — so the largest choice in the
 * crime module was a button with no moment attached to it.
 *
 * Now it is the same pattern as a combat moment: a hidden danger is rolled,
 * the player is given a TELL they can read, and what they do about it
 * decides the outcome. Nothing moves until they answer.
 *
 * THE SECOND BUG, found the same way: one generic template was reused for
 * every crime and every answer, so a white-collar crime showed the burglary
 * text and offered "go for the safe". The fix is the rule this module now
 * enforces end to end —
 *
 *   text + options = f(the offence, the rolled band, the choice, the result)
 *
 * — with every line authored per scene in crimecopy.ts and picked from a
 * pool by seed. Varied wording, never a mismatched fact. Nothing is
 * generated; the pools are written by hand, which is the point.
 *
 * This module is pure and holds no state: it says what the room looks like
 * and what an answer to it means. crime.ts owns the money, the record and
 * the courthouse, exactly as before.
 */

import type { Offence } from './content.js'
import { PROFILE_BANDS, PROFILE_OPTIONS, SCENE_OF } from './crimecopy.js'
import type { CrimeDanger, DangerProfile, SceneCopy } from './crimecopy.js'

/**
 * How the room actually is, hidden until the scene is drawn.
 *
 * Declared alongside the copy it names — "armed" in a house, "a patrol near"
 * on a street, "an audit" in a ledger — and re-exported here, which is where
 * the rest of the engine has always read it from.
 */
export type { CrimeDanger }

/** The three answers. Their WORDS come from the profile; these are the ids. */
export type CrimeChoice = 'press' | 'cool' | 'bail'

export const CRIME_SCENE_OPTIONS: readonly CrimeChoice[] = ['press', 'cool', 'bail']

export interface CrimeScene {
  readonly danger: CrimeDanger
  /** "Occupied" / "A witness" / "An audit" — the banner, in this profile's words. */
  readonly label: string
  /** The tell: what the player can see before choosing. */
  readonly tell: string
  readonly options: readonly {
    readonly id: CrimeChoice
    readonly title: string
    /** "high risk" / "measured" / "safe". */
    readonly tag: string
    readonly detail: string
  }[]
}

export type CrimeOutcomeKind =
  | 'clean'
  /** Took it, but was seen — the constable is coming. */
  | 'seen'
  /** Nothing taken; arrested on the spot. */
  | 'caught'
  /** It went physically wrong. */
  | 'wounded'
  /** Backed out. No crime, no loss. */
  | 'bailed'

export interface CrimeOutcome {
  readonly kind: CrimeOutcomeKind
  readonly title: string
  readonly text: string
  /** The line under it: the take, or what it cost. */
  readonly consequence: string
  /**
   * Share of the offence's takings this attempt actually gets, in
   * thousandths. Zero on anything that ended without the money.
   */
  readonly lootPerMille: number
  /**
   * What it did to the chance of being caught, in thousandths of the
   * offence's own clearance. A quiet job is genuinely hard to solve; being
   * seen is most of the way to a charge.
   */
  readonly clearancePerMille: number
}

/** Every offence has one. The catalogue is checked for it by a test. */
export function profileOf(offence: Offence): DangerProfile {
  return offence.danger ?? 'police'
}

/** The authored set for this offence. */
export function copyFor(offence: Offence): SceneCopy | undefined {
  return SCENE_OF[offence.id]
}

/**
 * The danger, weighted by WHAT KIND of danger the offence carries.
 *
 * `danger` is not a severity — it says what can go wrong. A 'physical'
 * offence is one where somebody is present to fight back, so it goes hot
 * most often. 'police' is a crime interrupted by the law rather than by a
 * resident. 'discovery' is the white-collar shape: nobody is going to walk
 * in on a forged ledger, so the room is almost always quiet and the risk
 * lives somewhere else entirely.
 *
 * Everything leans quiet, because most crimes are not interrupted — a
 * scene that was hot every time would teach the player to always bail.
 */
export function dangerFor(
  offence: Offence,
  rng: { nextIntInclusive: (min: number, max: number) => number },
): CrimeDanger {
  const profile = profileOf(offence)
  const risk = profile === 'physical' ? 2 : profile === 'police' ? 1 : 0
  const roll = rng.nextIntInclusive(1, 100)
  // quiet / occupied / hot, sliding with the offence's own danger.
  //
  // MEASURED, and the first setting contradicted the paragraph above it: at
  // `55 - risk * 15` a physical crime came up HOT 51 times in 100 — a
  // burglary met an armed resident more often than not, which is both
  // absurd and exactly the thing that teaches a player to always bail.
  // Re-measured over all 100 rolls at this setting: hot is 25 for physical,
  // 17 for police-risk and 9 for a paper crime, which is the intended shape
  // — rare, real, and rarest where nobody is going to walk in on you.
  const quiet = 50 - risk * 8
  const occupied = quiet + 41
  if (roll <= quiet) return 'quiet'
  if (roll <= occupied) return 'occupied'
  return 'hot'
}

/**
 * ONE LINE OUT OF A POOL, by seed.
 *
 * Deterministic and total: the same offence, band and pick always give the
 * same sentence, and an empty pool is impossible because the test asserts
 * every slot of every set is non-empty.
 */
function fromPool(pool: readonly string[], pick: number): string {
  if (pool.length === 0) return ''
  return pool[Math.abs(pick) % pool.length] ?? ''
}

/**
 * A stable number to pick pool entries with.
 *
 * The variant is carried on the pending alongside the band, so the sentence
 * a player read before choosing is the same one they would read again — a
 * scene that reworded itself between the tell and the answer would be a
 * different scene.
 */
export function crimeSceneFor(offence: Offence, danger: CrimeDanger, variant = 0): CrimeScene {
  const profile = profileOf(offence)
  const copy = copyFor(offence)
  const words = PROFILE_OPTIONS[profile]
  return {
    danger,
    label: PROFILE_BANDS[profile][danger],
    tell: copy === undefined ? '' : fromPool(copy[danger], variant),
    options: [
      {
        id: 'press',
        title: words.press,
        tag: 'high risk',
        detail: copy?.pressDetail ?? '',
      },
      { id: 'cool', title: words.cool, tag: 'measured', detail: copy?.coolDetail ?? '' },
      { id: 'bail', title: words.bail, tag: 'safe', detail: copy?.bailDetail ?? '' },
    ],
  }
}

/** What the six results are called, per profile. */
const TITLES: Record<DangerProfile, Record<CrimeOutcomeKind, string>> = {
  physical: {
    bailed: 'Walked away',
    clean: 'Clean getaway',
    seen: 'Seen',
    wounded: 'It goes wrong',
    caught: 'Caught in the act',
  },
  police: {
    bailed: 'Left it alone',
    clean: 'Nobody looked',
    seen: 'Somebody saw',
    wounded: 'It goes wrong',
    caught: 'Stopped',
  },
  discovery: {
    bailed: 'Put it back',
    clean: 'Nobody counted',
    seen: 'It shows in the books',
    wounded: 'The file comes apart',
    caught: 'Asked to explain it',
  },
}

/** The consequence line: factual, and worded for where the danger lives. */
const CONSEQUENCES: Record<DangerProfile, Record<CrimeOutcomeKind, string>> = {
  physical: {
    bailed: 'Nothing taken. Nothing lost.',
    clean: 'No witnesses. You were never there.',
    seen: 'You were seen — evidence is high. Expect the constable.',
    wounded: 'Badly hurt in the doing. If you live, this goes before the judge.',
    caught: 'Arrested on the spot. Your case goes before the judge.',
  },
  police: {
    bailed: 'Nothing done. Nothing on the record.',
    clean: 'Nobody reported it. Low evidence.',
    seen: 'Somebody gave a description. Evidence is high.',
    wounded: 'It went physical, and that is a charge of its own.',
    caught: 'Stopped and taken in. Your case goes before the judge.',
  },
  discovery: {
    bailed: 'The books balance. Nothing happened.',
    clean: 'Nothing on paper points anywhere near you.',
    seen: 'It is in writing now, and the writing is yours.',
    wounded: 'The whole file is being read, and it reads badly.',
    caught: 'Referred, and the referral names you. This goes before the judge.',
  },
}

/**
 * What an answer to that room actually means.
 *
 * THE RULE THIS OBEYS is the combat moment's: a choice is never a discount.
 * Bailing is genuinely safe and genuinely empty-handed; pressing on in the
 * worst band can get you hurt; and holding back is the middle everywhere,
 * which is what makes reading the tell worth doing.
 *
 * The numbers are the same for every crime — they are the shape of the
 * gamble. The WORDS are the offence's own, out of its authored set.
 */
export function crimeOutcomeFor(
  danger: CrimeDanger,
  choice: CrimeChoice,
  offence?: Offence,
  variant = 0,
): CrimeOutcome {
  const profile = offence === undefined ? 'physical' : profileOf(offence)
  const copy = offence === undefined ? undefined : copyFor(offence)
  const said = (slot: keyof SceneCopy): string => {
    const pool = copy?.[slot]
    return Array.isArray(pool) ? fromPool(pool, variant) : ''
  }
  const made = (kind: CrimeOutcomeKind, slot: keyof SceneCopy, loot: number, clearance: number) => ({
    kind,
    title: TITLES[profile][kind],
    text: said(slot),
    consequence: CONSEQUENCES[profile][kind],
    lootPerMille: loot,
    clearancePerMille: clearance,
  })

  if (choice === 'bail') return made('bailed', 'bailed', 0, 0)

  if (danger === 'quiet') {
    return choice === 'press'
      ? made('clean', 'boldClean', 1000, 350)
      : made('clean', 'quietClean', 420, 200)
  }

  if (danger === 'occupied') {
    return choice === 'press'
      ? made('seen', 'seen', 720, 2400)
      : made('clean', 'quietClean', 300, 900)
  }

  // The worst band. The room already told them.
  return choice === 'press'
    ? made('wounded', 'wounded', 0, 1000)
    : made('caught', 'caught', 0, 1000)
}

/**
 * "burglary:quiet:2" — what the pending carries between the scene and the
 * answer. The VARIANT travels with it so the sentence a player read before
 * choosing is the one the outcome follows on from.
 */
export function encodeCrimeScene(offenceId: string, danger: CrimeDanger, variant = 0): string {
  return `${offenceId}:${danger}:${String(variant)}`
}

export function decodeCrimeScene(encoded: string | null): {
  offenceId: string
  danger: CrimeDanger
  variant: number
} {
  const parts = (encoded ?? '').split(':')
  const danger = parts[1]
  const variant = Number.parseInt(parts[2] ?? '0', 10)
  return {
    offenceId: parts[0] ?? '',
    danger: danger === 'quiet' || danger === 'occupied' || danger === 'hot' ? danger : 'quiet',
    variant: Number.isFinite(variant) ? variant : 0,
  }
}
