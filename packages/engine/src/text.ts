/**
 * Small text helpers shared by the systems (which record short action
 * descriptions) and the narrative renderer.
 *
 * Kept separate so systems.ts does not have to import story.ts — the tick
 * systems should not depend on the prose layer.
 */

import type { Traits } from './types.js'

/**
 * "a" or "an". Checking the first letter is crude but correct for this
 * vocabulary: it handles electrician, engineer, accountant and office clerk.
 * The awkward exceptions (a university, an hour) do not appear here. Revisit
 * if the occupation table ever gains one.
 */
export function article(word: string): string {
  const first = word.charAt(0).toLowerCase()
  return 'aeiou'.includes(first) ? 'an' : 'a'
}

export function withArticle(word: string): string {
  return `${article(word)} ${word}`
}

// ---------------------------------------------------------------------------
// Temperament in words (P3)
//
// Every person has carried six 0-1000 traits since M1, and they drive real
// behaviour: diligence decides school and job performance and how much of the
// surplus a household spends, ambition decides who goes looking for work,
// curiosity decides who studies on, resilience buffers a setback, vitality is
// read by mortality. Nothing rendered any of it, so the Why? texts landed
// without the person behind them.
//
// The numbers stay internal (Law 9). These are the same facts as a neighbour
// would say them, and only where a trait is actually notable — a middling
// person gets no adjective, because there is nothing to say.
// ---------------------------------------------------------------------------

/** Above this a trait is worth remarking on; below LOW likewise. */
const TRAIT_HIGH = 680
const TRAIT_LOW = 320

interface TraitWord {
  readonly key: keyof Traits
  readonly high: string
  readonly low: string
}

/** Fixed order, so a tie between two equally notable traits is stable. */
const TRAIT_WORDS: readonly TraitWord[] = [
  { key: 'diligence', high: 'diligent', low: 'easy-going' },
  { key: 'ambition', high: 'ambitious', low: 'content with things' },
  { key: 'sociability', high: 'outgoing', low: 'private' },
  { key: 'curiosity', high: 'curious', low: 'set in their ways' },
  { key: 'resilience', high: 'hard to knock down', low: 'takes things hard' },
  { key: 'vitality', high: 'hale', low: 'frail' },
]

/**
 * The notable traits, strongest first. Empty for a person with nothing that
 * stands out — which is most people, and saying so is more honest than
 * dressing every character in adjectives.
 */
export function traitWords(traits: Traits): readonly string[] {
  const notable: { word: string; distance: number; order: number }[] = []
  TRAIT_WORDS.forEach((entry, order) => {
    const value = traits[entry.key]
    if (value >= TRAIT_HIGH) notable.push({ word: entry.high, distance: value - 500, order })
    else if (value <= TRAIT_LOW) notable.push({ word: entry.low, distance: 500 - value, order })
  })
  notable.sort((a, b) => b.distance - a.distance || a.order - b.order)
  return notable.map((item) => item.word)
}

/** e.g. "diligent, private and hale". Empty string when nothing stands out. */
export function describeTraits(traits: Traits): string {
  const words = traitWords(traits)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
}
