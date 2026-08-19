/**
 * THE SITUATION (MILITARY_DEPTH_PLAN §4.1, §4.2, §4.4b).
 *
 * OWNER, TWICE: "make sure we are being descriptive in the combat scenes and
 * our actions are descriptive along with the results and the scenes and
 * everything." And later, reading his own screen: "These arent very
 * descriptive or in depth like how we discussed."
 *
 * WHAT WAS ACTUALLY WRONG, and it was not the prose. The scene catalogue is
 * well written — twenty-four scenes, each with a line per threat level. But
 * every one of them has the SAME STRUCTURE: one sentence of read, three
 * one-word buttons, one status line. §4.1 names the real fault: "24 scenes
 * read as one scene today because the STRUCTURE is identical, not because the
 * prose is thin."
 *
 * So this module adds the missing layer: a contact generates a SITUATION.
 *
 * THREE RULES THE OWNER THEN ADDED, each from reading his own screen:
 *
 *   1. AN OPTION MUST NOT TELL YOU WHAT WILL HAPPEN. "the results of your
 *      actions shouldnt be told to the user before they click it." The first
 *      version promised outcomes — "nobody else gets hit in the next thirty
 *      seconds" — which is the game answering the question it is asking. An
 *      option states the ORDER and what it RISKS, and nothing else.
 *
 *   2. THE SAME ANSWER MUST NOT READ THE SAME WAY TWICE. "each choice should
 *      be random like and not give the same results every single time." There
 *      was ONE sentence per spectrum, so every push in a career opened with
 *      the same words. The telling is drawn from several, seeded on the
 *      contact so a given afternoon still reads the same way for ever.
 *
 *   3. IT HAS TO BE ENGLISH. "6 of yours on the ground. you count 3 maybe 4
 *      across 200 metres. this is obviously bad writting." Right, and the
 *      first half is worse than clumsy: "on the ground" is what you say about
 *      a man who is DOWN, so it read as six casualties. Counts are words now,
 *      ranges are spoken the way a soldier says them, and nothing about your
 *      own strength borrows a phrase that means a casualty.
 *
 * NOTHING IS STORED. The situation is derived from (seed, person, tick), so
 * it is the same afternoon every time it is read, and a contact recorded
 * before this module existed has one waiting.
 *
 * The options map down onto the three-way spectrum the rest of the engine
 * already resolves (`push` / `hold` / `cover`), so none of the casualty,
 * award or record machinery changes. An id is `spectrum:variant`; a bare
 * `push` from an older save still parses.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { hash32, Stream } from './rng.js'
import type { SceneChoice, Threat, World } from './types.js'

/** Who saw whom, which decides whether you are reacting or choosing. */
export type FirstSight = 'they-saw-you' | 'you-saw-them' | 'at-once'

export interface Situation {
  /** The low end of what was counted. Nobody counts exactly, under fire. */
  readonly countLow: number
  readonly countHigh: number
  /** Where this is happening, as a phrase: "a goat track on the north face". */
  readonly ground: string
  /** Metres, and it is the number every option is priced against. */
  readonly distance: number
  readonly firstSight: FirstSight
  /** Is the radio working? Everything about support hangs off this. */
  readonly radio: boolean
  /** Minutes until the guns can answer, or null when nothing is in range. */
  readonly gunsMinutes: number | null
  /** Minutes until air can be overhead, or null. */
  readonly airMinutes: number | null
  /** Minutes of usable light left; 0 means it is already dark. */
  readonly lightMinutes: number
  /** What the weather is doing to this, or null when it is doing nothing. */
  readonly weather: string | null
  /** Somebody hit in the opening burst, by the name the squad uses. */
  readonly downNow: string | null
  /** How many of you there are. NOT how many are down. */
  readonly strength: number
  /** Whether the ground gives a covered approach — gates the flank. */
  readonly hasApproach: boolean
  /** Whether there is cover within a rush — gates going to ground. */
  readonly hasCover: boolean
}

/**
 * EACH ONE CARRIES ITS OWN PREPOSITION.
 *
 * They were bare noun phrases with "You are on " glued in front, which gives
 * "You are ON a mud-walled compound" and "ON a culvert" — the same fault as
 * `rangeWords` inside another preposition, and caught the same way, by reading
 * a printed sample. A place knows whether you are on it or in it; the sentence
 * does not.
 */
const GROUNDS: readonly string[] = [
  'on a goat track on the north face',
  'on the shoulder of a dry wadi',
  'in a treeline at the edge of cut fields',
  'in a mud-walled compound on the village edge',
  'on the open scree below a ridge',
  'on a rutted road between two irrigation ditches',
  'on a hillside of terraced orchard',
  'on the flat ground short of a river crossing',
  'in a rubbled street of two-storey houses',
  'in a culvert under the main road',
  'on the reverse slope of a low saddle',
  'on a stony plateau with nothing on it for a mile',
]

const WEATHERS: readonly (string | null)[] = [
  null,
  null,
  null,
  'It has been raining since first light and everything is slick',
  'The dust is up and you are eating it with every breath',
  'It is well over a hundred degrees and has been all day',
  'There is a wind coming down the valley that takes the sound away',
  'The cloud is on the deck, so nothing is flying today',
  'It is cold enough that hands are already going',
]

/**
 * A NUMBER, SPOKEN.
 *
 * Nobody says "3, maybe 5" out loud, and digits mid-sentence read like a
 * spreadsheet with adjectives on it.
 */
const ONES: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS: readonly string[] = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]

export function numberWord(value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n < 20) return ONES[n] ?? String(n)
  if (n < 100) {
    const ten = TENS[Math.floor(n / 10)] ?? ''
    const one = n % 10
    return one === 0 ? ten : `${ten}-${ONES[one] ?? ''}`
  }
  if (n < 1000) {
    const hundreds = `${ONES[Math.floor(n / 100)] ?? ''} hundred`
    return n % 100 === 0 ? hundreds : `${hundreds} and ${numberWord(n % 100)}`
  }
  return String(n)
}

function capitalise(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** "at forty metres" / "two hundred metres out" — how it is actually said. */
function rangeWords(metres: number): string {
  return metres <= 100 ? `at ${numberWord(metres)} metres` : `${numberWord(metres)} metres out`
}

/**
 * THE BARE DISTANCE, for when a preposition already governs it.
 *
 * `rangeWords` carries its own preposition, so dropping it into another one
 * produced "inside two hundred and eighty metres OUT OF a position nobody has
 * seen properly" — caught by reading a printed sample rather than by a test,
 * which is the only way this kind of fault ever gets caught.
 */
function bareRange(metres: number): string {
  return `${numberWord(metres)} metres`
}

/**
 * WHO IS HERE, BY THE NAMES THE SQUAD USES.
 *
 * The squad is on the deployment already (Stage 1), and these are real
 * registered people — which is what makes "Volkov goes down before anybody
 * hears it" mean anything at all. Seeded, so the man on point is the same man
 * every time the scene is read, and derived, so nothing is stored.
 */
export interface SceneCast {
  readonly strength: number
  /** Hit in the opening burst, or null on a contact that opens clean. */
  readonly downNow: string | null
  /** Whoever ends up in front if this goes forward. */
  readonly onPoint: string | null
  readonly names: readonly string[]
}

export function castFor(world: World, personId: EntityId, tick: Tick, threat: Threat): SceneCast {
  const tours = world.deployments.get(personId) ?? []
  const tour = tours.find(
    (each) =>
      each.startedAtTick <= tick && (each.returnedAtTick === null || each.returnedAtTick >= tick),
  )
  const names: string[] = []
  for (const mate of tour?.squad ?? []) {
    const them = world.people.get(mate.personId)
    if (them === undefined || them.deathTick !== null) continue
    // The nickname is what they would actually be called; the surname is the
    // fallback, because a report and a shout use different halves of a name.
    names.push(mate.nickname.length > 0 ? mate.nickname : them.familyName)
  }
  const draw = hash32(world.seed, Stream.CombatResolution, personId, 63_000 + tick)
  const strength = names.length > 0 ? names.length + 1 : 4 + (draw % 5)

  // SOMEBODY IS HIT BEFORE THE FIRST DECISION, sometimes — and it changes the
  // whole shape of the problem, because it puts a man on the ground in every
  // option's risk. Rare in a light contact and usual in an overrun.
  const opensBadly =
    names.length > 0 &&
    (threat === 'overrun' ? draw % 100 < 62 : threat === 'heavy' ? draw % 100 < 34 : draw % 100 < 9)
  const downNow = opensBadly ? (names[(draw >>> 7) % names.length] ?? null) : null
  const standing = names.filter((name) => name !== downNow)
  const onPoint = standing.length === 0 ? null : (standing[(draw >>> 13) % standing.length] ?? null)
  return { strength, downNow, onPoint, names }
}

/**
 * THE SITUATION, DERIVED.
 *
 * Seeded on the person and the tick so a contact reads the same forever, and
 * salted apart from the combat resolution stream so that reading the scene
 * never changes what happens in it.
 */
export function situationFor(
  world: World,
  personId: EntityId,
  tick: Tick,
  threat: Threat,
): Situation {
  const cast = castFor(world, personId, tick, threat)
  const draw = hash32(world.seed, Stream.CombatResolution, personId, 61_000 + tick)
  const two = hash32(world.seed, Stream.CombatResolution, personId, 62_000 + tick)

  // HOW MANY, and the count is a guess with a spread, never a number. A
  // heavier threat is more of them, and a spread that is wider because nobody
  // gets a good look at a position that has you pinned.
  const base = threat === 'light' ? 2 : threat === 'heavy' ? 6 : 12
  const countLow = base + (draw % (threat === 'light' ? 3 : 5))
  const spread = threat === 'light' ? 1 + ((draw >>> 3) % 2) : 2 + ((draw >>> 3) % 6)

  // HOW FAR. Distance is what makes an option sane or suicidal, so it is
  // drawn wide: forty metres and four hundred are different wars.
  const distance =
    threat === 'light'
      ? 40 + ((draw >>> 6) % 9) * 20
      : threat === 'heavy'
        ? 80 + ((draw >>> 6) % 12) * 25
        : 30 + ((draw >>> 6) % 8) * 15

  const firstSight: FirstSight =
    threat === 'overrun'
      ? 'they-saw-you'
      : (draw >>> 11) % 10 < 4
        ? 'they-saw-you'
        : (draw >>> 11) % 10 < 8
          ? 'you-saw-them'
          : 'at-once'

  // SUPPORT. The radio is the hinge: no radio, no guns and no air, which is
  // exactly the case §4.2 names — "you cannot call for fire with no radio and
  // nothing in range".
  const radio = two % 100 >= (threat === 'overrun' ? 30 : 12)
  const gunsInRange = radio && (two >>> 4) % 100 < 62
  const gunsMinutes = gunsInRange ? 8 + ((two >>> 8) % 5) * 4 : null
  const airUp = radio && (two >>> 12) % 100 < 34
  const airMinutes = airUp ? 14 + ((two >>> 15) % 6) * 5 : null

  const lightMinutes = (two >>> 19) % 10 === 0 ? 0 : 15 + ((two >>> 20) % 9) * 15
  const weather = WEATHERS[(draw >>> 17) % WEATHERS.length] ?? null

  return {
    countLow,
    countHigh: countLow + spread,
    ground: GROUNDS[(draw >>> 21) % GROUNDS.length] ?? 'on open ground',
    distance,
    firstSight,
    radio,
    gunsMinutes,
    airMinutes,
    lightMinutes,
    weather,
    downNow: cast.downNow,
    strength: cast.strength,
    // A covered approach is what makes a flank an option rather than a
    // hundred metres of nothing. Deliberately not always there.
    hasApproach: (draw >>> 27) % 100 < 55,
    hasCover: (two >>> 24) % 100 < 78,
  }
}

/** "three of them, maybe five" — a count as somebody would call it. */
function counted(situation: Situation): string {
  return `${numberWord(situation.countLow)} of them, maybe ${numberWord(situation.countHigh)}`
}

function lightWords(situation: Situation): string {
  // CLAMPED, because it once printed "The light goes in -30 minutes": the
  // draws come from `hash32`, which is UNSIGNED, and every shift here was the
  // SIGNED `>>`. The shifts are `>>>` now; this floor is the belt to that
  // braces, because a negative minute should never reach a player.
  const left = Math.max(0, situation.lightMinutes)
  if (left === 0) return 'It is already dark'
  if (left <= 30) return `The light goes in ${numberWord(left)} minutes`
  return `You have about ${numberWord(Math.round(left / 15) * 15)} minutes of light`
}

function supportWords(situation: Situation): string {
  if (!situation.radio) return 'The radio is dead — nobody is coming, and nobody knows'
  const parts: string[] = []
  if (situation.gunsMinutes !== null) {
    parts.push(`the battery is ${numberWord(situation.gunsMinutes)} minutes out`)
  }
  if (situation.airMinutes !== null) {
    parts.push(`there is air ${numberWord(situation.airMinutes)} minutes away`)
  }
  if (parts.length === 0) return 'The radio works, and there is nothing in range to send'
  return `The radio works: ${parts.join(', and ')}`
}

/**
 * THE SITUATION, WRITTEN (§4.4b rule 1: "never 'heavy contact'").
 *
 * The scene's own line opens it, because that is where the trade and the
 * moment live — a medic's opening is not a rifleman's. Everything after is
 * the specifics.
 *
 * NOTE THE SECOND SENTENCE, which used to read "with 6 of yours on the
 * ground" and meant, to anybody who has heard the phrase, six men down. Your
 * own strength never borrows a phrase that describes a casualty.
 */
export function situationWords(situation: Situation, opening: string): string {
  const seen =
    situation.firstSight === 'they-saw-you'
      ? 'They had this ground sighted before you walked onto it'
      : situation.firstSight === 'you-saw-them'
        ? 'You have them, and they do not have you yet'
        : 'You saw each other in the same second, and neither of you has moved yet'

  const hit =
    situation.downNow === null ? '' : ` ${situation.downNow} goes down before anybody hears it.`

  const weather = situation.weather === null ? '' : ` ${situation.weather}.`
  const strength =
    situation.strength <= 1
      ? 'You are on your own out here.'
      : `There are ${numberWord(situation.strength)} of you.`

  return [
    `${opening}${hit}`,
    `You are ${situation.ground}. ${strength}`,
    `${capitalise(counted(situation))}, ${rangeWords(situation.distance)}. ${seen}.`,
    `${supportWords(situation)}. ${lightWords(situation)}.${weather}`,
  ].join(' ')
}

/**
 * ONE THING THE PLAYER CAN ORDER, written as an intention with its RISK.
 *
 * §4.4b rule 2: "never 'Push.'" And the owner's correction on top of it: the
 * cost line says what you are GAMBLING, never what will happen. The game does
 * not answer its own question before you have answered it.
 */
export interface SceneOption {
  /** `spectrum:variant`, e.g. `push:draw`. Carried on the pending. */
  readonly id: string
  /** Which of the three the engine resolves it as. */
  readonly spectrum: SceneChoice
  /** The order, in the words you would give it. */
  readonly intention: string
  /** What you are gambling. NEVER an outcome. */
  readonly cost: string
}

/**
 * THE OPTIONS THE SITUATION SUPPORTS — four to six of them, never a fixed
 * three, and every one gated on something real.
 */
/**
 * WHAT A BEAT IS FOR — and why the options change with it.
 *
 * OWNER: "the screens after the initial contact screen are always the same
 * options and stuff as well, each screen should have their own options."
 *
 * He is right, and the old comment beside the call site admitted it in
 * writing: "the situation does not change between beats — it is the same
 * afternoon — so the same options are on offer at the beat that asks." That
 * reasoning is true about the SITUATION and wrong about the QUESTION. The
 * afternoon does not change; what is being asked of you does, four or five
 * times, and asking it with the same three buttons turns a sequence into the
 * same screen shown repeatedly.
 *
 * A contact opens with seconds and instinct. Orienting is not a decision at
 * all — it is the moment you decide whether to act on what you have or wait
 * for more. The decision beat is the real one and keeps the full spectrum.
 * The consequence beat asks what you do about what just happened, which is a
 * different question from what you were going to do. The follow-on is about
 * a PERSON. And the last beat is about what you say afterwards.
 *
 * All of them still resolve through `spectrumOf`, so the engine's own
 * arithmetic is untouched and an old save's bare `push` still parses.
 */
function beatOptions(situation: Situation, beat: string): readonly SceneOption[] | null {
  const down = situation.downNow
  if (beat === 'contact') {
    return [
      {
        id: 'push:shout',
        spectrum: 'push',
        intention: 'Return fire at once, before anybody has worked out where it is coming from.',
        cost: 'Volume now buys everybody a second to move. It also tells them exactly how many of you there are and where.',
      },
      {
        id: 'cover:drop',
        spectrum: 'cover',
        intention: 'Everybody down where they stand.',
        cost: 'The safest thing in the first two seconds, and the ground you are lying on was chosen by them, not you.',
      },
      {
        id: 'hold:find',
        spectrum: 'hold',
        intention: 'Nobody fires until somebody can say where it is coming from.',
        cost: 'Two seconds of discipline against two seconds of being shot at while you spend them.',
      },
    ]
  }
  if (beat === 'orient') {
    return [
      {
        id: 'push:now',
        spectrum: 'push',
        intention: 'You have enough. Move on it before it changes.',
        cost: 'What you have is most of it. Acting on most of it is how most things are done and how some of them go wrong.',
      },
      {
        id: 'hold:look',
        spectrum: 'hold',
        intention: 'Another ten seconds of looking before anybody commits.',
        cost: 'Ten seconds is nothing, unless it is the ten seconds they needed.',
      },
    ]
  }
  if (beat === 'consequence') {
    return [
      {
        id: 'push:press',
        spectrum: 'push',
        intention: 'Carry on with it — the thing that just happened does not change the task.',
        cost: 'The task gets done. Whether everybody agrees it was worth it is decided afterwards, by people who were not here.',
      },
      {
        id: 'hold:consolidate',
        spectrum: 'hold',
        intention: 'Stop, get a count, and find out what you actually have left.',
        cost: `A count takes minutes you may not have${down === null ? '' : `, and ${down} is where he fell for all of them`}.`,
      },
      {
        id: 'cover:withdraw',
        spectrum: 'cover',
        intention: 'That is enough. Get everybody back the way you came.',
        cost: 'Nothing more is lost here today. The ground is theirs and somebody will have to come back for it.',
      },
    ]
  }
  if (beat === 'followon') {
    return [
      {
        id: 'push:reach',
        spectrum: 'push',
        intention: `Go for ${down ?? 'him'} now, across whatever is in the way.`,
        cost: 'Crossing it is the whole risk. Nobody who has ever done it says it felt like a decision.',
      },
      {
        id: 'hold:cover-him',
        spectrum: 'hold',
        intention: 'Put everything you have onto the position and let somebody else go for him.',
        cost: 'It is the right way to do it. It is also somebody else going.',
      },
      {
        id: 'cover:wait',
        spectrum: 'cover',
        intention: 'Nobody moves until the fire slackens.',
        cost: `Waiting is correct and it is the hardest thing in the game to do${down === null ? '' : ` while ${down} is out there`}.`,
      },
    ]
  }
  if (beat === 'after') {
    return [
      {
        id: 'hold:report',
        spectrum: 'hold',
        intention: 'Get a full and accurate report in, whatever it says about today.',
        cost: 'Accurate reports are how the next patrol survives, and how this one gets examined.',
      },
      {
        id: 'cover:men',
        spectrum: 'cover',
        intention: 'See to the men first. The report can wait an hour.',
        cost: 'An hour of the truth going stale, spent on people who need somebody to look at them.',
      },
    ]
  }
  // 'decision' and anything unrecognised get the full situational spectrum.
  return null
}

export function optionsFor(
  situation: Situation,
  /** Which beat is asking. Omitted means the decision beat's full spectrum. */
  beat = 'decision',
): readonly SceneOption[] {
  const forBeat = beatOptions(situation, beat)
  if (forBeat !== null) return forBeat
  return situationalOptions(situation)
}

function situationalOptions(situation: Situation): readonly SceneOption[] {
  const found: SceneOption[] = []
  const range = rangeWords(situation.distance)

  // GET OFF THE X. Always available, because going to ground always is.
  if (situation.hasCover) {
    found.push({
      id: 'cover:ground',
      spectrum: 'cover',
      intention: 'Get everybody off the open and into whatever cover is there.',
      cost:
        situation.downNow === null
          ? 'You are handing them the ground and the initiative to buy a few seconds. Whether a few seconds is what you needed is the part you do not get to know first.'
          : `You are handing them the ground to get heads down, and ${situation.downNow} is lying where he fell while you do it.`,
    })
  } else {
    found.push({
      id: 'cover:flat',
      spectrum: 'cover',
      intention: 'Everybody flat and still, and hope they lose you.',
      cost: 'There is no cover to get to. You are betting they have not fixed exactly where you are.',
    })
  }

  // THE ANSWER THAT ENDS IT, and it needs ground to do it on.
  if (situation.hasApproach) {
    found.push({
      id: 'push:draw',
      spectrum: 'push',
      intention: 'Base of fire here, and take a team up the covered approach.',
      cost: `The approach is covered for most of it, and most is not all. You are putting men inside ${bareRange(situation.distance)} of a position nobody has seen properly.`,
    })
  } else {
    found.push({
      id: 'push:across',
      spectrum: 'push',
      intention: 'Straight at them, everything firing, and close the distance.',
      cost: `Open ground, ${range}, against ${counted(situation)}. You are betting that weight of fire keeps their heads down while you cross it.`,
    })
  }

  // FIRE SUPPORT — only when there is a radio AND something in range.
  if (situation.radio && situation.gunsMinutes !== null) {
    found.push({
      id: 'hold:guns',
      spectrum: 'hold',
      intention: 'Call for fire on the position and hold what you have.',
      cost: `You are asking your people to stay exactly where they are for ${numberWord(situation.gunsMinutes)} minutes, and trusting a grid somebody else will shoot at.`,
    })
  }
  if (situation.radio && situation.airMinutes !== null) {
    found.push({
      id: 'hold:air',
      spectrum: 'hold',
      intention: 'Get air on station and mark the position for them.',
      cost: `${capitalise(numberWord(situation.airMinutes))} minutes of waiting, and marking means somebody stands up long enough to be seen doing it.`,
    })
  }

  // THE WOUNDED — only when there is somebody to get out.
  if (situation.downNow !== null) {
    found.push({
      id: 'cover:casualty',
      spectrum: 'cover',
      intention: `Get ${situation.downNow} out first. Everything else waits.`,
      cost: 'Two of your people go into the open for him, and the position gets as long as that takes to decide what it wants to do about you.',
    })
  }

  // LET THEM COMMIT — the option the light and the dark make sensible.
  if (situation.lightMinutes === 0 || situation.lightMinutes <= 30) {
    found.push({
      id: 'hold:dark',
      spectrum: 'hold',
      intention:
        situation.lightMinutes === 0
          ? 'Hold in the dark and make them come to you.'
          : 'Hold until the light goes, then move.',
      cost:
        situation.lightMinutes === 0
          ? 'They know this ground and you do not. You are gambling that crossing it costs them more than knowing it gains them.'
          : `${capitalise(numberWord(situation.lightMinutes))} more minutes of being shot at, for the chance to leave on your own terms.`,
    })
  }

  // BREAK CONTACT — always a choice, and the honest one when they saw you
  // first and you are outnumbered.
  found.push({
    id: 'cover:break',
    spectrum: 'cover',
    intention: 'Break contact by teams and get off this ground entirely.',
    cost:
      situation.downNow === null
        ? 'Nobody wins anything, and a withdrawal under fire is its own problem: you are moving in the open, by bounds, while they watch.'
        : `A withdrawal under fire, carrying ${situation.downNow}, which is slower than a withdrawal under fire without him.`,
  })

  // Never more than six: past that it is a menu rather than a decision.
  return found.slice(0, 6)
}

/**
 * THE OPTION IDS FOR A CONTACT, which is what goes on the pending.
 *
 * The pending stores IDS ONLY. The prose is derived on every read, so the save
 * carries no text, an old save's bare `push` still parses, and the writing can
 * be rewritten tomorrow without a migration.
 */
export function optionIdsFor(
  world: World,
  personId: EntityId,
  tick: Tick,
  threat: Threat,
  /** The beat asking the question — see `beatOptions`. */
  beat = 'decision',
): readonly string[] {
  return optionsFor(situationFor(world, personId, tick, threat), beat).map((option) => option.id)
}

/**
 * WHICH OF THE THREE AN ANSWER IS.
 *
 * `push:draw` is a push. A bare `push` from a save written before options had
 * variants is still a push, which is why this splits rather than looks up.
 */
export function spectrumOf(id: string): SceneChoice {
  const head = id.split(':')[0]
  return head === 'push' || head === 'hold' || head === 'cover' ? head : 'hold'
}

/**
 * HOW IT OPENED, by what was ordered — several tellings each.
 *
 * OWNER: "each choice should be random like and not give the same results
 * every single time." There was ONE sentence per spectrum, so every push in a
 * career opened with the same words.
 */
const OPENED: Readonly<Record<SceneChoice, readonly string[]>> = {
  push: [
    'The guns opened on the position and you went, {point} in front.',
    'You gave it thirty seconds of everything you had, then moved, with {point} leading.',
    'There was no signal anybody would recognise. {Point} went, and the rest went with him.',
    'You went in short rushes, two up and two down, {point} on the left.',
    'You put smoke out and crossed behind it, {point} first into it.',
  ],
  hold: [
    'You put everybody down and got on the net.',
    'You held where you were and let them decide whether they wanted it.',
    'Nobody moved. You lay in it and waited for somebody else to change the arithmetic.',
    'You marked the position, called it, and made everybody small.',
    'You held the line you had and told them to conserve what they were firing.',
  ],
  cover: [
    'You got them off the open and into whatever was there.',
    'You went back by teams, one bounding while the other fired.',
    'Everything stopped while you dealt with what was in front of you.',
    'You broke it off before it became something you could not break off.',
    'You pulled everybody in tight and got the near side of the bank between you and it.',
  ],
}

/** How it went, and there is more than one way for a thing to go either way. */
const WENT_WELL: readonly string[] = [
  'It was bad for the first stretch and then it was fast. {Minutes} minutes, and it was over.',
  'It worked, more or less the way it was meant to. {Minutes} minutes, end to end.',
  'They had no appetite for it once it started costing them. {Minutes} minutes.',
  'It went cleanly, which is rare enough that nobody quite believed it afterwards. {Minutes} minutes.',
  'The volume came off them almost at once. {Minutes} minutes, and the ground was yours.',
]

const WENT_BADLY: readonly string[] = [
  'It stalled. {Minutes} minutes somewhere nobody wanted to be, and it ended because they stopped, not because you did anything.',
  'It came apart halfway. {Minutes} minutes, and you came off that ground with nothing to show for it.',
  'Whatever was supposed to happen did not. {Minutes} minutes of it, and the position was still there at the end.',
  'It was slower and louder than it should have been. {Minutes} minutes, and everybody knew it was going wrong while it was going wrong.',
  'You lost the initiative in the first minute and never got it back. {Minutes} minutes.',
]

function fill(text: string, point: string, minutes: number): string {
  return text
    .replace('{Point}', capitalise(point))
    .replace('{point}', point)
    .replace('{Minutes}', capitalise(numberWord(minutes)))
    .replace('{minutes}', numberWord(minutes))
}

/**
 * THE RESOLUTION, NARRATED (§4.4b rule 3: "not an outcome flag").
 *
 * What happened, in order, with names, how long it took and how it ended. The
 * one thing it never carries is what it cost THEM — that is the after-action
 * report's, and the gap between the two voices is the point.
 *
 * `draw` is seeded on the contact by the caller, so the telling varies between
 * contacts and never re-rolls within one.
 */
export function resolutionWords(
  situation: Situation,
  optionId: string,
  went: 'well' | 'badly',
  cast: {
    readonly onPoint: string | null
    readonly hurt: string | null
    readonly killed: string | null
  },
  draw = 0,
): readonly string[] {
  const lines: string[] = []
  const spectrum = spectrumOf(optionId)
  const minutes = went === 'well' ? 3 + (situation.distance % 4) : 9 + (situation.distance % 13)
  const point = cast.onPoint ?? 'the lead man'
  const pick = Math.abs(Math.trunc(draw))

  const openings = OPENED[spectrum]
  lines.push(fill(openings[pick % openings.length] ?? openings[0] ?? '', point, minutes))

  const endings = went === 'well' ? WENT_WELL : WENT_BADLY
  const second = Math.floor(pick / Math.max(1, openings.length)) % endings.length
  lines.push(fill(endings[second] ?? endings[0] ?? '', point, minutes))

  // WHAT IT COST, and the dead get their own line, always last, always plain.
  // §4.4b's worked example ends on exactly this and so does this.
  if (cast.hurt !== null) {
    lines.push(`${cast.hurt} was hit during it and kept going until somebody made him stop.`)
  }
  if (cast.killed !== null) {
    lines.push(
      situation.downNow === cast.killed
        ? `${cast.killed} died on the ground where he fell, while the rest of you were still fighting. Nobody was with him.`
        : `${cast.killed} was killed. It was after the worst of it was over, which is the part nobody ever makes sense of.`,
    )
  }
  return lines
}
