import { useCallback, useEffect, useRef, useState } from 'react'
import type { World } from '@life-engine/engine'
import { toSaveFile } from '@life-engine/persistence'
import type { WorkerRequest, WorkerResponse } from './engine.worker.js'
import { deleteSave, readSave, writeSave } from './storage.js'

/**
 * Drives the simulation from the interface.
 *
 * THE ARRANGEMENT (ADR-0003, ADR-0012):
 *
 *   Worker    owns the world. The single authority. Nothing else mutates it.
 *   Storage   holds the saved bytes. IndexedDB, in storage.ts.
 *   This hook holds a read-only CLONE of the world for rendering, and sends
 *             commands. It never mutates the clone.
 *
 * The clone is a render snapshot, not a second source of truth: no code path
 * writes to it, and every change arrives from the worker. That is a different
 * thing from the UI keeping its own simulation state, which remains forbidden.
 */

export type Status = 'starting' | 'idle' | 'working' | 'error'

export interface WorldController {
  readonly world: World | null
  readonly status: Status
  readonly message: string | null
  /** Milliseconds the last simulation step took, from the worker's own clock. */
  readonly lastElapsedMs: number | null
  readonly saveState: 'unsaved' | 'saving' | 'saved' | 'failed'
  advance: (months: number) => void
  newWorld: (seed: number) => void
  /** Start or stop living as a person. Null returns to watching the town.
   *  `heir: true` continues the line — the finished life joins the lineage. */
  play: (personId: number | null, heir?: boolean) => void
  /** Answer the pending decision. */
  choose: (choice: string) => void
  save: () => void
  discardSave: () => void
}

export function useWorld(initialSeed: number): WorldController {
  const workerRef = useRef<Worker | null>(null)
  const [world, setWorld] = useState<World | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [message, setMessage] = useState<string | null>(null)
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<'unsaved' | 'saving' | 'saved' | 'failed'>('unsaved')
  const autosaveTimer = useRef<number | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      if (response.type === 'error') {
        setStatus('error')
        setMessage(response.message)
        return
      }
      setWorld(response.world)
      setLastElapsedMs(response.elapsedMs)
      setStatus('idle')
      setMessage(response.notice ?? null)

      // AUTOSAVE. A browser tab can be killed without warning, and losing
      // forty simulated years to that is the kind of thing a player does not
      // forgive (R-03). Every world update is written down, debounced so a
      // burst of quick steps becomes one write. toSaveFile is pure and the
      // clone is read-only, so saving off the response is safe.
      const worldToSave = response.world
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
      setSaveState('saving')
      autosaveTimer.current = window.setTimeout(() => {
        void (async () => {
          const result = await writeSave(toSaveFile(worldToSave))
          setSaveState(result.ok ? 'saved' : 'failed')
          if (!result.ok && result.message !== undefined) setMessage(result.message)
        })()
      }, 600)
    }

    worker.onerror = () => {
      setStatus('error')
      setMessage('The simulation stopped unexpectedly. Reload the page to start again.')
    }

    // Prefer a stored save over a fresh world, so reopening the tab continues
    // where the player left off.
    void (async () => {
      let stored: unknown
      try {
        stored = await readSave()
      } catch {
        stored = undefined
      }

      const request: WorkerRequest =
        stored === undefined ? { type: 'new', seed: initialSeed } : { type: 'load', save: stored }
      worker.postMessage(request)
    })()

    return () => {
      worker.terminate()
      workerRef.current = null
    }
    // Deliberately once: the worker outlives every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = useCallback((request: WorkerRequest) => {
    const worker = workerRef.current
    if (!worker) return
    setStatus('working')
    setMessage(null)
    worker.postMessage(request)
  }, [])

  const advance = useCallback(
    (months: number) => {
      if (months > 0) send({ type: 'advance', months })
    },
    [send],
  )

  const newWorld = useCallback(
    (seed: number) => {
      send({ type: 'new', seed })
    },
    [send],
  )

  const play = useCallback(
    (personId: number | null, heir = false) => {
      send({ type: 'play', personId, heir })
    },
    [send],
  )

  const choose = useCallback(
    (choice: string) => {
      send({ type: 'choose', choice })
    },
    [send],
  )

  const save = useCallback(() => {
    if (!world) return
    setSaveState('saving')
    void (async () => {
      // toSaveFile is pure, so building the save on this thread is safe: it
      // reads the clone and writes nothing.
      const result = await writeSave(toSaveFile(world))
      setSaveState(result.ok ? 'saved' : 'failed')
      if (!result.ok && result.message !== undefined) setMessage(result.message)
    })()
  }, [world])

  const discardSave = useCallback(() => {
    void (async () => {
      await deleteSave()
      setSaveState('unsaved')
      setMessage('Saved game deleted.')
    })()
  }, [])

  return {
    world,
    status,
    message,
    lastElapsedMs,
    saveState,
    advance,
    newWorld,
    play,
    choose,
    save,
    discardSave,
  }
}
