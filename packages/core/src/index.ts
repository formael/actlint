// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core — PURE.
// The functional core: (ToolManifest + Vocabulary) -> ActionRiskProfile -> Finding[].
// No clock, network, fs, randomness, or model call ever appears here — the banned-import
// guard (scripts/check-purity.ts) enforces it.

export type { MakeFindingInput, RawFinding } from './classify/index.ts';
// Classification (derived vs declared -> Verdict -> Finding, via the makeFinding gate)
export {
  ADVISORY_RULES,
  ALL_RULE_IDS,
  advisories,
  assessManifest,
  classify,
  classifyManifest,
  classifyTool,
  computeSeverity,
  HONESTY_RULES,
  lookupStandards,
  makeFinding,
  missingCrosswalkEntries,
  RULE,
  ruleClassOf,
} from './classify/index.ts';
export type { DeclaredHint, DeclaredProfile, EffectiveDeclaredValue, McpHintDefault } from './declared.ts';
// Declared side (what the tool claims)
export {
  declaredHintSchema,
  declaredProfileSchema,
  effectiveDeclaredValue,
  MCP_HINT_DEFAULTS,
} from './declared.ts';
export type { Contribution, DerivationResult, PrimaryDimension } from './derive/index.ts';
// Derivation engine (ToolDefinition + Vocabulary -> ActionRiskProfile, declaration-blind)
export {
  compose,
  derive,
  descriptionSignals,
  nameSignals,
  schemaShapeSignals,
  scoreBlastRadius,
} from './derive/index.ts';
export type {
  ActionRiskProfile,
  BlastRadius,
  Confidence,
  Destructiveness,
  Dimension,
  ExternalReach,
  Idempotency,
  Reversibility,
  SignalRef,
} from './dimensions.ts';
// Dimensions and the derived action-risk profile
export {
  actionRiskProfileSchema,
  BLAST_RADIUS_ORDER,
  blastRadiusDimensionSchema,
  blastRadiusSchema,
  confidenceSchema,
  DESTRUCTIVENESS_ORDER,
  destructivenessDimensionSchema,
  destructivenessSchema,
  EXTERNAL_REACH_ORDER,
  externalReachDimensionSchema,
  externalReachSchema,
  IDEMPOTENCY_ORDER,
  idempotencyDimensionSchema,
  idempotencySchema,
  REVERSIBILITY_ORDER,
  reversibilityDimensionSchema,
  reversibilitySchema,
  signalRefSchema,
} from './dimensions.ts';
export type { Finding, RuleClass, Severity, StandardsRef, Verdict } from './finding.ts';
// Findings (the canonical output)
export { ruleClassSchema, severitySchema, standardsRefSchema, verdictSchema } from './finding.ts';
export type { JsonSchema, ManifestSource, ToolDefinition, ToolManifest } from './manifest.ts';
// Manifest (input boundary)
export {
  jsonSchemaSchema,
  manifestSourceSchema,
  toolDefinitionSchema,
  toolManifestSchema,
} from './manifest.ts';
export type { ActlintError, ErrorCode, Outcome } from './outcome.ts';
// Outcome / error model (pure core never throws for control flow)
export { actlintErrorSchema, assertNever, err, errorCodeSchema, ok } from './outcome.ts';
export type { IsoTimestamp, RuleId } from './primitives.ts';
// Primitives
export { isoTimestampSchema, Redacted, redactedSchema, ruleIdSchema } from './primitives.ts';
export type { Report, ReportSummary } from './report-schema.ts';
// The `--json` report schema — a versioned public API (single source of truth for the payload shape)
export { REPORT_SCHEMA_VERSION, reportSchema } from './report-schema.ts';
export type { Coverage, ServerGrade, ServerResult } from './server-result.ts';
// Server-level result (what reporters and the CLI consume), assessment coverage, and the honesty grade
export { coverageSchema, serverGradeSchema } from './server-result.ts';
