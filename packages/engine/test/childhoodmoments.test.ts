import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { SCHOOL_MOMENTS, schoolMomentsFor } from '../src/schoolmoments.js'

/**
 * A CHILDHOOD HAS THINGS IN IT (live player, on itch: "from ages 0-18
 * there is pretty much nothing to do besides click").
 *
 * Two starvations: no stage at all before enrollment (ages 0-5 empty by
 * construction), and a firing rate of 14-in-1000 monthly — one moment
 * every six years, so the authored pool effectively never fired.
 */
describe('childhood moments', () => {
  it('the early years have their own pool', () => {
    const early = schoolMomentsFor('early')
    expect(early.length).toBeGreaterThanOrEqual(3)
    // Authored, not shared: no early moment reuses another stage's id.
    const ids = new Set(SCHOOL_MOMENTS.map((m) => m.id))
    expect(ids.size).toBe(SCHOOL_MOMENTS.length)
  })

  it('moments actually fire across a childhood — the famine is over', () => {
    // MEASURED, NOT ASSERTED FROM THE RATE. Run a world and count
    // school-moment events landing on children. At the old rate this
    // number across a whole town's worth of childhoods was a handful;
    // starved is distinguishable from fed without a tight bound.
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 25)
    let moments = 0
    for (const event of world.events) {
      if (event.type === 'school-moment') moments += 1
    }
    // A town of hundreds over 25 years: the pool must be a real presence.
    expect(moments).toBeGreaterThan(100)
  })

  it('a single child meets several moments before eighteen', () => {
    const world = createWorld(makeSeed(777))
    // Find somebody born early in the run so their whole childhood is
    // inside the window.
    advanceTicks(world, 12 * 2)
    const child = [...world.people.values()].find(
      (p) => p.deathTick === null && world.tick - p.birthTick < 24,
    )
    expect(child).toBeDefined()
    if (!child) return
    advanceTicks(world, 12 * 18)
    const theirs = world.events.filter(
      (e) => e.type === 'school-moment' && e.subjectId === child.id,
    ).length
    // "Nothing to do besides click" — a childhood now carries real
    // moments. Three is a floor, not a target; the expected count at the
    // new rate is around eight.
    expect(theirs).toBeGreaterThanOrEqual(3)
  })
})
