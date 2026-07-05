// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The ingestion input surface.
//
// An `IngestSource` is what a caller asks actlint to look at — it carries the LIVE connection
// details (a command line, a URL, an auth header). It is deliberately distinct from the
// `ManifestSource` provenance that ends up on the returned `ToolManifest`: that provenance is
// redacted, credential-free, and safe to write into a capture file. Credentials enter here and
// never leave this package.

/** How to reach a server, with the raw connection details needed to acquire its tools. */
export type IngestSource =
  | {
      readonly kind: 'live';
      readonly transport: 'stdio';
      readonly command: string;
      readonly args?: readonly string[];
      readonly env?: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: 'live';
      readonly transport: 'http';
      readonly url: string;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | { readonly kind: 'server-card'; readonly origin: string }
  | { readonly kind: 'registry'; readonly serverId: string }
  | { readonly kind: 'file'; readonly path: string };

/** The two live-transport variants, narrowed for the live-capture path. */
export type LiveSource = Extract<IngestSource, { kind: 'live' }>;

/** Optional knobs for an ingestion. All have conservative defaults. */
export interface IngestOptions {
  /** Permit experimental sources (server cards, against a still-draft SEP). Off by default. */
  readonly experimental?: boolean;
  /** Per-operation timeout in milliseconds. */
  readonly timeoutMs?: number;
  /** Identity actlint announces to the server during the MCP handshake. */
  readonly clientInfo?: { readonly name: string; readonly version: string };
}

/** Default per-operation timeout: long enough for a slow cold start, short enough to fail a hang. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** The identity actlint announces when it connects. Read-only; it never issues `tools/call`. */
export const DEFAULT_CLIENT_INFO = { name: 'actlint', version: '0.1.0' } as const;
