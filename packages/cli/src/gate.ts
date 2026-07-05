// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The CI gate — the pure decision behind exit code 0 vs 1. It reads the finished finding set; it
// runs no analysis of its own. A finding gates when it is an honesty verdict at or above the
// threshold. Two consequences fall out of the model rather than being special-cased here:
//   - Advisories never gate. They are capability hygiene, not honesty verdicts (finding.ruleClass).
//   - An `uncertain` finding never fails the default gate. Confidence already steps its severity
//     down the ladder (severity policy), so an uncertain under-declaration lands below `high`.

import type { Finding, Severity } from '@formael/actlint-core';

// Least to most concerning — the same ladder the severity policy uses. Kept local so the gate has a
// total order to compare against without importing a policy table.
const SEVERITY_ORDER: readonly Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function atOrAbove(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(threshold);
}

/**
 * The honesty findings that meet the gate: verdict-bearing (not advisory) and at or above the
 * threshold. These are what turn a green build red. A finding suppressed or graced by the baseline
 * has already been removed before this is called.
 */
export function gatingFindings(findings: readonly Finding[], failOn: Severity): readonly Finding[] {
  return findings.filter((f) => f.ruleClass === 'honesty' && atOrAbove(f.severity, failOn));
}

/** True when at least one finding meets the gate — the caller maps this to exit code 1 vs 0. */
export function gateFails(findings: readonly Finding[], failOn: Severity): boolean {
  return gatingFindings(findings, failOn).length > 0;
}
