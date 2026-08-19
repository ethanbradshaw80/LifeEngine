/**
 * THE RIFLEMAN'S WAR — twenty scenes that belong to nobody else.
 *
 * OWNER'S RULING, 2026-08-18: "I think we should add 20+ scenes to each MOS
 * that would be specific to that MOS and what they'd see on a deployment. I
 * don't want the special groups to get the same popups as logistics guys."
 *
 * `mosscenes.ts` already worked this out for the medic and the driver and
 * wrote it down: "the medic's pool was two scenes deep... the cause was
 * depth, not wiring." The rifleman never got the same treatment. He had NO
 * dedicated pool at all — he drew from the general core scenes, which are
 * also the fallback for every trade without one, so the most-played job in
 * the game had the shallowest and least specific war of any of them.
 *
 * WHAT MAKES A SCENE BELONG HERE. It has to be a problem that is his and
 * not somebody else's. A medic decides who to work on; a driver decides
 * whether the vehicle moves. A rifleman's decisions are about GROUND — who
 * holds it, whether to cross it, and what it costs to take the next piece.
 * Every scene below is a piece of ground and a price.
 *
 * THE THREE OPTIONS ARE A SPECTRUM, NOT A MENU (§4.2): `push` accepts risk
 * to force the outcome, `hold` does the disciplined thing, `cover` protects
 * people at the cost of the objective. None of them is the right answer and
 * none is a trap. The `did` lines are past tense because they end up on a
 * record somebody's grandchild reads.
 *
 * THE OWNER'S OVERRIDE (§10) applies: this is grim and concrete on purpose.
 * Nothing here draws a number — pure content, chosen by the seeded picker.
 */

import type { CombatScene } from './types.js'

export const RIFLEMAN_SCENES: readonly CombatScene[] = [
  {
    id: 'the-open-ground',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Sixty metres of ploughed field between you and the ditch, and somebody has started ranging it.',
      heavy: 'The field is being swept end to end and the man who went first is halfway across and not moving.',
      overrun: 'There is no more talking about the field. Either everybody goes now or everybody stays here and it is decided for them.',
    },
    labels: {
      push: 'Go now, all at once',
      hold: 'Bound across in pairs',
      cover: 'Nobody crosses — put fire down and pull back',
    },
    did: {
      push: 'took the whole section across open ground in one rush',
      hold: 'moved the section across in bounds under covering fire',
      cover: 'refused the crossing and withdrew the section under fire',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-doorway-you-cannot-see-into',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The door is ajar and the room behind it is black. Nothing has come out of it.',
      heavy: 'Something moved in there twice and the man beside you has his shoulder against the frame waiting on you.',
      overrun: 'The building has to be cleared in the next minute or the whole street is untenable, and that door is the way in.',
    },
    labels: {
      push: 'Go through it',
      hold: 'Grenade first, then go',
      cover: 'Leave it — seal the door and move on',
    },
    did: {
      push: 'went first through a doorway nobody could see into',
      hold: 'put a grenade through before entering',
      cover: 'sealed a room rather than clear it, and moved the section on',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'turned-earth',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The dirt at the culvert has been turned over and the rain has not touched it. It was not like that on the way out.',
      heavy: 'Two patches, forty metres apart, and the second one is where anybody would go to get off the first.',
      overrun: 'The whole track has been worked on and there is fire coming from the treeline to keep you standing on it.',
    },
    labels: {
      push: 'Keep going and take the track',
      hold: 'Stop everything and wait for the search team',
      cover: 'Take the section off the track and go the long way',
    },
    did: {
      push: 'walked a patrol down a track that had plainly been dug in',
      hold: 'halted the patrol on suspicion and waited for clearance',
      cover: 'took the patrol off the route and lost four hours',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-fire-that-moves-left',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The shooting has shifted twenty metres left of where it started. Somebody over there is working.',
      heavy: 'They are not trying to hit you from the front. The front is to keep your head down while the left comes round.',
      overrun: 'The left is already past your flank and the rear of the position is open ground with nobody watching it.',
    },
    labels: {
      push: 'Take the section left and meet them',
      hold: 'Refuse the flank — swing the gun and hold',
      cover: 'Break contact now while there is still a way out',
    },
    did: {
      push: 'attacked into a flanking movement rather than wait for it',
      hold: 'refused the flank and held the position',
      cover: 'broke contact before the flank closed',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'down-to-two-magazines',
    tags: ['combat_firefight', 'base_defense'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'You are on your third magazine and the resupply is somewhere behind a hill.',
      heavy: 'Two magazines each and the gun is down to a belt and a half. Nobody has said it out loud yet.',
      overrun: 'The gun is dry. What is left is what is in the rifles and it is not enough for another ten minutes of this.',
    },
    labels: {
      push: 'Keep the rate up and win it now',
      hold: 'Aimed shots only — make it last',
      cover: 'Send two men back for ammunition through the open',
    },
    did: {
      push: 'spent the last of the ammunition trying to end it quickly',
      hold: 'rationed a section down to aimed shots and held',
      cover: 'sent men across open ground for ammunition',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-man-at-the-window',
    tags: ['combat_firefight', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There is a face at the second-floor window. It has been there twice now and it is not carrying anything you can see.',
      heavy: 'Somebody is at that window every time the fire slackens, and the fire is very well laid on.',
      overrun: 'Whoever is in that window is putting rounds down the length of the street and there are people trying to cross it.',
    },
    labels: {
      push: 'Engage the window',
      hold: 'Watch it and wait to see a weapon',
      cover: 'Move everybody out of its arc instead',
    },
    did: {
      push: 'fired on an occupied window without confirming a weapon',
      hold: 'held fire until the target was positively identified',
      cover: 'moved the section out of the arc rather than shoot into the building',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-listening-post',
    tags: ['base_defense', 'combat_patrol_ied'],
    channels: ['base-attack-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'Two hundred metres out in the dark with one other man, and something in the scrub has been moving for ten minutes.',
      heavy: 'It is more than one and they are between you and the wire.',
      overrun: 'They are past you. The position behind you does not know it yet and the radio has one transmission in it before you are found.',
    },
    labels: {
      push: 'Open fire and give the position away',
      hold: 'Whisper it in and stay where you are',
      cover: 'Break for the wire now and hope they hold fire',
    },
    did: {
      push: 'opened fire from a listening post and gave away the position',
      hold: 'stayed hidden and reported an enemy approach from feet away',
      cover: 'ran for the wire in the dark to warn the position',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-ditch-with-everybody-in-it',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The whole section is in one ditch and it is the only cover for ninety metres.',
      heavy: 'Everybody is in the same ditch and somebody is walking mortars towards it in fifty-metre steps.',
      overrun: 'The next one lands on the ditch. Everybody in the game knows it and nobody wants to be the first one out.',
    },
    labels: {
      push: 'Everybody out and forward, now',
      hold: 'Split the section — half out, half stay',
      cover: 'Out the back and accept losing the ground',
    },
    did: {
      push: 'took the section forward out of cover under indirect fire',
      hold: 'split the section rather than lose all of it in one place',
      cover: 'gave up the ground to get the section out of a registered ditch',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-stopped-vehicle',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'The lead vehicle has stopped and nobody in it is getting out.',
      heavy: 'The lead is burning and the road is walled on both sides, which is why they picked it.',
      overrun: 'Two vehicles are gone, the road behind is blocked, and the fire is coming from above you on both sides.',
    },
    labels: {
      push: 'Dismount and clear the high ground',
      hold: 'Get the vehicles through the gap and out',
      cover: 'Everybody to the lead vehicle and get the crew out first',
    },
    did: {
      push: 'dismounted into an ambush and went for the high ground',
      hold: 'pushed the remaining vehicles through and out of the killing area',
      cover: 'went to the burning lead vehicle for its crew before anything else',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'upstairs',
    tags: ['combat_breach', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Ground floor is clear. The stairs are wooden and there is one way up.',
      heavy: 'Somebody is up there and the staircase is a straight run with no turn to take cover behind.',
      overrun: 'They are upstairs and they are shooting down through the floor at the sound of you.',
    },
    labels: {
      push: 'Take the stairs',
      hold: 'Hold the bottom and make them come down',
      cover: 'Everybody out of the building and level it another way',
    },
    did: {
      push: 'led men up an open staircase into an occupied floor',
      hold: 'held the ground floor and waited them out',
      cover: 'withdrew from a building rather than fight up a staircase',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'mortars-on-the-patrol-base',
    tags: ['base_defense'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'Two came in wide. Everybody is in the bunkers and the stand-to has not been called.',
      heavy: 'They have the range now and the third one took the cookhouse roof off.',
      overrun: 'The barrage is walking through the position and the wire on the east side is being cut while it does.',
    },
    labels: {
      push: 'Man the east wall through the barrage',
      hold: 'Stay in the bunkers until it lifts',
      cover: 'Get the wounded to the aid post between salvoes',
    },
    did: {
      push: 'manned a wall under indirect fire to meet an assault',
      hold: 'kept the section under cover through a barrage',
      cover: 'moved casualties between salvoes instead of manning the wall',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-one-who-runs',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of the young ones has come off his weapon and is looking at the way back.',
      heavy: 'He is up and going and if he gets ten metres two more will follow him.',
      overrun: 'Half the section is watching him go and the position only works if everybody stays in it.',
    },
    labels: {
      push: 'Go after him and bring him back',
      hold: 'Shout the rest of them back onto their arcs',
      cover: 'Let him go and close the gap he left',
    },
    did: {
      push: 'left cover to bring back a man who had broken',
      hold: 'held the rest of the section on their arcs and let one go',
      cover: 'closed the gap and said nothing about the man who left it',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-canal',
    tags: ['combat_firefight', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Chest-deep water, four metres across, and one footbridge that everybody can see.',
      heavy: 'The bridge is covered and the water is slow enough that a man in it is a man standing still.',
      overrun: 'You are being pushed back onto the canal and there is no third way over it.',
    },
    labels: {
      push: 'Rush the bridge',
      hold: 'Into the water in twos, weapons up',
      cover: 'Hold this bank and let them come to you',
    },
    did: {
      push: 'took a covered footbridge at a run',
      hold: 'crossed a canal in the water under observation',
      cover: 'held the near bank rather than cross',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'stand-to-contact',
    tags: ['base_defense', 'combat_firefight'],
    channels: ['base-attack-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'First light, everybody on the wall, and the treeline is closer than it was yesterday because somebody has cut it.',
      heavy: 'They came in on stand-to, which means they watched you do it every morning for a week.',
      overrun: 'They are inside the wire on the north side and it is still too dark to tell who is who.',
    },
    labels: {
      push: 'Counterattack into the wire now',
      hold: 'Hold the inner line and identify before firing',
      cover: 'Pull everybody back to the centre and give up the perimeter',
    },
    did: {
      push: 'counterattacked into the wire in the half-dark',
      hold: 'held the inner line and made every man identify before firing',
      cover: 'gave up the perimeter to consolidate the position',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-treeline-that-goes-quiet',
    tags: ['combat_firefight', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The birds went out of the treeline about a minute ago and have not come back.',
      heavy: 'The whole wood has gone silent and the patrol is strung out across the last of the open.',
      overrun: 'It opens up from the wood at forty metres with the patrol in the middle of the field.',
    },
    labels: {
      push: 'Assault straight into the wood',
      hold: 'Go firm and put fire into the treeline',
      cover: 'Back the way you came, fast',
    },
    did: {
      push: 'assaulted an occupied wood across open ground',
      hold: 'went firm in the open and fought the treeline',
      cover: 'withdrew a patrol back across the open under fire',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-drop-in-the-wrong-field',
    tags: ['combat_firefight', 'base_defense'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The resupply has gone into the field on the far side of the road. It is all there and it is all in the open.',
      heavy: 'The stores are in the open and somebody has been watching the field since the aircraft left.',
      overrun: 'Whoever gets to those crates first has ammunition and whoever does not runs out this afternoon.',
    },
    labels: {
      push: 'Go and get it',
      hold: 'Wait for dark and take what is left',
      cover: 'Destroy it where it lies so nobody gets it',
    },
    did: {
      push: 'recovered a resupply from open ground under observation',
      hold: 'waited for dark and recovered what had not been taken',
      cover: 'destroyed a resupply rather than let it be captured',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-prisoner-on-the-objective',
    tags: ['combat_breach', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of them has put his hands up in the corner of the room and there are two more rooms to clear.',
      heavy: 'He is surrendering and he is between you and the next doorway and the section is stacked behind you.',
      overrun: 'He has his hands up, the building is not clear, and there is no one to spare to watch him.',
    },
    labels: {
      push: 'Leave a man on him and keep clearing',
      hold: 'Stop the clearance and secure him properly',
      cover: 'Push him ahead of you into the next room',
    },
    did: {
      push: 'left one man guarding a prisoner and continued the clearance a man short',
      hold: 'halted a clearance to secure a prisoner correctly',
      cover: 'used a prisoner to lead the entry into an uncleared room',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-gun-that-will-not-clear',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The section gun has stopped and the number two is head-down over it with the fire still coming.',
      heavy: 'It has been down for ninety seconds. Without it the position is four rifles and an opinion.',
      overrun: 'The gun is dead and they have noticed it is dead, and they are coming on the side it used to cover.',
    },
    labels: {
      push: 'Get on the gun yourself and clear it under fire',
      hold: 'Cover the gun group and let them work',
      cover: 'Abandon the gun and get the group out of that position',
    },
    did: {
      push: 'worked on a stopped machine gun under direct fire',
      hold: 'covered the gun group while they cleared a stoppage',
      cover: 'abandoned a machine gun position to save its crew',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-house-with-people-still-in-it',
    tags: ['combat_breach', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There is washing on the line and fire is coming from the upper floor of the same building.',
      heavy: 'A family is in the ground floor of a house that is being fought from above them.',
      overrun: 'The building has to come down and there are people in the bottom of it who have nowhere to go.',
    },
    labels: {
      push: 'Fight up through it as it is',
      hold: 'Get the family out first, whatever it costs in time',
      cover: 'Pull back and leave the building alone',
    },
    did: {
      push: 'fought up through an occupied house',
      hold: 'stopped an assault to evacuate civilians first',
      cover: 'withdrew rather than fight through a house with a family in it',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
  {
    id: 'the-last-vehicle-out',
    tags: ['combat_convoy_ambush', 'combat_firefight'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'The order to withdraw has come and there is one vehicle and more men than seats.',
      heavy: 'Everybody who is walking is walking. The wounded have the seats and the vehicle leaves in two minutes.',
      overrun: 'It goes now or it does not go. Whoever is not on it is on foot with what they are carrying.',
    },
    labels: {
      push: 'Hold the ground until everybody is aboard',
      hold: 'Send it now with the wounded and walk out',
      cover: 'Overload it and go — nobody walks',
    },
    did: {
      push: 'held a position to cover the last vehicle out',
      hold: 'sent the wounded ahead and withdrew on foot',
      cover: 'overloaded the last vehicle rather than leave anybody walking',
    },
    unitId: null,
    specialtyIds: ['rifleman'],
    biasToward: null,
  },
]
