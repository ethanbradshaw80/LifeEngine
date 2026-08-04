/**
 * Seeded deterministic randomness. See docs/DETERMINISM.md §1-2.
 *
 * Two ideas do all the work here:
 *
 * 1. DERIVED STREAMS. Every random draw is derived from
 *    (worldSeed, streamId, entityId, tick) rather than pulled from one shared
 *    sequence. If every subsystem shared a single generator, adding one new
 *    draw anywhere would shift every subsequent value in the entire world — a
 *    bug fix in employment would silently change every birth and death after
 *    it. Derived streams make subsystems independent.
 *
 * 2. INTEGER ARITHMETIC ONLY. Everything below uses 32-bit integer operations
 *    (Math.imul, >>>, ^). No floating point enters the generator, so results
 *    are bit-identical on every JavaScript engine. Math.sin and friends are
 *    banned project-wide precisely because they are not.
 */

import type { EntityId, Seed, Tick } from '@life-engine/shared'

/**
 * Which subsystem a random draw belongs to. Values are permanent: a save
 * records which stream produced which outcome, so they are never renumbered
 * or reused. Extend by appending.
 */
export const Stream = {
  WorldGeneration: 1,
  PersonTraits: 2,
  LifeEventTiming: 3,
  Relationships: 4,
  Education: 5,
  Employment: 6,
  Health: 7,
  Economy: 8,
  /** Reserved in Milestone 1; claimed at L4-M1. */
  Geopolitics: 9,
  /** Reserved in Milestone 1; claimed at L4-M4. The last reserved stream. */
  CombatResolution: 10,
  /** Appended at C1 (the sanctioned path): crime and justice draws. */
  Crime: 11,
  /**
   * Appended at M-CAREER, by the same sanctioned path: the civilian ladder,
   * its reviews and its work moments. A stream of its own so that adding a
   * career draw never reorders an employment one.
   */
  Career: 12,
  /**
   * Appended at M-ENLIST, by the same sanctioned path: the entry test, the
   * officer merit board and the scene a job meets. Its own stream so that
   * adding a recruiting draw never reorders a deployment one.
   */
  Service: 13,
} as const

export type StreamId = (typeof Stream)[keyof typeof Stream]

/**
 * 32-bit integer hash (murmur3 finalizer). Fixed forever: changing it changes
 * every simulation outcome, so it would require a simulation-version bump.
 */
function mix32(value: number): number {
  let h = value | 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Combine several integers into one 32-bit hash, order-sensitively. */
export function hash32(...values: readonly number[]): number {
  let h = 0x811c9dc5 | 0
  for (const value of values) {
    h = mix32((h ^ (value | 0)) >>> 0)
  }
  return h >>> 0
}

/**
 * A single random stream. Created fresh for each (stream, entity, tick)
 * context, drawn from, then discarded — it holds no state between ticks.
 */
export class Rng {
  private state: number

  constructor(streamSeed: number) {
    // A zero state would make the generator produce a constant sequence.
    this.state = streamSeed >>> 0 || 0x9e3779b9
  }

  /** Next raw 32-bit value (mulberry32). */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  /**
   * Integer in [minInclusive, maxExclusive).
   *
   * Uses rejection sampling rather than a modulo, because a plain modulo
   * biases toward low values when the range does not divide evenly into 2^32.
   * Over millions of draws that bias is visible in the simulation.
   */
  nextInt(minInclusive: number, maxExclusive: number): number {
    const span = maxExclusive - minInclusive
    if (!Number.isInteger(span) || span <= 0) {
      throw new RangeError(`Invalid range [${minInclusive}, ${maxExclusive})`)
    }
    const limit = 0x100000000 - (0x100000000 % span)
    let draw = this.nextUint32()
    while (draw >= limit) draw = this.nextUint32()
    return minInclusive + (draw % span)
  }

  /** Integer in [min, max] inclusive at both ends. */
  nextIntInclusive(min: number, max: number): number {
    return this.nextInt(min, max + 1)
  }

  /** True with probability numerator/denominator. */
  chance(numerator: number, denominator: number): boolean {
    if (numerator <= 0) return false
    if (numerator >= denominator) return true
    return this.nextInt(0, denominator) < numerator
  }

  /** True with probability perTenThousand/10000. Convenient for rare events. */
  chanceInTenThousand(perTenThousand: number): boolean {
    return this.chance(perTenThousand, 10_000)
  }

  /** Uniform choice from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick() requires a non-empty array')
    const chosen = items[this.nextInt(0, items.length)]
    if (chosen === undefined) throw new Error('unreachable: index within bounds')
    return chosen
  }

  /**
   * Weighted choice. Weights must be non-negative integers; at least one must
   * be positive. Integer weights keep this exactly reproducible.
   */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError('pickWeighted() requires equal non-empty arrays')
    }
    let total = 0
    for (const w of weights) {
      if (!Number.isInteger(w) || w < 0) throw new RangeError('weights must be non-negative integers')
      total += w
    }
    if (total === 0) throw new RangeError('pickWeighted() requires at least one positive weight')

    let roll = this.nextInt(0, total)
    for (let i = 0; i < items.length; i++) {
      const weight = weights[i] ?? 0
      if (roll < weight) {
        const chosen = items[i]
        if (chosen === undefined) throw new Error('unreachable: index within bounds')
        return chosen
      }
      roll -= weight
    }
    throw new Error('unreachable: weights summed incorrectly')
  }

  /**
   * A roughly bell-shaped integer in [min, max], from averaging four uniform
   * draws. Useful for traits, where most people should sit near the middle.
   */
  nextBellInt(min: number, max: number): number {
    const span = max - min + 1
    let total = 0
    for (let i = 0; i < 4; i++) total += this.nextInt(0, span)
    return min + Math.floor(total / 4)
  }
}

/**
 * Open a random stream for a specific context. The same arguments always
 * produce the same sequence, on any machine, in any browser, forever.
 */
export function openStream(
  worldSeed: Seed,
  streamId: StreamId,
  entity: EntityId | number,
  tick: Tick | number,
): Rng {
  return new Rng(hash32(worldSeed, streamId, entity, tick))
}
