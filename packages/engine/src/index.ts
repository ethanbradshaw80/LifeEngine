/**
 * The Life Engine — public surface.
 *
 * PURITY RULE (CLAUDE.md §6, ADR-0003):
 * This package may import from @life-engine/shared and nothing else.
 * No React. No DOM. No window, document, localStorage, fetch.
 * No clock, no timers, no storage, no network, no randomness of its own.
 *
 * The engine is a pure function of (state, seed, inputs) -> new state.
 * Everything that touches the outside world lives in apps/web.
 *
 * This rule is enforced automatically by test/purity.test.ts.
 */

/**
 * Simulation behaviour version. Increments whenever a change alters simulation
 * results. Saves record this so it is always knowable whether a save was made
 * by a version that would produce different outcomes. See docs/DETERMINISM.md §7.
 */
export const SIMULATION_VERSION = 1

/** Save schema version. Increments when the persisted shape changes. */
export const SCHEMA_VERSION = 1
