import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Simulation tests grow whole centuries of world history, and under full-
    // suite parallel load the big ones brush the 5s default. The limit is for
    // hangs, not for honest work: 60s catches a stuck loop just as well.
    testTimeout: 60_000,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
})
