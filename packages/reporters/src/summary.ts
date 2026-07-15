// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The per-tool honesty tally shared by the grade and every reporter. It is a REDUCTION of the
// canonical Finding[], not new judgment: each tool is counted once, under its worst honesty
// verdict, so the four dishonesty buckets plus `consistent` always sum to the tool count. Advisory
// findings are hygiene notes with no verdict — they never move a tool out of `consistent`.

import type { Finding, ReportSummary, Verdict } from '@formael/actlint-core';

// Worst honesty verdict first. A tool showing several verdicts is classified by the worst one it
// carries, mirroring the asymmetry the whole product pivots on: under-declared ≫ undeclared ≫
// over-declared. `consistent` is not a producible finding verdict — a clean tool simply has none.
const HONESTY_VERDICT_WORST_FIRST: readonly Verdict[] = ['under-declared', 'undeclared', 'over-declared'];

function worstRank(verdict: Verdict): number {
  const idx = HONESTY_VERDICT_WORST_FIRST.indexOf(verdict);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * The worst honesty verdict for each tool that carries one, keyed by tool name. Tools with only
 * advisory findings (or none) are absent — they are consistent for honesty purposes.
 */
export function worstVerdictByTool(findings: readonly Finding[]): ReadonlyMap<string, Verdict> {
  const worst = new Map<string, Verdict>();
  for (const finding of findings) {
    if (finding.ruleClass !== 'honesty') continue;
    const current = worst.get(finding.toolName);
    if (current === undefined || worstRank(finding.verdict) < worstRank(current)) {
      worst.set(finding.toolName, finding.verdict);
    }
  }
  return worst;
}

/**
 * Reduce a finding set and a tool count to the per-tool summary the scorecard headline, the JSON
 * report, and the grade all read. `consistent` is the remainder after the three dishonesty buckets
 * and the `unassessed` tools; the five buckets sum to `tools`.
 *
 * `unassessed` is the count of tools actlint found no verdict-bearing signal for (see assessManifest).
 * It defaults to 0, so the grade — which weighs an unassessed tool as non-dishonest, never punishing
 * a server for the linter's own recall gap — reads the same summary it always has. The reporters pass
 * the real count, moving those tools out of `consistent` so silence is never rendered as honesty.
 */
export function summarize(findings: readonly Finding[], toolCount: number, unassessed = 0): ReportSummary {
  const worst = worstVerdictByTool(findings);

  let underDeclared = 0;
  let undeclared = 0;
  let overDeclared = 0;
  for (const verdict of worst.values()) {
    if (verdict === 'under-declared') underDeclared += 1;
    else if (verdict === 'undeclared') undeclared += 1;
    else if (verdict === 'over-declared') overDeclared += 1;
  }

  const consistent = Math.max(0, toolCount - underDeclared - undeclared - overDeclared - unassessed);
  return { tools: toolCount, underDeclared, undeclared, overDeclared, consistent, unassessed };
}
