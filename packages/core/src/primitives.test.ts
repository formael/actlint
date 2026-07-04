// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { Redacted, isoTimestampSchema, ruleIdSchema } from './primitives.ts';

describe('isoTimestampSchema', () => {
  it('accepts a valid UTC datetime', () => {
    const result = isoTimestampSchema.safeParse('2026-07-04T12:00:00Z');
    expect(result.success).toBe(true);
  });

  it('accepts a datetime with offset', () => {
    const result = isoTimestampSchema.safeParse('2026-07-04T17:30:00+05:30');
    expect(result.success).toBe(true);
  });

  it('rejects a bare date string', () => {
    expect(isoTimestampSchema.safeParse('2026-07-04').success).toBe(false);
  });

  it('rejects an arbitrary string', () => {
    expect(isoTimestampSchema.safeParse('not-a-date').success).toBe(false);
  });
});

describe('ruleIdSchema', () => {
  it('accepts a valid kebab-case rule id', () => {
    expect(ruleIdSchema.safeParse('destructive-unflagged').success).toBe(true);
    expect(ruleIdSchema.safeParse('write-as-readonly').success).toBe(true);
    expect(ruleIdSchema.safeParse('no-scope-constraint').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(ruleIdSchema.safeParse('').success).toBe(false);
  });

  it('rejects strings that start with a digit', () => {
    expect(ruleIdSchema.safeParse('1-bad-id').success).toBe(false);
  });

  it('rejects uppercase characters', () => {
    expect(ruleIdSchema.safeParse('Destructive-Unflagged').success).toBe(false);
  });
});

describe('Redacted', () => {
  it('elides the secret in toString', () => {
    const r = Redacted.create('https://user:password@example.com/endpoint');
    expect(r.toString()).toBe('[REDACTED]');
    expect(String(r)).toBe('[REDACTED]');
  });

  it('elides the secret in toJSON / JSON.stringify', () => {
    const r = Redacted.create('s3://bucket?token=secret');
    expect(r.toJSON()).toBe('[REDACTED]');
    expect(JSON.stringify({ endpoint: r })).toBe('{"endpoint":"[REDACTED]"}');
  });

  it('preserves the raw value via unwrap', () => {
    const raw = 'https://user:password@example.com/endpoint';
    const r = Redacted.create(raw);
    expect(Redacted.unwrap(r)).toBe(raw);
  });

  it('never leaks the secret through template literals', () => {
    const r = Redacted.create('secret-token');
    const interpolated = `endpoint: ${r}`;
    expect(interpolated).toBe('endpoint: [REDACTED]');
    expect(interpolated).not.toContain('secret-token');
  });
});
