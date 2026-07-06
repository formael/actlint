// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The CROSSWALK-COMPLETENESS contract (Invariant 5), as a suite-wide test. Every RuleId the engine
// can emit must map to at least one external standard or MCP field. Adding a rule without a mapping
// makes missingCrosswalkEntries() non-empty and fails the build — a finding that cannot locate
// itself in the standards landscape is unshippable.

import { describe, expect, it } from 'vitest';
import type { RuleId } from '../primitives.ts';
import { ruleIdSchema } from '../primitives.ts';
import { lookupStandards, missingCrosswalkEntries } from './crosswalk.ts';
import { ALL_RULE_IDS } from './rule-ids.ts';

describe('crosswalk completeness', () => {
  it('every RuleId in the closed set has a non-empty crosswalk entry', () => {
    expect(missingCrosswalkEntries()).toEqual([]);
  });

  it.each(
    ALL_RULE_IDS.map((id) => [id as string, id] as const),
  )('%s maps to at least one external standard or MCP field', (_label, ruleId) => {
    const ref = lookupStandards(ruleId);
    expect(ref).toBeDefined();
  });
});

describe('crosswalk gaps are caught, not tolerated', () => {
  it('a RuleId with no entry resolves to undefined (the completeness guard would flag it)', () => {
    const unmapped = ruleIdSchema.parse('rule-with-no-crosswalk-entry') as RuleId;
    expect(lookupStandards(unmapped)).toBeUndefined();
  });
});
