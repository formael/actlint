// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The corpus integration test: the actual seed corpus, run through the actual engine, scored and
// gated. This is where the eval stops being unit machinery and becomes the number that defends the
// scorecard — so it also re-asserts the corpus's structural contract (every label carries a cited
// provenance) and the engine's determinism over the whole corpus (Invariant 1).

import { describe, expect, it } from 'vitest';
import { analyzeCorpus } from './analyze.ts';
import { loadCorpus, loadThresholds } from './corpus.ts';
import { scoreCorpus } from './score.ts';
import { evaluateGate } from './threshold.ts';

const corpus = loadCorpus();
const thresholds = loadThresholds();

describe('the seed corpus', () => {
  it('loads a handful of real, validated servers', () => {
    // loadCorpus throws on any schema, tool-coverage, or server-id mismatch, so reaching here means
    // every manifest is a valid ToolManifest and every labels.json matches its manifest.
    expect(corpus.length).toBeGreaterThanOrEqual(4);
  });

  it('gives every label a present, cited provenance', () => {
    for (const entry of corpus) {
      for (const tool of entry.labels.tools) {
        expect(tool.provenance.source.length).toBeGreaterThan(0);
        expect(tool.provenance.kind).toBeTruthy();
        // vendor-docs citations must be dated, since documentation drifts.
        if (tool.provenance.kind === 'vendor-docs') expect(tool.provenance.accessedAt).toBeDefined();
      }
    }
  });
});

describe('the engine over the corpus', () => {
  it('is deterministic — byte-identical findings across two runs (Invariant 1)', () => {
    const once = JSON.stringify(analyzeCorpus(corpus));
    const twice = JSON.stringify(analyzeCorpus(corpus));
    expect(once).toBe(twice);
  });
});

describe('the merge gate', () => {
  const report = scoreCorpus(analyzeCorpus(corpus), thresholds.beta);

  it('measures per-rule precision/recall on the rules the seed corpus exercises', () => {
    const exercised = report.perRule.filter((r) => r.tp + r.fp + r.fn > 0);
    expect(exercised.length).toBeGreaterThanOrEqual(3);
  });

  it('holds precision above the committed v0.x floor', () => {
    const result = evaluateGate(report, thresholds);
    if (!result.passed) throw new Error(`eval gate failed: ${result.failures.join('; ')}`);
    expect(result.passed).toBe(true);
    expect(report.aggregate.precision ?? 0).toBeGreaterThanOrEqual(thresholds.aggregate.minPrecision);
  });
});
