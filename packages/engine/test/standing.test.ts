/**
 * STANDING HAS TO BE REACHABLE — the schoolhouse bug.
 *
 * The owner, playing: "I'm also getting an error with the school houses
 * where I have a 300 pt score and I am still not 'meeting the bar'", and
 * then "it was all the schoolhouses I wasnt eligible even with that score".
 *
 * The 300 was fitness, which caps at 300 and clears every fitness gate in
 * the game. The bar that was actually refusing him is `performance`, printed
 * on every course card as "Standing meets the bar" — and it had no path
 * behind it. Standing drifted toward diligence, which is FIXED AT BIRTH, and
 * the only things that raised it were graduating a school (which needs
 * standing), finishing a deployment, and one moment that fires once.
 *
 * Two fixes, and one claim each: the years count, and there is something to
 * do about it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { isServing, schoolOptionsFor } from '../src/service.js'
import { extraDutyBar, takeExtraDuty } from '../src/player.js'
import { setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function servingWorld(seed: number, years: number): World {
  const world = createWorld(makeSeed(seed))
  advanceTicks(world, 12 * years)
  return world
}

describe('standing is something a career can earn', () => {
  /**
   * THE ROOT CAUSE. Before the seasoning term, a soldier's ceiling was their
   * birth temperament and the years added nothing — so this comparison came
   * out flat, and which schools somebody could ever attend was settled before
   * they were born.
   *
   * A POPULATION PROPERTY, not a person: individuals vary, and one unlucky
   * sergeant proves nothing. What must hold is that the long-serving, as a
   * group, stand higher than the newly joined.
   */
  it('the long-serving stand higher than the newly joined', () => {
    const world = servingWorld(4242, 45)
    const veteran: number[] = []
    const fresh: number[] = []
    for (const person of livingPeople(world)) {
      if (!isServing(world, person.id)) continue
      const record = world.service.get(person.id)
      if (!record) continue
      const years = (world.tick - record.enlistedAtTick) / 12
      if (years >= 12) veteran.push(record.performance)
      else if (years <= 3) fresh.push(record.performance)
    }
    expect(veteran.length).toBeGreaterThan(0)
    expect(fresh.length).toBeGreaterThan(0)
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(veteran)).toBeGreaterThan(mean(fresh))
  })

  /**
   * AND IT HAS TO REACH THE DOOR. Raising a number nobody can spend would be
   * the same bug in a different place, so the claim is about the schoolhouse
   * rather than about `performance`: courses actually open.
   */
  it('the schoolhouse opens to somebody in a grown world', () => {
    const world = servingWorld(4242, 45)
    let open = 0
    let standingRefusals = 0
    for (const person of livingPeople(world)) {
      if (!isServing(world, person.id)) continue
      for (const option of schoolOptionsFor(world, person.id)) {
        if (!option.onYourList) continue
        if (option.open) open += 1
        else if (option.reason === 'The work is not there yet.') standingRefusals += 1
      }
    }
    expect(open).toBeGreaterThan(0)
    // Standing must not be the wall it was. It is still allowed to refuse —
    // the top courses SHOULD want more than time served — but it can no
    // longer be the thing that shuts the schoolhouse for everybody.
    expect(standingRefusals).toBeLessThan(open * 4)
  })

  /**
   * THE QUESTION THE TEST ABOVE DOES NOT ASK, and the reason the owner
   * reported this same refusal a SECOND time after it was called fixed.
   *
   * That test pools every serving soldier in a forty-five-year-old world,
   * twenty-year veterans included, and claims only that somebody somewhere
   * can get a seat. It passes comfortably on a world where the newest
   * cohort is refused everything, because the twelve-year sergeants carry
   * the total. It is an assertion adjacent to the bug rather than on it.
   *
   * The owner is not somebody somewhere. He is a man who just enlisted. So
   * this asks about HIS cohort, on a pooled sample big enough to mean
   * something — the single-seed world has about five such soldiers, which is
   * too few to measure anything.
   *
   * MEASURED while fixing this: new soldiers had 0.29 open courses each
   * against eighteen standing refusals, and the entry-tier bar (450) sat
   * within a rounding error of their median standing (492) — so the most
   * basic course in the army refused about half the recruits who would take
   * it. The bar is 400 now, which is a value the table already used.
   */
  it('a soldier who just enlisted can get into something', () => {
    let people = 0
    let open = 0
    for (const seed of [11, 4242, 777, 90210, 31337]) {
      const world = servingWorld(seed, 45)
      for (const person of livingPeople(world)) {
        if (!isServing(world, person.id)) continue
        const record = world.service.get(person.id)
        if (!record) continue
        if ((world.tick - record.enlistedAtTick) / 12 >= 3) continue
        people += 1
        for (const option of schoolOptionsFor(world, person.id)) {
          if (option.onYourList && option.open) open += 1
        }
      }
    }
    expect(people).toBeGreaterThan(20)
    // Not "every recruit gets a seat" — a new private SHOULD be shut out of
    // sniper school. The claim is that the door is not shut on the whole
    // cohort at once: across the first three years there is, on average,
    // better than half a course apiece actually reachable.
    expect(open / people).toBeGreaterThan(0.5)
  })
})

describe('extra duty — the path behind the bar', () => {
  /** Find a world where the player is serving, so the verb has a subject. */
  function playerServing(seed: number): World | null {
    const world = servingWorld(seed, 40)
    for (const person of livingPeople(world)) {
      if (!isServing(world, person.id)) continue
      const record = world.service.get(person.id)
      if (!record || record.schoolId !== null) continue
      setPlayer(world, person.id)
      return world
    }
    return null
  }

  it('raises standing, and the same answer greys the button', () => {
    const world = playerServing(4242)
    expect(world).not.toBeNull()
    if (world === null) return
    const personId = world.player.personId
    expect(personId).not.toBeNull()
    if (personId === null) return

    const before = world.service.get(personId)?.performance ?? 0
    // The bar and the verb are one function, so if the button is live the
    // verb must succeed. That is the whole point of the pattern.
    expect(extraDutyBar(world)).toBeNull()
    const result = takeExtraDuty(world)
    expect(result.done).toBe(true)
    expect(world.service.get(personId)?.performance ?? 0).toBeGreaterThan(before)
  })

  it('cannot be held down — the months have to pass', () => {
    const world = playerServing(4242)
    expect(world).not.toBeNull()
    if (world === null) return
    expect(takeExtraDuty(world).done).toBe(true)
    // Immediately again: refused, and the refusal is the bar's own words.
    const bar = extraDutyBar(world)
    expect(bar).not.toBeNull()
    const second = takeExtraDuty(world)
    expect(second.done).toBe(false)
    expect(second.reason).toBe(bar)
  })

  it('costs something — the hours come out of a life', () => {
    const world = playerServing(4242)
    expect(world).not.toBeNull()
    if (world === null) return
    const personId = world.player.personId
    if (personId === null) return
    const before = world.wellbeing.get(personId)?.value ?? 550
    takeExtraDuty(world)
    expect(world.wellbeing.get(personId)?.value ?? 550).toBeLessThan(before)
  })

  it('is refused to somebody not serving', () => {
    const world = servingWorld(4242, 40)
    const civilian = livingPeople(world).find((p) => !isServing(world, p.id))
    expect(civilian).toBeDefined()
    if (!civilian) return
    setPlayer(world, civilian.id)
    expect(extraDutyBar(world)).toBe('Only somebody serving can pick up extra duty.')
    expect(takeExtraDuty(world).done).toBe(false)
  })
})
