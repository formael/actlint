<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

## What this changes

<!-- One or two sentences. Keep the PR small and anchored to one component spec. -->

## Why

<!-- Link the issue, the arch doc section, or the component spec this implements. -->

## Checklist

- [ ] `pnpm check` is green locally (typecheck + lint + test + guards).
- [ ] This change stays **in lane**: measurement/reporting only — no enforcement, catalog, ledger, vault, or
      live policy evaluation.
- [ ] Purity holds: no clock/network/fs/randomness/model in `core`, `vocabulary`, or `reporters`.
- [ ] Any new snapshot diff was **reviewed as if hand-written**, not blind-accepted.
- [ ] Commits are signed off (`git commit -s`) per the DCO.

## Human-gate (check if this PR touches judgment or copy)

- [ ] This PR changes a CODEOWNERS-protected surface (vocabulary, crosswalk, severity policy, eval labels,
      fixture expected outputs, or user-facing copy). If so, it **proposes** — a maintainer decides. For
      high-weight vocabulary judgments, a 2025–2026 citation is included.
