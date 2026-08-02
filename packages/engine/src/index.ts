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
export { ageAt, formatDate, formatYear, isBirthdayMonth, monthName, toDate } from './clock.js'
export type { SimDate } from './clock.js'

// Randomness
export { hash32, openStream, Rng, Stream } from './rng.js'
export type { StreamId } from './rng.js'

// World
export { createWorld, DEFAULT_POPULATION, placesOfKind } from './worldgen.js'
export { HEARTLAND_COUNTY, HEARTLAND_SPEC, HEARTLAND_STATE } from './heartland.js'
export {
  branchSpecFor,
  CLASSIC_SPEC,
  PRESETS,
  schoolFor,
  specById,
  specialtyFor,
  unitFor,
} from './worldspec.js'
export { advanceTick, advanceTicks } from './tick.js'
export {
  birthBar,
  DISMISSAL_PERFORMANCE,
  enrolmentBar,
  livingPeople,
  RAISE_MIN_PERFORMANCE,
  WARNING_PERFORMANCE,
} from './systems.js'
export {
  compatibility,
  courtshipBar,
  friendsOf,
  other,
  partnerOf,
  proposalBar,
  relationshipBetween,
  relationshipsOf,
  spouseOf,
} from './relationships.js'

// Player
export {
  applyForJob,
  askForRaise,
  awaitingPlayer,
  chooseSpendStance,
  courtFriend,
  createCustomLife,
  describePending,
  describeStakes,
  endCourtship,
  heirsOf,
  lookForPlace,
  moveBar,
  motherCandidates,
  playerIsAlive,
  playerPerson,
  propose,
  quitJob,
  requestDeployment,
  requestDischarge,
  requestEnlistment,
  requestEnrolment,
  requestSchool,
  resolvePending,
  setConvalescenceStance,
  setPlayer,
  spendTimeWith,
  tendTheMarriage,
  trainFitness,
  tryForChild,
  tryOutForUnit,
  walkOut,
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

// The newsroom (WCJC): structured articles, to the owner's brief.
export { articleFor } from './newsroom.js'
export { COMBAT_SCENES, decodeScene, outcomeFor, SCENE_OPTIONS, sceneById } from './scenes.js'
export { UNIT_MOMENTS, unitMomentById } from './scenes.js'
export type { UnitMoment, UnitMomentId } from './scenes.js'
export type { CombatScene, SceneChoice, Threat } from './scenes.js'
export { describeTraits, sentenceCase, traitWords, withArticle } from './text.js'
export type { NewsArticle, NewsQuote } from './newsroom.js'

// Health (L4-M2)
export { healthOf, isSeverelyAiling, SEVERE_AILMENT } from './health.js'
export { describeAilment, markFor } from './wounds.js'
export type { InjuryContext } from './wounds.js'

// Service (L4-M3)
export {
  badgesOf,
  boardStandingFor,
  branchName,
  disciplinaryFileOf,
  enlistmentBar,
  squadmatesOf,
  unitRosterOf,
  isServing,
  isVeteran,
  pensionOf,
  survivorPensionOf,
  promotionPointsFor,
  rankTitle,
  recruitingDriveActive,
  schoolOptionsFor,
  serviceNewsSince,
  servicePayOf,
  unitOptionsFor,
  veteranUnlocks,
} from './service.js'
export { specialUnitById } from './content.js'

// Crime & justice (C1)
export {
  commitOffence,
  courtOutcomeOf,
  crimeNewsSince,
  criminalRecordOf,
  hasRecentConviction,
  isJailed,
  offenceBar,
} from './crime.js'
export { GRADE_TITLES, isFelony, OFFENCES, offenceById } from './content.js'
export type { Offence, OffenceGrade } from './content.js'
export type { CourtOutcome } from './crime.js'

// Demographics (D1) — read-side measures
export {
  fertilityCohort,
  partneringFunnel,
  populationAt,
  yearlyDemographics,
} from './demographics.js'
export type { FertilityCohort, PartneringFunnel, YearDemographics } from './demographics.js'

// Awards (L4-M5)
export {
  decorationsOf,
  grantCampaignMedal,
  grantCombatAction,
  grantGoodConduct,
  grantQualificationBadge,
  grantWoundRecognition,
} from './awards.js'
export { BRANCH_NAMES, BRANCH_RANKS, CLASSIC_BRANCHES, specialtyById } from './content.js'


// Deployment (L4-M4)
export {
  alliedWars,
  currentDeployment,
  deploymentsOf,
  isDeployed,
  rotationAvailable,
  supportDeploymentAvailable,
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
  arrearsHistoryOf,
  canAfford,
  discretionaryFor,
  householdCosts,
  householdIncome,
  householdLedger,
  inArrears,
  monthlyNetOf,
} from './finances.js'
export type { ArrearsSpell, HouseholdLedger, LedgerEntry } from './finances.js'
export { LIVING_COST_ADULT, LIVING_COST_CHILD, rentFor } from './content.js'

// Records
export { childrenOf, decisionForEvent, decisionsFor, eventsFor } from './records.js'

// Narrative
export {
  describeOutcome,
  explainDecision,
  explainWhy,
  fullName,
  lifeStory,
  personSummary,
  timelineFor,
} from './story.js'
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
  Conviction,
  CriminalRecord,
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
  SpendStance,
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
  Gazetteer,
  ExposureProfile,
  ServiceSchool,
  ServiceSpecialty,
  SpecialUnit,
  ServiceBranchSpec,
  NamePool,
  WorldSpec,
  WarPhase,
  World,
  WorldEvent,
} from './types.js'
