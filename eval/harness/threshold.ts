// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The merge gate — PURE. Turns a ScoreReport into a pass/fail decision against committed floors.
//
// The floors live in `eval/thresholds.json`, reviewed and versioned data like the vocabulary: an
// agent may propose a change, a human ratifies it. The gate is what lets contributors iterate
// aggressively on rules without drifting into an untrustworthy tool — a change that improves recall
// but tanks precision drops below the precision floor and FAILS CI.
//
// The floors are set conservatively for v0.x: the seed corpus is small, so per-rule numbers are
// statistically noisy. The aggregate precision floor is the load-bearing one (it is the false-flag
// guard); recall and F-beta floors are secondary and deliberately slack while the corpus is sparse.

import { z } from 'zod';
import type { ScoreReport } from './score.ts';

const boundedFloor = z.number().min(0).max(1);

export const thresholdsSchema = z
  .object({
    schemaVersion: z.literal(1),
    // Records why these particular floors were chosen; read by humans reviewing a floor change.
    notes: z.string().min(1).optional(),
    // The F-beta the floors were measured against; must match the scorer to be comparable.
    beta: z.number().positive(),
    aggregate: z
      .object({
        // The load-bearing false-flag guard: aggregate precision may not fall below this.
        minPrecision: boundedFloor,
        // Slack while the corpus is sparse; a floor, never the quality target.
        minRecall: boundedFloor,
        minFBeta: boundedFloor,
      })
      .readonly(),
  })
  .readonly();
export type Thresholds = z.infer<typeof thresholdsSchema>;

export interface GateResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

function pct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

// A null metric means the corpus produced no positive predictions (precision) or no ground-truth
// positives (recall). There is nothing to regress in that case, so a null passes vacuously — the
// corpus-completeness checks in the loader are what guard against an empty corpus.
function below(actual: number | null, floor: number): boolean {
  return actual !== null && actual < floor;
}

/** Decide whether a ScoreReport clears the committed floors. Pure over its inputs. */
export function evaluateGate(report: ScoreReport, thresholds: Thresholds): GateResult {
  const failures: string[] = [];
  const { minPrecision, minRecall, minFBeta } = thresholds.aggregate;
  const { precision, recall, fBeta } = report.aggregate;

  if (thresholds.beta !== report.beta) {
    failures.push(
      `beta mismatch: thresholds measured at beta ${thresholds.beta}, scorer ran at beta ${report.beta} — the numbers are not comparable`,
    );
  }
  if (below(precision, minPrecision)) {
    failures.push(`aggregate precision ${pct(precision)} is below the floor ${pct(minPrecision)}`);
  }
  if (below(recall, minRecall)) {
    failures.push(`aggregate recall ${pct(recall)} is below the floor ${pct(minRecall)}`);
  }
  if (below(fBeta, minFBeta)) {
    failures.push(`aggregate F${thresholds.beta} ${pct(fBeta)} is below the floor ${pct(minFBeta)}`);
  }

  return { passed: failures.length === 0, failures };
}

/** Validate parsed JSON as the committed thresholds. Throws a ZodError on any violation. */
export function parseThresholds(raw: unknown): Thresholds {
  return thresholdsSchema.parse(raw);
}
