// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The derivation engine's public surface: the pure `derive` entry point, the per-family extractors
// (independently testable), the composer, and the blast-radius scorer.

export { derive } from './derive.ts';
export { compose } from './compose.ts';
export { scoreBlastRadius } from './blast-radius.ts';
export { nameSignals, descriptionSignals, schemaShapeSignals } from './extractors.ts';
export type { Contribution, DerivationResult } from './types.ts';
export type { PrimaryDimension } from './primary-dimension.ts';
