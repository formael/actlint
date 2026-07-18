// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-mcp-fetch — the only IMPURE module.
//
// The single quarantine for network code and the MCP SDK. It acquires a server's advertised tools
// (live, server-card, registry, or file), NEVER calls them, and returns a normalized `ToolManifest`
// behind an anti-corruption boundary. Everything downstream is a pure function of that manifest.
// It depends on core ONLY via `@formael/actlint-core/contracts`.

export { readManifestFile, serializeManifest, writeCapture } from './capture.ts';
export type { IngestError, IngestErrorCode } from './errors.ts';
export { ingest } from './ingest.ts';
export { redactEndpoint, sanitizeUrl } from './redact.ts';
export { childEnv } from './sources/live.ts';
export { toManifest } from './to-manifest.ts';
export type { IngestOptions, IngestSource, LiveSource } from './types.ts';
export { DEFAULT_CLIENT_INFO, DEFAULT_TIMEOUT_MS } from './types.ts';
