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
import { extractWWWAuthenticateParams } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { nowIso } from '../clock.ts';
import type { IngestError } from '../errors.ts';
import { authRequired, connectFailed, malformedTools, timedOut } from '../errors.ts';
import { sanitizedDetail, TimeoutError, withTimeout } from '../net.ts';
import { redactEndpoint, sanitizeUrl } from '../redact.ts';
import { toManifest } from '../to-manifest.ts';
import type { IngestOptions, LiveSource } from '../types.ts';
import { DEFAULT_CLIENT_INFO, DEFAULT_TIMEOUT_MS } from '../types.ts';

/** What a server declared on a 401 — read from its own `WWW-Authenticate` header, never held by us. */
interface AuthChallenge {
  readonly scheme?: string;
  readonly resourceMetadataUrl?: string;
}

/** A built transport plus the redacted endpoint used for provenance and error context. */
interface Wired {
  readonly transport: Transport;
  readonly endpoint: Redacted;
  readonly provenance: ManifestSource;
  /** The 401 challenge observed during the connection, if any. Undefined until (and unless) one is seen. */
  readonly challenge: () => AuthChallenge | undefined;
}

/**
 * Wrap fetch to notice a 401 and read the challenge the server itself sent. Read-only: every call is
 * forwarded to the platform fetch unchanged and the response returned untouched; the observer issues
 * no request of its own and follows no URL. A 401 alone is the signal — the challenge fields are
 * enrichment, absent when the server sends no (or a non-Bearer) `WWW-Authenticate`.
 */
function observeAuth(): { fetch: typeof fetch; challenge: () => AuthChallenge | undefined } {
  let seen: AuthChallenge | undefined;
  const observer: typeof fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init);
    if (response.status === 401 && seen === undefined) {
      const header = response.headers.get('WWW-Authenticate') ?? undefined;
      const scheme = header?.trim().split(/\s+/, 1)[0];
      const url = extractWWWAuthenticateParams(response).resourceMetadataUrl?.toString();
      seen = {
        ...(scheme !== undefined && scheme.length > 0 ? { scheme } : {}),
        ...(url !== undefined ? { resourceMetadataUrl: sanitizeUrl(url) } : {}),
      };
    }
    return response;
  };
  return { fetch: observer, challenge: () => seen };
}

// The SDK transports are not written against `exactOptionalPropertyTypes`, so their concrete
// classes are not structurally assignable to `Transport` under our strict config. Bridge that gap
// once, here at the SDK boundary, rather than loosening the whole workspace.
function asTransport(transport: StdioClientTransport | StreamableHTTPClientTransport): Transport {
  return transport as unknown as Transport;
}

/**
 * The child's environment: the SDK's sanitized defaults with the caller's named variables on top.
 * The SDK treats a supplied `env` as the entire child environment — the defaults (PATH, HOME, …) are
 * not merged in — so passing only the user's variables would leave the child with no PATH. Merging
 * over the defaults keeps npx-launched servers working; the caller wins on a collision, so an
 * explicit override (e.g. `--env PATH=…`) still takes effect.
 */
export function childEnv(env: Readonly<Record<string, string>>): Record<string, string> {
  return { ...getDefaultEnvironment(), ...env };
}

function wire(source: LiveSource): Wired {
  if (source.transport === 'stdio') {
    const commandLine = [source.command, ...(source.args ?? [])].join(' ').trim();
    const endpoint = redactEndpoint(commandLine);
    const transport = new StdioClientTransport({
      command: source.command,
      ...(source.args !== undefined ? { args: [...source.args] } : {}),
      ...(source.env !== undefined ? { env: childEnv(source.env) } : {}),
    });
    return {
      transport: asTransport(transport),
      endpoint,
      provenance: { kind: 'live', transport: 'stdio', endpoint },
      challenge: () => undefined,
    };
  }
  const endpoint = redactEndpoint(source.url);
  const observer = observeAuth();
  const transport = new StreamableHTTPClientTransport(new URL(source.url), {
    fetch: observer.fetch,
    ...(source.headers !== undefined ? { requestInit: { headers: { ...source.headers } } } : {}),
  });
  return {
    transport: asTransport(transport),
    endpoint,
    provenance: { kind: 'live', transport: 'http', endpoint },
    challenge: observer.challenge,
  };
}

/** True when the source presented an Authorization header — so a 401 means "not accepted", not "none sent". */
function presentedAuthorization(source: LiveSource): boolean {
  if (source.transport !== 'http' || source.headers === undefined) return false;
  return Object.keys(source.headers).some((name) => name.toLowerCase() === 'authorization');
}

/** The calm, credential-free message for a 401 — two variants: no credential sent, or one not accepted. */
function authMessage(source: LiveSource, challenge: AuthChallenge): string {
  const scheme = challenge.scheme !== undefined ? `, ${challenge.scheme}` : '';
  const base = presentedAuthorization(source)
    ? `the server did not accept the presented credential (HTTP 401${scheme})`
    : `the server requires authorization before it will share its tool list (HTTP 401${scheme})`;
  return challenge.resourceMetadataUrl !== undefined
    ? `${base}; its resource metadata is at ${challenge.resourceMetadataUrl}`
    : base;
}

function edgeError(
  error: unknown,
  endpoint: Redacted,
  source: LiveSource,
  challenge: AuthChallenge | undefined,
): IngestError {
  if (error instanceof TimeoutError) return timedOut('the server did not respond in time', endpoint);
  // A 401 was observed on the connection: the failure is authorization, not an unreachable server.
  if (challenge !== undefined) {
    return authRequired(authMessage(source, challenge), endpoint, challenge);
  }
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
  const { transport, endpoint, provenance, challenge } = wire(source);
  const client = new Client({ name: clientInfo.name, version: clientInfo.version }, { capabilities: {} });

  let raw: unknown;
  try {
    await withTimeout(client.connect(transport), timeoutMs);
    // The one wire read actlint ever makes: the tool declarations. Never `client.callTool(...)`.
    raw = await withTimeout(client.listTools(), timeoutMs);
  } catch (error) {
    await close(client);
    return err(edgeError(error, endpoint, source, challenge()));
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
