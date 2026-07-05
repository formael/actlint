// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { cleanResult, mixedResult } from './fixtures.ts';
import { sarifReporter } from './sarif.ts';
import { serverResult } from './test-support.ts';

interface SarifLog {
  readonly version: string;
  readonly runs: readonly {
    readonly tool: { readonly driver: { readonly name: string; readonly rules: readonly { id: string }[] } };
    readonly originalUriBaseIds?: Record<string, { uri: string }>;
    readonly results: readonly {
      readonly ruleId: string;
      readonly level: string;
      readonly message: { text: string };
      readonly partialFingerprints: Record<string, string>;
      readonly properties: { tags: readonly string[]; verdict: string };
    }[];
  }[];
}

const parse = (result: ReturnType<typeof mixedResult>): SarifLog =>
  JSON.parse(sarifReporter(result)) as SarifLog;

describe('sarifReporter (SARIF 2.1.0)', () => {
  it('renders the mixed server the same way every time', () => {
    expect(sarifReporter(mixedResult())).toMatchSnapshot();
  });

  it('renders a spotless server', () => {
    expect(sarifReporter(cleanResult())).toMatchSnapshot();
  });

  it('declares SARIF 2.1.0 with a single run named actlint', () => {
    const log = parse(mixedResult());
    expect(log.version).toBe('2.1.0');
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0]?.tool.driver.name).toBe('actlint');
  });

  it('emits one result per finding, each carrying its ruleId', () => {
    const result = mixedResult();
    const log = parse(result);
    expect(log.runs[0]?.results).toHaveLength(result.findings.length);
    expect(log.runs[0]?.results.map((r) => r.ruleId)).toEqual(result.findings.map((f) => f.ruleId));
  });

  it('derives the SARIF level from severity (critical → error, low → note)', () => {
    const log = parse(mixedResult());
    const byRule = new Map(log.runs[0]?.results.map((r) => [r.ruleId, r.level]));
    expect(byRule.get('write-as-readonly')).toBe('error'); // critical
    expect(byRule.get('destructive-absent')).toBe('note'); // low
    expect(byRule.get('freeform-input-as-code')).toBe('warning'); // advisory floor: medium
  });

  it('lists a deduplicated rule descriptor per distinct RuleId', () => {
    const result = mixedResult();
    const ids = parse(result).runs[0]?.tool.driver.rules.map((r) => r.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(result.findings.map((f) => f.ruleId as string)));
  });

  it('tags results with the crosswalk so a Guardian can filter by standard', () => {
    const log = parse(mixedResult());
    const flagship = log.runs[0]?.results.find((r) => r.ruleId === 'write-as-readonly');
    expect(flagship?.properties.tags).toContain('OWASP-ASI:ASI02:2026');
    expect(flagship?.properties.tags).toContain('mcp-field:readOnlyHint');
  });

  it('carries a stable per-finding fingerprint for dashboard dedup', () => {
    const log = parse(mixedResult());
    const flagship = log.runs[0]?.results.find((r) => r.ruleId === 'write-as-readonly');
    expect(flagship?.partialFingerprints['actlint/toolRule']).toBe('delete_repository::write-as-readonly');
  });

  it('publishes a server-card URL as the run origin', () => {
    const log = parse(mixedResult());
    expect(log.runs[0]?.originalUriBaseIds?.SERVER?.uri).toBe('https://example.com/.well-known/mcp');
  });

  it('omits the run origin for a local file source (not a publishable URI)', () => {
    const fileResult = serverResult(mixedResult().findings, {
      toolCount: 10,
      source: { kind: 'file', path: '/tmp/manifest.json' },
    });
    const log = JSON.parse(sarifReporter(fileResult)) as SarifLog;
    expect(log.runs[0]?.originalUriBaseIds).toBeUndefined();
    expect(sarifReporter(fileResult)).not.toContain('/tmp/manifest.json');
  });
});
