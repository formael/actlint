// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { Redacted } from '@formael/actlint-core/contracts';
import { describe, expect, it } from 'vitest';

import { redactEndpoint, sanitizeUrl } from './redact.ts';

describe('sanitizeUrl', () => {
  it('strips userinfo but keeps scheme, host, and path', () => {
    expect(sanitizeUrl('https://user:hunter2@mcp.example.com/mcp')).toBe('https://mcp.example.com/mcp');
  });

  it('redacts sensitive query parameters case-insensitively', () => {
    const out = sanitizeUrl('https://mcp.example.com/mcp?Token=abc123&page=2');
    expect(out).not.toContain('abc123');
    expect(out).toContain('page=2');
  });

  it('returns a non-URL string unchanged (e.g. a stdio command line)', () => {
    expect(sanitizeUrl('npx -y @acme/mcp-server')).toBe('npx -y @acme/mcp-server');
  });
});

describe('redactEndpoint', () => {
  it('wraps in a Redacted that never renders the underlying value', () => {
    const redacted = redactEndpoint('https://user:hunter2@mcp.example.com/mcp?token=abc123');
    expect(redacted).toBeInstanceOf(Redacted);
    expect(redacted.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ endpoint: redacted })).not.toContain('hunter2');
    expect(JSON.stringify({ endpoint: redacted })).not.toContain('abc123');
  });

  it('sanitizes before wrapping so even an unwrap cannot surface a credential', () => {
    const redacted = redactEndpoint('https://user:hunter2@mcp.example.com/mcp?token=abc123');
    expect(Redacted.unwrap(redacted)).not.toContain('hunter2');
    expect(Redacted.unwrap(redacted)).not.toContain('abc123');
  });
});
