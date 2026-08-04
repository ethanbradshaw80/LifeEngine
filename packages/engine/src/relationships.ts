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

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { raisePending } from './player.js'
import { isHomeless, inArrears } from './finances.js'
import { openStream, Stream, type Rng } from './rng.js'
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
// Widened 12 → 16 at D2: thin cohorts in a small town locked out otherwise.
const MAX_AGE_GAP = 16

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

/** Among this person's matching edges, the one first in (a, b) order — the
 *  same edge a sorted scan would find first, without sorting. These queries
 *  run per person inside per-tick loops, and re-sorting the whole graph on
 *  every call was 86% of tick time on a grown town (see the profile note in
 *  vitest.config.ts). In the impossible-but-guard-worthy case of two matching
 *  edges, the (a, b) tie-break keeps the answer deterministic. */
function firstEdgeWith(
  world: World,
  personId: EntityId,
  matches: (type: Relationship['type']) => boolean,
): Relationship | null {
  let best: Relationship | null = null
  for (const relationship of world.relationships.values()) {
    if (!matches(relationship.type)) continue
    if (relationship.a !== personId && relationship.b !== personId) continue
    if (
      best === null ||
      relationship.a < best.a ||
      (relationship.a === best.a && relationship.b < best.b)
    ) {
      best = relationship
    }
  }
  return best
}

/** Current spouse, if any. Former spouses are history and are not returned. */
export function spouseOf(world: World, personId: EntityId): EntityId | null {
  const edge = firstEdgeWith(world, personId, (type) => type === 'spouse')
  return edge === null ? null : other(edge, personId)
}

/** Spouse or courting partner — whoever a person is currently paired with. */
export function partnerOf(world: World, personId: EntityId): EntityId | null {
  const edge = firstEdgeWith(world, personId, (type) => type === 'spouse' || type === 'courting')
  return edge === null ? null : other(edge, personId)
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

/**
 * Work for STRAIN purposes: a wage or a uniform (P2 military review — the
 * model counted a serving spouse as jobless while the stakes said
 * otherwise; text and model must agree). Reads world.service directly:
 * importing isServing would close the relationships→service→player→
 * relationships loop, and service.ts stays the map's single WRITER either
 * way.
 */
function hasWork(world: World, personId: EntityId): boolean {
  if (world.employment.has(personId)) return true
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick === null
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
function couldCourt(
  world: World,
  a: Person,
  b: Person,
  tick: Tick,
  partners?: ReadonlyMap<EntityId, EntityId>,
): boolean {
  if (a.sex === b.sex) return false // simplification — see the note in §Births
  const aPartnered = partners !== undefined ? partners.has(a.id) : partnerOf(world, a.id) !== null
  const bPartnered = partners !== undefined ? partners.has(b.id) : partnerOf(world, b.id) !== null
  if (aPartnered || bPartnered) return false

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
  holdSocials(world, tick, living)
  advanceCourtships(world, tick)
  considerMarriage(world, tick)
  settleFamilyPlans(world, tick)
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
    // D2: a courtship is TENDED — the pair see each other on purpose, roof
    // or no roof. Without this, courting couples who lived apart decayed
    // below the marriage bar and lingered courting forever (courtships have
    // no ending path), locking both partners out of everything.
    if (relationship.type === 'courting') change += 9
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
        const idle = (hasWork(world, a.id) ? 0 : 1) + (hasWork(world, b.id) ? 0 : 1)
        change -= idle * 3
      }
      // Money trouble is its own strain, distinct from joblessness: a
      // household can be employed and still drowning, and that is the month
      // that tells (M-MONEY; the record's 'financial-strain' factor now has
      // a real ledger behind it).
      if (inArrears(world, a.householdId)) change -= 3
      // M-SAFETY §3. Losing the roof is harder on a marriage than arrears.
      if (isHomeless(world, a.id)) change -= 5
    }

    // The years that held get their day (M-DEPTH3, courtship/marriage
    // texture): ten years married, then silver, then golden — deterministic
    // from the wedding date, in both feeds, worth a little strength because
    // a marked year genuinely is one.
    if (relationship.type === 'spouse') {
      const married = tick - relationship.typeSinceTick
      if (married === 120 || married === 300 || married === 600) {
        const which = married === 120 ? 'ten years' : married === 300 ? 'the silver' : 'the golden'
        recordEvent(world, tick, { type: 'anniversary', subjectId: relationship.a, otherId: relationship.b, detail: which })
        recordEvent(world, tick, { type: 'anniversary', subjectId: relationship.b, otherId: relationship.a, detail: which })
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
      familySizeAspiration: null,
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

// ---------------------------------------------------------------------------
// D2 — the town must live (DEMOGRAPHICS_AUDIT.md §D2)
//
// Measured before this existed: courtships ran 1-2 per DECADE because pairing
// was entirely passive — a friendship had to drift over the courtship
// threshold by proximity luck. Nobody ever LOOKED. Seeking models the
// looking: single adults who want a family get introduced to eligible
// singles at the town's occasions, at need-driven rates. Selection stays
// exactly as picky (couldCourt + the compatibility draw in
// advanceCourtships); only the FLOW of eligible meetings rises. No birth
// rate is touched here — ADR-0019 forbids it.
// ---------------------------------------------------------------------------

/** Months the widowed and divorced heal before looking again. */
const SEEKING_RECOVERY_MONTHS = 18
/** Monthly meeting roll denominator — intent (≈25-270) over this. */
const MEETING_DENOM = 1_300
const VENUES = [
  'the harvest dance',
  'the church social',
  'a wedding party',
  'the county fair',
  'the grange hall',
  "a friend's kitchen table",
]

/**
 * How much this person is looking for a partner right now, 0-1000-ish.
 * Derived every tick from circumstance — no stored state, so no schema.
 * Zero while partnered, outside 18-52, or still healing from a loss.
 */
export function seekingIntent(
  world: World,
  person: Person,
  tick: Tick,
  partners?: ReadonlyMap<EntityId, EntityId>,
): number {
  if (person.deathTick !== null) return 0
  const partnered = partners !== undefined ? partners.has(person.id) : partnerOf(world, person.id) !== null
  if (partnered) return 0
  const age = ageAt(person.birthTick, tick)
  if (age < ADULT_AGE || age > 52) return 0

  // The bereaved and divorced heal first. Latest ended marriage wins;
  // max() over unsorted iteration is order-independent.
  let lastEnded: Tick | null = null
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'former-spouse') continue
    if (relationship.a !== person.id && relationship.b !== person.id) continue
    if (relationship.endedAtTick === null) continue
    if (lastEnded === null || relationship.endedAtTick > lastEnded) lastEnded = relationship.endedAtTick
  }
  if (lastEnded !== null && tick - lastEnded < SEEKING_RECOVERY_MONTHS) return 0

  const byAge = age <= 20 ? 15 : age <= 25 ? 110 : age <= 33 ? 220 : age <= 45 ? 180 : 90
  return byAge + Math.floor(person.traits.sociability / 20)
}

/**
 * The meeting moments. A seeker's monthly roll may land them an
 * introduction to another seeker they could actually court — a new tie
 * starts warm (they met ON PURPOSE), an existing one warms further. The
 * courtship itself must still pass the same machinery as ever.
 */
function holdSocials(world: World, tick: Tick, living: readonly Person[]): void {
  const partners = currentPartners(world)
  for (const person of living) {
    const intent = seekingIntent(world, person, tick, partners)
    if (intent <= 0) continue
    const rng = openStream(world.seed, Stream.Relationships, person.id, tick + 505)
    if (!rng.chance(intent, MEETING_DENOM)) continue

    const candidates: Person[] = []
    const weights: number[] = []
    for (const other of living) {
      if (other.id === person.id) continue
      if (seekingIntent(world, other, tick, partners) <= 0) continue
      if (!couldCourt(world, person, other, tick, partners)) continue
      const key = relationshipKey(person.id, other.id)
      const existing = world.relationships.get(key)
      if (existing !== undefined && existing.type !== 'friend') continue // no rekindling exes in D2
      candidates.push(other)
      weights.push(1 + compatibility(person, other))
    }
    if (candidates.length === 0) continue

    const chosen = rng.pickWeighted(candidates, weights)
    const venue = rng.pick(VENUES)
    const key = relationshipKey(person.id, chosen.id)
    const existing = world.relationships.get(key)
    if (existing !== undefined) {
      world.relationships.set(key, {
        ...existing,
        strength: Math.min(1000, existing.strength + 90 + rng.nextInt(0, 60)),
      })
    } else {
      // Romance may crowd a roster a little past the passive-friendship
      // cap, but not without limit (review S1).
      let friendEdges = 0
      for (const relationship of world.relationships.values()) {
        if (relationship.type !== 'friend') continue
        if (relationship.a === person.id || relationship.b === person.id) friendEdges++
      }
      if (friendEdges >= MAX_FRIENDS + 2) continue
      setRelationship(world, {
        a: person.id < chosen.id ? person.id : chosen.id,
        b: person.id < chosen.id ? chosen.id : person.id,
        type: 'friend',
        strength: Math.min(1000, 430 + Math.floor(compatibility(person, chosen) / 10) + rng.nextInt(0, 60)),
        formedAtTick: tick,
        typeSinceTick: tick,
        endedAtTick: null,
        familySizeAspiration: null,
      })
    }
    recordEvent(world, tick, {
      type: 'was-introduced',
      subjectId: person.id,
      otherId: chosen.id,
      detail: venue,
    })
  }
}

/** Living children of one person — parentage is on Person, never the graph. */
export function livingChildrenOf(world: World, personId: EntityId): number {
  let count = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (person.parentIds.includes(personId)) count++
  }
  return count
}

/** 1-5 hoped-for children (mean ≈ 2.45, tuned against the D1 targets);
 *  never fewer than the children already living. Small families are real
 *  families — the first draft floored at 2 and the town exploded. */
function decideFamilyAspiration(rng: Rng, existingChildren: number): number {
  let hoped = 1
  if (rng.chance(780, 1_000)) hoped += 1
  if (rng.chance(470, 1_000)) hoped += 1
  if (rng.chance(210, 1_000)) hoped += 1
  if (rng.chance(60, 1_000)) hoped += 1
  return Math.max(hoped, existingChildren)
}

/**
 * Family plans outside the wedding day. Two cases, one ordered pass:
 * marriages that predate the model (founding couples; migrated saves)
 * decide their plan on the first tick it can be decided — recorded then,
 * honestly, never backdated, and ONLY while the woman is inside reach of
 * the window (an elderly couple decides nothing; their aspiration stays
 * null and the record stays silent — review S3). And when the window
 * closes on an unmet hope, that fact goes on the record: "the children
 * never came" is the one Why? a generational game must not leave silent
 * (review M2).
 */
function settleFamilyPlans(world: World, tick: Tick): void {
  for (const [key, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'spouse') continue
    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue
    const mother = a.sex === 'female' ? a : b
    const motherAge = ageAt(mother.birthTick, tick)

    if (relationship.familySizeAspiration === null) {
      if (motherAge > 45) continue
      const rng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 707)
      const aspiration = decideFamilyAspiration(rng, livingChildrenOf(world, mother.id))
      world.relationships.set(key, { ...relationship, familySizeAspiration: aspiration })
      recordDecision(world, tick, {
        subjectId: relationship.a,
        decision: 'family',
        significance: 'notable',
        inputs: [factor('wants-a-family', 300 + aspiration * 100, relationship.b)],
        chosen: `hoped to raise ${aspiration} children`,
        rejected: [],
        streamId: Stream.Relationships,
      })
      continue
    }

    // The birthday month that ends the window, exactly once.
    if (
      motherAge === 43 &&
      ageAt(mother.birthTick, (tick - 1) as Tick) === 42 &&
      livingChildrenOf(world, mother.id) === 0
    ) {
      recordDecision(world, tick, {
        subjectId: relationship.a,
        decision: 'family',
        significance: 'notable',
        inputs: [factor('wants-a-family', 200, relationship.b)],
        chosen: 'the children never came',
        rejected: [],
        streamId: Stream.Relationships,
      })
    }
  }
}

/**
 * Hardship can shrink the plan — once, on the record (ADR-0019: stopping
 * is a decision, not a silent rate). Called by the birth system when a
 * deep-arrears month would otherwise just silently skip; relationships
 * stays the single writer of the edge.
 */
export function stopFamilyEarly(world: World, tick: Tick, motherId: EntityId): void {
  const partnerId = partnerOf(world, motherId)
  if (partnerId === null) return
  const key = relationshipKey(motherId, partnerId)
  const tie = world.relationships.get(key)
  if (!tie || tie.type !== 'spouse' || tie.familySizeAspiration === null) return
  // The family they HAVE is the family they stop at — and a couple with
  // no children yet does not give up hoping, however hard the year
  // (money postpones the first child through the hazard; it does not
  // cancel it). Recorded only when the cut actually binds (review S4).
  const settled = livingChildrenOf(world, motherId)
  if (settled === 0) return
  if (tie.familySizeAspiration <= settled) return

  world.relationships.set(key, { ...tie, familySizeAspiration: settled })
  recordDecision(world, tick, {
    subjectId: motherId,
    decision: 'family',
    significance: 'notable',
    inputs: [factor('in-arrears', 700), factor('wants-a-family', 250)],
    chosen: 'stopped at the family the money could feed',
    rejected: ['to keep trying'],
    streamId: Stream.Relationships,
  })
}

/** Current partner per person, one O(edges) pass — holdSocials' hot loop
 *  reads this instead of re-sorting the whole graph per lookup (review S2). */
function currentPartners(world: World): Map<EntityId, EntityId> {
  const partners = new Map<EntityId, EntityId>()
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'courting' && relationship.type !== 'spouse') continue
    partners.set(relationship.a, relationship.b)
    partners.set(relationship.b, relationship.a)
  }
  return partners
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

/**
 * The record's subject: the player when the player is IN this pair — they
 * made or answered the choice — the lower id otherwise. The P1 review S1
 * rule, applied to every shared transition (P2 architecture M1: a player
 * verb must not write "own-choice" into the PARTNER's file). Event and
 * record subjects stay aligned so decisionForEvent keeps resolving.
 */
function subjectOf(world: World, relationship: Relationship): EntityId {
  const playerId = world.player.personId
  return playerId !== null && (playerId === relationship.a || playerId === relationship.b)
    ? playerId
    : relationship.a
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
  const subjectId = subjectOf(world, relationship)
  const otherId = other(relationship, subjectId)

  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'courting',
    typeSinceTick: tick,
  })

  recordEvent(world, tick, {
    type: 'started-courting',
    subjectId,
    otherId,
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'courtship',
    significance: 'major',
    inputs: [
      ...extraInputs,
      factor('compatible-personality', match, otherId),
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

    // D2: the appetite grows with the courtship instead of plateauing at
    // 90 — measured median marriage age was 38-44 because couples courted
    // for a decade. The family window adds its own pull.
    const woman = a.sex === 'female' ? a : b
    const womanAge = ageAt(woman.birthTick, tick)
    const familyPull = womanAge >= 22 && womanAge <= 40 ? 70 : 0
    const appetite = 60 + earners * 45 + Math.min(200, monthsTogether * 5) + familyPull
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

  // D2: the couple sizes the family they hope for AT the wedding — decided
  // once, recorded, and read by the birth system from then on.
  const mother = a.sex === 'female' ? a : b
  const planRng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 707)
  const aspiration = decideFamilyAspiration(planRng, livingChildrenOf(world, mother.id))

  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'spouse',
    typeSinceTick: tick,
    strength: Math.min(1000, relationship.strength + 40),
    familySizeAspiration: aspiration,
  })

  const subjectId = subjectOf(world, relationship)
  const otherId = other(relationship, subjectId)
  recordEvent(world, tick, {
    type: 'married',
    subjectId,
    otherId,
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'family',
    significance: 'notable',
    inputs: [factor('wants-a-family', 300 + aspiration * 100, otherId)],
    chosen: `hoped to raise ${aspiration} children`,
    rejected: [],
    streamId: Stream.Relationships,
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'marriage',
    significance: 'defining',
    inputs: [
      ...extraInputs,
      factor('strong-attachment', relationship.strength, otherId),
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
  for (const [, relationship] of sortedRelationships(world)) {
    if (relationship.type !== 'spouse') continue
    if (relationship.strength > DIVORCE_STRENGTH_THRESHOLD) continue

    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.deathTick !== null || b.deathTick !== null) continue

    const bothOutOfWork = !hasWork(world, a.id) && !hasWork(world, b.id)
    const moneyTrouble = inArrears(world, a.householdId)
    const resilience = Math.floor((a.traits.resilience + b.traits.resilience) / 2)

    // Resilient couples hold on longer. Strain makes separation likelier, never
    // certain — and a marriage must have genuinely weakened first, so this can
    // never fire on a couple who are doing fine.
    const pressure =
      (DIVORCE_STRENGTH_THRESHOLD - relationship.strength) +
      (bothOutOfWork ? 120 : 0) +
      (moneyTrouble ? 80 : 0) -
      Math.floor(resilience / 14)
    if (pressure <= 0) continue

    const rng = openStream(world.seed, Stream.Relationships, relationship.a, tick + 303)
    if (!rng.chance(pressure, 9_000)) continue

    // The breaking point is simulated for everyone; the player answers it
    // themselves. Choosing to stay is a real act, not a dismissal — see
    // reconcile() — so a played marriage can be fought for in a way an NPC
    // marriage cannot. That asymmetry is the point of playing.
    const playerId = world.player.personId
    if (playerId !== null && (playerId === relationship.a || playerId === relationship.b)) {
      // ONLY IF IT LANDED — same reason as the house move. A marriage at its
      // breaking point neither broke nor asked for every month a played
      // character was held, which is a marriage frozen by a bug rather than
      // by anything happening in it.
      const asked = raisePending(world, {
        tick,
        kind: 'separation',
        personId: playerId,
        otherId: playerId === relationship.a ? relationship.b : relationship.a,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['stay', 'separate'],
      })
      if (asked) continue
    }

    performSeparation(world, tick, relationship, [])
  }
}

/** One separation implementation for both the automatic path and player choices. */
export function performSeparation(
  world: World,
  tick: Tick,
  relationship: Relationship,
  extraInputs: readonly CausalFactor[],
): void {
  const a = world.people.get(relationship.a)
  const b = world.people.get(relationship.b)
  if (!a || !b) return
  const bothOutOfWork = !hasWork(world, a.id) && !hasWork(world, b.id)
  const moneyTrouble = inArrears(world, a.householdId)
  const subjectId = subjectOf(world, relationship)
  const otherId = other(relationship, subjectId)

  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'former-spouse',
    typeSinceTick: tick,
    endedAtTick: tick,
  })

  recordEvent(world, tick, {
    type: 'divorced',
    subjectId,
    otherId,
  })

  const inputs = [
    ...extraInputs,
    factor('drifted-apart', 1000 - relationship.strength, otherId),
    factor('years-together', tick - relationship.formedAtTick),
  ]
  if (bothOutOfWork || moneyTrouble) inputs.push(factor('financial-strain', moneyTrouble ? 600 : 400))

  recordDecision(world, tick, {
    subjectId,
    decision: 'separation',
    significance: 'defining',
    inputs,
    chosen: 'separated',
    rejected: ['to stay together'],
    streamId: Stream.Relationships,
  })

  splitHousehold(world, tick, relationship.a, relationship.b)
}

/**
 * The player chose to stay. Staying is modelled, not merely deferred: the
 * attempt itself restores some strength, the way a couple who decide to try
 * again genuinely are closer for a while. The strain model still applies —
 * a badly-matched marriage will reach this point again.
 */
export function reconcile(
  world: World,
  tick: Tick,
  relationship: Relationship,
): void {
  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    strength: Math.min(1000, relationship.strength + 160),
  })
  // The subject is whichever spouse made the choice (P1 review S1; the
  // shared subjectOf rule).
  const subjectId = subjectOf(world, relationship)
  // P1: the fought-for marriage shows in the feed, not only the record.
  recordEvent(world, tick, {
    type: 'reconciled',
    subjectId,
    otherId: subjectId === relationship.a ? relationship.b : relationship.a,
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'separation',
    significance: 'defining',
    inputs: [
      factor('own-choice', 1000),
      factor('years-together', tick - relationship.formedAtTick),
    ],
    chosen: 'chose to stay and try again',
    rejected: ['to separate'],
    streamId: Stream.Relationships,
  })
}

// ---------------------------------------------------------------------------
// P2 — the verbs' shared functions. Player-initiated moments resolve through
// these; each is written so a future NPC caller gets identical behaviour.
// This file stays the single writer of world.relationships.
// ---------------------------------------------------------------------------

/**
 * Why a courtship between these two cannot begin — or null when it can.
 * The same gates couldCourt applies, plus the tie-state gates the automatic
 * path (advanceCourtships) checks, each with the reason in words. The verb
 * refuses honestly; the UI never has to guess.
 */
export function courtshipBar(
  world: World,
  personId: EntityId,
  otherId: EntityId,
  tick: Tick,
): string | null {
  const person = world.people.get(personId)
  const other = world.people.get(otherId)
  if (!person || person.deathTick !== null) return 'Nobody is there to ask.'
  if (!other || other.deathTick !== null) return 'They are gone.'
  const name = other.givenName

  const tie = relationshipBetween(world, personId, otherId)
  if (!tie || tie.type === 'former-spouse') {
    return tie ? 'Too much history stands between you.' : `You and ${name} are not friends.`
  }
  if (tie.type === 'courting' || tie.type === 'spouse') return `You and ${name} are already together.`
  if (tie.strength < COURTSHIP_MIN_STRENGTH) return 'The friendship is not that close yet.'

  if (person.sex === other.sex) return 'Dear friends, and that is the shape of it.' // simplification — see §Births
  if (partnerOf(world, personId) !== null) return 'You are already spoken for.'
  if (partnerOf(world, otherId) !== null) return `${name} is spoken for.`

  const ageA = ageAt(person.birthTick, tick)
  const ageB = ageAt(other.birthTick, tick)
  if (ageA < ADULT_AGE || ageB < ADULT_AGE) return 'Not yet grown.'
  if (Math.abs(ageA - ageB) > MAX_AGE_GAP) return 'The years between you are too many.'

  if (
    person.parentIds.includes(otherId) ||
    other.parentIds.includes(personId) ||
    person.parentIds.some((id) => other.parentIds.includes(id))
  ) {
    return 'Family is family.'
  }
  return null
}

/**
 * Why a proposal cannot be made today — or null when it can. The same bar
 * considerMarriage holds the automatic path to: a real courtship, old enough,
 * strong enough. The appetite roll is NPC timing, not consent — a player who
 * clears the bar is not additionally dice-rolled for a yes.
 */
export function proposalBar(world: World, personId: EntityId, tick: Tick): string | null {
  const partnerId = partnerOf(world, personId)
  if (partnerId === null) return 'There is nobody to ask.'
  const tie = relationshipBetween(world, personId, partnerId)
  if (!tie || tie.type !== 'courting') return 'You are not courting.'
  const months = tick - tie.typeSinceTick
  if (months < MARRIAGE_MIN_COURTSHIP_MONTHS) {
    return `The courtship is ${String(months)} month${months === 1 ? '' : 's'} old. Not yet.`
  }
  if (tie.strength < MARRIAGE_MIN_STRENGTH) return 'What is between you is not strong enough to build on yet.'
  return null
}

/**
 * A courtship ends by choice. The tie survives as a distant friendship — set
 * just above the lapse line, so it either mends with tending or quietly
 * lapses through ordinary decay. Emits the 'courtship-ended' event that has
 * waited in the schema since M5 with nothing to emit it.
 */
export function performCourtshipEnd(
  world: World,
  tick: Tick,
  relationship: Relationship,
  initiatorId: EntityId,
  extraInputs: readonly CausalFactor[],
): void {
  if (relationship.type !== 'courting') return
  const otherId = other(relationship, initiatorId)
  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    type: 'friend',
    typeSinceTick: tick,
    // Between the lapse line and the courtship bar, whatever it was before:
    // a strong courtship ended must not bounce straight back into the
    // courtship question next month (review S3), and a weak one should
    // still be free to quietly lapse through ordinary decay.
    strength: Math.max(
      FRIENDSHIP_END_STRENGTH + 20,
      Math.min(COURTSHIP_MIN_STRENGTH - 60, relationship.strength - 240),
    ),
  })
  recordEvent(world, tick, {
    type: 'courtship-ended',
    subjectId: initiatorId,
    otherId,
  })
  recordDecision(world, tick, {
    subjectId: initiatorId,
    decision: 'courtship',
    significance: 'major',
    inputs: [
      ...extraInputs,
      factor('years-together', tick - relationship.typeSinceTick),
    ],
    chosen: 'ended the courtship',
    rejected: ['to keep courting'],
    streamId: Stream.Relationships,
  })
}

/**
 * Deliberate time given to the marriage. A smaller mend than reconcile()'s —
 * that one is the brink stepped back from; this is an ordinary month's
 * choosing — and the strain model keeps running underneath.
 */
export function tendMarriage(world: World, tick: Tick, relationship: Relationship): void {
  if (relationship.type !== 'spouse') return
  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    strength: Math.min(1000, relationship.strength + 60),
  })
  const subjectId = subjectOf(world, relationship)
  recordEvent(world, tick, {
    type: 'tended-marriage',
    subjectId,
    otherId: subjectId === relationship.a ? relationship.b : relationship.a,
  })
  recordDecision(world, tick, {
    subjectId,
    decision: 'marriage',
    significance: 'notable',
    inputs: [factor('own-choice', 1000), factor('years-together', tick - relationship.formedAtTick)],
    chosen: 'made time for the marriage',
    rejected: ['to let the weeks pass'],
    streamId: Stream.Relationships,
  })
}

/**
 * An afternoon given to a friendship. Reinforcement the decay model respects;
 * no roll — showing up is not a gamble.
 */
export function strengthenFriendship(
  world: World,
  tick: Tick,
  relationship: Relationship,
  initiatorId: EntityId,
): void {
  if (relationship.type !== 'friend') return
  world.relationships.set(relationshipKey(relationship.a, relationship.b), {
    ...relationship,
    strength: Math.min(1000, relationship.strength + 40),
  })
  recordEvent(world, tick, {
    type: 'spent-time',
    subjectId: initiatorId,
    otherId: other(relationship, initiatorId),
  })
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
  // The pot splits evenly on separation — debts too, so leaving a failing
  // marriage does not leave one side holding the whole hole.
  const half = Math.floor(household.savings / 2) as Money
  world.households.set(household.id, {
    ...household,
    memberIds: household.memberIds.filter((id) => id !== leaverId),
    savings: (household.savings - half) as Money,
  })
  world.households.set(newHouseholdId, {
    id: newHouseholdId,
    placeId: destination.id,
    memberIds: [leaverId],
    formedTick: tick,
    dissolvedTick: null,
    savings: half,
    spendStance: null,
    homelessSinceTick: null,
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
