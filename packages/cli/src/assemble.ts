// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Assemble the ServerResult the reporters and the gate consume. The canonical truth is the
// Finding[]; the grade is a downstream reduction (computed by the reporters' gradeServer), and the
// four version lines are carried on the result so a report records exactly which tool and which
// judgment produced it. The shell assembles; it computes no verdict or severity of its own.

import type { ManifestSource, ServerResult } from '@formael/actlint-core';
import { type Finding, REPORT_SCHEMA_VERSION } from '@formael/actlint-core';
import { gradeServer } from '@formael/actlint-reporters';
import type { Versions } from './version.ts';

export interface AssembleInput {
  readonly source: ManifestSource;
  readonly findings: readonly Finding[];
  readonly toolCount: number;
  readonly versions: Versions;
}

/** Build a ServerResult from the (possibly baseline-filtered) findings and the run's versions. */
export function assembleResult(input: AssembleInput): ServerResult {
  return {
    source: input.source,
    findings: input.findings,
    toolCount: input.toolCount,
    grade: gradeServer(input.findings, input.toolCount),
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    actlintVersion: input.versions.actlint,
    vocabularyVersion: input.versions.vocabulary,
    crosswalkVersion: input.versions.crosswalk,
  };
}
