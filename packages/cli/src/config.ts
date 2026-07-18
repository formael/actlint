// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Config resolution — deterministic and declarative. Configuration is resolved in one fixed
// precedence and is otherwise inert: there is no implicit network, no environment magic, and no
// remote config fetch (Invariant 6). The config file is data the shell reads; core never sees it.
//
//   defaults  ◄  actlint.config.json (if present)  ◄  CLI flags        (later overrides earlier)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Severity } from '@formael/actlint-core';
import { severitySchema } from '@formael/actlint-core';
import type { EnvEntry, OutputFormat, RawTarget, ScanFlags } from './args.ts';
import { type CliError, usageError } from './exit-codes.ts';

/** The declarative config file. Only these keys are honored; an unknown key is a loud error. */
export interface FileConfig {
  readonly failOn?: Severity;
  readonly baseline?: string;
  readonly vocabulary?: string;
  readonly format?: OutputFormat;
}

const CONFIG_FILENAME = 'actlint.config.json';
const KNOWN_KEYS = new Set(['failOn', 'baseline', 'vocabulary', 'format']);
const FORMATS = new Set<OutputFormat>(['human', 'json', 'sarif']);

const DEFAULT_FAIL_ON: Severity = 'high';
const DEFAULT_FORMAT: OutputFormat = 'human';

type ConfigResult =
  | { readonly ok: true; readonly config: FileConfig }
  | { readonly ok: false; readonly error: CliError };

function stringField(raw: Record<string, unknown>, key: string): string | CliError | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return usageError(`${CONFIG_FILENAME}: '${key}' must be a string`);
  return value;
}

/**
 * Load `actlint.config.json` from `cwd` if it exists. A missing file is not an error — it resolves
 * to an empty config. A present-but-malformed file is a usage error (exit 2): a trust tool never
 * silently ignores configuration it could not read.
 */
export function loadConfig(cwd: string): ConfigResult {
  let text: string;
  try {
    text = readFileSync(join(cwd, CONFIG_FILENAME), 'utf8');
  } catch {
    return { ok: true, config: {} }; // absent config file — inert, the common case.
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: usageError(`${CONFIG_FILENAME} is not valid JSON`) };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: usageError(`${CONFIG_FILENAME} must be a JSON object`) };
  }

  const raw = parsed as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      return { ok: false, error: usageError(`${CONFIG_FILENAME}: unknown key '${key}'`) };
    }
  }

  const config: {
    failOn?: Severity;
    baseline?: string;
    vocabulary?: string;
    format?: OutputFormat;
  } = {};

  if (raw.failOn !== undefined) {
    const parsedSeverity = severitySchema.safeParse(raw.failOn);
    if (!parsedSeverity.success) {
      return {
        ok: false,
        error: usageError(`${CONFIG_FILENAME}: 'failOn' must be one of ${severitySchema.options.join(', ')}`),
      };
    }
    config.failOn = parsedSeverity.data;
  }

  const baseline = stringField(raw, 'baseline');
  if (baseline !== undefined && typeof baseline !== 'string') return { ok: false, error: baseline };
  if (typeof baseline === 'string') config.baseline = baseline;

  const vocabulary = stringField(raw, 'vocabulary');
  if (vocabulary !== undefined && typeof vocabulary !== 'string') return { ok: false, error: vocabulary };
  if (typeof vocabulary === 'string') config.vocabulary = vocabulary;

  if (raw.format !== undefined) {
    if (typeof raw.format !== 'string' || !FORMATS.has(raw.format as OutputFormat)) {
      return {
        ok: false,
        error: usageError(`${CONFIG_FILENAME}: 'format' must be one of human, json, sarif`),
      };
    }
    config.format = raw.format as OutputFormat;
  }

  return { ok: true, config };
}

/** A fully-resolved scan: every option has a concrete value after applying the precedence chain. */
export interface ResolvedScan {
  readonly target: RawTarget;
  readonly format: OutputFormat;
  readonly outputPath?: string;
  readonly failOn: Severity;
  readonly baselinePath?: string;
  readonly writeBaselinePath?: string;
  readonly capturePath?: string;
  readonly vocabularyPath?: string;
  readonly experimental: boolean;
  readonly env?: readonly EnvEntry[];
}

/**
 * Resolve flags over a config file over the defaults. Per field the order is flags ◄ config ◄
 * default; target, output, capture, write-baseline, experimental, and env are flag-only (they
 * describe a single invocation, not a persistent policy).
 */
export function resolveScan(flags: ScanFlags, config: FileConfig): ResolvedScan {
  const baselinePath = flags.baselinePath ?? config.baseline;
  const vocabularyPath = flags.vocabularyPath ?? config.vocabulary;
  const resolved: {
    target: RawTarget;
    format: OutputFormat;
    outputPath?: string;
    failOn: Severity;
    baselinePath?: string;
    writeBaselinePath?: string;
    capturePath?: string;
    vocabularyPath?: string;
    experimental: boolean;
    env?: readonly EnvEntry[];
  } = {
    target: flags.target,
    format: flags.format ?? config.format ?? DEFAULT_FORMAT,
    failOn: flags.failOn ?? config.failOn ?? DEFAULT_FAIL_ON,
    experimental: flags.experimental ?? false,
  };
  if (flags.outputPath !== undefined) resolved.outputPath = flags.outputPath;
  if (baselinePath !== undefined) resolved.baselinePath = baselinePath;
  if (flags.writeBaselinePath !== undefined) resolved.writeBaselinePath = flags.writeBaselinePath;
  if (flags.capturePath !== undefined) resolved.capturePath = flags.capturePath;
  if (vocabularyPath !== undefined) resolved.vocabularyPath = vocabularyPath;
  if (flags.env !== undefined) resolved.env = flags.env;
  return resolved;
}
