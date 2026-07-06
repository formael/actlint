// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The anti-corruption boundary.
//
// `toManifest` is the one place a server's untrusted, SDK-shaped `tools/list` result is turned
// into actlint's own `ToolManifest`. Everything downstream speaks only actlint contracts, so an
// SDK release can never become an engine migration, and a hostile `tools/list` becomes a typed
// `Err` here — never a thrown exception deep in the engine.
//
// Two disciplines are load-bearing:
//   • Defensive: the input is `unknown`. Servers are untrusted; we validate every field.
//   • Forward-compatible: any annotation field we do not model lands in `unknownHints`, never
//     dropped — the precondition for downstream conservatism.

import type {
  DeclaredHint,
  DeclaredProfile,
  IsoTimestamp,
  JsonSchema,
  ManifestSource,
  Outcome,
  ToManifestFn,
  ToolDefinition,
  ToolManifest,
} from '@formael/actlint-core/contracts';
import { err, ok, toolManifestSchema } from '@formael/actlint-core/contracts';
import { nowIso } from './clock.ts';

// The MCP annotation fields actlint models, mapped to their DeclaredProfile keys. Every OTHER
// annotation field (including `title` and any future hint) is routed to `unknownHints`.
const KNOWN_HINT_KEYS: Readonly<Record<string, keyof Omit<DeclaredProfile, 'unknownHints'>>> = {
  readOnlyHint: 'readOnly',
  destructiveHint: 'destructive',
  idempotentHint: 'idempotent',
  openWorldHint: 'openWorld',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the MCP annotations block literally. A field present as a boolean becomes an explicit
 * `true`/`false` hint (the crucial `false` = an active claim); an absent field is simply omitted
 * (silence). Anything we cannot model — an unknown key, or a known key with a non-boolean value —
 * is preserved verbatim in `unknownHints` so it is captured, never dropped.
 */
function normalizeAnnotations(raw: unknown): DeclaredProfile {
  const hints: {
    readOnly?: DeclaredHint;
    destructive?: DeclaredHint;
    idempotent?: DeclaredHint;
    openWorld?: DeclaredHint;
  } = {};
  const unknownHints: Record<string, unknown> = {};

  if (isPlainObject(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const mapped = KNOWN_HINT_KEYS[key];
      if (mapped !== undefined && typeof value === 'boolean') {
        hints[mapped] = { state: value ? 'true' : 'false' };
      } else {
        // Unknown field, or a modeled hint carrying a value we refuse to interpret as a claim.
        unknownHints[key] = value;
      }
    }
  }

  return { ...hints, unknownHints };
}

/** `inputSchema` is opaque data. Keep any object as-is; default a missing/invalid one to `{}`-object. */
function normalizeInputSchema(raw: unknown): JsonSchema {
  return isPlainObject(raw) ? raw : { type: 'object' };
}

function normalizeTool(raw: unknown, index: number): Outcome<ToolDefinition> {
  if (!isPlainObject(raw)) {
    return err({ code: 'invalid-manifest', message: `tool at index ${index} is not an object` });
  }
  const name = raw.name;
  if (typeof name !== 'string' || name.length === 0) {
    return err({ code: 'invalid-manifest', message: `tool at index ${index} has no non-empty string name` });
  }
  const description = raw.description;
  const tool: ToolDefinition = {
    name,
    // A non-string description is treated as absent — itself a derivation signal downstream.
    ...(typeof description === 'string' ? { description } : {}),
    inputSchema: normalizeInputSchema(raw.inputSchema),
    annotations: normalizeAnnotations(raw.annotations),
  };
  return ok(tool);
}

/**
 * Translate a raw `tools/list` result into a validated `ToolManifest`.
 *
 * @param raw untrusted server output (SDK-shaped); validated defensively, never trusted.
 * @param source the redacted provenance to stamp onto the manifest.
 * @param capturedAt provenance timestamp (metadata only; the engine never reads it). Injected for
 *   determinism in tests; defaults to now.
 * @param protocolRevision the negotiated MCP protocol revision, if known.
 */
export function toManifest(
  raw: unknown,
  source: ManifestSource,
  capturedAt: IsoTimestamp = nowIso(),
  protocolRevision?: string,
): Outcome<ToolManifest> {
  if (!isPlainObject(raw)) {
    return err({ code: 'invalid-manifest', message: 'tools/list result is not an object' });
  }
  const rawTools = raw.tools;
  if (!Array.isArray(rawTools)) {
    return err({ code: 'invalid-manifest', message: 'tools/list result has no tools array' });
  }

  const tools: ToolDefinition[] = [];
  for (let i = 0; i < rawTools.length; i++) {
    const normalized = normalizeTool(rawTools[i], i);
    if (!normalized.ok) return normalized;
    tools.push(normalized.value);
  }

  const candidate: ToolManifest = {
    source,
    capturedAt,
    ...(typeof protocolRevision === 'string' ? { protocolRevision } : {}),
    tools,
  };

  // Re-validate the fully-normalized value against the core schema: the boundary's own contract.
  const parsed = toolManifestSchema.safeParse(candidate);
  if (!parsed.success) {
    return err({
      code: 'invalid-manifest',
      message: `normalized manifest failed validation: ${parsed.error.message}`,
    });
  }
  return ok(parsed.data);
}

// Compile-time proof that `toManifest` satisfies the contract declared in core/contracts. The extra
// optional parameters keep it assignable to the two-argument `ToManifestFn`.
const _contract: ToManifestFn = toManifest;
void _contract;
