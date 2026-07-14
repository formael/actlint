// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Snapshots are the executable spec for product COPY: review every diff, never blind-accept it.

import { describe, expect, it } from 'vitest';

import { cleanResult, mixedResult, silentServerResult, unassessedResult } from './fixtures.ts';
import { humanReporter } from './human.ts';

const ESC = '';

describe('humanReporter (the scorecard)', () => {
  it('renders the mixed server the same way every time (no-color)', () => {
    expect(humanReporter(mixedResult())).toMatchSnapshot();
  });

  it('renders the mixed server with colour when asked', () => {
    expect(humanReporter(mixedResult(), { color: true })).toMatchSnapshot();
  });

  it('renders a spotless server', () => {
    expect(humanReporter(cleanResult())).toMatchSnapshot();
  });

  it('renders a server with unassessed tools (qualified grade, not-assessable footer)', () => {
    expect(humanReporter(unassessedResult())).toMatchSnapshot();
  });

  it('renders a server that declares no annotations anywhere', () => {
    expect(humanReporter(silentServerResult())).toMatchSnapshot();
  });

  it('qualifies the grade and never presents an unassessed tool as consistent', () => {
    const out = humanReporter(unassessedResult());
    expect(out).toContain('(assessed 9 of 12 tools)');
    expect(out).toContain('9 of 12 tools consistent');
    expect(out).toContain('3 not assessable (no recognized risk signals)');
    expect(out).toContain('Not assessable is not verified honest');
  });

  it('surfaces a zero annotation surface without claiming anything unassessed', () => {
    const out = humanReporter(silentServerResult());
    expect(out).toContain('0 of 4 declare annotations');
    expect(out).not.toContain('not assessable');
    expect(out).not.toContain('(assessed');
  });

  it('puts the grade in the headline', () => {
    expect(humanReporter(mixedResult())).toContain('honesty grade: C');
  });

  it('degrades cleanly to no-color by default (no ANSI escapes)', () => {
    expect(humanReporter(mixedResult())).not.toContain(ESC);
  });

  it('emits ANSI only when colour is explicitly enabled', () => {
    expect(humanReporter(mixedResult(), { color: true })).toContain(ESC);
  });

  it('orders under-declared before undeclared before over-declared', () => {
    const out = humanReporter(mixedResult());
    const under = out.indexOf('write-as-readonly');
    const undeclared = out.indexOf('destructive-absent');
    const over = out.indexOf('over-declared-risk');
    expect(under).toBeGreaterThanOrEqual(0);
    expect(under).toBeLessThan(undeclared);
    expect(undeclared).toBeLessThan(over);
  });

  it('separates advisories below the honesty verdicts and labels them', () => {
    const out = humanReporter(mixedResult());
    const lastHonesty = out.indexOf('over-declared-risk');
    const advisoryLabel = out.indexOf('advisories — capability hygiene');
    const advisoryFinding = out.indexOf('no-scope-constraint');
    expect(lastHonesty).toBeLessThan(advisoryLabel);
    expect(advisoryLabel).toBeLessThan(advisoryFinding);
  });

  it('renders an uncertain honesty finding as a soft tag, never hidden', () => {
    const out = humanReporter(mixedResult());
    expect(out).toContain('MED?');
    expect(out).toContain('send_message');
  });

  it('renders an uncertain advisory as ADV?, and a certain one as ADV', () => {
    const out = humanReporter(mixedResult());
    expect(out).toContain('ADV?');
    expect(out).toContain('ADV ');
  });

  it('carries a reason and a standard on every honesty line', () => {
    const out = humanReporter(mixedResult());
    // The reason (rationale) and a crosswalk standard both appear for the flagship finding.
    expect(out).toContain('A read-only declaration on a tool that writes suppresses');
    expect(out).toContain('OWASP ASI02:2026');
    expect(out).toContain('EU AI Act Art.14');
  });
});
