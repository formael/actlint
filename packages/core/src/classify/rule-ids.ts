// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The RuleId taxonomy — a stable, CLOSED set, split into two classes with different gating
// semantics. Stability is a contract: renaming a RuleId is a breaking change, because downstream
// baselines, SARIF dashboards, and importers key on it. Adding one without a crosswalk entry fails
// the completeness contract (see ./crosswalk.ts). The engine emits no RuleId outside this file.

import type { RuleClass, Verdict } from '../finding.ts';
import { ruleIdSchema } from '../primitives.ts';
import type { RuleId } from '../primitives.ts';

// Brand a literal RuleId at module load. The literals here are the single source of truth for the
// closed set; the branding also guarantees each is a well-formed RuleId at startup.
function rule(id: string): RuleId {
  return ruleIdSchema.parse(id);
}

/**
 * The named RuleIds. Reference these constants everywhere — never a bare string — so a rename is a
 * single, compiler-checked edit and the crosswalk/severity keys stay in lockstep.
 */
export const RULE = {
  // Honesty rules — verdict-bearing, gate-eligible. The grade is computed from this set alone.
  writeAsReadonly: rule('write-as-readonly'),
  destructiveUnflagged: rule('destructive-unflagged'),
  externalReachUndeclared: rule('external-reach-undeclared'),
  destructiveAbsent: rule('destructive-absent'),
  reachAbsent: rule('reach-absent'),
  irreversibleUnflagged: rule('irreversible-unflagged'),
  overDeclaredRisk: rule('over-declared-risk'),
  // Advisory rules — capability hygiene, non-verdict, non-gating by default.
  freeformInputAsCode: rule('freeform-input-as-code'),
  noScopeConstraint: rule('no-scope-constraint'),
} as const;

// The characteristic verdict each honesty rule carries. The confidence may soften the *severity*
// (see ./severity.ts), but a rule's verdict is fixed — write-as-readonly is always under-declared.
export const HONESTY_RULES: ReadonlyArray<{ readonly id: RuleId; readonly verdict: Verdict }> = [
  { id: RULE.writeAsReadonly, verdict: 'under-declared' },
  { id: RULE.destructiveUnflagged, verdict: 'under-declared' },
  { id: RULE.externalReachUndeclared, verdict: 'under-declared' },
  { id: RULE.destructiveAbsent, verdict: 'undeclared' },
  { id: RULE.reachAbsent, verdict: 'undeclared' },
  { id: RULE.irreversibleUnflagged, verdict: 'undeclared' },
  { id: RULE.overDeclaredRisk, verdict: 'over-declared' },
];

export const ADVISORY_RULES: readonly RuleId[] = [RULE.freeformInputAsCode, RULE.noScopeConstraint];

// The whole closed set, in a stable order. The crosswalk-completeness contract iterates this.
export const ALL_RULE_IDS: readonly RuleId[] = [...HONESTY_RULES.map((r) => r.id), ...ADVISORY_RULES];

const ADVISORY_SET: ReadonlySet<string> = new Set(ADVISORY_RULES.map((id) => id as string));

/** The class of a RuleId. Advisory rules never contribute to the honesty grade and never gate. */
export function ruleClassOf(id: RuleId): RuleClass {
  return ADVISORY_SET.has(id as string) ? 'advisory' : 'honesty';
}
