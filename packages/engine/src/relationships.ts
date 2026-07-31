/**
 * The relationships domain. Milestone 5.
 *
 * This replaced Milestone 1's placeholder, where friends were picked at random
 * from anyone of a similar age and partnership was an accident of who happened
 * to share a roof. It is also the template for how every remaining Layer 2
 * domain should be built: typed state, decisions driven by modelled factors,
 * and a causal record written at the moment each decision is taken.
 *
 * The life cycle of a tie:
 *
 *     (strangers) → friend → courting → spouse → former-spouse
 *                      ↓         ↓         ↓
 *                   lapsed    ended    divorced / widowed
 *
 * Every transition is a decision with recorded inputs. Law 3 applies as much to
 * a marriage ending as to a job change: the game must be able to say why.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { raisePending } from './player.js'
import { openStream, Stream } from './rng.js'
import type { CausalFactor, Person, Relationship, World } from './types.js'
import { relationshipKey } from './types.js'

// --- Tunables ---------------------------------------------------------------

const MIN_SOCIAL_AGE = 5
const ADULT_AGE = 18
const MAX_FRIENDS = 8
/** Below this a friendship lapses. Courtships and marriages use their own rules. */
const FRIENDSHIP_END_STRENGTH = 120
const BASE_DECAY = 4
/** Familiarity dulls a partnership; cohabitation no longer fully offsets decay. */
const HABITUATION = 2
/** Living together or working together keeps a tie alive. */
const SHARED_HOME_REINFORCEMENT = 7
const SHARED_WORK_REINFORCEMENT = 3
const COURTSHIP_MIN_STRENGTH = 480
const MARRIAGE_MIN_STRENGTH = 540
const MARRIAGE_MIN_COURTSHIP_MONTHS = 14
const DIVORCE_STRENGTH_THRESHOLD = 340
const MAX_AGE_GAP = 12

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function relationshipBetween(
  world: World,
  a: EntityId,
  b: EntityId,
): Relationship | undefined {
  return world.relationships.get(relationshipKey(a, b))
}

/** Everyone connected to this person, with the tie, in stable id order. */
export function relationshipsOf(world: World, personId: EntityId): Relationship[] {
  const found: Relationship[] = []
  for (const relationship of world.relationships.values()) {
    if (relationship.a === personId || relationship.b === personId) found.push(relationship)
  }
  found.sort((x, y) => other(x, personId) - other(y, personId))
  return found
}

export function other(relationship: Relationship, self: EntityId): EntityId {
  return relationship.a === self ? relationship.b : relationship.a
}

/** Current spouse, if any. Former spouses are history and are not returned. */
export function spouseOf(world: World, personId: EntityId): EntityId | null {
  // Sorted so that, in the impossible-but-guard-worthy case of two spouse
  // edges, the same one is always returned.
  for (const [, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'spouse') continue
    if (relationship.a === personId || relationship.b === personId) {
      return other(relationship, personId)
    }
  }
  return null
}

/** Spouse or courting partner — whoever a person is currently paired with. */
export function partnerOf(world: World, personId: EntityId): EntityId | null {
  for (const [, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'spouse' && relationship.type !== 'courting') continue
    if (relationship.a === personId || relationship.b === personId) {
      return other(relationship, personId)
    }
  }
  return null
}

export function friendsOf(world: World, personId: EntityId): EntityId[] {
  const friends: EntityId[] = []
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'friend') continue
    if (relationship.a === personId) friends.push(relationship.b)
    else if (relationship.b === personId) friends.push(relationship.a)
  }
  friends.sort((x, y) => x - y)
  return friends
}

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

/**
 * How well two people suit each other, 0-1000.
 *
 * Similar sociability and curiosity draw people together; a large gap in either
 * pushes them apart. This is deliberately simple and readable — it is a model
 * of "these two get on", not a claim about how attraction works.
 */
export function compatibility(a: Person, b: Person): number {
  const socialGap = Math.abs(a.traits.sociability - b.traits.sociability)
  const curiousGap = Math.abs(a.traits.curiosity - b.traits.curiosity)
  const diligenceGap = Math.abs(a.traits.diligence - b.traits.diligence)

  // Averaged gap, inverted: identical traits score 1000, opposite score 0.
  const gap = Math.floor((socialGap * 2 + curiousGap * 2 + diligenceGap) / 5)
  return Math.max(0, 1000 - gap)
}

function sharesHousehold(_world: World, a: Person, b: Person): boolean {
  return a.householdId !== null && a.householdId === b.householdId
}

function sharesWorkplace(world: World, a: EntityId, b: EntityId): boolean {
  const jobA = world.employment.get(a)
  const jobB = world.employment.get(b)
  return jobA !== undefined && jobB !== undefined && jobA.workplaceId === jobB.workplaceId
}

function sharesNeighbourhood(world: World, a: Person, b: Person): boolean {
  if (a.householdId === null || b.householdId === null) return false
  const homeA = world.households.get(a.householdId)
  const homeB = world.households.get(b.householdId)
  return homeA !== undefined && homeB !== undefined && homeA.placeId === homeB.placeId
}

/** True when neither person is already paired and the pairing is plausible. */
function couldCourt(world: World, a: Person, b: Person, tick: Tick): boolean {
  if (a.sex === b.sex) return false // simplification — see the note in §Births
  if (partnerOf(world, a.id) !== null || partnerOf(world, b.id) !== null) return false

  const ageA = ageAt(a.birthTick, tick)
  const ageB = ageAt(b.birthTick, tick)
  if (ageA < ADULT_AGE || ageB < ADULT_AGE) return false
  if (Math.abs(ageA - ageB) > MAX_AGE_GAP) return false

  // Close kin are excluded. Only parent/child and sibling links exist in the
  // model today; the check is written so adding more kinship extends it here.
  if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id)) return false
  if (a.parentIds.some((id) => b.parentIds.includes(id))) return false

  return true
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

function setRelationship(world: World, relationship: Relationship): void {
  world.relationships.set(relationshipKey(relationship.a, relationship.b), relationship)
}

/**
 * Relationship entries in a STABLE order: by (a, b), never Map insertion order.
 *
 * This is not a tidiness preference. Courtship and marriage depend on whether
 * someone is ALREADY paired, so the order edges are processed in changes who
 * ends up with whom. Map insertion order reflects the history of how the world
 * was built, and a world restored from a save is rebuilt from a sorted array —
 * so insertion order differs after a save/load and the simulation diverges.
 *
 * Milestone 1's friendship loop iterated insertion order and got away with it,
 * because decay treated every edge independently. Milestone 5 introduced
 * cross-edge dependencies, and with them this hazard. Caught by the
 * save-load-continue test, which is exactly what it is for
 * (docs/DETERMINISM.md §3).
 */
function sortedRelationships(world: World): [string, Relationship][] {
  return [...world.relationships].sort(([, x], [, y]) => x.a - y.a || x.b - y.b)
}

function livingSorted(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((x, y) => x.id - y.id)
  return living
}

export function runRelationships(world: World, tick: Tick): void {
  const living = livingSorted(world)
  if (living.length < 2) return

  decayAndReinforce(world, tick)
  formFriendships(world, tick, living)
  advanceCourtships(world, tick)
  considerMarriage(world, tick)
  considerSeparation(world, tick)
}

/**
 * Ties weaken over time unless something keeps them alive.
 *
 * Runs before formation so a tie made this month is not immediately decayed,
 * and so reinforcement reflects this month's circumstances.
 */
function decayAndReinforce(world: World, tick: Tick): void {
  for (const [key, relationship] of sortedRelationships(world)) {
    if (relationship.type === 'former-spouse') continue // history; does not decay

    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b) continue

    let change = -BASE_DECAY
    if (sharesHousehold(world, a, b)) change += SHARED_HOME_REINFORCEMENT
    if (sharesWorkplace(world, relationship.a, relationship.b)) change += SHARED_WORK_REINFORCEMENT
    if (sharesNeighbourhood(world, a, b)) change += 1

    // Partnerships carry a strain proportional to how badly matched the two
    // are, and to being out of work. Without this a couple who live together
    // gain strength every single month and a marriage can NEVER weaken — which
    // made divorce impossible rather than rare. A well-matched pair still grows
    // closer; a poorly-matched one erodes.
    if (relationship.type === 'spouse' || relationship.type === 'courting') {
      // Three strains, all modelled rather than random:
      //
      //  - habituation: living together stops being novel, so cohabitation no
      //    longer fully offsets ordinary decay;
      //  - mismatch: how badly suited the two are;
      //  - money: being out of work below retirement age.
      //
      // Without the first, a couple who lived together gained strength every
      // month forever. Courtship already selects hard for compatibility — every
      // married pair scored 721-916 — so mismatch alone could never end a
      // marriage, and the town recorded zero separations in fifty years.
      change -= HABITUATION
      change -= Math.floor((1000 - compatibility(a, b)) / 70)

      const belowRetirement = ageAt(a.birthTick, tick) < 66 && ageAt(b.birthTick, tick) < 66
      if (belowRetirement) {
        const idle = (world.employment.has(a.id) ? 0 : 1) + (world.employment.has(b.id) ? 0 : 1)
        change -= idle * 3
      }
    }

    const strength = Math.max(0, Math.min(1000, relationship.strength + change))

    if (relationship.type === 'friend' && strength < FRIENDSHIP_END_STRENGTH) {
      world.relationships.delete(key)
      recordEvent(world, tick, {
        type: 'friendship-lapsed',
        subjectId: relationship.a,
        otherId: relationship.b,
      })
      continue
    }

    world.relationships.set(key, { ...relationship, strength })
  }
}

function formFriendships(world: World, tick: Tick, living: Person[]): void {
  const counts = new Map<EntityId, number>()
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'friend') continue
    counts.set(relationship.a, (counts.get(relationship.a) ?? 0) + 1)
    counts.set(relationship.b, (counts.get(relationship.b) ?? 0) + 1)
  }

  for (const person of living) {
    const age = ageAt(person.birthTick, tick)
    if (age < MIN_SOCIAL_AGE) continue
    if ((counts.get(person.id) ?? 0) >= MAX_FRIENDS) continue

    const rng = openStream(world.seed, Stream.Relationships, person.id, tick)
    if (!rng.chance(person.traits.sociability, 26_000)) continue

    // Candidates are people already in this person's orbit — same home, same
    // work, same street — plus anyone of a similar age. Proximity is what makes
    // the resulting friendships explainable rather than arbitrary.
    const candidates: Person[] = []
    const weights: number[] = []

    for (const otherPerson of living) {
      if (otherPerson.id === person.id) continue
      if (world.relationships.has(relationshipKey(person.id, otherPerson.id))) continue

      const otherAge = ageAt(otherPerson.birthTick, tick)
      if (otherAge < MIN_SOCIAL_AGE) continue
      if (Math.abs(otherAge - age) > 10) continue

      let weight = 1 + Math.floor(compatibility(person, otherPerson) / 100)
      if (sharesHousehold(world, person, otherPerson)) weight += 12
      if (sharesWorkplace(world, person.id, otherPerson.id)) weight += 8
      if (sharesNeighbourhood(world, person, otherPerson)) weight += 4

      candidates.push(otherPerson)
      weights.push(weight)
    }

    if (candidates.length === 0) continue

    const chosen = rng.pickWeighted(candidates, weights)
    const strength = 260 + Math.floor(compatibility(person, chosen) / 4) + rng.nextInt(0, 120)

    setRelationship(world, {
      a: person.id < chosen.id ? person.id : chosen.id,
      b: person.id < chosen.id ? chosen.id : person.id,
      type: 'friend',
      strength: Math.min(1000, strength),
      formedAtTick: tick,
      typeSinceTick: tick,
      endedAtTick: null,
    })
    counts.set(person.id, (counts.get(person.id) ?? 0) + 1)
    counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1)

    recordEvent(world, tick, {
      type: 'befriended',
      subjectId: person.id,
      otherId: chosen.id,
    })
  }
}

/** Strong friendships between eligible adults may become courtships. */
function advanceCourtships(world: World, tick: Tick): void {
  for (const [, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'friend') continue
    if (relationship.strength < COURTSHIP_MIN_STRENGTH) continue

    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue
    if (!couldCourt(world, a, b, tick)) continue

    const rng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 101)
    const match = compatibility(a, b)
    if (!rng.chance(match, 6_000)) continue

    // The moment exists either way; the player gets to answer it. Declining
    // leaves the friendship as it was — the moment may or may not come again.
    const playerId = world.player.personId
    if (playerId !== null && (playerId === relationship.a || playerId === relationship.b)) {
      raisePending(world, {
        tick,
        kind: 'courtship',
        personId: playerId,
        otherId: playerId === relationship.a ? relationship.b : relationship.a,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
      continue
    }

    promoteToCourting(world, tick, relationship, [])
  }
}

/** One courtship implementation for both the automatic path and player choices. */
export function promoteToCourting(
  world: World,
  tick: Tick,
  relationship: Relationship,
  extraInputs: readonly CausalFactor[],
): void {
  const a = world.people.get(relationship.a)
  const b = world.people.get(relationship.b)
  if (!a || !b) return
  const match = compatibility(a, b)

  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'courting',
    typeSinceTick: tick,
  })

  recordEvent(world, tick, {
    type: 'started-courting',
    subjectId: relationship.a,
    otherId: relationship.b,
  })
  recordDecision(world, tick, {
    subjectId: relationship.a,
    decision: 'courtship',
    significance: 'major',
    inputs: [
      ...extraInputs,
      factor('compatible-personality', match, relationship.b),
      factor('strong-attachment', relationship.strength),
    ],
    chosen: 'began courting',
    rejected: ['to stay friends'],
    streamId: Stream.Relationships,
  })
}

function considerMarriage(world: World, tick: Tick): void {
  for (const [, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'courting') continue
    if (relationship.strength < MARRIAGE_MIN_STRENGTH) continue
    if (tick - relationship.typeSinceTick < MARRIAGE_MIN_COURTSHIP_MONTHS) continue

    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue

    // Some income between them makes marriage more likely — a modelled
    // pressure, not a requirement. Poverty delays weddings; it does not
    // forbid them.
    const earners =
      (world.employment.has(a.id) ? 1 : 0) + (world.employment.has(b.id) ? 1 : 0)
    const rng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 202)
    const monthsTogether = tick - relationship.typeSinceTick

    const appetite = 60 + earners * 45 + Math.min(90, monthsTogether)
    if (!rng.chance(appetite, 1_200)) continue

    const playerId = world.player.personId
    if (playerId !== null && (playerId === relationship.a || playerId === relationship.b)) {
      raisePending(world, {
        tick,
        kind: 'marriage',
        personId: playerId,
        otherId: playerId === relationship.a ? relationship.b : relationship.a,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      })
      continue
    }

    promoteToSpouse(world, tick, relationship, [])
  }
}

/** One marriage implementation for both the automatic path and player choices. */
export function promoteToSpouse(
  world: World,
  tick: Tick,
  relationship: Relationship,
  extraInputs: readonly CausalFactor[],
): void {
  const a = world.people.get(relationship.a)
  const b = world.people.get(relationship.b)
  if (!a || !b) return
  const monthsTogether = tick - relationship.typeSinceTick
  const earners =
    (world.employment.has(relationship.a) ? 1 : 0) + (world.employment.has(relationship.b) ? 1 : 0)

  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'spouse',
    typeSinceTick: tick,
    strength: Math.min(1000, relationship.strength + 40),
  })

  recordEvent(world, tick, {
    type: 'married',
    subjectId: relationship.a,
    otherId: relationship.b,
  })
  recordDecision(world, tick, {
    subjectId: relationship.a,
    decision: 'marriage',
    significance: 'defining',
    inputs: [
      ...extraInputs,
      factor('strong-attachment', relationship.strength, relationship.b),
      factor('years-together', Math.floor(monthsTogether / TICKS_PER_YEAR) * 100 + monthsTogether),
      factor('compatible-personality', compatibility(a, b)),
      ...(earners > 0 ? [factor('has-income', earners * 300)] : []),
    ],
    chosen: 'married',
    rejected: ['to stay unmarried'],
    streamId: Stream.Relationships,
  })
}

/**
 * Marriages can end. They must not end by an unexplained roll.
 *
 * Separation becomes possible only once a marriage has genuinely weakened, and
 * the record names what weakened it. Financial strain raises the pressure; it
 * is never the sole cause.
 */
function considerSeparation(world: World, tick: Tick): void {
  for (const [key, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'spouse') continue
    if (relationship.strength > DIVORCE_STRENGTH_THRESHOLD) continue

    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue

    const bothOutOfWork = !world.employment.has(a.id) && !world.employment.has(b.id)
    const resilience = Math.floor((a.traits.resilience + b.traits.resilience) / 2)

    // Resilient couples hold on longer. Strain makes separation likelier, never
    // certain — and a marriage must have genuinely weakened first, so this can
    // never fire on a couple who are doing fine.
    const pressure =
      (DIVORCE_STRENGTH_THRESHOLD - relationship.strength) +
      (bothOutOfWork ? 120 : 0) -
      Math.floor(resilience / 14)
    if (pressure <= 0) continue

    const rng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 303)
    if (!rng.chance(pressure, 9_000)) continue

    world.relationships.set(key, {
      ...relationship,
      type: 'former-spouse',
      typeSinceTick: tick,
      endedAtTick: tick,
    })

    recordEvent(world, tick, {
      type: 'divorced',
      subjectId: relationship.a,
      otherId: relationship.b,
    })

    const inputs = [
      factor('drifted-apart', 1000 - relationship.strength, relationship.b),
      factor('years-together', tick - relationship.formedAtTick),
    ]
    if (bothOutOfWork) inputs.push(factor('financial-strain', 400))

    recordDecision(world, tick, {
      subjectId: relationship.a,
      decision: 'separation',
      significance: 'defining',
      inputs,
      chosen: 'separated',
      rejected: ['to stay together'],
      streamId: Stream.Relationships,
    })

    splitHousehold(world, tick, relationship.a, relationship.b)
  }
}

/**
 * One spouse leaves the shared home. Children stay where they are — the model
 * has no custody system, and inventing one here would be a bigger claim than
 * the simulation can support.
 */
function splitHousehold(world: World, tick: Tick, aId: EntityId, bId: EntityId): void {
  const a = world.people.get(aId)
  const b = world.people.get(bId)
  if (!a || !b) return
  if (a.householdId === null || a.householdId !== b.householdId) return

  const household = world.households.get(a.householdId)
  if (!household) return

  // The person with fewer children in the household moves out.
  const childrenOfA = household.memberIds.filter((id) =>
    world.people.get(id)?.parentIds.includes(aId),
  ).length
  const childrenOfB = household.memberIds.filter((id) =>
    world.people.get(id)?.parentIds.includes(bId),
  ).length
  const leaverId = childrenOfA <= childrenOfB ? aId : bId
  const leaver = world.people.get(leaverId)
  if (!leaver) return

  const neighbourhoods: { id: EntityId }[] = []
  for (const id of world.town.placeIds) {
    const place = world.places.get(id)
    if (place && place.kind === 'neighbourhood') neighbourhoods.push({ id: place.id })
  }
  if (neighbourhoods.length === 0) return

  const rng = openStream(world.seed, Stream.LifeEventTiming, leaverId, tick + 404)
  const destination = rng.pick(neighbourhoods)

  const newHouseholdId = allocate(world)
  world.households.set(household.id, {
    ...household,
    memberIds: household.memberIds.filter((id) => id !== leaverId),
  })
  world.households.set(newHouseholdId, {
    id: newHouseholdId,
    placeId: destination.id,
    memberIds: [leaverId],
    formedTick: tick,
    dissolvedTick: null,
  })
  world.people.set(leaverId, { ...leaver, householdId: newHouseholdId })

  recordEvent(world, tick, {
    type: 'moved-house',
    subjectId: leaverId,
    placeId: destination.id,
  })
}

function allocate(world: World): EntityId {
  const id = world.nextEntityId as EntityId
  world.nextEntityId += 1
  return id
}

/** Called by the mortality system so a death ends a marriage properly. */
export function endRelationshipsOnDeath(world: World, tick: Tick, personId: EntityId): void {
  for (const [key, relationship] of sortedRelationships(world)) {
    if (relationship.a !== personId && relationship.b !== personId) continue

    if (relationship.type === 'spouse') {
      // A widow is not a divorcee. The tie becomes history, and the surviving
      // spouse gets an event of their own.
      world.relationships.set(key, {
        ...relationship,
        type: 'former-spouse',
        typeSinceTick: tick,
        endedAtTick: tick,
      })
      recordEvent(world, tick, {
        type: 'widowed',
        subjectId: other(relationship, personId),
        otherId: personId,
      })
      continue
    }

    if (relationship.type === 'former-spouse') continue // history is kept
    world.relationships.delete(key)
  }
}
