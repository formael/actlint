// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The four *sensed* dimensions an extractor may argue for. `blastRadius` is deliberately
// excluded: it is a composite the engine computes, never a level a signal asserts directly.
//
// Re-exported from the vocabulary package (the base data layer) so the engine and the data
// share one definition — a signal can only contribute to a dimension the schema also permits.

export type { PrimaryDimension } from '@formael/action-risk-vocabulary';
