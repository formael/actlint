// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Redacted, isoTimestampSchema } from '@formael/actlint-core/contracts';
import type { ManifestSource, ToolManifest } from '@formael/actlint-core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readManifestFile, serializeManifest, writeCapture } from './capture.ts';
import { toManifest } from './to-manifest.ts';

const AT = isoTimestampSchema.parse('2026-01-01T00:00:00.000Z');
const LIVE_SOURCE: ManifestSource = {
  kind: 'live',
  transport: 'http',
  endpoint: Redacted.create('https://mcp.example.com/mcp?token=SUPERSECRET'),
};

function buildManifest(): ToolManifest {
  const result = toManifest(
    {
      tools: [
        { name: 'b_tool', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
        {
          name: 'a_tool',
          description: 'writes things',
          inputSchema: { type: 'object' },
          annotations: { destructiveHint: true },
        },
      ],
    },
    LIVE_SOURCE,
    AT,
  );
  if (!result.ok) throw new Error('fixture manifest failed to build');
  return result.value;
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'actlint-capture-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('serializeManifest', () => {
  it('produces canonical, diffable JSON with sorted keys and a trailing newline', () => {
    const text = serializeManifest(buildManifest());
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text);
    // Top-level keys are canonicalized (sorted): capturedAt before source before tools.
    expect(Object.keys(parsed)).toEqual(['capturedAt', 'source', 'tools']);
  });

  it('never emits a credential — the redacted endpoint renders as a placeholder', () => {
    const text = serializeManifest(buildManifest());
    expect(text).not.toContain('SUPERSECRET');
    expect(text).toContain('[REDACTED]');
  });

  it('is stable: serializing twice yields byte-identical output', () => {
    expect(serializeManifest(buildManifest())).toBe(serializeManifest(buildManifest()));
  });
});

describe('capture-and-replay round-trip', () => {
  it('replays a captured manifest to byte-identical tools via the file source', async () => {
    const original = buildManifest();
    const path = join(dir, 'server.json');

    const write = await writeCapture(original, path);
    expect(write.ok).toBe(true);

    const replay = await readManifestFile(path);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;

    // Findings are a function of tools alone: those must survive the round-trip exactly.
    expect(replay.value.tools).toEqual(original.tools);
    expect(JSON.stringify(replay.value.tools)).toBe(JSON.stringify(original.tools));
    expect(replay.value.capturedAt).toBe(original.capturedAt);
    // The replayed provenance is honest about where it came from.
    expect(replay.value.source).toEqual({ kind: 'file', path });
  });

  it('re-capturing a replayed manifest is byte-identical in its tools', async () => {
    const path = join(dir, 'roundtrip.json');
    await writeCapture(buildManifest(), path);
    const replay = await readManifestFile(path);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    const recapture = serializeManifest(replay.value);
    // The tools block is identical across the round-trip (only provenance differs).
    expect(JSON.parse(recapture).tools).toEqual(JSON.parse(serializeManifest(buildManifest())).tools);
  });
});

describe('readManifestFile — defensive', () => {
  it('returns connect-failed for a missing file', async () => {
    const result = await readManifestFile(join(dir, 'does-not-exist.json'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('connect-failed');
  });

  it('returns malformed-tools for non-JSON content', async () => {
    const path = join(dir, 'garbage.json');
    await writeFile(path, 'not json at all', 'utf8');
    const result = await readManifestFile(path);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('malformed-tools');
  });

  it('returns malformed-tools for JSON that is not a ToolManifest', async () => {
    const path = join(dir, 'wrong-shape.json');
    await writeFile(path, JSON.stringify({ hello: 'world' }), 'utf8');
    const result = await readManifestFile(path);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('malformed-tools');
  });
});
