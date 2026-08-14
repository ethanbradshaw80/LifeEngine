/**
 * RUNNING THE BUSINESS, month by month (owner, 2026-08-13: "we need
 * literally actions that you can click on in the business menu to also grow
 * the business like buying item stock, selling item stock, looking for new
 * vendor to get lower prices on whatever we sell").
 *
 * The complaint underneath it was that a business was a number that ticked
 * up while you watched, with nothing to do until an IPO eight years away.
 * This is the loop that fixes it: you hold STOCK, you buy it from a VENDOR
 * at a rate you can improve, and you sell it at a PRICE you set. Every
 * month those three decisions meet the town's demand for your trade.
 *
 * STOCK IS MEASURED AT COST, in cents, not in units.
 *
 * That is the whole trick that makes this fit an engine which has never had
 * an inventory: a shelf of shampoo, a tank of diesel and a rack of videos
 * are not comparable in units but they are perfectly comparable in what
 * they cost. Selling consumes stock equal to the cost of what went out of
 * the door, so running out is a real event — you lose the sale, and the
 * customer goes to the salon across the square.
 *
 * And it is honest accounting: buying stock is cash turning into stock, not
 * an expense. The expense lands when it SELLS. That is why the books can
 * show a month with good takings and no profit, which is a thing that
 * happens to real shops and never happened here before.
 *
 * Pure content and arithmetic. finances moves the money.
 */

import type { Money, Tick } from '@life-engine/shared'
import type { Business, BusinessOps } from './types.js'
import type { BusinessKind } from './business.js'

/** How a business starts: no stock, the vendor everybody uses, ordinary prices. */
export function freshOps(): BusinessOps {
  return {
    stockCents: 0 as Money,
    vendorName: 'the usual supplier',
    vendorRatePerMille: 1000,
    vendorQualityPerMille: 1000,
    markupPerMille: 1000,
    advertisedUntilTick: null,
    longHours: false,
    insured: false,
    owedToYouCents: 0 as Money,
    refitAtTick: null,
    /** The owner's own dial. 300 is what the engine always did on its own. */
    retainPerMille: 300,
  }
}

// ---------------------------------------------------------------------------
// Price, and what it does to custom
// ---------------------------------------------------------------------------

/** The markup settings the screen offers, per-mille of the ordinary price. */
export const PRICE_STEPS: readonly { readonly perMille: number; readonly title: string }[] = [
  { perMille: 800, title: 'Undercut everybody' },
  { perMille: 900, title: 'Keen' },
  { perMille: 1000, title: 'The going rate' },
  { perMille: 1150, title: 'A bit dearer' },
  { perMille: 1300, title: 'Premium' },
]

/**
 * WHAT YOUR PRICE DOES TO THE NUMBER OF PEOPLE THROUGH THE DOOR, per-mille.
 *
 * Cutting prices wins custom and costs margin; charging more does the
 * reverse. Deliberately NOT symmetric — going dear loses you more custom
 * than going cheap wins you, because a small town has only so many people
 * in it and the ones who leave do not come back quickly.
 */
export function demandFromPricePerMille(markupPerMille: number): number {
  const over = markupPerMille - 1000
  // NEGATIVE ZERO IS NOT ZERO to a strict comparison, and `Math.floor(-0)`
  // is exactly what pricing at the going rate produces. The ledger hit the
  // same thing earlier in this codebase; guard it at the source.
  if (over === 0) return 0
  if (over < 0) return Math.min(300, Math.floor(-over * 1.2))
  return -Math.floor(over * 1.6)
}

/** What your price does to what you keep on each sale, per-mille. */
export function marginFromPricePerMille(markupPerMille: number): number {
  return markupPerMille - 1000
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/**
 * WHAT A MONTH OF TRADING EATS, in cents of stock at cost.
 *
 * The trade's own cost-of-goods share of what it expects to take. A
 * software company barely touches its shelf; a filling station empties it.
 */
export function stockNeededFor(takings: Money, kind: BusinessKind): Money {
  return Math.floor((takings * kind.cogsPerMille) / 1000) as Money
}

/**
 * HOW MUCH OF THE MONTH YOU CAN ACTUALLY SERVE, per-mille.
 *
 * Full where the shelf covers what the month wants. Short where it does
 * not — and a trade with no cost of goods at all is never short, because
 * there is nothing for it to run out of.
 */
export function servedPerMille(stock: Money, needed: Money): number {
  if (needed <= 0) return 1000
  if (stock >= needed) return 1000
  return Math.max(0, Math.floor((stock * 1000) / needed))
}

/** What a bulk order saves, per-mille off the bill. Buying more costs less. */
export function bulkDiscountPerMille(months: number): number {
  if (months >= 6) return 90
  if (months >= 3) return 50
  return 0
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

/** A supplier's terms, as the screen shows them. */
export interface VendorOffer {
  readonly name: string
  /** What they charge, per-mille of the ordinary rate. Lower is better. */
  readonly ratePerMille: number
  /** What their goods are like, per-mille. Cheap often means shoddy. */
  readonly qualityPerMille: number
}

const VENDOR_FIRST: readonly string[] = [
  'Ashby', 'Corrigan', 'Delaney', 'Fairweather', 'Guthrie',
  'Hollis', 'Marchetti', 'Prentice', 'Rowntree', 'Vance',
]
const VENDOR_SECOND: readonly string[] = [
  '& Sons', 'Supply Co.', 'Wholesale', 'Trading', 'Brothers',
]

/**
 * WHO ELSE WOULD SUPPLY YOU.
 *
 * Seeded off the business and the month, so the list is steady while you
 * think about it and turns over when you look again. Cheap and good is
 * rare: the roll that makes a vendor cheaper usually makes them worse, and
 * the screen shows both so the choice is honest.
 */
export function vendorOfferFrom(
  pick: number,
  rateRoll: number,
  qualityRoll: number,
): VendorOffer {
  const first = VENDOR_FIRST[pick % VENDOR_FIRST.length] ?? 'Ashby'
  const second = VENDOR_SECOND[(pick >> 3) % VENDOR_SECOND.length] ?? 'Supply Co.'
  // 780 to 1080 per-mille of the ordinary rate.
  const ratePerMille = 780 + rateRoll
  // The cheaper they are, the likelier the goods are poor — but not always,
  // and finding the exception is the reason to keep looking.
  const penalty = Math.max(0, 1000 - ratePerMille)
  const qualityPerMille = Math.max(700, Math.min(1150, 1000 - penalty + qualityRoll))
  return { name: `${first} ${second}`, ratePerMille, qualityPerMille }
}

/** What a vendor's goods do to what customers think of you, per-mille. */
export function qualityEffectPerMille(ops: BusinessOps): number {
  return Math.floor((ops.vendorQualityPerMille - 1000) / 4)
}

// ---------------------------------------------------------------------------
// The other levers
// ---------------------------------------------------------------------------

/** Advertising lifts custom while it runs, and not a month longer. */
export const ADVERT_MONTHS = 6
export const ADVERT_LIFT_PER_MILLE = 180

export function advertisingLiftPerMille(ops: BusinessOps, tick: Tick): number {
  if (ops.advertisedUntilTick === null || tick >= ops.advertisedUntilTick) return 0
  return ADVERT_LIFT_PER_MILLE
}

/** Trading evenings and Sundays. More custom served, more wages owed. */
export const LONG_HOURS_LIFT_PER_MILLE = 150
export const LONG_HOURS_WAGE_PER_MILLE = 200

/** A refit keeps a place looking cared for — for about eight years. */
export const REFIT_YEARS = 8
export const REFIT_LIFT_PER_MILLE = 120

export function refitLiftPerMille(ops: BusinessOps, tick: Tick, ticksPerYear: number): number {
  if (ops.refitAtTick === null) return 0
  const age = tick - ops.refitAtTick
  if (age >= REFIT_YEARS * ticksPerYear) return 0
  return REFIT_LIFT_PER_MILLE
}

/** What insuring the place costs a month, per-mille of the capital in it. */
export const INSURANCE_PER_MILLE = 4

export function insurancePremiumFor(business: Business): Money {
  return Math.floor((business.capital * INSURANCE_PER_MILLE) / 1000) as Money
}

/**
 * WHAT PEOPLE OWE YOU, and how much of it you would get back by asking.
 *
 * Selling on account is how a small town does business; some of it comes
 * back when you chase it and some of it never does.
 */
export const CHASED_BACK_PER_MILLE = 650

export function chaseableFrom(ops: BusinessOps): Money {
  return Math.floor((ops.owedToYouCents * CHASED_BACK_PER_MILLE) / 1000) as Money
}

/**
 * EVERYTHING THE OWNER'S CHOICES DO TO A MONTH'S CUSTOM, in one per-mille.
 *
 * One place, so the screen can show the same number the tick uses and the
 * two can never drift — which is the failure this codebase has had six
 * times with the ledger trio.
 */
export function tradingLiftPerMille(
  ops: BusinessOps,
  tick: Tick,
  ticksPerYear: number,
): number {
  return (
    demandFromPricePerMille(ops.markupPerMille) +
    advertisingLiftPerMille(ops, tick) +
    (ops.longHours ? LONG_HOURS_LIFT_PER_MILLE : 0) +
    refitLiftPerMille(ops, tick, ticksPerYear) +
    qualityEffectPerMille(ops)
  )
}
