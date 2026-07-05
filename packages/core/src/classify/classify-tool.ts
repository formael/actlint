// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The per-tool and per-server orchestration: derive (declaration-blind) → classify (derived vs
// declared) + advisories (schema hygiene) → makeFinding (the explainability gate). The canonical
// output is a readonly Finding[]; grading and rendering are strictly downstream views of it, so
// nothing about a grade or a report format leaks in here.

import type { Vocabulary } from '@formael/action-risk-vocabulary';
import { derive } from '../derive/index.ts';
import type { Finding } from '../finding.ts';
import type { ToolDefinition, ToolManifest } from '../manifest.ts';
import { type Outcome, ok } from '../outcome.ts';
import { advisories } from './advisories.ts';
import { classify } from './classify.ts';
import { makeFinding } from './make-finding.ts';
import type { RawFinding } from './raw-finding.ts';

/**
 * The findings for a single tool: its honesty findings and its hygiene advisories, each passed
 * through makeFinding. Returns the first construction failure as an Err — in a shipped build the
 * crosswalk is complete (a contract test guarantees it), so this only fails on a planted bug.
 */
export function classifyTool(tool: ToolDefinition, vocabulary: Vocabulary): Outcome<readonly Finding[]> {
  const { profile, signals } = derive(tool, vocabulary);
  const declared = tool.annotations;

  const rawFindings: readonly RawFinding[] = [
    ...classify(profile, declared),
    ...advisories(tool.inputSchema, profile, signals),
  ];

  const findings: Finding[] = [];
  for (const raw of rawFindings) {
    const built = makeFinding({
      ruleId: raw.ruleId,
      toolName: tool.name,
      verdict: raw.verdict,
      confidence: raw.confidence,
      derived: profile,
      declared,
      signals: raw.signals,
    });
    if (!built.ok) return built;
    findings.push(built.value);
  }

  return ok(findings);
}

/**
 * Fold a whole manifest into its canonical Finding[]. Tools are processed in manifest order and
 * their findings concatenated, so the output is deterministic and stable across runs.
 */
export function classifyManifest(
  manifest: ToolManifest,
  vocabulary: Vocabulary,
): Outcome<readonly Finding[]> {
  const findings: Finding[] = [];
  for (const tool of manifest.tools) {
    const toolFindings = classifyTool(tool, vocabulary);
    if (!toolFindings.ok) return toolFindings;
    findings.push(...toolFindings.value);
  }
  return ok(findings);
}
