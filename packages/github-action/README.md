<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# actlint GitHub Action

Run [actlint](https://github.com/formael/actlint) — the static action-risk linter for MCP servers — in
CI. The action is a thin wrapper around the `actlint` CLI: it runs the linter and lets the exit code be
the gate.

## Usage

Pin the action to a full commit SHA — the same posture actlint's own OpenSSF Scorecard preaches, and the
form we recommend. The trailing comment records the human-readable release the SHA belongs to:

```yaml
- name: Lint MCP tool honesty
  uses: formael/actlint/packages/github-action@<commit-sha> # v0.1.0
  with:
    args: --card https://example.com/.well-known/mcp --fail-on medium
```

Scan a captured manifest committed in the repo, with a baseline:

```yaml
- uses: formael/actlint/packages/github-action@<commit-sha> # v0.1.0
  with:
    args: --manifest tools.json --baseline .actlint-baseline.json
```

### Version references

The action is distributed by git tag, not npm. Alongside each release we push a signed annotated tag and
move a major-line tag, so you can trade immutability for convenience:

| Reference | Immutable | Use it when |
|---|---|---|
| `@<commit-sha>` | yes | You want a reproducible, supply-chain-audited pin (recommended). |
| `@v0.1.0` | yes | You want a readable exact version and accept trusting the tag. |
| `@v0` | no | You want automatic patch/minor updates within the `0.x` line. |

Note: Changesets tags the npm packages as `actlint@0.1.0`; those tags are for the CLI on npm, not for this
action. Use the `v*` tags above (or a SHA) to reference the action. The tagging step is documented in
[`RELEASING.md`](https://github.com/formael/actlint/blob/main/RELEASING.md).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `args` | yes | — | Arguments passed verbatim to `actlint`, including the target (`--card`, `--http`, `--manifest`, `--registry`, or a stdio command). |
| `version` | no | `latest` | The npm version or dist-tag of `actlint` to run. |
| `working-directory` | no | `.` | Directory to run in, for relative `--manifest` / `--baseline` paths. |

## Outputs

| Output | Description |
|---|---|
| `exit-code` | The raw actlint exit code — `0` clean, `1` findings, `2` usage error, `3` ingestion error. |

## Exit-code contract

The step fails whenever `actlint` exits non-zero, so a dishonest server (exit `1`), a bad invocation
(exit `2`), or an unreadable target (exit `3`) all fail the job. To gate on findings without failing the
build, read the `exit-code` output on a step marked `continue-on-error: true`.

## What it does not do

It never runs, routes, blocks, or executes the target server's tools. It reads the labels on their
advertised actions and reports whether they are honest.
