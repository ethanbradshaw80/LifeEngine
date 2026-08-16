/**
 * GIVING IT AWAY (owner: "once you get money like that theres nothing to
 * really do... we neeed ideas for that too").
 *
 * The first of the money sinks, and chosen first on purpose: it is the only
 * one on the list that serves LAW 8. A yacht is a number that leaves when
 * you do. A wing with your family's name on it is still standing when your
 * grandson walks past it, and that is the whole difference between spending
 * money and leaving something behind.
 *
 * THE RULE THIS IS BUILT TO: a money sink should buy a STORY, not a number.
 * Nothing here raises a stat the player will go looking for. What it buys is
 * a permanent mark on the town, a line in the retrospective, and the quiet
 * fact that the school your children attend is the one your money saved.
 *
 * WHY THE FAMILY NAME GOES ON A FIELD OF ITS OWN, and does not simply
 * rename the place: half this town's machinery matches places BY NAME.
 * `workplaceNamesFor` seats a nurse at "the county hospital" and a teacher
 * at "the public library" by string. Renaming the library to "the Bradshaw
 * Library" would quietly stop every education and creative career finding
 * anywhere to work — a bug that would surface months later as "why does
 * nobody get hired at the library any more". `endowedBy` sits beside the
 * name instead, so the town reads exactly as it did and the screens can say
 * both.
 *
 * PURE CONTENT AND PURE READS. Nothing here moves money or writes a place —
 * `endowPlayer` in player.ts does that, for the same reason every other verb
 * does: this module would otherwise have to import finances, which imports
 * player, and the cycle checker would be right to complain.
 */

import type { Money } from '@life-engine/shared'
import { dollars } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import type { Place, World } from './types.js'

export type GiftTier = 'gift' | 'wing' | 'endowment'

export interface GiftTerms {
  readonly tier: GiftTier
  readonly title: string
  /** What it costs, in BASE-YEAR cents. Charged at today's prices. */
  readonly cost: Money
  readonly blurb: string
  /**
   * What it does to the place, 0-1000 desirability. A real effect on a real
   * field — desirability drives where people choose to live — and a small
   * one, because a library does not remake a town.
   */
  readonly lift: number
  /** Does the family name go on it? */
  readonly names: boolean
}

/**
 * THREE SIZES OF GIVING, priced so that each is out of reach until it is not.
 *
 * The gift is meant to be affordable to an ordinary working life — giving
 * should not be a rich person's verb only. The endowment is priced where a
 * successful business owner feels it, and it is the one that carries the
 * name, because a name on a building should cost something that hurt.
 *
 * Base-year cents, so all three inflate with the world and the endowment
 * still bites in 2070.
 */
export const GIFTS: readonly GiftTerms[] = [
  {
    tier: 'gift',
    title: 'Make a gift',
    cost: dollars(400),
    blurb: 'Enough to matter to them, and to be remembered by the people who run it.',
    lift: 0,
    names: false,
  },
  {
    tier: 'wing',
    title: 'Pay for a new wing',
    cost: dollars(12_000),
    blurb: 'Bricks and mortar. The place can do more than it could last year.',
    lift: 40,
    names: false,
  },
  {
    tier: 'endowment',
    title: 'Endow it in your family’s name',
    cost: dollars(90_000),
    blurb: 'Money that outlives you, and your name over the door for good.',
    lift: 80,
    names: true,
  },
]

export function giftTermsFor(tier: GiftTier): GiftTerms | undefined {
  return GIFTS.find((entry) => entry.tier === tier)
}

/** Where the tier sits in the order, so a bigger gift can follow a smaller. */
export function giftRank(tier: GiftTier): number {
  return GIFTS.findIndex((entry) => entry.tier === tier)
}

/**
 * THE TOWN'S OWN INSTITUTIONS — what there is to give to.
 *
 * The school and the civic buildings, and deliberately not the workplaces:
 * a foundry is somebody's business, not a public good, and endowing one
 * would read as buying it rather than giving to it.
 */
export function causePlaces(world: World): readonly Place[] {
  const found: Place[] = []
  for (const id of world.town.placeIds) {
    const place = world.places.get(id)
    if (place === undefined) continue
    if (place.kind === 'school' || place.kind === 'civic') found.push(place)
  }
  return found
}

/** What this institution is for, in one line. */
export function causeBlurb(place: Place): string {
  if (place.kind === 'school') return 'Where every child in this town learns to read.'
  if (place.name.includes('library')) return 'The only books in town that anybody can borrow.'
  return 'The business of the town, conducted in public.'
}

/**
 * WHAT IT WOULD SAY OVER THE DOOR. Not applied here — `endowPlayer` writes
 * it — but computed here so the screen can show the player what they are
 * buying before they buy it.
 */
export function endowedNameFor(familyName: string, place: Place): string {
  const what =
    place.kind === 'school' ? 'School' : place.name.includes('library') ? 'Library' : 'Hall'
  return `the ${familyName} ${what}`
}

export interface GiftOffer {
  readonly tier: GiftTier
  readonly title: string
  readonly blurb: string
  /** At TODAY'S prices — what they will actually be asked for. */
  readonly cost: Money
  /** Why they cannot, in the engine's own words, or null. */
  readonly bar: string | null
}

export interface CauseView {
  readonly placeId: EntityId
  readonly name: string
  readonly blurb: string
  /** The family whose name is on it, or null while nobody's is. */
  readonly endowedBy: string | null
  readonly offers: readonly GiftOffer[]
}
