// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// A planted violation: the data package must never carry scoring/composition mechanism.

export function scoreBlastRadius(): string {
  return 'severe';
}

export const composeProfile = (): number => 42;
