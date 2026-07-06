// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The SDK-boundary guard.
//
// The MCP SDK is the wire format's shape. It is allowed to exist in exactly one place —
// packages/mcp-fetch, the sole impurity — so SDK types never leak past the anti-corruption
// boundary into the pure engine. Everywhere else, an SDK import is a build failure.

import { extractImports, listSourceFiles, readSource, type Violation } from './scan';

export const SDK_SPECIFIER_PREFIX = '@modelcontextprotocol/sdk';

/** Every package's source EXCEPT mcp-fetch, which is the one place the SDK may appear. */
export const SDK_FORBIDDEN_ROOTS: readonly string[] = [
  'packages/core/src',
  'packages/vocabulary/src',
  'packages/reporters/src',
  'packages/cli/src',
];

/** Scan the given roots for MCP SDK imports. Any hit is a violation. */
export function checkSdkBoundary(roots: readonly string[] = SDK_FORBIDDEN_ROOTS): Violation[] {
  const violations: Violation[] = [];
  for (const root of roots) {
    for (const file of listSourceFiles(root)) {
      const source = readSource(file);
      for (const ref of extractImports(source)) {
        if (ref.specifier === SDK_SPECIFIER_PREFIX || ref.specifier.startsWith(`${SDK_SPECIFIER_PREFIX}/`)) {
          violations.push({
            file,
            line: ref.line,
            rule: 'sdk-boundary',
            detail: `imports '${ref.specifier}' — the MCP SDK may appear ONLY in packages/mcp-fetch`,
          });
        }
      }
    }
  }
  return violations;
}
