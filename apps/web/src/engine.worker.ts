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
 * AUTHORITY: this worker owns the world. The main thread holds a read-only
 * RECONSTRUCTION of it — everything but the ledger arrives whole on every
 * message, and the ledger is accumulated across messages because re-sending
 * all of history to report a handful of new rows was most of what advancing
 * a month cost (see ledgerdelta.ts). There are still not two copies of the
 * truth: only messages sent back here change anything, and the tracker in
 * ledgerdelta.ts is what makes the reconstruction equal to the original —
 * checked on arrival rather than argued for, because a mistake there is
 * written into the autosave and becomes the permanent record.
 */

import {
  advanceTicks,
  applyForJob,
  askForRaise,
  bankTransfer,
  borrowPlayer,
  buyHomePlayer,
  divestPlayer,
  investPlayer,
  chooseSpendStance,
  courtFriend,
  createCustomLife,
  createWorld,
  specById,
  endCourtship,
  lookForPlace,
  propose,
  quitJob,
  requestDeployment,
  commitOffence,
  petitionForExpungement,
  playerPerson,
  requestDischarge,
  requestEnlistment,
  requestEnrolment,
  requestSchool,
  resolvePending,
  setConvalescenceStance,
  setPlayer,
  SIMULATION_VERSION,
  spendTimeWith,
  tendTheMarriage,
  trainFitness,
  tryForChild,
  tryOutForUnit,
  walkOut,
} from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { createLedgerTracker } from './ledgerdelta.js'
import type { LedgerDelta } from './ledgerdelta.js'
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

/**
 * P2: one message for every player-initiated verb. Each engine verb returns
 * { <did-it>: boolean, reason }, so a single dispatch handles the lot; the
 * refusal travels back as the notice either way.
 */
export type VerbRequest =
  | { readonly verb: 'court'; readonly otherId: number }
  | { readonly verb: 'propose' }
  | { readonly verb: 'end-courtship' }
  | { readonly verb: 'tend-marriage' }
  | { readonly verb: 'spend-time'; readonly otherId: number }
  | { readonly verb: 'try-for-child' }
  | { readonly verb: 'walk-out' }
  | { readonly verb: 'quit-job' }
  | { readonly verb: 'ask-raise' }
  | { readonly verb: 're-enrol'; readonly level: 'college' | 'trade' }
  | { readonly verb: 'spend-stance'; readonly stance: 'thrifty' | 'loose' | null }
  | { readonly verb: 'look-for-place'; readonly placeId: number }
  | { readonly verb: 'convalesce-stance'; readonly rest: boolean }
  | { readonly verb: 'request-discharge' }
  | { readonly verb: 'commit-offence'; readonly offenceId: string }
  | { readonly verb: 'petition-expungement' }
  | { readonly verb: 'bank-deposit'; readonly cents: number }
  | { readonly verb: 'bank-withdraw'; readonly cents: number }
  | { readonly verb: 'invest'; readonly sectorId: string; readonly cents: number; readonly retirement: boolean }
  | { readonly verb: 'divest'; readonly sectorId: string; readonly retirement: boolean }
  | { readonly verb: 'borrow'; readonly kind: 'personal' | 'auto' | 'mortgage'; readonly cents: number }
  | { readonly verb: 'buy-home' }

export type WorkerRequest =
  | {
      readonly type: 'new'
      readonly seed: number
      /** W1: which preset builds the world. Omitted means Classic — the only
       *  one that ships today, and the one every older save is. */
      readonly presetId?: string | undefined
    }
  | { readonly type: 'advance'; readonly months: number }
  | { readonly type: 'load'; readonly save: unknown }
  | { readonly type: 'play'; readonly personId: number | null; readonly heir?: boolean }
  | { readonly type: 'choose'; readonly choice: string }
  | { readonly type: 'create-life'; readonly spec: CreateLifeSpec }
  | { readonly type: 'apply-job'; readonly occupationId: string }
  | { readonly type: 'request-enlist' }
  | { readonly type: 'request-school'; readonly schoolId: string }
  | { readonly type: 'try-unit'; readonly unitId: string }
  | { readonly type: 'request-deploy' }
  | { readonly type: 'fitness-test' }
  /** The main thread's ledger does not match; send the whole thing again. */
  | { readonly type: 'resync' }
  | { readonly type: 'verb'; readonly action: VerbRequest }

/** The world without its ledger — everything else the UI renders from. */
export type WorldHead = Omit<World, 'events' | 'causalRecords'>

export type WorkerResponse =
  | {
      readonly type: 'world'
      readonly world: WorldHead
      /** Only what the main thread has not been sent — see ledgerdelta.ts. */
      readonly ledger: LedgerDelta
      /** Milliseconds the simulation itself took, for the performance budget. */
      readonly elapsedMs: number
      readonly notice?: string
    }
  | { readonly type: 'error'; readonly message: string }

let world: World | null = null

/** What this main thread has been sent, so only the tail crosses the wire. */
const ledger = createLedgerTracker()

function resetLedgerTracking(): void {
  ledger.reset()
}

function post(response: WorkerResponse): void {
  self.postMessage(response)
}

function send(elapsedMs: number, notice?: string): void {
  if (!world) {
    post({ type: 'error', message: 'No world exists yet.' })
    return
  }
  // A World is structured-cloneable: Maps, arrays, plain objects, numbers and
  // strings. No serialization step is needed to cross this boundary — but the
  // ledger is not re-sent, only extended: it was the majority of this clone
  // (docs/PERFORMANCE_BASELINE.md, "Render snapshot cost").
  const delta = ledger.since(world)
  const { events: _events, causalRecords: _records, ...head } = world
  post(
    notice === undefined
      ? { type: 'world', world: head, ledger: delta, elapsedMs }
      : { type: 'world', world: head, ledger: delta, elapsedMs, notice },
  )
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    switch (request.type) {
      case 'new': {
        const started = performance.now()
        // specById is total, so an unknown preset makes a Classic world
        // rather than a dead worker (WORLD_MODES_PLAN resistance 2).
        world = createWorld(makeSeed(request.seed), undefined, specById(request.presetId))
        // A different world entirely: whatever ledger the main thread holds
        // belongs to a town that no longer exists.
        resetLedgerTracking()
        send(performance.now() - started)
        return
      }

      case 'resync': {
        if (!world) {
          post({ type: 'error', message: 'No world to resynchronise.' })
          return
        }
        ledger.reset()
        send(0)
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

      case 'request-school': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        const result = requestSchool(world, request.schoolId)
        send(0, result.attended ? undefined : result.reason)
        return
      }

      case 'try-unit': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        // Selection opens a cutscene now rather than answering at once,
        // so an empty reason means "it began", not "it failed".
        const result = tryOutForUnit(world, request.unitId)
        send(0, result.reason === '' ? undefined : result.reason)
        return
      }

      case 'request-deploy': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        const result = requestDeployment(world)
        send(0, result.deployed ? undefined : result.reason)
        return
      }

      case 'fitness-test': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        const result = trainFitness(world)
        send(0, result.trained ? undefined : result.reason)
        return
      }

      case 'verb': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        const a = request.action
        let outcome: { ok: boolean; reason: string }
        switch (a.verb) {
          case 'court': {
            const r = courtFriend(world, a.otherId as EntityId)
            outcome = { ok: r.courting, reason: r.reason }
            break
          }
          case 'propose': {
            const r = propose(world)
            outcome = { ok: r.married, reason: r.reason }
            break
          }
          case 'end-courtship': {
            const r = endCourtship(world)
            outcome = { ok: r.ended, reason: r.reason }
            break
          }
          case 'tend-marriage': {
            const r = tendTheMarriage(world)
            outcome = { ok: r.tended, reason: r.reason }
            break
          }
          case 'spend-time': {
            const r = spendTimeWith(world, a.otherId as EntityId)
            outcome = { ok: r.spent, reason: r.reason }
            break
          }
          case 'try-for-child': {
            const r = tryForChild(world)
            // "Not this month." is an answer, not an error — it still travels
            // as the notice, like every refusal.
            outcome = { ok: r.conceived, reason: r.reason }
            break
          }
          case 'walk-out': {
            const r = walkOut(world)
            outcome = { ok: r.separated, reason: r.reason }
            break
          }
          case 'quit-job': {
            const r = quitJob(world)
            outcome = { ok: r.quit, reason: r.reason }
            break
          }
          case 'ask-raise': {
            const r = askForRaise(world)
            outcome = { ok: r.raised, reason: r.reason }
            break
          }
          case 're-enrol': {
            const r = requestEnrolment(world, a.level)
            outcome = { ok: r.enrolled, reason: r.reason }
            break
          }
          case 'spend-stance': {
            const r = chooseSpendStance(world, a.stance)
            outcome = { ok: r.set, reason: r.reason }
            break
          }
          case 'look-for-place': {
            const r = lookForPlace(world, a.placeId as EntityId)
            outcome = { ok: r.moved, reason: r.reason }
            break
          }
          case 'convalesce-stance': {
            const r = setConvalescenceStance(world, a.rest)
            outcome = { ok: r.set, reason: r.reason }
            break
          }
          case 'request-discharge': {
            const r = requestDischarge(world)
            outcome = { ok: r.discharged, reason: r.reason }
            break
          }
          case 'petition-expungement': {
            const person = playerPerson(world)
            if (!person) {
              outcome = { ok: false, reason: 'Nobody is being played.' }
              break
            }
            const r = petitionForExpungement(world, person.id, world.tick)
            outcome = {
              ok: r.sealed > 0,
              reason: r.reason === '' ? 'The court sealed nothing.' : r.reason,
            }
            break
          }
          case 'bank-deposit': {
            const r = bankTransfer(world, a.cents, true)
            outcome = { ok: r.moved, reason: r.reason }
            break
          }
          case 'bank-withdraw': {
            const r = bankTransfer(world, a.cents, false)
            outcome = { ok: r.moved, reason: r.reason }
            break
          }
          case 'invest': {
            const r = investPlayer(world, a.sectorId, a.cents, a.retirement)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'divest': {
            const r = divestPlayer(world, a.sectorId, a.retirement)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'borrow': {
            const r = borrowPlayer(world, a.kind, a.cents)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'buy-home': {
            const r = buyHomePlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'commit-offence': {
            const person = playerPerson(world)
            if (!person) {
              outcome = { ok: false, reason: 'Nobody is being played.' }
              break
            }
            const r = commitOffence(world, world.tick, person, a.offenceId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
        }
        send(0, outcome.ok ? undefined : outcome.reason)
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
        resetLedgerTracking()

        // Both of these are told to the player rather than hidden. A migrated
        // save and a simulation-version change can both alter future results,
        // and discovering that silently is worse than being warned.
        const notes: string[] = []
        if (result.migrationsApplied.length > 0) {
          notes.push(`Save updated from an older format (${result.migrationsApplied.join('; ')}).`)
        }
        if (result.presetUnknown) {
          notes.push(
            `This world was made with a setting this version does not have (${result.header.presetId}), so it is running on the Classic one. Names, services and foreign nations from here on will be Classic's.`,
          )
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
    //
    // AND THE LEDGER BOOKKEEPING IS ABANDONED. `since()` marks entries as
    // sent before `post` delivers them, so a throw anywhere after that point
    // — a DataCloneError being the realistic one — would leave the tracker
    // believing the main thread holds rows it never received. Every later
    // append would then come from the wrong offset, and the gap is invisible
    // to the prefix check because the tracker's own bookkeeping stays
    // self-consistent. Forgetting what was sent costs one full ledger on the
    // next message and cannot be wrong.
    ledger.reset()
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong in the simulation.',
    })
  }
}
