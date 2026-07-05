// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// A clean data-package module: exported data and an allowlisted validator, no mechanism.

export const SAMPLE_DATA = { version: '0.1.0', entries: [] } as const;

export function parseVocabulary(data: unknown): unknown {
  return data;
}
