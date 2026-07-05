// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-reporters — PURE.
// One canonical Finding[] rendered three ways — the human scorecard, the JSON machine report, and
// SARIF 2.1.0 — as pure functions from a ServerResult to a string. Reporters render; they never
// compute a verdict or a severity. Output strings are user-facing product copy: calm, concrete, no
// severity theatre. No I/O, no clock — the CLI writes the string the reporter returns.

import type { ServerResult } from '@formael/actlint-core';

export const REPORTERS_PACKAGE = '@formael/actlint-reporters';

/** A reporter is a pure function from a whole-server result to a rendered string. */
export type Reporter = (result: ServerResult) => string;

export { humanReporter } from './human.ts';
export type { HumanReporterOptions } from './human.ts';
export { jsonReporter } from './json.ts';
export { sarifReporter } from './sarif.ts';

// The honesty grade and the per-tool summary: deterministic reductions of the finding set, shared
// by the reporters and available to the CLI when it assembles a ServerResult.
export { gradeServer } from './grade.ts';
export { summarize, worstVerdictByTool } from './summary.ts';
