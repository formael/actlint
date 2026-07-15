// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The scorecard — the product's face. It must read in five seconds and survive as a single
// screenshot: the grade is the headline, dishonesty is at the top, and every honesty line carries
// its reason and a standard so the picture is legible to a Guardian, not only a Builder.
//
// A reporter is a PURE function of its ServerResult. Colour is opt-in (the shell decides from
// NO_COLOR / TTY and passes it); the default is plain output that degrades cleanly to CI logs.

import type { Finding, ReportSummary, ServerResult, Severity, Verdict } from '@formael/actlint-core';
import { formatStandards, glyph, paint, severityTag, sourceLabel, tagColour } from './format.ts';
import { summarize } from './summary.ts';

export interface HumanReporterOptions {
  /** Emit ANSI colour. Off by default: the plain form is deterministic and NO_COLOR-safe. */
  readonly color?: boolean;
}

const INDENT = '  ';
const SUB_INDENT = '      ';
const RULE_WIDTH = 78;
const RULE = INDENT + '─'.repeat(RULE_WIDTH);
const TAG_WIDTH = 5; // widest tag: "INFO" / "CRIT" / "MED?" — pad so tool names align

// Display order for honesty findings: the actively-dishonest first, then the absent-hint nudges,
// then the over-declarations — the severity order the product pivots on.
const VERDICT_RANK: Record<Verdict, number> = {
  'under-declared': 0,
  undeclared: 1,
  'over-declared': 2,
  consistent: 3,
};
const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

// A total, deterministic string order — no locale-sensitive collation, so output is byte-stable.
function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareHonesty(a: Finding, b: Finding): number {
  return (
    VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    byString(a.toolName, b.toolName) ||
    byString(a.ruleId as string, b.ruleId as string)
  );
}

function compareAdvisory(a: Finding, b: Finding): number {
  return byString(a.toolName, b.toolName) || byString(a.ruleId as string, b.ruleId as string);
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function gradeColour(grade: ServerResult['grade']): 'cyan' | 'yellow' | 'red' {
  if (grade === 'A' || grade === 'B') return 'cyan';
  if (grade === 'C' || grade === 'D') return 'yellow';
  return 'red';
}

function headerLine(result: ServerResult, color: boolean): string {
  const left = `actlint  ▸  ${sourceLabel(result.source)}`;
  // When some tools could not be assessed, the grade is qualified so it can never read as a
  // verified-honest verdict over the whole server.
  const qualifier =
    result.coverage.unassessedTools > 0
      ? `  (assessed ${result.coverage.assessedTools} of ${plural(result.toolCount, 'tool')})`
      : '';
  const gradeText = `honesty grade: ${paint(result.grade, gradeColour(result.grade), color)}${qualifier}`;
  // Right-align to the rule width. paint adds invisible bytes, so measure the plain text.
  const visibleRight = `honesty grade: ${result.grade}${qualifier}`;
  const gap = Math.max(1, RULE_WIDTH - left.length - visibleRight.length);
  return INDENT + left + ' '.repeat(gap) + gradeText;
}

function findingBlock(finding: Finding, color: boolean): readonly string[] {
  const tag = severityTag(finding).padEnd(TAG_WIDTH);
  const head = `${glyph(finding)} ${paint(tag, tagColour(finding), color)} ${finding.toolName}  ${finding.ruleId as string}`;
  const lines = [INDENT + head, SUB_INDENT + finding.rationale];
  const standards = formatStandards(finding.standards);
  if (standards.length > 0) lines.push(`${SUB_INDENT}↳ ${paint(standards, 'dim', color)}`);
  return lines;
}

/**
 * Render one ServerResult as the human scorecard. Honesty findings are grouped and sorted for the
 * screenshot; advisories follow, explicitly labelled so a hygiene note is never read as dishonesty.
 */
export function humanReporter(result: ServerResult, options: HumanReporterOptions = {}): string {
  const color = options.color ?? false;
  const summary = summarize(result.findings, result.toolCount, result.coverage.unassessedTools);

  const honesty = result.findings
    .filter((f) => f.ruleClass === 'honesty')
    .slice()
    .sort(compareHonesty);
  const advisory = result.findings
    .filter((f) => f.ruleClass === 'advisory')
    .slice()
    .sort(compareAdvisory);

  const lines: string[] = [
    headerLine(result, color),
    RULE,
    `${INDENT}${plural(result.toolCount, 'tool')} scanned · ${summary.underDeclared} under-declared · ${summary.undeclared} undeclared · ${summary.overDeclared} over-declared`,
  ];

  if (honesty.length > 0) {
    lines.push('');
    for (const finding of honesty) lines.push(...findingBlock(finding, color));
  }

  if (advisory.length > 0) {
    lines.push('');
    lines.push(`${INDENT}${paint('advisories — capability hygiene, not honesty verdicts', 'dim', color)}`);
    for (const finding of advisory) lines.push(...findingBlock(finding, color));
  }

  lines.push(RULE);
  lines.push(...footerLines(result, summary, color));
  lines.push(`${INDENT}Full report: --json`);

  return `${lines.join('\n')}\n`;
}

// The closing tally. For a fully-assessed server that annotates at least one tool, it is the plain
// consistent line it has always been. When actlint could not assess every tool, or when a server
// declares no annotations anywhere, it reports coverage plainly instead — so silence and a blank
// annotation surface are never read as a clean bill of health.
function footerLines(result: ServerResult, summary: ReportSummary, color: boolean): readonly string[] {
  const { toolCount } = result;
  const { unassessedTools, annotatedTools } = result.coverage;
  const showCoverage = toolCount > 0 && (unassessedTools > 0 || annotatedTools === 0);

  if (!showCoverage) {
    return [`${INDENT}${summary.consistent} of ${plural(toolCount, 'tool')} consistent.`];
  }

  const allUnassessed = unassessedTools === toolCount;
  const segments: string[] = [];
  if (!allUnassessed) segments.push(`${summary.consistent} of ${plural(toolCount, 'tool')} consistent`);
  if (unassessedTools > 0) {
    segments.push(`${unassessedTools} not assessable (no recognized risk signals)`);
  }
  segments.push(`${annotatedTools} of ${toolCount} declare annotations`);

  const lines = [`${INDENT}${segments.join(' · ')}`];
  if (unassessedTools > 0) {
    const note =
      'Not assessable is not verified honest: actlint found no signal it recognizes in these tools.';
    lines.push(`${INDENT}${paint(note, 'dim', color)}`);
  }
  return lines;
}
