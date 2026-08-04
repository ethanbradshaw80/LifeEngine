/**
 * WHAT EVERY CRIME ACTUALLY LOOKS LIKE. Authored copy, one set per scene.
 *
 * THE BUG THIS EXISTS TO KILL (owner, playing): one generic template was
 * reused for every offence and every answer, so a white-collar crime was
 * described as a burglary — "a shotgun in the dark" — and offered "go for
 * the safe". Four registers was an improvement on one; it was still four
 * templates stretched over fifty-eight crimes.
 *
 * THE RULE NOW, and nothing here may break it:
 *
 *   every line = f(the offence, the rolled band, the chosen option, the result)
 *
 * No line is shared between offences that do not share a scene. Where two
 * ids genuinely ARE the same moment — second-degree and first-degree murder
 * differ in what a court later decides about intent, not in the room — they
 * point at one set, and `SCENE_OF` says so out loud rather than falling
 * through a default.
 *
 * VARIETY WITHOUT DRIFT: every slot is a POOL, picked by seed. The wording
 * changes between runs; the facts never do, because every string in a pool
 * describes the same offence, the same band and the same result. Same
 * principle as the newsroom's variants (Law 1, Law 11). No text is
 * generated — these are authored, and that is the whole point.
 *
 * This module is pure data. crimescene.ts picks from it; crime.ts owns the
 * money, the record and the courthouse.
 */

/**
 * How the room actually is. The three ids are stable because pendings and
 * saves carry them; what each one is CALLED depends on the profile, which is
 * what PROFILE_BANDS below is for.
 *
 * Declared here rather than imported from crimescene.js: that module reads
 * this one, and importing back would be a cycle (the import ratchet caught
 * it). crimescene re-exports the type, so nothing else has to move.
 */
export type CrimeDanger = 'quiet' | 'occupied' | 'hot'

/**
 * WHERE THE DANGER LIVES, which decides what the three answers even are.
 * A fraud must never be offered a heist's choices.
 */
export type DangerProfile = 'physical' | 'police' | 'discovery'

/** The three answers, worded for the kind of danger they answer. */
export const PROFILE_OPTIONS: Readonly<
  Record<DangerProfile, { readonly press: string; readonly cool: string; readonly bail: string }>
> = {
  physical: { press: 'Press on', cool: 'Keep cool', bail: 'Bail' },
  police: { press: 'Brazen it out', cool: 'Play it cool', bail: 'Walk away' },
  discovery: { press: 'Cover it', cool: 'Skim less', bail: 'Stop now' },
}

/** The tell, named. What the band IS, in that profile's terms. */
export const PROFILE_BANDS: Readonly<Record<DangerProfile, Record<CrimeDanger, string>>> = {
  physical: { quiet: 'Empty', occupied: 'Occupied', hot: 'Armed' },
  police: { quiet: 'Quiet', occupied: 'A witness', hot: 'A patrol near' },
  discovery: { quiet: 'Clean books', occupied: 'A question', hot: 'An audit' },
}

/**
 * One crime's authored copy.
 *
 * The six outcome slots are exactly the six things that can happen, and they
 * are (option × result), not (band): backing out, taking it boldly and
 * getting clear, taking a little quietly, being seen doing it, pressing on
 * into a room that had already warned you, and being taken in the act.
 */
export interface SceneCopy {
  /** The situation, per band. */
  readonly quiet: readonly string[]
  readonly occupied: readonly string[]
  readonly hot: readonly string[]
  /** The line under each button — what that answer means HERE. */
  readonly pressDetail: string
  readonly coolDetail: string
  readonly bailDetail: string
  /** The result. */
  readonly bailed: readonly string[]
  /** Pressed on with nothing in the way. */
  readonly boldClean: readonly string[]
  /** Kept it small and got clear. */
  readonly quietClean: readonly string[]
  /** Pressed on while somebody was there to see it. */
  readonly seen: readonly string[]
  /** Pressed on into the worst band. */
  readonly wounded: readonly string[]
  /** Held back in the worst band, and taken anyway. */
  readonly caught: readonly string[]
}

// ---------------------------------------------------------------------------
// PHYSICAL — somebody can be standing there, and it can go wrong in a body.
// Bands: empty · occupied · armed.
// ---------------------------------------------------------------------------

const BURGLARY: SceneCopy = {
  quiet: [
    'The windows are dark and the drive is empty. Whoever lives here is somewhere else tonight.',
    'No car, no lights, and three days of mail behind the door. Nobody has been home in a while.',
  ],
  occupied: [
    'A light burns upstairs, and somewhere inside a dog starts to bark.',
    'The television is on in the front room and there is a shape in the chair. They have not heard you yet.',
  ],
  hot: [
    'You are barely inside when you hear it — the unmistakable rack of a shotgun in the dark.',
    'A floorboard goes, and a voice says "who is that" in the tone of somebody already reaching for something.',
  ],
  pressDetail: 'Go through the whole house. More to take, more to lose.',
  coolDetail: 'Take what is by the door and be gone inside two minutes.',
  bailDetail: 'Back out of the window and leave it empty-handed.',
  bailed: [
    'Something about it feels wrong. You are over the fence before the porch light finds you.',
    'You put the window back down the way you found it and walk away down the middle of the road, unhurried.',
  ],
  boldClean: [
    'Nobody home and all night to work. You go through every room and leave by the back door with both hands full.',
    'You take your time — the drawers, the wardrobe, the tin at the back of the cupboard — and nothing so much as creaks.',
  ],
  quietClean: [
    'You take what is lying out and you are gone in two minutes. Nothing moved that anyone will notice by morning.',
    'Wallet from the hall table, watch from the shelf, out. The dog never quite decided you were there.',
  ],
  seen: [
    'A floorboard gives under you. A voice calls a name that is not yours, and a shape moves at the top of the stairs. You take the drawer and run.',
    'The landing light comes on while you are still in the room. You go through the back door with somebody shouting a description of you at your back.',
  ],
  wounded: [
    'You go for the hall and the dark goes white. The blast catches you across the shoulder, and you are down before you hear the second one.',
    'They were waiting at the top of the stairs with it levelled, and you had already committed to the step.',
  ],
  caught: [
    'You freeze with your hands up. The barrel does not waver. Headlights swing into the drive — they had already called it in.',
    'You stop dead and say nothing, and the two of you stand there in the dark until the constable arrives.',
  ],
}

const COMMERCIAL_BURGLARY: SceneCopy = {
  quiet: [
    'The shop has been shut for hours. The till drawer is out and open on the counter, the way they leave it.',
    'The loading door is on one bolt and the yard light burned out weeks ago. Nobody has fixed either.',
  ],
  occupied: [
    'There is a light on in the back office and somebody is still doing the books.',
    'The cleaner is working the far aisle with a radio going. They have not looked up.',
  ],
  hot: [
    'The owner sleeps over the shop, and he is on the stairs with something in his hand.',
    'A key turns in the front door while you are still behind the counter.',
  ],
  pressDetail: 'The safe in the back office, and the stock room after it.',
  coolDetail: 'The till and whatever is small enough to carry out under a coat.',
  bailDetail: 'Out the way you came in. Nothing taken.',
  bailed: [
    'You put the bolt back across and walk out of the yard. It was never worth the years.',
    'You leave the drawer where it is. Somebody else can want it this badly.',
  ],
  boldClean: [
    'The safe is older than you are and opens like a suggestion. You are out through the yard with the whole week in a sack.',
    'Office first, stock room second, and you leave by the loading door with the van a street away and nobody within a mile.',
  ],
  quietClean: [
    'The float from the till and a box off the shelf, and you are gone before the radio in the far aisle changes song.',
    'You take what fits under the coat and leave the drawer sitting open exactly as you found it.',
  ],
  seen: [
    'The office door opens while you are still at the safe. He gets a long, unhurried look at your face before you are through the yard.',
    'The cleaner comes round the end of the aisle, and by the time you are over the fence they are already on the telephone.',
  ],
  wounded: [
    'He swings first and he swings with the whole weight of a man defending his own, and the floor comes up fast.',
    'You go for the door he is standing in, and the two of you go down the stairs together.',
  ],
  caught: [
    'You put your hands where he can see them. He does not lower the bar until the constable is in the room.',
    'The key turns, the light goes on, and there is nowhere in a shop this size to be standing that is not obvious.',
  ],
}

const STREET_ROBBERY: SceneCopy = {
  quiet: [
    "The street is empty and your mark is alone, head down against the cold.",
    'They are two hundred yards from the nearest lit window and paying attention to nothing but their own feet.',
  ],
  occupied: [
    'There are people at the corner. Witnesses, if this goes loud.',
    'A couple is walking the other side of the road, and a car is idling at the kerb with somebody in it.',
  ],
  hot: [
    'Their hand moves to their coat. They might be carrying too.',
    'They turn before you are ready, and they are bigger than they looked, and they are not frightened.',
  ],
  pressDetail: 'Take everything they have on them, and make sure they do not follow.',
  coolDetail: 'Take what is already in their hand and be gone before they place your face.',
  bailDetail: 'Let them walk. Not tonight.',
  bailed: [
    'You let them go past. They never knew how close it came.',
    'You watch them turn the corner and put your hands back in your pockets.',
  ],
  boldClean: [
    'They never see it start. They are still on the ground and you are two streets away with everything they had.',
    'It takes four seconds and there is nobody on the road to say it happened at all.',
  ],
  quietClean: [
    'You show enough to be taken seriously and they hand it over without a word.',
    'You take what is in their hand and you are around the corner before they have your face.',
  ],
  seen: [
    'Somebody shouts from the corner. You get what you came for and run, and they get a long look at you doing it.',
    'The car door opens behind you while you are still going through their pockets, and a voice starts describing you to somebody.',
  ],
  wounded: [
    'You both reach at once. Only one of you was carrying, and it was not you.',
    'It stops being a robbery the moment they turn into it, and the street comes apart around the two of you.',
  ],
  caught: [
    'They have your wrist and they are not letting go, and they are shouting for somebody, and somebody comes.',
    'You back off a step too late. The corner empties towards you and none of it is on your side.',
  ],
}

const ARMED_ROBBERY: SceneCopy = {
  quiet: [
    'One clerk, one till, and a road outside with nothing moving on it.',
    'The place is empty at this hour and the man behind the counter is not going to be a hero for somebody else’s money.',
  ],
  occupied: [
    'There are two customers by the freezer and a camera over the door.',
    'Somebody is filling a car on the forecourt and can see straight through the glass at you.',
  ],
  hot: [
    'There is a shotgun under that counter and the man behind it has both hands out of sight.',
    'A patrol car pulls onto the forecourt while you are still deciding.',
  ],
  pressDetail: 'The till, the safe, and every wallet in the room.',
  coolDetail: 'The till, and out. Do not let it become anything else.',
  bailDetail: 'Put it away and leave. Nothing has happened yet.',
  bailed: [
    'You take your hand off it and buy a packet of cigarettes and leave. Nothing happened here.',
    'You turn around and walk out. The whole of the rest of your life goes on being the one you had.',
  ],
  boldClean: [
    'Nobody argues. You leave with the drawer, the safe bag and four wallets, and the road outside is still empty.',
    'It goes exactly the way you pictured it, which almost never happens, and you are gone inside ninety seconds.',
  ],
  quietClean: [
    'The drawer, and out. He does not look up and you do not give him a reason to.',
    'You keep it short and pointed and take only what was already counted.',
  ],
  seen: [
    'The customers at the freezer see all of it, and one of them is already describing you before the door swings shut.',
    'The camera has your face for eleven seconds, and eleven seconds is a great deal of camera.',
  ],
  wounded: [
    'His hands come up from under the counter with it, and the room goes very loud and very white.',
    'You turn towards the forecourt, and every wall of this place is glass.',
  ],
  caught: [
    'You put it on the counter and your hands on your head, because the alternative is the rest of a very short life.',
    'The forecourt fills with light. You are on the floor before anybody says a word to you.',
  ],
}

const AUTO_THEFT: SceneCopy = {
  quiet: [
    'The car has sat on that drive under a film of dust for a fortnight, and the house behind it is dark.',
    'Back row of the yard, no lights, and the wheel arch already going at the edges. Nobody is looking for this one tonight.',
  ],
  occupied: [
    'There is a light on in the front room and the curtain is not quite closed.',
    'A man three doors down is putting his bins out and has already looked over twice.',
  ],
  hot: [
    'The owner comes out of the house before you have the door shut, and he is already running.',
    'The alarm goes on the second turn, and every light on the street starts coming on with it.',
  ],
  pressDetail: 'Take it anyway and drive. Sort the plates out later.',
  coolDetail: 'Wait for the road to clear, then take it quietly and slowly.',
  bailDetail: 'Leave it. There will be another one.',
  bailed: [
    'You put your hands back in your pockets and keep walking. There is always another car.',
    'You leave the door as you found it. Not this one, not tonight.',
  ],
  boldClean: [
    'It starts on the second try and you are off the estate before the exhaust has stopped being loud.',
    'Two streets, then the main road, then gone. Nobody will miss it until the weekend.',
  ],
  quietClean: [
    'You wait for the road to empty, roll it off the drive on the clutch, and start it around the corner.',
    'No lights, no noise, no hurry. It is a hundred yards away before it is properly running.',
  ],
  seen: [
    'The curtain moves as you pull off, and a face in it is memorising the shape of your head.',
    'The neighbour straightens up with his bin lid in his hand and watches the whole thing happen.',
  ],
  wounded: [
    'He gets a hand to the door while you are still moving, and what happens next happens to both of you.',
    'You take it out of the drive with him alongside it, and the street ends the argument badly.',
  ],
  caught: [
    'You stop, because the alternative is worse, and you sit there with your hands on the wheel until somebody comes.',
    'The alarm brings the whole road out, and a car in a crowd is not a getaway.',
  ],
}

const GRAND_THEFT: SceneCopy = {
  quiet: [
    'The house is dark and the thing you came for is in the room nearest the door.',
    'Everybody is out. It is not even locked, and it is worth more than a year of honest work.',
  ],
  occupied: [
    'They are home. You can hear the kettle going and a radio in the kitchen.',
    'Someone is in the next room and has not stopped talking on the telephone since you got here.',
  ],
  hot: [
    'The door goes behind you and there are two of them in the hall, and one is holding something.',
    'They are standing in the doorway of the room you are in, and they have already seen your hands.',
  ],
  pressDetail: 'Take the whole of it, and take your time about it.',
  coolDetail: 'Take the piece that fits under a coat and leave the rest.',
  bailDetail: 'Put it down and go.',
  bailed: [
    'You put it back on the shelf and let yourself out. It stops being a crime the moment you do.',
    'It sits there being worth more than you have. You walk out anyway.',
  ],
  boldClean: [
    'You take all of it, at your own pace, and nobody comes home for three hours.',
    'Two trips to the car and not one light comes on anywhere on the road.',
  ],
  quietClean: [
    'You take the one piece worth carrying and leave the rest looking untouched.',
    'Small, valuable and under a coat, and the kettle is still going when you shut the door.',
  ],
  seen: [
    'The radio stops. Somebody says "hello?" from the kitchen, and gets a very good look at you leaving.',
    'You are carrying it through the hall when the front door opens, and the two of you look straight at each other.',
  ],
  wounded: [
    'You go for the door they are standing in, and there are two of them and one of you.',
    'The hall is narrow, they are not moving, and you make the decision that ends the night in a hospital.',
  ],
  caught: [
    'You set it down carefully on the floor and put your hands out where they can be seen.',
    'There is nothing to say. You stand in their front room holding their property until somebody official arrives.',
  ],
}

const LOOTING: SceneCopy = {
  quiet: [
    'The window is already out and half the street has been through it. Nobody is coming for a while.',
    'The town has other problems tonight, and this row of shops is not one of them.',
  ],
  occupied: [
    'There are others in here doing the same thing, and any one of them would name you to save themselves.',
    'Somebody is filming it from across the road on a shoulder camera.',
  ],
  hot: [
    'A line of constables comes down the road in step, and they are not here to talk.',
    'The shopkeeper is standing in his own broken doorway with a length of pipe.',
  ],
  pressDetail: 'Take what is worth taking and let whoever is watching watch.',
  coolDetail: 'Take one thing and be nobody in particular about it.',
  bailDetail: 'This is not your night. Go home.',
  bailed: [
    'You step back over the glass and go home, and in the morning you are one of the ones who did not.',
    'You look at it for a while and then walk away up the middle of the empty road.',
  ],
  boldClean: [
    'You take everything worth carrying and the street is too busy being a disaster to notice one more person in it.',
    'Nobody stops you, nobody asks, and half the town is doing the same thing.',
  ],
  quietClean: [
    'One thing, under the coat, and out. You were never really here.',
    'You take what you can carry without hurrying and let the noise cover the rest.',
  ],
  seen: [
    'The camera across the road holds on you for a long, unhurried few seconds.',
    'One of the others watches you the whole time, and he will remember your face when he needs to.',
  ],
  wounded: [
    'The line reaches you at a run, and going forward into it was the wrong choice by some distance.',
    'The shopkeeper is defending the only thing he has, and he does it with everything he has left.',
  ],
  caught: [
    'You stop where you are with your hands out, and they take you out of the doorway without a word.',
    'There is nowhere to go that is not the road, and the road is full of them.',
  ],
}

const ARSON: SceneCopy = {
  quiet: [
    'The building is empty, the yard is dark, and there is nobody on the road behind you.',
    'Nothing has been in this place in years but pigeons. It would go up like paper.',
  ],
  occupied: [
    'There is a light on in the flat above it.',
    'Somebody is asleep in a car on the far side of the yard with the window down.',
  ],
  hot: [
    'A watchman comes round the corner of the building with a torch, and he has already seen the can.',
    'It catches faster than you meant, and it catches between you and the way out.',
  ],
  pressDetail: 'Set it properly, in more than one place, and make sure it goes.',
  coolDetail: 'One corner, one match, and out before it is anything much.',
  bailDetail: 'Put the can down and leave.',
  bailed: [
    'You put the cap back on and carry the can back to the car. The building is still standing in the morning.',
    'You stand there for a while and then you do not do it, and nobody will ever know how close it was.',
  ],
  boldClean: [
    'You set it in three places and it takes all of them, and you are a mile away before the sky over the yard changes colour.',
    'It goes up whole, and there is not a soul on the road to say who was there.',
  ],
  quietClean: [
    'One corner, and you are gone before it is more than a smell.',
    'You leave it small and let it find its own way, which it does, slowly, an hour after you have gone.',
  ],
  seen: [
    'The light in the flat goes on while you are still in the yard. A window opens above you.',
    'The man in the car sits up, and the two of you look at each other through his windscreen.',
  ],
  wounded: [
    'It takes hold behind you instead of in front of you, and the yard is suddenly a very long way away.',
    'You go back to set the third one, and the building makes the decision for you.',
  ],
  caught: [
    'The torch comes up and holds on your face, and you have a can in your hand and nothing to say.',
    'You stand very still in the yard while he talks into a radio.',
  ],
}

const DRUG_TRADE: SceneCopy = {
  quiet: [
    'The yard is empty and the buyer is on time and alone.',
    'It is a quiet road and a quiet hour and the whole thing should take four minutes.',
  ],
  occupied: [
    'There is a second car at the end of the road that has been there as long as you have.',
    'Your buyer brought somebody, and the somebody has not got out of the car.',
  ],
  hot: [
    'The men who get out of the second car do not move like buyers.',
    'Your buyer is sweating in a cold yard and keeps looking at his own coat.',
  ],
  pressDetail: 'Do the whole deal and do not be the one who blinks.',
  coolDetail: 'Move a small piece of it and keep the rest in the car.',
  bailDetail: 'Drive off. There will be another buyer.',
  bailed: [
    'You put it in gear and go, and whatever that was in the second car stays somebody else’s problem.',
    'You do not get out of the car at all. The yard is behind you inside a minute.',
  ],
  boldClean: [
    'The whole weight moves and the money is real and nobody drives past the end of the road once.',
    'Four minutes, exactly as planned, and the yard is empty again before anybody knows a thing happened in it.',
  ],
  quietClean: [
    'You move a corner of it, keep the rest in the boot, and take a different road home.',
    'A small piece, quickly, and you leave enough behind that a bad night would not have been the end of you.',
  ],
  seen: [
    'The second car pulls away as you finish, and it does not turn its lights on until the junction.',
    'Somebody has been watching the whole exchange from a window over the yard.',
  ],
  wounded: [
    'They are not buyers, and it is not an arrest either, and the yard is a bad place to find that out.',
    'His hand comes out of his coat with the wrong thing in it.',
  ],
  caught: [
    'The yard fills from both ends at once. There is nowhere to put it that is not in front of somebody.',
    'They were waiting for the money to change hands, because that is the moment that convicts you.',
  ],
}

const FIGHT: SceneCopy = {
  quiet: [
    'It is just the two of you, and nobody on this stretch of road is going to get involved.',
    'The bar has emptied out around you and whoever is left is looking at their drink.',
  ],
  occupied: [
    'Half the room is watching now, and one of them has a hand on the telephone.',
    'People have stopped on the pavement. This has an audience.',
  ],
  hot: [
    'His friends are up off their stools, and there are four of them.',
    'He has picked something up off the table, and he means it.',
  ],
  pressDetail: 'Go through him. Finish it.',
  coolDetail: 'One shove, enough to end it, and leave.',
  bailDetail: 'Take the hand off him and walk out.',
  bailed: [
    'You take your hand off his shirt and walk out, and by the car park you are already glad you did.',
    'You let it go. He says something to your back, and you keep walking, and that is the end of it.',
  ],
  boldClean: [
    'It is over in seconds and there is nobody in the road to say who started it.',
    'He goes down and stays there, and the street stays empty the whole time.',
  ],
  quietClean: [
    'One shove, hard enough to be an answer, and you are out of the door before it is anything more.',
    'You put him into the wall once and leave while it is still only that.',
  ],
  seen: [
    'The room watches all of it, and somebody is already saying your name into a telephone.',
    'It happens in front of thirty people, and thirty people are a lot of statements.',
  ],
  wounded: [
    'Four of them come off the stools at once, and it stops being anything you have any say in.',
    'He swings the thing in his hand and the night ends in a hospital corridor.',
  ],
  caught: [
    'You put your hands up and step back, and it does not matter, because the constable was already at the door.',
    'You stop, and it is far too late to have stopped.',
  ],
}

const DOMESTIC: SceneCopy = {
  quiet: [
    'It is late, the house is quiet, and there is nobody else in it.',
    'The argument has been going for an hour and the doors are shut.',
  ],
  occupied: [
    'The children are upstairs and awake.',
    'The window is open onto the road, and next door’s light has just come on.',
  ],
  hot: [
    'They have the telephone in their hand and their thumb on the dial.',
    'Someone is knocking on the front door, hard, and has not stopped.',
  ],
  pressDetail: 'Do not back down from it.',
  coolDetail: 'Say the worst of it and leave the room.',
  bailDetail: 'Stop. Walk out of the house.',
  bailed: [
    'You take your coat and go, and you walk until it is out of you.',
    'You stop mid-sentence and leave the room, and nothing happens that cannot be taken back.',
  ],
  boldClean: [
    'It happens the way these things happen, behind a shut door, and nobody outside the house knows a thing.',
    'The house is quiet again afterwards, in the way houses are.',
  ],
  quietClean: [
    'You say the worst thing you can think of and slam the door on the way out.',
    'It stays words. Bad ones, that stay in the room with them after you have gone.',
  ],
  seen: [
    'Next door’s light stays on. In the morning somebody makes a telephone call about what they heard.',
    'The children are on the landing. They see it, and they will keep seeing it.',
  ],
  wounded: [
    'It goes past anything either of you could have argued for, and the ambulance comes before the constable does.',
    'The room ends the argument, and it ends it in a way that cannot be undone.',
  ],
  caught: [
    'The knocking stops because the door opens, and the constable is already in the hall.',
    'They get the call out. It takes eleven minutes for somebody to arrive, and you spend all eleven in the kitchen.',
  ],
}

const GRAVE_VIOLENCE: SceneCopy = {
  quiet: [
    'There is nobody else here, and there is nothing between you and it but the decision.',
    'The road is empty and the hour is late, and everything that happens next happens because you chose it.',
  ],
  occupied: [
    'There are people close enough to hear. Close enough to say afterwards what they heard.',
    'A window overlooks all of this, and there is a light on behind it.',
  ],
  hot: [
    'They know. They have known since you came through the door, and they are not unprepared.',
    'There is somebody else in the house, and they are already on the stairs.',
  ],
  pressDetail: 'Go through with it.',
  coolDetail: 'Stop short of the worst of it.',
  bailDetail: 'Turn around and leave.',
  bailed: [
    'You turn around and go, and the rest of your life is the one where you did not.',
    'You put it down and walk out, and your hands do not stop shaking until the next town.',
  ],
  boldClean: [
    'It is done, and the road stays empty, and there is nobody at all to say you were ever on it.',
    'Afterwards the quiet is the loudest thing about it. Nobody comes. Nobody saw.',
  ],
  quietClean: [
    'You stop short. It is bad, and it is not the worst, and that distinction will matter later.',
    'You do enough and no more, and the difference between the two is the rest of your life.',
  ],
  seen: [
    'The window stays lit. Somebody stood at it for the whole of it and will stand in a courtroom later.',
    'People heard, and people came out, and among them is one who saw your face clearly.',
  ],
  wounded: [
    'They were ready, and you were not as ready as you thought, and it goes the other way entirely.',
    'The person on the stairs reaches you first, and after that none of it is yours to decide.',
  ],
  caught: [
    'You stop. It is not enough to have stopped, but you stop, and they take hold of you.',
    'Somebody has you by both arms, and there is nothing left to do but let them.',
  ],
}

const KIDNAPPING: SceneCopy = {
  quiet: [
    'The car park is empty and they are walking to their car alone.',
    'There is nobody on this road and the van door is already open.',
  ],
  occupied: [
    'There is somebody at the far end of the car park loading shopping.',
    'A car goes past slowly, and then goes past again.',
  ],
  hot: [
    'They fight, immediately and loudly, and a door opens somewhere behind you.',
    'There is a constable at the entrance to the car park.',
  ],
  pressDetail: 'Get them into the van.',
  coolDetail: 'Take the bag and let them go.',
  bailDetail: 'Shut the door and drive away.',
  bailed: [
    'You shut the van door and drive out of the car park, and they never know what nearly happened.',
    'You let them walk to their car. It is the only decision of the night you will be glad of.',
  ],
  boldClean: [
    'The door goes shut and the car park stays empty, and nobody reports anything for four hours.',
    'It takes seconds, and there is not a soul in the place to have seen any of them.',
  ],
  quietClean: [
    'You take the bag out of their hands and let them go, and it stays a robbery.',
    'You change your mind halfway and settle for what they were carrying.',
  ],
  seen: [
    'The person with the shopping straightens up and watches the van doors close.',
    'The car that went past twice has stopped, and somebody in it is writing down a registration.',
  ],
  wounded: [
    'They fight far harder than you planned for, and the car park turns into something you cannot leave.',
    'The door behind you opens and there are suddenly three people in this, and none of them are yours.',
  ],
  caught: [
    'You let go and step back, and the constable is already crossing the car park at a run.',
    'It ends with you face down on tarmac, which was always one of the ways it could end.',
  ],
}

const VEHICLE_HARM: SceneCopy = {
  quiet: [
    'The road behind you is empty and there is nobody at the roadside at all.',
    'It is three in the morning and there is not another light on the road in either direction.',
  ],
  occupied: [
    'There are people at the bus stop twenty yards back, and all of them are looking.',
    'The car behind you has stopped too, and its hazards are on.',
  ],
  hot: [
    'Somebody is already out of their car and running towards you, and there is a patrol car at the junction.',
    'The road fills with people almost at once, and one of them is on a telephone.',
  ],
  pressDetail: 'Put your foot down and keep going.',
  coolDetail: 'Pull over up the road and see what happens.',
  bailDetail: 'Stop the car and get out.',
  bailed: [
    'You stop the car and get out and do what a person is supposed to do, and that decision is the whole difference.',
    'You put the handbrake on and go back on foot, which is the hardest and only right thing.',
  ],
  boldClean: [
    'You take the next turning and then another, and by the time anybody has looked properly the road is empty.',
    'There was nobody to see it, and the damage is on the wrong side of the car to be obvious.',
  ],
  quietClean: [
    'You pull over a hundred yards up and sit there, and when nothing happens you drive on slowly.',
    'You stop, briefly, in a way that could be explained later, and then you go.',
  ],
  seen: [
    'The bus stop saw all of it, and one of them has your registration written on the back of a ticket.',
    'The car behind stayed with you for two miles with its lights on full, and it did not need to catch you to know you.',
  ],
  wounded: [
    'You put your foot down into a road that is already filling with people, and it becomes something else entirely.',
    'The junction is not empty, and you find that out at speed.',
  ],
  caught: [
    'You pull over because the patrol car is behind you now, and you sit with both hands on the wheel.',
    'You get about four hundred yards. It is not the kind of thing you get away from in a town this size.',
  ],
}

const EVADING: SceneCopy = {
  quiet: [
    'One car, a long straight road, and half a mile of nothing behind it.',
    'They are still a good way back and the turnings out of town are all ahead of you.',
  ],
  occupied: [
    'There is traffic ahead, and a school on the corner, and it is the wrong time of day for either.',
    'There are two of them now, and one has gone round.',
  ],
  hot: [
    'The road ahead has a car across it, and there are men out of it already.',
    'They are alongside you and the road narrows in two hundred yards.',
  ],
  pressDetail: 'Do not stop. Take the next turning at whatever speed it takes.',
  coolDetail: 'Ease off and look like somebody who was always going to stop.',
  bailDetail: 'Pull over and put your hands on the wheel.',
  bailed: [
    'You indicate, pull in and turn the engine off, and it stays the small thing it started as.',
    'You stop. It is the difference between a fine and a felony, and you make it in time.',
  ],
  boldClean: [
    'Three turnings and an alley, and the lights go the other way at the junction.',
    'You lose them in the estate and sit in the dark with the engine off for twenty minutes.',
  ],
  quietClean: [
    'You slow to something reasonable and take a legal turning, and they carry on past.',
    'You look for all the world like a man driving home. It works.',
  ],
  seen: [
    'They do not catch you, but they get the plate, and a plate is most of the way to a door being knocked on.',
    'The second car got in front long enough to see your face through the windscreen.',
  ],
  wounded: [
    'The road narrows exactly where they said it would, and you are still doing sixty when it does.',
    'You go for the gap between the car across the road and the wall, and there is no gap.',
  ],
  caught: [
    'You stop at the block because there is nothing else left, and they take you out through the driver’s door.',
    'The engine dies at the worst possible moment, and the rest happens without you.',
  ],
}

// ---------------------------------------------------------------------------
// POLICE-RISK — nobody is going to fight you; the danger is being seen doing
// it. Bands: quiet · a witness · a patrol near.
// ---------------------------------------------------------------------------

const SHOPLIFTING: SceneCopy = {
  quiet: [
    'The clerk is in the back and the aisle is empty.',
    'One person on the till, a queue at it, and nobody at all down this end of the shop.',
  ],
  occupied: [
    'A customer two rows over keeps glancing your way.',
    'The clerk has looked up twice now, and the second time was not an accident.',
  ],
  hot: [
    'There is a guard by the door and a camera on the ceiling.',
    'A constable is standing at the end of the aisle buying a newspaper.',
  ],
  pressDetail: 'Fill your coat and walk out like you own the place.',
  coolDetail: 'Pocket the small things and buy a drink to look normal.',
  bailDetail: 'Put it back on the shelf.',
  bailed: [
    'Not worth a record. You put it back and leave with nothing.',
    'You set it down on the shelf, straighten it, and walk out empty-handed.',
  ],
  boldClean: [
    'You walk out like you own it, and nobody so much as turns their head.',
    'Coat pockets, both hands full, straight past the till at a completely ordinary speed.',
  ],
  quietClean: [
    'You pocket the small things and buy a drink to look normal, and the clerk thanks you for it.',
    'One thing, small, and a receipt in your hand for something else entirely.',
  ],
  seen: [
    'The customer two rows over watches you do it and follows you to the door with their eyes.',
    'The clerk says nothing at the time, which is worse, and writes something down after you have gone.',
  ],
  wounded: [
    'The guard gets a hand on your collar at the door and the pavement outside is very hard.',
    'You go for the door past a constable, which turns a fine into a struggle and a struggle into a charge.',
  ],
  caught: [
    'A hand on your arm before you reach the door. "Would you come with me, please."',
    'The constable at the end of the aisle folds his newspaper. He has been watching for a while.',
  ],
}

const NIGHT_OUT: SceneCopy = {
  quiet: [
    'The street has emptied out and there is nobody left to bother.',
    'Two in the morning, one taxi at the rank, and the driver is asleep.',
  ],
  occupied: [
    'There are still people outside the chip shop, and one of them is watching you.',
    'The doorman across the road has been looking this way for a minute.',
  ],
  hot: [
    'There is a patrol van on the corner with two of them leaning on it.',
    'A constable is walking straight down the middle of the road towards you.',
  ],
  pressDetail: 'Make as much of it as you like. Let them look.',
  coolDetail: 'Keep it down and keep moving.',
  bailDetail: 'Call it a night and go home.',
  bailed: [
    'You call it a night, and in the morning it is a story instead of a charge.',
    'Somebody puts you in a taxi and that is the end of it.',
  ],
  boldClean: [
    'You make an evening of it in the middle of an empty street, and there is nobody left to mind.',
    'Nobody comes, nobody complains, and the road belongs to you for twenty minutes.',
  ],
  quietClean: [
    'You keep it down and keep walking, and the street forgets about you.',
    'Loud enough to enjoy, quiet enough that nobody reaches for a telephone.',
  ],
  seen: [
    'The chip shop watches the whole performance, and somebody in it makes a call.',
    'The doorman across the road has seen enough and is already talking into his radio.',
  ],
  wounded: [
    'You take it to the van on the corner, which is the single worst idea available to you.',
    'It goes from noise to hands very quickly, and the road is not soft.',
  ],
  caught: [
    'He does not even raise his voice. "Right. That is enough of that."',
    'They take you by both arms and put you in the back of the van, and you sober up on the way.',
  ],
}

const SOMEWHERE_YOU_SHOULD_NOT_BE: SceneCopy = {
  quiet: [
    'The fence is down at the corner and there is nobody on the site at all.',
    'The gate has been open for weeks and the yard behind it is dark and empty.',
  ],
  occupied: [
    'There is a caravan on the site with a light on in it.',
    'Somebody walking a dog on the path has stopped to look through the fence.',
  ],
  hot: [
    'A watchman comes round the container with a torch already up.',
    'There is a patrol car parked at the gate with somebody in it.',
  ],
  pressDetail: 'Go right in and take your time.',
  coolDetail: 'Stay near the fence and keep to the dark.',
  bailDetail: 'Get back over the fence.',
  bailed: [
    'You go back over the fence and walk off up the path, and none of it ever happened.',
    'You look at it for a while through the wire and then leave.',
  ],
  boldClean: [
    'You have the run of the place for an hour and nobody comes near it.',
    'Straight in, all the way to the far end, and out again without hurrying.',
  ],
  quietClean: [
    'You keep to the fence line and the dark, and you are out again in ten minutes.',
    'Nothing further in than the edge, and nobody the wiser.',
  ],
  seen: [
    'The dog walker is still at the fence when you come back to it, and they have had a long look.',
    'The caravan door opens and a torch finds the middle of your back.',
  ],
  wounded: [
    'You run at the torch instead of away from it, and the yard is full of things to fall over.',
    'The fence catches you going over it at speed, which is how most of these end.',
  ],
  caught: [
    'The torch holds on your face and a voice asks you what you think you are doing.',
    'The car at the gate turns its lights on. There is one way out of a yard and it is that one.',
  ],
}

const VANDALISM: SceneCopy = {
  quiet: [
    'A long blank wall, a dead-end road, and nobody on it.',
    'The car park is empty and the lights at that end have been out for months.',
  ],
  occupied: [
    'There is a lit window over the wall, and it is open.',
    'Two people are sitting in a car at the far end and have not driven off.',
  ],
  hot: [
    'A patrol comes down the road at walking pace with its window down.',
    'The owner of it comes out of the door beside the wall.',
  ],
  pressDetail: 'Do the whole wall properly. Take as long as it takes.',
  coolDetail: 'Something small, in a corner, and gone.',
  bailDetail: 'Put the can in your pocket and walk.',
  bailed: [
    'You put the can back in your pocket and walk off. The wall stays a wall.',
    'You stand in front of it for a minute and then you do not, and that is that.',
  ],
  boldClean: [
    'You do the whole wall, end to end, and take your time over it, and nobody comes down the road once.',
    'It takes forty minutes and it is the best thing you have ever done and there is nobody there to see it.',
  ],
  quietClean: [
    'Something small, low down in the corner, and you are round the end of the wall inside a minute.',
    'You keep it small enough to deny and quick enough not to be caught at.',
  ],
  seen: [
    'The window over the wall stays open, and somebody has been listening to the rattle of the can for ten minutes.',
    'The car at the far end puts its headlights on you for a moment before it drives away.',
  ],
  wounded: [
    'He comes out of the door fast and you go the wrong way past him.',
    'You run at the road rather than away from it, and the road has a patrol car on it.',
  ],
  caught: [
    'The window comes down. "Stay exactly where you are."',
    'He has you by the arm and the can is still in your hand and still wet.',
  ],
}

const BAD_DRIVING: SceneCopy = {
  quiet: [
    'Empty road, empty mirrors, and a straight run home.',
    'Nothing on the road at this hour but you and the cat eyes down the middle of it.',
  ],
  occupied: [
    'There is a car behind you that has been behind you for a while.',
    'The road into town has people on the pavements and a bus pulling out.',
  ],
  hot: [
    'There is a patrol car at the junction, sitting still, facing your way.',
    'Blue lights come round the bend behind you.',
  ],
  pressDetail: 'Carry on as you are. It is not far.',
  coolDetail: 'Slow to the limit and drive it like a driving test.',
  bailDetail: 'Pull over, stop, and stay there.',
  bailed: [
    'You pull into the layby and stop and sit there until you are fit to drive. Nothing happens at all.',
    'You leave the car where it is and walk, which is the cheapest decision of the night.',
  ],
  boldClean: [
    'You take the whole road at your own speed and get home without seeing another vehicle.',
    'Nobody sees any of it, and the car is on the drive before the hour is up.',
  ],
  quietClean: [
    'You sit at exactly the limit with both hands on the wheel and drive it like a test.',
    'You slow right down and take the long way, and it is dull and it works.',
  ],
  seen: [
    'The car behind stays behind you all the way into town, and its passenger is on a telephone.',
    'The bus driver leans on the horn and gets a long look at your face doing it.',
  ],
  wounded: [
    'You take the bend at that speed with something coming the other way.',
    'You put your foot down past a patrol car, which turns a bad night into a very long one.',
  ],
  caught: [
    'The blue lights fill the car. "Switch the engine off for me."',
    'The patrol pulls out behind you at the junction and stays there for half a mile before it lights up.',
  ],
}

const CARRYING: SceneCopy = {
  quiet: [
    'The street is empty and nobody has any reason to stop you.',
    'A quiet road, a coat that hangs right, and nothing to draw an eye.',
  ],
  occupied: [
    'There is a doorman on the corner who looks at everybody twice.',
    'The bus is full and you are standing up against people the whole way.',
  ],
  hot: [
    'Two constables are stopping people at the end of the road.',
    'A patrol slows alongside you and the window comes down.',
  ],
  pressDetail: 'Carry on. Walk straight past them.',
  coolDetail: 'Take another road and keep your hands out of your pockets.',
  bailDetail: 'Get rid of it in the nearest bin.',
  bailed: [
    'It goes in a bin behind the chip shop and you keep walking with nothing on you at all.',
    'You leave it under a hedge and come back for it another day, or never.',
  ],
  boldClean: [
    'You walk straight past them at your own pace and nobody looks at you twice.',
    'Nothing on the road, nothing said, and you are home with it inside ten minutes.',
  ],
  quietClean: [
    'You take the next road instead and add ten minutes to the walk.',
    'You keep your hands where they can be seen and go the long way round the whole thing.',
  ],
  seen: [
    'The doorman watches you the length of the street and remembers the coat.',
    'Somebody on the bus notices the shape of it and looks at your face for a good deal longer than is comfortable.',
  ],
  wounded: [
    'You go past them at a run, and running from two constables is a decision that answers itself.',
    'It comes out of the coat in the middle of an argument, and the street stops being a street.',
  ],
  caught: [
    '"Empty your pockets for me, please." There is nowhere for it to have gone.',
    'The window comes down and the question is polite and there is only one true answer to it.',
  ],
}

const IN_FRONT_OF_THE_LAW: SceneCopy = {
  quiet: [
    'It is one constable, on his own, and he is not in a hurry.',
    'There is nobody else in the room and no record being kept of any of it.',
  ],
  occupied: [
    'There are people watching from the pavement, and one of them has a camera up.',
    'The whole waiting room can hear this.',
  ],
  hot: [
    'There are four of them now, and the van has arrived.',
    'The judge has stopped writing and is looking directly at you.',
  ],
  pressDetail: 'Say the whole of it, and do not give an inch.',
  coolDetail: 'Say the least you can and let it pass.',
  bailDetail: 'Say nothing. Do what you are told.',
  bailed: [
    'You do as you are asked and say nothing at all, and it goes no further than it already had.',
    'You swallow it. It costs nothing and it ends there.',
  ],
  boldClean: [
    'You say all of it, and he decides it is not worth the paperwork, and walks away.',
    'It goes nowhere. Some days it goes nowhere.',
  ],
  quietClean: [
    'You give the shortest possible answers and it runs out of anywhere to go.',
    'You say the one thing you have to and nothing else, and it passes.',
  ],
  seen: [
    'The camera on the pavement gets every word, and the words are not good ones.',
    'It happens in front of a full room, and a full room is a great many witnesses.',
  ],
  wounded: [
    'You put a hand out to stop him and after that it is four of them and the pavement.',
    'You take a step towards the bench, and the room moves faster than you do.',
  ],
  caught: [
    '"Right." And that is the end of the conversation and the beginning of the charge.',
    'They put you in the van without raising their voices at all, which is somehow worse.',
  ],
}

const BACK_ROOM: SceneCopy = {
  quiet: [
    'The garage is shut, the shutter is down, and the stuff is already in the back.',
    'Nobody comes down this lane and nobody has asked a question about it in two years.',
  ],
  occupied: [
    'The man who brought it will not stop talking, and the shutter is half up.',
    'Somebody has been sitting in a car at the end of the lane for a while.',
  ],
  hot: [
    'There is a constable at the shutter asking whose van that is.',
    'The man who brought it has been arrested twice this month, and he brought a friend.',
  ],
  pressDetail: 'Take the whole lot and move it on this week.',
  coolDetail: 'Take a couple of pieces and let the rest go elsewhere.',
  bailDetail: 'Tell him to take it away.',
  bailed: [
    'You tell him to put it back in the van and take it somewhere else, and you shut the shutter behind him.',
    'You do not touch it and you do not look at it. It leaves the way it came.',
  ],
  boldClean: [
    'The whole lot goes in the back and out again inside the week, and nobody ever comes looking for it.',
    'You take all of it, cheap, and it is gone before anybody has finished writing the list.',
  ],
  quietClean: [
    'You take two pieces, pay cash, and let the rest be somebody else’s problem.',
    'A little of it, nothing traceable, and the shutter down again inside ten minutes.',
  ],
  seen: [
    'The car at the end of the lane has been there the whole time and pulls away when the shutter comes down.',
    'He tells three people where it went before the week is out, because he tells everybody everything.',
  ],
  wounded: [
    'His friend is not a friend, and the back of a garage is a bad place to find that out.',
    'You go for the shutter, and it comes down on the argument rather than ending it.',
  ],
  caught: [
    '"Whose van is that, then." And it is all still in the back of it.',
    'They come under the shutter before it is halfway down, and every piece in the garage is on a list.',
  ],
}

// ---------------------------------------------------------------------------
// DISCOVERY — nobody is going to walk in on a ledger. The danger is that it
// is noticed later. Bands: clean books · a question · an audit.
// ---------------------------------------------------------------------------

const EMBEZZLEMENT: SceneCopy = {
  quiet: [
    'The books are quiet and nobody is looking at your ledger.',
    'The account has not been reconciled since spring and you are the only one who touches it.',
  ],
  occupied: [
    'Accounting asked about a transfer last week. Nothing since — yet.',
    'Somebody has been through the ledger since you were last in it. The margin is not in your hand.',
  ],
  hot: [
    'There is an outside auditor in the office this month.',
    'Your file is open on the finance director’s desk and he is not at his desk.',
  ],
  pressDetail: 'Paper over the gap with another entry and take the rest.',
  coolDetail: 'Take a smaller cut and keep it quiet.',
  bailDetail: 'Put it back before anyone counts.',
  bailed: [
    'You put it back before anyone counts, and the column adds up the way it always did.',
    'You reverse the entry the same afternoon. Nothing in the book says it was ever otherwise.',
  ],
  boldClean: [
    'You move the whole balance and square the book behind you. It will be spring before anybody looks.',
    'One entry covers the other and both of them look like work. Nobody reads this account twice.',
  ],
  quietClean: [
    'A little, off an account nobody reads closely. It will not be missed.',
    'You take a figure small enough to be a rounding and leave the rest exactly where it was.',
  ],
  seen: [
    'You take the lot, and the transfer sits there in the open, in your hand, dated.',
    'The entry you papered it with is in a different pen. Somebody will notice that eventually, and somebody does.',
  ],
  wounded: [
    'The auditor asks for the ledger while you are still holding it, and every entry after page four is yours.',
    'You add one more entry to cover the last, in a month when a stranger is reading every one of them.',
  ],
  caught: [
    'The auditor turns the page towards you and asks you to explain it.',
    'The finance director asks you to sit down, and there is already somebody else in the room.',
  ],
}

const TAX_EVASION: SceneCopy = {
  quiet: [
    'The return is due, and half of what you took this year was never written down anywhere.',
    'Nobody has ever asked you a question about a return in your life.',
  ],
  occupied: [
    'A letter came about last year’s figures. Only a query, so far.',
    'The revenue office has written twice, politely, and the second letter was less polite.',
  ],
  hot: [
    'There is an examination open on the last three years and they have asked for the books.',
    'They want the ledgers by the end of the month, and they have named the accounts.',
  ],
  pressDetail: 'Declare a fraction of it and let the rest disappear.',
  coolDetail: 'Understate it a little. Nothing that stands out.',
  bailDetail: 'Declare all of it and pay what is owed.',
  bailed: [
    'You put the whole figure on the return and pay what it comes to, and it hurts, and it is over.',
    'You declare all of it. The cheque is enormous and nothing else about the year is.',
  ],
  boldClean: [
    'Half of it never reaches the page and nobody ever asks a thing.',
    'The return goes in with a number on it that has very little to do with the year, and the year ends.',
  ],
  quietClean: [
    'You shade it. Not enough to stand out from anybody else in the trade.',
    'A few per cent, in the direction everybody shades it, and the return passes without a glance.',
  ],
  seen: [
    'The figure does not sit right next to last year’s, and the difference is in writing, signed by you.',
    'They have both returns side by side now, and the two of them tell different stories.',
  ],
  wounded: [
    'You file a third false return into an open examination, which turns a bill into a prosecution.',
    'They already had the bank statements. You had signed something that disagreed with all of them.',
  ],
  caught: [
    'They ask you to confirm the figure, and then they show you the one they already have.',
    'The examination closes with an assessment, and under the assessment is a referral.',
  ],
}

const FORGERY: SceneCopy = {
  quiet: [
    'You have his signature on four other things and an afternoon on your own with the book.',
    'The paper is right, the ink is right, and nobody who could tell is in the building.',
  ],
  occupied: [
    'The bank called about the last one to confirm it. They took your word for it.',
    'Somebody in the office has said, twice now, that the writing does not look like his.',
  ],
  hot: [
    'There is an examiner comparing signatures at the counter and he has the file open.',
    'They have asked the man himself whether he signed it.',
  ],
  pressDetail: 'Sign the whole set and put them all through at once.',
  coolDetail: 'One small one that nobody would query.',
  bailDetail: 'Burn it and forget it.',
  bailed: [
    'You put it in the grate and watch it go, and there is nothing left to compare to anything.',
    'You tear it into pieces small enough to be nothing at all.',
  ],
  boldClean: [
    'All of them clear inside the week and nobody looks twice at any of them.',
    'The whole set goes through, and it is a better hand than his own.',
  ],
  quietClean: [
    'One small one, for a figure nobody would query, and it goes through like anything else.',
    'You keep it to an amount that would be boring to check, and nobody checks it.',
  ],
  seen: [
    'They accept it and then the office starts talking about the writing.',
    'It clears — and then a copy of it turns up on a desk beside three real ones.',
  ],
  wounded: [
    'You put a second one in while the first is already being compared, and the two of them convict each other.',
    'The examiner looks up from the counter, and you had signed it in front of him.',
  ],
  caught: [
    'He puts the two signatures side by side on the counter and turns them towards you.',
    'They ask the man himself, in the next room, and he says no.',
  ],
}

const SMALL_PAPER_CRIME: SceneCopy = {
  quiet: [
    'The account has been empty for a week and the man behind the counter does not know you.',
    'Nobody in this shop has ever telephoned a bank about anything.',
  ],
  occupied: [
    'The first one bounced and somebody has left a message about it.',
    'The shop has your name on a card behind the till now.',
  ],
  hot: [
    'The bank has closed the account and asked you to come in.',
    'The man behind the counter is holding the last one and looking at a list.',
  ],
  pressDetail: 'Write it for the full amount and be somewhere else on Monday.',
  coolDetail: 'Keep it small — an amount nobody chases.',
  bailDetail: 'Tear it up.',
  bailed: [
    'You tear it up in the car park. It was never worth what it would have cost.',
    'You put the book back in your pocket and pay in cash you can barely spare.',
  ],
  boldClean: [
    'It goes through for the whole amount and by the time it comes back you are three towns away.',
    'Nobody rings anybody, and the goods are in the boot before the day is out.',
  ],
  quietClean: [
    'You keep it to an amount nobody chases, and nobody chases it.',
    'Small enough to be written off by a shop that cannot be bothered.',
  ],
  seen: [
    'The message on the machine has your name in it and a date and a figure.',
    'Your name goes on the card behind the till, which is a very short list to be on.',
  ],
  wounded: [
    'You write another into a shop that already has your name behind the till.',
    'You go back in on the Monday, which is the one thing you needed not to do.',
  ],
  caught: [
    'He does not hand back the cheque. He asks you to wait a moment and goes to the telephone.',
    'The bank is not asking you to come in about the account. There is somebody with them.',
  ],
}

const SOMEBODY_ELSES_NAME: SceneCopy = {
  quiet: [
    'You have their name, their date of birth and a u?ility bill, and none of it is being watched.',
    'The card came through the door in somebody else’s name and it has not been reported.',
  ],
  occupied: [
    'One of the accounts has been frozen and a letter has gone out to them.',
    'They have started asking their bank questions. Nothing has come back to you yet.',
  ],
  hot: [
    'There is an investigator on the account and every transaction is being read.',
    'The shop asked for identification, and then asked again, and then went into the back.',
  ],
  pressDetail: 'Run every account to the limit while it is open.',
  coolDetail: 'Small amounts, spread out, nothing that flags.',
  bailDetail: 'Put the papers in the fire.',
  bailed: [
    'The papers go in the fire and whoever they belong to never knows how near it came.',
    'You post the card back through their door and that is genuinely the end of it.',
  ],
  boldClean: [
    'Every account goes to its limit in a fortnight and none of it is questioned until long after.',
    'You take the lot before anybody in it has looked at a statement.',
  ],
  quietClean: [
    'Small amounts, spread across weeks, nothing large enough to flag.',
    'You keep every one of them under the figure that makes a computer telephone somebody.',
  ],
  seen: [
    'The frozen account has a letter attached to it now with a list of every transaction on it.',
    'They have reported it, and the report has a time and a place on it, and you were both.',
  ],
  wounded: [
    'You use it again in the same shop that asked for identification the first time.',
    'You run one more through an account that already has an investigator reading it.',
  ],
  caught: [
    'The shop assistant comes back from the office with somebody who is not a shop assistant.',
    'They read the transactions back to you in order, and they are all in the same handwriting.',
  ],
}

const CLAIM_FRAUD: SceneCopy = {
  quiet: [
    'The claim is in, the paperwork is thin, and the adjuster has forty others this month.',
    'Nobody is going to drive out and look at it. They almost never do.',
  ],
  occupied: [
    'The adjuster has asked for one more document than you expected.',
    'They want to send somebody to look. Only routine, they say.',
  ],
  hot: [
    'There is an investigator on it now, and he has been to the site.',
    'They have pulled every claim you have made in ten years and put them in one folder.',
  ],
  pressDetail: 'Inflate the whole claim and stand behind every figure.',
  coolDetail: 'Pad it a little. Nothing an adjuster would drive out for.',
  bailDetail: 'Withdraw it.',
  bailed: [
    'You withdraw the claim and say it was a misunderstanding, and it is, from that moment on.',
    'You let it go. There is nothing on paper that says you ever meant it.',
  ],
  boldClean: [
    'They pay it in full without a query. Forty claims a month is a great many claims.',
    'The whole figure clears, and nobody drives anywhere to look at anything.',
  ],
  quietClean: [
    'You pad it enough to be worth it and not enough to be interesting.',
    'A number that is high but not remarkable, and it goes through with the rest of the post.',
  ],
  seen: [
    'The document they asked for does not agree with the one you already sent.',
    'The man they sent out took photographs, and photographs keep.',
  ],
  wounded: [
    'You stand behind every figure in front of an investigator who has already been to the site.',
    'You send a second claim into a folder that already holds ten years of the first.',
  ],
  caught: [
    'He puts the photographs on the table one at a time and asks you about each of them.',
    'They do not argue about the figure. They ask you to come in and talk about all of them.',
  ],
}

const WASHING_IT: SceneCopy = {
  quiet: [
    'The business takes cash and nobody has ever counted what walks through the door.',
    'Three accounts, two names, and a set of books that has never been read by anybody but you.',
  ],
  occupied: [
    'The bank has asked what the deposits are for. Only a form, so far.',
    'One of the transfers came back with a question attached to it.',
  ],
  hot: [
    'The accounts are being read by somebody whose whole job is reading accounts.',
    'They have both sets of books, and the two of them do not agree.',
  ],
  pressDetail: 'Push the whole amount through this quarter.',
  coolDetail: 'Move a little at a time and keep the takings believable.',
  bailDetail: 'Leave it where it is.',
  bailed: [
    'You leave it in the bag under the floor, where it does nothing and says nothing.',
    'You stop. It stays money nobody can spend, which is better than the alternative.',
  ],
  boldClean: [
    'The whole quarter goes through and comes out the other side looking like a good year for the trade.',
    'It all goes, and the books are beautiful, and nobody asks a single question about any of it.',
  ],
  quietClean: [
    'A little at a time, and the takings stay the sort of takings a shop like that has.',
    'You keep the weekly figure inside what the till could plausibly have done.',
  ],
  seen: [
    'The form the bank sent is on a file now, with your signature at the bottom of it.',
    'The returned transfer is the loose thread, and somebody has started pulling on it.',
  ],
  wounded: [
    'You push a quarter’s worth through accounts that are already being read line by line.',
    'You move it again while the two sets of books are on the same desk.',
  ],
  caught: [
    'They lay the two sets of books side by side and ask which one is the real one.',
    'The questions stop being about the business and start being about you.',
  ],
}

const BRIBERY: SceneCopy = {
  quiet: [
    'It is the two of you in a car park and there is no reason for either of you to say a word about it afterwards.',
    'He has taken one before. Everybody in the trade knows he has taken one before.',
  ],
  occupied: [
    'Somebody in his office has started asking how the last contract was decided.',
    'He is nervous, and he keeps looking past you at the door.',
  ],
  hot: [
    'There is an inquiry into the last award and both your names are in it.',
    'He is wearing a coat indoors and he has not taken it off.',
  ],
  pressDetail: 'Hand it over and name what you want for it.',
  coolDetail: 'Make it a favour and a lunch and nothing anybody could name.',
  bailDetail: 'Put the envelope away.',
  bailed: [
    'The envelope stays in your inside pocket and the conversation stays a conversation.',
    'You talk about the weather and the contract and nothing else, and you both go home.',
  ],
  boldClean: [
    'It changes hands and the decision goes the way it was always going to go now.',
    'Nobody counts it in front of anybody, and the award is announced three weeks later.',
  ],
  quietClean: [
    'It becomes a favour and a long lunch and a job for his nephew, and none of that is a crime on paper.',
    'You make it into the kind of thing that could be explained, and it works nearly as well.',
  ],
  seen: [
    'Somebody in his office writes down the date of the meeting, and the date is the problem.',
    'The award goes your way, and the inquiry into the last one gets very interested in this one.',
  ],
  wounded: [
    'You hand it to a man in a coat he has not taken off indoors.',
    'You name what you want for it, out loud, into an inquiry that is already open.',
  ],
  caught: [
    'He does not take it. Two men get out of the car at the other end of the car park.',
    'They play it back to you, and it is unmistakably your voice.',
  ],
}

const EXTORTION: SceneCopy = {
  quiet: [
    'He has more to lose than you do, and he knows it, and there is nobody else in the room.',
    'What you have on him would end him, and he has already gone grey looking at it.',
  ],
  occupied: [
    'He has told somebody. Not everything, but enough that somebody knows there is something.',
    'He asked for a week, and he has spent the week talking to a solicitor.',
  ],
  hot: [
    'He has been to the police, and they have told him exactly what to say to you.',
    'There is a car outside that has been outside for both of the last two meetings.',
  ],
  pressDetail: 'Name a bigger figure and a shorter deadline.',
  coolDetail: 'Take what he is offering and let it end there.',
  bailDetail: 'Drop it. Give the thing back.',
  bailed: [
    'You give him the thing back and never mention it again, and he never quite believes his luck.',
    'You drop it entirely. It is the only version of this that does not end badly for both of you.',
  ],
  boldClean: [
    'He pays the bigger figure inside the week and says nothing to anybody, because he cannot.',
    'You name it and he agrees to it in the same breath, and that is the whole conversation.',
  ],
  quietClean: [
    'You take what he offered, once, and it ends there, which is more than most of these do.',
    'One payment, no threats written down anywhere, and neither of you ever refers to it again.',
  ],
  seen: [
    'The solicitor he spent the week with has a file now, and the file has dates in it.',
    'He told somebody. Not everything — but a name, and a figure, and when.',
  ],
  wounded: [
    'You name a bigger figure to a man who has already been told exactly what to say to you.',
    'You put the deadline in writing, into a conversation that is being recorded.',
  ],
  caught: [
    'He says the figure back to you very clearly, twice, and then the car outside empties.',
    'They have all of it: the dates, the amounts, and you saying what would happen if he did not.',
  ],
}

/**
 * EVERY OFFENCE IN THE CATALOGUE, pointed at the scene it actually is.
 *
 * There is no default and no fallback. A crime with no entry here is a bug,
 * and `crimecopy.test.ts` fails the build over it — which is the whole
 * mechanism that stops a fifty-ninth offence quietly inheriting a burglary's
 * shotgun the way the old shared template let it.
 *
 * Where several ids share a set they share a SCENE: murder in the first and
 * second degree differ in what a court later decides about intent, not in
 * the room it happened in.
 */
export const SCENE_OF: Readonly<Record<string, SceneCopy>> = {
  // --- physical ---------------------------------------------------------
  burglary: BURGLARY,
  'commercial-burglary': COMMERCIAL_BURGLARY,
  robbery: STREET_ROBBERY,
  'armed-robbery': ARMED_ROBBERY,
  'auto-theft': AUTO_THEFT,
  'grand-theft': GRAND_THEFT,
  looting: LOOTING,
  arson: ARSON,
  'drug-trafficking': DRUG_TRADE,
  'drug-manufacturing': DRUG_TRADE,
  'simple-assault': FIGHT,
  battery: FIGHT,
  'aggravated-assault': FIGHT,
  brandishing: FIGHT,
  'unlawful-discharge': FIGHT,
  'assault-deadly-weapon': FIGHT,
  'domestic-violence': DOMESTIC,
  'attempted-murder': GRAVE_VIOLENCE,
  'murder-second': GRAVE_VIOLENCE,
  'murder-first': GRAVE_VIOLENCE,
  'felony-murder': GRAVE_VIOLENCE,
  'voluntary-manslaughter': GRAVE_VIOLENCE,
  'involuntary-manslaughter': GRAVE_VIOLENCE,
  kidnapping: KIDNAPPING,
  'hit-and-run-injury': VEHICLE_HARM,
  'vehicular-assault': VEHICLE_HARM,
  'vehicular-manslaughter': VEHICLE_HARM,
  'evading-police': EVADING,

  // --- police risk ------------------------------------------------------
  shoplifting: SHOPLIFTING,
  'disorderly-conduct': NIGHT_OUT,
  'public-intoxication': NIGHT_OUT,
  'disturbing-peace': NIGHT_OUT,
  trespassing: SOMEWHERE_YOU_SHOULD_NOT_BE,
  loitering: SOMEWHERE_YOU_SHOULD_NOT_BE,
  vandalism: VANDALISM,
  'reckless-driving': BAD_DRIVING,
  dui: BAD_DRIVING,
  'suspended-license': BAD_DRIVING,
  'hit-and-run-property': BAD_DRIVING,
  'drug-possession': CARRYING,
  'possession-with-intent': CARRYING,
  'unlawful-firearm': CARRYING,
  'concealed-weapon': CARRYING,
  'resisting-arrest': IN_FRONT_OF_THE_LAW,
  obstruction: IN_FRONT_OF_THE_LAW,
  contempt: IN_FRONT_OF_THE_LAW,
  'receiving-stolen': BACK_ROOM,

  // --- discovery --------------------------------------------------------
  embezzlement: EMBEZZLEMENT,
  'tax-evasion': TAX_EVASION,
  forgery: FORGERY,
  'bad-check': SMALL_PAPER_CRIME,
  'petty-fraud': SMALL_PAPER_CRIME,
  'identity-theft': SOMEBODY_ELSES_NAME,
  'credit-card-fraud': SOMEBODY_ELSES_NAME,
  'insurance-fraud': CLAIM_FRAUD,
  'wire-fraud': CLAIM_FRAUD,
  'money-laundering': WASHING_IT,
  bribery: BRIBERY,
  extortion: EXTORTION,
}
