import { useMemo, useState } from 'react'
import {
  advanceTicks,
  ageAt,
  createWorld,
  formatDate,
  fullName,
  livingPeople,
  personSummary,
  worldHashHex,
} from '@life-engine/engine'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { PersonDetail } from './PersonDetail.js'
import { CharacterPicker, DecisionPrompt, Retrospective } from './PlayerPanel.js'
import { Welcome } from './Welcome.js'
import { GameScreen } from './GameScreen.js'
import { useWorld } from './useWorld.js'

/**
 * CROSS-ENVIRONMENT DETERMINISM CHECK.
 *
 * The same fingerprint committed in packages/engine/test/determinism.test.ts,
 * which runs under Node. Recomputing it here proves the simulation produces
 * byte-identical results in a real browser too.
 *
 * It is the only check that catches a banned Math.sin/cos/pow reaching engine
 * code: ECMAScript leaves those functions' precision implementation-defined, so
 * a simulation can reproduce perfectly under Node and still diverge in a
 * browser. KEEP THIS IN STEP WITH THE TEST.
 */
const GOLDEN_SEED = 12345
const GOLDEN_TICKS = 120
const GOLDEN_HASH_HEX = 'b7c83da6'

type Filter = 'living' | 'working' | 'children' | 'dead'

export function App() {
  const {
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
    choose,
    discardSave,
  } = useWorld(GOLDEN_SEED)
  const [selected, setSelected] = useState<EntityId | null>(null)
  const [filter, setFilter] = useState<Filter>('living')
  const [seedInput, setSeedInput] = useState(String(GOLDEN_SEED))
  // Whether the character picker is open. Pure interface state — what the user
  // is looking at, not a fact about the world.
  const [picking, setPicking] = useState(false)
  // First-run explainer. Seen-ness is a UI preference, not simulation state,
  // so localStorage is the right home for it — the engine never knows.
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('life-sim:welcomed') === null
    } catch {
      return false
    }
  })
  const [confirmingNewWorld, setConfirmingNewWorld] = useState(false)
  // A person being read in an overlay while the game screen is up. Interface
  // state only — closing it changes nothing in the world.
  const [inspecting, setInspecting] = useState<EntityId | null>(null)
  const busy = status === 'working' || status === 'starting'

  function dismissWelcome(): void {
    setShowWelcome(false)
    try {
      window.localStorage.setItem('life-sim:welcomed', '1')
    } catch {
      /* private mode: the sheet simply shows again next visit */
    }
  }

  // Everything below reads the player FROM THE WORLD. The interface never
  // keeps its own idea of who is being played (ADR-0012).
  const playerId = world?.player.personId ?? null
  const playerPerson = playerId === null ? undefined : world?.people.get(playerId)
  const pending = world?.player.pending ?? null
  const playerDead = playerPerson !== undefined && playerPerson.deathTick !== null

  const determinismOk = useMemo(() => {
    const check = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(check, GOLDEN_TICKS)
    return worldHashHex(check) === GOLDEN_HASH_HEX
  }, [])

  // Recomputed whenever the worker sends a new world snapshot.
  const { people, deadCount } = useMemo(() => {
    if (!world) return { people: [], deadCount: 0 }
    const living = livingPeople(world)
    const dead = [...world.people.values()].filter((p) => p.deathTick !== null)

    const shown =
      filter === 'dead'
        ? dead
        : filter === 'working'
          ? living.filter((p) => world.employment.has(p.id))
          : filter === 'children'
            ? living.filter((p) => ageAt(p.birthTick, world.tick) < 18)
            : living

    return { people: shown, deadCount: dead.length }
  }, [world, filter])

  const selectedStillKnown = selected !== null && world !== null && world.people.has(selected)

  function applySeed() {
    const value = Number.parseInt(seedInput, 10)
    if (!Number.isInteger(value)) return
    setSelected(null)
    newWorld(value)
  }

  // No world: either still starting, or a load failed.
  //
  // The recovery controls matter more than they look. A damaged save is
  // correctly refused, but without a way out the player is left staring at an
  // error with a dead app and no button to press. Found by deliberately
  // corrupting a save and reloading — reasoning about it would not have caught
  // it, because the failure only appears when there is no world to render.
  if (!world) {
    const failed = status === 'error'
    return (
      <div className="app">
        <header className="topbar">
          <h1>The Life Simulator</h1>
        </header>

        {failed ? (
          <>
            <p className="banner bad">{message ?? 'The saved game could not be opened.'}</p>
            <section className="controls">
              <button type="button" className="primary" onClick={() => newWorld(GOLDEN_SEED)}>
                Start a new world
              </button>
              <button type="button" onClick={discardSave}>
                Delete the damaged save
              </button>
            </section>
            <p className="pad muted small">
              Starting a new world leaves the damaged save untouched, in case a
              later version of the game can read it.
            </p>
          </>
        ) : (
          <p className="pad muted">Starting the simulation…</p>
        )}
      </div>
    )
  }

  if (playerPerson && !playerDead) {
    return (
      <div className="game-root">
        <GameScreen
          world={world}
          person={playerPerson}
          busy={busy}
          onAdvance={advance}
          onStop={() => play(null)}
          onInspect={setInspecting}
          onApplyJob={applyJob}
          onRequestEnlist={requestEnlist}
          onRequestSchool={requestSchool}
          onTryUnit={tryUnit}
          onRequestDeploy={requestDeploy}
          onFitnessTest={fitnessTest}
          notice={message}
        />

        {pending !== null && !busy && (
          <DecisionPrompt world={world} pending={pending} onChoose={choose} />
        )}

        {inspecting !== null && world.people.has(inspecting) && (
          <div className="overlay" role="dialog" aria-modal="true" aria-label="About this person">
            <div className="sheet wide">
              <PersonDetail world={world} personId={inspecting} onSelect={setInspecting} />
              <div className="sheet-actions">
                <button type="button" onClick={() => setInspecting(null)}>
                  Back to your life
                </button>
              </div>
            </div>
          </div>
        )}

        {showWelcome && !busy && (
          <Welcome onLiveALife={dismissWelcome} onWatch={dismissWelcome} />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>The Life Simulator</h1>
          <p className="date">
            {world.town.name} · {formatDate(world.tick)}
          </p>
        </div>
        {playerPerson && (
          <button
            type="button"
            className={playerDead ? 'player-chip dead' : 'player-chip'}
            onClick={() => setSelected(playerPerson.id)}
            title="Show my life"
          >
            ▶ {fullName(playerPerson)}
            {!playerDead && `, ${ageAt(playerPerson.birthTick, world.tick)}`}
          </button>
        )}
        <button
          type="button"
          className="help"
          title="What is this?"
          aria-label="What is this?"
          onClick={() => setShowWelcome(true)}
        >
          ?
        </button>
        <div className="stats">
          <span>
            <strong>{livingPeople(world).length}</strong> living
          </span>
          <span>
            <strong>{deadCount}</strong> died
          </span>
          <span>
            <strong>{world.causalRecords.length}</strong> decisions explained
          </span>
        </div>
      </header>

      <section className="controls" aria-label="Time controls">
        <button type="button" disabled={busy} onClick={() => advance(1)}>
          + 1 month
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => advance(12)}>
          + 1 year
        </button>
        <button type="button" disabled={busy} onClick={() => advance(60)}>
          + 5 years
        </button>
        <button type="button" disabled={busy} onClick={() => advance(600)}>
          + 50 years
        </button>

        <span className="spacer" />

        {playerId === null ? (
          <button type="button" className="primary" disabled={busy} onClick={() => setPicking(true)}>
            Live a life
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => play(null)}>
            Stop playing
          </button>
        )}
        <span className="savestate" title="The world saves itself in this browser">
          {saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
        <label className="seed">
          Seed
          <input
            value={seedInput}
            inputMode="numeric"
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setConfirmingNewWorld(true)
            }}
          />
        </label>
        {confirmingNewWorld ? (
          <span className="confirm">
            Replace this world and its history?
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                setConfirmingNewWorld(false)
                applySeed()
              }}
            >
              Yes, start over
            </button>
            <button type="button" onClick={() => setConfirmingNewWorld(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirmingNewWorld(true)}>
            New world
          </button>
        )}
      </section>

      {busy && (
        <p className="banner working">
          Simulating… the page stays responsive because the engine runs on a
          background thread.
        </p>
      )}
      {message !== null && !busy && (
        <p className={status === 'error' ? 'banner bad' : 'banner notice'}>
          {message}
          {status === 'error' && (
            <button type="button" className="link" onClick={discardSave}>
              delete the saved game
            </button>
          )}
        </p>
      )}

      <div className="columns">
        <section className="list" aria-label="People">
          <div className="filters" role="tablist">
            {(['living', 'working', 'children', 'dead'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {people.length === 0 ? (
            <p className="muted pad">Nobody yet.</p>
          ) : (
            <ul>
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className={selected === person.id ? 'selected' : ''}
                    onClick={() => setSelected(person.id)}
                  >
                    {person.id === playerId ? '▶ ' : ''}
                    {personSummary(world, person.id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="Person detail">
          {selectedStillKnown && selected !== null ? (
            <PersonDetail world={world} personId={selected} onSelect={setSelected} />
          ) : (
            <div className="empty">
              <p>Pick anyone on the left to read their life so far.</p>
              <p className="muted small">
                The town only moves when you advance time. Add a year, watch
                what changes, and click “Why?” on anything that surprises you —
                or press <strong>Live a life</strong> and make the decisions
                yourself.
              </p>
            </div>
          )}
        </section>
      </div>

      {showWelcome && !busy && (
        <Welcome
          onLiveALife={() => {
            dismissWelcome()
            setPicking(true)
          }}
          onWatch={dismissWelcome}
        />
      )}

      {picking && !busy && (
        <CharacterPicker
          world={world}
          onPlay={(id) => {
            setPicking(false)
            setSelected(id)
            play(id)
          }}
          onCreate={(spec) => {
            setPicking(false)
            createLife(spec)
          }}
          onCancel={() => setPicking(false)}
        />
      )}

      {pending !== null && !busy && (
        <DecisionPrompt world={world} pending={pending} onChoose={choose} />
      )}

      {playerDead && playerId !== null && !busy && (
        <Retrospective
          world={world}
          personId={playerId}
          onPlayHeir={(heirId) => {
            setSelected(heirId)
            play(heirId, true)
          }}
          onWatch={() => play(null)}
        />
      )}

      <footer>
        <span className={determinismOk ? 'check ok' : 'check bad'}>
          {determinismOk
            ? `Determinism verified in this browser (${GOLDEN_HASH_HEX})`
            : 'DETERMINISM CHECK FAILED — this browser disagrees with Node'}
        </span>
        <span className="muted small">
          {playerId === null ? 'Watching the town' : 'Living a life'} · engine on a
          worker thread · saves in this browser
          {lastElapsedMs !== null && ` · last step ${lastElapsedMs.toFixed(0)} ms`}
        </span>
      </footer>
    </div>
  )
}
