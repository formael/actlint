// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { parseVocabulary, type Vocabulary } from '@formael/action-risk-vocabulary';
import { describe, expect, it } from 'vitest';

import type { JsonSchema } from '../manifest.ts';
import * as extractors from './extractors.ts';
import { descriptionSignals, nameSignals, schemaShapeSignals } from './extractors.ts';
import type { Contribution } from './types.ts';

// A small, controlled vocabulary so each extractor is tested against known entries in isolation.
const vocab: Vocabulary = parseVocabulary({
  version: '0.0.0',
  entries: [
    {
      id: 'verb.read',
      signal: { kind: 'name-verb', match: ['get', 'list'] },
      contributes: { destructiveness: { level: 'read-only', weight: 'high' } },
      evidence: 'retrieval verbs read state',
      citation: 'test',
      confidence: 'high',
    },
    {
      id: 'verb.delete',
      signal: { kind: 'name-verb', match: ['delete', 'remove'] },
      contributes: {
        destructiveness: { level: 'deleting', weight: 'high' },
        reversibility: { level: 'irreversible', weight: 'medium' },
      },
      evidence: 'deletion verbs remove state',
      citation: 'test',
      confidence: 'high',
    },
    {
      id: 'phrase.deletion',
      signal: { kind: 'description-phrase', match: ['permanently delete'] },
      contributes: { destructiveness: { level: 'deleting', weight: 'low' } },
      evidence: 'prose weakly supports deletion',
      confidence: 'low',
    },
    {
      id: 'shape.destination-format',
      signal: { kind: 'schema-shape', match: { stringFormatMatches: ['uri', 'email'] } },
      contributes: { externalReach: { level: 'open-world', weight: 'high' } },
      evidence: 'a declared destination format reaches outward',
      citation: 'test',
      confidence: 'high',
    },
    {
      id: 'shape.freeform',
      signal: { kind: 'schema-shape', match: { paramNameMatches: ['sql', 'command'], unconstrained: true } },
      contributes: { destructiveness: { level: 'mutating', weight: 'medium' } },
      evidence: 'free-form code input can drive arbitrary behavior',
      confidence: 'medium',
    },
    {
      id: 'shape.dest-name',
      signal: { kind: 'schema-shape', match: { paramNameMatches: ['webhook', 'url'] } },
      contributes: { externalReach: { level: 'open-world', weight: 'medium' } },
      evidence: 'a destination-shaped name reaches outward',
      confidence: 'medium',
    },
  ],
});

const ids = (cs: readonly Contribution[]): string[] => [...new Set(cs.map((c) => c.source.id))].sort();
const obj = (props: Record<string, unknown>): JsonSchema => ({ type: 'object', properties: props });

describe('the engine has no annotation extractor (declaration-blind by construction)', () => {
  it('exports only the three declaration-blind signal families', () => {
    expect(Object.keys(extractors).sort()).toEqual([
      'descriptionSignals',
      'nameSignals',
      'schemaShapeSignals',
    ]);
  });
});

describe('nameSignals', () => {
  it('fires on an exact verb token, mapping every contribution the entry argues', () => {
    const cs = nameSignals('delete_account', vocab);
    expect(ids(cs)).toEqual(['verb.delete']);
    const destructiveness = cs.find((c) => c.dimension === 'destructiveness');
    expect(destructiveness).toMatchObject({ level: 'deleting', weight: 'high', confidence: 'high' });
    expect(destructiveness?.source.weight).toBe('definitive');
    expect(cs.find((c) => c.dimension === 'reversibility')).toMatchObject({
      level: 'irreversible',
      source: { weight: 'strong' },
    });
  });

  it('does not match a prefixed verb (exact tokens only)', () => {
    expect(nameSignals('undelete_thing', vocab)).toEqual([]);
  });

  it('matches camelCase tokens', () => {
    expect(ids(nameSignals('getRecord', vocab))).toEqual(['verb.read']);
  });
});

describe('descriptionSignals', () => {
  it('returns nothing for an absent description', () => {
    expect(descriptionSignals(undefined, vocab)).toEqual([]);
  });

  it('fires on a phrase match and ignores name-verb entries entirely', () => {
    const cs = descriptionSignals('This will permanently delete the row.', vocab);
    expect(ids(cs)).toEqual(['phrase.deletion']);
    expect(cs[0]).toMatchObject({ dimension: 'destructiveness', level: 'deleting', weight: 'low' });
  });
});

describe('schemaShapeSignals', () => {
  it('fires the destination-format signal on a declared string format', () => {
    const cs = schemaShapeSignals(obj({ to: { type: 'string', format: 'email' } }), vocab);
    expect(ids(cs)).toEqual(['shape.destination-format']);
  });

  it('fires the free-form signal only for an unconstrained code parameter', () => {
    expect(ids(schemaShapeSignals(obj({ sql: { type: 'string' } }), vocab))).toEqual(['shape.freeform']);
    // The same name, but constrained by an enum, is NOT free-form.
    expect(schemaShapeSignals(obj({ sql: { type: 'string', enum: ['a'] } }), vocab)).toEqual([]);
  });

  it('matches a destination name by token, not by coincidental substring', () => {
    // `webhook` matches; `curl_opts` tokenizes to [curl, opts] and never matches `url`.
    expect(ids(schemaShapeSignals(obj({ webhook: { type: 'string' } }), vocab))).toEqual(['shape.dest-name']);
    expect(schemaShapeSignals(obj({ curl_opts: { type: 'string' } }), vocab)).toEqual([]);
  });
});
