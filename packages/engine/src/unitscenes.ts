/**
 * THE SPECIAL UNITS' OWN WARS (owner's ruling, 2026-08-18: "do the special
 * forces units and logistics next").
 *
 * WHAT THE COUNT LOOKED LIKE BEFORE THIS FILE. Seven special units exist in
 * `content.ts`, and between them they had TEN scenes: Pathfinders 3, Trident
 * 3, Guardian Flight 2, Grey Section 2, and nothing whatsoever for the three
 * tier-2 units. That last part is the worst of it — Vanguard, the Nighthawks
 * and Task Unit Ember are what a tier-1 operator is PROMOTED INTO, so
 * reaching the top of the pack dropped a player back to a generic pool.
 * The reward for selection was a thinner war.
 *
 * WHY A UNIT OUTRANKS A TRADE in `pickScene`. Special units recruit from the
 * ordinary trades — a Pathfinder's record still says `rifleman`. If the
 * trade were checked first he would draw ordinary infantry scenes for a
 * career and never see the inside of his own unit, which is exactly the
 * blending the owner rejected. Being in Trident is a stronger fact about
 * your war than being a rifleman is.
 *
 * WHAT SEPARATES THESE FROM THE LINE INFANTRY. A rifleman's problems are
 * about GROUND. A special unit's problems are about the JOB and the fact
 * that there is no one else coming: the force is small, it is a long way
 * from help, and the decision is almost always whether to continue a task
 * that has already gone wrong. Compromise, not contact, is the recurring
 * shape. Nobody here gets to be relieved.
 *
 * THE OWNER'S OVERRIDE (§10) applies. Nothing here draws a number.
 */

import type { CombatScene } from './types.js'

/**
 * THE PATHFINDER BATTALION — in first, on the ground, marking what the rest
 * of the force is going to land on. Their decisions are about a timetable
 * somebody else is flying to.
 */
export const PATHFINDER_SCENES: readonly CombatScene[] = [
  {
    id: 'pf-the-lz-is-wrong',
    tags: ['combat_patrol_ied', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The field is soft. It will take the first three aircraft and then it will not take any more.',
      heavy: 'It is softer than the photographs and the lift is eleven minutes out with sixty men on it.',
      overrun: 'The ground will not hold and there is no alternate inside the fuel the lift is carrying.',
    },
    labels: {
      push: 'Mark it anyway and let them land',
      hold: 'Wave the lift off and take the blame',
      cover: 'Mark half of it and land them in packets',
    },
    did: {
      push: 'marked a landing zone he knew was marginal',
      hold: 'waved off a battalion lift on his own judgement',
      cover: 'split a lift across a half-serviceable landing zone',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-drop-short',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The stick has come down two fields long and the rally point is on the other side of a road.',
      heavy: 'Half the team is across a road that has traffic on it, in the dark, in a country that knows they are coming.',
      overrun: 'The team is scattered over a kilometre and first light is in forty minutes.',
    },
    labels: {
      push: 'Cross the road and collect them',
      hold: 'Go to ground and rally at last light tomorrow',
      cover: 'Break the task and get everybody to the alternate',
    },
    did: {
      push: 'crossed a trafficked road in darkness to collect a scattered stick',
      hold: 'lay up for a full day to rally a scattered team',
      cover: 'abandoned the task to recover the team',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-farmer',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A man has walked into the hide with a dog. He has seen the aerial before he has seen anybody.',
      heavy: 'He has seen the team and he has a phone in his hand and he is eight hundred metres from a village.',
      overrun: 'He is already walking back and the drop is in ninety minutes.',
    },
    labels: {
      push: 'Stop him leaving',
      hold: 'Hold him until the drop is in',
      cover: 'Let him go and move the whole team',
    },
    did: {
      push: 'stopped a civilian who had compromised the position',
      hold: 'detained a civilian until the operation was complete',
      cover: 'let a compromise walk and displaced the team',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-beacon-that-will-not-answer',
    tags: ['combat_patrol_ied', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The beacon is on and nothing is talking to it. The aircraft are twenty minutes out.',
      heavy: 'No beacon, no radio, and the only thing that will bring them onto the right field now is something burning on it.',
      overrun: 'They are inbound blind and there is fire on two sides of the zone.',
    },
    labels: {
      push: 'Light the zone by hand and stand in the open to do it',
      hold: 'Try the second set and accept the delay',
      cover: 'Abort the drop rather than bring them onto an unmarked field',
    },
    did: {
      push: 'marked a drop zone by hand, in the open, under fire',
      hold: 'delayed a drop to re-establish marking',
      cover: 'aborted a drop rather than risk an unmarked landing',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-bridge-they-need-tomorrow',
    tags: ['combat_breach', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The bridge is intact and guarded by four men who are not paying much attention.',
      heavy: 'It is intact, it is guarded properly, and the force that needs it is twelve hours behind you.',
      overrun: 'They are wiring it as you watch and there is no time to do this quietly.',
    },
    labels: {
      push: 'Take the bridge now with what you have',
      hold: 'Watch it and report — the main force can fight for it',
      cover: 'Cut the firing circuit and withdraw',
    },
    did: {
      push: 'seized a defended bridge with a reconnaissance team',
      hold: 'observed a bridge rather than commit to taking it',
      cover: 'cut a demolition circuit and withdrew unseen',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-man-who-cannot-walk',
    tags: ['combat_rescue', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'He came down badly and the ankle is wrong. The objective is nine kilometres away.',
      heavy: 'He cannot walk and the team cannot carry him and finish the task, and both are true at once.',
      overrun: 'Carrying him means the drop goes unmarked and the drop is sixty men.',
    },
    labels: {
      push: 'Leave two with him and take the rest on',
      hold: 'Whole team carries him — the task fails',
      cover: 'Hide him with a radio and come back after',
    },
    did: {
      push: 'split the team to leave an injured man behind and continue',
      hold: 'failed the task to carry an injured man out whole',
      cover: 'concealed an injured man and returned for him afterwards',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-first-light-in-the-open',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Dawn is in twenty minutes and the hide is four kilometres away over open ground.',
      heavy: 'It is getting light and there is a village between the team and any cover worth the name.',
      overrun: 'It is light. People are already out and the team is standing in a field.',
    },
    labels: {
      push: 'Move fast and be seen moving',
      hold: 'Lie up where you are, in the open, all day',
      cover: 'Take the village edge and hide among the buildings',
    },
    did: {
      push: 'moved a team across open ground in daylight',
      hold: 'lay up in the open through a full day',
      cover: 'concealed a team inside an inhabited village',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-second-team',
    tags: ['combat_firefight', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The other team has missed two scheduled calls. They are eleven kilometres north.',
      heavy: 'Three missed calls and a partial transmission that ended without a sign-off.',
      overrun: 'Somebody is using their callsign and getting the authentication wrong.',
    },
    labels: {
      push: 'Go north for them now',
      hold: 'Complete the task first, then go',
      cover: 'Report it and let higher decide',
    },
    did: {
      push: 'abandoned a task to go to another team that had gone silent',
      hold: 'finished the task before going to a silent team',
      cover: 'referred a silent team upward rather than act',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-cache',
    tags: ['combat_breach', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The cache is where it was said to be, and there is more in it than the report described.',
      heavy: 'It is a cache with people using it, and one of them is asleep against it.',
      overrun: 'It is being loaded onto vehicles as you watch and there is no time to call anything in.',
    },
    labels: {
      push: 'Hit it now',
      hold: 'Mark it and let the aircraft do it',
      cover: 'Photograph it, leave it untouched, and walk away',
    },
    did: {
      push: 'assaulted a weapons cache with a reconnaissance team',
      hold: 'marked a cache for air attack rather than assault it',
      cover: 'left a cache undisturbed to protect the reconnaissance',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-extraction-that-is-late',
    tags: ['combat_firefight', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The aircraft is forty minutes late and the team is sitting on an open hilltop.',
      heavy: 'Two hours late, no communications, and there is movement in the valley below.',
      overrun: 'It is not coming. There is a border sixteen kilometres away and everything in between is awake.',
    },
    labels: {
      push: 'Hold the hill and wait for it',
      hold: 'Move to the alternate pickup and try again tomorrow',
      cover: 'Walk out — sixteen kilometres, on foot, now',
    },
    did: {
      push: 'held an exposed pickup point waiting for a late aircraft',
      hold: 'moved to an alternate pickup and waited another day',
      cover: 'walked a team out overland rather than wait for extraction',
    },
    unitId: 'pathfinders',
    biasToward: 'overrun',
  },
  {
    id: 'pf-the-wrong-house',
    tags: ['combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The house matches the description and the number on the door is wrong by one.',
      heavy: 'You are stacked on a door and the man beside you is certain it is the next one along.',
      overrun: 'The street is awake, the assault has to go now, and two houses match.',
    },
    labels: {
      push: 'Go — the description is good enough',
      hold: 'Stop and confirm before anybody goes through a door',
      cover: 'Take both, gently, and sort it out inside',
    },
    did: {
      push: 'entered a house on a partial identification',
      hold: 'halted an assault to confirm the target address',
      cover: 'secured two houses to avoid entering the wrong one hard',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-dog',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A dog has been barking at the hide for six minutes and somebody in the compound has noticed.',
      heavy: 'The dog will not stop and a man has come out with a lamp to see what it is barking at.',
      overrun: 'It has brought four of them out and they are walking a line towards the ditch you are in.',
    },
    labels: {
      push: 'Deal with the dog',
      hold: 'Stay absolutely still and let it play out',
      cover: 'Withdraw now, before the line reaches you',
    },
    did: {
      push: 'silenced an animal that had compromised a hide',
      hold: 'lay still while a search passed within feet',
      cover: 'withdrew a hide before a search reached it',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-message-you-cannot-send',
    tags: ['combat_patrol_ied', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'You have something the force needs and the only way to send it is a transmission long enough to be found.',
      heavy: 'It is a column, it is moving, and the report takes ninety seconds to send.',
      overrun: 'They are already sweeping for transmitters and this one has to be four minutes long.',
    },
    labels: {
      push: 'Send it all, from here',
      hold: 'Send a fragment and move, then send the rest',
      cover: 'Move first, send from somewhere else, and be late',
    },
    did: {
      push: 'transmitted a long report from a compromised position',
      hold: 'split a transmission and moved between parts',
      cover: 'delayed a critical report to protect the team',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-boy-with-the-radio',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A boy of about fourteen has been following the route for an hour, well back, with a handset.',
      heavy: 'He is talking into it every time the team changes direction.',
      overrun: 'Whatever he has been saying, there is a reception being prepared a kilometre ahead.',
    },
    labels: {
      push: 'Take him and take the handset',
      hold: 'Change the route and lose him',
      cover: 'Abort the task and go back the way you came',
    },
    did: {
      push: 'detained a child who was reporting the team’s movements',
      hold: 'changed route to break away from a spotter',
      cover: 'aborted a task rather than act against a child',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-river-in-spate',
    tags: ['combat_patrol_ied'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The river is up. The crossing point in the brief is now a hundred metres of moving water.',
      heavy: 'It is moving hard enough to take a loaded man off his feet and the ford is the only place for six kilometres.',
      overrun: 'The far bank is the only ground that is not being searched, and the water is rising.',
    },
    labels: {
      push: 'Cross here, roped, loaded',
      hold: 'Six kilometres upstream to the bridge, and lose the night',
      cover: 'Cache the heavy equipment and swim it light',
    },
    did: {
      push: 'crossed a river in spate under load',
      hold: 'lost a night’s march to find a safe crossing',
      cover: 'cached equipment to cross a river light',
    },
    unitId: 'pathfinders',
    biasToward: 'heavy',
  },
  {
    id: 'pf-the-observation-post-that-is-seen',
    tags: ['combat_firefight', 'combat_patrol_ied'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Somebody has looked directly at the OP twice and walked on both times.',
      heavy: 'The hide has been found. Nobody has done anything about it yet, which means somebody is fetching people.',
      overrun: 'They are coming up the hill in a line and the OP has one way off it.',
    },
    labels: {
      push: 'Fight from the OP and hold what you can see',
      hold: 'Compromise reported — go now, quietly, downhill',
      cover: 'Burn the equipment first, then break out',
    },
    did: {
      push: 'fought from a compromised observation post',
      hold: 'withdrew from a compromised OP without firing',
      cover: 'destroyed sensitive equipment before breaking out',
    },
    unitId: 'pathfinders',
    biasToward: 'overrun',
  },
  {
    id: 'pf-the-lift-that-can-take-six',
    tags: ['combat_rescue', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The aircraft can take six and there are eight of you on the zone.',
      heavy: 'Six seats, eight men, and the aircraft has fuel for one lift.',
      overrun: 'Six seats, eight men, and whoever is left is left in the open with what they can carry.',
    },
    labels: {
      push: 'Overload it and risk the aircraft',
      hold: 'Six go, two stay and walk to the alternate',
      cover: 'Nobody goes — send it away and walk out together',
    },
    did: {
      push: 'overloaded an aircraft rather than leave two men',
      hold: 'stayed behind so six could be lifted out',
      cover: 'refused an extraction so the team would not be split',
    },
    unitId: 'pathfinders',
    biasToward: 'overrun',
  },
]

/**
 * THE TRIDENT DETACHMENT — combat divers. Their war is water, darkness and
 * timetables, and the recurring problem is that everything they do has a gas
 * supply or a tide attached to it.
 */
export const TRIDENT_SCENES: readonly CombatScene[] = [
  {
    id: 'td-the-tide-turned',
    tags: ['sea_smallboat_attack', 'sea_manoverboard'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The tide has turned early. The swim out is now against it and it is two kilometres.',
      heavy: 'Against the tide, loaded, and the pickup window closes in fifty minutes.',
      overrun: 'The team will not make the pickup swimming and the alternate is a beach with people on it.',
    },
    labels: {
      push: 'Swim it and make the window',
      hold: 'Go for the alternate and take the beach as it comes',
      cover: 'Cache the charges and swim out light',
    },
    did: {
      push: 'swam a loaded team out against the tide to make a window',
      hold: 'diverted to an occupied beach for extraction',
      cover: 'abandoned the charges to get the team out',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-gas-for-one',
    tags: ['sea_manoverboard', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'His set has been breathing wrong for ten minutes and he has not said so.',
      heavy: 'One set has failed under a hull and there is one buddy line between two men.',
      overrun: 'Two sets down, one line, and forty metres of hull still to swim.',
    },
    labels: {
      push: 'Buddy-breathe and finish the job',
      hold: 'Abort the swim and surface together now',
      cover: 'Send him up alone and finish it by yourself',
    },
    did: {
      push: 'shared air under a hull to complete an attack',
      hold: 'aborted an attack when a breathing set failed',
      cover: 'sent a diver up and completed the swim alone',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-lit-deck',
    tags: ['sea_smallboat_attack', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'They have turned the deck lights on. Nobody is looking over the side yet.',
      heavy: 'Lights on, two men walking the rail, and the caving ladder is already up the side.',
      overrun: 'They know something is on the hull and they are dropping things into the water to find out what.',
    },
    labels: {
      push: 'Go up the ladder now, into the light',
      hold: 'Hold on the hull and wait for the patrol to pass',
      cover: 'Cut away and abort the boarding',
    },
    did: {
      push: 'boarded a lit and alerted vessel',
      hold: 'held on a hull beneath an active deck patrol',
      cover: 'aborted a boarding rather than climb into the light',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-net',
    tags: ['sea_manoverboard'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'There is a net across the harbour mouth that was not in the brief.',
      heavy: 'The net is weighted and one of the team is caught in it in the dark.',
      overrun: 'He is caught, he is running out of gas, and a patrol boat is working the harbour mouth.',
    },
    labels: {
      push: 'Cut him out fast and take the noise',
      hold: 'Work him free slowly and quietly',
      cover: 'Surface with him and accept being seen',
    },
    did: {
      push: 'cut a diver free of an obstacle at the cost of noise',
      hold: 'freed a trapped diver slowly with air running out',
      cover: 'surfaced with a trapped diver in a patrolled harbour',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-boat-that-does-not-start',
    tags: ['sea_smallboat_attack'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The outboard has not caught on the first four pulls and the team is drifting toward the shore.',
      heavy: 'It will not start and the current has the boat inside the bay with the light coming.',
      overrun: 'Dead engine, closing shore, and there are vehicles on the coast road.',
    },
    labels: {
      push: 'Keep working the engine and stay with the boat',
      hold: 'Paddle it out of the bay by hand',
      cover: 'Sink the boat and swim for the headland',
    },
    did: {
      push: 'stayed with a dead boat inside a hostile bay',
      hold: 'paddled a disabled boat out of a bay by hand',
      cover: 'scuttled a boat and swam for the coast',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-second-hull',
    tags: ['sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The target is alongside another ship that was not there yesterday.',
      heavy: 'The second hull is a passenger vessel and it is moored close enough to matter.',
      overrun: 'The charges are set and the passenger ship has come alongside since.',
    },
    labels: {
      push: 'Fire the charges as laid',
      hold: 'Move the charges further down the hull, in the water, now',
      cover: 'Recover the charges and abort',
    },
    did: {
      push: 'fired charges with a civilian vessel moored alongside',
      hold: 'relaid charges under water to spare a neighbouring hull',
      cover: 'recovered charges and aborted an attack',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-swimmer-who-is-not-there',
    tags: ['sea_manoverboard', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'Head count at the rendezvous is one short and nobody saw him go.',
      heavy: 'One short, the current runs offshore, and there is twenty minutes of darkness left.',
      overrun: 'One short and the boat has to be off this coast before first light or everybody is lost.',
    },
    labels: {
      push: 'Search the line back, in the dark, against the clock',
      hold: 'Hold the rendezvous the full time and no longer',
      cover: 'Take the team out and report a man missing',
    },
    did: {
      push: 'searched for a missing diver past the extraction deadline',
      hold: 'held a rendezvous to the last minute for a missing man',
      cover: 'extracted the team and left a man unaccounted for',
    },
    unitId: 'trident',
    biasToward: 'overrun',
  },
  {
    id: 'td-the-jetty-watchman',
    tags: ['sea_smallboat_attack', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One old man on the jetty with a lamp and a radio, and the team has to pass under him.',
      heavy: 'He is awake, he is walking the jetty, and the water beneath it is flat and clear.',
      overrun: 'He has stopped directly above the team and he is looking down into the water.',
    },
    labels: {
      push: 'Take him off the jetty',
      hold: 'Go under and hope the water stays dark',
      cover: 'Back out and use the long way round the harbour',
    },
    did: {
      push: 'removed a civilian watchman to pass a jetty',
      hold: 'passed beneath an occupied jetty in clear water',
      cover: 'took the long route rather than deal with a watchman',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-depth-that-is-wrong',
    tags: ['sea_manoverboard'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'The channel is deeper than the chart and the team has been down longer than the tables allow.',
      heavy: 'They are past the table and the only way to the target is deeper still.',
      overrun: 'Somebody is already talking oddly on the line and the target is another ten metres down.',
    },
    labels: {
      push: 'Go deeper and finish it',
      hold: 'Come up on schedule and lose the target',
      cover: 'Send the two strongest on and surface the rest',
    },
    did: {
      push: 'took a team past the dive tables to reach a target',
      hold: 'surfaced on schedule and lost the target',
      cover: 'split a dive team and sent two on alone',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-fishing-boat',
    tags: ['sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'A fishing boat has come out early and it is working directly over the approach lane.',
      heavy: 'It is anchored on the lane with four men aboard and lights on the water.',
      overrun: 'It has a net down across the only way in and the window is closing.',
    },
    labels: {
      push: 'Board it and hold the crew until the job is done',
      hold: 'Wait it out and lose the window',
      cover: 'Go round through the shallows and the rocks',
    },
    did: {
      push: 'boarded a fishing boat and held its crew',
      hold: 'lost an operational window to a civilian boat',
      cover: 'took a team through the rocks to avoid a fishing boat',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-cold',
    tags: ['sea_manoverboard'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'Two hours in the water and the youngest one has stopped complaining, which is worse.',
      heavy: 'He is not shivering any more and he is answering questions a beat late.',
      overrun: 'He has gone quiet in the water and the pickup is another hour.',
    },
    labels: {
      push: 'Keep him swimming and keep him talking',
      hold: 'Get him out of the water onto the rocks and break cover',
      cover: 'Signal for early pickup and give away the position',
    },
    did: {
      push: 'swam a hypothermic man the remaining distance',
      hold: 'broke cover to get a freezing man out of the water',
      cover: 'called an early pickup and compromised the operation',
    },
    unitId: 'trident',
    biasToward: 'overrun',
  },
  {
    id: 'td-the-hatch',
    tags: ['combat_breach', 'sea_smallboat_attack'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The hatch is dogged from the inside and there is another way round that takes nine minutes.',
      heavy: 'Dogged, and the nine-minute route passes the crew accommodation.',
      overrun: 'The ship is waking up and both routes are now bad in different ways.',
    },
    labels: {
      push: 'Blow the hatch',
      hold: 'Take the long route past the crew',
      cover: 'Hold on the outside and let the assault come to you',
    },
    did: {
      push: 'breached a hatch explosively aboard a ship',
      hold: 'moved past crew accommodation to avoid a breach',
      cover: 'held outside and let an assault develop without him',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-wrong-ship',
    tags: ['sea_smallboat_attack', 'combat_breach'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The hull number does not match. Everything else does.',
      heavy: 'Wrong number, right silhouette, right berth, and the team is already on the ladder.',
      overrun: 'Two identical hulls at the same berth and the timing does not allow for both.',
    },
    labels: {
      push: 'Take it — everything else matches',
      hold: 'Confirm the number before anybody goes aboard',
      cover: 'Withdraw and report the discrepancy',
    },
    did: {
      push: 'boarded a vessel whose identity did not fully match',
      hold: 'held an assault to confirm a ship’s identity',
      cover: 'withdrew rather than board an unconfirmed vessel',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-charge-that-will-not-arm',
    tags: ['sea_smallboat_attack'],
    channels: ['direct-combat-exposure', 'battlefield-accident'],
    tell: {
      light: 'One of the four has not armed and the team is due off the hull in six minutes.',
      heavy: 'It has not armed, it is on the shaft, and it is the one that matters.',
      overrun: 'It has not armed and the other three are already running.',
    },
    labels: {
      push: 'Go back to it with three live charges on the same hull',
      hold: 'Leave it and accept a partial result',
      cover: 'Pull the other three and start again another night',
    },
    did: {
      push: 'returned to a failed charge with three others already armed',
      hold: 'accepted a partial attack rather than return to the hull',
      cover: 'recovered all charges to attack again another night',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-shoreline-that-is-occupied',
    tags: ['sea_smallboat_attack', 'combat_firefight'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'There are two vehicles parked on the beach that the reconnaissance did not have.',
      heavy: 'The beach has people on it and the team has to cross it to get inland.',
      overrun: 'The beach is held and the boat has already gone.',
    },
    labels: {
      push: 'Cross the beach and fight through',
      hold: 'Lie in the surf line until they go',
      cover: 'Swim along the coast and land somewhere else entirely',
    },
    did: {
      push: 'fought across an occupied beach',
      hold: 'lay in the surf line until an occupied beach cleared',
      cover: 'swam a team along the coast to land elsewhere',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-prisoner-in-the-water',
    tags: ['sea_manoverboard', 'combat_rescue'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'One of them went over the side during the boarding and he is holding onto the ladder.',
      heavy: 'He is in the water, he cannot swim, and the team is trying to leave.',
      overrun: 'He is drowning and taking him means a man in the boat that the boat does not have room for.',
    },
    labels: {
      push: 'Pull him out and take him with you',
      hold: 'Put him on something floating and leave him for his own people',
      cover: 'Leave him — the team is already over its weight',
    },
    did: {
      push: 'recovered a drowning enemy and took him aboard',
      hold: 'left a drowning man something to hold and withdrew',
      cover: 'left an enemy in the water',
    },
    unitId: 'trident',
    biasToward: 'heavy',
  },
  {
    id: 'td-the-long-swim-home',
    tags: ['sea_manoverboard'],
    channels: ['direct-combat-exposure'],
    tell: {
      light: 'The submarine has moved its rendezvous four kilometres further out.',
      heavy: 'Four kilometres further, at night, after a job, with a wounded man on the line.',
      overrun: 'The boat cannot come closer and one of the team is not going to swim that far.',
    },
    labels: {
      push: 'Everybody swims — tow the wounded man',
      hold: 'Signal the boat and demand it comes in',
      cover: 'Put the wounded man ashore and come back for him',
    },
    did: {
      push: 'towed a wounded man four kilometres to a submarine',
      hold: 'forced a submarine to close a hostile coast',
      cover: 'left a wounded man ashore to be recovered later',
    },
    unitId: 'trident',
    biasToward: 'overrun',
  },
]
