// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsup';
import { definePackageBuild } from '../../tsup.config.base';

// The CLI ships an executable entry; tsup preserves the shebang from src/index.ts.
//
// `actlint` bundles its workspace siblings (the pure engine, the reporters, the impure fetch
// boundary) and zod into the one file, so the internal packages are never published — the only
// supported import surfaces are the vocabulary package and the `--json` report, and the engine is
// never a public npm dependency someone can pin against.
//
// The MCP SDK is deliberately left external and declared as `actlint`'s sole runtime dependency:
// its stdio transport pulls CJS transitives (cross-spawn) that cannot be inlined into an ESM
// single file, and it is a real third-party dependency, not an actlint seam. One honest dependency
// beats a fragile mega-bundle.
export default defineConfig(
  definePackageBuild({
    noExternal: [/^@formael\//, 'zod'],
  }),
);
