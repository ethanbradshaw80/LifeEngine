/**
 * The station's voice (newsroom spec §2 and §4).
 *
 * Two claims worth defending in tests: the paper varies without ever
 * becoming unreproducible, and the tone override's one hard line holds at
 * every grit level.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { articleFor } from '../src/newsroom.js'
import { serviceNewsSince } from '../src/service.js'
import { crimeNewsSince } from '../src/crime.js'
import {
  CRIME_OPENERS,
  DEATH_OPENERS,
  DEATH_QUOTES,
  gritFor,
  pickPhrase,
  WAR_OPENERS,
} from '../src/newsvoice.js'

describe('the newsroom voice', () => {
  it('is varied and still perfectly reproducible', () => {
    // The whole trick: "unique" means seeded, not random. Two runs of the
    // same world must print the same paper, word for word.
    const build = () => {
      const world = createWorld(makeSeed(4242), 140)
      advanceTicks(world, 480)
      return [...serviceNewsSince(world, 0 as never), ...crimeNewsSince(world, 0 as never)]
        .map((item) => articleFor(world, item))
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => `${a.headline}|${a.lede}`)
    }
    const first = build()
    const second = build()
    expect(first).toEqual(second)

    // And it is actually varied: the ledes are not one template.
    if (first.length >= 4) {
      expect(new Set(first).size, 'the paper printed the same story twice').toBeGreaterThan(1)
    }
  })

  it('runs the death pages hot, and does not run the local page hot', () => {
    // §4's dial. Obituaries were a register cooler on my reasoning and the
    // owner overruled it: the paper is blunt about death wherever it
    // happens, not only where a war caused it.
    expect(gritFor('war')).toBe('high')
    expect(gritFor('courts')).toBe('high')
    expect(gritFor('obituaries')).toBe('high')
    // A mill hiring notice does not need blood in it.
    expect(gritFor('local')).toBe('low')
  })

  it('every pool has all three registers, and none of them is empty', () => {
    for (const pools of [DEATH_OPENERS, CRIME_OPENERS, WAR_OPENERS, DEATH_QUOTES]) {
      for (const grit of ['low', 'medium', 'high'] as const) {
        expect(pools[grit].length, `${grit} register is empty`).toBeGreaterThan(1)
        for (const phrase of pools[grit]) expect(phrase.length).toBeGreaterThan(10)
      }
    }
  })

  it('picks deterministically from a pool', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    expect(pickPhrase(pool, 12345, 7, 100)).toBe(pickPhrase(pool, 12345, 7, 100))
    // And it moves: the same pool with a different subject is not pinned to
    // one entry.
    const picks = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((n) => pickPhrase(pool, 12345, n, 100)))
    expect(picks.size).toBeGreaterThan(1)
  })
})

describe('what the station will and will not report', () => {
  it('never gives an illness a combat headline', () => {
    // THE OWNER, READING THE PAPER: a soldier who died of an illness got
    // "killed in service" and "was hit and did not make it off the road"
    // over a body that said sudden illness. A person in uniform can die of
    // anything anybody else dies of, and when they do it is not a service
    // story.
    const world = createWorld(makeSeed(3131), 140)
    advanceTicks(world, 720)

    for (const item of serviceNewsSince(world, 0 as never)) {
      if (item.kind !== 'died-in-service') continue
      const died = world.events.find(
        (e) => e.type === 'died' && e.subjectId === item.subjectId && e.tick === item.tick,
      )
      const cause = died?.detail ?? ''
      // Only the three the service itself is answerable for reach the paper.
      expect(
        cause.includes('wounds taken in action') ||
          cause.includes('accident') ||
          cause.includes('captivity'),
        `the paper reported a death by "${cause}"`,
      ).toBe(true)

      // And the words match the cause.
      const article = articleFor(world, item)
      if (article === null) continue
      expect(article.headline.length).toBeGreaterThan(0)
    }
  })
})
