// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core/contracts — the anti-corruption boundary.
//
// This sub-path exposes ONLY the manifest types that mcp-fetch produces and core consumes.
// mcp-fetch MUST import from here and NOWHERE ELSE in core — SDK shapes must never leak into
// the pure engine. Enforced by scripts/check-sdk-boundary.ts.

// Input boundary: the manifest types mcp-fetch produces
export type { ToolManifest, ToolDefinition, ManifestSource, JsonSchema } from '../manifest.ts';
export {
  toolManifestSchema,
  toolDefinitionSchema,
  manifestSourceSchema,
  jsonSchemaSchema,
} from '../manifest.ts';

// Declared side: what a tool says about itself — needed to build a ToolManifest
export type { DeclaredProfile, DeclaredHint } from '../declared.ts';
export { declaredProfileSchema, declaredHintSchema } from '../declared.ts';

// Primitives: Redacted (class export for construction) and IsoTimestamp
export type { IsoTimestamp } from '../primitives.ts';
export { Redacted, isoTimestampSchema, redactedSchema } from '../primitives.ts';

// Error model: mcp-fetch returns Outcome<ToolManifest> from toManifest
export type { Outcome, ActlintError, ErrorCode } from '../outcome.ts';
export { ok, err, errorCodeSchema, assertNever } from '../outcome.ts';

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
