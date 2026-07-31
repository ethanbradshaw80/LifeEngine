import { SCHEMA_VERSION, SIMULATION_VERSION } from '@life-engine/engine'
import { dollars, formatMoney } from '@life-engine/shared'

/**
 * Milestone 0 placeholder.
 *
 * Its only job is to prove the wiring works end to end: the browser loads the
 * app, the app imports the engine and shared packages, and TypeScript resolves
 * across workspace boundaries. No simulation exists yet — that is Milestone 1.
 */
export function App() {
  return (
    <main>
      <h1>The Life Simulator</h1>
      <p className="phase">Milestone 0 — skeleton</p>

      <section>
        <h2>Wiring check</h2>
        <dl>
          <dt>Simulation version</dt>
          <dd>{SIMULATION_VERSION}</dd>
          <dt>Save schema version</dt>
          <dd>{SCHEMA_VERSION}</dd>
          <dt>Shared money type</dt>
          <dd>{formatMoney(dollars(1234))}</dd>
        </dl>
      </section>

      <p className="note">
        No simulation has been implemented. The engine currently exports version
        constants only.
      </p>
    </main>
  )
}
