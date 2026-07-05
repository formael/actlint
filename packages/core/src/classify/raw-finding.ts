// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// RawFinding — the intermediate the comparator emits before the explainability contract is applied.
// It names WHAT fired (a RuleId, its verdict, the confidence carried over from the driving
// dimension, and the signals that produced it) but has no rationale, no standards mapping, and no
// severity yet. Those are added — and, crucially, *enforced* — only by makeFinding. There is no way
// to turn a RawFinding into a Finding except through that constructor.

import type { Confidence, SignalRef } from '../dimensions.ts';
import type { Verdict } from '../finding.ts';
import type { RuleId } from '../primitives.ts';

export interface RawFinding {
  readonly ruleId: RuleId;
  readonly verdict: Verdict;
  // The confidence of the derived dimension that drove this comparison. It softens severity but
  // never suppresses the finding (Invariant 3).
  readonly confidence: Confidence;
  // The vocabulary signals behind the driving dimension — the provenance a rationale is generated
  // from. May be empty for a rule that fires on a structural absence rather than a positive signal.
  readonly signals: readonly SignalRef[];
}
