// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Weight } from '@formael/action-risk-vocabulary';
import type { Confidence } from '../dimensions.ts';
import { compose } from './compose.ts';
import { concernRank } from './ordinals.ts';
import type { PrimaryDimension } from './primary-dimension.ts';
import { type Contribution, toSignalWeight } from './types.ts';

let seq = 0;
function c(
  dimension: PrimaryDimension,
  level: string,
  weight: Weight,
  confidence: Confidence,
  id = `e${seq++}`,
): Contribution {
  return { dimension, level, weight, confidence, source: { id, weight: toSignalWeight(weight) } };
}

describe('rule 1 — highest concern wins within a dimension, weighted', () => {
  it('a single high-weight `deleting` beats three low-weight `additive`s', () => {
    const profile = compose([
      c('destructiveness', 'deleting', 'high', 'high'),
      c('destructiveness', 'additive', 'low', 'low'),
      c('destructiveness', 'additive', 'low', 'low'),
      c('destructiveness', 'additive', 'low', 'low'),
    ]);
    expect(profile.destructiveness.level).toBe('deleting');
  });
});

describe('rule 2 — confidence is earned, not assumed', () => {
  it('a lone high-weight, high-confidence signal earns high confidence', () => {
    expect(compose([c('destructiveness', 'deleting', 'high', 'high')]).destructiveness.confidence).toBe(
      'high',
    );
  });

  it('a lone low-weight signal stays low, even if the entry claims more', () => {
    // weight floors confidence: a low-weight signal cannot alone justify high confidence.
    expect(compose([c('destructiveness', 'deleting', 'low', 'high')]).destructiveness.confidence).toBe('low');
  });

  it('corroborating signals at the same level take the strongest support', () => {
    const profile = compose([
      c('destructiveness', 'deleting', 'low', 'low'),
      c('destructiveness', 'deleting', 'high', 'high'),
    ]);
    expect(profile.destructiveness.confidence).toBe('high');
  });
});

describe('rule 3 — conflict resolves toward concern, but lowers confidence', () => {
  it('read-only vs mutating resolves to mutating with capped confidence', () => {
    const profile = compose([
      c('destructiveness', 'read-only', 'high', 'high'),
      c('destructiveness', 'mutating', 'medium', 'medium'),
    ]);
    expect(profile.destructiveness.level).toBe('mutating');
    expect(profile.destructiveness.confidence).toBe('low');
  });

  it('a safety claim contradicting only a weak concerning signal drops to uncertain', () => {
    const profile = compose([
      c('destructiveness', 'read-only', 'high', 'high'),
      c('destructiveness', 'deleting', 'low', 'low'),
    ]);
    expect(profile.destructiveness.level).toBe('deleting');
    expect(profile.destructiveness.confidence).toBe('uncertain');
  });

  it('disagreement among writing levels is not a contradiction — the concerning level keeps its confidence', () => {
    const profile = compose([
      c('destructiveness', 'additive', 'medium', 'medium'),
      c('destructiveness', 'deleting', 'high', 'high'),
    ]);
    expect(profile.destructiveness.level).toBe('deleting');
    expect(profile.destructiveness.confidence).toBe('high');
  });
});

describe('rule 4 — silence is unknown, never benign', () => {
  it('a dimension with no contribution is unknown/uncertain with empty provenance', () => {
    const profile = compose([c('destructiveness', 'deleting', 'high', 'high')]);
    for (const dimension of ['reversibility', 'externalReach', 'idempotency'] as const) {
      expect(profile[dimension]).toEqual({ level: 'unknown', confidence: 'uncertain', provenance: [] });
    }
  });

  it('no contributions at all yields an all-unknown profile and unknown blast radius', () => {
    const profile = compose([]);
    expect(profile.destructiveness.level).toBe('unknown');
    expect(profile.blastRadius).toEqual({ level: 'unknown', confidence: 'uncertain', provenance: [] });
  });

  it('a contribution that only argues `unknown` keeps the level unknown but records provenance', () => {
    const profile = compose([c('externalReach', 'unknown', 'low', 'low', 'shape.freeform')]);
    expect(profile.externalReach.level).toBe('unknown');
    expect(profile.externalReach.provenance).toEqual([{ id: 'shape.freeform', weight: 'weak' }]);
  });
});

describe('provenance', () => {
  it('is deduplicated by entry id and sorted, for byte-identical output', () => {
    const profile = compose([
      c('destructiveness', 'deleting', 'high', 'high', 'verb.delete'),
      c('destructiveness', 'deleting', 'low', 'low', 'phrase.deletion'),
    ]);
    expect(profile.destructiveness.provenance.map((r) => r.id)).toEqual(['phrase.deletion', 'verb.delete']);
  });
});

describe('property — adding a contribution never lowers a derived concern level', () => {
  const contributionArb: fc.Arbitrary<Contribution> = fc
    .record({
      dimension: fc.constantFrom<PrimaryDimension>(
        'reversibility',
        'destructiveness',
        'externalReach',
        'idempotency',
      ),
      levelPick: fc.nat({ max: 3 }),
      weight: fc.constantFrom<Weight>('high', 'medium', 'low'),
      confidence: fc.constantFrom<Confidence>('high', 'medium', 'low', 'uncertain'),
    })
    .map(({ dimension, levelPick, weight, confidence }) => {
      const order = { reversibility: 3, destructiveness: 4, externalReach: 3, idempotency: 2 }[dimension];
      const levels: Record<PrimaryDimension, string[]> = {
        reversibility: ['reversible', 'recoverable-with-effort', 'irreversible', 'unknown'],
        destructiveness: ['read-only', 'additive', 'mutating', 'deleting'],
        externalReach: ['local', 'org-internal', 'open-world', 'unknown'],
        idempotency: ['idempotent', 'non-idempotent', 'unknown'],
      };
      const level = levels[dimension][levelPick % order] as string;
      return {
        dimension,
        level,
        weight,
        confidence,
        source: { id: `e${levelPick}`, weight: toSignalWeight(weight) },
      };
    });

  it('the winning concern rank is monotonic under adding contributions', () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 8 }), contributionArb, (base, extra) => {
        const dims: PrimaryDimension[] = ['reversibility', 'destructiveness', 'externalReach', 'idempotency'];
        const before = compose(base);
        const after = compose([...base, extra]);
        for (const d of dims) {
          expect(concernRank(d, after[d].level)).toBeGreaterThanOrEqual(concernRank(d, before[d].level));
        }
      }),
    );
  });
});
