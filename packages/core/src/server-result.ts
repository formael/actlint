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

// Coverage — how much of a server actlint could actually assess, carried beside the grade so the
// grade is never mistaken for a clean bill of health. A tool is `unassessed` when no verdict-bearing
// signal fired for it: silence is not honesty, and a scorecard must say so rather than fold such a
// tool into `consistent`. `annotatedTools` is the annotation-coverage half — it lets a report state
// plainly when a server declares no MCP annotations anywhere.
export const coverageSchema = z
  .object({
    assessedTools: z.number().int().nonnegative(),
    unassessedTools: z.number().int().nonnegative(),
    annotatedTools: z.number().int().nonnegative(),
    unassessedToolNames: z.array(z.string()).readonly(),
  })
  .readonly();
export type Coverage = z.infer<typeof coverageSchema>;

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
  readonly coverage: Coverage;
  readonly reportSchemaVersion: string;
  readonly actlintVersion: string;
  readonly vocabularyVersion: string;
  readonly crosswalkVersion: string;
}
