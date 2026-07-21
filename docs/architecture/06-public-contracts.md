<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Public contracts

actlint's public surface is deliberately small, and everything on it is a contract: stable,
versioned, and changed only as a semver event.

## The CLI

```
actlint <target> [options]
actlint explain <ruleId>
actlint --version
```

Exactly one target per run:

| Target | Meaning |
|---|---|
| `<command...>` | launch a stdio MCP server and read its tools |
| `--http <url>` | connect to a Streamable-HTTP server |
| `--card <url>` | read a `.well-known` MCP server card (experimental, behind `--experimental`) |
| `--registry <serverId>` | resolve a server from the MCP Registry |
| `--manifest <path\|->` | read a previously captured manifest (fully offline) |

Output is the human scorecard by default, or `--json` / `--sarif`. `--capture` writes the
normalized manifest for replay. `--fail-on <severity>` sets the CI gate threshold (default
`high`). `--vocabulary` pins a judgment version. `actlint explain <ruleId>` documents any rule
from the terminal.

Two repeatable flags feed a credential to the one step that talks to a server:

| Flag | Applies to | Meaning |
|---|---|---|
| `--env KEY[=VALUE]` | a launched stdio command | forward a named variable to the child; bare `KEY` forwards it from actlint's own environment, `KEY=VALUE` sets a literal |
| `--header <name>: <value>` | an `--http` target | send a request header — the home for a bearer token |

Each is valid only with its own target; using either against the wrong one is a usage error (exit 2).
Both are documented to take a value indirectly through an environment variable, so a secret never lands
in argv or shell history. A named credential is carried for a single scan and never persisted.

The CLI is a thin shell over the library packages: it parses arguments, resolves config, wires
fetch through core through reporters, and exits. It contains no analysis logic.

actlint sends no telemetry. The only network activity is the fetch the user explicitly requests,
and `--manifest` performs none at all.

## Exit codes

The four exit codes are a public API that CI pipelines branch on.

| Code | Meaning |
|---|---|
| `0` | scan completed; no finding at or above the gate threshold |
| `1` | scan completed; at least one gating finding remained after baseline suppression |
| `2` | usage error — bad flags, no target, unreadable config |
| `3` | ingestion error — could not fetch or parse the target |

The separation is deliberate. A pipeline author must be able to distinguish "the server is
dishonest" (1) from "the invocation was wrong" (2) from "actlint couldn't look" (3). Findings are
never an error; they are a successful scan whose result the gate reads. Every `IngestError` from
`mcp-fetch` maps to exit 3, and nothing else does.

## The JSON report

`--json` emits a machine report validated against a committed JSON Schema
(`packages/core/schema/report.schema.json`). The schema is generated from the same Zod definition
the reporter is conformance-tested against, so the committed schema, the reporter's output, and
the documentation cannot drift apart silently. The schema is strict: an extra, renamed, or dropped
key fails the conformance test rather than shipping an incompatible payload.

The report carries everything a consumer needs to re-explain a verdict without re-running the
engine: each finding's rationale, standards references, and both the derived and declared profiles,
plus a per-tool summary, the grade, and the versions that produced the result. It also carries a
per-server `coverage` block — how many tools actlint could assess, how many it could not, and the
names of the unassessed ones — so a consumer can tell a clean scan from a thin one. Live endpoints are
rendered redacted; a report never contains a credential-bearing URL, and a forwarded environment value
or request header never appears in it, in a capture, or in an error message.

`--sarif` emits SARIF 2.1.0 for code-scanning platforms, keyed by the same stable rule IDs.

## Rule IDs

The rule set is closed and its IDs are stable. Baselines, SARIF dashboards, and importers key on
them, so renaming or removing a rule ID is a breaking change. Adding a rule requires a matching
crosswalk entry (enforced by a completeness test) and an `explain` page.

## The baseline

The baseline answers two adoption problems: the first run against an existing server that may
already have gaps, and a vocabulary update that would otherwise turn a green build red.

`--write-baseline <path>` records the current findings as accepted. `--baseline <path>` suppresses
exactly those findings on later runs, so only new problems fail the build.

Suppression keys on a stable fingerprint: a content hash over the rule ID, tool name, verdict,
derived levels, and declared hint states. It never includes ordering or position, so unrelated
changes cannot un-suppress a finding; it does include the tool's own risk facts, so a genuine
change to the tool's situation correctly surfaces as a new finding.

The baseline file records the vocabulary version it was written under. When a later run uses a
newer vocabulary, findings not in the baseline are reported as newly introduced by the vocabulary
update rather than dumped as failures. The remedy is one re-run of `--write-baseline`.

## Version lines

actlint versions four things independently, and every report states all four.

| Line | What bumps it |
|---|---|
| `actlint` (the CLI/engine) | code changes, on the usual semver rules |
| vocabulary data | judgment changes; a change that flips a classification on the fixture corpus is breaking |
| crosswalk data | standards-mapping changes |
| report schema | shape changes to the `--json` payload; breaking shape changes are a major bump |

Separate version lines exist so an integrator can pin exactly the contract they depend on without
pinning the others.

## Distribution

Releases are automated with Changesets. Publishing uses npm Trusted Publishing over OIDC, so no
long-lived npm token exists anywhere in the project. Every published package carries npm
provenance: npm generates a SLSA build-provenance attestation over the exact published tarball,
logs it in the Sigstore transparency log, and serves it from the registry — verifiable with
`npm audit signatures`. The npm tarball is the artifact of record; GitHub Releases carry no binary
assets, so there is exactly one chain of custody to keep honest. The GitHub Action is distributed
by git tag and documented for SHA-pinned use. A security tool asks users to trust its supply
chain, so the release pipeline is built to make that trust verifiable.
