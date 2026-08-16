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
  employeesOf,
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
  buyPropertyPlayer,
  rentPropertyPlayer,
  sellHomePlayer,
  payOffBankruptcyPlayer,
  seeADoctor,
  setHabit,
  DOCTOR_VISIT_COST,
  divestPlayer,
  heirsOf,
  investPlayer,
  lookForPlace,
  moveBackInBar,
  moveBackInWithParents,
  refinancePlayer,
  findTenantPlayer,
  endTenancyPlayer,
  moveIntoOwnPlayer,
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
  businessOf,
  candidatesForBusiness,
  raiseBar,
  raiseCapitalPlayer,
  nextRoundOffer,
  boardFor,
  withdrawFromBusinessPlayer,
  growthOffersFor,
  growBusinessPlayer,
  ceilingReport,
  buyersForBusiness,
  sellBusinessPlayer,
  windDownPlayer,
  opsFor,
  stockReport,
  orderStockPlayer,
  clearStockPlayer,
  vendorOffersFor,
  switchVendorPlayer,
  haggleVendorPlayer,
  setPricePlayer,
  setRetainPlayer,
  investInBusinessPlayer,
  advertisePlayer,
  setLongHoursPlayer,
  setInsurancePlayer,
  chaseDebtsPlayer,
  refitPlayer,
  booksFor,
  expansionBar,
  expansionOffers,
  expandBusinessPlayer,
  rivalsForSale,
  acquireRivalPlayer,
  hireBar,
  hireIntoBusiness,
  letGoFromBusiness,
  requestEnlistment,
  requestEnrolment,
  requestSchool,
  resolvePending,
  setConvalescenceStance,
  setPlayer,
  spendTimeWith,
  tendTheMarriage,
  extraDutyBar,
  takeExtraDuty,
  trainFitness,
  tryForChild,
  tryOutForUnit,
  walkOut,
} from './player.js'
export type { CustomLifeSpec, JobCandidate, LicenceView, PathView, RungView, StakeView, StockReport } from './player.js'
export {
  ADVERT_MONTHS,
  PRICE_STEPS,
  demandFromPricePerMille,
  insurancePremiumFor,
  servedPerMille,
  stockNeededFor,
  tradingLiftPerMille,
} from './operations.js'
export {
  SKILLS,
  SKILL_LEVEL,
  SKILL_MAX,
  afterAMonth,
  earnedThisMonth,
  gatesFailed,
  heldSkills,
  levelOf,
  meetsGates,
  skillById,
  skillOf,
  standingOf,
} from './skills.js'
export type { Skill, SkillGate, SkillGrowth, SkillId, SkillSheet } from './skills.js'
export {
  LICENCES,
  PATH_CATEGORIES,
  SPEC_DEFLATOR,
  fromSpecSalary,
  levelOfPath,
  licenceById,
  nextLevel,
  pathAvailableIn,
  pathById,
} from './paths.js'
export type { CareerPath, Licence, PathLevel } from './paths.js'
export { FIRST_SLICE } from './pathcontent.js'
export type { VendorOffer } from './operations.js'
export {
  BOARD_MATTERS,
  boardMatterById,
  hasBoardSeat,
  offerFor,
  priceAfter,
  voteCarries,
} from './board.js'
export type { BoardMatter, BoardMatterId } from './board.js'
export {
  BUSINESS_MOMENTS,
  businessMomentById,
  businessMomentsFor,
} from './moments.js'
export type { BusinessMoment, MomentId } from './moments.js'
export { PLAIN_WORDS, inTradeWords, wordsFor } from './tradewords.js'
export type { TradeWords } from './tradewords.js'
export type { BusinessOps } from './types.js'

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
  flagStatus,
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
  arrearsOf,
  buyHome,
  homePurchaseBar,
  payOffPlan,
  buyInvestment,
  buyShares,
  payDownBar,
  payDownLoan,
  sellShares,
  applyMoneyShock,
  creditOf,
  refinanceBar,
  findTenantBar,
  rentalIncomeOf,
  homeValueOf,
  fileBankruptcy,
  discretionaryForUnit,
  financialUnitOf,
  moneyOnHand,
  setSpendStance,
  stanceOfUnit,
  unitCosts,
  unitIncome,
  unitMonthlyNet,
  unitsUnder,
  supportOf,
  moveBetweenOwnAccounts,
  sellInvestment,
  takeLoan,
  arrearsHistoryOf,
  canAfford,
  householdWealth,
  businessDrawOf,
  businessWorthOf,
  // The ACCOUNTS a person actually spends from (H0) — distinct from
  // player.ts's `walletOf`, which answers with a single figure.
  walletOf as walletAccountsOf,
  // A person's own share of the joint purse — what net worth counts for
  // them, so a screen itemising it uses the same figure.
  liquidShareOf,
  bricksAndMortarOf,
  businessDemandsAllHours,
  netWorthOf,
  personalIncome,
  personalMonthlyNet,
  monthAheadFor,
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
  HabitKind,
  HabitRecord,
  Lease,
  Property,
  PropertyType,
  WellbeingCause,
  WellbeingRecord,
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
  LicenceId,
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
  depositShareFor,
  homeEquityOf,
  homePriceFor,
  monthlyPaymentFor,
  loanBar,
  loanTermsFor,
  offeredRatePerMille,
  totalDebtOf,
} from './credit.js'
export type { Loan, LoanKind } from './types.js'
export type {
  Bankruptcy,
  BankruptcyChapter,
  Business,
  CapTable,
  BusinessMonth,
  Expansion,
  ExpansionKind,
  InvestmentRound,
  Shareholder,
} from './types.js'
export {
  EXPANSIONS,
  expansionTermsFor,
  upliftPerMilleOf,
  CEILING_STEPS_MAX,
  ceilingBonusPerMilleOf,
  growthOptionsFor,
  boardViewFor,
  growthPerMilleOf,
  summarise,
  competitionPerMilleFor,
  marketWeightOf,
  shareOfTradePerMille,
  ROUNDS,
  boardWeightFor,
  capTableSums,
  foundingCapTable,
  investmentFor,
  issueShares,
  nextRoundFor,
  privateValuationOf,
  shareOf,
  termsFor,
} from './equity.js'
export type { RoundTerms, ExpansionTerms, GrowthTerms, Ledger, BoardView } from './equity.js'
export {
  BUSINESS_KINDS,
  annualRevenueOf,
  businessBar,
  companyHeadcountOf,
  founderSalaryOf,
  scaleUpBar,
  valuationOf,
  businessHealthWords,
  businessKindById,
  businessNameFor,
  kindAvailableIn,
  kindDemandPerMille,
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
  planMonthsLeft,
  planPayoffBar,
  planPayoffFor,
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
export { GRADUATE_ADMISSION, MAJORS, MERIT_ATTAINMENT, majorById, majorsFor } from './content.js'
export {
  ANALYST_MONTHS,
  REFERENCE_PE,
  betaOf,
  computeAnalystView,
  dividendYieldOf,
  earningsOf,
  holdingKeyOf,
  marketCapOf,
  peRatioOf,
  ratingOf,
  sharesFor,
  upsidePerMille,
  volumeOf,
  yearRangeOf,
  COMPANY_NEWS,
  HISTORY_MONTHS,
  STOCKS,
  companyNewsById,
  newsOpenTo,
  freshStockPrices,
  pushHistory,
  stepStocks,
  floatProceedsFor,
  stockById,
  stocksInSector,
  BLOCKING_STAKE_PER_MILLE,
  CONTROL_STAKE_PER_MILLE,
  controlPremiumPerMille,
  costToReachPerMille,
  priceToBuyerOf,
  stakePerMilleOf,
  stakeWords,
} from './market.js'
export type { AnalystView, Stock } from './types.js'
export type { CompanyNews } from './market.js'
export { dropOut, dropOutBar, hiringBar, serviceEdgeFor } from './systems.js'
export { isEntryWork, meritedRung } from './careers.js'
export {
  CAMPAIGN_MONTHS,
  OFFICES,
  PARTIES,
  SEATED_OFFICES,
  DEBATE_LINES,
  DEBATE_OPTIONS,
  campaign,
  candidacyBar,
  castVote,
  debate,
  declareCandidacy,
  eligibleFor,
  myCandidacy,
  freshPolicy,
  heldOffices,
  holderOf,
  LEVER_NOTES,
  LEVER_RANGE,
  leverBar,
  leversOf,
  warPowerBar,
  officeById,
  openBallots,
  townBudget,
  partyById,
  voteBar,
} from './government.js'
export type { Election, Office, Officeholder, Party, PolicyState } from './types.js'
export type { CampaignAction, DebateChoice } from './government.js'
export {
  buySharesPlayer,
  pathsFor,
  joinBar,
  joinPathPlayer,
  climbPathPlayer,
  licencesFor,
  earnLicencePlayer,
  holdsLicence,
  stakesOf,
  takeoverBar,
  takeStakePlayer,
  campaignPlayer,
  dropOutPlayer,
  sellSharesPlayer,
  ipoBar,
  decodeHeldSession,
  bankrollOf,
  walletOf,
  buyChipsPlayer,
  cashOutPlayer,
  casinoBar,
  playTablePlayer,
  playPokerPlayer,
  enterTournamentPlayer,
  studyPokerPlayer,
  turnProPlayer,
  seekHelpPlayer,
  payDownPlayer,
  scaleUpPlayer,
  takePublicPlayer,
  seekPeacePlayer,
  setLeverPlayer,
  standPlayer,
  votePlayer,
} from './player.js'
export type { Major } from './content.js'
export {
  SCHOOL_CHOICES,
  SCHOOL_MOMENTS,
  decodeSchoolMoment,
  schoolMomentById,
  schoolMomentsFor,
  schoolOutcomeOf,
  schoolResultFor,
  schoolSituationOf,
} from './schoolmoments.js'
export type {
  SchoolChoice,
  SchoolMoment,
  SchoolOption,
  SchoolOutcome,
  SchoolStage,
} from './schoolmoments.js'
export {
  INTERVIEW_APPROACHES,
  INTERVIEW_OPTIONS,
  decodeInterview,
  interviewOutcomeOf,
  interviewSituation,
} from './interview.js'
export type { InterviewApproach, InterviewOption, InterviewOutcome } from './interview.js'
export {
  APTITUDE_MAX,
  APTITUDE_MIN,
  accessionOf,
  accessionWords,
  aptitudeBaseFor,
  aptitudeWords,
  assignOfficerRole,
  commissionBar,
  eligibleJobs,
  entryTestScore,
  jobsOfBranch,
  meritScoreFor,
  mosBar,
  officerRolesOf,
  recruitingStationFor,
  sceneTagsFor,
} from './enlistment.js'
export type { HomePurchaseMethod } from './finances.js'
export { article15For } from './article15.js'
export { GIFTS, causeBlurb, endowedNameFor, giftTermsFor } from './philanthropy.js'
export type { CauseView, GiftOffer, GiftTerms, GiftTier } from './philanthropy.js'
export { causesFor, endowPlayer, giveBar } from './player.js'
export type { Article15 } from './article15.js'
export { OFFICER_ROLES, officerRoleById } from './content.js'
export type { MosField, OfficerAccession, OfficerRole } from './types.js'
export { contractFor } from './contract.js'
export { separationFor, retirementCertificateFor, separationTermsFor } from './separation.js'
export type { SeparationRecord, RetirementCertificate, CharacterOfService } from './separation.js'
export type { ServiceContract, ContractVariant } from './contract.js'

// --- Wellbeing (the stats panel's one new stored stat) ---------------------
export {
  nudgeWellbeing,
  runWellbeing,
  wellbeingBaselineFor,
  wellbeingCausesOf,
  wellbeingOf,
  wellbeingRecordOf,
  WELLBEING_MAX,
  WELLBEING_NEUTRAL,
} from './wellbeing.js'

// --- The body, and the age it starts being one (stats phase 2) ------------
export {
  disciplineOf,
  dropHabit,
  habitMaturity,
  habitMonths,
  habitsOf,
  keepsHabit,
  takeUpHabit,
  fitnessOf,
  fitnessStandardFor,
  fitnessTargetFor,
  healthStatOf,
  looksOf,
  runStats,
  setFitness,
  smartsOf,
  STATS_FROM_AGE,
} from './stats.js'

// --- Real estate (the property market) ------------------------------------
export type { Listing, NeighbourhoodTrend, OwnershipCost } from './realestate.js'
export {
  generateProperties,
  trendOf,
  trendWords,
  listingOf,
  listingsFor,
  ownershipCostOf,
  seatHouseholds,
  equityOf,
  improveProperty,
  renovationCostOf,
  runProperties,
  saleProceedsOf,
  downPaymentFor,
  housingCostOf,
  leaseBar,
  leaseOf,
  DEPOSIT_MONTHS,
  LEASE_MONTHS,
  isVacant,
  occupantOf,
  portfolioValueOf,
  propertiesIn,
  propertiesOwnedBy,
  setOwner,
  rentOf,
  useRentCurve,
  valueOf,
} from './realestate.js'

// The casino (owner's `casino_poker_master_1.md`).
export {
  BLACKJACK_CHOICES,
  BUY_INS_FOR_A_ROLL,
  CASINO_MIN_AGE,
  PRO_MIN_HOURS,
  PRO_MIN_SKILL,
  STAKES,
  TOURNAMENTS,
  HAND_CHOICES,
  buyChipsBar,
  keyHandFor,
  keyHandOutcome,
  handOutcomeWords,
  expectedReturnPerMille,
  freshGambler,
  gamblerOf,
  holdLevelOf,
  holdWords,
  houseEdgePerMille,
  paytableFor,
  pokerCeilingFor,
  prizeFor,
  rollWordsFor,
  rolledFor,
  stakeById,
  tournamentById,
  tournamentRunning,
  turnProBar,
} from './casino.js'
export type {
  BlackjackChoice,
  HandChoice,
  KeyHand,
  HoldLevel,
  SessionResult,
  Stake,
  TableGame,
  TableResult,
  Tournament,
  TournamentResult,
} from './casino.js'
export type { GamblingRecord, SessionSummary, TournamentSummary } from './types.js'

// Athlete careers (owner's `sports_careers_master.md`).
export {
  BASE_STATS,
  DRAFT_AGE,
  DRAFT_PICKS,
  POSITIONS,
  SKILL_TITLES,
  TRAINING_FOCI,
  TRYOUT_AGE,
  ceilingFor,
  isProAthlete,
  offersFor,
  overallOf,
  positionById,
  positionsFor,
  rookieWageFor,
  runDraft,
  sportsWageOf,
  statOf,
  trainingRisk,
  tryoutBar,
  veteranWageFor,
  SPORT_RULES,
  rulesFor,
  runDraftFor,
  runSigning,
  runFight,
  applyFight,
  recordWords,
  standingWordsFor,
  signedWageFor,
  endorsementsFor,
  famePressure,
  secondActsFor,
  SECOND_ACTS,
} from './sports.js'
export type { AthleteLevel, Offer, Position, SeasonLine, SportId, SportRules, TrainingFocus, FightResult, SigningResult } from './sports.js'
export type { AthleteRecord, OfferRecord, SeasonLineRecord } from './types.js'
export {
  athleteOf,
  tryOutPlayer,
  trainPlayer,
  restPlayer,
  acceptOfferPlayer,
  declareForDraftPlayer,
  retirePlayer,
  takeFightPlayer,
  signEndorsementPlayer,
  secondActPlayer,
} from './player.js'

// The paper an athlete signs (owner: "make a contract UI how we did for
// deployments and stuff").
export {
  letterOfIntentFor,
  playingContractFor,
  endorsementFor,
  endorsementOfferFor,
} from './sportspaper.js'
export type { SportsPaper, PaperVariant } from './sportspaper.js'
export type { SecondAct } from './sports.js'

// The combat & tours revamp (owner's `combat_tours_revamp.md`).
export {
  beatFor,
  contactChanceFor,
  contactShapePerMille,
  monthContactChance,
  operationNameFor,
  phaseFor,
  severityBiasFor,
  tempoFor,
  tempoWords,
  tierFor,
  tourHeadline,
} from './tours.js'
export type { IntensityTier, TourBeat, TourPhase } from './tours.js'
export {
  ROLE_TITLES,
  SQUAD_SIZE,
  bondWith,
  bondWords,
  livingSquad,
  pickCasualty,
  squadLineFor,
  squadMemberOf,
} from './squad.js'
export type { SquadRole } from './squad.js'
export type { SquadMember } from './types.js'
export {
  afterActionWords,
  beatsFor,
  consequenceWords,
  decodeEngagement,
  encodeEngagement,
  engagementRoll,
  followOnFor,
  orientWords,
  decodeSequence,
  encodeSequence,
  beatAt,
  beatAsks,
  whoIsDown,
  followOnOdds,
  followOnWords,
  hurtInContact,
} from './engagement.js'
export type { BeatKind } from './engagement.js'
export {
  EVACUATES_AT,
  TIER_WORDS,
  careShiftFor,
  endsTheTour,
  evacMinutesFor,
  meritsWoundRecognition,
  permanentDisabilityFrom,
  resolveCasualty,
  returnsToDuty,
  woundAgeWords,
} from './casualty.js'
export type { Casualty, WoundTier } from './casualty.js'
export { MOS_SCENES } from './mosscenes.js'

// The front door (owner's `newgame_and_birth_master.md`).
export {
  FULL_LIFE_YEARS,
  announcementFor,
  defaultBirthTick,
  householdWordsFor,
  parentWorkFor,
  planBirth,
  registryNoFor,
  seedFromName,
  seedFromRegistryNo,
  registerBirth,
} from './birth.js'
export {
  barredFromWork,
  canRun,
  CANNOT_RUN_BELOW,
  effectsFor,
  effectsOf,
} from './conditions.js'
export type { ConditionEffects } from './conditions.js'
export { cardValue, decodeHand, handTotal } from './casino.js'
export type { BlackjackHand } from './casino.js'
export { dealBlackjack, fileBAClaim } from './player.js'
export {
  baCompensationFor,
  coverageOf,
  coverageWords,
  disabilityRatingFor,
  inTheBA,
  outOfPocketFor,
  SENIORCARE_AGE,
} from './benefits.js'
export type { Coverage, CoverageSource } from './benefits.js'
export type { BirthPlan, BirthRequest, FamilySpec } from './birth.js'
