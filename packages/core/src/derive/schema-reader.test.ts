// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import type { JsonSchema } from '../manifest.ts';
import { collectParams, type SchemaParam } from './schema-reader.ts';

const byName = (params: readonly SchemaParam[], name: string): SchemaParam | undefined =>
  params.find((p) => p.name === name);

describe('collectParams', () => {
  it('collects top-level properties with their declared format', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        body: { type: 'string' },
      },
    };
    const params = collectParams(schema);
    expect(byName(params, 'to')?.format).toBe('email');
    expect(byName(params, 'body')?.format).toBeUndefined();
  });

  it('finds a destination nested inside an object property (structure, not text)', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: { callback_url: { type: 'string', format: 'uri' } },
        },
      },
    };
    const params = collectParams(schema);
    expect(byName(params, 'callback_url')?.format).toBe('uri');
  });

  it('finds properties inside array items and combinators', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        targets: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' } } } },
      },
      anyOf: [{ type: 'object', properties: { webhook: { type: 'string' } } }],
    };
    const names = collectParams(schema).map((p) => p.name);
    expect(names).toContain('url');
    expect(names).toContain('webhook');
  });

  it('marks an unconstrained string parameter as free-form', () => {
    const schema: JsonSchema = { type: 'object', properties: { sql: { type: 'string' } } };
    expect(byName(collectParams(schema), 'sql')?.isFreeformString).toBe(true);
  });

  it('does NOT mark a constrained string (enum / pattern / format) as free-form', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['a', 'b'] },
        code: { type: 'string', pattern: '^[0-9]{4}$' },
        link: { type: 'string', format: 'uri' },
        raw: { type: 'string' },
      },
    };
    const params = collectParams(schema);
    expect(byName(params, 'mode')?.isFreeformString).toBe(false);
    expect(byName(params, 'code')?.isFreeformString).toBe(false);
    expect(byName(params, 'link')?.isFreeformString).toBe(false);
    expect(byName(params, 'raw')?.isFreeformString).toBe(true);
  });

  it('is defensive: malformed or non-object schemas contribute nothing, never throw', () => {
    expect(collectParams({})).toEqual([]);
    // `properties` that is not an object is ignored rather than crashing the walk.
    expect(collectParams({ properties: 'nonsense' } as unknown as JsonSchema)).toEqual([]);
    expect(collectParams({ properties: { x: null } } as unknown as JsonSchema)).toEqual([
      { name: 'x', isFreeformString: false },
    ]);
  });
});
