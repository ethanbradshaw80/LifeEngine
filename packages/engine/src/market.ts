/**
 * THE MARKET (M-ECON §5).
 *
 * An index and a handful of FICTIONAL sectors — no real company is named,
 * ever (Part F). Each sector has its own character: how hard it swings, and
 * how much of the economy's weather it feels. Defense rises in a war that
 * would flatten Consumer; Agricultural barely notices either.
 *
 * Prices are basis points from a 10,000 start, so "10,000" reads as 100 and
 * everything stays integer (ADR-0008). A holding is UNITS, and its value is
 * units × price ÷ 10,000 — which means a unit bought at 10,000 cost exactly
 * one dollar's worth of index, and the arithmetic never leaves cents.
 */

import type { Money, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import { recordEvent } from './records.js'
import { homeland } from './geopolitics.js'
import type { AnalystView, EconomyState, Holding, Stock, World } from './types.js'

export interface Sector {
  readonly id: string
  readonly title: string
  /** How far it swings per month, in basis points of itself. */
  readonly volatility: number
  /** How much of the cycle's growth it feels, per-mille. 1000 is all of it. */
  readonly beta: number
  /** What a war does to it, in basis points a month. Negative for some. */
  readonly warEffect: number
  /** Annual dividend, per-mille of value. Paid monthly, floored. */
  readonly dividendPerMille: number
}

/**
 * The sectors, moved toward the real GICS set (spec §2).
 *
 * THE FOUR ORIGINAL IDS ARE UNTOUCHED — `industrial`, `agricultural`,
 * `defense`, `consumer`. Every holding in every existing save is keyed by
 * one of those strings, and renaming even one would orphan somebody's
 * portfolio. Their TITLES move to the GICS words where the mapping is
 * honest (Industrial -> Industrials, Agricultural -> Materials, which is
 * where agriculture actually sits) and the rest are appended.
 *
 * Defense stays a sector of its own rather than becoming an Industrials
 * sub-industry as the spec suggests, for one concrete reason: `warEffect`
 * is per-sector and it is the hook that makes a war visible in a
 * portfolio. Folding it in would have thrown that away to gain a taxonomy
 * nobody can see. It is named as the sub-industry it really is.
 *
 * Sector shapes are BALANCE NUMBERS. Utilities pay the most and move the
 * least; technology is the opposite; energy is the one that likes a war
 * nearly as much as defense does.
 */
export const SECTORS: readonly Sector[] = [
  {
    id: 'industrial',
    title: 'Industrials',
    volatility: 190,
    beta: 1300,
    warEffect: 40,
    dividendPerMille: 22,
  },
  {
    id: 'agricultural',
    title: 'Materials',
    volatility: 110,
    beta: 500,
    warEffect: 15,
    dividendPerMille: 38,
  },
  {
    id: 'defense',
    title: 'Aerospace & Defense',
    volatility: 160,
    beta: 700,
    warEffect: 120,
    dividendPerMille: 26,
  },
  {
    id: 'consumer',
    title: 'Consumer',
    volatility: 145,
    beta: 1100,
    warEffect: -35,
    dividendPerMille: 30,
  },
  // Appended below. Existing saves have no price for these; freshSectorPrices
  // and the step both default a missing one to par, so they simply begin.
  {
    id: 'technology',
    title: 'Technology',
    volatility: 280,
    beta: 1600,
    warEffect: -10,
    dividendPerMille: 8,
  },
  {
    id: 'health',
    title: 'Health Care',
    volatility: 150,
    beta: 800,
    warEffect: 20,
    dividendPerMille: 20,
  },
  {
    id: 'financials',
    title: 'Financials',
    volatility: 210,
    beta: 1400,
    warEffect: -50,
    dividendPerMille: 34,
  },
  {
    id: 'energy',
    title: 'Energy',
    volatility: 240,
    beta: 900,
    warEffect: 90,
    dividendPerMille: 42,
  },
  {
    id: 'utilities',
    title: 'Utilities',
    volatility: 70,
    beta: 300,
    warEffect: 5,
    dividendPerMille: 52,
  },
  {
    id: 'realestate',
    title: 'Real Estate',
    volatility: 130,
    beta: 1000,
    warEffect: -40,
    dividendPerMille: 46,
  },
  {
    id: 'communications',
    title: 'Communication Services',
    volatility: 175,
    beta: 1200,
    warEffect: -15,
    dividendPerMille: 18,
  },
]

export function sectorById(id: string): Sector | undefined {
  return SECTORS.find((s) => s.id === id)
}

/** Every sector at its starting price. */
export function freshSectorPrices(): Readonly<Record<string, number>> {
  const prices: Record<string, number> = {}
  for (const sector of SECTORS) prices[sector.id] = 10_000
  return prices
}

/**
 * One month of prices.
 *
 * The trend is the economy's growth through the sector's beta; the swing is
 * its own volatility; a war leans on it either way. Floored at a thousand —
 * a sector can be gutted but this world does not model one going to zero,
 * and pretending otherwise would make a holding vanish rather than crash.
 */
export function stepSectors(
  world: World,
  tick: Tick,
  economy: EconomyState,
  atWar: boolean,
): Readonly<Record<string, number>> {
  const next: Record<string, number> = {}
  for (const sector of SECTORS) {
    const rng = openStream(world.seed, Stream.Economy, sector.id.length, tick + 88_000 + sector.volatility)
    const current = world.sectorPrices[sector.id] ?? 10_000
    const trend = Math.trunc((economy.growthPerMille * sector.beta) / 1000)
    const swing = rng.nextIntInclusive(-sector.volatility, sector.volatility)
    const war = atWar ? sector.warEffect : 0
    next[sector.id] = Math.max(
      1_000,
      current + Math.trunc((current * (trend + swing + war)) / 10_000),
    )
  }
  return next
}

/** What one holding is worth today, in cents. */
export function holdingValue(world: World, holding: Holding): Money {
  const price = world.sectorPrices[holding.sectorId] ?? 10_000
  return Math.floor((holding.units * price) / 10_000) as Money
}

/** Everything a person's holdings are worth. */
export function portfolioValue(world: World, holdings: readonly Holding[]): Money {
  let total = 0
  for (const holding of holdings) total += holdingValue(world, holding)
  return total as Money
}

/** What the whole market is doing, as one number for a screen. */
export function marketLevel(world: World): number {
  let total = 0
  for (const sector of SECTORS) total += world.sectorPrices[sector.id] ?? 10_000
  return Math.floor(total / SECTORS.length)
}

/**
 * Units bought for a sum of cents, at today's price. Floored: you get the
 * units the money actually buys, and the remainder stays as cash rather
 * than conjuring a fraction of a unit.
 */
export function unitsFor(world: World, sectorId: string, cents: Money): number {
  const price = world.sectorPrices[sectorId] ?? 10_000
  if (price <= 0) return 0
  return Math.floor((cents * 10_000) / price)
}

/** This month's dividend on a holding. Floored, so small holdings pay none. */
export function dividendOn(world: World, holding: Holding): Money {
  const sector = sectorById(holding.sectorId)
  if (!sector) return 0 as Money
  const value = holdingValue(world, holding)
  return Math.floor((value * sector.dividendPerMille) / (1000 * 12)) as Money
}

// ---------------------------------------------------------------------------
// The company layer (spec §1-§3)
// ---------------------------------------------------------------------------

/**
 * THE LISTED COMPANIES. Every one invented; every sector real (charter §3).
 *
 * Thirty-three names, which is inside the spec's own "~30-50 at launch, grow
 * later" and enough that a sector has more than one story in it. The table
 * is the whole of it — adding a company is a row here and nothing else,
 * which is why the idiosyncratic draw was given its own RNG stream.
 *
 * The numbers are BALANCE NUMBERS, not claims about anything. What they
 * are FOR: `betaMultiplier` decides who a bad month hurts most, and
 * `idioVolatility` decides who has news of their own. A utility at 600 and
 * 40 barely moves; a semiconductor at 1700 and 260 is a different asset
 * entirely, and that difference is the reason to have individual stocks
 * at all rather than four funds.
 */
export const STOCKS: readonly Stock[] = [
  // Technology
  { id: 'vntk', ticker: 'VNTK', name: 'Vantek Semiconductor', sectorId: 'technology', subIndustry: 'Semiconductors', betaMultiplier: 1700, idioVolatility: 260, sharesOutstanding: 82_000_000, baseEarnings: 410000000 as Money, blurb: 'Designs and fabricates logic chips. Sells to everyone, is beholden to a handful of them, and lives or dies on a product cycle it announces two years early.' },
  { id: 'hlix', ticker: 'HLIX', name: 'Helix Systems', sectorId: 'technology', subIndustry: 'Software', betaMultiplier: 1400, idioVolatility: 210, sharesOutstanding: 54_000_000, baseEarnings: 290000000 as Money, blurb: 'Business software on long contracts. Boring in the way that compounds, until a competitor is cheaper.' },
  { id: 'nrth', ticker: 'NRTH', name: 'Northgate Data', sectorId: 'technology', subIndustry: 'IT Services', betaMultiplier: 1250, idioVolatility: 175, sharesOutstanding: 38_000_000, baseEarnings: 180000000 as Money, blurb: 'Runs other companies systems. Wins when firms cut their own staff, loses when they cut everything.' },
  { id: 'qbit', ticker: 'QBIT', name: 'Quillbrook Instruments', sectorId: 'technology', subIndustry: 'Hardware', betaMultiplier: 1550, idioVolatility: 240, sharesOutstanding: 21_000_000, baseEarnings: 84000000 as Money, blurb: 'Precision measuring equipment for laboratories and factory floors. Small, specialised, and priced like it.' },
  // Health Care
  { id: 'meds', ticker: 'MEDS', name: 'Aldercrest Pharma', sectorId: 'health', subIndustry: 'Pharmaceuticals', betaMultiplier: 900, idioVolatility: 300, sharesOutstanding: 96_000_000, baseEarnings: 620000000 as Money, blurb: 'A dozen drugs, two of which matter. The patent calendar is the whole business plan.' },
  { id: 'stjn', ticker: 'STJN', name: 'St Junia Health', sectorId: 'health', subIndustry: 'Providers', betaMultiplier: 700, idioVolatility: 120, sharesOutstanding: 44_000_000, baseEarnings: 210000000 as Money, blurb: 'Hospitals and clinics. People fall ill in every kind of economy, which is the entire investment case.' },
  { id: 'orbm', ticker: 'ORBM', name: 'Orbis Medical', sectorId: 'health', subIndustry: 'Devices', betaMultiplier: 1050, idioVolatility: 165, sharesOutstanding: 33_000_000, baseEarnings: 155000000 as Money, blurb: 'Surgical devices sold to purchasing committees. Slow to win an account and slow to lose one.' },
  { id: 'gnva', ticker: 'GNVA', name: 'Genova Labs', sectorId: 'health', subIndustry: 'Biotechnology', betaMultiplier: 1900, idioVolatility: 420, sharesOutstanding: 27_000_000, baseEarnings: 41000000 as Money, blurb: 'Research-stage biology. Worth a great deal or nothing at all, and the gap between those closes on trial dates.' },
  // Financials
  { id: 'mrdn', ticker: 'MRDN', name: 'Meridian Bank', sectorId: 'financials', subIndustry: 'Banks', betaMultiplier: 1350, idioVolatility: 150, sharesOutstanding: 120_000_000, baseEarnings: 740000000 as Money, blurb: 'Deposits in, loans out, and a margin that is entirely the central bank rate.' },
  { id: 'ashf', ticker: 'ASHF', name: 'Ashford Mutual', sectorId: 'financials', subIndustry: 'Insurance', betaMultiplier: 850, idioVolatility: 130, sharesOutstanding: 68_000_000, baseEarnings: 390000000 as Money, blurb: 'Writes policies and invests the float. A quiet business punctuated by disasters.' },
  { id: 'clvr', ticker: 'CLVR', name: 'Calver Trust', sectorId: 'financials', subIndustry: 'Asset Management', betaMultiplier: 1500, idioVolatility: 195, sharesOutstanding: 29_000_000, baseEarnings: 170000000 as Money, blurb: 'Manages other people money for a percentage. Geared to the market twice over.' },
  { id: 'penn', ticker: 'PENN', name: 'Pennsford Credit', sectorId: 'financials', subIndustry: 'Consumer Finance', betaMultiplier: 1600, idioVolatility: 230, sharesOutstanding: 41_000_000, baseEarnings: 220000000 as Money, blurb: 'Lends to people the banks decline, at rates that reflect it. Excellent until it is not.' },
  // Consumer
  { id: 'hrvs', ticker: 'HRVS', name: 'Harvest Foods', sectorId: 'consumer', subIndustry: 'Staples', betaMultiplier: 600, idioVolatility: 85, sharesOutstanding: 110_000_000, baseEarnings: 580000000 as Money, blurb: 'Tinned goods and dry stores under a dozen labels. Nobody stops eating.' },
  { id: 'brkl', ticker: 'BRKL', name: 'Brackenwell Stores', sectorId: 'consumer', subIndustry: 'Retail', betaMultiplier: 1450, idioVolatility: 190, sharesOutstanding: 57_000_000, baseEarnings: 260000000 as Money, blurb: 'A chain of shops on the high street. Feels every consumer mood within a fortnight.' },
  { id: 'mrwt', ticker: 'MRWT', name: 'Merriweather Brands', sectorId: 'consumer', subIndustry: 'Household Goods', betaMultiplier: 800, idioVolatility: 110, sharesOutstanding: 73_000_000, baseEarnings: 350000000 as Money, blurb: 'Soap, polish and paper. Sells the same things forever and raises the price with inflation.' },
  { id: 'ldbr', ticker: 'LDBR', name: 'Ladbroke Motors', sectorId: 'consumer', subIndustry: 'Automobiles', betaMultiplier: 1750, idioVolatility: 250, sharesOutstanding: 64_000_000, baseEarnings: 240000000 as Money, blurb: 'Builds cars. Enormous fixed costs and a product people can always put off for a year.' },
  // Industrials
  { id: 'cstl', ticker: 'CSTL', name: 'Castlereagh Engineering', sectorId: 'industrial', subIndustry: 'Machinery', betaMultiplier: 1300, idioVolatility: 160, sharesOutstanding: 48_000_000, baseEarnings: 270000000 as Money, blurb: 'Heavy machinery on long order books. You can see the next two years from here, which is worth something.' },
  { id: 'thrn', ticker: 'THRN', name: 'Thorne Rail', sectorId: 'industrial', subIndustry: 'Transport', betaMultiplier: 1100, idioVolatility: 125, sharesOutstanding: 52_000_000, baseEarnings: 310000000 as Money, blurb: 'Freight on rails it owns. Nearly impossible to compete with and nearly impossible to grow.' },
  { id: 'wdlr', ticker: 'WDLR', name: 'Wendler Construction', sectorId: 'industrial', subIndustry: 'Construction', betaMultiplier: 1650, idioVolatility: 215, sharesOutstanding: 31_000_000, baseEarnings: 120000000 as Money, blurb: 'Builds what other people finance. First into a downturn and last out of it.' },
  { id: 'aeon', ticker: 'AEON', name: 'Aeon Freight', sectorId: 'industrial', subIndustry: 'Logistics', betaMultiplier: 1250, idioVolatility: 155, sharesOutstanding: 36_000_000, baseEarnings: 160000000 as Money, blurb: 'Moves other people goods by road and sea. Fuel is the whole margin.' },
  // Aerospace & Defense
  { id: 'irnd', ticker: 'IRND', name: 'Ironhold Defense', sectorId: 'defense', subIndustry: 'Defense Primes', betaMultiplier: 900, idioVolatility: 140, sharesOutstanding: 71_000_000, baseEarnings: 440000000 as Money, blurb: 'Armoured vehicles and ordnance on government contracts. The customer is one country and its friends.' },
  { id: 'kstl', ticker: 'KSTL', name: 'Kestrel Aviation', sectorId: 'defense', subIndustry: 'Aerospace', betaMultiplier: 1200, idioVolatility: 200, sharesOutstanding: 43_000_000, baseEarnings: 230000000 as Money, blurb: 'Airframes, military and civil. Programmes run a decade and are cancelled in an afternoon.' },
  { id: 'vgls', ticker: 'VGLS', name: 'Vigilis Systems', sectorId: 'defense', subIndustry: 'Defense Electronics', betaMultiplier: 1050, idioVolatility: 175, sharesOutstanding: 26_000_000, baseEarnings: 135000000 as Money, blurb: 'Radar, sensors and the software that reads them. Sells into every platform somebody else builds.' },
  // Materials
  { id: 'grng', ticker: 'GRNG', name: 'Granger Agricultural', sectorId: 'agricultural', subIndustry: 'Agriculture', betaMultiplier: 500, idioVolatility: 145, sharesOutstanding: 59_000_000, baseEarnings: 250000000 as Money, blurb: 'Grain, feed and fertiliser. Weather is a bigger shareholder than anyone on the register.' },
  { id: 'stnw', ticker: 'STNW', name: 'Stonewater Minerals', sectorId: 'agricultural', subIndustry: 'Mining', betaMultiplier: 1400, idioVolatility: 285, sharesOutstanding: 34_000_000, baseEarnings: 140000000 as Money, blurb: 'Digs metal out of the ground and sells it at whatever the world is paying that morning.' },
  { id: 'crnb', ticker: 'CRNB', name: 'Cranborne Chemical', sectorId: 'agricultural', subIndustry: 'Chemicals', betaMultiplier: 1150, idioVolatility: 170, sharesOutstanding: 40_000_000, baseEarnings: 190000000 as Money, blurb: 'Industrial chemicals for everyone else processes. Priced off oil and shipped in tankers.' },
  // Energy
  { id: 'brmr', ticker: 'BRMR', name: 'Braemar Petroleum', sectorId: 'energy', subIndustry: 'Integrated Oil', betaMultiplier: 950, idioVolatility: 220, sharesOutstanding: 135_000_000, baseEarnings: 880000000 as Money, blurb: 'Finds it, refines it, sells it at the pump. Enormous, hated in a good year, indispensable in a bad one.' },
  { id: 'dlrd', ticker: 'DLRD', name: 'Dolerite Drilling', sectorId: 'energy', subIndustry: 'Oil Services', betaMultiplier: 1800, idioVolatility: 330, sharesOutstanding: 22_000_000, baseEarnings: 68000000 as Money, blurb: 'Drills wells for the companies that own them. All of the cycle and none of the reserves.' },
  // Utilities
  { id: 'hvpw', ticker: 'HVPW', name: 'Haverlock Power', sectorId: 'utilities', subIndustry: 'Electric Utilities', betaMultiplier: 400, idioVolatility: 45, sharesOutstanding: 88_000_000, baseEarnings: 370000000 as Money, blurb: 'Generates and distributes electricity under a regulated return. Dull by law.' },
  { id: 'clwt', ticker: 'CLWT', name: 'Clearwater Utilities', sectorId: 'utilities', subIndustry: 'Water', betaMultiplier: 350, idioVolatility: 40, sharesOutstanding: 46_000_000, baseEarnings: 185000000 as Money, blurb: 'Water in, waste out, a rate case every few years. The closest thing here to a bond.' },
  // Real Estate
  { id: 'hlmr', ticker: 'HLMR', name: 'Hallmere Properties', sectorId: 'realestate', subIndustry: 'REIT', betaMultiplier: 1000, idioVolatility: 135, sharesOutstanding: 51_000_000, baseEarnings: 235000000 as Money, blurb: 'Owns buildings and collects rent. Moves with interest rates more than with tenants.' },
  // Communication Services
  { id: 'atls', ticker: 'ATLS', name: 'Atlas Telecom', sectorId: 'communications', subIndustry: 'Telecom', betaMultiplier: 950, idioVolatility: 115, sharesOutstanding: 104_000_000, baseEarnings: 460000000 as Money, blurb: 'Lines and licences. Vast capital spending against a subscriber base that barely grows.' },
  { id: 'crwn', ticker: 'CRWN', name: 'Crownlight Media', sectorId: 'communications', subIndustry: 'Media', betaMultiplier: 1500, idioVolatility: 245, sharesOutstanding: 37_000_000, baseEarnings: 110000000 as Money, blurb: 'Newspapers, radio and whatever comes next. Advertising is the first budget anybody cuts.' },
]

export function stockById(id: string): Stock | undefined {
  return STOCKS.find((stock) => stock.id === id)
}

export function stocksInSector(sectorId: string): readonly Stock[] {
  return STOCKS.filter((stock) => stock.sectorId === sectorId)
}

/** Every company at par. */
export function freshStockPrices(): Readonly<Record<string, number>> {
  const prices: Record<string, number> = {}
  for (const stock of STOCKS) prices[stock.id] = 10_000
  return prices
}

/**
 * HOW MANY MONTHLY CLOSES ARE KEPT (Law 6).
 *
 * Sixty is five years, which covers every range the chart offers below
 * MAX and keeps the save honest: forty companies times a century of
 * monthly closes would be 48,000 numbers nobody can see.
 */
export const HISTORY_MONTHS = 60

/**
 * One month of company prices (spec §1).
 *
 * A stock's move is its SECTOR'S move taken harder or softer — that is
 * the whole reason the sector engine survives this revamp rather than
 * being replaced — plus a swing that is its own.
 *
 * The sector move is computed from where the sector actually went this
 * month, not re-rolled, so a company can never drift away from the thing
 * it belongs to. Every company in Energy has a good month when Energy
 * does; how good is what makes them different.
 */
export function stepStocks(
  world: World,
  tick: Tick,
  nextSectorPrices: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const next: Record<string, number> = {}
  for (const stock of STOCKS) {
    const before = world.sectorPrices[stock.sectorId] ?? 10_000
    const after = nextSectorPrices[stock.sectorId] ?? before
    // The sector's own move this month, in basis points of itself.
    const sectorMove = before > 0 ? Math.trunc(((after - before) * 10_000) / before) : 0
    const rng = openStream(world.seed, Stream.Market, stock.ticker.length * 31 + stock.id.length, tick)
    const idio = rng.nextIntInclusive(-stock.idioVolatility, stock.idioVolatility)
    const move = Math.trunc((sectorMove * stock.betaMultiplier) / 1000) + idio
    const current = world.stockPrices[stock.id] ?? 10_000
    // Floored at par/20 for the same reason a sector is floored: this world
    // does not model a company going to zero, and pretending otherwise
    // would make a holding vanish rather than crash.
    next[stock.id] = Math.max(500, current + Math.trunc((current * move) / 10_000))
  }
  return next
}

/** Push this month's closes onto the bounded history. */
export function pushHistory(
  world: World,
  prices: Readonly<Record<string, number>>,
): Readonly<Record<string, readonly number[]>> {
  const next: Record<string, readonly number[]> = {}
  for (const stock of STOCKS) {
    const past = world.stockHistory[stock.id] ?? []
    const price = prices[stock.id] ?? 10_000
    const grown = [...past, price]
    next[stock.id] = grown.length > HISTORY_MONTHS ? grown.slice(grown.length - HISTORY_MONTHS) : grown
  }
  return next
}

// ---------------------------------------------------------------------------
// Fundamentals (spec §3) — all DERIVED, none stored
// ---------------------------------------------------------------------------

/**
 * Everything on the key-stats grid is computed on read from two stored
 * numbers — the price and the catalogue row — for the same reason money is
 * cents and prices are basis points: a derived figure cannot drift out of
 * step with the thing it is derived from, and it costs nothing in the save.
 */

/** Price x shares, in cents. */
export function marketCapOf(world: World, stock: Stock): Money {
  const price = world.stockPrices[stock.id] ?? 10_000
  // Shares are in whole units and the price is basis points off par, where
  // par is one dollar. Cents, therefore, is shares x price / 100.
  return Math.floor((stock.sharesOutstanding * price) / 100) as Money
}

/**
 * Earnings this year, grown with the economy since the world began.
 *
 * THE FIGURES IN THE CATALOGUE ARE SIZED AGAINST MARKET CAP AT PAR, and
 * getting that wrong the first time was instructive: they were an order
 * of magnitude too small, the median P/E MEASURED at 229, and because the
 * analyst panel scores value as "cheap relative to the market" every
 * single company then read as maximally cheap — 30 of 33 rated Buy or
 * Strong Buy. A fundamentals bug became a sentiment bug two functions
 * downstream, which is what "everything is interconnected" costs when a
 * number is wrong.
 *
 * Without the growth term a company's P/E would fall for a century as its
 * price rose against a fixed earnings figure, and every stock in the game
 * would eventually look impossibly cheap.
 */
export function earningsOf(world: World, stock: Stock): Money {
  const level = marketLevel(world)
  return Math.max(1, Math.floor((stock.baseEarnings * level) / 10_000)) as Money
}

/**
 * Price/earnings, x100 so it stays an integer — 1,850 reads as 18.5.
 * Zero when a company earns nothing, which the UI shows as "n/a" rather
 * than as an infinity.
 */
export function peRatioOf(world: World, stock: Stock): number {
  const earnings = earningsOf(world, stock)
  if (earnings <= 0) return 0
  return Math.floor((marketCapOf(world, stock) * 100) / earnings)
}

/** Annual dividend yield in per-mille, from the sector, tuned by the name. */
export function dividendYieldOf(stock: Stock): number {
  const sector = sectorById(stock.sectorId)
  if (!sector) return 0
  // A high-beta company in a sector reinvests rather than pays out; a
  // sleepy one pays more than its sector average. Same total, redistributed.
  const tilt = Math.max(300, 2_000 - stock.betaMultiplier)
  return Math.max(0, Math.floor((sector.dividendPerMille * tilt) / 1000))
}

/** Sector beta through the company's own multiplier, per-mille. */
export function betaOf(stock: Stock): number {
  const sector = sectorById(stock.sectorId)
  if (!sector) return stock.betaMultiplier
  return Math.floor((sector.beta * stock.betaMultiplier) / 1000)
}

/**
 * The high and low of the last twelve closes, and where today sits.
 * Falls back to today when a save has no history yet.
 */
export function yearRangeOf(world: World, stock: Stock): { low: number; high: number } {
  const price = world.stockPrices[stock.id] ?? 10_000
  const past = world.stockHistory[stock.id] ?? []
  // NOT NAMED `window`. The purity check guards against the browser
  // global by pattern, and a local called `window` reads as `window.` the
  // moment you ask it for its length — the same trap the school-moment
  // prose hit from the other direction.
  const recent = past.slice(Math.max(0, past.length - 12))
  if (recent.length === 0) return { low: price, high: price }
  let low = recent[0] ?? price
  let high = recent[0] ?? price
  for (const value of recent) {
    if (value < low) low = value
    if (value > high) high = value
  }
  return { low: Math.min(low, price), high: Math.max(high, price) }
}

/**
 * Shares traded this month. Seeded, scaled by size — a big company trades
 * more than a small one — and NOT stored, because a number nobody can act
 * on does not belong in a save.
 */
export function volumeOf(world: World, stock: Stock, tick: Tick): number {
  const rng = openStream(world.seed, Stream.Market, stock.id.length * 7 + 3, tick + 12_000)
  const turnover = rng.nextIntInclusive(4, 38) // per mille of shares, a month
  return Math.floor((stock.sharesOutstanding * turnover) / 1000)
}

// ---------------------------------------------------------------------------
// The analyst panel (spec §4)
// ---------------------------------------------------------------------------

/** How often the panel publishes. Quarterly, so a rating is worth reading. */
export const ANALYST_MONTHS = 3

/**
 * The P/E the panel treats as fair, x100. A BALANCE NUMBER — it is what
 * "cheap" and "dear" are measured against, and moving it moves the whole
 * market's sentiment at once.
 */
export const REFERENCE_PE = 2_300

export type AnalystRating = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'

/**
 * WHAT THE STREET THINKS, and why it can be explained.
 *
 * Each analyst's lean is a DETERMINISTIC function of the same two things
 * a real one argues about — what the company is worth against what it
 * earns, and which way it has been going — plus a small seeded bias that
 * is the analyst's own. Cheap and rising draws buys; dear and falling
 * draws sells.
 *
 * The bias matters: without it every analyst would reach the same verdict
 * from the same inputs and the panel would be unanimous every quarter,
 * which is not a panel, it is one opinion printed thirty times.
 */
export function computeAnalystView(world: World, stock: Stock, tick: Tick): AnalystView {
  const rng = openStream(world.seed, Stream.Market, stock.id.length * 13 + 101, tick)
  const analysts = rng.nextIntInclusive(12, 30)
  const price = world.stockPrices[stock.id] ?? 10_000

  // VALUE: a P/E under the reference is cheap, above it is dear. BOTH
  // NUMBERS ARE x100 — this first read `1_800 - pe / 100`, comparing a
  // P/E of 22 against a constant meaning 18.0, so the term saturated at
  // "maximally cheap" for every company in the game and the panel rated
  // 32 of 33 names a Buy. Two numbers on different scales, subtracted.
  const pe = peRatioOf(world, stock)
  const valueScore = pe <= 0 ? 0 : Math.max(-600, Math.min(600, REFERENCE_PE - pe))

  // Momentum: where it sits against the last year.
  const past = world.stockHistory[stock.id] ?? []
  const yearAgo = past[Math.max(0, past.length - 12)] ?? price
  const momentum = yearAgo > 0 ? Math.max(-400, Math.min(400, Math.trunc(((price - yearAgo) * 1_000) / yearAgo))) : 0

  let buy = 0
  let hold = 0
  let sell = 0
  for (let i = 0; i < analysts; i++) {
    // The analyst's own bias. Small enough that it colours a verdict
    // rather than deciding it — at +-260 against a signal of a few
    // hundred, the panel was re-rolling its mind every other quarter.
    const bias = rng.nextIntInclusive(-170, 170)
    // THE WEIGHTS DECIDE WHETHER THIS IS A PANEL OR AN ECHO. At /3 and /2
    // the two signals swamped the analyst's own bias, every analyst on a
    // given name reached the same verdict, and the market came out
    // bimodal — 17 Strong Sells and one Hold across 33 companies. Damped
    // so that the fundamentals TILT a panel and the people in it still
    // disagree, which is what produces a spread of ratings.
    const lean = Math.trunc(valueScore / 6) + Math.trunc(momentum / 4) + bias
    if (lean > 150) buy += 1
    else if (lean < -150) sell += 1
    else hold += 1
  }

  // The target is the panel's own: today's price moved by the same view,
  // spread by how much they disagree.
  const consensusLean = Math.trunc(((buy - sell) * 1_000) / Math.max(1, analysts))
  const targetAvg = Math.max(500, price + Math.trunc((price * Math.trunc(consensusLean / 4)) / 1_000))
  const spread = Math.max(200, Math.trunc((price * (12 + hold)) / 100))
  return {
    stockId: stock.id,
    analysts,
    buy,
    hold,
    sell,
    targetLow: Math.max(500, targetAvg - spread),
    targetAvg,
    targetHigh: targetAvg + spread,
    refreshedAtTick: tick,
  }
}

/** The panel's verdict in the words a screen shows. */
export function ratingOf(view: AnalystView): AnalystRating {
  const net = ((view.buy - view.sell) * 1_000) / Math.max(1, view.analysts)
  // WIDER THAN THE FIRST ATTEMPT. At +-120 for the middle band a rating
  // changed in 44% of quarters, which is not an opinion, it is noise with
  // a label on it. A downgrade should be worth reading.
  if (net > 520) return 'Strong Buy'
  if (net > 200) return 'Buy'
  if (net < -520) return 'Strong Sell'
  if (net < -200) return 'Sell'
  return 'Hold'
}

/** Upside to the average target, in per-mille of today's price. */
export function upsidePerMille(world: World, view: AnalystView): number {
  const price = world.stockPrices[view.stockId] ?? 10_000
  if (price <= 0) return 0
  return Math.trunc(((view.targetAvg - price) * 1_000) / price)
}

/**
 * Refresh the panel on its cadence, and record a RATING CHANGE when the
 * verdict actually moves — so "downgraded to Hold after the miss" is a
 * thing the game can say rather than a thing it forgets (spec §4).
 */
export function runAnalysts(world: World, tick: Tick): void {
  if (tick % ANALYST_MONTHS !== 0) return
  for (const stock of STOCKS) {
    const before = world.analystViews.get(stock.id)
    const after = computeAnalystView(world, stock, tick)
    world.analystViews.set(stock.id, after)
    if (before !== undefined && ratingOf(before) !== ratingOf(after)) {
      // Hung on the homeland, the way a recruiting drive is: this is a
      // world-level event and the ledger has no notion of one without a
      // subject. The visibility ratchet has its own list for these.
      const home = homeland(world)
      if (home !== undefined) {
        recordEvent(world, tick, {
          type: 'analyst-change',
          subjectId: home.id,
          detail: `${stock.ticker}:${ratingOf(after)}`,
        })
      }
    }
  }
}
