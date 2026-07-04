// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Proves the Biome dependency-direction boundary is a FAILING rule, not a memo.
// A deliberately-planted back-edge — `core` importing the CLI shell (`actlint`) — must trip
// `lint/nursery/noRestrictedImports`. We plant a probe file under packages/core/src (so the
// per-package override matches), run Biome on it, and assert it fails; the probe is always
// removed in `finally`.

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const biomeBin = join(process.cwd(), 'node_modules', '.bin', 'biome');

interface BiomeRun {
  readonly exitCode: number;
  readonly output: string;
}

function runBiomeCheck(relativeFile: string): BiomeRun {
  try {
    const stdout = execFileSync(biomeBin, ['check', relativeFile], { encoding: 'utf8' });
    return { exitCode: 0, output: stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('biome dependency-direction boundary', () => {
  it('fails on a planted back-edge (core importing the CLI shell)', () => {
    const rel = join('packages', 'core', 'src', '__boundary_probe__.ts');
    const abs = join(process.cwd(), rel);
    try {
      writeFileSync(abs, "// planted back-edge probe\nimport 'actlint';\nexport const probe = 1;\n");
      const run = runBiomeCheck(rel);
      expect(run.exitCode).not.toBe(0);
      expect(run.output).toContain('noRestrictedImports');
    } finally {
      rmSync(abs, { force: true });
    }
  });

  it('passes on a legal edge (core importing vocabulary)', () => {
    const rel = join('packages', 'core', 'src', '__boundary_probe_ok__.ts');
    const abs = join(process.cwd(), rel);
    try {
      writeFileSync(
        abs,
        "// legal downstream edge\nimport { VOCABULARY_PACKAGE } from '@formael/action-risk-vocabulary';\nexport const probe = VOCABULARY_PACKAGE;\n",
      );
      const run = runBiomeCheck(rel);
      expect(run.exitCode).toBe(0);
    } finally {
      rmSync(abs, { force: true });
    }
  });
});
