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
  payOffBankruptcyPlayer,
  buyPropertyPlayer,
  payDownPlayer,
  tryOutPlayer,
  trainPlayer,
  restPlayer,
  acceptOfferPlayer,
  declareForDraftPlayer,
  retirePlayer,
  takeFightPlayer,
  signEndorsementPlayer,
  secondActPlayer,
  buyChipsPlayer,
  cashOutPlayer,
  dealBlackjack,
  fileBAClaim,
  playTablePlayer,
  playPokerPlayer,
  enterTournamentPlayer,
  studyPokerPlayer,
  turnProPlayer,
  seekHelpPlayer,
  scaleUpPlayer,
  hireIntoBusiness,
  raiseCapitalPlayer,
  orderStockPlayer,
  clearStockPlayer,
  switchVendorPlayer,
  haggleVendorPlayer,
  setPricePlayer,
  setRetainPlayer,
  investInBusinessPlayer,
  withdrawFromBusinessPlayer,
  advertisePlayer,
  setLongHoursPlayer,
  setInsurancePlayer,
  chaseDebtsPlayer,
  refitPlayer,
  growBusinessPlayer,
  sellBusinessPlayer,
  windDownPlayer,
  expandBusinessPlayer,
  acquireRivalPlayer,
  letGoFromBusiness,
  takePublicPlayer,
  rentPropertyPlayer,
  seeADoctor,
  sellHomePlayer,
  dropOutPlayer,
  votePlayer,
  standPlayer,
  setLeverPlayer,
  seekPeacePlayer,
  campaignPlayer,
  setHabit,
  startBusiness,
  divestPlayer,
  investPlayer,
  buySharesPlayer,
  sellSharesPlayer,
  chooseSpendStance,
  courtFriend,
  createCustomLife,
  createWorld,
  specById,
  endCourtship,
  lookForPlace,
  moveBackInWithParents,
  refinancePlayer,
  findTenantPlayer,
  endTenancyPlayer,
  moveIntoOwnPlayer,
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
  takeExtraDuty,
  planBirth,
  registerBirth,
  trainFitness,
  tryForChild,
  tryOutForUnit,
  walkOut,
} from '@life-engine/engine'
import type { ExpansionKind, World } from '@life-engine/engine'
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
  | { readonly verb: 'move-in-parents' }
  | { readonly verb: 'refinance' }
  | { readonly verb: 'find-tenant'; readonly propertyId: string }
  | { readonly verb: 'end-tenancy'; readonly propertyId: string }
  | { readonly verb: 'move-into-own'; readonly propertyId: string }
  | { readonly verb: 'convalesce-stance'; readonly rest: boolean }
  | { readonly verb: 'request-discharge' }
  | { readonly verb: 'commit-offence'; readonly offenceId: string }
  | { readonly verb: 'petition-expungement' }
  | { readonly verb: 'bank-deposit'; readonly cents: number }
  | { readonly verb: 'bank-withdraw'; readonly cents: number }
  | { readonly verb: 'invest'; readonly sectorId: string; readonly cents: number; readonly retirement: boolean }
  | { readonly verb: 'buy-shares'; readonly stockId: string; readonly cents: number; readonly retirement: boolean }
  | { readonly verb: 'sell-shares'; readonly stockId: string; readonly retirement: boolean }
  | { readonly verb: 'divest'; readonly sectorId: string; readonly retirement: boolean }
  | { readonly verb: 'borrow'; readonly kind: 'personal' | 'auto' | 'mortgage'; readonly cents: number }
  | { readonly verb: 'buy-home'; readonly method: 'cash' | 'mortgage' }
  | { readonly verb: 'pay-off-plan' }
  | { readonly verb: 'habit'; readonly kind: 'training' | 'study' | 'social'; readonly keep: boolean }
  | { readonly verb: 'doctor' }
  | { readonly verb: 'buy-property'; readonly propertyId: string; readonly method?: 'cash' | 'mortgage' }
  | { readonly verb: 'pay-down'; readonly kind: 'personal' | 'auto' | 'mortgage' | 'student'; readonly cents: number }
  | { readonly verb: 'scale-up' }
  | { readonly verb: 'raise-capital' }
  | { readonly verb: 'order-stock'; readonly months: number }
  | { readonly verb: 'clear-stock' }
  | { readonly verb: 'grow-business'; readonly kind: ExpansionKind }
  | { readonly verb: 'sell-business'; readonly buyerId: number }
  | { readonly verb: 'wind-down' }
  | { readonly verb: 'switch-vendor'; readonly name: string }
  | { readonly verb: 'haggle-vendor' }
  | { readonly verb: 'set-price'; readonly perMille: number }
  | { readonly verb: 'set-retain'; readonly perMille: number }
  | { readonly verb: 'invest-business'; readonly cents: number }
  | { readonly verb: 'withdraw-business'; readonly cents: number }
  | { readonly verb: 'advertise' }
  | { readonly verb: 'long-hours'; readonly on: boolean }
  | { readonly verb: 'insure'; readonly on: boolean }
  | { readonly verb: 'chase-debts' }
  | { readonly verb: 'refit' }
  | { readonly verb: 'expand-business'; readonly kind: ExpansionKind }
  | { readonly verb: 'buy-rival'; readonly rivalId: number }
  | { readonly verb: 'hire-staff'; readonly candidateId: number }
  | { readonly verb: 'let-go'; readonly employeeId: number }
  | { readonly verb: 'buy-chips'; readonly cents: number }
  | { readonly verb: 'cash-out' }
  | { readonly verb: 'deal-blackjack'; readonly wager: number }
  | { readonly verb: 'file-ba-claim' }
  | { readonly verb: 'gamble'; readonly game: 'blackjack' | 'slots'; readonly wager: number; readonly choice: 'hit' | 'stand' | 'double' }
  | { readonly verb: 'poker'; readonly stakeId: string; readonly hours: number }
  | { readonly verb: 'tournament'; readonly tournamentId: string }
  | { readonly verb: 'study-poker' }
  | { readonly verb: 'turn-pro' }
  | { readonly verb: 'seek-help' }
  | { readonly verb: 'try-out'; readonly sport: string; readonly positionId: string }
  | { readonly verb: 'train'; readonly focus: string }
  | { readonly verb: 'rest-up' }
  | { readonly verb: 'take-offer'; readonly offerId: string }
  | { readonly verb: 'declare-draft' }
  | { readonly verb: 'retire-sport' }
  | { readonly verb: 'take-fight' }
  | { readonly verb: 'endorse' }
  | { readonly verb: 'second-act'; readonly actId: string }
  | { readonly verb: 'take-public' }
  | { readonly verb: 'rent-property'; readonly propertyId: string }
  | { readonly verb: 'sell-home' }
  | { readonly verb: 'drop-out' }
  | { readonly verb: 'vote'; readonly officeId: string; readonly forPersonId: number }
  | { readonly verb: 'stand'; readonly officeId: string }
  | { readonly verb: 'set-lever'; readonly lever: string; readonly value: number }
  | { readonly verb: 'seek-peace' }
  | { readonly verb: 'campaign'; readonly officeId: string; readonly action: 'fundraise' | 'rally' | 'advertise' }
  | { readonly verb: 'sell-property'; readonly propertyId: string }
  | { readonly verb: 'start-business'; readonly kindId: string }

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
  | { readonly type: 'extra-duty' }
  | {
      readonly type: 'be-born'
      readonly givenName: string
      readonly familyName: string
      readonly sex: 'male' | 'female'
      readonly station: number | null
      readonly seedNumber: number
    }
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

      case 'be-born': {
        if (!world) {
          post({ type: 'error', message: 'No world to be born into.' })
          return
        }
        // PLAN, THEN REGISTER, THEN PLAY. Three steps because they are
        // three different responsibilities: deciding a family's shape,
        // writing it into a running world, and pointing the camera at the
        // child.
        const plan = planBirth(
          world,
          {
            givenName: request.givenName,
            familyName: request.familyName,
            sex: request.sex,
            placeId: null,
            station: request.station,
            birthTick: null,
          },
          request.seedNumber,
        )
        const childId = registerBirth(world, plan, request.seedNumber)
        if (childId === null) {
          send(0, 'This world could not take a birth.')
          return
        }
        setPlayer(world, childId, false)
        send(0)
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
        send(0, result.applied ? undefined : result.reason)
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

      case 'extra-duty': {
        if (!world) {
          post({ type: 'error', message: 'No world.' })
          return
        }
        const result = takeExtraDuty(world)
        send(0, result.done ? undefined : result.reason)
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
          case 'move-in-parents': {
            const r = moveBackInWithParents(world)
            outcome = { ok: r.moved, reason: r.reason }
            break
          }
          case 'refinance': {
            const r = refinancePlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'find-tenant': {
            const r = findTenantPlayer(world, a.propertyId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'end-tenancy': {
            const r = endTenancyPlayer(world, a.propertyId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'move-into-own': {
            const r = moveIntoOwnPlayer(world, a.propertyId)
            outcome = { ok: r.done, reason: r.reason }
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
          case 'buy-shares': {
            const r = buySharesPlayer(world, a.stockId, a.cents, a.retirement)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'sell-shares': {
            const r = sellSharesPlayer(world, a.stockId, a.retirement)
            outcome = { ok: r.done, reason: r.reason }
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
          case 'habit': {
            const r = setHabit(world, a.kind, a.keep)
            outcome = { ok: r.changed, reason: r.reason }
            break
          }
          case 'buy-chips': {
            const r = buyChipsPlayer(world, a.cents as never)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'cash-out': {
            const r = cashOutPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'file-ba-claim': {
        // The board's answer, in its own words, straight to the toast.
        const r = fileBAClaim(world)
        outcome = { ok: r.done, reason: r.done ? r.words : r.reason }
        break
      }
      case 'deal-blackjack': {
            // THE WAGER BUYS A DEAL, and the hand is played at the table
            // as a pending decision — it is not resolved here.
            const r = dealBlackjack(world, a.wager as never)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'gamble': {
            const r = playTablePlayer(world, a.game, a.wager as never, a.choice)
            outcome = { ok: r.done, reason: r.done && r.result !== null ? r.result.words : r.reason }
            break
          }
          case 'poker': {
            const r = playPokerPlayer(world, a.stakeId, a.hours)
            outcome = { ok: r.done, reason: r.done && r.result !== null ? r.result.words : r.reason }
            break
          }
          case 'tournament': {
            const r = enterTournamentPlayer(world, a.tournamentId)
            outcome = { ok: r.done, reason: r.done && r.result !== null ? r.result.words : r.reason }
            break
          }
          case 'study-poker': {
            const r = studyPokerPlayer(world)
            outcome = { ok: r.done, reason: r.done ? 'Put the hours in away from the table.' : r.reason }
            break
          }
          case 'turn-pro': {
            const r = turnProPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'seek-help': {
            const r = seekHelpPlayer(world)
            outcome = { ok: r.done, reason: r.done ? 'You said it out loud. That is the hard part.' : r.reason }
            break
          }
          case 'try-out': {
            const r = tryOutPlayer(world, a.sport, a.positionId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'train': {
            const r = trainPlayer(world, a.focus)
            outcome = { ok: r.done, reason: r.done ? r.words : r.reason }
            break
          }
          case 'rest-up': {
            const r = restPlayer(world)
            outcome = { ok: r.done, reason: r.done ? 'Rested up.' : r.reason }
            break
          }
          case 'take-offer': {
            const r = acceptOfferPlayer(world, a.offerId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'declare-draft': {
            const r = declareForDraftPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'endorse': {
            const r = signEndorsementPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'second-act': {
            const r = secondActPlayer(world, a.actId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'take-fight': {
            const r = takeFightPlayer(world)
            outcome = { ok: r.done, reason: r.done ? r.words : r.reason }
            break
          }
          case 'retire-sport': {
            const r = retirePlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'buy-rival': {
            const r = acquireRivalPlayer(world, a.rivalId as never)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'expand-business': {
            const r = expandBusinessPlayer(world, a.kind)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'order-stock': { const r = orderStockPlayer(world, a.months); outcome = { ok: r.done, reason: r.reason }; break }
          case 'grow-business': { const r = growBusinessPlayer(world, a.kind as never); outcome = { ok: r.done, reason: r.reason }; break }
          case 'sell-business': { const r = sellBusinessPlayer(world, a.buyerId as never); outcome = { ok: r.done, reason: r.reason }; break }
          case 'wind-down': { const r = windDownPlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'clear-stock': { const r = clearStockPlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'switch-vendor': { const r = switchVendorPlayer(world, a.name); outcome = { ok: r.done, reason: r.reason }; break }
          case 'haggle-vendor': { const r = haggleVendorPlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'set-price': { const r = setPricePlayer(world, a.perMille); outcome = { ok: r.done, reason: r.reason }; break }
          case 'set-retain': { const r = setRetainPlayer(world, a.perMille); outcome = { ok: r.done, reason: r.reason }; break }
          case 'withdraw-business': { const r = withdrawFromBusinessPlayer(world, a.cents); outcome = { ok: r.done, reason: r.reason }; break }
          case 'invest-business': { const r = investInBusinessPlayer(world, a.cents); outcome = { ok: r.done, reason: r.reason }; break }
          case 'advertise': { const r = advertisePlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'long-hours': { const r = setLongHoursPlayer(world, a.on); outcome = { ok: r.done, reason: r.reason }; break }
          case 'insure': { const r = setInsurancePlayer(world, a.on); outcome = { ok: r.done, reason: r.reason }; break }
          case 'chase-debts': { const r = chaseDebtsPlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'refit': { const r = refitPlayer(world); outcome = { ok: r.done, reason: r.reason }; break }
          case 'raise-capital': {
            const r = raiseCapitalPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'hire-staff': {
            const r = hireIntoBusiness(world, a.candidateId as never)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'let-go': {
            const r = letGoFromBusiness(world, a.employeeId as never)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'scale-up': {
            const r = scaleUpPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'take-public': {
            const r = takePublicPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'pay-down': {
            const r = payDownPlayer(world, a.kind, a.cents)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'buy-property': {
            const r = buyPropertyPlayer(world, a.propertyId, a.method ?? 'mortgage')
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'rent-property': {
            const r = rentPropertyPlayer(world, a.propertyId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'sell-property': {
            const r = sellHomePlayer(world, a.propertyId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'seek-peace': {
            const r = seekPeacePlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'set-lever': {
            const r = setLeverPlayer(world, a.lever, a.value)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'stand': {
            const r = standPlayer(world, a.officeId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'campaign': {
            const r = campaignPlayer(world, a.officeId, a.action)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'vote': {
            const r = votePlayer(world, a.officeId, a.forPersonId)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'drop-out': {
            const r = dropOutPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'sell-home': {
            const r = sellHomePlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'doctor': {
            const r = seeADoctor(world)
            outcome = { ok: r.seen, reason: r.reason }
            break
          }
          case 'pay-off-plan': {
            const r = payOffBankruptcyPlayer(world)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'buy-home': {
            const r = buyHomePlayer(world, a.method)
            outcome = { ok: r.done, reason: r.reason }
            break
          }
          case 'start-business': {
            const r = startBusiness(world, a.kindId)
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
        /**
         * SAY WHAT HAPPENED, not only what did not (owner: "make sure when
         * we click on something from the business it actually reports
         * feedback back and not just tap and nothing pops up").
         *
         * This threw away the reason on SUCCESS, so every action that
         * worked was silent and the screen simply redrew. A verb now
         * reports whenever it has something to say; the ones that return
         * an empty reason stay quiet, which is the right default for a
         * toggle nobody needs told about.
         */
        send(0, outcome.reason === '' ? undefined : outcome.reason)
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
