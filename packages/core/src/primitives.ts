// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

// IsoTimestamp — a branded ISO 8601 datetime string. Carried on ToolManifest for provenance only.
// The pure engine MUST NEVER read this value; findings are a function of tools + vocabulary alone.
export const isoTimestampSchema = z.string().datetime({ offset: true }).brand('IsoTimestamp');
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;

// RuleId — branded, stable, semver-significant rule identifier.
// Renaming one is a semver-breaking change. The brand prevents stray strings reaching the crosswalk.
export const ruleIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/)
  .brand('RuleId');
export type RuleId = z.infer<typeof ruleIdSchema>;

// Redacted — wraps a credential-bearing string so that toString/toJSON always elide the secret.
// The raw value is inaccessible outside this module: Redacted.unwrap() is intentionally module-scoped.
export class Redacted {
  readonly #value: string;

  // TypeScript-only brand — prevents a plain string from satisfying the Redacted type.
  declare readonly __brand: 'Redacted';

  private constructor(value: string) {
    this.#value = value;
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }

  static create(value: string): Redacted {
    return new Redacted(value);
  }

  // Only the translation layer (mcp-fetch) needs the raw value; it calls this explicitly.
  static unwrap(r: Redacted): string {
    return r.#value;
  }
}

// z.instanceof() requires a publicly constructable class, so we use z.custom() here.
export const redactedSchema = z.custom<Redacted>((val) => val instanceof Redacted);
