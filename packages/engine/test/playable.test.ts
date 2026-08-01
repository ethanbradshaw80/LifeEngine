/**
 * The playable character. M-PLAY.
 *
 * What must be true for this to be a game rather than a viewer:
 *
 *  1. Playing nobody changes nothing — the simulation is exactly the pure
 *     world the golden-seed test fingerprints.
 *  2. The clock halts at a player decision and resumes when answered.
 *  3. Answers take effect through the same code the automatic path uses.
 *  4. A life is replayable: same seed + same answers ⇒ byte-identical world.
 *  5. Death halts the run so the retrospective can be shown, and heirs exist.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import {
  advanceTick,
  advanceTicks,
  createWorld,
  lifeStory,
  worldHash,
} from '../src/index.js'
import {
  awaitingPlayer,
  describePending,
  hasAnswered,
  heirsOf,
  playerIsAlive,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

const SEED = 12345

/** The oldest founding child — the person whose education question comes soonest. */
function pickTeenager(world: World) {
  const children = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) < 18)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  const teen = children[0]
  if (!teen) throw new Error('seed produced no children — pick a different seed')
  return teen
}

/** Advance until a decision is pending, with a sanity bound. */
function advanceToPending(world: World, maxTicks = 600): number {
  let ticks = 0
  while (!awaitingPlayer(world) && ticks < maxTicks) {
    advanceTick(world)
    ticks++
    if (!playerIsAlive(world)) break
  }
  return ticks
}

describe('playing nobody changes nothing', () => {
  it('a watched world equals a pure simulation, byte for byte', () => {
    const pure = createWorld(makeSeed(SEED), 100)
    advanceTicks(pure, 120)

    const watched = createWorld(makeSeed(SEED), 100)
    setPlayer(watched, null)
    advanceTicks(watched, 120)

    expect(worldHash(watched)).toBe(worldHash(pure))
  })
})

describe('the clock and the player', () => {
  let world: World

  beforeEach(() => {
    world = createWorld(makeSeed(SEED), 100)
  })

  it('halts at the first decision instead of living the life unasked', () => {
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)

    advanceTicks(world, 600)

    // The run stopped early — at a decision, not at the tick budget.
    expect(world.tick).toBeLessThan(600)
    expect(awaitingPlayer(world)).toBe(true)
    const pending = world.player.pending
    expect(pending?.personId).toBe(teen.id)
    // The first fork in a founding teenager's life is the education question.
    expect(pending?.kind).toBe('education')
    // L4-M3: the fork may also offer the uniform when the person qualifies.
    expect(pending?.options.slice(0, 3)).toEqual(['college', 'trade', 'work'])
  })

  it('does not advance while a decision is pending', () => {
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)

    const before = world.tick
    advanceTicks(world, 60)
    expect(world.tick).toBe(before)
  })

  it('resumes once answered, and never asks the same question again', () => {
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)

    resolvePending(world, 'work')
    expect(awaitingPlayer(world)).toBe(false)
    expect(hasAnswered(world, 'education')).toBe(true)

    const before = world.tick
    advanceToPending(world, 240)
    expect(world.tick).toBeGreaterThan(before)
    // Whatever comes next, it is not the education question repeated.
    if (world.player.pending) expect(world.player.pending.kind).not.toBe('education')
  })

  it('rejects an answer that is not among the options', () => {
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)
    expect(() => resolvePending(world, 'become-an-astronaut')).toThrow(/not one of/)
  })

  it('refuses to play the dead', () => {
    const dead = createWorld(makeSeed(SEED), 100)
    advanceTicks(dead, 240)
    const gone = [...dead.people.values()].find((p) => p.deathTick !== null)
    expect(gone).toBeDefined()
    if (!gone) return
    expect(() => setPlayer(dead, gone.id)).toThrow(/not alive/)
  })
})

describe('answers take effect', () => {
  it('college means college', () => {
    const world = createWorld(makeSeed(SEED), 100)
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)

    resolvePending(world, 'college')
    expect(world.education.get(teen.id)?.enrolledIn).toBe('college')

    // And the record honestly says it was their own choice.
    const record = world.causalRecords.find(
      (r) => r.subjectId === teen.id && r.inputs.some((f) => f.factor === 'own-choice'),
    )
    expect(record).toBeDefined()
  })

  it('an accepted job offer employs; a declined one does not', () => {
    const world = createWorld(makeSeed(SEED), 100)
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)
    resolvePending(world, 'work')

    // Next decision should be a job offer, eventually.
    advanceToPending(world, 240)
    const pending = world.player.pending
    expect(pending?.kind).toBe('job-offer')
    if (!pending) return

    resolvePending(world, 'decline')
    expect(world.employment.has(teen.id)).toBe(false)

    advanceToPending(world, 240)
    if (world.player.pending?.kind === 'job-offer') {
      resolvePending(world, 'accept')
      expect(world.employment.has(teen.id)).toBe(true)
    }
  })
})

describe('a life is replayable', () => {
  it('same seed and same answers produce the identical world', () => {
    function liveALife(): World {
      const world = createWorld(makeSeed(SEED), 100)
      const teen = pickTeenager(world)
      setPlayer(world, teen.id)

      // A fixed policy stands in for a human: always the first option.
      let answered = 0
      for (let guard = 0; guard < 2_000 && world.tick < 480; guard++) {
        if (awaitingPlayer(world)) {
          const first = world.player.pending?.options[0]
          if (first === undefined) throw new Error('pending with no options')
          resolvePending(world, first)
          answered++
        } else {
          advanceTick(world)
          if (!playerIsAlive(world)) break
        }
      }
      expect(answered).toBeGreaterThan(0)
      return world
    }

    const first = liveALife()
    const second = liveALife()

    expect(first.player.log.length).toBe(second.player.log.length)
    expect(worldHash(first)).toBe(worldHash(second))
  })
})

describe('death and legacy', () => {
  it('the run halts at death, the story ends honestly, and heirs are findable', () => {
    const world = createWorld(makeSeed(SEED), 100)
    // Play someone middle-aged so death arrives within the test budget.
    const elder = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 55 && age <= 70
    })
    expect(elder).toBeDefined()
    if (!elder) return
    setPlayer(world, elder.id)

    for (let guard = 0; guard < 5_000 && playerIsAlive(world); guard++) {
      if (awaitingPlayer(world)) {
        const first = world.player.pending?.options[0]
        resolvePending(world, first ?? 'decline')
      } else {
        advanceTick(world)
      }
    }

    expect(playerIsAlive(world)).toBe(false)
    const person = world.people.get(elder.id)
    expect(person?.deathTick).not.toBeNull()

    // The retrospective is the life story, and it ends with a death, a cause,
    // and a wholly explainable record (Law 8, Law 3).
    const story = lifeStory(world, elder.id)
    expect(story).toContain('Died')

    // Heirs: any living children, oldest first.
    const heirs = heirsOf(world, elder.id)
    for (const heirId of heirs) {
      expect(world.people.get(heirId)?.deathTick).toBeNull()
    }
  })
})

describe('prompts', () => {
  it('describes a pending decision in plain words', () => {
    const world = createWorld(makeSeed(SEED), 100)
    const teen = pickTeenager(world)
    setPlayer(world, teen.id)
    advanceToPending(world)
    const pending = world.player.pending
    expect(pending).not.toBeNull()
    if (!pending) return
    const prompt = describePending(world, pending)
    expect(prompt.length).toBeGreaterThan(10)
    expect(prompt).not.toContain('undefined')
  })
})
