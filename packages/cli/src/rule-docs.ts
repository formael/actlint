// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The rule documentation `explain` renders — the meaning, the reason, an example, and the fix for
// each rule. This is the single source for that prose, so what the terminal prints and what a docs
// site would show cannot drift. The standards crosswalk is NOT duplicated here: it lives once in the
// vocabulary data and is looked up at render time, so a rule speaks to one crosswalk everywhere.
//
// This is product copy: calm and concrete, no fear-mongering and no severity theatre. A finding is
// not a compliance verdict; the fix is a plain next step, not an alarm.

export interface RuleDoc {
  readonly title: string;
  /** What the rule detects, in one plain sentence. */
  readonly meaning: string;
  /** Why it matters — the honest cost of the mislabel. */
  readonly reason: string;
  /** A short, concrete instance. */
  readonly example: string;
  /** The plain next step that resolves it. */
  readonly fix: string;
}

// Keyed by RuleId string. Every RuleId the engine can emit has an entry (a test asserts it), so
// `explain <ruleId>` never lands on a rule with no documentation.
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'write-as-readonly': {
    title: 'Write declared as read-only',
    meaning:
      'The tool declares readOnlyHint: true, but its name, description, and schema derive an action that writes.',
    reason:
      'readOnlyHint: true is an explicit claim that a tool cannot change state. A client may skip a confirmation prompt on that claim. If the tool in fact mutates or deletes, the claim removed a safety step that would otherwise have been shown.',
    example: 'A tool named `exec_sql` with a free-form `sql` parameter, annotated readOnlyHint: true.',
    fix: 'Remove readOnlyHint (or set it to false) so the tool is described as the write it is. If it truly only reads, narrow its schema so that is legible.',
  },
  'destructive-unflagged': {
    title: 'Destructive action declared non-destructive',
    meaning:
      'The tool declares destructiveHint: false, but it derives an action that mutates or deletes existing state.',
    reason:
      'destructiveHint: false is an explicit claim that an action does not destroy data. Where it is wrong, it suppresses the exact prompt a spec-following client would otherwise show for a destructive action.',
    example: 'A tool named `delete_repository` annotated destructiveHint: false.',
    fix: 'Remove destructiveHint, or set it to true so the destructive effect is stated plainly.',
  },
  'external-reach-undeclared': {
    title: 'External reach declared local',
    meaning:
      'The tool declares openWorldHint: false, but it derives an action that reaches an open, external world.',
    reason:
      'openWorldHint: false is an explicit claim that a tool acts only within a closed, local domain. Where it is wrong, a reviewer under-estimates the tool’s reach — for example, that it can contact arbitrary hosts.',
    example: 'A tool named `send_webhook` taking an arbitrary `url`, annotated openWorldHint: false.',
    fix: 'Remove openWorldHint, or set it to true so the external reach is declared.',
  },
  'destructive-absent': {
    title: 'Destructive action, no destructive hint',
    meaning: 'The tool derives a destructive write and declares no destructiveHint either way.',
    reason:
      'This is an informational nudge, not a false claim: the MCP spec default already treats an absent destructiveHint as destructive, so a spec-following client still prompts. Declaring it explicitly makes the tool self-describing.',
    example: 'A tool named `drop_table` with no annotations block.',
    fix: 'Add destructiveHint: true so the effect is declared rather than left to the spec default.',
  },
  'reach-absent': {
    title: 'Open-world action, no open-world hint',
    meaning: 'The tool derives open external reach and declares no openWorldHint either way.',
    reason:
      'An informational nudge: the spec default already treats an absent openWorldHint as open-world, so nothing is hidden. Declaring it explicitly makes the reach legible without relying on the default.',
    example: 'A tool named `fetch_url` taking an arbitrary `url`, with no annotations block.',
    fix: 'Add openWorldHint: true to state the external reach explicitly.',
  },
  'irreversible-unflagged': {
    title: 'Irreversible action not flagged',
    meaning:
      'The tool derives an irreversible effect that is not an obvious destructive write, and it has not declared the effect as destructive.',
    reason:
      'Some irreversible actions — a payment, a message send — are not deletions, so the destructive prompt may not apply, yet the effect cannot be undone. A low, non-gating nudge to state that plainly.',
    example: 'A tool named `charge_card` that moves money and declares nothing about reversibility.',
    fix: 'State the irreversible effect in the description, or declare destructiveHint: true if that fits the action.',
  },
  'over-declared-risk': {
    title: 'Declared riskier than derived',
    meaning:
      'The tool declares a risk — destructive, or not read-only, or open-world — that its derivation does not support.',
    reason:
      'Over-declaration is the safe direction, so this is the lowest-severity honesty finding. It is still worth surfacing: consistent over-caution trains reviewers to ignore prompts, which erodes the value of the honest ones.',
    example: 'A pure local read annotated destructiveHint: true.',
    fix: 'If the caution is deliberate, keep it. If it is a copy-paste of another tool’s annotations, align the hint with what the tool actually does.',
  },
  'freeform-input-as-code': {
    title: 'Free-form input that reads as code',
    meaning:
      'A capability-hygiene advisory: a free-form string parameter looks like it accepts code, a command, or a query rather than a constrained value.',
    reason:
      'This is not an honesty verdict and never gates by default. It flags a shape where the tool’s real capability is bounded only by what a caller passes — useful context for a reviewer sizing the tool.',
    example: 'A `command` or `sql` string parameter with no enum, pattern, or format.',
    fix: 'Where possible, constrain the parameter (an enum, a pattern, a narrower type) so the capability is bounded by the schema, not the caller.',
  },
  'no-scope-constraint': {
    title: 'No scope constraint in the schema',
    meaning:
      'A capability-hygiene advisory: the input schema places no constraint that bounds the tool’s scope of effect.',
    reason:
      'Not an honesty verdict and never gating by default. An unconstrained schema means the schema itself tells a reviewer little about how far the tool can reach.',
    example: 'A tool whose only parameter is an open object with additionalProperties allowed.',
    fix: 'Add the constraints that describe the intended scope — required fields, enums, or patterns — so the schema documents the boundary.',
  },
};
