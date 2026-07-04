// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The determinism guard.
//
// Once packages/core exposes a pure pipeline, this runs the fixture corpus twice and asserts
// the serialized findings are byte-for-byte identical (and, in CI, identical across Node 22
// and 24). The pure engine does not exist yet, so this is an honest no-op scaffold.

export interface DeterminismResult {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly reason: string;
}

// TODO: replace this scaffold once core.run(manifest, vocabulary) exists. Load every fixture,
// run it twice, JSON-serialize both finding sets with stable key ordering, and assert byte-equality.
export function checkDeterminism(): DeterminismResult {
  return {
    ok: true,
    skipped: true,
    reason: 'no-op scaffold: the pure core pipeline does not exist yet',
  };
}
