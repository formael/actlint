// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The SDK-boundary guard.
//
// The MCP SDK is the wire format's shape. It is allowed to exist in exactly one place —
// packages/mcp-fetch, the sole impurity — so SDK types never leak past the anti-corruption
// boundary into the pure engine. Everywhere else, an SDK import is a build failure.
//
// The rule matches the whole npm scope, not a single package. Any specifier under
// `@modelcontextprotocol/` — the current `sdk`, and any package published in that scope —
// is an MCP SDK import. Unknown packages in the scope resolve to "forbidden outside
// mcp-fetch", the conservative direction. Near-miss names that merely contain the string
// (`@modelcontextprotocols/x`, `modelcontextprotocol-utils`) are not in the scope and pass.

import { extractImports, listSourceFiles, readSource, type Violation } from './scan';

export const SDK_SPECIFIER_SCOPE = '@modelcontextprotocol/';

/** A specifier is an MCP SDK import when it sits under the `@modelcontextprotocol/` scope. */
export function isSdkSpecifier(specifier: string): boolean {
  return specifier.startsWith(SDK_SPECIFIER_SCOPE);
}

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
        if (isSdkSpecifier(ref.specifier)) {
          violations.push({
            file,
            line: ref.line,
            rule: 'sdk-boundary',
            detail: `imports '${ref.specifier}' — MCP SDK packages may appear ONLY in packages/mcp-fetch`,
          });
        }
      }
    }
  }
  return violations;
}
