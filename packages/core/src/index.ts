// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core — PURE.
// The functional core: (ToolManifest + Vocabulary) -> ActionRiskProfile -> Finding[].
// No clock, network, fs, randomness, or model call ever appears here — the banned-import
// guard (scripts/check-purity.ts) enforces it.
export const CORE_PACKAGE = '@formael/actlint-core';
