// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Small edge utilities shared by the network-touching sources. Timeouts and error sanitization
// live here so that no raw endpoint string — which may carry a credential — is ever surfaced.

/** Distinguishes a timeout from any other rejection so callers can map it to the `timeout` code. */
export class TimeoutError extends Error {
  constructor() {
    super('operation timed out');
    this.name = 'TimeoutError';
  }
}

/**
 * Reject with {@link TimeoutError} if `promise` does not settle within `ms`. The timer is unref'd
 * so a pending timeout never keeps the process (or a test runner) alive.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * A credential-safe detail string for an error context. Returns a Node/system error code
 * (`ECONNREFUSED`, `ENOTFOUND`, …) when present — these never contain a URL — and otherwise
 * `undefined`. The raw error message is deliberately never returned: it may echo the endpoint.
 */
export function sanitizedDetail(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)) return code;
  }
  return undefined;
}
