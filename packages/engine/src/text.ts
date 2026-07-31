/**
 * Small text helpers shared by the systems (which record short action
 * descriptions) and the narrative renderer.
 *
 * Kept separate so systems.ts does not have to import story.ts — the tick
 * systems should not depend on the prose layer.
 */

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
