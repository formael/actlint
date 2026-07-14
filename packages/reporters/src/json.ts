// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The `--json` reporter. Its output is a PUBLIC API (see core's report-schema): CI dashboards, the
// badge pipeline, and importers read it, so the shape is a contract validated against the published
// JSON Schema. This function only renders — it emits the canonical Finding[] plus the metadata the
// result already carries, in a fixed key order, pretty-printed and deterministic.

import { assertNever, type Finding, type ManifestSource, type ServerResult } from '@formael/actlint-core';
import { summarize } from './summary.ts';

// The source, made JSON-safe. A live endpoint may carry a credential, so it is redacted here (the
// Redacted wrapper renders itself as "[REDACTED]") — a report never leaks where a live server lives.
function renderSource(source: ManifestSource): Record<string, string> {
  switch (source.kind) {
    case 'live':
      return { kind: 'live', transport: source.transport, endpoint: source.endpoint.toString() };
    case 'server-card':
      return { kind: 'server-card', url: source.url };
    case 'registry':
      return { kind: 'registry', serverId: source.serverId };
    case 'file':
      return { kind: 'file', path: source.path };
    default:
      return assertNever(source);
  }
}

// One finding, projected to the report shape. Full provenance travels — rationale, standards, and
// both profiles — so an importer can re-explain a verdict without re-running the engine.
function renderFinding(finding: Finding): Record<string, unknown> {
  return {
    ruleId: finding.ruleId as string,
    ruleClass: finding.ruleClass,
    toolName: finding.toolName,
    verdict: finding.verdict,
    severity: finding.severity,
    confidence: finding.confidence,
    rationale: finding.rationale,
    standards: finding.standards,
    derived: finding.derived,
    declared: finding.declared,
    evidence: finding.evidence,
  };
}

/** Render one ServerResult as the machine report. Findings keep their canonical order; keys are fixed. */
export function jsonReporter(result: ServerResult): string {
  const report = {
    reportSchemaVersion: result.reportSchemaVersion,
    tool: 'actlint',
    actlintVersion: result.actlintVersion,
    vocabularyVersion: result.vocabularyVersion,
    crosswalkVersion: result.crosswalkVersion,
    source: renderSource(result.source),
    grade: result.grade,
    summary: summarize(result.findings, result.toolCount, result.coverage.unassessedTools),
    coverage: result.coverage,
    findings: result.findings.map(renderFinding),
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}
