import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Simulation tests grow whole centuries of world history, and under full-
    // suite parallel load the big ones brush the 5s default. The limit is for
    // hangs, not for honest work. Raised 60s → 300s at D2: the town GROWS
    // now, and per-tick work that scales with people and edges makes
    // two-century tests several times slower at 200+ people. (Third
    // occurrence of the timeouts-not-drift lesson.) PROFILED at P2 entry:
    // partnerOf/spouseOf's per-call graph re-sort was 86% of tick time on a
    // 150-year town; fixed with a sort-free scan (byte-identical, ~10x).
    // The O(n²) friendship loop measured 2.3% at that scale — the cohort
    // index stays deferred until measurement justifies it.
    // RAISED from 300s. Set when the suite was 890 tests and ~450s; it is
    // 956 and ~820s now, and the long sweeps — two centuries of war, a
    // forty-year capture study — legitimately exceed five minutes when
    // sixteen workers are competing for the box. They passed alone and
    // failed in the suite, which is a false negative, not a slow test.
    // A genuinely hung test still fails; it just fails at fifteen minutes.
    /**
     * CAP THE WORKERS INSTEAD OF RAISING THE LIMIT AGAIN.
     *
     * The note above has been rewritten three times, each time raising the
     * timeout because "they passed alone and failed in the suite". That is
     * the right diagnosis and the wrong lever: the number being exceeded is
     * WALL CLOCK, and wall clock on an over-subscribed box is mostly waiting.
     * Raising the ceiling makes a slow suite slower to fail without making
     * any test finish sooner.
     *
     * MEASURED 2026-08-20. The suite was green at 30.2 minutes, then came
     * back at 63, 61 and 63 with seven or eight heavy tests timing out — and
     * the engine was provably unchanged across all of it: three probes at
     * the failing shape (a 140-person world run 600 ticks) gave identical
     * population, identical event counts and ~13s either side of every
     * suspect change. One of those tests reports 3,118,226ms of wall clock
     * for work the engine does in seconds. That gap is queueing, not
     * simulation.
     *
     * Vitest defaults to about `cores - 2` workers; this box has 14 cores
     * and the heavy files are the ones that collide. Six leaves the machine
     * room to answer, which is what keeps a wall-clock number honest.
     */
    maxWorkers: 6,
    testTimeout: 900_000,
    // beforeAll hooks grow whole centuries too; same reasoning, same limit.
    hookTimeout: 900_000,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
})
