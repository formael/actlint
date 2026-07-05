// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The server-card source — experimental, and gated one level up in `ingest`.
//
// A server card is static metadata served from a well-known path: it lets actlint read a server's
// declared tools WITHOUT connecting to it and WITHOUT credentials — exactly what the ecosystem
// scorecard needs to scan many servers safely. The SEP is still Draft and even the path is
// unsettled, so this stays behind `--experimental` until the spec stabilizes and is confirmed to
// carry full tool definitions.

import { err, ok } from '@formael/actlint-core/contracts';
import type { ManifestSource, Outcome, ToolManifest } from '@formael/actlint-core/contracts';
import { nowIso } from '../clock.ts';
import { connectFailed, malformedTools, timedOut } from '../errors.ts';
import type { IngestError } from '../errors.ts';
import { sanitizedDetail } from '../net.ts';
import { redactEndpoint } from '../redact.ts';
import { toManifest } from '../to-manifest.ts';
import { DEFAULT_TIMEOUT_MS } from '../types.ts';
import type { IngestOptions } from '../types.ts';

// The draft well-known path. Kept in one place so it is trivial to update when the SEP settles.
const WELL_KNOWN_PATH = '/.well-known/mcp.json';

/** Fetch and normalize a server card from `<origin>/.well-known/mcp.json`. No connection, no credentials. */
export async function fetchServerCard(
  origin: string,
  options: IngestOptions = {},
): Promise<Outcome<ToolManifest, IngestError>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = new URL(WELL_KNOWN_PATH, origin).toString();
  const endpoint = redactEndpoint(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
  } catch (error) {
    if (controller.signal.aborted) return err(timedOut('the server card did not respond in time', endpoint));
    const detail = sanitizedDetail(error);
    return err(
      connectFailed(
        detail === undefined
          ? 'could not fetch the server card'
          : `could not fetch the server card (${detail})`,
        endpoint,
      ),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return err(connectFailed(`server card request returned HTTP ${response.status}`, endpoint));
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return err(malformedTools('server card is not valid JSON'));
  }

  const provenance: ManifestSource = { kind: 'server-card', url };
  const manifest = toManifest(body, provenance, nowIso());
  if (!manifest.ok) return err(malformedTools(manifest.error.message));
  return ok(manifest.value);
}
