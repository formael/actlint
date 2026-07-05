// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Test builders for the classification suites — terse constructors for derived profiles and
// declared profiles so a fixture reads as the scenario it encodes. Not part of the shipped surface
// (never imported by index.ts); pure (types and literals only), so it stays clean under the guards.

import type { DeclaredHint, DeclaredProfile } from '../declared.ts';
import type { ActionRiskProfile, Confidence, Dimension, SignalRef } from '../dimensions.ts';

export function sig(id: string, weight: SignalRef['weight'] = 'definitive'): SignalRef {
  return { id, weight };
}

export function dim<L extends string>(
  level: L,
  confidence: Confidence = 'high',
  provenance: readonly SignalRef[] = [],
): Dimension<L> {
  return { level, confidence, provenance };
}

// A clean, benign baseline profile: a pure local read at high confidence. Override any dimension.
export function profile(overrides: Partial<ActionRiskProfile> = {}): ActionRiskProfile {
  return {
    reversibility: dim('reversible'),
    destructiveness: dim('read-only'),
    externalReach: dim('local'),
    idempotency: dim('idempotent'),
    blastRadius: dim('contained'),
    ...overrides,
  };
}

export const hint = {
  true: { state: 'true' } as DeclaredHint,
  false: { state: 'false' } as DeclaredHint,
  absent: { state: 'absent' } as DeclaredHint,
};

// A declared profile from a partial; anything omitted is absent (the honest silence state).
export function declared(overrides: Partial<Omit<DeclaredProfile, 'unknownHints'>> = {}): DeclaredProfile {
  return { unknownHints: {}, ...overrides };
}
