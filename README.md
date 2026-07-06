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

## Why it exists

MCP tools carry advisory honesty hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
Everyone nods at them; nobody verifies them. actlint makes that advisory best-practice **checkable,
shareable, and CI-enforceable** — turning "is this tool honest about what it does?" from an opinion into a
reproducible, standards-mapped finding.

## Quickstart

Zero install — point it at a running server, a published server card, or a captured manifest:

```sh
npx actlint --card https://example.com/.well-known/mcp
npx actlint --manifest tools.json --fail-on medium
```

The exit code is the gate: `0` clean, `1` findings at or above the threshold, `2` a usage error, `3` an
ingestion error. In CI, use the [GitHub Action](./packages/github-action):

```yaml
- uses: formael/actlint/packages/github-action@<commit-sha> # v0.1.0 — SHA-pinned; see the action README
  with:
    args: --card https://example.com/.well-known/mcp --fail-on medium
```

actlint publishes token-lessly (npm Trusted Publishing over OIDC) with automatic provenance, a CycloneDX
SBOM, SLSA build provenance, and cosign signatures — it practises the honesty it lints.

## Principles (the seven invariants)

1. **Determinism** — same input ⇒ byte-identical findings. No clock, network, fs, randomness, or model in the
   scoring path.
2. **Explainability** — every finding carries a rationale _and_ a standards mapping; a finding without a
   reason is a bug.
3. **Conservatism** — `uncertain` is a first-class, non-failing result. Under-claiming beats crying wolf.
4. **Narrow scope** — declared-vs-derived honesty labeling only. It never enforces.
5. **Standards-native** — findings map to OWASP ASI, the OWASP MCP Top 10, CoSAI/OASIS, the EU AI Act, and NIST.
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

## Development

Requires **Node ≥ 22** (tested on 24) and **pnpm**.

```sh
pnpm install     # install the workspace
pnpm check       # the full local gate: typecheck + lint + test + guards
```

Individual gates: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm guards`.

**Contributions:** actlint is not accepting external code contributions yet while the v0.x foundations settle. Bug reports and issues are welcome.

## License

[Apache-2.0](./LICENSE). actlint is developed by [Formael](https://formael.com).
