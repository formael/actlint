// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DeclaredHint, McpHintDefault } from './declared.ts';
import {
  declaredHintSchema,
  declaredProfileSchema,
  effectiveDeclaredValue,
  MCP_HINT_DEFAULTS,
} from './declared.ts';

describe('declaredHintSchema', () => {
  it('accepts state: true', () => {
    expect(declaredHintSchema.safeParse({ state: 'true' }).success).toBe(true);
  });

  it('accepts state: false', () => {
    expect(declaredHintSchema.safeParse({ state: 'false' }).success).toBe(true);
  });

  it('accepts state: absent', () => {
    expect(declaredHintSchema.safeParse({ state: 'absent' }).success).toBe(true);
  });

  it('rejects state: undefined', () => {
    expect(declaredHintSchema.safeParse({ state: undefined }).success).toBe(false);
  });

  it('rejects boolean true (the old broken model)', () => {
    expect(declaredHintSchema.safeParse(true).success).toBe(false);
  });

  it('rejects boolean false (the old broken model)', () => {
    expect(declaredHintSchema.safeParse(false).success).toBe(false);
  });
});

describe('declaredProfileSchema', () => {
  it('accepts a profile with all hints present', () => {
    const result = declaredProfileSchema.safeParse({
      readOnly: { state: 'true' },
      destructive: { state: 'false' },
      idempotent: { state: 'absent' },
      openWorld: { state: 'true' },
      unknownHints: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal profile with only unknownHints', () => {
    expect(declaredProfileSchema.safeParse({ unknownHints: {} }).success).toBe(true);
  });

  it('captures unknownHints', () => {
    const result = declaredProfileSchema.safeParse({
      unknownHints: { futureHint: 42, anotherHint: 'value' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unknownHints.futureHint).toBe(42);
    }
  });

  it('rejects a profile missing unknownHints', () => {
    expect(declaredProfileSchema.safeParse({ readOnly: { state: 'true' } }).success).toBe(false);
  });
});

describe('effectiveDeclaredValue', () => {
  it('resolves absent to absent-spec-default-risky for destructive', () => {
    expect(effectiveDeclaredValue(undefined, MCP_HINT_DEFAULTS.destructive)).toBe(
      'absent-spec-default-risky',
    );
  });

  it('resolves absent to absent-spec-default-risky for openWorld', () => {
    expect(effectiveDeclaredValue(undefined, MCP_HINT_DEFAULTS.openWorld)).toBe('absent-spec-default-risky');
  });

  it('resolves absent to absent-spec-default-safe for readOnly', () => {
    expect(effectiveDeclaredValue(undefined, MCP_HINT_DEFAULTS.readOnly)).toBe('absent-spec-default-safe');
  });

  it('resolves absent to absent-spec-default-safe for idempotent', () => {
    expect(effectiveDeclaredValue(undefined, MCP_HINT_DEFAULTS.idempotent)).toBe('absent-spec-default-safe');
  });

  it('resolves state:absent hint the same way as undefined hint', () => {
    const hint: DeclaredHint = { state: 'absent' };
    expect(effectiveDeclaredValue(hint, 'risky')).toBe('absent-spec-default-risky');
    expect(effectiveDeclaredValue(hint, 'safe')).toBe('absent-spec-default-safe');
  });

  it('resolves explicit true to explicit-true', () => {
    const hint: DeclaredHint = { state: 'true' };
    expect(effectiveDeclaredValue(hint, 'risky')).toBe('explicit-true');
    expect(effectiveDeclaredValue(hint, 'safe')).toBe('explicit-true');
  });

  it('resolves explicit false to explicit-false', () => {
    const hint: DeclaredHint = { state: 'false' };
    expect(effectiveDeclaredValue(hint, 'risky')).toBe('explicit-false');
    expect(effectiveDeclaredValue(hint, 'safe')).toBe('explicit-false');
  });
});

// Core asymmetry property: absent ≠ false — they must resolve differently
describe('absent vs false asymmetry (the central invariant)', () => {
  it('absent destructiveHint resolves differently from explicit false', () => {
    const absent = effectiveDeclaredValue(undefined, MCP_HINT_DEFAULTS.destructive);
    const explicitFalse = effectiveDeclaredValue({ state: 'false' }, MCP_HINT_DEFAULTS.destructive);

    expect(absent).toBe('absent-spec-default-risky');
    expect(explicitFalse).toBe('explicit-false');
    expect(absent).not.toBe(explicitFalse);
  });

  it('property: no specDefault makes absent equal explicit-false', () => {
    const specDefaults: McpHintDefault[] = ['risky', 'safe'];

    fc.assert(
      fc.property(fc.constantFrom(...specDefaults), (specDefault) => {
        const absentResult = effectiveDeclaredValue({ state: 'absent' }, specDefault);
        const falseResult = effectiveDeclaredValue({ state: 'false' }, specDefault);
        return absentResult !== falseResult;
      }),
    );
  });
});
