// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { Redacted, reportSchema } from '@formael/actlint-core';
import { describe, expect, it } from 'vitest';

import { cleanResult, mixedResult } from './fixtures.ts';
import { jsonReporter } from './json.ts';
import { serverResult } from './test-support.ts';

describe('jsonReporter (the machine report)', () => {
  it('renders the mixed server the same way every time', () => {
    expect(jsonReporter(mixedResult())).toMatchSnapshot();
  });

  it('renders a spotless server', () => {
    expect(jsonReporter(cleanResult())).toMatchSnapshot();
  });

  it('emits a trailing newline and parses as JSON', () => {
    const out = jsonReporter(mixedResult());
    expect(out.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(out)).not.toThrow();
  });

  // The report-schema conformance contract: the output is the public API, and it must validate
  // against the published schema for every fixture.
  it('validates against the published report schema', () => {
    for (const result of [mixedResult(), cleanResult()]) {
      const parsed = reportSchema.safeParse(JSON.parse(jsonReporter(result)));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
  });

  it('surfaces a planted shape change: an unexpected key fails conformance', () => {
    const report = JSON.parse(jsonReporter(mixedResult())) as Record<string, unknown>;
    report.leakedField = 'drift';
    expect(reportSchema.safeParse(report).success).toBe(false);
  });

  it('surfaces a planted shape change: a renamed key fails conformance', () => {
    const { grade, ...withoutGrade } = JSON.parse(jsonReporter(mixedResult())) as Record<string, unknown>;
    const renamed = { ...withoutGrade, rank: grade };
    expect(reportSchema.safeParse(renamed).success).toBe(false);
  });

  it('carries the reproducibility metadata (which judgment produced this)', () => {
    const report = JSON.parse(jsonReporter(mixedResult())) as Record<string, unknown>;
    expect(report).toMatchObject({
      reportSchemaVersion: '1.1.0',
      tool: 'actlint',
      vocabularyVersion: '0.1.0',
      crosswalkVersion: '0.1.0',
    });
  });

  it('reduces the findings to the same per-tool summary the scorecard shows', () => {
    const report = JSON.parse(jsonReporter(mixedResult())) as { summary: unknown };
    expect(report.summary).toEqual({
      tools: 10,
      underDeclared: 2,
      undeclared: 1,
      overDeclared: 1,
      consistent: 6,
      unassessed: 0,
    });
  });

  it('carries assessment coverage beside the summary', () => {
    const report = JSON.parse(jsonReporter(mixedResult())) as { coverage: unknown };
    expect(report.coverage).toEqual({
      assessedTools: 10,
      unassessedTools: 0,
      annotatedTools: 10,
      unassessedToolNames: [],
    });
  });

  it('projects each finding with full provenance', () => {
    const report = JSON.parse(jsonReporter(mixedResult())) as {
      findings: readonly Record<string, unknown>[];
    };
    const flagship = report.findings[0];
    expect(flagship).toMatchObject({
      ruleId: 'write-as-readonly',
      ruleClass: 'honesty',
      verdict: 'under-declared',
      severity: 'critical',
    });
    expect(flagship?.rationale).toBeTruthy();
    expect(flagship?.standards).toBeTruthy();
    expect(flagship?.derived).toBeTruthy();
    expect(flagship?.declared).toBeTruthy();
  });

  it('never leaks a live endpoint — it renders redacted', () => {
    const live = serverResult(mixedResult().findings, {
      toolCount: 10,
      source: { kind: 'live', transport: 'http', endpoint: Redacted.create('https://token@host/mcp') },
    });
    const report = JSON.parse(jsonReporter(live)) as { source: Record<string, string> };
    expect(report.source).toEqual({ kind: 'live', transport: 'http', endpoint: '[REDACTED]' });
    expect(jsonReporter(live)).not.toContain('token@host');
  });
});
