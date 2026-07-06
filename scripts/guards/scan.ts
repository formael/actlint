// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Shared scanning primitives for the static guards.
//
// These guards are build tooling, not part of the pure core, so they may touch the
// filesystem freely. They are deliberately dependency-free: the guards must run before
// any package is built.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** A single guard violation: enough context to locate and understand it. */
export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly detail: string;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '__fixtures__']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];

/** Recursively list source files under `root`, skipping build output and vendored code. */
export function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, out);
  return out.sort();
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // A configured root may not exist yet (e.g. a package not yet created).
    return;
  }
  for (const entry of entries.sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
}

/** Read a source file as UTF-8 text. Guards inspect source as text; they never import it. */
export function readSource(file: string): string {
  return readFileSync(file, 'utf8');
}

/** The line number (1-based) at a character offset, for human-readable violation output. */
export function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

const IMPORT_PATTERNS: readonly RegExp[] = [
  // import ... from 'x'  /  import 'x'
  /import\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // export ... from 'x'
  /export\s+(?:\*|\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // import('x')  /  require('x')
  /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** An import/export/require module specifier and the line it appears on. */
export interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

/** Extract every module specifier referenced by `source`. */
export function extractImports(source: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match !== null) {
      const specifier = match[1];
      if (specifier !== undefined) {
        refs.push({ specifier, line: lineAt(source, match.index) });
      }
      match = pattern.exec(source);
    }
  }
  return refs;
}
