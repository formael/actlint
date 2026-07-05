// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The vocabulary-data guard.
//
// packages/vocabulary is the tool's JUDGMENT, and it must stay pure data + validators. The moment
// scoring, schema-walking, or dimension composition leaks into it, the "judgment is data, mechanism
// is code" separation — the thing that makes the judgment auditable — quietly breaks. This guard
// refuses any exported function in the package other than the small, named validator surface.

import { type Violation, extractImports, lineAt, listSourceFiles, readSource } from './scan';

export const VOCABULARY_ROOT = 'packages/vocabulary/src';

// The only executable exports the data package is allowed: validators over the data shape. Anything
// that scores, walks, or composes belongs in packages/core.
export const ALLOWED_EXPORTED_FUNCTIONS: ReadonlySet<string> = new Set([
  'parseVocabulary',
  'parseMcpMapping',
  'parseCrosswalk',
  'parseSeverityPolicy',
]);

// The base data layer depends on nothing internal; an @formael/* import would be a back-edge.
const INTERNAL_IMPORT_PREFIX = '@formael/';

const EXPORTED_FUNCTION_PATTERNS: readonly RegExp[] = [
  // export function foo(   /   export async function foo(
  /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
  // export const foo = (...) =>   /   export const foo: T = async (...) =>
  /export\s+const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]*?)?=>/g,
  // export const foo = function
  /export\s+const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s+)?function\b/g,
];

/** Scan the vocabulary package's shipped source for mechanism. Pure over its file inputs. */
export function checkVocabularyData(roots: readonly string[] = [VOCABULARY_ROOT]): Violation[] {
  const violations: Violation[] = [];
  for (const root of roots) {
    for (const file of listSourceFiles(root)) {
      if (file.endsWith('.test.ts')) continue; // tests are not shipped and may hold helpers
      const source = readSource(file);

      for (const ref of extractImports(source)) {
        if (ref.specifier.startsWith(INTERNAL_IMPORT_PREFIX)) {
          violations.push({
            file,
            line: ref.line,
            rule: 'vocabulary-no-implementation',
            detail: `imports '${ref.specifier}' — vocabulary is the base data layer and must depend on nothing internal`,
          });
        }
      }

      for (const pattern of EXPORTED_FUNCTION_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null = pattern.exec(source);
        while (match !== null) {
          const name = match[1];
          if (name !== undefined && !ALLOWED_EXPORTED_FUNCTIONS.has(name)) {
            violations.push({
              file,
              line: lineAt(source, match.index),
              rule: 'vocabulary-no-implementation',
              detail: `exports function '${name}' — packages/vocabulary is pure data + validators; scoring, walking, and composition belong in packages/core`,
            });
          }
          match = pattern.exec(source);
        }
      }
    }
  }
  return violations;
}
