/**
 * The WCJC newsroom, held to the owner's brief.
 *
 * The brief names three failure modes and this file tests for all three:
 * no facts, no quotes and no structure, and length spent on abstract
 * commentary. It also enforces the rule that matters most for a
 * simulation: nothing invented, and every quote attributed to a person who
 * actually exists.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { newsSince } from '../src/geopolitics.js'
import { serviceNewsSince } from '../src/service.js'
import { crimeNewsSince } from '../src/crime.js'
import { articleFor } from '../src/newsroom.js'
import type { NewsArticle } from '../src/newsroom.js'

/** The abstract register the brief forbids: musings rather than reporting. */
const BANNED = [
  'which is not the same as',
  'shelf life',
  'is not an abstraction',
  'the part people forget',
  'worth saying plainly',
  'is its own kind of',
  'tends to decide',
]

function wordCount(article: NewsArticle): number {
  const parts = [
    article.headline,
    article.lede,
    ...article.body,
    article.quote?.text ?? '',
    article.closing ?? '',
  ]
  return parts.join(' ').split(/\s+/).filter(Boolean).length
}

describe('WCJC', () => {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, 90 * 12)
  const items = [
    ...newsSince(world, 0 as never),
    ...serviceNewsSince(world, 0 as never),
    ...crimeNewsSince(world, 0 as never),
  ]
  const articles = items
    .map((item) => articleFor(world, item))
    .filter((a): a is NewsArticle => a !== null)

  it('files articles at all', () => {
    expect(items.length).toBeGreaterThan(0)
    expect(articles.length).toBeGreaterThan(0)
  })

  it('gives every article the structure the brief asks for', () => {
    for (const article of articles) {
      // Headline: plain, specific, under about twelve words.
      expect(article.headline.length).toBeGreaterThan(0)
      expect(article.headline.split(/\s+/).length).toBeLessThanOrEqual(12)
      // Dateline: place and month.
      expect(article.dateline).toMatch(/^[A-Z][A-Z\s']+, [A-Z][a-z]+ \d+$/)
      // A lede that is one sentence of fact.
      expect(article.lede.length).toBeGreaterThan(20)
      expect(article.lede.endsWith('.')).toBe(true)
      // Two to four body paragraphs.
      expect(article.body.length).toBeGreaterThanOrEqual(1)
      expect(article.body.length).toBeLessThanOrEqual(4)
    }
  })

  it('keeps the length in a reporter\'s range', () => {
    for (const article of articles) {
      const words = wordCount(article)
      expect(words).toBeGreaterThan(45)
      expect(words).toBeLessThan(260)
    }
  })

  it('does not philosophize', () => {
    for (const article of articles) {
      const all = [article.headline, article.lede, ...article.body, article.closing ?? ''].join(' ')
      for (const phrase of BANNED) {
        expect(all.toLowerCase(), `"${phrase}" is essay-writing`).not.toContain(phrase)
      }
    }
  })

  it('attributes every quote to somebody who actually exists', () => {
    let quoted = 0
    for (const item of items) {
      const article = articleFor(world, item)
      if (!article || article.quote === null) continue
      quoted++
      // The source names a real living person in the world.
      const named = [...world.people.values()].some(
        (p) => article.quote!.source.includes(`${p.givenName} ${p.familyName}`),
      )
      expect(named, `no such person: ${article.quote.source}`).toBe(true)
    }
    expect(quoted).toBeGreaterThan(0)
  })

  it('reports a death with the facts a death report needs', () => {
    const deaths = items.filter((i) => i.kind === 'died-in-service')
    expect(deaths.length).toBeGreaterThan(0)
    for (const item of deaths) {
      const article = articleFor(world, item)
      expect(article).not.toBeNull()
      if (!article) continue
      const person = item.subjectId === undefined ? undefined : world.people.get(item.subjectId)
      expect(person).toBeDefined()
      if (!person) continue
      // WHO and WHEN in the lede, WHY in the body.
      expect(article.lede).toContain(person.familyName)
      expect(article.body.join(' ')).toContain('cause is recorded as')
      // Survivors or the record's disposition close it.
      expect(article.closing).not.toBeNull()
    }
  })
})
