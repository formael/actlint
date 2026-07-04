// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core/contracts — the anti-corruption boundary.
// This sub-path exposes ONLY the shared, SDK-independent manifest types that mcp-fetch
// produces and core consumes. mcp-fetch may import from here and nowhere else in core, so
// SDK shapes never leak into the pure engine.
export const CONTRACTS_SURFACE = '@formael/actlint-core/contracts';
