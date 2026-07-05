// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The `--json` report is not a debug dump — it is a PUBLIC API. CI dashboards read it, the badge is
// computed from it, and third-party (and Formael) importers write against it. So its shape is a
// contract: a Zod schema is the single source of truth, the committed `schema/report.schema.json`
// is generated from it (and snapshot-tested, so any shape change surfaces as a semver decision),
// and the reporter's conformance test validates its output against it.
//
// This schema describes the RENDERED JSON, not an in-memory type: the source's live endpoint is a
// redacted string here, and every field is JSON-serializable. Object schemas are strict so a
// reporter that drifts (an extra, renamed, or dropped key) fails conformance rather than silently
// shipping an incompatible payload.

import { z } from 'zod';

import { declaredProfileSchema } from './declared.ts';
import { confidenceSchema, signalRefSchema } from './dimensions.ts';
import { actionRiskProfileSchema } from './dimensions.ts';
import { ruleClassSchema, severitySchema, standardsRefSchema, verdictSchema } from './finding.ts';
import { serverGradeSchema } from './server-result.ts';

/**
 * Semver of the report schema — an independent line from the code, vocabulary, and crosswalk
 * versions. A breaking change to the report shape is a MAJOR bump here, tracked separately so an
 * integrator can pin the payload contract without pinning the tool.
 */
export const REPORT_SCHEMA_VERSION = '1.0.0';

// The source, as rendered: the live transport's endpoint is redacted to a fixed string so a report
// never carries a credential-bearing URL.
const reportSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('live'), transport: z.enum(['stdio', 'http']), endpoint: z.string() }).strict(),
  z.object({ kind: z.literal('server-card'), url: z.string() }).strict(),
  z.object({ kind: z.literal('registry'), serverId: z.string() }).strict(),
  z.object({ kind: z.literal('file'), path: z.string() }).strict(),
]);

// Per-tool honesty tally. Each scanned tool is counted once, under its worst verdict, so the four
// buckets plus `consistent` sum to `tools`.
const reportSummarySchema = z
  .object({
    tools: z.number().int().nonnegative(),
    underDeclared: z.number().int().nonnegative(),
    undeclared: z.number().int().nonnegative(),
    overDeclared: z.number().int().nonnegative(),
    consistent: z.number().int().nonnegative(),
  })
  .strict();

// One finding, projected to JSON: the full provenance an importer needs to re-explain a verdict
// without re-running the engine — the rationale, the standards crosswalk, and both profiles.
const reportFindingSchema = z
  .object({
    ruleId: z.string().min(1),
    ruleClass: ruleClassSchema,
    toolName: z.string(),
    verdict: verdictSchema,
    severity: severitySchema,
    confidence: confidenceSchema,
    rationale: z.string().min(1),
    standards: standardsRefSchema,
    derived: actionRiskProfileSchema,
    declared: declaredProfileSchema,
    evidence: z.array(signalRefSchema),
  })
  .strict();

export const reportSchema = z
  .object({
    reportSchemaVersion: z.string(),
    tool: z.literal('actlint'),
    actlintVersion: z.string(),
    vocabularyVersion: z.string(),
    crosswalkVersion: z.string(),
    source: reportSourceSchema,
    grade: serverGradeSchema,
    summary: reportSummarySchema,
    findings: z.array(reportFindingSchema),
  })
  .strict()
  .meta({
    $id: 'https://formael.dev/schemas/actlint/report.schema.json',
    title: 'actlint report',
    description:
      "actlint's --json report: a versioned, machine-readable account of one server's action-risk honesty. The canonical output is `findings`; `grade` and `summary` are deterministic reductions of it. This schema is a public API — its shape changes only on a semver decision.",
  });

export type Report = z.infer<typeof reportSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
