// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The classification layer's public surface: the comparator, the advisory detector, the smart
// constructor, the orchestration, and the closed RuleId taxonomy with its crosswalk/severity readers.

export { advisories } from './advisories.ts';
export { classify } from './classify.ts';
export { classifyManifest, classifyTool } from './classify-tool.ts';
export { lookupStandards, missingCrosswalkEntries } from './crosswalk.ts';
export type { MakeFindingInput } from './make-finding.ts';
export { makeFinding } from './make-finding.ts';
export type { RawFinding } from './raw-finding.ts';
export { ADVISORY_RULES, ALL_RULE_IDS, HONESTY_RULES, RULE, ruleClassOf } from './rule-ids.ts';
export { computeSeverity } from './severity.ts';
