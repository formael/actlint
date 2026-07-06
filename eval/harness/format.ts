// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Rendering the score report as a calm, plain table — PURE. No colour, no theatre: this is an
// engineering number, printed the way the tool itself reads. Deterministic over its input.

import type { Metrics, RuleScore, ScoreReport } from './score.ts';
import type { GateResult } from './threshold.ts';

function pct(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function row(cells: readonly [string, string, string, string, string, string, string]): string {
  const [rule, tp, fp, fn, precision, recall, f] = cells;
  return [
    pad(rule, 26),
    padLeft(tp, 4),
    padLeft(fp, 4),
    padLeft(fn, 4),
    padLeft(precision, 9),
    padLeft(recall, 8),
    padLeft(f, 8),
  ].join('  ');
}

function metricRow(name: string, m: Metrics): string {
  return row([name, String(m.tp), String(m.fp), String(m.fn), pct(m.precision), pct(m.recall), pct(m.fBeta)]);
}

/** Render the full report and gate outcome as text. Pure; the caller decides where it goes. */
export function formatReport(report: ScoreReport, gate: GateResult): string {
  const lines: string[] = [];
  lines.push(
    `actlint eval — ${report.toolsScored} tools across ${report.serversScored} servers (F-beta = ${report.beta}, precision-weighted)`,
  );
  lines.push('');
  lines.push(row(['rule', 'TP', 'FP', 'FN', 'precision', 'recall', `F${report.beta}`]));
  lines.push('─'.repeat(76));

  const rules: readonly RuleScore[] = report.perRule;
  for (const r of rules) lines.push(metricRow(r.ruleId as string, r));

  lines.push('─'.repeat(76));
  lines.push(metricRow('aggregate (micro)', report.aggregate));
  lines.push('');

  if (gate.passed) {
    lines.push('gate: PASS — precision holds above the committed floor.');
  } else {
    lines.push('gate: FAIL');
    for (const failure of gate.failures) lines.push(`  · ${failure}`);
  }

  return `${lines.join('\n')}\n`;
}
