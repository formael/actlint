// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { phraseOccurs, tokenize, tokenSet } from './tokenize.ts';

describe('tokenize', () => {
  it('splits snake_case, kebab-case, dots and slashes', () => {
    expect(tokenize('exec_sql')).toEqual(['exec', 'sql']);
    expect(tokenize('delete-account')).toEqual(['delete', 'account']);
    expect(tokenize('db.drop.table')).toEqual(['db', 'drop', 'table']);
  });

  it('splits camelCase and acronym boundaries', () => {
    expect(tokenize('deleteAccount')).toEqual(['delete', 'account']);
    expect(tokenize('listHTTPServers')).toEqual(['list', 'http', 'servers']);
  });

  it('lowercases and drops empty tokens', () => {
    expect(tokenize('  Send__Email  ')).toEqual(['send', 'email']);
    expect(tokenize('')).toEqual([]);
  });

  it('does not find a verb as a coincidental substring', () => {
    // `account` contains "count", but tokens are whole words: no `count` token is produced.
    expect(tokenSet('get_account').has('count')).toBe(false);
    expect(tokenSet('get_account').has('get')).toBe(true);
  });
});

describe('phraseOccurs', () => {
  it('matches a multi-word phrase on word boundaries', () => {
    expect(phraseOccurs('This will permanently delete the row.', 'permanently delete')).toBe(true);
    expect(phraseOccurs('Reads a value.', 'permanently delete')).toBe(false);
  });

  it('matches regardless of surrounding punctuation and case', () => {
    expect(phraseOccurs('Warning: THIS CANNOT BE UNDONE!', 'cannot be undone')).toBe(true);
  });

  it('does not match a phrase mid-word', () => {
    expect(phraseOccurs('undoneness is not a word', 'undone')).toBe(false);
  });

  it('still matches inside a negation — why prose is only weak, supporting evidence', () => {
    // The tokenizer cannot see negation; a negated sentence still contains the phrase. This is the
    // documented reason description signals are low-weight and never originate high confidence.
    expect(phraseOccurs('This does not permanently delete anything.', 'permanently delete')).toBe(true);
  });
});
