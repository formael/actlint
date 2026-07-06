// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';

// Test harness wiring. fast-check is available for property tests.
// Coverage thresholds are intentionally left unenforced on the skeleton.
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'scripts/**/*.test.ts', 'eval/harness/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__fixtures__/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'scripts/guards/**/*.ts', 'eval/harness/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**', '**/index.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
