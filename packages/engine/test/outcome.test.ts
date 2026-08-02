/**
 * "Why?" must answer the question (owner direction).
 *
 * A causal record says what pushed someone into a decision, which on its
 * own reads as a tautology — "he went to the school because he chose to".
 * describeOutcome answers the other half: what the event PRODUCED, read
 * from the state it produced. This pins that it reads real state and never
 * invents a consequence.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { describeOutcome, timelineFor } from '../src/story.js'

describe('what came of it', () => {
  const world = createWorld(makeSeed(12345))
  advanceTicks(world, 80 * 12)

  it('names the act behind an award, not just the medal', () => {
    const awarded = world.events.filter((e) => e.type === 'awarded')
    expect(awarded.length).toBeGreaterThan(0)
    let described = 0
    for (const event of awarded) {
      const text = describeOutcome(world, event)
      if (text === null) continue
      described++
      // The medal's own title is in it…
      expect(text).toContain(event.detail ?? '')
      // …and it says something beyond the title alone.
      expect(text.length).toBeGreaterThan((event.detail ?? '').length + 8)
    }
    expect(described).toBeGreaterThan(0)
  })

  it('says what a school left behind rather than that it was attended', () => {
    const courses = world.events.filter((e) => e.type === 'completed-training')
    expect(courses.length).toBeGreaterThan(0)
    const described = courses
      .map((e) => describeOutcome(world, e))
      .filter((t): t is string => t !== null)
    expect(described.length).toBeGreaterThan(0)
    // It talks about consequences — the rating, the board, the trade — not
    // about the act of going.
    expect(
      described.some(
        (t) => t.includes('board') || t.includes('rating') || t.includes('trade'),
      ),
    ).toBe(true)
  })

  it('reads a conviction from the record, with its real sentence', () => {
    const convictions = world.events.filter((e) => e.type === 'was-convicted')
    for (const event of convictions) {
      const text = describeOutcome(world, event)
      if (text === null) continue
      const record = world.criminal.get(event.subjectId)
      const conviction = record?.convictions.find((c) => c.tick === event.tick)
      if (!conviction) continue
      if (conviction.sentenceMonths > 0) {
        expect(text).toContain(String(conviction.sentenceMonths))
      }
      expect(text).toContain('ten years')
    }
  })

  it('is null where an event produced nothing beyond itself', () => {
    const born = world.events.find((e) => e.type === 'born')
    expect(born).toBeDefined()
    if (born) expect(describeOutcome(world, born)).toBeNull()
  })

  it('reaches the timeline, so the interface can lead with it', () => {
    // Somebody with a service life has outcomes on their entries.
    const served = [...world.service.keys()]
    let withOutcome = 0
    for (const personId of served.slice(0, 25)) {
      const entries = timelineFor(world, personId)
      withOutcome += entries.filter((entry) => entry.outcome !== null).length
    }
    expect(withOutcome).toBeGreaterThan(0)
  })
})
