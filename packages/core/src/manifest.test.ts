// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { manifestSourceSchema, toolDefinitionSchema, toolManifestSchema } from './manifest.ts';
import { Redacted } from './primitives.ts';

const minimalAnnotations = { unknownHints: {} };

describe('manifestSourceSchema', () => {
  it('accepts a live stdio source', () => {
    const result = manifestSourceSchema.safeParse({
      kind: 'live',
      transport: 'stdio',
      endpoint: Redacted.create('unix:///var/run/mcp.sock'),
    });
    expect(result.success).toBe(true);
  });

  it('accepts a live http source', () => {
    const result = manifestSourceSchema.safeParse({
      kind: 'live',
      transport: 'http',
      endpoint: Redacted.create('https://api.example.com/mcp'),
    });
    expect(result.success).toBe(true);
  });

  it('accepts a server-card source', () => {
    expect(
      manifestSourceSchema.safeParse({ kind: 'server-card', url: 'https://example.com/.well-known/mcp' })
        .success,
    ).toBe(true);
  });

  it('accepts a registry source', () => {
    expect(manifestSourceSchema.safeParse({ kind: 'registry', serverId: 'stripe-payments' }).success).toBe(
      true,
    );
  });

  it('accepts a file source', () => {
    expect(
      manifestSourceSchema.safeParse({ kind: 'file', path: '/fixtures/stripe.manifest.json' }).success,
    ).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(manifestSourceSchema.safeParse({ kind: 'unknown-source' }).success).toBe(false);
  });

  it('rejects a live source with a plain string endpoint (must be Redacted)', () => {
    const result = manifestSourceSchema.safeParse({
      kind: 'live',
      transport: 'http',
      endpoint: 'https://example.com/mcp',
    });
    expect(result.success).toBe(false);
  });

  it('live source: endpoint never leaks through toString', () => {
    const rawUrl = 'https://admin:secretkey@api.example.com/mcp';
    const result = manifestSourceSchema.safeParse({
      kind: 'live',
      transport: 'http',
      endpoint: Redacted.create(rawUrl),
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === 'live') {
      expect(result.data.endpoint.toString()).toBe('[REDACTED]');
      expect(JSON.stringify(result.data)).not.toContain(rawUrl);
    }
  });
});

describe('toolDefinitionSchema', () => {
  it('accepts a minimal tool (no description)', () => {
    const result = toolDefinitionSchema.safeParse({
      name: 'delete_file',
      inputSchema: { type: 'object', properties: {} },
      annotations: minimalAnnotations,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a tool with description and annotations', () => {
    const result = toolDefinitionSchema.safeParse({
      name: 'send_email',
      description: 'Sends an email via SMTP.',
      inputSchema: { type: 'object' },
      annotations: {
        destructive: { state: 'false' },
        openWorld: { state: 'true' },
        unknownHints: {},
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a tool with an empty name', () => {
    expect(
      toolDefinitionSchema.safeParse({
        name: '',
        inputSchema: {},
        annotations: minimalAnnotations,
      }).success,
    ).toBe(false);
  });

  it('rejects a tool with a non-object inputSchema', () => {
    expect(
      toolDefinitionSchema.safeParse({
        name: 'my_tool',
        inputSchema: 'not-an-object',
        annotations: minimalAnnotations,
      }).success,
    ).toBe(false);
  });
});

describe('toolManifestSchema', () => {
  const validManifest = {
    source: { kind: 'file', path: '/fixtures/test.json' },
    capturedAt: '2026-07-04T10:00:00Z',
    tools: [
      {
        name: 'read_file',
        inputSchema: { type: 'object' },
        annotations: { readOnly: { state: 'true' }, unknownHints: {} },
      },
    ],
  };

  it('accepts a valid manifest', () => {
    expect(toolManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it('accepts a manifest with protocolRevision', () => {
    const result = toolManifestSchema.safeParse({ ...validManifest, protocolRevision: '2026-07-28' });
    expect(result.success).toBe(true);
  });

  it('accepts a manifest with an empty tools array', () => {
    expect(toolManifestSchema.safeParse({ ...validManifest, tools: [] }).success).toBe(true);
  });

  it('rejects a manifest with an invalid capturedAt', () => {
    expect(toolManifestSchema.safeParse({ ...validManifest, capturedAt: '2026-07-04' }).success).toBe(false);
  });

  it('rejects a manifest missing source', () => {
    const { source: _, ...withoutSource } = validManifest;
    expect(toolManifestSchema.safeParse(withoutSource).success).toBe(false);
  });
});
