/**
 * THE WAR EACH JOB ACTUALLY SEES (owner's `combat_tours_revamp.md` §4, §4a).
 *
 * THE SPEC'S DIAGNOSIS WAS CLOSE AND NOT QUITE RIGHT, and the difference
 * decides what this file is. It reported that a 68W medic "never once got
 * a medic scene" and concluded scenes were not gated by MOS at all.
 *
 * MEASURED: gating works. A medic in a firefight draws the medic's scene
 * half the time and in a base attack every time. What was actually wrong
 * is that THE MEDIC'S POOL WAS TWO SCENES DEEP — one of which was the
 * infantry scene they happen to share — so a whole tour was those two,
 * alternating. The player's experience was exactly as reported; the cause
 * was depth, not wiring. Nineteen combat scenes were carrying forty-eight
 * specialties.
 *
 * So this file is not a fix to the selection. It is the missing pool: the
 * scenes that make a medic's war a medic's war, a driver's a driver's, and
 * a flight-line crew chief's something that has never involved a doorway.
 *
 * THE OWNER'S OVERRIDE (§10) applies here — this content is grim and
 * authentic on purpose. The one rule not overridden is determinism, and
 * nothing in this file draws a number: these are pure content, selected by
 * the seeded picker that already exists.
 */

import type { CombatScene } from './types.js'
import { RIFLEMAN_SCENES } from './mosrifleman.js'
import { PATHFINDER_SCENES, TRIDENT_SCENES } from './unitscenes.js'

/**
 * A NOTE ON TAGS, LEARNED BY MEASURING THIS FILE TWICE.
 *
 * The first version of these pools gave role scenes BROAD tags as well as
 * their own — a pilot's approach also carried `combat_rescue`, a
 * checkpoint also carried `combat_firefight`. It reads harmless and it is
 * not: those broad tags are held by half the roster, so a medic started
 * drawing aviation emergencies and checkpoint shootings, and the pools
 * leaked into exactly the undifferentiated soup this file exists to end.
 *
 * THE RULE: a role scene carries ONLY tags that role owns. Breadth belongs
 * on the generic scenes in `scenes.ts`, which are meant to reach everybody
 * — that is what they are for.
 */


/**
 * MEDICAL — the war where the enemy is time and the thing you can lose is
 * somebody else. Every scene here is a triage decision wearing different
 * clothes, because that is what the job is.
 */
const MEDICAL_SCENES: readonly CombatScene[] = [
  {
    id: 'two-casualties',
    tags: ['med_masscas', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Two of them are hit. One is shouting, which means he is breathing.',
      heavy: 'Two casualties, and you have one pair of hands. The quiet one is the bad one.',
      overrun: 'Four down, one of you, and the volume of fire says this is not going to let up so you can think about it.',
    },
    labels: {
      push: 'Work the quiet one',
      hold: 'Stop the bleeding you can see',
      cover: 'Get them both behind the wall first',
    },
    did: {
      push: 'went to the silent casualty first',
      hold: 'controlled the visible haemorrhage first',
      cover: 'moved both casualties to cover before treating either',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'the-one-you-lose',
    tags: ['med_masscas', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'He is grey and his pulse is going and there is nothing obviously wrong with him.',
      heavy: 'You have done everything you carry and he is still going. The bird is eleven minutes out.',
      overrun: 'He is not going to make eleven minutes and you both know it, and there are two more behind him.',
    },
    labels: {
      push: 'Keep working him',
      hold: 'Make him comfortable and move on',
      cover: 'Call it and go to the others',
    },
    did: {
      push: 'worked a dying man past the point of hope',
      hold: 'stayed with a dying man and treated the others after',
      cover: 'triaged a man as expectant and moved to the living',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'the-nine-line',
    tags: ['med_treat_under_fire', 'med_masscas'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'You need a bird. The LZ is a field two hundred metres back and nobody has cleared it.',
      heavy: 'The nine-line is in and they want to know if the LZ is hot. It is, and if you say so they may not come.',
      overrun: 'They will not land in this. Somebody has to decide whether to carry him out to where they will.',
    },
    labels: {
      push: 'Call it cold and get them in',
      hold: 'Report it honestly and wait',
      cover: 'Carry him to a colder LZ',
    },
    did: {
      push: 'called an LZ cold to get a bird in',
      hold: 'reported the LZ hot and waited for the escort',
      cover: 'carried a casualty to a colder landing zone',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * TRANSPORT AND CONVOY — the war that happens to you while you are trying
 * to get somewhere. A driver does not choose the ground.
 */
const TRANSPORT_SCENES: readonly CombatScene[] = [
  {
    id: 'the-strike',
    tags: ['combat_convoy_ambush', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'road-exposure'],
    tell: {
      light: 'A pressure plate goes under the lead truck. Nobody is hurt and everybody has stopped, which is the danger.',
      heavy: 'The third vehicle is on its side and burning and the convoy is strung out across four hundred metres of road.',
      overrun: 'The strike was the start of it. There is fire from the treeline and the road behind you has just gone up as well.',
    },
    labels: {
      push: 'Push the convoy out of the kill zone',
      hold: 'Stop and fight from the vehicles',
      cover: 'Get the wounded out and dismount',
    },
    did: {
      push: 'drove the convoy out through the ambush',
      hold: 'halted and fought the ambush from the trucks',
      cover: 'dismounted the convoy and recovered the wounded',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'the-recovery',
    tags: ['combat_convoy_ambush'],
    channels: ['direct-combat-exposure', 'road-exposure'],
    tell: {
      light: 'A truck has thrown a track a kilometre short of the wire. It is recoverable and it is getting dark.',
      heavy: 'The vehicle is disabled in the open and the recovery will take forty minutes somebody is watching.',
      overrun: 'They are shooting at the casualty vehicle to keep you coming to it, and everybody here knows it.',
    },
    labels: {
      push: 'Hook it up and tow it out',
      hold: 'Strip it and destroy what is left',
      cover: 'Leave it and come back with more people',
    },
    did: {
      push: 'recovered a disabled vehicle under fire',
      hold: 'stripped and denied a disabled vehicle',
      cover: 'left a vehicle and returned in strength',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * ENGINEER AND EOD — the war where the ground itself is the enemy and
 * patience is the only skill that matters. The second device is the one
 * that gets people, and it is aimed at whoever comes to help.
 */
const ENGINEER_SCENES: readonly CombatScene[] = [
  {
    id: 'the-second-device',
    tags: ['munitions_mishap'],
    channels: ['direct-combat-exposure', 'road-exposure'],
    tell: {
      light: 'The device is exposed and it is old and somebody has been careless burying it.',
      heavy: 'It is command wire, which means somebody is holding the other end and watching you.',
      overrun: 'This one is a decoy. It is placed to be FOUND, which means the real one is under whoever comes to look at it.',
    },
    labels: {
      push: 'Approach and render it safe',
      hold: 'Blow it in place from here',
      cover: 'Clear everybody back and reroute',
    },
    did: {
      push: 'approached and rendered a device safe by hand',
      hold: 'destroyed a device in place',
      cover: 'cleared the route and moved the element around it',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'route-clearance',
    tags: ['munitions_mishap'],
    channels: ['direct-combat-exposure', 'road-exposure'],
    tell: {
      light: 'Nine kilometres of road and a convoy waiting on you. The ground is soft where it should not be.',
      heavy: 'Three finds in four kilometres. Whoever laid these had time and nobody stopped them.',
      overrun: 'The pattern says the whole stretch is seeded and the convoy behind you is already rolling.',
    },
    labels: {
      push: 'Keep clearing at speed',
      hold: 'Slow down and do it properly',
      cover: 'Halt the convoy and call for more assets',
    },
    did: {
      push: 'cleared a seeded route at speed to keep a convoy moving',
      hold: 'slowed the clearance and held a convoy for it',
      cover: 'halted a convoy and waited for clearance assets',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * AVIATION — the war fought from somewhere the enemy can reach and you
 * cannot stop. The decision is nearly always whether to go back in.
 */
const AVIATION_SCENES: readonly CombatScene[] = [
  {
    id: 'taking-fire-on-final',
    tags: ['air_hardlanding', 'air_emergency_landing'],
    channels: ['direct-combat-exposure', 'air-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Tracer well off the nose on short final. The LZ is still good.',
      heavy: 'You are taking rounds through the airframe on approach and there are people on the ground waiting on you.',
      overrun: 'The LZ is being overrun as you come in and the ones waiting are not going to last another orbit.',
    },
    labels: {
      push: 'Go in anyway',
      hold: 'One orbit and try again',
      cover: 'Wave off and find another LZ',
    },
    did: {
      push: 'landed into a hot LZ under fire',
      hold: 'orbited and made a second approach',
      cover: 'waved off and lifted from an alternate',
    },
    unitId: null,
    biasToward: null,
  },
  {
    // The medevac run. The aircraft is the only thing that can reach him
    // and it is also the only thing they want to hit.
    id: 'the-dust-off',
    tags: ['air_hardlanding', 'air_emergency_landing'],
    channels: ['air-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'A routine lift from a secured position. Twenty minutes each way and the weather is holding.',
      heavy: 'Urgent surgical, and the grid they have given you is four hundred metres from where the fighting is.',
      overrun: 'They are asking for a hoist over a position that is being overrun, at night, with the ceiling on the deck.',
    },
    labels: {
      push: 'Go, and go now',
      hold: 'Wait for the escort to marry up',
      cover: 'Hold until the ground clears the LZ',
    },
    did: {
      push: 'flew an unescorted medevac into a contested landing zone',
      hold: 'waited for escort before flying the medevac',
      cover: 'held the aircraft until the landing zone was cleared',
    },
    unitId: null,
    biasToward: null,
  },
  {
    // Low level, at night, in ground the map is not honest about.
    id: 'wires-and-weather',
    tags: ['air_crash', 'air_hardlanding'],
    channels: ['air-exposure'],
    tell: {
      light: 'The ceiling is coming down and the valley route is the quick way home.',
      heavy: 'You are below the ridgeline in cloud and the chart is older than the power lines under you.',
      overrun: 'There is nowhere to climb to, nowhere to turn to, and the aircraft behind is following your lights.',
    },
    labels: {
      push: 'Press on down the valley',
      hold: 'Climb into it and go on instruments',
      cover: 'Turn back while there is room to turn',
    },
    did: {
      push: 'pressed on at low level in deteriorating weather',
      hold: 'climbed into cloud and flew out on instruments',
      cover: 'turned back rather than press deteriorating weather',
    },
    unitId: null,
    biasToward: null,
  },
  // NO ENGINE-OUT SCENE HERE. `scenes.ts` already has one and it covers
  // the same ground — a second under the same id made one of them
  // unreachable, because `sceneById` returns the first match. Caught by a
  // duplicate-id test rather than by reading, which is the only way this
  // kind of collision ever gets caught in a catalogue this size.
  {
    id: 'flightline-fire',
    tags: ['air_flightline_fire'],
    channels: ['base-attack-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'A fuel spill under the port wing and somebody is still running an APU forty feet away.',
      heavy: 'The aircraft is alight on the line and the one beside it is fuelled and loaded.',
      overrun: 'The line is burning and there is ordnance on the ramp and rounds are still coming in.',
    },
    labels: {
      push: 'Go in and tow the loaded aircraft clear',
      hold: 'Fight the fire from where you are',
      cover: 'Pull everybody back and let it burn',
    },
    did: {
      push: 'towed a loaded aircraft clear of a burning flight line',
      hold: 'fought a flight-line fire from cover',
      cover: 'cleared the line and let an aircraft burn',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * AT SEA — the war where there is nowhere to go. A ship is a building on
 * fire that you cannot leave, and every one of these is that.
 */
const SEA_SCENES: readonly CombatScene[] = [
  {
    id: 'general-quarters',
    tags: ['sea_general_quarters', 'sea_smallboat_attack'],
    channels: ['sea-exposure', 'direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'General quarters at zero four hundred. Probably another drill, and probably is doing a lot of work.',
      heavy: 'Small craft closing fast from three bearings and the rules of engagement are somebody else’s problem in about ninety seconds.',
      overrun: 'One of them is not turning away and it is close enough now that being wrong either way kills people.',
    },
    labels: {
      push: 'Engage now',
      hold: 'Warning shots and hold',
      cover: 'Manoeuvre away and report',
    },
    did: {
      push: 'engaged a closing craft',
      hold: 'fired warning shots and held fire',
      cover: 'manoeuvred clear and reported the contact',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'fire-aboard',
    tags: ['sea_fire_aboard', 'sea_general_quarters'],
    channels: ['sea-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Smoke in a berthing space two decks down. The alarm has gone and nobody is panicking yet.',
      heavy: 'A machinery-space fire and the compartment either side of it is manned.',
      overrun: 'The fire is between the people forward and the only way aft, and the bulkhead is already too hot to lean on.',
    },
    labels: {
      push: 'Go in after the people',
      hold: 'Fight it from the boundary',
      cover: 'Seal the compartment',
    },
    did: {
      push: 'entered a burning compartment after trapped shipmates',
      hold: 'fought a fire from the boundary and held it',
      cover: 'sealed a compartment with the fire inside it',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'flight-deck',
    tags: ['sea_flightdeck_hazard'],
    channels: ['sea-exposure', 'air-exposure'],
    tell: {
      light: 'A tie-down has come adrift on a spotted aircraft and the deck is moving more than it was.',
      heavy: 'An aircraft has come in hard and there is fuel on a deck with turning engines on it.',
      overrun: 'There is a man down inside the foul line with a jet turning twenty feet away and the deck is pitching.',
    },
    labels: {
      push: 'Go out onto the deck',
      hold: 'Signal a shutdown first',
      cover: 'Clear the deck and wait',
    },
    did: {
      push: 'went out onto a fouled flight deck',
      hold: 'shut down the aircraft before going out',
      cover: 'cleared the flight deck and waited it out',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * MILITARY POLICE AND SECURITY — the war where the hard part is deciding
 * who somebody is with two seconds to do it. These are the ROE scenes, and
 * the wrong call is wrong in both directions.
 */
const SECURITY_SCENES: readonly CombatScene[] = [
  {
    id: 'the-checkpoint',
    tags: ['base_defense'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'A car is coming up the approach faster than it should be and it has not seen the signs.',
      heavy: 'It is inside the warning line and accelerating and there are people behind you.',
      overrun: 'It is not stopping, there are children visible in the back, and you have about two seconds.',
    },
    labels: {
      push: 'Fire into the engine block',
      hold: 'Escalate — flare, then warning shot',
      cover: 'Hold fire and get everybody down',
    },
    did: {
      push: 'fired on a vehicle at a checkpoint',
      hold: 'escalated by the book at a checkpoint',
      cover: 'held fire and cleared the checkpoint',
    },
    unitId: null,
    biasToward: null,
  },
  {
    id: 'the-insider',
    tags: ['base_defense'],
    channels: ['base-attack-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'One of the partnered troops is somewhere he has no reason to be, and he is armed, which he is entitled to be.',
      heavy: 'He has turned and he is walking toward the chow line with his weapon at the low ready.',
      overrun: 'He has already started firing and he is inside the wire and everybody in front of you is unarmed.',
    },
    labels: {
      push: 'Engage immediately',
      hold: 'Challenge him first',
      cover: 'Get the unarmed out and cover the door',
    },
    did: {
      push: 'engaged an insider attacker without challenge',
      hold: 'challenged an armed man inside the wire',
      cover: 'covered the withdrawal of unarmed personnel',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * INTELLIGENCE AND OPERATIONS — the war fought at a distance, where the
 * decision is made in a room and paid for somewhere else. Nothing here is
 * physically dangerous to the person deciding, and that is the point of it.
 */
const INTELLIGENCE_SCENES: readonly CombatScene[] = [
  {
    id: 'the-targeting-call',
    tags: ['ops_center_crisis', 'cyber_incident'],
    channels: ['direct-combat-exposure', 'base-attack-exposure', 'rear-exposure'],
    tell: {
      light: 'The picture is thin but the pattern is there, and a patrol is going to walk that road in four hours.',
      heavy: 'You are being asked whether the building is what you think it is, and the answer moves people tonight.',
      overrun: 'The confidence is not there and the ground commander needs an answer now, and both answers cost somebody.',
    },
    labels: {
      push: 'Call it — commit to the assessment',
      hold: 'Give the assessment with the caveats',
      cover: 'Say you do not know',
    },
    did: {
      push: 'made a firm targeting assessment on thin intelligence',
      hold: 'gave a caveated assessment under pressure',
      cover: 'declined to assess without better information',
    },
    unitId: null,
    biasToward: null,
  },
]

/**
 * COMMAND — the officer's war. The spec's phrase is "the order that spends
 * people; being right and paying for it anyway", and these are written so
 * that the correct tactical answer is sometimes the one that costs
 * somebody you know. That is what makes them different from everything
 * above rather than a rank badge on the same scene.
 */
const COMMAND_SCENES: readonly CombatScene[] = [
  {
    id: 'who-goes-first',
    tags: ['ops_center_crisis'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody has to clear the outbuilding first and everybody is looking at you to say who.',
      heavy: 'The only way at them is across forty metres of open and it is your call who crosses it.',
      overrun: 'One element has to fix them while the other moves, and the one that fixes them is going to take it.',
    },
    labels: {
      push: 'Send your best team',
      hold: 'Take it yourself with a fireteam',
      cover: 'Nobody moves — call for fire and wait',
    },
    did: {
      push: 'ordered his best team across open ground',
      hold: 'led the assault element himself',
      cover: 'held the element and called for indirect fire',
    },
    unitId: null,
    biasToward: null,
    officersOnly: true,
  },
  {
    id: 'press-or-consolidate',
    tags: ['ops_center_crisis'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'You have the initiative and about an hour of light. Pressing costs nothing yet.',
      heavy: 'You are ahead and thin, and the men have been on their feet since two.',
      overrun: 'One more push probably finishes it. It also probably finishes some of them, and you know which ones are forward.',
    },
    labels: {
      push: 'Press the attack',
      hold: 'Consolidate and hold what you have',
      cover: 'Break contact and withdraw',
    },
    did: {
      push: 'pressed an attack with a tired and extended element',
      hold: 'consolidated on the objective',
      cover: 'broke contact and withdrew the element',
    },
    unitId: null,
    biasToward: null,
    officersOnly: true,
  },
]

/**
 * EVERY POOL, IN ONE PLACE. Appended to `COMBAT_SCENES` rather than
 * replacing anything: the existing nineteen still fire, and these are the
 * depth underneath them (spec: "nothing working gets removed — existing
 * scenes become the seeds of the new engagement pools").
 */
export const MOS_SCENES: readonly CombatScene[] = [
  // THE RIFLEMAN HAD NO POOL AT ALL until 2026-08-18 — the most-played job
  // in the game fell through to the general core scenes, which is a large
  // part of why the owner kept seeing the same three. Twenty of his own,
  // in `mosrifleman.ts`.
  ...RIFLEMAN_SCENES,
  // The special units' own wars. Seven units shared TEN scenes before
  // 2026-08-18, and the three tier-2 units — the ones a tier-1 operator is
  // promoted into — had none at all, so reaching the top of the pack made a
  // player's war SHALLOWER. See `unitscenes.ts`.
  ...PATHFINDER_SCENES,
  ...TRIDENT_SCENES,
  ...MEDICAL_SCENES,
  ...TRANSPORT_SCENES,
  ...ENGINEER_SCENES,
  ...AVIATION_SCENES,
  ...SEA_SCENES,
  ...SECURITY_SCENES,
  ...INTELLIGENCE_SCENES,
  ...COMMAND_SCENES,
]
