/**
 * WHO OWNS THE BUSINESS (the business revamp, owner's ruling 2026-08-13).
 *
 * A trade starts wholly the founder's. Money can be raised against it, and
 * every share sold is a share of everything it will ever earn — which is
 * the whole of the decision. Nobody is forced to raise; a business that
 * never takes a penny from anybody stays at a thousand per-mille and this
 * module never touches it.
 *
 * THE OWNER'S RULING ON WHO INVESTS: *"we can do real townspeople but I
 * also wanted to do generated firms"*. Scale decides which, which is also
 * how it works in life.
 *
 *   - A SEED round is a person. The dentist, the man who sold his hardware
 *     store, possibly your wife's brother. The money leaves THEIR wallet,
 *     to the cent, and when they die their stake passes to their children.
 *     You know them, and that is the point.
 *   - SERIES A AND BEYOND are firms — fictional, out of town, faceless.
 *     Institutional money, correctly impersonal, and a board seat with it.
 *
 * Per-mille throughout, integer, exactly like every other share in this
 * engine. Pure arithmetic: finances moves the money.
 */

import type { EntityId, Money } from '@life-engine/shared'
import type {
  Business,
  BusinessMonth,
  BusinessOps,
  CapTable,
  Expansion,
  ExpansionKind,
  InvestmentRound,
  Shareholder,
} from './types.js'
import { businessKindById } from './business.js'
import type { BusinessKind } from './business.js'

/** A business nobody has raised against: the founder holds all of it. */
export function foundingCapTable(): CapTable {
  return { founderPerMille: 1000, shareholders: [] }
}

/**
 * WHAT THE BUSINESS IS WORTH, for the purpose of selling a piece of it.
 *
 * Revenue times the trade's own multiple — the same machinery the IPO
 * already uses, applied a stage earlier. A private trade is worth what its
 * earnings are worth to somebody else, and no more.
 */
/** Months of trading before anybody will price it on its earnings. */
export const TRACK_RECORD_MONTHS = 6

/** What a year of demonstrated profit is worth to a buyer. */
export const EARNINGS_MULTIPLE = 8

export function privateValuationOf(
  world: {
    readonly tick: number
    readonly businessBooks: ReadonlyMap<EntityId, readonly BusinessMonth[]>
    readonly businessOps: ReadonlyMap<EntityId, BusinessOps>
  },
  business: Business,
): Money {
  const kind = businessKindById(business.kindId)
  if (kind === undefined || business.closedTick !== null) return 0 as Money

  /**
   * A BUSINESS IS WORTH WHAT IT HAS EARNED, not what it might.
   *
   * THE EXPLOIT THIS CLOSES (owner, playing): "when you start a business
   * the worth is automatically super high, I just started a business for 9k
   * worth 553k at the very start now, this is bad because now we can just
   * sell and make all that money."
   *
   * He is exactly right, and the cause was valuing a business on its
   * THEORETICAL capacity: revenue implied from the capital, times a
   * multiple, from the first day. A trade bought on Monday was worth
   * fifteen times its price on Tuesday, and selling it was free money —
   * which would have made every other way of earning in this game pointless.
   *
   * So the price is what a buyer would actually pay: the ASSETS (the money
   * in the till and the stock on the shelf, which are really there) plus a
   * multiple of the profit it has DEMONSTRATED over the last year. A
   * business with no track record is worth its assets and not a penny more,
   * so flipping it loses you the private-sale haircut. A business that has
   * genuinely earned for a year is worth a great deal, which is the whole
   * reward for having run it well.
   */
  const ops = world.businessOps.get(business.id)
  const assets = (business.capital + (ops?.stockCents ?? 0)) as Money

  const books = world.businessBooks.get(business.id) ?? []
  if (books.length < TRACK_RECORD_MONTHS) return assets

  const recent = books.slice(-12)
  const earned = recent.reduce((sum, month) => sum + month.profit, 0)
  if (earned <= 0) return assets

  // Scaled to a full year where there is less than a year of it, so six
  // good months are not quietly counted as twelve.
  const annual = Math.floor((earned * 12) / recent.length)
  return (assets + annual * EARNINGS_MULTIPLE) as Money
}

/** What each round buys, and what it costs the founder. */
export interface RoundTerms {
  readonly round: InvestmentRound
  readonly title: string
  /** The slice the money buys, per-mille of the whole. */
  readonly perMille: number
  /** A seat at the table — institutions take one, an angel does not. */
  readonly boardSeat: boolean
  /** What they get back before anybody else, per-mille of what they put in. */
  readonly preferencePerMille: number
}

export const ROUNDS: readonly RoundTerms[] = [
  {
    round: 'seed',
    title: 'a local backer',
    perMille: 100,
    boardSeat: false,
    preferencePerMille: 1000,
  },
  {
    round: 'series-a',
    title: 'a first institutional round',
    perMille: 200,
    boardSeat: true,
    preferencePerMille: 1500,
  },
  {
    round: 'series-b',
    title: 'a growth round',
    perMille: 180,
    boardSeat: true,
    preferencePerMille: 2000,
  },
  {
    round: 'series-c',
    title: 'a late round',
    perMille: 150,
    boardSeat: true,
    preferencePerMille: 2500,
  },
]

export function termsFor(round: InvestmentRound): RoundTerms | undefined {
  return ROUNDS.find((entry) => entry.round === round)
}

/** The next round this business could take, or undefined when it is done raising. */
export function nextRoundFor(table: CapTable): RoundTerms | undefined {
  const taken = new Set(table.shareholders.map((holder) => holder.round))
  return ROUNDS.find((entry) => !taken.has(entry.round))
}

/**
 * WHAT THE MONEY COSTS TO RAISE. The investor pays the slice's worth of
 * the business as it stands — a bigger business sells the same slice for
 * more, which is the entire reason to wait.
 */
export function investmentFor(valuation: Money, terms: RoundTerms): Money {
  return Math.max(1, Math.floor((valuation * terms.perMille) / 1000)) as Money
}

/**
 * ISSUE THE SHARES.
 *
 * Everybody already on the register is diluted in proportion, the founder
 * included — that is what dilution IS, and doing it any other way would
 * quietly rob whoever came first. Conserving by construction: the slices
 * are scaled by the same factor and the new one takes exactly what it
 * bought, so the register still sums to a thousand.
 */
export function issueShares(table: CapTable, holder: Shareholder): CapTable {
  const keep = 1000 - holder.perMille
  const diluted = table.shareholders.map((existing) => ({
    ...existing,
    perMille: Math.floor((existing.perMille * keep) / 1000),
  }))
  const issued = [...diluted, holder]
  // THE ROUNDING GOES TO THE FOUNDER, so the register sums to exactly a
  // thousand and the odd per-mille is not quietly created or destroyed.
  const held = issued.reduce((sum, entry) => sum + entry.perMille, 0)
  return { founderPerMille: Math.max(0, 1000 - held), shareholders: issued }
}

/** Does the register still account for the whole business? */
export function capTableSums(table: CapTable): boolean {
  const held = table.shareholders.reduce((sum, entry) => sum + entry.perMille, 0)
  return table.founderPerMille + held === 1000
}

/** What this slice of a month's drawing is worth, in cents. */
export function shareOf(amount: Money, perMille: number): Money {
  return Math.floor((amount * perMille) / 1000) as Money
}

/** How the board would vote, by the weight of what they hold. */
export function boardWeightFor(table: CapTable): number {
  return table.shareholders
    .filter((holder) => holder.boardSeat)
    .reduce((sum, holder) => sum + holder.perMille, 0)
}

// ---------------------------------------------------------------------------
// Growing beyond the four walls
// ---------------------------------------------------------------------------

/** What each way of growing costs and what it buys. */
export interface ExpansionTerms {
  readonly kind: ExpansionKind
  readonly title: string
  readonly blurb: string
  /** Cost as a share of what the trade took to open, per-mille. */
  readonly costPerMille: number
  /** What it adds to the monthly earning, per-mille. */
  readonly upliftPerMille: number
  /** Years of trading before anybody would consider it. */
  readonly yearsTrading: number
  /** Consecutive profitable months before it is worth trying. */
  readonly goodMonths: number
}

/**
 * THE LADDER, in the order a real business climbs it.
 *
 * A second location is the ordinary next step and the cheapest. Franchising
 * needs a name worth licensing, so it asks for far longer at the wheel and
 * pays a smaller, safer royalty. Owning the supplier is the most expensive
 * and the most valuable, because it takes a bite out of everything the
 * business will ever buy.
 */
export const EXPANSIONS: readonly ExpansionTerms[] = [
  {
    kind: 'location',
    title: 'Open a second place',
    blurb: 'Another set of doors, trading on its own, under the same name.',
    costPerMille: 700,
    upliftPerMille: 550,
    yearsTrading: 2,
    goodMonths: 12,
  },
  {
    kind: 'supply-chain',
    title: 'Buy your supplier',
    blurb: 'Own what you buy from, and take the margin they were charging you.',
    costPerMille: 1200,
    upliftPerMille: 400,
    yearsTrading: 3,
    goodMonths: 18,
  },
  {
    kind: 'franchise',
    title: 'License the name',
    blurb: 'Let somebody else run one and pay you for the sign above the door.',
    costPerMille: 500,
    upliftPerMille: 300,
    yearsTrading: 5,
    goodMonths: 24,
  },
]

export function expansionTermsFor(kind: ExpansionKind): ExpansionTerms | undefined {
  return EXPANSIONS.find((entry) => entry.kind === kind)
}

/**
 * WHAT THE EXPANSIONS ADD TOGETHER, per-mille of the ordinary month.
 *
 * Additive rather than compounding, deliberately: three ways of growing
 * should make a business three times bigger, not eight times. Compounding
 * here is how a shop quietly becomes worth more than the town.
 */
export function upliftPerMilleOf(list: readonly Expansion[] | undefined): number {
  if (list === undefined || list.length === 0) return 0
  return list.reduce((sum, entry) => sum + entry.upliftPerMille, 0)
}

// ---------------------------------------------------------------------------
// The market: who else is in this trade, and how the town's custom splits
// ---------------------------------------------------------------------------

/**
 * HOW STRONG A BUSINESS IS IN ITS MARKET, in arbitrary weight.
 *
 * Weight, not a share — the share falls out of dividing one business's
 * weight by everybody's. That is the whole reason this is written this way:
 * shares computed independently do not add up to the town's custom, and a
 * market where the parts do not sum to the whole is a market that invents
 * customers. (The supplied design computed each share on its own and never
 * normalised; it also had UNDERCUTTING LOSE share, its formula peaking at
 * exactly the market average.)
 *
 * Three things make a business strong, and every one of them is something
 * the owner did: the capital in it, the people working there, and how far
 * it has grown beyond its own doors.
 */
export function marketWeightOf(
  business: Business,
  staffCount: number,
  expansionPerMille: number,
): number {
  if (business.closedTick !== null) return 0
  // Capital is the floor — a bigger business serves more people.
  const fromCapital = Math.max(1, Math.floor(business.capital / 10_000))
  // Staff multiply what one pair of hands could do.
  const fromStaff = staffCount * 40
  // And growth counts for what it cost.
  const fromGrowth = Math.floor((fromCapital * expansionPerMille) / 1000)
  return fromCapital + fromStaff + fromGrowth
}

/**
 * WHAT SHARE OF THE TRADE'S CUSTOM THIS ONE TAKES, per-mille.
 *
 * By construction the shares of everybody in a trade sum to a thousand, so
 * the town's custom is conserved: one business winning is another losing,
 * which is what competition IS. A trade with one business in it takes all
 * of it, and correctly feels no competition at all.
 */
export function shareOfTradePerMille(mine: number, allWeights: readonly number[]): number {
  const total = allWeights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 1000
  return Math.floor((mine * 1000) / total)
}

/**
 * WHAT COMPETITION DOES TO THE MONTH, per-mille of the ordinary earning.
 *
 * A business alone in its trade earns what it always did. Rivals take
 * custom away, and the model is deliberately gentle at the top and harsh
 * at the bottom: holding half a two-horse trade costs you nothing, being
 * the fourth shop of five hurts.
 *
 * Expressed against the EVEN share rather than against a thousand, so a
 * trade with more businesses in it is not automatically poorer for
 * everybody — only for whoever is losing.
 */
export function competitionPerMilleFor(sharePerMille: number, rivals: number): number {
  if (rivals <= 0) return 0
  const even = Math.floor(1000 / (rivals + 1))
  if (even <= 0) return 0
  // How far above or below an even split this business sits, per-mille of
  // the even split, clamped so one dominant shop cannot earn without end.
  const relative = Math.floor((sharePerMille * 1000) / even) - 1000
  return Math.max(-600, Math.min(500, Math.floor(relative / 2)))
}

// ---------------------------------------------------------------------------
// The books, and the board
// ---------------------------------------------------------------------------

/** A stretch of months added up, for the profit-and-loss screen. */
export interface Ledger {
  readonly months: number
  readonly takings: Money
  readonly wages: Money
  readonly profit: Money
  readonly drawn: Money
  readonly retained: Money
  /** Profit as a share of takings, per-mille. Negative where it lost money. */
  readonly marginPerMille: number
}

export function summarise(months: readonly BusinessMonth[]): Ledger {
  const takings = months.reduce((sum, m) => sum + m.takings, 0)
  const wages = months.reduce((sum, m) => sum + m.wages, 0)
  const profit = months.reduce((sum, m) => sum + m.profit, 0)
  return {
    months: months.length,
    takings: takings as Money,
    wages: wages as Money,
    profit: profit as Money,
    drawn: months.reduce((sum, m) => sum + m.drawn, 0) as Money,
    retained: months.reduce((sum, m) => sum + m.retained, 0) as Money,
    marginPerMille: takings === 0 ? 0 : Math.floor((profit * 1000) / takings),
  }
}

/**
 * IS THE BUSINESS GOING THE RIGHT WAY? Per-mille, comparing the last year
 * against the year before it. Zero where there is not yet enough history to
 * say, which is honest rather than flattering.
 */
export function growthPerMilleOf(months: readonly BusinessMonth[]): number {
  if (months.length < 24) return 0
  const older = summarise(months.slice(0, 12)).takings
  const recent = summarise(months.slice(12)).takings
  if (older <= 0) return 0
  return Math.floor(((recent - older) * 1000) / older)
}

/** What the board makes of it, and why. */
export interface BoardView {
  /** Combined weight of the seats held, per-mille. */
  readonly weightPerMille: number
  readonly approves: boolean
  readonly reason: string
}

/**
 * HOW THE BOARD WOULD VOTE.
 *
 * Institutions take a seat when they buy in, and a seat is worth something
 * or it is decoration. They read three things — is it growing, is it making
 * money, is it steady — and they are not sentimental about any of them.
 *
 * A business with no board approves everything, because there is nobody to
 * ask. That is the ordinary case and it stays frictionless.
 */
export function boardViewFor(
  table: CapTable | undefined,
  books: readonly BusinessMonth[],
  badMonths: number,
): BoardView {
  const weight = table === undefined ? 0 : boardWeightFor(table)
  if (weight <= 0) {
    return { weightPerMille: 0, approves: true, reason: 'Nobody to answer to but yourself.' }
  }
  const year = summarise(books.slice(-12))
  const growth = growthPerMilleOf(books)
  if (badMonths > 0) {
    return {
      weightPerMille: weight,
      approves: false,
      reason: 'They will not back anything in the middle of a bad run.',
    }
  }
  if (year.profit <= 0) {
    return {
      weightPerMille: weight,
      approves: false,
      reason: 'A year that lost money is not a year they will put more into.',
    }
  }
  if (growth < -100) {
    return {
      weightPerMille: weight,
      approves: false,
      reason: 'Takings are going backwards, and they can read.',
    }
  }
  return {
    weightPerMille: weight,
    approves: true,
    reason:
      growth > 100
        ? 'Growing, profitable, and they would like more of it.'
        : 'Steady enough that nobody round the table objects.',
  }
}

// ---------------------------------------------------------------------------
// Growing it: the five ways, named for the trade
// ---------------------------------------------------------------------------

/**
 * THE WALL, AND HOW YOU MOVE IT (owner: "there is no real ways to grow the
 * business, we need actions the players can take depending on their type of
 * business to be able to grow and make more money").
 *
 * The reason a business stopped growing was never the player: retained
 * profit was capped at four times what the trade took to open, and after
 * that a well-run shop and a badly-run one arrived at the same place. That
 * cap is what CAPACITY moves — repeatable, dearer every time, and the only
 * road from a four-times trade to a twenty-five-times one.
 *
 * The other four do not touch the ceiling. They decide whether you are the
 * shop people go to, which since the market landed is a thing that takes
 * custom off named rivals rather than conjuring it.
 */
export const CEILING_STEP_PER_MILLE = 3000
export const CEILING_STEPS_MAX = 7

/** How the five read for a trade that sells goods, and one that sells hours. */
interface GrowthNames {
  readonly title: string
  readonly blurb: string
}

const GOODS_NAMES: Readonly<Record<string, GrowthNames>> = {
  capacity: { title: 'Take on more room', blurb: 'More space, more shelves, more you can sell in a month.' },
  reputation: { title: 'Build the name', blurb: 'Be the one people mean when they name the trade.' },
  quality: { title: 'Raise the standard', blurb: 'Better goods, better kept. People notice both.' },
  'new-line': { title: 'Add a line', blurb: 'Something else on the shelf, for the people already through the door.' },
  contracts: { title: 'Land a standing order', blurb: 'Somebody who buys every month whatever the month is like.' },
}

const SERVICE_NAMES: Readonly<Record<string, GrowthNames>> = {
  capacity: { title: 'Take on more room', blurb: 'Another chair, another pair of hands, more people seen in a week.' },
  reputation: { title: 'Build the name', blurb: 'Be the one people ask for by name.' },
  quality: { title: 'Raise the standard', blurb: 'Train them properly. It shows, and it is charged for.' },
  'new-line': { title: 'Offer something new', blurb: 'Another service, for the people already coming to you.' },
  contracts: { title: 'Land a standing booking', blurb: 'Regular work that does not care what kind of month it is.' },
}

/** A trade that keeps much of its money on a shelf sells goods. */
function sellsGoods(kind: BusinessKind): boolean {
  return kind.cogsPerMille >= 300
}

export interface GrowthTerms {
  readonly kind: ExpansionKind
  readonly title: string
  readonly blurb: string
  /** Cost as a share of what the trade took to open, per-mille. */
  readonly costPerMille: number
  readonly upliftPerMille: number
  readonly ceilingPerMille: number
  readonly weightBonus: number
  readonly floorPerMille: number
  readonly yearsTrading: number
  readonly repeatable: boolean
}

export function growthOptionsFor(kind: BusinessKind): readonly GrowthTerms[] {
  const names = sellsGoods(kind) ? GOODS_NAMES : SERVICE_NAMES
  const of = (id: string): GrowthNames =>
    names[id] ?? { title: 'Grow it', blurb: 'More of what you already do.' }
  return [
    {
      kind: 'capacity',
      ...of('capacity'),
      costPerMille: 900,
      upliftPerMille: 90,
      ceilingPerMille: CEILING_STEP_PER_MILLE,
      weightBonus: 0,
      floorPerMille: 0,
      yearsTrading: 1,
      repeatable: true,
    },
    {
      kind: 'reputation',
      ...of('reputation'),
      costPerMille: 450,
      upliftPerMille: 60,
      ceilingPerMille: 0,
      weightBonus: 120,
      floorPerMille: 0,
      yearsTrading: 2,
      repeatable: false,
    },
    {
      kind: 'quality',
      ...of('quality'),
      costPerMille: 550,
      upliftPerMille: 120,
      ceilingPerMille: 0,
      weightBonus: 60,
      floorPerMille: 0,
      yearsTrading: 2,
      repeatable: false,
    },
    {
      kind: 'new-line',
      ...of('new-line'),
      costPerMille: 700,
      upliftPerMille: 200,
      ceilingPerMille: 0,
      weightBonus: 0,
      floorPerMille: 0,
      yearsTrading: 3,
      repeatable: false,
    },
    {
      kind: 'contracts',
      ...of('contracts'),
      costPerMille: 800,
      upliftPerMille: 80,
      ceilingPerMille: 0,
      weightBonus: 40,
      /** Steady money: a ruinous month is far less ruinous. */
      floorPerMille: 500,
      yearsTrading: 4,
      repeatable: false,
    },
  ]
}

export function growthTermsFor(kind: BusinessKind, which: ExpansionKind): GrowthTerms | undefined {
  return growthOptionsFor(kind).find((entry) => entry.kind === which)
}

/**
 * HOW FAR THE CEILING HAS BEEN MOVED, per-mille above the founding four.
 *
 * Capped, because a ceiling that rises without end is no ceiling: seven
 * steps of three takes a trade from four times its founding capital to
 * twenty-five, which is what a business worth ten million looks like from
 * where it started.
 */
export function ceilingBonusPerMilleOf(list: readonly Expansion[] | undefined): number {
  if (list === undefined) return 0
  const steps = list.filter((entry) => entry.kind === 'capacity').length
  return Math.min(CEILING_STEPS_MAX, steps) * CEILING_STEP_PER_MILLE
}

/** What growth adds to your weight against the rivals in your trade. */
export function weightBonusOf(list: readonly Expansion[] | undefined): number {
  if (list === undefined) return 0
  return list.reduce((sum, entry) => sum + (entry.weightBonus ?? 0), 0)
}

/** How far growth has lifted the floor under a bad month, per-mille. */
export function floorLiftPerMilleOf(list: readonly Expansion[] | undefined): number {
  if (list === undefined) return 0
  return list.reduce((sum, entry) => sum + (entry.floorPerMille ?? 0), 0)
}
