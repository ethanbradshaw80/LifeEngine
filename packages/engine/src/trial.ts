/**
 * The court case, as the owner's §15b specifies it: three playable scenes,
 * not a button.
 *
 * THE GAP HE FOUND, PLAYING: "I just click stand trial and then I get
 * convicted." Sections 13 to 15 specified trials as OUTCOMES — the plea,
 * the penalties, the justification maths — and the only courtroom scene was
 * the arraignment. Everything after it resolved off-screen.
 *
 *   SCENE 1  arraignment — the charge, any plea deal, and if you contest
 *            it, who represents you. Plead out here and there is no trial:
 *            the case goes straight to sentencing.
 *   SCENE 2  the trial — the evidence the state actually gathered, laid
 *            out, and three beats that move the odds against it.
 *   SCENE 3  the verdict — the jury returns. This is what the case has
 *            been building to, so it is a scene and not a log line.
 *
 * THE EVIDENCE IS READ, NOT ROLLED. It is assembled from what the record
 * already holds about the commission: whether an arrest was made, whether
 * there is a victim alive to testify, whether a weapon was used, what the
 * file already says about the defendant. That is the same discipline the
 * awards and the causal records keep — the game does not invent facts for
 * people to argue about.
 */

import type { EntityId } from '@life-engine/shared'
import type { Offence } from './content.js'
import type { World, WorldEvent } from './types.js'

export type TrialStage = 'counsel' | 'state' | 'defense' | 'closing' | 'verdict'

export interface TrialScene {
  readonly stage: TrialStage
  readonly tell: string
  readonly options: readonly { readonly id: string; readonly label: string; readonly says: string }[]
}

/**
 * What the state has. Each piece is READ off the record of the commission,
 * so the case that gets argued is the case that actually happened.
 */
export interface Evidence {
  /** 0-1000. The state's case before anybody argues about it. */
  readonly strength: number
  /** The pieces, in words, for the scene that lays them out. */
  readonly pieces: readonly string[]
}

/** What hiring somebody costs, in cents. Real money, real ledger. */
export const COUNSEL_COST = 180_000

/** Counsel, and what it is worth against the state's case. */
const COUNSEL_SWING: Readonly<Record<string, number>> = {
  'hire-attorney': 240,
  'public-defender': 90,
  'self-represent': 0,
}

/** Each beat's answer, and what it moves. */
const BEAT_SWING: Readonly<Record<string, number>> = {
  // Beat 1 — the state's case
  'challenge-the-weak-point': 150,
  'let-it-stand': 40,
  'object-hard': 90,
  // Beat 2 — your defence
  'take-the-stand': 200,
  'let-counsel-argue': 110,
  'stay-silent': 80,
  // Beat 3 — closing
  'reasonable-doubt': 140,
  'appeal-for-sympathy': 60,
  'stand-on-the-facts': 100,
}

export function counselSwing(choice: string): number {
  return COUNSEL_SWING[choice] ?? 0
}

export function beatSwing(choice: string): number {
  return BEAT_SWING[choice] ?? 0
}

/**
 * C3 §15b. What the state gathered, read off the record.
 *
 * Nothing here is invented: each piece corresponds to something the world
 * already recorded, and a thin case is thin because the crime genuinely
 * left little behind.
 */
export function evidenceFor(
  world: World,
  personId: EntityId,
  offence: Offence,
  tick: number,
): Evidence {
  const pieces: string[] = []
  // The base is how readily this kind of offence is pinned on anybody — a
  // burglary at night leaves less than a fight in front of forty people,
  // and the catalogue already says which is which.
  let strength = Math.floor(offence.clearance / 2)

  const own: WorldEvent[] = []
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event) continue
    if (tick - event.tick > 3) break
    if (event.subjectId === personId) own.push(event)
  }

  if (own.some((e) => e.type === 'was-arrested')) {
    strength += 120
    pieces.push('the arrest itself, made within the month')
  }

  // A victim who is alive can testify; one who is not cannot. That cuts
  // both ways, which is exactly why it has to be read rather than assumed.
  const assault = own.find((e) => e.type === 'was-assaulted' || e.type === 'committed-offence')
  const victimId = assault?.otherId ?? null
  if (victimId !== null) {
    const victim = world.people.get(victimId)
    if (victim && victim.deathTick === null) {
      strength += 200
      pieces.push('the victim, alive and willing to testify')
    } else if (victim) {
      strength += 60
      pieces.push('a victim who cannot be called')
    }
  }
  if (offence.violent === true) {
    strength += 90
    pieces.push('the weapon, and what it did')
  }
  if (offence.takesFromHousehold === true) {
    strength += 70
    pieces.push('the property, recovered')
  }
  const priors =
    world.criminal.get(personId)?.convictions.filter((c) => c.sealed !== true).length ?? 0
  if (priors > 0) {
    strength += Math.min(180, priors * 60)
    pieces.push(`a record the jury will hear about — ${String(priors)} prior${priors === 1 ? '' : 's'}`)
  }
  if (pieces.length === 0) pieces.push('very little: no witness, no property, nobody who saw it')

  return { strength: Math.max(50, Math.min(950, strength)), pieces }
}

export function sceneFor(stage: TrialStage, offence: Offence, evidence: Evidence): TrialScene {
  switch (stage) {
    case 'counsel':
      return {
        stage,
        tell: `You have pleaded not guilty to ${offence.title}. Before anything else: who stands up for you.`,
        options: [
          { id: 'hire-attorney', label: 'Hire an attorney', says: 'hired an attorney' },
          {
            id: 'public-defender',
            label: 'Take the public defender',
            says: 'took the public defender',
          },
          { id: 'self-represent', label: 'Represent yourself', says: 'represented themselves' },
        ],
      }
    case 'state':
      return {
        stage,
        tell: `The state lays out what it has: ${evidence.pieces.join('; ')}.`,
        options: [
          {
            id: 'challenge-the-weak-point',
            label: 'Challenge the weakest piece',
            says: 'challenged the weakest piece of the case',
          },
          { id: 'let-it-stand', label: 'Let it stand', says: 'let the case stand unchallenged' },
          { id: 'object-hard', label: 'Object to all of it', says: 'objected to all of it' },
        ],
      }
    case 'defense':
      return {
        stage,
        tell: 'Your side. The jury has heard the state; what they hear next is yours to decide.',
        options: [
          { id: 'take-the-stand', label: 'Take the stand', says: 'took the stand' },
          { id: 'let-counsel-argue', label: 'Let counsel argue it', says: 'let counsel argue it' },
          { id: 'stay-silent', label: 'Stay silent', says: 'stayed silent' },
        ],
      }
    case 'closing':
      return {
        stage,
        tell: 'Closing. The last thing they hear before they go out.',
        options: [
          {
            id: 'reasonable-doubt',
            label: 'Argue reasonable doubt',
            says: 'argued reasonable doubt',
          },
          {
            id: 'appeal-for-sympathy',
            label: 'Appeal for sympathy',
            says: 'appealed to the jury for sympathy',
          },
          { id: 'stand-on-the-facts', label: 'Stand on the facts', says: 'stood on the facts' },
        ],
      }
    default:
      return {
        stage: 'verdict',
        tell: 'The jury files back in. Nobody looks at you.',
        options: [{ id: 'hear-it', label: 'Hear the verdict', says: 'heard the verdict' }],
      }
  }
}

/** The case's state travels on the pending's one string. */
export function encodeCase(
  offenceId: string,
  stage: TrialStage,
  defence: number,
  sympathy: number,
  taken: number,
): string {
  return `${offenceId}|${stage}|${String(defence)}|${String(sympathy)}|${String(taken)}`
}

export function decodeCase(encoded: string | null): {
  offenceId: string
  stage: TrialStage
  defence: number
  sympathy: number
  taken: number
} {
  const parts = (encoded ?? '').split('|')
  const stage = (parts[1] ?? 'counsel') as TrialStage
  return {
    offenceId: parts[0] ?? '',
    stage:
      stage === 'state' || stage === 'defense' || stage === 'closing' || stage === 'verdict'
        ? stage
        : 'counsel',
    defence: Number(parts[2] ?? '0'),
    sympathy: Number(parts[3] ?? '0'),
    taken: Number(parts[4] ?? '0'),
  }
}

/** The stage after this one, or null when the case is over. */
export function nextStage(stage: TrialStage): TrialStage | null {
  if (stage === 'counsel') return 'state'
  if (stage === 'state') return 'defense'
  if (stage === 'defense') return 'closing'
  if (stage === 'closing') return 'verdict'
  return null
}

/**
 * Whether the jury acquits: what the defence bought, against what the state
 * actually had. Floored at both ends, so no case is unwinnable and none is
 * a formality.
 */
export function acquits(
  evidence: Evidence,
  defence: number,
  rng: { chance: (n: number, d: number) => boolean },
): boolean {
  const odds = Math.max(40, Math.min(880, 500 - evidence.strength + defence))
  return rng.chance(odds, 1_000)
}
