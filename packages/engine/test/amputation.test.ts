import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { fitAdaptation, runHealth } from '../src/health.js'
import { barredFromWork, canRun, effectsOf } from '../src/conditions.js'
import { enlistmentBar } from '../src/service.js'

/**
 * A LIMB DOES NOT GROW BACK.
 *
 * The owner, playing: "I just lost my leg in war and I rested and healed
 * right back up and now im 'back on my feet' no past wounds no nothing lol
 * we need this fixed he lost his leg how can he still serve and fight for
 * the country with 1 leg".
 *
 * He was right twice over, and the two halves are tested separately below
 * because they were two different failures stacked on each other.
 */
describe('irreversible wounds', () => {
  /**
   * Put a healed-out amputation in front of the recovery path and read what
   * it leaves behind. The wound is set up directly rather than by waiting
   * for a war to produce one — the thing under test is what recovery DOES
   * with an amputation, not how often one happens.
   */
  function recoverFrom(kind: string, peakSeverity: number) {
    const world = createWorld(makeSeed(909), 100)
    const personId = [...world.people.keys()][0]!
    const before = world.health.get(personId)!
    world.health.set(personId, {
      ...before,
      ailment: 'injury',
      ailmentKind: kind,
      ailmentSite: 'leg',
      // Already healed down to nothing — this is precisely the moment the
      // player described, the one where he "rested and healed right back up".
      severity: 1,
      peakSeverity,
      sinceTick: (world.tick - 6) as Tick,
      ailmentServiceConnected: true,
    })
    runHealth(world, world.tick)
    return { world, personId, after: world.health.get(personId)! }
  }

  it('an amputation always leaves a permanent record — it is not a dice roll', () => {
    // THE ORIGINAL BUG WAS PROBABILISTIC, so once is not a test. The old
    // code rolled `chance(peakSeverity, 2600)` and left nothing about two
    // times in three; a single passing run would have proved nothing at
    // all. Every seed must leave the record, not most of them.
    for (let seed = 0; seed < 40; seed += 1) {
      const world = createWorld(makeSeed(seed), 100)
      const personId = [...world.people.keys()][0]!
      const before = world.health.get(personId)!
      world.health.set(personId, {
        ...before,
        ailment: 'injury',
        ailmentKind: 'amputation',
        ailmentSite: 'leg',
        severity: 1,
        peakSeverity: 420,
        sinceTick: (world.tick - 6) as Tick,
        ailmentServiceConnected: true,
      })
      runHealth(world, world.tick)
      const after = world.health.get(personId)!
      expect(after.disability, `seed ${String(seed)} left no disability`).toBeGreaterThanOrEqual(450)
      expect(after.marks.length, `seed ${String(seed)} left no mark`).toBeGreaterThan(0)
    }
  })

  it('a man with one leg cannot enlist to fight', () => {
    // THE HALF THAT MATTERED MOST TO HIM. A record that says "leg gone" and
    // a recruiter who takes him anyway is the same bug with paperwork.
    const { world, personId } = recoverFrom('amputation', 420)
    const person = world.people.get(personId)!
    expect(enlistmentBar(world, person, world.tick)).not.toBeNull()
  })

  it('the loss is service-connected, so the pension sees it', () => {
    const { after } = recoverFrom('amputation', 420)
    expect(after.serviceDisability).toBeGreaterThanOrEqual(450)
  })

  it('an ordinary injury is still a roll — the floor did not swallow everything', () => {
    // THE ADJACENT-ASSERTION GUARD. A "fix" that made every wound permanent
    // would pass all three tests above and quietly ruin the town. A sprain
    // that heals clean has to stay possible.
    let cleanRecoveries = 0
    for (let seed = 0; seed < 40; seed += 1) {
      const world = createWorld(makeSeed(seed), 100)
      const personId = [...world.people.keys()][0]!
      const before = world.health.get(personId)!
      world.health.set(personId, {
        ...before,
        ailment: 'injury',
        ailmentKind: 'fracture',
        ailmentSite: 'leg',
        severity: 1,
        peakSeverity: 420,
        sinceTick: (world.tick - 6) as Tick,
      })
      runHealth(world, world.tick)
      if (world.health.get(personId)!.disability === before.disability) cleanRecoveries += 1
    }
    expect(cleanRecoveries).toBeGreaterThan(10)
  })
})

/**
 * WHAT THE WOUND ACTUALLY DOES TO THE LIFE — M-HEALTH §4.
 *
 * The spec's acceptance bar: "if a condition can't be FELT elsewhere in the
 * game, it isn't modeled yet." Before this, `marks` were read by exactly one
 * caller — `story.ts`, to narrate them — so a lost leg was a sentence in an
 * obituary and changed nothing a player could touch.
 */
describe('a permanent wound is felt', () => {
  function withLostLeg() {
    const world = createWorld(makeSeed(909), 100)
    const personId = [...world.people.keys()][0]!
    const before = world.health.get(personId)!
    world.health.set(personId, {
      ...before,
      permanent: [{ kind: 'amputation', site: 'leg', sinceTick: world.tick }],
    })
    return { world, personId }
  }

  it('takes the manual trades away for good', () => {
    const { world, personId } = withLostLeg()
    expect(barredFromWork(world, personId, 'labourer')).toBe(true)
    expect(barredFromWork(world, personId, 'carpenter')).toBe(true)
    // AND LEAVES THE REST OPEN. A wound that closed every door would be a
    // different bug, and Law 7 is explicit that a life goes on after one.
    expect(barredFromWork(world, personId, 'clerk')).toBe(false)
    expect(barredFromWork(world, personId, 'bookkeeper')).toBe(false)
  })

  it('stops him running', () => {
    const { world, personId } = withLostLeg()
    expect(canRun(world, personId)).toBe(false)
  })

  it('lowers what he can ever be fit enough for', () => {
    const { world, personId } = withLostLeg()
    expect(effectsOf(world, personId).fitnessCeilingPerMille).toBeLessThan(1000)
  })

  it('a prosthetic gives back part of it, and never all of it', () => {
    const { world, personId } = withLostLeg()
    const before = effectsOf(world, personId).mobilityPerMille
    expect(fitAdaptation(world, personId, world.tick)).toBe(true)
    const after = effectsOf(world, personId).mobilityPerMille

    expect(after).toBeGreaterThan(before)
    // THE CLAIM THAT MATTERS. §7: "partially restores function, NEVER
    // FULLY". A fix that quietly healed him would pass the line above and
    // reintroduce the exact bug this whole module exists for.
    expect(after).toBeLessThan(1000)
  })

  it('and does not reopen the roofing job', () => {
    const { world, personId } = withLostLeg()
    fitAdaptation(world, personId, world.tick)
    expect(barredFromWork(world, personId, 'carpenter')).toBe(true)
  })

  it('cannot be fitted twice for the same limb', () => {
    const { world, personId } = withLostLeg()
    expect(fitAdaptation(world, personId, world.tick)).toBe(true)
    expect(fitAdaptation(world, personId, world.tick)).toBe(false)
  })
})
