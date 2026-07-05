// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The four version lines that identify a run. Reproducing a report requires all four — the tool,
// the judgment data (vocabulary + crosswalk), and the report-schema shape — so `--version` prints
// every one and the assembled ServerResult carries them.

import { readFileSync } from 'node:fs';
import { CROSSWALK_VERSION, VOCABULARY_VERSION } from '@formael/action-risk-vocabulary';
import { REPORT_SCHEMA_VERSION } from '@formael/actlint-core';

/**
 * The actlint code version, read from the package manifest next to the built entry. Read once at
 * startup; if the manifest is unreadable (an unusual packaging), it degrades to a clear placeholder
 * rather than throwing — the shell never crashes over its own metadata.
 */
export function readActlintVersion(): string {
  try {
    const manifestUrl = new URL('../package.json', import.meta.url);
    const parsed = JSON.parse(readFileSync(manifestUrl, 'utf8')) as { readonly version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface Versions {
  readonly actlint: string;
  readonly vocabulary: string;
  readonly crosswalk: string;
  readonly reportSchema: string;
}

/** The four independent version lines for this run. `vocabulary`/`crosswalk` reflect the loaded data. */
export function versions(
  vocabularyVersion = VOCABULARY_VERSION,
  crosswalkVersion = CROSSWALK_VERSION,
): Versions {
  return {
    actlint: readActlintVersion(),
    vocabulary: vocabularyVersion,
    crosswalk: crosswalkVersion,
    reportSchema: REPORT_SCHEMA_VERSION,
  };
}

/** The `--version` block: one line per version, because reproducing a report needs all four. */
export function formatVersions(v: Versions): string {
  return [
    `actlint        ${v.actlint}`,
    `vocabulary     ${v.vocabulary}`,
    `crosswalk      ${v.crosswalk}`,
    `report-schema  ${v.reportSchema}`,
  ].join('\n');
}
