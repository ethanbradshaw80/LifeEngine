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
  const { world, version, advance, reset } = useWorld(GOLDEN_SEED)
  const [selected, setSelected] = useState<EntityId | null>(null)
  const [filter, setFilter] = useState<Filter>('living')
  const [seedInput, setSeedInput] = useState(String(GOLDEN_SEED))

  const determinismOk = useMemo(() => {
    const check = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(check, GOLDEN_TICKS)
    return worldHashHex(check) === GOLDEN_HASH_HEX
  }, [])

  // Recomputed whenever the world changes. `version` is a render trigger, not
  // a fact about the world — nothing here is derived from its value.
  const { people, deadCount } = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, version, filter])

  const selectedStillKnown = selected !== null && world.people.has(selected)

  function applySeed() {
    const value = Number.parseInt(seedInput, 10)
    if (!Number.isInteger(value)) return
    setSelected(null)
    reset(value)
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
        <button type="button" onClick={() => advance(1)}>
          + 1 month
        </button>
        <button type="button" className="primary" onClick={() => advance(12)}>
          + 1 year
        </button>
        <button type="button" onClick={() => advance(60)}>
          + 5 years
        </button>

        <span className="spacer" />

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
        <button type="button" onClick={applySeed}>
          New world
        </button>
      </section>

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
          Milestone 2 · the engine holds all state; this page only renders it
        </span>
      </footer>
    </div>
  )
}
