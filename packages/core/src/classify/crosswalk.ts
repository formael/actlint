// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The engine-side accessor over the standards crosswalk DATA (versioned, human-gated, and living in
// the vocabulary package). Mechanism here; judgment there. This module answers two questions:
//   1. what standards does this RuleId map to?  (lookupStandards)
//   2. does every RuleId the engine can emit have an entry?  (missingCrosswalkEntries)
// The second is the crosswalk-completeness contract: a rule with no mapping cannot be shipped.

import { CROSSWALK } from '@formael/action-risk-vocabulary';
import type { StandardsRef } from '../finding.ts';
import type { RuleId } from '../primitives.ts';
import { ALL_RULE_IDS } from './rule-ids.ts';

// A crosswalk entry is "present" when it maps to at least one non-empty standards list. The
// vocabulary schema already enforces this shape; we re-check here so the engine never trusts an
// entry it did not verify itself.
function isNonEmptyRef(ref: StandardsRef | undefined): ref is StandardsRef {
  if (ref === undefined) return false;
  return [ref.owaspAsi, ref.owaspMcp, ref.cosaiOasis, ref.euAiAct, ref.nist, ref.mcpField].some(
    (arr) => arr !== undefined && arr.length > 0,
  );
}

/**
 * The standards mapping for a RuleId, or `undefined` if the crosswalk has no non-empty entry. A
 * finding whose RuleId returns `undefined` here cannot be constructed (makeFinding refuses it).
 */
export function lookupStandards(ruleId: RuleId): StandardsRef | undefined {
  const ref = CROSSWALK.map[ruleId as string] as StandardsRef | undefined;
  return isNonEmptyRef(ref) ? ref : undefined;
}

/**
 * Every RuleId the engine can emit that lacks a non-empty crosswalk entry. The completeness
 * contract test asserts this is empty; a planted rule with no mapping makes it fail the build.
 */
export function missingCrosswalkEntries(): readonly RuleId[] {
  return ALL_RULE_IDS.filter((id) => lookupStandards(id) === undefined);
}
