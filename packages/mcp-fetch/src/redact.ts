// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Endpoint redaction — credentials must never reach a capture file or an error context.
//
// `ManifestSource.endpoint` is a `Redacted`, so it already renders as "[REDACTED]" in every
// serialized form. We sanitize the URL BEFORE wrapping anyway (defense in depth): even the
// module-scoped `Redacted.unwrap` must never surface a secret.

import { Redacted } from '@formael/actlint-core/contracts';

// Query-parameter names that commonly carry a bearer secret. Matched case-insensitively.
const SENSITIVE_QUERY_KEYS: ReadonlySet<string> = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'key',
  'password',
  'secret',
  'session',
  'sessionid',
  'sig',
  'signature',
  'token',
]);

const REDACTED_PLACEHOLDER = 'REDACTED';

/**
 * Strip credentials from a URL: userinfo (`user:pass@`) and any sensitive query parameter value.
 * Scheme, host, port, and path are preserved for audit value. A non-URL string (e.g. a stdio
 * command line) is returned unchanged — it is still wrapped in `Redacted` by the caller.
 */
export function sanitizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.username !== '') url.username = '';
  if (url.password !== '') url.password = '';
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.set(key, REDACTED_PLACEHOLDER);
    }
  }
  return url.toString();
}

/** Wrap a credential-free rendering of an endpoint for safe provenance and error context. */
export function redactEndpoint(raw: string): Redacted {
  return Redacted.create(sanitizeUrl(raw));
}
