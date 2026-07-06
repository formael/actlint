// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// CI entry. Fails the build if the MCP SDK is imported anywhere but mcp-fetch.
// Run via `pnpm guard:sdk`.

import { reportGuard } from './guards/report';
import { checkSdkBoundary, SDK_FORBIDDEN_ROOTS } from './guards/sdk-boundary';

process.exit(reportGuard('check-sdk-boundary', checkSdkBoundary(SDK_FORBIDDEN_ROOTS)));
