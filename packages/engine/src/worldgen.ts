/**
 * World generation. Builds a town and its founding population from a seed.
 *
 * Everything here draws from Stream.WorldGeneration or Stream.PersonTraits, so
 * the same seed always produces exactly the same town — same people, same
 * names, same ages, same houses.
 */

import type { EntityId, Money, Seed, Tick } from '@life-engine/shared'
import { entityId, tick as makeTick, TICKS_PER_YEAR } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { Rng } from './rng.js'
import type {
  EducationLevel,
  EducationRecord,
  Household,
  Person,
  Place,
  Sex,
  Traits,
  World,
} from './types.js'
import { relationshipKey } from './types.js'
import { foundingSavings } from './finances.js'
import { generateNations } from './geopolitics.js'
import {
  CIVIC_NAMES,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  NEIGHBOURHOOD_NAMES,
  SCHOOL_NAME,
  TOWN_NAME,
  WORKPLACE_NAMES,
} from './content.js'

/** Founding population. The milestone specifies approximately 100 people. */
export const DEFAULT_POPULATION = 100

/** Oldest age generated for the founding population. */
const MAX_STARTING_AGE = 84

function allocateId(world: { nextEntityId: number }): EntityId {
  const id = entityId(world.nextEntityId)
  world.nextEntityId += 1
  return id
}

function rollTraits(rng: Rng): Traits {
  return {
    sociability: rng.nextBellInt(0, 1000),
    diligence: rng.nextBellInt(0, 1000),
    ambition: rng.nextBellInt(0, 1000),
    resilience: rng.nextBellInt(0, 1000),
    curiosity: rng.nextBellInt(0, 1000),
    vitality: rng.nextBellInt(200, 1000),
  }
}

/**
 * Education the founding generation already has, based on age and curiosity.
 * Nobody arrives mid-course: the founding population's schooling is finished.
 */
function startingEducation(age: number, curiosity: number, rng: Rng): EducationLevel {
  if (age < 6) return 'none'
  if (age < 12) return 'primary'
  if (age < 18) return 'secondary'

  // Adults: higher curiosity means more schooling, but it is not deterministic.
  const roll = rng.nextInt(0, 1000) + Math.floor(curiosity / 3)
  if (roll > 1150) return 'college'
  if (roll > 850) return 'trade'
  if (roll > 350) return 'secondary'
  return 'primary'
}

function makePlaces(world: World, rng: Rng): void {
  const placeIds: EntityId[] = []

  for (const name of NEIGHBOURHOOD_NAMES) {
    const id = allocateId(world)
    world.places.set(id, {
      id,
      name,
      kind: 'neighbourhood',
      desirability: rng.nextBellInt(150, 950),
    })
    placeIds.push(id)
  }

  const schoolId = allocateId(world)
  world.places.set(schoolId, { id: schoolId, name: SCHOOL_NAME, kind: 'school', desirability: 500 })
  placeIds.push(schoolId)

  for (const name of WORKPLACE_NAMES) {
    const id = allocateId(world)
    world.places.set(id, { id, name, kind: 'workplace', desirability: 500 })
    placeIds.push(id)
  }

  for (const name of CIVIC_NAMES) {
    const id = allocateId(world)
    world.places.set(id, { id, name, kind: 'civic', desirability: 500 })
    placeIds.push(id)
  }

  ;(world.town as { placeIds: readonly EntityId[] }).placeIds = placeIds
}

export function placesOfKind(world: World, kind: Place['kind']): Place[] {
  const found: Place[] = []
  for (const id of world.town.placeIds) {
    const place = world.places.get(id)
    if (place && place.kind === kind) found.push(place)
  }
  return found
}

/**
 * Create a world at tick 0.
 *
 * The founding population is generated as households: some are single adults,
 * some are two adults, and some have children whose parentage is recorded so
 * family history is real from the first tick rather than invented later.
 */
export function createWorld(seed: Seed, population = DEFAULT_POPULATION): World {
  const world: World = {
    seed,
    tick: makeTick(0),
    nextEntityId: 1,
    nextEventId: 1,
    nextCausalRecordId: 1,
    town: { name: TOWN_NAME, placeIds: [] },
    places: new Map(),
    people: new Map(),
    households: new Map(),
    education: new Map(),
    employment: new Map(),
    relationships: new Map(),
    events: [],
    causalRecords: [],
    player: { personId: null, pending: null, log: [], nextDecisionId: 1, lineage: [] },
    nations: new Map(),
    geoRelations: new Map(),
  }

  const genRng = openStream(seed, Stream.WorldGeneration, 0, 0)
  makePlaces(world, genRng)

  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) throw new Error('world generation produced no neighbourhoods')

  let created = 0
  while (created < population) {
    const householdId = allocateId(world)
    const home = genRng.pick(neighbourhoods)
    const familyName = genRng.pick(FAMILY_NAMES)
    const memberIds: EntityId[] = []

    // 55% of households are a couple, the rest a single adult.
    const adultCount = genRng.chance(55, 100) ? 2 : 1
    const adultIds: EntityId[] = []

    // The first adult's age is free; a second adult is drawn near the first.
    // Without this, an independent draw pairs a 74-year-old with a 29-year-old
    // often enough to be noticeable, which reads as a bug rather than a life.
    let firstAdultAge: number | null = null

    for (let i = 0; i < adultCount && created + memberIds.length < population; i++) {
      const sex: Sex = adultCount === 2 ? (i === 0 ? 'female' : 'male') : genRng.chance(1, 2) ? 'female' : 'male'
      const anchor: number | null = firstAdultAge
      const age: number =
        anchor === null
          ? genRng.nextIntInclusive(19, MAX_STARTING_AGE)
          : Math.max(19, Math.min(MAX_STARTING_AGE, anchor + genRng.nextIntInclusive(-8, 8)))
      firstAdultAge ??= age
      const id = makePerson(world, genRng, { sex, age, familyName, householdId, parentIds: [] })
      memberIds.push(id)
      adultIds.push(id)
    }

    // Couples under 55 may have children living at home.
    const eldest = adultIds[0]
    const youngestAdultAge = adultIds.length > 0 && eldest !== undefined ? ageOf(world, eldest) : 0
    const canHaveChildren = adultCount === 2 && youngestAdultAge < 55
    const childCount = canHaveChildren ? genRng.pickWeighted([0, 1, 2, 3], [35, 30, 25, 10]) : 0

    for (let i = 0; i < childCount && created + memberIds.length < population; i++) {
      const maxChildAge = Math.max(0, Math.min(17, youngestAdultAge - 20))
      if (maxChildAge <= 0) break
      const sex: Sex = genRng.chance(1, 2) ? 'female' : 'male'
      const age = genRng.nextIntInclusive(0, maxChildAge)
      const id = makePerson(world, genRng, {
        sex,
        age,
        familyName,
        householdId,
        parentIds: adultIds,
      })
      memberIds.push(id)
    }

    if (memberIds.length === 0) break

    // Founding couples are married from tick 0. Without this the first
    // generation would be two strangers sharing a house, and the Milestone 5
    // birth rule — which requires an actual partnership — would stop them ever
    // having children. Their wedding predates the simulation, so formedAtTick
    // is 0 rather than invented.
    const [firstAdult, secondAdult] = adultIds
    if (adultCount === 2 && firstAdult !== undefined && secondAdult !== undefined) {
      const a = firstAdult < secondAdult ? firstAdult : secondAdult
      const b = firstAdult < secondAdult ? secondAdult : firstAdult
      world.relationships.set(relationshipKey(a, b), {
        a,
        b,
        type: 'spouse',
        strength: 620 + genRng.nextInt(0, 300),
        formedAtTick: makeTick(0),
        typeSinceTick: makeTick(0),
        endedAtTick: null,
      })
    }

    const household: Household = {
      id: householdId,
      placeId: home.id,
      memberIds,
      formedTick: makeTick(0),
      dissolvedTick: null,
      // Filled in below, once employment exists to base it on.
      savings: 0 as Money,
    }
    world.households.set(householdId, household)
    created += memberIds.length
  }

  // Founding savings: unequal by design (Law 10). Employment has not started
  // yet, so this is the fallback range in foundingSavings — a family may
  // start with a few hundred dollars or a couple of thousand.
  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    world.households.set(household.id, {
      ...household,
      savings: foundingSavings(world, household),
    })
  }

  // The wider world is generated LAST, so nations take ids above every
  // founding person and place. Deliberate: allocating them first shifted all
  // person ids, and person ids seed trait streams — the whole town would have
  // been reborn as different people. Draws live on Stream 9 either way; id
  // order is the only coupling, and this removes it.
  generateNations(world)

  return world
}

function ageOf(world: World, id: EntityId): number {
  const person = world.people.get(id)
  if (!person) return 0
  return Math.floor((world.tick - person.birthTick) / TICKS_PER_YEAR)
}

interface PersonSpec {
  readonly sex: Sex
  readonly age: number
  readonly familyName: string
  readonly householdId: EntityId
  readonly parentIds: readonly EntityId[]
}

function makePerson(world: World, genRng: Rng, spec: PersonSpec): EntityId {
  const id = allocateId(world)

  // Traits use their own stream keyed on the person, so changing world layout
  // does not change anyone's personality.
  const traitRng = openStream(world.seed, Stream.PersonTraits, id, 0)
  const traits = rollTraits(traitRng)

  const givenNames = spec.sex === 'female' ? FEMALE_GIVEN_NAMES : MALE_GIVEN_NAMES
  const birthTick = makeTick(0) - spec.age * TICKS_PER_YEAR - genRng.nextInt(0, TICKS_PER_YEAR)

  const person: Person = {
    id,
    givenName: genRng.pick(givenNames),
    familyName: spec.familyName,
    sex: spec.sex,
    birthTick: birthTick as Tick,
    deathTick: null,
    causeOfDeath: null,
    tier: 'deep',
    traits,
    householdId: spec.householdId,
    parentIds: spec.parentIds,
  }
  world.people.set(id, person)

  const eduRng = openStream(world.seed, Stream.Education, id, 0)
  const level = startingEducation(spec.age, traits.curiosity, eduRng)
  const record: EducationRecord = {
    personId: id,
    level,
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: Math.min(1000, Math.floor((traits.diligence + traits.curiosity) / 2)),
  }
  world.education.set(id, record)

  return id
}
