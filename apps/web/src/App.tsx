import { useMemo, useState } from 'react'
import {
  advanceTicks,
  ageAt,
  createWorld,
  formatYear,
  lifeStory,
  livingPeople,
  personSummary,
  worldHashHex,
} from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'

/**
 * CROSS-ENVIRONMENT DETERMINISM CHECK.
 *
 * This constant is the same fingerprint committed in
 * packages/engine/test/determinism.test.ts, which runs under Node. Recomputing
 * it here proves the simulation produces byte-identical results in a real
 * browser as well.
 *
 * It is the only check that catches a banned Math.sin/cos/pow slipping into
 * engine code: ECMAScript leaves those functions' precision
 * implementation-defined, so a simulation can reproduce perfectly under Node
 * and still diverge in a browser. Keep these two values in step.
 */
const GOLDEN_SEED = 12345
const GOLDEN_TICKS = 120
const GOLDEN_HASH_HEX = 'd5a213eb'

function buildWorld(seed: number, ticks: number): World {
  const world = createWorld(makeSeed(seed))
  advanceTicks(world, ticks)
  return world
}

export function App() {
  const [seedInput, setSeedInput] = useState(String(GOLDEN_SEED))
  const [years, setYears] = useState(10)
  const [selected, setSelected] = useState<EntityId | null>(null)

  const seedValue = Number.parseInt(seedInput, 10)
  const validSeed = Number.isInteger(seedValue)

  const world = useMemo(
    () => (validSeed ? buildWorld(seedValue, years * 12) : null),
    [seedValue, years, validSeed],
  )

  // Recomputed under the reference conditions so the check is meaningful even
  // when the user is exploring a different seed.
  const determinismOk = useMemo(
    () => worldHashHex(buildWorld(GOLDEN_SEED, GOLDEN_TICKS)) === GOLDEN_HASH_HEX,
    [],
  )

  const people = world ? livingPeople(world) : []
  const dead = world ? [...world.people.values()].filter((p) => p.deathTick !== null) : []

  return (
    <main>
      <h1>The Life Simulator</h1>
      <p className="phase">Milestone 1 — the simulation runs. No interface work yet.</p>

      <p className={determinismOk ? 'check ok' : 'check bad'}>
        {determinismOk
          ? `Determinism check passed in this browser (${GOLDEN_HASH_HEX}).`
          : 'DETERMINISM CHECK FAILED — this browser produced a different world from Node.'}
      </p>

      <section>
        <h2>World</h2>
        <div className="controls">
          <label>
            Seed
            <input
              value={seedInput}
              onChange={(e) => {
                setSeedInput(e.target.value)
                setSelected(null)
              }}
              inputMode="numeric"
            />
          </label>
          <label>
            Years simulated: {years}
            <input
              type="range"
              min={1}
              max={40}
              value={years}
              onChange={(e) => {
                setYears(Number(e.target.value))
                setSelected(null)
              }}
            />
          </label>
        </div>

        {!validSeed && <p className="note">Enter a whole number for the seed.</p>}

        {world && (
          <p className="summary">
            {world.town.name}, {formatYear(world.tick)} — {people.length} living,{' '}
            {dead.length} died, {world.events.length} events recorded,{' '}
            {world.causalRecords.length} explained decisions.
          </p>
        )}
      </section>

      {world && (
        <section>
          <h2>People</h2>
          <ul className="people">
            {people
              .filter((p) => ageAt(p.birthTick, world.tick) >= 16)
              .slice(0, 40)
              .map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className={selected === person.id ? 'selected' : ''}
                    onClick={() => setSelected(person.id === selected ? null : person.id)}
                  >
                    {personSummary(world, person.id)}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {world && selected !== null && (
        <section>
          <h2>Life</h2>
          <pre className="story">{lifeStory(world, selected)}</pre>
        </section>
      )}

      <p className="note">
        The engine holds all simulation state. This page only renders it and sends
        commands — it stores nothing the engine does not have.
      </p>
    </main>
  )
}
