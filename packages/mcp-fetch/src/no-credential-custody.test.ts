// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The credential red line, made structural. actlint may carry a credential for one connection; it
// must never keep one. The auth-carrying code — the live sources — opens outbound connections only:
// it never writes a file, never listens for a callback, and never launches a browser. This test
// pins that by grepping the sources, so a future change that reaches for any of those fails CI.
//
// Comments are stripped first, so documentation is free to name what it forbids; only real code is
// checked. The forbidden tokens are assembled from fragments so this file never matches itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sources');
const SELF = fileURLToPath(import.meta.url);

// Assembled from fragments so the literals never appear verbatim in this source file.
const FS_WRITE = `write${'FileSync'}`; // a synchronous file write
const FS_WRITE_PROMISE = `write${'File'}`; // the promise-based file write
const LISTEN = `.${'listen'}(`; // binding a server socket for a callback
const CREATE_SERVER = `create${'Server'}`; // standing up an inbound server
const OPEN_URL = [`xdg-${'open'}`, `${'open'}('http`]; // launching a browser

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts') && full !== SELF) {
      out.push(full);
    }
  }
  return out;
}

describe('the live sources keep no credential and open only outbound connections', () => {
  const files = listSourceFiles(SOURCES_DIR);

  it('scans the source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('writes no file, listens on no socket, and launches no browser', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const forbidden = [FS_WRITE, FS_WRITE_PROMISE, LISTEN, CREATE_SERVER, ...OPEN_URL];
      if (forbidden.some((token) => code.includes(token))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
