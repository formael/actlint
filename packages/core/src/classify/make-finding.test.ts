// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The EXPLAINABILITY contract (Invariant 2), as a suite-wide test. makeFinding is the only way to
// build a Finding, and it refuses to build one that cannot explain itself. This suite asserts that
// every RuleId the engine can emit produces a non-empty rationale and a non-empty standards mapping,
// and that a planted rule which cannot explain itself is rejected — a build-failing gate, not a wish.

import { describe, expect, it } from 'vitest';

import type { Verdict } from '../finding.ts';
import type { RuleId } from '../primitives.ts';
import { ruleIdSchema } from '../primitives.ts';
import { makeFinding } from './make-finding.ts';
import { ADVISORY_RULES, ALL_RULE_IDS, HONESTY_RULES, ruleClassOf } from './rule-ids.ts';
import { declared, dim, profile, sig } from './test-builders.ts';

// A profile that gives every rule's rationale concrete levels to describe.
const richDerived = profile({
  destructiveness: dim('deleting', 'high', [sig('verb.delete')]),
  externalReach: dim('open-world', 'high', [sig('shape.destination-format')]),
  reversibility: dim('irreversible', 'high', [sig('verb.payment')]),
});

// The characteristic verdict per RuleId (advisory rules carry the neutral undeclared marker).
const verdictOf = (id: RuleId): Verdict => {
  const honesty = HONESTY_RULES.find((r) => r.id === id);
  return honesty ? honesty.verdict : 'undeclared';
};

describe('explainability contract: every RuleId builds a fully-explained Finding', () => {
  it.each(ALL_RULE_IDS.map((id) => [id as string, id] as const))('%s', (_label, ruleId) => {
    const outcome = makeFinding({
      ruleId,
      toolName: 'example_tool',
      verdict: verdictOf(ruleId),
      confidence: 'high',
      derived: richDerived,
      declared: declared(),
      signals: [sig('verb.delete')],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const f = outcome.value;
    expect(f.rationale.length).toBeGreaterThan(0);
    expect(f.standards).toBeTruthy();
    const someStandard = [
      f.standards.owaspAsi,
      f.standards.owaspMcp,
      f.standards.cosaiOasis,
      f.standards.euAiAct,
      f.standards.nist,
      f.standards.mcpField,
    ].some((arr) => arr !== undefined && arr.length > 0);
    expect(someStandard).toBe(true);
    expect(f.ruleClass).toBe(ruleClassOf(ruleId));
    expect(f.severity).toBeTruthy();
  });
});

describe('explainability contract: an unexplained finding is unconstructable', () => {
  it('a rule with no rationale is rejected (missing-rationale), not silently shipped', () => {
    const planted = ruleIdSchema.parse('planted-unknown-rule') as RuleId;
    const outcome = makeFinding({
      ruleId: planted,
      toolName: 'example_tool',
      verdict: 'under-declared',
      confidence: 'high',
      derived: richDerived,
      declared: declared(),
      signals: [sig('x')],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('missing-rationale');
  });
});

describe('advisory findings are marked as such', () => {
  it('every advisory RuleId yields a Finding whose class is advisory', () => {
    for (const id of ADVISORY_RULES) {
      const outcome = makeFinding({
        ruleId: id,
        toolName: 't',
        verdict: 'undeclared',
        confidence: 'medium',
        derived: richDerived,
        declared: declared(),
        signals: [sig('shape.freeform-code-input')],
      });
      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value.ruleClass).toBe('advisory');
    }
  });
});
