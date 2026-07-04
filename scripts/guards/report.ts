// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import type { Violation } from './scan';

// Shared CLI reporting for the guard entry points. The guard *logic* is pure and returns
// Violation[]; only these thin CLI wrappers print and set an exit code.

/** Print the result of a guard and return the process exit code (0 clean, 1 violations). */
export function reportGuard(name: string, violations: readonly Violation[]): number {
  if (violations.length === 0) {
    process.stdout.write(`✓ ${name}: clean\n`);
    return 0;
  }
  process.stderr.write(`✗ ${name}: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}  [${v.rule}] ${v.detail}\n`);
  }
  return 1;
}
