// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

// ErrorCode — the closed union of all well-known failure states in the pure core.
// Handle with an exhaustive switch so adding a new code forces every callsite to update.
export const errorCodeSchema = z.enum([
  'invalid-manifest',
  'invalid-schema',
  'unsupported-source',
  'vocabulary-load-failed',
  'crosswalk-incomplete',
  'missing-rationale',
  'missing-standards-ref',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// ActlintError — errors are data: a code, a human message, and enough context to explain.
// The pure core never throws for control flow; it returns Outcome.
export const actlintErrorSchema = z
  .object({
    code: errorCodeSchema,
    message: z.string().min(1),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .readonly();
export type ActlintError = z.infer<typeof actlintErrorSchema>;

// Outcome<T, E> — the pure core's typed failure model.
// All decisions are pure values; callers must handle both arms explicitly.
// Exceptions are reserved for genuine programmer bugs (invariant violations in tests).
export type Outcome<T, E = ActlintError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Outcome<T, never> {
  return { ok: true, value };
}

export function err<E = ActlintError>(error: E): Outcome<never, E> {
  return { ok: false, error };
}

// assertNever — exhaustive switch sentinel.
// Place as the `default` branch; adding a new member to any closed union will fail to compile here.
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${String(x)}`);
}
