// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  DESTRUCTIVENESS_ORDER,
  EXTERNAL_REACH_ORDER,
  IDEMPOTENCY_ORDER,
  REVERSIBILITY_ORDER,
} from '../dimensions.ts';
import {
  CONCERN_ORDER,
  capConfidence,
  concernRank,
  downgradeConfidence,
  maxConfidence,
  minConfidence,
  minConfidenceOf,
} from './ordinals.ts';

// The loud-failure check: the engine's concern ranking is the dimension ORDER with `unknown`
// stripped. If a level is added, removed, or reordered in `dimensions.ts` and this file is not
// updated in lockstep, this test fails — the dimension space cannot drift silently.
describe('CONCERN_ORDER is pinned to the dimension ORDER arrays', () => {
  const cases = [
    ['reversibility', CONCERN_ORDER.reversibility, REVERSIBILITY_ORDER],
    ['destructiveness', CONCERN_ORDER.destructiveness, DESTRUCTIVENESS_ORDER],
    ['externalReach', CONCERN_ORDER.externalReach, EXTERNAL_REACH_ORDER],
    ['idempotency', CONCERN_ORDER.idempotency, IDEMPOTENCY_ORDER],
  ] as const;

  for (const [name, concern, order] of cases) {
    it(`${name}: concern order equals dimension order minus 'unknown', in the same sequence`, () => {
      expect([...concern]).toEqual(order.filter((level) => level !== 'unknown'));
      expect(concern).not.toContain('unknown');
    });
  }
});

describe('concernRank', () => {
  it('ranks concrete levels least-to-most concerning', () => {
    expect(concernRank('destructiveness', 'read-only')).toBe(0);
    expect(concernRank('destructiveness', 'deleting')).toBe(3);
    expect(concernRank('destructiveness', 'read-only')).toBeLessThan(
      concernRank('destructiveness', 'mutating'),
    );
  });

  it('returns -1 for `unknown` — it is not a point on the concern scale', () => {
    expect(concernRank('destructiveness', 'unknown')).toBe(-1);
    expect(concernRank('reversibility', 'nonsense')).toBe(-1);
  });
});

describe('confidence ladder', () => {
  it('min/max pick the conservative and optimistic bounds', () => {
    expect(minConfidence('high', 'low')).toBe('low');
    expect(maxConfidence('uncertain', 'medium')).toBe('medium');
    expect(minConfidence('medium', 'medium')).toBe('medium');
  });

  it('capConfidence clamps to a ceiling', () => {
    expect(capConfidence('high', 'low')).toBe('low');
    expect(capConfidence('uncertain', 'high')).toBe('uncertain');
  });

  it('downgradeConfidence drops one rung, never below uncertain', () => {
    expect(downgradeConfidence('high')).toBe('medium');
    expect(downgradeConfidence('low')).toBe('uncertain');
    expect(downgradeConfidence('uncertain')).toBe('uncertain');
  });

  it('minConfidenceOf is the lowest of a list, uncertain when empty', () => {
    expect(minConfidenceOf(['high', 'medium', 'low'])).toBe('low');
    expect(minConfidenceOf(['high', 'high'])).toBe('high');
    expect(minConfidenceOf([])).toBe('uncertain');
  });
});
