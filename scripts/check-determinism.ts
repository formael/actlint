// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// CI entry. A no-op scaffold until the pure core pipeline exists; then it asserts
// byte-identical serialized findings across two runs. Run via `pnpm guard:determinism`.

import { checkDeterminism } from './guards/determinism';

const result = checkDeterminism();
if (result.skipped) {
  process.stdout.write(`• check-determinism: SKIPPED — ${result.reason}\n`);
} else if (result.ok) {
  process.stdout.write('✓ check-determinism: byte-identical across runs\n');
} else {
  process.stderr.write(`✗ check-determinism: ${result.reason}\n`);
}
process.exit(result.ok ? 0 : 1);
