// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

// SignalRef — a pointer to the vocabulary signal that contributed to a dimension assessment.
// Powers generated rationales and "why did this flag?" explanations in the scorecard.
export const signalRefSchema = z
  .object({
    id: z.string().min(1),
    weight: z.enum(['definitive', 'strong', 'weak']),
  })
  .readonly();
export type SignalRef = z.infer<typeof signalRefSchema>;

// Confidence — a first-class result, not a probability we invent.
// 'uncertain' downgrades severity but NEVER suppresses a finding (Invariant 3).
export const confidenceSchema = z.enum(['high', 'medium', 'low', 'uncertain']);
export type Confidence = z.infer<typeof confidenceSchema>;

// ---------------------------------------------------------------------------
// Ordinal dimension levels. ORDER IS SEMANTICALLY LOAD-BEARING.
// Property tests assert monotonicity: a higher ordinal index is more concerning.
// Do not reorder, insert, or collapse levels without a breaking-change semver bump.
// ---------------------------------------------------------------------------

export const reversibilitySchema = z.enum([
  'reversible',
  'recoverable-with-effort',
  'irreversible',
  'unknown',
]);
export type Reversibility = z.infer<typeof reversibilitySchema>;
export const REVERSIBILITY_ORDER: readonly Reversibility[] = [
  'reversible',
  'recoverable-with-effort',
  'irreversible',
  'unknown',
] as const;

export const destructivenessSchema = z.enum(['read-only', 'additive', 'mutating', 'deleting', 'unknown']);
export type Destructiveness = z.infer<typeof destructivenessSchema>;
export const DESTRUCTIVENESS_ORDER: readonly Destructiveness[] = [
  'read-only',
  'additive',
  'mutating',
  'deleting',
  'unknown',
] as const;

export const externalReachSchema = z.enum(['local', 'org-internal', 'open-world', 'unknown']);
export type ExternalReach = z.infer<typeof externalReachSchema>;
export const EXTERNAL_REACH_ORDER: readonly ExternalReach[] = [
  'local',
  'org-internal',
  'open-world',
  'unknown',
] as const;

export const idempotencySchema = z.enum(['idempotent', 'non-idempotent', 'unknown']);
export type Idempotency = z.infer<typeof idempotencySchema>;
export const IDEMPOTENCY_ORDER: readonly Idempotency[] = ['idempotent', 'non-idempotent', 'unknown'] as const;

// BlastRadius — composite of the four primary dimensions; computed by the vocabulary scoring function.
// Confidence can never exceed the minimum confidence of its contributing dimensions (conservatism).
export const blastRadiusSchema = z.enum(['contained', 'moderate', 'severe', 'critical', 'unknown']);
export type BlastRadius = z.infer<typeof blastRadiusSchema>;
export const BLAST_RADIUS_ORDER: readonly BlastRadius[] = [
  'contained',
  'moderate',
  'severe',
  'critical',
  'unknown',
] as const;

// Dimension<L> — one axis of derived risk: level + confidence + the signals that produced it.
export interface Dimension<L extends string> {
  readonly level: L;
  readonly confidence: Confidence;
  readonly provenance: readonly SignalRef[];
}

// Helper that builds a typed Zod dimension schema from a given level enum schema.
function dimensionSchema<L extends z.ZodType<string>>(levelSchema: L) {
  return z
    .object({
      level: levelSchema,
      confidence: confidenceSchema,
      provenance: z.array(signalRefSchema).readonly(),
    })
    .readonly();
}

export const reversibilityDimensionSchema = dimensionSchema(reversibilitySchema);
export const destructivenessDimensionSchema = dimensionSchema(destructivenessSchema);
export const externalReachDimensionSchema = dimensionSchema(externalReachSchema);
export const idempotencyDimensionSchema = dimensionSchema(idempotencySchema);
export const blastRadiusDimensionSchema = dimensionSchema(blastRadiusSchema);

export const actionRiskProfileSchema = z
  .object({
    reversibility: reversibilityDimensionSchema,
    destructiveness: destructivenessDimensionSchema,
    externalReach: externalReachDimensionSchema,
    idempotency: idempotencyDimensionSchema,
    blastRadius: blastRadiusDimensionSchema,
  })
  .readonly();
export type ActionRiskProfile = z.infer<typeof actionRiskProfileSchema>;
