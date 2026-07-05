// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/action-risk-vocabulary — PURE DATA.
// The versioned action-risk vocabulary and the MCP-hint mapping, validated at load. This is the
// base layer: it depends on nothing internal, and it carries no scoring, walking, or composition
// mechanism — that judgment-into-profile machinery lives in the engine (packages/core).
//
// The canonical artifacts are the reviewable JSON files in `../data`, validated here against the
// JSON Schemas' Zod mirror so a malformed dataset fails loudly at import rather than silently
// downstream.

import rawMcpMapping from '../data/mcp-mapping.json' with { type: 'json' };
import rawVocabulary from '../data/vocabulary.json' with { type: 'json' };
import { type McpMapping, type Vocabulary, parseMcpMapping, parseVocabulary } from './schema.ts';

/** The npm package name — the single shared artifact between actlint (open) and the Formael platform. */
export const VOCABULARY_PACKAGE = '@formael/action-risk-vocabulary';

/** The validated action-risk vocabulary: the tool's judgment, as evidence-backed data. */
export const VOCABULARY: Vocabulary = Object.freeze(parseVocabulary(rawVocabulary));

/** The validated mapping from actlint's five dimensions onto MCP's four annotation booleans. */
export const MCP_MAPPING: McpMapping = Object.freeze(parseMcpMapping(rawMcpMapping));

/** Semver of the vocabulary dataset — an independent line from the engine and report-schema versions. */
export const VOCABULARY_VERSION: string = VOCABULARY.version;

/** Semver of the MCP-hint mapping dataset. */
export const MCP_MAPPING_VERSION: string = MCP_MAPPING.version;

// Re-export the schemas, inferred types, and validators for consumers and tests.
export * from './schema.ts';
