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

// --- Football (American). Appendix A, and the highest injury rate of the
// four, which is a real fact about the sport rather than flavour. -------
const FOOTBALL_POSITIONS: readonly Position[] = [
  {
    id: 'qb',
    sport: 'football',
    title: 'Quarterback',
    short: 'QB',
    skills: ['accuracy', 'armStrength', 'reading', 'poise'],
    weights: [340, 240, 260, 160],
    basePerMille: 220,
  },
  {
    id: 'rb',
    sport: 'football',
    title: 'Running Back',
    short: 'RB',
    skills: ['vision', 'ballSecurity', 'receiving', 'accuracy'],
    weights: [400, 280, 220, 100],
    basePerMille: 460,
  },
  {
    id: 'wr',
    sport: 'football',
    title: 'Wide Receiver',
    short: 'WR',
    skills: ['hands', 'routeRunning', 'leaping', 'receiving'],
    weights: [320, 300, 190, 190],
    basePerMille: 440,
  },
  {
    id: 'ol',
    sport: 'football',
    title: 'Offensive Line',
    short: 'OL',
    skills: ['runBlock', 'passBlock', 'awareness', 'ballSecurity'],
    weights: [340, 360, 220, 80],
    basePerMille: 400,
  },
  {
    id: 'dl',
    sport: 'football',
    title: 'Defensive Line',
    short: 'DL',
    skills: ['passRush', 'runStop', 'motor', 'awareness'],
    weights: [350, 300, 230, 120],
    basePerMille: 430,
  },
  {
    id: 'lb',
    sport: 'football',
    title: 'Linebacker',
    short: 'LB',
    skills: ['tackling', 'coverage', 'recognition', 'motor'],
    weights: [320, 260, 280, 140],
    basePerMille: 400,
  },
  {
    id: 'cb',
    sport: 'football',
    title: 'Cornerback',
    short: 'CB',
    skills: ['coverage', 'ballSkills', 'recognition', 'tackling'],
    weights: [400, 260, 210, 130],
    basePerMille: 460,
  },
  {
    id: 's',
    sport: 'football',
    title: 'Safety',
    short: 'S',
    skills: ['range', 'coverage', 'tackling', 'recognition'],
    weights: [300, 280, 220, 200],
    basePerMille: 420,
  },
]

// --- Soccer. Appendix A. No draft anywhere in it. ----------------------
const SOCCER_POSITIONS: readonly Position[] = [
  {
    id: 'gk',
    sport: 'soccer',
    title: 'Goalkeeper',
    short: 'GK',
    skills: ['reflexes', 'handling2', 'positioning', 'distribution'],
    weights: [340, 280, 260, 120],
    basePerMille: 240,
  },
  {
    id: 'cb-soc',
    sport: 'soccer',
    title: 'Centre-back',
    short: 'CB',
    skills: ['tackling', 'marking', 'heading', 'positioning'],
    weights: [300, 280, 230, 190],
    basePerMille: 380,
  },
  {
    id: 'fb',
    sport: 'soccer',
    title: 'Full-back',
    short: 'FB',
    skills: ['crossing', 'tackling', 'workRate', 'marking'],
    weights: [300, 280, 250, 170],
    basePerMille: 460,
  },
  {
    id: 'cm',
    sport: 'soccer',
    title: 'Central Midfielder',
    short: 'CM',
    skills: ['passing', 'vision', 'workRate', 'dribbling'],
    weights: [340, 290, 210, 160],
    basePerMille: 320,
  },
  {
    id: 'cam',
    sport: 'soccer',
    title: 'Attacking Midfielder',
    short: 'CAM',
    skills: ['vision', 'passing', 'dribbling', 'shooting'],
    weights: [300, 250, 240, 210],
    basePerMille: 300,
  },
  {
    id: 'wing',
    sport: 'soccer',
    title: 'Winger',
    short: 'W',
    skills: ['dribbling', 'crossing', 'finishing', 'workRate'],
    weights: [340, 260, 250, 150],
    basePerMille: 460,
  },
  {
    id: 'st',
    sport: 'soccer',
    title: 'Striker',
    short: 'ST',
    skills: ['finishing', 'positioning', 'heading', 'dribbling'],
    weights: [420, 250, 180, 150],
    basePerMille: 380,
  },
]

// --- Combat. WEIGHT CLASSES INSTEAD OF POSITIONS, which is why the shape
// works at all: a division is a bracket you fit into rather than a job on
// a team, and everybody in it trains the same six things. ---------------
const COMBAT_POSITIONS: readonly Position[] = [
  {
    id: 'flyweight',
    sport: 'combat',
    title: 'Flyweight',
    short: 'FLY',
    skills: ['striking', 'grappling', 'cardio', 'chin', 'fightIq'],
    weights: [260, 240, 240, 120, 140],
    basePerMille: 340,
  },
  {
    id: 'lightweight',
    sport: 'combat',
    title: 'Lightweight',
    short: 'LW',
    skills: ['striking', 'grappling', 'cardio', 'chin', 'fightIq'],
    weights: [280, 250, 210, 130, 130],
    basePerMille: 340,
  },
  {
    id: 'welterweight',
    sport: 'combat',
    title: 'Welterweight',
    short: 'WW',
    skills: ['striking', 'grappling', 'power', 'chin', 'fightIq'],
    weights: [280, 240, 200, 150, 130],
    basePerMille: 340,
  },
  {
    id: 'middleweight',
    sport: 'combat',
    title: 'Middleweight',
    short: 'MW',
    skills: ['striking', 'power', 'grappling', 'chin', 'fightIq'],
    weights: [270, 250, 210, 150, 120],
    basePerMille: 350,
  },
  {
    id: 'heavyweight',
    sport: 'combat',
    title: 'Heavyweight',
    short: 'HW',
    skills: ['power', 'striking', 'chin', 'grappling', 'fightIq'],
    weights: [330, 250, 180, 140, 100],
    basePerMille: 380,
  },
]

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
  ...FOOTBALL_POSITIONS,
  ...SOCCER_POSITIONS,
  ...COMBAT_POSITIONS,
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
  // Football
  accuracy: 'Accuracy',
  armStrength: 'Arm strength',
  reading: 'Reading defences',
  poise: 'Pocket poise',
  vision: 'Vision',
  ballSecurity: 'Ball security',
  receiving: 'Receiving',
  hands: 'Hands',
  routeRunning: 'Route running',
  leaping: 'Leaping',
  runBlock: 'Run blocking',
  passBlock: 'Pass blocking',
  awareness: 'Awareness',
  passRush: 'Pass rush',
  runStop: 'Run stopping',
  motor: 'Motor',
  tackling: 'Tackling',
  coverage: 'Coverage',
  recognition: 'Recognition',
  ballSkills: 'Ball skills',
  range: 'Range',
  // Soccer
  reflexes: 'Reflexes',
  handling2: 'Handling',
  positioning: 'Positioning',
  distribution: 'Distribution',
  marking: 'Marking',
  heading: 'Heading',
  crossing: 'Crossing',
  workRate: 'Work rate',
  passing2: 'Passing',
  dribbling: 'Dribbling',
  // Combat
  striking: 'Striking',
  grappling: 'Grappling',
  cardio: 'Cardio',
  chin: 'Chin',
  power: 'Power',
  fightIq: 'Fight IQ',
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

/**
 * WHAT BEING KNOWN COSTS EVERYBODY THIS MONTH, for the tick loop to hand
 * to wellbeing. A read — this module never writes a mood.
 */
export function famePressures(world: World): readonly { personId: EntityId; drag: number }[] {
  const out: { personId: EntityId; drag: number }[] = []
  for (const [personId, record] of world.athletes) {
    const drag = famePressure(record.fame ?? 0)
    if (drag !== 0) out.push({ personId, drag })
  }
  return out
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

    // WHAT THE SEASON COST THE BODY, and this is where football differs
    // from basketball in the way that actually matters. The spec calls out
    // "highest injury attrition of the four" for a reason: at 210 per
    // mille against basketball's 70, a football career is three times as
    // likely to be ended by a hit as by a decline. Same pipeline, same
    // code, one number — and a completely different life.
    const rules = rulesFor(record.sport)
    if (rng.chance(rules.injuryPerMille, 1_000)) {
      const durability = next.stats['durability'] ?? 50
      // A CAREER-ENDER, or a year that takes something off you for good.
      // Durability is what stands between the two.
      const ending = rng.chance(Math.max(60, 420 - durability * 3), 1_000)
      if (ending) {
        world.athletes.set(personId, {
          ...next,
          level: 'done',
          wage: 0 as Money,
          endedBecause: 'a career-ending injury',
        })
        out.push({
          personId,
          words: 'The injury ended it. Not a decline and not a decision — one play, and that was the career.',
          line,
        })
        continue
      }
      const hurt: Record<string, number> = { ...next.stats }
      for (const id of BASE_STATS) hurt[id] = Math.max(0, (hurt[id] ?? 0) - 3)
      next = { ...next, stats: hurt }
    }

    // FAME, AND WHAT IT COSTS. Earned by playing well where people are
    // watching, and it decays every year that is not spent earning it.
    const famed =
      record.sport === 'combat'
        ? fameFromFighting(next, overallOf(next))
        : fameFrom(next, line, overallOf(next))
    next = { ...next, fame: famed, endorsements: next.endorsements ?? (0 as Money) }

    // A SCANDAL REACHES THE WELL-KNOWN AND NOBODY ELSE, which is itself
    // the point: obscurity is a kind of protection.
    const scandal = rollScandal(world, tick, personId, famed)
    if (scandal !== null) {
      next = {
        ...next,
        fame: Math.max(0, famed - scandal.fameCost),
        // THE MORALS CLAUSE, doing exactly what the paper said it would.
        endorsements: 0 as Money,
      }
      out.push({ personId, words: scandal.words, line })
    }

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
  if (record === undefined) return 0 as Money
  // ENDORSEMENT MONEY OUTLIVES THE CAREER BY A LITTLE, which is why this
  // is not gated on being a professional the way the wage is: a brand's
  // term runs to its end date and a retirement does not cancel it.
  const playing = record.level === 'pro' ? record.wage : (0 as Money)
  return (playing + (record.endorsements ?? 0)) as Money
}

/** Is this person's whole living the game? Used by the jobs screens. */
export function isProAthlete(world: World, personId: EntityId): boolean {
  return world.athletes.get(personId)?.level === 'pro'
}

// ---------------------------------------------------------------------------
// WHAT EACH SPORT ACTUALLY DOES DIFFERENTLY (spec §"The four sports")
// ---------------------------------------------------------------------------

/**
 * THE RULES THAT ARE NOT SHARED.
 *
 * Everything above this line is one framework. This is the small set of
 * facts where the sports genuinely diverge — and they are RULES rather
 * than trademarks, which is why they can be the real ones (charter §3, and
 * the spec says so in as many words).
 *
 * The differences are not decoration:
 *
 *   BASKETBALL takes you at nineteen, a year out of school, in two rounds.
 *   FOOTBALL will not look at you until THREE YEARS removed from high
 *     school, and then takes seven rounds of you — far more picks, so
 *     being drafted means much less, and undrafted players get camp
 *     invitations rather than nothing.
 *   SOCCER HAS NO DRAFT AT ALL. You join an academy young, and you are
 *     signed or you are not. Nobody calls your name.
 *   COMBAT has no team and no draft either: you build an amateur record,
 *     turn professional, and a promotion signs you off the back of it.
 */
export interface SportRules {
  readonly sport: SportId
  readonly title: string
  /** The youngest a professional path opens. */
  readonly proAge: number
  /** Zero when the sport has no draft — soccer and combat. */
  readonly draftPicks: number
  readonly draftRounds: number
  /** Per-mille chance a season does real damage. Football leads, by a lot. */
  readonly injuryPerMille: number
  /** What the road is called on screen when there is no draft. */
  readonly proRoute: string
}

export const SPORT_RULES: readonly SportRules[] = [
  {
    sport: 'basketball',
    title: 'Basketball',
    proAge: 19,
    draftPicks: 60,
    draftRounds: 2,
    injuryPerMille: 70,
    proRoute: 'the draft',
  },
  {
    sport: 'football',
    title: 'Football',
    // THREE YEARS REMOVED FROM HIGH SCHOOL, which is the real rule and
    // the reason a football player cannot leave college early the way a
    // basketball player can.
    proAge: 21,
    draftPicks: 257,
    draftRounds: 7,
    // THE HIGHEST ATTRITION OF THE FOUR, and the spec calls it out
    // specifically. It is the single most consequential difference
    // between these two otherwise near-identical pipelines.
    injuryPerMille: 210,
    proRoute: 'the draft',
  },
  {
    sport: 'soccer',
    title: 'Soccer',
    // AN ACADEMY TAKES YOU YOUNG. There is no waiting for a draft class,
    // because there is no draft: a club signs you or it does not.
    proAge: 17,
    draftPicks: 0,
    draftRounds: 0,
    injuryPerMille: 110,
    proRoute: 'a first-team contract',
  },
  {
    sport: 'combat',
    title: 'Combat sports',
    proAge: 18,
    draftPicks: 0,
    draftRounds: 0,
    injuryPerMille: 160,
    proRoute: 'a promotion signing you',
  },
]

export function rulesFor(sport: string): SportRules {
  return (
    SPORT_RULES.find((rules) => rules.sport === sport) ??
    SPORT_RULES[0] ?? {
      sport: 'basketball',
      title: 'Basketball',
      proAge: 19,
      draftPicks: 60,
      draftRounds: 2,
      injuryPerMille: 70,
      proRoute: 'the draft',
    }
  )
}

/**
 * A DRAFT WITH THE RIGHT NUMBER OF PICKS IN IT.
 *
 * The generic version of `runDraft`, which was basketball's alone. Seven
 * rounds of two hundred and fifty-seven changes what being drafted MEANS:
 * far more names are called, so the bar to hear one is lower and a late
 * pick guarantees nothing at all. That is exactly how the two sports
 * differ in life, and it falls out of one number.
 */
export function runDraftFor(
  rules: SportRules,
  overall: number,
  production: number,
  roll: number,
): DraftResult {
  if (rules.draftPicks === 0) {
    return { pick: null, round: null, teamName: '', words: 'This sport has no draft.' }
  }
  const stock = Math.floor((overall * 3 + Math.min(99, production)) / 4) + roll
  // A bigger draft reaches further down. Basketball's sixty names start at
  // 82; football's two hundred and fifty-seven start well below that.
  const bar = rules.draftPicks >= 200 ? 70 : 82
  if (stock < bar) {
    return {
      pick: null,
      round: null,
      teamName: '',
      words:
        rules.draftPicks >= 200
          ? 'Undrafted. There are camp invitations for players like you, and most of them end in a cut.'
          : 'Sixty names, and none of them yours. It is what happens to nearly everybody.',
    }
  }
  const span = Math.max(1, 99 - bar)
  const pick = Math.max(
    1,
    Math.min(rules.draftPicks, rules.draftPicks - Math.floor(((stock - bar) * rules.draftPicks) / span)),
  )
  const perRound = Math.max(1, Math.floor(rules.draftPicks / rules.draftRounds))
  const round = Math.max(1, Math.min(rules.draftRounds, Math.ceil(pick / perRound)))
  return {
    pick,
    round,
    teamName: teamNameFor(pick),
    words:
      round === 1
        ? 'First round. Guaranteed money and a real chance.'
        : round <= 3
          ? 'A middle-round pick. A roster spot to win, not a gift.'
          : 'Late. You have to make the team out of camp, and plenty do not.',
  }
}

/**
 * SIGNED, RATHER THAN DRAFTED — soccer and combat (spec §"The four
 * sports": "no draft — you're scouted, signed, and developed").
 *
 * The difference from a draft is not cosmetic. A draft is one night with a
 * fixed number of names; a signing is a judgement a club or a promotion
 * makes about you whenever they like, and there is no round to be taken
 * in. What replaces the pick number is simply whether anybody wanted you.
 */
export interface SigningResult {
  readonly signed: boolean
  readonly clubName: string
  /** 1 is the top flight. Higher numbers are further down the pyramid. */
  readonly tier: number
  readonly words: string
}

const CLUB_NAMES: readonly string[] = [
  'Haverlock Athletic',
  'Ashcombe Rovers',
  'Brackenwell United',
  'Coastal City',
  'Fairmount Wanderers',
  'Northgate Town',
]

const PROMOTIONS: readonly string[] = ['Apex Fighting', 'Ironclad Combat', 'Vanguard MMA']

export function runSigning(
  sport: string,
  overall: number,
  record: number,
  roll: number,
): SigningResult {
  const standing = Math.floor((overall * 3 + Math.min(99, record)) / 4) + roll

  if (sport === 'combat') {
    // A PROMOTION SIGNS A RECORD, not a rating. You can be the most gifted
    // fighter in the region and go unsigned with four wins, which is the
    // honest shape of that sport.
    if (standing < 74) {
      return {
        signed: false,
        clubName: '',
        tier: 0,
        words: 'Nobody called. You keep fighting regionals and building the record.',
      }
    }
    return {
      signed: true,
      clubName: PROMOTIONS[Math.abs(standing) % PROMOTIONS.length] ?? 'Apex Fighting',
      tier: 1,
      words: 'A major promotion signed you. Now the rankings start.',
    }
  }

  // SOCCER'S PYRAMID. There is a level for almost anybody who is good
  // enough to be a professional at all — and being a professional in the
  // fourth tier is a real life, which is why this does not simply refuse.
  if (standing < 58) {
    return {
      signed: false,
      clubName: '',
      tier: 0,
      words: 'Released by the academy. Most of every intake is, and most of them were good.',
    }
  }
  const tier = standing >= 86 ? 1 : standing >= 74 ? 2 : 3
  return {
    signed: true,
    clubName: CLUB_NAMES[Math.abs(standing) % CLUB_NAMES.length] ?? 'Haverlock Athletic',
    tier,
    words:
      tier === 1
        ? 'A first-team contract in the top flight.'
        : tier === 2
          ? 'A contract in the second tier. Promotion is the whole season.'
          : 'A contract further down the pyramid. It is a living and it is professional football.',
  }
}

/** What a signed player is paid, by tier. Base-year cents a month. */
export function signedWageFor(sport: string, tier: number, overall: number): Money {
  if (tier <= 0) return 0 as Money
  if (sport === 'combat') {
    // A PURSE IS NOT A SALARY. Fighters are paid per fight and this is the
    // monthly equivalent — deliberately modest until somebody is ranked,
    // because that is what the sport actually pays outside the top.
    return Math.floor(35_000 + Math.max(0, overall - 60) * 2_400) as Money
  }
  const byTier = tier === 1 ? 900_000 : tier === 2 ? 180_000 : 45_000
  return Math.floor(byTier + Math.max(0, overall - 60) * (tier === 1 ? 26_000 : 3_200)) as Money
}

// ---------------------------------------------------------------------------
// COMBAT: the record, the rankings, and the belt (spec §"Combat sports")
// ---------------------------------------------------------------------------

export interface FightResult {
  readonly won: boolean
  readonly finish: boolean
  /** Cents, base-year. A purse, not a salary. */
  readonly purse: Money
  readonly opponent: string
  readonly words: string
}

const FIGHTER_NAMES: readonly string[] = [
  'Diego Reyes',
  'Kostya Marek',
  '"The Anvil" Boone',
  'Tomas Vega',
  'Rashad Bell',
  'Juno Ferrar',
  'Emeka Osei',
  'Vince Kowalczyk',
]

/**
 * ONE FIGHT.
 *
 * The opponent is drawn to be roughly your level, which is what a
 * matchmaker does — and it is why a rising fighter's record is not a
 * straight line of wins. Climbing means being matched harder, so the
 * better you get the harder it stays.
 *
 * A LOSS IS NOT THE END and never resets anything. A record carries both
 * numbers because both are true, and 14-3 is a good fighter.
 */
export function runFight(
  world: World,
  tick: Tick,
  personId: EntityId,
  record: AthleteRecord,
  fightNumber: number,
): FightResult {
  const rng = openStream(world.seed, Stream.Sports, personId * 23 + fightNumber, tick + 5_100)
  const mine = overallOf(record)
  const ranked = (record.ranking ?? 0) > 0 || record.champion === true

  // MATCHED TOWARD YOUR LEVEL, NOT AT IT — and the difference is the
  // whole reason a rating means anything here.
  //
  // MEASURED with the opponent drawn straight off the fighter's own level:
  // a fighter rated 88 and a fighter rated 55 both won 51.5 per cent of
  // the time, because the edge was identical by construction. Perfect
  // matchmaking makes skill invisible.
  //
  // A division is a finite pool. The best fighter in it cannot be matched
  // with somebody better, so they face relatively weaker opposition and
  // win more; somebody near the bottom is matched up and loses more. Being
  // ranked pulls the matching harder toward you, because nobody feeds a
  // ranked fighter easy nights.
  const divisionMean = 62
  const pull = ranked ? 800 : 620
  const drawn = divisionMean + Math.floor(((mine - divisionMean) * pull) / 1_000)
  const opponent = Math.max(20, Math.min(99, drawn + rng.nextIntInclusive(-8, 8)))
  const edge = mine - opponent
  // 500 per-mille at level, and skill moves it hard — a ten-point gap is
  // a heavy favourite, which is true in this sport more than most.
  const chance = Math.max(120, Math.min(880, 500 + edge * 34))
  const won = rng.chance(chance, 1_000)

  // Finishes come from power and striking rather than from winning: a
  // decision win is a win, and a knockout is a different thing.
  const finishing = Math.floor((statOf(record, 'power') + statOf(record, 'striking')) / 2)
  const finish = won && rng.chance(Math.max(80, Math.min(650, finishing * 6)), 1_000)

  const base = record.champion === true ? 900_000 : ranked ? 180_000 : 32_000
  const purse = Math.floor(base * (won ? 1.6 : 1)) as Money

  return {
    won,
    finish,
    purse,
    opponent: FIGHTER_NAMES[Math.abs(fightNumber * 7 + personId) % FIGHTER_NAMES.length] ?? 'a late replacement',
    words: won
      ? finish
        ? 'You finished him. People will have seen that one.'
        : 'A decision, and you did enough.'
      : 'You lost. It is a record, not a story — you carry both numbers.',
  }
}

/**
 * WHAT A FIGHT DOES TO A CAREER.
 *
 * THE CLIMB IS THE WHOLE SPORT: an unranked fighter with wins gets ranked,
 * a ranked one moves up, the top of the division earns a shot, and taking
 * it makes you champion. Losing costs you ground rather than everything —
 * which is why a fighter can lose and come back, and they do.
 */
export function applyFight(record: AthleteRecord, result: FightResult): AthleteRecord {
  const wins = (record.wins ?? 0) + (result.won ? 1 : 0)
  const losses = (record.losses ?? 0) + (result.won ? 0 : 1)
  const finishes = (record.finishes ?? 0) + (result.finish ? 1 : 0)
  let ranking = record.ranking ?? 0
  let champion = record.champion === true
  let titleDefences = record.titleDefences ?? 0

  if (result.won) {
    if (champion) {
      titleDefences += 1
    } else if (ranking === 1) {
      // A TITLE SHOT TAKEN. The number one contender beating whoever is in
      // front of them is how a belt changes hands.
      champion = true
      ranking = 0
    } else if (ranking > 1) {
      ranking -= 1
    } else if (wins >= 4) {
      // Into the rankings at last, at the bottom of them.
      ranking = 15
    }
  } else if (champion) {
    // THE BELT GOES. You do not keep it by losing, and you re-enter the
    // division at the top of the contenders rather than at the bottom.
    champion = false
    ranking = 2
    titleDefences = 0
  } else if (ranking > 0 && ranking < 15) {
    ranking += 1
  }

  return { ...record, wins, losses, finishes, ranking, champion, titleDefences }
}

/** The record, as everybody in the sport actually says it. */
export function recordWords(record: AthleteRecord): string {
  const wins = record.wins ?? 0
  const losses = record.losses ?? 0
  const finishes = record.finishes ?? 0
  const base = `${String(wins)}-${String(losses)}`
  return finishes > 0 ? `${base} (${String(finishes)} by finish)` : base
}

export function standingWordsFor(record: AthleteRecord): string {
  if (record.champion === true) {
    const defences = record.titleDefences ?? 0
    return defences === 0
      ? 'Champion'
      : `Champion · ${String(defences)} defence${defences === 1 ? '' : 's'}`
  }
  const ranking = record.ranking ?? 0
  if (ranking === 1) return 'Number one contender'
  if (ranking > 0) return `Ranked #${String(ranking)}`
  return 'Unranked'
}

// ---------------------------------------------------------------------------
// FAME, MONEY, AND WHAT COMES AFTER (spec §"Money, fame, and the second act")
// ---------------------------------------------------------------------------

/**
 * HOW WELL KNOWN SOMEBODY BECOMES.
 *
 * Fame follows PERFORMANCE AT A LEVEL PEOPLE WATCH, which is why a
 * dominant college player is less famous than a mediocre professional and
 * a third-tier professional is barely known at all. It decays every year
 * that is not spent earning it — fame is rented, never owned.
 */
export function fameFrom(record: AthleteRecord, line: SeasonLine, overall: number): number {
  const now = record.fame ?? 0
  const watched =
    record.level !== 'pro'
      ? 0
      : record.sport === 'soccer' && (record.tier ?? 3) > 1
        ? (record.tier ?? 3) === 2 ? 30 : 8
        : 100
  if (watched === 0) return Math.max(0, now - 40)

  // Being good is most of it; winning is the rest. Nobody outside a city
  // knows the best player on a losing team as well as they know a
  // champion, which is unfair and true.
  const earned = Math.floor(
    ((Math.max(0, overall - 55) * 14 + Math.max(0, line.teamWins - line.teamLosses) * 3) * watched) / 100,
  )
  // Decay first, then this year's earning. A year off the top costs you.
  return Math.max(0, Math.min(1_000, Math.floor(now * 0.86) + earned))
}

/** Champions in combat are famous for the belt rather than for a season. */
export function fameFromFighting(record: AthleteRecord, overall: number): number {
  const now = record.fame ?? 0
  const earned =
    record.champion === true ? 120 : (record.ranking ?? 0) > 0 ? 40 : Math.max(0, overall - 70)
  return Math.max(0, Math.min(1_000, Math.floor(now * 0.9) + earned))
}

/**
 * WHAT THE BRANDS PAY, in cents a month.
 *
 * Steeply non-linear, because that is how it works: nobody endorses the
 * ninth-best player in a league. Below a real level of fame it is zero,
 * and most professionals never see a penny of it.
 */
export const ENDORSEMENT_FLOOR = 320

export function endorsementsFor(fame: number): Money {
  if (fame < ENDORSEMENT_FLOOR) return 0 as Money
  const above = fame - ENDORSEMENT_FLOOR
  return Math.floor((above * above) / 90) as Money
}

/**
 * WHAT BEING KNOWN COSTS (spec: "pressure on Wellbeing and relationships").
 *
 * Returned rather than applied — wellbeing is its own module's to write.
 * It is a real cost and it rises with fame, because the thing people
 * actually describe is not enjoying it: no privacy, an opinion from
 * everybody, and every bad night discussed by strangers.
 */
export function famePressure(fame: number): number {
  if (fame < 300) return 0
  return -Math.floor((fame - 300) / 90)
}

/**
 * A SCANDAL. Rare, seeded, and only reaches people anybody is watching —
 * which is itself the point: obscurity is a kind of protection.
 */
export interface Scandal {
  readonly id: string
  readonly words: string
  /** What it takes off fame and off the endorsement money. */
  readonly fameCost: number
}

const SCANDALS: readonly Scandal[] = [
  {
    id: 'night-out',
    words: 'A night out ended up in the papers, and the pictures were not flattering.',
    fameCost: 90,
  },
  {
    id: 'row',
    words: 'A row with a coach was recorded by somebody in the stand and went everywhere.',
    fameCost: 140,
  },
  {
    id: 'money',
    words: 'A business you lent your name to collapsed, and everybody who lost money knows whose name was on it.',
    fameCost: 200,
  },
]

export function rollScandal(world: World, tick: Tick, personId: EntityId, fame: number): Scandal | null {
  if (fame < 380) return null
  const rng = openStream(world.seed, Stream.Sports, personId * 37, tick + 6_600)
  // Being more famous is being more exposed, and there is no upper bound
  // on how closely somebody can be watched.
  if (!rng.chance(Math.min(90, Math.floor(fame / 14)), 1_000)) return null
  return SCANDALS[rng.nextIntInclusive(0, SCANDALS.length - 1)] ?? null
}

/**
 * THE SECOND ACT (spec §"Money, fame, and the second act", and Law 7).
 *
 * A career ends around thirty-five and a life does not. What somebody can
 * do next is read off what they actually were: the well-known go on
 * television, the ones who understood the game coach it, and everybody
 * else does what everybody else does — which is not a punishment, it is
 * simply the ordinary outcome for the ordinary professional.
 */
export interface SecondAct {
  readonly id: string
  readonly title: string
  readonly blurb: string
  /** The civilian occupation this becomes, or null to leave it open. */
  readonly occupationId: string | null
}

export const SECOND_ACTS: readonly SecondAct[] = [
  {
    id: 'broadcast',
    title: 'Broadcasting',
    blurb: 'They want you in a studio on match days. It pays well and it keeps you near it.',
    occupationId: null,
  },
  {
    id: 'coach',
    title: 'Coaching',
    blurb: 'Start where everybody starts — an assistant, on a fraction of what you used to make.',
    occupationId: null,
  },
  {
    id: 'ordinary',
    title: 'Something else entirely',
    blurb: 'Most people who ever played professionally do something else afterwards, and it is a life.',
    occupationId: null,
  },
]

/**
 * WHAT IS ACTUALLY OPEN TO THEM. Broadcasting wants a name; coaching
 * wants somebody who understood it. Neither is owed to anybody for having
 * played.
 */
export function secondActsFor(record: AthleteRecord): readonly SecondAct[] {
  const open: SecondAct[] = []
  if ((record.fame ?? 0) >= 420) {
    const broadcast = SECOND_ACTS.find((act) => act.id === 'broadcast')
    if (broadcast !== undefined) open.push(broadcast)
  }
  if (statOf(record, 'sportIq') >= 60 || record.seasons >= 8) {
    const coach = SECOND_ACTS.find((act) => act.id === 'coach')
    if (coach !== undefined) open.push(coach)
  }
  const ordinary = SECOND_ACTS.find((act) => act.id === 'ordinary')
  if (ordinary !== undefined) open.push(ordinary)
  return open
}
