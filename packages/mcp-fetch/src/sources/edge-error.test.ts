// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The edge error map, unit-tested directly and without a network. `edgeError` is total: every
// rejection the capture path can catch becomes exactly one typed `IngestError`. A timeout, an
// observed 401 challenge, an SDK-surfaced 401, a protocol-version mismatch, and everything else
// each have a single, calm destination — and no credential ever reaches the message.

import { Redacted } from '@formael/actlint-core/contracts';
import {
  SdkErrorCode,
  SdkHttpError,
  UnauthorizedError,
  UnsupportedProtocolVersionError,
} from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';

import { TimeoutError } from '../net.ts';
import type { LiveSource } from '../types.ts';
import { edgeError } from './live.ts';

const ENDPOINT = Redacted.create('https://mcp.example.com/mcp');
const HTTP: LiveSource = { kind: 'live', transport: 'http', url: 'https://mcp.example.com/mcp' };
const HTTP_WITH_AUTH: LiveSource = {
  kind: 'live',
  transport: 'http',
  url: 'https://mcp.example.com/mcp',
  headers: { Authorization: 'Bearer SUPERSECRET' },
};

/** A 401 the SDK surfaced as an HTTP error, carrying `status: 401`. */
function http401(): SdkHttpError {
  return new SdkHttpError(SdkErrorCode.ClientHttpAuthentication, 'HTTP 401', { status: 401 });
}

/** A 500 the SDK surfaced as an HTTP error — not an authorization failure. */
function http500(): SdkHttpError {
  return new SdkHttpError(SdkErrorCode.ClientHttpUnexpectedContent, 'HTTP 500', { status: 500 });
}

describe('edgeError — total mapping of a caught rejection to a typed IngestError', () => {
  it('maps a TimeoutError to timeout', () => {
    const result = edgeError(new TimeoutError(), ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('timeout');
    expect(result.message).toBe('the server did not respond in time');
  });

  it('maps an observed 401 challenge to auth-required, reading the server’s own scheme', () => {
    const result = edgeError(new Error('irrelevant'), ENDPOINT, HTTP, { scheme: 'Bearer' });
    expect(result.code).toBe('auth-required');
    expect(result.message).toMatch(/requires authorization/);
    expect(result.context?.authScheme).toBe('Bearer');
  });

  it('maps an UnauthorizedError with no observed challenge to auth-required, fields absent', () => {
    const result = edgeError(new UnauthorizedError('unauthorized'), ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('auth-required');
    expect(result.message).toMatch(/requires authorization/);
    expect(result.context?.authScheme).toBeUndefined();
    expect(result.context?.resourceMetadataUrl).toBeUndefined();
  });

  it('maps an SdkHttpError with status 401 and no challenge to auth-required', () => {
    const result = edgeError(http401(), ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('auth-required');
    expect(result.message).toMatch(/requires authorization/);
  });

  it('reports "did not accept" for a 401 when a credential was presented, echoing none of it', () => {
    const result = edgeError(http401(), ENDPOINT, HTTP_WITH_AUTH, undefined);
    expect(result.code).toBe('auth-required');
    expect(result.message).toMatch(/did not accept/);
    expect(JSON.stringify(result)).not.toContain('SUPERSECRET');
  });

  it('maps an UnsupportedProtocolVersionError to a calm connect-failed', () => {
    const error = new UnsupportedProtocolVersionError({
      supported: ['2025-06-18'],
      requested: '2026-07-28',
    });
    const result = edgeError(error, ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('connect-failed');
    expect(result.message).toBe('the server and actlint share no protocol version');
  });

  it('surfaces a system error code as a sanitized connect-failed detail', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9999'), {
      code: 'ECONNREFUSED',
    });
    const result = edgeError(error, ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('connect-failed');
    expect(result.message).toBe('connection failed (ECONNREFUSED)');
  });

  it('maps a non-401 SDK HTTP error to connect-failed, surfacing only its sanitized code', () => {
    const result = edgeError(http500(), ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('connect-failed');
    // The SDK error code is uppercase and credential-free, so it is safe to show; the host is not.
    expect(result.message).toBe('connection failed (CLIENT_HTTP_UNEXPECTED_CONTENT)');
    expect(result.message).not.toContain('mcp.example.com');
  });

  it('maps an unrecognized rejection to connect-failed with no detail', () => {
    const result = edgeError(new Error('anything'), ENDPOINT, HTTP, undefined);
    expect(result.code).toBe('connect-failed');
    expect(result.message).toBe('connection failed');
  });
});
