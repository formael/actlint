// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The engine's internal currency between the two phases: a `Contribution` is one weighted,
// provenance-tagged argument that a signal makes about one dimension. Extractors emit them; the
// composer folds them into an `ActionRiskProfile`.

import type { Weight } from '@formael/action-risk-vocabulary';
import type { ActionRiskProfile, Confidence, SignalRef } from '../dimensions.ts';
import type { PrimaryDimension } from './primary-dimension.ts';

// One weighted argument for a dimension level, carrying the vocabulary entry that produced it.
export interface Contribution {
  readonly dimension: PrimaryDimension;
  readonly level: string; // an ordinal level for `dimension`; validated against it by the composer
  readonly weight: Weight; // how strongly the entry argues (drives concern-wins and earned confidence)
  readonly confidence: Confidence; // the entry's own confidence, floored against its weight downstream
  readonly source: SignalRef; // { id, weight } — the provenance that makes the rationale generated
}

// The engine's output: the profile plus every distinct signal that fired, so a caller can render
// "why did this flag?" without the engine having authored a single explanation string.
export interface DerivationResult {
  readonly profile: ActionRiskProfile;
  readonly signals: readonly SignalRef[];
}

// A vocabulary `weight` (how strongly a *judgment* is argued) maps to a `SignalRef` weight (how a
// *fired signal* reads in provenance). One ladder, two vocabularies; kept in one place.
export function toSignalWeight(weight: Weight): SignalRef['weight'] {
  switch (weight) {
    case 'high':
      return 'definitive';
    case 'medium':
      return 'strong';
    case 'low':
      return 'weak';
  }
}

// A vocabulary `weight` also seeds a confidence ceiling: a low-weight signal can never, on its own,
// justify high confidence. The composer takes the min of this and the entry's declared confidence.
export function weightConfidence(weight: Weight): Confidence {
  switch (weight) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
  }
}

const SIGNAL_WEIGHT_RANK: Record<SignalRef['weight'], number> = { weak: 0, strong: 1, definitive: 2 };

/**
 * Deduplicate signal refs by entry id, keeping the strongest weight seen, and sort by id. One
 * vocabulary entry can argue for several dimensions; it should appear once in a provenance list,
 * at its strongest. Stable ordering is what makes serialized findings byte-identical across runs.
 */
export function dedupeSignals(refs: readonly SignalRef[]): readonly SignalRef[] {
  const strongestById = new Map<string, SignalRef>();
  for (const ref of refs) {
    const existing = strongestById.get(ref.id);
    if (existing === undefined || SIGNAL_WEIGHT_RANK[ref.weight] > SIGNAL_WEIGHT_RANK[existing.weight]) {
      strongestById.set(ref.id, ref);
    }
  }
  return [...strongestById.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
