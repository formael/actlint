// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Shared reporter fixtures — one server that exercises every rendering path: an explicit false
// read-only claim (critical under-declared), a soft/uncertain under-declaration (renders MED?), an
// absent-hint nudge, an over-declaration, and two advisories (one certain, one uncertain → ADV?).
// The findings are real (built through makeFinding), so the snapshots are of genuine output.

import type { Finding, ServerResult } from '@formael/actlint-core';
import { buildFinding, declared, dim, hint, profile, serverResult, sig } from './test-support.ts';

/** The canonical mixed-scenario finding set, in manifest (tool) order. */
export function mixedFindings(): readonly Finding[] {
  return [
    // An explicit read-only claim on a tool that deletes — the flagship critical under-declaration.
    buildFinding({
      ruleId: 'write-as-readonly',
      toolName: 'delete_repository',
      verdict: 'under-declared',
      confidence: 'high',
      derived: profile({
        destructiveness: dim('deleting', 'high', [sig('verb.delete')]),
        reversibility: dim('irreversible', 'medium', [sig('verb.delete')]),
      }),
      declared: declared({ readOnly: hint.true }),
      signals: [sig('verb.delete')],
    }),
    // openWorldHint:false on a tool whose reach reads open-world, but only uncertainly → soft (MED?).
    buildFinding({
      ruleId: 'external-reach-undeclared',
      toolName: 'send_message',
      verdict: 'under-declared',
      confidence: 'uncertain',
      derived: profile({ externalReach: dim('open-world', 'uncertain', [sig('verb.send')]) }),
      declared: declared({ openWorld: hint.false }),
      signals: [sig('verb.send')],
    }),
    // A mutating tool that declares neither read-only nor destructive — an absent-hint nudge (LOW).
    buildFinding({
      ruleId: 'destructive-absent',
      toolName: 'update_record',
      verdict: 'undeclared',
      confidence: 'high',
      derived: profile({ destructiveness: dim('mutating', 'high', [sig('verb.mutate')]) }),
      declared: declared({}),
      signals: [sig('verb.mutate')],
    }),
    // A plain read that declares destructiveHint:true — honest but noisy (over-declared, LOW).
    buildFinding({
      ruleId: 'over-declared-risk',
      toolName: 'list_items',
      verdict: 'over-declared',
      confidence: 'high',
      derived: profile(),
      declared: declared({ destructive: hint.true }),
      signals: [],
    }),
    // A free-form `command` parameter — capability hygiene, not an honesty verdict (ADV).
    buildFinding({
      ruleId: 'freeform-input-as-code',
      toolName: 'run_task',
      verdict: 'consistent',
      confidence: 'medium',
      derived: profile({ destructiveness: dim('mutating', 'medium', [sig('shape.freeform-code-input')]) }),
      declared: declared({ destructive: hint.true }),
      signals: [sig('shape.freeform-code-input')],
    }),
    // A sensitive, unconstrained schema, read uncertainly → an uncertain advisory (ADV?).
    buildFinding({
      ruleId: 'no-scope-constraint',
      toolName: 'purge_cache',
      verdict: 'consistent',
      confidence: 'uncertain',
      derived: profile({
        destructiveness: dim('deleting', 'uncertain', [sig('verb.delete')]),
        externalReach: dim('open-world', 'uncertain'),
      }),
      declared: declared({ destructive: hint.true }),
      signals: [],
    }),
  ];
}

/** The mixed server: ten tools, four of them with honesty findings, so six read consistent. */
export function mixedResult(): ServerResult {
  return serverResult(mixedFindings(), { toolCount: 10 });
}

/** A spotless server: every tool consistent, no findings — the all-A case and the empty-list path. */
export function cleanResult(): ServerResult {
  return serverResult([], { toolCount: 5 });
}
