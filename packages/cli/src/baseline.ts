// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The baseline — the single biggest determinant of whether a linter sticks. A wall of failures on
// first run, or a tightened vocabulary breaking a green pipeline, is the most common reason teams
// rip a linter out. The baseline is the answer, and it ships in v0.1: `--write-baseline` records the
// current findings as accepted; `--baseline` suppresses exactly those on later runs, so only *new*
// dishonesty fails the build.
//
// Suppression keys on a STABLE FINGERPRINT — the ruleId, the tool, the verdict, and the salient
// derived/declared facts — never on line numbers or ordering. An unrelated change (a different tool,
// a reordering) cannot silently un-suppress a finding, and a real change to this tool's honesty
// situation correctly reads as a new finding.
//
// The baseline records the vocabulary version it was made under. When a later run uses a different
// vocabulary, findings that are not in the baseline are reported as *newly introduced by the
// vocabulary bump* rather than dumped as failures — the mechanism that lets the vocabulary tighten
// without punishing early adopters. The remedy is a single re-run of `--write-baseline`.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DeclaredHint, Finding } from '@formael/actlint-core';
import { type CliError, usageError } from './exit-codes.ts';
import type { Versions } from './version.ts';

export interface BaselineEntry {
  readonly ruleId: string;
  readonly toolName: string;
  readonly fingerprint: string;
}

export interface Baseline {
  readonly baselineVersion: 1;
  readonly createdWith: { readonly actlint: string; readonly vocabulary: string };
  readonly accepted: readonly BaselineEntry[];
}

function hintState(hint: DeclaredHint | undefined): string {
  return hint?.state ?? 'absent';
}

/**
 * The stable fingerprint of a finding: a content hash over the facts that make it *this* finding —
 * the rule, the tool, the verdict, the derived risk levels, and the declared hint states. It never
 * includes ordering or position, so it survives an unrelated change; it does include the tool's own
 * risk situation, so a genuine change to that situation yields a new fingerprint (correctly, a new
 * finding). Content-seeded and therefore deterministic — the same finding fingerprints identically
 * forever.
 */
export function fingerprint(finding: Finding): string {
  const salient = {
    ruleId: finding.ruleId as string,
    toolName: finding.toolName,
    verdict: finding.verdict,
    derived: {
      reversibility: finding.derived.reversibility.level,
      destructiveness: finding.derived.destructiveness.level,
      externalReach: finding.derived.externalReach.level,
      idempotency: finding.derived.idempotency.level,
      blastRadius: finding.derived.blastRadius.level,
    },
    declared: {
      readOnly: hintState(finding.declared.readOnly),
      destructive: hintState(finding.declared.destructive),
      idempotent: hintState(finding.declared.idempotent),
      openWorld: hintState(finding.declared.openWorld),
    },
  };
  return createHash('sha256').update(JSON.stringify(salient)).digest('hex').slice(0, 16);
}

function compareEntries(a: BaselineEntry, b: BaselineEntry): number {
  if (a.toolName !== b.toolName) return a.toolName < b.toolName ? -1 : 1;
  if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1;
  return a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0;
}

/** Record the current findings as an accepted baseline, sorted for a stable, diffable file. */
export function buildBaseline(findings: readonly Finding[], versions: Versions): Baseline {
  const accepted = findings
    .map((f) => ({ ruleId: f.ruleId as string, toolName: f.toolName, fingerprint: fingerprint(f) }))
    .sort(compareEntries);
  return {
    baselineVersion: 1,
    createdWith: { actlint: versions.actlint, vocabulary: versions.vocabulary },
    accepted,
  };
}

/** Canonical, diffable JSON for a baseline file, with a trailing newline. */
export function serializeBaseline(baseline: Baseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

type ReadResult =
  | { readonly ok: true; readonly baseline: Baseline }
  | { readonly ok: false; readonly error: CliError };

function isEntry(value: unknown): value is BaselineEntry {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.ruleId === 'string' && typeof e.toolName === 'string' && typeof e.fingerprint === 'string';
}

/**
 * Read a baseline file. A malformed baseline is a usage error (exit 2): it is a file the user pointed
 * actlint at, not a server it failed to reach, and a silently-ignored baseline would be worse than a
 * loud one — it would quietly un-suppress every accepted finding.
 */
export function readBaseline(path: string): ReadResult {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, error: usageError(`could not read baseline file: ${path}`) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: usageError(`baseline file is not valid JSON: ${path}`) };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: usageError(`baseline file is not a JSON object: ${path}`) };
  }

  const raw = parsed as Record<string, unknown>;
  const createdWith = raw.createdWith as Record<string, unknown> | undefined;
  if (
    raw.baselineVersion !== 1 ||
    createdWith === undefined ||
    typeof createdWith.actlint !== 'string' ||
    typeof createdWith.vocabulary !== 'string' ||
    !Array.isArray(raw.accepted) ||
    !raw.accepted.every(isEntry)
  ) {
    return { ok: false, error: usageError(`baseline file is not a valid actlint baseline: ${path}`) };
  }

  return {
    ok: true,
    baseline: {
      baselineVersion: 1,
      createdWith: { actlint: createdWith.actlint, vocabulary: createdWith.vocabulary },
      accepted: raw.accepted as BaselineEntry[],
    },
  };
}

export interface Partitioned {
  /** In the baseline — accepted risk, removed from the report and the gate. */
  readonly suppressed: readonly Finding[];
  /** Not in the baseline, surfaced because the vocabulary changed — reported but not gated. */
  readonly newlyIntroduced: readonly Finding[];
  /** Not in the baseline under the same vocabulary — the live finding set the gate reads. */
  readonly active: readonly Finding[];
}

/**
 * Partition findings against a baseline. Matched fingerprints are suppressed. When the baseline was
 * made under a different vocabulary version, the unmatched findings are `newlyIntroduced` (surfaced,
 * not gated); under the same version they are `active` (the gate reads these).
 */
export function partitionByBaseline(
  findings: readonly Finding[],
  baseline: Baseline,
  currentVocabularyVersion: string,
): Partitioned {
  const accepted = new Set(baseline.accepted.map((e) => e.fingerprint));
  const vocabularyChanged = baseline.createdWith.vocabulary !== currentVocabularyVersion;

  const suppressed: Finding[] = [];
  const newlyIntroduced: Finding[] = [];
  const active: Finding[] = [];
  for (const finding of findings) {
    if (accepted.has(fingerprint(finding))) suppressed.push(finding);
    else if (vocabularyChanged) newlyIntroduced.push(finding);
    else active.push(finding);
  }
  return { suppressed, newlyIntroduced, active };
}
