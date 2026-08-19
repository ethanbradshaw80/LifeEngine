/**
 * THE LOGISTICS TRADES' OWN WAR — transport and supply, twenty scenes each.
 *
 * OWNER'S RULING: "I don't want the special groups to get the same popups as
 * logistics guys." This is the other half of that sentence. Separation is
 * only worth having if the pool on the far side of it is deep enough to live
 * in, and these two trades were drawing from the general infantry pool.
 *
 * WHAT MAKES A LOGISTICS PROBLEM DIFFERENT, and it is not "less dangerous".
 * A rifleman's decisions are about GROUND. A special unit's are about a task
 * with nobody coming to help. A driver's and a storeman's are about a LOAD
 * and a SCHEDULE — something has to reach somebody by a time, the route is
 * known to everyone including the enemy, and the vehicle cannot shoot back
 * while it is moving. The recurring shape here is that stopping is the
 * dangerous thing and going on is also the dangerous thing, and the cargo
 * does not care.
 *
 * THE SECOND SHAPE IS BEING BLAMED. Nobody notices logistics until it fails,
 * so a good half of these decisions are about what to tell the people who
 * will be angry either way, and about what a shortage forces you to choose
 * between when both choices are somebody's ammunition.
 *
 * THE OWNER'S OVERRIDE (§10) applies. Nothing here draws a number.
 */

import type { CombatScene } from './types.js'

/**
 * TRANSPORT — the road, the load, and the fact that everybody knows which
 * way you have to come back.
 */
export const TRANSPORT_SCENES: readonly CombatScene[] = [
  {
    id: 'tr-the-only-road',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'The route brief says the northern road. The northern road is where the last two went wrong.',
      heavy: 'Everybody uses this road because there is no other road, and everybody knows that.',
      overrun: 'The road is the only way through and something is already burning on it four kilometres ahead.',
    },
    labels: {
      push: 'Run it fast and do not stop for anything',
      hold: 'Convoy speed, spacing, and eyes out',
      cover: 'Wait for an escort and deliver late',
    },
    did: {
      push: 'ran a known route at speed rather than wait for escort',
      hold: 'kept convoy discipline down a compromised road',
      cover: 'held a convoy for escort and delivered late',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-vehicle-that-will-not-start',
    tags: ['work_maint_fault', 'combat_convoy_ambush'],
    channels: ['convoy-exposure', 'battlefield-accident'],
    tell: {
      light: 'Number four will not turn over and the convoy is holding on a bend.',
      heavy: 'It is dead, it is loaded, and the convoy has been stationary for nine minutes on ground of somebody else’s choosing.',
      overrun: 'It is dead and the fire has already started coming in on the stopped column.',
    },
    labels: {
      push: 'Tow it and slow everybody down',
      hold: 'Cross-load what you can and destroy the rest',
      cover: 'Leave it, leave the load, and get the column moving',
    },
    did: {
      push: 'towed a casualty vehicle and slowed the whole column',
      hold: 'cross-loaded a stranded vehicle and destroyed what would not fit',
      cover: 'abandoned a loaded vehicle to get the column moving',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-crowd-at-the-halt',
    tags: ['combat_convoy_ambush', 'base_defense'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'Children have come out to the vehicles at the halt and there are more of them than there were a minute ago.',
      heavy: 'The crowd is thirty deep, it is between the trucks, and nobody can see the third vehicle.',
      overrun: 'The crowd will not move, the column cannot, and somebody in it has started throwing things.',
    },
    labels: {
      push: 'Push the vehicles through the crowd',
      hold: 'Stop, dismount, and clear a path on foot',
      cover: 'Reverse the column out the way it came',
    },
    did: {
      push: 'drove a column through a civilian crowd',
      hold: 'dismounted to clear a crowd rather than drive through it',
      cover: 'reversed a column out rather than force a crowd',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-culvert',
    tags: ['combat_patrol_ied'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'There is a culvert at the bottom of the dip and the search team is two hours behind.',
      heavy: 'The dip has a culvert under it and the vehicles have to slow to walking pace to take it.',
      overrun: 'It is the fourth culvert today and the delivery is already a day late.',
    },
    labels: {
      push: 'Take it at speed and hope',
      hold: 'Stop short and clear it on foot yourself',
      cover: 'Go around across the fields and risk bogging in',
    },
    did: {
      push: 'drove an uncleared culvert at speed',
      hold: 'cleared a culvert on foot before taking a convoy through',
      cover: 'took a convoy off-road to avoid a culvert',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-load-you-were-not-told-about',
    tags: ['work_maint_fault', 'combat_convoy_ambush'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'The manifest says rations. The pallets are stencilled with something else entirely.',
      heavy: 'You are carrying ammunition on a run that was briefed as a ration run, which changes every rule about spacing.',
      overrun: 'It is ammunition, the spacing is wrong for it, and the column is already inside the bad ground.',
    },
    labels: {
      push: 'Carry on and say nothing',
      hold: 'Stop the column and re-space it properly',
      cover: 'Refuse the load and send it back',
    },
    did: {
      push: 'ran a misdeclared load without adjusting for it',
      hold: 'halted a column to re-space for the load it was actually carrying',
      cover: 'refused a misdeclared load',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-man-flagging-you-down',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'A man in the road is waving both arms. There is a vehicle on its side behind him.',
      heavy: 'He is waving you down and the ground either side of him is exactly where you would put a stop group.',
      overrun: 'He is in the road, the column is committed, and there is nowhere to turn a loaded truck around.',
    },
    labels: {
      push: 'Do not stop — go around him',
      hold: 'Stop and help',
      cover: 'Stop short, cover him, and send one vehicle forward',
    },
    did: {
      push: 'drove past a man flagging down the convoy',
      hold: 'stopped a convoy for a civilian in the road',
      cover: 'held the column back and sent one vehicle to investigate',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-night-run',
    tags: ['combat_convoy_ambush', 'work_maint_fault'],
    channels: ['convoy-exposure', 'battlefield-accident'],
    tell: {
      light: 'Lights off, twenty vehicles, and a road with a drop on one side.',
      heavy: 'The dust is so thick that the driver behind is steering by the sound of you.',
      overrun: 'Somebody has already gone off the edge and the column has to keep moving past him.',
    },
    labels: {
      push: 'Keep the speed up and hold the schedule',
      hold: 'Slow to a crawl and lose the darkness',
      cover: 'Stop the column and wait for light',
    },
    did: {
      push: 'held convoy speed on a night run past a vehicle over the edge',
      hold: 'slowed a night convoy and lost its cover of darkness',
      cover: 'halted a night convoy until first light',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-checkpoint-that-is-new',
    tags: ['combat_convoy_ambush', 'base_defense'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'There is a checkpoint on the route that was not there on the way out. The uniforms are almost right.',
      heavy: 'The checkpoint is new, the uniforms are wrong in a detail you cannot name, and they are waving the column in.',
      overrun: 'They have blocked the road with a vehicle and they are not soldiers.',
    },
    labels: {
      push: 'Break through it',
      hold: 'Stop and comply while somebody checks by radio',
      cover: 'Turn the column around and take the long route',
    },
    did: {
      push: 'drove a convoy through an unidentified checkpoint',
      hold: 'complied with an unverified checkpoint',
      cover: 'turned a convoy around rather than pass an unverified checkpoint',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-casualty-in-the-back',
    tags: ['combat_convoy_ambush', 'combat_rescue'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'One of the passengers is hit and the aid post is forty minutes back the way you came.',
      heavy: 'He is bleeding in the back of a truck and the destination is ninety minutes on.',
      overrun: 'He will not last ninety minutes and turning the column around means going back through what just happened.',
    },
    labels: {
      push: 'Turn back through the ambush ground',
      hold: 'Press on and treat him in the vehicle',
      cover: 'Split off one vehicle and send it back alone',
    },
    did: {
      push: 'turned a convoy back through the ambush ground for a casualty',
      hold: 'pressed on with a casualty being treated in the vehicle',
      cover: 'detached a single vehicle to run a casualty back alone',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-bridge-weight',
    tags: ['work_maint_fault'],
    channels: ['convoy-exposure', 'battlefield-accident'],
    tell: {
      light: 'The bridge is rated for less than the heaviest vehicle in the column.',
      heavy: 'It is well under-rated for the load and the detour is a hundred and forty kilometres.',
      overrun: 'The detour is through country that is not held and the delivery is needed tonight.',
    },
    labels: {
      push: 'Take it one vehicle at a time and chance it',
      hold: 'Cross the light ones and leave the heavy behind',
      cover: 'Take the detour and arrive tomorrow',
    },
    did: {
      push: 'took an under-rated bridge with overweight vehicles',
      hold: 'split a column at a bridge and left the heavy vehicles',
      cover: 'took a long detour rather than risk a bridge',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-fuel',
    tags: ['work_maint_fault', 'combat_convoy_ambush'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'The column has enough fuel to get there or enough to get back, and not both.',
      heavy: 'There is no resupply at the far end and the gauge has been reading low since the detour.',
      overrun: 'Two vehicles are running on fumes in country where a stopped truck is a gift.',
    },
    labels: {
      push: 'Go on and worry about the return later',
      hold: 'Deliver half and keep enough to come home',
      cover: 'Turn back now with the whole load undelivered',
    },
    did: {
      push: 'delivered a load with no fuel margin to return',
      hold: 'delivered half a load to keep a return margin',
      cover: 'turned back with the load rather than strand the column',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-driver-who-has-not-slept',
    tags: ['work_maint_fault'],
    channels: ['convoy-exposure', 'battlefield-accident'],
    tell: {
      light: 'One of your drivers has been up for twenty-six hours and is on his third run.',
      heavy: 'He drifted across the centre line twice in the last ten kilometres and there is nobody to relieve him.',
      overrun: 'He is asleep at the wheel of a loaded vehicle in a moving column.',
    },
    labels: {
      push: 'Keep him driving — the run has to go',
      hold: 'Put him in the passenger seat and drive it yourself',
      cover: 'Pull his vehicle out of the run entirely',
    },
    did: {
      push: 'kept an exhausted driver at the wheel to make a delivery',
      hold: 'took over from an exhausted driver and drove double',
      cover: 'pulled a vehicle from a run rather than use an exhausted driver',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-recovery',
    tags: ['work_maint_fault', 'combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'A vehicle from yesterday’s run is still out there on the road, stripped but recoverable.',
      heavy: 'It is recoverable and it is sitting in the middle of ground nobody has held since it stopped.',
      overrun: 'It is bait and everybody knows it is bait, and the vehicle is still worth more than the unit can spare.',
    },
    labels: {
      push: 'Go and get it',
      hold: 'Strip what matters off it and destroy the rest',
      cover: 'Write it off and stay away',
    },
    did: {
      push: 'recovered a vehicle from ground nobody held',
      hold: 'stripped and destroyed a stranded vehicle in place',
      cover: 'wrote off a recoverable vehicle rather than risk the party',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-order-that-makes-no-sense',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'The tasking has you leaving at the same hour you left the last three days.',
      heavy: 'Same hour, same route, fourth day running, and the man who wrote it is not coming.',
      overrun: 'It is the same run at the same time and yesterday’s was hit at the same bend.',
    },
    labels: {
      push: 'Follow the tasking as written',
      hold: 'Change the timing on your own authority',
      cover: 'Refuse the run and put it in writing',
    },
    did: {
      push: 'ran a predictable tasking exactly as written',
      hold: 'altered a run’s timing without authority',
      cover: 'formally refused a run as unsafe',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-hitchhikers',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'Six men from another unit want a lift and their own transport is broken.',
      heavy: 'They want a lift, they are armed, and nobody can confirm who they are on this net.',
      overrun: 'They are asking hard now and the column is not going to sit here arguing.',
    },
    labels: {
      push: 'Take them aboard',
      hold: 'Take them but separate them across vehicles',
      cover: 'Refuse and drive on',
    },
    did: {
      push: 'carried unverified armed passengers',
      hold: 'carried unverified passengers split across vehicles',
      cover: 'refused a lift to unverified armed men',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-wrong-turn',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'The lead vehicle has taken a turn that is not on the route card.',
      heavy: 'The column is four kilometres down a road nobody briefed and the map does not agree with the ground.',
      overrun: 'You are lost, in a town, in vehicles that cannot turn around in these streets.',
    },
    labels: {
      push: 'Keep going and find a way through',
      hold: 'Stop and work out where you are',
      cover: 'Reverse the whole column back out',
    },
    did: {
      push: 'pressed on through an unbriefed town rather than stop',
      hold: 'halted a lost column in a built-up area to navigate',
      cover: 'reversed a full column out of a town it should not have entered',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-load-that-is-people',
    tags: ['combat_convoy_ambush', 'combat_rescue'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'The load out is stores. The load back is forty men who have been in the line for six weeks.',
      heavy: 'Forty exhausted men in open trucks on a road that was hit yesterday.',
      overrun: 'They are asleep in the back and they will not be able to fight if anything happens.',
    },
    labels: {
      push: 'Run it straight through without a halt',
      hold: 'Wake them and have them stand to through the bad ground',
      cover: 'Take the long safe route and add four hours',
    },
    did: {
      push: 'ran exhausted troops straight through bad ground without a halt',
      hold: 'stood exhausted troops to for the dangerous stretch',
      cover: 'added four hours to a run to keep sleeping men off a bad road',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-blocked-return',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure', 'direct-combat-exposure'],
    tell: {
      light: 'The road back has been closed behind you for clearance.',
      heavy: 'Closed behind, and the position you delivered to has no room and no rations for a convoy crew.',
      overrun: 'Closed behind, and the place you are sitting in is being probed.',
    },
    labels: {
      push: 'Run the closed road anyway',
      hold: 'Stay the night with the position and go at first light',
      cover: 'Take the vehicles cross-country and abandon the road',
    },
    did: {
      push: 'ran a road closed for clearance',
      hold: 'kept a convoy overnight at a position under probe',
      cover: 'took a convoy cross-country to avoid a closed road',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-the-thing-in-the-mirror',
    tags: ['combat_convoy_ambush'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'The same civilian car has been four hundred metres back for eleven kilometres.',
      heavy: 'It has matched every change of speed the column has made.',
      overrun: 'It has closed to a hundred metres and it is not slowing.',
    },
    labels: {
      push: 'Stop it — whatever that takes',
      hold: 'Signal it back and keep signalling',
      cover: 'Change route and let it follow an empty road',
    },
    did: {
      push: 'fired on a civilian vehicle following the column',
      hold: 'warned off a following vehicle without firing',
      cover: 'changed a convoy’s route to shake a follower',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
  {
    id: 'tr-what-you-put-in-the-report',
    tags: ['work_maint_fault'],
    channels: ['convoy-exposure'],
    tell: {
      light: 'Two pallets are missing at the far end and both signatures are yours.',
      heavy: 'Two pallets gone, your signature on both, and the receiving unit says they never arrived.',
      overrun: 'Somebody in your own section is selling it and everybody knows and nobody has said so.',
    },
    labels: {
      push: 'Name him',
      hold: 'Write it up as loss in transit and let it go',
      cover: 'Handle it inside the section without paperwork',
    },
    did: {
      push: 'reported a man in his own section for theft',
      hold: 'wrote off stolen stores as loss in transit',
      cover: 'dealt with theft inside the section and kept it off paper',
    },
    unitId: null,
    specialtyIds: ['transport'],
    biasToward: null,
  },
]

/**
 * SUPPLY — the storeman's war, which is mostly about who does not get what,
 * decided by somebody who has to look them in the face afterwards.
 */
export const SUPPLY_SCENES: readonly CombatScene[] = [
  {
    id: 'sp-two-units-one-pallet',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure', 'convoy-exposure'],
    tell: {
      light: 'Two companies have indented for the same ammunition and there is one pallet of it.',
      heavy: 'One is in contact and the other is going out tonight, and the one in contact shouts louder.',
      overrun: 'Both are in contact and whoever does not get it will be fighting without it before dark.',
    },
    labels: {
      push: 'Give it all to the one in contact',
      hold: 'Split it and satisfy neither',
      cover: 'Hold it back for the one going out — they can still be saved',
    },
    did: {
      push: 'gave a whole holding to the company already in contact',
      hold: 'split a scarce holding between two companies',
      cover: 'held stock back from a unit in contact for one not yet committed',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-dump-is-in-the-open',
    tags: ['base_defense', 'work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The ammunition dump is under a net and the net is the only thing over it.',
      heavy: 'It is stacked too close together because there was nowhere else, and there has been a spotter aircraft over twice.',
      overrun: 'Rounds are landing on the position and the dump is forty metres from the nearest bunker.',
    },
    labels: {
      push: 'Go out and disperse it under fire',
      hold: 'Stay under cover and let it take its chances',
      cover: 'Fight the fire on the edge of it and save what you can',
    },
    did: {
      push: 'dispersed an ammunition dump under indirect fire',
      hold: 'sheltered while an ammunition dump was shelled',
      cover: 'fought a fire at the edge of a burning dump',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-indent-that-is-a-lie',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'A company has indented for twice what it can possibly use.',
      heavy: 'They have done it three months running and somewhere there is a shed full of it.',
      overrun: 'Everybody is over-indenting because everybody expects to be cut, and the system has stopped meaning anything.',
    },
    labels: {
      push: 'Issue what they asked for and let it rot',
      hold: 'Cut them to what they need and take the phone call',
      cover: 'Issue in full and report the pattern upward',
    },
    did: {
      push: 'issued an inflated indent in full',
      hold: 'cut an inflated indent and absorbed the complaint',
      cover: 'issued in full and reported the over-indenting upward',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-boots',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'There are no boots in the sizes half the company wears and there have not been for five weeks.',
      heavy: 'Men are patrolling in boots that have come apart and there is a pallet of the wrong sizes.',
      overrun: 'Trench foot is going through a platoon and the requisition has been open since spring.',
    },
    labels: {
      push: 'Take them off another unit’s allocation',
      hold: 'Chase the requisition through the proper channel again',
      cover: 'Buy them locally with unit funds and hide the paperwork',
    },
    did: {
      push: 'diverted another unit’s allocation to shoe his own',
      hold: 'chased a requisition through channels while men went unshod',
      cover: 'bought supplies locally and concealed the accounting',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-count-does-not-match',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The count is nine short and you have counted it three times.',
      heavy: 'Nine weapons short, and the last man to sign for them rotated home a fortnight ago.',
      overrun: 'Nine short, an inspection in the morning, and no explanation that is both true and survivable.',
    },
    labels: {
      push: 'Report the true figure',
      hold: 'Reconcile it on paper and keep looking',
      cover: 'Borrow nine from another store to make the count',
    },
    did: {
      push: 'reported a weapons shortfall exactly as counted',
      hold: 'reconciled a shortfall on paper while searching for the stock',
      cover: 'borrowed stock from another store to pass an inspection',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-airdrop-in-the-wrong-place',
    tags: ['work_maint_fault', 'base_defense'],
    channels: ['base-attack-exposure', 'convoy-exposure'],
    tell: {
      light: 'The drop has gone into the valley instead of the field. It is all intact.',
      heavy: 'It is in the valley, it is intact, and the valley is not ours after dark.',
      overrun: 'Half of it is already being carried away by people who are not us.',
    },
    labels: {
      push: 'Take a party down for it now',
      hold: 'Recover what is on this side and leave the rest',
      cover: 'Call fire on it so nobody has it',
    },
    did: {
      push: 'led a recovery party into a valley held by nobody',
      hold: 'recovered the near half of a misdropped load',
      cover: 'destroyed a misdropped load rather than let it be taken',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-rations-that-came-wrong',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'Six weeks of the same ration and a company that has stopped eating it.',
      heavy: 'Men are losing weight on full rations because they will not eat what has arrived.',
      overrun: 'It has turned in the heat and there is nothing else on the shelf.',
    },
    labels: {
      push: 'Issue it anyway and say nothing',
      hold: 'Condemn the lot and put everybody on half',
      cover: 'Trade it to a local contractor for something edible',
    },
    did: {
      push: 'issued rations he knew had turned',
      hold: 'condemned a ration lot and put the unit on half',
      cover: 'traded unfit rations locally for edible food',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-forward-dump',
    tags: ['base_defense', 'combat_convoy_ambush'],
    channels: ['base-attack-exposure', 'convoy-exposure'],
    tell: {
      light: 'The forward dump is one man, a tent and everything a company needs.',
      heavy: 'It is one man and it is you, and the line has moved back about a kilometre since morning.',
      overrun: 'The line is coming back through the dump and there is no transport to move it.',
    },
    labels: {
      push: 'Stay with it and keep issuing',
      hold: 'Issue everything you can to whoever passes and burn the rest',
      cover: 'Fire the dump now and go with the line',
    },
    did: {
      push: 'stayed with a forward dump as the line came back through it',
      hold: 'issued out a dump to passing troops and destroyed the remainder',
      cover: 'destroyed a forward dump and withdrew with the line',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-officer-who-wants-it-now',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'A captain wants a vehicle signed out with no authorisation and no intention of bringing paperwork.',
      heavy: 'He is senior, he is angry, and the vehicle is the one earmarked for the medical run.',
      overrun: 'He has taken the keys off the board himself.',
    },
    labels: {
      push: 'Stop him',
      hold: 'Let it go and write down exactly what happened',
      cover: 'Give him a different vehicle and keep the medical one',
    },
    did: {
      push: 'refused a senior officer to his face over stores discipline',
      hold: 'allowed an unauthorised issue and documented it',
      cover: 'substituted a vehicle to protect the medical run',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-water',
    tags: ['work_maint_fault', 'base_defense'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The water bowser has been standing in the sun and the chlorine reading is wrong.',
      heavy: 'It is the only water on the position and there are men queueing for it.',
      overrun: 'People are already drinking it and the next delivery is two days out.',
    },
    labels: {
      push: 'Let them drink and treat what comes of it',
      hold: 'Stop the issue and ration what is sealed',
      cover: 'Boil it in relays all night with whatever is on the position',
    },
    did: {
      push: 'issued water he knew was not properly treated',
      hold: 'stopped a water issue and rationed the sealed stock',
      cover: 'organised boiling in relays rather than issue bad water',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-dead-mans-kit',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'There is a kit to inventory and the name on it is somebody you played cards with.',
      heavy: 'There are eleven of them and the letters home go out with the effects.',
      overrun: 'There are things in the kit that the family should not be sent and no rule about which.',
    },
    labels: {
      push: 'Send everything, exactly as found',
      hold: 'Inventory it strictly and send what the regulation says',
      cover: 'Quietly remove what would only hurt them',
    },
    did: {
      push: 'sent a dead man’s effects complete and unedited',
      hold: 'inventoried effects strictly to regulation',
      cover: 'removed items from a dead man’s effects to spare his family',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-shortage-nobody-will-admit',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The returns say the theatre has forty days of ammunition. Your shelves say eleven.',
      heavy: 'Eleven days, and the number going upward every week is still forty.',
      overrun: 'The operation being planned assumes forty and it starts on Thursday.',
    },
    labels: {
      push: 'Send the real number and let it land where it lands',
      hold: 'Send the real number through your own chain only',
      cover: 'Say nothing — it is not your return to sign',
    },
    did: {
      push: 'reported a theatre-level shortage over his own chain’s head',
      hold: 'reported a shortage correctly through his own chain',
      cover: 'stayed silent about a shortage that was not his to report',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-local-contractor',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The contractor delivering fresh food has started asking which gate is quietest.',
      heavy: 'He has asked twice about the guard rotation and he is the only supplier there is.',
      overrun: 'He did not come today and neither did anybody else.',
    },
    labels: {
      push: 'Report him and lose the supply',
      hold: 'Keep him, watch him, and change the rotation',
      cover: 'Say nothing — the position needs the food',
    },
    did: {
      push: 'reported the only local supplier and lost the supply',
      hold: 'kept a suspect supplier under watch and changed the routine',
      cover: 'said nothing about a suspect supplier the position depended on',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-fire-in-the-store',
    tags: ['base_defense', 'work_maint_fault'],
    channels: ['base-attack-exposure', 'battlefield-accident'],
    tell: {
      light: 'Something is smoking at the back of the tentage and the tentage is next to the fuel.',
      heavy: 'It has caught properly and the fuel drums are two rows away.',
      overrun: 'The drums have started going and there are men still inside the store.',
    },
    labels: {
      push: 'Go in for the men',
      hold: 'Get everybody back and let it burn',
      cover: 'Roll the drums out before it reaches them',
    },
    did: {
      push: 'went into a burning store for men still inside',
      hold: 'cleared the area and let a store burn out',
      cover: 'moved fuel drums clear of a fire by hand',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-priority-list',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The priority list has the headquarters generator above the field hospital’s.',
      heavy: 'Both need the same part and there is one, and the list is signed.',
      overrun: 'The hospital is running on a generator that is failing and the list has not changed.',
    },
    labels: {
      push: 'Give it to the hospital and answer for it',
      hold: 'Follow the list exactly',
      cover: 'Give it to the hospital and lose the paperwork',
    },
    did: {
      push: 'issued against a signed priority list, openly, for the hospital',
      hold: 'followed the priority list as signed',
      cover: 'issued against the list and let the paperwork go missing',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-store-under-shellfire',
    tags: ['base_defense'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The barrage has started and there are men at the counter waiting to draw ammunition.',
      heavy: 'They need it now and the store is a soft building with a tin roof.',
      overrun: 'The counter is gone and the stock is under what is left of the roof.',
    },
    labels: {
      push: 'Keep issuing through it',
      hold: 'Shut the store and take everybody below',
      cover: 'Dump the stock outside so people can help themselves and get out',
    },
    did: {
      push: 'kept a store issuing through a barrage',
      hold: 'closed a store and took his people below',
      cover: 'put stock into the open for self-service and cleared the building',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-man-who-lost-his-rifle',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'A private has come in white-faced to report a weapon lost on patrol.',
      heavy: 'He lost it in a river crossing and he is nineteen and the penalty is severe.',
      overrun: 'A weapon is missing in country where a missing weapon gets used on somebody.',
    },
    labels: {
      push: 'Report it up immediately, as it happened',
      hold: 'Give him a day to go back and look for it',
      cover: 'Issue him another and write the first off as combat loss',
    },
    did: {
      push: 'reported a lost weapon immediately and by the book',
      hold: 'gave a soldier a day to recover a lost weapon before reporting it',
      cover: 'wrote off a lost weapon as a combat loss to protect a soldier',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-convoy-that-is-not-coming',
    tags: ['work_maint_fault', 'combat_convoy_ambush'],
    channels: ['base-attack-exposure', 'convoy-exposure'],
    tell: {
      light: 'The resupply convoy is a day late and nobody on the net knows where it is.',
      heavy: 'Three days late, and the position is issuing at half scale to make it last.',
      overrun: 'It is not coming at all and nobody has told the men who are waiting for it.',
    },
    labels: {
      push: 'Go out and find it yourself',
      hold: 'Cut the issue again and say nothing yet',
      cover: 'Tell the company commanders the truth now',
    },
    did: {
      push: 'went out to find an overdue convoy himself',
      hold: 'cut issue rates again without explaining why',
      cover: 'told the companies plainly that resupply was not coming',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-the-medical-stores',
    tags: ['work_maint_fault'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'The morphine count is right and the seal on the box is not.',
      heavy: 'Somebody has been at the medical stores and the aid post is short in a firefight.',
      overrun: 'A man is in pain in the aid post and there is nothing left to give him.',
    },
    labels: {
      push: 'Search the section and find who',
      hold: 'Lock it down and report the discrepancy',
      cover: 'Replace the shortfall quietly from another unit',
    },
    did: {
      push: 'searched his own section over missing medical stores',
      hold: 'locked down and reported a medical stores discrepancy',
      cover: 'quietly replaced missing medical stores from elsewhere',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
  {
    id: 'sp-what-the-line-thinks-of-you',
    tags: ['work_maint_fault', 'base_defense'],
    channels: ['base-attack-exposure'],
    tell: {
      light: 'A sergeant off the line has come to the counter and he is not here about stores.',
      heavy: 'He has lost two men this week and he thinks it is because of what did not arrive.',
      overrun: 'He is right that it did not arrive and wrong about whose fault that is, and he is not going to be told.',
    },
    labels: {
      push: 'Tell him exactly where it went and who stopped it',
      hold: 'Take it and say nothing',
      cover: 'Go back with him and see the ground yourself',
    },
    did: {
      push: 'told a line sergeant exactly where his supplies had gone',
      hold: 'absorbed the blame for a shortage that was not his',
      cover: 'went forward with a line sergeant to see the position himself',
    },
    unitId: null,
    specialtyIds: ['supply'],
    biasToward: null,
  },
]
