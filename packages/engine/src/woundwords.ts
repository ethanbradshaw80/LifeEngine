/**
 * WHAT A WOUND IS LIKE (MILITARY_DEPTH_PLAN §4.4c).
 *
 * OWNER: "we also need to change up the 'you were hit - the shoulder - its
 * bad' writting too this sucks this needs to be way more in detail and
 * descriptive as well. We can ignore whatever rules we have for gore and
 * censorship for this depth plan for everything."
 *
 * §4.4c names the four things the writing has to say, and all four are
 * computable from what the engine already holds:
 *
 *   1. WHAT HIT HIM, AND WHAT THAT DOES. A rifle round, a fragment, blast
 *      overpressure and burns are four different injuries and read nothing
 *      alike.
 *   2. WHERE, SPECIFICALLY, and what is under that place. A shoulder is a
 *      joint, an artery and a nerve bundle, which is why a shoulder wound
 *      ends careers a thigh wound does not.
 *   3. WHAT IT COST TO GET HIM OUT — the minutes, the ride, who carried him.
 *   4. WHAT HE IS LIKE AFTERWARDS.
 *
 * THE ONE DESIGN DECISION HERE, AND WHY.
 *
 * §4.4c's correction says `casualty.ts` is dead code — `resolveCasualty` has
 * never run — and recommends wiring it into `inflictWound` so the prose can
 * key on its six TIERS and its MINUTES TO A SURGICAL TEAM.
 *
 * Wiring it as the DECIDER would re-roll every wound in the game through a
 * second distribution, and `casualty.ts`'s own comments record what happened
 * the last time that distribution was got slightly wrong: "57 per cent of all
 * wounds ended the tour against a spec that asks for well under 25". That is
 * a rebalance, and a rebalance in the same pass as a writing job is how you
 * end up unable to tell which change broke the numbers.
 *
 * So the tier is READ off the severity the live path already computes, rather
 * than drawn again. Severity 0–1000 IS the tier expressed as a scalar; this
 * module says where the lines fall. Nothing about who lives, who is evacuated
 * or who is boarded out changes by one case — and the writing gets the tier
 * and the minutes it needs.
 *
 * The minutes are derived from (seed, person, tick) exactly like the
 * situation, so they are a stable fact about that wounding, cost no save
 * space, and exist for every wound ever recorded, including in old saves.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { hash32, Stream } from './rng.js'
import type { BodySite, InjuryKind, World } from './types.js'

/** The six tiers `casualty.ts` defines, read off severity rather than redrawn. */
export type WoundTier = 1 | 2 | 3 | 4 | 5 | 6

/**
 * WHERE THE LINES FALL, and the one that matters is between 3 and 4 — the
 * difference between a man who stays and a man who goes on the aircraft.
 * These are the same boundaries `EVACUATES_AT` already implies.
 */
export function tierOfSeverity(severity: number): WoundTier {
  if (severity < 120) return 1
  if (severity < 300) return 2
  if (severity < 480) return 3
  if (severity < 700) return 4
  if (severity < 900) return 5
  return 6
}

/**
 * HOW LONG IT TOOK TO GET HIM TO A SURGEON.
 *
 * The most dramatic number in the casualty system and it has never once been
 * shown. Under twenty minutes is the difference between a survivable chest
 * wound and a fatal one; past two hours the tier hardly matters.
 */
export function evacMinutes(
  world: World,
  personId: EntityId,
  tick: Tick,
  hasMedic: boolean,
): number {
  const draw = hash32(world.seed, Stream.CombatResolution, personId, 71_000 + tick)
  const base = 18 + (draw % 100)
  // A medic on the ground is the whole difference in the first hour.
  return Math.max(6, hasMedic ? Math.floor(base / 2) : base)
}

/** What the thing that hit him does, in the terms of the injury it makes. */
const MECHANISM: Readonly<Partial<Record<InjuryKind, string>>> = {
  gunshot:
    'A rifle round does not make a hole so much as a cavity — it dumps its energy into whatever it passes through and the wrecked tissue goes on dying for hours after the bleeding stops',
  shrapnel:
    'Fragments do not travel alone. There is never one wound; there are nine or eleven of them, most shallow, and the one that matters is the one nobody found for twenty minutes',
  blast:
    'Overpressure does its damage to the parts of a body that hold air — lungs, gut, the inside of the ears — so a man can walk away from a blast with nothing to see and be bleeding internally the whole time',
  burns:
    'Burns keep going after the fire stops. What matters is not the pain, which is worse in the shallow ones, but the fluid a body loses through skin that is no longer skin',
  crush:
    'Crushed muscle poisons the blood it is still attached to. The dangerous hour is not the one under the weight, it is the one after the weight comes off',
  fracture:
    'The bone is the simple part. What breaks bone that hard tears everything around it, and that is what takes the months',
  concussion:
    'The brain is a soft thing in a hard box and it does not have to be touched to be hurt. The worst of it does not show up on the day',
  laceration:
    'A deep laceration bleeds in a way that looks worse than it is, right up until it involves something that matters, at which point it looks the same and is not',
  amputation:
    'A limb taken off by blast or by a surgeon is the same limb gone; the difference is how much of what is left is worth keeping',
  'hearing-damage':
    'Hearing does not come back. The ringing stops, and what is left is a hole in the middle of every conversation for the rest of a life',
  'spinal-injury':
    'A spinal injury is the one where the number of millimetres decides everything and nobody knows the number for days',
  'internal-injury':
    'Internal injuries are quiet. A liver or a spleen will fill an abdomen without a mark on the outside of it',
  'eye-injury':
    'The eye is a fluid-filled sphere and it does not tolerate being opened. There is a window of hours and then there is not',
  electrocution:
    'Current goes in somewhere and out somewhere and cooks everything on the path between the two, which is never the path you would guess',
  'chemical-burns':
    'A chemical burn goes on burning until something neutralises it, and water is usually the wrong answer',
  'smoke-inhalation':
    'It is not the smoke, it is what the heat does to an airway on the way down — and an airway that is swelling closes hours later, somewhere quiet',
  heatstroke:
    'When the body stops being able to shed heat, the temperature climbs until proteins start to fail, and organs go in an order',
  frostbite:
    'Frozen tissue does not hurt, which is the problem. It hurts coming back, and by then you know how much of it is coming back',
  'near-drowning':
    'Water in the lungs does its damage over the following day, to a man who has been talking and walking since he came out',
  'animal-bite':
    'A bite crushes and tears at once and puts a mouth full of bacteria into the middle of it',
}

/** What is under that place, which is why site matters more than size. */
const ANATOMY: Readonly<Record<BodySite, string>> = {
  head:
    'the head, where there is nothing that is not important and no room for anything to swell',
  chest:
    'the chest — and armour covers the chest, so anything that reaches it got through something first',
  back:
    'the back, a hand-width from the spinal cord along its whole length',
  shoulder:
    'the shoulder, which is a joint, a major artery and the nerve bundle that runs the whole arm, packed into a space the size of a fist',
  arm: 'the upper arm, where the artery runs against the bone',
  hand: 'the hand, twenty-seven bones and the difference between a trade and a pension',
  leg: 'the thigh, where the femoral artery will empty a man in three minutes',
  foot: 'the foot, which carries everything and forgives nothing',
}

/** What he is like afterwards, by tier. */
const AFTER: Readonly<Record<WoundTier, string>> = {
  1: 'Nothing touched him. He will hear that shot again for years, usually about four in the morning.',
  2: 'Dressed at the aid station and back with the platoon the same week, with a scar to be casual about.',
  3: 'Walking and working inside the month, and it will ache in the cold for the rest of his life.',
  4: 'Months of it, and a return to duty that is real but not the same. He will pass the medical and know he is passing it.',
  5: 'This one does not end. Everything after it happens on the other side of it, and the word the board uses is permanent.',
  6: 'They did not get to him in time.',
}

export interface WoundStory {
  readonly tier: WoundTier
  /** "A serious gunshot wound to the shoulder." The headline, still plain. */
  readonly headline: string
  /** The four paragraphs §4.4c asks for, in order. */
  readonly lines: readonly string[]
}

/**
 * THE WOUND, WRITTEN.
 *
 * `cast.carriedBy` is the man who got him out, by the name the squad uses,
 * because "the minutes and the ride and who carried him" is the third of the
 * four things and a name is what makes it a memory rather than a statistic.
 */
export function woundStory(
  kind: InjuryKind,
  site: BodySite,
  severity: number,
  minutes: number,
  cast?: { readonly carriedBy?: string | null; readonly medic?: string | null },
): WoundStory {
  const tier = tierOfSeverity(severity)
  const what = kind.replace(/-/g, ' ')
  const headline =
    tier === 1
      ? 'A near miss.'
      : `${tier >= 5 ? 'A life-altering' : tier === 4 ? 'A serious' : tier === 3 ? 'A' : 'A minor'} ${what} to the ${site}.`

  const lines: string[] = []

  // 1. WHAT HIT HIM.
  if (tier === 1) {
    lines.push(
      'It went past close enough to hear the crack of it going by, which means it was inside a hand-width. Nothing touched him.',
    )
  } else {
    lines.push(`${MECHANISM[kind] ?? 'It did what it does'}.`)
  }

  // 2. WHERE, AND WHAT IS UNDER IT.
  if (tier > 1) {
    lines.push(`It caught him in ${ANATOMY[site]}.`)
  }

  // 3. WHAT IT COST TO GET HIM OUT. Only when he had to be got out at all.
  if (tier >= 3) {
    const ride =
      minutes <= 20
        ? `The bird was on the ground in ${String(minutes)} minutes, which is the only reason this reads the way it does`
        : minutes <= 60
          ? `It was ${String(minutes)} minutes to a surgical team — long enough to be frightening and short enough to survive`
          : minutes <= 120
            ? `It took ${String(minutes)} minutes to get him to a surgeon. An hour of that was spent waiting on weather`
            : `It was ${String(minutes)} minutes before anybody with a scalpel saw him, and at that point the argument stops being about the wound`
    const carried =
      cast?.carriedBy === undefined || cast.carriedBy === null
        ? ''
        : ` ${cast.carriedBy} carried him the first part of it and would not let anybody else take the weight.`
    const medic =
      cast?.medic === undefined || cast.medic === null
        ? ''
        : ` ${cast.medic} kept him going with what he had in a bag.`
    lines.push(`${ride}.${medic}${carried}`)
  }

  // 4. WHAT HE IS LIKE AFTERWARDS.
  lines.push(AFTER[tier])

  return { tier, headline, lines }
}
