// Fixture: a PLANTED purity violation. A pure package must never import the filesystem —
// it breaks determinism. check-purity must fail on this file.
import { readFileSync } from 'node:fs';

export function loadVocabulary(): string {
  return readFileSync('./vocab.json', 'utf8');
}

// A second planted violation: a wall-clock read inside a scored value.
export const scannedAt = new Date().toISOString();
