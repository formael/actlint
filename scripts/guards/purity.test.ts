// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPurity } from './purity';

const fixture = (p: string): string => join(import.meta.dirname, '__fixtures__', p);

describe('check-purity', () => {
  it('passes on a clean pure module', () => {
    expect(checkPurity([fixture('purity/clean')])).toEqual([]);
  });

  it('fails on a planted node:fs import', () => {
    const violations = checkPurity([fixture('purity/violation')]);
    expect(violations.some((v) => v.rule === 'banned-import' && v.detail.includes('fs'))).toBe(true);
  });

  it('fails on a planted wall-clock read', () => {
    const violations = checkPurity([fixture('purity/violation')]);
    expect(violations.some((v) => v.rule === 'banned-token' && v.detail.includes('clock'))).toBe(true);
  });

  it('holds the real pure packages (core, vocabulary, reporters) clean', () => {
    expect(checkPurity()).toEqual([]);
  });
});
