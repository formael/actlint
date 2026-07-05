// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Severity is COMPUTED, never hand-assigned. It reads the published severity policy (versioned data
// in the vocabulary package) and applies it mechanically, so "why is this critical?" is always
// answerable from the table: "under-declared verdict, high confidence, no downgrade." The whole
// asymmetry of the product — under-declared ≫ undeclared ≈ over-declared — lives in that data, not
// here. This file is the reader.

import { SEVERITY_POLICY } from '@formael/action-risk-vocabulary';
import type { Confidence } from '../dimensions.ts';
import type { Severity, Verdict } from '../finding.ts';
import type { RuleId } from '../primitives.ts';
import { ruleClassOf } from './rule-ids.ts';

// The severity ladder, least to most concerning. Confidence steps a finding DOWN this ladder.
const SEVERITY_LADDER: readonly Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function stepDown(severity: Severity, steps: number): Severity {
  const idx = SEVERITY_LADDER.indexOf(severity);
  const next = Math.max(0, idx - Math.max(0, steps));
  return SEVERITY_LADDER[next] ?? 'info';
}

function higher(a: Severity, b: Severity): Severity {
  return SEVERITY_LADDER.indexOf(a) >= SEVERITY_LADDER.indexOf(b) ? a : b;
}

/**
 * The severity of a finding, from the published policy.
 *
 * Advisory rules take their own floor (a structural schema fact, not softened by confidence).
 * Honesty rules start at the verdict's base severity and are stepped DOWN the ladder by the
 * confidence adjustment — an `uncertain` under-declared is softened, but never suppressed and never
 * promoted. A per-rule floor, if the policy defines one, is applied last.
 */
export function computeSeverity(ruleId: RuleId, verdict: Verdict, confidence: Confidence): Severity {
  const floor = SEVERITY_POLICY.ruleFloor[ruleId as string];

  if (ruleClassOf(ruleId) === 'advisory') {
    return floor ?? SEVERITY_POLICY.ruleClass.advisory;
  }

  const base = SEVERITY_POLICY.byVerdict[verdict];
  const stepsDown = -SEVERITY_POLICY.confidenceAdjust[confidence];
  const adjusted = stepDown(base, stepsDown);
  return floor ? higher(floor, adjusted) : adjusted;
}
