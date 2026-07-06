<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# eval — the quality number that defends the scorecard

`actlint`'s output is *evaluable*: given real MCP servers with human-labelled ground truth, we can
measure the precision and recall of every finding type. That turns "is the linter good?" from an
opinion into a defensible number — the exact trust a linter must earn, and the direct answer to the
false-positive problem the field already has.

This directory is **impure tooling and is never published.** It reads the corpus from disk and runs
the pure core over it; the scoring itself is a pure function.

## Layout

```
eval/
  corpus/<server-id>/
    manifest.json   # a captured tools/list — exactly what the linter sees
    labels.json     # expert ground truth per tool, with a mandatory, cited provenance
  harness/          # the loader (impure) + the scorer, gate, and formatter (pure)
  thresholds.json   # the committed merge-gate floors (reviewed, versioned data)
```

## Running it

```
pnpm build   # the scorer runs the built core
pnpm eval    # score the corpus, print the table, exit non-zero if precision regresses
```

## How the number is computed

- **Only honesty rules are scored.** Advisory (hygiene) findings carry no verdict and no ground
  truth, so they are neither rewarded nor penalised.
- **False positives are weighted above false negatives.** A false flag spends trust, which is the
  tool's only asset. The headline number is an F-beta with `beta = 0.5`, which weights precision (the
  cost of a false positive) above recall. This is what stops anyone from "improving recall" by making
  the tool cry wolf.
- **`uncertain` on a genuinely ambiguous tool counts as correct.** On a tool a labeller marks
  `ambiguous`, an `uncertain` finding or silence is never penalised, and a miss is not a false
  negative — but a *confident* wrong flag still counts as a false positive.
- **Per-rule, not just aggregate**, so a regression is localised to the rule that caused it.

## The label provenance requirement

Every label must cite **how the tool's actual behaviour was established** — not merely what the
labeller believed from reading the manifest. A precision figure computed against manifest-only labels
is self-confirming: the labeller and the linter would have identical evidence. The accepted kinds,
strongest first:

| Kind | Meaning |
|---|---|
| `source-inspection` | the labeller read the server's source; cite the file (+ commit) |
| `vendor-docs` | cite official vendor documentation (URL + access date) |
| `documented-behavior` | cite the server's own README/changelog |
| `behavioral-inference` | inferred from name + schema + description only; the weakest |

This requirement is expensive to fill, and that expense is what makes the number credible.

## The merge gate

The eval is a **merge gate**: a change — vocabulary, engine, or crosswalk — that improves recall but
tanks precision drops below the committed precision floor and fails CI. The floors in
`thresholds.json` are set conservatively for v0.x: the seed corpus is small, so per-rule numbers are
noisy and only the aggregate, micro-averaged floors are gated. Raise them as the corpus grows.

