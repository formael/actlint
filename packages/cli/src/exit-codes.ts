// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The four exit codes are a PUBLIC API. CI pipelines branch on them, so they are stable and
// documented, and a change to their meaning is a semver event. The separation is deliberate: a CI
// author must be able to tell "the server is dishonest" (1) from "you held it wrong" (2) from
// "I couldn't look" (3). Collapsing them is the classic linter foot-gun.

export const EXIT = {
  /** Scan completed; no finding at or above the gate threshold. The green build. */
  clean: 0,
  /** Scan completed; at least one gating finding remained after baseline suppression. */
  findings: 1,
  /** Usage error — bad flags, no target, conflicting sources, unreadable config. */
  usage: 2,
  /** Ingestion error — could not fetch or parse the target. Distinct from "found problems". */
  ingestion: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

// A CLI-layer failure carried as a value up to the shell's rim, where it becomes an exit code and a
// stderr line. `usage` maps to EXIT.usage; `ingestion` to EXIT.ingestion. Findings are never an
// error — they are a successful scan whose result the gate reads.
export interface CliError {
  readonly kind: 'usage' | 'ingestion';
  readonly message: string;
}

export function usageError(message: string): CliError {
  return { kind: 'usage', message };
}

export function ingestionError(message: string): CliError {
  return { kind: 'ingestion', message };
}

export function exitCodeFor(error: CliError): ExitCode {
  return error.kind === 'usage' ? EXIT.usage : EXIT.ingestion;
}
