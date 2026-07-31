/**
 * The specifics of harm. M-WOUNDS.
 *
 * The health model of L4-M2 knew THAT a body was hurt; this module knows HOW.
 * A convoy strike does not wound the way a mill saw does, pneumonia is not
 * "illness", and a lasting mark deserves words, not a percentage. Depth and
 * dignity are not opposites: "shrapnel to the left leg" is more honest than
 * a category, and no less careful with it.
 *
 * Everything here is deterministic content selection — the same draws that
 * already decided an ailment exists now also decide what it specifically is.
 * Tables, not prose generators: the words are fixed per (kind, site), so the
 * same wound reads the same way forever (no stored prose; the record keeps
 * kind and site, and rendering assembles the sentence — CAUSAL_RECORDS §2
 * discipline applied to the body).
 */

import type { Rng } from './rng.js'
import type { BodySite, IllnessKind, InjuryKind } from './types.js'

// ---------------------------------------------------------------------------
// What can happen where
// ---------------------------------------------------------------------------

/** How a person got hurt — determines what KINDS of wound are plausible. */
export type InjuryContext =
  | 'machinery' // risky civilian work: the mill, the shop floor
  | 'mishap' // civilian accidents: falls, vehicles, weather
  | 'direct-combat'
  | 'convoy'
  | 'base-attack'
  | 'field-accident' // deployment tempo: vehicles, weather, fatigue

const INJURY_KINDS_BY_CONTEXT: Readonly<Record<InjuryContext, readonly InjuryKind[]>> = {
  machinery: ['crush', 'laceration', 'fracture'],
  mishap: ['fracture', 'concussion', 'laceration', 'crush'],
  'direct-combat': ['gunshot', 'shrapnel', 'laceration'],
  convoy: ['blast', 'shrapnel', 'crush', 'concussion'],
  'base-attack': ['blast', 'burns', 'shrapnel', 'concussion'],
  'field-accident': ['crush', 'fracture', 'burns', 'concussion'],
}

const SITES_BY_KIND: Readonly<Record<InjuryKind, readonly BodySite[]>> = {
  gunshot: ['leg', 'arm', 'shoulder', 'chest'],
  shrapnel: ['leg', 'arm', 'back', 'chest', 'shoulder'],
  blast: ['head', 'chest', 'leg', 'arm'],
  burns: ['hand', 'arm', 'chest', 'head'],
  crush: ['hand', 'foot', 'leg', 'arm'],
  fracture: ['leg', 'arm', 'foot', 'shoulder'],
  concussion: ['head'],
  laceration: ['hand', 'arm', 'leg'],
}

/** Illness by stage of life: the old heart, the winter lung, the bad back. */
export function pickIllness(rng: Rng, age: number): IllnessKind {
  if (age >= 60 && rng.chance(2, 5)) return 'heart-trouble'
  if (age >= 45 && rng.chance(1, 4)) return 'back-trouble'
  const common: readonly IllnessKind[] = ['pneumonia', 'influenza', 'fever', 'infection']
  return rng.pick(common)
}

export function pickInjury(rng: Rng, context: InjuryContext): { kind: InjuryKind; site: BodySite } {
  const kind = rng.pick(INJURY_KINDS_BY_CONTEXT[context])
  const site = rng.pick(SITES_BY_KIND[kind])
  return { kind, site }
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const INJURY_PHRASES: Readonly<Record<InjuryKind, string>> = {
  gunshot: 'a gunshot wound to the',
  shrapnel: 'shrapnel to the',
  blast: 'blast injuries to the',
  burns: 'burns to the',
  crush: 'a crush injury to the',
  fracture: 'a broken',
  concussion: 'a concussion', // site is always head; phrase stands alone
  laceration: 'a deep gash to the',
}

const ILLNESS_PHRASES: Readonly<Record<IllnessKind, string>> = {
  pneumonia: 'pneumonia',
  influenza: 'influenza',
  fever: 'a long fever',
  infection: 'a bad infection',
  'heart-trouble': 'heart trouble',
  'back-trouble': 'back trouble',
}

/** "shrapnel to the leg" / "a broken arm" / "pneumonia". */
export function describeAilment(
  ailment: 'injury' | 'illness',
  kind: string | null,
  site: BodySite | null,
): string {
  if (ailment === 'illness') {
    return kind !== null && kind in ILLNESS_PHRASES
      ? ILLNESS_PHRASES[kind as IllnessKind]
      : 'an illness'
  }
  if (kind === null || !(kind in INJURY_PHRASES)) return 'an injury'
  const phrase = INJURY_PHRASES[kind as InjuryKind]
  if (kind === 'concussion') return phrase
  return site !== null ? `${phrase} ${site}` : phrase
}

/**
 * The permanent mark, in words, from what caused it. One sentence fragment
 * per (kind, site) family — fixed forever, so the same old wound reads the
 * same way in every retrospective.
 */
export function markFor(
  ailment: 'injury' | 'illness',
  kind: string | null,
  site: BodySite | null,
): string {
  if (ailment === 'illness') {
    switch (kind as IllnessKind | null) {
      case 'pneumonia':
      case 'influenza':
      case 'fever':
        return 'the lungs never fully recovered'
      case 'infection':
        return 'never quite regained full strength'
      case 'heart-trouble':
        return 'the heart had to be minded ever after'
      case 'back-trouble':
        return 'the back gave trouble for good'
      default:
        return 'never quite the same after the illness'
    }
  }
  switch (kind as InjuryKind | null) {
    case 'gunshot':
    case 'shrapnel':
      return site === 'leg' || site === 'foot'
        ? 'walked with a limp from then on'
        : `the ${site ?? 'old wound'} ached ever after`
    case 'blast':
    case 'concussion':
      return 'the headaches and the ringing never entirely left'
    case 'burns':
      return `carried the burn scars on the ${site ?? 'arms'}`
    case 'crush':
      return site === 'hand'
        ? 'the hand never worked fine tools again'
        : `the ${site ?? 'limb'} never bore full weight again`
    case 'fracture':
      return `the ${site ?? 'bone'} knitted badly and said so in cold weather`
    case 'laceration':
      return `kept the scar on the ${site ?? 'arm'}`
    default:
      return 'carried the old injury quietly'
  }
}
