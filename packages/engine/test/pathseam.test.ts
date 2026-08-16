/**
 * WHAT THE JOBS SCREEN ACTUALLY GETS.
 *
 * `paths.test.ts` validates the TABLE. This validates the SEAM: `pathsFor`
 * is the one function `JobsTab.tsx` calls, and a ladder that is perfect in
 * the table but never reaches the screen — filtered out by an era window,
 * or arriving with an entry bar nobody could ever clear — is a career that
 * does not exist as far as a player is concerned.
 *
 * Written when the table went from fifteen ladders to seventy-four, because
 * that is exactly the change that would hide a whole category behind an
 * empty bubble without a single test going red.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { PATH_CATEGORIES } from '../src/paths.js'
import { pathsFor, setPlayer } from '../src/player.js'

/** A school leaver, standing in front of the jobs screen with nothing. */
function aSchoolLeaver(years = 25) {
  const world = createWorld(makeSeed(4242), 100)
  advanceTicks(world, years * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 22 && ageAt(p.birthTick, world.tick) <= 40)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  ;(world.player as { pending: unknown }).pending = null
  return world
}

describe('the ladders reach the screen', () => {
  it('hands the jobs tab a career in every bubble it draws', () => {
    /**
     * THE BUBBLE THAT OPENS ON NOTHING. `JobsTab` hides a category with no
     * paths, so a category that empties out disappears silently rather than
     * breaking. This is the only place that would notice.
     */
    const world = aSchoolLeaver()
    const views = pathsFor(world)
    expect(views.length).toBeGreaterThanOrEqual(60)
    for (const category of PATH_CATEGORIES) {
      const inIt = views.filter((view) => view.categoryId === category.id)
      expect(inIt.length, `${category.label} draws an empty bubble`).toBeGreaterThan(0)
    }
  })

  it('leaves a way in — every category has something a beginner could start', () => {
    /**
     * A category where EVERY ladder is shut is a bubble a player opens,
     * reads four refusals in, and closes. Some individual ladders should be
     * shut — that is the point of gates — but a whole trade being sealed to
     * a school leaver is a dead screen.
     *
     * Measured on a fresh world, where the player has no schooling, no
     * licences and no skills: the hardest case there is.
     */
    const world = aSchoolLeaver()
    const views = pathsFor(world)
    const sealed: string[] = []
    for (const category of PATH_CATEGORIES) {
      const open = views.filter((view) => view.categoryId === category.id && view.entryBar === null)
      if (open.length === 0) sealed.push(category.label)
    }
    /**
     * THE ONE THIS FOUND. Personal Services was sealed outright: stylist,
     * trainer and masseur all demand their licence at the entry rung, and
     * the groomer did too, so the bubble opened on four locks. The groomer's
     * ticket moved up a rung — see `pathhands.ts` — and there is now a way
     * into every trade in town.
     */
    expect(sealed).toEqual([])
  })

  it('says why in words, never with a bare lock', () => {
    const world = aSchoolLeaver()
    for (const view of pathsFor(world)) {
      if (view.entryBar === null) continue
      expect(view.entryBar.length, `${view.id} is shut without saying why`).toBeGreaterThan(10)
    }
  })

  it('opens the modern trades only once the world reaches them', () => {
    // The era windows are honoured through the seam, not merely in the
    // table: 1970 should be a shorter list of careers than the present day.
    const early = pathsFor(aSchoolLeaver(25)).length
    const later = pathsFor(aSchoolLeaver(60)).length
    expect(later, 'the modern trades never arrive').toBeGreaterThan(early)
  })
})
