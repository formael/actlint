// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The report schema is a public API. Two guards live here:
//   1. the committed `schema/report.schema.json` is GENERATED from the Zod source of truth and
//      pinned by a file snapshot — a shape change updates the file and shows in the diff, which is
//      exactly the point where a semver decision is made;
//   2. the ServerGrade enum agrees across the engine and the vocabulary's grade-policy data.

import { serverGradeSchema as vocabGradeSchema } from '@formael/action-risk-vocabulary';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { REPORT_SCHEMA_VERSION, reportSchema } from './report-schema.ts';
import { serverGradeSchema } from './server-result.ts';

describe('report schema (the --json public API)', () => {
  it('carries a plain-semver version', () => {
    expect(REPORT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('the published JSON Schema is the one generated from the Zod contract', async () => {
    const jsonSchema = z.toJSONSchema(reportSchema, { target: 'draft-2020-12' });
    await expect(`${JSON.stringify(jsonSchema, null, 2)}\n`).toMatchFileSnapshot(
      '../schema/report.schema.json',
    );
  });

  it('pins the ServerGrade enum to the vocabulary grade-policy data', () => {
    expect(serverGradeSchema.options).toEqual(vocabGradeSchema.options);
  });
});
