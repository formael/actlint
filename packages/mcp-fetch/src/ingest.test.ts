// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ManifestSource } from '@formael/actlint-core/contracts';
import { isoTimestampSchema, Redacted } from '@formael/actlint-core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeCapture } from './capture.ts';
import { ingest } from './ingest.ts';
import { toManifest } from './to-manifest.ts';
import type { IngestSource } from './types.ts';

const AT = isoTimestampSchema.parse('2026-01-01T00:00:00.000Z');
const SOURCE: ManifestSource = { kind: 'live', transport: 'stdio', endpoint: Redacted.create('mcp-server') };

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'actlint-ingest-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ingest — file source', () => {
  it('replays a captured manifest deterministically', async () => {
    const built = toManifest({ tools: [{ name: 't', inputSchema: { type: 'object' } }] }, SOURCE, AT);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const path = join(dir, 'capture.json');
    await writeCapture(built.value, path);

    const result = await ingest({ kind: 'file', path });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tools).toEqual(built.value.tools);
    expect(result.value.source).toEqual({ kind: 'file', path });
  });
});

describe('ingest — experimental gating', () => {
  it('refuses a server-card source without the experimental flag', async () => {
    const result = await ingest({ kind: 'server-card', origin: 'https://example.com' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('server-card-draft');
  });

  it('reports that a registry entry carries no tool definitions', async () => {
    const result = await ingest({ kind: 'registry', serverId: 'acme-server' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('registry-no-tools');
  });
});

describe('ingest — live edge failures are typed and credential-safe', () => {
  it('turns a refused connection into a typed error that leaks no credential', async () => {
    const source: IngestSource = {
      kind: 'live',
      transport: 'http',
      url: 'http://127.0.0.1:1/mcp?token=SUPERSECRET',
      headers: { authorization: 'Bearer HEADERSECRET' },
    };

    const result = await ingest(source, { timeoutMs: 3000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['connect-failed', 'timeout']).toContain(result.error.code);

    const serialized = JSON.stringify(result.error);
    expect(serialized).not.toContain('SUPERSECRET');
    expect(serialized).not.toContain('HEADERSECRET');
  });
});
