<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Testing and quality

For a linter, correctness is the product. A false positive costs user trust; a wrong definition of
risk discredits every other finding. The test architecture is built in layers, each answering a
different question.

## The layers

### Unit and property tests

Every module carries unit tests (Vitest). The engine's key guarantees are expressed as property
tests (fast-check) rather than examples, because properties state the rule itself rather than a
sample of it.

The three properties that matter most:

**Monotonicity.** Adding signals to a tool can never make its derived profile less concerning.
Reassuring prose in a description can add contributions but cannot remove them.

**Conservatism.** Silence composes to `unknown`, never to a safe level, and a tool derived entirely
from silence is surfaced as `unassessed` rather than counted consistent. Blast-radius confidence
never exceeds its least confident input.

**Ordering invariance.** Findings do not depend on tool order or signal order.

### Golden fixtures

Captured manifests with expected findings, checked byte-for-byte. The derivation fixtures under
`packages/core/src/derive/__fixtures__/` pin the engine's behavior per signal family: name verbs,
description phrases, schema shapes, silence and unknowns, and a full worked example.

A fixture diff is a semantic event. It means the tool's judgment changed, and the diff must be
reviewed as such, never blind-accepted to make a build green.

### Contract tests

The promises other systems build on, each pinned by a dedicated test:

The `--json` report validates against the committed report schema, and the schema snapshot makes
any shape change an explicit semver decision. Every rule ID has a crosswalk entry (completeness),
and `makeFinding` refuses an unexplained or unmapped finding. Enum lists that are deliberately
re-declared across package layers (dimension levels, grades) are pinned identical by test.

### Static guards

Four scripts, run by `pnpm guards` and in CI, enforce the structural rules mechanically: purity
of the core packages, the SDK boundary, byte-level determinism across repeated runs, and
data-only vocabulary. They are described in detail in [Packages and boundaries](02-packages-and-boundaries.md).

### The eval corpus

The layer that measures whether actlint is right, not merely consistent. `eval/` (development
tooling, never published) holds captured manifests from real MCP servers with human-labeled ground
truth, and a harness that scores the engine against the labels.

Only honesty rules are scored; advisory nudges carry no verdict to be right or wrong about.

False positives are weighted above false negatives. The headline number is an F-beta with beta of
0.5, so precision dominates. No change can buy recall at the cost of precision.

`uncertain` on a genuinely ambiguous tool counts as correct. Conservatism is the right answer
where the ground truth itself is ambiguous, but a confident wrong flag is still a false positive.

Labels must cite how the tool's real behavior was established: source inspection, vendor docs, or
documented behavior. Labels based on the same manifest the linter sees would make the precision
number self-confirming.

The eval is a merge gate. Committed floors in `eval/thresholds.json` fail CI when a change drops
aggregate precision below the accepted level. Floors ratchet upward as the corpus grows; a
downward move requires a written, reviewed exception.

## Human review where it matters

A green build is necessary but not sufficient for changes to judgment. Vocabulary data, the
crosswalk, the severity and grade policies, eval labels, fixture expectations, and user-facing copy
are CODEOWNERS-protected. Tests verify these changes are consistent, but only a person can verify
a definition of risk is correct. Mechanism changes are gated by machines; judgment changes are
gated by people.

## Running the gates

```sh
pnpm check   # typecheck + lint + tests + the four guards
pnpm gate    # build + check + the eval corpus — the full pre-merge gate
```

Coverage is treated as a floor, not a goal. The layers above exist because each catches a class of
error that line coverage cannot see: a wrong judgment, a broken contract, a nondeterministic byte,
an unexplained finding.
