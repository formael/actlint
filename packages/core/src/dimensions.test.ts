// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  actionRiskProfileSchema,
  BLAST_RADIUS_ORDER,
  blastRadiusSchema,
  confidenceSchema,
  DESTRUCTIVENESS_ORDER,
  destructivenessSchema,
  EXTERNAL_REACH_ORDER,
  externalReachSchema,
  IDEMPOTENCY_ORDER,
  idempotencySchema,
  REVERSIBILITY_ORDER,
  reversibilitySchema,
  signalRefSchema,
} from './dimensions.ts';

describe('confidenceSchema', () => {
  it.each(['high', 'medium', 'low', 'uncertain'])('accepts "%s"', (v) => {
    expect(confidenceSchema.safeParse(v).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(confidenceSchema.safeParse('very-high').success).toBe(false);
  });
});

describe('signalRefSchema', () => {
  it('accepts a valid signal ref', () => {
    expect(signalRefSchema.safeParse({ id: 'writes-disk', weight: 'strong' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    expect(signalRefSchema.safeParse({ id: '', weight: 'weak' }).success).toBe(false);
  });

  it('rejects unknown weight', () => {
    expect(signalRefSchema.safeParse({ id: 'x', weight: 'absolute' }).success).toBe(false);
  });
});

describe('ordinal level schemas round-trip', () => {
  it.each(REVERSIBILITY_ORDER)('reversibility "%s"', (v) => {
    expect(reversibilitySchema.safeParse(v).success).toBe(true);
  });

  it.each(DESTRUCTIVENESS_ORDER)('destructiveness "%s"', (v) => {
    expect(destructivenessSchema.safeParse(v).success).toBe(true);
  });

  it.each(EXTERNAL_REACH_ORDER)('externalReach "%s"', (v) => {
    expect(externalReachSchema.safeParse(v).success).toBe(true);
  });

  it.each(IDEMPOTENCY_ORDER)('idempotency "%s"', (v) => {
    expect(idempotencySchema.safeParse(v).success).toBe(true);
  });

  it.each(BLAST_RADIUS_ORDER)('blastRadius "%s"', (v) => {
    expect(blastRadiusSchema.safeParse(v).success).toBe(true);
  });
});

describe('ordinal order arrays are contiguous and complete', () => {
  it('reversibility order covers all schema values', () => {
    const schemaValues = reversibilitySchema.options as readonly string[];
    expect([...REVERSIBILITY_ORDER].sort()).toEqual([...schemaValues].sort());
  });

  it('destructiveness order covers all schema values', () => {
    const schemaValues = destructivenessSchema.options as readonly string[];
    expect([...DESTRUCTIVENESS_ORDER].sort()).toEqual([...schemaValues].sort());
  });

  it('externalReach order covers all schema values', () => {
    const schemaValues = externalReachSchema.options as readonly string[];
    expect([...EXTERNAL_REACH_ORDER].sort()).toEqual([...schemaValues].sort());
  });

  it('idempotency order covers all schema values', () => {
    const schemaValues = idempotencySchema.options as readonly string[];
    expect([...IDEMPOTENCY_ORDER].sort()).toEqual([...schemaValues].sort());
  });

  it('blastRadius order covers all schema values', () => {
    const schemaValues = blastRadiusSchema.options as readonly string[];
    expect([...BLAST_RADIUS_ORDER].sort()).toEqual([...schemaValues].sort());
  });
});

const signalRefArb = fc.record({
  id: fc.string({ minLength: 1 }),
  weight: fc.constantFrom('definitive' as const, 'strong' as const, 'weak' as const),
});

const validDimensionArb = <T extends string>(levels: readonly T[]) =>
  fc.record({
    level: fc.constantFrom(...(levels as [T, ...T[]])),
    confidence: fc.constantFrom('high' as const, 'medium' as const, 'low' as const, 'uncertain' as const),
    provenance: fc.array(signalRefArb, { maxLength: 5 }),
  });

describe('actionRiskProfileSchema', () => {
  it('accepts a fully valid profile', () => {
    const valid = {
      reversibility: { level: 'irreversible', confidence: 'high', provenance: [] },
      destructiveness: { level: 'deleting', confidence: 'high', provenance: [] },
      externalReach: { level: 'open-world', confidence: 'medium', provenance: [] },
      idempotency: { level: 'non-idempotent', confidence: 'low', provenance: [] },
      blastRadius: { level: 'critical', confidence: 'uncertain', provenance: [] },
    };
    expect(actionRiskProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid dimension level', () => {
    const invalid = {
      reversibility: { level: 'fully-reversible', confidence: 'high', provenance: [] },
      destructiveness: { level: 'deleting', confidence: 'high', provenance: [] },
      externalReach: { level: 'open-world', confidence: 'medium', provenance: [] },
      idempotency: { level: 'non-idempotent', confidence: 'low', provenance: [] },
      blastRadius: { level: 'critical', confidence: 'uncertain', provenance: [] },
    };
    expect(actionRiskProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('property: always accepts any valid combination of ordinal levels', () => {
    const profileArb = fc.record({
      reversibility: validDimensionArb(REVERSIBILITY_ORDER),
      destructiveness: validDimensionArb(DESTRUCTIVENESS_ORDER),
      externalReach: validDimensionArb(EXTERNAL_REACH_ORDER),
      idempotency: validDimensionArb(IDEMPOTENCY_ORDER),
      blastRadius: validDimensionArb(BLAST_RADIUS_ORDER),
    });

    fc.assert(
      fc.property(profileArb, (profile) => {
        return actionRiskProfileSchema.safeParse(profile).success;
      }),
    );
  });
});
