// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Assessment coverage against the real vocabulary, plus the three properties that keep it honest:
// coverage is monotonic (a signal never un-assesses a tool), an unassessed tool is never folded into
// consistent, and the comparator still refuses to accuse on silence (the hasEvidence gate).

import { VOCABULARY } from '@formael/action-risk-vocabulary';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compose } from '../derive/compose.ts';
import type { PrimaryDimension } from '../derive/primary-dimension.ts';
import type { Contribution } from '../derive/types.ts';
import { toSignalWeight } from '../derive/types.ts';
import type { ActionRiskProfile, Confidence, Dimension } from '../dimensions.ts';
import type { JsonSchema, ToolDefinition, ToolManifest } from '../manifest.ts';
import { isoTimestampSchema, ruleIdSchema } from '../primitives.ts';
import { classify } from './classify.ts';
import { classifyManifest } from './classify-tool.ts';
import { assessManifest, profileIsAssessed } from './coverage.ts';
import { makeFinding } from './make-finding.ts';
import { declared, dim, hint, profile } from './test-builders.ts';

function tool(over: Partial<ToolDefinition> & { name: string; inputSchema: JsonSchema }): ToolDefinition {
  return { annotations: declared(), ...over };
}

function manifestOf(tools: readonly ToolDefinition[]): ToolManifest {
  return {
    source: { kind: 'file', path: 'example.json' },
    capturedAt: isoTimestampSchema.parse('2026-07-05T00:00:00Z'),
    tools,
  };
}

// A tool with an opaque, out-of-vocabulary name and a signal-free schema: nothing actlint recognizes
// fires, so it derives all-silent — the case coverage exists to surface.
const OPAQUE = tool({
  name: 'zorp_widget',
  inputSchema: { type: 'object', properties: { handle: { type: 'string' } } },
});

describe('assessManifest', () => {
  it('marks an opaque, signal-free tool unassessed and names it', () => {
    const coverage = assessManifest(manifestOf([OPAQUE]), VOCABULARY, []);
    expect(coverage.unassessedTools).toBe(1);
    expect(coverage.assessedTools).toBe(0);
    expect(coverage.unassessedToolNames).toEqual(['zorp_widget']);
  });

  it('marks a recognized tool assessed', () => {
    const del = tool({
      name: 'delete_account',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
    });
    const coverage = assessManifest(manifestOf([del]), VOCABULARY, []);
    expect(coverage.assessedTools).toBe(1);
    expect(coverage.unassessedTools).toBe(0);
    expect(coverage.unassessedToolNames).toEqual([]);
  });

  it('counts only tools that state an annotation, in manifest order', () => {
    const annotated = tool({
      name: 'zorp_widget',
      inputSchema: { type: 'object', properties: { handle: { type: 'string' } } },
      annotations: declared({ readOnly: hint.true }),
    });
    const silentHints = tool({
      name: 'quux_gadget',
      inputSchema: { type: 'object', properties: { handle: { type: 'string' } } },
      annotations: declared({ readOnly: hint.absent }),
    });
    const coverage = assessManifest(manifestOf([annotated, silentHints]), VOCABULARY, []);
    expect(coverage.annotatedTools).toBe(1);
    expect(coverage.unassessedToolNames).toEqual(['zorp_widget', 'quux_gadget']);
  });

  it('a tool that produced an honesty finding is assessed even if its dimensions read silent', () => {
    // The finding is the evidence: whatever fired it, the tool was judged, so it is not unassessed.
    const built = makeFinding({
      ruleId: ruleIdSchema.parse('destructive-absent'),
      toolName: 'zorp_widget',
      verdict: 'undeclared',
      confidence: 'high',
      derived: profile({
        destructiveness: dim('mutating', 'high', [{ id: 'verb.mutate', weight: 'definitive' }]),
      }),
      declared: declared(),
      signals: [{ id: 'verb.mutate', weight: 'definitive' }],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const coverage = assessManifest(manifestOf([OPAQUE]), VOCABULARY, [built.value]);
    expect(coverage.assessedTools).toBe(1);
    expect(coverage.unassessedTools).toBe(0);
  });

  it('is deterministic — same manifest, byte-identical coverage', () => {
    const m = manifestOf([OPAQUE]);
    expect(JSON.stringify(assessManifest(m, VOCABULARY, []))).toBe(
      JSON.stringify(assessManifest(m, VOCABULARY, [])),
    );
  });
});

// A random contribution to any one dimension. Mirrors compose.test's arbitrary: a valid ordinal
// level for the chosen dimension, at any weight and confidence.
const contributionArb: fc.Arbitrary<Contribution> = fc
  .record({
    dimension: fc.constantFrom<PrimaryDimension>(
      'reversibility',
      'destructiveness',
      'externalReach',
      'idempotency',
    ),
    levelPick: fc.nat({ max: 3 }),
    weight: fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<'high' | 'medium' | 'low'>,
    confidence: fc.constantFrom<Confidence>('high', 'medium', 'low', 'uncertain'),
    id: fc.integer({ min: 0, max: 20 }),
  })
  .map(({ dimension, levelPick, weight, confidence, id }) => {
    const levels: Record<PrimaryDimension, string[]> = {
      reversibility: ['reversible', 'recoverable-with-effort', 'irreversible', 'unknown'],
      destructiveness: ['read-only', 'additive', 'mutating', 'deleting'],
      externalReach: ['local', 'org-internal', 'open-world', 'unknown'],
      idempotency: ['idempotent', 'non-idempotent', 'unknown'],
    };
    const pool = levels[dimension];
    const level = pool[levelPick % pool.length] as string;
    return { dimension, level, weight, confidence, source: { id: `e${id}`, weight: toSignalWeight(weight) } };
  });

describe('property — coverage monotonicity', () => {
  it('adding any contribution never moves a tool from assessed to unassessed', () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 8 }), contributionArb, (base, extra) => {
        const before = profileIsAssessed(compose(base));
        const after = profileIsAssessed(compose([...base, extra]));
        if (before) expect(after).toBe(true);
      }),
    );
  });
});

describe('property — no silent consistency', () => {
  it('an unassessed tool never carries an honesty finding (disjoint from every dishonesty bucket)', () => {
    const nameArb = fc.stringMatching(/^[a-z][a-z_]{2,20}$/);
    fc.assert(
      fc.property(fc.uniqueArray(nameArb, { minLength: 1, maxLength: 6 }), (names) => {
        const tools = names.map((name) =>
          tool({ name, inputSchema: { type: 'object', properties: { handle: { type: 'string' } } } }),
        );
        const m = manifestOf(tools);
        const classified = classifyManifest(m, VOCABULARY);
        expect(classified.ok).toBe(true);
        if (!classified.ok) return;
        const coverage = assessManifest(m, VOCABULARY, classified.value);
        const honestyTools = new Set(
          classified.value.filter((f) => f.ruleClass === 'honesty').map((f) => f.toolName),
        );
        for (const unassessed of coverage.unassessedToolNames) {
          expect(honestyTools.has(unassessed)).toBe(false);
        }
      }),
    );
  });
});

describe('property — comparator unchanged (the hasEvidence gate)', () => {
  const silentProfile = (): ActionRiskProfile => {
    const silent = <L extends string>(level: L): Dimension<L> => dim(level, 'uncertain');
    return {
      reversibility: silent('unknown'),
      destructiveness: silent('unknown'),
      externalReach: silent('unknown'),
      idempotency: silent('unknown'),
      blastRadius: silent('unknown'),
    };
  };
  const hintArb = fc.constantFrom(hint.true, hint.false, hint.absent);

  it('an all-unknown, empty-provenance derivation yields zero honesty findings for any declaration', () => {
    fc.assert(
      fc.property(hintArb, hintArb, hintArb, hintArb, (readOnly, destructive, openWorld, idempotent) => {
        const decl = declared({ readOnly, destructive, openWorld, idempotent });
        expect(classify(silentProfile(), decl)).toEqual([]);
      }),
    );
  });
});
