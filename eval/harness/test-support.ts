// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Test builders for the eval suites. Findings are built through the REAL smart constructor
// (makeFinding), so the objects the scorer grades are genuine engine output, not mocks. Labels are
// built through the real label schema, so a test fixture is a valid corpus row. Not part of the
// shipped surface; pure over the core.

import {
  type ActionRiskProfile,
  type Confidence,
  type Finding,
  type RuleId,
  type SignalRef,
  type Verdict,
  makeFinding,
} from '@formael/actlint-core';
import { type ServerLabels, serverLabelsSchema } from './schema.ts';
import type { ScoredServer } from './score.ts';

function dim<L extends string>(
  level: L,
  confidence: Confidence,
): { level: L; confidence: Confidence; provenance: readonly SignalRef[] } {
  return { level, confidence, provenance: [{ id: 'verb.delete', weight: 'strong' }] };
}

// A risky-but-plain derived profile, enough for makeFinding to generate a non-empty rationale.
function derivedFor(confidence: Confidence): ActionRiskProfile {
  return {
    reversibility: dim('irreversible', confidence),
    destructiveness: dim('deleting', confidence),
    externalReach: dim('open-world', confidence),
    idempotency: dim('non-idempotent', confidence),
    blastRadius: dim('severe', confidence),
  };
}

/** Build a real honesty Finding on `toolName` for `ruleId` at the given confidence. */
export function finding(
  toolName: string,
  ruleId: RuleId,
  confidence: Confidence = 'high',
  verdict: Verdict = 'undeclared',
): Finding {
  const built = makeFinding({
    ruleId,
    toolName,
    verdict,
    confidence,
    derived: derivedFor(confidence),
    declared: { unknownHints: {} },
    signals: [{ id: 'verb.delete', weight: 'strong' }],
  });
  if (!built.ok) throw new Error(`test-support could not build a finding: ${built.error.message}`);
  return built.value;
}

/** Validate and return a ServerLabels literal, so a test fixture is always a legal corpus row. */
export function labels(raw: unknown): ServerLabels {
  return serverLabelsSchema.parse(raw);
}

/** One scored server for the scorer, from raw findings and a labels literal. */
export function scored(server: string, findings: readonly Finding[], rawLabels: unknown): ScoredServer {
  return { server, findings, labels: labels(rawLabels) };
}

const provenance = {
  kind: 'behavioral-inference' as const,
  source: 'test fixture — synthetic ground truth',
};

/** A minimal honesty label: a tool that truly warrants exactly `expected`. */
export function toolLabel(name: string, expected: readonly string[], extra: Record<string, unknown> = {}) {
  return {
    name,
    trueVerdict: expected.length > 0 ? 'undeclared' : 'consistent',
    trueRisk: {},
    expected: expected.map((ruleId) => ({ ruleId })),
    confidence: 'high',
    provenance,
    ...extra,
  };
}
