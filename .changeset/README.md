<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Changesets — how actlint versions itself

Every pull request that changes a published surface ships a changeset. Run `pnpm changeset`, pick
the packages that changed, pick the bump, and write the note. Releases are a reviewed **Version
Packages** PR opened by CI — never a manual `npm publish`.

## The published surfaces version independently

| Package | Line | A breaking (MAJOR) change is |
|---|---|---|
| `actlint` | the **code** line — CLI, engine, reporters, fetch (bundled) | a removed flag, a changed exit-code meaning, a renamed `RuleId` |
| `@formael/action-risk-vocabulary` | the **vocabulary/crosswalk** line | a change that *flips* an existing tool's classification and turns a passing gate red |

The internal packages (`@formael/actlint-core`, `-reporters`, `-mcp-fetch`) are `private` and bundled
into `actlint`; they are never published and never need a changeset. The **report-schema** version is
a third line, but it lives as `reportSchemaVersion` inside the code, not as its own npm package — bump
it in code, and note the bump in the `actlint` changeset.

## The one rule that governs the vocabulary bump

> **Broadening what counts as risky is a MINOR** (shipped with baseline guidance, so an early adopter
> is never punished for upgrading). **Flipping an existing tool's classification in a way that changes
> a CI result is a MAJOR.** The same rule governs the crosswalk and the severity policy.

We never silently turn someone's green pipeline red. Choosing MINOR when the honest answer is MAJOR is
the mistake this note exists to catch in review.

## Vocabulary / crosswalk / severity changesets carry a mandatory finding-impact note

A definition change changes *output*, and output is what someone's CI gate keys on. So the changeset
must state the finding-level impact in plain terms, e.g.:

```
---
"@formael/action-risk-vocabulary": minor
---

Add the "webhook" lexeme to the external-reach dimension.

Finding impact: adds `external-reach-undeclared` findings on tools whose description mentions a
webhook; flips 0 existing classifications. MINOR + baseline (broadening only).
```

The reviewer approves the semver call against this note, not against a guess. The eval gate also runs
on every vocabulary PR, so a definition change cannot regress precision under cover of a "MINOR."
