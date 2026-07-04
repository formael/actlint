// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import type { Options } from 'tsup';

// Shared per-package build preset: ESM + type declarations, dual output, zero-config.
// Standalone-binary bundling is deferred.
export function definePackageBuild(overrides: Partial<Options> = {}): Options {
  return {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'dist',
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    ...overrides,
  };
}
