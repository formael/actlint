// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsup';
import { definePackageBuild } from '../../tsup.config.base';

// The CLI ships an executable entry; tsup preserves the shebang from src/index.ts.
export default defineConfig(definePackageBuild());
