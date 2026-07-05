// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkVocabularyData } from './vocabulary-data';

const fixture = (p: string): string => join(import.meta.dirname, '__fixtures__', p);

describe('check-vocabulary-data', () => {
  it('passes on a module that exports only data and an allowlisted validator', () => {
    expect(checkVocabularyData([fixture('vocabulary/clean')])).toEqual([]);
  });

  it('fails on a module that exports scoring/composition mechanism', () => {
    const violations = checkVocabularyData([fixture('vocabulary/violation')]);
    expect(violations.some((v) => v.detail.includes('scoreBlastRadius'))).toBe(true);
    expect(violations.some((v) => v.detail.includes('composeProfile'))).toBe(true);
  });

  it('holds the real vocabulary package clean', () => {
    expect(checkVocabularyData()).toEqual([]);
  });
});
