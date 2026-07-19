# actlint

## 0.3.0

### Minor Changes

- 1e01855: Add `--header "<name>: <value>"` to send request headers when connecting to an `--http` server, so
  actlint can scan servers that require authorization before `tools/list`.

  Many hosted servers answer an unauthenticated `tools/list` with `HTTP 401`. `--header` presents a
  credential for that single scan:

  - Repeatable, and valid only with an `--http` target; any misuse is a usage error (exit 2).
  - Header values are treated as secrets: they never reach a capture, a report, or an error message.
    Read tokens from an environment variable (`--header "Authorization: Bearer ${MCP_TOKEN}"`) to keep
    them out of argv and shell history.

  actlint carries a credential for one connection and never keeps one — no token storage, no browser,
  no callback listener.

  mcp-fetch now recognizes a `401` and returns a typed `auth-required` ingestion error (exit 3) instead
  of an opaque connection failure, reading the scheme and resource-metadata URL from the server's own
  `WWW-Authenticate` header. `IngestErrorCode` gains the `auth-required` member and `IngestError.context`
  gains optional `authScheme`/`resourceMetadataUrl` fields; a consumer matching exhaustively on the code
  union will need the new arm.

- bf83296: Add `--env KEY[=VALUE]` to forward named environment variables to a launched stdio server.

  A launched stdio server receives only a minimal, sanitized environment, so a server that needs a
  variable to start would refuse to start (exit 3), and one that quietly runs with fewer tools when a
  variable is missing would be linted against that reduced surface. `--env` names each variable the
  child may receive:

  - `--env KEY` forwards `KEY`'s value from actlint's own environment (the value stays out of argv).
  - `--env KEY=VALUE` sets `KEY` to a literal value.

  It is repeatable, allow-list only (there is no blanket inheritance), and applies only to a launched
  stdio server; any misuse is a usage error (exit 2). A stdio connect failure without `--env` now
  carries a one-line hint pointing at the likeliest cause.

  mcp-fetch merges forwarded variables over the SDK's sanitized defaults instead of replacing them, so
  an `npx`-launched server keeps its `PATH`; the caller wins on a collision. The merge is exported as
  `childEnv` for direct testing.

## 0.2.0

### Minor Changes

- e8fc55f: Scorecards now report assessment coverage. A tool actlint finds no recognized risk signal for is
  reported as unassessed rather than folded into the consistent count, and a server that declares no
  MCP annotations anywhere is stated plainly — silence is no longer presented as a clean bill of
  health. The `--json` and SARIF reports carry a new `coverage` object, and the summary gains an
  `unassessed` count (report-schema 1.0.0 → 1.1.0, additive and non-breaking). The honesty grade is
  unchanged: an unassessed tool still weighs as non-dishonest, so no grade flips. No flag, exit-code,
  or gate behavior changes.

### Patch Changes

- ee77a2c: `actlint explain` now notes on the `write-as-readonly` and `destructive-absent` pages that the
  finding can rest on the input schema's write operations, independent of the tool's name. Copy only;
  no behavior, flag, or exit-code change.

## 0.1.2

### Patch Changes

- Rebuild the CLI against action-risk vocabulary 0.3.0, which the binary bundles at build time. This
  ships the write-family name verbs (`write`, `overwrite`, `save`, `upsert`) and the reply-content
  false-positive screen (`generate`, `install`) to `actlint` users: tools named like `write_file` now
  surface a `write-as-readonly` finding when they declare `readOnlyHint: true`, and the four false
  positives on honestly-annotated tools (`generate_typescript_types`, `hubspot-generate-feedback-link`,
  `extension_cli_generate`, `extension_cli_install`) no longer fire.

## 0.1.1

### Patch Changes

- 54d4534: First release published through the automated OIDC pipeline: every artifact now
  carries npm build provenance, a CycloneDX SBOM, and keyless cosign signatures.
