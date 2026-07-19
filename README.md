<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# actlint

[![CI](https://github.com/formael/actlint/actions/workflows/ci.yml/badge.svg)](https://github.com/formael/actlint/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/formael/actlint/badge)](https://scorecard.dev/viewer/?uri=github.com/formael/actlint)
[![npm](https://img.shields.io/npm/v/actlint?logo=npm)](https://www.npmjs.com/package/actlint)
[![Provenance](https://img.shields.io/badge/npm-provenance-8957e5?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

**A static action-risk linter for MCP servers.**

actlint reads an [MCP](https://modelcontextprotocol.io) server's advertised tools — `name`, `description`,
`inputSchema`, and declared `annotations` — **derives** an honest action-risk profile for each tool,
**compares** it against what the tool _declares_, and reports the gaps as a human scorecard, a machine
report, and a CI pass/fail signal.

It is a linter in the lineage of `eslint`, `tflint`, and `hadolint`. **It never runs, routes, blocks, or
executes anything.** It reads the labels on outbound actions and tells you whether they are honest.

<img width="1200" height="700" alt="actlint-demo" src="https://github.com/user-attachments/assets/4ec5e3b7-421e-42d3-ab9c-8f7df76cf0c7" />

see [Usage](#usage) below.

## Why it exists

MCP tools carry advisory honesty hints — `readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`. A spec-conformant client uses them to decide when to prompt for confirmation. Everyone
nods at the hints; nobody verifies them. A tool that writes files while declaring `readOnlyHint: true`
suppresses the very prompt that would have caught it.

actlint makes those hints **checkable**: it works out what each tool actually does from its name, schema,
and description, then checks that against what the tool claims. The result is a reproducible,
standards-mapped finding instead of an opinion.

## Install

Run it with no install:

```sh
npx actlint --version
```

Or add it to a project:

```sh
npm install --save-dev actlint
```

Requires **Node ≥ 22**.

`--version` prints four independent lines — the tool, the vocabulary, the crosswalk, and the report
schema. Reproducing a report needs all four, so you can always say exactly which judgment graded a server:

```
actlint        0.1.2
vocabulary     0.4.0
crosswalk      0.1.0
report-schema  1.0.0
```

## Usage

Every run points actlint at **one** server and produces a report. The command is small on purpose.

### Point it at a server

Choose exactly one target:

| Intent | Command |
|---|---|
| Launch a local stdio server | `actlint <command> [args…]` |
| Connect to a hosted server | `actlint --http https://host/mcp` |
| Read a published server card | `actlint --experimental --card https://host/.well-known/mcp` |
| Resolve from the MCP Registry | `actlint --registry <serverId>` |
| Replay a captured manifest (offline) | `actlint --manifest tools.json` (`-` for stdin) |

```sh
# Lint a filesystem server, launched over stdio
actlint npx -y @modelcontextprotocol/server-filesystem ./sandbox
```

> **One rule to remember: options go _before_ the stdio command.** Everything after the command is
> passed to the server as its own arguments. `actlint --capture out.json <command>` captures; `actlint
> <command> --capture out.json` hands `--capture` to the server and quietly does nothing. Use `--` to
> mark the boundary explicitly: `actlint <options> -- <command> <args>`.

### Capture once, analyze many

Talking to a live server is the only step that touches the network or launches a process. Capture the
normalized manifest once, then run every analysis offline — the results are byte-for-byte reproducible:

```sh
# Step 1 — touch the live server once, save the manifest
actlint --capture fs.json npx -y @modelcontextprotocol/server-filesystem ./sandbox

# Step 2…N — pure, offline, repeatable
actlint --manifest fs.json                       # human scorecard
actlint --manifest fs.json --json  -o fs.report.json
actlint --manifest fs.json --sarif -o fs.sarif
```

This is also the right shape for CI: capture in a job that has network access, gate in one that doesn't.
`--manifest` never opens a socket.

### Servers that need environment variables

A launched stdio server receives a minimal, sanitized environment on purpose — not your shell's — and
actlint forwards only what you name. A server that needs a variable to start will otherwise refuse to
start (exit `3`), and one that quietly runs with fewer tools when a variable is missing will be linted
against that reduced surface. Name the variables it needs with `--env`:

```sh
# Forward a secret from your environment — the value stays out of argv, shell history, and `ps`
export HUBSPOT_TOKEN=…
actlint --env HUBSPOT_TOKEN npx -y @hubspot/mcp-server

# Set a non-secret value literally
actlint --env LOG_LEVEL=debug npx -y some-server
```

`--env` is repeatable and applies only to a launched stdio server. Prefer the bare `--env KEY` form for
secrets: a literal `--env KEY=VALUE` puts the value in the command line, where shell history and local
process listings can see it.

### Authenticated servers

Many hosted servers answer an unauthenticated `tools/list` with `HTTP 401` — they will not enumerate
their tools without a credential. Pass one as a request header, reading the token from an environment
variable so it stays out of argv and shell history:

```sh
export MCP_TOKEN=…
actlint --http https://mcp.example.com/mcp --header "Authorization: Bearer ${MCP_TOKEN}"
```

`--header` is repeatable and applies only to an `--http` target. Header values are secrets: actlint never
writes one to a capture, a report, or an error message.

Reach for the capture pattern here too. The credential is needed only when talking to the server, so
authenticate once, save the manifest, and gate offline — no token on any later run:

```sh
# Once, where the credential lives:
actlint --http https://mcp.example.com/mcp --header "Authorization: Bearer ${MCP_TOKEN}" --capture tools.json

# Every run after, with no credential and byte-identical findings:
actlint --manifest tools.json --fail-on medium
```

actlint carries a credential for a single scan; it never keeps one. For a server that only authenticates through an interactive browser flow, mint a token with your existing tooling — your identity provider's CLI, an OAuth helper, or a
`curl` to the token endpoint — and hand it to `--header`.

### Output formats

| Flag | Output |
|---|---|
| _(default)_ | Human scorecard to stdout |
| `--json` | Machine report — a versioned, stable JSON API |
| `--sarif` | SARIF 2.1.0 for GitHub code scanning |
| `-o, --output <path>` | Write to a file instead of stdout |

Each finding in every format carries a plain-English rationale and a mapping to the standards it relates
to. A finding without a reason cannot exist by construction.

### Gate a build

The exit code is the gate:

| Code | Meaning |
|---|---|
| `0` | Clean, or all findings below the threshold |
| `1` | A finding met or exceeded `--fail-on` |
| `2` | Usage error (bad flag, no target) |
| `3` | Ingestion error (server failed to start, unreachable) |

```sh
# Fail only on findings at or above <severity>. Default: high.
actlint --manifest fs.json --fail-on medium
```

`--fail-on` takes one of `info`, `low`, `medium`, `high`, `critical`.

In CI, use the [GitHub Action](./packages/github-action):

```yaml
- uses: formael/actlint/packages/github-action@<commit-sha> # v0.1.0 — SHA-pinned; see the action README
  with:
    args: --card https://example.com/.well-known/mcp --fail-on medium
```

### Adopt on a noisy server with a baseline

To turn on actlint without a red build, record today's findings as accepted, then gate only on new ones:

```sh
# Record the current findings as the accepted baseline
actlint --manifest fs.json --write-baseline fs.baseline.json

# From now on, suppress those and fail only on findings not in the baseline
actlint --manifest fs.json --baseline fs.baseline.json --fail-on low
```

Baseline entries are keyed by a fingerprint, so they survive re-ordering and unrelated edits.

### Understand a finding

```sh
actlint explain write-as-readonly
```

`explain` is offline and takes a rule id straight from any report. It prints what the rule means, why it
matters, an example, the standards mapping, and the fix. An unknown id exits `2` and lists the known rules.

## Reading the scorecard

```
  actlint  ▸  stdio server                                      honesty grade: A
  ──────────────────────────────────────────────────────────────────────────────
  14 tools scanned · 0 under-declared · 0 undeclared · 0 over-declared

  advisories — capability hygiene, not honesty verdicts
  ◐ ADV   move_file  no-scope-constraint
      This is a sensitive action whose input schema carries no narrowing constraint …
      ↳ OWASP ASI02:2026 · OWASP MCP02:2025 · CoSAI MCP-T3 · EU AI Act Art.15 · NIST …
```

Two things to know when you first read a scorecard:

- **The summary counts are the honesty verdict.** In order of severity:
  **under-declared** (worst — the tool claims _less_ risk than it has) › **undeclared** (says nothing) ›
  **over-declared** (harmless excess caution).
- **Advisories (`◐ ADV`) are not honesty verdicts.** They are capability notes — "this parameter is
  free-form code", "no schema constraint bounds this tool". A server can grade **A** and still carry
  advisories; they do not affect the grade or the gate.

The grades are earned, not lenient. A server scores A when its declarations _match_ what actlint derives
independently — not because actlint failed to look.

## Principles (the seven invariants)

1. **Determinism** — same input ⇒ byte-identical findings. No clock, network, fs, randomness, or model in
   the scoring path.
2. **Explainability** — every finding carries a rationale _and_ a standards mapping; a finding without a
   reason is a bug.
3. **Conservatism** — `uncertain` is a first-class, non-failing result. Under-claiming beats crying wolf.
4. **Narrow scope** — declared-vs-derived honesty labeling only. It never enforces.
5. **Standards-native** — findings map to OWASP ASI, the OWASP MCP Top 10, CoSAI/OASIS, the EU AI Act,
   and NIST.
6. **No phone-home** — zero telemetry by default.
7. **No overclaiming** — every external claim cites a source or is flagged an assumption.

## Repository layout

```
packages/
  core/         PURE.   manifest + vocabulary -> profiles -> findings. No I/O, clock, or model.
  vocabulary/   PURE DATA. the action-risk vocabulary + standards crosswalk, JSON-Schema'd, own semver.
  reporters/    PURE.   findings -> human / json / sarif.
  cli/          SHELL.  the `actlint` command: fetch -> core -> reporters -> exit code.
  mcp-fetch/    IMPURE. the only network code; the only place the MCP SDK appears.
```

## Troubleshooting

- **A flag was ignored.** Options must come before a stdio command. Put them first, or use `--` to mark
  the boundary: `actlint <options> -- <command> <args>`.
- **Server banners mixed into the scorecard.** Some stdio servers print startup banners to stderr.
  Redirect them for a clean capture: `actlint <command> 2>/dev/null`.
- **`--card` exits with code 3.** Server cards are still draft; they need `--experimental`.

## Development

Requires **Node ≥ 22** (tested on 24) and **pnpm**.

```sh
pnpm install     # install the workspace
pnpm check       # the full local gate: typecheck + lint + test + guards
```

Individual gates: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm guards`.

actlint publishes token-lessly (npm Trusted Publishing over OIDC) with Sigstore-logged SLSA provenance
over every published tarball — verify any install with `npm audit signatures`. It practises the honesty
it lints.

**Contributions:** actlint is not accepting external code contributions yet while the v0.x foundations
settle. Bug reports and issues are welcome.

## License

[Apache-2.0](./LICENSE). actlint is developed by [Formael](https://formael.com).
</content>
</invoke>
