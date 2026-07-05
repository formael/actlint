// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The Zod mirror of the JSON Schemas in `../schema`. These are VALIDATORS, not mechanism:
// they check the shape of the data and refuse a malformed entry. Nothing here scores, walks,
// or composes — that judgment-into-profile machinery lives in the engine (packages/core).
//
// The dimension levels below are re-declared to match the engine's dimensions exactly. This
// package is the base layer and depends on nothing, so it cannot import them from core; the
// vocabulary's acceptance tests pin the two lists together.

import { z } from 'zod';

// --- Ordinal levels (must stay identical to the engine's dimension enums) --------------------

export const reversibilityLevelSchema = z.enum([
  'reversible',
  'recoverable-with-effort',
  'irreversible',
  'unknown',
]);
export const destructivenessLevelSchema = z.enum([
  'read-only',
  'additive',
  'mutating',
  'deleting',
  'unknown',
]);
export const externalReachLevelSchema = z.enum(['local', 'org-internal', 'open-world', 'unknown']);
export const idempotencyLevelSchema = z.enum(['idempotent', 'non-idempotent', 'unknown']);

// The four dimensions an entry may contribute to. `blastRadius` is deliberately absent: it is a
// derived composite, formed only by the engine's scorer, never asserted by a vocabulary entry.
export const primaryDimensionSchema = z.enum([
  'reversibility',
  'destructiveness',
  'externalReach',
  'idempotency',
]);
export type PrimaryDimension = z.infer<typeof primaryDimensionSchema>;

// Every dimension name, including the derived composite — used by the MCP mapping.
export const dimensionNameSchema = z.enum([
  'reversibility',
  'destructiveness',
  'externalReach',
  'idempotency',
  'blastRadius',
]);
export type DimensionName = z.infer<typeof dimensionNameSchema>;

// --- Entry building blocks -------------------------------------------------------------------

// How strongly an entry argues for a contribution. `high` demands a citation (see below).
export const weightSchema = z.enum(['high', 'medium', 'low']);
export type Weight = z.infer<typeof weightSchema>;

// Seeds the confidence the engine assigns. `uncertain` downgrades severity, never suppresses.
export const vocabularyConfidenceSchema = z.enum(['high', 'medium', 'low', 'uncertain']);
export type VocabularyConfidence = z.infer<typeof vocabularyConfidenceSchema>;

export const signalKindSchema = z.enum(['name-verb', 'description-phrase', 'schema-shape']);
export type SignalKind = z.infer<typeof signalKindSchema>;

const contribution = <L extends z.ZodTypeAny>(level: L) => z.object({ level, weight: weightSchema }).strict();

// Only the four primary dimensions; at least one must be present. blastRadius cannot appear.
export const contributesSchema = z
  .object({
    reversibility: contribution(reversibilityLevelSchema).optional(),
    destructiveness: contribution(destructivenessLevelSchema).optional(),
    externalReach: contribution(externalReachLevelSchema).optional(),
    idempotency: contribution(idempotencyLevelSchema).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length >= 1, {
    message: 'contributes must argue for at least one dimension',
  });
export type Contributes = z.infer<typeof contributesSchema>;

const lexicalMatchSchema = z.array(z.string().min(1)).min(1);

const schemaShapeMatchSchema = z
  .object({
    paramNameMatches: z.array(z.string().min(1)).optional(),
    stringFormatMatches: z.array(z.string().min(1)).optional(),
    unconstrained: z.boolean().optional(),
  })
  .strict()
  .refine((m) => m.paramNameMatches !== undefined || m.stringFormatMatches !== undefined, {
    message: 'a schema-shape signal must match on a parameter name or a string format',
  });
export type SchemaShapeMatch = z.infer<typeof schemaShapeMatchSchema>;

export const signalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('name-verb'), match: lexicalMatchSchema }).strict(),
  z.object({ kind: z.literal('description-phrase'), match: lexicalMatchSchema }).strict(),
  z.object({ kind: z.literal('schema-shape'), match: schemaShapeMatchSchema }).strict(),
]);
export type Signal = z.infer<typeof signalSchema>;

// --- Entry ------------------------------------------------------------------------------------

const entryShapeSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, {
      message: 'id must be lowercase dot/hyphen-segmented (e.g. verb.delete, shape.freeform-code-input)',
    }),
    signal: signalSchema,
    contributes: contributesSchema,
    evidence: z.string().min(1),
    citation: z.string().min(1).optional(),
    confidence: vocabularyConfidenceSchema,
  })
  .strict();

// The type of a single entry, before the cross-field citation rule is layered on.
export type VocabularyEntry = z.infer<typeof entryShapeSchema>;

function hasHighWeightContribution(contributes: Contributes): boolean {
  return Object.values(contributes).some((c) => c !== undefined && c.weight === 'high');
}

// The no-overclaiming rule: any high-weight judgment must cite a source.
export const vocabularyEntrySchema = entryShapeSchema.superRefine((entry, ctx) => {
  if (hasHighWeightContribution(entry.contributes) && entry.citation === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['citation'],
      message: 'a citation is required for any high-weight contribution',
    });
  }
});

export const vocabularySchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, { message: 'version must be plain semver (MAJOR.MINOR.PATCH)' }),
    limitations: z.array(z.string().min(1)).optional(),
    entries: z.array(vocabularyEntrySchema).min(1),
  })
  .strict();
export type Vocabulary = z.infer<typeof vocabularySchema>;

// --- MCP hint mapping -------------------------------------------------------------------------

export const mcpHintSchema = z.enum(['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint']);
export type McpHint = z.infer<typeof mcpHintSchema>;

// The discipline as a validated invariant: a verdict may be raised on a dimension only where an
// MCP hint exists. Dimensions with no hint (reversibility, blastRadius) are context, never verdicts.
export const mcpMappingRowSchema = z
  .object({
    mcpHint: mcpHintSchema.nullable(),
    dimension: dimensionNameSchema,
    raisesVerdict: z.boolean(),
    correspondence: z.string().min(1),
    note: z.string().min(1),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.raisesVerdict !== (row.mcpHint !== null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['raisesVerdict'],
        message: 'raisesVerdict must be true exactly when an MCP hint exists to be honest about',
      });
    }
  });
export type McpMappingRow = z.infer<typeof mcpMappingRowSchema>;

export const mcpMappingSchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, { message: 'version must be plain semver (MAJOR.MINOR.PATCH)' }),
    mappings: z.array(mcpMappingRowSchema).min(1),
  })
  .strict();
export type McpMapping = z.infer<typeof mcpMappingSchema>;

// --- Classification vocabularies: severity and verdict ----------------------------------------
//
// These enums are re-declared to match the engine's `Verdict` and `Severity` exactly. As the base
// layer this package cannot import them from core; the crosswalk/severity tests pin the two lists
// together, exactly as the dimension levels are pinned.

export const verdictSchema = z.enum(['consistent', 'under-declared', 'over-declared', 'undeclared']);
export type VerdictName = z.infer<typeof verdictSchema>;

export const severitySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type SeverityName = z.infer<typeof severitySchema>;

// Stable, kebab-case RuleId keys. The same lexical shape the engine's branded RuleId enforces;
// the engine owns the closed *set*, this only constrains the *shape* of a crosswalk/floor key.
const ruleIdKeySchema = z.string().regex(/^[a-z][a-z0-9-]*$/, {
  message: 'a RuleId key must be lowercase, kebab-case (e.g. write-as-readonly)',
});

// --- The standards & regulatory crosswalk -----------------------------------------------------

// Per-column typed ref arrays. Patterns enforce that identifiers use the exact form each issuing
// body publishes, so a malformed or nonexistent ID fails validation rather than silently ships.
const owaspAsiRefSchema = z.array(z.string().regex(/^ASI(0[1-9]|10):2026$/)).min(1);
const owaspMcpRefSchema = z.array(z.string().regex(/^MCP(0[1-9]|10):2025$/)).min(1);
const cosaiOasisRefSchema = z.array(z.string().regex(/^MCP-T([1-9]|1[0-2])$/)).min(1);
const euAiActRefSchema = z.array(z.string().regex(/^Art\.\d{1,3}$/)).min(1);
const nistRefSchema = z.array(z.string().regex(/^AI-RMF:(GOVERN|MAP|MEASURE|MANAGE)$/)).min(1);
const mcpFieldRefSchema = z
  .array(z.enum(['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']))
  .min(1);

export const standardsRefSchema = z
  .object({
    owaspAsi: owaspAsiRefSchema.optional(),
    owaspMcp: owaspMcpRefSchema.optional(),
    cosaiOasis: cosaiOasisRefSchema.optional(),
    euAiAct: euAiActRefSchema.optional(),
    nist: nistRefSchema.optional(),
    mcpField: mcpFieldRefSchema.optional(),
  })
  .strict()
  .refine(
    (ref) =>
      [ref.owaspAsi, ref.owaspMcp, ref.cosaiOasis, ref.euAiAct, ref.nist, ref.mcpField].some(
        (arr) => arr !== undefined && arr.length > 0,
      ),
    { message: 'a crosswalk entry must cite at least one external standard or MCP field' },
  );
export type StandardsRef = z.infer<typeof standardsRefSchema>;

export const crosswalkSchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, { message: 'version must be plain semver (MAJOR.MINOR.PATCH)' }),
    note: z.string().min(1).optional(),
    map: z.record(ruleIdKeySchema, standardsRefSchema),
  })
  .strict();
export type Crosswalk = z.infer<typeof crosswalkSchema>;

// --- The severity policy ----------------------------------------------------------------------

export const severityPolicySchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, { message: 'version must be plain semver (MAJOR.MINOR.PATCH)' }),
    byVerdict: z
      .object({
        'under-declared': severitySchema,
        undeclared: severitySchema,
        'over-declared': severitySchema,
        consistent: severitySchema,
      })
      .strict(),
    ruleClass: z.object({ advisory: severitySchema }).strict(),
    ruleFloor: z.record(ruleIdKeySchema, severitySchema),
    confidenceAdjust: z
      .object({
        uncertain: z.number().int(),
        low: z.number().int(),
        medium: z.number().int(),
        high: z.number().int(),
      })
      .strict(),
  })
  .strict();
export type SeverityPolicy = z.infer<typeof severityPolicySchema>;

// --- The honesty-grade policy -----------------------------------------------------------------
//
// The letter grade is a downstream view of the finding set, computed by the reporters, but its
// bands and weights are JUDGMENT and so live here as reviewable data. ServerGrade is re-declared
// (like Verdict and Severity above): the base layer cannot import the engine's type, and the
// grade-policy schema / core pin the two lists together.

export const serverGradeSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
export type ServerGrade = z.infer<typeof serverGradeSchema>;

// The honesty weight [0,1] of a single tool, or a band threshold. 1.0 is fully honest.
const gradeWeightSchema = z.number().min(0).max(1);

export const gradePolicySchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, { message: 'version must be plain semver (MAJOR.MINOR.PATCH)' }),
    note: z.string().min(1).optional(),
    // Per-tool honesty weight, keyed by the tool's worst verdict. The ordering encodes the
    // product's asymmetry: consistent (fully honest) ≫ undeclared ≈ over-declared ≫ under-declared.
    weights: z
      .object({
        consistent: gradeWeightSchema,
        undeclared: gradeWeightSchema,
        'over-declared': gradeWeightSchema,
        'under-declared': gradeWeightSchema,
      })
      .strict(),
    // Score-to-letter bands, best grade first. A score takes the first band it meets or exceeds.
    bands: z.array(z.object({ grade: serverGradeSchema, minScore: gradeWeightSchema }).strict()).min(1),
    // Ceilings the worst dishonesty imposes regardless of score; the strictest applicable one wins.
    caps: z
      .object({
        anyUnderDeclared: serverGradeSchema,
        criticalUnderDeclared: serverGradeSchema,
      })
      .strict(),
  })
  .strict();
export type GradePolicy = z.infer<typeof gradePolicySchema>;

// --- Validators (the package's only functions) ------------------------------------------------

/** Validate an unknown value as a vocabulary document. Throws on a malformed shape. */
export function parseVocabulary(data: unknown): Vocabulary {
  return vocabularySchema.parse(data);
}

/** Validate an unknown value as an MCP-hint mapping document. Throws on a malformed shape. */
export function parseMcpMapping(data: unknown): McpMapping {
  return mcpMappingSchema.parse(data);
}

/** Validate an unknown value as a standards crosswalk document. Throws on a malformed shape. */
export function parseCrosswalk(data: unknown): Crosswalk {
  return crosswalkSchema.parse(data);
}

/** Validate an unknown value as a severity policy document. Throws on a malformed shape. */
export function parseSeverityPolicy(data: unknown): SeverityPolicy {
  return severityPolicySchema.parse(data);
}

/** Validate an unknown value as an honesty-grade policy document. Throws on a malformed shape. */
export function parseGradePolicy(data: unknown): GradePolicy {
  return gradePolicySchema.parse(data);
}
