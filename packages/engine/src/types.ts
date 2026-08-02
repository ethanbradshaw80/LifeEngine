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
// The world's preset (W1 — docs/WORLD_MODES_PLAN.md, ADR-0020)
//
// The shape only. The DATA lives in worldspec.ts, which may import content;
// this file imports nothing but @life-engine/shared and must keep it that way.
// ---------------------------------------------------------------------------

/**
 * A pool of names with their relative frequencies. Both arrays are the same
 * length; pickWeighted spends exactly one draw whatever the weights are, so
 * changing a pool's CONTENT changes names without changing anyone's life.
 */
export interface NamePool {
  readonly names: readonly string[]
  readonly weights: readonly number[]
}

/** Everything the town is made of, before anybody lives in it. */
export interface Gazetteer {
  readonly townName: string
  readonly schoolName: string
  readonly neighbourhoods: readonly string[]
  readonly workplaces: readonly string[]
  readonly civic: readonly string[]
  /**
   * Military installations. Allocated AFTER the population — see worldgen.
   *
   * `branches` lists the service ids posted there; EMPTY MEANS ALL, which is
   * what Classic's joint-use stations have always been. W2's review made
   * this necessary: with real installation names, posting a sailor to an
   * army fort stops being a harmless fiction and becomes a false claim
   * about a real place, written into a permanent record.
   */
  readonly bases: readonly BaseSpec[]
  /** The town's news station, by call sign. A town fact wearing a masthead
   *  (W1 review) — WCJC is Haverlock's, not every town's. */
  readonly newsStation: string
}

/**
 * A service branch, as DATA (W1 resistance 3). It was a compile-time union
 * — `type ServiceBranch = 'land-forces' | ...` — keying five separate
 * Records in content.ts, which meant a preset could not name its own
 * services without editing the engine's types. The five tables are one
 * object now, and the branch a record holds is a plain string id resolved
 * against the world's spec.
 */
export interface ServiceBranchSpec {
  readonly id: string
  /** What the branch is called: "the Land Forces". */
  readonly name: string
  /** Enlisted ladder, junior to senior. A record stores an INDEX into this. */
  readonly ranks: readonly string[]
  /** Pay grade (E-1..E-8) per ladder index. Pay reads the GRADE, not the
   *  index: two ranks can share a grade, exactly as in life. */
  readonly grades: readonly number[]
  /** First ladder index that takes a promotion board; below is time-in-grade. */
  readonly competitiveFrom: number
  /** Months in grade before the next JUNIOR promotion, by current rank. */
  readonly juniorTigMonths: readonly number[]
}

// ---------------------------------------------------------------------------
// Service content (W1). Shapes here, DATA in content.ts and on the spec.
// Branch ids are plain strings: the compile-time union is gone, so a preset
// can name its own services without editing the engine's types.
// ---------------------------------------------------------------------------

export interface ExposureProfile {
  readonly directCombat: number
  readonly convoy: number
  readonly baseAttack: number
  readonly accident: number
}

export interface ServiceSpecialty {
  readonly id: string
  readonly title: string
  readonly branch: string
  readonly requires: EducationLevel
  /** Months of occupational school after basic training (AIT-equivalent). */
  readonly schoolMonths: number
  /** The qualification this trade can earn, in words. L4-M5 reads these. */
  readonly qualification: string
  /**
   * Offset on the board's points cutoff (M-SPECOPS): every trade promotes
   * at its own speed, the way the real monthly cutoff lists work. Negative
   * means the trade needs people and promotes faster.
   */
  readonly boardCutoffOffset: number
  readonly exposure: ExposureProfile
  /** Civilian occupations this specialty's training unlocks for veterans. */
  readonly civilianUnlocks: readonly string[]
}

export interface ServiceSchool {
  readonly id: string
  readonly title: string
  /** Branches admitted; empty = all. */
  readonly branches: readonly string[]
  /** Specialties admitted; empty = any. */
  readonly specialtyIds: readonly string[]
  readonly minRank: number
  readonly minPerformance: number
  /** The badge the course pins on — routed through the awards machinery. */
  readonly badge: string
  readonly performanceBoost: number
  /** How long the course runs, in months. */
  readonly courseMonths: number
  /**
   * Months between class start dates. A school is not a door you walk
   * through when you feel like it — there is a next class, and you wait for
   * it. Class starts sit on a fixed grid off tick 0, so they are the same in
   * every replay of a world (owner spec, "class dates come off a fixed epoch
   * grid").
   */
  readonly classCadenceMonths: number
  /** Seats in one class. A full class is a real reason to wait. */
  readonly seatsPerClass: number
}

export interface SpecialUnit {
  readonly id: string
  /** Fictional name, authentic weight. */
  readonly name: string
  /** 1 = the entry unit; 2 = the tier above it; 3 = the one at the top. */
  readonly tier: 1 | 2 | 3
  readonly branches: readonly string[]
  readonly minRank: number
  readonly minPerformance: number
  readonly requiredBadges: readonly string[]
  /** Selection draws from this unit first, or null. */
  readonly feederUnitId: string | null
  /** chance(clamp(perf − minPerf + 60, 10, 400), THIS). Selection fails people. */
  readonly selectionDenominator: number
  /** Monthly special-duty pay on top of grade pay, cents. */
  readonly dutyPay: number
  /** Direct-combat exposure multiplier, per-mille. The sharp end, sharper. */
  readonly exposureMultiplier: number
}

/**
 * Where a nation starts relative to the homeland (ADR-0021). A STARTING
 * POSITION, not a judgement: it sets the first rung of the ladder on tick
 * zero and nothing after. Null means the preset has no opinion and the
 * simulation decides, which is what Classic does for every nation it
 * invents.
 */
export type Alignment = 'ally' | 'neutral' | 'rival'

/** A foreign nation as a preset supplies it. */
export interface NationSpec {
  readonly name: string
  readonly alignment: Alignment | null
  /**
   * Combat rating, 1-10 — how hard this country is to fight (owner spec,
   * 2026-08-02). A GAMEPLAY BALANCE NUMBER AND NOTHING ELSE, in the owner's
   * own words: "NOT a real-world stat — tune freely". It is not a ranking of
   * anybody's armed forces and the game never displays it as one; it feeds
   * the danger a deployed soldier faces and nothing more.
   *
   * Null means the preset has no opinion and the rating is derived from the
   * nation's generated strength, which is what Classic does for its twelve
   * invented countries.
   */
  readonly combatRating: number | null
}

/** An installation, and which services post people there. */
export interface BaseSpec {
  readonly name: string
  /** Service ids posted here. Empty = joint use, open to every branch. */
  readonly branches: readonly string[]
}

export interface WorldSpec {
  /** Stable id, recorded in the save header. Never rendered to the player. */
  readonly id: string
  /** What the preset is called when a person reads it. */
  readonly name: string
  /**
   * One or two sentences shown wherever a world is chosen or described.
   *
   * For a preset whose homeland is REAL this is not decoration: it is where
   * the world says it is not history. WORLD_MODES_PLAN.md made explicit
   * alternate-history framing a condition of the homeland-real ruling,
   * because a 1975 headline reading "The United States is at war" in a
   * world of invented enemies otherwise invites exactly one reading.
   */
  readonly description: string
  /**
   * A standing notice shown INSIDE the running game, or null when a preset
   * needs none. ADR-0021 §3 makes this a condition of naming real nations,
   * not a courtesy: a player who reads "the United States is at war with
   * Russia" on the news screen has to be able to see, in the same glance,
   * that the simulation made it up. Classic invents everything and needs no
   * disclaimer for it.
   */
  readonly inGameNotice: string | null
  readonly maleGiven: NamePool
  readonly femaleGiven: NamePool
  readonly family: NamePool
  readonly gazetteer: Gazetteer
  /**
   * The calendar year tick 0 falls in. A LABEL on the ticks, not an input to
   * them — nothing in the tick path reads it. If a start year is ever
   * player-selectable it becomes an input like the seed and belongs in the
   * save header beside presetId; until then it is the preset's.
   */
  readonly startYear: number
  /**
   * The nation the town lives in. W2's whole premise is that this becomes
   * the United States for one preset while every FOREIGN nation stays
   * fictional in all of them (MILITARY_AND_WAR_FOUNDATION §3 as amended by
   * ADR-0020) — so the homeland is the one nation name a preset owns.
   * Carries its own article: "the Republic", "the United States".
   */
  readonly homelandName: string
  /**
   * Foreign nations, in allocation ORDER — which is load-bearing, because
   * ids follow allocation and ids seed draws. Append only; never reorder.
   * The homeland is not in this list.
   *
   * A preset may name real countries (ADR-0021). What it may NEVER do is
   * name a real war: every conflict here is generated from modelled
   * pressure, and no real war, operation or battle name may enter this
   * engine's content. Classic invents its whole map.
   */
  readonly foreignNations: readonly NationSpec[]
  /** The services. A record naming a branch this preset does not have
   *  resolves to a BLANK, never to another service's ladder — substituting
   *  one re-reads every rank index and rewrites a career. */
  readonly branches: readonly ServiceBranchSpec[]
  /**
   * The trades. THE KEYSTONE of the branch extraction (W1 architecture
   * review): every branch id that ever reaches a service record comes from
   * `specialty.branch`, so until the trades are the preset's, `branches` is
   * decorative — a preset physically cannot use its own branch ids.
   */
  readonly specialties: readonly ServiceSpecialty[]
  /** Courses a soldier can be sent on. Shared fictional content in every
   *  preset so far; here because their branch links are the preset's. */
  readonly schools: readonly ServiceSchool[]
  /** Named units are FICTIONAL in every preset (WORLD_MODES_PLAN.md); on
   *  the spec for the same reason as schools. */
  readonly units: readonly SpecialUnit[]
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export type PlaceKind = 'neighbourhood' | 'school' | 'workplace' | 'civic' | 'base'

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
  /**
   * P2. A chosen spending posture, or null for the character-driven default
   * (discretionaryFor's diligence formula). Only a played household ever sets
   * it — NPC households stay null, so a world played by nobody is unchanged.
   * Schema v18.
   */
  readonly spendStance: SpendStance | null
}

/** How the household carries its money: tight, as-it-comes, or open-handed. */
export type SpendStance = 'thrifty' | 'loose'

// ---------------------------------------------------------------------------
// Health (L4-M2)
// ---------------------------------------------------------------------------

export type Ailment = 'injury' | 'illness'

/** What KIND of harm it is. M-WOUNDS: a wound has a name, not a category.
 *  M-HARM widened both tables — the world has many ways to hurt a body,
 *  and a record that names them is worth more than a category. */
export type InjuryKind =
  | 'gunshot'
  | 'shrapnel'
  | 'blast'
  | 'burns'
  | 'crush'
  | 'fracture'
  | 'concussion'
  | 'laceration'
  | 'amputation'
  | 'hearing-damage'
  | 'spinal-injury'
  | 'internal-injury'
  | 'eye-injury'
  | 'electrocution'
  | 'chemical-burns'
  | 'smoke-inhalation'
  | 'heatstroke'
  | 'frostbite'
  | 'near-drowning'
  | 'animal-bite'

export type IllnessKind =
  | 'pneumonia'
  | 'influenza'
  | 'fever'
  | 'infection'
  | 'heart-trouble'
  | 'back-trouble'
  | 'cancer'
  | 'stroke'
  | 'tuberculosis'
  | 'meningitis'
  | 'appendicitis'
  | 'kidney-trouble'
  | 'liver-trouble'
  | 'ulcers'
  | 'field-fever'
  | 'dysentery'

/** Where on the body an injury landed. */
export type BodySite = 'leg' | 'arm' | 'hand' | 'chest' | 'head' | 'back' | 'shoulder' | 'foot'

export interface HealthRecord {
  readonly personId: EntityId
  /** Current ailment, or null when well. One at a time — modest by design. */
  readonly ailment: Ailment | null
  /**
   * The specific kind: an InjuryKind for injuries, an IllnessKind for
   * illnesses. Null only on records migrated from before kinds existed —
   * unrecorded history stays unrecorded, and the text falls back to the
   * general word.
   */
  readonly ailmentKind: string | null
  /** For injuries: where it landed. Illnesses carry no site. */
  readonly ailmentSite: BodySite | null
  /** 0-1000 while ailing; 0 when well. Recovery works it down. */
  readonly severity: number
  /** The worst this ailment got — what lasting damage is judged by. */
  readonly peakSeverity: number
  readonly sinceTick: Tick | null
  /** The player is asked once per ailment how to carry a serious one. */
  readonly askedConvalesce: boolean
  /**
   * Permanent disability, 0-1000. Accumulates when bad ailments resolve
   * badly; NEVER decreases.
   */
  readonly disability: number
  /**
   * Whether the CURRENT ailment came from service (a wound inflicted on
   * deployment, any channel — line of duty). Stamped at onset, because
   * provenance is only knowable then; false for every civilian ailment.
   */
  readonly ailmentServiceConnected: boolean
  /**
   * The service-connected share of `disability` — accrued when a
   * service-stamped ailment resolves badly, WHENEVER that happens, including
   * years after discharge. This is the field the pension reads (L4-M5): not
   * a date range that would credit civilian illness during a career, and not
   * one that would miss a war wound still healing at discharge.
   */
  readonly serviceDisability: number
  /**
   * The marks in WORDS, accumulated alongside the number: "the left leg never
   * carried him the same", "hearing in one ear never came back". What a
   * retrospective says instead of a percentage. Append-only.
   */
  readonly marks: readonly string[]
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
// Military service (L4-M3)
// ---------------------------------------------------------------------------

export interface ServiceRecord {
  readonly personId: EntityId
  readonly branch: string
  readonly specialtyId: string
  /** Index into the BRANCH's own ladder (BRANCH_RANKS). Never skips. */
  readonly rank: number
  /** When the current rank was pinned on — time in grade drives junior
   *  promotions, the way it actually works. */
  readonly rankSinceTick: Tick
  /** Qualifications earned, in words ("expert marksman"). Append-only;
   *  L4-M5's award system reads these. */
  readonly qualifications: readonly string[]
  /**
   * P2. Trades held BEFORE the current one, in order — written when a
   * reenlistment retrain crosses specialties. A twelve-year mechanic who
   * finishes as a rifleman is still a trained mechanic: veteranUnlocks
   * unions across all of these (military review must-fix — the trade must
   * not vanish from the record that is foundation §10's whole point).
   */
  readonly priorSpecialtyIds: readonly string[]
  /**
   * P2. When the current specialty was entered by RETRAIN, or null when it
   * is the enlistment trade. Gates deployment (the new trade's school must
   * finish first) and times the completed-training event.
   */
  readonly specialtyChangedAtTick: Tick | null
  readonly enlistedAtTick: Tick
  /** The current posting. */
  readonly baseId: EntityId
  readonly monthlyPay: Money
  /** 0-1000, drifts with diligence like civilian work. */
  readonly performance: number
  /** Months remaining on the current term. */
  readonly termMonthsLeft: number
  /** Null while serving. THE RECORD SURVIVES DISCHARGE — a service record is
   *  the artifact a descendant finds (foundation §10). */
  readonly dischargedAtTick: Tick | null
  readonly dischargeReason: string | null
  /**
   * Sum of monthly performance across the CURRENT term (L4-M5). Good
   * conduct is judged on the term's average, not on whatever the last
   * month's noise happened to be. Reset when a new term begins.
   */
  readonly termPerformanceSum: number
  /**
   * The school this soldier is down for, or null. A seat is taken the month
   * it is granted and held until the course finishes — which is what makes a
   * class fill up and a schedule mean something.
   */
  readonly schoolId: string | null
  /** The tick that class starts. Null when not down for one. */
  readonly schoolStartsAtTick: Tick | null
  /**
   * Special unit (M-SPECOPS), or null for the line. Earned through a
   * selection that can be failed; carries duty pay and a sharper war.
   * Survives discharge with the rest of the record.
   */
  readonly unitId: string | null
  /**
   * Latest fitness test score, 0-300 promotion points (M-SPECOPS). The body
   * is one of the roads to the board; it ages, and the test says so.
   */
  readonly fitnessScore: number
  readonly fitnessTestedAtTick: Tick | null
}

// ---------------------------------------------------------------------------
// Crime & justice (C1)
//
// crime.ts is the single writer of criminal records and jail state. A map
// entry exists only for people with a history — absence IS the clean record.
// ---------------------------------------------------------------------------

/**
 * What someone was convicted of. 'theft' is C1's desperation offence, kept
 * as its own kind because its sentencing was measured and tuned before the
 * catalogue existed; every other value is an OFFENCES id (C2). A plain
 * string rather than a closed union: the catalogue is content, and content
 * should be able to grow without a type change rippling through saves.
 */
export type CrimeKind = string

export interface Conviction {
  readonly kind: CrimeKind
  /** Conviction date. */
  readonly tick: Tick
  /** Months of the sentence; 0 when the court settled on a fine. */
  readonly sentenceMonths: number
  /** The fine, cents; 0 when the sentence was time. */
  readonly fine: number
}

export interface CriminalRecord {
  readonly personId: EntityId
  /** Append-only. History never shortens (Law 6); GATES read recency. */
  readonly convictions: readonly Conviction[]
  /** Non-null while serving time. */
  readonly jailedUntilTick: Tick | null
}

// ---------------------------------------------------------------------------
// Awards (L4-M5)
//
// AWARDS ARE EARNED FROM DOCUMENTED SERVICE EVENTS, NEVER GRANTED AS
// PROGRESSION REWARDS (foundation §11). Every record points at the actual
// simulated event that qualified it — a reference, not a description — and
// eligibility is enforced in code: the grant functions REFUSE anything that
// does not qualify, and a test attempts the wrong grant and watches it fail.
// ---------------------------------------------------------------------------

export type AwardKind =
  /** A qualifying wound or death FROM ENEMY ACTION. Nothing else, ever. */
  | 'wound-recognition'
  /** Came under enemy fire — once per war, from the recorded contact. */
  | 'combat-action'
  /** A documented act under fire. Requires the recorded act, nothing else. */
  | 'valor'
  /** A term served at a distinguished average — the evaluation's decoration. */
  | 'meritorious-service'
  /** Twenty years in uniform; a device at thirty. */
  | 'long-service'
  /** Qualifying service in a war's theatre: three months, or a casualty. */
  | 'campaign'
  /** A completed enlistment term served honorably. */
  | 'good-conduct'
  /** An occupational rating, earned and recorded during service. */
  | 'qualification-badge'
  /** Meritorious service in a combat zone — the merit Bronze Star. */
  | 'combat-merit'
  /** A commendable term, below the meritorious bar. */
  | 'commendation'
  /** A single strong achievement rather than a whole term. */
  | 'achievement'
  /** Served while the country was at war, whoever they were. */
  | 'national-defense'
  /** A tour of duty outside the homeland. */
  | 'overseas'
  /** Completed the leaders course — the NCO's development ribbon. */
  | 'nco-development'
  /** Finished initial training. The first ribbon anybody gets. */
  | 'service-ribbon'
  /** Held prisoner. Earned by the capture system, ADR-0025. */
  | 'pow'
  /** A mission flown under fire. Earned by the aviation trades, ADR-0026. */
  | 'air'
  //
  // BOTH OF THE PACK'S HOLD ITEMS ARE NOW EARNABLE, which is the only
  // condition on which they were ever allowed in. 'pow' arrived with the
  // capture branch (ADR-0025) and 'air' with the aviation trades and the
  // Nighthawk Squadron (ADR-0026), both on 2026-08-02. Any future kind
  // waits for its system the same way (ADR-0024 §4).

export interface AwardRecord {
  readonly personId: EntityId
  readonly kind: AwardKind
  /** The decoration's name. REAL since ADR-0024 — "the Purple Heart".
   *  Records written before that keep the invented title they were written
   *  with, because a record is what happened. */
  readonly title: string
  /** When first awarded. */
  readonly tick: Tick
  /**
   * THE QUALIFYING EVENTS — ids of the WorldEvents that earned it, first
   * award first. A device (count > 1) keeps its own evidence: every entry
   * here earned either the medal or one of its devices.
   */
  readonly qualifyingEventIds: readonly number[]
  /** Issuing authority: the branch's name. */
  readonly issuedBy: string
  readonly citation: string
  /** Later qualifying events add a device, not a second medal. */
  readonly count: number
}

// ---------------------------------------------------------------------------
// Deployment (L4-M4)
// ---------------------------------------------------------------------------

export interface Deployment {
  readonly personId: EntityId
  /**
   * M-ARMY2. What kind of time away this is. A 'combat' tour answers a war;
   * a 'rotation' is a peacetime posting with an ally. The distinction is
   * load-bearing: peace has no enemy, so a rotation carries no combat
   * channel and earns no campaign medal — those belong to a campaign.
   */
  readonly kind: 'combat' | 'rotation'
  /** The war, by its geoRelation pair. Null on a rotation — there is none. */
  readonly warA: EntityId | null
  readonly warB: EntityId | null
  /** The enemy nation the theatre faces. Null on a rotation. */
  readonly enemyId: EntityId | null
  /** The allied nation hosting a rotation. Null on a combat tour. */
  readonly hostId: EntityId | null
  readonly startedAtTick: Tick
  /** Planned end. Null once returned (closed deployments keep their history). */
  readonly endsAtTick: Tick
  readonly returnedAtTick: Tick | null
  readonly tourNumber: number
  /**
   * Taken prisoner, and when. A captive's tour does NOT end on the calendar
   * — that is the whole truth of captivity, and closing it on schedule
   * would have them walk home on the day the orders said. It closes when
   * they are repatriated, or when they die held.
   */
  readonly capturedAtTick: Tick | null
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
  /**
   * D2. How many children the couple hoped to raise — decided and RECORDED
   * at the wedding (or on the first tick for marriages that predate the
   * model; nobody's plan is invented silently). Meaningful on spouse edges
   * only; null everywhere else and until decided. relationships.ts is the
   * single writer.
   */
  readonly familySizeAspiration: number | null
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
  /**
   * What this nation's strength recovers TOWARD in peace — the peacetime
   * weight of the country, set once at generation. Wars grind `strength`
   * below it and the years build it back. Without a baseline a recovering
   * nation would climb toward whatever ceiling the code named, and every
   * country would slowly become the same size.
   */
  readonly baseStrength: number
  readonly economy: number
  readonly stability: number
  /** Alliance bloc index, or null for the non-aligned. */
  readonly bloc: number | null
  /**
   * Combat rating, 1-10. Set at generation from the preset, or derived from
   * strength when the preset has no opinion. Fixed for the world's life —
   * what CHANGES with a country's fighting is `warMonths` below.
   */
  readonly combatRating: number
  /**
   * Cumulative months this nation has spent at war, ever, across every war.
   * Battle-hardened countries are harder to fight (owner spec): ten years of
   * war is worth a point of effective strength, to a cap of three. Counted
   * rather than drawn, so a country's toughness is a thing it earned and the
   * record can explain it.
   */
  readonly warMonths: number
  /**
   * War exhaustion: this nation starts no new escalation before this tick.
   * Set when a war it fought reaches ceasefire (10-20 years out, scaled by
   * how worn down the war left it); null for a nation that has never fought.
   */
  readonly exhaustedUntilTick: Tick | null
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
  /**
   * How long this war was always going to run, in months, rolled when it
   * broke out: 2 to 15 years, narrower at the ends when the two sides are
   * badly mismatched or evenly matched (owner spec, 2026-08-02).
   *
   * It is a CEILING, not a schedule. Weariness can still end a war early —
   * a bloodbath stops sooner than anyone planned — and the roll is what
   * stops the other kind, the war that grinds on because no draw happened
   * to land. Null on wars that predate the roll.
   */
  readonly plannedWarMonths: number | null
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
  /** A serious ailment: rest, or push on. */
  | 'convalesce'
  /** A recruiter's offer, or the fork at eighteen. */
  | 'enlist'
  /** Which uniform: the specialty choice on enlistment. */
  | 'specialty'
  /** Term's end: sign again, or hang it up. */
  | 'reenlist'
  /** The board meets (M-SERVICE-PLAY): put your name in, or let it go by.
   *  For the PLAYER, competitive rank comes only through this door —
   *  stripes are put in for, not received. */
  | 'promotion-board'
  /** A slot at an advanced school opened: take it, or pass. */
  | 'attend-school'
  /** The unit is taking names for the next rotation. The orders system
   *  can still call regardless — volunteering just stops waiting. */
  | 'volunteer-deploy'
  /** M-ARMY2. The allied country you are posted to has gone to war. Go
   *  home, or stay and fight beside them — a real tour against their
   *  enemy. otherId is the enemy; placeId is the ally. */
  | 'support-deployment'
  /** C2. The month the ledger and the empty weeks made a theft thinkable.
   *  Both roads are real: taking it, and going without. */
  | 'desperation'
  /** C2. Arrested and standing before the courthouse: plead, or be tried.
   *  monthlyPay carries what was taken. */
  | 'plea'
  /** M-ARMY2. Hit, and still conscious: the minutes that decide whether a
   *  serious wound is survived. The diagram shows where and how bad. */
  | 'first-aid'
  /** M-ARMY2. A medic's own moment: a squadmate is down. otherId is the
   *  casualty, who is a real person with a real wound. */
  | 'treat-casualty'
  /**
   * LOG-ONLY (like 'custom-birth'): the player asked after work at a
   * particular trade — a tab verb, recorded so replay stays exact. Never a
   * live question.
   */
  | 'job-application'
  /** LOG-ONLY: the player walked into the recruiting office themselves. */
  | 'walk-in-enlist'
  /** LOG-ONLY: asked for a school slot from the Service tab. */
  | 'school-request'
  /** LOG-ONLY: put in for a special unit's selection. */
  | 'unit-tryout'
  /** LOG-ONLY: took the fitness test from the Service tab. */
  | 'fitness-test'
  /** LOG-ONLY (C2): the player went and did something from the Record
   *  tab. A crime is a player INPUT and belongs in the replay log like
   *  every other one; the choice carries the offence id. */
  | 'offence'
  /** A contact that became the player's own moment: the squad pinned, and
   *  a choice that is genuinely theirs (M-HARM). */
  | 'combat-moment'
  | 'unit-moment'
  | 'deployment-order'
  /** P2. The foreman has noticed the work slipping — the modelled dismissal
   *  threshold gets a warning moment before the axe. Player-only; NPCs are
   *  simply let go, as they always were. */
  | 'foremans-warning'
  /** P2. Signing for another term asks the trade question too: keep the
   *  specialty, or retrain. Raised as a follow-up after 'stay'. */
  | 'retrain'
  /** P2 LOG-ONLY tab verbs (the custom-birth pattern): the player initiated,
   *  the entry makes replay exact, never a live question. */
  | 'court-friend'
  | 'proposal'
  | 'courtship-end'
  | 'marriage-tend'
  | 'social-call'
  | 'child-try'
  | 'walk-out'
  | 'job-quit'
  | 'raise-request'
  | 're-enrolment'
  | 'spend-stance'
  | 'house-hunt'
  | 'convalesce-stance'
  /**
   * A custom life brought into the world at the picker. NEVER raised as a
   * live question — createCustomLife writes the log entry directly, so the
   * player's inputs (name, sex, family) are part of the deterministic record
   * and seed + log still replays the world exactly.
   */
  | 'custom-birth'

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
  /** D2. Introduced to an eligible single at a town occasion — the seeking
   *  model's meeting moment. detail carries the venue. */
  | 'was-introduced'
  | 'started-courting'
  | 'courtship-ended'
  | 'married'
  /** A wedding anniversary worth marking: ten years, silver, golden. */
  | 'anniversary'
  | 'divorced'
  | 'widowed'
  | 'left-home'
  | 'moved-in-together'
  | 'moved-house'
  | 'had-child'
  /** The household could not cover the month; savings went negative. */
  | 'took-a-seat'
  | 'wartime-service'
  | 'refused-orders'
  | 'asked-exemption'
  | 'call-to-arms'
  | 'joined-war'
  | 'declined-call'
  | 'fell-behind'
  /** Savings recovered above zero after arrears. */
  | 'back-in-the-black'
  /** Money passed to this person from a parent's estate. */
  | 'inherited'
  | 'was-injured'
  | 'fell-ill'
  | 'recovered'
  | 'enlisted'
  | 'promoted'
  | 'reenlisted'
  | 'discharged'
  | 'deployed'
  | 'returned-home'
  /** Service texture (M-GAMEDEPTH): a term is a lived four years, not
   *  silence until the reenlistment question. */
  | 'began-training'
  | 'completed-training'
  | 'field-exercise'
  | 'earned-qualification'
  | 'changed-post'
  /** A decoration granted (L4-M5). The AwardRecord holds the reference to
   *  the qualifying event; this is the moment it was pinned on. */
  | 'awarded'
  /** The pension board recognized service-connected disability (L4-M5). */
  | 'granted-pension'
  /** Went before the promotion board and was not selected (M-SERVICE-PLAY).
   *  Non-selection is on the record, like selection is. */
  | 'passed-over'
  /** Asked after work and the town said no (M-SERVICE-PLAY). The answer is
   *  part of the story, like the asking was. */
  | 'turned-down'
  /** Selected for a special unit (M-SPECOPS). */
  | 'joined-unit'
  | 'unit-moment'
  | 'was-captured'
  | 'repatriated'
  | 'died-in-captivity'
  | 'aerial-mission'
  /** Went to selection and did not make it. On the record, without shame. */
  | 'dropped-selection'
  /** Scored the annual fitness test — promotion points for the body's work. */
  | 'fitness-tested'
  /** P1 — the four player choices that were recorded but invisible. Each
   *  carries its decision's tick so the Why? resolves. */
  | 'convalesced'
  | 'declined-board'
  | 'kept-heads-down'
  | 'reconciled'
  /** P2 — the verbs. Choices the player initiates, visible in the feed like
   *  every other choice (no silent state changes; the P1 principle). */
  | 'tended-marriage'
  | 'spent-time'
  | 'warned-at-work'
  | 'changed-spending'
  /** Crime & justice (C1). The thief's own timeline knows what they did. */
  | 'committed-theft'
  | 'was-robbed'
  | 'was-arrested'
  | 'was-convicted'
  | 'was-acquitted'
  | 'released-from-jail'
  /** Wounded by enemy action on deployment — distinct from civilian injury,
   *  because award eligibility will read the difference (L4-M5). */
  | 'wounded-in-action'
  /** Came under fire and walked away — contact is not casualty. The texture
   *  of a real tour, and what combat-action recognition reads. */
  | 'saw-combat'
  /** A documented act under fire — the player's own recorded choice, and
   *  the ONLY thing valor recognition may ever read (foundation §11). */
  | 'act-of-valor'
  /** C2. The desperation moment answered the other way — a life that
   *  stayed honest while it was hard, which the record should keep. */
  | 'went-without'
  /** M-ARMY2. Field aid worked on a wound — the player's own, or a
   *  medic's on a squadmate (otherId). */
  | 'field-aid'
  /** M-ARMY2. A company punishment — the mistake at base, on the record.
   *  detail carries the infraction; a third inside five years ends the
   *  career by misconduct discharge. */
  | 'disciplined'
  /** M-ARMY2. The recruiters set up in town for a season (subject is the
   *  homeland nation id — a town fact, invisible to person timelines).
   *  serviceNewsSince reads these; the season also multiplies enlistment
   *  propensity while it runs. */
  | 'recruiting-drive'
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
  | 'convalescence'
  | 'enlistment'
  /** A rank pinned on — its own kind, so "why did they enlist?" and "why
   *  were they promoted?" never answer each other's question. */
  | 'promotion'
  /** A decoration granted — explained by its qualifying service. */
  | 'award'
  /** The pension board's finding — explained by the recorded disability. */
  | 'pension'
  /** A school attended (M-SPECOPS) — its own kind, so a same-month
   *  selection's Why? never answers with the schoolhouse. */
  | 'training'
  /** A special unit's selection, made or missed. */
  | 'selection'
  /** A crime committed — motive on the record at the moment (C1). */
  | 'crime'
  /** D2. The family the couple hoped for — sized at the wedding, cut only
   *  by recorded hardship. */
  | 'family'
  /** The court's answer — verdict and sentence, citing the charge. */
  | 'justice'
  | 'deployment'
  | 'geopolitics'
  /** P2. The household's chosen spending posture — a standing money choice
   *  that is neither a move nor an employment change. */
  | 'spending'

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
  | 'regional-flashpoint'
  | 'internal-instability'
  | 'war-weariness'
  | 'alliance-obligation'
  | 'reluctant'
  | 'ally-in-distress'
  | 'heavy-casualties'
  | 'old-grudge'
  | 'long-peace'
  | 'steady-pay'
  | 'way-out-of-town'
  | 'service-tradition'
  /** M-ARMY2. The recruiters were in town — the season people walk in. */
  | 'recruiting-drive'
  | 'term-ended'
  | 'medically-unfit'
  | 'time-in-grade'
  | 'strong-performance'
  | 'holds-qualification'
  | 'enemy-action-wound'
  | 'campaign-service'
  | 'honorable-term'
  | 'qualification-earned'
  | 'service-disability'
  | 'desperation'
  | 'witnessed'
  | 'prior-record'
  | 'clean-record'
  | 'jail-sentence'
  /** D2. The pull toward building a family — drives seeking and weddings. */
  | 'wants-a-family'
  | 'under-orders'
  | 'war-demanded-troops'
  | 'enemy-capability'
  | 'war-phase'
  | 'convoy-exposure'
  | 'direct-combat-exposure'
  | 'base-attack-exposure'
  | 'battlefield-accident'
  | 'battlefield-chaos'
  | 'threat-level'
  | 'unit-standard'
  | 'tour-complete'

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
  /**
   * The preset that made this world (W1). Chosen at creation, IMMUTABLE for
   * the world's life, and recorded in the SAVE HEADER by its id rather than
   * in the engine's own snapshot — the fingerprint describes the town, and
   * the preset is an input to it like the seed. On load the id is resolved
   * back to a spec with specById().
   */
  readonly spec: WorldSpec
  /**
   * The preset id AS WRITTEN in the save, which is not always spec.id.
   *
   * specById falls back to Classic for a preset this build does not know, so
   * a world saved by a LATER build and opened here runs on Classic content —
   * correct, and better than refusing to load. But writing spec.id back out
   * would then overwrite the world's true identity with 'classic', and the
   * autosave fires 600ms after any change, so the loss would be silent and
   * permanent (persistence review, W1). This field is what gets written
   * back: what the world says it is, even when this build cannot serve it.
   */
  readonly presetId: string
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
  /** L4-M2. Keyed by personId; single writer is the health system. */
  readonly health: Map<EntityId, HealthRecord>
  /** L4-M3. Keyed by personId. Records SURVIVE discharge. */
  readonly service: Map<EntityId, ServiceRecord>
  /** Decorations per person, append-only. Written only through awards.ts. */
  readonly awards: Map<EntityId, AwardRecord[]>
  /** Criminal records; entry only where history exists. crime.ts writes. */
  readonly criminal: Map<EntityId, CriminalRecord>
  /** L4-M4. Keyed by personId: every tour, open and closed. History persists. */
  readonly deployments: Map<EntityId, Deployment[]>
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
