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
  bankTransfer,
  borrowPlayer,
  buyHomePlayer,
  divestPlayer,
  heirsOf,
  investPlayer,
  lookForPlace,
  moveBar,
  motherCandidates,
  playerIsAlive,
  playerPerson,
  propose,
  quitJob,
  requestDeployment,
  requestDischarge,
  isStretchFor,
  jobBar,
  startBusiness,
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
export { describeTraits, sentenceCase, traitWords, withArticle, sentenceInWords } from './text.js'
export type { NewsArticle, NewsQuote } from './newsroom.js'

// Health (L4-M2)
export { healthOf, isSeverelyAiling, SEVERE_AILMENT } from './health.js'
export { describeAilment, markFor } from './wounds.js'
export type { InjuryContext } from './wounds.js'

// Service (L4-M3)
export {
  badgesOf,
  boardStandingFor,
  upOrOutStandingFor,
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
  decodeContract,
  recruitingDriveActive,
  schoolOptionsFor,
  serviceNewsSince,
  servicePayOf,
  unitOptionsFor,
  veteranUnlocks,
} from './service.js'
export { specialUnitById, specialtyTitleFor } from './content.js'

// Crime & justice (C1)
export {
  commitOffence,
  courtOutcomeOf,
  crimeNewsSince,
  criminalRecordOf,
  hasRecentConviction,
  isJailed,
  offenceBar,
  expungementBar,
  gateStrengthOf,
  recordGateOf,
  petitionForExpungement,
  crimePressureOf,
  isOnProbation,
} from './crime.js'
export { GRADE_TITLES, isFelony, OFFENCES, offenceById } from './content.js'
export { crimeSceneFor, crimeOutcomeFor, decodeCrimeScene, CRIME_SCENE_OPTIONS } from './crimescene.js'
export type { CrimeScene, CrimeDanger, CrimeChoice, CrimeOutcome } from './crimescene.js'
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
  ordersSheetFor,
  isCaptive,
  capturedSince,
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
  accountsOf,
  buyHome,
  buyInvestment,
  applyMoneyShock,
  creditOf,
  homeValueOf,
  fileBankruptcy,
  moneyOnHand,
  supportOf,
  moveBetweenOwnAccounts,
  sellInvestment,
  takeLoan,
  arrearsHistoryOf,
  canAfford,
  householdWealth,
  netWorthOf,
  personalIncome,
  personalMonthlyNet,
  discretionaryFor,
  householdCosts,
  householdIncome,
  householdLedger,
  inArrears,
  monthlyNetOf,
} from './finances.js'
export type { ArrearsSpell, HouseholdLedger, LedgerEntry } from './finances.js'
export { LIVING_COST_ADULT, LIVING_COST_CHILD, annualPay, rentFor } from './content.js'

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
  Accounts,
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
export type { OrdersSheet, OrdersVariant } from './deployment.js'
export { SECTORS, holdingValue, marketLevel, portfolioValue, sectorById } from './market.js'
export type { Sector } from './market.js'
export { economyPhaseWords, atTodaysPrices } from './economy.js'
export { incomeTaxFor, marginalRatePerMille, withholdingFor, capitalGainsTaxOn } from './tax.js'
export type { EconomyPhase, EconomyState, Holding } from './types.js'
export {
  CREDIT_MAX,
  CREDIT_MIN,
  LOAN_TERMS,
  creditWords,
  depositFor,
  homeEquityOf,
  homePriceFor,
  loanBar,
  loanTermsFor,
  offeredRatePerMille,
  totalDebtOf,
} from './credit.js'
export type { Loan, LoanKind } from './types.js'
export type { Bankruptcy, BankruptcyChapter, Business } from './types.js'
export {
  BUSINESS_KINDS,
  businessBar,
  businessHealthWords,
  businessKindById,
  businessNameFor,
  monthlyProfitFor,
} from './business.js'
export type { BusinessKind } from './business.js'
export {
  CHAPTER_7_FILE_YEARS,
  CHAPTER_13_FILE_YEARS,
  chapterTitle,
  chapterWords,
  chaptersOpenTo,
  creditPenaltyOf,
  filingsOf,
  openFilingOf,
  planMonthsFor,
  planPaymentFor,
  totalOwedBy,
  underStay,
} from './bankruptcy.js'
export {
  ASSISTANCE_FLOOR,
  STATE_PENSION_AGE,
  assistanceOf,
  safetyNetWords,
  statePensionOf,
  unemploymentOf,
} from './safetynet.js'
export {
  CAREER_TRACKS,
  nextRungOf,
  placeOf,
  promotionBar,
  reviewScoreFor,
  standingWords,
  trackById,
  tracksOpenTo,
} from './careers.js'
export type { CareerTrack, Rung } from './careers.js'
export {
  WORK_CHOICES,
  WORK_MOMENTS,
  decodeWorkMoment,
  momentsFor,
  outcomeOf,
  situationOf,
  workMomentById,
  workResultFor,
} from './workmoments.js'
export type { WorkChoice, WorkMoment, WorkOption, WorkOutcome } from './workmoments.js'
export {
  INTERVIEW_APPROACHES,
  INTERVIEW_OPTIONS,
  decodeInterview,
  interviewOutcomeOf,
  interviewSituation,
} from './interview.js'
export type { InterviewApproach, InterviewOption, InterviewOutcome } from './interview.js'
export { contractFor } from './contract.js'
export { separationFor, retirementCertificateFor, separationTermsFor } from './separation.js'
export type { SeparationRecord, RetirementCertificate, CharacterOfService } from './separation.js'
export type { ServiceContract, ContractVariant } from './contract.js'
