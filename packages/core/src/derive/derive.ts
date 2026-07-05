// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// derive — the engine's single entry point. Pure mechanism applied to the vocabulary's judgment:
// gather evidence from every signal family, compose it conservatively, and return the profile with
// the signals that produced it. It reads ONLY its two inputs and returns ONLY a value: no clock, no
// network, no filesystem, no randomness, no model, no hidden state.
//
// It is declaration-blind: `tool.annotations` is never read here. The declared side is evidence to
// audit later (in classification), not an input to derive from — that separation is what makes the
// monotonicity guarantees ("you cannot sweet-talk the linter") hold.

import type { Vocabulary } from '@formael/action-risk-vocabulary';
import type { ToolDefinition } from '../manifest.ts';
import { compose } from './compose.ts';
import { descriptionSignals, nameSignals, schemaShapeSignals } from './extractors.ts';
import { type Contribution, type DerivationResult, dedupeSignals } from './types.ts';

/**
 * Derive a tool's honest action-risk profile from its name, description, and input schema, against
 * a vocabulary. Deterministic: the same `tool` yields byte-identical output every time.
 */
export function derive(tool: ToolDefinition, vocabulary: Vocabulary): DerivationResult {
  const contributions: readonly Contribution[] = [
    ...nameSignals(tool.name, vocabulary),
    ...descriptionSignals(tool.description, vocabulary),
    ...schemaShapeSignals(tool.inputSchema, vocabulary),
    // Intentionally absent: an annotation extractor. Derivation must not read `tool.annotations`.
  ];

  return {
    profile: compose(contributions),
    signals: dedupeSignals(contributions.map((c) => c.source)),
  };
}
