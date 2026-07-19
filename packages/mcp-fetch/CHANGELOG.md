# @formael/actlint-mcp-fetch

## 0.1.0

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

## 0.0.2

### Patch Changes

- Updated dependencies [e8fc55f]
- Updated dependencies [a92f46d]
  - @formael/actlint-core@0.1.0

## 0.0.1

### Patch Changes

- @formael/actlint-core@0.0.1
