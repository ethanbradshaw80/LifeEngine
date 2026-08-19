/**
 * THE SNIPER'S WAR — earned, not assigned.
 *
 * OWNER'S RULING: "we have a school called 'sniper school' in the
 * schoolhouse. only infantry men should be able to apply but if you get this
 * school completed and deploy you should then be the sniper for all the
 * deployments after the school."
 *
 * WHY THIS FILE IS KEYED ON A BADGE AND NOT A TRADE. There is no sniper
 * specialty in the game and there should not be one: a sniper is a rifleman
 * who passed a course, which is how it actually works, and `sniper-school`
 * already exists in `content.ts`, already restricted to `rifleman`, already
 * awarding `sniper qualified`. The badge is the gate. It also means the role
 * follows a man for the rest of his career, which is what he asked for —
 * once you have it, every deployment after is a sniper's deployment.
 *
 * WHAT MAKES A SNIPER'S PROBLEM HIS OWN. Two things, and nearly every scene
 * here is one or the other.
 *
 *   THE SHOT. Not whether he can make it — he can — but whether he should,
 *   and what taking it costs him and everybody with him. A rifleman firing
 *   is one of eight men firing. A sniper firing is a decision with a name
 *   attached and a face in the glass.
 *
 *   THE LYING STILL. Days in a hide with a spotter and a bottle, unable to
 *   move, watching things happen that he could stop by revealing himself.
 *   The infantry's problem is what to do; his is what to WATCH.
 *
 * He is also, uniquely, a man whose work is COUNTED — which is why
 * `aftermath.ts` gates its confirmed count on this same badge.
 *
 * THE OWNER'S OVERRIDE (§10) applies. Nothing here draws a number.
 */

import type { CombatScene } from './types.js'

const SNIPER = ['sniper qualified'] as const

export const SNIPER_SCENES: readonly CombatScene[] = [
  {
    id: 'sn-the-man-who-is-not-a-target',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The man in the glass is digging. He has been digging for an hour and there is no weapon near him.',
      heavy: 'He is digging a firing position and he is fifteen years old at most.',
      overrun: 'He has finished it and somebody is walking towards it carrying something long.',
    },
    labels: {
      push: 'Take him',
      hold: 'Wait for the weapon to reach the hole',
      cover: 'Report it and let the position be dealt with another way',
    },
    did: {
      push: 'shot an unarmed boy digging a firing position',
      hold: 'waited for a weapon to appear before firing',
      cover: 'reported a position rather than fire on the man preparing it',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-nine-hundred-metre-wind',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The shot is long, the wind is switching in the middle third, and there is time.',
      heavy: 'The wind will not settle and the target is about to be inside a building for a week.',
      overrun: 'The wind is wrong, the shot is now, and there are people behind him.',
    },
    labels: {
      push: 'Take it and dope the switch by feel',
      hold: 'Wait for the wind and probably lose him',
      cover: 'Give the shot to the spotter’s rifle at a shorter angle',
    },
    did: {
      push: 'took a long shot through an unsettled wind',
      hold: 'let a target go rather than fire through bad wind',
      cover: 'handed a shot to his spotter from a better angle',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-what-you-watch-from-the-hide',
    tags: ['combat_patrol_ied', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'From the hide you can see a patrol walking towards ground you know is mined.',
      heavy: 'They are not on your net, they are four hundred metres out, and breaking cover ends the task.',
      overrun: 'The lead man is thirty metres from it.',
    },
    labels: {
      push: 'Break cover and stop them',
      hold: 'Try every frequency and keep trying',
      cover: 'Fire a shot into the ground in front of them',
    },
    did: {
      push: 'broke cover to stop a patrol walking into a minefield',
      hold: 'worked the radio while a patrol approached a minefield',
      cover: 'fired a warning shot and compromised his own position',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-fourth-day',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'Fourth day in the hide. The water is gone and the target has not appeared.',
      heavy: 'The spotter has started making mistakes on the log and neither of you has slept properly.',
      overrun: 'You cannot feel your legs and the extraction is not until tomorrow night.',
    },
    labels: {
      push: 'Stay the full duration as briefed',
      hold: 'Move the hide tonight and risk the movement',
      cover: 'Abort and walk out early',
    },
    did: {
      push: 'held a hide to the full duration without water',
      hold: 'moved a hide at night rather than break',
      cover: 'aborted a hide early and walked out',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-spotter-is-hit',
    tags: ['combat_firefight', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Something has found the hide and your spotter has taken it in the shoulder.',
      heavy: 'He is hit badly, the position is known, and the rifle cannot be worked alone at this range.',
      overrun: 'He is not moving and the fire is walking along the ridge towards you both.',
    },
    labels: {
      push: 'Keep shooting and treat him between shots',
      hold: 'Stop shooting entirely and work on him',
      cover: 'Drag him off the ridge and leave the rifle',
    },
    did: {
      push: 'kept firing while treating his spotter between shots',
      hold: 'stopped engaging entirely to treat his spotter',
      cover: 'abandoned the rifle to drag his spotter off a ridge',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-officer-in-the-glass',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The man reading the map is plainly the one they all listen to.',
      heavy: 'He is the commander, he is in the open, and killing him will scatter them into the village.',
      overrun: 'He is about to move and there will not be another day like this one.',
    },
    labels: {
      push: 'Take the commander',
      hold: 'Take the radio operator instead and leave them leaderless but coherent',
      cover: 'Take neither and report the position for a strike',
    },
    did: {
      push: 'killed an enemy commander in the open',
      hold: 'killed the signaller rather than scatter a formation',
      cover: 'let a commander live and called a strike instead',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-counter-sniper',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody on the far ridge is doing exactly what you are doing.',
      heavy: 'He has found the hide once already and the second round was closer.',
      overrun: 'He is better placed than you and he knows it.',
    },
    labels: {
      push: 'Stay and win the duel',
      hold: 'Move and re-establish somewhere worse',
      cover: 'Bring artillery onto the whole ridge, yourself included',
    },
    did: {
      push: 'stayed in a compromised hide to fight a counter-sniper',
      hold: 'displaced under observation to a poorer position',
      cover: 'called fire onto a ridge he was still on',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-shot-you-are-ordered-to-take',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The order names a man and gives a description that fits half the village.',
      heavy: 'The description fits, the man is there, and nothing about him confirms anything.',
      overrun: 'The order has been repeated and the window is closing.',
    },
    labels: {
      push: 'Take the shot on the order',
      hold: 'Refuse until identification is positive',
      cover: 'Report that you cannot confirm and let them decide again',
    },
    did: {
      push: 'fired on an order without positive identification',
      hold: 'refused a shot without positive identification',
      cover: 'reported an unconfirmed target back and let the window close',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-family-in-the-frame',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The target is standing in a doorway and there are children in the room behind him.',
      heavy: 'The round will go through him and keep going.',
      overrun: 'He is not going to leave that doorway and the assault is committed.',
    },
    labels: {
      push: 'Take the shot as presented',
      hold: 'Wait for him to step clear of the doorway',
      cover: 'Call the assault off rather than fire into a house',
    },
    did: {
      push: 'fired at a target with children behind him',
      hold: 'held for a clear shot with an assault waiting',
      cover: 'called off an assault rather than fire into an occupied house',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-hide-in-the-house',
    tags: ['combat_breach', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The best position in the district is the top floor of somebody’s home.',
      heavy: 'The family are downstairs and they have worked out that the house is now a target.',
      overrun: 'They are asking to leave and leaving will tell everybody where you are.',
    },
    labels: {
      push: 'Hold them in the house until the task is done',
      hold: 'Let them go and move within the hour',
      cover: 'Give up the position and find a worse one',
    },
    did: {
      push: 'held a family in their own house to protect a firing position',
      hold: 'let a family leave and displaced immediately',
      cover: 'gave up the best position in the district for a worse one',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-body-that-draws-others',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The man you shot is lying in the open and somebody is going to come for him.',
      heavy: 'Two have come for him already and they are not armed.',
      overrun: 'A crowd is forming around him in the road.',
    },
    labels: {
      push: 'Engage whoever comes — it is a known technique',
      hold: 'Let them recover him and hold fire',
      cover: 'Displace rather than have to make the choice',
    },
    did: {
      push: 'engaged the unarmed men recovering a body',
      hold: 'held fire while a body was recovered',
      cover: 'displaced rather than fire on a recovery party',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-log',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The spotter’s log for today does not match what you remember of this morning.',
      heavy: 'It has one more entry in it than there were shots.',
      overrun: 'The log is what the count is built from and somebody senior has asked to see it.',
    },
    labels: {
      push: 'Correct it to what actually happened',
      hold: 'Leave it and say nothing to anybody',
      cover: 'Take it to your spotter first and ask him',
    },
    did: {
      push: 'corrected an inflated log against his own record',
      hold: 'left an inflated log uncorrected',
      cover: 'confronted his spotter about the log before anybody else saw it',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-range-you-have-never-shot',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The target is further out than anything you have hit outside a range day.',
      heavy: 'It is beyond your rifle’s honest ability and the data past that distance is somebody else’s.',
      overrun: 'It is that or nothing and the patrol below is being cut apart.',
    },
    labels: {
      push: 'Take it and hold for everything you can guess at',
      hold: 'Wait for him to close and hope the patrol lasts',
      cover: 'Give the target to the mortars and accept the spread',
    },
    did: {
      push: 'fired well beyond his rifle’s tested range',
      hold: 'waited for a target to close while a patrol was engaged',
      cover: 'handed a target to indirect fire',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-face-you-remember',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'You have watched this man through glass for three days and you know how he takes his tea.',
      heavy: 'You know his routine better than his neighbours do and the order came this morning.',
      overrun: 'He is exactly where you knew he would be, at the time you knew he would be there.',
    },
    labels: {
      push: 'Take the shot',
      hold: 'Hand the target to somebody who has not watched him',
      cover: 'Report that he has changed pattern and buy a day',
    },
    did: {
      push: 'killed a man whose routine he had watched for three days',
      hold: 'handed off a target he had studied too closely',
      cover: 'misreported a target’s pattern to delay a shot',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-infantry-who-want-you-gone',
    tags: ['combat_firefight', 'base_defense'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The platoon holding this building would rather you took your rifle somewhere else.',
      heavy: 'They say every round you fire brings mortars onto them, and they are right.',
      overrun: 'They have started to make the point physically.',
    },
    labels: {
      push: 'Stay and keep working — the position is the position',
      hold: 'Move out and lose the arcs',
      cover: 'Work only when they are in contact anyway',
    },
    did: {
      push: 'held a firing position over the objections of the men in the building',
      hold: 'gave up a firing position to the platoon holding the building',
      cover: 'restricted his own firing to periods of existing contact',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-second-shot',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The first round did not do it and he is crawling.',
      heavy: 'He is crawling and screaming and everybody in the position can hear him.',
      overrun: 'He has been screaming for eleven minutes and men are coming out to him.',
    },
    labels: {
      push: 'Finish it',
      hold: 'Hold and let them recover him',
      cover: 'Displace and leave it',
    },
    did: {
      push: 'fired a second round to end a wounded man’s suffering',
      hold: 'held fire and let a wounded enemy be recovered',
      cover: 'displaced rather than fire again',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-position-that-is-perfect',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The obvious hill has the obvious view and every man in the valley knows it.',
      heavy: 'It is the only place with the arcs, and it has been used before by somebody.',
      overrun: 'There is old brass on the ground up here that is not yours.',
    },
    labels: {
      push: 'Use it — the arcs are worth it',
      hold: 'Build a worse hide somewhere nobody would choose',
      cover: 'Use it as a decoy and lie up elsewhere',
    },
    did: {
      push: 'occupied the obvious position for the arcs it gave',
      hold: 'built a poor hide in a place nobody would look',
      cover: 'used an obvious position as a decoy',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-order-to-stop',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A ceasefire has come into effect and there is a man in your glass laying a charge.',
      heavy: 'The ceasefire holds everywhere except in front of you.',
      overrun: 'He has finished and he is walking away from something that will kill people tomorrow.',
    },
    labels: {
      push: 'Fire and break the ceasefire',
      hold: 'Hold fire and report the charge’s position',
      cover: 'Go down and clear it yourself after dark',
    },
    did: {
      push: 'fired during a ceasefire on a man laying a charge',
      hold: 'held fire under a ceasefire and reported the device',
      cover: 'went out after dark to clear a device rather than fire',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-what-the-others-ask-you',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure', 'base_defense'],
    tell: {
      light: 'The younger men have started asking what the number is.',
      heavy: 'They ask every week and one of them has started keeping a tally for you.',
      overrun: 'Somebody has painted it on a wall of the accommodation.',
    },
    labels: {
      push: 'Tell them the number and let it be what it is',
      hold: 'Refuse to discuss it at all',
      cover: 'Make them paint the wall over and say why',
    },
    did: {
      push: 'told his platoon his confirmed count',
      hold: 'refused to discuss his count with anybody',
      cover: 'had a tally painted over and explained why',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
  {
    id: 'sn-the-day-you-do-not-shoot',
    tags: ['combat_patrol_ied', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Everything is right — range, wind, identification — and you have not moved your finger.',
      heavy: 'The shot is there, it has been there for a minute, and something in you has stopped.',
      overrun: 'The spotter has asked twice and the target is walking out of the arc.',
    },
    labels: {
      push: 'Take it before it goes',
      hold: 'Let it go and hand the rifle to the spotter',
      cover: 'Let it go and say nothing about why',
    },
    did: {
      push: 'took a shot he had frozen on',
      hold: 'handed his rifle to his spotter mid-task',
      cover: 'let a confirmed target walk and never explained it',
    },
    unitId: null,
    badgeIds: SNIPER,
    biasToward: null,
  },
]
