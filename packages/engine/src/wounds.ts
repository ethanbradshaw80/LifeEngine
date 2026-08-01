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
  machinery: ['crush', 'laceration', 'fracture', 'amputation', 'electrocution', 'chemical-burns', 'eye-injury'],
  mishap: ['fracture', 'concussion', 'laceration', 'crush', 'spinal-injury', 'near-drowning', 'smoke-inhalation', 'animal-bite', 'frostbite'],
  'direct-combat': ['gunshot', 'shrapnel', 'laceration', 'hearing-damage', 'eye-injury'],
  convoy: ['blast', 'shrapnel', 'crush', 'concussion', 'amputation', 'internal-injury', 'hearing-damage'],
  'base-attack': ['blast', 'burns', 'shrapnel', 'concussion', 'hearing-damage', 'smoke-inhalation'],
  'field-accident': ['crush', 'fracture', 'burns', 'concussion', 'heatstroke', 'frostbite', 'near-drowning', 'spinal-injury'],
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
  amputation: ['hand', 'foot', 'leg', 'arm'],
  'hearing-damage': ['head'],
  'spinal-injury': ['back'],
  'internal-injury': ['chest'],
  'eye-injury': ['head'],
  electrocution: ['hand', 'arm'],
  'chemical-burns': ['hand', 'arm', 'head'],
  'smoke-inhalation': ['chest'],
  heatstroke: ['head'],
  frostbite: ['foot', 'hand'],
  'near-drowning': ['chest'],
  'animal-bite': ['hand', 'arm', 'leg'],
}

/** Illness by stage of life: the old heart, the winter lung, the bad back —
 *  and the rarer, harder names that also live in a real town (M-HARM). */
export function pickIllness(rng: Rng, age: number): IllnessKind {
  if (age >= 60 && rng.chance(2, 5)) return 'heart-trouble'
  if (age >= 55 && rng.chance(1, 9)) return 'stroke'
  if (age >= 45 && rng.chance(1, 12)) return 'cancer'
  if (age >= 50 && rng.chance(1, 12)) return 'kidney-trouble'
  if (age >= 40 && rng.chance(1, 14)) return 'liver-trouble'
  if (age >= 45 && rng.chance(1, 4)) return 'back-trouble'
  if (age >= 35 && rng.chance(1, 12)) return 'ulcers'
  if (age <= 30 && rng.chance(1, 20)) return 'meningitis'
  if (rng.chance(1, 16)) return 'appendicitis'
  if (rng.chance(1, 14)) return 'tuberculosis'
  const common: readonly IllnessKind[] = ['pneumonia', 'influenza', 'fever', 'infection']
  return rng.pick(common)
}

/** What a theatre gives out that a town does not (M-HARM): the diseases of
 *  the field. Deployment illness is service-connected; history's armies
 *  lost more people to these than to fire. */
export function pickFieldIllness(rng: Rng): IllnessKind {
  return rng.pick(['field-fever', 'dysentery', 'infection'] as const)
}

export function pickInjury(rng: Rng, context: InjuryContext): { kind: InjuryKind; site: BodySite } {
  const kind = rng.pick(INJURY_KINDS_BY_CONTEXT[context])
  const site = rng.pick(SITES_BY_KIND[kind])
  return { kind, site }
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** Kinds whose phrase stands alone — no "to the <site>" suffix. */
const STANDALONE_KINDS: ReadonlySet<string> = new Set([
  'concussion', 'hearing-damage', 'spinal-injury', 'internal-injury',
  'eye-injury', 'smoke-inhalation', 'heatstroke', 'near-drowning',
])

const INJURY_PHRASES: Readonly<Record<InjuryKind, string>> = {
  gunshot: 'a gunshot wound to the',
  shrapnel: 'shrapnel to the',
  blast: 'blast injuries to the',
  burns: 'burns to the',
  crush: 'a crush injury to the',
  fracture: 'a broken',
  concussion: 'a concussion', // standalone
  laceration: 'a deep gash to the',
  amputation: 'the loss of the',
  'hearing-damage': 'blown-out hearing', // standalone
  'spinal-injury': 'a back broken in the fall', // standalone
  'internal-injury': 'internal injuries', // standalone
  'eye-injury': 'an injured eye', // standalone
  electrocution: 'an electrical burn through the',
  'chemical-burns': 'chemical burns to the',
  'smoke-inhalation': 'lungs full of smoke', // standalone
  heatstroke: 'heatstroke', // standalone
  frostbite: 'frostbite in the',
  'near-drowning': 'a near-drowning', // standalone
  'animal-bite': 'a bad bite to the',
}

const ILLNESS_PHRASES: Readonly<Record<IllnessKind, string>> = {
  pneumonia: 'pneumonia',
  influenza: 'influenza',
  fever: 'a long fever',
  infection: 'a bad infection',
  'heart-trouble': 'heart trouble',
  'back-trouble': 'back trouble',
  cancer: 'a cancer',
  stroke: 'a stroke',
  tuberculosis: 'tuberculosis',
  meningitis: 'meningitis',
  appendicitis: 'a burst appendix',
  'kidney-trouble': 'kidney trouble',
  'liver-trouble': 'liver trouble',
  ulcers: 'bleeding ulcers',
  'field-fever': 'a fever out of the field',
  dysentery: 'dysentery',
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
  if (STANDALONE_KINDS.has(kind)) return phrase
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
      case 'field-fever':
        return 'the lungs never fully recovered'
      case 'infection':
        return 'never quite regained full strength'
      case 'heart-trouble':
        return 'the heart had to be minded ever after'
      case 'back-trouble':
        return 'the back gave trouble for good'
      case 'cancer':
        return 'the illness left its shadow over every year after'
      case 'stroke':
        return 'one side stayed slow, and the words came harder'
      case 'tuberculosis':
        return 'breathed carefully for the rest of the life'
      case 'meningitis':
        return 'the headaches stayed, and some of the hearing went with them'
      case 'appendicitis':
        return 'the scar across the belly, and a wariness of doctors'
      case 'kidney-trouble':
        return 'the kidneys had to be watched from then on'
      case 'liver-trouble':
        return 'strong drink was finished with, willingly or not'
      case 'ulcers':
        return 'ate carefully ever after'
      case 'dysentery':
        return 'the gut never wholly settled'
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
    case 'amputation':
      return site === 'hand' || site === 'arm'
        ? `lived on without the ${site ?? 'hand'}, and learned the other`
        : `lived on without the ${site ?? 'leg'}, and hated the stairs`
    case 'hearing-damage':
      return 'the hearing on one side never came back'
    case 'spinal-injury':
      return 'stood crooked ever after, and sat down carefully'
    case 'internal-injury':
      return 'the strength for heavy work never fully returned'
    case 'eye-injury':
      return 'saw the world through one good eye from then on'
    case 'electrocution':
      return `the ${site ?? 'hand'} trembled at fine work ever after`
    case 'chemical-burns':
      return `the skin on the ${site ?? 'hands'} stayed papery and pale`
    case 'smoke-inhalation':
      return 'stairs and cold mornings found the lungs out'
    case 'heatstroke':
      return 'the sun was never trusted again'
    case 'frostbite':
      return 'cold weather found the old frostbite first'
    case 'near-drowning':
      return 'deep water was finished with for good'
    case 'animal-bite':
      return `kept the tooth-marks on the ${site ?? 'arm'}, and a wariness`
    default:
      return 'carried the old injury quietly'
  }
}
