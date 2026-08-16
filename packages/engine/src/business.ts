/**
 * WORKING FOR YOURSELF (M-CAREER §5).
 *
 * The ladder is somebody else's ladder. This is the other road: put up
 * capital, take the risk, and keep what is left — the civilian path to real
 * wealth, and the one that can genuinely fail.
 *
 * ONE SYSTEM AT TWO SCALES, deliberately. A side gig is not a different
 * mechanism from a business; it is a business with almost no capital in it,
 * run in the evenings, that will never employ anybody. Modelling them
 * separately would be two things that behave the same.
 *
 * WHAT MAKES IT REAL RATHER THAN A SECOND WAGE:
 *
 *   - The capital is REAL money, out of savings or a loan, and it is gone.
 *   - The economy is felt directly. A boom is worth more to an owner than
 *     to anybody on a salary; a slump can close the doors.
 *   - It can FAIL, and failing costs the capital and the income at once.
 *   - It PASSES DOWN. A business is the only thing in this world that keeps
 *     earning for somebody who did not build it.
 *
 * Pure content and pure arithmetic. finances moves the money.
 */

import type { Money } from '@life-engine/shared'
import type { Business, EconomyPhase } from './types.js'

export interface BusinessKind {
  readonly id: string
  readonly title: string
  /** What it takes to open the doors, in base-year cents. */
  readonly capital: Money
  /**
   * What it returns in a good month, in per-mille of the capital in it.
   * Small trades return a lot on very little; a real shop returns less on
   * far more, and the absolute numbers are the other way round.
   */
  readonly returnPerMille: number
  /** How hard the cycle hits it, per-mille. A trade rides out what a shop cannot. */
  readonly exposure: number
  /** Zero for a one-person trade. */
  readonly maxEmployees: number
  /**
   * THE YEAR THE TRADE BECOMES POSSIBLE (owner's ruling, 2026-08-13:
   * "businesses should be able to populate over the years so if SaaS isn't
   * in 1970 just make it available only after a certain year").
   *
   * A CALENDAR year, compared against `toDate(world, tick).year`, because a
   * preset sets its own `startYear` and a hardcoded 1970 would be a lie in
   * any other one. Absent means the trade has no era — somebody has always
   * cut hair and somebody has always fixed things.
   */
  readonly availableFrom?: number
  /**
   * THE YEAR IT STOPS BEING A LIVING (the other half of the same ruling).
   *
   * Nothing is deleted: a retired kind can no longer be FOUNDED, and the
   * ones already trading meet a market that is going away. A video rental
   * shop opened in 1985 is a good business and the same shop in 2010 is a
   * story, which is the entire reason to model this rather than quietly
   * dropping the type from the list.
   */
  readonly retiredAfter?: number
  /**
   * WHAT THE GOODS COST, per-mille of what they sell for.
   *
   * From the owner's own BUSINESS_TYPES_DATA: software is almost all
   * margin (50), a shop or a diner lives on a knife edge (400-500). This
   * is what makes running one trade feel unlike another — a salon's stock
   * is a shelf of product, a haulage firm's is diesel, and a software
   * company barely has any, so price and reputation are all it has.
   */
  readonly cogsPerMille: number
}

/**
 * Can this trade be started in this year? The founding screen and the verb
 * both read it, so a greyed row and a refusal cannot disagree (the bar
 * pattern).
 */
export function kindAvailableIn(kind: BusinessKind, year: number): boolean {
  if (kind.availableFrom !== undefined && year < kind.availableFrom) return false
  if (kind.retiredAfter !== undefined && year > kind.retiredAfter) return false
  return true
}

/**
 * HOW MUCH OF ITS MARKET IS LEFT, per-mille of normal.
 *
 * A trade in its own era trades at 1000. Past its retirement the floor
 * falls away over a decade rather than at a stroke — the last video rental
 * shop in town did not close the morning the world changed, it ground down
 * while its owner decided what to do. Ten years after the end it is at a
 * fifth, and it stays there: somebody, somewhere, still wants the thing.
 */
export function kindDemandPerMille(kind: BusinessKind, year: number): number {
  if (kind.retiredAfter === undefined || year <= kind.retiredAfter) return 1000
  const yearsPast = year - kind.retiredAfter
  if (yearsPast >= 10) return 200
  return 1000 - yearsPast * 80
}

/**
 * THE TRADES, in capital order.
 *
 * TWO RULES HOLD ACROSS THE WHOLE TABLE and a test enforces both: capital
 * strictly increases, and the return per-mille never increases with it. A
 * small trade returns a lot on very little; a real firm returns less on far
 * more, and the absolute money runs the other way. That is the engine's
 * economic model and the fifteen trades added with the era ruling were
 * fitted ONTO it rather than importing a second one — the supplied design
 * had professional practices and software returning both the most AND
 * costing the most, which would have made them strictly dominant.
 *
 * So what makes one trade different from another of the same size is
 * `exposure` — how hard the cycle hits it. A dental practice is the safest
 * money in the table (400) because people's teeth do not read the business
 * pages; a software company is the wildest (1500). That is where the
 * character lives, along with the era window.
 *
 * The original five keep their exact ids and numbers: saves reference
 * `kindId`, and every one of these figures was measured into place.
 */
export const BUSINESS_KINDS: readonly BusinessKind[] = [
  {
    id: 'freelance',
    title: 'freelance work',
    capital: 268_000 as Money,
    returnPerMille: 2250,
    exposure: 500,
    maxEmployees: 0,
    cogsPerMille: 120,
  },
  {
    id: 'lessons',
    title: 'lessons at the kitchen table',
    capital: 456_000 as Money,
    returnPerMille: 1550,
    exposure: 600,
    maxEmployees: 1,
    cogsPerMille: 80,
  },
  {
    id: 'cleaning-round',
    title: 'a cleaning round',
    capital: 680_000 as Money,
    returnPerMille: 1200,
    exposure: 700,
    maxEmployees: 4,
    cogsPerMille: 220,
  },
  {
    id: 'market-stall',
    title: 'a market stall',
    capital: 828_000 as Money,
    returnPerMille: 1050,
    exposure: 700,
    maxEmployees: 1,
    cogsPerMille: 420,
  },
  {
    // A BUSINESS THAT ENDS. Word processors took the trade apart through
    // the eighties; by 1990 the man who fixed typewriters was fixing
    // something else or he was finished.
    id: 'office-machines',
    title: 'a typewriter and office machine shop',
    capital: 1_424_000 as Money,
    returnPerMille: 725,
    exposure: 800,
    maxEmployees: 2,
    cogsPerMille: 300,
    retiredAfter: 1990,
  },
  {
    id: 'workshop',
    title: 'a workshop',
    capital: 1_754_000 as Money,
    returnPerMille: 650,
    exposure: 850,
    maxEmployees: 3,
    cogsPerMille: 300,
  },
  {
    id: 'salon',
    title: 'a hair salon',
    capital: 2_080_000 as Money,
    returnPerMille: 600,
    exposure: 700,
    maxEmployees: 5,
    cogsPerMille: 220,
  },
  {
    // Mail order first, then the same trade with a website in front of it.
    id: 'mail-order',
    title: 'a mail-order and internet shop',
    capital: 2_228_000 as Money,
    returnPerMille: 588,
    exposure: 1400,
    maxEmployees: 6,
    cogsPerMille: 500,
    availableFrom: 1996,
  },
  {
    id: 'print-shop',
    title: 'a print shop',
    capital: 2_636_000 as Money,
    returnPerMille: 538,
    exposure: 900,
    maxEmployees: 4,
    cogsPerMille: 340,
    retiredAfter: 2005,
  },
  {
    // OPENED IN 1985 THIS IS A GOOD BUSINESS. Run to 2010 it is a story,
    // which is the whole reason retirement is modelled rather than the
    // type quietly disappearing from the list.
    id: 'video-rental',
    title: 'a video rental shop',
    capital: 2_928_000 as Money,
    returnPerMille: 500,
    exposure: 1100,
    maxEmployees: 4,
    cogsPerMille: 260,
    availableFrom: 1982,
    retiredAfter: 2007,
  },
  {
    id: 'feed-store',
    title: 'a feed and hardware store',
    capital: 3_224_000 as Money,
    returnPerMille: 488,
    exposure: 950,
    maxEmployees: 3,
    cogsPerMille: 450,
  },
  {
    id: 'fitness-studio',
    title: 'a fitness studio',
    capital: 3_632_000 as Money,
    returnPerMille: 463,
    exposure: 1000,
    maxEmployees: 5,
    cogsPerMille: 150,
    availableFrom: 1980,
  },
  {
    id: 'shop',
    title: 'a shop on the square',
    capital: 4_000_000 as Money,
    returnPerMille: 450,
    exposure: 1000,
    maxEmployees: 6,
    cogsPerMille: 430,
  },
  {
    id: 'computer-shop',
    title: 'a computer shop',
    capital: 4_336_000 as Money,
    returnPerMille: 440,
    exposure: 1300,
    maxEmployees: 6,
    cogsPerMille: 460,
    availableFrom: 1980,
  },
  {
    id: 'filling-station',
    title: 'a filling station',
    capital: 4_688_000 as Money,
    returnPerMille: 430,
    exposure: 1100,
    maxEmployees: 4,
    cogsPerMille: 520,
  },
  {
    id: 'diner',
    title: 'a diner',
    capital: 5_364_000 as Money,
    returnPerMille: 405,
    exposure: 1150,
    maxEmployees: 10,
    cogsPerMille: 380,
  },
  {
    id: 'haulage',
    title: 'a haulage firm',
    capital: 6_040_000 as Money,
    returnPerMille: 388,
    exposure: 1250,
    maxEmployees: 8,
    cogsPerMille: 400,
  },
  {
    id: 'contracting-firm',
    title: 'a contracting firm',
    capital: 6_816_000 as Money,
    returnPerMille: 375,
    exposure: 1200,
    maxEmployees: 14,
    cogsPerMille: 380,
  },
  {
    // THE SAFEST MONEY IN THE TABLE. A recession does not stop a tooth
    // hurting, which is what an exposure of 400 means.
    id: 'dental-practice',
    title: 'a dental practice',
    capital: 7_812_000 as Money,
    returnPerMille: 363,
    exposure: 400,
    maxEmployees: 6,
    cogsPerMille: 200,
  },
  {
    // AND THE WILDEST. It rides the cycle harder than anything else here.
    id: 'software-company',
    title: 'a software company',
    capital: 9_016_000 as Money,
    returnPerMille: 350,
    exposure: 1500,
    maxEmployees: 20,
    cogsPerMille: 60,
    availableFrom: 2002,
  },
]

export function businessKindById(id: string): BusinessKind | undefined {
  return BUSINESS_KINDS.find((kind) => kind.id === id)
}

/** Months in the red before the doors shut. */
/**
 * WHAT A WAGE BUYS, per-mille of itself. At 1650 a member of staff brings
 * in 1.65 times their pay before the cycle touches it, so in an ordinary
 * month the owner clears roughly a quarter of the wage bill and in a bad
 * one pays it out of their own pocket.
 */
export const STAFF_EARNS_PER_MILLE = 1650

export const BUSINESS_FAILS_AFTER = 3

/**
 * HOW BIG ONE TRADE CAN GET, as a multiple of what it took to open.
 *
 * MEASURED, and it was a runaway: retained profit grew the capital, bigger
 * capital returned more profit, and a hundred-year town ended with somebody
 * holding $386 BILLION. A market stall compounding at 42 per cent a year
 * for a century is not a market stall.
 *
 * Past this ceiling the profit is all DRAWN rather than retained. There is
 * only so much capital one shop can absorb — beyond it you are running a
 * different kind of business, which is what the larger kinds are for.
 */
export const CAPITAL_CEILING_MULTIPLE = 4

// ---------------------------------------------------------------------------
// THE SCALE-UP (careers overhaul, Fix 3B)
// ---------------------------------------------------------------------------

/**
 * WHAT IT TAKES TO STOP BEING A TRADE.
 *
 * The ceiling above is where an ordinary business stops growing, and the
 * comment on it has always said what is on the other side: "beyond it you
 * are running a different kind of business." This is the door.
 *
 * Two gates now, and each is doing a different job. The CAPITAL gate means
 * the business must actually have hit its own ceiling rather than merely be
 * doing well. The YEARS gate means it survived, because almost half of
 * these close and a company built out of a two-year-old venture would be a
 * company built out of luck.
 *
 * THE KIND GATE IS GONE (owner, playing, 2026-08-14: "I also have a company
 * right now worth 75 million that is in the freelance cannot IPO or sell...
 * all companies should be able to IPO and stuff").
 *
 * It was a whitelist of two — a shop and a contracting firm — and it was
 * wrong in the way whitelists usually are. A freelance consultancy that has
 * traded eight years and filled its ceiling IS a firm; refusing to let it
 * incorporate while the exchange also refuses to list a trade left a
 * seventy-five-million-dollar business with no road out in either
 * direction. The capital gate already says "big enough" and says it for
 * every trade, which is what the kind gate was clumsily approximating.
 */
export const SCALE_UP_YEARS = 8

/**
 * How much bigger a scaled company may get than the trade it grew out of.
 *
 * Twenty times, against the ordinary four. This is the number that makes a
 * valuation worth having and an IPO worth doing, and it is a BALANCE
 * NUMBER — the spec says so itself ("thresholds are balance numbers —
 * tune, don't quote").
 *
 * THE COMMENT SAID TWENTY AND THE CONSTANT SAID 200 (owner, playing with
 * his brother: "he hit 1 trillion dollar net worth in 110 years by just
 * doing businesses"). A factor of ten between the documented intent and the
 * code, and it is the whole absurd tail.
 *
 * What 200 actually bought, through `earningBaseOf`'s taper — full return
 * to 4x founding, 60% marginal to 10x, 35% marginal above:
 *
 *     at 20x   the earning base is about 11x founding capital
 *     at 200x  it is about 74x
 *
 * Seven times the earnings, and `privateValuationOf` is EIGHT TIMES annual
 * profit on top of that. A trade that scaled up was compounding into a
 * number no town could contain, which is exactly what he watched happen.
 *
 * Twenty keeps the scale-up worth doing — it is still five times what an
 * unscaled trade may hold, and an IPO is still reachable — without the
 * ceiling being somewhere no business should ever get to.
 */
export const COMPANY_CEILING_MULTIPLE = 20

/** Is this business allowed to become a company? Null when it is. */
export function scaleUpBar(
  business: Business | undefined,
  kind: BusinessKind | undefined,
  tick: number,
): string | null {
  if (!business || !kind) return 'There is no business to grow.'
  if (business.closedTick !== null) return 'It closed.'
  if (business.scaledAtTick != null) return 'It is already a company.'
  const years = Math.floor((tick - business.foundedTick) / 12)
  if (years < SCALE_UP_YEARS) {
    return `It has traded ${String(years)} year${years === 1 ? '' : 's'}. A company is built on ${String(SCALE_UP_YEARS)}.`
  }
  if (business.capital < kind.capital * CAPITAL_CEILING_MULTIPLE) {
    return 'It has not grown into what it already is. There is more room in this business yet.'
  }
  return null
}

/**
 * WHAT THE YEAR TOOK IN, in cents. Revenue, not profit.
 *
 * Derived from the capital and the kind's own return rather than stored,
 * because storing it would be a second source of truth for a number the
 * capital already implies. Revenue is bigger than profit — a company
 * turning over ten million does not keep ten million — and the multiple
 * below is calibrated against revenue, so the two have to mean what they
 * say.
 */
export function annualRevenueOf(business: Business, kind: BusinessKind): Money {
  // `capital * returnPerMille / 1000` is the year's PROFIT, which is what
  // the monthly figure is built from. Revenue is profit divided by the
  // margin, and the margin here is eight per cent — a working number for a
  // firm that builds or sells things rather than a claim about any real
  // industry. The first version multiplied by three instead, which implied
  // a fifty per cent margin and left a fully grown company valued at about
  // a million: below its own IPO threshold, so the capstone was
  // arithmetically unreachable. Caught by measuring rather than by reading.
  return Math.floor((business.capital * kind.returnPerMille) / 1000) * 12 as Money
}

/**
 * WHAT SOMEBODY WOULD PAY FOR THE WHOLE THING (spec: "revenue x a sector
 * multiple").
 *
 * The multiple is the kind's, and it runs the way multiples actually run:
 * a contracting firm on long contracts is worth more per pound of revenue
 * than a shop, because the revenue is more likely to still be there next
 * year. That is the entire content of a multiple.
 *
 * DELIBERATELY COARSE. This is a number on a screen and the basis of one
 * decision; pretending to a discounted cash flow would invite somebody to
 * trade against it, and there is nothing behind it to trade against.
 */
export function valuationMultipleFor(kindId: string): number {
  return kindId === 'contracting-firm' ? 1900 : 1200
}

export function valuationOf(business: Business, kind: BusinessKind): Money {
  if (business.scaledAtTick == null) return 0 as Money
  const revenue = annualRevenueOf(business, kind)
  return Math.floor((revenue * valuationMultipleFor(business.kindId)) / 1000) as Money
}

/**
 * WHAT A FOUNDER PAYS THEMSELF once it is a company.
 *
 * A salary, monthly, and the point of it is that it is NOT the profit. An
 * owner-operator takes what the business makes; a chief executive takes a
 * wage and leaves the rest inside the company, where it grows the capital
 * and therefore the valuation. That difference is the whole reason to
 * scale up rather than keep drawing.
 */
export function founderSalaryOf(business: Business, kind: BusinessKind): Money {
  if (business.scaledAtTick == null) return 0 as Money
  return Math.floor(annualRevenueOf(business, kind) / 40 / 12) as Money
}

/** How many people it employs once it is a company — it outgrows maxEmployees. */
export function companyHeadcountOf(business: Business, kind: BusinessKind): number {
  if (business.scaledAtTick == null) return business.employees
  return Math.min(400, Math.floor((business.capital * 4) / Math.max(1, kind.capital)))
}

/**
 * HOW MUCH OF THE CAPITAL IS ACTUALLY EARNING (owner, playing, 2026-08-14:
 * "it feels so easy to scale a business. Run a test on your own and find
 * ways for it to be more challenging").
 *
 * MEASURED FIRST, as he asked. An active player founding a shop and
 * climbing the capacity ladder every year reached a valuation of **$23.7M
 * and $34.6M** at two seeds inside ten years, against a ten-million IPO
 * gate — so the gate was a formality rather than a target. A passive owner
 * reached $1.2M, so the ladder was doing its job; the RATE was the problem.
 *
 * The cause was one line: earnings were LINEAR in capital, for ever. Ten
 * times the money in the till made ten times the profit, which is why the
 * loop "pour money in, buy capacity, repeat" had no ceiling worth the name.
 * It also implied something plainly untrue about a small town — that a
 * corner shop with a million dollars behind it can find a million dollars
 * of customers on the same square.
 *
 * So capital earns at full rate up to four times what the trade costs to
 * open — its natural size — then at three fifths, then at a third. The
 * money is not wasted and growing is still worth doing; it just stops
 * being multiplication. Every other lever the player has (price, staff,
 * expansions, the vendor, advertising) works on a per-mille basis and is
 * therefore UNTOUCHED by this — which is deliberate. It makes running the
 * business well matter MORE, relative to simply feeding it.
 */
export function earningBaseOf(capital: number, foundingCapital: number): number {
  const founding = Math.max(1, foundingCapital)
  const natural = founding * 4
  if (capital <= natural) return capital
  const wide = founding * 10
  if (capital <= wide) return natural + Math.floor(((capital - natural) * 6) / 10)
  return natural + Math.floor(((wide - natural) * 6) / 10) + Math.floor(((capital - wide) * 35) / 100)
}

/**
 * WHAT THE MONTH RETURNED, in cents. Can be negative, which is the point.
 *
 * The kind's own return on the capital in it, moved by the cycle through
 * its exposure and by how well the owner runs it. A boom is worth far more
 * to an owner than a salary is to anybody; a depression is worth far less
 * than nothing.
 */
export function monthlyProfitFor(
  business: Business,
  kind: BusinessKind,
  phase: EconomyPhase,
  growthPerMille: number,
  diligence: number,
  swing: number,
  /**
   * THE YEAR, so a trade whose era has passed meets a market that is going
   * away (the owner's retirement ruling). Optional: every caller written
   * before there was an era keeps its exact arithmetic.
   */
  year?: number,
  /** What the staff cost this month, in cents. Zero for a one-person trade. */
  payroll = 0,
  /**
   * WHAT THE BUSINESS HAS GROWN INTO, per-mille on top of its ordinary
   * earning. A second set of doors trades like most of another shop; a
   * supplier you own stops charging you their margin.
   */
  expansionPerMille = 0,
  /**
   * WHAT THE COMPETITION IS DOING TO IT, per-mille. Zero for a trade with
   * nobody else in it, negative when rivals are taking the custom.
   */
  competitionPerMille = 0,
  /**
   * HOW FAR A STANDING ORDER LIFTS THE FLOOR under a ruinous month. Steady
   * money does not care what kind of month it is, which is the whole point
   * of having some.
   */
  floorLiftPerMille = 0,
  /**
   * WHAT THIS TRADE COSTS TO OPEN, in TODAY'S cents.
   *
   * Passed in rather than read off the kind because the kind's figure is
   * in base-year money and this file cannot see the price level — the
   * engine is a pure function and inflation is the world's business.
   * Defaulting to the kind's own number keeps every caller written before
   * the taper existed arithmetically identical.
   */
  foundingCapital = 0,
): Money {
  // A RETIRING TRADE EARNS ON A SHRINKING MARKET. The demand floor falls
  // over a decade rather than at a stroke, so the owner has years to sell,
  // pivot or ride it down — Law 7's recovery path, not a cliff.
  const demand = year === undefined ? 1000 : kindDemandPerMille(kind, year)
  const earning = Math.floor(
    (earningBaseOf(business.capital, foundingCapital > 0 ? foundingCapital : kind.capital) *
      demand) /
      1000,
  )
  // WHAT IT HAS GROWN INTO. A second set of doors trades like most of
  // another shop; a supplier you own stops charging you their margin.
  // Additive, not compounding — three ways of growing make a business
  // three times bigger, not eight, and compounding here is how a shop
  // quietly becomes worth more than the town it stands in.
  const contested = Math.max(0, 1000 + expansionPerMille + competitionPerMille)
  const grown = Math.floor((earning * contested) / 1000)
  const base = Math.floor((grown * kind.returnPerMille) / 1000 / 12)
  // What the staff bring in, derived FROM the wage rather than a per-head
  // constant, so it scales with whoever was actually hired.
  const staffBase = Math.floor((payroll * STAFF_EARNS_PER_MILLE) / 1000)
  // The cycle, through this trade's exposure to it.
  const weather = Math.floor((growthPerMille * kind.exposure) / 1000)
  const slump = phase === 'depression' ? -90 : phase === 'recession' ? -45 : 0
  // How well it is run: -100 to +100 per-mille on the base.
  const hand = Math.floor((diligence - 500) / 5)
  //
  // The multiplier can go NEGATIVE, and that is the whole difference from a
  // wage: a bad month costs you rather than paying you less. Floored at
  // -1500 per-mille so a single month cannot swallow a business whole —
  // three of them in a row closes it, which is the mechanism that does.
  //
  // MEASURED, and the first setting never let anybody fail: at a base of
  // 1000 with a +/-260 swing the multiplier practically could not go
  // negative, and three workshops run for thirty years all came through
  // trading with the capital seven to eleven times larger. A business that
  // cannot fail is a savings account with a story attached.
  //
  // Re-measured twice more. At a +/-380 swing the multiplier still could
  // not reach a losing month outside a deep slump: 72 businesses opened
  // across three towns and 67 were still trading, a 93 per cent survival
  // rate no small trade has ever had. At +/-980 the shape is right - 89
  // opened, 37 closed, 58 per cent surviving, and the ones that failed had
  // a median life of seventeen years rather than dying in their first
  // winter. The slump term still doubles, so failures cluster in the
  // downturns rather than falling on people at random.
  const perMille = Math.max(
    -1500 + floorLiftPerMille,
    880 + weather * 10 + slump * 2 + hand + swing,
  )
  /**
   * THE WAGES GO OUT WHATEVER THE MONTH DID — operating leverage, and the
   * whole reason employing somebody is a decision rather than a free
   * upgrade. A good month clears about a quarter of the wage bill on top;
   * a bad one loses the trading loss AND the wage bill.
   *
   * STAFF NEVER PRODUCE LESS THAN NOTHING. MEASURED: letting their
   * earnings ride the full cycle — which swings ±980 on a base of 880 —
   * had them generating deeply negative revenue in a slump on top of
   * their wages, at worst three times the payroll. A shop assistant still
   * serves customers in a recession; the shop's MARGIN compresses, the
   * assistant does not start destroying stock.
   */
  const fromStaff = Math.max(0, Math.floor((staffBase * perMille) / 1000))
  return (Math.floor((base * perMille) / 1000) + fromStaff - payroll) as Money
}

/** What an owner would clear a month, for a screen, before any of it is spent. */
export function employeeCostFor(business: Business, wage: Money): Money {
  return (business.employees * wage) as Money
}

/** Why they cannot open this today, or null when they can. */
export function businessBar(
  kind: BusinessKind | undefined,
  cash: Money,
  capitalNow: Money,
  alreadyOwns: boolean,
  age: number,
  /**
   * THE YEAR, for the era gate. Optional so every existing caller keeps its
   * exact meaning — a caller that does not care about the era (and the
   * tests written before there was one) still gets the old four answers.
   */
  year?: number,
): string | null {
  if (!kind) return 'No such trade to go into.'
  if (age < 18) return 'Not yet eighteen.'
  if (alreadyOwns) return 'You already have one to run.'
  if (year !== undefined && kind.availableFrom !== undefined && year < kind.availableFrom) {
    return `Nobody has thought of that yet. Ask again after ${String(kind.availableFrom)}.`
  }
  if (year !== undefined && kind.retiredAfter !== undefined && year > kind.retiredAfter) {
    return `That trade has had its day — the last of them closed around ${String(kind.retiredAfter)}.`
  }
  if (cash < capitalNow) {
    return `${sentenceCase(kind.title)} takes ${String(Math.floor(capitalNow / 100))} dollars to open, and you have ${String(Math.floor(cash / 100))}.`
  }
  return null
}

function sentenceCase(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/**
 * A NAME FOR IT. Fictional always (charter §3), and built from the owner's
 * own family name so a business that passes down still reads as theirs.
 */
export function businessNameFor(familyName: string, kindId: string, pick: number): string {
  const SHAPES: readonly string[] = [
    `${familyName} & Sons`,
    `${familyName} Brothers`,
    `The ${familyName} Company`,
    `${familyName} & Co.`,
    `${familyName}'s`,
  ]
  if (kindId === 'freelance') return `${familyName}, on their own account`
  return SHAPES[Math.abs(pick) % SHAPES.length] ?? `${familyName} & Co.`
}

/** In words, for a screen. */
export function businessHealthWords(business: Business): string {
  if (business.closedTick !== null) return 'closed'
  if (business.badMonths >= 2) return 'in trouble'
  if (business.badMonths === 1) return 'a bad month'
  return 'trading'
}

/**
 * WHEN A BUSINESS IS THE JOB (owner, playing, 2026-08-14: "when someone
 * starts to have a big company say like worth 2 million they shouldnt be
 * able to work a full time job too, businesses take time. Limit this").
 *
 * He is right, and the omission was making a business strictly better than
 * a career: a player could draw a fortune out of a company they never had
 * to attend and collect a salary on top for hours that do not exist in the
 * week.
 *
 * FIVE HUNDRED THOUSAND (owner, ruling, 2026-08-14: "whenever a players
 * company is worth over 500k they should have to leave their job or get a
 * popup that is letting them decide to quit or focus on the business"). Two
 * million was the first number and it almost never bit; this one lands in
 * an ordinary playthrough, which is the point of having it. In base-year
 * cents, so it means the same thing in 1970 and 2030.
 */
export const BUSINESS_IS_FULL_TIME_AT = 50_000_000
