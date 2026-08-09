/**
 * ATHLETE CAREERS (owner's `sports_careers_master.md`).
 *
 * The pipeline a real athlete walks: a school team, then a high-school
 * squad you make or do not, then recruiting driven by what you actually
 * did, then college, then the draft — and at every one of those steps the
 * ordinary outcome is that it ends.
 *
 * MOST PEOPLE DO NOT MAKE IT, and that is the spine of this module rather
 * than a caveat on it (spec: "realistic wash-out (Law 7)"). A sports
 * career where a diligent player reaches the pros is not a sports career,
 * it is a promotion ladder with a ball in it. What makes the pipeline mean
 * anything is that the great majority of people who start it stop — cut
 * from the squad, unrecruited, benched in college, undrafted — and every
 * one of those endings leaves a life still going.
 *
 * THE FRAMEWORK IS SHARED AND THE SPORTS ARE CONTENT. One pipeline, one
 * season simulation, one key-moment shape; a sport supplies its positions,
 * its stat weights and its own rule for turning pro. That is what lets
 * basketball's age-19 draft and combat's amateur record live in the same
 * module without either being a special case.
 *
 * Pure content and pure arithmetic. finances owns contracts, health owns
 * injuries, education owns the school hook; this owns the career.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { AthleteRecord, World } from './types.js'

// ---------------------------------------------------------------------------
// Sports and positions (spec §"The shared framework", Appendix A)
// ---------------------------------------------------------------------------

export type SportId = 'basketball' | 'football' | 'soccer' | 'combat'

/**
 * THE ATHLETIC BASE EVERY ATHLETE HAS, whatever they play (Appendix A).
 * Speed, strength, agility, stamina, durability and a sport IQ — the
 * things that transfer, and the reason a good athlete is a good athlete
 * before they are a good anything-in-particular.
 */
export type BaseStat = 'speed' | 'strength' | 'agility' | 'stamina' | 'durability' | 'sportIq'

export const BASE_STATS: readonly BaseStat[] = [
  'speed',
  'strength',
  'agility',
  'stamina',
  'durability',
  'sportIq',
]

/**
 * A POSITION, and the stats that decide whether you are any good at it.
 *
 * The weights are what make a position a position rather than a label: a
 * centre who trains shooting is training the wrong thing, and the scouts
 * read the stats that matter for the spot (spec: "your overall rating is
 * position-weighted").
 */
export interface Position {
  readonly id: string
  readonly sport: SportId
  readonly title: string
  readonly short: string
  /** Skill stat ids, in the order the screen shows them. */
  readonly skills: readonly string[]
  /** Per-mille weights over `skills`, summing to 1000. */
  readonly weights: readonly number[]
  /** How much of the overall is the athletic base rather than skill. */
  readonly basePerMille: number
}

export const POSITIONS: readonly Position[] = [
  {
    id: 'pg',
    sport: 'basketball',
    title: 'Point Guard',
    short: 'PG',
    skills: ['handling', 'passing', 'shooting', 'perimeterD'],
    weights: [320, 300, 230, 150],
    basePerMille: 300,
  },
  {
    id: 'sg',
    sport: 'basketball',
    title: 'Shooting Guard',
    short: 'SG',
    skills: ['shooting', 'finishing', 'handling', 'perimeterD'],
    weights: [380, 250, 200, 170],
    basePerMille: 300,
  },
  {
    id: 'sf',
    sport: 'basketball',
    title: 'Small Forward',
    short: 'SF',
    skills: ['shooting', 'finishing', 'perimeterD', 'rebounding'],
    weights: [280, 280, 240, 200],
    basePerMille: 340,
  },
  {
    id: 'pf',
    sport: 'basketball',
    title: 'Power Forward',
    short: 'PF',
    skills: ['rebounding', 'postPlay', 'interiorD', 'finishing'],
    weights: [300, 260, 250, 190],
    basePerMille: 360,
  },
  {
    id: 'c',
    sport: 'basketball',
    title: 'Centre',
    short: 'C',
    skills: ['rebounding', 'interiorD', 'blocking', 'postPlay'],
    weights: [300, 270, 240, 190],
    basePerMille: 380,
  },
]

export function positionById(id: string): Position | undefined {
  return POSITIONS.find((position) => position.id === id)
}

export function positionsFor(sport: SportId): readonly Position[] {
  return POSITIONS.filter((position) => position.sport === sport)
}

/** Plain words for a skill id, so no screen invents its own. */
export const SKILL_TITLES: Readonly<Record<string, string>> = {
  handling: 'Ball handling',
  passing: 'Passing',
  shooting: 'Shooting',
  finishing: 'Finishing',
  perimeterD: 'Perimeter defence',
  interiorD: 'Interior defence',
  rebounding: 'Rebounding',
  postPlay: 'Post play',
  blocking: 'Shot blocking',
  speed: 'Speed',
  strength: 'Strength',
  agility: 'Agility',
  stamina: 'Stamina',
  durability: 'Durability',
  sportIq: 'Sport IQ',
}

// ---------------------------------------------------------------------------
// The rating (spec: "your overall rating is position-weighted")
// ---------------------------------------------------------------------------

export function statOf(record: AthleteRecord, id: string): number {
  return record.stats[id] ?? 0
}

/**
 * WHAT A SCOUT SEES. 0-99, because that is the scale every person who has
 * ever looked at a player rating expects, and a number nobody has to be
 * taught to read is worth more than a tidier one.
 */
export function overallOf(record: AthleteRecord): number {
  const position = positionById(record.positionId)
  if (position === undefined) return 0

  let skill = 0
  for (let i = 0; i < position.skills.length; i += 1) {
    const id = position.skills[i]
    const weight = position.weights[i]
    if (id === undefined || weight === undefined) continue
    skill += statOf(record, id) * weight
  }
  skill = Math.floor(skill / 1_000)

  let base = 0
  for (const id of BASE_STATS) base += statOf(record, id)
  base = Math.floor(base / BASE_STATS.length)

  const blended = Math.floor(
    (base * position.basePerMille + skill * (1_000 - position.basePerMille)) / 1_000,
  )
  return Math.max(0, Math.min(99, blended))
}

// ---------------------------------------------------------------------------
// The pipeline (spec §"The shared framework")
// ---------------------------------------------------------------------------

/**
 * WHERE SOMEBODY IS ON THE ROAD.
 *
 * `done` is not a failure state and is not called one anywhere: it is
 * where almost everybody who ever plays a sport ends up, and the module
 * treats it as the ordinary outcome it is.
 */
export type AthleteLevel = 'school' | 'highschool' | 'college' | 'pro' | 'done'

export const TRYOUT_AGE = 12
/** Basketball's real rule: nineteen, and a year removed from school. */
export const DRAFT_AGE = 19
export const DRAFT_ROUNDS = 2
export const DRAFT_PICKS = 60
export const PRO_TEAMS = 30

/**
 * MAKING THE SQUAD. Why they cannot try out, or null.
 */
export function tryoutBar(age: number, record: AthleteRecord | undefined): string | null {
  if (record !== undefined && record.level !== 'done') return 'You are already on a team.'
  if (age < TRYOUT_AGE) return 'Too young for the school team yet.'
  if (age > 18) return 'That road starts at school, and school is behind you.'
  return null
}

/**
 * DOES THE COACH KEEP THEM? Seeded, and weighted by what they actually
 * are rather than by wanting it.
 *
 * The bar rises with every level, which is the entire pipeline in one
 * function: a lot of people make a middle-school team, fewer make varsity,
 * and the number who are recruited is small.
 */
export function makesSquad(overall: number, level: AthleteLevel, roll: number): boolean {
  // MEASURED, and the first set of bars did not cut at all: every single
  // player who made a school team went on to make varsity, because six
  // years of ordinary development carried everybody past a bar of 52. A
  // gate that nobody fails is not a gate, and the pipeline's whole meaning
  // is that each step actually turns people away.
  const bar = level === 'school' ? 42 : level === 'highschool' ? 68 : 80
  return overall + roll >= bar
}

/**
 * WHAT COLLEGES OFFER, given what a player did in high school (spec: a
 * scholarship "earned by your record", and it "ties to the education
 * module's aid").
 */
export interface Offer {
  readonly id: string
  readonly programme: string
  readonly blurb: string
  /** 'full' pays all the tuition, 'partial' half, 'walk-on' none. */
  readonly ride: 'full' | 'partial' | 'walk-on'
  /** How strong the programme is, 0-99. A better one develops you faster. */
  readonly strength: number
}

const PROGRAMMES: readonly { name: string; blurb: string; strength: number }[] = [
  { name: 'State University', blurb: 'a powerhouse programme', strength: 92 },
  { name: 'Haverlock College', blurb: 'a solid mid-major', strength: 82 },
  { name: 'Coastal Tech', blurb: 'rebuilding, and they need bodies', strength: 72 },
  // MEASURED: with the weakest programme at 46, EVERY varsity player in a
  // two-thousand-person cohort got an offer. Even a small college takes a
  // player who was well above average in a good high school — being on the
  // varsity squad is not on its own a recruitable record.
  { name: 'Fairmount State', blurb: 'small, and they will play you', strength: 60 },
]

/**
 * THE OFFERS ON THE TABLE. Empty is the commonest answer and the screen
 * says so plainly rather than dressing it up.
 */
export function offersFor(overall: number, hsPoints: number): readonly Offer[] {
  const offers: Offer[] = []
  // What the recruiters actually read: the rating AND the production. A
  // player who looks the part and never scored is a different prospect
  // from one who did neither and a different one again from a grinder.
  const standing = Math.floor((overall * 2 + Math.min(99, hsPoints)) / 3)
  for (const programme of PROGRAMMES) {
    // A programme takes you if you clear ITS OWN bar, and a powerhouse's
    // bar is its own strength. MEASURED, the first version subtracted
    // forty-two from it and handed three offers to a 45-overall player who
    // had never scored — which would have made recruiting a formality and
    // the high-school years pointless.
    const reach = standing - programme.strength
    if (reach < 0) continue
    offers.push({
      id: programme.name.toLowerCase().replace(/[^a-z]/g, '-'),
      programme: programme.name,
      blurb: programme.blurb,
      // How far past a programme's bar you are is what decides the money.
      // Clearing it comfortably is a scholarship; scraping over it is a
      // place on the roster and a bill.
      ride: reach >= 12 ? 'full' : reach >= 4 ? 'partial' : 'walk-on',
      strength: programme.strength,
    })
  }
  return offers
}

// ---------------------------------------------------------------------------
// Training is real work (spec §"Training is real work")
// ---------------------------------------------------------------------------

export type TrainingFocus = 'skill' | 'strength' | 'conditioning'

export const TRAINING_FOCI: readonly TrainingFocus[] = ['skill', 'strength', 'conditioning']

/**
 * HOW MUCH IS LEFT IN SOMEBODY.
 *
 * A ceiling made of the body they were born with and the age they are —
 * and it is the reason training plateaus rather than climbing forever.
 * The spec is explicit that athleticism must be EARNED over time and never
 * toggled on, and a ceiling is what stops "earned" meaning "eventually
 * everybody is a 99".
 */
export function ceilingFor(potential: number, age: number): number {
  // Peaks in the late twenties and comes down after, which is what a
  // career actually looks like from the inside.
  const decline = age <= 28 ? 0 : Math.min(45, (age - 28) * 3)
  return Math.max(20, Math.min(99, potential - decline))
}

/**
 * WHAT A BLOCK OF TRAINING BUYS, and what it costs.
 *
 * DIMINISHING AND FATIGUING, both. The first month of proper work is worth
 * a great deal; the twentieth in a row is worth less and is how people get
 * hurt. That is the "plateaus, fatigue, and injury / overtraining risk"
 * the spec asks for, and it is why the answer is not simply to hold the
 * button down.
 */
export interface TrainingResult {
  readonly gained: Readonly<Record<string, number>>
  readonly fatigueAfter: number
  /** True when the body gave out. The health module owns what happens next. */
  readonly hurt: boolean
  readonly words: string
}

export const FATIGUE_MAX = 1_000

export function trainingRisk(fatigue: number, durability: number): number {
  // Fresh, almost nothing. Deep in the red, a real chance every month.
  const strain = Math.max(0, fatigue - 400)
  return Math.max(0, Math.floor((strain * (140 - durability)) / 900))
}

export function train(
  record: AthleteRecord,
  focus: TrainingFocus,
  ceiling: number,
  roll: number,
  hurtRoll: number,
): TrainingResult {
  const gained: Record<string, number> = {}
  const position = positionById(record.positionId)
  const targets: readonly string[] =
    focus === 'skill'
      ? (position?.skills ?? [])
      : focus === 'strength'
        ? ['strength', 'durability']
        : ['speed', 'stamina', 'agility']

  // FATIGUE BLUNTS THE WORK ITSELF. Training tired is not merely riskier,
  // it is less useful, which is the part people actually get wrong.
  const tired = Math.max(300, 1_000 - record.fatigue)
  for (const id of targets) {
    const now = record.stats[id] ?? 0
    const room = Math.max(0, ceiling - now)
    if (room <= 0) continue
    const gain = Math.max(0, Math.floor((room * (roll + 60) * tired) / 3_600_000))
    if (gain > 0) gained[id] = gain
  }

  const fatigueAfter = Math.min(FATIGUE_MAX, record.fatigue + 110)
  const hurt = hurtRoll < trainingRisk(record.fatigue, record.stats['durability'] ?? 50)

  return {
    gained,
    fatigueAfter,
    hurt,
    words: hurt
      ? 'Something went in the middle of a session. You knew you were running on empty.'
      : Object.keys(gained).length === 0
        ? 'You put the work in and nothing moved. There is a limit and you are at it.'
        : 'A good block of work. It shows.',
  }
}

/** Rest is the other half of training, and the only thing that clears fatigue. */
export function rested(fatigue: number): number {
  return Math.max(0, fatigue - 260)
}

// ---------------------------------------------------------------------------
// The season (spec §"Season-sim + key moments")
// ---------------------------------------------------------------------------

export interface SeasonLine {
  readonly games: number
  readonly points: number
  readonly rebounds: number
  readonly assists: number
  /** Per-mille, so a 47% shooter is 470. */
  readonly shootingPerMille: number
  readonly teamWins: number
  readonly teamLosses: number
}

export const GAMES_PER_SEASON: Readonly<Record<AthleteLevel, number>> = {
  school: 16,
  highschool: 24,
  college: 32,
  pro: 60,
  done: 0,
}

/**
 * PLAY A SEASON, from the stats rather than from a die.
 *
 * The production is what the player IS, bent by variance — a shooter
 * scores because their shooting is high, and a bad year is a bad year
 * rather than a different player. The spec's phrase is "the season
 * simulates from your stats", and the test of whether that is true is
 * whether a better player reliably out-produces a worse one over a career
 * while still having bad seasons.
 */
export function playSeason(
  world: World,
  tick: Tick,
  personId: EntityId,
  record: AthleteRecord,
  seasonIndex: number,
): SeasonLine {
  const rng = openStream(world.seed, Stream.Sports, personId * 11 + seasonIndex, tick)
  const position = positionById(record.positionId)
  const games = GAMES_PER_SEASON[record.level as AthleteLevel] ?? 0
  const overall = overallOf(record)

  // How much of the game runs through this player. A star at a small
  // school scores enormously; the same player in the pros is one of five.
  const share = record.level === 'pro' ? 62 : record.level === 'college' ? 74 : 88
  const swing = rng.nextIntInclusive(-14, 14)
  const form = Math.max(20, Math.min(99, overall + swing))

  const shoot = statOf(record, 'shooting')
  const board = statOf(record, 'rebounding')
  const pass = statOf(record, 'passing')

  const points = Math.max(0, Math.floor((form * share * (60 + shoot)) / 90_000))
  const rebounds = Math.max(0, Math.floor((board * share) / 1_800))
  const assists = Math.max(0, Math.floor((pass * share) / 2_100))
  const shootingPerMille = Math.max(
    280,
    Math.min(620, 340 + Math.floor(shoot / 2) + rng.nextIntInclusive(-30, 30)),
  )

  // The team is mostly not you, which is why a great player can miss the
  // playoffs and a modest one can win.
  const teamStrength = rng.nextIntInclusive(30, 70) + Math.floor((form - 50) / 6)
  const teamWins = Math.max(0, Math.min(games, Math.floor((games * teamStrength) / 100)))

  void position
  return {
    games,
    points,
    rebounds,
    assists,
    shootingPerMille,
    teamWins,
    teamLosses: games - teamWins,
  }
}

/**
 * WHAT A SEASON DID TO A CAREER TOTAL. Kept as running sums rather than a
 * list of seasons: Law 6 says summarise rather than hoard, and a
 * twenty-year career at sixty games is twelve hundred box scores nobody
 * will read.
 */
export function addSeason(record: AthleteRecord, line: SeasonLine): AthleteRecord {
  return {
    ...record,
    seasons: record.seasons + 1,
    careerGames: record.careerGames + line.games,
    careerPoints: record.careerPoints + line.points * line.games,
    lastSeason: line,
  }
}

// ---------------------------------------------------------------------------
// The draft (spec: basketball's real rule)
// ---------------------------------------------------------------------------

export interface DraftResult {
  /** 1-60, or null when nobody called their name. */
  readonly pick: number | null
  readonly round: number | null
  readonly teamName: string
  readonly words: string
}

/**
 * FICTIONAL TEAMS, from the sim's own towns where it fits (charter §3, and
 * the spec says so explicitly). No real club is ever named here.
 */
const TEAM_NAMES: readonly string[] = [
  'Haverlock Foundry',
  'Ashcombe Nine',
  'Brackenwell Sentinels',
  'Coastal Current',
  'Fairmount Pioneers',
  'Northgate Rail',
  'Calver Kings',
  'Thorne Valley Ironsides',
  'Merriweather Crown',
  'Pennsford Union',
]

export function teamNameFor(pick: number): string {
  return TEAM_NAMES[Math.abs(pick) % TEAM_NAMES.length] ?? 'Haverlock Foundry'
}

/**
 * DRAFT NIGHT.
 *
 * UNDRAFTED IS THE COMMON ANSWER and the odds say so honestly: sixty picks
 * against everybody in the country who ever played. The rating has to be
 * genuinely high before a name is called, and the spec wants exactly that
 * — "undrafted → developmental league/overseas grind" is a real branch,
 * not a consolation message.
 */
export function runDraft(overall: number, collegePoints: number, roll: number): DraftResult {
  // What the room actually thinks of them, out of 99.
  const stock = Math.floor((overall * 3 + Math.min(99, collegePoints)) / 4) + roll

  // MEASURED AND HARDENED. At a bar of 74, forty-six per cent of everybody
  // who had been recruited to a college heard their name called. The real
  // proportion is on the order of one in a hundred, and the gap between
  // those two numbers is the difference between a sport and a queue. The
  // bar sits above what all but the very best players ever reach.
  if (stock < 82) {
    return {
      pick: null,
      round: null,
      teamName: '',
      words: 'Sixty names, and none of them yours. It is what happens to nearly everybody.',
    }
  }
  // 74 goes last, 99 goes first — the whole draft inside twenty-five points,
  // which is what makes a point of rating worth so much at the top.
  const pick = Math.max(1, Math.min(DRAFT_PICKS, DRAFT_PICKS - (stock - 82) * 4))
  const round = pick <= 30 ? 1 : 2
  return {
    pick,
    round,
    teamName: teamNameFor(pick),
    words:
      pick <= 5
        ? 'A lottery pick. Your life changed in the time it took to read a card.'
        : pick <= 30
          ? 'First round. Guaranteed money and a real chance.'
          : 'Second round. No guarantees — you have to make the roster.',
  }
}

/**
 * WHAT A ROOKIE DEAL IS WORTH, in cents a month.
 *
 * Steeply tied to the pick, the way a real rookie scale is, and a second
 * rounder makes a fraction of a lottery pick. Base-year cents; finances
 * ages it like every other wage.
 */
export function rookieWageFor(pick: number | null): Money {
  if (pick === null) return 0 as Money
  const top = 1_100_000
  const floorPay = 90_000
  const scale = Math.max(0, DRAFT_PICKS - pick) / DRAFT_PICKS
  return Math.floor(floorPay + (top - floorPay) * scale * scale) as Money
}

/** What a veteran is worth once they have shown what they are. */
export function veteranWageFor(overall: number): Money {
  if (overall < 70) return 120_000 as Money
  const above = overall - 70
  return Math.floor(120_000 + above * above * 5_400) as Money
}

// ---------------------------------------------------------------------------
// Starting out, and the yearly pass
// ---------------------------------------------------------------------------

/**
 * WHAT A TWELVE-YEAR-OLD BRINGS TO A TRYOUT.
 *
 * Built from the body they have and the person they are, not drawn fresh:
 * a fast, tough, sharp child is a better prospect than a slow one before
 * anybody has coached them, and that has to be true or the traits mean
 * nothing here.
 *
 * POTENTIAL IS DRAWN AND HIDDEN. Some people simply have more in them,
 * nobody knows their own ceiling at twelve, and the module never shows the
 * number — a screen that told you your potential would end the story on
 * the first day.
 */
export function startingStats(
  vitality: number,
  resilience: number,
  diligence: number,
  roll: number,
): Readonly<Record<string, number>> {
  const athletic = 20 + Math.floor(vitality / 12)
  const stats: Record<string, number> = {
    speed: athletic + (roll % 7),
    strength: 18 + Math.floor(resilience / 14) + (roll % 5),
    agility: athletic + ((roll >> 3) % 7),
    stamina: 18 + Math.floor(vitality / 14) + ((roll >> 5) % 6),
    durability: 22 + Math.floor(resilience / 12),
    sportIq: 18 + Math.floor(diligence / 14) + ((roll >> 7) % 5),
  }
  for (const position of POSITIONS) {
    for (const skill of position.skills) {
      if (stats[skill] === undefined) stats[skill] = 14 + (((roll >> 2) + skill.length * 3) % 12)
    }
  }
  return stats
}

export function potentialFor(vitality: number, resilience: number, roll: number): number {
  // Most people top out somewhere ordinary. A few do not, and there is no
  // way to know which you are until the ceiling stops moving.
  return Math.max(45, Math.min(99, 52 + Math.floor((vitality + resilience) / 40) + roll))
}

export function freshAthlete(
  personId: EntityId,
  sport: SportId,
  positionId: string,
  stats: Readonly<Record<string, number>>,
  potential: number,
): AthleteRecord {
  return {
    personId,
    sport,
    positionId,
    level: 'school',
    stats,
    potential,
    fatigue: 0,
    seasons: 0,
    careerGames: 0,
    careerPoints: 0,
    draftPick: null,
    teamName: '',
    wage: 0 as Money,
    turnedProAtTick: null,
    retiredAtTick: null,
    endedBecause: '',
  }
}

/**
 * WHAT HAPPENS WHEN A LEVEL ENDS — the moment the pipeline is actually
 * made of.
 *
 * Returns the record moved on, moved up, or ENDED, plus words for the
 * story. Every branch out of here except one is somebody's career being
 * over, which is the correct proportion.
 */
export interface StepResult {
  readonly record: AthleteRecord
  readonly moved: boolean
  readonly words: string
}

export function stepPipeline(
  record: AthleteRecord,
  age: number,
  roll: number,
  hsPoints: number,
): StepResult {
  const overall = overallOf(record)

  if (record.level === 'school') {
    if (age < 14) return { record, moved: false, words: '' }
    // Making a varsity squad is the first real cut, and plenty of people
    // who loved it at twelve do not get past it.
    if (!makesSquad(overall, 'highschool', roll)) {
      return {
        record: { ...record, level: 'done', endedBecause: 'did not make the varsity squad' },
        moved: true,
        words: 'You did not make the squad. That is where it stops for most people, and it is not nothing to have played.',
      }
    }
    return {
      record: { ...record, level: 'highschool' },
      moved: true,
      words: 'You made varsity.',
    }
  }

  if (record.level === 'highschool') {
    if (age < 18) return { record, moved: false, words: '' }
    const offers = offersFor(overall, hsPoints)
    if (offers.length === 0) {
      return {
        record: { ...record, level: 'done', endedBecause: 'nobody recruited you' },
        moved: true,
        words: 'The phone did not ring. No offers, and school is over.',
      }
    }
    // The offers stand until they choose one. Choosing is a VERB — the
    // whole point of recruiting is that it is a decision.
    return {
      record: {
        ...record,
        offers: offers.map((offer) => ({
          id: offer.id,
          programme: offer.programme,
          blurb: offer.blurb,
          ride: offer.ride,
          strength: offer.strength,
        })),
      },
      moved: false,
      words: `${String(offers.length)} programme${offers.length === 1 ? '' : 's'} want you.`,
    }
  }

  if (record.level === 'college') {
    // BASKETBALL'S REAL RULE: nineteen and a year removed from school. The
    // door opens then; it does not open earlier however good somebody is.
    if (age < DRAFT_AGE) return { record, moved: false, words: '' }
    return { record, moved: false, words: '' }
  }

  if (record.level === 'pro') {
    // A body stops being able to do this, and the ceiling above is what
    // decides when. Nobody plays past their late thirties.
    const ceiling = ceilingFor(record.potential, age)
    if (age >= 40 || (age >= 33 && overall > ceiling + 8)) {
      return {
        record: { ...record, level: 'done', endedBecause: 'retired', retiredAtTick: null },
        moved: true,
        words: 'You retired. The body stopped being able to do it, which is how it ends for everybody who lasts.',
      }
    }
  }

  return { record, moved: false, words: '' }
}

/**
 * WHAT THE YEARS TAKE. Called once a year for a pro; the decline is the
 * ceiling coming down under them rather than a separate rule.
 */
export function ageStats(record: AthleteRecord, age: number): AthleteRecord {
  const ceiling = ceilingFor(record.potential, age)
  const stats: Record<string, number> = { ...record.stats }
  let moved = false
  for (const [id, value] of Object.entries(stats)) {
    if (value > ceiling) {
      stats[id] = Math.max(0, value - 2)
      moved = true
    }
  }
  return moved ? { ...record, stats } : record
}

/**
 * THE SPORTING YEAR.
 *
 * Once every twelve months: a season is played, the record grows, the
 * pipeline steps, and bodies age. Everything else in this module is a
 * verb — nothing here tries out, trains or declares on anybody's behalf.
 *
 * WAGES ARE NOT PAID HERE. The record carries what somebody is owed and
 * `finances.ts` pays it, like every other wage in this world.
 */
export interface SportingYear {
  readonly personId: EntityId
  readonly words: string
  readonly line: SeasonLine | null
}

export function runSports(world: World, tick: Tick): readonly SportingYear[] {
  // ONE MONTH A YEAR. A season is a year long, and running this every tick
  // would play twelve of them.
  if (tick % 12 !== 5) return []
  const out: SportingYear[] = []

  for (const [personId, record] of world.athletes) {
    const person = world.people.get(personId)
    if (person === undefined || person.deathTick !== null) continue
    if (record.level === 'done') continue
    const age = Math.floor((tick - person.birthTick) / 12)

    // The season itself, from the stats.
    const line = playSeason(world, tick, personId, record, record.seasons)
    let next = addSeason(record, line)

    // A YEAR OFF THE FATIGUE. A season is hard and an off-season is what
    // an off-season is for.
    next = { ...next, fatigue: Math.max(0, next.fatigue - 220) }
    next = ageStats(next, age)

    const rng = openStream(world.seed, Stream.Sports, personId * 19 + record.seasons, tick + 3_300)
    const production = Math.floor(line.points * 3)
    const step = stepPipeline(next, age, rng.nextIntInclusive(-12, 12), production)

    // A PRO'S PAY FOLLOWS WHAT THEY ARE, once the rookie deal is done.
    if (step.record.level === 'pro' && step.record.seasons >= 4) {
      next = { ...step.record, wage: veteranWageFor(overallOf(step.record)) }
    } else {
      next = step.record
    }

    world.athletes.set(personId, next)
    if (step.words !== '') out.push({ personId, words: step.words, line })
  }
  return out
}

/**
 * WHAT A TEAM PAYS THEM THIS MONTH, for finances to read.
 *
 * A read, not a write — this module never moves a cent (Law 12).
 */
export function sportsWageOf(world: World, personId: EntityId): Money {
  const record = world.athletes.get(personId)
  if (record === undefined || record.level !== 'pro') return 0 as Money
  return record.wage
}

/** Is this person's whole living the game? Used by the jobs screens. */
export function isProAthlete(world: World, personId: EntityId): boolean {
  return world.athletes.get(personId)?.level === 'pro'
}
