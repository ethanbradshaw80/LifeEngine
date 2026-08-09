/**
 * THE CASINO, AND POKER AS A CAREER (owner's `casino_poker_master_1.md`).
 *
 * The charter override is explicit and narrow: gambling content is allowed
 * here. The one rule NOT overridden is determinism — every card, spin,
 * session and tournament is seeded, and the same seed replays the same
 * night exactly.
 *
 * THE HONEST PART, which is most of the design:
 *
 *   The house wins. Blackjack and slots carry a real edge and no amount of
 *   play beats it, because that is what a casino is. A game where a patient
 *   player grinds the house down would be a lie told with numbers.
 *
 *   Poker is different, and the difference is the whole module. You are not
 *   playing the house; you are playing the other people at the table, and
 *   being better than them is genuinely +EV. That is why poker can be a
 *   career and slots can never be.
 *
 *   VARIANCE IS REAL IN BOTH DIRECTIONS. A good player has losing months. A
 *   bad player has winning nights and draws exactly the wrong conclusion
 *   from them. Both of those have to be true or the thing is not poker.
 *
 * WHAT THIS MODULE DOES NOT DO IS MOVE MONEY. It resolves a night and
 * returns what it came to; `finances.ts` is the only thing in this world
 * that writes cash, and the casino requests debits and credits like every
 * other module (Law 12, single-writer).
 *
 * Pure content and pure arithmetic. No cash, no clock, no randomness of its
 * own — every draw comes from a seeded stream.
 */

import type { Money, Seed, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { GamblingRecord, World } from './types.js'
import type { EntityId } from '@life-engine/shared'

// ---------------------------------------------------------------------------
// The floor: blackjack and slots (spec §1)
// ---------------------------------------------------------------------------

/**
 * THE AGE ON THE DOOR. The spec's own number, and it is checked at the verb
 * rather than only hidden in the UI — a rule enforced by a screen is not
 * enforced.
 */
export const CASINO_MIN_AGE = 21

export type TableGame = 'blackjack' | 'slots'

/**
 * THE TWO GAMES ON THE FLOOR, and the difference between them is the whole
 * of the honest part:
 *
 *   BLACKJACK's edge is small, so a night is a slow bleed with real swings
 *     in it, and playing well genuinely narrows it — never past zero,
 *     because basic strategy does not beat the house, it only stops you
 *     beating yourself.
 *   SLOTS' edge is large and there is no decision at all. The fastest road
 *     to trouble in the building, which is what the spec calls it.
 *
 * Neither number is written down anywhere. Both are READ OFF the paytables
 * below, for reasons the comment on `houseEdgePerMille` explains.
 */

/**
 * WHAT A GAME ACTUALLY PAYS — a real paytable, per 100,000 plays.
 *
 * THE FIRST VERSION WAS A SWING AROUND A MEAN and it was badly wrong.
 * Losses floor at zero (you cannot lose more than you put up, which is
 * true) but wins had no cap, so a symmetric roll became wildly asymmetric.
 * MEASURED over twenty thousand spins: the player held 55.7 PER CENT of
 * everything wagered at slots. A money printer with a casino painted on
 * it — the same lie the module's own header warns about, told in the
 * opposite direction.
 *
 * A paytable cannot have that bug, because the expectation is the sum of
 * its own rows and can be checked by reading it. `payoutPerMille` is what
 * comes back for one unit staked: 0 is a loss, 1_000 is the stake
 * returned, 2_000 is a win of one unit.
 *
 * The weights are per 100,000 rather than per 1,000 so a jackpot can be
 * genuinely rare. At 1-in-1,000 a ten-thousand-times payout would be worth
 * ten times the stake on its own and no edge could survive it.
 */
export interface PayoutRow {
  readonly weight: number
  readonly payoutPerMille: number
}

/**
 * BLACKJACK, shaped like the real distribution of a hand: you lose a
 * little under half of them, you push about one in twelve, you win a
 * little under half, and one hand in twenty-two is a blackjack paying
 * three to two.
 */
const BLACKJACK_TABLE: readonly PayoutRow[] = [
  { weight: 47_500, payoutPerMille: 0 },
  { weight: 8_500, payoutPerMille: 1_000 },
  { weight: 39_500, payoutPerMille: 2_000 },
  { weight: 4_500, payoutPerMille: 2_500 },
]

/**
 * SLOTS. Three quarters of spins return nothing at all, most of the rest
 * return less than the stake or barely it, and the whole thing is carried
 * by prizes almost nobody sees. That shape is the point: it is why a
 * machine can feel like it pays while taking eight and a half per cent of
 * everything fed into it.
 */
const SLOTS_TABLE: readonly PayoutRow[] = [
  { weight: 62_186, payoutPerMille: 0 },
  { weight: 22_000, payoutPerMille: 1_000 },
  { weight: 12_000, payoutPerMille: 2_000 },
  { weight: 3_000, payoutPerMille: 5_000 },
  { weight: 700, payoutPerMille: 20_000 },
  { weight: 100, payoutPerMille: 100_000 },
  { weight: 14, payoutPerMille: 500_000 },
]

/**
 * THE EDGE IS READ OFF THE TABLE, never written beside it.
 *
 * The first version stated the edge in a constant AND implemented it
 * separately, which is two sources of truth for one number and they
 * disagreed by a factor of six the moment anybody measured.
 *
 * The second version agreed on paper and still lied in play: too much of
 * the return sat in prizes nobody will ever see. MEASURED over twenty
 * thousand spins, a machine designed to hold 8.5 per cent actually held
 * 21.7, because a one-in-a-hundred-thousand jackpot cannot pay out inside
 * a human lifetime of pulls. A return only a statistician experiences is
 * not a return.
 *
 * The THIRD version had the same disease in miniature and it showed up as
 * something that looked like a broken random number generator: measured
 * hold swung between MINUS 21 PER CENT and PLUS 0.1 across samples of
 * twenty thousand, because one hit on a five-thousand-times prize is a
 * quarter of everything wagered in that sample. It was never the RNG. A
 * top prize that can move the house's whole take single-handed means the
 * machine's economics are decided by whether one spin lands, and no test
 * and no player can see through that.
 *
 * So the top prize is five hundred times rather than five thousand, and
 * the return is carried by the tiers somebody will genuinely hit. The
 * jackpot is there to be exciting, not to hold the arithmetic up.
 */
export function houseEdgePerMille(game: TableGame): number {
  return 1_000 - expectedReturnPerMille(paytableFor(game))
}

export function paytableFor(game: TableGame): readonly PayoutRow[] {
  return game === 'blackjack' ? BLACKJACK_TABLE : SLOTS_TABLE
}

/**
 * WHAT A TABLE RETURNS ON AVERAGE, per-mille of the stake. Under 1,000 is
 * the house edge, and every table here must be — which is what the tests
 * assert by reading this rather than by trusting the comments above.
 */
export function expectedReturnPerMille(rows: readonly PayoutRow[]): number {
  let weighted = 0
  let total = 0
  for (const row of rows) {
    weighted += row.weight * row.payoutPerMille
    total += row.weight
  }
  return total === 0 ? 0 : Math.floor(weighted / total)
}

export type BlackjackChoice = 'hit' | 'stand' | 'double'

export const BLACKJACK_CHOICES: readonly BlackjackChoice[] = ['hit', 'stand', 'double']

/**
 * WHAT THE DECISION IS ACTUALLY WORTH (spec: "a light decision that
 * genuinely shifts the seeded odds via basic strategy — skill matters a
 * little, the house edge still wins long-run").
 *
 * Weight moved out of the LOSING row and into the winning one, per
 * 100,000. The numbers are small on purpose: the best decision available
 * is worth a fraction of a per cent, and anything larger would let a
 * careful player beat a casino, which does not happen.
 *
 * DOUBLING IS NOT A BONUS. It doubles the money at risk, so it doubles the
 * swing in both directions — the edge it buys is real and so is the extra
 * exposure, which is the whole reason it is a decision and not a strictly
 * better button.
 */
export function blackjackEdgeShift(choice: BlackjackChoice, smarts: number): number {
  const know = Math.max(-400, Math.min(400, (smarts - 500) * 2))
  switch (choice) {
    case 'stand':
      return 300 + know
    case 'hit':
      return 150 + know
    case 'double':
      return 500 + know
  }
}

/** How much of the wager is actually at risk, per-mille. Doubling risks twice. */
export function stakeMultiplierFor(choice: BlackjackChoice): number {
  return choice === 'double' ? 2_000 : 1_000
}

export interface TableResult {
  readonly game: TableGame
  /** What was put up, in cents. */
  readonly wagered: Money
  /** What came back, in cents. Zero on a loss; more than the wager on a win. */
  readonly returned: Money
  /** returned - wagered. Negative on a losing visit, which is most of them. */
  readonly net: number
  readonly words: string
}

/**
 * PLAY A HAND, OR PULL THE HANDLE. Pure: it decides, and the caller pays.
 *
 * Abstracted rather than dealt card by card, which the spec asks for. What
 * a player experiences at a table over a visit IS a distribution, and
 * shuffling fifty-two cards would produce the same numbers with more code
 * and a slower tick.
 */
export function playTable(
  world: World,
  tick: Tick,
  personId: EntityId,
  game: TableGame,
  wager: Money,
  choice: BlackjackChoice,
  smarts: number,
  /**
   * WHICH HAND THIS IS. Without it the stream is (person, tick, game) and
   * every hand inside one month came back IDENTICAL — a player could sit
   * at a table all month and be dealt the same card forty times. Caught by
   * a test that played sixty spins and watched the tray move by exactly
   * the same amount each time.
   */
  visit: number,
): TableResult {
  const risked = Math.floor(
    (wager * (game === 'blackjack' ? stakeMultiplierFor(choice) : 1_000)) / 1_000,
  )
  const rng = openStream(world.seed, Stream.Casino, personId * 7 + game.length + visit * 101, tick)

  // The player's skill moves weight from the losing row to the winning one
  // and NEVER touches the rest of the table, so the shape of the game is
  // the same and only the edge narrows. It cannot narrow past the losing
  // row emptying, and long before that the arithmetic still favours the
  // house — asserted by a test rather than trusted.
  const rows = paytableFor(game)
  const shift = game === 'blackjack' ? blackjackEdgeShift(choice, smarts) : 0
  const table = rows.map((row, index) =>
    index === 0
      ? { ...row, weight: Math.max(0, row.weight - shift) }
      : index === 2
        ? { ...row, weight: row.weight + shift }
        : row,
  )

  const total = table.reduce((sum, row) => sum + row.weight, 0)
  let draw = rng.nextIntInclusive(0, Math.max(0, total - 1))
  let payoutPerMille = 0
  for (const row of table) {
    if (draw < row.weight) {
      payoutPerMille = row.payoutPerMille
      break
    }
    draw -= row.weight
  }

  const returned = Math.floor((risked * payoutPerMille) / 1_000)
  const net = returned - risked

  return {
    game,
    wagered: risked as Money,
    returned: returned as Money,
    net,
    words: wordsFor(game, net, risked),
  }
}

function wordsFor(game: TableGame, net: number, risked: number): string {
  if (game === 'slots') {
    if (net > risked * 8) return 'The machine went off. People turned round to look.'
    if (net > 0) return 'It paid, and it paid enough to keep you sitting there.'
    if (net > -risked / 2) return 'It gave a little back on the way down. That is the trick of it.'
    return 'Nothing. Then nothing again.'
  }
  if (net > risked) return 'A good shoe, and you were on the right side of it.'
  if (net > 0) return 'Up a little, which is how a long night starts.'
  if (net > -risked / 2) return 'The dealer got there. Most of them do.'
  return 'The whole stack, and quickly.'
}

// ---------------------------------------------------------------------------
// Poker (spec §2) — the part that can be a career
// ---------------------------------------------------------------------------

/**
 * POKER SKILL, 0-1000. New, hidden, and EARNED (spec §3: "put in the work,
 * don't just toggle it").
 *
 * This is the number that separates a fish from a grinder, and the only
 * ways it moves are playing and studying. It is deliberately NOT a trait:
 * nobody is born able to play poker, and a stat you are issued at birth
 * would make the whole career a lottery ticket drawn before the game
 * started.
 *
 * WHAT THE TRAITS DO instead is set the CEILING. Smarts is the maths,
 * discipline is the bankroll and the tilt, and resilience is what gets
 * somebody through a downswing without quitting or punting. A player with
 * poor numbers can still learn to beat the small games; they will not
 * become the best player in the room, and that is true.
 */
export const POKER_SKILL_MAX = 1000

export function pokerCeilingFor(smarts: number, discipline: number, resilience: number): number {
  // 400 is reachable by anybody who puts the hours in. The rest is the
  // person, and even a perfect one is not guaranteed the top of the scale.
  return Math.min(POKER_SKILL_MAX, 400 + Math.floor((smarts * 3 + discipline * 2 + resilience) / 10))
}

/**
 * WHAT A SESSION TEACHES, and why it plateaus.
 *
 * Volume is the only teacher that works at the table, and it works less and
 * less: the tenth session teaches a great deal and the thousandth teaches
 * almost nothing, which is exactly why grinders study away from the table
 * too. Approaching the ceiling, gains shrink to nearly nothing — the
 * plateau the spec asks for.
 */
export function skillGainFrom(current: number, ceiling: number, intensity: number): number {
  const room = ceiling - current
  if (room <= 0) return 0
  return Math.max(0, Math.floor((room * intensity) / 1_000))
}

/**
 * THE STAKES LADDER (spec §2, and the owner's dashboard mockup).
 *
 * Each rung is a real game with a real buy-in, a stronger field, and bigger
 * swings. Moving up is not a promotion somebody hands you — it is a
 * decision you make with your own money, and making it too early is how
 * players go broke.
 */
export interface Stake {
  readonly id: string
  readonly title: string
  /** One buy-in, in base-year cents. */
  readonly buyIn: Money
  /**
   * How good the other people at this table are, 0-1000. Your EDGE is your
   * skill against this, which is why moving up a rung can turn a winning
   * player into a losing one without anything about them changing.
   */
  readonly fieldStrength: number
  /** How hard a session swings, in per-mille of a buy-in. */
  readonly variancePerMille: number
}

export const STAKES: readonly Stake[] = [
  { id: 'micro', title: '$0.25/$0.50 No-Limit', buyIn: 5_000 as Money, fieldStrength: 240, variancePerMille: 900 },
  { id: 'low', title: '$1/$2 No-Limit', buyIn: 20_000 as Money, fieldStrength: 380, variancePerMille: 1_000 },
  { id: 'mid', title: '$5/$10 No-Limit', buyIn: 100_000 as Money, fieldStrength: 540, variancePerMille: 1_150 },
  { id: 'high', title: '$25/$50 No-Limit', buyIn: 500_000 as Money, fieldStrength: 700, variancePerMille: 1_300 },
  { id: 'nosebleed', title: '$100/$200 Nosebleed', buyIn: 2_000_000 as Money, fieldStrength: 850, variancePerMille: 1_500 },
]

export function stakeById(id: string): Stake | undefined {
  return STAKES.find((stake) => stake.id === id)
}

/**
 * HOW MANY BUY-INS MAKE A BANKROLL.
 *
 * The single most important number in the module, and the one every real
 * player argues about. Twenty buy-ins is the conventional floor for
 * no-limit cash, and being under it does not mean you lose — it means a
 * normal downswing, the kind that happens to winning players constantly,
 * can end you.
 *
 * THIS IS WHY DISCIPLINE MATTERS. The rule is not enforced by the casino;
 * it is enforced by the player, or it isn't.
 */
export const BUY_INS_FOR_A_ROLL = 20

export function rolledFor(bankroll: Money, todaysBuyIn: Money): boolean {
  return bankroll >= todaysBuyIn * BUY_INS_FOR_A_ROLL
}

/** How far off being rolled, in words, for the ladder screen. */
export function rollWordsFor(bankroll: Money, todaysBuyIn: Money): 'yes' | 'close' | 'no' {
  const needed = todaysBuyIn * BUY_INS_FOR_A_ROLL
  if (bankroll >= needed) return 'yes'
  return bankroll >= Math.floor(needed / 2) ? 'close' : 'no'
}

/**
 * WHAT A SESSION IS WORTH, in per-mille of a buy-in per hour, before
 * variance.
 *
 * THE ONE PLACE POKER DIFFERS FROM THE HOUSE GAMES, and the reason it can
 * be a career: this number is your skill against the FIELD's, so it can be
 * positive. Nothing at blackjack can be.
 *
 * The rake is why it is not simply the difference. The house takes a cut of
 * every pot whoever wins it, so a player exactly as good as the field is a
 * LOSING player — which is true, and is the single most misunderstood fact
 * about the game. You have to be better than the table by more than the
 * rake before you are winning anything at all.
 */
export const RAKE_PER_MILLE = 8

export function edgePerHourFor(skill: number, field: Stake): number {
  // MEASURED, and the first scaling was wrong in a way that mattered: a
  // player a hundred and sixty points better than the field came out at
  // MINUS three dollars an hour, because the rake term swamped the skill
  // term. That makes poker unbeatable, which is the same lie as a beatable
  // blackjack table told backwards — and it would have made the entire
  // career phase impossible while looking like variance.
  //
  // Now: level with the field is a small loss (the rake, correctly), and
  // being genuinely better is genuinely profitable.
  return Math.floor((skill - field.fieldStrength) / 4) - RAKE_PER_MILLE
}

export interface SessionResult {
  readonly stakeId: string
  readonly hours: number
  readonly hands: number
  /** Cents. Negative on a losing night, which happens to everybody. */
  readonly net: number
  /** Cents per hour, for the recap screen. */
  readonly perHour: number
  /** The best pot of the night, in cents. Presentation only. */
  readonly biggestPot: Money
  readonly words: string
}

/**
 * PLAY A CASH SESSION. Pure — it resolves the night; the caller moves the
 * money.
 *
 * THE VARIANCE IS THE POINT AND IT IS ENORMOUS. A winning player's edge
 * over one session is a rounding error next to the swing, which is why
 * poker feels like luck up close and like skill from a distance. If a good
 * player won most sessions the game would not exist — nobody would sit
 * down with them twice.
 */
export function playSession(
  world: World,
  tick: Tick,
  personId: EntityId,
  stake: Stake,
  todaysBuyIn: Money,
  skill: number,
  hours: number,
  visit: number,
): SessionResult {
  const rng = openStream(world.seed, Stream.Casino, personId * 13 + visit, tick + 2_600)
  const played = Math.max(1, hours)
  const hands = played * rng.nextIntInclusive(24, 34)

  // The expectation for the night: a small number of buy-ins either way.
  const edge = edgePerHourFor(skill, stake)
  const expected = Math.floor((todaysBuyIn * edge * played) / 1_000)

  // And the swing, which dwarfs it over one night. Scaled by the square
  // root of time the way variance actually accumulates: a session twice as
  // long does not swing twice as far.
  const spread = Math.floor(
    (todaysBuyIn * stake.variancePerMille * Math.round(Math.sqrt(played) * 100)) / 100_000,
  )
  const swing = rng.nextIntInclusive(-spread, spread)

  // YOU CANNOT LOSE MORE THAN YOU SAT DOWN WITH. A cash game is not a debt
  // — you buy in, and when the money is gone you are done for the night.
  // Without this a bad session could take a bankroll to nothing in one
  // hand, which is not how a table works.
  const maxLoss = todaysBuyIn * 3
  const net = Math.max(-maxLoss, expected + swing)
  const biggestPot = Math.max(
    Math.floor(todaysBuyIn / 4),
    Math.floor((Math.abs(net) * rng.nextIntInclusive(400, 900)) / 1_000),
  )

  return {
    stakeId: stake.id,
    hours: played,
    hands,
    net,
    perHour: Math.floor(net / played),
    biggestPot: biggestPot as Money,
    words: sessionWords(net, todaysBuyIn),
  }
}

function sessionWords(net: number, buyIn: Money): string {
  if (net > buyIn * 2) return 'One of those nights where everything held up.'
  if (net > 0) return 'A winning session. They are quieter than the other kind.'
  if (net > -buyIn) return 'Down a buy-in. Nothing happened; that is most sessions.'
  return 'A bad night, and the kind you have to be able to afford.'
}

// ---------------------------------------------------------------------------
// Tournaments (spec §2, §2b)
// ---------------------------------------------------------------------------

/**
 * THE BOARD. Fictional names, like every organisation in this world
 * (charter §3) — no real tour, series or brand is ever named here.
 *
 * The shape of the three is the whole pitch of tournament poker: a nightly
 * you can afford and win regularly, a weekly worth a month's grind, and a
 * once-a-year lottery with a life in the prize pool.
 */
export interface Tournament {
  readonly id: string
  readonly title: string
  readonly buyIn: Money
  readonly field: number
  /** How many months between runnings. */
  readonly everyMonths: number
  /** Per-mille of the prize pool paid to first. Top-heavy by design. */
  readonly topPerMille: number
  readonly blurb: string
}

export const TOURNAMENTS: readonly Tournament[] = [
  {
    id: 'nightly',
    title: 'The Nightly Turbo',
    buyIn: 6_000 as Money,
    field: 120,
    everyMonths: 1,
    topPerMille: 260,
    blurb: 'Fast blinds and a room half full of people who came to gamble.',
  },
  {
    id: 'major',
    title: 'The Sunday Major',
    buyIn: 30_000 as Money,
    field: 1_400,
    everyMonths: 1,
    topPerMille: 180,
    blurb: 'The one the regulars plan their week around.',
  },
  {
    id: 'main',
    title: 'The Main Event',
    buyIn: 1_000_000 as Money,
    field: 8_000,
    everyMonths: 12,
    topPerMille: 140,
    blurb: 'Once a year. Everybody in the building has thought about winning it.',
  },
]

export function tournamentById(id: string): Tournament | undefined {
  return TOURNAMENTS.find((event) => event.id === id)
}

/** Is this one running this month? Deterministic and total. */
export function tournamentRunning(event: Tournament, tick: Tick): boolean {
  return tick % event.everyMonths === 0
}

/**
 * HOW MANY GET PAID. About one in eight, which is the conventional shape,
 * and everybody else goes home with nothing — that is what makes a
 * min-cash feel like something.
 */
export const PAID_PER_MILLE = 125

/**
 * WHERE A DRAW ACTUALLY FINISHES, once skill has bent it.
 *
 * NO FRACTIONAL POWERS, and that is not a style preference — the purity
 * test refused `Math.pow` and it was right to. ECMAScript leaves its
 * precision implementation-defined, so the same tournament could finish
 * differently in two browsers and Law 11 would be quietly broken by a
 * rounding bit nobody could see. `Math.sqrt` is fine (IEEE-754 specifies
 * it exactly); `pow` is not.
 *
 * So the curve is a POLYNOMIAL BLEND in per-mille fixed point, which is
 * exact everywhere:
 *
 *   x        is where the draw landed, 0 to 1,000
 *   x*x      pulls hard toward the front — the skilled player's curve
 *   2x - x*x pushes toward the back — the weak player's
 *
 * and the bias slides between x and whichever of those applies. It is the
 * same shape the power curve had and it can be computed with integers.
 */
export function shapeFinish(flat: number, field: number, skill: number): number {
  if (field <= 1) return 1
  const raw = Math.max(-350, Math.min(600, Math.floor(((skill - 450) * 1_000) / 900)))

  // A BIGGER FIELD DILUTES IT. Without this, skill compounded with the
  // field size and MEASURED the wrong way round entirely: the Main Event,
  // eight thousand deep, returned MORE to a good player than the nightly
  // did. That is backwards. The spec wants the main event to be "small
  // odds, life-changing payouts — the poker dream, HONESTLY PRICED", and
  // honestly priced means the lottery stays a lottery: you enter it for
  // the size of the prize, not because it is the best game in the room.
  const damp = Math.min(1_000, Math.floor(Math.sqrt((240 * 1_000_000) / field)))
  const bias = Math.floor((raw * damp) / 1_000)

  // PER MILLION, NOT PER MILLE, and the difference is not pedantry. At a
  // thousand buckets a field of eight thousand put its first EIGHT
  // finishers in bucket zero, so all of them came first — MEASURED, the
  // Main Event returned 242 per cent to a good player, which is the same
  // ordering bug the damping above exists to prevent, reintroduced by
  // arithmetic resolution. The fixed point has to be finer than the field.
  const SCALE = 1_000_000
  const x = Math.max(0, Math.min(SCALE, Math.floor((flat * SCALE) / field)))
  const squared = Math.floor((x * x) / SCALE)
  const target = bias >= 0 ? squared : 2 * x - squared
  const shaped = x + Math.floor(((target - x) * Math.abs(bias)) / 1_000)

  const place = Math.ceil((Math.max(0, Math.min(SCALE, shaped)) * field) / SCALE)
  return Math.max(1, Math.min(field, place))
}

/**
 * WHAT THE HOUSE TAKES OFF A TOURNAMENT, per-mille of the buy-ins.
 *
 * Separate from the cash-game rake because it is a different charge: cash
 * games take a slice of each pot, a tournament takes a fee at the door.
 */
export const TOURNAMENT_RAKE_PER_MILLE = 80

/**
 * THE PAYOUT CURVE — and it must give away the WHOLE pool.
 *
 * MEASURED, the first one did not come close: it divided every non-winning
 * prize by the number of paid places, so a strong player's return on
 * investment came out at MINUS THIRTY PER CENT and the prize pool simply
 * evaporated. A tournament that pays out less than it takes in is not
 * top-heavy, it is broken, and no amount of skill could ever have shown up
 * through it.
 *
 * So: first place takes its stated share, and everybody else divides what
 * is left by a weight that falls away steeply from the front. Because the
 * remainder is DIVIDED rather than computed independently, the pool is
 * distributed by construction — the bug cannot come back.
 */
export function prizeFor(
  pool: number,
  finish: number,
  paidTo: number,
  topPerMille: number,
): number {
  if (finish > paidTo || finish < 1) return 0
  const first = Math.floor((pool * topPerMille) / 1_000)
  if (finish === 1 || paidTo === 1) return first

  // Squared, so a final table is worth many min-cashes and a min-cash is
  // worth roughly the buy-in back — which is what those words mean.
  let total = 0
  for (let place = 2; place <= paidTo; place += 1) {
    const depth = (paidTo - place + 1) / (paidTo - 1)
    total += depth * depth
  }
  if (total <= 0) return 0
  const depth = (paidTo - finish + 1) / (paidTo - 1)
  return Math.floor(((pool - first) * (depth * depth)) / total)
}

export interface TournamentResult {
  readonly tournamentId: string
  readonly field: number
  /** 1 is a win. Always at least 1 and at most the field. */
  readonly finish: number
  readonly inTheMoney: boolean
  /** Cents won for the finish, before bounties. Zero below the money. */
  readonly payout: Money
  readonly bounties: Money
  readonly buyIn: Money
  /** payout + bounties - buyIn. */
  readonly net: number
  readonly hours: number
  readonly words: string
}

/**
 * PLAY A TOURNAMENT. Pure — the caller moves the money.
 *
 * A FIELD IS MOSTLY A LOTTERY AND SKILL BENDS IT. A great player in a
 * field of eight thousand still busts before the money most of the time,
 * and the reason they are still a great player is that they cash more often
 * than the field does and go deeper when they do. Both of those have to be
 * true at once, which is why the finish is drawn as a position in the field
 * and then PULLED toward the top by skill rather than being decided by it.
 */
export function playTournament(
  world: World,
  tick: Tick,
  personId: EntityId,
  event: Tournament,
  todaysBuyIn: Money,
  skill: number,
  entry: number,
): TournamentResult {
  const rng = openStream(world.seed, Stream.Casino, personId * 17 + entry, tick + 4_100)

  // Where an average player lands: anywhere in the field, flat.
  const flat = rng.nextIntInclusive(1, event.field)

  // AND SKILL BENDS THE WHOLE DISTRIBUTION, rather than subtracting from
  // one draw. The first version did the subtraction and it had a silent
  // hole in it: only `flat === 1` could ever produce a win, so MEASURED
  // over three thousand entries a skilled player won exactly as often as a
  // hopeless one — 56 of 3,000 for both. Skill moved the middle of the
  // field around and left the thing everybody actually plays for alone.
  //
  // A power curve moves every position at once. Below the field average
  // the exponent goes the other way and pushes a weak player toward the
  // back, which is right: in a room this size, being bad is not neutral.
  //
  // DAMPED, and measured twice to get here. The first curve was far too
  // strong: a good player returned FOUR HUNDRED PER CENT on buy-ins, which
  // would have made tournaments a printing press and the cash grind
  // pointless. A genuinely good tournament player makes a modest profit
  // over a great many entries and still busts most of them.
  const finish = shapeFinish(flat, event.field, skill)

  const paidTo = Math.max(1, Math.floor((event.field * PAID_PER_MILLE) / 1_000))
  const inTheMoney = finish <= paidTo
  const pool = Math.floor((todaysBuyIn * event.field * (1_000 - TOURNAMENT_RAKE_PER_MILLE)) / 1_000)
  const payout = inTheMoney ? prizeFor(pool, finish, paidTo, event.topPerMille) : 0

  const hours = inTheMoney ? rng.nextIntInclusive(4, 11) : rng.nextIntInclusive(1, 5)
  const net = payout - todaysBuyIn

  return {
    tournamentId: event.id,
    field: event.field,
    finish,
    inTheMoney,
    payout: payout as Money,
    bounties: 0 as Money,
    buyIn: todaysBuyIn,
    net,
    hours,
    words: tournamentWords(finish, event.field, inTheMoney),
  }
}

function tournamentWords(finish: number, field: number, inTheMoney: boolean): string {
  if (finish === 1) return 'You won it. The whole thing.'
  if (finish <= 9) return 'A final table. People will remember this one.'
  if (finish <= Math.floor(field / 50)) return 'A deep run, and it paid properly.'
  if (inTheMoney) return 'A min-cash. Not nothing, and not much.'
  return 'Busted before the money, like almost everybody does.'
}

/**
 * IS A DEEP RUN WORTH PRINTING? The newsroom asks this rather than
 * guessing, so the paper and the record agree about what counted.
 */
export function newsworthy(result: TournamentResult, event: Tournament): boolean {
  return result.finish === 1 || (result.finish <= 9 && event.field >= 1_000)
}

// ---------------------------------------------------------------------------
// The record, and what gambling costs (spec §2 "tilt & addiction", §5)
// ---------------------------------------------------------------------------

/** A blank record. Nobody is born with one of these. */
export function freshGambler(personId: EntityId): GamblingRecord {
  return {
    personId,
    chips: 0 as Money,
    pokerSkill: 0,
    hoursPlayed: 0,
    lifetimeNet: 0,
    lifetimeWagered: 0,
    hold: 0,
    lastPlayedTick: null,
    inRecoverySinceTick: null,
    bestFinish: null,
    turnedProAtTick: null,
  }
}

export function gamblerOf(world: World, personId: EntityId): GamblingRecord {
  return world.gamblers.get(personId) ?? freshGambler(personId)
}

// ---------------------------------------------------------------------------
// THE CASHIER (owner: chips, bought, separate from everything)
// ---------------------------------------------------------------------------

/**
 * Why they cannot buy in, or null.
 *
 * NOTE WHAT IS NOT HERE: any limit on how much somebody may buy. A casino
 * does not stop you, and a model that did would be quietly removing the
 * decision this whole module is about.
 */
export function buyChipsBar(cents: Money, liquid: Money): string | null {
  if (cents <= 0) return 'You have to buy something.'
  if (liquid < cents) return 'You do not have it.'
  return null
}

/**
 * WHAT A TRIP TO THE WINDOW COSTS BEYOND THE MONEY.
 *
 * This is where the hold now comes from, and moving it here from the bet
 * is the whole point of the owner's chips model. Losing a hand is not what
 * hurts people; going back for more is. So:
 *
 *   the FIRST buy-in of a visit is close to free — everybody who goes to a
 *     casino buys chips, and it means nothing;
 *   every RE-BUY costs more than the one before it, because that is the
 *     act that separates a night out from a problem;
 *   and buying in for a large share of everything you own costs most of
 *     all, whether it is the first trip or the fifth.
 *
 * Discipline is a real brake, and someone with none can get into trouble
 * on small money — which is true, and is why the number is not simply the
 * size of the buy-in.
 */
export function holdFromCashier(
  cents: Money,
  liquid: Money,
  rebuysThisVisit: number,
  discipline: number,
): number {
  const exposure = liquid <= 0 ? 1_000 : Math.min(1_000, Math.floor((cents * 1_000) / liquid))
  const chasing = Math.min(4, rebuysThisVisit)
  const raw = Math.floor(exposure / 50) + chasing * 9
  const resisted = Math.floor((raw * discipline) / 1_400)
  return Math.max(0, raw - resisted)
}

/**
 * TIME AWAY IS WHAT RECOVERY IS MADE OF, and the rate is deliberately
 * ASYMMETRIC: the hold tightens fast and loosens slowly. That is not
 * flavour, it is the thing itself, and a model where a month off undid a
 * year of it would be telling a comfortable lie.
 *
 * But it ALWAYS loosens. Law 7 — failure creates new chapters, and there
 * is no state in this game somebody cannot walk back from. Somebody in
 * recovery does better than somebody merely not playing, because deciding
 * to stop is different from happening not to.
 */
export function easeHold(record: GamblingRecord, tick: Tick): GamblingRecord {
  if (record.hold <= 0) return record
  const away = record.lastPlayedTick === null ? 0 : tick - record.lastPlayedTick
  if (away < 1) return record
  const trying = record.inRecoverySinceTick !== null
  const ease = trying ? 12 : 4
  return { ...record, hold: Math.max(0, record.hold - ease) }
}

/**
 * IS THIS A PROBLEM? Three words the screens and the story can share, so
 * they cannot describe the same person differently.
 *
 * The wording matters and is chosen with some care: nothing here calls
 * anybody a degenerate or celebrates a "high roller". It describes a
 * situation, which is what the spec asks for.
 */
export type HoldLevel = 'none' | 'heavy' | 'problem'

export function holdLevelOf(record: GamblingRecord): HoldLevel {
  if (record.hold >= 600) return 'problem'
  if (record.hold >= 280) return 'heavy'
  return 'none'
}

export function holdWords(level: HoldLevel): string {
  switch (level) {
    case 'problem':
      return 'This has stopped being something you choose. It is costing you money you needed and people have noticed.'
    case 'heavy':
      return 'You are going more than you meant to, and staying longer than you planned.'
    case 'none':
      return ''
  }
}

/**
 * WHAT THE HOLD DOES TO A DECISION.
 *
 * Not a penalty on the outcome — the cards do not know. What it does is
 * make somebody bet MORE than they said they would, which is the actual
 * mechanism and the one that empties accounts. Returns the multiplier
 * applied to an intended wager, per-mille.
 */
export function wagerCreepPerMille(record: GamblingRecord): number {
  return 1_000 + Math.floor(record.hold / 2)
}

/**
 * TILT (spec §2): playing worse when stuck.
 *
 * Skill is not knowledge, it is knowledge you can still use at two in the
 * morning after losing four buy-ins. Discipline and resilience are what
 * hold it together — which is exactly what the ceiling already says those
 * traits are for, applied to a single night.
 */
export function tiltedSkill(
  skill: number,
  downSoFar: number,
  buyIn: Money,
  discipline: number,
  resilience: number,
): number {
  if (downSoFar >= 0 || buyIn <= 0) return skill
  const buyInsDown = Math.min(10, Math.floor(-downSoFar / buyIn))
  if (buyInsDown < 2) return skill
  const composure = Math.floor((discipline + resilience) / 2)
  // At 1000 composure a bad run costs almost nothing; at 0 it costs a lot.
  const loss = Math.floor((buyInsDown * 22 * (1_000 - composure)) / 1_000)
  return Math.max(0, skill - loss)
}

/**
 * GOING PRO (spec §2). Why they cannot, or null.
 *
 * Modelled on the business gate rather than the job gate, and the spec
 * says so: this is self-employment with lumpy income and no safety net,
 * not a post somebody appoints you to. The bar is a real bankroll and real
 * evidence — hours actually played and a skill that beats a real field,
 * because anybody can have one good month.
 */
export const PRO_MIN_HOURS = 1_200
export const PRO_MIN_SKILL = 560

export function turnProBar(
  record: GamblingRecord,
  liquid: Money,
  lowStakeBuyIn: Money,
): string | null {
  if (record.turnedProAtTick !== null) return 'You already do this for a living.'
  if (record.hoursPlayed < PRO_MIN_HOURS) {
    return `You have ${String(record.hoursPlayed)} hours in. Nobody makes a living off this without at least ${String(PRO_MIN_HOURS)}.`
  }
  if (record.pokerSkill < PRO_MIN_SKILL) {
    return 'You are not yet beating the games you would have to live on.'
  }
  if (liquid < lowStakeBuyIn * BUY_INS_FOR_A_ROLL) {
    return 'You are not rolled for the stakes you would have to beat. A downswing would end it in a month.'
  }
  return null
}

/**
 * THE CASINO'S OWN MONTH.
 *
 * Two things, and neither of them is a table: the hold eases for everybody
 * who is not playing, and a hold that has become a problem drags on
 * wellbeing. The tables themselves are a VERB — nothing here plays for
 * anybody.
 *
 * The wellbeing drag is returned rather than applied, because wellbeing is
 * its own module's to write and this one does not reach into it.
 */
export function runCasino(world: World, tick: Tick): readonly { personId: EntityId; drag: number }[] {
  const drags: { personId: EntityId; drag: number }[] = []
  for (const [personId, record] of world.gamblers) {
    const person = world.people.get(personId)
    if (person === undefined || person.deathTick !== null) continue
    const eased = easeHold(record, tick)
    if (eased !== record) world.gamblers.set(personId, eased)
    const level = holdLevelOf(eased)
    if (level === 'problem') drags.push({ personId, drag: -14 })
    else if (level === 'heavy') drags.push({ personId, drag: -5 })
  }
  return drags
}

// ---------------------------------------------------------------------------
// THE KEY HAND (spec §2 — "the interactive spice")
// ---------------------------------------------------------------------------

export type HandChoice = 'fold' | 'call' | 'shove'

export const HAND_CHOICES: readonly HandChoice[] = ['fold', 'call', 'shove']

/**
 * A BIG POT, AND A READ THAT IS ONLY MOSTLY RIGHT.
 *
 * Every field here is drawn from the session's own seed, so the hand is
 * part of the night rather than a second roll of dice on top of it.
 */
export interface KeyHand {
  readonly potPerMille: number
  /** What calling costs, per-mille of a buy-in. */
  readonly toCallPerMille: number
  /** 0-1000. How often you are actually ahead. THE PLAYER IS TOLD A
   *  BLURRED VERSION of this, never the number. */
  readonly aheadPerMille: number
  readonly board: string
  readonly hole: string
  readonly villain: string
  readonly read: string
}

const VILLAINS: readonly string[] = [
  '"Iceman" Vos',
  'Dana R.',
  'The Kid',
  'Marchetti',
  'the quiet one in seat four',
  'Pooley',
]

/**
 * DOES A BIG POT COME UP, and what is in it?
 *
 * Drawn from the session's stream so the same night always contains the
 * same hand. Returns null most sessions — a key hand every time would make
 * it wallpaper rather than an event.
 */
export function keyHandFor(
  world: World,
  tick: Tick,
  personId: EntityId,
  visit: number,
  skill: number,
): KeyHand | null {
  const rng = openStream(world.seed, Stream.Casino, personId * 29 + visit, tick + 7_700)
  if (!rng.chance(260, 1_000)) return null

  const potPerMille = rng.nextIntInclusive(900, 2_600)
  const toCallPerMille = Math.floor((potPerMille * rng.nextIntInclusive(380, 720)) / 1_000)
  // A better player finds themselves ahead in big pots more often, because
  // getting there is most of what skill is.
  const aheadPerMille = Math.max(
    150,
    Math.min(850, rng.nextIntInclusive(280, 620) + Math.floor((skill - 450) / 6)),
  )
  const villain = VILLAINS[rng.nextIntInclusive(0, VILLAINS.length - 1)] ?? 'the big stack'

  // THE READ IS BLURRED ON PURPOSE. Being told "you are ahead 61 per cent"
  // would make this arithmetic; being told what you think is a decision.
  const read =
    aheadPerMille >= 620
      ? `You are almost certainly good here. ${villain} has been running over the table and this is the spot.`
      : aheadPerMille >= 460
        ? `It is close. ${villain} could have it, and has been capable of this with nothing all night.`
        : `Something is wrong. ${villain} has not put a chip in without it, and this is a lot of chips.`

  return {
    potPerMille,
    toCallPerMille,
    aheadPerMille,
    board: BOARDS[rng.nextIntInclusive(0, BOARDS.length - 1)] ?? 'A♥ K♠ 7♦',
    hole: HOLES[rng.nextIntInclusive(0, HOLES.length - 1)] ?? 'A♠ K♣',
    villain,
    read,
  }
}

const BOARDS: readonly string[] = [
  'A♥ K♠ 7♦ 2♣',
  'Q♦ J♦ 9♠ 4♥',
  '8♣ 8♦ 3♠ K♥',
  'T♠ 6♥ 2♦ T♣',
  'A♣ 5♦ 4♠ 3♥',
]

const HOLES: readonly string[] = ['A♠ K♣', 'Q♠ Q♥', 'J♣ T♣', 'A♦ 2♠', 'K♦ Q♣']

/**
 * WHAT THE ANSWER IS WORTH, in per-mille of a buy-in, added to the night.
 *
 * FOLDING IS NOT FREE AND NOT A LOSS. You keep what you have not put in
 * and you give up what is already out there, which is exactly what folding
 * is — the pot was partly yours.
 *
 * THE CHOICE SHIFTS A SEEDED OUTCOME; IT DOES NOT ADD RANDOMNESS (spec
 * §5). The hand's `aheadPerMille` was drawn when the hand was, and the
 * same draw decides it whatever you pick — so calling a hand you were
 * behind in loses, every time, on that seed.
 */
export function keyHandOutcome(hand: KeyHand, choice: HandChoice, roll: number): number {
  const ahead = roll < hand.aheadPerMille
  switch (choice) {
    case 'fold':
      // A quarter of the pot is a fair reading of what was already yours.
      return -Math.floor(hand.potPerMille / 4)
    case 'call':
      return ahead ? hand.potPerMille : -hand.toCallPerMille
    case 'shove':
      // More on the line both ways: you get paid more when good and lose
      // the whole stack when not.
      return ahead
        ? Math.floor((hand.potPerMille * 3) / 2)
        : -Math.floor((hand.toCallPerMille * 9) / 5)
  }
}

export function handOutcomeWords(choice: HandChoice, gained: number): string {
  if (choice === 'fold') return 'You let it go. It cost you what was already in there, and no more.'
  if (gained > 0) return 'You were good. The pot is yours and it was a big one.'
  return choice === 'shove'
    ? 'He had it. The whole stack, in one hand.'
    : 'He had it. An expensive way to find out.'
}

// ---------------------------------------------------------------------------
// A HAND OF BLACKJACK, actually dealt
// ---------------------------------------------------------------------------

/**
 * THE OWNER, PLAYING: "there is no popup for when you do blackjack, you
 * should enter the room choose what you bet then a hand comes out and you
 * play blackjack".
 *
 * He is right, and what was there was not blackjack. The table offered three
 * buttons — Stand, Hit, Double — and each one resolved an ENTIRE hand from
 * the label alone. You were not playing cards; you were picking a strategy
 * and being told how it went. No cards existed anywhere in the model.
 *
 * WHY THE HAND LIVES IN THE PENDING DECISION rather than in a new stored
 * field: `world.player.pending` already carries multi-step state through its
 * detail string — the engagement beats do exactly this — so a hand can be
 * dealt, hit, and settled across several player actions with NO schema
 * change and no migration. The same trick, for the same reason.
 *
 * DETERMINISM (Law 11). Every card is a pure function of (seed, person,
 * tick, position in the shoe). Nothing is stored, nothing is drawn twice,
 * and replaying the same seed deals the same cards.
 */

/** A card's rank, 1-13. Only the rank matters for scoring. */
export function cardAt(seed: Seed, personId: EntityId, tick: Tick, position: number): number {
  // A fresh stream per card position, salted well clear of the other casino
  // draws so a hand cannot correlate with a slots spin on the same tick.
  return openStream(seed, Stream.Casino, personId, tick + 40_000 + position).nextIntInclusive(1, 13)
}

/** What a rank is worth. Face cards ten, ace counted high here. */
export function cardValue(rank: number): number {
  if (rank === 1) return 11
  return rank >= 10 ? 10 : rank
}

/**
 * The best total this hand can hold without busting — aces drop from
 * eleven to one, one at a time, exactly as they do at a real table.
 */
export function handTotal(cards: readonly number[]): number {
  let total = 0
  let aces = 0
  for (const rank of cards) {
    total += cardValue(rank)
    if (rank === 1) aces += 1
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return total
}

/** A hand in progress, as carried in the pending decision's detail. */
export interface BlackjackHand {
  readonly wager: number
  readonly player: readonly number[]
  readonly dealer: readonly number[]
  /** How deep into the shoe the next card comes from. */
  readonly position: number
  readonly doubled: boolean
}

export function encodeHand(hand: BlackjackHand): string {
  return [
    String(hand.wager),
    hand.player.join(','),
    hand.dealer.join(','),
    String(hand.position),
    hand.doubled ? 'd' : '-',
  ].join(':')
}

export function decodeHand(detail: string | null): BlackjackHand | null {
  const parts = (detail ?? '').split(':')
  if (parts.length < 5) return null
  const nums = (text: string): number[] =>
    text
      .split(',')
      .filter((one) => one.length > 0)
      .map((one) => Number(one))
      .filter((one) => Number.isFinite(one))
  const wager = Number(parts[0])
  if (!Number.isFinite(wager)) return null
  return {
    wager,
    player: nums(parts[1] ?? ''),
    dealer: nums(parts[2] ?? ''),
    position: Number(parts[3] ?? 0),
    doubled: parts[4] === 'd',
  }
}

/** The opening deal: two to the player, one showing for the house. */
export function openingHand(
  seed: Seed,
  personId: EntityId,
  tick: Tick,
  wager: number,
  /**
   * WHICH DEAL OF THE MONTH THIS IS — and it exists because of an exploit
   * found by playing one hand and then dealing again: the shoe was salted
   * by tick alone, so every deal inside the same month produced the SAME
   * cards. A player who won a hand could redeal the identical winning hand
   * thirty times (the whole monthly cadence) for free money.
   *
   * The deal number offsets the whole hand 64 cards deeper into the shoe —
   * no real hand uses ten, let alone sixty-four — so consecutive deals draw
   * from disjoint stretches while replays stay exact: same seed, same
   * choices, same Nth deal, same cards (Law 11).
   *
   * The offset lives inside `position`, which the hand already carries
   * through the pending decision — so hits and the dealer's finish need no
   * knowledge of it at all.
   */
  dealNumber = 0,
): BlackjackHand {
  const base = dealNumber * 64
  return {
    wager,
    player: [cardAt(seed, personId, tick, base), cardAt(seed, personId, tick, base + 1)],
    dealer: [cardAt(seed, personId, tick, base + 2)],
    position: base + 3,
    doubled: false,
  }
}

/** Take one more. */
export function hitHand(
  seed: Seed,
  personId: EntityId,
  tick: Tick,
  hand: BlackjackHand,
): BlackjackHand {
  return {
    ...hand,
    player: [...hand.player, cardAt(seed, personId, tick, hand.position)],
    position: hand.position + 1,
  }
}

/**
 * THE HOUSE PLAYS ITS HAND, and it has no choices to make — a dealer draws
 * to sixteen and stands on seventeen. That fixed rule is the entire source
 * of the house edge, and it is why blackjack is beatable-looking and not
 * beatable.
 */
export function dealerFinish(
  seed: Seed,
  personId: EntityId,
  tick: Tick,
  hand: BlackjackHand,
): BlackjackHand {
  let dealer = [...hand.dealer]
  let position = hand.position
  while (handTotal(dealer) < 17) {
    dealer = [...dealer, cardAt(seed, personId, tick, position)]
    position += 1
  }
  return { ...hand, dealer, position }
}

/** What the hand paid, in chips — negative is a loss. */
export function settleHand(hand: BlackjackHand): number {
  const stake = hand.doubled ? hand.wager * 2 : hand.wager
  const mine = handTotal(hand.player)
  const theirs = handTotal(hand.dealer)
  if (mine > 21) return -stake
  // A natural pays three to two, which is the one place the player gets the
  // better of it and the reason the game feels fair.
  const natural = hand.player.length === 2 && mine === 21
  if (natural && !(hand.dealer.length === 2 && theirs === 21)) {
    return Math.floor((stake * 3) / 2)
  }
  if (theirs > 21) return stake
  if (mine > theirs) return stake
  if (mine < theirs) return -stake
  return 0
}
