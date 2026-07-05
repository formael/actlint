// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// scoreBlastRadius — the one composite, and the one place a careless linter becomes a fear
// machine. It lives in `core` (mechanism), never in `vocabulary` (data): it is a small, explicit,
// property-tested pure function, not a lookup table. Three laws govern it, each a property test:
//
//   1. Monotonic in severity — raising any input to a more-concerning level never lowers the score.
//   2. Uncertainty propagates — the composite's confidence is at most the minimum of the inputs it
//      relied on, and it is dropped a further rung when any input is `unknown`. It never resolves an
//      `unknown` input to a benign default: when nothing concrete is known, the level is `unknown`.
//   3. Explained — the returned dimension carries the provenance of exactly the inputs that drove it.

import type {
  BlastRadius,
  Destructiveness,
  Dimension,
  ExternalReach,
  Idempotency,
  Reversibility,
  SignalRef,
} from '../dimensions.ts';
import { concernRank, downgradeConfidence, minConfidenceOf } from './ordinals.ts';
import type { PrimaryDimension } from './primary-dimension.ts';
import { dedupeSignals } from './types.ts';

// Named weights, each with a one-line justification — the opposite of magic numbers. They encode
// how much each dimension widens the radius of a single action. A change here is judgment-adjacent
// and human-gated. Monotonicity holds for any positive weights, so tuning these is safe by design.
const BLAST_WEIGHTS = {
  destructiveness: 3, // primary driver: what the action does to state is the core of blast radius
  reversibility: 2, // multiplier of harm: an effect that cannot be undone costs far more
  externalReach: 2, // widens the radius: an effect that escapes the local boundary reaches further
  idempotency: 1, // minor modifier: whether repeating the call compounds the effect
} as const satisfies Record<PrimaryDimension, number>;

// Score thresholds → blast-radius band. Non-decreasing, so the mapping is itself monotonic.
// Calibrated against worked cases: read-only → contained; create/update/free-form → moderate;
// delete (deletes + irreversible) and outbound send → severe; delete that also reaches the open
// world → critical. Max attainable score is 3·3 + 2·2 + 2·2 + 1·1 = 18.
const CRITICAL_AT = 14;
const SEVERE_AT = 8;
const MODERATE_AT = 2;

function bandFor(score: number): BlastRadius {
  if (score >= CRITICAL_AT) return 'critical';
  if (score >= SEVERE_AT) return 'severe';
  if (score >= MODERATE_AT) return 'moderate';
  return 'contained';
}

interface BlastInputs {
  readonly reversibility: Dimension<Reversibility>;
  readonly destructiveness: Dimension<Destructiveness>;
  readonly externalReach: Dimension<ExternalReach>;
  readonly idempotency: Dimension<Idempotency>;
}

/**
 * Combine the four sensed dimensions into the blast-radius composite. Pure, deterministic,
 * monotonic, and uncertainty-propagating. When every input is `unknown`, returns `unknown` — never
 * a benign `contained` — because absence of evidence of danger is not evidence of safety.
 */
export function scoreBlastRadius(inputs: BlastInputs): Dimension<BlastRadius> {
  const dimensions: readonly [PrimaryDimension, Dimension<string>][] = [
    ['destructiveness', inputs.destructiveness],
    ['reversibility', inputs.reversibility],
    ['externalReach', inputs.externalReach],
    ['idempotency', inputs.idempotency],
  ];

  let score = 0;
  let unknownCount = 0;
  const reliedOnConfidences: Dimension<string>['confidence'][] = [];
  const provenance: SignalRef[] = [];

  for (const [name, dimension] of dimensions) {
    const severity = concernRank(name, dimension.level); // -1 for `unknown`
    if (severity < 0) {
      unknownCount += 1;
      continue;
    }
    score += BLAST_WEIGHTS[name] * severity;
    reliedOnConfidences.push(dimension.confidence);
    provenance.push(...dimension.provenance);
  }

  // Nothing concrete to score: the honest, conservative answer is `unknown`, not `contained`.
  if (reliedOnConfidences.length === 0) {
    return { level: 'unknown', confidence: 'uncertain', provenance: [] };
  }

  const confidence = minConfidenceOf(reliedOnConfidences);
  // Any missing dimension could only raise the true radius, so a partial view is less certain.
  const propagated = unknownCount > 0 ? downgradeConfidence(confidence) : confidence;

  return { level: bandFor(score), confidence: propagated, provenance: dedupeSignals(provenance) };
}
