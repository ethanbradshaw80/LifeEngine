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
 * This module is pure and holds no state: it says what the room looks like
 * and what an answer to it means. crime.ts owns the money, the record and
 * the courthouse, exactly as before.
 */

import type { Offence } from './content.js'

/**
 * How the room actually is, hidden until the scene is drawn.
 *
 * Named for what the player sees rather than for a number, because the
 * whole point is that the tell is readable: a dark house, a light upstairs,
 * a shotgun in the dark.
 */
export type CrimeDanger = 'quiet' | 'occupied' | 'hot'

/** Press on, keep cool, or back out. */
export type CrimeChoice = 'press' | 'cool' | 'bail'

export const CRIME_SCENE_OPTIONS: readonly CrimeChoice[] = ['press', 'cool', 'bail']

export interface CrimeScene {
  readonly danger: CrimeDanger
  /** "Occupied" — the banner. */
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
  /** The resident was armed. */
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
  const risk = offence.danger === 'physical' ? 2 : offence.danger === 'police' ? 1 : 0
  const roll = rng.nextIntInclusive(1, 100)
  // quiet / occupied / hot, sliding with the offence's own danger.
  const quiet = 55 - risk * 15
  const occupied = quiet + 32 - risk * 4
  if (roll <= quiet) return 'quiet'
  if (roll <= occupied) return 'occupied'
  return 'hot'
}

const LABELS: Record<CrimeDanger, string> = {
  quiet: 'Quiet',
  occupied: 'Occupied',
  hot: 'Hot',
}

/**
 * WHICH KIND OF ROOM THIS IS.
 *
 * Found by playing: "disorderly conduct" was being described as a burglary
 * — "whoever lives here is not home tonight", with "go for the safe" as an
 * option. There is no house and there is no safe. A tell that asserts a
 * scene the offence does not have is the same fault as prose asserting a
 * mechanism the record does not support, and the player reads it instantly.
 *
 * Four registers, decided by what the offence actually IS rather than by
 * how bad it is:
 *
 *   person   somebody is standing in front of you
 *   house    you are inside somewhere you should not be
 *   ledger   nobody will walk in; the risk is that it is noticed later
 *   street   nothing is being taken at all — the risk is being seen doing it
 */
type SceneRegister = 'person' | 'house' | 'ledger' | 'street'

function registerFor(offence: Offence): SceneRegister {
  if (offence.violent === true) return 'person'
  if (offence.takesFromHousehold === true) return 'house'
  if (offence.gainMax > 0) return 'ledger'
  return 'street'
}

const TELLS: Record<SceneRegister, Record<CrimeDanger, string>> = {
  person: {
    quiet:
      'They are alone and not paying attention, head down, a long way from the nearest lit porch.',
    occupied:
      'They are alone, but the street is not — there are voices somewhere behind you, and a car idling at the kerb.',
    hot: 'They turn before you are ready, and they are bigger than they looked. Their hand is already going inside their coat.',
  },
  house: {
    quiet: 'The windows are dark and the drive is empty. Whoever lives here is not home tonight.',
    occupied: 'A light burns upstairs, and somewhere inside a dog starts to bark.',
    hot: 'You are barely inside when you hear it — the unmistakable rack of a shotgun in the dark.',
  },
  ledger: {
    quiet: 'The office is empty and the ledger is open. Nobody reconciles this account until spring.',
    occupied: 'The book does not balance the way it did last week. Someone has been through it since you have.',
    hot: 'There is an auditor at the desk that is usually empty, and they have your file open in front of them.',
  },
  street: {
    quiet: 'The street is empty and the hour is late. Nobody is going to see this.',
    occupied: 'There are people on the corner and a lit window across the road. Somebody is watching, or will be.',
    hot: 'A constable rounds the corner ahead of you and slows down when they see your face.',
  },
}

const OPTION_WORDS: Record<
  SceneRegister,
  { press: string; cool: string; bail: string; pressTitle: string; coolTitle: string; bailTitle: string }
> = {
  person: {
    pressTitle: 'Press on',
    press: 'Take everything they have on them — and make sure they do not follow.',
    coolTitle: 'Keep cool',
    cool: 'Take what is in their hand and be gone before they place your face.',
    bailTitle: 'Bail',
    bail: 'Leave them be and walk the other way.',
  },
  house: {
    pressTitle: 'Press on',
    press: 'Go for the safe — more to take, more to lose.',
    coolTitle: 'Keep cool',
    cool: "Grab what's in reach and slip out.",
    bailTitle: 'Bail',
    bail: 'Back out now, empty-handed.',
  },
  ledger: {
    pressTitle: 'Take the lot',
    press: 'Move the whole balance and square the book afterwards.',
    coolTitle: 'Skim it',
    cool: 'Take a little, from an account nobody reads closely.',
    bailTitle: 'Put it back',
    bail: 'Close the book and leave the numbers where they were.',
  },
  street: {
    pressTitle: 'Push it',
    press: 'Make a scene of it, and let whoever is watching watch.',
    coolTitle: 'Keep it quiet',
    cool: 'Do what you came to do without drawing a crowd.',
    bailTitle: 'Walk away',
    bail: 'Let it go and keep walking.',
  },
}

function optionsFor(offence: Offence): CrimeScene['options'] {
  const words = OPTION_WORDS[registerFor(offence)]
  return [
    { id: 'press', title: words.pressTitle, tag: 'high risk', detail: words.press },
    { id: 'cool', title: words.coolTitle, tag: 'measured', detail: words.cool },
    { id: 'bail', title: words.bailTitle, tag: 'safe', detail: words.bail },
  ]
}

export function crimeSceneFor(offence: Offence, danger: CrimeDanger): CrimeScene {
  return {
    danger,
    label: LABELS[danger],
    tell: TELLS[registerFor(offence)][danger],
    options: optionsFor(offence),
  }
}

/**
 * What an answer to that room actually means.
 *
 * THE RULE THIS OBEYS is the combat moment's: a choice is never a discount.
 * Bailing is genuinely safe and genuinely empty-handed; pressing on in a
 * hot room can get you hurt; and keeping cool is the middle everywhere,
 * which is what makes reading the tell worth doing.
 *
 * The WORDS take the offence, because a ledger has no hallway — the first
 * version described every outcome as a burglary, including a bar fight and
 * a forged cheque.
 */
export function crimeOutcomeFor(
  danger: CrimeDanger,
  choice: CrimeChoice,
  offence?: Offence,
): CrimeOutcome {
  const register = offence === undefined ? 'house' : registerFor(offence)
  const said = (byRegister: Partial<Record<SceneRegister, string>>, fallback: string): string =>
    byRegister[register] ?? fallback

  if (choice === 'bail') {
    return {
      kind: 'bailed',
      title: danger === 'hot' ? 'Backed off' : 'Walked away',
      text: said(
        {
          person: 'You let them go past. They never knew how close it came.',
          ledger: 'You close the book and put it back exactly as you found it.',
          street: 'You keep your head down and keep walking. Nothing happened here.',
        },
        danger === 'hot'
          ? 'You do not argue with a shotgun. You are back out and gone, heart going like a hammer.'
          : 'Something about it feels wrong. You back out and melt into the dark.',
      ),
      consequence: 'Nothing taken. Nothing lost.',
      lootPerMille: 0,
      clearancePerMille: 0,
    }
  }

  if (danger === 'quiet') {
    const press = choice === 'press'
    return {
      kind: 'clean',
      title: 'Clean getaway',
      text: press
        ? said(
            {
              person: 'They never see you coming, and they are still on the ground when you are two streets away.',
              ledger: 'You move the whole balance and square the book behind you. It will be spring before anyone looks.',
              street: 'You do exactly what you came to do, loudly, and nobody comes.',
            },
            'Nobody home, all night to work. You find the safe, and it is not much of one.',
          )
        : said(
            {
              person: 'You take what is in their hand and you are gone before they have your face.',
              ledger: 'A little, off an account nobody reads closely. It will not be missed.',
              street: 'Quick and quiet, and the street stays empty.',
            },
            'You take what is lying out and you are gone in two minutes.',
          ),
      consequence: press ? 'No witnesses. You were never here.' : 'Low evidence — a quiet job.',
      lootPerMille: press ? 1000 : 420,
      clearancePerMille: press ? 350 : 200,
    }
  }

  if (danger === 'occupied') {
    return choice === 'press'
      ? {
          kind: 'seen',
          title: 'Seen',
          text: said(
            {
              person: 'Somebody shouts from the corner. You get what you came for and run, and they get a long look at you doing it.',
              ledger: 'You take the lot — and the transfer sits there in the open, in your hand, dated.',
              street: 'You make a scene of it, and half the street watches you make it.',
            },
            'A floorboard gives under you. A voice calls a name that is not yours, and a shape moves at the top of the stairs. You grab the drawer and run.',
          ),
          consequence: 'You were seen — evidence is high. Expect the constable.',
          lootPerMille: 720,
          clearancePerMille: 2400,
        }
      : {
          kind: 'clean',
          title: 'Slipped out',
          text: said(
            {
              person: 'You take what is easy and go before anyone behind you turns round.',
              ledger: 'You skim it and leave the book looking like a book.',
              street: 'You do it small, and the corner does not look up.',
            },
            'You take what is by the door and go before the dog brings anyone down.',
          ),
          consequence: 'Somebody may have noticed — some evidence.',
          lootPerMille: 300,
          clearancePerMille: 900,
        }
  }

  // Hot. The room already told them.
  return choice === 'press'
    ? {
        kind: 'wounded',
        title: register === 'ledger' || register === 'street' ? 'It goes wrong' : 'It goes wrong',
        text: said(
          {
            person: 'The knife is out before you understand there is one, and the street comes apart around you.',
            ledger: 'The auditor looks up, and the room fills with people who were waiting for you to reach for it.',
            street: 'You push it, and it stops being your night the moment hands are on you.',
          },
          'You go for the hall and the dark goes white. The blast catches you across the shoulder, and you are down before you hear the second one.',
        ),
        consequence:
          register === 'ledger' || register === 'street'
            ? 'Taken hold of, and hurt in the doing. This goes before the judge.'
            : 'Gravely wounded. If you live, this is a court case — and the charge may not be what you came for.',
        lootPerMille: 0,
        clearancePerMille: 1000,
      }
    : {
        kind: 'caught',
        title: 'Caught in the act',
        text: said(
          {
            person: 'They have your wrist and they are not letting go, and they are shouting for someone.',
            ledger: 'The auditor turns the page towards you and asks you to explain it.',
            street: 'The constable is already saying your name by the time you look up.',
          },
          'You freeze, hands up. The barrel does not waver. Headlights swing into the drive — they had already called it in.',
        ),
        consequence: 'Arrested. Your case goes before the judge.',
        lootPerMille: 0,
        clearancePerMille: 1000,
      }
}

/** "quiet:press" — what the pending carries between the scene and the answer. */
export function encodeCrimeScene(offenceId: string, danger: CrimeDanger): string {
  return `${offenceId}:${danger}`
}

export function decodeCrimeScene(encoded: string | null): {
  offenceId: string
  danger: CrimeDanger
} {
  const parts = (encoded ?? '').split(':')
  const danger = parts[1]
  return {
    offenceId: parts[0] ?? '',
    danger: danger === 'quiet' || danger === 'occupied' || danger === 'hot' ? danger : 'quiet',
  }
}
