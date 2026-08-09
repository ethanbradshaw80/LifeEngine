/**
 * BEING BORN (owner's `newgame_and_birth_master.md`).
 *
 * The front door. A player types a name and a surname and is BORN INTO A
 * FAMILY that carries it — a father who has the name, a mother with a
 * maiden name, sometimes a sibling, in a household with a standing.
 *
 * THE DIFFERENTIATOR, and the spec says to lean on it: this is not a blank
 * slate. The world is already running — towns, NPCs, a market, and an
 * invented history since 1970 — and the family is generated INSIDE it. The
 * news and the wars and the economy were turning before the player was
 * born and keep turning as they age.
 *
 * SINGLE-WRITER (spec §5): "the NPC/worldgen system owns them;
 * character-creation only REQUESTS the birth". So this module decides the
 * SHAPE of a family and nothing else — who exists, how old, what they do,
 * how well off. It writes no people; the caller does, through the same
 * paths every other person in this world is made by.
 *
 * TRAITS ARE ROLLED, NOT PICKED. The spec is explicit and it is the honest
 * design: "rolled at birth, seeded — not hand-picked", revealed afterwards
 * on the You panel. Nobody chooses their own temperament.
 */

import type { Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { World } from './types.js'

/** What the player actually chooses. Everything else is settled at birth. */
export interface BirthRequest {
  readonly givenName: string
  readonly familyName: string
  readonly sex: 'male' | 'female'
  /** A place id, or null for "anywhere" — the world picks. */
  readonly placeId: string | null
  /** Advanced: 0 hard-up, 500 comfortable, 1000 silver spoon. Null = rolled. */
  readonly station: number | null
  /** Advanced: the tick to be born on, or null for the smart default. */
  readonly birthTick: Tick | null
}

/**
 * ONE MEMBER OF THE FAMILY YOU ARE BORN INTO.
 *
 * A REQUEST, not a person. The caller registers them, which is what keeps
 * worldgen the single writer of people.
 */
export interface FamilySpec {
  readonly relation: 'father' | 'mother' | 'sibling'
  readonly givenName: string
  readonly familyName: string
  /** The mother's own name before the marriage — shown as "née ___". */
  readonly maidenName: string | null
  readonly ageYears: number
  /** Older or younger than the child. Siblings only. */
  readonly older: boolean
}

export interface BirthPlan {
  readonly givenName: string
  readonly familyName: string
  readonly sex: 'male' | 'female'
  readonly birthTick: Tick
  readonly placeId: string | null
  readonly family: readonly FamilySpec[]
  /** 0-1000. Drives the household's starting money and home. */
  readonly station: number
  /** The line the certificate prints under the family. */
  readonly householdWords: string
  /** "4471·GARY·LEWIS" — the shareable registry number (spec §12.5). */
  readonly registryNo: string
}

/**
 * WHEN TO BE BORN, when the player has not said (spec §12.1: "the engine
 * auto-picks a birth era that guarantees a FULL LIFE plays forward to
 * death within the simulated timeline — no player has to think about it").
 *
 * So: far enough back that a whole life fits, and not so far that the
 * childhood happens before the world has any history to be part of.
 */
export const FULL_LIFE_YEARS = 85

export function defaultBirthTick(worldTick: Tick): Tick {
  // Born far enough back that eighty-five years of living still lands
  // inside the world's own run, with a little room either side.
  const back = Math.min(worldTick, 24 * 12)
  return Math.max(0, worldTick - back) as Tick
}

/**
 * THE REGISTRY NUMBER — and it is a real feature rather than decoration
 * (spec §12.5: "make it a first-class feature... free virality for itch").
 *
 * Built from the seed and the name, so the same seed and the same choices
 * produce the same number AND the same life. That is the whole promise of
 * a shareable seed, and it is free because the engine is deterministic.
 */
export function registryNoFor(seedNumber: number, given: string, family: string): string {
  const digits = String(Math.abs(seedNumber) % 10_000).padStart(4, '0')
  const clean = (text: string): string => text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  return `${digits}·${clean(given) || 'CHILD'}·${clean(family) || 'FAMILY'}`
}

/** Read a registry number back to the seed it came from, or null. */
export function seedFromRegistryNo(code: string): number | null {
  const first = code.split('·')[0] ?? code.split('-')[0] ?? ''
  const digits = first.replace(/[^0-9]/g, '')
  return digits.length === 0 ? null : Number(digits)
}

/**
 * WHAT A HOUSEHOLD IS LIKE, in the words the certificate prints.
 *
 * Written rather than computed because the certificate is a document and a
 * document has a voice. What it must never do is flatter: being born
 * hard-up is a real thing that happens to most people, and the line says
 * so without either pitying it or dressing it up.
 */
export function householdWordsFor(station: number): string {
  if (station >= 820) {
    return 'A house on the good side of town, and money that was there before you were. Doors that open for reasons nobody explains to a child.'
  }
  if (station >= 620) {
    return 'Comfortable. A mortgage that gets paid, a car that starts, and nobody counting at the table.'
  }
  if (station >= 380) {
    return 'Working people. There is enough, most months, and everybody knows which months are not most months.'
  }
  if (station >= 180) {
    return 'A rented half-house on the mill side of town. Hard but steady, which is more than some get.'
  }
  return 'Hard up, and it was hard before you arrived. Whatever you make of this, you will make it yourself.'
}

const MOTHER_MAIDEN_FALLBACK = 'Hartley'

/**
 * BUILD THE FAMILY.
 *
 * SEEDED FROM THE LIFE'S OWN SEED, so the same registry number always
 * produces the same father, the same mother and the same sister. A
 * shareable seed that produced a different family would not be shareable.
 *
 * The shape is the spec's default (§12.4): the father carries the name,
 * the mother keeps a maiden name, siblings sometimes. The generator is
 * built to take other shapes — nothing here assumes there must be two
 * parents — but v1's creation screen does not offer a picker, so the
 * default is what it builds.
 */
export function planBirth(
  world: World,
  request: BirthRequest,
  seedNumber: number,
): BirthPlan {
  const rng = openStream(world.seed, Stream.PersonTraits, seedNumber, 4_242)
  const birthTick = request.birthTick ?? defaultBirthTick(world.tick)
  const station = request.station ?? rng.nextIntInclusive(120, 880)

  const male = world.spec.maleGiven
  const female = world.spec.femaleGiven
  const families = world.spec.family

  const fatherAge = rng.nextIntInclusive(22, 38)
  const motherAge = rng.nextIntInclusive(20, 36)
  const maiden = rng.pickWeighted(families.names, families.weights) || MOTHER_MAIDEN_FALLBACK

  const family: FamilySpec[] = [
    {
      relation: 'father',
      givenName: rng.pickWeighted(male.names, male.weights),
      // THE FATHER CARRIES THE NAME. That is what makes the surname the
      // player typed mean something rather than being a label on the
      // child alone.
      familyName: request.familyName,
      maidenName: null,
      ageYears: fatherAge,
      older: true,
    },
    {
      relation: 'mother',
      givenName: rng.pickWeighted(female.names, female.weights),
      familyName: request.familyName,
      maidenName: maiden,
      ageYears: motherAge,
      older: true,
    },
  ]

  // SIBLINGS SOMETIMES, which is the honest rate — most people have one
  // and plenty have none.
  const siblings = rng.chance(620, 1_000) ? rng.nextIntInclusive(1, 3) : 0
  for (let i = 0; i < siblings; i += 1) {
    const sisterly = rng.chance(500, 1_000)
    const pool = sisterly ? female : male
    family.push({
      relation: 'sibling',
      givenName: rng.pickWeighted(pool.names, pool.weights),
      familyName: request.familyName,
      maidenName: null,
      ageYears: rng.nextIntInclusive(1, 8),
      older: rng.chance(600, 1_000),
    })
  }

  return {
    givenName: request.givenName.trim() || rng.pickWeighted(male.names, male.weights),
    familyName: request.familyName.trim() || rng.pickWeighted(families.names, families.weights),
    sex: request.sex,
    birthTick,
    placeId: request.placeId,
    family,
    station,
    householdWords: householdWordsFor(station),
    registryNo: registryNoFor(seedNumber, request.givenName, request.familyName),
  }
}

/**
 * WHAT THE PARENTS DO, from the household's standing.
 *
 * Occupation ids the careers module already knows, so a father on the
 * certificate is a father with a real job in the real ladder rather than a
 * word on a document.
 */
export function parentWorkFor(station: number, rngRoll: number): string {
  const poor = ['labourer', 'millhand', 'shop-clerk']
  const middle = ['carpenter', 'clerk', 'constable', 'aide']
  const comfortable = ['teacher', 'nurse', 'accountant', 'manager']
  const rich = ['doctor', 'director', 'partner', 'vice-president']
  const pool =
    station >= 820 ? rich : station >= 620 ? comfortable : station >= 320 ? middle : poor
  return pool[Math.abs(rngRoll) % pool.length] ?? 'labourer'
}

/**
 * THE BIRTH ANNOUNCEMENT, in the certificate's own voice.
 *
 * One sentence, and it is the first sentence of the whole game — worth
 * getting right. The spec's example is followed closely because it is
 * good: name, sex, date, place.
 */
export function announcementFor(plan: BirthPlan, dateWords: string, placeWords: string): string {
  const article = plan.sex === 'male' ? 'a boy' : 'a girl'
  return `You were born ${plan.givenName} ${plan.familyName}, ${article}, on ${dateWords}, in ${placeWords}.`
}
