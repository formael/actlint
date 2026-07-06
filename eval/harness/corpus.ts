// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The corpus loader — the impure edge. Reads the labeled corpus from disk and validates it. This is
// tooling, not the pure core, so it may touch the filesystem freely; the scorer it feeds stays pure.
//
// It enforces the corpus's structural contract at load time, so a drifting corpus fails loudly here
// rather than silently skewing the number: every manifest validates as a ToolManifest, every
// labels.json validates against the label schema, the labels' `server` matches its directory, and
// the labelled tools are exactly the tools in the manifest (no unlabelled tool silently ignored, no
// label pointing at a tool that no longer exists).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ToolManifest, toolManifestSchema } from '@formael/actlint-core';
import { parseServerLabels, type ServerLabels } from './schema.ts';
import { parseThresholds, type Thresholds } from './threshold.ts';

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
export const EVAL_ROOT = join(HARNESS_DIR, '..');
export const CORPUS_DIR = join(EVAL_ROOT, 'corpus');
export const THRESHOLDS_PATH = join(EVAL_ROOT, 'thresholds.json');

/** One corpus server: the captured manifest the linter sees, and the expert labels it is graded on. */
export interface CorpusEntry {
  readonly server: string;
  readonly manifest: ToolManifest;
  readonly labels: ServerLabels;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listServerDirs(root: string): string[] {
  return readdirSync(root)
    .filter((entry) => statSync(join(root, entry)).isDirectory())
    .sort();
}

function assertToolsMatch(server: string, manifest: ToolManifest, labels: ServerLabels): void {
  const manifestNames = new Set(manifest.tools.map((t) => t.name));
  const labelNames = new Set(labels.tools.map((t) => t.name));

  const unlabelled = [...manifestNames].filter((name) => !labelNames.has(name)).sort();
  if (unlabelled.length > 0) {
    throw new Error(`corpus '${server}': manifest tools have no label: ${unlabelled.join(', ')}`);
  }
  const orphaned = [...labelNames].filter((name) => !manifestNames.has(name)).sort();
  if (orphaned.length > 0) {
    throw new Error(`corpus '${server}': labels name tools absent from the manifest: ${orphaned.join(', ')}`);
  }
}

/** Load and validate one corpus server directory. Throws with the server id on any violation. */
export function loadServer(server: string, root: string = CORPUS_DIR): CorpusEntry {
  const dir = join(root, server);
  const manifest = toolManifestSchema.parse(readJson(join(dir, 'manifest.json')));
  const labels = parseServerLabels(readJson(join(dir, 'labels.json')));

  if (labels.server !== server) {
    throw new Error(`corpus '${server}': labels.server is '${labels.server}', expected '${server}'`);
  }
  assertToolsMatch(server, manifest, labels);
  return { server, manifest, labels };
}

/** Load the whole corpus, in a stable directory order. */
export function loadCorpus(root: string = CORPUS_DIR): CorpusEntry[] {
  return listServerDirs(root).map((server) => loadServer(server, root));
}

/** Load the committed merge-gate floors. */
export function loadThresholds(path: string = THRESHOLDS_PATH): Thresholds {
  return parseThresholds(readJson(path));
}
