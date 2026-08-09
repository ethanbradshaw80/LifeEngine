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
import { foundingSavings, seedFoundingAccounts } from './finances.js'
import { freshEconomy } from './economy.js'
import { freshSectorPrices, freshStockPrices } from './market.js'
import { freshPolicy } from './government.js'
import { generateProperties, seatHouseholds } from './realestate.js'
import { generateNations } from './geopolitics.js'
import { freshHealth } from './health.js'
import { CLASSIC_SPEC } from './worldspec.js'
import type { WorldSpec } from './types.js'

/**
 * Founding population. ~100 from Milestone 1 through P2; 400 from M-ARMY2
 * (owner direction 2026-08-01: "300-500 people just so we have it all mixed
 * and not too many people join but still have other jobs"). Measured before
 * the move: demographic bands hold at 400 (fertility 2.36-2.48, childless
 * 6-9%, median first marriage 21, town grows to ~800-950 by year 150) and
 * the army becomes visible (14-16 enlistments/decade, ~30 serving at once).
 * Tests that predate the change pin population 100 explicitly — same
 * generation path, byte-identical to their old worlds.
 */
export const DEFAULT_POPULATION = 400

/** Oldest age generated for the founding population. */
const MAX_STARTING_AGE = 84

function allocateId(world: { nextEntityId: number }): EntityId {
  const id = entityId(world.nextEntityId)
  world.nextEntityId += 1
  return id
}

export function rollTraits(rng: Rng): Traits {
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
export function startingEducation(age: number, curiosity: number, rng: Rng): EducationLevel {
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

function makePlaces(world: World, rng: Rng, spec: WorldSpec): void {
  const placeIds: EntityId[] = []

  for (const name of spec.gazetteer.neighbourhoods) {
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
  world.places.set(schoolId, { id: schoolId, name: spec.gazetteer.schoolName, kind: 'school', desirability: 500 })
  placeIds.push(schoolId)

  for (const name of spec.gazetteer.workplaces) {
    const id = allocateId(world)
    world.places.set(id, { id, name, kind: 'workplace', desirability: 500 })
    placeIds.push(id)
  }

  for (const name of spec.gazetteer.civic) {
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
export function createWorld(
  seed: Seed,
  population = DEFAULT_POPULATION,
  spec: WorldSpec = CLASSIC_SPEC,
): World {
  const world: World = {
    seed,
    tick: makeTick(0),
    nextEntityId: 1,
    nextEventId: 1,
    nextCausalRecordId: 1,
    spec,
    presetId: spec.id,
    town: { name: spec.gazetteer.townName, placeIds: [] },
    places: new Map(),
    people: new Map(),
    households: new Map(),
    accounts: new Map(),
    bankruptcies: new Map(),
    businesses: new Map(),
    economy: freshEconomy(),
    sectorPrices: freshSectorPrices(),
    stockPrices: freshStockPrices(),
    stockHistory: {},
    gamblers: new Map(),
    athletes: new Map(),
    analystViews: new Map(),
    listings: new Map(),
    officials: new Map(),
    elections: new Map(),
    policy: freshPolicy(),
    education: new Map(),
    employment: new Map(),
    health: new Map(),
    service: new Map(),
    awards: new Map(),
    criminal: new Map(),
    wellbeing: new Map(),
    habits: new Map(),
    properties: new Map(),
    leases: new Map(),
    deployments: new Map(),
    relationships: new Map(),
    events: [],
    causalRecords: [],
    player: { personId: null, pending: null, log: [], nextDecisionId: 1, lineage: [] },
    nations: new Map(),
    geoRelations: new Map(),
  }

  const genRng = openStream(seed, Stream.WorldGeneration, 0, 0)
  makePlaces(world, genRng, spec)

  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) throw new Error('world generation produced no neighbourhoods')

  let created = 0
  while (created < population) {
    const householdId = allocateId(world)
    const home = genRng.pick(neighbourhoods)
    // Weighted by real census frequency: a town should hold several Smiths
    // and one Kowalczyk, which is what the numbers are carried for.
    const familyName = genRng.pickWeighted(spec.family.names, spec.family.weights)
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
        // Their plan predates the record too — decided (and recorded) on
        // the first tick by settleFamilyPlans, never invented here.
        familySizeAspiration: null,
      })
    }

    const household: Household = {
      id: householdId,
      placeId: home.id,
      memberIds,
      formedTick: makeTick(0),
      dissolvedTick: null,
      homelessSinceTick: null,
      // Filled in below, once employment exists to base it on.
      savings: 0 as Money,
      spendStance: null,
    }
    world.households.set(householdId, household)
    created += memberIds.length
  }

  // Founding savings: unequal by design (Law 10). Employment has not started
  // yet, so this is the fallback range in foundingSavings — a family may
  // start with a few hundred dollars or a couple of thousand.
  //
  // M-ECON §1: it goes to the ADULTS, because that is where money lives now.
  // The household itself starts square with the world and only goes negative
  // if it fails to meet a month.
  for (const household of [...world.households.values()].sort((a, b) => a.id - b.id)) {
    seedFoundingAccounts(world, household, foundingSavings(world, household))
  }

  // L4-M3: the Republic's installations — allocated AFTER the founding
  // population for the same reason nations are (below): person ids seed trait
  // streams, and id-shifting reshuffles the whole town. Nothing during person
  // generation needs a base to exist.
  for (const base of spec.gazetteer.bases) {
    const id = allocateId(world)
    world.places.set(id, { id, name: base.name, kind: 'base', desirability: 500 })
    ;(world.town as { placeIds: readonly EntityId[] }).placeIds = [...world.town.placeIds, id]
  }

  // The wider world is generated LAST, so nations take ids above every
  // founding person and place. Deliberate: allocating them first shifted all
  // person ids, and person ids seed trait streams — the whole town would have
  // been reborn as different people. Draws live on Stream 9 either way; id
  // order is the only coupling, and this removes it.
  generateNations(world)

  // THE HOUSING STOCK, LAST AND WITHOUT A DRAW. Properties are derived from
  // the neighbourhood ids that already exist, so laying them out consumes
  // no RNG and cannot shift a single later roll in the world. Ordering it
  // after nations for the same reason nations come after people: whatever
  // allocates ids last cannot disturb what came before it.
  generateProperties(world, placesOfKind(world, 'neighbourhood').map((p) => p.id))
  // And every founding family gets an address, not just a street. Without
  // this the whole stock reads as empty and the market has no scarcity in
  // it at all.
  seatHouseholds(world)

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

  // NB: `spec` here is the PERSON spec (this function's own parameter); the
  // world's preset is world.spec.
  const pool = spec.sex === 'female' ? world.spec.femaleGiven : world.spec.maleGiven
  const givenNames = pool.names
  const givenWeights = pool.weights
  const birthTick = makeTick(0) - spec.age * TICKS_PER_YEAR - genRng.nextInt(0, TICKS_PER_YEAR)

  const person: Person = {
    id,
    givenName: genRng.pickWeighted(givenNames, givenWeights),
    familyName: spec.familyName,
    sex: spec.sex,
    birthTick: birthTick as Tick,
    deathTick: null,
    causeOfDeath: null,
    tier: 'deep',
    traits,
    householdId: spec.householdId,
    parentIds: spec.parentIds,
    spendStance: null,
  }
  world.people.set(id, person)

  world.health.set(id, freshHealth(id))

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
