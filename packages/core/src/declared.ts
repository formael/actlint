// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

// DeclaredHint — the three states of an MCP annotation field, read literally.
//
// 'absent' is NOT the same as 'false'. This is the single most important modeling decision:
//   { state: 'false' } = an active claim ("I am not destructive") — when wrong, actively dangerous
//   { state: 'absent' } = silence (no claim made; MCP spec defaults apply conservatively)
//
// Collapsing absent and false would erase the under-declared / undeclared distinction.
export type DeclaredHint =
  | { readonly state: 'true' }
  | { readonly state: 'false' }
  | { readonly state: 'absent' };

const _declaredHintSchemaRaw = z.discriminatedUnion('state', [
  z.object({ state: z.literal('true') }),
  z.object({ state: z.literal('false') }),
  z.object({ state: z.literal('absent') }),
]);
// Cast to marry the schema (validates runtime shape) with the explicit readonly type (compile-time contract).
// They must stay in sync; any change to DeclaredHint requires a matching schema update.
export const declaredHintSchema = _declaredHintSchemaRaw as z.ZodType<DeclaredHint>;

// DeclaredProfile — what a tool says about itself, normalized from the MCP annotations block.
//
// unknownHints captures any annotation field actlint does not yet model. It is NEVER silently dropped
// and NEVER resolves to "safe" in the comparison layer — forward-compatibility without false safety.
export interface DeclaredProfile {
  readonly readOnly?: DeclaredHint;
  readonly destructive?: DeclaredHint;
  readonly idempotent?: DeclaredHint;
  readonly openWorld?: DeclaredHint;
  readonly unknownHints: Readonly<Record<string, unknown>>;
}

const _declaredProfileSchemaRaw = z.object({
  readOnly: declaredHintSchema.optional(),
  destructive: declaredHintSchema.optional(),
  idempotent: declaredHintSchema.optional(),
  openWorld: declaredHintSchema.optional(),
  unknownHints: z.record(z.string(), z.unknown()),
});
export const declaredProfileSchema = _declaredProfileSchemaRaw as z.ZodType<DeclaredProfile>;

// ---------------------------------------------------------------------------
// MCP spec defaults (2025-03-26): absent hints are NOT neutral — they have conservative defaults.
//
//   destructiveHint absent → defaults to true  (assumed destructive until told otherwise)
//   openWorldHint   absent → defaults to true  (assumed open-world until told otherwise)
//   readOnlyHint    absent → defaults to false (assumed mutating until told otherwise)
//   idempotentHint  absent → defaults to false (assumed non-idempotent until told otherwise)
//
// Consequence for severity: 'undeclared' (absent + derived-risky) is LOW/INFO because a
// spec-following client already treats absent destructiveHint as true — the safety prompt is
// still shown. The genuinely dangerous case is 'under-declared' (explicit false + derived-risky):
// that actively removes a safety prompt the spec default would have preserved.
// ---------------------------------------------------------------------------

export type McpHintDefault = 'risky' | 'safe';

export const MCP_HINT_DEFAULTS = {
  destructive: 'risky',
  openWorld: 'risky',
  readOnly: 'safe',
  idempotent: 'safe',
} as const satisfies Record<keyof Omit<DeclaredProfile, 'unknownHints'>, McpHintDefault>;

// EffectiveDeclaredValue — resolves a DeclaredHint against the MCP spec default for comparison.
// Used by the classification layer to determine the true declared posture.
export type EffectiveDeclaredValue =
  | 'explicit-true'
  | 'explicit-false'
  | 'absent-spec-default-safe'
  | 'absent-spec-default-risky';

export function effectiveDeclaredValue(
  hint: DeclaredHint | undefined,
  specDefault: McpHintDefault,
): EffectiveDeclaredValue {
  if (hint === undefined || hint.state === 'absent') {
    return specDefault === 'risky' ? 'absent-spec-default-risky' : 'absent-spec-default-safe';
  }
  return hint.state === 'true' ? 'explicit-true' : 'explicit-false';
}
