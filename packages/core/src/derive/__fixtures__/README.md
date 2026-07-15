<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Derivation golden fixtures

Each file here is the **executable spec** for one signal family: a set of input tools and the exact
`DerivationResult` the engine must produce for each. Together with the property tests they *are* the
acceptance criteria for `derive`.

- `name-verb.json` — the tool name is the sole evidence; one case per verb family, plus a write-family
  case pinning that `write`/`overwrite`/`save`/`upsert` names resolve to the mutating family, and
  cases pinning a broadened lexeme (`migrate`, `provision`) to its family.
- `description-phrase.json` — prose as low-weight, supporting evidence (and a phrase-only case that
  stays low-confidence).
- `schema-shape.json` — the typed schema walk: declared formats, destination-shaped names, free-form
  code input, a **nested** destination found through an object, and a constrained string that is
  deliberately *not* free-form. Also the write-operation shapes: a `create`/`update`
  array-of-records param derives `mutating` and a `delete` array param derives `deleting` (with
  reversibility an evidence-backed unknown, never asserted irreversible) independent of the tool's
  name; a write-op name on a scalar param does **not** fire, and neither does a write-op-named
  *object* filter — only an array of records is the write signal, because an object is
  indistinguishable from a read tool's filter.
- `worked-example.json` — the end-to-end `exec_sql` case; the dishonest `readOnly: true` annotation is
  ignored because derivation is declaration-blind.
- `silence-and-unknown.json` — no matched signal derives all-`unknown`; blast radius is `unknown`,
  never a comfortable `contained`. Includes the screened reply-content verbs (`generate`, `install`),
  whose names deliberately resolve to silence rather than a write family.

Each case carries its own `intent`, so a future reader knows whether a diff is a fix or a regression.

> **These `expected` outputs are human-ratified.** An agent may *propose* a fixture; a human reviews
> the diff as if hand-written, because only a human catches a subtly-wrong *definition* of risk. A
> changed `expected` block is a behavior change to be understood, never rubber-stamped.
