// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The comparator's executable spec: one golden case per honesty RuleId, the corrected
// uncertain+explicit-false cell, the hint-interaction dedup, and the property laws (no double-fire;
// escalating the gap never lowers severity).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { DeclaredProfile } from '../declared.ts';
import type {
  ActionRiskProfile,
  Confidence,
  Destructiveness,
  ExternalReach,
  Reversibility,
} from '../dimensions.ts';
import type { Verdict } from '../finding.ts';
import { classify } from './classify.ts';
import { RULE } from './rule-ids.ts';
import { computeSeverity } from './severity.ts';
import { declared, dim, hint, profile, sig } from './test-builders.ts';

const only = (findings: ReturnType<typeof classify>) => {
  expect(findings).toHaveLength(1);
  const [first] = findings;
  if (first === undefined) throw new Error('expected exactly one finding');
  return first;
};

describe('golden cases — one per honesty rule', () => {
  it('write-as-readonly: a deleting tool that declares readOnlyHint:true (under-declared)', () => {
    const f = only(
      classify(
        profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) }),
        declared({ readOnly: hint.true }),
      ),
    );
    expect(f.ruleId).toBe(RULE.writeAsReadonly);
    expect(f.verdict).toBe<Verdict>('under-declared');
    expect(f.confidence).toBe('high');
  });

  it('destructive-unflagged: a mutating tool that declares destructiveHint:false (under-declared)', () => {
    const f = only(
      classify(
        profile({ destructiveness: dim('mutating', 'high', [sig('verb.mutate')]) }),
        declared({ destructive: hint.false }),
      ),
    );
    expect(f.ruleId).toBe(RULE.destructiveUnflagged);
    expect(f.verdict).toBe<Verdict>('under-declared');
  });

  it('external-reach-undeclared: an open-world tool that declares openWorldHint:false (under-declared)', () => {
    const f = only(
      classify(
        profile({ externalReach: dim('open-world', 'high', [sig('shape.destination-format')]) }),
        declared({ openWorld: hint.false }),
      ),
    );
    expect(f.ruleId).toBe(RULE.externalReachUndeclared);
    expect(f.verdict).toBe<Verdict>('under-declared');
  });

  it('destructive-absent: a deleting tool that declares nothing (undeclared, informational)', () => {
    const f = only(
      classify(profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) }), declared()),
    );
    expect(f.ruleId).toBe(RULE.destructiveAbsent);
    expect(f.verdict).toBe<Verdict>('undeclared');
  });

  it('reach-absent: an open-world tool with no openWorldHint (undeclared, informational)', () => {
    const f = only(
      classify(
        profile({ externalReach: dim('open-world', 'medium', [sig('shape.destination-param-name')]) }),
        declared(),
      ),
    );
    expect(f.ruleId).toBe(RULE.reachAbsent);
    expect(f.verdict).toBe<Verdict>('undeclared');
  });

  it('irreversible-unflagged: an irreversible, non-deleting tool with no destructive admission', () => {
    const f = only(
      classify(
        profile({
          destructiveness: dim('additive', 'medium', [sig('verb.payment')]),
          reversibility: dim('irreversible', 'high', [sig('verb.payment')]),
        }),
        declared(),
      ),
    );
    expect(f.ruleId).toBe(RULE.irreversibleUnflagged);
    expect(f.verdict).toBe<Verdict>('undeclared');
  });

  it('over-declared-risk: a pure read that declares destructiveHint:true (over-declared)', () => {
    const f = only(
      classify(
        profile({ destructiveness: dim('read-only', 'high', [sig('verb.read')]) }),
        declared({ destructive: hint.true }),
      ),
    );
    expect(f.ruleId).toBe(RULE.overDeclaredRisk);
    expect(f.verdict).toBe<Verdict>('over-declared');
  });
});

describe('the corrected uncertain + explicit-false cell', () => {
  it('uncertain destructiveness + destructiveHint:false is a SOFT under-declared (not undeclared)', () => {
    const f = only(
      classify(
        profile({ destructiveness: dim('unknown', 'uncertain') }),
        declared({ destructive: hint.false }),
      ),
    );
    expect(f.ruleId).toBe(RULE.destructiveUnflagged);
    expect(f.verdict).toBe<Verdict>('under-declared');
    expect(f.confidence).toBe('uncertain'); // the softening lives in confidence, carried to severity.
  });

  it('a present-and-false hint is a claim: it never degrades to the absent (undeclared) case', () => {
    const soft = classify(
      profile({ destructiveness: dim('unknown', 'uncertain') }),
      declared({ destructive: hint.false }),
    );
    const absent = classify(profile({ destructiveness: dim('unknown', 'uncertain') }), declared());
    expect(soft[0]?.verdict).toBe('under-declared');
    expect(absent).toHaveLength(0); // silence about an uncertain risk is not itself a finding.
  });
});

describe('hint-interaction and dedup', () => {
  it('readOnlyHint:true moots destructiveHint: only write-as-readonly fires, not destructive-unflagged', () => {
    const findings = classify(
      profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) }),
      declared({ readOnly: hint.true, destructive: hint.false }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe(RULE.writeAsReadonly);
  });

  it('over-declared argued by two aspects collapses to a single finding', () => {
    const findings = classify(
      profile({ destructiveness: dim('read-only', 'high'), externalReach: dim('local', 'high') }),
      declared({ destructive: hint.true, openWorld: hint.true }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe(RULE.overDeclaredRisk);
  });
});

describe('clean and consistent tools produce no finding', () => {
  it('a read-only tool that declares readOnlyHint:true', () => {
    expect(classify(profile(), declared({ readOnly: hint.true }))).toHaveLength(0);
  });

  it('a deleting tool that honestly declares destructiveHint:true', () => {
    expect(
      classify(profile({ destructiveness: dim('deleting', 'high') }), declared({ destructive: hint.true })),
    ).toHaveLength(0);
  });

  it('a fully silent, benign read', () => {
    expect(classify(profile(), declared())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property laws.
// ---------------------------------------------------------------------------

const destructivenessArb = fc.constantFrom<Destructiveness>(
  'read-only',
  'additive',
  'mutating',
  'deleting',
  'unknown',
);
const reachArb = fc.constantFrom<ExternalReach>('local', 'org-internal', 'open-world', 'unknown');
const reversibilityArb = fc.constantFrom<Reversibility>(
  'reversible',
  'recoverable-with-effort',
  'irreversible',
  'unknown',
);
const confidenceArb = fc.constantFrom<Confidence>('high', 'medium', 'low', 'uncertain');

const profileArb: fc.Arbitrary<ActionRiskProfile> = fc
  .record({ d: destructivenessArb, r: reachArb, rev: reversibilityArb, c: confidenceArb })
  .map(({ d, r, rev, c }) =>
    profile({
      destructiveness: dim(d, c, [sig('x')]),
      externalReach: dim(r, c, [sig('y')]),
      reversibility: dim(rev, c, [sig('z')]),
    }),
  );

const hintArb = fc.constantFrom(hint.true, hint.false, hint.absent);
const declaredArb: fc.Arbitrary<DeclaredProfile> = fc
  .record({ readOnly: hintArb, destructive: hintArb, openWorld: hintArb }, { requiredKeys: [] })
  .map((h) => declared(h));

describe('property: dedup never double-fires a RuleId on one tool', () => {
  it('no two findings for a tool share a RuleId', () => {
    fc.assert(
      fc.property(profileArb, declaredArb, (p, d) => {
        const ids = classify(p, d).map((f) => f.ruleId as string);
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });
});

describe('property: escalating the derived-vs-declared gap never lowers severity', () => {
  // Against a fixed false destructive claim, walking destructiveness up the concern order can only
  // turn silence into an under-declaration — never soften it. Severity is monotonic in the gap.
  it('read-only → deleting under destructiveHint:false never reduces the emitted severity', () => {
    const worst = (p: ActionRiskProfile, d: DeclaredProfile): number => {
      const rank = ['info', 'low', 'medium', 'high', 'critical'];
      return classify(p, d).reduce((max, f) => {
        const s = rank.indexOf(computeSeverity(f.ruleId, f.verdict, f.confidence));
        return Math.max(max, s);
      }, -1);
    };
    fc.assert(
      fc.property(confidenceArb, (c) => {
        const d = declared({ destructive: hint.false });
        const read = worst(profile({ destructiveness: dim('read-only', c, [sig('x')]) }), d);
        const del = worst(profile({ destructiveness: dim('deleting', c, [sig('x')]) }), d);
        expect(del).toBeGreaterThanOrEqual(read);
      }),
    );
  });
});
