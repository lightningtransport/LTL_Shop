import { defineConfig } from 'vitest/config';
import MatrixReporter from './test-real/matrix-reporter';

// Flow tests against the real API and a local Postgres (docs/OPEN_ISSUES.md §0).
// `npm test` never runs these: vitest.config.ts only includes src/**/*.spec.ts.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test-real/rows/**/*.real.spec.ts'],
    globalSetup: ['./test-real/global-setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['default', new MatrixReporter()],
  },
});
