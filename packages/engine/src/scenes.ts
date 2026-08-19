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
import { MOS_SCENES } from './mosscenes.js'
import type { CombatScene, SceneChoice, Threat } from './types.js'

/** How bad the moment is. Rolled hidden, then told to the player. */
export type { Threat, SceneChoice, CombatScene } from './types.js'

/** The three answers, in the order they are offered. */
export const SCENE_OPTIONS: readonly SceneChoice[] = ['push', 'hold', 'cover']

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
 * TIER 1 — pure combat. No new systems, no other people required: these can
 * fire for anybody in contact, which is why they are the ones that ship
 * first (the owner's build order).
 */
const CORE_SCENES: readonly CombatScene[] = [
  {
    id: 'pinned',
    tags: ['combat_firefight'],
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
    tags: ['combat_convoy_ambush', 'combat_patrol_ied'],
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
    tags: ['base_defense'],
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
    tags: ['combat_breach'],
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
  // TRADE SCENES (M-ENLIST §5b). Non-unit, anybody's-rank moments for the
  // jobs that were only ever getting a rifleman's day.
  //
  // Phase 1 made twenty-two real trades out of eight; this is the other
  // half of that. A medic in a firefight is not deciding whether to charge
  // a position — he is deciding who he can reach — and until these existed
  // the scene text said he was.
  // -------------------------------------------------------------------------
  {
    // The medic's moment. The same spectrum, but what it costs is the man
    // on the ground rather than the ground itself.
    id: 'treat-under-fire',
    tags: ['med_treat_under_fire', 'combat_rescue', 'med_masscas'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Somebody is down twenty metres out and calling for you. The fire is high and sporadic.',
      heavy: 'He is in the open and he has stopped shouting. Whatever hit him is still shooting.',
      overrun: 'There are three of them down between you and the wire, and the position is about to be on top of all of you.',
    },
    labels: {
      push: 'Go to him now',
      hold: 'Work from cover and drag him back',
      cover: 'Wait for the fire to lift',
    },
    did: {
      push: 'crossed open ground to reach a casualty under fire',
      hold: 'worked from cover and pulled the casualty back',
      cover: 'held until the fire lifted before treating the casualty',
    },
    unitId: null,
    biasToward: null,
  },
  {
    // The signaller's. Nothing here is a rifle problem: the platoon is
    // deaf, and the antenna is the highest thing on the position.
    id: 'the-net-is-down',
    tags: ['comms_blackout', 'cyber_incident', 'ops_center_crisis'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The net has gone scratchy. It is probably the antenna, and the antenna is on the roof.',
      heavy: 'The company net is dead and the relay is fifty metres away across ground somebody is watching.',
      overrun: 'Nobody outside this position knows what is happening here, and the only thing that can tell them is on the roof.',
    },
    labels: {
      push: 'Go up and fix the antenna',
      hold: 'Work the backup from here',
      cover: 'Send it by runner',
    },
    did: {
      push: 'went up to the antenna to restore the net',
      hold: 'brought the backup net up from cover',
      cover: 'sent the traffic by runner instead',
    },
    unitId: null,
    biasToward: null,
  },
  {
    // The mechanic's, and the closest to what most of the trade jobs
    // actually are: something broken, somewhere it should not be broken.
    id: 'dead-track',
    tags: ['work_critical_repair', 'work_maint_fault', 'munitions_mishap'],
    channels: ['convoy-exposure', 'direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The vehicle has thrown a track short of the wire. The road is quiet and there is daylight left.',
      heavy: 'It is down in the open with the column stopped behind it, and stopped columns get shot at.',
      overrun: 'It is dead where it sits, the fire has started, and the crew are still inside it.',
    },
    labels: {
      push: 'Get out and fix it',
      hold: 'Rig a tow and drag it clear',
      cover: 'Strip it and burn it',
    },
    did: {
      push: 'repaired the vehicle where it stood',
      hold: 'rigged a tow and pulled the vehicle clear',
      cover: 'stripped the vehicle and destroyed it in place',
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
    tags: ['combat_firefight', 'combat_breach'],
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
    tags: ['combat_firefight', 'base_defense'],
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
    tags: ['combat_firefight'],
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
    tags: ['combat_firefight', 'sea_smallboat_attack'],
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
    tags: ['sea_smallboat_attack', 'combat_breach'],
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
    tags: ['sea_smallboat_attack', 'sea_manoverboard'],
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
    tags: ['combat_rescue', 'air_hardlanding'],
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
    tags: ['combat_rescue', 'med_treat_under_fire'],
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
    tags: ['combat_firefight'],
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
    tags: ['combat_breach', 'combat_firefight'],
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

  // -------------------------------------------------------------------------
  // OFFICER MOMENTS (M-ENLIST §5c, written out in full by the owner). The
  // same three-option spectrum, but the decision belongs to somebody whose
  // answer moves other people — which is the difference between being in a
  // firefight and running one.
  //
  // Written to the same hard line as everything else here: sober, never
  // graphic, never triumphal. A platoon leader's worst day is not an action
  // sequence.
  // -------------------------------------------------------------------------
  {
    // "THE CALL." The platoon is in contact and the radio is asking the
    // lieutenant what the platoon is going to do about it. Every answer is
    // defensible; that is the point of putting it on one man.
    id: 'the-call',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    officersOnly: true,
    tell: {
      light: 'First squad is taking fire from a treeline and has gone to ground. Nobody is hurt. Your platoon sergeant is on the net waiting for you to say something.',
      heavy: 'Two squads are pinned in the open and the fire is coming from a position nobody has eyes on. The net has gone quiet, and everybody on it is waiting for you.',
      overrun: 'First squad has casualties, the enemy is closer than the map says, and your platoon sergeant is asking for a decision in a voice you have not heard him use before.',
    },
    labels: {
      push: 'Send second squad around the flank',
      hold: 'Suppress and work it out from here',
      cover: 'Pull back to the last covered position',
    },
    did: {
      push: 'sent a squad around the flank while the platoon was in contact',
      hold: 'held the platoon in place and fought it out on the guns',
      cover: 'pulled the platoon back to cover under fire',
    },
    unitId: null,
    biasToward: null,
  },
  {
    // "ENGINE OUT." Not enemy contact at all — but it kills people, and the
    // three answers are a real spectrum of how much aircraft you are
    // willing to gamble to keep it. A pilot's job, and only a pilot's.
    id: 'engine-out',
    tags: ['air_emergency_landing', 'air_crash'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    officersOnly: true,
    tell: {
      light: 'A caution light and a rough note in the number two. You have altitude, you have a field in sight, and you have time to think.',
      heavy: 'Number two is gone and number one is not happy about carrying the load. The nearest strip is further away than you would like.',
      overrun: 'Both are out. You are a glider now, the ground is coming up, and there is no version of this that ends on a runway.',
    },
    labels: {
      push: 'Try the restart',
      hold: 'Deadstick it in',
      cover: 'Get everyone out',
    },
    did: {
      push: 'stayed with the aircraft and ran the restart',
      hold: 'brought the aircraft down without power',
      cover: 'got the crew out and let the aircraft go',
    },
    unitId: null,
    biasToward: 'heavy',
  },
]

/** The scene anything unrecognized falls back to. */
const FALLBACK_SCENE_ID = 'pinned'

/**
 * THE WHOLE CATALOGUE — the original nineteen plus the per-role pools.
 *
 * MEASURED BEFORE THIS EXISTED: a medic's entire war was two scenes,
 * alternating, one of which was the infantry scene they share. The gating
 * was working; there was simply nothing on the other side of it. Nineteen
 * scenes were carrying forty-eight specialties.
 */
export const COMBAT_SCENES: readonly CombatScene[] = [...CORE_SCENES, ...MOS_SCENES]

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
  /** M-ENLIST §5b. The trade's own scene tags — see `CombatScene.tags`. */
  tags: readonly string[] = [],
  /** M-ENLIST §5c. Command moments are only offered to people in command. */
  isOfficer = false,
  /**
   * Scene ids this person has just been through, MOST RECENT FIRST. Empty is
   * a legitimate answer (a first tour, or a caller that does not track it)
   * and simply means nothing is suppressed.
   */
  recent: readonly string[] = [],
  /**
   * The trade this person actually holds. Scenes that name their owners are
   * offered only to the trades they name — see `CombatScene.specialtyIds`.
   */
  specialtyId: string | null = null,
): CombatScene | undefined {
  const rankOk = COMBAT_SCENES.filter((scene) => isOfficer || scene.officersOnly !== true)

  /**
   * OWNED SCENES FIRST, AND EXCLUSIVELY.
   *
   * A scene that names its trades is offered to those trades and to nobody
   * else, and where a trade has its own scenes it gets ONLY those. This is
   * the owner's separation rule made structural: an infantry problem is not
   * a storeman's problem however similar the situation looked to the tags.
   */
  const eligible = rankOk.filter(
    (scene) =>
      scene.specialtyIds === undefined ||
      (specialtyId !== null && scene.specialtyIds.includes(specialtyId)),
  )
  const ownedByTrade = eligible.filter((scene) => scene.specialtyIds !== undefined)
  if (ownedByTrade.length > 0) {
    const byChannel = ownedByTrade.filter((scene) => scene.channels.includes(channel))
    const fromTrade = byChannel.length > 0 ? byChannel : ownedByTrade
    const tradeWeights = fromTrade.map((scene) => {
      const seen = recent.indexOf(scene.id)
      return seen === 0 ? 1 : seen > 0 ? 4 : 24
    })
    return rng.pickWeighted(fromTrade, tradeWeights)
  }

  /**
   * THE JOB DECIDES WHAT YOU SEE. OWNER'S RULING, 2026-08-18: "I don't want
   * the special groups to get the same popups as logistics guys."
   *
   * A first attempt at his repetition complaint turned these filters into
   * weights so that a Pathfinder could occasionally draw a general scene.
   * That was the wrong answer to the right complaint: it made every MOS
   * blend into every other, which is precisely what he does not want. The
   * separation is the POINT — a logistics sergeant and a combat swimmer are
   * not having the same war — and the cure for repetition is DEPTH inside
   * each pool, not leakage between them.
   *
   * So the gates are gates again: your unit's scenes if your unit has any,
   * then the channel, then your own trade's tags. What changed permanently
   * is the last step below.
   */
  const unitScenes = eligible.filter((scene) => scene.unitId !== null && scene.unitId === unitId)
  const pool = unitScenes.length > 0 ? unitScenes : eligible.filter((scene) => scene.unitId === null)
  const matching = pool.filter((scene) => scene.channels.includes(channel))
  const choices = matching.length > 0 ? matching : pool
  if (choices.length === 0) return undefined
  const own = choices.filter((scene) => scene.tags.some((tag) => tags.includes(tag)))
  const finalPool = own.length > 0 ? own : choices

  /**
   * AND NOT THE ONE YOU JUST HAD.
   *
   * Within the right pool, an immediate repeat is still what reads as "it is
   * always the same". Recent scenes are pushed far down rather than removed:
   * a pool can be small, and a scene that can never recur is its own kind of
   * wrong — a man can be ambushed on the same road twice.
   */
  const weights = finalPool.map((scene) => {
    const seen = recent.indexOf(scene.id)
    if (seen === 0) return 1
    if (seen > 0) return 4
    return 24
  })
  return rng.pickWeighted(finalPool, weights)
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

// ---------------------------------------------------------------------------
// UNIT MOMENTS (owner's combat plan §4a) — the shared cutscenes.
//
// THESE ARE NOT COMBAT SCENES, and that is the whole design call. A combat
// scene ends in `resolveMomentCasualty`, which is the ENEMY CONTACT
// resolver: it carries a firefight's fatal tail because a firefight is what
// it models. Reusing it here would put a rifle round in a moment where
// nobody is shooting — a man deciding whether to drop a packet, or standing
// at a ramp ceremony for somebody he served with.
//
// So they share the three-option SHAPE (the player has one spectrum to
// learn, not six) and nothing else. What each one costs is its own.
// ---------------------------------------------------------------------------

/** Which cutscene this is; the id travels on the pending. */
export type UnitMomentId =
  | 'packet-drop'
  | 'selection-day'
  | 'reporting-in'
  | 'losing-one'
  | 'the-old-hand'

export interface UnitMoment {
  readonly id: UnitMomentId
  /** What the player is told. No threat level: these are not contacts. */
  readonly tell: string
  readonly labels: Readonly<Record<SceneChoice, string>>
  readonly did: Readonly<Record<SceneChoice, string>>
}

export const UNIT_MOMENTS: readonly UnitMoment[] = [
  {
    id: 'packet-drop',
    tell:
      'The selection course opens next cycle, and your name would be taken seriously. Dropping a packet is a commitment before it is anything else.',
    labels: {
      push: 'Drop the packet now',
      hold: 'Train one more cycle first',
      cover: 'Stay in your line unit',
    },
    did: {
      push: 'dropped a packet for selection',
      hold: 'trained another cycle before putting a packet in',
      cover: 'stayed in the line unit',
    },
  },
  {
    id: 'selection-day',
    tell:
      'Selection. Nobody is shooting at anybody here — the course is the thing that beats people, and most of the ones who leave walk out on their own.',
    labels: {
      push: 'Empty the tank',
      hold: 'Pace yourself',
      cover: 'Protect the injury',
    },
    did: {
      push: 'emptied the tank at selection',
      hold: 'paced themselves through selection',
      cover: 'nursed an injury through selection',
    },
  },
  {
    id: 'reporting-in',
    tell:
      'First day in the team room. Nobody here is impressed by anything you did to get in, and they are all watching how you carry it.',
    labels: {
      push: 'Prove yourself loudly',
      hold: 'Head down, learn the standard',
      cover: 'Fall back on what worked before',
    },
    did: {
      push: 'came in loud and made a point of it',
      hold: 'kept their head down and learned the standard',
      cover: 'stuck to what had worked before',
    },
  },
  {
    id: 'losing-one',
    tell:
      'One of the team is going home in an aircraft, and the ramp ceremony is this evening. Nobody will think less of you whatever you do with it.',
    labels: {
      push: 'Speak at the ramp ceremony',
      hold: 'Carry it quietly',
      cover: 'Ask for a stand-down',
    },
    did: {
      push: 'spoke at the ramp ceremony',
      hold: 'carried it quietly',
      cover: 'took a stand-down after losing one of the team',
    },
  },
  {
    id: 'the-old-hand',
    tell:
      'You have been here long enough to be one of the ones they watch. A new selection class comes through next month.',
    labels: {
      push: 'Take the class yourself',
      hold: 'Take one of them under your wing',
      cover: 'Leave them to the cadre',
    },
    did: {
      push: 'ran the new selection class',
      hold: 'took one of the new arrivals under their wing',
      cover: 'left the new class to the cadre',
    },
  },
]

export function unitMomentById(id: string): UnitMoment | undefined {
  return UNIT_MOMENTS.find((moment) => moment.id === id)
}
