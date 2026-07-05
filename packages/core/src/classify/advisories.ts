// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Advisory findings — capability HYGIENE, not honesty. They fire on schema-shape properties that
// have no MCP hint to be honest or dishonest about, so they are never verdict-bearing, never touch
// the honesty grade, and are non-gating by default. They are still surfaced, still actionable, and
// still appear in machine output — reporters filter them on their advisory rule class.
//
// Because there is no declared side to compare against, these are derived from the schema shape and
// the vocabulary signals the engine already fired — not from the declared profile.

import { collectParams } from '../derive/schema-reader.ts';
import type { ActionRiskProfile, Confidence, SignalRef } from '../dimensions.ts';
import type { JsonSchema } from '../manifest.ts';
import type { RawFinding } from './raw-finding.ts';
import { RULE } from './rule-ids.ts';

// The vocabulary entry id whose judgment is "an unconstrained free-form parameter interpreted as
// code." Reusing the fired signal keeps this advisory anchored to the reviewed data, not a second
// copy of the lexeme list. If that entry is renamed, this constant moves with it.
const FREEFORM_CODE_SIGNAL_ID = 'shape.freeform-code-input';

const DESTRUCTIVE_WRITE_LEVELS: ReadonlySet<string> = new Set(['mutating', 'deleting']);

function isSensitive(derived: ActionRiskProfile): boolean {
  const writes =
    DESTRUCTIVE_WRITE_LEVELS.has(derived.destructiveness.level) &&
    derived.destructiveness.confidence !== 'uncertain';
  const reaches =
    derived.externalReach.level === 'open-world' && derived.externalReach.confidence !== 'uncertain';
  return writes || reaches;
}

// The confidence a sensitive tool's advisory carries — the stronger of the two sensitive dimensions.
function sensitiveConfidence(derived: ActionRiskProfile): Confidence {
  const order: readonly Confidence[] = ['uncertain', 'low', 'medium', 'high'];
  const rank = (c: Confidence): number => order.indexOf(c);
  return rank(derived.destructiveness.confidence) >= rank(derived.externalReach.confidence)
    ? derived.destructiveness.confidence
    : derived.externalReach.confidence;
}

/**
 * The hygiene findings for one tool. Pure over its inputs. Advisory severity floors at `medium`
 * from the policy regardless of the confidence carried here, so these never masquerade as an
 * honesty verdict.
 */
export function advisories(
  inputSchema: JsonSchema,
  derived: ActionRiskProfile,
  signals: readonly SignalRef[],
): readonly RawFinding[] {
  const out: RawFinding[] = [];

  // freeform-input-as-code — the engine already fired the vocabulary's unconstrained-code signal.
  const codeSignals = signals.filter((s) => s.id === FREEFORM_CODE_SIGNAL_ID);
  if (codeSignals.length > 0) {
    out.push({
      ruleId: RULE.freeformInputAsCode,
      verdict: 'undeclared',
      confidence: derived.destructiveness.confidence,
      signals: codeSignals,
    });
  }

  // no-scope-constraint — a sensitive tool whose schema declares parameters but bounds none of them
  // (no enum, const, pattern, or format anywhere). A tighter schema would scope what it can do.
  const params = collectParams(inputSchema);
  if (isSensitive(derived) && params.length > 0 && params.every((p) => p.isFreeformString)) {
    out.push({
      ruleId: RULE.noScopeConstraint,
      verdict: 'undeclared',
      confidence: sensitiveConfidence(derived),
      signals: [],
    });
  }

  return out;
}
