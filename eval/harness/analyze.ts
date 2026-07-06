// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Running the pure core over the corpus — the step that produces the findings the scorer grades.
// This is a pure function of (corpus, vocabulary): it performs no I/O of its own (the corpus was
// already loaded by the impure edge), so the runner and the tests analyze the corpus identically.

import { VOCABULARY } from '@formael/action-risk-vocabulary';
import { classifyManifest } from '@formael/actlint-core';
import type { CorpusEntry } from './corpus.ts';
import type { ScoredServer } from './score.ts';

/**
 * Classify every corpus manifest with the bundled vocabulary and pair the findings with the labels.
 * A classification failure is unreachable in a shipped build (the crosswalk-completeness contract
 * guarantees every emitted rule maps to a standard); if it ever fires it is a broken build, so we
 * throw with the offending server rather than silently scoring a partial corpus.
 */
export function analyzeCorpus(entries: readonly CorpusEntry[]): ScoredServer[] {
  return entries.map((entry) => {
    const classified = classifyManifest(entry.manifest, VOCABULARY);
    if (!classified.ok) {
      throw new Error(`corpus '${entry.server}': classification failed — ${classified.error.message}`);
    }
    return { server: entry.server, findings: classified.value, labels: entry.labels };
  });
}
