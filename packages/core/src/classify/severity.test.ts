// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Severity is computed from the published policy, softened by confidence, never hand-assigned.
// These tests pin the policy's consequences and the two laws that matter: confidence only steps a
// finding DOWN (never up, never away), and a more-severe verdict is never less severe.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Confidence } from '../dimensions.ts';
import type { Severity, Verdict } from '../finding.ts';
import { RULE } from './rule-ids.ts';
import { computeSeverity } from './severity.ts';

const LADDER: readonly Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
const rank = (s: Severity): number => LADDER.indexOf(s);

describe('honesty severity from verdict + confidence', () => {
  it('under-declared at high confidence is critical — the flagship claim', () => {
    expect(computeSeverity(RULE.writeAsReadonly, 'under-declared', 'high')).toBe('critical');
  });

  it('under-declared softens with confidence but is never suppressed', () => {
    expect(computeSeverity(RULE.writeAsReadonly, 'under-declared', 'low')).toBe('high'); // -1
    expect(computeSeverity(RULE.writeAsReadonly, 'under-declared', 'uncertain')).toBe('medium'); // -2
  });

  it('undeclared is low (the spec default already covers it), and dips no lower than info', () => {
    expect(computeSeverity(RULE.destructiveAbsent, 'undeclared', 'high')).toBe('low');
    expect(computeSeverity(RULE.destructiveAbsent, 'undeclared', 'uncertain')).toBe('info');
  });

  it('over-declared is low; consistent is info', () => {
    expect(computeSeverity(RULE.overDeclaredRisk, 'over-declared', 'high')).toBe('low');
    expect(computeSeverity(RULE.overDeclaredRisk, 'consistent', 'high')).toBe('info');
  });
});

// The gate boundary is the single most consequential cell in the severity policy: it decides which
// softened findings break a default CI gate (--fail-on high). Uncertain never gates; low may gate.
describe('gate-boundary fixtures: uncertain never gates, low confidence may gate', () => {
  it('destructive-unflagged under-declared at uncertain → medium (below --fail-on high, does not gate)', () => {
    expect(computeSeverity(RULE.destructiveUnflagged, 'under-declared', 'uncertain')).toBe('medium');
  });

  it('destructive-unflagged under-declared at low → high (at --fail-on high, gates)', () => {
    expect(computeSeverity(RULE.destructiveUnflagged, 'under-declared', 'low')).toBe('high');
  });
});

describe('advisory severity is a floor, independent of confidence', () => {
  it('advisory rules sit at medium regardless of the confidence carried', () => {
    for (const c of ['high', 'medium', 'low', 'uncertain'] as const) {
      expect(computeSeverity(RULE.freeformInputAsCode, 'undeclared', c)).toBe('medium');
      expect(computeSeverity(RULE.noScopeConstraint, 'undeclared', c)).toBe('medium');
    }
  });
});

// ---------------------------------------------------------------------------
// Property laws.
// ---------------------------------------------------------------------------

const verdictArb = fc.constantFrom<Verdict>('under-declared', 'undeclared', 'over-declared', 'consistent');
const confidenceArb = fc.constantFrom<Confidence>('high', 'medium', 'low', 'uncertain');
const CONFIDENCE_RANK: Record<Confidence, number> = { uncertain: 0, low: 1, medium: 2, high: 3 };

describe('property: confidence only steps severity down, never up', () => {
  it('for a fixed verdict, higher confidence is never less severe', () => {
    fc.assert(
      fc.property(verdictArb, confidenceArb, confidenceArb, (verdict, a, b) => {
        const [lo, hi] = CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? [a, b] : [b, a];
        const loSev = rank(computeSeverity(RULE.writeAsReadonly, verdict, lo));
        const hiSev = rank(computeSeverity(RULE.writeAsReadonly, verdict, hi));
        expect(hiSev).toBeGreaterThanOrEqual(loSev);
      }),
    );
  });
});

describe('property: a more-severe verdict is never less severe', () => {
  // under-declared ≥ undeclared, over-declared ≥ consistent, at any fixed confidence.
  it('under-declared dominates undeclared at the same confidence', () => {
    fc.assert(
      fc.property(confidenceArb, (c) => {
        const under = rank(computeSeverity(RULE.writeAsReadonly, 'under-declared', c));
        const un = rank(computeSeverity(RULE.writeAsReadonly, 'undeclared', c));
        expect(under).toBeGreaterThanOrEqual(un);
      }),
    );
  });
});
