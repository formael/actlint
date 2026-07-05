// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import type { Finding } from './finding.ts';
import type { ManifestSource } from './manifest.ts';

// ServerGrade — a five-second proxy for "how honestly does this server label its actions?",
// A (fully honest) down to F. It is NOT a safety score and must never be read as one: a server
// full of honestly-declared destructive tools is an A. The grade is a downstream, deterministic
// reduction of the finding set, computed by the reporters from versioned band data.
//
// Re-declared here (like Verdict and Severity) rather than imported: the base vocabulary layer
// owns the band DATA and declares the same enum, and a pin test keeps the two lists identical.
export const serverGradeSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
export type ServerGrade = z.infer<typeof serverGradeSchema>;

// ServerResult — the whole-server view the reporters and CLI consume. The canonical truth is the
// readonly Finding[]; everything else is metadata or a downstream reduction of it.
//
// The version fields are carried on the result, not read from a global, so a reporter stays a pure
// function of its input: the same ServerResult always renders byte-identically, and the report it
// emits records exactly which judgment (vocabulary + crosswalk) and which tool produced it. The
// imperative shell fills them when it assembles the result.
export interface ServerResult {
  readonly source: ManifestSource;
  readonly findings: readonly Finding[];
  readonly toolCount: number;
  readonly grade: ServerGrade;
  readonly reportSchemaVersion: string;
  readonly actlintVersion: string;
  readonly vocabularyVersion: string;
  readonly crosswalkVersion: string;
}
