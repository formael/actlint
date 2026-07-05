// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { type Finding, serverGradeSchema } from '@formael/actlint-core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { gradeServer } from './grade.ts';
import { buildFinding, declared, dim, hint, profile, sig } from './test-support.ts';

const GRADE_BEST_FIRST = serverGradeSchema.options;
const gradeIndex = (g: string): number => GRADE_BEST_FIRST.indexOf(g as (typeof GRADE_BEST_FIRST)[number]);

// A genuine critical under-declaration: an explicit read-only claim on a tool derived as deleting.
function criticalUnderDeclared(toolName: string): Finding {
  return buildFinding({
    ruleId: 'write-as-readonly',
    toolName,
    verdict: 'under-declared',
    confidence: 'high',
    derived: profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) }),
    declared: declared({ readOnly: hint.true }),
    signals: [sig('verb.delete')],
  });
}

// An absent-hint nudge: derived mutating, nothing declared. Non-gating, never dishonest.
function undeclared(toolName: string): Finding {
  return buildFinding({
    ruleId: 'destructive-absent',
    toolName,
    verdict: 'undeclared',
    confidence: 'high',
    derived: profile({ destructiveness: dim('mutating', 'high', [sig('verb.mutate')]) }),
    declared: declared({}),
    signals: [sig('verb.mutate')],
  });
}

describe('gradeServer (the honesty grade)', () => {
  it('grades an all-consistent server A', () => {
    expect(gradeServer([], 12)).toBe('A');
  });

  it('grades a server with no tools A (vacuously honest)', () => {
    expect(gradeServer([], 0)).toBe('A');
  });

  it('cannot exceed C when any critical under-declared tool is present', () => {
    // One critical under-declaration among nineteen otherwise-consistent tools would score an A on
    // ratio alone; the cap holds it at C.
    const grade = gradeServer([criticalUnderDeclared('delete_repository')], 20);
    expect(gradeIndex(grade)).toBeGreaterThanOrEqual(gradeIndex('C'));
    expect(grade).toBe('C');
  });

  it('holds the cap even when every tool is a critical under-declaration', () => {
    const findings = Array.from({ length: 6 }, (_, i) => criticalUnderDeclared(`tool_${i}`));
    expect(gradeIndex(gradeServer(findings, 6))).toBeGreaterThanOrEqual(gradeIndex('C'));
  });

  it('lets absent-hint nudges dent the grade without capping it (they are not dishonesty)', () => {
    // All-undeclared: honest silence, never worse than the any-under-declared cap territory.
    const findings = Array.from({ length: 10 }, (_, i) => undeclared(`tool_${i}`));
    const grade = gradeServer(findings, 10);
    expect(gradeIndex(grade)).toBeLessThan(gradeIndex('C'));
  });

  it('is deterministic — the same findings grade identically across runs', () => {
    const findings = [criticalUnderDeclared('a'), undeclared('b')];
    expect(gradeServer(findings, 5)).toBe(gradeServer(findings, 5));
  });

  it('is monotonic: replacing consistent tools with under-declared ones never improves the grade', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 0, max: 40 }), (toolCount, kRaw) => {
        const k = Math.min(kRaw, toolCount);
        const fewer = Array.from({ length: k }, (_, i) => criticalUnderDeclared(`u_${i}`));
        const more = Array.from({ length: Math.min(k + 1, toolCount) }, (_, i) =>
          criticalUnderDeclared(`u_${i}`),
        );
        // One more dishonest tool (same total tool count) is never graded better.
        expect(gradeIndex(gradeServer(more, toolCount))).toBeGreaterThanOrEqual(
          gradeIndex(gradeServer(fewer, toolCount)),
        );
      }),
    );
  });
});
