// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Ordinal arithmetic for the engine: the concern ranking of dimension levels and the
// four-valued confidence ladder. Both are pure, total functions over closed unions — the
// composer's conservatism (concern-wins, earned confidence) is expressed entirely in terms
// of them, so the judgment lives in one small, auditable place.

import type { Confidence } from '../dimensions.ts';
import {
  DESTRUCTIVENESS_ORDER,
  EXTERNAL_REACH_ORDER,
  IDEMPOTENCY_ORDER,
  REVERSIBILITY_ORDER,
} from '../dimensions.ts';
import type { PrimaryDimension } from './primary-dimension.ts';

// ---------------------------------------------------------------------------
// Concern ranking.
//
// `unknown` is NOT the top of a concern scale — it is the epistemic state "no level was
// determined", and it sits LAST in every dimension's ORDER array for schema reasons only.
// So concern ranks are the ORDER arrays with `unknown` stripped: a concrete level always
// out-ranks `unknown`, and the composer treats an all-`unknown` dimension as silence.
// ---------------------------------------------------------------------------

function withoutUnknown(order: readonly string[]): readonly string[] {
  return order.filter((level) => level !== 'unknown');
}

// The concern order per dimension — least to most concerning, `unknown` excluded. Derived
// from the single source of truth (the dimension ORDER arrays) so the two can never drift;
// a test pins them together and fails loudly if the dimension space changes.
export const CONCERN_ORDER = {
  reversibility: withoutUnknown(REVERSIBILITY_ORDER),
  destructiveness: withoutUnknown(DESTRUCTIVENESS_ORDER),
  externalReach: withoutUnknown(EXTERNAL_REACH_ORDER),
  idempotency: withoutUnknown(IDEMPOTENCY_ORDER),
} as const satisfies Record<PrimaryDimension, readonly string[]>;

/** The concern rank of a level within its dimension, or -1 for `unknown`/unrecognized. */
export function concernRank(dimension: PrimaryDimension, level: string): number {
  return CONCERN_ORDER[dimension].indexOf(level);
}

/** The concrete level at a given concern rank, or `undefined` if the rank is out of range. */
export function levelAtRank(dimension: PrimaryDimension, rank: number): string | undefined {
  return CONCERN_ORDER[dimension][rank];
}

// ---------------------------------------------------------------------------
// The confidence ladder.
// ---------------------------------------------------------------------------

// Least to most confident. `uncertain` is a first-class result that downgrades severity in
// classification but never suppresses a finding (Invariant 3).
const CONFIDENCE_ORDER = ['uncertain', 'low', 'medium', 'high'] as const satisfies readonly Confidence[];

function confidenceRank(confidence: Confidence): number {
  return CONFIDENCE_ORDER.indexOf(confidence);
}

/** The lower (more conservative) of two confidences. */
export function minConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

/** The higher (better-corroborated) of two confidences. */
export function maxConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

/** Clamp a confidence to at most `ceiling` — used when conflict caps how sure we may be. */
export function capConfidence(confidence: Confidence, ceiling: Confidence): Confidence {
  return minConfidence(confidence, ceiling);
}

/** Drop a confidence by one rung (`high`→`medium`→`low`→`uncertain`), never below `uncertain`. */
export function downgradeConfidence(confidence: Confidence): Confidence {
  const rank = confidenceRank(confidence);
  return CONFIDENCE_ORDER[Math.max(0, rank - 1)] ?? 'uncertain';
}

/** The lowest confidence in a non-empty list; `uncertain` for an empty one (no evidence). */
export function minConfidenceOf(confidences: readonly Confidence[]): Confidence {
  if (confidences.length === 0) return 'uncertain';
  return confidences.reduce<Confidence>((acc, c) => minConfidence(acc, c), 'high');
}
