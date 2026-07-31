import { defineConfig } from 'vitest/config'

/**
 * Benchmarks run separately from the test suite: they take minutes, and a slow
 * `npm test` is a test suite that stops being run.
 *
 * The benchmark enables --expose-gc from inside the process (see
 * performance.bench.ts) rather than relying on a runner flag, so heap figures
 * measure retained memory rather than uncollected garbage regardless of how
 * vitest was invoked. Vitest 4 removed the pool option that used to pass it.
 */
export default defineConfig({
  test: {
    include: ['packages/**/*.bench.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 20 * 60 * 1000,
  },
})
