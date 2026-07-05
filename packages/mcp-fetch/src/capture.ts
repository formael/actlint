// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Capture-and-replay — the bridge to determinism and fixtures.
//
// `writeCapture` serializes a normalized manifest to plain, diffable JSON; `readManifestFile`
// replays one back. A captured manifest is three things at once: an offline determinism anchor
// (it replays to byte-identical downstream findings forever), a golden-fixture input, and the
// eval/scorecard corpus source. Because the file is canonical JSON, a change to a captured
// manifest shows up as a reviewable diff in a PR.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { err, ok } from '@formael/actlint-core/contracts';
import type { ManifestSource, Outcome, ToolManifest } from '@formael/actlint-core/contracts';
import { toolManifestSchema } from '@formael/actlint-core/contracts';
import { captureFailed, connectFailed, malformedTools } from './errors.ts';
import type { IngestError } from './errors.ts';

/** Recursively sort object keys so serialization is canonical and diff-stable. Arrays keep order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}

/**
 * Canonical, diffable JSON for a manifest, with a trailing newline. The JSON round-trip applies
 * `Redacted.toJSON()` first, so credentials are elided before key order is canonicalized.
 */
export function serializeManifest(manifest: ToolManifest): string {
  const plain: unknown = JSON.parse(JSON.stringify(manifest));
  return `${JSON.stringify(canonicalize(plain), null, 2)}\n`;
}

/** Write a normalized manifest to `path` as a capture file, creating parent directories. */
export async function writeCapture(
  manifest: ToolManifest,
  path: string,
): Promise<Outcome<void, IngestError>> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializeManifest(manifest), 'utf8');
    return ok(undefined);
  } catch {
    return err(captureFailed(`could not write capture file: ${path}`));
  }
}

/**
 * Replay a captured manifest from disk (the `file` source). The on-disk provenance is replaced
 * with `{ kind: 'file', path }` — the honest provenance of a replayed scan — while `tools`,
 * `capturedAt`, and `protocolRevision` are validated and preserved, so downstream findings are
 * byte-identical to the original capture.
 */
export async function readManifestFile(path: string): Promise<Outcome<ToolManifest, IngestError>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return err(connectFailed(`could not read manifest file: ${path}`));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err(malformedTools(`manifest file is not valid JSON: ${path}`));
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err(malformedTools(`manifest file is not a JSON object: ${path}`));
  }

  const source: ManifestSource = { kind: 'file', path };
  const candidate = { ...(parsed as Record<string, unknown>), source };
  const result = toolManifestSchema.safeParse(candidate);
  if (!result.success) {
    return err(malformedTools(`manifest file is not a valid ToolManifest: ${result.error.message}`));
  }
  return ok(result.data);
}
