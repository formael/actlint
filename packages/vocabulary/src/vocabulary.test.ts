// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Acceptance spec for the vocabulary DATA. These tests are the executable contract: the seed
// dataset validates, a malformed entry is refused, every dimension the engine scores is covered
// (or is honestly noted as derived-only), and the JSON Schema and its Zod mirror agree.
//
// Kept pure: the JSON is loaded as modules, never read from the filesystem, so this file stays
// clean under the purity guard.

import { describe, expect, it } from 'vitest';

import vocabularySchemaJson from '../schema/vocabulary.schema.json' with { type: 'json' };
import {
  CROSSWALK,
  CROSSWALK_VERSION,
  MCP_MAPPING,
  MCP_MAPPING_VERSION,
  SEVERITY_POLICY,
  SEVERITY_POLICY_VERSION,
  VOCABULARY,
  VOCABULARY_VERSION,
  type VocabularyEntry,
  crosswalkSchema,
  destructivenessLevelSchema,
  externalReachLevelSchema,
  idempotencyLevelSchema,
  mcpMappingRowSchema,
  reversibilityLevelSchema,
  severityPolicySchema,
  standardsRefSchema,
  vocabularyConfidenceSchema,
  vocabularyEntrySchema,
  vocabularySchema,
  weightSchema,
} from './index.ts';

// A minimal, valid entry used as the base for malformed-input mutations.
const validEntry = {
  id: 'verb.example',
  signal: { kind: 'name-verb', match: ['frobnicate'] },
  contributes: { destructiveness: { level: 'mutating', weight: 'medium' } },
  evidence: 'An example entry used only by the test suite.',
  confidence: 'medium',
} as const;

const PRIMARY_DIMENSIONS = ['reversibility', 'destructiveness', 'externalReach', 'idempotency'] as const;

describe('seed vocabulary', () => {
  it('is a non-empty, versioned dataset', () => {
    expect(VOCABULARY.entries.length).toBeGreaterThan(0);
    expect(VOCABULARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every entry validates against the schema', () => {
    for (const entry of VOCABULARY.entries) {
      expect(vocabularyEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('entry ids are unique', () => {
    const ids = VOCABULARY.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every high-weight contribution carries a citation', () => {
    for (const entry of VOCABULARY.entries) {
      const highWeight = Object.values(entry.contributes).some((c) => c !== undefined && c.weight === 'high');
      if (highWeight) {
        expect(entry.citation, `entry ${entry.id} is high-weight and must cite a source`).toBeTruthy();
      }
    }
  });

  it('distinguishes name-verb from description-phrase signals (name weighted above prose)', () => {
    const kinds = new Set(VOCABULARY.entries.map((e) => e.signal.kind));
    expect(kinds.has('name-verb')).toBe(true);
    expect(kinds.has('description-phrase')).toBe(true);
  });
});

describe('malformed entries are refused', () => {
  it('rejects an entry missing its evidence', () => {
    const { evidence: _evidence, ...noEvidence } = validEntry;
    expect(vocabularyEntrySchema.safeParse(noEvidence).success).toBe(false);
  });

  it('rejects a high-weight contribution with no citation', () => {
    const highWeightNoCitation = {
      ...validEntry,
      contributes: { destructiveness: { level: 'deleting', weight: 'high' } },
    };
    expect(vocabularyEntrySchema.safeParse(highWeightNoCitation).success).toBe(false);
  });

  it('accepts the same high-weight contribution once a citation is added', () => {
    const cited = {
      ...validEntry,
      contributes: { destructiveness: { level: 'deleting', weight: 'high' } },
      citation: 'A real source.',
    };
    expect(vocabularyEntrySchema.safeParse(cited).success).toBe(true);
  });

  it('rejects an empty contributes object', () => {
    expect(vocabularyEntrySchema.safeParse({ ...validEntry, contributes: {} }).success).toBe(false);
  });

  it('rejects a contribution to the derived-only blastRadius dimension', () => {
    const contributesToComposite = {
      ...validEntry,
      contributes: { blastRadius: { level: 'critical', weight: 'medium' } },
    };
    expect(vocabularyEntrySchema.safeParse(contributesToComposite).success).toBe(false);
  });

  it('rejects an unknown signal kind', () => {
    const badKind = { ...validEntry, signal: { kind: 'name-token', match: ['x'] } };
    expect(vocabularyEntrySchema.safeParse(badKind).success).toBe(false);
  });
});

describe('dimension completeness', () => {
  it('every primary dimension is contributed to by at least one entry', () => {
    const covered = new Set<string>();
    for (const entry of VOCABULARY.entries) {
      for (const dim of Object.keys(entry.contributes)) covered.add(dim);
    }
    for (const dim of PRIMARY_DIMENSIONS) {
      expect(covered.has(dim), `no entry contributes to dimension "${dim}"`).toBe(true);
    }
  });

  it('no entry contributes to blastRadius — it is derived-only', () => {
    for (const entry of VOCABULARY.entries) {
      expect(Object.keys(entry.contributes)).not.toContain('blastRadius');
    }
  });
});

describe('lexicon limits are documented, not hidden', () => {
  it('records its known gaps', () => {
    expect(VOCABULARY.limitations?.length ?? 0).toBeGreaterThan(0);
  });

  it('names the non-English / alias gap explicitly', () => {
    const text = (VOCABULARY.limitations ?? []).join(' ').toLowerCase();
    expect(text).toContain('non-english');
    expect(text).toContain('alias');
  });
});

describe('MCP-hint mapping', () => {
  it('is a non-empty, versioned dataset', () => {
    expect(MCP_MAPPING.mappings.length).toBeGreaterThan(0);
    expect(MCP_MAPPING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('covers all five dimensions', () => {
    const dims = new Set(MCP_MAPPING.mappings.map((m) => m.dimension));
    for (const dim of [...PRIMARY_DIMENSIONS, 'blastRadius']) {
      expect(dims.has(dim as (typeof MCP_MAPPING.mappings)[number]['dimension'])).toBe(true);
    }
  });

  it('raises a verdict exactly where an MCP hint exists', () => {
    for (const row of MCP_MAPPING.mappings) {
      expect(row.raisesVerdict).toBe(row.mcpHint !== null);
    }
  });

  it('treats reversibility and blastRadius as supporting context only', () => {
    for (const dim of ['reversibility', 'blastRadius'] as const) {
      const rows = MCP_MAPPING.mappings.filter((m) => m.dimension === dim);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.mcpHint).toBeNull();
        expect(row.raisesVerdict).toBe(false);
      }
    }
  });

  it('rejects a row that claims a verdict without a backing hint', () => {
    const phantom = {
      mcpHint: null,
      dimension: 'reversibility',
      raisesVerdict: true,
      correspondence: 'no corresponding MCP hint',
      note: 'invalid: a verdict with no hint to be honest about',
    };
    expect(mcpMappingRowSchema.safeParse(phantom).success).toBe(false);
  });
});

// Data-layer guards: one test per fixture scenario, each naming a representative tool.
describe('ratification fixtures — data-layer guards', () => {
  const byId = new Map(VOCABULARY.entries.map((e) => [e.id, e]));

  const getEntry = (id: string): VocabularyEntry => {
    const e = byId.get(id);
    if (!e) throw new Error(`entry not found in vocabulary: ${id}`);
    return e;
  };

  const verbMatch = (id: string): readonly string[] => {
    const e = getEntry(id);
    if (e.signal.kind !== 'name-verb') throw new Error(`${id} is not a name-verb entry`);
    return e.signal.match;
  };

  const paramNames = (id: string): readonly string[] => {
    const e = getEntry(id);
    if (e.signal.kind !== 'schema-shape') throw new Error(`${id} is not a schema-shape entry`);
    return (e.signal.match as { paramNameMatches?: string[] }).paramNameMatches ?? [];
  };

  it('search_web(query): query absent from freeform-code-input — launch-critical FP guard', () => {
    expect(paramNames('shape.freeform-code-input')).not.toContain('query');
  });

  it('copy_file(source,destination): to/destination/address absent from every paramNameMatches', () => {
    for (const entry of VOCABULARY.entries) {
      if (entry.signal.kind !== 'schema-shape') continue;
      const pn = (entry.signal.match as { paramNameMatches?: string[] }).paramNameMatches ?? [];
      expect(pn, `entry ${entry.id}`).not.toContain('to');
      expect(pn, `entry ${entry.id}`).not.toContain('destination');
      expect(pn, `entry ${entry.id}`).not.toContain('address');
    }
  });

  it('send_email(to): verb.send covers open-world at high weight — dropped param names cost nothing', () => {
    const e = getEntry('verb.send');
    expect(e.contributes.externalReach?.level).toBe('open-world');
    expect(e.contributes.externalReach?.weight).toBe('high');
  });

  it('create_contact(email): shape.destination-param-name holds email at medium — accepted FP cost', () => {
    expect(paramNames('shape.destination-param-name')).toContain('email');
    expect(getEntry('shape.destination-param-name').contributes.externalReach?.weight).toBe('medium');
  });

  it('run_shell_command(command)+destructiveHint:false: freeform-code-input matches command at medium', () => {
    expect(paramNames('shape.freeform-code-input')).toContain('command');
    expect(getEntry('shape.freeform-code-input').contributes.destructiveness?.weight).toBe('medium');
  });

  it('submit_verification(code): code is in freeform-code-input watch list', () => {
    expect(paramNames('shape.freeform-code-input')).toContain('code');
  });

  it('pay_invoice: verb.payment claims irreversible at high weight and non-idempotent', () => {
    const e = getEntry('verb.payment');
    expect(e.contributes.reversibility?.level).toBe('irreversible');
    expect(e.contributes.reversibility?.weight).toBe('high');
    expect(e.contributes.idempotency?.level).toBe('non-idempotent');
    expect(e.citation).toBeTruthy();
  });

  it('transfer_file: verb.transfer matches only bare transfer — medium-weight, no high-confidence irreversibility', () => {
    const e = getEntry('verb.transfer');
    expect([...verbMatch('verb.transfer')]).toEqual(['transfer']);
    expect(e.contributes.reversibility?.weight).not.toBe('high');
    expect(e.confidence).toBe('medium');
  });

  it('deactivate_user: deactivate is in verb.mutate, not verb.delete', () => {
    expect(verbMatch('verb.mutate')).toContain('deactivate');
    expect(verbMatch('verb.delete')).not.toContain('deactivate');
  });

  it('cancel_job: cancel is in verb.mutate, not verb.delete', () => {
    expect(verbMatch('verb.mutate')).toContain('cancel');
    expect(verbMatch('verb.delete')).not.toContain('cancel');
  });

  it('find_and_delete: verb.delete is deleting/high; verb.read is read-only/high — composer must not let read suppress delete', () => {
    const del = getEntry('verb.delete');
    const read = getEntry('verb.read');
    expect(verbMatch('verb.delete')).toContain('delete');
    expect(del.contributes.destructiveness?.level).toBe('deleting');
    expect(del.contributes.destructiveness?.weight).toBe('high');
    expect(verbMatch('verb.read')).toContain('find');
    expect(read.contributes.destructiveness?.level).toBe('read-only');
    expect(read.contributes.destructiveness?.weight).toBe('high');
  });

  it('query exclusion is recorded in limitations', () => {
    expect((VOCABULARY.limitations ?? []).join(' ').toLowerCase()).toContain('query');
  });

  it('negation blindness is documented in limitations', () => {
    expect((VOCABULARY.limitations ?? []).join(' ').toLowerCase()).toContain('negat');
  });
});

describe('standards crosswalk', () => {
  it('is a non-empty, versioned dataset', () => {
    expect(Object.keys(CROSSWALK.map).length).toBeGreaterThan(0);
    expect(CROSSWALK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every entry cites at least one external standard or MCP field', () => {
    for (const [ruleId, ref] of Object.entries(CROSSWALK.map)) {
      expect(standardsRefSchema.safeParse(ref).success, `crosswalk entry ${ruleId}`).toBe(true);
    }
  });

  it('carries the relevant-not-prescriptive caveat in the data', () => {
    expect((CROSSWALK.note ?? '').toLowerCase()).toContain('relevant, not prescriptive');
  });

  it('rejects an entry with every standards array empty', () => {
    expect(
      standardsRefSchema.safeParse({
        owaspAsi: [],
        owaspMcp: [],
        cosaiOasis: [],
        euAiAct: [],
        nist: [],
        mcpField: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an entry with no fields at all', () => {
    expect(standardsRefSchema.safeParse({}).success).toBe(false);
  });

  it('the whole crosswalk satisfies its top-level schema', () => {
    expect(crosswalkSchema.safeParse(CROSSWALK).success).toBe(true);
  });
});

describe('severity policy', () => {
  it('is a versioned dataset that maps every verdict', () => {
    expect(SEVERITY_POLICY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    for (const verdict of ['under-declared', 'undeclared', 'over-declared', 'consistent'] as const) {
      expect(SEVERITY_POLICY.byVerdict[verdict]).toBeTruthy();
    }
  });

  it('reserves critical for the under-declared verdict (the asymmetry, as data)', () => {
    expect(SEVERITY_POLICY.byVerdict['under-declared']).toBe('critical');
    expect(SEVERITY_POLICY.byVerdict.undeclared).toBe('low');
    expect(SEVERITY_POLICY.byVerdict['over-declared']).toBe('low');
  });

  it('steps confidence down, never up (uncertain and low are negative; certain are zero)', () => {
    expect(SEVERITY_POLICY.confidenceAdjust.uncertain).toBeLessThan(0);
    expect(SEVERITY_POLICY.confidenceAdjust.low).toBeLessThan(0);
    expect(SEVERITY_POLICY.confidenceAdjust.medium).toBe(0);
    expect(SEVERITY_POLICY.confidenceAdjust.high).toBe(0);
    expect(SEVERITY_POLICY.confidenceAdjust.uncertain).toBeLessThan(SEVERITY_POLICY.confidenceAdjust.low);
  });

  it('the whole policy satisfies its top-level schema', () => {
    expect(severityPolicySchema.safeParse(SEVERITY_POLICY).success).toBe(true);
  });
});

// The published JSON Schema and the Zod validator must agree on their enums, or an external
// contributor validating against the JSON Schema would get a different answer than actlint's CI.
describe('JSON Schema and Zod mirror agree', () => {
  const defs = (vocabularySchemaJson as { $defs: Record<string, { enum?: readonly string[] }> }).$defs;

  const cases: readonly [string, string, readonly string[]][] = [
    ['reversibilityLevel', 'reversibility', reversibilityLevelSchema.options],
    ['destructivenessLevel', 'destructiveness', destructivenessLevelSchema.options],
    ['externalReachLevel', 'externalReach', externalReachLevelSchema.options],
    ['idempotencyLevel', 'idempotency', idempotencyLevelSchema.options],
    ['weight', 'weight', weightSchema.options],
    ['confidence', 'confidence', vocabularyConfidenceSchema.options],
  ];

  it.each(cases)('the %s enum matches', (defName, _label, zodOptions) => {
    const jsonEnum = defs[defName]?.enum ?? [];
    expect([...jsonEnum].sort()).toEqual([...zodOptions].sort());
  });

  it('the whole seed dataset satisfies the top-level Zod schema', () => {
    expect(vocabularySchema.safeParse(VOCABULARY).success).toBe(true);
  });
});
