// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The scan orchestration — the imperative shell's main path, expressed as one linear pipeline:
//
//   resolve ─► load vocabulary ─► acquire manifest ─► classify (PURE) ─► baseline ─► render ─► gate
//
// Effects (ingest, read stdin, write files) are injected so the whole pipeline is testable without a
// process, and every failure is a value that maps to one of the four public exit codes. This module
// runs no analysis of its own: classification is core's, rendering is the reporters', grading is the
// reporters'. It only sequences them and decides which exit code the finished result implies.

import type { Finding, ServerResult } from '@formael/actlint-core';
import { classifyManifest } from '@formael/actlint-core';
import type { Outcome, ToolManifest } from '@formael/actlint-core';
import type { IngestError, IngestOptions, IngestSource } from '@formael/actlint-mcp-fetch';
import { humanReporter, jsonReporter, sarifReporter } from '@formael/actlint-reporters';
import type { OutputFormat } from './args.ts';
import { assembleResult } from './assemble.ts';
import { buildBaseline, partitionByBaseline, readBaseline, serializeBaseline } from './baseline.ts';
import type { ResolvedScan } from './config.ts';
import { type CliError, EXIT, type ExitCode, exitCodeFor, usageError } from './exit-codes.ts';
import { gateFails } from './gate.ts';
import { isStdinManifest, parseStdinManifest, toIngestSource } from './ingest-target.ts';
import { type Versions, versions as buildVersions } from './version.ts';
import { loadVocabulary } from './vocabulary.ts';

/** The effects the shell performs. Injected so the pipeline runs deterministically under test. */
export interface Effects {
  readonly ingest: (
    source: IngestSource,
    options?: IngestOptions,
  ) => Promise<Outcome<ToolManifest, IngestError>>;
  readonly writeCapture: (manifest: ToolManifest, path: string) => Promise<Outcome<void, IngestError>>;
  readonly writeTextFile: (path: string, data: string) => Promise<void>;
  readonly readStdin: () => Promise<string>;
}

export interface RunContext {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Whether stdout is a colour-capable TTY. Colour is opt-in and off under NO_COLOR or a pipe. */
  readonly colorCapable: boolean;
  readonly effects: Effects;
}

export interface RunResult {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

function fail(error: CliError): RunResult {
  return { exitCode: exitCodeFor(error), stdout: '', stderr: `actlint: ${error.message}\n` };
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function wantsColor(resolved: ResolvedScan, ctx: RunContext): boolean {
  if (resolved.format !== 'human' || resolved.outputPath !== undefined) return false;
  if (ctx.env.NO_COLOR !== undefined) return false;
  return ctx.colorCapable;
}

function render(result: ServerResult, format: OutputFormat, color: boolean): string {
  switch (format) {
    case 'json':
      return jsonReporter(result);
    case 'sarif':
      return sarifReporter(result);
    case 'human':
      return humanReporter(result, { color });
  }
}

// Acquire the manifest: stdin is read and parsed in the shell; every other source goes through
// mcp-fetch's single ingestion interface. Either way the result is a captured ToolManifest or a
// typed error the caller maps to exit 3.
async function acquireManifest(
  resolved: ResolvedScan,
  ctx: RunContext,
): Promise<Outcome<ToolManifest, CliError>> {
  if (isStdinManifest(resolved.target)) {
    const text = await ctx.effects.readStdin();
    const parsed = parseStdinManifest(text);
    return parsed.ok ? { ok: true, value: parsed.manifest } : { ok: false, error: parsed.error };
  }

  const source = toIngestSource(resolved.target);
  const options: IngestOptions = resolved.experimental ? { experimental: true } : {};
  const ingested = await ctx.effects.ingest(source, options);
  if (!ingested.ok) {
    // Every messy reality of the edge is already a value here; the shell only relabels it as exit 3.
    return { ok: false, error: { kind: 'ingestion', message: ingested.error.message } };
  }
  return { ok: true, value: ingested.value };
}

/**
 * Run one scan to a RunResult. Pure of process concerns — it returns the exit code and the text to
 * write, and performs only the file/stdin effects the flags asked for. index.ts does the actual
 * writing and the single process.exit.
 */
export async function runScan(resolved: ResolvedScan, ctx: RunContext): Promise<RunResult> {
  const loaded = loadVocabulary(resolved.vocabularyPath);
  if (!loaded.ok) return fail(loaded.error);
  const runVersions: Versions = buildVersions(
    loaded.loaded.vocabularyVersion,
    loaded.loaded.crosswalkVersion,
  );

  const manifestOutcome = await acquireManifest(resolved, ctx);
  if (!manifestOutcome.ok) return fail(manifestOutcome.error);
  const manifest = manifestOutcome.value;

  // A requested capture is written before scoring so it reflects exactly what was analyzed.
  if (resolved.capturePath !== undefined) {
    const written = await ctx.effects.writeCapture(manifest, resolved.capturePath);
    if (!written.ok) return fail({ kind: 'ingestion', message: written.error.message });
  }

  const classified = classifyManifest(manifest, loaded.loaded.vocabulary);
  if (!classified.ok) {
    // Unreachable in a shipped build: the crosswalk-completeness contract guarantees every emitted
    // rule maps to a standard. If it ever fires, it is a broken build, not a user or network fault.
    return fail(usageError(`internal error while classifying: ${classified.error.message}`));
  }
  const allFindings = classified.value;
  const toolCount = manifest.tools.length;

  // --write-baseline records the current findings as accepted and stops. It is a capture action, not
  // a gate run, so it never fails the build.
  if (resolved.writeBaselinePath !== undefined) {
    const baseline = buildBaseline(allFindings, runVersions);
    await ctx.effects.writeTextFile(resolved.writeBaselinePath, serializeBaseline(baseline));
    const note = `wrote baseline with ${plural(baseline.accepted.length, 'accepted finding')} to ${resolved.writeBaselinePath}\n`;
    return { exitCode: EXIT.clean, stdout: '', stderr: note };
  }

  // Apply a baseline if one was supplied: suppressed findings leave the report and the gate;
  // vocabulary-bump findings are surfaced but do not gate; the rest are the live set.
  let visibleFindings: readonly Finding[] = allFindings;
  let gateFindings: readonly Finding[] = allFindings;
  const notes: string[] = [];
  if (resolved.baselinePath !== undefined) {
    const baselineResult = readBaseline(resolved.baselinePath);
    if (!baselineResult.ok) return fail(baselineResult.error);

    const partition = partitionByBaseline(allFindings, baselineResult.baseline, runVersions.vocabulary);
    visibleFindings = [...partition.active, ...partition.newlyIntroduced];
    gateFindings = partition.active;
    if (partition.suppressed.length > 0) {
      notes.push(`${plural(partition.suppressed.length, 'finding')} suppressed by baseline.`);
    }
    if (partition.newlyIntroduced.length > 0) {
      notes.push(
        `${plural(partition.newlyIntroduced.length, 'finding')} newly surfaced since the baseline was recorded under vocabulary ${baselineResult.baseline.createdWith.vocabulary} (current: ${runVersions.vocabulary}); these do not fail the build. Run --write-baseline to accept them.`,
      );
    }
  }

  const result = assembleResult({
    source: manifest.source,
    findings: visibleFindings,
    toolCount,
    versions: runVersions,
  });
  const report = render(result, resolved.format, wantsColor(resolved, ctx));
  const exitCode: ExitCode = gateFails(gateFindings, resolved.failOn) ? EXIT.findings : EXIT.clean;
  const stderr = notes.length > 0 ? `${notes.join('\n')}\n` : '';

  // The report goes to a file if asked, keeping stdout clean; otherwise to stdout. Informational
  // notes always go to stderr, so a --json or --sarif stdout stays a single valid document.
  if (resolved.outputPath !== undefined) {
    await ctx.effects.writeTextFile(resolved.outputPath, report);
    return { exitCode, stdout: '', stderr };
  }
  return { exitCode, stdout: report, stderr };
}
