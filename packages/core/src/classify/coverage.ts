// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Assessment coverage — the honest account of how much of a server actlint could judge. It is pure
// metadata over the same manifest the classifier reads: it adds and changes no finding. The point is
// epistemic honesty. A tool for which no verdict-bearing signal fired is `unassessed`, not
// `consistent`; folding it into the consistent remainder would present the linter's own recall gap
// as a clean bill of health.

import type { Vocabulary } from '@formael/action-risk-vocabulary';
import type { DeclaredHint, DeclaredProfile } from '../declared.ts';
import { derive } from '../derive/index.ts';
import type { ActionRiskProfile, Dimension } from '../dimensions.ts';
import type { Finding } from '../finding.ts';
import type { ToolManifest } from '../manifest.ts';
import type { Coverage } from '../server-result.ts';

// A dimension rests on no evidence when it is `unknown` with an empty provenance — no signal fired.
// This is the silence the composer derives to `unknown` (never to a safe level); coverage reports it.
function isSilent(dimension: Dimension<string>): boolean {
  return dimension.level === 'unknown' && dimension.provenance.length === 0;
}

// Whether a derived profile carries any verdict-bearing signal. A verdict rests on destructiveness or
// external reach; if both are silent, nothing actlint recognizes fired. Adding any contribution to
// either dimension can only add provenance or raise the level, so this is monotonic — a signal can
// move a tool assessed, never unassessed.
export function profileIsAssessed(profile: ActionRiskProfile): boolean {
  return !(isSilent(profile.destructiveness) && isSilent(profile.externalReach));
}

// An annotation counts only when a hint is actually stated (true or false), not absent. `absent` is
// silence, and a server that annotates nothing must be distinguishable from one that declares hints.
function hintStated(hint: DeclaredHint | undefined): boolean {
  return hint !== undefined && hint.state !== 'absent';
}

function declaresAnnotation(declared: DeclaredProfile): boolean {
  return (
    hintStated(declared.readOnly) ||
    hintStated(declared.destructive) ||
    hintStated(declared.idempotent) ||
    hintStated(declared.openWorld)
  );
}

/**
 * The per-server assessment coverage. A tool is unassessed when neither destructiveness nor external
 * reach — the dimensions a verdict rests on — carries any signal, and it produced no honesty finding.
 * Any signal, any concrete level, or any finding makes it assessed. Tool names are returned in
 * manifest order, so the result is deterministic. `findings` is the full (pre-baseline) set: a tool
 * whose finding a baseline suppresses was still assessed.
 */
export function assessManifest(
  manifest: ToolManifest,
  vocabulary: Vocabulary,
  findings: readonly Finding[],
): Coverage {
  const toolsWithHonestyFinding = new Set<string>();
  for (const finding of findings) {
    if (finding.ruleClass === 'honesty') toolsWithHonestyFinding.add(finding.toolName);
  }

  let assessedTools = 0;
  let annotatedTools = 0;
  const unassessedToolNames: string[] = [];

  for (const tool of manifest.tools) {
    const { profile } = derive(tool, vocabulary);
    const unassessed = !profileIsAssessed(profile) && !toolsWithHonestyFinding.has(tool.name);

    if (unassessed) unassessedToolNames.push(tool.name);
    else assessedTools += 1;

    if (declaresAnnotation(tool.annotations)) annotatedTools += 1;
  }

  return {
    assessedTools,
    unassessedTools: unassessedToolNames.length,
    annotatedTools,
    unassessedToolNames,
  };
}
