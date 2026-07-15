// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { mixedFindings } from './fixtures.ts';
import { summarize, worstVerdictByTool } from './summary.ts';
import { buildFinding, declared, dim, hint, profile, sig } from './test-support.ts';

describe('summarize (per-tool honesty tally)', () => {
  it('counts each tool once, under its worst honesty verdict', () => {
    const summary = summarize(mixedFindings(), 10);
    expect(summary).toEqual({
      tools: 10,
      underDeclared: 2,
      undeclared: 1,
      overDeclared: 1,
      consistent: 6,
      unassessed: 0,
    });
  });

  it('the five buckets always sum to the tool count', () => {
    const s = summarize(mixedFindings(), 10, 3);
    expect(s.underDeclared + s.undeclared + s.overDeclared + s.consistent + (s.unassessed ?? 0)).toBe(
      s.tools,
    );
    // The three unassessed tools come out of the consistent remainder, never a dishonesty bucket.
    expect(s.consistent).toBe(3);
    expect(s.unassessed).toBe(3);
  });

  it('advisory-only tools count as consistent (a hygiene note is not a verdict)', () => {
    const advisoryOnly = buildFinding({
      ruleId: 'freeform-input-as-code',
      toolName: 'run_task',
      verdict: 'consistent',
      confidence: 'medium',
      derived: profile({ destructiveness: dim('mutating', 'medium', [sig('shape.freeform-code-input')]) }),
      declared: declared({ destructive: hint.true }),
      signals: [sig('shape.freeform-code-input')],
    });
    expect(summarize([advisoryOnly], 1)).toMatchObject({ consistent: 1, underDeclared: 0 });
    expect(worstVerdictByTool([advisoryOnly]).has('run_task')).toBe(false);
  });

  it('classifies a tool by its worst verdict when it carries several', () => {
    const under = buildFinding({
      ruleId: 'write-as-readonly',
      toolName: 'delete_repository',
      verdict: 'under-declared',
      confidence: 'high',
      derived: profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) }),
      declared: declared({ readOnly: hint.true }),
      signals: [sig('verb.delete')],
    });
    const alsoUndeclared = buildFinding({
      ruleId: 'reach-absent',
      toolName: 'delete_repository',
      verdict: 'undeclared',
      confidence: 'high',
      derived: profile({ externalReach: dim('open-world', 'high', [sig('verb.send')]) }),
      declared: declared({}),
      signals: [sig('verb.send')],
    });
    expect(worstVerdictByTool([alsoUndeclared, under]).get('delete_repository')).toBe('under-declared');
    expect(summarize([alsoUndeclared, under], 1)).toMatchObject({ underDeclared: 1, undeclared: 0 });
  });

  it('never lets the consistent count go negative', () => {
    // More finding-bearing tools than the declared count (a degenerate input) floors at zero.
    const summary = summarize(mixedFindings(), 1);
    expect(summary.consistent).toBe(0);
  });
});
