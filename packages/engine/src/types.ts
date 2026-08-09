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
  /**
   * M-MONEY2. HOW THIS PERSON CARRIES THEIR OWN MONEY, or null for the
   * character-driven default.
   *
   * It used to live on the HOUSEHOLD, which meant a parent's posture
   * governed the spending of every grown adult under the roof (owner:
   * "why would my parents control my spending when I'm a grown man after
   * 18"). It is a person's own now, and a couple share theirs — see
   * financialUnitOf — because a couple genuinely do.
   */
  readonly spendStance: SpendStance | null
  /**
   * The body, 0-300, owned by `stats.ts`. Zero below twelve, when a
   * childhood is not yet a stat. The service record READS this — it used
   * to own it, which meant a civilian had no fitness at all and a life
   * spent idle arrived at the recruiting station in the same shape as a
   * life spent otherwise.
   *
   * Optional so a save written before the stats panel loads unchanged; the
   * first tick gives everybody old enough their own number.
   */
  readonly fitness?: number
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
  /**
   * The officer ladder, junior to senior, and its O-grades. A separate
   * ladder because an officer is not a senior enlisted person: they enter
   * somewhere else and go somewhere else.
   *
   * Optional so a preset written before commissions existed still loads —
   * a branch without one simply has no officers.
   */
  readonly officerRanks?: readonly string[]
  readonly officerGrades?: readonly number[]
  /** First ladder index that takes a promotion board; below is time-in-grade. */
  readonly competitiveFrom: number
  /** Months in grade before the next JUNIOR promotion, by current rank. */
  readonly juniorTigMonths: readonly number[]
  /**
   * M-ENLIST §5c. How this branch hands out officer jobs. Optional so a
   * preset written before the officer track loads unchanged; absent behaves
   * as 'needs-assigned', which is the least player-choice of the three and
   * therefore the safe default.
   */
  readonly officerAccession?: OfficerAccession
  /** M-ENLIST §5b. What the branch's moments look like when a job has none. */
  readonly combatFlavor?: 'ground' | 'sea' | 'air'
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

/** M-ENLIST §2. What a job is FOR, which decides which moments it meets. */
export type MosField =
  | 'combat'
  | 'technical'
  | 'medical'
  | 'logistics'
  | 'admin'
  | 'intel'
  | 'aviation'
  | 'ordnance'

/** M-ENLIST §5c. How a branch hands its officers their jobs. They differ. */
export type OfficerAccession = 'community-select' | 'merit-branch' | 'needs-assigned'

/**
 * M-ENLIST §5c. AN OFFICER'S JOB, which is not an enlisted one.
 *
 * A separate catalogue from the specialties, because the two are separate
 * things: an infantryman holds 11B and an infantry officer holds 11A, and
 * the officer's job is to command the people holding the first.
 */
export interface OfficerRole {
  readonly id: string
  /** '13A', '1310', '11X'. */
  readonly code: string
  readonly title: string
  readonly field: MosField
  readonly branch: string
  /** How often a combat moment fires for this role, per mille. */
  readonly combatWeight: number
  /** A seeded selection gate on top of the accession — pilot, special warfare. */
  readonly competitive?: boolean
  readonly minAptitude?: number
  /** Which moments this role can meet. */
  readonly sceneTags: readonly string[]
  readonly exposure: ExposureProfile
  readonly civilianUnlocks: readonly string[]
}

export interface ServiceSpecialty {
  readonly id: string
  readonly title: string
  /**
   * M-ENLIST §2. The job's CODE — '11B', 'HM', '3P0'.
   *
   * Real codes, on the owner's explicit override of the fictional-entity
   * rule for jobs. Named UNITS stay fictional everywhere, which is the line
   * the charter actually draws (§3): a code is a job title, a unit is a
   * body of real people with real casualties.
   */
  readonly code?: string
  readonly field?: MosField
  /** The entry-test score this job asks for, 1-99. Absent means open. */
  readonly minAptitude?: number
  /** What signing for it pays, in integer cents, base-year money. */
  readonly bonusCents?: Money
  /** How often a combat moment fires for it, per mille. */
  readonly combatWeight?: number
  /**
   * M-ENLIST §5b. WHICH MOMENTS THIS JOB CAN MEET.
   *
   * The whole point: a medic gets mass-casualty calls and never a door
   * breach, a sailor's crisis happens aboard ship, a mechanic's happens on
   * a flightline. Empty falls back to the branch's own flavour.
   */
  readonly sceneTags?: readonly string[]
  /**
   * What the same trade is called by the person COMMISSIONED into it.
   *
   * An officer does not hold an enlisted job (military review, should-fix 4):
   * the record used to read "commissioned into the United States Army as a
   * rifleman", and the contract printed 2LT beside "Assigned Specialty:
   * rifleman". Every trade keeps an officer's name for itself rather than
   * some trades being closed, because closing them would leave the naval
   * branch — which has exactly one specialty — with no officers at all.
   */
  readonly officerTitle?: string
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

  // ---- M-SCHOOL (owner's schoolhouse remodel spec) --------------------
  //
  // WHAT WAS MISSING. A school was a flat gate: clear the rank and the
  // evaluation, wait for a class, and the badge was yours. Nobody was ever
  // turned down for a seat and nobody ever washed out. The three forces the
  // spec names — the unit decides you have earned a scarce seat, hard
  // schools are genuinely hard, and a failure has a road back — had nothing
  // to hang on.

  /**
   * What kind of school this is, which decides how it behaves.
   *
   *  'pme'        promotion education. Rarely washes anybody out — the
   *               difficulty is GETTING THE SEAT in time to promote.
   *  'skill'      a badge and a capability. Some are easy, some are hard.
   *  'selection'  a gateway, not a course. Few seats, heavy attrition,
   *               and the service is choosing rather than teaching.
   */
  readonly category: 'pme' | 'skill' | 'selection'

  /**
   * Wash-out weight, per thousand, BEFORE the soldier's own fitness,
   * aptitude and standing move it. Not a probability the player ever sees
   * as a number — the tab shows it as a difficulty read.
   *
   * TUNED RELATIVELY, from the ranges the owner's spec cites: an airborne
   * course passes the large majority, air assault washes a share at day
   * zero, a ranger course graduates roughly half on a first attempt with
   * recycles common, and special-forces selection is more selective still.
   * Those are the SHAPE. The numbers here are this game's, and they want
   * measuring against a grown world before anybody trusts them.
   */
  readonly difficulty: number

  /**
   * How rare a seat is, per thousand, as the unit's own quota. Higher is
   * rarer. This is the "they only send a couple" reality, and it is the
   * thing that replaced a flat one-in-seventy-two roll for every course in
   * the catalogue regardless of how precious it was.
   */
  readonly seatScarcity: number

  /** Lifetime seats the unit will fund. A wash-out is a setback, not a wall. */
  readonly maxAttempts: number

  /**
   * Whether a phase can be repeated before the attempt is called a failure.
   * Costs time, costs nothing on the record — which is what a recycle is.
   */
  readonly recycleAllowed?: boolean

  /** Months in uniform before the unit will spend a seat on somebody. */
  readonly minTimeInServiceMonths?: number
  /** The aptitude floor, read off the score the recruiting station set. */
  readonly minAptitude?: number
  /** The fitness standard to START. Some courses test you on day zero. */
  readonly minFitness?: number
  /** A prior school this one is built on top of. */
  readonly prereqBadges?: readonly string[]
  /** Board points beyond POINTS_PER_BADGE, for the courses that carry weight. */
  readonly pointsBonus?: number

  /**
   * WHICH LADDER THIS COURSE IS FOR. Undefined means both.
   *
   * The NCO professional development courses are enlisted education —
   * "the Basic Leader Course" is where a specialist learns to be a
   * sergeant, and no captain has ever attended one. `meetsRankGate`
   * returns true for every commissioned officer (correctly: a lieutenant
   * really can go to jump school, and comparing an enlisted rank index
   * against the officer ladder is meaningless), so without this an officer
   * cleared every NCO course's gate and read the whole NCOES catalogue as
   * though it were his (owner, playing: "I'm seeing officers seeing NCO
   * courses").
   *
   * Skill schools leave this undefined on purpose. Airborne, Ranger and
   * the rest take both.
   */
  readonly track?: 'enlisted' | 'officer'

  /**
   * M-PROMO. The PAY GRADE this course gates, if it gates one.
   *
   * The classic mapping the owner's `army_promotions_fix.md` recommends:
   * each rank is earned by finishing ITS school — BLC makes sergeant, ALC
   * makes staff sergeant, and so on up. Set to 5 on the course that gates
   * E-5.
   *
   * NOTE FOR WHOEVER READS THIS LATER AND THINKS IT IS A BUG: the real
   * Army's literal prerequisite shifted UP one grade in June 2024, so that
   * BLC became the requirement for E-6 rather than E-5. The owner's spec
   * chose the classic mapping deliberately — it is cleaner, it is how the
   * courses are described to the people taking them, and it will not date
   * the way a backlog-driven change does. This is a decision, not an
   * oversight.
   *
   * Grade, not rank index, so one number works across three ladders whose
   * indices do not line up.
   */
  readonly gatesGrade?: number
}


/** One go at one course, and how it ended (M-SCHOOL §5). */
export interface SchoolAttempt {
  readonly schoolId: string
  readonly tick: Tick
  /**
   * 'graduated' — the badge was pinned on.
   * 'failed'    — returned to unit, no badge, an attempt spent.
   * 'injured'   — a medical drop. Costs the course, NOT the attempt: you
   *               did not quit, you got hurt, and the spec is explicit
   *               that this must not count against you.
   */
  readonly outcome: 'graduated' | 'failed' | 'injured'
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

/**
 * ONE PERSON'S MONEY (M-ECON §1).
 *
 * Every person holds their own accounts. Pay lands in checking; what they
 * choose to put by sits in savings; the two investment accounts arrive with
 * the market and are zero until then.
 *
 * WHAT THIS REPLACES: a single pot per roof, into which every wage went and
 * out of which everything was paid — so a working adult's money was not
 * theirs, an inheritance came from a house rather than from a person, and
 * there was nowhere for a personal surplus to exist. The household keeps
 * its SHARED OBLIGATIONS (rent and living costs), funded from the people
 * who live there; what is left over stays with whoever earned it.
 *
 * Integer cents throughout (ADR-0008). Absent from the map means zero: a
 * newborn has no accounts until money reaches them, and reading is total.
 */
export interface Accounts {
  readonly personId: EntityId
  /** Pay lands here; the household's call on it is met from here. */
  readonly checking: Money
  /** What they have deliberately put by. Earns interest once rates exist. */
  readonly savings: Money
  /** M-ECON §5, zero until the market exists. */
  readonly brokerage: Money
  /**
   * M-ECON §5, tax-advantaged. Cash in the retirement account; its holdings
   * ride the market like any other but pay no capital-gains tax, which is
   * the whole point of it over a life this long.
   */
  readonly retirement: Money
  /** What the brokerage actually owns. */
  readonly holdings: readonly Holding[]
  /** What the retirement account owns. */
  readonly retirementHoldings: readonly Holding[]
  /** M-ECON §6: what they owe, and to what. */
  readonly loans: readonly Loan[]
  /** The place they OWN, if they bought one. Null means they rent. */
  readonly homePlaceId: EntityId | null
  /** What the home cost. Its value today drifts with prices. */
  readonly homePurchasePrice: Money
  /** Months of loan payments met. The thing a score is built from. */
  readonly monthsPaid: number
  /** Defaults on the record. The thing that breaks it. */
  readonly defaults: number
  /**
   * THE TAX YEAR SO FAR (M-ECON §3). Gross income and the tax already
   * withheld from it, both reset when the return is filed. The return
   * settles the difference between what was withheld and what is actually
   * owed — which is the refund, or the bill.
   */
  readonly taxableYtd: Money
  readonly withheldYtd: Money
  /**
   * M-SAFETY §4. THE WORK RECORD A PENSION IS BUILT FROM.
   *
   * Months in which this person earned — a wage, service pay, either. The
   * state pension scales with it, which is what makes a working life worth
   * something after it ends. Counted rather than derived because the
   * employment record does not survive the job, and Law 6 says history is
   * kept, not recomputed from a gap.
   */
  readonly monthsWorked: number
  /**
   * What they last earned in a month, kept after the job ends. Unemployment
   * insurance is a share of it, so it has to outlive the wage.
   */
  readonly lastMonthlyPay: Money
  /**
   * M-SAFETY §4. Unemployment insurance runs until this tick, or null when
   * they are not drawing it. Set by a LAYOFF — being sacked for cause and
   * walking out do not qualify, which is how the real thing works.
   */
  readonly unemploymentUntilTick: Tick | null
}

/**
 * M-SAFETY §2. A BANKRUPTCY, on the public record.
 *
 * Modelled on the structure of United States bankruptcy law, which is public
 * law and fine to model. Every NAME here is generic and fictional — this
 * world has no trademarked programs in it (charter §3).
 *
 *   Chapter 13 — REORGANISATION, for somebody with income. A court-approved
 *   plan of three to five years; the home and the basics are kept; arrears
 *   are caught up on a schedule and what is left at the end is resolved.
 *
 *   Chapter 7 — LIQUIDATION, for somebody with little or none, and
 *   means-tested. What is not exempt is sold, most unsecured debt is
 *   discharged, and it is a genuine fresh start at zero.
 *
 * Both put an automatic stay over repossession while they run, and both sit
 * on the credit file for years afterwards — seven and ten — which is the
 * same door the criminal record uses (C3 §5): shut, and openable again.
 */
/**
 * M-CAREER §5. A BUSINESS. Persisted, so it lives here beside every other
 * entity the save carries; business.ts holds what one DOES.
 */
/**
 * WHAT THE CASINO KNOWS ABOUT SOMEBODY (casino spec §2, §5).
 *
 * Every field here is EARNED rather than issued. A person who has never
 * been through the doors has no record at all, which is the honest default
 * and also what makes the migration trivial.
 */
export interface GamblingRecord {
  readonly personId: EntityId
  /**
   * CHIPS ON HAND, in cents of face value (owner: "chips you buy from a
   * cashier that is separate funds from everything").
   *
   * The single most important consequence: this is ALL you can lose
   * tonight. A bad session cannot reach your savings, your rent or your
   * children's tuition — it can only empty the tray. Reaching those takes
   * a deliberate second act, which is walking back to the cashier, and
   * that act is the one the addiction model watches.
   *
   * Owned by casino.ts. Cents are finances'; chips are these. The cashier
   * is the only place the two ever meet.
   */
  readonly chips: Money
  /** 0-1000, and it only moves by playing and studying (spec §3). */
  readonly pokerSkill: number
  /** Hours at the tables, ever. The thing skill is actually made of. */
  readonly hoursPlayed: number
  /** Lifetime, in cents. Negative for almost everybody, which is the point. */
  readonly lifetimeNet: number
  /** Cents wagered across everything, ever — the denominator for trouble. */
  readonly lifetimeWagered: number
  /**
   * 0-1000. How much of a hold this has (spec §2, "modeled responsibly").
   *
   * Rises with chasing — playing more after losing — and falls with time
   * away. It is NOT a moral score and nothing in the model calls it one:
   * what it does is make somebody play when they should not and bet more
   * than they meant to, which is what the thing actually does to people.
   */
  readonly hold: number
  /** The tick they last played. Time away is what recovery is made of. */
  readonly lastPlayedTick: Tick | null
  /** When they admitted it was a problem and started doing something. */
  readonly inRecoverySinceTick: Tick | null
  /** Best tournament finish ever, for the record. Null if never cashed. */
  readonly bestFinish: number | null
  /** Whether poker is what they do for a living (spec §2, "going pro"). */
  readonly turnedProAtTick: Tick | null
  /**
   * THE LAST THING THAT HAPPENED, for the results screens (spec §2b:
   * "shown after EVERY tournament and cash session").
   *
   * Kept on the record rather than returned and forgotten, because the
   * screen that shows it renders on a later frame than the verb that
   * produced it — the worker settles, the world is posted back, and only
   * then does anything draw. A result that lived only in a return value
   * would be gone by the time there was anywhere to put it.
   */
  readonly lastSession?: SessionSummary
  readonly lastTournament?: TournamentSummary
}

/** The cash-game recap (spec §2b). Presentation of an already-seeded night. */
export interface SessionSummary {
  readonly tick: Tick
  readonly stakeTitle: string
  readonly hours: number
  readonly hands: number
  readonly net: number
  readonly perHour: number
  readonly biggestPot: Money
  readonly chipsAfter: Money
  readonly words: string
}

/** The tournament payout screen (spec §2b). */
export interface TournamentSummary {
  readonly tick: Tick
  readonly title: string
  readonly field: number
  readonly finish: number
  readonly payout: Money
  readonly bounties: Money
  readonly buyIn: Money
  readonly net: number
  readonly hours: number
  readonly chipsAfter: Money
  readonly words: string
}

/**
 * AN ATHLETIC CAREER (sports spec).
 *
 * Absent for almost everybody, which is the honest default: most people
 * never join a team, and of those who do almost none go anywhere. A person
 * with no record here simply never played.
 */
export interface AthleteRecord {
  readonly personId: EntityId
  readonly sport: string
  readonly positionId: string
  /** 'school' | 'highschool' | 'college' | 'pro' | 'done'. */
  readonly level: string
  /**
   * Position skills AND the athletic base, 0-99 each, in one bag.
   *
   * ONE MAP RATHER THAN TWO because a stat is a stat: strength matters to
   * a lineman as a skill and to everybody as a base, and splitting them
   * would mean deciding which bucket every new number goes in for ever.
   */
  readonly stats: Readonly<Record<string, number>>
  /** The ceiling they were born with, 0-99. Never shown as a number. */
  readonly potential: number
  /** 0-1000. Training raises it; rest is the only thing that lowers it. */
  readonly fatigue: number
  readonly seasons: number
  readonly careerGames: number
  readonly careerPoints: number
  /** Where they were taken, or null for undrafted and for everybody else. */
  readonly draftPick: number | null
  readonly teamName: string
  /** Cents a month, base-year. Zero until somebody is paying them. */
  readonly wage: Money
  readonly turnedProAtTick: Tick | null
  readonly retiredAtTick: Tick | null
  /** Why the road ended, in plain words. Empty while it has not. */
  readonly endedBecause: string
  readonly lastSeason?: SeasonLineRecord
  /** College offers standing right now, if any. */
  readonly offers?: readonly OfferRecord[]
  /**
   * COMBAT ONLY, and the spec is blunt about why it exists: "your record
   * is your identity". A fighter is not a rating to anybody who matters —
   * they are 14-3 with nine finishes, and that string is what gets them
   * signed, ranked and given a title shot.
   */
  readonly wins?: number
  readonly losses?: number
  readonly finishes?: number
  /** 1-15 once ranked, 0 unranked. Champion is its own flag. */
  readonly ranking?: number
  readonly champion?: boolean
  readonly titleDefences?: number
  /** Soccer only: 1 is the top flight, higher is further down. */
  readonly tier?: number
  /**
   * 0-1000. HOW MANY PEOPLE KNOW WHO YOU ARE (sports spec §"Money, fame").
   *
   * Earned by playing well at a level anybody watches, and it decays: fame
   * is a thing you keep paying for. It is NOT a reward — it buys
   * endorsement money and it costs wellbeing and privacy, and the spec
   * wants both halves.
   */
  readonly fame?: number
  /** Cents a month from endorsements, base-year. Stars only. */
  readonly endorsements?: Money
  /** What they did after. Empty while still playing. */
  readonly secondAct?: string
}

export interface SeasonLineRecord {
  readonly games: number
  readonly points: number
  readonly rebounds: number
  readonly assists: number
  readonly shootingPerMille: number
  readonly teamWins: number
  readonly teamLosses: number
}

export interface OfferRecord {
  readonly id: string
  readonly programme: string
  readonly blurb: string
  readonly ride: string
  readonly strength: number
}

/**
 * HOW BAD A COMBAT MOMENT IS, and the three answers to it.
 *
 * These live here rather than in `scenes.ts` for a structural reason: the
 * per-role scene pools in `mosscenes.ts` are built from `CombatScene`, and
 * `scenes.ts` assembles the catalogue from those pools. With the type in
 * `scenes.ts` the two files imported each other and the import-graph test
 * refused it — correctly. A shared TYPE in the shared type module is the
 * seam; both files depend on this one and neither on the other.
 */
export type Threat = 'light' | 'heavy' | 'overrun'

export type SceneChoice = 'push' | 'hold' | 'cover'

/**
 * One scene: the situation, and what the three answers are CALLED in it.
 *
 * Only the flavour changes between scenes — the spectrum underneath is
 * always the same, which is what keeps a catalogue this size from becoming
 * that many sets of rules nobody can hold in their head.
 */
export interface CombatScene {
  readonly id: string
  /** Which trade or situation it belongs to; empty means anyone, anywhere. */
  readonly channels: readonly string[]
  /** What the player is told, by threat level — the read. */
  readonly tell: Readonly<Record<Threat, string>>
  /** What each answer is called here. */
  readonly labels: Readonly<Record<SceneChoice, string>>
  /** What the record says they did. */
  readonly did: Readonly<Record<SceneChoice, string>>
  /** Serving in this unit only, or null for anyone. */
  readonly unitId: string | null
  /** Units take the sharper jobs: bias the threat roll upward. */
  readonly biasToward: Threat | null
  /**
   * WHICH TRADES THIS MOMENT BELONGS TO, in the same vocabulary the
   * specialties and officer roles carry (`sceneTags`).
   *
   * The channel says what FOUND them — a road, a wire, a doorway. This
   * says whose day it is.
   */
  readonly tags: readonly string[]
  /** Officers only, where the moment is a command decision. */
  readonly officersOnly?: true
}

export interface Business {
  readonly id: EntityId
  readonly ownerId: EntityId
  readonly kindId: string
  /** Fictional, like every business in this world (charter §3). */
  readonly name: string
  readonly foundedTick: Tick
  /** What is in it. Grows with retained profit, shrinks with losses. */
  readonly capital: Money
  readonly employees: number
  /** Consecutive months in the red. Three closes it. */
  readonly badMonths: number
  /** Null while trading. */
  readonly closedTick: Tick | null
  /** How many times it has changed hands. Legacy, on the record. */
  readonly generations: number
  /**
   * WHEN IT STOPPED BEING A TRADE AND BECAME A COMPANY (careers overhaul,
   * Fix 3B). Null on every ordinary business, which is almost all of them.
   *
   * Past this point the capital ceiling lifts, the owner draws a salary
   * instead of the profit, and the thing carries a VALUATION — which is
   * what an IPO needs and a market stall does not have.
   */
  readonly scaledAtTick?: Tick | null
  /**
   * Shares in issue once it is public, and who holds what. Both null until
   * the IPO. The PRICE is not here: the market owns every price in this
   * world, and a second copy of one is a second source of truth.
   */
  readonly listedStockId?: string | null
  /** Per-mille of the company the founder still holds after the float. */
  readonly founderStakePerMille?: number
}

export type BankruptcyChapter = 7 | 13

export interface Bankruptcy {
  readonly personId: EntityId
  readonly chapter: BankruptcyChapter
  readonly filedAtTick: Tick
  /** What was owed when it was filed — the record of how deep it went. */
  readonly owed: Money
  /** Chapter 13's monthly payment. Zero under chapter 7. */
  readonly planMonthly: Money
  /** When the plan finishes. Null under chapter 7, which has no plan. */
  readonly planEndsAtTick: Tick | null
  /** When the debt was actually wiped. Null while a plan is still running. */
  readonly dischargedAtTick: Tick | null
  /** How much the discharge wiped, for the record and the newspaper. */
  readonly discharged: Money
}

/**
 * THE WEATHER (M-ECON §4). Where the economy is, and what it is doing.
 * All integer: rates and growth in per-mille, the index in basis points.
 */
export type EconomyPhase = 'expansion' | 'peak' | 'recession' | 'depression' | 'recovery'

export interface EconomyState {
  readonly phase: EconomyPhase
  readonly phaseSinceTick: Tick
  /** Annualised, per-mille. Negative in a downturn. */
  readonly growthPerMille: number
  readonly inflationPerMille: number
  /** Share of those who want work and have none, per-mille. */
  readonly unemploymentPerMille: number
  /** The central bank's rate: what savings earn and what loans cost. */
  readonly ratePerMille: number
  /** Basis points from a 10,000 start. */
  readonly marketIndex: number
  /** Compounded price drift since the world began; 1000 is the start. */
  readonly priceLevelPerMille: number
}

/**
 * A stake in one sector (M-ECON §5). Units, and what they cost — the cost
 * basis is what makes a capital GAIN a gain rather than a sale price.
 */
export interface Holding {
  readonly sectorId: string
  readonly units: number
  readonly costBasis: Money
  /**
   * SHARES IN A NAMED COMPANY, or absent for units of the sector fund
   * (spec §7).
   *
   * Added rather than replacing `sectorId`, and that is the whole
   * migration: the spec suggests converting existing sector holdings into
   * "sector-fund instruments", but they ALREADY ARE that — a holding with
   * no company named is exactly a fund position, and always was. Nobody's
   * portfolio has to be rewritten to mean what it already meant.
   *
   * `sectorId` stays populated either way, so a company holding still
   * knows which sector it belongs to without a lookup.
   */
  readonly stockId?: string
}

export type LoanKind = 'personal' | 'auto' | 'mortgage' | 'student'

/**
 * MONEY OWED (M-ECON §6). One debt, its rate fixed at signing — a loan does
 * not re-price when the central bank moves, which is the whole reason the
 * month you sign matters.
 */
export interface Loan {
  readonly kind: LoanKind
  readonly principal: Money
  readonly balance: Money
  /** Fixed at signing, per-mille, annual. */
  readonly ratePerMille: number
  readonly monthlyPayment: Money
  readonly takenAtTick: Tick
  readonly maturesAtTick: Tick
  /** Consecutive months missed. Three is a default. */
  readonly missedMonths: number
}

export interface Household {
  readonly id: EntityId
  readonly placeId: EntityId
  /**
   * The specific home, where one is known. Null for a household that
   * predates the property model or lives somewhere untracked — `placeId`
   * remains the authority on WHICH STREET, and this narrows it to a door.
   */
  readonly propertyId?: string | null
  readonly memberIds: readonly EntityId[]
  readonly formedTick: Tick
  /** Null while active. */
  readonly dissolvedTick: Tick | null
  /**
   * The household's SHARED OBLIGATIONS balance, in integer cents (ADR-0008).
   *
   * No longer the family pot (M-ECON §1). Rent and living costs are paid
   * from here, and the people who live here fund it from their own checking
   * in proportion to what they earn. In a month that is met it returns to
   * zero; NEGATIVE MEANS ARREARS, which has consequences and is not clamped
   * away. A surplus never accumulates here — it stays with whoever earned
   * it, which is the whole point of the split.
   *
   * finances.ts remains the single writer.
   */
  readonly savings: Money
  /**
   * P2. A chosen spending posture, or null for the character-driven default
   * (discretionaryFor's diligence formula). Only a played household ever sets
   * it — NPC households stay null, so a world played by nobody is unchanged.
   * Schema v18.
   */
  readonly spendStance: SpendStance | null
  /**
   * M-SAFETY §3. WHEN THEY LOST THE ROOF, or null while they have one.
   *
   * Homelessness is a modelled STATE, not a crash and not an ever-deepening
   * debt: no rent is charged, a shelter floor keeps people alive, and the
   * consequences are real — health, work, relationships and exposure to
   * crime. It is the bottom of the ladder and never a dead end; income buys
   * a room back. `placeId` is kept so the record still says which street
   * they were pushed out of.
   */
  readonly homelessSinceTick: Tick | null
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

/**
 * One thing that moved a life's morale, and what to call it on the screen.
 * Bounded: a person keeps only their last few.
 */
/**
 * Something a person has taken up and keeps doing.
 *
 * The spec's whole point about activities: *"an activity is a HABIT with a
 * modelled trajectory... not a +5 click."* You do not buy fitness, you take
 * up running, and then the months do the work — or you stop, and the months
 * undo it.
 */
export type HabitKind = 'training' | 'study' | 'social'

export interface HabitRecord {
  readonly personId: EntityId
  /** What they keep doing, and since when. */
  readonly active: readonly { readonly kind: HabitKind; readonly sinceTick: Tick }[]
  /**
   * Study accrued, 0–1000, feeding Smarts.
   *
   * IT DOES NOT DECAY, and that is the difference between a mind and a
   * body. Conditioning is lost when you stop training — the fitness target
   * drops and the body drifts down to meet it. What you have learned is
   * simply yours.
   */
  readonly studied: number
}

/**
 * A REAL HOME (owner's `real_estate_revamp.md`).
 *
 * Owning used to be `accounts.homePlaceId` — a pointer at a NEIGHBOURHOOD,
 * with the house's worth derived from that street's rent. You chose a
 * street, never a home. This is the home.
 *
 * It sits inside a neighbourhood rather than replacing it, so the whole
 * desirability model keeps working underneath and nothing about the old
 * economy is thrown away.
 */
export type PropertyType = 'house' | 'condo' | 'townhouse' | 'apartment' | 'estate'

export interface Property {
  readonly id: string
  readonly neighbourhoodPlaceId: EntityId
  readonly address: string
  readonly type: PropertyType
  readonly beds: number
  readonly baths: number
  readonly sqft: number
  /** Zero for anything without land of its own. */
  readonly lotSqft: number
  readonly yearBuilt: number
  /** 0-1000. Degrades with the years; repairs and renovations raise it. */
  readonly condition: number
  /**
   * WHO OWNS IT (owner, playing: "we still can't see houses we buy if we get
   * multiple or sell houses we buy").
   *
   * Ownership used to be one field on one person's bank accounts —
   * `accounts.homePlaceId` — which meant a person could own exactly one
   * home, and it was a NEIGHBOURHOOD rather than a house. Buying a second
   * silently overwrote the first.
   *
   * The deed belongs on the property. One owner, many properties, and the
   * question "what do I own?" is a filter rather than a field.
   */
  readonly ownerId?: EntityId | null
}

/**
 * A TENANCY (real estate §4). Renting used to be the absence of owning —
 * you lived on a street and the street charged you. A lease is an agreement
 * about a specific home: a deposit you get back, a rent that is the
 * property's rather than the postcode's, and a term that ends.
 */
export interface Lease {
  readonly propertyId: string
  readonly householdId: EntityId
  readonly monthlyRent: Money
  /** Held by the landlord, returned at the end if the place is sound. */
  readonly depositCents: Money
  readonly startedAtTick: Tick
  /** When it comes up for renewal. */
  readonly endsAtTick: Tick
}

export interface WellbeingCause {
  readonly tick: Tick
  /** Signed, and already softened by resilience if it was a blow. */
  readonly delta: number
  /** Plain words for the panel — "Out of work", "Taken prisoner". */
  readonly words: string
}

export interface WellbeingRecord {
  readonly personId: EntityId
  /** 0–1000, the same scale the traits use. */
  readonly value: number
  readonly causes: readonly WellbeingCause[]
}

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

/**
 * THE FULL SCHOOL LADDER (owner's `education_module_master.md` §0.5).
 *
 * Childhood should be "a lived stage, not a blur you skip to age 18", so
 * middle school exists between elementary and high school rather than the
 * two of them covering twelve years in one jump.
 *
 * `secondary` still means THE DIPLOMA and every occupation that requires it
 * keeps its exact meaning — `meetsRequirement` compares ranks, so inserting
 * a rung shifts the numbers without shifting what any of them mean. The one
 * thing that could have broken was code comparing a rank to a LITERAL, and
 * there were three of those; they ask `isHigherEducation` by name now.
 */
export type EducationLevel =
  | 'none'
  | 'primary'
  | 'middle'
  | 'secondary'
  | 'trade'
  | 'college'
  | 'graduate'

/**
 * A LISTED COMPANY (owner's `stock_market_revamp.md` §1).
 *
 * The sector engine was never the problem — the owner's own words: "the
 * engine is fine; the experience is missing." You could buy units of four
 * sectors and there was nothing to tap into: no company, no chart, no
 * identity.
 *
 * So a stock sits ON TOP of a sector rather than replacing it. The sector
 * still supplies the systematic move — the thing every company in it does
 * together — and the company adds how hard it takes that move, plus noise
 * that is its own. Fictional names and tickers in REAL sectors, which is
 * the charter §3 line: no real company is ever named here.
 */
export interface Stock {
  readonly id: string
  readonly ticker: string
  readonly name: string
  readonly sectorId: string
  readonly subIndustry: string
  /** How much MORE this name swings than its sector, per mille of 1000. */
  readonly betaMultiplier: number
  /** Company-specific noise, basis points a month. */
  readonly idioVolatility: number
  readonly sharesOutstanding: number
  /** Seed for the earnings figure; grows with the economy. */
  readonly baseEarnings: Money
  readonly blurb: string
}

/** What the analyst panel currently thinks. Cached between refreshes. */
export interface AnalystView {
  readonly stockId: string
  readonly analysts: number
  readonly buy: number
  readonly hold: number
  readonly sell: number
  /** Basis points, like every other price in this system. */
  readonly targetLow: number
  readonly targetAvg: number
  readonly targetHigh: number
  readonly refreshedAtTick: Tick
}

/**
 * A PARTY. Fictional, like every organisation in this world (charter §3).
 *
 * Three of them, named in the owner's `government.html`. They are not
 * left and right on a line — a town's politics is about what it is
 * willing to pay for, so each leans on the levers differently and that
 * lean is what a voter is actually choosing between.
 */
export interface Party {
  readonly id: string
  readonly name: string
  /**
   * WHICH DESIGN TOKEN THE BALLOT DOT USES — a name, never a hex.
   *
   * The mockup gives each party a colour and the first instinct is to put
   * `#5b8def` here. That is exactly what made the market and school
   * screens look pasted in: the mockups carry their own palette and this
   * app has eight semantic tokens and a light mode.
   */
  readonly tone: 'accent' | 'bad' | 'ok'
  /** Where it pulls each lever, per-mille of the range. Balance numbers. */
  readonly taxLean: number
  readonly policeLean: number
  readonly schoolLean: number
}

/** A seat somebody holds. */
export interface Office {
  readonly id: string
  readonly title: string
  readonly level: 'local' | 'state' | 'national'
  /** Years between elections. */
  readonly termYears: number
  /** The youngest anybody may hold it. */
  readonly minAge: number
  /** A seat you cannot reach without having held one of these first. */
  readonly needsPrior?: readonly string[]
}

/**
 * AN ELECTION IN PROGRESS.
 *
 * The mockup shows a BALLOT — candidates, parties, live polling, a Vote
 * button — which means an election cannot be an instant that resolves the
 * month a term ends. It is a season: the ballot opens, the town can see
 * who is standing and how they are polling, the player marks it, and then
 * it decides.
 */
export interface Election {
  readonly officeId: string
  readonly opensAtTick: Tick
  readonly decidesAtTick: Tick
  readonly runners: readonly {
    readonly personId: EntityId
    readonly partyId: string
    /** Per-mille of the vote, as the polls have it. Sums to under 1000. */
    readonly polling: number
  }[]
  /** Who the player marked, if they have. */
  readonly playerVote?: EntityId
  /**
   * WHAT THE PLAYER HAS RAISED, in cents, if they are standing.
   *
   * The mockup puts a war chest on the campaign screen and three things
   * to do with a week, so money is the resource a campaign actually
   * spends — raised by asking, spent on reach.
   */
  readonly warChest?: Money
}

/** Who holds a seat, and until when. */
export interface Officeholder {
  readonly officeId: string
  readonly personId: EntityId
  readonly partyId: string
  readonly sinceTick: Tick
  readonly termEndsTick: Tick
  /** 0-1000. What the town thinks of them today. */
  readonly approval: number
  /**
   * 0-1000. HOW MUCH THERE IS TO FIND.
   *
   * Every corrupt act adds to it and nothing takes it away quickly —
   * that asymmetry IS the risk. A clean officeholder's stays at zero and
   * no investigation ever opens on them, which is what makes the honest
   * path genuinely viable rather than merely slower.
   */
  readonly exposure?: number
}

/**
 * WHAT THE TOWN HAS DECIDED TO DO. The levers, in one place.
 *
 * Phase 1 seeds these and lets them be READ; the systems they are meant
 * to move are wired one at a time in phase 2, so that when a golden shifts
 * there is one plausible cause for it (spec §8).
 */
export interface PolicyState {
  /** Property tax, per-mille of assessed value, annual. */
  readonly propertyTaxPerMille: number
  /** 0-1000. Feeds crime clearance when phase 2 wires it. */
  readonly policeFunding: number
  /** 0-1000. Feeds public-school quality when phase 2 wires it. */
  readonly schoolFunding: number
  /** Per-mille. The national lever; tax.ts reads it in phase 2. */
  readonly incomeTaxPerMille: number
  /**
   * 0-1000. What the country spends on its armed forces.
   *
   * The military module has run since Layer 4 with nobody in charge of
   * it; this is the office it answers to. Optional so a save written
   * before the presidency loads unchanged.
   */
  readonly militaryBudget?: number
}

export interface EducationRecord {
  readonly personId: EntityId
  readonly level: EducationLevel
  /** Null when not currently enrolled. */
  readonly enrolledIn: EducationLevel | null
  readonly enrolledAtTick: Tick | null
  readonly completesAtTick: Tick | null
  /**
   * 0-1000. Influences job quality.
   *
   * It MOVES now. It used to be written once — at worldgen from traits, at
   * birth to a flat 500 — and never again, which meant thirteen years of
   * school changed nothing about the person who sat through them.
   */
  readonly attainment: number
  /**
   * Public or private, decided when a child first walks into a classroom
   * and kept for the whole of the school years.
   *
   * Optional because a save written before this loads unchanged, and a
   * record without one is a public one — which is what every existing
   * child was, having never been charged a penny of tuition.
   */
  readonly schooling?: 'public' | 'private'
  /**
   * The field of study, once there is one. Null through the whole of the
   * K-12 ladder because a diploma is not in anything, and optional so a
   * save written before this loads unchanged.
   */
  readonly major?: string | null
  /**
   * WHO IS PAYING FOR THE COURSE (education master §4).
   *
   * Settled once at enrolment and kept, so a good year cannot move
   * somebody onto a scholarship halfway through and a bad one cannot take
   * it away. Absent means nobody ever asked — an old save, or the K-12
   * ladder, which nobody is billed for.
   */
  readonly funding?: 'self' | 'merit' | 'need' | 'rotc' | 'gi-bill'
  /**
   * IN HALLS. The institution houses them, and it is billed with the
   * tuition rather than as rent.
   *
   * Only for somebody who would otherwise be keeping a roof up alone: a
   * student still living with their parents is at home, which is where
   * most of them are and what most of them can afford.
   */
  readonly inHalls?: boolean
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
  /**
   * The fields this work actually wants. A match opens the door wider; a
   * mismatch is NOT a bar — the spec is explicit that a mismatched
   * graduate still works, just without the edge. Absent means the job
   * does not care what you studied, which is most of them.
   */
  readonly preferredMajors?: readonly string[]
}

export interface EmploymentRecord {
  readonly personId: EntityId
  readonly occupationId: string
  readonly workplaceId: EntityId
  readonly monthlyPay: Money
  readonly startedAtTick: Tick
  /** 0-1000, drifts with diligence. */
  readonly performance: number
  /**
   * M-CAREER §1. WHICH LADDER, AND WHEN THIS RUNG WAS TAKEN.
   *
   * The civilian parallel to a service record's rank and rankSinceTick:
   * time in the job is half of what a review counts, exactly as time in
   * grade is half of what a board counts. Null on a job that belongs to no
   * track — the ladders cover the town's work, not every possible job.
   */
  readonly trackId: string | null
  readonly rungSinceTick: Tick
}

// ---------------------------------------------------------------------------
// Military service (L4-M3)
// ---------------------------------------------------------------------------

/**
 * A RE CODE — what the separation papers say about coming back (owner:
 * "thats why we have RE codes so that people who get out at say 8 years
 * and then want to reenlist can join another branch and stuff. But if you
 * have an RE4 or 3 the recruiter should deny you").
 *
 *   1 — eligible. Served the term, left clean.
 *   2 — eligible, with something on the file. The service said "no more
 *       at that rank", not "no more".
 *   3 — denied. In the real world a waiver exists; the owner's ruling is
 *       that the recruiter turns them away, and the owner's ruling wins.
 *   4 — barred. Misconduct, or a body that will not pass again.
 */
export type ReCode = 1 | 2 | 3 | 4

/**
 * A TERM ALREADY SERVED, kept when somebody goes back in.
 *
 * `world.service` holds ONE record per person, so re-enlisting would
 * otherwise overwrite the closed one — and that record is the artifact a
 * descendant finds three generations on (foundation §10). This is the
 * summary that survives instead: Law 6 asks for history compressed, not
 * hoarded, and what matters about a finished term is which branch, how
 * long, how it ended and what it said about coming back.
 */
export interface PriorTerm {
  readonly branch: string
  readonly specialtyId: string
  readonly enlistedAtTick: Tick
  readonly dischargedAtTick: Tick
  readonly dischargeReason: string
  readonly finalRank: number
  readonly commissioned: boolean
  readonly reCode: ReCode
}

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
   * M-PROMO. A LEADERSHIP BILLET HELD OVER THE PAY GRADE.
   *
   * From the owner's `army_promotions_fix.md` §3: "1SG and CSM aren't
   * missing ranks — they're leadership billets you get selected into." A
   * First Sergeant is a Master Sergeant appointed as a company's senior
   * NCO: same E-8 pay, different title, and he REVERTS to Master Sergeant
   * when he leaves the job. Adding them as pay grades — which is what
   * "we're missing two ranks" would have meant — would have been wrong.
   *
   * Null for almost everybody. The abbreviation is what renders in place
   * of the rank while it is held.
   */
  readonly billet?: string | null
  /** When the billet was taken up. Null when none is held. */
  readonly billetSinceTick?: Tick | null
  /**
   * M-SCHOOL §5. WHAT THIS SOLDIER HAS ALREADY TRIED, and how it went.
   *
   * A wash-out is a real setback and not a game over (Law 7): the unit will
   * fund another seat if any remain. Recorded per course, because "you have
   * had your two goes at selection" is a different sentence from "you have
   * never been".
   *
   * Recycles are counted but do NOT spend an attempt — repeating a phase
   * costs time, not a chance.
   */
  readonly schoolAttempts?: readonly SchoolAttempt[]
  /**
   * What the papers said about coming back. Set at discharge and never
   * afterwards; absent while still serving, and absent on any record
   * written before re-enlistment existed.
   */
  readonly reCode?: ReCode
  /** Terms served before this one. Empty for almost everybody. */
  readonly priorTerms?: readonly PriorTerm[]
  /** Recycles used inside the course currently being attended. */
  readonly recyclesUsed?: number
  /**
   * P2. Trades held BEFORE the current one, in order — written when a
   * reenlistment retrain crosses specialties. A twelve-year mechanic who
   * finishes as a rifleman is still a trained mechanic: veteranUnlocks
   * unions across all of these (military review must-fix — the trade must
   * not vanish from the record that is foundation §10's whole point).
   */
  readonly priorSpecialtyIds: readonly string[]
  /**
   * M-ENLIST §4. THE ENTRY TEST, 1-99. Rolled once at the recruiting
   * station and kept for ever: the score is a fact about the day they sat
   * it, and recomputing it later would let a changed formula rewrite
   * somebody's history (Law 3).
   *
   * Optional: a record written before the test existed simply has none, and
   * the migration back-fills it from the same deterministic base.
   */
  readonly aptitude?: number
  /**
   * M-ENLIST §5c. Which road they are on. `commissioned` already says
   * whether they hold a commission; this says which PIPELINE they entered
   * through, which is not the same thing — a mustang commissioned from the
   * ranks entered as enlisted.
   */
  readonly track?: 'enlisted' | 'officer'
  /** M-ENLIST §5c. The officer job, for somebody on the officer track. */
  readonly officerRoleId?: string
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
  /**
   * Commissioned. The rank index then reads the OFFICER ladder rather than
   * the enlisted one, and so does the pay.
   *
   * Optional: a record written before commissions existed is enlisted, and
   * that is the truth about it rather than a default.
   */
  readonly commissioned?: boolean
  /**
   * The CHOSEN length of the current contract, in months. A term used to be
   * a constant, so every enlistment in every life was forty-eight months
   * long; the owner's reenlistment spec makes it a decision.
   *
   * Optional: a record written before terms were chosen ran the constant,
   * and reading it as such is the truth about it.
   */
  readonly termMonths?: number
  /** No involuntary orders until this tick — the stability option. */
  readonly stabilizedUntilTick?: Tick | null
  /** Past this point the service stops asking: senior NCOs serve on. */
  readonly indefinite?: boolean
  readonly unitId: string | null
  /**
   * When they joined it. Months in the UNIT is not months enlisted — eight
   * years in a line unit does not make somebody the old hand of a team they
   * joined last month, and the senior parachutist's clock counts time on a
   * jump status rather than time in uniform.
   *
   * Null means UNKNOWN, not zero: a record migrated from a save written
   * before this field existed does not know, and the clock starts where the
   * knowledge starts rather than at a date we would be inventing.
   */
  readonly unitSinceTick: Tick | null
  /**
   * When the annual fitness test was last taken. The SCORE is not here any
   * more — the body belongs to the person (stats phase 2), because a
   * civilian has one too and it has to exist before anybody enlists.
   */
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
  /**
   * C3 §1. Which rung of the ladder the court chose. Optional so that
   * convictions written before the ladder existed stay readable — they are
   * a fine or a term, and say so.
   */
  readonly disposition?: Disposition
  /** Owed to the victim, in cents. Rides any disposition (C3 §6). */
  readonly restitution?: number
  /**
   * C3 §5, Decision 2. SEALED, NEVER DELETED. An expungement stops every
   * gate reading this conviction — hiring, enlistment, the public record —
   * and changes nothing about the fact that it happened. A descendant
   * reading the life still finds it; an employer does not.
   *
   * The alternative, erasing it, would let a record rewrite history, and
   * the whole engine rests on history being the thing that does not move.
   */
  readonly sealed?: boolean
}

/**
 * C3 §5. How hard a conviction still bars a door.
 *
 * 'hard' is the wall the flat gate used to be. 'soft' is a door that got
 * heavier, not one that shut. 'none' is a thing that happened once and no
 * longer decides anything.
 */
export type GateStrength = 'hard' | 'soft' | 'none'

/**
 * C3 §1. What the court actually did, between "fined" and "months".
 *
 * The first pass had two answers and a five-time burglar landed in the same
 * bucket as a first shoplifter. These are the rungs in between:
 *
 *  - 'dismissed'  — no conviction at all; the case ended
 *  - 'fine'       — money, and it is over
 *  - 'service'    — a fine and hours owed to the county
 *  - 'probation'  — supervised, no custody, and revocable
 *  - 'suspended'  — a term that only lands if they offend again
 *  - 'split'      — a short stretch inside, then probation
 *  - 'jail'       — custody, as before
 *
 * Restitution rides any of them where something was taken.
 */
export type Disposition =
  | 'dismissed'
  | 'fine'
  | 'service'
  | 'probation'
  | 'suspended'
  | 'split'
  | 'jail'

export interface CriminalRecord {
  readonly personId: EntityId
  /** Append-only. History never shortens (Law 6); GATES read recency. */
  readonly convictions: readonly Conviction[]
  /** Non-null while serving time. */
  readonly jailedUntilTick: Tick | null
  /**
   * C3 §2. Non-null while on probation. Probation is not custody — the job
   * survives, the household survives — but it is revocable, and a new
   * offence while it runs imposes what was hanging over them.
   */
  readonly probationUntilTick?: Tick | null
  /** The term a suspended sentence or probation would impose on revocation. */
  readonly suspendedMonths?: number
  /** Still owed to victims, in cents. */
  readonly restitutionOwed?: number
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
   *
   * The stamp is never cleared. A closed tour that was a captivity is a
   * different tour from one that was not, and this field is the only place
   * that difference survives.
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
  | 'commission'
  | 'separation-record'
  | 'retirement-certificate'
  /** Which uniform: the specialty choice on enlistment. */
  | 'specialty'
  /** M-ENLIST §1. Which service. The first step of the new pipeline. */
  /**
   * ADR-0037. The Article 15 paper, player-only. Raised only for the
   * punishments that actually cost something — a stripe, or a civilian
   * conviction — because the careless-month infractions are already a
   * quiet story line and papering all of them is the base-popup spam the
   * service module has been warned about twice.
   */
  | 'article15'
  | 'branch-choice'
  /** M-ENLIST §4. The entry test's result, read before the jobs open. */
  | 'entry-test'
  /** M-ENLIST §5c. What an officer candidate asks the branch for. */
  | 'officer-preference'
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
  | 'invest'
  | 'divest'
  | 'borrow'
  | 'buy-home'
  /** ADR-0038. Settling a chapter 13 plan in full, early. */
  | 'pay-off-plan'
  /** Real estate: taking a tenancy, and selling up. */
  | 'rent-home'
  | 'sell-home'
  | 'drop-out'
  | 'vote'
  | 'stand'
  | 'campaign'
  | 'set-lever'
  | 'seek-peace'
  | 'pay-down'
  | 'scale-up'
  | 'take-public'
  | 'gamble'
  | 'buy-chips'
  | 'cash-out'
  | 'poker'
  | 'tournament'
  | 'study-poker'
  | 'turn-pro'
  | 'seek-help'
  | 'try-out'
  | 'train'
  | 'rest-up'
  | 'take-offer'
  | 'declare-draft'
  | 'retire-sport'
  | 'take-fight'
  | 'endorse'
  | 'second-act'
  /** Taking up or giving up an activity (stats phase 5). */
  | 'habit'
  /** A visit about whatever is wrong. */
  | 'doctor'
  /** LOG-ONLY: asked for a school slot from the Service tab. */
  | 'school-request'
  /** LOG-ONLY: put in for a special unit's selection. */
  | 'unit-tryout'
  /** LOG-ONLY: took the fitness test from the Service tab. */
  | 'fitness-test'
  /** LOG-ONLY: picked up extra duty to work on the record. */
  | 'extra-duty'
  /** LOG-ONLY (C2): the player went and did something from the Record
   *  tab. A crime is a player INPUT and belongs in the replay log like
   *  every other one; the choice carries the offence id. */
  | 'offence'
  /** A contact that became the player's own moment: the squad pinned, and
   *  a choice that is genuinely theirs (M-HARM). */
  | 'combat-moment'
  | 'unit-moment'
  | 'crime-victim'
  | 'crime-scene'
  | 'money-shock'
  | 'bankruptcy'
  | 'promotion-offer'
  | 'work-moment'
  /** A big pot mid-session, and the choice is genuinely yours (casino §2). */
  | 'key-hand'
  | 'graduate'
  | 'debate'
  | 'school-choice'
  | 'major'
  | 'school-moment'
  | 'interview'
  | 'promotion-offer'
  | 'reenlist-term'
  | 'reenlist-option'
  | 'service-contract'
  | 'trial'
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
  /**
   * WHOSE CHOICE IT WAS (ADR-0033).
   *
   * The log is never cleared on succession — deliberately, because it is the
   * dynasty's record and Law 6 keeps history. But `hasAnswered` read it
   * unscoped, so an heir inherited every once-in-a-life flag their parent
   * had set: the fork at eighteen was never offered to them, and neither
   * was the walk into the recruiting office. They graduated secondary
   * school and the employment system simply handed them a job.
   *
   * Absent means "written before this field existed, owner unknown", and
   * an unknown entry answers for nobody — which re-offers a missed question
   * to an existing save's heir rather than leaving them stuck.
   */
  readonly personId?: EntityId
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
  /**
   * WHEN A QUESTION WAS LAST TURNED DOWN, by kind (owner, playing: "when
   * we first come out of high school it gives a popup that says 'blank
   * wants to start dating' and if you turn it down and wait itll just
   * keep asking, same thing with turning down a kid").
   *
   * A refusal used to change nothing at all: the roll behind the question
   * came round again the next month and asked again, so "no" meant "not
   * this month" and the only way to stop being asked was to say yes.
   *
   * Optional so a save written before this loads unchanged.
   */
  declinedAtTick?: Record<string, Tick>
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
  | 'debt-written-off'
  | 'filed-bankruptcy'
  | 'debt-discharged'
  | 'plan-completed'
  | 'plan-dismissed'
  | 'lost-housing'
  | 'rehoused'
  | 'laid-off'
  | 'drew-unemployment'
  | 'drew-assistance'
  | 'state-pension-began'
  | 'opened-business'
  | 'business-closed'
  | 'inherited-business'
  | 'commissioned'
  | 'promoted-at-work'
  | 'passed-over'
  /** M-PROMO. A leadership billet taken up — First Sergeant, Command
   *  Sergeant Major and their equivalents. A title over the pay grade. */
  /** Seen about an ailment — costs money, takes the edge off, never cures. */
  | 'saw-a-doctor'
  /** A tenancy taken on, and given up. */
  /** The house sold — for a gain, or for a shortfall that follows you. */
  | 'sold-home'
  | 'signed-lease'
  | 'ended-lease'
  | 'billet-taken'
  /** And handed on. The reversion is the part that makes a billet a billet
   *  rather than a rank. */
  | 'billet-ended'
  /** M-SCHOOL §5. Returned to unit — washed out, or hurt and dropped. */
  | 'dropped-from-training'
  /** A phase repeated. Costs time, costs nothing on the record. */
  | 'recycled-in-training'
  | 'work-moment'
  | 'left-course'
  | 'stood-for-office'
  | 'debated'
  | 'paid-down-loan'
  | 'delisted'
  | 'signed-endorsement'
  | 'second-act'
  | 'signed-pro'
  | 'fought'
  | 'won-title'
  | 'made-team'
  | 'missed-squad'
  | 'signed-letter'
  | 'drafted'
  | 'went-undrafted'
  | 'training-injury'
  | 'retired-from-sport'
  | 'bought-chips'
  | 'cashed-out'
  | 'gambled'
  | 'played-poker'
  | 'played-tournament'
  | 'turned-pro'
  | 'sought-help'
  | 'company-scaled'
  | 'went-public'
  | 'took-graft'
  | 'investigated'
  | 'set-policy'
  | 'took-office'
  | 'voted'
  | 'company-news'
  | 'analyst-change'
  | 'won-funding'
  | 'took-student-loan'
  | 'chose-major'
  | 'school-moment'
  | 'promoted-at-work'
  | 'passed-over'
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
  | 'received-orders'
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
  | 'filed-taxes'
  | 'bought-investment'
  | 'sold-investment'
  | 'took-loan'
  | 'paid-off-loan'
  | 'defaulted'
  | 'bought-home'
  | 'lost-home'
  | 'money-shock'
  /** Crime & justice (C1). The thief's own timeline knows what they did. */
  | 'committed-theft'
  | 'committed-offence'
  | 'was-robbed'
  | 'was-arrested'
  | 'was-convicted'
  | 'used-lethal-force'
  | 'charge-declined'
  | 'charged'
  | 'arraigned'
  | 'stood-trial'
  | 'testified'
  | 'stayed-silent'
  | 'verdict'
  | 'pleaded-self-defense'
  | 'ruled-justified'
  | 'plea-deal-offered'
  | 'took-plea-deal'
  | 'was-assaulted'
  | 'escalated-charge'
  | 'barred-from-reenlistment'
  | 'placed-on-probation'
  | 'completed-probation'
  | 'violated-probation'
  | 'community-service'
  | 'ordered-restitution'
  | 'paid-restitution'
  | 'conviction-expunged'
  | 'reported-crime'
  | 'declined-to-report'
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
  /** The venture's own decisions: opened, grown into a company, floated.
   *  Its own kind so "why did they take it public?" and "why did they
   *  change jobs?" never answer each other's question. */
  | 'business'

/** Drives retention. Assigned when the record is created. */
export type Significance = 'notable' | 'major' | 'defining'

export type FactorId =
  /** How long the venture has survived — the thing that separates a
   *  company from a good year. */
  | 'years-trading'
  /** What the company is worth, which is what an underwriter reads. */
  | 'valuation'
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
  | 'economy-turned'
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
  | 'holds-a-degree'
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
  /** M-ECON §1: every person's own money. Absent means zero. */
  readonly accounts: Map<EntityId, Accounts>
  /**
   * M-SAFETY §2: every bankruptcy ever filed, newest last, by person.
   * The HISTORY is the point — you cannot refile for years, and the file
   * remembers for years after that.
   */
  readonly bankruptcies: Map<EntityId, readonly Bankruptcy[]>
  /** M-CAREER §5: every business ever opened in this town, by its own id. */
  readonly businesses: Map<EntityId, Business>
  /** M-ECON §4: the weather everybody lives in. */
  readonly economy: EconomyState
  /** M-ECON §5: what each fictional sector costs today, in basis points. */
  readonly sectorPrices: Readonly<Record<string, number>>
  /** Live share prices in basis points, keyed by stock id. Owned by market.ts. */
  readonly stockPrices: Readonly<Record<string, number>>
  /**
   * Monthly closes, oldest first, BOUNDED. Law 6: summarise, do not hoard —
   * a century of monthly closes for forty companies is 48,000 numbers in
   * every save, and no chart in this game can show more than a few years.
   */
  readonly stockHistory: Readonly<Record<string, readonly number[]>>
  /**
   * WHO GAMBLES, AND WHAT IT HAS COST THEM (casino spec §5). Keyed by
   * personId; the single writer is `casino.ts`.
   *
   * NOT A BANKROLL. The spec's screens say "bankroll" and they mean it, but
   * a poker player's bankroll IS their money — putting a second pot of
   * cents in here would be a second source of truth for how much somebody
   * has, and finances owns that (Law 12). What lives here is the things
   * finances has no opinion about: the skill, the hours, the record, and
   * how much trouble this is causing.
   */
  readonly gamblers: Map<EntityId, GamblingRecord>
  /**
   * WHO PLAYS, AND HOW FAR THEY GOT (sports spec §"Determinism").
   * Keyed by personId; the single writer is `sports.ts`.
   */
  readonly athletes: Map<EntityId, AthleteRecord>
  /** The analyst panel's standing view, refreshed quarterly. */
  readonly analystViews: Map<string, AnalystView>
  /**
   * COMPANIES THAT WENT PUBLIC, keyed by stock id (careers overhaul, Fix
   * 3C). The thirty-three in `STOCKS` are the world's; these are the ones
   * this town floated, and after the bell there is no difference between
   * them — same prices, same analysts, same news, same delisting.
   */
  readonly listings: Map<string, Stock>
  /** Who holds which seat. Keyed by office id. Owned by `government.ts`. */
  readonly officials: Map<string, Officeholder>
  /** The levers as they currently stand. */
  readonly policy: PolicyState
  /** Elections whose ballots are open. Keyed by office id. */
  readonly elections: Map<string, Election>
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
  /**
   * Morale, owned by `wellbeing.ts` and written nowhere else. A separate
   * map rather than a field on Person, because that is how every other
   * per-person domain in this world is stored — health, education, service,
   * the criminal record — and because a domain with its own module wants
   * its own table (DOMAIN_MAP §2).
   */
  readonly wellbeing: Map<EntityId, WellbeingRecord>
  /** Habits, owned by `stats.ts`. */
  readonly habits: Map<EntityId, HabitRecord>
  /** The town's housing stock, owned by `realestate.ts`. Keyed by id. */
  readonly properties: Map<string, Property>
  /** Live tenancies, keyed by household. Owned by `realestate.ts`. */
  readonly leases: Map<EntityId, Lease>
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
