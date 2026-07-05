// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { Redacted, isoTimestampSchema } from '@formael/actlint-core/contracts';
import type { ManifestSource } from '@formael/actlint-core/contracts';
import { describe, expect, it } from 'vitest';

import { toManifest } from './to-manifest.ts';

const AT = isoTimestampSchema.parse('2026-01-01T00:00:00.000Z');
const SOURCE: ManifestSource = { kind: 'live', transport: 'stdio', endpoint: Redacted.create('mcp-server') };

describe('toManifest — valid normalization', () => {
  it('normalizes a well-formed tools/list result', () => {
    const raw = {
      tools: [
        {
          name: 'delete_record',
          description: 'Delete a record by id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
          annotations: { destructiveHint: true, readOnlyHint: false },
        },
      ],
    };

    const result = toManifest(raw, SOURCE, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.tools).toHaveLength(1);
    const tool = result.value.tools[0];
    expect(tool).toBeDefined();
    if (tool === undefined) return;
    expect(tool.name).toBe('delete_record');
    expect(tool.description).toBe('Delete a record by id.');
    expect(tool.inputSchema).toEqual(raw.tools[0]?.inputSchema);
    // An explicit `false` is a claim, not silence — it must be preserved as such.
    expect(tool.annotations.readOnly).toEqual({ state: 'false' });
    expect(tool.annotations.destructive).toEqual({ state: 'true' });
  });

  it('omits hints that are absent rather than inventing them', () => {
    const result = toManifest({ tools: [{ name: 't', inputSchema: { type: 'object' } }] }, SOURCE, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const annotations = result.value.tools[0]?.annotations;
    expect(annotations).toEqual({ unknownHints: {} });
    expect(annotations && 'readOnly' in annotations).toBe(false);
  });

  it('defaults a missing inputSchema to an empty object schema', () => {
    const result = toManifest({ tools: [{ name: 't' }] }, SOURCE, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tools[0]?.inputSchema).toEqual({ type: 'object' });
  });

  it('carries the injected provenance and timestamp verbatim', () => {
    const result = toManifest({ tools: [] }, SOURCE, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toEqual(SOURCE);
    expect(result.value.capturedAt).toBe(AT);
  });
});

describe('toManifest — unknown fields are captured, never dropped', () => {
  it('routes an unmodeled annotation field into unknownHints', () => {
    const result = toManifest(
      {
        tools: [
          {
            name: 't',
            inputSchema: { type: 'object' },
            annotations: { futureHint: 'watch-me', title: 'Nice' },
          },
        ],
      },
      SOURCE,
      AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tools[0]?.annotations.unknownHints).toEqual({
      futureHint: 'watch-me',
      title: 'Nice',
    });
  });

  it('does not trust a modeled hint carrying a non-boolean value — it keeps it in unknownHints', () => {
    const result = toManifest(
      { tools: [{ name: 't', inputSchema: { type: 'object' }, annotations: { destructiveHint: 'yes' } }] },
      SOURCE,
      AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const annotations = result.value.tools[0]?.annotations;
    expect(annotations && 'destructive' in annotations).toBe(false);
    expect(annotations?.unknownHints).toEqual({ destructiveHint: 'yes' });
  });
});

describe('toManifest — hostile input becomes a typed Err, never a throw', () => {
  const hostile: readonly [string, unknown][] = [
    ['a non-object result', 42],
    ['null', null],
    ['a result with no tools array', { tools: {} }],
    ['a tool that is not an object', { tools: ['nope'] }],
    ['a tool with no name', { tools: [{ inputSchema: { type: 'object' } }] }],
    ['a tool with an empty name', { tools: [{ name: '' }] }],
  ];

  for (const [label, raw] of hostile) {
    it(`rejects ${label}`, () => {
      let result: ReturnType<typeof toManifest>;
      expect(() => {
        result = toManifest(raw, SOURCE, AT);
      }).not.toThrow();
      // biome-ignore lint/style/noNonNullAssertion: assigned synchronously above.
      expect(result!.ok).toBe(false);
    });
  }
});
