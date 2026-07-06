<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# actlint

[![npm](https://img.shields.io/npm/v/actlint?logo=npm)](https://www.npmjs.com/package/actlint)
[![Provenance](https://img.shields.io/badge/npm-provenance-8957e5?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

**A static action-risk linter for MCP servers.** actlint reads an
[MCP](https://modelcontextprotocol.io) server's advertised tools — `name`, `description`, `inputSchema`,
and declared `annotations` — **derives** an honest action-risk profile for each tool, **compares** it
against what the tool _declares_, and reports the gaps as a human scorecard, a machine report, and a CI
pass/fail signal. It is a linter in the lineage of `eslint`, `tflint`, and `hadolint`. **It never runs,
routes, blocks, or executes anything** — it reads the labels on outbound actions and tells you whether they
are honest.

## Quickstart

Zero install — point it at a running server, a published server card, or a captured manifest:

```sh
npx actlint --card https://example.com/.well-known/mcp
npx actlint --manifest tools.json --fail-on medium
npx actlint --manifest - < tools.json        # read a manifest from stdin
```

Pick exactly one target:

| Target | Reads |
|---|---|
| `<command...>` | launches a stdio MCP server and reads its tools |
| `--http <url>` | a Streamable-HTTP MCP server |
| `--card <url>` | a `.well-known` MCP Server Card (experimental) |
| `--registry <serverId>` | a server resolved from the MCP Registry |
| `--manifest <path\|->` | a previously captured manifest, or `-` for stdin |

Output defaults to a human scorecard; `--json` emits the machine report (a versioned public API) and
`--sarif` emits SARIF 2.1.0 for code scanning. `-o, --output <path>` writes to a file. The CI gate is
`--fail-on <severity>` (default `high`); `--baseline <path>` suppresses already-accepted findings. Run
`actlint --help` for the full surface, or `actlint explain <ruleId>` for a rule's rationale.

## Exit-code contract

The exit code is the gate — CI pipelines branch on it, so it is stable and semver-governed:

| Code | Meaning |
|---|---|
| `0` | Clean — no finding at or above the `--fail-on` threshold. The green build. |
| `1` | Findings — at least one gating finding remained after baseline suppression. |
| `2` | Usage error — bad flags, no target, conflicting sources, or unreadable config. |
| `3` | Ingestion error — could not fetch or parse the target. Distinct from "found problems". |

The three failure codes are kept apart on purpose: a CI author must be able to tell "the server is
dishonest" (`1`) from "you held it wrong" (`2`) from "I couldn't look" (`3`).

## In CI

Use the [actlint GitHub Action](https://github.com/formael/actlint/tree/main/packages/github-action), or
call the CLI directly and let the exit code fail the job.

## No phone-home

actlint reads a server's advertised tools. It never calls them, and it phones home to no one — zero
telemetry by default.

## Links

- **Repository, docs, and issues:** <https://github.com/formael/actlint>
- **License:** [Apache-2.0](./LICENSE). Developed by [Formael](https://formael.com).
