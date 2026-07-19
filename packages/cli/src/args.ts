// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The argument parser — hand-rolled and dependency-light on purpose. The surface is small and
// obvious, and the output (a scorecard) is the product's face, so it should not be at the mercy of a
// heavy CLI framework's conventions. This module is purely syntactic: it turns argv into a typed
// Command or a usage error. It resolves no config, reads no file, and touches no network.

import type { Severity } from '@formael/actlint-core';
import { severitySchema } from '@formael/actlint-core';
import { type CliError, usageError } from './exit-codes.ts';

export type OutputFormat = 'human' | 'json' | 'sarif';

/** A target as written on the command line — one ingestion source, selected exactly once. */
export type RawTarget =
  | { readonly kind: 'stdio'; readonly command: string; readonly args: readonly string[] }
  | { readonly kind: 'http'; readonly url: string }
  | { readonly kind: 'card'; readonly url: string }
  | { readonly kind: 'registry'; readonly serverId: string }
  | { readonly kind: 'manifest'; readonly path: string };

/** One --env entry as written: a literal assignment, or a name to forward from actlint's environment. */
export type EnvEntry =
  | { readonly key: string; readonly kind: 'literal'; readonly value: string }
  | { readonly key: string; readonly kind: 'forward' };

/** One --header entry as written. The value is carried verbatim and treated as a secret. */
export interface HeaderEntry {
  readonly name: string;
  readonly value: string;
}

/** The flags of a scan invocation, exactly as given. Absent overrides are filled by config/defaults. */
export interface ScanFlags {
  readonly target: RawTarget;
  readonly format?: OutputFormat;
  readonly outputPath?: string;
  readonly failOn?: Severity;
  readonly baselinePath?: string;
  readonly writeBaselinePath?: string;
  readonly capturePath?: string;
  readonly vocabularyPath?: string;
  readonly experimental?: boolean;
  readonly env?: readonly EnvEntry[];
  readonly headers?: readonly HeaderEntry[];
}

export type Command =
  | { readonly kind: 'version' }
  | { readonly kind: 'help' }
  | { readonly kind: 'explain'; readonly ruleId: string }
  | { readonly kind: 'scan'; readonly flags: ScanFlags };

export type ParseResult =
  | { readonly ok: true; readonly command: Command }
  | { readonly ok: false; readonly error: CliError };

type Draft = {
  -readonly [K in keyof ScanFlags]?: ScanFlags[K];
};

// A POSIX-shaped environment variable name: a letter or underscore, then letters, digits, or
// underscores. A malformed name is rejected loudly rather than passed to the child.
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Parse one --env token into an entry. Splits at the first `=`: no `=` is the forward form (take the
// value from actlint's environment), a present `=` is the literal form and everything after it —
// further `=` characters and the empty string included — is the value verbatim. A value is never
// echoed in an error, since a mistyped literal form may carry a secret.
function parseEnvEntry(token: string): EnvEntry | CliError {
  const eq = token.indexOf('=');
  const key = eq === -1 ? token : token.slice(0, eq);
  if (!ENV_KEY.test(key)) {
    return usageError(`--env expects KEY or KEY=VALUE with a valid variable name (got '${key}')`);
  }
  return eq === -1 ? { key, kind: 'forward' } : { key, kind: 'literal', value: token.slice(eq + 1) };
}

// An RFC 7230 field-name token: the characters a header name is allowed to contain.
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

// Parse one --header token, "Name: value". Splits at the first colon, since a value (e.g. a bearer
// token) may itself contain colons. The name is trimmed and validated; the value is the remainder
// with leading whitespace stripped, taken otherwise verbatim. A value is never echoed in an error —
// a mistyped header may carry a live credential.
function parseHeaderEntry(token: string): HeaderEntry | CliError {
  const colon = token.indexOf(':');
  if (colon === -1) return usageError("--header expects 'Name: value'");
  const name = token.slice(0, colon).trim();
  if (!HEADER_NAME.test(name)) {
    return usageError(`--header expects a valid header name before ':' (got '${name}')`);
  }
  return { name, value: token.slice(colon + 1).replace(/^\s+/, '') };
}

// A single-target invariant, enforced as tokens are read: setting a second target is a usage error,
// never a silent last-wins. "Exactly one ingestion source" is the contract (07 §2).
function setTarget(draft: Draft, target: RawTarget): CliError | null {
  if (draft.target !== undefined) {
    return usageError('more than one target given — choose exactly one ingestion source');
  }
  draft.target = target;
  return null;
}

/**
 * Parse argv (already stripped of `node` and the script path) into a Command. Returns a usage error
 * for any malformed invocation — a bad flag, a missing value, no target, or conflicting sources —
 * which the shell maps to exit code 2, never confused with a findings failure.
 */
export function parseArgv(argv: readonly string[]): ParseResult {
  if (argv.length === 0) {
    return { ok: false, error: usageError('no target given') };
  }

  // `explain <ruleId>` is its own command — resolved before target parsing so `explain` is never
  // mistaken for a stdio command name.
  if (argv[0] === 'explain') {
    const ruleId = argv[1];
    if (ruleId === undefined || ruleId.length === 0) {
      return {
        ok: false,
        error: usageError('explain requires a rule id, e.g. `actlint explain destructive-unflagged`'),
      };
    }
    if (argv.length > 2) {
      return { ok: false, error: usageError('explain takes a single rule id') };
    }
    return { ok: true, command: { kind: 'explain', ruleId } };
  }

  const draft: Draft = {};
  let format: OutputFormat | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string;

    // A flag that carries a value consumes the next token. `--manifest -` is legitimate, so a value
    // is taken verbatim; only a truly missing value is an error.
    const valueFor = (flag: string): string | CliError => {
      const value = argv[i + 1];
      if (value === undefined) return usageError(`${flag} requires a value`);
      i++;
      return value;
    };

    switch (token) {
      case '--version':
        return { ok: true, command: { kind: 'version' } };
      case '-h':
      case '--help':
        return { ok: true, command: { kind: 'help' } };

      case '--json':
      case '--sarif': {
        const next: OutputFormat = token === '--json' ? 'json' : 'sarif';
        if (format !== undefined && format !== next) {
          return { ok: false, error: usageError('choose one output format — not both --json and --sarif') };
        }
        format = next;
        break;
      }

      case '-o':
      case '--output': {
        const value = valueFor('--output');
        if (typeof value !== 'string') return { ok: false, error: value };
        draft.outputPath = value;
        break;
      }

      case '--fail-on': {
        const value = valueFor('--fail-on');
        if (typeof value !== 'string') return { ok: false, error: value };
        const parsed = severitySchema.safeParse(value);
        if (!parsed.success) {
          return {
            ok: false,
            error: usageError(
              `--fail-on expects one of ${severitySchema.options.join(', ')} (got '${value}')`,
            ),
          };
        }
        draft.failOn = parsed.data;
        break;
      }

      case '--baseline': {
        const value = valueFor('--baseline');
        if (typeof value !== 'string') return { ok: false, error: value };
        draft.baselinePath = value;
        break;
      }
      case '--write-baseline': {
        const value = valueFor('--write-baseline');
        if (typeof value !== 'string') return { ok: false, error: value };
        draft.writeBaselinePath = value;
        break;
      }
      case '--capture': {
        const value = valueFor('--capture');
        if (typeof value !== 'string') return { ok: false, error: value };
        draft.capturePath = value;
        break;
      }
      case '--vocabulary': {
        const value = valueFor('--vocabulary');
        if (typeof value !== 'string') return { ok: false, error: value };
        draft.vocabularyPath = value;
        break;
      }
      case '--experimental':
        draft.experimental = true;
        break;

      case '--env': {
        const value = valueFor('--env');
        if (typeof value !== 'string') return { ok: false, error: value };
        const entry = parseEnvEntry(value);
        if (!('key' in entry)) return { ok: false, error: entry };
        const existing = draft.env ?? [];
        if (existing.some((e) => e.key === entry.key)) {
          return {
            ok: false,
            error: usageError(`--env ${entry.key} given more than once — each variable may be set once`),
          };
        }
        draft.env = [...existing, entry];
        break;
      }

      case '--header': {
        const value = valueFor('--header');
        if (typeof value !== 'string') return { ok: false, error: value };
        const entry = parseHeaderEntry(value);
        if (!('name' in entry)) return { ok: false, error: entry };
        const existing = draft.headers ?? [];
        // Header names are case-insensitive; a duplicate is a loud error, never a silent last-wins.
        if (existing.some((h) => h.name.toLowerCase() === entry.name.toLowerCase())) {
          return {
            ok: false,
            error: usageError(`--header ${entry.name} given more than once — set each header once`),
          };
        }
        draft.headers = [...existing, entry];
        break;
      }

      case '--http': {
        const value = valueFor('--http');
        if (typeof value !== 'string') return { ok: false, error: value };
        const conflict = setTarget(draft, { kind: 'http', url: value });
        if (conflict !== null) return { ok: false, error: conflict };
        break;
      }
      case '--card': {
        const value = valueFor('--card');
        if (typeof value !== 'string') return { ok: false, error: value };
        const conflict = setTarget(draft, { kind: 'card', url: value });
        if (conflict !== null) return { ok: false, error: conflict };
        break;
      }
      case '--registry': {
        const value = valueFor('--registry');
        if (typeof value !== 'string') return { ok: false, error: value };
        const conflict = setTarget(draft, { kind: 'registry', serverId: value });
        if (conflict !== null) return { ok: false, error: conflict };
        break;
      }
      case '--manifest': {
        const value = valueFor('--manifest');
        if (typeof value !== 'string') return { ok: false, error: value };
        const conflict = setTarget(draft, { kind: 'manifest', path: value });
        if (conflict !== null) return { ok: false, error: conflict };
        break;
      }

      case '--': {
        // Explicit end of actlint options: the remainder is a stdio command, verbatim.
        const rest = argv.slice(i + 1);
        if (rest.length === 0)
          return { ok: false, error: usageError('`--` must be followed by a command to launch') };
        const conflict = setTarget(draft, { kind: 'stdio', command: rest[0] as string, args: rest.slice(1) });
        if (conflict !== null) return { ok: false, error: conflict };
        i = argv.length;
        break;
      }

      default: {
        if (token.startsWith('-')) {
          return { ok: false, error: usageError(`unknown option: ${token}`) };
        }
        // The first bare token begins a stdio command; everything after it — flags included —
        // belongs to that command, not to actlint. Options must precede the command.
        const rest = argv.slice(i);
        const conflict = setTarget(draft, { kind: 'stdio', command: rest[0] as string, args: rest.slice(1) });
        if (conflict !== null) return { ok: false, error: conflict };
        i = argv.length;
        break;
      }
    }
  }

  if (format !== undefined) draft.format = format;

  if (draft.target === undefined) {
    return {
      ok: false,
      error: usageError('no target given — provide a command, --http, --card, --registry, or --manifest'),
    };
  }
  if (draft.writeBaselinePath !== undefined && draft.baselinePath !== undefined) {
    return {
      ok: false,
      error: usageError('--write-baseline records a fresh baseline; do not combine it with --baseline'),
    };
  }
  if (draft.env !== undefined && draft.env.length > 0 && draft.target.kind !== 'stdio') {
    return { ok: false, error: usageError('--env only applies when launching a stdio server') };
  }
  if (draft.headers !== undefined && draft.headers.length > 0 && draft.target.kind !== 'http') {
    return { ok: false, error: usageError('--header only applies to an --http target') };
  }

  return { ok: true, command: { kind: 'scan', flags: draft as ScanFlags } };
}
