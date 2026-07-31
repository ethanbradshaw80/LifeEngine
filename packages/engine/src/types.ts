/**
 * The domain model.
 *
 * Ownership follows docs/DOMAIN_MAP.md §2: every field has exactly one owning
 * domain, and only that domain writes it. That is why employment, education,
 * and friendships live in their own maps on the World rather than as fields on
 * Person — if two systems could both write a person's wage, they would
 * eventually disagree and there would be no principled way to say which copy
 * is right.
 *
 * All quantities are integers. Traits use a 0-1000 scale rather than 0.0-1.0,
 * and money is integer cents (ADR-0008). Floating point never enters
 * authoritative state.
 */

import type { EntityId, Money, Seed, Tick } from '@life-engine/shared'

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female'

/**
 * Simulation detail level. Only 'deep' exists in Milestone 1, but the field is
 * present from the first save ever written so the tier system can be added
 * later without a save migration (docs/SIMULATION_LEVELS.md §9).
 */
export type Tier = 'deep'

/** Stable personality traits, 0-1000. Set at birth, essentially fixed. */
export interface Traits {
  /** Drives friendship formation and household partnering. */
  readonly sociability: number
  /** Drives school performance and job retention. */
  readonly diligence: number
  /** Drives job seeking and moving for opportunity. */
  readonly ambition: number
  /** Buffers against setbacks; slows decline after failure. */
  readonly resilience: number
  /** Drives further education. */
  readonly curiosity: number
  /** Baseline constitution. Affects mortality, not illness — there is no
   *  health system in Milestone 1 beyond alive/dead. */
  readonly vitality: number
}

export interface Person {
  readonly id: EntityId
  readonly givenName: string
  readonly familyName: string
  readonly sex: Sex
  readonly birthTick: Tick
  /** Null while alive. Set once, never cleared. */
  readonly deathTick: Tick | null
  readonly causeOfDeath: string | null
  readonly tier: Tier
  readonly traits: Traits
  readonly householdId: EntityId | null
  /** Empty for the founding generation, whose parents are outside the sim. */
  readonly parentIds: readonly EntityId[]
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export type PlaceKind = 'neighbourhood' | 'school' | 'workplace' | 'civic'

export interface Place {
  readonly id: EntityId
  readonly name: string
  readonly kind: PlaceKind
  /** Relative desirability, 0-1000. Drives moving decisions. */
  readonly desirability: number
}

export interface Town {
  readonly name: string
  readonly placeIds: readonly EntityId[]
}

// ---------------------------------------------------------------------------
// Households
// ---------------------------------------------------------------------------

export interface Household {
  readonly id: EntityId
  readonly placeId: EntityId
  readonly memberIds: readonly EntityId[]
  readonly formedTick: Tick
  /** Null while active. */
  readonly dissolvedTick: Tick | null
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export type EducationLevel = 'none' | 'primary' | 'secondary' | 'trade' | 'college'

export interface EducationRecord {
  readonly personId: EntityId
  readonly level: EducationLevel
  /** Null when not currently enrolled. */
  readonly enrolledIn: EducationLevel | null
  readonly enrolledAtTick: Tick | null
  readonly completesAtTick: Tick | null
  /** 0-1000. Influences job quality. */
  readonly attainment: number
}

// ---------------------------------------------------------------------------
// Employment
// ---------------------------------------------------------------------------

export interface Occupation {
  readonly id: string
  readonly title: string
  readonly requires: EducationLevel
  readonly minMonthlyPay: Money
  readonly maxMonthlyPay: Money
}

export interface EmploymentRecord {
  readonly personId: EntityId
  readonly occupationId: string
  readonly workplaceId: EntityId
  readonly monthlyPay: Money
  readonly startedAtTick: Tick
  /** 0-1000, drifts with diligence. */
  readonly performance: number
}

// ---------------------------------------------------------------------------
// Relationships
//
// The social graph. Milestone 5 replaced Milestone 1's placeholder friendship
// model with typed edges that can change type over a lifetime.
//
// KINSHIP IS NOT STORED HERE. Parent and child links live on Person.parentIds,
// because they are facts about a person rather than a relationship that can
// form, decay or end. Storing them twice would create two writers for the same
// truth (DOMAIN_MAP.md §1).
// ---------------------------------------------------------------------------

export type RelationshipType = 'friend' | 'courting' | 'spouse' | 'former-spouse'

export interface Relationship {
  readonly a: EntityId
  readonly b: EntityId
  readonly type: RelationshipType
  /** 0-1000. Decays without contact, is reinforced by shared circumstances. */
  readonly strength: number
  /** When these two first connected, whatever the type was then. */
  readonly formedAtTick: Tick
  /** When the CURRENT type began — the wedding date for a spouse. */
  readonly typeSinceTick: Tick
  /** Set when a marriage ends. A former spouse is history, not a live tie. */
  readonly endedAtTick: Tick | null
}

/** Stable key for an unordered pair. Always lower id first, so lookup is symmetric. */
export function relationshipKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/** @deprecated Milestone 1 name, kept so existing call sites keep compiling. */
export const friendshipKey = relationshipKey

// ---------------------------------------------------------------------------
// Events — WHAT happened
// ---------------------------------------------------------------------------

export type EventType =
  | 'born'
  | 'died'
  | 'started-school'
  | 'finished-school'
  | 'hired'
  | 'left-job'
  | 'befriended'
  | 'friendship-lapsed'
  | 'started-courting'
  | 'courtship-ended'
  | 'married'
  | 'divorced'
  | 'widowed'
  | 'left-home'
  | 'moved-in-together'
  | 'moved-house'
  | 'had-child'

export interface WorldEvent {
  readonly id: number
  readonly tick: Tick
  readonly type: EventType
  readonly subjectId: EntityId
  /** The other person involved, where there is one. */
  readonly otherId: EntityId | null
  readonly placeId: EntityId | null
  /** Short factual detail, e.g. an occupation title. Never a full sentence —
   *  prose is generated at render time, not stored. */
  readonly detail: string | null
}

// ---------------------------------------------------------------------------
// Causal records — WHY a decision was made
//
// See docs/CAUSAL_RECORDS.md. Inputs store factor identifiers and integer
// weights, never prose: storing sentences would double the data and freeze the
// phrasing. The explanation is generated on demand from these facts.
// ---------------------------------------------------------------------------

export type DecisionType =
  | 'employment-change'
  | 'household-formation'
  | 'move'
  | 'death'
  | 'courtship'
  | 'marriage'
  | 'separation'

/** Drives retention. Assigned when the record is created. */
export type Significance = 'notable' | 'major' | 'defining'

export type FactorId =
  | 'qualified-for-role'
  | 'higher-pay'
  | 'ambition'
  | 'poor-performance'
  | 'no-local-vacancy'
  | 'reached-adulthood'
  | 'has-income'
  | 'close-friendship'
  | 'household-crowded'
  | 'better-neighbourhood'
  | 'can-afford-move'
  | 'old-age'
  | 'frailty'
  | 'accident'
  | 'compatible-personality'
  | 'shared-home'
  | 'shared-workplace'
  | 'lived-nearby'
  | 'years-together'
  | 'strong-attachment'
  | 'drifted-apart'
  | 'financial-strain'
  | 'lost-work'
  | 'wanted-family'

export interface CausalFactor {
  readonly factor: FactorId
  /** Relative influence. Rendering sorts by this, descending. */
  readonly weight: number
  readonly referencedEntityId: EntityId | null
}

export interface CausalRecord {
  readonly id: number
  readonly tick: Tick
  readonly subjectId: EntityId
  readonly decision: DecisionType
  readonly significance: Significance
  readonly inputs: readonly CausalFactor[]
  readonly chosen: string
  /** Recorded for major and defining decisions only. */
  readonly rejected: readonly string[]
  /** Which random stream resolved this, so it can be re-derived. */
  readonly streamId: number
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export interface World {
  readonly seed: Seed
  readonly tick: Tick
  /** Monotonic. Never reused, even after an entity dies. */
  nextEntityId: number
  nextEventId: number
  nextCausalRecordId: number

  readonly town: Town
  readonly places: Map<EntityId, Place>
  readonly people: Map<EntityId, Person>
  readonly households: Map<EntityId, Household>
  readonly education: Map<EntityId, EducationRecord>
  readonly employment: Map<EntityId, EmploymentRecord>
  /** Keyed by relationshipKey(). Map iteration is insertion-ordered and
   *  therefore deterministic — see docs/DETERMINISM.md §3. */
  readonly relationships: Map<string, Relationship>

  readonly events: WorldEvent[]
  readonly causalRecords: CausalRecord[]
}
