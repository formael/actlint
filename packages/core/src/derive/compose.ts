// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The composer — the conservative judge. It folds all contributions for one tool into an
// `ActionRiskProfile`, one dimension at a time, applying four rules that ARE the engine's
// conscience:
//
//   1. Highest-concern wins within a dimension, weighted. The most-concerning concrete level any
//      contribution argues for is taken; weight and confidence decide how sure we are, not which
//      level wins. A high-weight `deleting` and a low-weight `additive` resolve to `deleting`.
//   2. Confidence is earned, not assumed. It is the strongest support for the winning level, each
//      support floored by its own weight (a low-weight signal cannot alone justify high confidence).
//   3. Conflict resolves toward concern, but lowers confidence. When contributions disagree on the
//      concrete level, the more-concerning one is taken and confidence is capped — under-claiming is
//      the worse error, so a conflicted tool is flagged, but softly.
//   4. Silence is `unknown`, never benign. A dimension with no contribution is
//      `{ level: 'unknown', confidence: 'uncertain' }` — never defaulted to a safe level.
//
// Then blast radius is scored last, inheriting its own uncertainty propagation.

import type {
  ActionRiskProfile,
  Confidence,
  Destructiveness,
  Dimension,
  ExternalReach,
  Idempotency,
  Reversibility,
  SignalRef,
} from '../dimensions.ts';
import { scoreBlastRadius } from './blast-radius.ts';
import { capConfidence, concernRank, levelAtRank, maxConfidence, minConfidence } from './ordinals.ts';
import type { PrimaryDimension } from './primary-dimension.ts';
import { type Contribution, dedupeSignals, weightConfidence } from './types.ts';

// A composed dimension before it is narrowed to its ordinal level type. `level` is always either a
// concrete level of `dimension` or `'unknown'`, so the narrowing casts in `compose` are sound.
interface ComposedDimension {
  readonly level: string;
  readonly confidence: Confidence;
  readonly provenance: readonly SignalRef[];
}

// The silence result: no contribution fired for this dimension. Conservatism rule 4.
function silent(): ComposedDimension {
  return { level: 'unknown', confidence: 'uncertain', provenance: [] };
}

// The earned confidence for a set of contributions supporting the winning level: the strongest
// single support, where each support is floored by its own weight. Corroboration can only help via
// the max; a lone low-weight support stays low.
function earnedConfidence(supporters: readonly Contribution[]): Confidence {
  return supporters.reduce<Confidence>(
    (acc, c) => maxConfidence(acc, minConfidence(weightConfidence(c.weight), c.confidence)),
    'uncertain',
  );
}

function composeDimension(
  dimension: PrimaryDimension,
  contributions: readonly Contribution[],
): ComposedDimension {
  const forDimension = contributions.filter((c) => c.dimension === dimension);
  if (forDimension.length === 0) return silent();

  // The winning level is the most-concerning concrete level argued for (rule 1). Contributions that
  // only argue `unknown` (concernRank -1) are epistemic, not concrete: they never win a level.
  const topRank = Math.max(...forDimension.map((c) => concernRank(dimension, c.level)));
  if (topRank < 0) {
    // Every contribution was `unknown` — a signal explicitly declined to determine a level.
    return { level: 'unknown', confidence: 'uncertain', provenance: refsOf(forDimension) };
  }

  const winningLevel = levelAtRank(dimension, topRank);
  if (winningLevel === undefined) return silent(); // unreachable: topRank came from CONCERN_ORDER

  const supporters = forDimension.filter((c) => c.level === winningLevel);

  // Rule 3: genuine conflict is a *safety-claiming* signal (the concern-rank-0 level: `read-only`,
  // `reversible`, `local`, `idempotent`) contradicting a more-concerning winner — the sharp
  // read-only-vs-mutating case. Disagreement among writing levels (additive vs deleting) is not a
  // contradiction: the most-concerning still wins at its own earned confidence. A contradiction
  // caps confidence toward `uncertain`; the concerning level still stands (under-claiming is worse).
  const contradicted = topRank > 0 && forDimension.some((c) => concernRank(dimension, c.level) === 0);

  let confidence = earnedConfidence(supporters);
  if (contradicted) {
    confidence = capConfidence(confidence, 'low');
    const hasWeightySupport = supporters.some((c) => c.weight === 'high' || c.weight === 'medium');
    if (!hasWeightySupport) confidence = 'uncertain';
  }

  return { level: winningLevel, confidence, provenance: refsOf(supporters) };
}

function refsOf(contributions: readonly Contribution[]): readonly SignalRef[] {
  return dedupeSignals(contributions.map((c) => c.source));
}

/**
 * Fold all contributions for one tool into an `ActionRiskProfile`. The four sensed dimensions are
 * composed independently and conservatively; blast radius is scored from them last. The `level`
 * casts are sound because a composed level is always a concrete level of its dimension or `unknown`.
 */
export function compose(contributions: readonly Contribution[]): ActionRiskProfile {
  const reversibility = composeDimension('reversibility', contributions) as Dimension<Reversibility>;
  const destructiveness = composeDimension('destructiveness', contributions) as Dimension<Destructiveness>;
  const externalReach = composeDimension('externalReach', contributions) as Dimension<ExternalReach>;
  const idempotency = composeDimension('idempotency', contributions) as Dimension<Idempotency>;

  const blastRadius = scoreBlastRadius({ reversibility, destructiveness, externalReach, idempotency });

  return { reversibility, destructiveness, externalReach, idempotency, blastRadius };
}
