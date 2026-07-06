// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The SARIF 2.1.0 reporter — actlint where CI already lives. Each Finding becomes one SARIF result:
// its ruleId, a level derived from severity, the rationale as the message, and the crosswalk as
// properties and tags. This is a RENDERER, not new logic — it emits the same Finding[] the other
// reporters do, so the code-scanning view can never disagree with the scorecard.

import {
  assertNever,
  type Finding,
  type ManifestSource,
  type ServerResult,
  type Severity,
  type StandardsRef,
} from '@formael/actlint-core';

// SARIF speaks error / warning / note. Map from severity so the level is derived, never authored.
function sarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
      return 'note';
    default:
      return assertNever(severity);
  }
}

// Flatten the crosswalk into stable tag strings so a Guardian can filter code-scanning by standard.
function standardsTags(standards: StandardsRef): readonly string[] {
  const tags: string[] = [];
  const add = (prefix: string, refs: readonly string[] | undefined): void => {
    if (refs !== undefined) for (const ref of refs) tags.push(`${prefix}${ref}`);
  };
  add('OWASP-ASI:', standards.owaspAsi);
  add('OWASP-MCP:', standards.owaspMcp);
  add('CoSAI:', standards.cosaiOasis);
  add('EU-AI-Act:', standards.euAiAct);
  add('NIST:', standards.nist);
  add('mcp-field:', standards.mcpField);
  return tags;
}

// A rule descriptor per distinct RuleId, in first-appearance order. The standards are keyed by
// RuleId in the crosswalk, so every finding of a rule shares them; the first occurrence supplies them.
function ruleDescriptors(findings: readonly Finding[]): readonly Record<string, unknown>[] {
  const seen = new Map<string, Finding>();
  for (const finding of findings) {
    const id = finding.ruleId as string;
    if (!seen.has(id)) seen.set(id, finding);
  }
  return [...seen.values()].map((finding) => ({
    id: finding.ruleId as string,
    name: finding.ruleId as string,
    properties: {
      ruleClass: finding.ruleClass,
      tags: [finding.ruleClass, ...standardsTags(finding.standards)],
    },
  }));
}

// Where the scan looked, as a SARIF logical location — findings are about a tool, not a file line.
function originUri(source: ManifestSource): string | undefined {
  switch (source.kind) {
    case 'server-card':
      return source.url;
    case 'live':
    case 'registry':
    case 'file':
      // A live endpoint may be credential-bearing, and a registry id / local path is not a URI —
      // none is safe or meaningful to publish as a SARIF artifact location.
      return undefined;
    default:
      return assertNever(source);
  }
}

function sarifResult(finding: Finding): Record<string, unknown> {
  return {
    ruleId: finding.ruleId as string,
    level: sarifLevel(finding.severity),
    message: { text: finding.rationale },
    locations: [{ logicalLocations: [{ name: finding.toolName, kind: 'resource' }] }],
    partialFingerprints: { 'actlint/toolRule': `${finding.toolName}::${finding.ruleId as string}` },
    properties: {
      toolName: finding.toolName,
      verdict: finding.verdict,
      severity: finding.severity,
      confidence: finding.confidence,
      ruleClass: finding.ruleClass,
      standards: finding.standards,
      tags: standardsTags(finding.standards),
    },
  };
}

/** Render one ServerResult as a SARIF 2.1.0 log. Same Finding[], one result each, in canonical order. */
export function sarifReporter(result: ServerResult): string {
  const uri = originUri(result.source);
  const log = {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'actlint',
            version: result.actlintVersion,
            rules: ruleDescriptors(result.findings),
          },
        },
        ...(uri !== undefined ? { originalUriBaseIds: { SERVER: { uri } } } : {}),
        results: result.findings.map(sarifResult),
      },
    ],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}
