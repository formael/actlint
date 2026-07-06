// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The live-capture source — the ONE module that imports the MCP SDK and opens a connection.
//
// It launches or connects to a server, reads its advertised tools with `listTools()`, and hands
// the raw result to the anti-corruption boundary. It NEVER issues `tools/call`: actlint reads the
// labels on outbound actions, it does not pull the triggers. Every network reality (a refused
// socket, a hung server) is caught here and returned as a typed `IngestError`.

import type { ManifestSource, Outcome, Redacted, ToolManifest } from '@formael/actlint-core/contracts';
import { err, ok } from '@formael/actlint-core/contracts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { nowIso } from '../clock.ts';
import type { IngestError } from '../errors.ts';
import { connectFailed, malformedTools, timedOut } from '../errors.ts';
import { sanitizedDetail, TimeoutError, withTimeout } from '../net.ts';
import { redactEndpoint } from '../redact.ts';
import { toManifest } from '../to-manifest.ts';
import type { IngestOptions, LiveSource } from '../types.ts';
import { DEFAULT_CLIENT_INFO, DEFAULT_TIMEOUT_MS } from '../types.ts';

/** A built transport plus the redacted endpoint used for provenance and error context. */
interface Wired {
  readonly transport: Transport;
  readonly endpoint: Redacted;
  readonly provenance: ManifestSource;
}

// The SDK transports are not written against `exactOptionalPropertyTypes`, so their concrete
// classes are not structurally assignable to `Transport` under our strict config. Bridge that gap
// once, here at the SDK boundary, rather than loosening the whole workspace.
function asTransport(transport: StdioClientTransport | StreamableHTTPClientTransport): Transport {
  return transport as unknown as Transport;
}

function wire(source: LiveSource): Wired {
  if (source.transport === 'stdio') {
    const commandLine = [source.command, ...(source.args ?? [])].join(' ').trim();
    const endpoint = redactEndpoint(commandLine);
    const transport = new StdioClientTransport({
      command: source.command,
      ...(source.args !== undefined ? { args: [...source.args] } : {}),
      ...(source.env !== undefined ? { env: { ...source.env } } : {}),
    });
    return {
      transport: asTransport(transport),
      endpoint,
      provenance: { kind: 'live', transport: 'stdio', endpoint },
    };
  }
  const endpoint = redactEndpoint(source.url);
  const transport = new StreamableHTTPClientTransport(new URL(source.url), {
    ...(source.headers !== undefined ? { requestInit: { headers: { ...source.headers } } } : {}),
  });
  return {
    transport: asTransport(transport),
    endpoint,
    provenance: { kind: 'live', transport: 'http', endpoint },
  };
}

function edgeError(error: unknown, endpoint: Redacted): IngestError {
  if (error instanceof TimeoutError) return timedOut('the server did not respond in time', endpoint);
  const detail = sanitizedDetail(error);
  return connectFailed(
    detail === undefined ? 'connection failed' : `connection failed (${detail})`,
    endpoint,
  );
}

/**
 * Connect to a live server, list its tools, and normalize them into a `ToolManifest`. Read-only:
 * there is no `callTool` here or anywhere in the codebase.
 */
export async function captureLive(
  source: LiveSource,
  options: IngestOptions = {},
): Promise<Outcome<ToolManifest, IngestError>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clientInfo = options.clientInfo ?? DEFAULT_CLIENT_INFO;
  const { transport, endpoint, provenance } = wire(source);
  const client = new Client({ name: clientInfo.name, version: clientInfo.version }, { capabilities: {} });

  let raw: unknown;
  try {
    await withTimeout(client.connect(transport), timeoutMs);
    // The one wire read actlint ever makes: the tool declarations. Never `client.callTool(...)`.
    raw = await withTimeout(client.listTools(), timeoutMs);
  } catch (error) {
    await close(client);
    return err(edgeError(error, endpoint));
  }
  await close(client);

  const manifest = toManifest(raw, provenance, nowIso());
  if (!manifest.ok) return err(malformedTools(manifest.error.message));
  return ok(manifest.value);
}

async function close(client: Client): Promise<void> {
  try {
    await client.close();
  } catch {
    // A best-effort teardown; a failure to close cleanly must not mask the real outcome.
  }
}
