// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The exit-code and baseline contracts, exercised end-to-end through `run` with injected effects.
// These are the CLI's spec: the four exit codes are a public API, so each is asserted exactly, and
// the offline stdin path is proven identical to file ingestion. No test here makes a network call —
// one of them proves it.

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { reportSchema } from '@formael/actlint-core';
import { ingest, writeCapture } from '@formael/actlint-mcp-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT } from './exit-codes.ts';
import { run } from './run.ts';
import type { RunContext } from './scan.ts';
import { CLEAN_MANIFEST, DISHONEST_MANIFEST, UNDECLARED_MANIFEST } from './test-manifests.ts';

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'actlint-cli-'));
});

interface CtxOptions {
  readonly stdin?: string;
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
}

function ctx(options: CtxOptions = {}): RunContext {
  return {
    cwd: options.cwd ?? workdir,
    env: options.env ?? {},
    colorCapable: false,
    effects: {
      ingest,
      writeCapture,
      writeTextFile: async (path, data) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, data, 'utf8');
      },
      readStdin: async () => options.stdin ?? '',
    },
  };
}

describe('exit-code contract', () => {
  it('0 — a clean scan', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: CLEAN_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.clean);
    expect(result.stdout).toContain('honesty grade: A');
  });

  it('1 — a finding at or above the default gate', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: DISHONEST_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.findings);
    expect(result.stdout).toContain('write-as-readonly');
  });

  it('0 — findings present but below the gate threshold', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: UNDECLARED_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.clean);
    expect(result.stdout).toContain('destructive-absent');
  });

  it('2 — a usage error (bad flag)', async () => {
    const result = await run(['--nope', '--manifest', '-'], ctx({ stdin: CLEAN_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.usage);
    expect(result.stderr).toMatch(/unknown option/);
  });

  it('3 — an ingestion error (unparseable manifest)', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: 'not json' }));
    expect(result.exitCode).toBe(EXIT.ingestion);
    expect(result.stderr).toMatch(/not valid JSON/);
  });

  it('3 — an ingestion error (missing file)', async () => {
    const result = await run(['--manifest', join(workdir, 'nope.json')], ctx());
    expect(result.exitCode).toBe(EXIT.ingestion);
  });

  it('lowering --fail-on makes an undeclared finding gate', async () => {
    const result = await run(['--fail-on', 'low', '--manifest', '-'], ctx({ stdin: UNDECLARED_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.findings);
  });
});

describe('output formats', () => {
  it('--json matches the published report schema', async () => {
    const result = await run(['--json', '--manifest', '-'], ctx({ stdin: DISHONEST_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.findings);
    const parsed = reportSchema.safeParse(JSON.parse(result.stdout));
    expect(parsed.success).toBe(true);
  });

  it('stdin and file ingestion produce identical findings', async () => {
    const file = join(workdir, 'manifest.json');
    await writeFile(file, DISHONEST_MANIFEST, 'utf8');

    const fromStdin = await run(['--json', '--manifest', '-'], ctx({ stdin: DISHONEST_MANIFEST }));
    const fromFile = await run(['--json', '--manifest', file], ctx());

    // The two differ only in the source provenance; the findings, grade, and summary are identical.
    const stripSource = (json: string) => {
      const { source: _source, ...rest } = JSON.parse(json) as Record<string, unknown>;
      return rest;
    };
    expect(stripSource(fromStdin.stdout)).toEqual(stripSource(fromFile.stdout));
  });

  it('-o writes the report to a file and keeps stdout clean', async () => {
    const out = join(workdir, 'report.json');
    const result = await run(['--json', '-o', out, '--manifest', '-'], ctx({ stdin: DISHONEST_MANIFEST }));
    expect(result.stdout).toBe('');
    const written = await readFile(out, 'utf8');
    expect(reportSchema.safeParse(JSON.parse(written)).success).toBe(true);
  });

  it('renders a stable human scorecard', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: DISHONEST_MANIFEST }));
    expect(result.stdout).toMatchSnapshot();
  });
});

describe('baseline', () => {
  it('--write-baseline then --baseline suppresses exactly those findings', async () => {
    const baselinePath = join(workdir, '.actlint-baseline.json');

    const write = await run(
      ['--write-baseline', baselinePath, '--manifest', '-'],
      ctx({ stdin: DISHONEST_MANIFEST }),
    );
    expect(write.exitCode).toBe(EXIT.clean);
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as { accepted: unknown[] };
    expect(baseline.accepted.length).toBeGreaterThan(0);

    const suppressed = await run(
      ['--baseline', baselinePath, '--manifest', '-'],
      ctx({ stdin: DISHONEST_MANIFEST }),
    );
    expect(suppressed.exitCode).toBe(EXIT.clean);
    expect(suppressed.stderr).toMatch(/suppressed by baseline/);
  });

  it('reports a finding as newly-introduced after a vocabulary bump, not as a failure', async () => {
    const baselinePath = join(workdir, 'old-baseline.json');
    // A baseline recorded under a different vocabulary version, accepting nothing.
    const oldBaseline = {
      baselineVersion: 1,
      createdWith: { actlint: '0.1.0', vocabulary: '0.0.1' },
      accepted: [],
    };
    await writeFile(baselinePath, JSON.stringify(oldBaseline), 'utf8');

    const result = await run(
      ['--baseline', baselinePath, '--manifest', '-'],
      ctx({ stdin: DISHONEST_MANIFEST }),
    );
    expect(result.exitCode).toBe(EXIT.clean);
    expect(result.stderr).toMatch(/newly surfaced/);
  });

  it('rejects a malformed baseline as a usage error', async () => {
    const baselinePath = join(workdir, 'bad-baseline.json');
    await writeFile(baselinePath, '{"nonsense": true}', 'utf8');
    const result = await run(['--baseline', baselinePath, '--manifest', '-'], ctx({ stdin: CLEAN_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.usage);
  });
});

describe('config resolution', () => {
  it('reads fail-on from actlint.config.json, and a flag overrides it', async () => {
    await writeFile(join(workdir, 'actlint.config.json'), JSON.stringify({ failOn: 'low' }), 'utf8');

    // Config alone gates the undeclared (low) finding.
    const withConfig = await run(['--manifest', '-'], ctx({ stdin: UNDECLARED_MANIFEST }));
    expect(withConfig.exitCode).toBe(EXIT.findings);

    // A flag overrides the config back up to critical, so the low finding no longer gates.
    const flagWins = await run(
      ['--fail-on', 'critical', '--manifest', '-'],
      ctx({ stdin: UNDECLARED_MANIFEST }),
    );
    expect(flagWins.exitCode).toBe(EXIT.clean);
  });

  it('rejects an unknown config key', async () => {
    await writeFile(join(workdir, 'actlint.config.json'), JSON.stringify({ nope: 1 }), 'utf8');
    const result = await run(['--manifest', '-'], ctx({ stdin: CLEAN_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.usage);
  });
});

describe('no phone-home', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes no network call during an offline scan', async () => {
    const result = await run(['--manifest', '-'], ctx({ stdin: CLEAN_MANIFEST }));
    expect(result.exitCode).toBe(EXIT.clean);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('meta commands', () => {
  it('--version prints all four versions', async () => {
    const result = await run(['--version'], ctx());
    expect(result.exitCode).toBe(EXIT.clean);
    for (const line of ['actlint', 'vocabulary', 'crosswalk', 'report-schema']) {
      expect(result.stdout).toContain(line);
    }
  });

  it('explain renders a known rule and rejects an unknown one', async () => {
    const known = await run(['explain', 'write-as-readonly'], ctx());
    expect(known.exitCode).toBe(EXIT.clean);
    expect(known.stdout).toMatch(/Meaning/);
    expect(known.stdout).toMatch(/Standards/);

    const unknown = await run(['explain', 'no-such-rule'], ctx());
    expect(unknown.exitCode).toBe(EXIT.usage);
  });
});
