// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// `explain <ruleId>` — a finding points to a rule; this resolves it without leaving the terminal.
// The prose comes from the single rule-docs source (no drift from a docs site), and the standards
// crosswalk is looked up from the vocabulary data (no drift from a finding's crosswalk). This module
// only renders; it derives nothing.

import { ALL_RULE_IDS, lookupStandards, ruleClassOf } from '@formael/actlint-core';
import type { RuleId, StandardsRef } from '@formael/actlint-core';
import { type CliError, usageError } from './exit-codes.ts';
import { RULE_DOCS } from './rule-docs.ts';

type ExplainResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: CliError };

// Framework label + the order they read in — most product-facing first, the MCP field last.
const STANDARDS_LABELS: readonly { readonly key: keyof StandardsRef; readonly label: string }[] = [
  { key: 'owaspAsi', label: 'OWASP ASI' },
  { key: 'owaspMcp', label: 'OWASP MCP Top 10' },
  { key: 'cosaiOasis', label: 'CoSAI/OASIS' },
  { key: 'nist', label: 'NIST AI RMF' },
  { key: 'euAiAct', label: 'EU AI Act' },
  { key: 'mcpField', label: 'MCP field' },
];

const LABEL_WIDTH = 18;

function standardsLines(standards: StandardsRef): readonly string[] {
  const lines: string[] = [];
  for (const { key, label } of STANDARDS_LABELS) {
    const refs = standards[key];
    if (refs !== undefined && refs.length > 0) {
      lines.push(`  ${label.padEnd(LABEL_WIDTH)}${refs.join(', ')}`);
    }
  }
  return lines;
}

function findRuleId(ruleId: string): RuleId | undefined {
  return ALL_RULE_IDS.find((id) => (id as string) === ruleId);
}

/**
 * Render one rule's explanation, or a usage error listing the valid ids. A rule id that is not in
 * the closed taxonomy is a usage mistake (exit 2), never a silent empty page.
 */
export function renderExplain(ruleId: string): ExplainResult {
  const known = findRuleId(ruleId);
  const doc = RULE_DOCS[ruleId];
  if (known === undefined || doc === undefined) {
    const valid = ALL_RULE_IDS.map((id) => `  ${id as string}`).join('\n');
    return { ok: false, error: usageError(`unknown rule id: ${ruleId}\n\nknown rules:\n${valid}`) };
  }

  const standards = lookupStandards(known);
  const klass = ruleClassOf(known);
  const sections: string[] = [
    `${ruleId} — ${doc.title}`,
    `  ${klass === 'advisory' ? 'advisory — capability hygiene, not an honesty verdict' : 'honesty rule'}`,
    '',
    'Meaning',
    `  ${doc.meaning}`,
    '',
    'Why it matters',
    `  ${doc.reason}`,
    '',
    'Example',
    `  ${doc.example}`,
  ];

  if (standards !== undefined) {
    sections.push('', 'Standards', ...standardsLines(standards));
    if (standards.euAiAct !== undefined && standards.euAiAct.length > 0) {
      sections.push(
        '  (EU AI Act references are transparency/oversight obligations, not asserted violations.)',
      );
    }
  }

  sections.push('', 'Fix', `  ${doc.fix}`);
  return { ok: true, text: `${sections.join('\n')}\n` };
}
