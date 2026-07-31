import { useMemo, useState } from 'react'
import {
  advanceTicks,
  ageAt,
  createWorld,
  formatDate,
  livingPeople,
  personSummary,
  worldHashHex,
} from '@life-engine/engine'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { PersonDetail } from './PersonDetail.js'
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
const GOLDEN_HASH_HEX = 'd5a213eb'

type Filter = 'living' | 'working' | 'children' | 'dead'

export function App() {
  const { world, status, message, lastElapsedMs, saveState, advance, newWorld, save, discardSave } =
    useWorld(GOLDEN_SEED)
  const [selected, setSelected] = useState<EntityId | null>(null)
  const [filter, setFilter] = useState<Filter>('living')
  const [seedInput, setSeedInput] = useState(String(GOLDEN_SEED))
  const busy = status === 'working' || status === 'starting'

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

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>The Life Simulator</h1>
          <p className="date">
            {world.town.name} · {formatDate(world.tick)}
          </p>
        </div>
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

        <button type="button" disabled={busy || saveState === 'saving'} onClick={save}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
        <label className="seed">
          Seed
          <input
            value={seedInput}
            inputMode="numeric"
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySeed()
            }}
          />
        </label>
        <button type="button" disabled={busy} onClick={applySeed}>
          New world
        </button>
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
              <p>Choose someone to read their life.</p>
              <p className="muted small">
                Then advance time and watch what happens to them. Every important
                decision keeps a record of why it was made.
              </p>
            </div>
          )}
        </section>
      </div>

      <footer>
        <span className={determinismOk ? 'check ok' : 'check bad'}>
          {determinismOk
            ? `Determinism verified in this browser (${GOLDEN_HASH_HEX})`
            : 'DETERMINISM CHECK FAILED — this browser disagrees with Node'}
        </span>
        <span className="muted small">
          Milestone 4 · engine on a worker thread · saves in this browser
          {lastElapsedMs !== null && ` · last step ${lastElapsedMs.toFixed(0)} ms`}
        </span>
      </footer>
    </div>
  )
}
