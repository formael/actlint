// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The single ingestion interface. One function over every source; every branch returns a value.
//
// This is the quarantine that makes the rest of actlint pure: everything below returns a captured
// `ToolManifest` (or a typed `IngestError`), and nothing downstream knows or cares how it was
// obtained.

import type { Outcome, ToolManifest } from '@formael/actlint-core/contracts';
import { assertNever, err } from '@formael/actlint-core/contracts';
import { readManifestFile } from './capture.ts';
import type { IngestError } from './errors.ts';
import { registryNoTools, serverCardDraft } from './errors.ts';
import { captureLive } from './sources/live.ts';
import { fetchServerCard } from './sources/server-card.ts';
import type { IngestOptions, IngestSource } from './types.ts';

/**
 * Acquire a server's advertised tools and return a normalized, SDK-free `ToolManifest`.
 *
 * v0.1 sources: `live` (stdio/http) and `file` (deterministic replay). Experimental sources
 * (`server-card`, `registry`) require `options.experimental`; without it they return a typed error
 * explaining why. This function never issues `tools/call`.
 */
export async function ingest(
  source: IngestSource,
  options: IngestOptions = {},
): Promise<Outcome<ToolManifest, IngestError>> {
  switch (source.kind) {
    case 'live':
      return captureLive(source, options);

    case 'file':
      return readManifestFile(source.path);

    case 'server-card':
      if (options.experimental !== true) {
        return err(
          serverCardDraft(
            'server-card ingestion is experimental while its SEP is still draft; pass the experimental option to proceed',
          ),
        );
      }
      return fetchServerCard(source.origin, options);

    case 'registry':
      // The registry is a discovery index: its entries carry package pointers but no tool
      // definitions. Building a manifest requires a (sandboxed) live capture of the resolved
      // server — separate infrastructure — so there is nothing to normalize from the entry alone.
      return err(
        registryNoTools(
          `registry entry '${source.serverId}' carries package pointers but no tool definitions; capture the resolved server with a live source instead`,
        ),
      );

    default:
      return assertNever(source);
  }
}
