// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSdkBoundary } from './sdk-boundary';

const fixture = (p: string): string => join(import.meta.dirname, '__fixtures__', p);

describe('check-sdk-boundary', () => {
  it('passes on a module that uses only the shared contracts', () => {
    expect(checkSdkBoundary([fixture('sdk/clean')])).toEqual([]);
  });

  it('flags the v1 SDK specifier (@modelcontextprotocol/sdk)', () => {
    const violations = checkSdkBoundary([fixture('sdk/violation')]);
    expect(violations.some((v) => v.file.endsWith('imports-sdk.ts'))).toBe(true);
  });

  it('flags v2 scope specifiers, including subpaths (@modelcontextprotocol/client/stdio)', () => {
    const violations = checkSdkBoundary([fixture('sdk/violation')]);
    const v2 = violations.find((v) => v.file.endsWith('imports-sdk-v2.ts'));
    expect(v2).toBeDefined();
    expect(v2?.rule).toBe('sdk-boundary');
    expect(v2?.detail).toContain('@modelcontextprotocol/client/stdio');
  });

  it('does not flag near-miss names outside the @modelcontextprotocol/ scope', () => {
    const violations = checkSdkBoundary([fixture('sdk/clean')]);
    expect(violations).toEqual([]);
  });

  it('holds the real non-mcp-fetch packages clean', () => {
    expect(checkSdkBoundary()).toEqual([]);
  });
});
