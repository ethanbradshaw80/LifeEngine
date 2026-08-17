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
 * So this module adds the missing layer. A contact now generates a SITUATION —
 * how many, what ground, how far, who saw whom first, what support is within
 * reach, what the light is doing, and who is already down. The scene's own
 * words open it; the situation gives it the specifics that make the same scene
 * a different problem every time.
 *
 * THREE THINGS FOLLOW FROM IT, which are §4.2 and §4.4b:
 *
 *   THE OPTIONS COME FROM THE SITUATION. Four to six, written as intentions
 *   with their cost stated, and each one only appears when the situation
 *   supports it — you cannot call for fire with no radio, and "get the
 *   wounded out first" is not an option when nobody is hit.
 *
 *   THE RESOLUTION IS A NARRATED SEQUENCE. What happened, in order, with
 *   names, and how it ended.
 *
 *   NOTHING IS STORED. The situation is derived from (seed, person, tick),
 *   so it is the same situation every time it is read, it costs no save
 *   space, and a contact recorded before this module existed has one.
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
  /** How many of yours are on the ground here. */
  readonly strength: number
  /** Whether the ground gives a covered approach — gates the flank. */
  readonly hasApproach: boolean
  /** Whether there is cover within a rush — gates going to ground. */
  readonly hasCover: boolean
}

const GROUNDS: readonly string[] = [
  'a goat track on the north face',
  'the shoulder of a dry wadi',
  'a treeline at the edge of cut fields',
  'a mud-walled compound on the village edge',
  'the open scree below a ridge',
  'a rutted road between two irrigation ditches',
  'a hillside of terraced orchard',
  'the flat ground short of a river crossing',
  'a rubbled street of two-storey houses',
  'a culvert under the main road',
  'the reverse slope of a low saddle',
  'a stony plateau with nothing on it for a mile',
]

const WEATHERS: readonly (string | null)[] = [
  null,
  null,
  null,
  'It has been raining since first light and everything is slick',
  'The dust is up and you are eating it with every breath',
  'It is well over forty degrees and has been all day',
  'There is a wind coming down the valley that takes the sound away',
  'The cloud is on the deck, so nothing is flying today',
  'It is cold enough that hands are already going',
]

/**
 * THE SITUATION, DERIVED.
 *
 * Seeded on the person and the tick so a contact reads the same forever, and
 * salted apart from the combat resolution stream so that reading the scene
 * never changes what happens in it.
 */
export function situationFor(world: World, personId: EntityId, tick: Tick, threat: Threat): Situation {
  const cast = castFor(world, personId, tick, threat)
  const draw = hash32(world.seed, Stream.CombatResolution, personId, 61_000 + tick)
  const two = hash32(world.seed, Stream.CombatResolution, personId, 62_000 + tick)

  // HOW MANY, and the count is a guess with a spread, never a number. A
  // heavier threat is more of them, and a spread that is wider because
  // nobody gets a good look at a position that has you pinned.
  const base = threat === 'light' ? 2 : threat === 'heavy' ? 6 : 12
  const countLow = base + (draw % (threat === 'light' ? 3 : 5))
  const spread = threat === 'light' ? 1 + ((draw >> 3) % 2) : 2 + ((draw >> 3) % 6)

  // HOW FAR. Distance is what makes an option sane or suicidal, so it is
  // drawn wide: forty metres and four hundred are different wars.
  const distance =
    threat === 'light'
      ? 40 + ((draw >> 6) % 9) * 20
      : threat === 'heavy'
        ? 80 + ((draw >> 6) % 12) * 25
        : 30 + ((draw >> 6) % 8) * 15

  const firstSight: FirstSight =
    threat === 'overrun'
      ? 'they-saw-you'
      : ((draw >> 11) % 10 < 4
          ? 'they-saw-you'
          : (draw >> 11) % 10 < 8
            ? 'you-saw-them'
            : 'at-once')

  // SUPPORT. The radio is the hinge: no radio, no guns and no air, which is
  // exactly the case §4.2 names — "you cannot call for fire with no radio
  // and nothing in range".
  const radio = (two % 100) >= (threat === 'overrun' ? 30 : 12)
  const gunsInRange = radio && (two >> 4) % 100 < 62
  const gunsMinutes = gunsInRange ? 8 + ((two >> 8) % 5) * 4 : null
  const airUp = radio && (two >> 12) % 100 < 34
  const airMinutes = airUp ? 14 + ((two >> 15) % 6) * 5 : null

  const lightMinutes = ((two >> 19) % 10) === 0 ? 0 : 15 + ((two >> 20) % 9) * 15
  const weather = WEATHERS[(draw >> 17) % WEATHERS.length] ?? null

  return {
    countLow,
    countHigh: countLow + spread,
    ground: GROUNDS[(draw >> 21) % GROUNDS.length] ?? 'open ground',
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
    hasApproach: (draw >> 27) % 100 < 55,
    hasCover: (two >> 24) % 100 < 78,
  }
}

/**
 * WHO IS HERE, BY THE NAMES THE SQUAD USES.
 *
 * The squad is on the deployment already (Stage 1), and these are real
 * registered people — which is what makes "Volkov is hit before anybody hears
 * the shot" mean anything at all. Seeded, so the man on point is the same man
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

export function castFor(
  world: World,
  personId: EntityId,
  tick: Tick,
  threat: Threat,
): SceneCast {
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

  // SOMEBODY IS HIT BEFORE THE FIRST DECISION, sometimes — and it changes
  // the whole shape of the problem, because it puts a man on the ground in
  // every option's cost. Rare in a light contact and usual in an overrun.
  const opensBadly =
    names.length > 0 &&
    (threat === 'overrun' ? draw % 100 < 62 : threat === 'heavy' ? draw % 100 < 34 : draw % 100 < 9)
  const downNow = opensBadly ? (names[(draw >> 7) % names.length] ?? null) : null
  const standing = names.filter((name) => name !== downNow)
  const onPoint = standing.length === 0 ? null : (standing[(draw >> 13) % standing.length] ?? null)
  return { strength, downNow, onPoint, names }
}

/** "eight, maybe twelve" — the way a count is actually reported. */
function counted(situation: Situation): string {
  return `${String(situation.countLow)}, maybe ${String(situation.countHigh)}`
}

function lightWords(situation: Situation): string {
  if (situation.lightMinutes === 0) return 'It is already dark'
  if (situation.lightMinutes <= 30) return `The light goes in ${String(situation.lightMinutes)} minutes`
  return `You have about ${String(Math.round(situation.lightMinutes / 15) * 15)} minutes of light`
}

function supportWords(situation: Situation): string {
  if (!situation.radio) return 'The radio is dead. Nobody is coming and nobody knows'
  const parts: string[] = []
  if (situation.gunsMinutes !== null) parts.push(`battery is ${String(situation.gunsMinutes)} minutes out`)
  if (situation.airMinutes !== null) parts.push(`there is air ${String(situation.airMinutes)} minutes away`)
  if (parts.length === 0) return 'The radio works, and there is nothing in range to send'
  return `The radio works. ${parts.join(' and ')}`
}

/**
 * THE SITUATION, WRITTEN (§4.4b rule 1: "never 'heavy contact'").
 *
 * The scene's own line opens it, because that is where the trade and the
 * moment live — a medic's opening is not a rifleman's. Everything after is
 * the specifics, and the specifics are what stop the same scene reading the
 * same way twice.
 */
export function situationWords(situation: Situation, opening: string): string {
  const seen =
    situation.firstSight === 'they-saw-you'
      ? `They had the ground sighted before you walked into it`
      : situation.firstSight === 'you-saw-them'
        ? `You have them, and they do not have you yet`
        : `You saw each other at the same moment and both of you are still deciding`

  const hit =
    situation.downNow === null
      ? ''
      : ` ${situation.downNow} is hit before anybody hears the shot.`

  const weather = situation.weather === null ? '' : ` ${situation.weather}.`

  return [
    `${opening}${hit}`,
    `You are on ${situation.ground} with ${String(situation.strength)} of yours on the ground.`,
    `You count ${counted(situation)} across ${String(situation.distance)} metres. ${seen}.`,
    `${supportWords(situation)}. ${lightWords(situation)}.${weather}`,
  ].join(' ')
}

/**
 * ONE THING THE PLAYER CAN ORDER, written as an intention with its cost.
 *
 * §4.4b rule 2: "never 'Push.'" Each says what you are ordering and what it
 * costs, in the voice of somebody who has four seconds.
 */
export interface SceneOption {
  /** `spectrum:variant`, e.g. `push:draw`. Carried on the pending. */
  readonly id: string
  /** Which of the three the engine resolves it as. */
  readonly spectrum: SceneChoice
  /** The order, in the words you would give it. */
  readonly intention: string
  /** What it costs you, said plainly. */
  readonly cost: string
}

/**
 * THE OPTIONS THE SITUATION SUPPORTS — four to six of them, never a fixed
 * three, and every one gated on something real.
 */
export function optionsFor(situation: Situation): readonly SceneOption[] {
  const found: SceneOption[] = []

  // GET OFF THE X. Always available, because going to ground always is.
  if (situation.hasCover) {
    found.push({
      id: 'cover:ground',
      spectrum: 'cover',
      intention: 'Get everybody off the open and into whatever cover is there.',
      cost:
        situation.downNow === null
          ? `Nobody else gets hit in the next thirty seconds. It also hands them ${String(situation.distance)} metres and the initiative.`
          : `Nobody else gets hit in the next thirty seconds. It also leaves ${situation.downNow} where he fell.`,
    })
  } else {
    found.push({
      id: 'cover:flat',
      spectrum: 'cover',
      intention: 'Everybody flat and still, and hope they lose you.',
      cost: 'There is no cover to get to. Lying still on open ground is a decision, and it is not a good one.',
    })
  }

  // THE ANSWER THAT ENDS IT, and it needs ground to do it on.
  if (situation.hasApproach) {
    found.push({
      id: 'push:draw',
      spectrum: 'push',
      intention: 'Base of fire here, and take a team up the covered approach.',
      cost: `It is the answer that ends the fight. It is also ${String(situation.distance)} metres with your youngest man somewhere in it.`,
    })
  } else {
    found.push({
      id: 'push:across',
      spectrum: 'push',
      intention: 'Straight at them, everything firing, and close the distance before they range you.',
      cost: `${String(situation.distance)} metres of open ground against ${counted(situation)}. If it works it works fast, and if it does not you will not get to choose again.`,
    })
  }

  // FIRE SUPPORT — only when there is a radio AND something in range.
  if (situation.radio && situation.gunsMinutes !== null) {
    found.push({
      id: 'hold:guns',
      spectrum: 'hold',
      intention: 'Call for fire on the position and hold what you have until it lands.',
      cost: `${String(situation.gunsMinutes)} minutes is a long time to lie still. It is a short time to be alive if their guns are ranging too.`,
    })
  }
  if (situation.radio && situation.airMinutes !== null) {
    found.push({
      id: 'hold:air',
      spectrum: 'hold',
      intention: 'Get air on station and mark the position for them.',
      cost: `${String(situation.airMinutes)} minutes, and marking means somebody stands up long enough to be seen doing it.`,
    })
  }

  // THE WOUNDED — only when there is somebody to get out.
  if (situation.downNow !== null) {
    found.push({
      id: 'cover:casualty',
      spectrum: 'cover',
      intention: `Get ${situation.downNow} out first. Everything else waits.`,
      cost: 'Everything else waits, and the position gets as long as it takes to decide what it wants to do about you.',
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
          ? 'They know the ground and you do not. But they have to cross it and you do not.'
          : `${String(situation.lightMinutes)} minutes of being shot at, in exchange for leaving on your terms.`,
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
        ? 'Nobody wins anything. Everybody is alive at the end of it, which is not the same as nothing.'
        : `Nobody wins anything, and somebody has to carry ${situation.downNow} out under fire.`,
  })

  // Never more than six: past that it is a menu rather than a decision.
  return found.slice(0, 6)
}

/**
 * THE OPTION IDS FOR A CONTACT, which is what goes on the pending.
 *
 * The pending stores IDS ONLY. The prose is derived on every read, so the
 * save carries no text, an old save's bare `push` still parses, and the
 * writing can be rewritten tomorrow without a migration.
 */
export function optionIdsFor(
  world: World,
  personId: EntityId,
  tick: Tick,
  threat: Threat,
): readonly string[] {
  return optionsFor(situationFor(world, personId, tick, threat)).map((option) => option.id)
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
 * THE RESOLUTION, NARRATED (§4.4b rule 3: "not an outcome flag").
 *
 * What happened, in order, with names, how long it took and how it ended.
 * The one thing it never carries is what it cost THEM — that is the
 * after-action report's, and the gap between the two voices is the point.
 */
export function resolutionWords(
  situation: Situation,
  optionId: string,
  went: 'well' | 'badly',
  cast: { readonly onPoint: string | null; readonly hurt: string | null; readonly killed: string | null },
): readonly string[] {
  const lines: string[] = []
  const spectrum = spectrumOf(optionId)
  const variant = optionId.split(':')[1] ?? ''
  const minutes = went === 'well' ? 3 + (situation.distance % 4) : 9 + (situation.distance % 13)
  const point = cast.onPoint ?? 'the lead man'

  if (spectrum === 'push') {
    lines.push(
      variant === 'draw'
        ? `The guns opened on the position and you took a team up the approach with ${point} in front.`
        : `You put everything you had on the position and went across the open at it, ${point} in front.`,
    )
    lines.push(
      went === 'well'
        ? `It went badly for the first thirty metres and then it went fast. You were in the position in under ${String(minutes)} minutes and the ones still there did not get a shot off.`
        : `It stalled halfway. ${String(minutes)} minutes on open ground with nowhere to be, and you came off it without the position.`,
    )
  } else if (spectrum === 'hold') {
    lines.push(
      variant === 'guns'
        ? `You called it in and put everybody down to wait for it.`
        : variant === 'air'
          ? `You marked the position and waited for something faster than you to deal with it.`
          : `You held where you were and let them decide whether they wanted it.`,
    )
    lines.push(
      went === 'well'
        ? `It landed more or less where you asked for it. The fire slackened, then stopped, and after ${String(minutes)} minutes there was nothing up there answering.`
        : `It came late and short. ${String(minutes)} minutes of lying in it, and when the fire lifted they were still there.`,
    )
  } else {
    lines.push(
      variant === 'casualty'
        ? `Everything stopped for ${cast.hurt ?? 'the man who was hit'}. Two of you went out for him and the rest put fire on the position to buy it.`
        : variant === 'break'
          ? `You broke contact by teams, one bounding while the other fired, back off the ground the way you came.`
          : `You got everybody into cover and kept them there.`,
    )
    lines.push(
      went === 'well'
        ? `It worked. ${String(minutes)} minutes and everybody who could walk was off that ground.`
        : `It did not go cleanly. ${String(minutes)} minutes of it, and they had the whole withdrawal to shoot at.`,
    )
  }

  // WHAT IT COST, and the dead get their own line, always last, always
  // plain. §4.4b's worked example ends on exactly this and so does this.
  if (cast.hurt !== null) {
    lines.push(
      `${cast.hurt} was hit during it and kept going until somebody made him stop.`,
    )
  }
  if (cast.killed !== null) {
    lines.push(
      situation.downNow === cast.killed
        ? `${cast.killed} died on the ground where he fell, while the rest of you were still fighting. Nobody was with him.`
        : `${cast.killed} was killed. It was quick, and it was after the worst of it was over, which is the part nobody ever makes sense of.`,
    )
  }
  return lines
}
