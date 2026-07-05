// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { BLAST_RADIUS_ORDER, type Confidence, type Dimension, type SignalRef } from '../dimensions.ts';
import { scoreBlastRadius } from './blast-radius.ts';
import { CONCERN_ORDER } from './ordinals.ts';

function dim<L extends string>(
  level: L,
  confidence: Confidence = 'high',
  provenance: readonly SignalRef[] = [],
): Dimension<L> {
  return { level, confidence, provenance };
}

const UNKNOWN = dim('unknown');
const bandIndex = (level: string): number => BLAST_RADIUS_ORDER.indexOf(level as never);

describe('scoreBlastRadius — bands', () => {
  it('a pure read is contained', () => {
    const b = scoreBlastRadius({
      destructiveness: dim('read-only'),
      reversibility: UNKNOWN,
      externalReach: UNKNOWN,
      idempotency: UNKNOWN,
    });
    expect(b.level).toBe('contained');
  });

  it('a delete that is irreversible is at least severe', () => {
    const b = scoreBlastRadius({
      destructiveness: dim('deleting'),
      reversibility: dim('irreversible'),
      externalReach: UNKNOWN,
      idempotency: UNKNOWN,
    });
    expect(bandIndex(b.level)).toBeGreaterThanOrEqual(bandIndex('severe'));
  });

  it('a delete that also reaches the open world is critical', () => {
    const b = scoreBlastRadius({
      destructiveness: dim('deleting'),
      reversibility: dim('irreversible'),
      externalReach: dim('open-world'),
      idempotency: dim('non-idempotent'),
    });
    expect(b.level).toBe('critical');
  });

  it('an irreversible outbound send is severe', () => {
    const b = scoreBlastRadius({
      destructiveness: UNKNOWN,
      reversibility: dim('irreversible'),
      externalReach: dim('open-world'),
      idempotency: dim('non-idempotent'),
    });
    expect(b.level).toBe('severe');
  });

  it('all-unknown inputs yield `unknown`, never a benign `contained`', () => {
    const b = scoreBlastRadius({
      destructiveness: UNKNOWN,
      reversibility: UNKNOWN,
      externalReach: UNKNOWN,
      idempotency: UNKNOWN,
    });
    expect(b.level).toBe('unknown');
    expect(b.confidence).toBe('uncertain');
    expect(b.provenance).toEqual([]);
  });
});

// Arbitrary over CONCRETE levels of a dimension (never `unknown` — `unknown` is not a point on the
// concern scale, so monotonicity is asserted over the concern order, exactly as the invariant reads).
const concreteLevelArb = <D extends keyof typeof CONCERN_ORDER>(dimension: D) =>
  fc.nat({ max: CONCERN_ORDER[dimension].length - 1 });

const concreteProfileArb = fc.record({
  destructiveness: concreteLevelArb('destructiveness'),
  reversibility: concreteLevelArb('reversibility'),
  externalReach: concreteLevelArb('externalReach'),
  idempotency: concreteLevelArb('idempotency'),
});

function profileFromRanks(ranks: {
  destructiveness: number;
  reversibility: number;
  externalReach: number;
  idempotency: number;
}) {
  return {
    destructiveness: dim(CONCERN_ORDER.destructiveness[ranks.destructiveness] as string),
    reversibility: dim(CONCERN_ORDER.reversibility[ranks.reversibility] as string),
    externalReach: dim(CONCERN_ORDER.externalReach[ranks.externalReach] as string),
    idempotency: dim(CONCERN_ORDER.idempotency[ranks.idempotency] as string),
  } as Parameters<typeof scoreBlastRadius>[0];
}

describe('scoreBlastRadius — laws', () => {
  it('is monotonic: raising any input to a more-concerning level never lowers the band', () => {
    const dimensions = ['destructiveness', 'reversibility', 'externalReach', 'idempotency'] as const;
    fc.assert(
      fc.property(concreteProfileArb, (ranks) => {
        for (const d of dimensions) {
          if (ranks[d] >= CONCERN_ORDER[d].length - 1) continue;
          const lower = scoreBlastRadius(profileFromRanks(ranks));
          const higher = scoreBlastRadius(profileFromRanks({ ...ranks, [d]: ranks[d] + 1 }));
          expect(bandIndex(higher.level)).toBeGreaterThanOrEqual(bandIndex(lower.level));
        }
      }),
    );
  });

  it('a tool mapped `irreversible` never scores below the same tool mapped `reversible`', () => {
    fc.assert(
      fc.property(concreteProfileArb, (ranks) => {
        const reversible = scoreBlastRadius(profileFromRanks({ ...ranks, reversibility: 0 }));
        const irreversible = scoreBlastRadius(
          profileFromRanks({ ...ranks, reversibility: CONCERN_ORDER.reversibility.length - 1 }),
        );
        expect(bandIndex(irreversible.level)).toBeGreaterThanOrEqual(bandIndex(reversible.level));
      }),
    );
  });

  it('confidence never exceeds the minimum confidence of the inputs it relied on', () => {
    const order: Confidence[] = ['uncertain', 'low', 'medium', 'high'];
    const b = scoreBlastRadius({
      destructiveness: dim('deleting', 'high'),
      reversibility: dim('irreversible', 'low'),
      externalReach: dim('open-world', 'medium'),
      idempotency: dim('non-idempotent', 'medium'),
    });
    // Relied on all four (all concrete); min was `low`, no unknown inputs, so confidence is `low`.
    expect(order.indexOf(b.confidence)).toBeLessThanOrEqual(order.indexOf('low'));
    expect(b.confidence).toBe('low');
  });

  it('a missing (unknown) input propagates a further downgrade of confidence', () => {
    const b = scoreBlastRadius({
      destructiveness: dim('deleting', 'high'),
      reversibility: UNKNOWN,
      externalReach: UNKNOWN,
      idempotency: UNKNOWN,
    });
    // Relied only on destructiveness (high), but three unknowns downgrade one rung to `medium`.
    expect(b.confidence).toBe('medium');
  });

  it('carries the provenance of exactly the inputs that drove the score', () => {
    const del: SignalRef = { id: 'verb.delete', weight: 'definitive' };
    const reach: SignalRef = { id: 'shape.destination-format', weight: 'definitive' };
    const b = scoreBlastRadius({
      destructiveness: dim('deleting', 'high', [del]),
      reversibility: UNKNOWN,
      externalReach: dim('open-world', 'high', [reach]),
      idempotency: UNKNOWN,
    });
    expect(b.provenance).toEqual([reach, del]); // deduped and sorted by id
  });
});
