// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The purity guard.
//
// Determinism is the first invariant: same input => byte-identical findings. It is kept
// structural by refusing, in CI, any import of a clock, network, filesystem, process, or
// randomness source inside the pure packages (core, vocabulary, reporters). This is what keeps
// the purity boundary from eroding one convenient import at a time.

import { extractImports, lineAt, listSourceFiles, readSource, type Violation } from './scan';

/** The pure packages. Nothing here may reach for the world. */
export const PURE_ROOTS: readonly string[] = [
  'packages/core/src',
  'packages/vocabulary/src',
  'packages/reporters/src',
];

// Banned Node builtins, matched on the first path segment after an optional `node:` prefix.
const BANNED_NODE_MODULES = new Set<string>([
  'net',
  'http',
  'http2',
  'https',
  'dns',
  'tls',
  'dgram',
  'fs',
  'child_process',
]);

// Banned ambient reads: the clock and non-deterministic randomness. `node:crypto` itself is
// allowed (content-seeded hashing is deterministic); only its randomness surface is banned.
const BANNED_TOKENS: readonly { readonly pattern: RegExp; readonly detail: string }[] = [
  { pattern: /\bnew\s+Date\b/g, detail: 'clock: `new Date` — findings must not depend on wall-clock time' },
  { pattern: /\bDate\.now\b/g, detail: 'clock: `Date.now` — findings must not depend on wall-clock time' },
  { pattern: /\bperformance\.now\b/g, detail: 'clock: `performance.now` — findings must not depend on time' },
  { pattern: /\bMath\.random\b/g, detail: 'randomness: `Math.random` — findings must be deterministic' },
  {
    pattern: /\bcrypto\.randomUUID\b/g,
    detail: 'randomness: `crypto.randomUUID` — findings must be deterministic',
  },
  {
    pattern: /\bcrypto\.randomBytes\b/g,
    detail: 'randomness: `crypto.randomBytes` — findings must be deterministic',
  },
  { pattern: /\brandomUUID\b/g, detail: 'randomness: `randomUUID` — findings must be deterministic' },
  { pattern: /\brandomBytes\b/g, detail: 'randomness: `randomBytes` — findings must be deterministic' },
  {
    pattern: /\bgetRandomValues\b/g,
    detail: 'randomness: `getRandomValues` — findings must be deterministic',
  },
];

function bannedModule(specifier: string): string | undefined {
  const bare = specifier.replace(/^node:/, '');
  const firstSegment = bare.split('/')[0];
  return firstSegment !== undefined && BANNED_NODE_MODULES.has(firstSegment) ? firstSegment : undefined;
}

/** Scan the given roots for purity violations. Pure over its file inputs; used by the test and the CLI. */
export function checkPurity(roots: readonly string[] = PURE_ROOTS): Violation[] {
  const violations: Violation[] = [];
  for (const root of roots) {
    for (const file of listSourceFiles(root)) {
      const source = readSource(file);

      for (const ref of extractImports(source)) {
        const banned = bannedModule(ref.specifier);
        if (banned !== undefined) {
          violations.push({
            file,
            line: ref.line,
            rule: 'banned-import',
            detail: `imports '${ref.specifier}' — the '${banned}' surface is forbidden in pure packages`,
          });
        }
      }

      for (const { pattern, detail } of BANNED_TOKENS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null = pattern.exec(source);
        while (match !== null) {
          violations.push({ file, line: lineAt(source, match.index), rule: 'banned-token', detail });
          match = pattern.exec(source);
        }
      }
    }
  }
  return violations;
}
