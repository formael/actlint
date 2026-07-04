// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'vitest';

import { actlintErrorSchema, assertNever, err, errorCodeSchema, ok } from './outcome.ts';
import type { ActlintError, ErrorCode, Outcome } from './outcome.ts';

describe('errorCodeSchema', () => {
  it.each([
    'invalid-manifest',
    'invalid-schema',
    'unsupported-source',
    'vocabulary-load-failed',
    'crosswalk-incomplete',
    'missing-rationale',
    'missing-standards-ref',
  ])('accepts "%s"', (code) => {
    expect(errorCodeSchema.safeParse(code).success).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(errorCodeSchema.safeParse('unknown-error').success).toBe(false);
  });
});

describe('actlintErrorSchema', () => {
  it('accepts a minimal error', () => {
    expect(
      actlintErrorSchema.safeParse({ code: 'invalid-manifest', message: 'manifest was null' }).success,
    ).toBe(true);
  });

  it('accepts an error with context', () => {
    expect(
      actlintErrorSchema.safeParse({
        code: 'missing-rationale',
        message: 'rationale is empty',
        context: { ruleId: 'destructive-unflagged', toolName: 'delete_file' },
      }).success,
    ).toBe(true);
  });

  it('rejects an error with an empty message', () => {
    expect(actlintErrorSchema.safeParse({ code: 'invalid-manifest', message: '' }).success).toBe(false);
  });

  it('rejects an error with an unknown code', () => {
    expect(actlintErrorSchema.safeParse({ code: 'oops', message: 'something went wrong' }).success).toBe(
      false,
    );
  });
});

describe('ok()', () => {
  it('constructs an Ok result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('type-level: ok result narrows to value', () => {
    const result: Outcome<string> = ok('hello');
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<string>();
    }
  });
});

describe('err()', () => {
  it('constructs an Err result', () => {
    const e: ActlintError = { code: 'invalid-manifest', message: 'bad input' };
    const result = err(e);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(e);
    }
  });

  it('type-level: err result narrows to error', () => {
    const e: ActlintError = { code: 'missing-rationale', message: 'empty rationale' };
    const result: Outcome<number> = err(e);
    if (!result.ok) {
      expectTypeOf(result.error).toEqualTypeOf<ActlintError>();
    }
  });
});

describe('Outcome composition pattern', () => {
  function parse(input: unknown): Outcome<number> {
    if (typeof input === 'number') return ok(input);
    return err({ code: 'invalid-manifest' as ErrorCode, message: `expected number, got ${typeof input}` });
  }

  it('ok path short-circuits correctly', () => {
    const result = parse(5);
    expect(result.ok).toBe(true);
  });

  it('err path carries the error value', () => {
    const result = parse('not-a-number');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-manifest');
    }
  });
});

describe('assertNever()', () => {
  it('throws for any runtime value that reaches it', () => {
    expect(() => assertNever('unexpected' as never)).toThrow('Unhandled variant: unexpected');
  });
});
