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

describe('parseArgv — --env', () => {
  it('parses a literal assignment', () => {
    expect(scan(['--env', 'FOO=bar', 'cmd']).env).toEqual([{ key: 'FOO', kind: 'literal', value: 'bar' }]);
  });

  it('parses a bare name as a forward entry', () => {
    expect(scan(['--env', 'FOO', 'cmd']).env).toEqual([{ key: 'FOO', kind: 'forward' }]);
  });

  it('treats an empty value as a valid literal, distinct from unset', () => {
    expect(scan(['--env', 'FOO=', 'cmd']).env).toEqual([{ key: 'FOO', kind: 'literal', value: '' }]);
  });

  it('keeps multiple entries in argv order', () => {
    expect(scan(['--env', 'A=1', '--env', 'B', 'cmd']).env).toEqual([
      { key: 'A', kind: 'literal', value: '1' },
      { key: 'B', kind: 'forward' },
    ]);
  });

  it('splits at the first = only, so the value may itself contain =', () => {
    expect(scan(['--env', 'FOO=a=b', 'cmd']).env).toEqual([{ key: 'FOO', kind: 'literal', value: 'a=b' }]);
  });
});

describe('parseArgv — --header', () => {
  it('parses a header, splitting at the first colon', () => {
    expect(scan(['--http', 'https://x/mcp', '--header', 'Authorization: Bearer x']).headers).toEqual([
      { name: 'Authorization', value: 'Bearer x' },
    ]);
  });

  it('does not require a space after the colon', () => {
    expect(scan(['--http', 'https://x/mcp', '--header', 'X-Api-Key:abc']).headers).toEqual([
      { name: 'X-Api-Key', value: 'abc' },
    ]);
  });

  it('splits at the first colon only, so the value may itself contain colons', () => {
    expect(scan(['--http', 'https://x/mcp', '--header', 'Authorization: Basic a:b:c']).headers).toEqual([
      { name: 'Authorization', value: 'Basic a:b:c' },
    ]);
  });

  it('keeps multiple headers in argv order', () => {
    expect(scan(['--http', 'https://x/mcp', '--header', 'A: 1', '--header', 'B: 2']).headers).toEqual([
      { name: 'A', value: '1' },
      { name: 'B', value: '2' },
    ]);
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

  it('rejects an --env key that is not a valid variable name, naming the key not the value', () => {
    const message = usage(['--env', '1BAD=secret', 'cmd']);
    expect(message).toMatch(/1BAD/);
    expect(message).not.toMatch(/secret/);
  });

  it('rejects the same --env key given twice', () => {
    expect(usage(['--env', 'FOO=a', '--env', 'FOO=b', 'cmd'])).toMatch(/more than once/);
  });

  it('rejects --env with a non-stdio target', () => {
    expect(usage(['--env', 'FOO', '--http', 'https://x/mcp'])).toMatch(/only applies when launching a stdio/);
  });

  it('rejects --env with no value', () => {
    expect(usage(['--env'])).toMatch(/requires a value/);
  });

  it('rejects a duplicate header name, case-insensitively, echoing no value', () => {
    const message = usage([
      '--http',
      'https://x/mcp',
      '--header',
      'Authorization: Bearer a',
      '--header',
      'authorization: Bearer SECRET',
    ]);
    expect(message).toMatch(/more than once/);
    expect(message).not.toMatch(/SECRET/);
  });

  it('rejects a header with no colon, echoing no value', () => {
    const message = usage(['--http', 'https://x/mcp', '--header', 'Bearer SECRET']);
    expect(message).toMatch(/Name: value/);
    expect(message).not.toMatch(/SECRET/);
  });

  it('rejects a header with an empty or malformed name, echoing no value', () => {
    expect(usage(['--http', 'https://x/mcp', '--header', ': SECRET'])).not.toMatch(/SECRET/);
    const badChars = usage(['--http', 'https://x/mcp', '--header', 'bad name: SECRET']);
    expect(badChars).toMatch(/valid header name/);
    expect(badChars).not.toMatch(/SECRET/);
  });

  it('rejects --header with a non-http target', () => {
    expect(usage(['--header', 'Authorization: Bearer x', 'node', 'srv.js'])).toMatch(
      /only applies to an --http target/,
    );
    expect(usage(['--header', 'Authorization: Bearer x', '--manifest', 'm.json'])).toMatch(
      /only applies to an --http target/,
    );
  });

  it('rejects --header with no value', () => {
    expect(usage(['--header'])).toMatch(/requires a value/);
  });
});
