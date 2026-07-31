/**
 * The simulation, running off the main thread.
 *
 * WHY: advancing many years is a long synchronous loop. On the main thread the
 * page freezes — no scrolling, no clicking, no spinner. Here it does not.
 *
 * This works precisely BECAUSE the engine is pure (ADR-0003): a Worker has no
 * DOM, no `window`, and no React, so an engine that touched any of them could
 * not run here at all. The purity rule paid for itself again.
 *
 * AUTHORITY: this worker owns the world. The main thread receives a structured
 * clone for rendering and must treat it as read-only. There are not two copies
 * of the truth — there is one authority and one render snapshot, and only
 * messages sent back here can change anything.
 */

import {
  advanceTicks,
  applyForJob,
  createCustomLife,
  createWorld,
  requestEnlistment,
  resolvePending,
  setPlayer,
  SIMULATION_VERSION,
} from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { fromSaveFile } from '@life-engine/persistence'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'

/** Player inputs for a custom life. Nulls mean "let the world decide". */
export interface CreateLifeSpec {
  readonly givenName: string | null
  readonly familyName: string | null
  readonly sex: 'female' | 'male' | null
  readonly motherId: number
}

export type WorkerRequest =
  | { readonly type: 'new'; readonly seed: number }
  | { readonly type: 'advance'; readonly months: number }
  | { readonly type: 'load'; readonly save: unknown }
  | { readonly type: 'play'; readonly personId: number | null; readonly heir?: boolean }
  | { readonly type: 'choose'; readonly choice: string }
  | { readonly type: 'create-life'; readonly spec: CreateLifeSpec }
  | { readonly type: 'apply-job'; readonly occupationId: string }
  | { readonly type: 'request-enlist' }

export type WorkerResponse =
  | {
      readonly type: 'world'
      readonly world: World
      /** Milliseconds the simulation itself took, for the performance budget. */
      readonly elapsedMs: number
      readonly notice?: string
    }
  | { readonly type: 'error'; readonly message: string }

let world: World | null = null

function post(response: WorkerResponse): void {
  self.postMessage(response)
}

function send(elapsedMs: number, notice?: string): void {
  if (!world) {
    post({ type: 'error', message: 'No world exists yet.' })
    return
  }
  // A World is structured-cloneable: Maps, arrays, plain objects, numbers and
  // strings. No serialization step is needed to cross this boundary.
  post(notice === undefined ? { type: 'world', world, elapsedMs } : { type: 'world', world, elapsedMs, notice })
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    switch (request.type) {
      case 'new': {
        const started = performance.now()
        world = createWorld(makeSeed(request.seed))
        send(performance.now() - started)
        return
      }

      case 'advance': {
        if (!world) {
          post({ type: 'error', message: 'No world to advance.' })
          return
        }
        const started = performance.now()
        advanceTicks(world, request.months)
        send(performance.now() - started)
        return
      }

      case 'play': {
        if (!world) {
          post({ type: 'error', message: 'No world to play in.' })
          return
        }
        setPlayer(world, request.personId as EntityId | null, request.heir === true)
        send(0)
        return
      }

      case 'choose': {
        if (!world) {
          post({ type: 'error', message: 'No world to choose in.' })
          return
        }
        // Applies the answer through the same code the automatic path uses,
        // then the clock is free again. The next 'advance' resumes the life.
        resolvePending(world, request.choice)
        send(0)
        return
      }

      case 'apply-job': {
        if (!world) {
          post({ type: 'error', message: 'No world to work in.' })
          return
        }
        // The engine answers honestly either way; a "no" travels back as a
        // notice so the player hears it even though the world barely moved.
        const result = applyForJob(world, request.occupationId)
        send(0, result.hired ? undefined : result.reason)
        return
      }

      case 'request-enlist': {
        if (!world) {
          post({ type: 'error', message: 'No world to serve in.' })
          return
        }
        const result = requestEnlistment(world)
        send(0, result.asked ? undefined : result.reason)
        return
      }

      case 'create-life': {
        if (!world) {
          post({ type: 'error', message: 'No world to be born into.' })
          return
        }
        const created = createCustomLife(world, {
          givenName: request.spec.givenName,
          familyName: request.spec.familyName,
          sex: request.spec.sex,
          motherId: request.spec.motherId as EntityId,
        })
        if (created === null) {
          post({ type: 'error', message: 'That family cannot take a newborn right now. Pick another.' })
          return
        }
        send(0)
        return
      }

      case 'load': {
        const started = performance.now()
        const result = fromSaveFile(request.save, SIMULATION_VERSION)
        world = result.world

        // Both of these are told to the player rather than hidden. A migrated
        // save and a simulation-version change can both alter future results,
        // and discovering that silently is worse than being warned.
        const notes: string[] = []
        if (result.migrationsApplied.length > 0) {
          notes.push(`Save updated from an older format (${result.migrationsApplied.join('; ')}).`)
        }
        if (result.simulationVersionChanged) {
          notes.push(
            'This save was made by a different version of the simulation, so events from here on may differ from the original run.',
          )
        }
        send(performance.now() - started, notes.length > 0 ? notes.join(' ') : undefined)
        return
      }

      default: {
        post({ type: 'error', message: 'Unknown request.' })
      }
    }
  } catch (error) {
    // A failed load must leave the previous world untouched and the stored save
    // exactly where it was. Reporting beats crashing the worker.
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong in the simulation.',
    })
  }
}
