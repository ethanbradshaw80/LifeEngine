/**
 * THE AIR PACK — the Guardian Flight and the Nighthawk Squadron.
 *
 * TWO UNITS, TWO COMPLETELY DIFFERENT JOBS, and it matters that they are not
 * written as one. The Guardian Flight goes DOWN THE ROPE: they are the people
 * who arrive after an aircraft has come apart, and their decisions are about
 * a casualty, a clock and a hoist. The Nighthawks FLY: their decisions are
 * about the aircraft itself — fuel, weather, weight, and whether to put it
 * somewhere it should not go because men on the ground are asking.
 *
 * The Nighthawks are tier 2 and fed by the Guardian Flight, so a player who
 * gets there has usually done both. The scenes should feel like a promotion
 * into a different kind of fear: the rescueman's is that he cannot reach
 * somebody, the pilot's is that everyone aboard is his.
 *
 * A UNIT SCENE MUST LEAN (scenes.test.ts). These jobs are not light days.
 */

import type { CombatScene } from './types.js'

/** THE GUARDIAN FLIGHT — that others may live, at whatever it costs. */
export const GUARDIAN_SCENES: readonly CombatScene[] = [
  {
    id: 'gf-the-second-man',
    tags: ['combat_rescue', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Two aircrew on the ground, three hundred metres apart, and the aircraft can make one pass.',
      heavy: 'One is moving and one is not, and the one who is not is further from the wire.',
      overrun: 'They are being walked towards by people on foot and the pass has to happen now.',
    },
    labels: {
      push: 'Go to the one who is not moving',
      hold: 'Take the one you can reach and come back',
      cover: 'Put yourself between them and buy time for both',
    },
    did: {
      push: 'went to the casualty least likely to live and furthest from safety',
      hold: 'recovered the reachable man and returned for the other',
      cover: 'stayed on the ground between two casualties and an advance',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-hoist-that-jams',
    tags: ['combat_rescue', 'air_hardlanding'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The hoist has stopped with the litter eight metres below the aircraft.',
      heavy: 'It is jammed, there is a man on the end of it, and the aircraft cannot land here.',
      overrun: 'Jammed, loaded, taking fire, and the aircraft has to move whether or not he is aboard.',
    },
    labels: {
      push: 'Fly out with him on the wire',
      hold: 'Work the jam while the aircraft holds the hover',
      cover: 'Cut him loose over the softest ground you can find',
    },
    did: {
      push: 'flew out of a hot area with a casualty suspended on a jammed hoist',
      hold: 'cleared a hoist jam in a hover under fire',
      cover: 'cut a casualty loose rather than lose the aircraft',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-wrong-side-of-the-line',
    tags: ['combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The survivor is four kilometres over a border nobody is supposed to cross.',
      heavy: 'He is over the line, he is alive on the radio, and the answer from above is no.',
      overrun: 'He has stopped answering and the answer from above is still no.',
    },
    labels: {
      push: 'Go anyway',
      hold: 'Hold on this side and keep asking',
      cover: 'Talk him to the border on foot and meet him there',
    },
    did: {
      push: 'crossed a closed border for a downed man against orders',
      hold: 'held short of a border while a survivor went quiet',
      cover: 'talked an injured survivor four kilometres to a border on foot',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-the-burning-aircraft',
    tags: ['combat_rescue', 'air_crash'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The wreck is alight at one end and there is somebody in the other end.',
      heavy: 'The fire has reached the centre section and the door is jammed against the ground.',
      overrun: 'There is ordnance aboard and it has started cooking off.',
    },
    labels: {
      push: 'Go into it',
      hold: 'Fight the fire back from outside first',
      cover: 'Pull everybody clear and let it burn',
    },
    did: {
      push: 'entered a burning aircraft with ordnance cooking off',
      hold: 'fought a fire back before entering a wreck',
      cover: 'pulled a rescue party clear of a burning aircraft',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-freefall-into-weather',
    tags: ['combat_rescue', 'air_hardlanding'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The cloud base has come down below the jump altitude and the drop is on.',
      heavy: 'You will be in cloud from exit to two hundred metres and the ground is not flat.',
      overrun: 'The weather has closed entirely and the man below has hours, not days.',
    },
    labels: {
      push: 'Jump into it',
      hold: 'Wait for a break and lose the daylight',
      cover: 'Refuse the jump and send the coordinates to somebody closer',
    },
    did: {
      push: 'made a freefall insertion through solid cloud',
      hold: 'waited out weather while a casualty deteriorated',
      cover: 'handed a rescue to another element rather than jump blind',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-man-who-will-not-be-moved',
    tags: ['combat_rescue', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'His back is wrong and moving him is going to do damage that cannot be undone.',
      heavy: 'He cannot be moved safely and he cannot stay where he is.',
      overrun: 'The position is being overrun and the choice is a broken back or captivity.',
    },
    labels: {
      push: 'Move him and accept the damage',
      hold: 'Stabilise him properly however long it takes',
      cover: 'Stay with him where he lies',
    },
    did: {
      push: 'moved a spinal casualty knowing what it would cost him',
      hold: 'took the time to stabilise a casualty under fire',
      cover: 'stayed on the ground with a man who could not be moved',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-the-decoy-beacon',
    tags: ['combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The beacon is transmitting and the voice on the radio is not using the authentication.',
      heavy: 'The authentication is wrong and the beacon is exactly where a beacon should be.',
      overrun: 'It is bait, everybody knows it is bait, and there is a real man missing in the same valley.',
    },
    labels: {
      push: 'Go in on the beacon regardless',
      hold: 'Work the valley away from the beacon and search',
      cover: 'Abort and report it as compromised',
    },
    did: {
      push: 'went in on a beacon that failed authentication',
      hold: 'searched a valley while ignoring a suspect beacon',
      cover: 'aborted a rescue on a compromised beacon',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-fuel-on-the-hover',
    tags: ['combat_rescue', 'air_emergency_landing'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The aircraft has fuel for eleven more minutes in the hover.',
      heavy: 'Eleven minutes, one casualty packaged and one still being cut out.',
      overrun: 'Four minutes, and the second man is not free yet.',
    },
    labels: {
      push: 'Keep working and let the aircraft worry about fuel',
      hold: 'Send the aircraft away and stay on the ground with them',
      cover: 'Go up with the one you have and leave the other',
    },
    did: {
      push: 'held an aircraft in the hover past its fuel margin',
      hold: 'sent the aircraft away and stayed on the ground with casualties',
      cover: 'lifted with one casualty and left the second on the ground',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-enemy-wounded',
    tags: ['combat_rescue', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of the men in the wreckage is not one of ours.',
      heavy: 'He is badly hurt, he is not ours, and the aircraft has room for exactly the men who are.',
      overrun: 'Taking him means leaving a stretcher behind and everybody on the ground can count.',
    },
    labels: {
      push: 'Treat and take him',
      hold: 'Treat him and leave him with what you can spare',
      cover: 'Take our own and go',
    },
    did: {
      push: 'evacuated an enemy casualty at the cost of a stretcher space',
      hold: 'treated an enemy casualty and left him supplies',
      cover: 'left an enemy wounded to take his own',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-village-that-carries-him-out',
    tags: ['combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A group of villagers are carrying the survivor towards the aircraft.',
      heavy: 'They have him on a door, they are twenty strong, and nobody can see everybody’s hands.',
      overrun: 'They will not hand him over until something is agreed and there is no time to agree it.',
    },
    labels: {
      push: 'Take him from them',
      hold: 'Let them come in and search nobody',
      cover: 'Land away and make them bring him across the open',
    },
    did: {
      push: 'took a survivor from villagers by force of presence',
      hold: 'let an unsearched crowd carry a survivor to the aircraft',
      cover: 'made villagers carry a survivor across open ground first',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-rope-in-the-trees',
    tags: ['combat_rescue', 'air_hardlanding'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'The only gap in the canopy is narrower than the rotor disc and forty metres deep.',
      heavy: 'The hole is tight, the trees are dead and dry, and the downwash is bringing branches down.',
      overrun: 'A limb has come through the rotor arc once already.',
    },
    labels: {
      push: 'Go down the rope into the hole',
      hold: 'Move a kilometre to open ground and carry him there',
      cover: 'Cut a landing site with what the team carries',
    },
    did: {
      push: 'roped into a canopy gap narrower than the rotor disc',
      hold: 'carried a casualty a kilometre to usable ground',
      cover: 'cut a landing site out of standing timber by hand',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-call-that-comes-twice',
    tags: ['combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A second call has come in while the team is still working the first.',
      heavy: 'Two casualties in two places and one team, and both callers say theirs is dying.',
      overrun: 'Three calls now, and the aircraft is committed to the furthest of them.',
    },
    labels: {
      push: 'Split the team and take both',
      hold: 'Finish this one properly and go on to the next',
      cover: 'Hand one to a conventional medevac and lose time explaining',
    },
    did: {
      push: 'split a rescue team across two simultaneous calls',
      hold: 'finished one recovery before starting another',
      cover: 'handed a call to a conventional medevac',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-water-landing',
    tags: ['combat_rescue', 'sea_manoverboard'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The aircrew is in the water and still in his harness, which is filling.',
      heavy: 'The canopy has him under and the sea is running.',
      overrun: 'He is under, the swell is taking him away from the aircraft, and there is one swimmer.',
    },
    labels: {
      push: 'Go in after him',
      hold: 'Work him up from the surface on the hoist',
      cover: 'Mark the position and bring surface craft',
    },
    did: {
      push: 'went into the sea after a man being pulled under by his canopy',
      hold: 'recovered a man from the water on the hoist',
      cover: 'marked a position and waited for surface craft',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-triage-you-do-not-want',
    tags: ['med_masscas', 'combat_rescue'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Five casualties and one aircraft with room for three.',
      heavy: 'Five, room for three, and the two worst will not survive the wait.',
      overrun: 'Five, room for three, and the position will not be held long enough for a second lift.',
    },
    labels: {
      push: 'Take the two worst and one other',
      hold: 'Take the three who will live',
      cover: 'Take two and stay behind with the rest',
    },
    did: {
      push: 'lifted the most desperate casualties over those most likely to live',
      hold: 'lifted the casualties most likely to survive',
      cover: 'gave up his own seat to stay with the men left behind',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-the-man-you-trained',
    tags: ['combat_rescue', 'med_treat_under_fire'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The casualty on the ground is somebody you put through the course.',
      heavy: 'It is your own student and you can see from here what it is.',
      overrun: 'He knows exactly what his injuries mean and he is asking you not to bother.',
    },
    labels: {
      push: 'Work him regardless of what he says',
      hold: 'Do what he is asking',
      cover: 'Give him something for the pain and stay',
    },
    did: {
      push: 'worked a man who had asked him to stop',
      hold: 'honoured a dying man’s request',
      cover: 'stayed with a dying man and made him comfortable',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-the-night-with-no-moon',
    tags: ['combat_rescue', 'air_hardlanding'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'No moon, no illumination allowed, and a search area of six square kilometres.',
      heavy: 'The goggles are showing nothing but grey and the survivor cannot risk a light.',
      overrun: 'You are searching by voice alone and his voice is getting weaker.',
    },
    labels: {
      push: 'Have him show a light and take the risk',
      hold: 'Grid the area on foot until you find him',
      cover: 'Wait for first light and search properly',
    },
    did: {
      push: 'had a survivor show a light in country that was watching',
      hold: 'searched a grid on foot through a moonless night',
      cover: 'waited for first light with a survivor deteriorating',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
  {
    id: 'gf-the-aircraft-that-is-hit',
    tags: ['air_emergency_landing', 'combat_rescue'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The aircraft has taken rounds through the tail on the way in.',
      heavy: 'It is flyable and it is losing something, and there are two men still on the ground.',
      overrun: 'The pilot is saying now or never and the second casualty is thirty metres out.',
    },
    labels: {
      push: 'Hold the aircraft and go for the last man',
      hold: 'Board and let the aircraft save itself',
      cover: 'Send the aircraft and stay on the ground with him',
    },
    did: {
      push: 'held a damaged aircraft on the ground for a last casualty',
      hold: 'boarded a damaged aircraft and left a man behind',
      cover: 'sent a damaged aircraft away and remained on the ground',
    },
    unitId: 'guardian-flight',
    biasToward: 'overrun',
  },
  {
    id: 'gf-what-you-carry-home',
    tags: ['combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The recovery is a body and the family have asked for him.',
      heavy: 'It is a body, it is in a bad place, and nobody is going to be saved by going there.',
      overrun: 'It is a body and going for it will cost living men.',
    },
    labels: {
      push: 'Go and get him anyway',
      hold: 'Mark the place and come back when it is quiet',
      cover: 'Leave him and tell the family the truth',
    },
    did: {
      push: 'risked living men to recover a body',
      hold: 'marked a body’s position for a later recovery',
      cover: 'left a body where it lay and told the family why',
    },
    unitId: 'guardian-flight',
    biasToward: 'heavy',
  },
]

/** THE NIGHTHAWK SQUADRON — the aircraft is yours and so is everyone in it. */
export const NIGHTHAWK_SCENES: readonly CombatScene[] = [
  {
    id: 'nh-brownout',
    tags: ['air_hardlanding', 'air_emergency_landing'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The dust comes up at fifteen metres and the landing site disappears.',
      heavy: 'You are in the cloud you made, with no horizon, and there is a wall somewhere to the left.',
      overrun: 'Blind, low, loaded, and the men on the ground have started running for where they think you are.',
    },
    labels: {
      push: 'Commit and put it down on instruments',
      hold: 'Go around and try the approach again',
      cover: 'Abort the landing and make them walk to open ground',
    },
    did: {
      push: 'landed on instruments inside his own dust cloud',
      hold: 'went around from a brownout approach',
      cover: 'aborted a landing and made troops move to open ground',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-wire-nobody-charted',
    tags: ['air_hardlanding', 'air_crash'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'There is a cable strung across the valley that is not on anything you were given.',
      heavy: 'It is at your height, you are below the ridgeline for a reason, and climbing means being seen.',
      overrun: 'You are inside it before you see it.',
    },
    labels: {
      push: 'Climb and accept being painted',
      hold: 'Go under it',
      cover: 'Turn back down the valley and take the long way',
    },
    did: {
      push: 'climbed into radar cover to clear an uncharted cable',
      hold: 'flew beneath an uncharted cable at night',
      cover: 'turned a mission around rather than pass an uncharted hazard',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-load-you-cannot-lift',
    tags: ['air_emergency_landing', 'air_hardlanding'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The team coming out is four heavier than the team that went in, with equipment.',
      heavy: 'At this altitude and this temperature the aircraft will not come out of the hover with all of them.',
      overrun: 'They are all running for the ramp and nobody on the ground is counting.',
    },
    labels: {
      push: 'Take everybody and drag it out along the ground',
      hold: 'Take what the aircraft can lift and go back for the rest',
      cover: 'Make them dump equipment on the landing site',
    },
    did: {
      push: 'over-torqued an aircraft to lift more men than it could carry',
      hold: 'made two lifts rather than exceed the aircraft’s limits',
      cover: 'ordered equipment abandoned on the landing site',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-ground-fire-on-short-final',
    tags: ['air_hardlanding', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There is tracer coming up from the treeline on the approach end.',
      heavy: 'It is aimed, it is close, and the team on the ground is in contact and needs you now.',
      overrun: 'Two guns, both firing, and the landing site is between them.',
    },
    labels: {
      push: 'Land through it',
      hold: 'Break off and come in from the other side, late',
      cover: 'Suppress from the air first and land after',
    },
    did: {
      push: 'landed through aimed ground fire to reach a team in contact',
      hold: 'broke off an approach and re-attacked from another axis',
      cover: 'suppressed a landing site from the air before committing',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-engine-note',
    tags: ['air_emergency_landing', 'work_maint_fault'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'Number two has been running warm since the second turn and nothing has flagged.',
      heavy: 'The temperature is climbing and you are ninety minutes from anywhere friendly.',
      overrun: 'It has failed, you are at low level, and there is a team waiting on the ground.',
    },
    labels: {
      push: 'Press on and finish the task',
      hold: 'Turn for the nearest friendly strip',
      cover: 'Put it down now, in country, and call it in',
    },
    did: {
      push: 'flew a failing aircraft to finish a task',
      hold: 'diverted a failing aircraft and abandoned a task',
      cover: 'landed a failing aircraft in hostile country',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-window',
    tags: ['air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The infiltration window is eleven minutes wide and the weather has cost you six.',
      heavy: 'Five minutes left, and the run-in is the part that cannot be hurried.',
      overrun: 'The window has closed and the team is standing on the ramp.',
    },
    labels: {
      push: 'Fly the run-in faster than it should be flown',
      hold: 'Insert late and warn the team what it means',
      cover: 'Scrub the insertion and bring them home',
    },
    did: {
      push: 'flew a run-in above briefed speed to make a window',
      hold: 'inserted a team outside its window',
      cover: 'scrubbed an insertion and returned the team',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-voice-asking-for-fire',
    tags: ['combat_firefight', 'air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The team is asking for fire forty metres from their own position.',
      heavy: 'Forty metres, at night, and they are the ones who can see and you are the one who cannot.',
      overrun: 'They are asking for it on their own position and the voice is steady, which is worse.',
    },
    labels: {
      push: 'Shoot exactly where they say',
      hold: 'Shoot further out and walk it in',
      cover: 'Refuse and come in to lift them instead',
    },
    did: {
      push: 'fired where a team asked, at forty metres, in darkness',
      hold: 'walked fire in from further out despite the urgency',
      cover: 'refused danger-close fire and attempted an extraction',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-second-aircraft',
    tags: ['air_crash', 'combat_rescue'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'Your wingman has put down hard on the far side of the ridge.',
      heavy: 'He is down, he is on the wrong side, and his crew are alive on the radio.',
      overrun: 'He is down in the middle of what you were both avoiding.',
    },
    labels: {
      push: 'Go to him now with your own load aboard',
      hold: 'Deliver your load first, then go back',
      cover: 'Call it in and orbit as long as fuel allows',
    },
    did: {
      push: 'diverted to a downed wingman with a mission load aboard',
      hold: 'completed the task before recovering a downed crew',
      cover: 'orbited a downed crew and called for the recovery force',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-weather-behind-you',
    tags: ['air_emergency_landing'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'The front is moving faster than forecast and it is between you and home.',
      heavy: 'It has closed the route back and the alternate is across the border.',
      overrun: 'There is nowhere in fuel range that is both open and friendly.',
    },
    labels: {
      push: 'Fly through it',
      hold: 'Land in country and wait it out',
      cover: 'Take the alternate across the border and explain later',
    },
    did: {
      push: 'flew a loaded aircraft through weather it was not rated for',
      hold: 'landed in hostile country to wait out weather',
      cover: 'diverted across a border without clearance',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-goggles-fail',
    tags: ['air_hardlanding', 'work_maint_fault'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'One tube has gone out and depth perception with it.',
      heavy: 'Both tubes are gone on the left seat at two hundred feet.',
      overrun: 'Both crew are on degraded goggles in a valley at low level.',
    },
    labels: {
      push: 'Continue on the good set and hand-fly it',
      hold: 'Climb to a safe altitude and abandon the low-level route',
      cover: 'Turn for home and abort the mission',
    },
    did: {
      push: 'continued a low-level night mission on degraded goggles',
      hold: 'climbed out of a low-level route after a goggle failure',
      cover: 'aborted a mission after a night-vision failure',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-passenger-who-is-dying',
    tags: ['combat_rescue', 'air_emergency_landing'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'There is a casualty in the back who is not going to make the planned destination.',
      heavy: 'He needs a surgeon within the hour and the nearest one is the wrong way.',
      overrun: 'Going for the surgeon means landing at a field that is under attack.',
    },
    labels: {
      push: 'Fly to the surgeon whatever the field looks like',
      hold: 'Hold the planned destination and let him take his chances',
      cover: 'Put down at the nearest aid post, wherever it is',
    },
    did: {
      push: 'landed at a field under attack to reach a surgeon',
      hold: 'held course while a casualty deteriorated',
      cover: 'diverted to the nearest aid post regardless of its capability',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-formation-that-drifts',
    tags: ['air_hardlanding', 'air_crash'],
    channels: ['battlefield-accident'],
    tell: {
      light: 'Number three has been drifting out of position for the last two turns.',
      heavy: 'He is closing and he is not answering the radio.',
      overrun: 'He is inside your rotor arc in cloud.',
    },
    labels: {
      push: 'Hold your line and make him move',
      hold: 'Break formation and re-form on the other side',
      cover: 'Take the whole formation up into open air',
    },
    did: {
      push: 'held station while another aircraft closed on him',
      hold: 'broke a night formation to avoid a collision',
      cover: 'took a formation into open air and gave up its cover',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-landing-site-that-is-a-roof',
    tags: ['air_hardlanding', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The objective is a roof and nobody knows what it is made of.',
      heavy: 'The roof will take a hover but probably not a landing, and the team has to go now.',
      overrun: 'A corner has already given way under the first man.',
    },
    labels: {
      push: 'Put the wheels on it',
      hold: 'Hold a hover and rope them down',
      cover: 'Take them to the street and let them fight up',
    },
    did: {
      push: 'landed on a roof of unknown construction',
      hold: 'held a hover over a failing roof while a team roped down',
      cover: 'inserted a team at street level instead of on the objective',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-fuel-you-do-not-have',
    tags: ['air_emergency_landing'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The team on the ground has asked for twenty more minutes on station.',
      heavy: 'Twenty minutes of loiter is your reserve and the tanker is not answering.',
      overrun: 'You are into the reserve now and they are still not ready.',
    },
    labels: {
      push: 'Stay until they are out',
      hold: 'Give them ten and then go whatever happens',
      cover: 'Leave now and send somebody else back',
    },
    did: {
      push: 'stayed on station into his fuel reserve for a team on the ground',
      hold: 'gave a team a hard deadline and kept to it',
      cover: 'left station with a team still on the ground',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-order-to-turn-back',
    tags: ['air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The mission has been cancelled while you are already inbound.',
      heavy: 'Cancelled, and the team you were going to collect is already moving to the pickup.',
      overrun: 'Cancelled, and they are in contact on the way to a pickup that is not coming.',
    },
    labels: {
      push: 'Go in anyway and answer for it',
      hold: 'Turn back as ordered',
      cover: 'Orbit outside and argue on the radio',
    },
    did: {
      push: 'flew a cancelled mission to collect a team already committed',
      hold: 'turned back as ordered and left a team moving to a pickup',
      cover: 'held outside the objective and contested the cancellation',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-child-on-the-landing-site',
    tags: ['air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There are children on the field you are about to put an aircraft into.',
      heavy: 'They have not moved for the noise and the approach is committed.',
      overrun: 'They are running towards the aircraft and there is a team in contact waiting on it.',
    },
    labels: {
      push: 'Land and trust them to clear',
      hold: 'Go around and try to move them from the air',
      cover: 'Take a worse landing site fifty metres on',
    },
    did: {
      push: 'landed onto a field with children on it',
      hold: 'went around to clear children from a landing site',
      cover: 'took an unsuitable landing site to avoid children',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-thing-in-the-back',
    tags: ['air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The team have brought somebody out with them who was not on the manifest.',
      heavy: 'He is bound, he is not one of theirs, and nobody has explained him.',
      overrun: 'He is bound, injured, and the crew chief is asking you what to do about it.',
    },
    labels: {
      push: 'Fly him out and ask questions on the ground',
      hold: 'Refuse to lift until somebody accounts for him',
      cover: 'Fly him out and log every detail of it',
    },
    did: {
      push: 'flew out an unaccounted prisoner without question',
      hold: 'refused to lift until a prisoner was accounted for',
      cover: 'flew out a prisoner and documented the whole of it',
    },
    unitId: 'nighthawks',
    biasToward: 'heavy',
  },
  {
    id: 'nh-the-approach-you-have-flown-before',
    tags: ['air_hardlanding'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'It is the same landing site and the same run-in as the last two nights.',
      heavy: 'Third night, same axis, and there is new cut brush at the approach end.',
      overrun: 'Somebody has been waiting for the third night and this is it.',
    },
    labels: {
      push: 'Fly it as planned',
      hold: 'Change the run-in on your own authority and land long',
      cover: 'Refuse the site and make the team walk to another',
    },
    did: {
      push: 'flew a pattern he had flown twice before',
      hold: 'changed a briefed approach on his own authority',
      cover: 'refused a compromised landing site',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-the-crew-chief',
    tags: ['air_hardlanding', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Your crew chief has been hit and is still on the gun.',
      heavy: 'He is hit badly and he is the only pair of eyes on that side.',
      overrun: 'He has stopped talking and the aircraft is still in the hover.',
    },
    labels: {
      push: 'Stay in the hover and finish the lift',
      hold: 'Pull out now and treat him',
      cover: 'Hand the lift to the second aircraft and go',
    },
    did: {
      push: 'held a hover with a wounded crew chief to finish a lift',
      hold: 'broke off a lift to treat his own crew',
      cover: 'handed a lift to another aircraft to get a wounded man out',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
  {
    id: 'nh-what-the-aircraft-is-worth',
    tags: ['air_crash', 'air_emergency_landing'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The aircraft is down and intact in country that is not ours.',
      heavy: 'It is intact, it is full of things nobody wants photographed, and the crew are out.',
      overrun: 'People are already walking towards it across the field.',
    },
    labels: {
      push: 'Go back and destroy it properly',
      hold: 'Call in fire on it from a distance',
      cover: 'Take the crew and leave the aircraft',
    },
    did: {
      push: 'returned on foot to destroy a downed aircraft',
      hold: 'called fire onto his own downed aircraft',
      cover: 'recovered the crew and left the aircraft intact',
    },
    unitId: 'nighthawks',
    biasToward: 'overrun',
  },
]
