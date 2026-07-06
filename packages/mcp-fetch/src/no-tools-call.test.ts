// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The lane, made structural. actlint reads a server's tool DECLARATIONS and never invokes a tool:
// there is no `tools/call` code path anywhere in the project, by design and by this test. This is
// the structural expression of "it does not run, route, or block anything."
//
// The scan strips comments first, so documentation is free to name the rule it enforces; only real
// code is checked. The forbidden tokens are assembled from fragments so this file never matches
// itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '__fixtures__']);
const SELF = fileURLToPath(import.meta.url);

// Assembled from fragments so the literals never appear verbatim in this source file.
const CALL_TOOL_METHOD = `call${'Tool'}`; // the SDK method that invokes a tool
const CALL_TOOL_RPC = `tools${'/'}call`; // the JSON-RPC method name

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (full.endsWith('.ts') && full !== SELF) {
      out.push(full);
    }
  }
  return out;
}

describe('no tools/call code path exists', () => {
  const files = listSourceFiles(PACKAGES_DIR);

  it('scans a non-trivial number of source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('finds no tool-invocation call anywhere in packages/*/src', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (code.includes(CALL_TOOL_METHOD) || code.includes(CALL_TOOL_RPC)) {
        offenders.push(file.slice(REPO_ROOT.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
