// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The typed ingestion error.
//
// Every messy reality of the edge — a refused socket, a hung server, a hostile `tools/list`, a
// registry entry with no tool definitions — is turned into one of these VALUES here, before
// anything downstream sees it. The pure engine is offline, so no failure mode of the engine is
// ever a network failure: the CLI maps every `IngestError` to exit code 3 ("couldn't look"),
// cleanly separated from exit 1 ("found problems").

import type { Redacted } from '@formael/actlint-core/contracts';
import { sanitizeUrl } from './redact.ts';

export type IngestErrorCode =
  | 'connect-failed' // could not reach or read the source
  | 'auth-required' // the source demands authorization before it will share its tools (HTTP 401)
  | 'timeout' // the source did not respond in time
  | 'malformed-tools' // the source returned something un-normalizable
  | 'unsupported-source' // no ingestion strategy for this source kind
  | 'registry-no-tools' // registry entry carries package pointers, not tool definitions
  | 'server-card-draft' // server-card SEP is still draft; pass experimental to proceed
  | 'capture-skipped' // scorecard harness: server requires interactive auth
  | 'capture-failed'; // could not write the capture file to disk

/** An ingestion failure as data. `context.endpoint` is always redacted — never a raw credential. */
export interface IngestError {
  readonly code: IngestErrorCode;
  readonly message: string;
  readonly context?: {
    readonly endpoint?: Redacted;
    /** RFC 9728 challenge fields the server itself declared on its 401. Never a credential. */
    readonly authScheme?: string;
    readonly resourceMetadataUrl?: string;
  };
}

function withEndpoint(endpoint: Redacted | undefined): Pick<IngestError, 'context'> {
  return endpoint === undefined ? {} : { context: { endpoint } };
}

export function connectFailed(message: string, endpoint?: Redacted): IngestError {
  return { code: 'connect-failed', message, ...withEndpoint(endpoint) };
}

export function timedOut(message: string, endpoint?: Redacted): IngestError {
  return { code: 'timeout', message, ...withEndpoint(endpoint) };
}

/**
 * The source answered with HTTP 401: it will not share its tools without a credential. The optional
 * challenge fields come from the server's own `WWW-Authenticate` header, not from anything actlint
 * holds. `resourceMetadataUrl` is sanitized before storage — defense in depth, since it should be
 * credential-free already.
 */
export function authRequired(
  message: string,
  endpoint: Redacted,
  challenge?: { readonly scheme?: string; readonly resourceMetadataUrl?: string },
): IngestError {
  const context: { endpoint: Redacted; authScheme?: string; resourceMetadataUrl?: string } = { endpoint };
  if (challenge?.scheme !== undefined) context.authScheme = challenge.scheme;
  if (challenge?.resourceMetadataUrl !== undefined) {
    context.resourceMetadataUrl = sanitizeUrl(challenge.resourceMetadataUrl);
  }
  return { code: 'auth-required', message, context };
}

export function malformedTools(message: string): IngestError {
  return { code: 'malformed-tools', message };
}

export function unsupportedSource(message: string): IngestError {
  return { code: 'unsupported-source', message };
}

export function registryNoTools(message: string): IngestError {
  return { code: 'registry-no-tools', message };
}

export function serverCardDraft(message: string): IngestError {
  return { code: 'server-card-draft', message };
}

export function captureFailed(message: string): IngestError {
  return { code: 'capture-failed', message };
}
