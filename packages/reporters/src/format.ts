// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Shared display helpers for the human scorecard. Presentation only — nothing here decides a
// verdict, a severity, or a grade; it renders values the engine already produced. The voice is
// calm and concrete: tags and glyphs serve legibility, never severity theatre, and everything
// degrades cleanly to no-color.

import { type Finding, type ManifestSource, type StandardsRef, assertNever } from '@formael/actlint-core';

// --- Colour (opt-in; the default is plain, deterministic, NO_COLOR-safe output) ----------------

const ANSI = {
  reset: '[0m',
  red: '[31m',
  yellow: '[33m',
  cyan: '[36m',
  dim: '[2m',
  bold: '[1m',
} as const;

type Colour = keyof Omit<typeof ANSI, 'reset'>;

/** Wrap text in an ANSI colour when enabled; return it untouched otherwise. */
export function paint(text: string, colour: Colour, enabled: boolean): string {
  return enabled ? `${ANSI[colour]}${text}${ANSI.reset}` : text;
}

// --- Severity tag + glyph ----------------------------------------------------------------------

// The short label a finding wears in the scorecard. Advisory findings read `ADV` (never a severity
// word), so a hygiene note can never be mistaken for a dishonesty verdict. An `uncertain` reading
// appends `?` — visibly soft, never hidden.
export function severityTag(finding: Finding): string {
  const base = finding.ruleClass === 'advisory' ? 'ADV' : severityWord(finding.severity);
  return finding.confidence === 'uncertain' ? `${base}?` : base;
}

function severityWord(severity: Finding['severity']): string {
  switch (severity) {
    case 'critical':
      return 'CRIT';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MED';
    case 'low':
      return 'LOW';
    case 'info':
      return 'INFO';
    default:
      return assertNever(severity);
  }
}

/** A leading glyph that reads in monochrome: a mark for dishonesty, a dot for a nudge, a half-moon for advisory. */
export function glyph(finding: Finding): string {
  if (finding.ruleClass === 'advisory') return '◐';
  switch (finding.severity) {
    case 'critical':
    case 'high':
      return '✖';
    case 'medium':
      return '▲';
    case 'low':
    case 'info':
      return '·';
    default:
      return assertNever(finding.severity);
  }
}

/** The colour a finding's tag takes when colour is enabled. Advisory is cool; dishonesty is warm. */
export function tagColour(finding: Finding): Colour {
  if (finding.ruleClass === 'advisory') return 'cyan';
  switch (finding.severity) {
    case 'critical':
    case 'high':
      return 'red';
    case 'medium':
      return 'yellow';
    case 'low':
    case 'info':
      return 'dim';
    default:
      return assertNever(finding.severity);
  }
}

// --- Standards crosswalk (the line that makes a finding legible to a Guardian) ------------------

/**
 * A compact one-line rendering of the crosswalk. EU AI Act entries are references to transparency /
 * oversight obligations, never asserted violations, so they read "EU AI Act Art.14", nothing more.
 */
export function formatStandards(standards: StandardsRef): string {
  const parts: string[] = [];
  const push = (label: string, refs: readonly string[] | undefined): void => {
    if (refs !== undefined && refs.length > 0) parts.push(`${label} ${refs.join(', ')}`);
  };
  push('OWASP', standards.owaspAsi);
  push('OWASP', standards.owaspMcp);
  push('CoSAI', standards.cosaiOasis);
  push('EU AI Act', standards.euAiAct);
  push('NIST', standards.nist);
  push('MCP field', standards.mcpField);
  return parts.join(' · ');
}

// --- Source label ------------------------------------------------------------------------------

/** A short, human label for where the manifest came from. A live endpoint is never printed — it may carry a credential. */
export function sourceLabel(source: ManifestSource): string {
  switch (source.kind) {
    case 'live':
      return `${source.transport} server`;
    case 'server-card':
      return source.url;
    case 'registry':
      return source.serverId;
    case 'file':
      return source.path;
    default:
      return assertNever(source);
  }
}
