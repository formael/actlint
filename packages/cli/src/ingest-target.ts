// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The bridge from a parsed CLI target to mcp-fetch's ingestion surface, plus the one path that does
// not go through mcp-fetch: `--manifest -` (stdin). Stdin is the fully-offline, deterministic entry
// point — a captured manifest piped in, findings out — so it is a first-class, tested path, not an
// afterthought. It is validated with core's manifest schema (the same shape the file source
// validates against), so its findings are identical to file ingestion; only the reading of the bytes
// differs.

import { type ToolManifest, toolManifestSchema } from '@formael/actlint-core';
import type { IngestSource } from '@formael/actlint-mcp-fetch';
import type { RawTarget } from './args.ts';
import { type CliError, ingestionError } from './exit-codes.ts';

/** True when the target is the stdin manifest path, which the shell reads directly. */
export function isStdinManifest(target: RawTarget): boolean {
  return target.kind === 'manifest' && target.path === '-';
}

/** Map a non-stdin target onto an mcp-fetch IngestSource. Stdin is handled separately, before this. */
export function toIngestSource(target: RawTarget): IngestSource {
  switch (target.kind) {
    case 'stdio':
      return { kind: 'live', transport: 'stdio', command: target.command, args: target.args };
    case 'http':
      return { kind: 'live', transport: 'http', url: target.url };
    case 'card':
      return { kind: 'server-card', origin: target.url };
    case 'registry':
      return { kind: 'registry', serverId: target.serverId };
    case 'manifest':
      return { kind: 'file', path: target.path };
  }
}

type ParseResult =
  | { readonly ok: true; readonly manifest: ToolManifest }
  | { readonly ok: false; readonly error: CliError };

/**
 * Parse a manifest read from stdin. Mirrors the file source: the provenance is set to a file source
 * (`-`), and the rest is validated against the manifest schema, so a malformed stdin manifest is an
 * ingestion error (exit 3) — actlint could not parse what it was given to look at.
 */
export function parseStdinManifest(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: ingestionError('manifest on stdin is not valid JSON') };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: ingestionError('manifest on stdin is not a JSON object') };
  }

  const candidate = { ...(parsed as Record<string, unknown>), source: { kind: 'file', path: '-' } };
  const result = toolManifestSchema.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      error: ingestionError(`manifest on stdin is not a valid manifest: ${result.error.message}`),
    };
  }
  return { ok: true, manifest: result.data };
}
