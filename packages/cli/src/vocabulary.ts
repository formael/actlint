// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Vocabulary loading. The default is the bundled, validated dataset; `--vocabulary <path>` pins a
// specific version by reading and validating an alternate dataset from disk. The crosswalk stays
// bundled — `--vocabulary` pins the risk judgment, not the standards mapping. Whichever dataset is
// used, its version travels onto the ServerResult so a report records exactly which judgment produced
// it.

import { readFileSync } from 'node:fs';
import {
  CROSSWALK_VERSION,
  parseVocabulary,
  VOCABULARY,
  VOCABULARY_VERSION,
  type Vocabulary,
} from '@formael/action-risk-vocabulary';
import { type CliError, usageError } from './exit-codes.ts';

export interface LoadedVocabulary {
  readonly vocabulary: Vocabulary;
  readonly vocabularyVersion: string;
  readonly crosswalkVersion: string;
}

type LoadResult =
  | { readonly ok: true; readonly loaded: LoadedVocabulary }
  | { readonly ok: false; readonly error: CliError };

const bundled: LoadedVocabulary = {
  vocabulary: VOCABULARY,
  vocabularyVersion: VOCABULARY_VERSION,
  crosswalkVersion: CROSSWALK_VERSION,
};

/**
 * The vocabulary for this run. With no pin, the bundled dataset. With a pin, the dataset at `path`,
 * validated against the vocabulary schema — a malformed or unreadable pin is a usage error (exit 2),
 * because the pin is configuration the user supplied, not a server they asked to look at.
 */
export function loadVocabulary(path: string | undefined): LoadResult {
  if (path === undefined) return { ok: true, loaded: bundled };

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, error: usageError(`could not read vocabulary file: ${path}`) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: usageError(`vocabulary file is not valid JSON: ${path}`) };
  }

  try {
    const vocabulary = parseVocabulary(parsed);
    return {
      ok: true,
      loaded: { vocabulary, vocabularyVersion: vocabulary.version, crosswalkVersion: CROSSWALK_VERSION },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: usageError(`vocabulary file is not a valid vocabulary: ${detail}`) };
  }
}
