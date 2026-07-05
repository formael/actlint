// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The extractors — one small, stateless function per signal family. Each reads one facet of a
// tool (its name, its description, its input schema) and emits weighted `Contribution`s against
// dimensions, tagged with the vocabulary entry that fired.
//
// There is deliberately NO annotation extractor. Reading `tool.annotations` here would let a
// declaration bias the derivation and quietly defeat the monotonicity guarantees — derivation is
// declaration-blind by construction. The declared side is audited later, never derived from.

import type { SchemaShapeMatch, Vocabulary, VocabularyEntry } from '@formael/action-risk-vocabulary';
import type { JsonSchema } from '../manifest.ts';
import type { PrimaryDimension } from './primary-dimension.ts';
import { type SchemaParam, collectParams } from './schema-reader.ts';
import { phraseOccurs, tokenSet } from './tokenize.ts';
import { type Contribution, toSignalWeight } from './types.ts';

// Expand an entry's `contributes` block into one Contribution per dimension it argues for.
function contributionsOf(entry: VocabularyEntry): Contribution[] {
  const out: Contribution[] = [];
  for (const [dimension, claim] of Object.entries(entry.contributes)) {
    if (claim === undefined) continue;
    out.push({
      dimension: dimension as PrimaryDimension,
      level: claim.level,
      weight: claim.weight,
      confidence: entry.confidence,
      source: { id: entry.id, weight: toSignalWeight(claim.weight) },
    });
  }
  return out;
}

/**
 * Name signals — the terse, intentional, high-value evidence. A tool named `delete_account` is a
 * strong argument; matching is exact-token, so `undelete` does not match `delete` and a verb is
 * never found as a coincidental substring.
 */
export function nameSignals(name: string, vocabulary: Vocabulary): readonly Contribution[] {
  const tokens = tokenSet(name);
  const out: Contribution[] = [];
  for (const entry of vocabulary.entries) {
    if (entry.signal.kind !== 'name-verb') continue;
    if (entry.signal.match.some((verb) => tokens.has(verb.toLowerCase()))) {
      out.push(...contributionsOf(entry));
    }
  }
  return out;
}

/**
 * Description signals — low-weight, supporting evidence only. Prose is ambiguous (a negated
 * "does not permanently delete" still contains the phrase), so these corroborate a name/schema
 * signal but rarely originate a high-confidence finding. Read by fixed tokenization, never a model.
 */
export function descriptionSignals(
  description: string | undefined,
  vocabulary: Vocabulary,
): readonly Contribution[] {
  if (description === undefined || description.length === 0) return [];
  const out: Contribution[] = [];
  for (const entry of vocabulary.entries) {
    if (entry.signal.kind !== 'description-phrase') continue;
    if (entry.signal.match.some((phrase) => phraseOccurs(description, phrase))) {
      out.push(...contributionsOf(entry));
    }
  }
  return out;
}

// Does a parameter's name match a listed name? A hit is either an exact match on the full
// lowercased name (so `callback_url` matches the listed `callback_url`) or a match on one of its
// tokens (so `redirectUri` matches `uri`). Structure over substring: `account` never matches `count`.
function paramNameHit(param: SchemaParam, names: readonly string[]): boolean {
  const lowerName = param.name.toLowerCase();
  const tokens = tokenSet(param.name);
  return names.some((candidate) => {
    const lower = candidate.toLowerCase();
    return lower === lowerName || tokens.has(lower);
  });
}

function schemaShapeFires(match: SchemaShapeMatch, params: readonly SchemaParam[]): boolean {
  if (match.paramNameMatches !== undefined) {
    const names = match.paramNameMatches;
    const requireFreeform = match.unconstrained === true;
    if (params.some((p) => paramNameHit(p, names) && (!requireFreeform || p.isFreeformString))) {
      return true;
    }
  }
  if (match.stringFormatMatches !== undefined) {
    const formats = match.stringFormatMatches.map((f) => f.toLowerCase());
    if (params.some((p) => p.format !== undefined && formats.includes(p.format.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

/**
 * Schema-shape signals — the highest-signal, language-independent evidence, because the input
 * schema is structured data. Fires on a walked, typed view of the schema: a nested destination
 * field or free-form code parameter is found; a coincidental substring is not.
 */
export function schemaShapeSignals(schema: JsonSchema, vocabulary: Vocabulary): readonly Contribution[] {
  const params = collectParams(schema);
  const out: Contribution[] = [];
  for (const entry of vocabulary.entries) {
    if (entry.signal.kind !== 'schema-shape') continue;
    if (schemaShapeFires(entry.signal.match, params)) {
      out.push(...contributionsOf(entry));
    }
  }
  return out;
}
