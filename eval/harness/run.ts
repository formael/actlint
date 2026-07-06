// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The eval runner — the impure shell and the merge gate's entry point. Loads the corpus and the
// committed floors from disk, runs the pure core over the corpus, scores the findings against the
// labels, prints the table, and exits non-zero if the number falls below the floor.
//
// Everything load-bearing (scoring, gating, formatting) is pure and unit-tested elsewhere; this file
// only wires the pieces to the filesystem and the process. Run it via `pnpm eval`.

import { analyzeCorpus } from './analyze.ts';
import { loadCorpus, loadThresholds } from './corpus.ts';
import { formatReport } from './format.ts';
import { scoreCorpus } from './score.ts';
import { evaluateGate } from './threshold.ts';

function main(): number {
  const thresholds = loadThresholds();
  const corpus = loadCorpus();
  if (corpus.length === 0) {
    process.stderr.write('actlint eval: the corpus is empty — nothing to score.\n');
    return 1;
  }

  const report = scoreCorpus(analyzeCorpus(corpus), thresholds.beta);
  const gate = evaluateGate(report, thresholds);
  process.stdout.write(formatReport(report, gate));
  return gate.passed ? 0 : 1;
}

process.exit(main());
