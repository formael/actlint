// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Fixed, documented tokenization — the whole of the engine's natural-language handling.
//
// This is the single most important "what we don't do": prose is read by these small,
// deterministic string functions and NEVER by a model. A skeptic can reproduce every match
// by hand. The moment a finding depended on an LLM reading a description, the scorecard would
// stop being reproducible and the trust argument would collapse.

// Split a camelCase/PascalCase boundary and an acronym boundary, so `deleteAccount` and
// `listHTTPServers` tokenize the way a reader expects.
function splitCamelCase(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // fooBar -> foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // HTTPServer -> HTTP Server
}

/**
 * Tokenize a name into lowercase word tokens. Separators (`_`, `-`, `.`, `/`, whitespace) and
 * camelCase boundaries all split; runs of punctuation collapse. `exec_sql` → `['exec', 'sql']`,
 * `deleteAccount` → `['delete', 'account']`.
 */
export function tokenize(text: string): string[] {
  return splitCamelCase(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** The distinct tokens of a name, for exact-token membership checks. */
export function tokenSet(text: string): ReadonlySet<string> {
  return new Set(tokenize(text));
}

// Collapse a string to lowercase words separated by single spaces, padded with one leading and
// trailing space. Padding lets a phrase check assert word boundaries with a plain `includes`.
function normalizeProse(text: string): string {
  const collapsed = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${collapsed} `;
}

/**
 * Does `phrase` occur in `text` on word boundaries? Both are normalized to lowercase words, so
 * `"permanently delete"` matches `"This will permanently delete the row."` but a phrase is never
 * matched mid-word. Multi-word phrases are supported; matching is a substring test on the
 * space-normalized, boundary-padded forms — deterministic and model-free.
 */
export function phraseOccurs(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeProse(phrase).trim();
  if (normalizedPhrase.length === 0) return false;
  return normalizeProse(text).includes(` ${normalizedPhrase} `);
}
