<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Analysis pipeline

This document walks the pipeline from a captured manifest to a rendered report. Every stage after
ingestion is a pure function. The code lives in `packages/core` for derivation, classification,
and severity, and in `packages/reporters` for grading and rendering.

## Stage 1: Ingestion and normalization

`mcp-fetch` acquires a server's advertised tool list from one of four sources: a live server
(stdio or Streamable HTTP), a published server card, an MCP Registry entry, or a previously
captured file.

It only ever lists tools. It issues the MCP handshake and `tools/list`, never `tools/call`. A
test asserts the call method is absent from the package.

A launched stdio server runs with a sanitized environment — the SDK's minimal defaults plus any
variables named with `--env`, and nothing else — so a credential reaches the child only when the
caller asks for it. An `--http` connection may carry a `--header` credential; header values, like
endpoints, are held only long enough to make the request. A protected server that answers an
unauthenticated `tools/list` with HTTP 401 becomes a typed `auth-required` ingestion error: actlint
reads the `WWW-Authenticate` challenge the server already sent, reports what it asked for, and issues
no request of its own. It maps to exit 3, never a partial score.

Everything is normalized at the boundary. SDK output is translated into actlint's own
`ToolManifest` types immediately, annotations become three-state `DeclaredHint` values, and
endpoints or credentials that could leak are stored redacted. Any failure becomes a typed
`IngestError`.

Any manifest can be written to disk with `--capture` and replayed with `--manifest`. This is how
fixtures are made and how scoring stays reproducible across time and machines.

## Stage 2: Derivation

`derive(tool, vocabulary)` produces the tool's `ActionRiskProfile`. It reads only the tool's
`name`, `description`, and `inputSchema`, never the tool's annotations. Derivation is
declaration-blind: what a tool says about itself is evidence to be audited in the next stage, not
an input to the audit. A tool cannot influence its own derived profile by declaring favorable
annotations.

Derivation has two halves: extraction, then composition.

### Extraction

Three extractors run over the tool, each matching against the vocabulary's signal entries.

| Extractor | Reads | Example |
|---|---|---|
| Name verbs | tokenized tool name | `delete_user` matches the deletion verb family |
| Description phrases | the description text | "permanently removes" matches a deletion phrase |
| Schema shape | parameter names and formats in `inputSchema` | a `url` parameter argues for open-world reach |

Each match yields a contribution: a dimension, a level, a weight, and a confidence, all taken from
the vocabulary entry that matched. Schema-shape signals carry the highest weights because they are
language-independent structure; description phrases carry the lowest because prose is easy to
write and easy to game.

A schema-shape signal can require a conjunction of a parameter name and its JSON Schema type — for
example a container-typed parameter keyed `create`, `update`, or `delete`. That lets a write-shaped
input schema stand as write evidence on its own, so a mutating tool is caught even when its name uses
a verb the vocabulary has never seen.

### Composition

The composer folds all contributions into one profile, one dimension at a time, under four rules.

1. Highest concern wins. If contributions disagree on a level, the most concerning concrete level
   any of them argues for is taken. Weight and confidence decide how sure the result is, not which
   level wins.

2. Confidence is earned. The result's confidence is the strongest single support for the winning
   level, where each support is capped by its own weight. A lone low-weight signal cannot produce
   a high-confidence reading.

3. Conflict lowers confidence, not concern. When a safety-claiming signal (read-only, local,
   reversible) contradicts a more concerning winner, the concerning level stands but its confidence
   is capped. Under-claiming a risk is the worse error, so a conflicted tool is flagged softly.

4. Silence is `unknown`, never safe. A dimension no signal spoke to becomes
   `{ level: 'unknown', confidence: 'uncertain' }` with empty provenance.

Blast radius is computed last, from the four sensed dimensions, and inherits their uncertainty.
Its confidence can never exceed the lowest confidence among its inputs.

Together, these rules make derivation monotone: adding reassuring prose can add contributions but
can never remove one, and the composer only moves toward concern. Property tests assert this
directly.

## Stage 3: Classification

`classify(derived, declared)` compares the derived profile against the effective declared values
(each hint resolved against its MCP spec default when absent) and emits at most one raw finding
per aspect.

Three aspects are compared.

**Destructiveness**, governed by `readOnlyHint` and `destructiveHint` together. An explicit
read-only claim is the more specific statement and takes precedence, so the classifier never
double-reports the same dishonesty under both hints. A `destructiveHint: false` on a mutating
tool is only under-declared when the mutation is corroborated as irrecoverable; a reversible
toggle honestly declaring itself non-destructive is consistent, not dishonest.

**External reach**, governed by `openWorldHint`.

**Reversibility**, which has no MCP hint. This only produces a low, non-gating nudge for an
irreversible action (a payment, a send) that is not otherwise flagged.

Two judgment rules shape every comparison.

The verdict asymmetry: an explicit false claim that removes a safety prompt (`under-declared`) is
far more serious than silence the spec default already covers (`undeclared`), which is about as
mild as honest over-caution (`over-declared`). A spec-following client already prompts on an
absent `destructiveHint`; it is the explicit `false` that turns the prompt off, so that is where
the severity lives.

Silence cannot accuse: a derived `unknown` with no provenance (no signal fired) may not contradict
an explicit declaration. Letting the engine's own vocabulary gap generate an accusation would
produce a finding whose only reason is that nothing was found, which is a false positive by
construction.

Separately from the honesty comparison, advisory checks read the schema shape directly (for
example, a free-form string parameter a tool will execute as code) and emit non-gating hygiene
findings.

## Stage 4: Severity and the finished finding

Severity is computed, never hand-assigned. A published policy table in the vocabulary package maps
each verdict to a base severity. The finding's confidence then steps it down a fixed ladder
(`info`, `low`, `medium`, `high`, `critical`), and a per-rule floor may apply. An `uncertain`
under-declaration is softened, never suppressed, never promoted. "Why is this critical?" is always
answerable by reading the table.

`makeFinding` then assembles the final `Finding`. It generates the rationale from the finding's
provenance (the signals, the levels, the declared states), attaches the standards references from
the crosswalk, and refuses to construct anything with an empty rationale or an empty standards
mapping.

## Stage 5: The grade and the reports

The reporters reduce the finding list to output. They render; they never re-score.

**The grade** (A through F) is a deterministic reduction of the honesty findings, driven entirely
by published policy data. Each tool is counted once under its worst verdict, verdict weights
produce a score in [0, 1], the score selects a band, and the presence of any under-declared tool
or any critical finding caps the grade regardless of score. Advisory findings never move it. The
grade measures how honestly a server labels its actions, not how safe the server is.

**Coverage** is reported alongside the grade. A tool no signal spoke to is `unassessed`, and every
rendering says so — the scorecard qualifies the grade line with "assessed N of M tools" and the JSON
report carries a `coverage` block. An unassessed tool is never counted as consistent: presenting
actlint's own recall gap as a clean bill of health would spend the trust the tool exists to hold. This
makes silence visible without letting it accuse — the Stage 3 rule that a signal-free `unknown` cannot
contradict a declaration is unchanged.

**Three renderings** of the same `ServerResult`:

| Output | Audience |
|---|---|
| Human scorecard (default) | a developer at a terminal: grade, per-tool table, rationales |
| `--json` | dashboards and importers: a versioned, schema-validated public API |
| `--sarif` | code-scanning platforms: SARIF 2.1.0 |

**The exit code** is the fourth view. The CI gate reads the finished finding list and fails the
build when any honesty finding sits at or above the `--fail-on` threshold. Advisory findings never
gate, and an `uncertain` finding never fails the default gate because its confidence has already
stepped its severity down. The gate contains no analysis of its own; by the time it runs, every
judgment has already been made and explained.
