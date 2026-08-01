/**
 * The Life Engine — public surface.
 *
 * PURITY RULE (CLAUDE.md §6, ADR-0003):
 * This package may import from @life-engine/shared and nothing else.
 * No React. No DOM. No window, document, localStorage, fetch.
 * No clock, no timers, no storage, no network, no randomness of its own.
 *
 * The engine is a pure function of (state, seed, inputs) -> new state.
 * Everything that touches the outside world lives in apps/web.
 *
 * This rule is enforced automatically by test/purity.test.ts and, independently,
 * by tsconfig.json declaring no ambient type libraries.
 */

export { SCHEMA_VERSION, SIMULATION_VERSION } from './snapshot.js'

// Time
export { ageAt, formatDate, formatYear, isBirthdayMonth, monthName, START_YEAR, toDate } from './clock.js'
export type { SimDate } from './clock.js'

// Randomness
export { hash32, openStream, Rng, Stream } from './rng.js'
export type { StreamId } from './rng.js'

// World
export { createWorld, DEFAULT_POPULATION, placesOfKind } from './worldgen.js'
export { advanceTick, advanceTicks } from './tick.js'
export { livingPeople } from './systems.js'
export {
  compatibility,
  friendsOf,
  other,
  partnerOf,
  relationshipBetween,
  relationshipsOf,
  spouseOf,
} from './relationships.js'

// Player
export {
  applyForJob,
  awaitingPlayer,
  createCustomLife,
  describePending,
  describeStakes,
  heirsOf,
  motherCandidates,
  playerIsAlive,
  playerPerson,
  requestDeployment,
  requestEnlistment,
  requestSchool,
  resolvePending,
  setPlayer,
  trainFitness,
  tryOutForUnit,
} from './player.js'
export type { CustomLifeSpec } from './player.js'

// Geopolitics (L4-M1)
export {
  activeWars,
  generateNations,
  homeland,
  isAtWar,
  newsSince,
  relationBetween,
} from './geopolitics.js'
export type { NewsItem } from './geopolitics.js'

// Health (L4-M2)
export { healthOf, isSeverelyAiling, SEVERE_AILMENT } from './health.js'
export { describeAilment, markFor } from './wounds.js'
export type { InjuryContext } from './wounds.js'

// Service (L4-M3)
export {
  badgesOf,
  boardStandingFor,
  enlistmentBar,
  isServing,
  isVeteran,
  pensionOf,
  promotionPointsFor,
  rankTitle,
  schoolOptionsFor,
  servicePayOf,
  unitOptionsFor,
  veteranUnlocks,
} from './service.js'
export { SPECIAL_UNITS, specialUnitById } from './content.js'

// Awards (L4-M5)
export {
  decorationsOf,
  grantCampaignMedal,
  grantCombatAction,
  grantGoodConduct,
  grantQualificationBadge,
  grantWoundRecognition,
} from './awards.js'
export { BRANCH_NAMES, BRANCH_RANKS, SPECIALTIES, specialtyById } from './content.js'
export type { ExposureProfile, ServiceBranch, ServiceSpecialty } from './content.js'

// Deployment (L4-M4)
export {
  currentDeployment,
  deploymentsOf,
  isDeployed,
  threatVectorFor,
} from './deployment.js'
export type { ThreatVector } from './deployment.js'

// Legacy
export {
  childrenIdsOf,
  descendantGenerations,
  familyHomeSince,
  familyTreeOf,
  grandchildrenIdsOf,
  grandparentIdsOf,
  isDescendantOf,
  legacySummaryOf,
  lineageOf,
  playsDescendantLine,
  siblingIdsOf,
} from './legacy.js'
export type { FamilyTree, LegacySummary } from './legacy.js'

// Finances
export {
  canAfford,
  discretionaryFor,
  householdCosts,
  householdIncome,
  inArrears,
  monthlyNetOf,
} from './finances.js'
export { LIVING_COST_ADULT, LIVING_COST_CHILD, rentFor } from './content.js'

// Records
export { childrenOf, decisionForEvent, decisionsFor, eventsFor } from './records.js'

// Narrative
export { explainDecision, explainWhy, fullName, lifeStory, personSummary, timelineFor } from './story.js'
export type { TimelineEntry } from './story.js'

// Persistence surface (serialization only — save/load is Milestone 4)
export { LOCAL_USER_ID, serialize, toSnapshot, worldHash, worldHashHex } from './snapshot.js'
export type { SnapshotHeader, WorldSnapshot } from './snapshot.js'

// Content
export { OCCUPATIONS, occupationById } from './content.js'
export { friendshipKey, relationshipKey } from './types.js'

// Types
export type {
  AwardKind,
  AwardRecord,
  CausalFactor,
  CausalRecord,
  DecisionType,
  EducationLevel,
  EducationRecord,
  EmploymentRecord,
  EventType,
  FactorId,
  Relationship,
  RelationshipType,
  Household,
  Occupation,
  PendingDecision,
  PendingKind,
  Deployment,
  Person,
  Place,
  ServiceRecord,
  PlayerChoice,
  PlayerState,
  PlaceKind,
  Sex,
  Significance,
  Tier,
  Ailment,
  BodySite,
  GeoRelation,
  IllnessKind,
  InjuryKind,
  GeoState,
  HealthRecord,
  Nation,
  Town,
  Traits,
  WarPhase,
  World,
  WorldEvent,
} from './types.js'
