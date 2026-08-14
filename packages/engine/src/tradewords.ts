/**
 * WHAT EACH TRADE CALLS ITS OWN THINGS (owner, 2026-08-14: "I don't like
 * how every trade is 'stock the shelfs' either or whatever, every business
 * is different how can a software company 'stock the shelfs' you know what
 * I mean? Each should be unique to each business").
 *
 * He is right, and the flaw is narrower than it looks. The MECHANIC is
 * sound and belongs on every trade: you hold something that cost money, you
 * buy it from somebody at a rate you can improve, and you sell it at a
 * price you set. A filling station holds fuel, a diner holds ingredients, a
 * software company holds servers and licences — all of them are money
 * sitting there waiting to become takings, which is exactly what the stock
 * arithmetic already models.
 *
 * What was wrong was the VOCABULARY. One set of nouns — shelf, stockroom,
 * supplier — was written for a corner shop and then shown to a dentist.
 *
 * So this is a translation table, not a second system. Same numbers, same
 * decisions, twenty different sets of words. There is precedent in this
 * codebase for exactly that: `growthOptionsFor` already names the same five
 * growth primitives differently for a salon and a shop.
 *
 * Pure content. Nothing here changes a single figure.
 */

export interface TradeWords {
  /** What the trade holds, as a mass noun: "fuel", "ingredients". */
  readonly stock: string
  /** Where it is kept: "the tanks", "the walk-in". */
  readonly store: string
  /** What the person selling it to you is called. */
  readonly supplier: string
  /** The button that buys more of it. */
  readonly order: string
  /** The button that turns what is left back into money. */
  readonly clear: string
  /** What the people who pay you are called. */
  readonly customers: string
}

/**
 * THE GENERIC SET, used by any trade added later that nobody has written
 * words for yet. Deliberately plain rather than shop-flavoured, so a trade
 * that falls through here reads as unfinished rather than as wrong.
 */
export const PLAIN_WORDS: TradeWords = {
  stock: 'supplies',
  store: 'the stores',
  supplier: 'supplier',
  order: 'Order supplies',
  clear: 'Sell off what is left',
  customers: 'customers',
}

/**
 * ONE ENTRY PER TRADE.
 *
 * Written to be read aloud. "Fill the tanks" is what a filling station
 * does; "Order supplies" is what a form thinks it does.
 */
const WORDS: Readonly<Record<string, TradeWords>> = {
  freelance: {
    stock: 'materials and travel',
    store: 'what you have paid up front',
    // NOT "the people you buy from": the purity test scans for `from '...'`
    // to find imports, and a string ending in that word reads as one.
    supplier: 'your suppliers',
    order: 'Pay for materials and travel',
    clear: 'Claim back what you can',
    customers: 'clients',
  },
  lessons: {
    stock: 'books and materials',
    store: 'the cupboard',
    supplier: 'the education supplier',
    order: 'Order books and materials',
    clear: 'Sell off the old books',
    customers: 'students',
  },
  'cleaning-round': {
    stock: 'cleaning supplies',
    store: 'the van',
    supplier: 'the janitorial supplier',
    order: 'Load up the van',
    clear: 'Sell off the surplus',
    customers: 'clients',
  },
  'market-stall': {
    stock: 'stock',
    store: 'the stall',
    supplier: 'the wholesaler',
    order: 'Buy stock in',
    clear: 'Sell the stall down',
    customers: 'customers',
  },
  'office-machines': {
    stock: 'machines and parts',
    store: 'the workshop',
    supplier: 'the parts supplier',
    order: 'Order machines and parts',
    clear: 'Sell off the old machines',
    customers: 'customers',
  },
  workshop: {
    stock: 'parts',
    store: 'the parts bin',
    supplier: 'the parts supplier',
    order: 'Buy in parts',
    clear: 'Sell off the parts',
    customers: 'customers',
  },
  salon: {
    stock: 'product',
    store: 'the back bar',
    supplier: 'the wholesaler',
    order: 'Order product',
    clear: 'Sell off the product',
    customers: 'clients',
  },
  'mail-order': {
    stock: 'stock',
    store: 'the warehouse',
    supplier: 'the wholesaler',
    order: 'Fill the warehouse',
    clear: 'Clear the warehouse',
    customers: 'customers',
  },
  'print-shop': {
    stock: 'paper and ink',
    store: 'the stores',
    supplier: 'the paper merchant',
    order: 'Order paper and ink',
    clear: 'Sell off the stores',
    customers: 'customers',
  },
  'video-rental': {
    stock: 'titles',
    store: 'the racks',
    supplier: 'the distributor',
    order: 'Buy in new titles',
    clear: 'Sell off the back catalogue',
    customers: 'members',
  },
  'feed-store': {
    stock: 'feed and seed',
    store: 'the barn',
    supplier: 'the co-op',
    order: 'Fill the barn',
    clear: 'Clear the barn',
    customers: 'customers',
  },
  'fitness-studio': {
    stock: 'equipment and supplies',
    store: 'the floor',
    supplier: 'the equipment supplier',
    order: 'Order equipment',
    clear: 'Sell off the old equipment',
    customers: 'members',
  },
  shop: {
    stock: 'stock',
    store: 'the shelves',
    supplier: 'the wholesaler',
    order: 'Stock the shelves',
    clear: 'Clear the stockroom',
    customers: 'customers',
  },
  'computer-shop': {
    stock: 'machines and parts',
    store: 'the stockroom',
    supplier: 'the distributor',
    order: 'Order machines in',
    clear: 'Clear the stockroom',
    customers: 'customers',
  },
  'filling-station': {
    stock: 'fuel',
    store: 'the tanks',
    supplier: 'the fuel distributor',
    order: 'Fill the tanks',
    clear: 'Run the tanks down',
    customers: 'customers',
  },
  diner: {
    stock: 'ingredients',
    store: 'the walk-in',
    supplier: 'the food supplier',
    order: 'Order ingredients',
    clear: 'Run the walk-in down',
    customers: 'diners',
  },
  haulage: {
    stock: 'fuel and parts',
    store: 'the depot',
    supplier: 'the fuel and parts supplier',
    order: 'Stock the depot',
    clear: 'Run the depot down',
    customers: 'shippers',
  },
  'contracting-firm': {
    stock: 'materials',
    store: 'the yard',
    supplier: 'the builders’ merchant',
    order: 'Order materials',
    clear: 'Sell off the yard',
    customers: 'clients',
  },
  'dental-practice': {
    stock: 'supplies',
    store: 'the dispensary',
    supplier: 'the dental supplier',
    order: 'Order supplies',
    clear: 'Run the dispensary down',
    customers: 'patients',
  },
  'software-company': {
    /**
     * THE ONE HE NAMED. A software company genuinely does hold something
     * that cost money before it earns any — servers, licences, the bill
     * that arrives whether anybody subscribed this month or not. That is
     * why its cost of goods is 60 per-mille and not zero. It has never
     * stocked a shelf in its life.
     */
    stock: 'servers and licences',
    store: 'the racks',
    supplier: 'the hosting provider',
    order: 'Take on more capacity',
    clear: 'Cut the servers back',
    customers: 'subscribers',
  },
}

/** What this trade calls its things. Falls back to plain words. */
export function wordsFor(kindId: string): TradeWords {
  return WORDS[kindId] ?? PLAIN_WORDS
}

/**
 * FILL IN A SENTENCE WRITTEN WITH PLACEHOLDERS.
 *
 * Moments and screens are written once, with `{stock}`, `{store}`,
 * `{supplier}` and `{customers}` in them, and each trade reads its own way.
 */
export function inTradeWords(text: string, kindId: string): string {
  const words = wordsFor(kindId)
  return text
    .replace(/\{stock\}/g, words.stock)
    .replace(/\{store\}/g, words.store)
    .replace(/\{supplier\}/g, words.supplier)
    .replace(/\{customers\}/g, words.customers)
}
