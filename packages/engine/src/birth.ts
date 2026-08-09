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

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { Household, Person, World } from './types.js'
import { rollTraits, startingEducation } from './worldgen.js'
import { freshHealth } from './health.js'
import { hireIntoStartingWork } from './systems.js'

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
 * WHEN TO BE BORN: NOW. Age zero, this month.
 *
 * THIS WAS WRONG AND A PLAYER FOUND IT IN ONE SITTING — "I just started a
 * life and never went through any school." It returned the world's tick
 * MINUS TWENTY-FOUR YEARS, so pressing "Begin life" dropped you in as a
 * twenty-four-year-old with childhood, school and every choice in them
 * already behind you. The entire education module was unreachable from
 * the front door.
 *
 * The mistake was reading §12.1 — "the engine auto-picks a birth era that
 * guarantees a full life plays forward to death" — as "born in the past".
 * You cannot play forward FROM the past: the world's clock is the present,
 * and a birth tick behind it is time you have already missed. The spec's
 * own instruction two sections earlier says it plainly: "drops into the
 * existing life feed AT AGE 0".
 *
 * A full life plays forward because the WORLD keeps running, not because
 * the birth is backdated. Choosing an era is a question about when the
 * world starts, which is worldgen's, and it is why the Advanced era field
 * is still unbuilt rather than half-built here.
 */
export const FULL_LIFE_YEARS = 85

export function defaultBirthTick(worldTick: Tick): Tick {
  return worldTick
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

/**
 * A SEED FROM THE NAME ITSELF, for a player who did not type a registry code.
 *
 * THE BUG (owner, playing): "everytime you start a new life the NPC family
 * doesn't start with a job and they are also named the same everytime".
 *
 * The fallback used to be `givenName.length * 977 + familyName.length * 131`
 * — the LENGTHS and nothing else. "John Smith" and "Mark Jones" are both
 * four-and-five, so they seeded identically and produced the same mother,
 * the same father, the same siblings, the same everything. Real names
 * cluster hard around the same few lengths, so most new lives collided and
 * the family looked hard-coded.
 *
 * FNV-1a over the actual characters. Deterministic — the same name still
 * gives the same family, which is the point of the registry code — but two
 * different names now differ, which is the point of a seed.
 *
 * Kept in the engine beside `seedFromRegistryNo` so both doors into a birth
 * derive their seed the same way, in one place, under test.
 */
export function seedFromName(givenName: string, familyName: string): number {
  let hash = 2_166_136_261
  const text = `${givenName.trim().toLowerCase()} ${familyName.trim().toLowerCase()}`
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    // The FNV prime, by shifts — `Math.imul` would do, but this keeps the
    // arithmetic plainly 32-bit and the engine free of surprises.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  // Kept well inside the safe-integer range; the streams salt it anyway.
  return hash % 1_000_000_007
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
/** Old enough to hold a job — the age the town itself hires from. */
const WORKING_AGE = 18

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

// ---------------------------------------------------------------------------
// REGISTERING THE BIRTH — where a plan becomes people (spec §5)
// ---------------------------------------------------------------------------

/**
 * WRITE THE FAMILY INTO THE WORLD, and make the child the player.
 *
 * THIS IS THE LAST MILE OF THE FRONT DOOR and the one that matters: until
 * it existed the certificate named a father, a mother and a sister who did
 * not exist anywhere, which is precisely the "set dressing" the spec's §5
 * refuses — "all family members are real registered NPCs so they persist,
 * age, and can die: the family is real, not set dressing."
 *
 * SINGLE-WRITER, HONESTLY. The spec says the NPC/worldgen system owns
 * people and character-creation only requests a birth. That is what
 * `planBirth` above does — it decides a shape and writes nothing. THIS
 * function is the writing, and it lives here rather than in worldgen for
 * one reason worth stating: worldgen builds a world from nothing at tick
 * zero, and this inserts a family into a world that is already running.
 * They are different jobs, and the second one has to know about the first
 * without being it.
 *
 * Returns the child's id, or null when the world cannot take a birth.
 */
export function registerBirth(
  world: World,
  plan: BirthPlan,
  seedNumber: number,
): EntityId | null {
  const places = [...world.places.values()]
  if (places.length === 0) return null
  const rng = openStream(world.seed, Stream.PersonTraits, seedNumber + 7, 5_151)

  // WHERE. A named town if the player picked one and it exists; otherwise
  // the world chooses, which is what "anywhere" means.
  const place =
    (plan.placeId === null
      ? undefined
      : places.find((entry) => entry.id === (plan.placeId as unknown as EntityId))) ??
    places[rng.nextIntInclusive(0, places.length - 1)]
  if (place === undefined) return null

  const householdId = allocate(world)
  const memberIds: EntityId[] = []

  // THE PARENTS AND SIBLINGS FIRST, because the child's parentIds have to
  // point at people who already exist.
  const parentIds: EntityId[] = []
  for (const member of plan.family) {
    const id = allocate(world)
    const person: Person = {
      id,
      givenName: member.givenName,
      familyName: member.familyName,
      sex:
        member.relation === 'mother'
          ? 'female'
          : member.relation === 'father'
            ? 'male'
            : rng.chance(500, 1_000)
              ? 'female'
              : 'male',
      // Their ages are relative to the CHILD's birth, not to now — the
      // certificate says the father was twenty-nine when you were born and
      // the world has to agree with the certificate.
      birthTick: (plan.birthTick - member.ageYears * 12) as Tick,
      deathTick: null,
      causeOfDeath: null,
      tier: 'deep',
      traits: rollTraits(openStream(world.seed, Stream.PersonTraits, id, 0)),
      householdId,
      parentIds: [],
      spendStance: null,
    }
    world.people.set(id, person)
    world.health.set(id, freshHealth(id))
    // AN EDUCATION RECORD, WITHOUT WHICH THEY ARE INVISIBLE TO SCHOOL.
    // `runEducation` starts with `if (!record) continue` — no record means
    // the person is never enrolled, never attends and never graduates, for
    // life. A parent with no schooling on file also reads as unqualified
    // for every job in the game.
    world.education.set(id, {
      personId: id,
      level: startingEducation(
        member.ageYears,
        person.traits.curiosity,
        openStream(world.seed, Stream.Education, id, 0),
      ),
      enrolledIn: null,
      enrolledAtTick: null,
      completesAtTick: null,
      attainment: Math.min(1000, Math.floor((person.traits.diligence + person.traits.curiosity) / 2)),
    })
    /**
     * AND A JOB, IF THEY ARE OLD ENOUGH TO HOLD ONE (owner, playing:
     * "everytime you start a new life the NPC family doesn't start with a
     * job").
     *
     * A birth family is written straight into a running world — two parents
     * in their twenties or thirties, with lives behind them — and nothing
     * gave them any work at all. `runEmployment` would have got to them
     * eventually, but it is a monthly pass with a chance gate, so the player
     * met their own mother and father unemployed on the certificate.
     *
     * Hired through the town's own rule rather than a second one written
     * here, so a parent cannot hold work the town would never have given
     * them. Not everybody gets a job — `hireIntoStartingWork` says no when
     * nothing fits, and some people are not employed, which is true.
     *
     * The stream is salted per person and distinct from the traits draw
     * above, so adding this cannot shift anybody's temperament (Law 11).
     */
    if (member.ageYears >= WORKING_AGE) {
      hireIntoStartingWork(
        world,
        world.tick,
        person,
        openStream(world.seed, Stream.Employment, id, 3_131),
      )
    }
    memberIds.push(id)
    if (member.relation !== 'sibling') parentIds.push(id)
  }

  // THEN THE CHILD.
  const childId = allocate(world)
  const child: Person = {
    id: childId,
    givenName: plan.givenName,
    familyName: plan.familyName,
    sex: plan.sex,
    birthTick: plan.birthTick,
    deathTick: null,
    causeOfDeath: null,
    tier: 'deep',
    // ROLLED, NEVER PICKED. The spec is explicit, and it is the honest
    // design — nobody chooses their own temperament.
    traits: rollTraits(openStream(world.seed, Stream.PersonTraits, childId, 0)),
    householdId,
    parentIds,
    spendStance: null,
  }
  world.people.set(childId, child)
  world.health.set(childId, freshHealth(childId))
  // THE CHILD'S OWN, and this is the bug a player found in one sitting:
  // "I just started a life and never went through any school." Exactly the
  // shape the in-simulation birth path already writes — level 'none',
  // because a newborn has none yet, and that record is what the schools
  // read to know somebody exists.
  world.education.set(childId, {
    personId: childId,
    level: 'none',
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: 500,
  })
  memberIds.push(childId)

  // SIBLINGS ARE THE PARENTS' CHILDREN TOO. Without this a brother is a
  // stranger who happens to share a surname and a roof, and every kinship
  // read in the game — inheritance, the family tree, who grieves — would
  // quietly disagree with the certificate.
  for (const id of memberIds) {
    const person = world.people.get(id)
    if (person === undefined || id === childId) continue
    if (parentIds.includes(id)) continue
    world.people.set(id, { ...person, parentIds })
  }

  const household: Household = {
    id: householdId,
    placeId: place.id,
    memberIds,
    formedTick: plan.birthTick,
    dissolvedTick: null,
    homelessSinceTick: null,
    // THE STATION IS REAL MONEY. A silver-spoon birth that started with the
    // same balance as a hard-up one would make the dial a label.
    savings: (plan.station * 400) as Money,
    spendStance: null,
  }
  world.households.set(householdId, household)

  return childId
}

function allocate(world: World): EntityId {
  const id = world.nextEntityId as EntityId
  world.nextEntityId += 1
  return id
}
