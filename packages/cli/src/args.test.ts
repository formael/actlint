// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { parseArgv } from './args.ts';

function scan(argv: string[]) {
  const result = parseArgv(argv);
  if (!result.ok) throw new Error(`expected a parse, got usage error: ${result.error.message}`);
  if (result.command.kind !== 'scan') throw new Error(`expected a scan command, got ${result.command.kind}`);
  return result.command.flags;
}

describe('parseArgv — targets', () => {
  it('reads a stdio command and passes trailing tokens to it', () => {
    const flags = scan(['--json', 'node', 'server.js', '--port', '3000']);
    expect(flags.target).toEqual({ kind: 'stdio', command: 'node', args: ['server.js', '--port', '3000'] });
    expect(flags.format).toBe('json');
  });

  it('reads each non-stdio target flag', () => {
    expect(scan(['--http', 'https://x/mcp']).target).toEqual({ kind: 'http', url: 'https://x/mcp' });
    expect(scan(['--card', 'https://x/.well-known/mcp']).target).toEqual({
      kind: 'card',
      url: 'https://x/.well-known/mcp',
    });
    expect(scan(['--registry', 'io.example/server']).target).toEqual({
      kind: 'registry',
      serverId: 'io.example/server',
    });
    expect(scan(['--manifest', 'm.json']).target).toEqual({ kind: 'manifest', path: 'm.json' });
  });

  it('treats --manifest - (stdin) as a first-class target', () => {
    expect(scan(['--manifest', '-']).target).toEqual({ kind: 'manifest', path: '-' });
  });

  it('supports -- to end options before a stdio command', () => {
    const flags = scan(['--fail-on', 'low', '--', 'python', '-m', 'srv']);
    expect(flags.target).toEqual({ kind: 'stdio', command: 'python', args: ['-m', 'srv'] });
    expect(flags.failOn).toBe('low');
  });
});

describe('parseArgv — commands', () => {
  it('recognizes --version and --help', () => {
    expect(parseArgv(['--version'])).toEqual({ ok: true, command: { kind: 'version' } });
    expect(parseArgv(['--help'])).toEqual({ ok: true, command: { kind: 'help' } });
    expect(parseArgv(['-h'])).toEqual({ ok: true, command: { kind: 'help' } });
  });

  it('parses explain <ruleId>', () => {
    expect(parseArgv(['explain', 'destructive-unflagged'])).toEqual({
      ok: true,
      command: { kind: 'explain', ruleId: 'destructive-unflagged' },
    });
  });
});

describe('parseArgv — usage errors', () => {
  const usage = (argv: string[]) => {
    const result = parseArgv(argv);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a usage error');
    expect(result.error.kind).toBe('usage');
    return result.error.message;
  };

  it('rejects an empty invocation', () => {
    expect(usage([])).toMatch(/no target/);
  });

  it('rejects two ingestion sources', () => {
    expect(usage(['--http', 'https://x', '--manifest', 'm.json'])).toMatch(/one target|one ingestion/);
    expect(usage(['--manifest', 'm.json', 'node', 'srv.js'])).toMatch(/one target|one ingestion/);
  });

  it('rejects an unknown flag', () => {
    expect(usage(['--nope', '--manifest', 'm.json'])).toMatch(/unknown option/);
  });

  it('rejects a missing flag value', () => {
    expect(usage(['--manifest'])).toMatch(/requires a value/);
  });

  it('rejects an invalid --fail-on severity', () => {
    expect(usage(['--fail-on', 'apocalyptic', '--manifest', 'm.json'])).toMatch(/fail-on/);
  });

  it('rejects both --json and --sarif', () => {
    expect(usage(['--json', '--sarif', '--manifest', 'm.json'])).toMatch(/one output format/);
  });

  it('rejects combining --write-baseline with --baseline', () => {
    expect(usage(['--baseline', 'b.json', '--write-baseline', 'b.json', '--manifest', 'm.json'])).toMatch(
      /write-baseline/,
    );
  });

  it('rejects explain without a rule id', () => {
    expect(usage(['explain'])).toMatch(/rule id/);
  });
});
