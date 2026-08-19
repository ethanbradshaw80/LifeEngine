/**
 * THE DEEP END — the Vanguard Group, Task Unit Ember, and the Grey Section.
 *
 * These are the three units nobody is promoted past. Two are tier 2, fed by
 * the Pathfinders and the Trident respectively; the Grey Section is tier 3
 * and belongs to no branch at all, takes nobody below the sixth rank, and is
 * the only unit in the game with no required badge — because what it selects
 * on is not a course.
 *
 * WHAT SEPARATES THEM FROM THE TIER BELOW. A Pathfinder's problem is a task
 * that has gone wrong with nobody coming. These units' problems are that the
 * task is not the sort anybody will admit to afterwards, and the decision is
 * usually about a person rather than a piece of ground: whether to trust
 * them, whether to leave them, whether to be the thing that happens to them.
 *
 * VANGUARD works BY, WITH AND THROUGH other people — a twelve-man team
 * raising and running a force of locals it does not command and cannot
 * discipline. Its recurring shape is divided loyalty.
 *
 * TASK UNIT EMBER is the Trident's harder edge: the same water and darkness,
 * but the target is a person or a room rather than a hull.
 *
 * GREY SECTION is one or two people a very long way from anyone, where the
 * cost of being seen is not casualties but a government's ability to say it
 * was not there.
 *
 * A unit scene must lean (scenes.test.ts). None of these are light days.
 */

import type { CombatScene } from './types.js'

/** THE VANGUARD GROUP — by, with and through people who are not yours. */
export const VANGUARD_SCENES: readonly CombatScene[] = [
  {
    id: 'vg-the-men-you-trained',
    tags: ['combat_firefight', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The company you raised has been ordered somewhere you would not send them.',
      heavy: 'They are going, they are not ready, and they think you are coming.',
      overrun: 'They have gone in without you and it has already started to come apart.',
    },
    labels: {
      push: 'Go with them regardless of orders',
      hold: 'Stay behind and run it from the radio',
      cover: 'Refuse to release them and take the consequences',
    },
    did: {
      push: 'went into an operation with partnered troops against his orders',
      hold: 'directed partnered troops by radio from outside',
      cover: 'refused to release partnered troops for an operation',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-commander-who-is-stealing',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The partner commander is selling a share of the ammunition and his men know it.',
      heavy: 'He is selling it, they are short because of it, and he is also the only man they will follow.',
      overrun: 'A patrol went out under-supplied and did not all come back.',
    },
    labels: {
      push: 'Report him and lose the force',
      hold: 'Confront him privately and keep the force together',
      cover: 'Route supplies around him directly to the companies',
    },
    did: {
      push: 'reported a partner commander for theft and lost the force',
      hold: 'confronted a partner commander privately',
      cover: 'bypassed a partner commander to supply his companies directly',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-boy-in-the-ranks',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of the recruits is plainly a good deal younger than the paper says.',
      heavy: 'He is about fourteen, he is armed, and his uncle is the company commander.',
      overrun: 'He is in the assault element and the assault goes tonight.',
    },
    labels: {
      push: 'Refuse to move until he is out of the line',
      hold: 'Pull him to the rear yourself, quietly',
      cover: 'Say nothing — it is their force and their custom',
    },
    did: {
      push: 'halted an operation over a child in the partnered ranks',
      hold: 'quietly moved a child out of a partnered assault element',
      cover: 'said nothing about a child soldier in a partnered force',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-informer',
    tags: ['combat_patrol_ied', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The source has given three good pieces of information and one that got somebody killed.',
      heavy: 'The last tip was a setup and he is asking to meet again tonight.',
      overrun: 'He is at the meeting site early and there are vehicles on the road above it.',
    },
    labels: {
      push: 'Meet him and find out',
      hold: 'Send a partner to meet him and watch from a distance',
      cover: 'Burn the source and move the safe house',
    },
    did: {
      push: 'met a source he believed had already betrayed him',
      hold: 'sent a partnered soldier to a meeting he would not attend',
      cover: 'burned a source and relocated the team',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-village-that-asks',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The elders have asked for weapons to defend themselves and they mean it.',
      heavy: 'They will be attacked within the week and they know which of their neighbours will do it.',
      overrun: 'It has started and they are asking for what is in your trucks.',
    },
    labels: {
      push: 'Arm them',
      hold: 'Leave a team with them instead of weapons',
      cover: 'Refuse and advise them to move',
    },
    did: {
      push: 'armed a village against its neighbours',
      hold: 'left a team in a village rather than arm it',
      cover: 'refused arms to a village that was about to be attacked',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-prisoner-they-took',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The partner force has taken a prisoner and put him in a room you are not invited into.',
      heavy: 'There is noise from that room and you are the only one who is going to do anything about it.',
      overrun: 'It has gone past noise.',
    },
    labels: {
      push: 'Go in and stop it',
      hold: 'Order it stopped through their commander',
      cover: 'Report it up the chain and stay out of the room',
    },
    did: {
      push: 'physically intervened in a partner force’s treatment of a prisoner',
      hold: 'went through a partner commander to stop an interrogation',
      cover: 'reported a partner force upward and did not intervene',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-defection',
    tags: ['combat_firefight', 'base_defense'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'Two of the partnered soldiers did not come back from leave.',
      heavy: 'Two are gone with their weapons and they know the camp layout.',
      overrun: 'One of them is on the wire tonight, calling the sentries by name.',
    },
    labels: {
      push: 'Move the camp tonight',
      hold: 'Change the routine and stay',
      cover: 'Disarm the whole partnered company until it is sorted',
    },
    did: {
      push: 'moved a camp overnight after a defection',
      hold: 'changed a camp’s routine and stayed after a defection',
      cover: 'disarmed an entire partnered company on suspicion',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-language',
    tags: ['combat_firefight', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The interpreter has been shading what the commander says and you have started to notice.',
      heavy: 'He is softening orders you gave and you cannot tell whether it is fear or something worse.',
      overrun: 'A whole assault has gone the wrong way and the only account of why is his.',
    },
    labels: {
      push: 'Replace him now, mid-operation',
      hold: 'Keep him and start checking every sentence',
      cover: 'Work without an interpreter at all',
    },
    did: {
      push: 'replaced an interpreter in the middle of an operation',
      hold: 'kept a suspect interpreter under verification',
      cover: 'ran an operation without an interpreter',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-long-way-in',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The infiltration is eleven days on foot with a force that has never done more than three.',
      heavy: 'They are already dropping equipment on day four and the objective is day nine.',
      overrun: 'Two of the partnered men have simply sat down and will not get up.',
    },
    labels: {
      push: 'Drive them on and make the timing',
      hold: 'Slow the whole force to the pace of its worst men',
      cover: 'Send the strongest ahead and leave the rest with a team',
    },
    did: {
      push: 'drove an exhausted partnered force to meet a timing',
      hold: 'slowed an infiltration to the pace of its weakest',
      cover: 'split a partnered force and left the weakest behind',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-strike-you-can-call',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The target building is confirmed and there are people going in and out of it who are not fighters.',
      heavy: 'It is the right building, it is full, and the window is minutes.',
      overrun: 'Your own partnered company is close enough that the strike will reach them too.',
    },
    labels: {
      push: 'Call it',
      hold: 'Wait for the building to clear and lose the target',
      cover: 'Take it on the ground instead, with what you have',
    },
    did: {
      push: 'called a strike onto an occupied building',
      hold: 'let a target go rather than strike a full building',
      cover: 'assaulted a target on the ground to avoid a strike',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-team-sergeant',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Your team sergeant disagrees with the plan and has said so in front of the partners.',
      heavy: 'He is right about the plan and he has undermined you in front of men who count face.',
      overrun: 'The partners are now looking at him instead of you and the operation starts in an hour.',
    },
    labels: {
      push: 'Take his plan and say publicly that it is his',
      hold: 'Hold your plan and settle it afterwards',
      cover: 'Give him the operation entirely',
    },
    did: {
      push: 'publicly adopted his sergeant’s plan over his own',
      hold: 'held his own plan and dealt with the dissent later',
      cover: 'handed an operation to his team sergeant',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-withdrawal',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The order has come to end the programme and hand everything over in ninety days.',
      heavy: 'Ninety days, and the force you built will not last thirty without you.',
      overrun: 'The date has moved forward and the handover is now a fortnight.',
    },
    labels: {
      push: 'Tell them the truth about what is coming',
      hold: 'Follow the plan and say what you were told to say',
      cover: 'Get the ones most at risk onto a list and fight for them',
    },
    did: {
      push: 'told a partnered force plainly that it was being abandoned',
      hold: 'delivered the official line about a withdrawal',
      cover: 'fought to get partnered soldiers onto an evacuation list',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-cache-in-the-mosque',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The weapons are in a building nobody is supposed to enter.',
      heavy: 'They are in there, it is confirmed, and entering it will cost you the district.',
      overrun: 'They are being moved out of it while you are still asking.',
    },
    labels: {
      push: 'Go in',
      hold: 'Send the partnered force in alone and stay outside',
      cover: 'Watch it and take the weapons when they move',
    },
    did: {
      push: 'entered a protected building for a weapons cache',
      hold: 'sent partnered troops into a protected building alone',
      cover: 'let a cache move rather than enter a protected building',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-man-who-wants-out',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A fighter from the other side has come in and says he wants to change sides.',
      heavy: 'He is offering names and the partner commander wants to shoot him.',
      overrun: 'He is worth more alive than anybody in this camp is willing to admit.',
    },
    labels: {
      push: 'Protect him and take him out yourself',
      hold: 'Hand him to the partner force as protocol requires',
      cover: 'Take what he knows and then hand him over',
    },
    did: {
      push: 'protected a defector from his own partner force',
      hold: 'handed a defector to the partner force as required',
      cover: 'debriefed a defector and then handed him over',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-medical-clinic',
    tags: ['med_treat_under_fire'],
    channels: ['direct-combat-exposure', 'base-attack-exposure'],
    tell: {
      light: 'The team medic has been running a clinic for the village and the queue is now enormous.',
      heavy: 'The clinic is the reason the village talks to you and it is also a fixed time and place.',
      overrun: 'Somebody has worked out that the clinic is a fixed time and place.',
    },
    labels: {
      push: 'Keep running it as it is',
      hold: 'Move it, change the day, and lose half the trust',
      cover: 'Shut it down entirely',
    },
    did: {
      push: 'kept a clinic running at a known time and place',
      hold: 'moved a clinic and lost the trust it had built',
      cover: 'closed a village clinic for security',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-two-orders',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The partner commander and your own headquarters want different things this week.',
      heavy: 'They want opposite things and both are watching what you do.',
      overrun: 'The partner force has begun moving on its own orders and your headquarters does not know.',
    },
    labels: {
      push: 'Go with the partners and tell your own people after',
      hold: 'Follow your own chain and hold the partners back',
      cover: 'Stall both until somebody senior settles it',
    },
    did: {
      push: 'followed a partner force’s orders over his own headquarters',
      hold: 'held a partner force back to follow his own chain',
      cover: 'stalled two conflicting chains of command',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-last-man-in-the-team',
    tags: ['combat_firefight', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Of twelve, four are wounded, two are out, and the operation continues.',
      heavy: 'You are down to six Americans among two hundred partnered soldiers.',
      overrun: 'You are the only one of your team still on his feet.',
    },
    labels: {
      push: 'Keep the team in the fight at six',
      hold: 'Pull the team out and leave the partners to it',
      cover: 'Call for replacements and hold everything until they come',
    },
    did: {
      push: 'kept a half-strength team committed among a partnered force',
      hold: 'withdrew his team and left the partnered force fighting',
      cover: 'halted operations until replacements arrived',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-what-they-do-when-you-go',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The company you trained has taken a village without you and there are reports about it.',
      heavy: 'The reports are consistent and they are about people who were not fighting.',
      overrun: 'They did it with the training you gave them and the weapons you drew for them.',
    },
    labels: {
      push: 'Report it in full and end the partnership',
      hold: 'Investigate it yourself first',
      cover: 'Report it and stay to make sure it does not happen again',
    },
    did: {
      push: 'reported a partnered force’s crimes and ended the partnership',
      hold: 'investigated allegations against his own partnered force',
      cover: 'reported a partnered force and remained with it',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
  {
    id: 'vg-the-radio-that-listens-back',
    tags: ['combat_firefight', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The partnered company is using its own radios on its own frequencies and you cannot hear them.',
      heavy: 'They are being listened to and they will not change, because the radios were a gift and changing insults the giver.',
      overrun: 'An ambush has been laid on a route only their net discussed.',
    },
    labels: {
      push: 'Take their radios off them',
      hold: 'Teach them the discipline and hope it takes',
      cover: 'Feed their net false routes and watch what happens',
    },
    did: {
      push: 'confiscated a partnered force’s radios',
      hold: 'trained a partnered force in signals discipline under fire',
      cover: 'fed a compromised partner net false information',
    },
    unitId: 'vanguard',
    biasToward: 'heavy',
  },
  {
    id: 'vg-the-promise-you-made',
    tags: ['combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'You told them air support would come if they went, and you believed it.',
      heavy: 'They went, they are in contact, and the aircraft have been retasked elsewhere.',
      overrun: 'They are asking for what you promised, by name, on an open net.',
    },
    labels: {
      push: 'Go to them on the ground yourself',
      hold: 'Tell them the truth and let them break contact',
      cover: 'Keep asking for aircraft and say nothing yet',
    },
    did: {
      push: 'went forward alone to a partnered force he had promised support to',
      hold: 'admitted to a partnered force that the support was not coming',
      cover: 'held back the truth while chasing air support',
    },
    unitId: 'vanguard',
    biasToward: 'overrun',
  },
]

/** TASK UNIT EMBER — the Trident's harder edge; the target is a person. */
export const EMBER_SCENES: readonly CombatScene[] = [
  {
    id: 'em-the-room-at-the-end',
    tags: ['combat_breach', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The man you came for is behind the last door and there are others in the house.',
      heavy: 'The door is barricaded and the house has woken up around you.',
      overrun: 'He is behind it and so are the people he lives with.',
    },
    labels: {
      push: 'Breach it now',
      hold: 'Call him out and give him the chance',
      cover: 'Withdraw and take him another day',
    },
    did: {
      push: 'breached a barricaded room with non-combatants inside',
      hold: 'called a barricaded target out rather than breach',
      cover: 'withdrew from an objective rather than breach onto a family',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-boat-that-is-late',
    tags: ['sea_smallboat_attack', 'sea_manoverboard'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The extraction boat is nine minutes late and the beach is starting to be used.',
      heavy: 'Twenty minutes late, and there are lights coming down the coast road.',
      overrun: 'It is not answering at all and the tide is going out from under the only cover there is.',
    },
    labels: {
      push: 'Hold the beach and wait for it',
      hold: 'Swim for the alternate and abandon the equipment',
      cover: 'Take a local boat and pay for it however you have to',
    },
    did: {
      push: 'held an exposed beach for a late extraction',
      hold: 'abandoned equipment and swam for an alternate pickup',
      cover: 'commandeered a local boat for an extraction',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-wrong-man',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The man on the floor does not match the photograph as well as everybody would like.',
      heavy: 'He is not the target, he is somebody’s father, and the objective is not secure.',
      overrun: 'The real one is somewhere in the compound and the assault has already been heard.',
    },
    labels: {
      push: 'Keep clearing until you find him',
      hold: 'Take the man you have and go',
      cover: 'Leave the compound entirely and come back with better information',
    },
    did: {
      push: 'continued clearing a compromised objective for the right man',
      hold: 'took the wrong man off an objective rather than stay',
      cover: 'abandoned an objective after a misidentification',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-swimmer-below',
    tags: ['sea_manoverboard'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'There is a second swimmer under the hull who is not one of yours.',
      heavy: 'He has seen you and he is between the team and its own charges.',
      overrun: 'He has a knife out and there is no surface to go to.',
    },
    labels: {
      push: 'Deal with him under the water',
      hold: 'Break contact and go around the hull',
      cover: 'Abort and take the team off',
    },
    did: {
      push: 'fought another diver beneath a hull',
      hold: 'broke contact underwater and worked around the hull',
      cover: 'aborted an attack after an underwater compromise',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-hostage',
    tags: ['combat_breach', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There is a hostage in the building and the assault has been authorised.',
      heavy: 'She is in the room with two of them and the walls are thin enough to shoot through.',
      overrun: 'They have started moving her and the window is closing.',
    },
    labels: {
      push: 'Go now and shoot through',
      hold: 'Wait for a clean entry that may not come',
      cover: 'Take the guards outside first and lose surprise inside',
    },
    did: {
      push: 'assaulted through a wall with a hostage in the room',
      hold: 'waited for a clean entry while a hostage was moved',
      cover: 'engaged external guards first and lost surprise',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-rig',
    tags: ['sea_smallboat_attack', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The platform is eighty metres above the water and the only way up is the outside.',
      heavy: 'The ladder is lit, the swell is running, and there are men on the deck above.',
      overrun: 'They are cutting the caving ladder while the team is on it.',
    },
    labels: {
      push: 'Climb faster',
      hold: 'Drop back to the boats and try the other leg',
      cover: 'Go to the water and abort',
    },
    did: {
      push: 'climbed a lit platform ladder as it was being cut',
      hold: 'dropped off a compromised ladder to try another approach',
      cover: 'aborted a platform assault into the water',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-crew-below',
    tags: ['combat_breach', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The ship’s crew are locked in the mess and one of them is hammering on the door.',
      heavy: 'They are locked in and there is smoke going into that compartment.',
      overrun: 'The ship is settling and the door is jammed from the outside.',
    },
    labels: {
      push: 'Stop and get them out',
      hold: 'Finish the objective first and come back for them',
      cover: 'Send two men back and continue with the rest',
    },
    did: {
      push: 'stopped an assault to free a trapped crew',
      hold: 'finished an objective before freeing a trapped crew',
      cover: 'split the assault to free a trapped crew',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-name-on-the-list',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The name on tonight’s list is somebody the team took prisoner two years ago.',
      heavy: 'He was released, he is back, and men from this unit died the first time.',
      overrun: 'He is on the objective and the team knows exactly who he is.',
    },
    labels: {
      push: 'Take him alive again',
      hold: 'Treat it as any other objective',
      cover: 'Hand the assault to another element',
    },
    did: {
      push: 'took a released prisoner alive a second time',
      hold: 'treated a personally significant target as routine',
      cover: 'handed an assault to another element to avoid his own team’s history',
    },
    unitId: 'task-unit-ember',
    biasToward: 'heavy',
  },
  {
    id: 'em-the-current-under-the-ice',
    tags: ['sea_manoverboard'],
    channels: ['battlefield-accident', 'direct-combat-exposure'],
    tell: {
      light: 'The dive is under ice with one hole in and one hole out.',
      heavy: 'The current is stronger than briefed and the out-hole is downstream.',
      overrun: 'A man has lost the line under the ice.',
    },
    labels: {
      push: 'Go after him under the ice',
      hold: 'Hold the line and let him find his way back to it',
      cover: 'Surface everybody and cut a new hole',
    },
    did: {
      push: 'went after a diver who had lost the line beneath ice',
      hold: 'held the line for a lost diver rather than follow',
      cover: 'aborted a dive and cut a new hole through the ice',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-photographs',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The objective has produced documents nobody briefed you to expect.',
      heavy: 'They are about people on your own side and there is one minute left on the objective.',
      overrun: 'They are burning them in the next room while you are reading.',
    },
    labels: {
      push: 'Take everything and run over time',
      hold: 'Take what you can carry in the time you have',
      cover: 'Photograph and leave them where they were found',
    },
    did: {
      push: 'stayed over time on an objective to recover documents',
      hold: 'took what could be carried within the time on target',
      cover: 'photographed sensitive documents and left them in place',
    },
    unitId: 'task-unit-ember',
    biasToward: 'heavy',
  },
  {
    id: 'em-the-dog',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The compound has a dog and the dog has started.',
      heavy: 'It has not stopped and lights are coming on across the courtyard.',
      overrun: 'The whole compound is awake and the team is still outside the wall.',
    },
    labels: {
      push: 'Go over the wall now, into it',
      hold: 'Withdraw and come back another night',
      cover: 'Take the outer buildings first and work in',
    },
    did: {
      push: 'assaulted a compound that was already awake',
      hold: 'withdrew from a compromised compound',
      cover: 'cleared outward buildings first on a compromised objective',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-man-who-surrenders-late',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'He has put his weapon down after firing it and he is smiling about it.',
      heavy: 'He killed one of yours ninety seconds ago and he is now unarmed and compliant.',
      overrun: 'He is unarmed, he is laughing, and one of your team has not lowered his rifle.',
    },
    labels: {
      push: 'Take him, and get between him and your own man',
      hold: 'Restrain your own man first and take the prisoner second',
      cover: 'Hand the prisoner to somebody who was not in the room',
    },
    did: {
      push: 'physically protected a prisoner from his own team',
      hold: 'restrained one of his own before securing a prisoner',
      cover: 'passed a prisoner to men who had not been in the fight',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-second-target',
    tags: ['combat_breach', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A second objective has come up while the team is still on the first.',
      heavy: 'It is twenty minutes away, it will not be there tomorrow, and the team is short of everything.',
      overrun: 'The team has wounded, no ammunition to speak of, and the second target is confirmed.',
    },
    labels: {
      push: 'Go straight on to it',
      hold: 'Finish here properly and let the second go',
      cover: 'Send the fit half on and take the wounded out',
    },
    did: {
      push: 'went straight on to a second objective with a spent team',
      hold: 'let a target go rather than commit an exhausted team',
      cover: 'split a team between a second objective and a casualty evacuation',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-water-you-cannot-see-in',
    tags: ['sea_manoverboard', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The harbour is running with silt and visibility is a hand’s width.',
      heavy: 'The team is navigating by compass and count alone and the count has been wrong once already.',
      overrun: 'Nobody is where they think they are and the charges are timed.',
    },
    labels: {
      push: 'Press on by dead reckoning',
      hold: 'Surface to fix the position and risk being seen',
      cover: 'Recall the team and reset the charges',
    },
    did: {
      push: 'pressed on by dead reckoning in zero visibility',
      hold: 'surfaced in a hostile harbour to fix a position',
      cover: 'recalled a dive team and reset timed charges',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-boy-with-the-phone',
    tags: ['combat_breach', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A boy on the roof opposite has been watching the approach and talking into a phone.',
      heavy: 'He has been talking for two minutes and the assault has not started.',
      overrun: 'Whatever he has said, there is now movement at the objective.',
    },
    labels: {
      push: 'Go immediately, before it can be acted on',
      hold: 'Hold and see whether it was anything',
      cover: 'Abort and come back when the pattern has settled',
    },
    did: {
      push: 'launched an assault early to beat a warning',
      hold: 'held an assault to see whether a compromise was real',
      cover: 'aborted an assault on a possible compromise',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-body-you-cannot-leave',
    tags: ['combat_rescue', 'sea_manoverboard'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of the team is dead on the objective and the boats are waiting.',
      heavy: 'He is dead, he is heavy, and carrying him costs the team its speed.',
      overrun: 'Carrying him means somebody else is likely to join him.',
    },
    labels: {
      push: 'Carry him out whatever it costs',
      hold: 'Carry him to the water and take him from there',
      cover: 'Leave him and mark the position',
    },
    did: {
      push: 'carried a dead teammate out at the cost of the team’s speed',
      hold: 'carried a body to the water line and swam him out',
      cover: 'left a teammate’s body on the objective and marked it',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-order-from-a-long-way-off',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody watching this on a screen has told you to go left.',
      heavy: 'The screen says left, the ground says right, and the screen is senior.',
      overrun: 'The screen is still saying left and it is now obviously wrong.',
    },
    labels: {
      push: 'Go right and answer for it afterwards',
      hold: 'Go left as ordered',
      cover: 'Stop and argue it out on the net',
    },
    did: {
      push: 'disregarded a remote order and used his own judgement on the ground',
      hold: 'followed a remote order he believed to be wrong',
      cover: 'halted an assault to contest an order over the radio',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-what-the-tape-shows',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Something happened in the third room and the accounts do not agree.',
      heavy: 'Two of the team say one thing and the camera says another.',
      overrun: 'The camera is clear and it is one of your own men in it.',
    },
    labels: {
      push: 'Submit it exactly as recorded',
      hold: 'Ask him about it first, then submit it',
      cover: 'Report it and stand beside him through what follows',
    },
    did: {
      push: 'submitted footage that condemned one of his own',
      hold: 'confronted a teammate before submitting the evidence',
      cover: 'reported a teammate and stood by him through the inquiry',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-tempo',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'This is the fourth objective in five nights and nobody has slept properly.',
      heavy: 'The team is making small mistakes and covering for each other about it.',
      overrun: 'Somebody flagged the wrong room tonight and it was very nearly a disaster.',
    },
    labels: {
      push: 'Keep the tempo — the targets are there now',
      hold: 'Stand the team down for two nights and lose the targets',
      cover: 'Rotate half the team out and run at half strength',
    },
    did: {
      push: 'maintained an operational tempo his team could no longer safely hold',
      hold: 'stood a team down and let targets go',
      cover: 'rotated half a team out and continued at half strength',
    },
    unitId: 'task-unit-ember',
    biasToward: 'overrun',
  },
  {
    id: 'em-the-quietest-part',
    tags: ['combat_breach', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The objective is over, the boats are gone, and the team is alone on a friendly beach.',
      heavy: 'It went well and one man has not spoken since the third room.',
      overrun: 'He has not spoken and he is due back on the water in six hours.',
    },
    labels: {
      push: 'Put him back on the water and watch him',
      hold: 'Take him off the rotation and say why',
      cover: 'Sit with him and tell nobody',
    },
    did: {
      push: 'kept a man on operations he had doubts about',
      hold: 'took a man off the rotation and recorded the reason',
      cover: 'sat with a teammate through the night and reported nothing',
    },
    unitId: 'task-unit-ember',
    biasToward: 'heavy',
  },
]

/** THE GREY SECTION — one or two people, and no one is coming. */
export const GREY_SCENES: readonly CombatScene[] = [
  {
    id: 'gs-the-cover-that-slips',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A clerk has asked a question your papers do not answer well.',
      heavy: 'He has asked twice and gone to fetch somebody.',
      overrun: 'Two men are walking back with him and one is not a clerk.',
    },
    labels: {
      push: 'Hold the cover and talk it through',
      hold: 'Leave now, calmly, and lose the meeting',
      cover: 'Abandon the identity entirely and go to the fallback',
    },
    did: {
      push: 'held a failing cover story through a challenge',
      hold: 'walked away from a compromised meeting',
      cover: 'burned an identity and went to a fallback',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-package',
    tags: ['combat_patrol_ied', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The dead drop has been serviced by somebody who is not your contact.',
      heavy: 'It has been opened and closed again badly, and what is in it is still there.',
      overrun: 'It is being watched from a car that has been in the same place for two days.',
    },
    labels: {
      push: 'Service it anyway',
      hold: 'Leave it and use the emergency signal',
      cover: 'Watch the watchers and find out who they are',
    },
    did: {
      push: 'serviced a dead drop he knew was watched',
      hold: 'abandoned a compromised drop and signalled emergency',
      cover: 'surveilled the surveillance on his own drop',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-agent-who-is-frightened',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Your source has asked to stop and is not saying why.',
      heavy: 'He wants out, his family are in the country, and what he still has is important.',
      overrun: 'He has been arrested and released, which is worse than arrested.',
    },
    labels: {
      push: 'Press him for one more collection',
      hold: 'Stand him down and try to get his family out',
      cover: 'Cut him loose now for both your sakes',
    },
    did: {
      push: 'pressed a frightened source for one more collection',
      hold: 'stood a source down and worked to move his family',
      cover: 'cut a compromised source loose',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-border-crossing',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The guard on the gate is new and is actually reading things.',
      heavy: 'He has taken your papers inside and the queue behind you is not moving.',
      overrun: 'The car is being searched and there is something in it that cannot be explained.',
    },
    labels: {
      push: 'Wait it out and be uninteresting',
      hold: 'Complain loudly, as a real traveller would',
      cover: 'Leave the vehicle and go on foot',
    },
    did: {
      push: 'sat through a search of a vehicle he could not explain',
      hold: 'played the indignant traveller through a border search',
      cover: 'abandoned a vehicle at a border and crossed on foot',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-face-you-know',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody in the hotel bar served with you nine years ago.',
      heavy: 'He has recognised you and he is coming over with his hand out.',
      overrun: 'He has said your real name across a room with the wrong people in it.',
    },
    labels: {
      push: 'Deny it flatly and hold the room',
      hold: 'Take him outside and explain nothing',
      cover: 'Leave the country tonight',
    },
    did: {
      push: 'denied his own name in a room that had heard it',
      hold: 'removed a man who had recognised him',
      cover: 'left a country the same night he was recognised',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-room-you-have-to-enter',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The office has an alarm you can beat and a cleaner who comes at eleven.',
      heavy: 'The cleaner has come early and is in the corridor.',
      overrun: 'She is in the room and she has seen you.',
    },
    labels: {
      push: 'Finish what you came for',
      hold: 'Leave immediately with nothing',
      cover: 'Wait her out inside the room',
    },
    did: {
      push: 'completed an entry after being seen',
      hold: 'abandoned an entry rather than be seen twice',
      cover: 'hid inside a room while it was cleaned around him',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-no-one-is-coming',
    tags: ['combat_patrol_ied', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The scheduled contact has been missed twice and there is no fallback for a third.',
      heavy: 'Nobody has answered for eleven days and the money is nearly gone.',
      overrun: 'There is no plan for this and there was never going to be one.',
    },
    labels: {
      push: 'Continue the task alone and indefinitely',
      hold: 'Make your own way to a neighbouring country',
      cover: 'Go to an embassy and end the deniability',
    },
    did: {
      push: 'continued a task alone after all contact was lost',
      hold: 'exfiltrated overland on his own initiative',
      cover: 'walked into an embassy and ended his own deniability',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-thing-you-were-told-to-do',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The tasking is lawful, and it is the kind of lawful that people argue about.',
      heavy: 'It is a person, it is authorised in writing, and the writing will not survive the week.',
      overrun: 'The circumstances have changed and the authorisation has not.',
    },
    labels: {
      push: 'Carry out the tasking as written',
      hold: 'Refer it back and wait, knowing the window will close',
      cover: 'Refuse it and put your reasons in writing',
    },
    did: {
      push: 'carried out a tasking after its circumstances had changed',
      hold: 'referred a tasking back and let the window close',
      cover: 'refused a tasking in writing',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-second-man-in-the-team',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Your partner has been drinking and there are only two of you.',
      heavy: 'He is drinking because of the last one and he is the only support there is.',
      overrun: 'He has missed a meeting and you do not know where he is.',
    },
    labels: {
      push: 'Go and find him',
      hold: 'Carry the task alone and cover for him',
      cover: 'Report him and work alone officially',
    },
    did: {
      push: 'went looking for a partner who had gone missing',
      hold: 'covered for a failing partner and worked alone',
      cover: 'reported his own partner as unfit',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-camera-on-the-corner',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There are more cameras on this route than there were last month.',
      heavy: 'The route is covered end to end and the meeting cannot move.',
      overrun: 'You have been on camera on this route four times in three weeks.',
    },
    labels: {
      push: 'Walk it anyway and accept the record',
      hold: 'Take three hours of counter-surveillance and arrive late',
      cover: 'Cancel and rebuild the whole meeting plan',
    },
    did: {
      push: 'walked a covered route knowing it was recorded',
      hold: 'ran hours of counter-surveillance and arrived late',
      cover: 'cancelled a meeting and rebuilt the plan',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-money',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The payment for the source is more than the source is worth and everybody knows it.',
      heavy: 'He is asking for more and there is nobody to ask about it.',
      overrun: 'He has said what he will do if the money stops.',
    },
    labels: {
      push: 'Pay him and account for it later',
      hold: 'Refuse and hold the original terms',
      cover: 'Pay him out of your own resources',
    },
    did: {
      push: 'paid a source beyond his authority and accounted for it later',
      hold: 'refused a source’s demand and held the terms',
      cover: 'paid a source from his own pocket',
    },
    unitId: 'grey-section',
    biasToward: 'heavy',
  },
  {
    id: 'gs-the-hotel-room',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The room has been entered while you were out and nothing is missing.',
      heavy: 'Nothing is missing and the case has been opened and closed correctly, which is the point.',
      overrun: 'Whoever it was is still in the building.',
    },
    labels: {
      push: 'Stay in the room and see who comes',
      hold: 'Leave everything and go, now',
      cover: 'Change hotels and continue the task',
    },
    did: {
      push: 'stayed in a room he knew had been searched',
      hold: 'left everything in a searched room and went',
      cover: 'moved hotels and continued the task',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-what-they-will-say',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'If this goes wrong the official position is that you were never sent.',
      heavy: 'It has gone wrong and the official position is holding.',
      overrun: 'Your family are being told something that is not true and you cannot correct it.',
    },
    labels: {
      push: 'Hold to the cover completely',
      hold: 'Find a way to get one message home',
      cover: 'Break cover and force them to acknowledge you',
    },
    did: {
      push: 'held a cover story that left his family misinformed',
      hold: 'found a way to get one true message to his family',
      cover: 'broke cover to force an acknowledgement',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-local-who-helps',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A shopkeeper has worked out roughly what you are and has said nothing.',
      heavy: 'He has started leaving the back door open, which is help you did not ask for.',
      overrun: 'He has been taken in for questioning.',
    },
    labels: {
      push: 'Go after him',
      hold: 'Move everything and disappear from the district',
      cover: 'Get his family out and take the risk',
    },
    did: {
      push: 'intervened for a civilian who had helped him',
      hold: 'disappeared from a district and left a helper to his fate',
      cover: 'moved a helper’s family out at his own risk',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-team-that-needs-you',
    tags: ['combat_firefight', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'An assault force is coming in on information you provided.',
      heavy: 'They are coming in tonight and one detail you gave them has since changed.',
      overrun: 'They are on the ground and the detail matters.',
    },
    labels: {
      push: 'Break cover to warn them directly',
      hold: 'Send it through the channel and hope it arrives',
      cover: 'Go to the objective yourself',
    },
    did: {
      push: 'broke cover to warn an assault force directly',
      hold: 'sent a correction through channels and waited',
      cover: 'went to an objective himself to warn a force',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-years',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'You have been this other person for longer than you were yourself in uniform.',
      heavy: 'You answer to the false name faster than the real one now.',
      overrun: 'Somebody asked what you actually do and you had to think about it.',
    },
    labels: {
      push: 'Extend again',
      hold: 'Ask to be brought home at the end of this task',
      cover: 'Ask to be brought home now',
    },
    did: {
      push: 'extended a long-term deployment under an assumed identity',
      hold: 'asked to be recalled at the end of a task',
      cover: 'asked to be brought home immediately',
    },
    unitId: 'grey-section',
    biasToward: 'heavy',
  },
  {
    id: 'gs-the-choice-with-no-good-side',
    tags: ['combat_breach', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Protecting the source means letting the operation fail.',
      heavy: 'Saving the operation means the source will be identified within a week.',
      overrun: 'There is no version of the next hour in which everybody is all right.',
    },
    labels: {
      push: 'Save the operation',
      hold: 'Protect the source and let the operation go',
      cover: 'Try for both and probably get neither',
    },
    did: {
      push: 'saved an operation at the cost of a source’s life',
      hold: 'protected a source and let an operation fail',
      cover: 'attempted to save both a source and an operation',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
  {
    id: 'gs-the-way-out',
    tags: ['combat_patrol_ied', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The exfiltration route has one crossing and it closes at dawn.',
      heavy: 'It closes at dawn and you are carrying somebody who cannot walk fast.',
      overrun: 'It has closed and there is no second route in this country.',
    },
    labels: {
      push: 'Force the crossing',
      hold: 'Go to ground for a month and wait for another window',
      cover: 'Split up and let each take his own chance',
    },
    did: {
      push: 'forced a closed border crossing',
      hold: 'went to ground for a month awaiting a new window',
      cover: 'split a team so each could take his own chance',
    },
    unitId: 'grey-section',
    biasToward: 'overrun',
  },
]
