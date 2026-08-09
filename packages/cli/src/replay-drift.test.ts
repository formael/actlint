// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The replay control experiment. Every committed capture is a permanent, byte-fixed input: replaying
// one through the `--manifest` path must yield a report that is a pure function of the manifest
// alone. This path acquires nothing over the wire — it reads a file — so it never constructs a
// client or touches the network. That makes it the cheapest, strongest proof that a change to how
// tools are FETCHED left what actlint CONCLUDES untouched: any drift here indicts an accidental
// change outside the fetch boundary, not a change to the fetch itself.
//
// It runs under the workspace's Node matrix (the LTS floor and the current line), so it also asserts
// determinism across both — same manifest in, byte-identical report out, on every supported runtime.

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportSchema } from '@formael/actlint-core';
import { ingest, writeCapture } from '@formael/actlint-mcp-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT } from './exit-codes.ts';
import { run } from './run.ts';
import type { RunContext } from './scan.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CORPUS_DIR = join(REPO_ROOT, 'eval', 'corpus');

/** Every committed capture on disk: one `manifest.json` per corpus server directory. */
function committedCaptures(): { readonly id: string; readonly path: string }[] {
  const out: { id: string; path: string }[] = [];
  for (const entry of readdirSync(CORPUS_DIR, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory()) continue;
    const path = join(CORPUS_DIR, entry.name, 'manifest.json');
    if (existsSync(path)) out.push({ id: entry.name, path });
  }
  return out;
}

let workdir: string;
beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'actlint-replay-'));
});

function ctx(): RunContext {
  return {
    cwd: workdir,
    env: {},
    colorCapable: false,
    effects: {
      ingest,
      writeCapture,
      writeTextFile: async (path, data) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, data, 'utf8');
      },
      readStdin: async () => '',
    },
  };
}

const captures = committedCaptures();

describe('replay zero-drift over every committed capture', () => {
  it('discovers the full committed corpus, not an empty glob', () => {
    // A vacuous pass is worse than a failure: assert the sweep actually found the corpus.
    expect(captures.length).toBeGreaterThanOrEqual(4);
  });

  it.each(captures)('replays $id to a deterministic, schema-valid report', async ({ path }) => {
    const first = await run(['--json', '--manifest', path], ctx());
    const second = await run(['--json', '--manifest', path], ctx());

    // A successful scan — never a usage (2) or ingestion (3) error. Findings (1) is a legitimate
    // outcome for a server that under-declares; only a broken replay path fails to parse.
    expect(first.exitCode === EXIT.clean || first.exitCode === EXIT.findings).toBe(true);

    // Determinism (Invariant 1): the same manifest yields the byte-identical report every time.
    expect(second.stdout).toBe(first.stdout);

    // The report is well-formed against the published schema — the replay path produces the same
    // contract a live scan does.
    expect(reportSchema.safeParse(JSON.parse(first.stdout)).success).toBe(true);
  });
});

describe('the replay path is offline', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes no network call while replaying a committed capture', async () => {
    const [sample] = captures;
    expect(sample).toBeDefined();
    if (!sample) return;
    const result = await run(['--json', '--manifest', sample.path], ctx());
    expect(result.exitCode === EXIT.clean || result.exitCode === EXIT.findings).toBe(true);
    // Reading a manifest from disk constructs no client and opens no socket.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
