#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// actlint — the imperative shell's entry point, and the ONLY place the process itself is touched:
// argv in, bytes to stdout/stderr, a single exit code out. Everything above this line is a value —
// the exit code and the text to write are computed by `run`, so the whole tool is exercisable in a
// test without spawning a process. There is no telemetry and no implicit network here or anywhere
// downstream; the only network that happens is an ingestion the user explicitly asked for.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ingest, writeCapture } from '@formael/actlint-mcp-fetch';
import { EXIT } from './exit-codes.ts';
import { run } from './run.ts';
import type { Effects, RunContext } from './scan.ts';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function writeTextFile(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data, 'utf8');
}

const effects: Effects = { ingest, writeCapture, writeTextFile, readStdin };

async function main(): Promise<void> {
  const ctx: RunContext = {
    cwd: process.cwd(),
    env: process.env,
    colorCapable: process.stdout.isTTY === true,
    effects,
  };

  const result = await run(process.argv.slice(2), ctx);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`actlint: unexpected error: ${message}\n`);
  process.exit(EXIT.usage);
});
