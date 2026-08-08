/**
 * M-CAREER §1-2. The civilian ladder, and the climb.
 *
 * THE CLAIMS, which are the spec's acceptance targets:
 *   1. Every rung is a real occupation, and pay rises up every ladder.
 *   2. A diligent worker visibly climbs one over a career.
 *   3. A poor performer stalls — being passed over is a thing that happens.
 *   4. The economy has its hand on it: booms open doors a slump keeps shut.
 *   5. Incomes across town spread across the real salary tiers.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { OCCUPATIONS, occupationById } from '../src/content.js'
import {
  CAREER_TRACKS,
  nextRungOf,
  placeOf,
  promotionBar,
  reviewScoreFor,
  standingWords,
  trackById,
  tracksOpenTo,
} from '../src/careers.js'

describe('the ladders', () => {
  it('are made of real occupations, every one of them', () => {
    const known = new Set(OCCUPATIONS.map((o) => o.id))
    for (const track of CAREER_TRACKS) {
      expect(track.rungs.length, `${track.id} is not a ladder`).toBeGreaterThan(2)
      for (const rung of track.rungs) {
        expect(known.has(rung.occupationId), `${track.id}: ${rung.occupationId}`).toBe(true)
      }
    }
  })

  it('pay more the higher you go, on every one', () => {
    for (const track of CAREER_TRACKS) {
      let last = -1
      for (const rung of track.rungs) {
        const pay = occupationById(rung.occupationId).minMonthlyPay
        expect(pay, `${track.id}: ${rung.occupationId} does not pay more than the rung below`).toBeGreaterThan(last)
        last = pay
      }
    }
  })

  it('ask more the higher you go, on every one', () => {
    for (const track of CAREER_TRACKS) {
      let lastPerformance = -1
      let lastMonths = -1
      for (const rung of track.rungs) {
        expect(rung.needsPerformance).toBeGreaterThanOrEqual(lastPerformance)
        lastPerformance = rung.needsPerformance
        lastMonths = Math.max(lastMonths, rung.needsMonths)
      }
      // And the top of a ladder is genuinely hard to reach.
      const top = track.rungs[track.rungs.length - 1]
      expect(top?.needsPerformance).toBeGreaterThan(400)
    }
  })

  it('place an occupation on exactly one of them', () => {
    const seen = new Map<string, string>()
    for (const track of CAREER_TRACKS) {
      for (const rung of track.rungs) {
        expect(
          seen.has(rung.occupationId),
          `${rung.occupationId} is on both ${seen.get(rung.occupationId) ?? ''} and ${track.id}`,
        ).toBe(false)
        seen.set(rung.occupationId, track.id)
      }
    }
    expect(placeOf('senior-associate')?.track.id).toBe('office')
    expect(placeOf('senior-associate')?.rung).toBe(2)
    // A job on no ladder is not an error — the ladders cover the town's
    // work, not every job it is possible to hold.
    expect(placeOf('nothing-like-this')).toBeUndefined()
  })

  it('open to the schooling their entry rung asks for', () => {
    const none = tracksOpenTo('none').map((t) => t.id)
    expect(none).toContain('industrial')
    expect(none).toContain('retail')
    expect(none).not.toContain('office')
    expect(none).not.toContain('physician')
    // Trade school is a sibling of secondary, not a step past it.
    expect(tracksOpenTo('secondary').map((t) => t.id)).not.toContain('trades')
    expect(tracksOpenTo('trade').map((t) => t.id)).toContain('trades')
    expect(tracksOpenTo('college').map((t) => t.id)).toContain('physician')
  })
})

describe('the review', () => {
  it('refuses in words, and says which of the two is missing', () => {
    const office = trackById('office')
    expect(office).toBeDefined()
    if (!office) return

    // Too soon.
    expect(promotionBar(office, 0, 999, 1)).toContain('month')
    // Long enough, but the reviews are not there.
    const next = nextRungOf(office, 0)
    expect(next).toBeDefined()
    expect(promotionBar(office, 0, 100, next!.needsMonths)).toContain('reviews')
    // Ready.
    expect(promotionBar(office, 0, next!.needsPerformance, next!.needsMonths)).toBeNull()
    // Nothing above the top.
    expect(promotionBar(office, office.rungs.length - 1, 1000, 999)).toContain('nothing above')
  })

  it('counts the work, the years and the weather', () => {
    const boom = reviewScoreFor(600, 36, 20)
    const slump = reviewScoreFor(600, 36, -20)
    expect(boom).toBeGreaterThan(slump)
    // Time in the job counts, and it is capped so it cannot carry somebody
    // to the top on patience alone.
    expect(reviewScoreFor(600, 200, 0)).toBe(reviewScoreFor(600, 1000, 0))
    expect(reviewScoreFor(600, 0, 0)).toBeLessThan(reviewScoreFor(600, 60, 0))
  })

  it('says where somebody stands, in words', () => {
    expect(standingWords(900)).toBe('well regarded')
    expect(standingWords(100)).toBe('on thin ice')
    expect(new Set(CAREER_TRACKS.map(() => standingWords(500))).size).toBe(1)
  })
})

describe('a career, over a life', () => {
  it('visibly climbs — and does not carry everybody to the top', () => {
    // MEASURED across three seeds and seventy-five years: 92 promotions and
    // 88 pass-overs, with people standing on every rung of the ladders.
    let promotions = 0
    let passedOver = 0
    const rungs = new Map<number, number>()
    for (const seedValue of [12345, 4141, 777]) {
      const world = createWorld(makeSeed(seedValue), 100)
      advanceTicks(world, 900)
      for (const event of world.events) {
        if (event.type === 'promoted-at-work') promotions++
        if (event.type === 'passed-over') passedOver++
      }
      for (const job of world.employment.values()) {
        const place = placeOf(job.occupationId)
        if (!place) continue
        rungs.set(place.rung, (rungs.get(place.rung) ?? 0) + 1)
      }
    }
    expect(promotions, 'nobody was ever promoted').toBeGreaterThan(20)
    expect(passedOver, 'everybody who qualified was promoted').toBeGreaterThan(10)
    // People are spread across the ladders rather than piled at either end.
    expect(rungs.get(0) ?? 0).toBeGreaterThan(0)
    expect(rungs.size, 'the whole town is on one rung').toBeGreaterThan(3)
  })

  it('leaves a record that says what happened and why', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 600)
    const promotions = world.events.filter((e) => e.type === 'promoted-at-work')
    expect(promotions.length).toBeGreaterThan(0)
    for (const event of promotions.slice(0, 10)) {
      // The event names the job it was to, and the job is real.
      expect(occupationById(event.detail ?? '').id).toBe(event.detail)
      const why = world.causalRecords.find(
        (r) => r.subjectId === event.subjectId && r.chosen.startsWith('promoted to'),
      )
      expect(why, 'a promotion with no cause on the record').toBeDefined()
    }
  })

  it('puts every worker on a ladder the town actually has', () => {
    const world = createWorld(makeSeed(4141), 100)
    advanceTicks(world, 480)
    for (const job of world.employment.values()) {
      if (job.trackId === null) continue
      const track = trackById(job.trackId)
      expect(track, `${job.trackId} is not a track`).toBeDefined()
      // And the record's track agrees with the occupation it holds.
      expect(placeOf(job.occupationId)?.track.id).toBe(job.trackId)
    }
  })
})

/**
 * The ordering bug the careers module found in its own foundation.
 */
describe('every level opens the doors it should', () => {
  it('opens tracks for the levels the education module added', () => {
    // `tracksOpenTo` kept a PRIVATE copy of the education ordering, and it
    // drifted the moment `middle` was inserted and `graduate` appended:
    // indexOf returned -1 for both, `-1 >= 0` is false for every track,
    // and so a middle-school leaver and a PhD holder each qualified for
    // NO TRACK AT ALL — an advanced degree opened fewer doors than
    // dropping out of primary school.
    //
    // The old test only checked 'none' and 'secondary', the two levels
    // that happened to sit in the stale array, which is why it went
    // unnoticed. This one walks the whole ladder.
    for (const level of ['none', 'primary', 'middle', 'secondary', 'trade', 'college', 'graduate'] as const) {
      expect(tracksOpenTo(level).length, `${level} opens nothing`).toBeGreaterThan(0)
    }
  })

  it('never lets more schooling open fewer doors', () => {
    // The invariant the drift broke, stated directly: walking up the
    // ladder can only ever add tracks, never take one away. The trade
    // exception is the one deliberate step sideways.
    const ladder = ['none', 'primary', 'middle', 'secondary'] as const
    let previous = 0
    for (const level of ladder) {
      const count = tracksOpenTo(level).length
      expect(count, `${level} opens fewer than the level below`).toBeGreaterThanOrEqual(previous)
      previous = count
    }
    // And the top of the ladder opens at least what a degree does.
    expect(tracksOpenTo('graduate').length).toBeGreaterThanOrEqual(tracksOpenTo('college').length)
  })
})
