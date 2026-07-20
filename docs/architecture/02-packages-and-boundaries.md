<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Packages and boundaries

actlint is a pnpm workspace of five source packages plus a GitHub Action wrapper. Each package has
one job, and the import rules between them are enforced by CI, not by convention.

## The packages

```
packages/
  core/           PURE.       manifest + vocabulary -> profiles -> findings.
  vocabulary/     PURE DATA.  the risk vocabulary, policies, and standards crosswalk, as JSON.
  reporters/      PURE.       findings -> human scorecard / JSON report / SARIF.
  cli/            SHELL.      the `actlint` command: fetch -> core -> reporters -> exit code.
  mcp-fetch/      IMPURE.     the only network code; the only place the MCP SDK appears.
  github-action/  WRAPPER.    a thin CI wrapper around the CLI; distributed by git tag, not npm.
```

| Package | npm name | Published |
|---|---|---|
| `cli` | `actlint` | yes — the product |
| `vocabulary` | `@formael/action-risk-vocabulary` | yes — independently versioned data |
| `core` | `@formael/actlint-core` | no — bundled into the CLI at build time |
| `reporters` | `@formael/actlint-reporters` | no — bundled into the CLI at build time |
| `mcp-fetch` | `@formael/actlint-mcp-fetch` | no — bundled into the CLI at build time |

The published `actlint` package is self-contained. `tsup` bundles the workspace packages into its
`dist`, and its only runtime dependency is the MCP SDK. A user who runs `npx actlint` accepts a
dependency tree small enough to read.

## Dependency direction

Dependencies point in one direction, toward the base layer:

- `vocabulary` depends on nothing internal. It is the base layer: data plus validators.
- `core` depends only on `vocabulary` and contains all analysis mechanism.
- `reporters` depends only on `core` and reads policy data from `vocabulary`. It renders; it
  never re-scores.
- `mcp-fetch` depends only on `@formael/actlint-core/contracts`, a sub-path that exposes the
  manifest types and the error model, but nothing from the scoring engine.
- `cli` depends on everything and contains no analysis logic of its own.

A back-edge fails lint. The direction keeps judgment (data), mechanism (core), and presentation
(reporters) separately reviewable and separately replaceable.

## The purity boundary

One boundary matters more than any other: the line between `mcp-fetch` and everything downstream
of a captured `ToolManifest`.

`mcp-fetch` is impure by design. It opens connections, spawns stdio servers with a sanitized
environment plus any caller-named variables, sends a caller-supplied request header, reads files,
enforces timeouts, and reads the clock to timestamp a capture. Every failure it can encounter is
converted into a typed `IngestError` value before anything downstream sees it.

It may carry a credential for the duration of one scan; it never keeps one. A forwarded environment
value or request header is used to reach the server and then dropped — it is never written to a
capture, a report, or an error message, and nothing about it crosses the `ToolManifest` boundary.
Persisting or brokering credentials is out of scope by design.

`core`, `vocabulary`, and `reporters` are pure. They import no clock, network, filesystem,
process access, or randomness. Given the same manifest and the same vocabulary version, they
produce byte-identical output on every machine.

Two details keep the boundary clean. The `ToolManifest` carries a `capturedAt` timestamp for the
report header, but the scoring engine never reads it. Findings are a function of tools and
vocabulary version only. The MCP SDK appears in exactly one package; `mcp-fetch` translates
whatever the SDK returns into actlint's own types at the boundary, so SDK changes cannot ripple
into the engine. The translation contract `ToManifestFn` is declared in `core/contracts` and
implemented in `mcp-fetch`, which makes the boundary compiler-checked.

## The static guards

Four guards run in CI and locally via `pnpm guards`. They are scripts under `scripts/`, each with
their own tests.

| Guard | Command | Fails on |
|---|---|---|
| Purity | `pnpm guard:purity` | any import of clock, network, fs, process, or randomness inside `core`, `vocabulary`, or `reporters` |
| SDK boundary | `pnpm guard:sdk` | the MCP SDK imported outside `mcp-fetch`, or `mcp-fetch` importing core beyond the `contracts` sub-path |
| Determinism | `pnpm guard:determinism` | the pipeline producing different bytes across two runs on the same input |
| Vocabulary data | `pnpm guard:vocabulary` | vocabulary data that fails its JSON Schema, or logic creeping into the data package |

`pnpm check` runs the full local gate: typecheck, lint, tests, and the guards. `pnpm gate` adds
the build and the eval corpus.

## Where a change belongs

Before adding code, ask which of these it is:

- **Deciding what is risky**: data, specifically a vocabulary entry or a policy row in `vocabulary`, not code.
- **Computing, comparing, or composing**: `core`.
- **Formatting or rendering**: `reporters`.
- **Talking to anything outside the process**: `mcp-fetch`, and it must return typed values, not throw.
- **Parsing arguments, reading config, or exiting**: `cli`.

If a change fits none of these, that is a signal to reconsider the change rather than widen a
package's job.
