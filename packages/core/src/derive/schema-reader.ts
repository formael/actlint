// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The typed, defensive JSON Schema reader.
//
// `inputSchema` is opaque data (`Readonly<Record<string, unknown>>`). Schema-shape signals are
// derived by *walking its structure*, never by matching its raw text: a `uri`-format field nested
// three objects deep is found; the substring "url" inside a description is not. Every access is
// guarded — a malformed or unexpected node contributes nothing (conservative silence) rather than
// throwing, so a hostile or sloppy schema can never crash derivation nor manufacture a false signal.

import type { JsonSchema } from '../manifest.ts';

// A parameter observed in the schema, reduced to exactly what the schema-shape signals ask about:
// its declared name, its declared string `format` (if any), and whether it is an unconstrained
// free-form string (a string with no `enum`, `const`, `pattern`, or `format` to bound it).
export interface SchemaParam {
  readonly name: string;
  readonly format?: string;
  readonly isFreeformString: boolean;
}

// Bound the walk so a self-referential or pathologically deep schema cannot spin. Real tool
// schemas are shallow; anything past this depth is not where an honest signal hides.
const MAX_DEPTH = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Does the node declare `type: "string"` (directly or within a type union)?
function isStringTyped(node: Record<string, unknown>): boolean {
  const type = node.type;
  if (type === 'string') return true;
  return Array.isArray(type) && type.includes('string');
}

// A string parameter is "constrained" when the schema bounds its value — an enum, a const, a tight
// pattern, or a declared format. An unconstrained string is the free-form-code-input shape.
function isConstrained(node: Record<string, unknown>): boolean {
  return (
    'enum' in node || 'const' in node || typeof node.pattern === 'string' || typeof node.format === 'string'
  );
}

function describeParam(name: string, node: unknown): SchemaParam {
  if (!isRecord(node)) return { name, isFreeformString: false };
  const format = typeof node.format === 'string' ? node.format : undefined;
  const isFreeformString = isStringTyped(node) && !isConstrained(node);
  return format === undefined ? { name, isFreeformString } : { name, format, isFreeformString };
}

// Subschema-bearing keywords whose value is a single schema.
const NESTED_SCHEMA_KEYS = [
  'items',
  'additionalProperties',
  'contains',
  'if',
  'then',
  'else',
  'not',
] as const;
// Keywords whose value is an array of schemas.
const SCHEMA_ARRAY_KEYS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;
// Keywords whose value is a map of named subschemas (reused definitions).
const DEFINITION_KEYS = ['$defs', 'definitions'] as const;

function walk(node: unknown, depth: number, out: SchemaParam[]): void {
  if (depth > MAX_DEPTH || !isRecord(node)) return;

  const { properties } = node;
  if (isRecord(properties)) {
    for (const [name, sub] of Object.entries(properties)) {
      out.push(describeParam(name, sub));
      walk(sub, depth + 1, out);
    }
  }

  for (const key of NESTED_SCHEMA_KEYS) {
    walk(node[key], depth + 1, out);
  }

  for (const key of SCHEMA_ARRAY_KEYS) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const sub of value) walk(sub, depth + 1, out);
    }
  }

  for (const key of DEFINITION_KEYS) {
    const value = node[key];
    if (isRecord(value)) {
      for (const sub of Object.values(value)) walk(sub, depth + 1, out);
    }
  }
}

/**
 * Collect every parameter the schema declares, walking nested objects, array items, combinators
 * (`allOf`/`anyOf`/…), and reusable `$defs`. Order follows the schema's own key order for stable
 * output. Pure and total — never throws.
 */
export function collectParams(schema: JsonSchema): readonly SchemaParam[] {
  const out: SchemaParam[] = [];
  walk(schema, 0, out);
  return out;
}
