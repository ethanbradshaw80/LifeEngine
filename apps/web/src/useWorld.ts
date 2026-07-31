import { useCallback, useRef, useState } from 'react'
import { advanceTicks, createWorld } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { seed as makeSeed } from '@life-engine/shared'

/**
 * Holds the simulation for the interface.
 *
 * THE RULE (ADR-0012): the UI renders engine state and sends commands. It holds
 * no simulation state of its own.
 *
 * That is why the world lives in a ref rather than in React state. The engine
 * advances the world in place; React only needs to be told that something
 * changed, which is what `version` does. Copying the world into React state
 * would create a second copy of the truth — the exact failure ADR-0005
 * originally existed to prevent, and the one this design has to guard against
 * now that the UI arrives early.
 *
 * `version` is a render counter, not simulation data. Nothing in the interface
 * may derive a fact about the world from it.
 */
export interface WorldController {
  readonly world: World
  readonly seed: number
  /** Increments on every change. Use as a dependency, never as a fact. */
  readonly version: number
  readonly isBusy: boolean
  advance: (months: number) => void
  reset: (seed: number) => void
}

export function useWorld(initialSeed: number): WorldController {
  const seedRef = useRef(initialSeed)
  const worldRef = useRef<World | null>(null)
  const [version, setVersion] = useState(0)
  const [isBusy, setIsBusy] = useState(false)

  worldRef.current ??= createWorld(makeSeed(initialSeed))

  const advance = useCallback((months: number) => {
    const world = worldRef.current
    if (!world || months <= 0) return

    // Long runs block the main thread. Milestone 4 moves the engine into a Web
    // Worker to fix this properly; until then the busy flag at least lets the
    // interface say so rather than appearing frozen.
    setIsBusy(true)
    advanceTicks(world, months)
    setIsBusy(false)
    setVersion((v) => v + 1)
  }, [])

  const reset = useCallback((nextSeed: number) => {
    seedRef.current = nextSeed
    worldRef.current = createWorld(makeSeed(nextSeed))
    setVersion((v) => v + 1)
  }, [])

  const world = worldRef.current
  if (!world) throw new Error('world failed to initialise')

  return { world, seed: seedRef.current, version, isBusy, advance, reset }
}
