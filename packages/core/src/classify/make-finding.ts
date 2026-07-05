// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// makeFinding — the ONLY way to construct a Finding. This is where Invariant 2 (explainability) and
// Invariant 5 (standards-native) stop being wishes and become structural: a finding that cannot
// generate a non-empty rationale, or whose RuleId has no crosswalk entry, is UNCONSTRUCTABLE. There
// is no public Finding literal anywhere in the codebase. A suite-wide contract test re-asserts this
// over every RuleId the engine can emit, so adding a rule without a mapping fails the build.

import type { DeclaredProfile } from '../declared.ts';
import type { ActionRiskProfile, Confidence, SignalRef } from '../dimensions.ts';
import type { Finding, Verdict } from '../finding.ts';
import { type Outcome, err, ok } from '../outcome.ts';
import type { RuleId } from '../primitives.ts';
import { lookupStandards } from './crosswalk.ts';
import { buildRationale } from './rationale.ts';
import { ruleClassOf } from './rule-ids.ts';
import { computeSeverity } from './severity.ts';

export interface MakeFindingInput {
  readonly ruleId: RuleId;
  readonly toolName: string;
  readonly verdict: Verdict;
  readonly confidence: Confidence;
  readonly derived: ActionRiskProfile;
  readonly declared: DeclaredProfile;
  readonly signals: readonly SignalRef[];
}

/**
 * Construct a Finding, or return an Err explaining why it could not be built. The two gates:
 *   • rationale — generated from the signals; must be non-empty (a finding without a reason is a bug)
 *   • standards — looked up from the crosswalk for the RuleId; must be non-empty (standards-native)
 * Severity is then computed from the published policy, softened by confidence. Never throws.
 */
export function makeFinding(input: MakeFindingInput): Outcome<Finding> {
  const { ruleId, toolName, verdict, confidence, derived, declared, signals } = input;

  const rationale = buildRationale(ruleId, derived, declared, signals);
  if (rationale.length === 0) {
    return err({
      code: 'missing-rationale',
      message: `Rule ${ruleId as string} produced an empty rationale; a finding without a reason cannot be shipped.`,
      context: { ruleId: ruleId as string, toolName },
    });
  }

  const standards = lookupStandards(ruleId);
  if (standards === undefined) {
    return err({
      code: 'missing-standards-ref',
      message: `Rule ${ruleId as string} has no crosswalk entry; every finding must locate itself in the standards landscape.`,
      context: { ruleId: ruleId as string, toolName },
    });
  }

  const severity = computeSeverity(ruleId, verdict, confidence);

  return ok({
    ruleId,
    ruleClass: ruleClassOf(ruleId),
    toolName,
    verdict,
    severity,
    confidence,
    rationale,
    standards,
    derived,
    declared,
    evidence: signals,
  });
}
