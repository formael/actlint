// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Test builders for the reporter suites. They drive the REAL engine surface — findings are built
// through makeFinding, so severities, rationales, and the crosswalk are genuine, not mocked — while
// letting a fixture read as the scenario it encodes. Not part of the shipped surface (never imported
// by index.ts); pure (types, literals, and the pure core), so it stays clean under the guards.

import {
  type ActionRiskProfile,
  type Confidence,
  type Coverage,
  type DeclaredHint,
  type DeclaredProfile,
  type Dimension,
  type Finding,
  type ManifestSource,
  makeFinding,
  ruleIdSchema,
  type ServerResult,
  type SignalRef,
  type Verdict,
} from '@formael/actlint-core';
import { gradeServer } from './grade.ts';

export function sig(id: string, weight: SignalRef['weight'] = 'definitive'): SignalRef {
  return { id, weight };
}

export function dim<L extends string>(
  level: L,
  confidence: Confidence = 'high',
  provenance: readonly SignalRef[] = [],
): Dimension<L> {
  return { level, confidence, provenance };
}

// A benign baseline: a pure local read at high confidence. Override any dimension for a scenario.
export function profile(overrides: Partial<ActionRiskProfile> = {}): ActionRiskProfile {
  return {
    reversibility: dim('reversible'),
    destructiveness: dim('read-only'),
    externalReach: dim('local'),
    idempotency: dim('idempotent'),
    blastRadius: dim('contained'),
    ...overrides,
  };
}

export const hint = {
  true: { state: 'true' } as DeclaredHint,
  false: { state: 'false' } as DeclaredHint,
  absent: { state: 'absent' } as DeclaredHint,
};

export function declared(overrides: Partial<Omit<DeclaredProfile, 'unknownHints'>> = {}): DeclaredProfile {
  return { unknownHints: {}, ...overrides };
}

export interface FindingSpec {
  readonly ruleId: string;
  readonly toolName: string;
  readonly verdict: Verdict;
  readonly confidence: Confidence;
  readonly derived: ActionRiskProfile;
  readonly declared: DeclaredProfile;
  readonly signals: readonly SignalRef[];
}

/** Build a Finding through the real smart constructor, or throw if it refuses (a broken fixture). */
export function buildFinding(spec: FindingSpec): Finding {
  const built = makeFinding({
    ruleId: ruleIdSchema.parse(spec.ruleId),
    toolName: spec.toolName,
    verdict: spec.verdict,
    confidence: spec.confidence,
    derived: spec.derived,
    declared: spec.declared,
    signals: spec.signals,
  });
  if (!built.ok) {
    throw new Error(`fixture could not build a Finding for ${spec.ruleId}: ${built.error.message}`);
  }
  return built.value;
}

export interface ServerResultOptions {
  readonly source?: ManifestSource;
  readonly toolCount?: number;
  readonly coverage?: Coverage;
  readonly actlintVersion?: string;
  readonly vocabularyVersion?: string;
  readonly crosswalkVersion?: string;
  readonly reportSchemaVersion?: string;
}

/**
 * Assemble a ServerResult the way the shell will: findings in, grade computed by gradeServer, fixed
 * metadata so snapshots are stable. `toolCount` defaults to the number of distinct tools with a
 * finding; pass a larger value to model consistent tools that produced none. `coverage` defaults to
 * a fully-assessed, fully-annotated server; override it to exercise the unassessed/silent paths.
 */
export function serverResult(findings: readonly Finding[], options: ServerResultOptions = {}): ServerResult {
  const distinctTools = new Set(findings.map((f) => f.toolName)).size;
  const toolCount = options.toolCount ?? distinctTools;
  const coverage: Coverage = options.coverage ?? {
    assessedTools: toolCount,
    unassessedTools: 0,
    annotatedTools: toolCount,
    unassessedToolNames: [],
  };
  return {
    source: options.source ?? { kind: 'server-card', url: 'https://example.com/.well-known/mcp' },
    findings,
    toolCount,
    grade: gradeServer(findings, toolCount),
    coverage,
    reportSchemaVersion: options.reportSchemaVersion ?? '1.1.0',
    actlintVersion: options.actlintVersion ?? '0.1.0',
    vocabularyVersion: options.vocabularyVersion ?? '0.1.0',
    crosswalkVersion: options.crosswalkVersion ?? '0.1.0',
  };
}
