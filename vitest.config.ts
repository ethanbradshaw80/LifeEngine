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
    testTimeout: 900_000,
    // beforeAll hooks grow whole centuries too; same reasoning, same limit.
    hookTimeout: 900_000,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
})
