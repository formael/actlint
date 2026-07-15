<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# @formael/action-risk-vocabulary

[![npm](https://img.shields.io/npm/v/@formael/action-risk-vocabulary?logo=npm)](https://www.npmjs.com/package/@formael/action-risk-vocabulary)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

**Pure data.** This package is the _judgment_ behind [actlint](https://github.com/formael/actlint) — the
action-risk vocabulary, the MCP-hint mapping, and the standards crosswalk — carried as JSON-Schema'd,
independently versioned data. It contains **no executable code**: every mechanism that reads this data (the
scoring, the composition, `scoreBlastRadius`) lives in the engine, `@formael/actlint-core`. Keeping judgment
as versioned data and mechanism as code is deliberate: it lets the data be reviewed, diffed, and consumed by
any tool without importing a linter.

## The data

Each dataset is validated against its JSON Schema at import (via a Zod mirror) so a malformed change fails
loudly, and each carries its own `version` field.

| Import path | What it is |
|---|---|
| `./data/vocabulary.json` | The action-risk vocabulary: the lexemes and schema-shape signals that contribute to a derived profile, each high-weight judgment backed by a cited 2025–2026 source. |
| `./data/mcp-mapping.json` | The mapping from actlint's action-risk dimensions onto MCP's four annotation booleans (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). |
| `./data/crosswalk.json` | The standards & regulatory crosswalk: each `RuleId` → the external frameworks it maps to (OWASP ASI, the OWASP MCP Top 10, CoSAI/OASIS, the EU AI Act, NIST). |
| `./data/severity-policy.json` | The reviewable table the engine reads to compute a finding's severity from its verdict, rule class, and confidence. Severity is never hand-assigned. |

Every dataset has a matching JSON Schema under `./schema/<name>.schema.json`. Import the parsed, frozen
values and their inferred types from the package root:

```ts
import { VOCABULARY, MCP_MAPPING, CROSSWALK, SEVERITY_POLICY } from '@formael/action-risk-vocabulary';
```

## Versioning

The vocabulary is versioned **independently** from the engine and the report schema — a data change ships on
its own semver line, and each embedded dataset above carries its own `version`. The governing rule is
**conservatism**:

- **MAJOR** — any change that can _flip_ a tool's verdict or tighten a classification, so an unchanged
  server can newly fail. Baselines exist to make these adoptable without a red build on day one.
- **MINOR** — new lexemes, signals, or crosswalk entries that only add detection, never re-classifying an
  existing input more leniently.
- **PATCH** — clarifications, citations, and wording that change no classification.

Unknown or future inputs always resolve conservatively — never to a benign default.

## Coverage and limitations

The write families cover the common write, create, mutate, and delete verbs, and two language-independent
schema shapes carry a write claim when the name verb is out of vocabulary: a parameter named like a write
operation (`create`, `update`, …) or a delete operation (`delete`, `remove`, …) whose value is an **array of
records**. The array requirement is deliberate — a single object is indistinguishable from a read tool's
filter, so it resolves to silence rather than risk a false read-only flag.

Coverage grows by evidence, not by guessing: several write-adjacent tokens (`generate`, `install`, `store`,
`record`, `snapshot`, `commit`, `stage`, `load`) are deliberately screened out as reply-content verbs or
noun/verb homographs, because matching any name token would make them misfire inside common reads
(`get_store`, `get_commit`). The vocabulary's own `limitations` field records every such screen and the
reasoning, so the next reviewer sees the judgment, not a gap.

## A note on trust

This directory is CODEOWNERS-protected. A subtly-wrong _definition_ of risk is the one bug that discredits
the whole tool, and only a human can catch it: a green build is necessary but never sufficient for a change
here. An agent may propose; a human ratifies.

## Links

- **Repository, docs, and issues:** <https://github.com/formael/actlint>
- **License:** [Apache-2.0](./LICENSE). Developed by [Formael](https://formael.com).
