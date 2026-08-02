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

  // -------------------------------------------------------------------------
  // UNIT SCENES (owner's combat plan §4). These raise only while the person
  // is serving in that unit, and they lean heavy or overrun — the unit takes
  // the sharpest jobs, which is why both the danger and the valor run high
  // there. The spectrum underneath is the same three answers; what changes
  // is what they are called and what they cost.
  //
  // Sober, non-graphic, and never triumphal (Law 10). These are people at
  // work in the worst job there is.
  // -------------------------------------------------------------------------

  // --- the Pathfinder Battalion: raids, airfields, landing zones -----------
  {
    id: 'airfield-seizure',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The strip is dark and the guards are somewhere else. It might stay that way.',
      heavy: 'There is fire from the tower end and the runway is a very open place to be.',
      overrun: 'The whole far side is awake and the birds are inbound regardless.',
    },
    labels: {
      push: 'Lead the assault onto the runway',
      hold: 'Hold support-by-fire',
      cover: 'Set the perimeter security',
    },
    did: {
      push: 'led the assault onto the runway',
      hold: 'held the support-by-fire position',
      cover: 'set security on the perimeter',
    },
    unitId: 'pathfinders',
    biasToward: 'overrun',
  },
  {
    id: 'mark-the-lz',
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The field is quiet. Marking it is a two-minute job.',
      heavy: 'The field is being watched, and smoke tells them exactly where to look.',
      overrun: 'They are already firing onto the field and the flight is three minutes out.',
    },
    labels: {
      push: 'Pop smoke in the open',
      hold: 'Mark it from cover',
      cover: 'Wave the birds off',
    },
    did: {
      push: 'marked the landing zone from the open',
      hold: 'marked the landing zone from cover',
      cover: 'waved the flight off the landing zone',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'hold-the-block',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Something is moving toward the blocking position, unhurried.',
      heavy: 'They are trying to get past you and they have worked out where you are.',
      overrun: 'They are coming through in numbers and the rally point is a long way back.',
    },
    labels: {
      push: 'Push out to meet them',
      hold: 'Hold the blocking position',
      cover: 'Collapse back to the rally point',
    },
    did: {
      push: 'pushed out to meet them',
      hold: 'held the blocking position',
      cover: 'collapsed back to the rally point',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },

  // --- the Trident Detachment: maritime, dive, boarding --------------------
  {
    id: 'over-the-beach',
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The swim was long and the beach is empty. So far this is just cold.',
      heavy: 'There are lights moving on the beach and the team is still in the water.',
      overrun: 'The approach is blown, the surf is bad, and there is nowhere on that beach to be.',
    },
    labels: {
      push: 'Press to the objective',
      hold: 'Hold in the surf and reassess',
      cover: 'Abort back to the water',
    },
    did: {
      push: 'pressed inland from the beach',
      hold: 'held in the surf until it was clear',
      cover: 'aborted back into the water',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'ship-takedown',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The deck is dark and nobody is looking over the side.',
      heavy: 'There is movement on deck and the ladder puts you in the open for all of it.',
      overrun: 'They know, they are waiting at the rail, and the ladder is the only way up.',
    },
    labels: {
      push: 'First up the ladder',
      hold: 'Cover from the boat',
      cover: 'Hold the boarding stack',
    },
    did: {
      push: 'went first up the caving ladder',
      hold: 'covered the boarding from the boat',
      cover: 'held in the boarding stack',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'last-swimmer-out',
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'Everyone is accounted for and the water is fifty metres away.',
      heavy: 'The last two are still coming and there is fire on the treeline behind them.',
      overrun: 'They are on the beach with you and the water is the only way out for anybody.',
    },
    labels: {
      push: 'Hold the beach until everyone is in the water',
      hold: 'Bound back by pairs',
      cover: 'Go now',
    },
    did: {
      push: 'held the beach until the last man was in the water',
      hold: 'bounded back to the water by pairs',
      cover: 'went into the water first',
    },
    unitId: 'trident',
    biasToward: 'overrun',
  },

  // --- the Guardian Flight: combat rescue ----------------------------------
  {
    id: 'reach-the-downed',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The wreck is close and the field is quiet. This should be quick.',
      heavy: 'There is fire across the open ground between you and the wreck.',
      overrun: 'They are closing on the wreck too, and whoever gets there first keeps him.',
    },
    labels: {
      push: 'Sprint to the wreck',
      hold: 'Bound forward with cover',
      cover: 'Direct the bird to a safer landing zone',
    },
    did: {
      push: 'ran to the wreck across open ground',
      hold: 'bounded to the wreck under cover',
      cover: 'moved the pickup to safer ground',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'hoist-under-fire',
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The hoist is turning and nothing is coming up at you yet.',
      heavy: 'Rounds are coming past the aircraft and the cable is only half in.',
      overrun: 'The aircraft is being hit and the man on the cable is halfway to the door.',
    },
    labels: {
      push: 'Stay exposed and finish the hoist',
      hold: 'Drop and re-approach',
      cover: 'Wave off and try again',
    },
    did: {
      push: 'stayed on the hoist until it was finished',
      hold: 'dropped the cable and came back around',
      cover: 'waved off the recovery',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },

  // --- the Grey Section: precise, deniable, and quiet about it -------------
  {
    id: 'compromised-on-infil',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody saw the team go past. They kept walking.',
      heavy: 'A herdsman has seen all six of you and the objective is two hours away.',
      overrun: 'The alarm has gone up ahead of you and the ground behind is closing.',
    },
    labels: {
      push: 'Press on, fast',
      hold: 'Hold and wait them out',
      cover: 'Abort the mission',
    },
    did: {
      push: 'pressed on after the team was seen',
      hold: 'held in place until the ground was quiet',
      cover: 'aborted the infiltration',
    },
    unitId: 'grey-section',
    biasToward: 'heavy',
  },
  {
    id: 'the-quiet-job',
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The house is quiet and the team has time. Nobody outside knows you are here.',
      heavy: 'There are more of them inside than the picture showed, and time is running out.',
      overrun: 'It has gone loud, the whole street is awake, and the exfil is not where it should be.',
    },
    labels: {
      push: 'Finish it',
      hold: 'Take what you have and exfil clean',
      cover: 'Abort',
    },
    did: {
      push: 'finished the job',
      hold: 'took what the team had and left clean',
      cover: 'called the job off',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
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
