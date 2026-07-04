// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { checkDeterminism } from './determinism';

describe('check-determinism', () => {
  it('is an honest no-op scaffold until the pure core exists', () => {
    const result = checkDeterminism();
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/no-op scaffold/);
  });
});
