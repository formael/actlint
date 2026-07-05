// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Rationales are GENERATED, not authored. Each string is a plain-language account of what the
// engine derived, what the tool declared, and why the two disagree — assembled from the driving
// dimension and the vocabulary signals that produced it. The voice is calm and concrete: no
// fear-mongering, no severity theatre. A rationale is product copy, not a debug log.
//
// makeFinding re-checks that the result is non-empty; every branch below returns a full sentence,
// so a Finding can never carry an empty reason (Invariant 2).

import type { DeclaredProfile } from '../declared.ts';
import type { ActionRiskProfile, SignalRef } from '../dimensions.ts';
import type { RuleId } from '../primitives.ts';
import { RULE } from './rule-ids.ts';

// "based on the signals verb.delete, phrase.deletion" — or "" when a rule fired on a structural
// absence rather than a positive signal.
function fromSignals(signals: readonly SignalRef[]): string {
  if (signals.length === 0) return '';
  const ids = signals.map((s) => s.id).join(', ');
  return signals.length === 1 ? ` (from the signal ${ids})` : ` (from the signals ${ids})`;
}

function confidenceCaveat(profile: ActionRiskProfile, dim: keyof ActionRiskProfile): string {
  return profile[dim].confidence === 'uncertain' ? ' This reading is uncertain.' : '';
}

/**
 * Build the rationale for one finding. Keys off the RuleId to select the driving dimension and the
 * declared hint at issue, then narrates the specific gap. Total and pure: every RuleId is handled.
 */
export function buildRationale(
  ruleId: RuleId,
  derived: ActionRiskProfile,
  _declared: DeclaredProfile,
  signals: readonly SignalRef[],
): string {
  const cite = fromSignals(signals);

  switch (ruleId as string) {
    case RULE.writeAsReadonly as string:
      return `The tool declares readOnlyHint: true, but its action is derived as ${derived.destructiveness.level}${cite}. A read-only declaration on a tool that writes suppresses the confirmation a spec-conformant client would otherwise show.${confidenceCaveat(derived, 'destructiveness')}`;

    case RULE.destructiveUnflagged as string:
      return `The tool declares destructiveHint: false, but its action is derived as ${derived.destructiveness.level}${cite}. Explicitly denying a destructive update removes a safety prompt the caller would otherwise see.${confidenceCaveat(derived, 'destructiveness')}`;

    case RULE.externalReachUndeclared as string:
      return `The tool declares openWorldHint: false, but its reach is derived as ${derived.externalReach.level}${cite}. Denying open-world reach on a tool that contacts an external boundary understates where its effects land.${confidenceCaveat(derived, 'externalReach')}`;

    case RULE.destructiveAbsent as string:
      return `The action is derived as ${derived.destructiveness.level}${cite}, and the tool declares neither readOnlyHint nor destructiveHint. A spec-conformant client still prompts here, so this is a nudge to declare the destructive nature explicitly rather than rely on defaults.`;

    case RULE.reachAbsent as string:
      return `The reach is derived as ${derived.externalReach.level}${cite}, and the tool declares no openWorldHint. The spec default already treats reach conservatively, so this is a nudge to declare open-world reach explicitly.`;

    case RULE.irreversibleUnflagged as string:
      return `The action is derived as ${derived.reversibility.level}${cite}, and the tool admits no destructiveness. MCP has no reversibility hint, so this is supporting context: an irreversible effect is worth stating plainly for the caller.`;

    case RULE.overDeclaredRisk as string:
      return `The tool declares more risk than its action is derived to carry (destructiveness ${derived.destructiveness.level}, reach ${derived.externalReach.level})${cite}. Over-declaration is honest but costs alarm fatigue; the annotation could be tightened to match the tool.`;

    case RULE.freeformInputAsCode as string:
      return `The input schema accepts an unconstrained free-form parameter interpreted as code${cite}. There is no MCP hint for this; it is a capability-hygiene note that the parameter lets a caller drive arbitrary behavior.`;

    case RULE.noScopeConstraint as string:
      return `This is a sensitive action (destructiveness ${derived.destructiveness.level}, reach ${derived.externalReach.level}) whose input schema carries no narrowing constraint — no enum, pattern, format, or limit bounds its parameters${cite}. A tighter schema would scope what the tool can be asked to do.`;

    default:
      // Unreachable: the RuleId set is closed and every member is handled above. An empty string
      // here would be caught by makeFinding, which refuses to build an unexplained finding.
      return '';
  }
}
