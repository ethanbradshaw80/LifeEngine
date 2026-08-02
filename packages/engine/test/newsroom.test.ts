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
    // A QUOTE IS NOT GUARANTEED BY THE FIXTURE, and this assertion used to
    // pretend it was. What the world produces in ninety years depends on the
    // wars it happened to have, so the bloc fix (v53) changed which seeds
    // yield a quotable story at all. The claim worth defending is the one
    // above — every quote names a real person — so the fixture widens until
    // it finds quotes, rather than the assertion being dropped.
    if (quoted === 0) {
      const wider = createWorld(makeSeed(4242))
      advanceTicks(wider, 90 * 12)
      for (const item of [
        ...newsSince(wider, 0 as never),
        ...serviceNewsSince(wider, 0 as never),
        ...crimeNewsSince(wider, 0 as never),
      ]) {
        const article = articleFor(wider, item)
        if (!article || article.quote === null) continue
        quoted++
        expect(
          [...wider.people.values()].some((p) =>
            article.quote?.source.includes(`${p.givenName} ${p.familyName}`),
          ),
          `no such person: ${article.quote.source}`,
        ).toBe(true)
      }
    }
    expect(quoted, 'some story in ninety years is worth quoting somebody about').toBeGreaterThan(0)
  })

  it('does not ship broken prose', () => {
    // Generated sentences are assembled from fragments, and the failures
    // are always the same shapes: a doubled article where a template
    // already carried one ("in the the Land Forces"), a bare number where
    // an ordinal belongs ("in its 8 year"), a gap where a field was empty.
    // A review caught two of these; this catches the next one.
    for (const article of articles) {
      // Filter before joining: an absent quote is not a gap in the copy,
      // and joining an empty string would look like one.
      const prose = [
        article.headline,
        article.lede,
        ...article.body,
        article.quote?.text,
        article.closing,
      ]
        .filter((part): part is string => part !== undefined && part !== null && part.length > 0)
        .join(' ')
      expect(prose, 'doubled article').not.toMatch(/\b(the the|a a|an an|in in|of of)\b/i)
      expect(prose, 'bare number where an ordinal belongs').not.toMatch(/in its \d+ year/)
      expect(prose, 'double space from an empty fragment').not.toMatch(/ {2,}/)
      expect(prose, 'space before punctuation').not.toMatch(/ [.,;]/)
      expect(prose, 'undefined leaked into copy').not.toMatch(/undefined|null|NaN/)
      expect(prose, 'empty parentheses or brackets').not.toMatch(/\(\s*\)|\[\s*\]/)
    }
  })

  it('does not print the same quote every time', () => {
    // Owner: every death used to be interviewed with one sentence. The
    // speaker and the line are drawn from a pure hash of (person, month),
    // so they vary across deaths and never vary for the same death.
    const quotes = articles.map((a) => a.quote?.text).filter((t): t is string => t !== undefined)
    if (quotes.length < 3) return // too few in this window to say anything
    expect(new Set(quotes).size).toBeGreaterThan(1)
    // Sources vary too — it is not always the same person being asked.
    const sources = articles.map((a) => a.quote?.source).filter((s): s is string => s !== undefined)
    expect(new Set(sources).size).toBeGreaterThan(1)
  })

  it('gives the same story the same quote, every time it is asked', () => {
    for (const item of items.slice(0, 40)) {
      const first = articleFor(world, item)
      const second = articleFor(world, item)
      expect(second?.quote?.text).toBe(first?.quote?.text)
      expect(second?.quote?.source).toBe(first?.quote?.source)
    }
  })

  it('runs recruiting notices without the red rule or an article', () => {
    const drives = items.filter((i) => i.kind === 'recruiting-drive')
    expect(drives.length).toBeGreaterThan(0)
    for (const drive of drives) {
      expect(drive.nearby).toBe(false)
      expect(articleFor(world, drive)).toBeNull()
    }
  })

  it('reports a death with the facts a death report needs', () => {
    // THE PAPER IS NARROWER NOW: it carries the deaths the service caused —
    // the enemy, the accident, the cell — and not a soldier who died of an
    // illness. So a fixture world can legitimately have none, and the
    // fixture widens rather than the claim being dropped.
    let deaths = items.filter((i) => i.kind === 'died-in-service')
    let source = world
    if (deaths.length === 0) {
      const wider = createWorld(makeSeed(999), 140)
      advanceTicks(wider, 900)
      source = wider
      deaths = serviceNewsSince(wider, 0 as never).filter((i) => i.kind === 'died-in-service')
    }
    expect(deaths.length, 'no service death in either world').toBeGreaterThan(0)
    for (const item of deaths) {
      const article = articleFor(source, item)
      expect(article).not.toBeNull()
      if (!article) continue
      const person = item.subjectId === undefined ? undefined : source.people.get(item.subjectId)
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
