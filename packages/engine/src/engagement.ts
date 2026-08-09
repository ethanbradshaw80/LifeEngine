/**
 * AN ENGAGEMENT IS A SEQUENCE, NOT A POPUP (owner's
 * `combat_tours_revamp.md` §3).
 *
 * The existing scene atom — a read, three answers, an outcome — is kept
 * exactly as it is, because it works and the spec says so in as many
 * words: "keep that atom." What was missing is that a contact arrived and
 * resolved in a single tap, so a firefight and a near-miss were the same
 * shape and neither had a middle.
 *
 * So: contact → orient → decision → consequence → follow-on → after-action.
 *
 * LENGTH SCALES WITH STAKES, which is the part that makes this worth
 * building. A routine near-miss is ONE beat and should be; the defining
 * event of a tour runs several. A model that made every contact a
 * five-part sequence would be the popup problem again, slower.
 *
 * THE FOLLOW-ON IS WHERE THE COST LIVES. The first decision is usually
 * about the mission; the second is about what the first one did to
 * somebody — and the spec's own line is that "the worst decisions in the
 * game should be the ones where the right tactical answer costs you
 * someone you know."
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { SceneChoice, Threat, World } from './types.js'

/** Where in the sequence a beat sits. */
export type BeatKind = 'contact' | 'orient' | 'decision' | 'consequence' | 'followon' | 'after'

/**
 * HOW LONG THIS ONE RUNS.
 *
 * A near-miss is a sentence. The defining event of a tour is a sequence
 * you remember. Everything between is between.
 */
export function beatsFor(threat: Threat, isDefining: boolean): readonly BeatKind[] {
  if (threat === 'light' && !isDefining) return ['contact', 'decision', 'after']
  if (threat === 'heavy' || isDefining) {
    return ['contact', 'orient', 'decision', 'consequence', 'after']
  }
  // Overrun: the long one, and the only shape with a follow-on in it —
  // the decision that is about a person rather than the ground.
  return ['contact', 'orient', 'decision', 'consequence', 'followon', 'after']
}

/**
 * THE ORIENT BEAT — what a trained person notices before deciding.
 *
 * Not a decision and not decoration: it is the information the choice is
 * made ON, and giving it its own beat is what stops the sequence being
 * three taps of the same button. What somebody notices depends on how good
 * they are, which is why competence reads through here.
 */
export function orientWords(threat: Threat, competence: number, hasRadio: boolean): string {
  const sharp = competence >= 620
  const base =
    threat === 'overrun'
      ? sharp
        ? 'Two positions, not one — the fire from the left is fixing you so the right can move. There is maybe a minute before they are close enough that leaving stops being an option.'
        : 'It is coming from everywhere and it is getting closer and you cannot tell how many.'
      : threat === 'heavy'
        ? sharp
          ? 'One position, well sited, and they have the angle on the ditch everybody is about to run for.'
          : 'Somebody is shooting properly and the ground you are on is not good.'
        : sharp
          ? 'Harassing fire from a long way out. Somebody is watching to see what you do about it.'
          : 'Rounds, high and wide. Nobody is hurt.'
  return hasRadio ? `${base} The net is up, for whatever that is worth.` : `${base} You are on your own out here.`
}

/**
 * WHAT THE FIRST ANSWER COST OR BOUGHT, before the follow-on.
 *
 * The consequence beat exists so a choice is felt BEFORE the next one is
 * made, which is the difference between a sequence and a menu.
 */
export function consequenceWords(choice: SceneChoice, good: boolean, threat: Threat): string {
  if (choice === 'push') {
    return good
      ? 'It worked. The volume drops and there is ground to move on now.'
      : threat === 'overrun'
        ? 'It did not work and now you are further forward than the rest of them.'
        : 'It did not work. Somebody is hit and the fire has not lifted.'
  }
  if (choice === 'hold') {
    return good
      ? 'The position steadies. Nobody has moved and nobody else is hit.'
      : 'Holding is costing more than it is buying. This is not a position that improves.'
  }
  return good
    ? 'The fire lifts on its own. Whatever they wanted, it was not a fight.'
    : 'Waiting has let them get to somewhere better than where they were.'
}

/**
 * THE FOLLOW-ON — the one that is about a person.
 *
 * Only fires in the worst engagements, and the spec's own instruction is
 * that the worst decisions should be the ones where the right tactical
 * answer costs you somebody you know. So the three options here are not
 * push/hold/cover about ground; they are about whether you go and get him.
 */
export interface FollowOn {
  readonly tell: string
  readonly labels: Readonly<Record<SceneChoice, string>>
  readonly did: Readonly<Record<SceneChoice, string>>
}

export function followOnFor(mateNickname: string, isLeader: boolean): FollowOn {
  return {
    tell: isLeader
      ? `${mateNickname} is down in the open and the element is still in contact. Whatever you do next, you are doing it with other people's lives.`
      : `${mateNickname} is down in the open and nobody has gone for him yet.`,
    labels: {
      push: 'Go and get him',
      hold: isLeader ? 'Send two men' : 'Put fire down and drag him back',
      cover: 'Hold everybody where they are',
    },
    did: {
      push: `went into the open for ${mateNickname}`,
      hold: isLeader
        ? `sent two men into the open for ${mateNickname}`
        : `covered and pulled ${mateNickname} back`,
      cover: `held the element rather than go into the open for ${mateNickname}`,
    },
  }
}

/**
 * THE AFTER-ACTION.
 *
 * Sober, brief, and the only beat that is not a decision. It exists
 * because an engagement that simply stops is a popup — what makes it an
 * engagement is that somebody counts up afterwards.
 */
export function afterActionWords(
  threat: Threat,
  lost: number,
  hurt: number,
): string {
  const toll =
    lost > 0
      ? `${String(lost)} killed`
      : hurt > 0
        ? `${String(hurt)} hit and evacuated`
        : 'nobody hurt'
  if (threat === 'overrun') {
    return `It is over. The count is ${toll}. Somebody will ask later how long it lasted and nobody in it will agree.`
  }
  if (threat === 'heavy') {
    return `Contact broken. ${toll[0]?.toUpperCase() ?? ''}${toll.slice(1)}. The rest of the day still has to happen.`
  }
  return `Nothing came of it. ${toll[0]?.toUpperCase() ?? ''}${toll.slice(1)}, and the patrol goes on.`
}

/**
 * ENCODE A SEQUENCE'S STATE onto a pending, so the engagement survives the
 * round trip between beats.
 *
 * THE OUTCOME IS DECIDED WHEN THE CONTACT STARTS and travels with it —
 * exactly the rule the poker key hand follows, and for the same reason: if
 * the sequence re-rolled at each beat, a player could reload for a better
 * firefight, and the choices would stop being choices.
 */
export function encodeEngagement(
  sceneId: string,
  threat: Threat,
  step: number,
  beats: readonly BeatKind[],
  firstChoice: SceneChoice | null,
  seedRoll: number,
): string {
  return [sceneId, threat, String(step), beats.join('+'), firstChoice ?? '-', String(seedRoll)].join('|')
}

export function decodeEngagement(encoded: string | null): {
  sceneId: string
  threat: Threat
  step: number
  beats: readonly BeatKind[]
  firstChoice: SceneChoice | null
  seedRoll: number
} | null {
  if (encoded === null) return null
  const [sceneId, threat, step, beats, firstChoice, seedRoll] = encoded.split('|')
  if (sceneId === undefined || threat === undefined || step === undefined) return null
  return {
    sceneId,
    threat: threat as Threat,
    step: Number(step),
    beats: (beats ?? '').split('+').filter((b) => b.length > 0) as BeatKind[],
    firstChoice: firstChoice === '-' || firstChoice === undefined ? null : (firstChoice as SceneChoice),
    seedRoll: Number(seedRoll ?? 0),
  }
}

/**
 * THE ONE ROLL AN ENGAGEMENT IS MADE OF.
 *
 * Drawn once, at contact, and carried through every beat. Choices bend it;
 * they never re-roll it (spec §3: "choices bend the seed; they don't add
 * real randomness", and §10: determinism is the one rule not overridden).
 */
export function engagementRoll(
  world: World,
  tick: Tick,
  personId: EntityId,
  nonce: number,
): number {
  const rng = openStream(world.seed, Stream.CombatResolution, personId * 67 + nonce, tick + 8_200)
  return rng.nextIntInclusive(0, 999)
}
