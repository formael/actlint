// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// CI entry. Fails the build if a pure package reaches for a clock, network,
// filesystem, process, or randomness source. Run via `pnpm guard:purity`.

import { PURE_ROOTS, checkPurity } from './guards/purity';
import { reportGuard } from './guards/report';

process.exit(reportGuard('check-purity', checkPurity(PURE_ROOTS)));
