// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The label schema — the contract every `labels.json` in the corpus must satisfy.
//
// A label is a human's assertion of ground truth about a real tool, and its authority is the
// company's authority (an agent may *propose* a label; a human ratifies it). The schema makes the
// one thing that gives the number credibility non-optional: PROVENANCE — how the tool's actual
// behavior was established, not merely what the labeler guessed from the same manifest the linter
// sees. A precision figure computed against manifest-only labels is self-confirming; requiring a
// cited provenance is what stops that.
//
// This module is pure over its inputs (it validates parsed JSON). It reuses core's closed enums so
// a label can never name a verdict, a dimension level, or a RuleId the engine does not know about.

import {
  ALL_RULE_IDS,
  confidenceSchema,
  destructivenessSchema,
  externalReachSchema,
  reversibilitySchema,
  ruleClassOf,
  verdictSchema,
} from '@formael/actlint-core';
import { z } from 'zod';

// The four accepted ways a label's ground truth may have been established, strongest first. The kind
// alone does not set confidence — a labeler still records `confidence` — but it records how much the
// number is allowed to lean on this row. `behavioral-inference` (name + schema only, no external
// source) is the weakest and is called out as such.
export const provenanceKindSchema = z.enum([
  'source-inspection',
  'vendor-docs',
  'documented-behavior',
  'behavioral-inference',
]);
export type ProvenanceKind = z.infer<typeof provenanceKindSchema>;

// Provenance — the mandatory citation. `source` is required for every kind: a file+commit for
// source-inspection, a URL for vendor-docs, a README/changelog section for documented-behavior, and
// the reasoning basis (the name/schema signals relied on) for behavioral-inference. Never empty.
export const provenanceSchema = z
  .object({
    kind: provenanceKindSchema,
    source: z.string().min(1, 'provenance.source must cite how the behavior was established'),
    // ISO date the source was accessed — required for vendor-docs, where content drifts.
    accessedAt: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
  })
  .readonly()
  .refine((p) => p.kind !== 'vendor-docs' || p.accessedAt !== undefined, {
    message: 'vendor-docs provenance must record an accessedAt date',
  });
export type Provenance = z.infer<typeof provenanceSchema>;

// The true action-risk of the tool, established via the provenance above. Documentation of *why*
// the verdict is what it is; each axis is optional because a labeler cites only what they verified.
export const trueRiskSchema = z
  .object({
    destructiveness: destructivenessSchema.optional(),
    reversibility: reversibilitySchema.optional(),
    externalReach: externalReachSchema.optional(),
  })
  .readonly();
export type TrueRisk = z.infer<typeof trueRiskSchema>;

// An expected honesty finding: the RuleId a correct linter must emit on this tool. This is the
// human's operationalization of `trueRisk` vs. what the tool declares — the answer key the scorer
// grades against. Only honesty rules are graded; advisory (hygiene) rules carry no verdict and are
// never listed here (a refine below enforces it).
const expectedFindingSchema = z
  .object({
    ruleId: z.enum(ALL_RULE_IDS.map((id) => id as string) as [string, ...string[]]),
  })
  .readonly()
  .refine((e) => ruleClassOf(e.ruleId as never) === 'honesty', {
    message: 'expected findings may only name honesty rules; advisory rules carry no verdict',
  });

// One labeled tool.
export const toolLabelSchema = z
  .object({
    name: z.string().min(1),
    // The tool-level rollup: the single worst verdict a correct linter should reach for this tool.
    trueVerdict: verdictSchema,
    trueRisk: trueRiskSchema,
    // The honesty findings a correct linter must emit. Empty means the tool is genuinely clean.
    expected: z.array(expectedFindingSchema).readonly(),
    // When true, the truth is genuinely ambiguous: a conservative `uncertain` finding or silence is
    // scored as correct, and a miss is not penalized. This is how conservatism is rewarded, not
    // punished — but a *confident* wrong flag on an ambiguous tool still counts against precision.
    ambiguous: z.boolean().optional(),
    // The labeler's confidence in this row. Distinct from a finding's confidence.
    confidence: confidenceSchema,
    provenance: provenanceSchema,
  })
  .readonly()
  .refine(
    (t) =>
      t.expected.length > 0
        ? t.trueVerdict !== 'consistent'
        : t.trueVerdict === 'consistent' || t.ambiguous === true,
    {
      message:
        'trueVerdict must agree with expected: a non-empty expected set implies a non-consistent verdict, and an empty set implies consistent (unless ambiguous)',
    },
  );
export type ToolLabel = z.infer<typeof toolLabelSchema>;

// The labels for one server. `server` must match the corpus directory id.
export const serverLabelsSchema = z
  .object({
    server: z.string().min(1),
    labeledAt: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
    tools: z.array(toolLabelSchema).min(1),
  })
  .readonly();
export type ServerLabels = z.infer<typeof serverLabelsSchema>;

/** Validate parsed JSON as a server's labels. Throws a ZodError on any violation. */
export function parseServerLabels(raw: unknown): ServerLabels {
  return serverLabelsSchema.parse(raw);
}
