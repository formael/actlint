// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { serializeManifest } from '../capture.ts';
import type { LiveSource } from '../types.ts';
import { captureLive, childEnv } from './live.ts';

describe('childEnv', () => {
  it("keeps the SDK's sanitized defaults and adds the caller's variables on top", () => {
    const merged = childEnv({ FOO: 'x' });
    expect(merged.FOO).toBe('x');
    // The defaults survived the merge, so an npx-launched child still has a PATH.
    expect(merged.PATH).toBeTruthy();
  });

  it('lets the caller win on a collision with a default', () => {
    expect(childEnv({ PATH: '/custom' }).PATH).toBe('/custom');
  });
});

// A minimal stdio MCP server that names its one tool after an environment variable. It is the proof
// that a variable passed through --env actually reaches the spawned child — the merge alone cannot
// show that, since the SDK, not us, spawns the process. The SDK modules are resolved to absolute
// URLs here so the child runs from a scratch directory with no node_modules of its own.
function canaryServer(mcpUrl: string, stdioUrl: string): string {
  return `
import { McpServer } from ${JSON.stringify(mcpUrl)};
import { StdioServerTransport } from ${JSON.stringify(stdioUrl)};
const name = process.env.CANARY ?? 'canary_unset';
const server = new McpServer({ name: 'canary', version: '0.0.0' });
server.tool(name, async () => ({ content: [] }));
await server.connect(new StdioServerTransport());
`;
}

describe('captureLive — a variable reaches the spawned child', () => {
  let dir: string;
  let serverPath: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'actlint-live-'));
    serverPath = join(dir, 'canary-server.mjs');
    const mcpUrl = import.meta.resolve('@modelcontextprotocol/sdk/server/mcp.js');
    const stdioUrl = import.meta.resolve('@modelcontextprotocol/sdk/server/stdio.js');
    await writeFile(serverPath, canaryServer(mcpUrl, stdioUrl), 'utf8');
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lists a tool named from CANARY when it is forwarded', { timeout: 30_000 }, async () => {
    const source: LiveSource = {
      kind: 'live',
      transport: 'stdio',
      command: process.execPath,
      args: [serverPath],
      env: { CANARY: 'tool_from_env' },
    };
    const result = await captureLive(source, { timeoutMs: 20_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tools.map((t) => t.name)).toContain('tool_from_env');
  });

  it('never writes a forwarded secret into the captured manifest', { timeout: 30_000 }, async () => {
    const source: LiveSource = {
      kind: 'live',
      transport: 'stdio',
      command: process.execPath,
      args: [serverPath],
      env: { CANARY: 'tool_from_env', TOKEN: 'SUPERSECRET' },
    };
    const result = await captureLive(source, { timeoutMs: 20_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A forwarded env value lives only on the ingest source; provenance carries the command line
    // alone, so a secret cannot reach the capture bytes. This pins that against regression.
    expect(serializeManifest(result.value)).not.toContain('SUPERSECRET');
  });
});
