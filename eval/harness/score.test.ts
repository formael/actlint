// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { RULE } from '@formael/actlint-core';
import { describe, expect, it } from 'vitest';
import { SCORING_BETA, scoreCorpus } from './score.ts';
import { finding, scored, toolLabel } from './test-support.ts';

// A one-tool server whose truth is a single destructive-absent finding.
function serverExpectingDestructiveAbsent(
  server: string,
  tool: string,
  findings = [finding(tool, RULE.destructiveAbsent)],
) {
  return scored(server, findings, {
    server,
    tools: [toolLabel(tool, [RULE.destructiveAbsent as string])],
  });
}

describe('scoreCorpus — confusion counting', () => {
  it('credits a true positive when the linter fires the expected rule', () => {
    const report = scoreCorpus([serverExpectingDestructiveAbsent('s', 't')]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.destructiveAbsent);
    expect(rule).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 });
  });

  it('counts a false negative when the linter stays silent on an expected rule', () => {
    const silent = scored('s', [], {
      server: 's',
      tools: [toolLabel('t', [RULE.destructiveAbsent as string])],
    });
    const report = scoreCorpus([silent]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.destructiveAbsent);
    expect(rule).toMatchObject({ tp: 0, fp: 0, fn: 1, recall: 0 });
  });

  it('counts a false positive when the linter fires a rule the truth does not warrant', () => {
    const clean = scored('s', [finding('t', RULE.reachAbsent)], {
      server: 's',
      tools: [toolLabel('t', [])],
    });
    const report = scoreCorpus([clean]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.reachAbsent);
    expect(rule).toMatchObject({ tp: 0, fp: 1, fn: 0, precision: 0 });
  });

  it('reports per-rule, not just an aggregate, so a regression is localizable', () => {
    const report = scoreCorpus([serverExpectingDestructiveAbsent('s', 't')]);
    expect(report.perRule.map((r) => r.ruleId as string)).toContain(RULE.destructiveAbsent as string);
    // Advisory rules are never scored: they carry no verdict and no ground truth.
    expect(report.perRule.map((r) => r.ruleId as string)).not.toContain(RULE.freeformInputAsCode as string);
  });
});

describe('scoreCorpus — the merge-gate property', () => {
  // The corpus: three tools that each truly warrant one destructive-absent finding.
  const corpus = [
    serverExpectingDestructiveAbsent('a', 't1'),
    serverExpectingDestructiveAbsent('b', 't2'),
    serverExpectingDestructiveAbsent('c', 't3'),
  ];

  it('a strictly-safer change (perfect precision) scores at least as well', () => {
    const report = scoreCorpus(corpus);
    expect(report.aggregate.precision).toBe(1);
    expect(report.aggregate.fBeta).toBe(1);
  });

  it('a precision-tanking change (new false positives) drops the F-beta below the safe run', () => {
    const safe = scoreCorpus(corpus);

    // The same recall, but the rule now also cries wolf on two clean tools.
    const noisy = [
      ...corpus,
      scored('d', [finding('clean1', RULE.destructiveAbsent)], {
        server: 'd',
        tools: [toolLabel('clean1', [])],
      }),
      scored('e', [finding('clean2', RULE.destructiveAbsent)], {
        server: 'e',
        tools: [toolLabel('clean2', [])],
      }),
    ];
    const noisyReport = scoreCorpus(noisy);

    expect(noisyReport.aggregate.recall).toBe(safe.aggregate.recall); // recall unchanged...
    expect(noisyReport.aggregate.precision ?? 0).toBeLessThan(safe.aggregate.precision ?? 0); // ...precision fell...
    expect(noisyReport.aggregate.fBeta ?? 0).toBeLessThan(safe.aggregate.fBeta ?? 0); // ...and the number fell.
  });

  it('weights a false positive more heavily than a false negative (beta < 1)', () => {
    // Same starting point; compare the cost of one extra FP against one extra FN.
    const oneFalsePositive = scoreCorpus([
      serverExpectingDestructiveAbsent('a', 't1'),
      scored('b', [finding('c', RULE.destructiveAbsent)], { server: 'b', tools: [toolLabel('c', [])] }),
    ]);
    const oneFalseNegative = scoreCorpus([
      serverExpectingDestructiveAbsent('a', 't1'),
      scored('b', [], { server: 'b', tools: [toolLabel('c', [RULE.destructiveAbsent as string])] }),
    ]);

    expect(SCORING_BETA).toBeLessThan(1);
    // 1 TP + 1 FP vs 1 TP + 1 FN: with a precision-weighted beta, the false positive hurts more.
    expect(oneFalsePositive.aggregate.fBeta ?? 0).toBeLessThan(oneFalseNegative.aggregate.fBeta ?? 0);
  });
});

describe('scoreCorpus — conservatism is rewarded on ambiguous truth', () => {
  it('an uncertain finding on a genuinely ambiguous tool is never a false positive', () => {
    const server = scored('s', [finding('t', RULE.reachAbsent, 'uncertain')], {
      server: 's',
      tools: [toolLabel('t', [], { ambiguous: true, trueVerdict: 'undeclared' })],
    });
    const report = scoreCorpus([server]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.reachAbsent);
    expect(rule).toMatchObject({ tp: 0, fp: 0, fn: 0 });
  });

  it('a miss on a genuinely ambiguous tool is never a false negative', () => {
    const server = scored('s', [], {
      server: 's',
      tools: [toolLabel('t', [RULE.destructiveAbsent as string], { ambiguous: true })],
    });
    const report = scoreCorpus([server]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.destructiveAbsent);
    expect(rule).toMatchObject({ tp: 0, fp: 0, fn: 0 });
  });

  it('but a CONFIDENT wrong flag on an ambiguous tool still spends trust (a false positive)', () => {
    const server = scored('s', [finding('t', RULE.reachAbsent, 'high')], {
      server: 's',
      tools: [toolLabel('t', [], { ambiguous: true, trueVerdict: 'undeclared' })],
    });
    const report = scoreCorpus([server]);
    const rule = report.perRule.find((r) => r.ruleId === RULE.reachAbsent);
    expect(rule).toMatchObject({ tp: 0, fp: 1, fn: 0 });
  });
});

describe('scoreCorpus — determinism', () => {
  it('is a pure function of its inputs (byte-identical serialized output across runs)', () => {
    const corpus = [serverExpectingDestructiveAbsent('a', 't1'), serverExpectingDestructiveAbsent('b', 't2')];
    expect(JSON.stringify(scoreCorpus(corpus))).toBe(JSON.stringify(scoreCorpus(corpus)));
  });
});
