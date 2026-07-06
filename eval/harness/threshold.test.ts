// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { RULE } from '@formael/actlint-core';
import { describe, expect, it } from 'vitest';
import { scoreCorpus } from './score.ts';
import { finding, scored, toolLabel } from './test-support.ts';
import { evaluateGate, parseThresholds, type Thresholds } from './threshold.ts';

const thresholds: Thresholds = {
  schemaVersion: 1,
  beta: 0.5,
  aggregate: { minPrecision: 0.65, minRecall: 0.5, minFBeta: 0.6 },
};

function tp(server: string, tool: string) {
  return scored(server, [finding(tool, RULE.destructiveAbsent)], {
    server,
    tools: [toolLabel(tool, [RULE.destructiveAbsent as string])],
  });
}

function fp(server: string, tool: string) {
  return scored(server, [finding(tool, RULE.destructiveAbsent)], {
    server,
    tools: [toolLabel(tool, [])],
  });
}

describe('evaluateGate', () => {
  it('passes a clean, high-precision run', () => {
    const report = scoreCorpus([tp('a', 't1'), tp('b', 't2')]);
    expect(evaluateGate(report, thresholds)).toEqual({ passed: true, failures: [] });
  });

  it('fails when aggregate precision falls below the floor', () => {
    // One true positive against three false positives: precision 0.25, below the 0.65 floor.
    const report = scoreCorpus([tp('a', 't1'), fp('b', 'c1'), fp('c', 'c2'), fp('d', 'c3')]);
    const result = evaluateGate(report, thresholds);
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('precision');
  });

  it('fails on a beta mismatch, because the numbers are not comparable', () => {
    const report = scoreCorpus([tp('a', 't1')], 0.5);
    const result = evaluateGate(report, { ...thresholds, beta: 1 });
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('beta mismatch');
  });

  it('treats a null metric (no positive predictions) as a vacuous pass', () => {
    // A corpus of one genuinely clean tool: no predictions, no truths — nothing to regress.
    const report = scoreCorpus([scored('a', [], { server: 'a', tools: [toolLabel('t', [])] })]);
    expect(report.aggregate.precision).toBeNull();
    expect(evaluateGate(report, thresholds).passed).toBe(true);
  });
});

describe('parseThresholds', () => {
  it('accepts the committed shape', () => {
    expect(() => parseThresholds(thresholds)).not.toThrow();
  });

  it('rejects a floor outside [0, 1]', () => {
    expect(() =>
      parseThresholds({ ...thresholds, aggregate: { ...thresholds.aggregate, minPrecision: 1.5 } }),
    ).toThrow();
  });
});
