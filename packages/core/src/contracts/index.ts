// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core/contracts — the anti-corruption boundary.
//
// This sub-path exposes ONLY the manifest types that mcp-fetch produces and core consumes.
// mcp-fetch MUST import from here and NOWHERE ELSE in core — SDK shapes must never leak into
// the pure engine. Enforced by scripts/check-sdk-boundary.ts.

// Declared side: what a tool says about itself — needed to build a ToolManifest
export type { DeclaredHint, DeclaredProfile } from '../declared.ts';
export { declaredHintSchema, declaredProfileSchema } from '../declared.ts';
// Input boundary: the manifest types mcp-fetch produces
export type { JsonSchema, ManifestSource, ToolDefinition, ToolManifest } from '../manifest.ts';
export {
  jsonSchemaSchema,
  manifestSourceSchema,
  toolDefinitionSchema,
  toolManifestSchema,
} from '../manifest.ts';
// Error model: mcp-fetch returns Outcome<ToolManifest> from toManifest
export type { ActlintError, ErrorCode, Outcome } from '../outcome.ts';
export { assertNever, err, errorCodeSchema, ok } from '../outcome.ts';
// Primitives: Redacted (class export for construction) and IsoTimestamp
export type { IsoTimestamp } from '../primitives.ts';
export { isoTimestampSchema, Redacted, redactedSchema } from '../primitives.ts';

// ---------------------------------------------------------------------------
// toManifest — the translation function contract that mcp-fetch must satisfy.
// Declared here as a named type so the boundary is a compiler-checked contract, not a convention.
// core never calls this function; mcp-fetch imports this type and implements it.
// SdkListToolsResult is intentionally opaque here: the SDK type is concrete only in mcp-fetch.
// ---------------------------------------------------------------------------
import type { ManifestSource, ToolManifest } from '../manifest.ts';
import type { Outcome } from '../outcome.ts';

export type SdkListToolsResult = unknown;
export type ToManifestFn = (sdkResult: SdkListToolsResult, source: ManifestSource) => Outcome<ToolManifest>;
