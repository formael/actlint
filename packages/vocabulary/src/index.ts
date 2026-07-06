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

import rawCrosswalk from '../data/crosswalk.json' with { type: 'json' };
import rawGradePolicy from '../data/grade-policy.json' with { type: 'json' };
import rawMcpMapping from '../data/mcp-mapping.json' with { type: 'json' };
import rawSeverityPolicy from '../data/severity-policy.json' with { type: 'json' };
import rawVocabulary from '../data/vocabulary.json' with { type: 'json' };
import {
  type Crosswalk,
  type GradePolicy,
  type McpMapping,
  parseCrosswalk,
  parseGradePolicy,
  parseMcpMapping,
  parseSeverityPolicy,
  parseVocabulary,
  type SeverityPolicy,
  type Vocabulary,
} from './schema.ts';

/** The npm package name — the action-risk vocabulary, published as independently versioned data any tool can consume. */
export const VOCABULARY_PACKAGE = '@formael/action-risk-vocabulary';

/** The validated action-risk vocabulary: the tool's judgment, as evidence-backed data. */
export const VOCABULARY: Vocabulary = Object.freeze(parseVocabulary(rawVocabulary));

/** The validated mapping from actlint's five dimensions onto MCP's four annotation booleans. */
export const MCP_MAPPING: McpMapping = Object.freeze(parseMcpMapping(rawMcpMapping));

/** Semver of the vocabulary dataset — an independent line from the engine and report-schema versions. */
export const VOCABULARY_VERSION: string = VOCABULARY.version;

/** Semver of the MCP-hint mapping dataset. */
export const MCP_MAPPING_VERSION: string = MCP_MAPPING.version;

/**
 * The validated standards & regulatory crosswalk: each RuleId → the external frameworks it is
 * relevant to. Consumed by the engine, whose makeFinding refuses to build a finding whose RuleId
 * has no entry here.
 */
export const CROSSWALK: Crosswalk = Object.freeze(parseCrosswalk(rawCrosswalk));

/** Semver of the crosswalk dataset — an independent line from the vocabulary and engine versions. */
export const CROSSWALK_VERSION: string = CROSSWALK.version;

/**
 * The validated severity policy: the reviewable table the engine reads to compute a finding's
 * severity from its verdict, rule class, and confidence. Severity is never hand-assigned.
 */
export const SEVERITY_POLICY: SeverityPolicy = Object.freeze(parseSeverityPolicy(rawSeverityPolicy));

/** Semver of the severity policy dataset — versioned alongside the crosswalk. */
export const SEVERITY_POLICY_VERSION: string = SEVERITY_POLICY.version;

/**
 * The validated honesty-grade policy: the reviewable bands and weights the reporters read to
 * reduce a server's findings to a single letter. It grades labelling honesty, never safety.
 */
export const GRADE_POLICY: GradePolicy = Object.freeze(parseGradePolicy(rawGradePolicy));

/** Semver of the grade policy dataset — an independent line, like the severity policy and crosswalk. */
export const GRADE_POLICY_VERSION: string = GRADE_POLICY.version;

// Re-export the schemas, inferred types, and validators for consumers and tests.
export * from './schema.ts';
