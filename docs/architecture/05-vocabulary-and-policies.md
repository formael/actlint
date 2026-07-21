<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Vocabulary and policies

All of actlint's judgment lives in versioned JSON data, not in code. The engine is mechanism; the
data is opinion. The separation buys three things.

A judgment change is a reviewable diff to a data file, visible in isolation, not a logic change
buried in an algorithm. The data is independently versioned and published as
`@formael/action-risk-vocabulary`, so other tools can consume the same definitions and a user can
pin the judgment (`--vocabulary`) separately from the tool version. The data is schema-validated at
load, so a malformed entry fails loudly at import rather than silently skewing results.

## The five datasets

`packages/vocabulary/data/` holds five files, each with a JSON Schema in
`packages/vocabulary/schema/` and a Zod mirror that validates it at load.

| File | What it holds |
|---|---|
| `vocabulary.json` | the signal entries: which names, phrases, and schema shapes argue for which risk levels |
| `mcp-mapping.json` | how actlint's five dimensions map onto MCP's four annotation hints |
| `crosswalk.json` | each rule ID mapped to the external standards and regulations it is relevant to |
| `severity-policy.json` | the table severity is computed from: base severity per verdict, confidence adjustments, per-rule floors |
| `grade-policy.json` | the verdict weights, score bands, and caps behind the A through F grade |

Each dataset carries its own semver, exported alongside the data, and every report records the
versions that produced it.

## Anatomy of a vocabulary entry

```json
{
  "id": "verb.delete",
  "signal": { "kind": "name-verb", "match": ["delete", "remove", "destroy", "purge"] },
  "contributes": {
    "destructiveness": { "level": "deleting", "weight": "high" },
    "reversibility":   { "level": "irreversible", "weight": "medium" }
  },
  "evidence": "why this signal means what it says",
  "citation": "required whenever any contribution carries high weight",
  "confidence": "high"
}
```

`signal` is one of three kinds: `name-verb` (exact-token match on the tool name after case and
separator normalization), `description-phrase` (match in the description text), or `schema-shape`
(parameter names or string formats in the input schema).

`contributes` names one or more of the four sensed dimensions with a level and a weight. Blast
radius cannot appear here; it is a computed composite formed only by the engine, never asserted
by data.

`evidence` is mandatory prose explaining the judgment. `citation` is mandatory whenever any
contribution carries high weight: a strong opinion must name its source. The schema enforces both.

The vocabulary file also carries a `limitations` list, a plain-language account of what the
current data cannot see (non-English verbs, negation, uncommon aliases). Publishing the
limitations is part of the no-overclaiming principle: the dataset states its own blind spots
rather than letting users discover them.

## Data, not code

The vocabulary package contains no scoring, walking, or composition logic. A CI guard
(`pnpm guard:vocabulary`) fails if any creeps in. The division of labor is strict: the data says
which token argues for which level at which weight, and the engine decides what to do when signals
agree, disagree, or stay silent.

This is also why blast radius is scored by a function in core rather than looked up in a table.
Its uncertainty propagation (never more confident than its least confident input) is mechanism,
and mechanism belongs in code where it can be property-tested.

## Growth discipline

The seed vocabulary covers the high-signal verb families (read, create, mutate, delete, send,
transfer) and the strongest schema shapes — free-form code input, external destinations, and
write- and delete-operation structure — rather than attempting breadth. A schema-shape entry can
condition on a parameter's type as well as its name, so write-operation structure argues for a
mutating tool without a matching name verb. Every entry is a potential source of false positives, so
additions must earn their place.

An addition must carry evidence, and a citation when high-weight. It must pass the eval corpus
without dropping precision below the committed floor. And it must be reviewed by a human.
Vocabulary data, the crosswalk, and both policies are CODEOWNERS-protected: a build can verify a
change is consistent, but only a person can verify a definition of risk is correct. A subtly wrong
definition is the one bug a linter cannot afford.

Because tightened data can create new findings on previously green pipelines, vocabulary changes
interact with the baseline mechanism. The public contracts document covers how a vocabulary bump
avoids breaking adopters.
