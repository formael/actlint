// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-core — PURE.
// The functional core: (ToolManifest + Vocabulary) -> ActionRiskProfile -> Finding[].
// No clock, network, fs, randomness, or model call ever appears here — the banned-import
// guard (scripts/check-purity.ts) enforces it.

// Primitives
export { Redacted, isoTimestampSchema, ruleIdSchema, redactedSchema } from './primitives.ts';
export type { IsoTimestamp, RuleId } from './primitives.ts';

// Dimensions and the derived action-risk profile
export {
  confidenceSchema,
  signalRefSchema,
  reversibilitySchema,
  destructivenessSchema,
  externalReachSchema,
  idempotencySchema,
  blastRadiusSchema,
  reversibilityDimensionSchema,
  destructivenessDimensionSchema,
  externalReachDimensionSchema,
  idempotencyDimensionSchema,
  blastRadiusDimensionSchema,
  actionRiskProfileSchema,
  REVERSIBILITY_ORDER,
  DESTRUCTIVENESS_ORDER,
  EXTERNAL_REACH_ORDER,
  IDEMPOTENCY_ORDER,
  BLAST_RADIUS_ORDER,
} from './dimensions.ts';
export type {
  Confidence,
  SignalRef,
  Dimension,
  Reversibility,
  Destructiveness,
  ExternalReach,
  Idempotency,
  BlastRadius,
  ActionRiskProfile,
} from './dimensions.ts';

// Manifest (input boundary)
export {
  jsonSchemaSchema,
  manifestSourceSchema,
  toolDefinitionSchema,
  toolManifestSchema,
} from './manifest.ts';
export type { JsonSchema, ManifestSource, ToolDefinition, ToolManifest } from './manifest.ts';

// Declared side (what the tool claims)
export {
  declaredHintSchema,
  declaredProfileSchema,
  effectiveDeclaredValue,
  MCP_HINT_DEFAULTS,
} from './declared.ts';
export type { DeclaredHint, DeclaredProfile, EffectiveDeclaredValue, McpHintDefault } from './declared.ts';

// Findings (the canonical output)
export { verdictSchema, severitySchema, ruleClassSchema, standardsRefSchema } from './finding.ts';
export type { Verdict, Severity, RuleClass, StandardsRef, Finding } from './finding.ts';

// Server-level result (what reporters and the CLI consume) and the honesty grade
export { serverGradeSchema } from './server-result.ts';
export type { ServerGrade, ServerResult } from './server-result.ts';

// The `--json` report schema — a versioned public API (single source of truth for the payload shape)
export { reportSchema, REPORT_SCHEMA_VERSION } from './report-schema.ts';
export type { Report, ReportSummary } from './report-schema.ts';

// Outcome / error model (pure core never throws for control flow)
export { ok, err, assertNever, errorCodeSchema, actlintErrorSchema } from './outcome.ts';
export type { Outcome, ActlintError, ErrorCode } from './outcome.ts';

// Derivation engine (ToolDefinition + Vocabulary -> ActionRiskProfile, declaration-blind)
export {
  derive,
  compose,
  scoreBlastRadius,
  nameSignals,
  descriptionSignals,
  schemaShapeSignals,
} from './derive/index.ts';
export type { Contribution, DerivationResult, PrimaryDimension } from './derive/index.ts';

// Classification (derived vs declared -> Verdict -> Finding, via the makeFinding gate)
export {
  classify,
  advisories,
  makeFinding,
  classifyTool,
  classifyManifest,
  computeSeverity,
  lookupStandards,
  missingCrosswalkEntries,
  RULE,
  ALL_RULE_IDS,
  HONESTY_RULES,
  ADVISORY_RULES,
  ruleClassOf,
} from './classify/index.ts';
export type { MakeFindingInput, RawFinding } from './classify/index.ts';
