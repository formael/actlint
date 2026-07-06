// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The scorer — PURE. Given the linter's findings and the expert labels for a set of servers, it
// measures how honestly the linter reproduced the ground truth, per rule and in aggregate. No I/O,
// no clock, no randomness: the same findings and labels yield byte-identical numbers.
//
// The metric encodes the product's values, not generic accuracy:
//   - Only HONESTY rules are scored. Advisory (hygiene) findings carry no verdict and no ground
//     truth, so they are neither rewarded nor penalized here.
//   - False positives are weighted more heavily than false negatives. A false flag spends trust,
//     which is the tool's only asset. The headline number is an F-beta with beta < 1, which weights
//     precision (and therefore the cost of a false positive) above recall.
//   - `uncertain` on a genuinely ambiguous tool counts as correct. Conservatism is rewarded, not
//     punished: on an ambiguous tool an `uncertain` finding or silence never counts against the
//     score, and a miss is not a false negative — but a *confident* wrong flag still spends trust
//     and counts as a false positive.
//   - Per-rule, not just aggregate, so a regression is localized to the rule that caused it.

import { type Confidence, type Finding, HONESTY_RULES, type RuleId } from '@formael/actlint-core';
import type { ServerLabels, ToolLabel } from './schema.ts';

/** Precision is weighted this many times more than recall in the headline F-beta. beta = 0.5. */
export const SCORING_BETA = 0.5;

/** One server's linter output paired with its expert labels. */
export interface ScoredServer {
  readonly server: string;
  readonly findings: readonly Finding[];
  readonly labels: ServerLabels;
}

/** The confusion counts and derived metrics for a single rule (or the aggregate). */
export interface Metrics {
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly tn: number;
  /** null when there were no positive predictions (tp + fp === 0). */
  readonly precision: number | null;
  /** null when there were no true positives to find (tp + fn === 0). */
  readonly recall: number | null;
  /** The precision-weighted F-beta; null when precision or recall is null. */
  readonly fBeta: number | null;
}

export interface RuleScore extends Metrics {
  readonly ruleId: RuleId;
}

export interface ScoreReport {
  readonly beta: number;
  readonly serversScored: number;
  readonly toolsScored: number;
  readonly perRule: readonly RuleScore[];
  /** Micro-averaged over every honesty rule: robust when per-rule counts are sparse. */
  readonly aggregate: Metrics;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function fBeta(precision: number | null, recall: number | null, beta: number): number | null {
  if (precision === null || recall === null) return null;
  const b2 = beta * beta;
  const denominator = b2 * precision + recall;
  return denominator === 0 ? 0 : ((1 + b2) * precision * recall) / denominator;
}

function metricsFrom(tp: number, fp: number, fn: number, tn: number, beta: number): Metrics {
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return { tp, fp, fn, tn, precision, recall, fBeta: fBeta(precision, recall, beta) };
}

// The honesty findings the linter emitted for a given tool, indexed by RuleId. There is at most one
// finding per RuleId per tool (the classifier dedups), so this maps a rule to its single finding.
function honestyFindingsByRule(findings: readonly Finding[], toolName: string): Map<string, Finding> {
  const byRule = new Map<string, Finding>();
  for (const f of findings) {
    if (f.toolName === toolName && f.ruleClass === 'honesty') byRule.set(f.ruleId as string, f);
  }
  return byRule;
}

function expectedRuleIds(label: ToolLabel): ReadonlySet<string> {
  return new Set(label.expected.map((e) => e.ruleId));
}

interface Tally {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

// The scoring decision for a single (tool, rule) cell, applied to the running tally.
//
// On a non-ambiguous tool the four outcomes are the usual confusion matrix. On an ambiguous tool the
// rules bend toward conservatism: an `uncertain` prediction and any miss are excluded entirely
// (neither credited nor penalized), a correct confident catch is still credited, and only a
// *confident wrong* flag is penalized — because a confident false claim spends trust even when the
// truth is debatable.
function tallyCell(
  tally: Tally,
  predicted: Finding | undefined,
  truthFired: boolean,
  ambiguous: boolean,
): void {
  const predFired = predicted !== undefined;
  const predConfidence: Confidence | undefined = predicted?.confidence;

  if (ambiguous) {
    if (predFired && truthFired) tally.tp++;
    else if (predFired && !truthFired && predConfidence !== 'uncertain') tally.fp++;
    // uncertain predictions, and every miss, are excluded on an ambiguous tool.
    return;
  }

  if (predFired && truthFired) tally.tp++;
  else if (predFired && !truthFired) tally.fp++;
  else if (!predFired && truthFired) tally.fn++;
  else tally.tn++;
}

/**
 * Score the linter's findings against the expert labels for a corpus. Pure and deterministic:
 * per-rule and micro-aggregate precision/recall/F-beta, with false positives weighted above false
 * negatives via `beta`.
 */
export function scoreCorpus(servers: readonly ScoredServer[], beta: number = SCORING_BETA): ScoreReport {
  const tallies = new Map<string, Tally>();
  for (const { id } of HONESTY_RULES) tallies.set(id as string, { tp: 0, fp: 0, fn: 0, tn: 0 });

  let toolsScored = 0;
  for (const server of servers) {
    for (const label of server.labels.tools) {
      toolsScored++;
      const byRule = honestyFindingsByRule(server.findings, label.name);
      const truth = expectedRuleIds(label);
      const ambiguous = label.ambiguous === true;
      for (const { id } of HONESTY_RULES) {
        const key = id as string;
        const tally = tallies.get(key);
        if (tally === undefined) continue; // unreachable: seeded above.
        tallyCell(tally, byRule.get(key), truth.has(key), ambiguous);
      }
    }
  }

  const perRule: RuleScore[] = HONESTY_RULES.map(({ id }) => {
    const t = tallies.get(id as string) ?? { tp: 0, fp: 0, fn: 0, tn: 0 };
    return { ruleId: id, ...metricsFrom(t.tp, t.fp, t.fn, t.tn, beta) };
  });

  const summed = perRule.reduce(
    (acc, r) => ({ tp: acc.tp + r.tp, fp: acc.fp + r.fp, fn: acc.fn + r.fn, tn: acc.tn + r.tn }),
    { tp: 0, fp: 0, fn: 0, tn: 0 },
  );

  return {
    beta,
    serversScored: servers.length,
    toolsScored,
    perRule,
    aggregate: metricsFrom(summed.tp, summed.fp, summed.fn, summed.tn, beta),
  };
}
