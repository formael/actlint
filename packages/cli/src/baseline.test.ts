// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { VOCABULARY } from '@formael/action-risk-vocabulary';
import { type Finding, classifyManifest } from '@formael/actlint-core';
import { describe, expect, it } from 'vitest';
import { buildBaseline, fingerprint, partitionByBaseline } from './baseline.ts';
import { parseStdinManifest } from './ingest-target.ts';
import { DISHONEST_MANIFEST } from './test-manifests.ts';
import type { Versions } from './version.ts';

const VERSIONS: Versions = {
  actlint: '0.1.0',
  vocabulary: '0.1.0',
  crosswalk: '0.1.0',
  reportSchema: '1.0.0',
};

function findingsFrom(text: string): readonly Finding[] {
  const parsed = parseStdinManifest(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const classified = classifyManifest(parsed.manifest, VOCABULARY);
  if (!classified.ok) throw new Error(classified.error.message);
  return classified.value;
}

// A second, unrelated tool alongside exec_sql — used to prove one tool's change never touches
// another's fingerprint.
const TWO_TOOLS = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  tools: [
    {
      name: 'exec_sql',
      description: 'Run a SQL statement against the database.',
      inputSchema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
      annotations: { readOnly: { state: 'true' }, unknownHints: {} },
    },
    {
      name: 'delete_repository',
      description: 'Permanently delete a repository.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { unknownHints: {} },
    },
  ],
});

describe('fingerprint', () => {
  it('is deterministic for the same finding', () => {
    const [a] = findingsFrom(DISHONEST_MANIFEST);
    const [b] = findingsFrom(DISHONEST_MANIFEST);
    expect(a && b).toBeTruthy();
    expect(fingerprint(a as Finding)).toBe(fingerprint(b as Finding));
  });
});

describe('partitionByBaseline', () => {
  const findings = findingsFrom(DISHONEST_MANIFEST);
  const baseline = buildBaseline(findings, VERSIONS);

  it('suppresses exactly the baselined findings under the same vocabulary', () => {
    const part = partitionByBaseline(findings, baseline, VERSIONS.vocabulary);
    expect(part.suppressed).toHaveLength(findings.length);
    expect(part.active).toHaveLength(0);
    expect(part.newlyIntroduced).toHaveLength(0);
  });

  it('does not un-suppress a baselined finding when an unrelated tool is added', () => {
    const withExtra = findingsFrom(TWO_TOOLS);
    const part = partitionByBaseline(withExtra, baseline, VERSIONS.vocabulary);
    // exec_sql's findings stay suppressed; only the new tool's findings are active.
    expect(part.suppressed.every((f) => f.toolName === 'exec_sql')).toBe(true);
    expect(part.active.every((f) => f.toolName === 'delete_repository')).toBe(true);
    expect(part.suppressed.length).toBe(findings.length);
  });

  it('reports unmatched findings as newly-introduced when the vocabulary version differs', () => {
    const olderVocabBaseline = buildBaseline([], { ...VERSIONS, vocabulary: '0.0.1' });
    const part = partitionByBaseline(findings, olderVocabBaseline, VERSIONS.vocabulary);
    expect(part.newlyIntroduced).toHaveLength(findings.length);
    expect(part.active).toHaveLength(0);
  });
});
