// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The derivation engine's public surface: the pure `derive` entry point, the per-family extractors
// (independently testable), the composer, and the blast-radius scorer.

export { scoreBlastRadius } from './blast-radius.ts';
export { compose } from './compose.ts';
export { derive } from './derive.ts';
export { descriptionSignals, nameSignals, schemaShapeSignals } from './extractors.ts';
export type { PrimaryDimension } from './primary-dimension.ts';
export type { Contribution, DerivationResult } from './types.ts';
