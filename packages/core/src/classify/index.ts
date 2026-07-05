// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The classification layer's public surface: the comparator, the advisory detector, the smart
// constructor, the orchestration, and the closed RuleId taxonomy with its crosswalk/severity readers.

export { classify } from './classify.ts';
export { advisories } from './advisories.ts';
export { makeFinding } from './make-finding.ts';
export type { MakeFindingInput } from './make-finding.ts';
export { classifyTool, classifyManifest } from './classify-tool.ts';
export type { RawFinding } from './raw-finding.ts';
export { computeSeverity } from './severity.ts';
export { lookupStandards, missingCrosswalkEntries } from './crosswalk.ts';
export { RULE, ALL_RULE_IDS, HONESTY_RULES, ADVISORY_RULES, ruleClassOf } from './rule-ids.ts';
