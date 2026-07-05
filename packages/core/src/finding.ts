// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import type { DeclaredProfile } from './declared.ts';
import type { ActionRiskProfile, Confidence, SignalRef } from './dimensions.ts';
import type { RuleId } from './primitives.ts';

// Verdict — the four mutually exclusive comparison outcomes (asymmetric: under-declared is worse than over-declared).
// Handle with an exhaustive switch + assertNever so adding a new verdict fails to compile at every site.
export const verdictSchema = z.enum(['consistent', 'under-declared', 'over-declared', 'undeclared']);
export type Verdict = z.infer<typeof verdictSchema>;

// Severity — a published, reviewable data policy, not a magic number buried in code.
// 'critical' is reserved for under-declared findings where an explicit false claim removed safety prompts.
export const severitySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof severitySchema>;

// RuleClass — the two-class split that keeps the honesty grade coherent.
//   'honesty'  — verdict-bearing, gate-eligible; compares derived risk to a declared MCP hint.
//   'advisory' — capability-hygiene checks with no declared-hint counterpart; never gating by
//                default, never contributing to the honesty grade. Reporters and importers filter
//                on this field so an advisory nudge is never read as an honesty verdict.
export const ruleClassSchema = z.enum(['honesty', 'advisory']);
export type RuleClass = z.infer<typeof ruleClassSchema>;

// StandardsRef — the typed crosswalk reference that makes every finding speak to Builder, Guardian,
// and auditor simultaneously. At least one array must be non-empty (crosswalk-completeness
// contract, enforced by the smart constructor and its contract test).
export interface StandardsRef {
  readonly owaspAsi?: readonly string[];
  readonly owaspMcp?: readonly string[];
  readonly cosaiOasis?: readonly string[];
  // EU AI Act mapping applies only when the deployer's system is high-risk under the Act.
  // NEVER render as "EU AI Act violation" — it is a transparency/oversight obligation reference.
  readonly euAiAct?: readonly string[];
  readonly nist?: readonly string[];
  readonly mcpField?: readonly string[];
}

export const standardsRefSchema = z
  .object({
    owaspAsi: z.array(z.string()).readonly().optional(),
    owaspMcp: z.array(z.string()).readonly().optional(),
    cosaiOasis: z.array(z.string()).readonly().optional(),
    euAiAct: z.array(z.string()).readonly().optional(),
    nist: z.array(z.string()).readonly().optional(),
    mcpField: z.array(z.string()).readonly().optional(),
  })
  .readonly()
  .refine(
    (ref) =>
      [ref.owaspAsi, ref.owaspMcp, ref.cosaiOasis, ref.euAiAct, ref.nist, ref.mcpField].some(
        (arr) => arr !== undefined && arr.length > 0,
      ),
    { message: 'A StandardsRef must cite at least one external standard or MCP field.' },
  );

// Finding — the canonical pipeline output: a verdict on one tool/aspect with full provenance.
//
// NEVER construct this with an object literal. Use makeFinding(), which enforces:
//   - rationale is non-empty (Invariant 2: a finding without a reason is a bug)
//   - standards maps to at least one external reference (Invariant 5: standards-native)
//   - confidence 'uncertain' is preserved, never silently promoted (Invariant 3: conservatism)
//
// The scorecard, JSON report, and exit code are all views of a readonly Finding[].
export interface Finding {
  readonly ruleId: RuleId;
  readonly ruleClass: RuleClass;
  readonly toolName: string;
  readonly verdict: Verdict;
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly rationale: string;
  readonly standards: StandardsRef;
  readonly derived: ActionRiskProfile;
  readonly declared: DeclaredProfile;
  readonly evidence: readonly SignalRef[];
}
