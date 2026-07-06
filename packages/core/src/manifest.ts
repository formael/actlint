// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import type { DeclaredProfile } from './declared.ts';
import { declaredProfileSchema } from './declared.ts';
import type { IsoTimestamp, Redacted } from './primitives.ts';
import { isoTimestampSchema, redactedSchema } from './primitives.ts';

// JsonSchema — opaque, validated JSON Schema object. Treated as data: the derivation engine walks
// it through a typed, defensive reader. Never `any`; validated by ajv downstream.
export const jsonSchemaSchema = z.record(z.string(), z.unknown());
export type JsonSchema = Readonly<Record<string, unknown>>;

// ManifestSource — closed union of capture provenance.
// Knowing where a manifest came from is required for the scorecard header and audit trail.
export type ManifestSource =
  | { readonly kind: 'live'; readonly transport: 'stdio' | 'http'; readonly endpoint: Redacted }
  | { readonly kind: 'server-card'; readonly url: string }
  | { readonly kind: 'registry'; readonly serverId: string }
  | { readonly kind: 'file'; readonly path: string };

const _manifestSourceSchemaRaw = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('live'),
    transport: z.enum(['stdio', 'http']),
    endpoint: redactedSchema,
  }),
  z.object({
    kind: z.literal('server-card'),
    url: z.string().url(),
  }),
  z.object({
    kind: z.literal('registry'),
    serverId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('file'),
    path: z.string().min(1),
  }),
]);
export const manifestSourceSchema = _manifestSourceSchemaRaw as z.ZodType<ManifestSource>;

// ToolDefinition — exactly the four MCP spec fields the pure engine needs.
// inputSchema is opaque data; description absence is itself a derivation signal.
export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: JsonSchema;
  readonly annotations: DeclaredProfile;
}

const _toolDefinitionSchemaRaw = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: jsonSchemaSchema,
  annotations: declaredProfileSchema,
});
export const toolDefinitionSchema = _toolDefinitionSchemaRaw as z.ZodType<ToolDefinition>;

// ToolManifest — a captured, SDK-independent snapshot of one MCP server's advertised tools.
// This is the single input to the pure pipeline. The SDK produces it; everything downstream
// is a pure function of (ToolManifest, Vocabulary).
//
// capturedAt: metadata ONLY — the pure engine MUST NEVER read it. Findings must be a function
// of `tools` and the vocabulary version only, not wall-clock time (Invariant 1).
export interface ToolManifest {
  readonly source: ManifestSource;
  readonly capturedAt: IsoTimestamp;
  readonly protocolRevision?: string;
  readonly tools: readonly ToolDefinition[];
}

const _toolManifestSchemaRaw = z.object({
  source: manifestSourceSchema,
  capturedAt: isoTimestampSchema,
  protocolRevision: z.string().optional(),
  tools: z.array(toolDefinitionSchema),
});
export const toolManifestSchema = _toolManifestSchemaRaw as z.ZodType<ToolManifest>;
