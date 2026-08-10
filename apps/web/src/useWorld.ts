import { useCallback, useEffect, useRef, useState } from 'react'
import type { World } from '@life-engine/engine'
import { applyLedgerDelta } from './ledgerdelta.js'
import type { HeldLedger } from './ledgerdelta.js'
import { toSaveFile } from '@life-engine/persistence'
import type { CreateLifeSpec, VerbRequest, WorkerRequest, WorkerResponse } from './engine.worker.js'
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
  newWorld: (seed: number, presetId?: string) => void
  /** Start or stop living as a person. Null returns to watching the town.
   *  `heir: true` continues the line — the finished life joins the lineage. */
  play: (personId: number | null, heir?: boolean) => void
  /** Be born: create a custom newborn in an existing family and play it. */
  createLife: (spec: CreateLifeSpec) => void
  /** Ask after work at a trade, from the Jobs tab. The town answers. */
  applyJob: (occupationId: string) => void
  /** Walk into the recruiting office, from the Service tab. */
  requestEnlist: () => void
  /** Ask for a named school slot, from the Service tab. */
  requestSchool: (schoolId: string) => void
  /** Put in for a special unit's selection. */
  tryUnit: (unitId: string) => void
  /** Volunteer for the rotation, on demand. */
  requestDeploy: () => void
  /** Take the annual fitness test — promotion points for the body. */
  fitnessTest: () => void
  extraDuty: () => void
  beBorn: (
    givenName: string,
    familyName: string,
    sex: 'male' | 'female',
    station: number | null,
    seedNumber: number,
  ) => void
  /** P2: any player-initiated verb — court, propose, quit, look for a place…
   *  One channel; the engine's honest refusal comes back as the notice. */
  act: (action: VerbRequest) => void
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
  // THE LEDGER LIVES HERE BETWEEN MESSAGES. The worker sends only what it
  // appended (see `ledgerSince` there — the whole ledger was 81% of a
  // per-tick clone that the owner could feel), so this side keeps the
  // running copy and hands the reassembled world to React. It is still one
  // authority and one read-only snapshot; the snapshot is now built in two
  // pieces instead of shipped whole.
  const ledgerRef = useRef<HeldLedger>({ events: [], causalRecords: [] })

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
      // 'append' extends what we hold; anything else replaces it (a new
      // world, a load, or a compaction that rewrote history). Fresh arrays
      // either way, so nothing downstream can hold a stale reference to the
      // ledger it was given.
      const applied = applyLedgerDelta(ledgerRef.current, response.ledger)

      // A LEDGER THAT DOES NOT ADD UP IS NEVER RENDERED AND NEVER SAVED.
      // The autosave below is built from THIS world, not the worker's, so a
      // desync would be written to IndexedDB within 600ms and become the
      // permanent record. Ask for the whole thing again instead; the cost is
      // one full clone and the alternative is somebody's history quietly
      // going missing.
      if (!applied.intact) {
        ledgerRef.current = { events: [], causalRecords: [] }
        setMessage('Resynchronising the record…')
        workerRef.current?.postMessage({ type: 'resync' } satisfies WorkerRequest)
        return
      }

      // Committed BEFORE setWorld, deliberately: if anything below throws,
      // what we hold is still correct and only the screen is stale.
      ledgerRef.current = applied.held
      const nextWorld: World = {
        ...response.world,
        events: applied.held.events,
        causalRecords: applied.held.causalRecords,
      }
      setWorld(nextWorld)
      setLastElapsedMs(response.elapsedMs)
      setStatus('idle')
      setMessage(response.notice ?? null)

      // AUTOSAVE. A browser tab can be killed without warning, and losing
      // forty simulated years to that is the kind of thing a player does not
      // forgive (R-03). Every world update is written down, debounced so a
      // burst of quick steps becomes one write. toSaveFile is pure and the
      // clone is read-only, so saving off the response is safe.
      // NEVER AUTOSAVE A WORLD WITHOUT ITS LEDGER. This is not theoretical:
      // during development a build briefly saved the ledger-less head the
      // worker sends, a hot reload pushed it into a live session, and the
      // autosave wrote a world with no history at all — which the loader
      // then rightly refused, costing the save. The reassembly above is now
      // the only source of these arrays, so the one cheap check that the
      // result is whole belongs between it and the disk.
      const worldToSave = nextWorld
      if (!Array.isArray(worldToSave.events) || !Array.isArray(worldToSave.causalRecords)) {
        setSaveState('failed')
        setMessage('The record did not come through whole; this month was not saved.')
        return
      }
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
        // A FRESH BOOT IS AMERICAN HEARTLAND (owner, releasing: "the engine
        // starts off as the classic preset and if people don't know how to
        // change they'll play in that one"). Omitting the preset here fell
        // through to Classic in the worker, so every first-time player got
        // the fully fictional Republic without ever being asked. Existing
        // saves are untouched — the load path keeps whatever world the
        // save was made in, because a world's preset is its own (ADR-0020).
        stored === undefined
          ? { type: 'new', seed: initialSeed, presetId: 'american-heartland' }
          : { type: 'load', save: stored }
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
    (seed: number, presetId?: string) => {
      // W2: which world to build. Omitted is Classic, which is what every
      // existing save is and what the first-run world has always been.
      send({ type: 'new', seed, presetId })
    },
    [send],
  )

  const play = useCallback(
    (personId: number | null, heir = false) => {
      send({ type: 'play', personId, heir })
    },
    [send],
  )

  const createLife = useCallback(
    (spec: CreateLifeSpec) => {
      send({ type: 'create-life', spec })
    },
    [send],
  )

  const applyJob = useCallback(
    (occupationId: string) => {
      send({ type: 'apply-job', occupationId })
    },
    [send],
  )

  const requestEnlist = useCallback(() => {
    send({ type: 'request-enlist' })
  }, [send])

  const requestSchool = useCallback(
    (schoolId: string) => {
      send({ type: 'request-school', schoolId })
    },
    [send],
  )

  const tryUnit = useCallback(
    (unitId: string) => {
      send({ type: 'try-unit', unitId })
    },
    [send],
  )

  const requestDeploy = useCallback(() => {
    send({ type: 'request-deploy' })
  }, [send])

  const fitnessTest = useCallback(() => {
    send({ type: 'fitness-test' })
  }, [send])

  const extraDuty = useCallback(() => {
    send({ type: 'extra-duty' })
  }, [send])

  const beBorn = useCallback(
    (
      givenName: string,
      familyName: string,
      sex: 'male' | 'female',
      station: number | null,
      seedNumber: number,
    ) => {
      send({ type: 'be-born', givenName, familyName, sex, station, seedNumber })
    },
    [send],
  )

  const act = useCallback(
    (action: VerbRequest) => {
      send({ type: 'verb', action })
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
    createLife,
    applyJob,
    requestEnlist,
    requestSchool,
    tryUnit,
    requestDeploy,
    fitnessTest,
    extraDuty,
    beBorn,
    act,
    choose,
    save,
    discardSave,
  }
}
