// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsup';
import { definePackageBuild } from '../../tsup.config.base';

// Two entry points: the main pure API (`.`) and the shared manifest types (`./contracts`),
// the only surface mcp-fetch is permitted to import.
export default defineConfig(definePackageBuild({ entry: ['src/index.ts', 'src/contracts/index.ts'] }));
