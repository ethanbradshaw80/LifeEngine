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
  /**
   * The household's money, in integer cents (ADR-0008). One pot per roof:
   * wages come in, rent and living costs go out, monthly, in the finances
   * system — the single writer of this field. Negative means arrears, which
   * has consequences; it is not clamped away.
   */
  readonly savings: Money
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
// Geopolitics (L4-M1)
//
// Nations are AGGREGATE entities: statistics with causal records, never
// containers of simulated people (LAYER4_PLAN §3). They take ids from the
// same allocator as everything else, so events and causal records about them
// flow through the existing machinery unchanged.
// ---------------------------------------------------------------------------

export interface Nation {
  readonly id: EntityId
  readonly name: string
  /** The nation the town lives in. Exactly one. */
  readonly isHomeland: boolean
  /** 0-1000 scales. Statistics, not personalities. */
  readonly strength: number
  readonly economy: number
  readonly stability: number
  /** Alliance bloc index, or null for the non-aligned. */
  readonly bloc: number | null
}

/** L4-M1's escalation subset of the foundation §4 ladder. */
export type GeoState = 'peace' | 'tension' | 'sanctions' | 'skirmish' | 'war' | 'ceasefire'

export type WarPhase = 'opening' | 'attrition' | 'offensive' | 'stalemate'

export interface GeoRelation {
  readonly a: EntityId
  readonly b: EntityId
  readonly state: GeoState
  readonly sinceTick: Tick
  /** Non-null only while at war. */
  readonly warPhase: WarPhase | null
  /** Aggregate war dead, per side — the entire foreign population model. */
  readonly casualtiesA: number
  readonly casualtiesB: number
}

// ---------------------------------------------------------------------------
// The player
//
// The player is one person inside the simulation, not a special entity. The
// person keeps their id, traits, relationships and records; the ONLY thing
// that changes is who answers their major decisions. When a system reaches a
// choice point for the player's person, it emits a PendingDecision and the
// clock halts instead of rolling (Law 5: "major events may pause progression
// for a player decision").
//
// Player choices are part of the deterministic record: same seed + same
// simulation version + same choice sequence ⇒ the same world, byte for byte.
// That is why every resolved choice is appended to `log` and serialized
// (docs/DETERMINISM.md §8 — a save is recoverable from seed + decisions).
// ---------------------------------------------------------------------------

export type PendingKind =
  /** At 18: college, trade school, or straight to work. */
  | 'education'
  /** A job offer — accept or decline. */
  | 'job-offer'
  /** Old enough, earning, still at home: move out or stay. */
  | 'move-out'
  /** A close friendship could become more. */
  | 'courtship'
  /** A courtship could become a marriage. */
  | 'marriage'
  /** The couple could start (or grow) a family. */
  | 'child'
  /** A better neighbourhood is affordable. */
  | 'move-house'
  /** Retirement age, still working: stop or carry on. */
  | 'retirement'
  /** The marriage has grown distant: separate, or try again. */
  | 'separation'

export interface PendingDecision {
  readonly id: number
  readonly tick: Tick
  readonly kind: PendingKind
  /** Always the player's person. */
  readonly personId: EntityId
  /** The other person involved, for courtship and marriage. */
  readonly otherId: EntityId | null
  readonly occupationId: string | null
  readonly workplaceId: EntityId | null
  readonly monthlyPay: Money | null
  /** Destination neighbourhood for a move. */
  readonly placeId: EntityId | null
  /** Valid answers, e.g. ['accept','decline'] or ['college','trade','work']. */
  readonly options: readonly string[]
}

export interface PlayerChoice {
  readonly decisionId: number
  readonly tick: Tick
  readonly kind: PendingKind
  readonly choice: string
}

export interface PlayerState {
  /** Null means nobody is being played — the world is a pure simulation. */
  personId: EntityId | null
  /** While non-null the clock is halted awaiting an answer. */
  pending: PendingDecision | null
  /** Every answered decision, in order. Part of the save. */
  readonly log: PlayerChoice[]
  nextDecisionId: number
  /**
   * COMPLETED lives played in this save, in order. Appended when the player
   * continues as an heir, so the game knows it is the third life of a line
   * and the retrospective can say so. Part of the save.
   */
  readonly lineage: EntityId[]
}

// ---------------------------------------------------------------------------
// Events — WHAT happened
// ---------------------------------------------------------------------------

export type EventType =
  | 'born'
  | 'died'
  | 'started-school'
  | 'finished-school'
  | 'hired'
  /** An annual review moved the pay. detail carries the new monthly cents. */
  | 'got-raise'
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
  /** The household could not cover the month; savings went negative. */
  | 'fell-behind'
  /** Savings recovered above zero after arrears. */
  | 'back-in-the-black'
  /** Money passed to this person from a parent's estate. */
  | 'inherited'
  /** Geopolitics (subjects are nation ids, invisible to person queries). */
  | 'war-began'
  | 'ceasefire'
  | 'peace-restored'
  | 'tensions-shifted'

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
  | 'geopolitics'

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
  | 'own-choice'
  | 'in-arrears'
  | 'cheaper-rent'
  | 'bloc-rivalry'
  | 'resource-competition'
  | 'internal-instability'
  | 'war-weariness'
  | 'heavy-casualties'
  | 'old-grudge'
  | 'long-peace'

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
  readonly player: PlayerState
  /** L4-M1. Keyed by id; insertion order deterministic from generation. */
  readonly nations: Map<EntityId, Nation>
  /** Keyed by relationKey(a, b). */
  readonly geoRelations: Map<string, GeoRelation>
}
