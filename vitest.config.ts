import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Simulation tests grow whole centuries of world history, and under full-
    // suite parallel load the big ones brush the 5s default. The limit is for
    // hangs, not for honest work. Raised 60s → 300s at D2: the town GROWS
    // now, and per-tick work that scales with people and edges makes
    // two-century tests several times slower at 200+ people. (Third
    // occurrence of the timeouts-not-drift lesson. PROFILE before fixing —
    // review evidence points at partnerOf's per-call graph re-sort at
    // least as much as the O(n²) friendship loop; the cohort index is the
    // queued cure for the latter.)
    testTimeout: 300_000,
    // beforeAll hooks grow whole centuries too; same reasoning, same limit.
    hookTimeout: 300_000,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
})
