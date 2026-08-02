/**
 * Combat scenes — the three-option, severity-driven moment.
 * Owner's combat plan §2, 2026-08-02.
 *
 * A combat moment used to be one scene with two answers: go forward or keep
 * down. This is the same idea widened until it is a real decision.
 *
 *   1. The month rolls a hidden THREAT LEVEL — light, heavy or overrun.
 *   2. THE SCENE TEXT TELLS THE PLAYER WHICH. That is the whole design: it
 *      is a read, not a coin flip, and Law 3 means the record can say what
 *      the moment actually was.
 *   3. The player answers along one spectrum: PUSH, HOLD, COVER.
 *   4. The outcome is the cell where the answer meets the threat.
 *
 * The diagonal is the smart play — push the light, cover the overrun, hold
 * when unsure — but nothing is safe: EVERY CELL KEEPS THE FATAL TAIL, which
 * is the invariant the whole system hangs on. The bravest act in the game
 * must not be the only one that can kill you, and the most careful one must
 * not be the only one that cannot.
 */

import type { EntityId } from '@life-engine/shared'
import type { Rng } from './rng.js'

/** How bad the moment is. Rolled hidden, then told to the player. */
export type Threat = 'light' | 'heavy' | 'overrun'

/** The spectrum, in the order it is offered. */
export type SceneChoice = 'push' | 'hold' | 'cover'

export const SCENE_OPTIONS: readonly SceneChoice[] = ['push', 'hold', 'cover']

/**
 * What a cell of the matrix does: the odds the month goes wrong, how bad it
 * is when it does, and the chance the act is written up for a decoration.
 *
 * `valorInN` of 0 means no valor is possible from that cell — holding a
 * light contact is doing your job, not gallantry.
 */
export interface SceneOutcome {
  readonly gate: number
  readonly severityFloor: number
  readonly valorInN: number
}

/**
 * THE MATRIX (owner's plan §2), exactly as specified.
 *
 * Read it down a column and the cost of caution is visible; read it across a
 * row and the cost of the moment is. Push into an overrun is the most
 * dangerous thing in the game and the likeliest to be decorated, which is
 * the trade the whole scene exists to offer.
 */
const MATRIX: Readonly<Record<SceneChoice, Readonly<Record<Threat, SceneOutcome>>>> = {
  push: {
    light: { gate: 300, severityFloor: 400, valorInN: 6 },
    heavy: { gate: 500, severityFloor: 520, valorInN: 3 },
    overrun: { gate: 750, severityFloor: 650, valorInN: 2 },
  },
  hold: {
    light: { gate: 220, severityFloor: 350, valorInN: 0 },
    heavy: { gate: 380, severityFloor: 450, valorInN: 0 },
    overrun: { gate: 560, severityFloor: 560, valorInN: 8 },
  },
  cover: {
    light: { gate: 120, severityFloor: 300, valorInN: 0 },
    heavy: { gate: 250, severityFloor: 380, valorInN: 0 },
    overrun: { gate: 420, severityFloor: 500, valorInN: 0 },
  },
}

export function outcomeFor(choice: SceneChoice, threat: Threat): SceneOutcome {
  return MATRIX[choice][threat]
}

/**
 * One scene: the situation, and what the three answers are CALLED in it.
 *
 * Only the flavour changes between scenes — the spectrum underneath is
 * always the same, which is what keeps a fourteen-scene catalogue from
 * becoming fourteen sets of rules nobody can hold in their head.
 */
export interface CombatScene {
  readonly id: string
  /** Which trade or situation it belongs to; empty means anyone, anywhere. */
  readonly channels: readonly string[]
  /** What the player is told, by threat level — the read. */
  readonly tell: Readonly<Record<Threat, string>>
  /** What each answer is called here. */
  readonly labels: Readonly<Record<SceneChoice, string>>
  /** What the record says they did. */
  readonly did: Readonly<Record<SceneChoice, string>>
  /** Serving in this unit only, or null for anyone. */
  readonly unitId: string | null
  /** Units take the sharper jobs: bias the threat roll upward. */
  readonly biasToward: Threat | null
}

/**
 * TIER 1 — pure combat. No new systems, no other people required: these can
 * fire for anybody in contact, which is why they are the ones that ship
 * first (the owner's build order).
 */
export const COMBAT_SCENES: readonly CombatScene[] = [
  {
    id: 'pinned',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A few rounds crack overhead — harassing fire. The squad is still moving.',
      heavy: 'The fire is steady and aimed. You are pinned; nobody moves without drawing it.',
      overrun: 'They are close and closing. The line beside you is about to break.',
    },
    labels: {
      push: 'Charge the position',
      hold: 'Return fire',
      cover: 'Get down and wait him out',
    },
    did: {
      push: 'charged the position under fire',
      hold: 'stayed up and returned fire',
      cover: 'got down and waited it out',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'convoy-ambush',
    channels: ['convoy-exposure'],
    tell: {
      light: 'A single blast behind the lead truck. The column is still rolling.',
      heavy: 'The lead vehicle is stopped and burning, and the fire is coming from both sides of the road.',
      overrun: 'The road is blocked front and back and the shooting is close enough to hear voices.',
    },
    labels: {
      push: 'Drive through it',
      hold: 'Stop and fight',
      cover: 'Dismount into the ditch',
    },
    did: {
      push: 'drove the column through the ambush',
      hold: 'stopped the column and fought it out',
      cover: 'took the ditch and returned fire from cover',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'base-attack',
    channels: ['base-attack-exposure'],
    tell: {
      light: 'A few rounds come in somewhere across the camp. The alarm goes anyway.',
      heavy: 'Rounds are landing inside the wire and the alarm has not stopped.',
      overrun: 'They are through the wire on the far side and the camp is awake and shooting.',
    },
    labels: {
      push: 'Man the wire',
      hold: 'Hold your sector',
      cover: 'Get to the bunker',
    },
    did: {
      push: 'went to the wire while it was still coming in',
      hold: 'held their sector through the attack',
      cover: 'took the bunker and waited it out',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'the-breach',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The door is closed and the house is quiet. It is probably nothing.',
      heavy: 'There is movement inside and the stack is waiting on somebody.',
      overrun: 'They know you are here and the first man through is going to find out how much.',
    },
    labels: {
      push: 'Take the door',
      hold: 'Cover the stack',
      cover: 'Pull security outside',
    },
    did: {
      push: 'took the door first',
      hold: 'covered the stack through the breach',
      cover: 'held security on the outside',
    },
    unitId: null,
    biasToward: null,
  },
]

/** The scene anything unrecognized falls back to. */
const FALLBACK_SCENE_ID = 'pinned'

export function sceneById(id: string): CombatScene | undefined {
  return COMBAT_SCENES.find((scene) => scene.id === id)
}

/**
 * Pick the scene for a contact. Driven by the CHANNEL that found them — the
 * threat vector already decided whether this was a road, a wire or a
 * doorway, so the scene follows the world rather than a separate draw.
 *
 * A unit's scenes are preferred while its members are serving in it, which
 * is what makes a unit feel like somewhere you are rather than a line on a
 * record.
 */
export function pickScene(
  channel: string,
  unitId: string | null,
  rng: Rng,
): CombatScene | undefined {
  const unitScenes = COMBAT_SCENES.filter((scene) => scene.unitId !== null && scene.unitId === unitId)
  const pool = unitScenes.length > 0 ? unitScenes : COMBAT_SCENES.filter((scene) => scene.unitId === null)
  const matching = pool.filter((scene) => scene.channels.includes(channel))
  const choices = matching.length > 0 ? matching : pool
  if (choices.length === 0) return undefined
  return choices[rng.nextInt(0, choices.length)]
}

/**
 * How bad this one is. Rolled from the war's own state — a stronger enemy
 * and a hotter phase produce worse moments — rather than from nothing, so
 * "overrun" means the war is going badly and not that a die came up.
 *
 * A unit scene biases upward: they take the sharpest jobs, which is why
 * both the danger and the valor run high there.
 */
export function rollThreat(contactWeight: number, bias: Threat | null, rng: Rng): Threat {
  // contactWeight is the channel's own per-mille weight for this month.
  const pressure = Math.min(900, contactWeight) + (bias === 'overrun' ? 300 : bias === 'heavy' ? 150 : 0)
  const draw = rng.nextInt(0, 1000) + Math.floor(pressure / 3)
  if (draw >= 780) return 'overrun'
  if (draw >= 420) return 'heavy'
  return 'light'
}

/** The scene id and threat travel on the pending, encoded in one field. */
export function encodeScene(sceneId: string, threat: Threat): string {
  return `${sceneId}:${threat}`
}

export function decodeScene(detail: string | null): { sceneId: string; threat: Threat } {
  // Defaults have to be applied to EMPTY, not only to absent: ''.split(':')
  // is [''], so a destructuring default never fires and the id comes back
  // as the empty string. A pending written before scenes existed decodes
  // through here, and it has to land on a real scene.
  const [rawId, rawThreat] = (detail ?? '').split(':')
  const sceneId = rawId !== undefined && rawId.length > 0 ? rawId : FALLBACK_SCENE_ID
  const threat: Threat =
    rawThreat === 'light' || rawThreat === 'overrun' || rawThreat === 'heavy' ? rawThreat : 'heavy'
  return { sceneId, threat }
}

/** Everything a caller needs to render or resolve a raised scene. */
export interface RaisedScene {
  readonly scene: CombatScene
  readonly threat: Threat
  readonly enemyId: EntityId | null
}
