// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'vitest';

import { severitySchema, standardsRefSchema, verdictSchema } from './finding.ts';
import type { Verdict } from './finding.ts';
import { assertNever } from './outcome.ts';

describe('verdictSchema', () => {
  it.each(['consistent', 'under-declared', 'over-declared', 'undeclared'])('accepts "%s"', (v) => {
    expect(verdictSchema.safeParse(v).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(verdictSchema.safeParse('maybe-declared').success).toBe(false);
  });
});

describe('severitySchema', () => {
  it.each(['info', 'low', 'medium', 'high', 'critical'])('accepts "%s"', (v) => {
    expect(severitySchema.safeParse(v).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(severitySchema.safeParse('blocker').success).toBe(false);
  });
});

describe('standardsRefSchema', () => {
  it('accepts a ref with only owaspMcp populated', () => {
    expect(standardsRefSchema.safeParse({ owaspMcp: ['MCP02'] }).success).toBe(true);
  });

  it('accepts a ref with multiple standards', () => {
    expect(
      standardsRefSchema.safeParse({
        owaspAsi: ['ASI02:2026'],
        owaspMcp: ['MCP02'],
        euAiAct: ['Art.14'],
        mcpField: ['destructiveHint'],
      }).success,
    ).toBe(true);
  });

  it('rejects a ref with all arrays empty', () => {
    const result = standardsRefSchema.safeParse({
      owaspAsi: [],
      owaspMcp: [],
      cosaiOasis: [],
      euAiAct: [],
      nist: [],
      mcpField: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a ref with no fields at all', () => {
    expect(standardsRefSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a ref with only mcpField populated', () => {
    expect(standardsRefSchema.safeParse({ mcpField: ['destructiveHint'] }).success).toBe(true);
  });
});

// Type-level test: exhaustive switch over Verdict must handle all variants.
// Adding a 5th verdict to the type causes the `default: assertNever(v)` to compile correctly —
// removing any case causes a type error that tsc catches.
describe('Verdict exhaustiveness (compile-time contract)', () => {
  it('exhaustive switch compiles and covers all variants at runtime', () => {
    function labelVerdict(v: Verdict): string {
      switch (v) {
        case 'consistent':
          return 'consistent';
        case 'under-declared':
          return 'under-declared';
        case 'over-declared':
          return 'over-declared';
        case 'undeclared':
          return 'undeclared';
        default:
          return assertNever(v);
      }
    }

    expect(labelVerdict('consistent')).toBe('consistent');
    expect(labelVerdict('under-declared')).toBe('under-declared');
    expect(labelVerdict('over-declared')).toBe('over-declared');
    expect(labelVerdict('undeclared')).toBe('undeclared');
  });

  it('Verdict type is a string union (type-level)', () => {
    expectTypeOf<Verdict>().toEqualTypeOf<'consistent' | 'under-declared' | 'over-declared' | 'undeclared'>();
  });
});
