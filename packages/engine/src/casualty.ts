/**
 * WHAT A WOUND ACTUALLY COSTS (owner's `combat_tours_revamp.md` §5, §5d).
 *
 * THE KEY REALISM, and the spec puts it in bold: "Getting hit does NOT
 * mean going home. The LARGE MAJORITY of wounds are tiers 1-3 and end in
 * return to duty — patched at the aid station, maybe a few days down, then
 * back to the fight, still on the same tour. Only tier 4+ leaves the
 * theater. A soldier can be wounded two, three, four times across a career
 * and keep serving. The tour-ending wound is the EXCEPTION."
 *
 * That is the whole reason this file exists. A model where every wound
 * ends a tour turns a career into one hit, and it is not what happens to
 * people: the aid station patches most of them and sends them back.
 *
 * WHAT DECIDES WHICH IS THE CHAIN (§5d). Where somebody is hit, how bad
 * it is, and — genuinely — how fast they reach care. The golden hour is
 * real, and a man hit twenty minutes from a surgical team lives through
 * things that kill a man two hours out. That is why evacuation time is an
 * input here rather than flavour.
 */

import type { Tick } from '@life-engine/shared'
import type { BodySite, InjuryKind } from './types.js'

/**
 * THE SIX TIERS (§5).
 *
 * 1 near-miss, 2 superficial, 3 walking wounded, 4 serious, 5
 * life-altering, 6 mortal. The line that matters is between 3 and 4:
 * everything at or below three goes back to the fight.
 */
export type WoundTier = 1 | 2 | 3 | 4 | 5 | 6

/** The line the whole model turns on. */
export const EVACUATES_AT: WoundTier = 4

export function endsTheTour(tier: WoundTier): boolean {
  return tier >= EVACUATES_AT
}

export function returnsToDuty(tier: WoundTier): boolean {
  return tier <= 3
}

export const TIER_WORDS: Readonly<Record<WoundTier, string>> = {
  1: 'a near miss',
  2: 'superficial',
  3: 'walking wounded',
  4: 'serious',
  5: 'life-altering',
  6: 'mortal',
}

/**
 * THE SHAPE OF A CASUALTY LIST.
 *
 * Weights per thousand. These are the numbers that make the spec's claim
 * true or false, so they are the ones worth arguing about: near-misses and
 * superficial wounds dominate, walking wounded is common, serious is
 * uncommon, life-altering is rare and mortal is rarer.
 *
 * A CASUALTY LIST IS NOT A BELL CURVE. Most of what happens to people in
 * contact is nothing much; the tail is what everybody remembers.
 */
const BASE_TIERS: readonly { tier: WoundTier; weight: number }[] = [
  { tier: 1, weight: 380 },
  { tier: 2, weight: 300 },
  { tier: 3, weight: 200 },
  { tier: 4, weight: 85 },
  { tier: 5, weight: 25 },
  { tier: 6, weight: 10 },
]

/**
 * WHERE SOMEBODY IS HIT CHANGES EVERYTHING.
 *
 * Per-mille shift toward the bad end. A limb wound is survivable in a way
 * a chest or head wound is not, and body armour is the reason: it covers
 * the torso, so what gets through to a chest got through something.
 */
const SITE_SEVERITY: Readonly<Record<BodySite, number>> = {
  head: 260,
  chest: 200,
  back: 150,
  shoulder: 60,
  arm: 30,
  hand: 10,
  leg: 70,
  foot: 20,
}

/**
 * SO DOES WHAT HIT THEM.
 *
 * A sniper's round and a distant fragment are not the same event. Blast is
 * the signature of these wars and it is here twice over — the fragments
 * and the overpressure behind them.
 */
const MECHANISM_SEVERITY: Readonly<Partial<Record<InjuryKind, number>>> = {
  gunshot: 140,
  shrapnel: 90,
  blast: 170,
  burns: 200,
  crush: 160,
  amputation: 420,
  'spinal-injury': 460,
  'internal-injury': 240,
  'eye-injury': 180,
  concussion: 40,
  'hearing-damage': -60,
  fracture: 20,
  laceration: -80,
  'smoke-inhalation': 60,
  heatstroke: -40,
  frostbite: -20,
  electrocution: 120,
  'chemical-burns': 180,
}

/**
 * THE ECHELONS OF CARE (§5d) — the chain that decides RTD or evacuation.
 *
 * `minutesToSurgical` is the whole of it. A man hit twenty minutes from a
 * surgical team survives what kills a man two hours out, and that is not a
 * dramatic device, it is why medevac exists.
 *
 * A NEGATIVE SHIFT IS GOOD HERE: fast care pulls the outcome DOWN the
 * tiers, toward return to duty.
 */
export function careShiftFor(minutesToSurgical: number): number {
  if (minutesToSurgical <= 20) return -120
  if (minutesToSurgical <= 60) return -40
  if (minutesToSurgical <= 120) return 60
  return 180
}

/**
 * HOW LONG THE BIRD TAKES, given where somebody is and how hot it is.
 *
 * Hot landing zones are the reason a nine-line is a decision rather than a
 * form: a bird will not come into fire, so the worse the fight, the longer
 * the wait — which is exactly backwards from what the casualty needs, and
 * is the cruellest true thing in this whole model.
 */
export function evacMinutesFor(threatPressure: number, hasMedic: boolean, roll: number): number {
  const base = 25 + Math.floor(threatPressure / 8) + (roll % 40)
  return Math.max(8, hasMedic ? Math.floor(base * 0.7) : base)
}

export interface Casualty {
  readonly tier: WoundTier
  readonly kind: InjuryKind
  readonly site: BodySite
  /** Months out of the fight. Zero for tiers 1-2. */
  readonly downMonths: number
  readonly evacuated: boolean
  readonly words: string
}

/**
 * RESOLVE ONE WOUNDING.
 *
 * Pure: it decides what happened; health.ts owns the record and
 * deployment.ts owns the tour. The roll is passed in rather than drawn so
 * this stays a function of its inputs — the caller already has the
 * engagement's own seed and re-drawing here would let a reload change a
 * wound (§10: determinism is the one rule not overridden).
 */
export function resolveCasualty(
  kind: InjuryKind,
  site: BodySite,
  minutesToSurgical: number,
  armour: boolean,
  roll: number,
): Casualty {
  const shift =
    (SITE_SEVERITY[site] ?? 60) +
    (MECHANISM_SEVERITY[kind] ?? 60) +
    careShiftFor(minutesToSurgical) +
    // BODY ARMOUR IS THE SINGLE BIGGEST REASON THESE WARS' CASUALTY LISTS
    // LOOK AS THEY DO: torso wounds that would have killed became wounds
    // people survive, which is also why the limb amputation became the
    // signature injury.
    (armour && (site === 'chest' || site === 'back') ? -220 : 0)

  // THE SHIFT MODULATES THE SHAPE, IT DOES NOT REPLACE IT — and getting
  // that wrong is easy in a way worth recording. The first version ADDED
  // the shift to each tier's weight scaled by its distance from the
  // middle, which sounds reasonable and completely inverts the
  // distribution: a shrapnel wound to the leg came out MORE likely to be
  // mortal than superficial, and 57 per cent of all wounds ended the tour
  // against a spec that asks for well under 25.
  //
  // Multiplying keeps the base shape — most of what happens to people in
  // contact is nothing much — and lets the shift bend it. Clamped at both
  // ends so a head wound is genuinely dangerous without being certain
  // death, and a hand wound is genuinely survivable without being safe.
  const weights = BASE_TIERS.map(({ tier, weight }) => {
    const lean = 1_000 + (tier - 3) * shift
    const scaled = Math.max(150, Math.min(3_000, lean))
    return { tier, weight: Math.max(1, Math.floor((weight * scaled) / 1_000)) }
  })
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  let draw = roll % Math.max(1, total)
  let tier: WoundTier = 1
  for (const entry of weights) {
    if (draw < entry.weight) {
      tier = entry.tier
      break
    }
    draw -= entry.weight
  }

  const downMonths = tier <= 2 ? 0 : tier === 3 ? 1 : tier === 4 ? 4 : tier === 5 ? 9 : 0
  return {
    tier,
    kind,
    site,
    downMonths,
    evacuated: endsTheTour(tier),
    words: casualtyWords(tier, kind, site),
  }
}

function casualtyWords(tier: WoundTier, kind: InjuryKind, site: BodySite): string {
  switch (tier) {
    case 1:
      return 'It went past you close enough to hear. Nothing touched you.'
    case 2:
      return `A ${kind.replace('-', ' ')} to the ${site}. The aid station patched it and you are back with the platoon.`
    case 3:
      return `A ${kind.replace('-', ' ')} to the ${site}. You are walking and you are working, and it is going to be sore for a while.`
    case 4:
      return `A serious ${kind.replace('-', ' ')} to the ${site}. The bird came, and the tour is over.`
    case 5:
      return `A ${kind.replace('-', ' ')} to the ${site} that does not go away. The rest of your life is on the other side of this.`
    case 6:
      return `A ${kind.replace('-', ' ')} to the ${site}. They could not get to you in time.`
  }
}

/**
 * THE PURPLE HEART IS PER WOUNDING EVENT, not per tour and not per
 * career — which is why a soldier can hold several. The spec says so
 * explicitly and the existing awards module already grants it; this is the
 * predicate that decides when.
 *
 * A near miss is not a wound. Everything else is.
 */
export function meritsWoundRecognition(tier: WoundTier): boolean {
  return tier >= 2
}

/**
 * WHAT AN OLD WOUND DOES FOR THE REST OF A LIFE (spec: "old wounds that
 * ache for life"). Only the permanent ones leave anything behind.
 */
export function permanentDisabilityFrom(tier: WoundTier, site: BodySite): number {
  if (tier < 5) return 0
  const bySite: Partial<Record<BodySite, number>> = {
    head: 620,
    back: 700,
    chest: 380,
    leg: 480,
    arm: 420,
    foot: 300,
    hand: 280,
    shoulder: 220,
  }
  return bySite[site] ?? 350
}

/** How long ago, in words, for the record. */
export function woundAgeWords(woundedAt: Tick, now: Tick): string {
  const months = Math.max(0, now - woundedAt)
  if (months < 12) return 'this year'
  const years = Math.floor(months / 12)
  return years === 1 ? 'a year ago' : `${String(years)} years ago`
}
