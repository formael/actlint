// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The 401 diagnosis, exercised through the real live-capture path. A stubbed global fetch stands in
// for the server, so no socket is opened: the transport's own request is what the observer watches.
// A 401 becomes a typed `auth-required` that reads the server's own challenge; every other failure
// stays `connect-failed`, unchanged. No test here presents a real credential, and none is echoed.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LiveSource } from '../types.ts';
import { captureLive } from './live.ts';

const URL_STR = 'https://mcp.example.com/mcp';
const RMD = 'https://mcp.example.com/.well-known/oauth-protected-resource';

function httpSource(headers?: Record<string, string>): LiveSource {
  return {
    kind: 'live',
    transport: 'http',
    url: URL_STR,
    ...(headers !== undefined ? { headers } : {}),
  };
}

function respond(status: number, headers: Record<string, string> = {}): Response {
  return new Response('', { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('captureLive — 401 diagnosis', () => {
  it('turns a 401 with a Bearer challenge into a typed auth-required naming the resource metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(401, {
          'WWW-Authenticate': `Bearer resource_metadata="${RMD}", scope="mcp:read"`,
        }),
      ),
    );
    const result = await captureLive(httpSource(), { timeoutMs: 5_000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('auth-required');
    expect(result.error.message).toMatch(/requires authorization/);
    expect(result.error.context?.authScheme).toBe('Bearer');
    expect(result.error.context?.resourceMetadataUrl).toBe(RMD);
    expect(result.error.message).toContain(RMD);
  });

  it('reports "not accepted" when a credential was presented and still refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(401, { 'WWW-Authenticate': 'Bearer' })),
    );
    const result = await captureLive(httpSource({ Authorization: 'Bearer SUPERSECRET' }), {
      timeoutMs: 5_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('auth-required');
    expect(result.error.message).toMatch(/did not accept/);
    // The presented credential is never surfaced.
    expect(JSON.stringify(result.error)).not.toContain('SUPERSECRET');
  });

  it('still reports auth-required when the 401 carries no challenge, with the fields absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(401)),
    );
    const result = await captureLive(httpSource(), { timeoutMs: 5_000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('auth-required');
    expect(result.error.context?.authScheme).toBeUndefined();
    expect(result.error.context?.resourceMetadataUrl).toBeUndefined();
  });

  it('leaves a non-401 failure as connect-failed, unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(500)),
    );
    const result = await captureLive(httpSource(), { timeoutMs: 5_000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('connect-failed');
  });

  it('sends the presented header on the outgoing request', async () => {
    const seen: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        seen.push(Object.fromEntries(new Headers(init?.headers).entries()));
        return respond(401, { 'WWW-Authenticate': 'Bearer' });
      }),
    );
    await captureLive(httpSource({ Authorization: 'Bearer t0ken' }), { timeoutMs: 5_000 });
    expect(seen.some((h) => h.authorization === 'Bearer t0ken')).toBe(true);
  });
});
