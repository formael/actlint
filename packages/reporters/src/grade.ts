// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// gradeServer — the deterministic, EXPLAINED reduction of a finding set to a single letter. It is
// driven solely by honesty-rule findings (advisory hygiene never moves the grade), and every step
// is answerable from published data: a weighted honesty score over the per-tool summary picks a
// band, then the worst dishonesty present imposes a ceiling.
//
// It grades labelling HONESTY, not safety: a server that declares all its destructive tools
// truthfully scores an A. All the tunable judgment — the weights, the bands, the caps — lives in
// the vocabulary's grade-policy DATA, so a grade change is a reviewable diff and a MAJOR event.

import { GRADE_POLICY } from '@formael/action-risk-vocabulary';
import { type Finding, type ServerGrade, serverGradeSchema } from '@formael/actlint-core';
import { summarize } from './summary.ts';

// Best grade first — the letters as their own ordinal. Sourced from the shared enum so it can never
// drift from the grade-policy data.
const GRADE_BEST_FIRST: readonly ServerGrade[] = serverGradeSchema.options;

// The worse (lower) of two grades — used to apply a ceiling: a capped grade can never be better
// than the cap, but a score that already earned worse keeps its worse grade.
function worse(a: ServerGrade, b: ServerGrade): ServerGrade {
  return GRADE_BEST_FIRST.indexOf(a) >= GRADE_BEST_FIRST.indexOf(b) ? a : b;
}

/**
 * The honesty score in [0,1]: the weighted mean of per-tool honesty, one tool per its worst
 * verdict. A server with no tools is vacuously honest (1.0). Pure over its inputs and the policy.
 */
function honestyScore(findings: readonly Finding[], toolCount: number): number {
  if (toolCount <= 0) return 1;
  const summary = summarize(findings, toolCount);
  const w = GRADE_POLICY.weights;
  const weighted =
    summary.consistent * w.consistent +
    summary.undeclared * w.undeclared +
    summary.overDeclared * w['over-declared'] +
    summary.underDeclared * w['under-declared'];
  return weighted / toolCount;
}

/**
 * The honesty grade for a server. The score selects the first band it meets or exceeds (bands are
 * best-first, bottoming out at 0), then the presence of any under-declared tool — and, worse, a
 * critical one — caps the grade no matter how high the score. The strictest applicable cap wins.
 */
export function gradeServer(findings: readonly Finding[], toolCount: number): ServerGrade {
  const score = honestyScore(findings, toolCount);

  const bands = GRADE_POLICY.bands;
  // The lowest band (minScore 0, schema-guaranteed) is the floor every score reaches.
  let grade: ServerGrade = bands[bands.length - 1]?.grade ?? 'F';
  for (const band of bands) {
    if (score >= band.minScore) {
      grade = band.grade;
      break;
    }
  }

  const honesty = findings.filter((f) => f.ruleClass === 'honesty' && f.verdict === 'under-declared');
  if (honesty.length > 0) {
    grade = worse(grade, GRADE_POLICY.caps.anyUnderDeclared);
    if (honesty.some((f) => f.severity === 'critical')) {
      grade = worse(grade, GRADE_POLICY.caps.criticalUnderDeclared);
    }
  }

  return grade;
}
