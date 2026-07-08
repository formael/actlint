<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Overview

## The problem

MCP tools describe themselves. Alongside a `name`, a `description`, and an `inputSchema`, a tool
may declare advisory annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, and
`openWorldHint`. Clients use these to decide when to prompt a human before calling a tool.

Nothing verifies them. A tool that deletes records can declare `readOnlyHint: true` and no part
of the protocol will object. Real safety decisions rest on these hints, and today they are taken
on faith.

actlint makes the hints checkable. For every tool a server advertises, it independently derives an
action-risk profile from the tool's name, description, and input schema, then compares that
against what the tool declares. Where the two disagree, it emits a finding with a written
rationale, a severity, and references to the external standards the gap touches. The result is a
human scorecard, a machine-readable report, and a CI exit code.

actlint is a linter in the lineage of `eslint`, `tflint`, and `hadolint`. It reads artifacts and
reports problems. It never calls a tool, never blocks a request, and never sits in an execution
path.

## Design principles

A linter is only useful if its output is believed. An unexplained false positive costs more trust
than many true positives earn back. The seven principles below serve that idea, and each is
enforced by a type, a test, or a CI check rather than by convention.

**Determinism.** The same input produces byte-identical findings. No clock, network, filesystem,
randomness, or model call exists anywhere in the scoring path. A CI guard scans imports; a
determinism check runs the pipeline twice and compares bytes.

**Explainability.** Every finding carries a non-empty rationale and at least one standards
reference. The `Finding` type cannot be constructed without them.

**Conservatism.** When the evidence is thin, actlint says `uncertain` rather than guessing.
`uncertain` lowers a finding's severity but never hides the finding, and it never fails a default
CI gate. Unknown input resolves to `unknown`, never to "safe".

**Narrow scope.** actlint checks one thing: whether a tool's declared annotations match what the
tool evidently does. Prompt-injection scanning, runtime privilege analysis, and authentication
belong to other tools. actlint reports; it never enforces.

**Standards-native.** Findings map to external frameworks through a versioned crosswalk: OWASP
ASI, the OWASP MCP Top 10, CoSAI/OASIS, the EU AI Act, and NIST. actlint does not invent a
private risk taxonomy.

**No phone-home.** actlint sends no telemetry. The only network activity is the fetch you
explicitly request, and the offline `--manifest` path needs no network at all.

**No overclaiming.** High-weight judgment entries in the vocabulary must cite a source. Output
copy is calm and concrete; severity is computed from a published policy table, never assigned by
hand.

## The pipeline

The tool runs in one straight sequence of five stages.

**Ingest** is the only stage that touches the outside world. It connects to a live server over
stdio or HTTP, reads a published server card, resolves a registry entry, or reads a captured
file, and produces a `ToolManifest`: a plain data value containing the server's tools.

**Normalize** happens at the same boundary. SDK types are translated into actlint's own types,
annotations become three-state hint values, and endpoints that may carry credentials are stored
redacted.

**Derive** produces an `ActionRiskProfile` for each tool by reading the tool's name, description,
and input schema against the vocabulary. This stage never reads the tool's annotations.

**Classify** compares each derived profile against the effective declared values and emits a
finding wherever they disagree.

**Report** renders the finding list as a human scorecard, a JSON report, or SARIF. The CLI wires
these stages together, parses arguments, and exits with a code the CI gate reads.

Everything from derivation onward is pure: same input, byte-identical output, on every machine.
Anyone can capture a manifest, re-run the pipeline, and get the same result. Every stage is
testable in isolation, and the one impure stage is small enough to audit by hand.

## What actlint checks and what it does not

actlint compares three derived aspects against the MCP annotations that govern them.

**Destructiveness** is compared against `readOnlyHint` and `destructiveHint`. An explicit
read-only claim is the more specific statement and takes precedence.

**External reach** is compared against `openWorldHint`.

**Reversibility** has no MCP hint, so this aspect only produces a low, non-gating nudge for
irreversible actions that are not otherwise flagged. It never produces a compliance failure
against a field that does not exist.

actlint does not attempt to detect malicious intent, hidden behavior, or anything that requires
running the tool. A tool whose description honestly says "permanently deletes the record" and
whose annotations say the same gets a clean report. actlint measures label honesty, not danger.
