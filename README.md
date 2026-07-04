<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# actlint

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

## License

[Apache-2.0](./LICENSE). actlint is developed by [Formael](https://formael.com).
