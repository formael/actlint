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

  it('fails on a planted MCP SDK import outside mcp-fetch', () => {
    const violations = checkSdkBoundary([fixture('sdk/violation')]);
    expect(violations.some((v) => v.rule === 'sdk-boundary')).toBe(true);
  });

  it('holds the real non-mcp-fetch packages clean', () => {
    expect(checkSdkBoundary()).toEqual([]);
  });
});
