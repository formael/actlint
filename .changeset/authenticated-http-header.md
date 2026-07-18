---
'actlint': minor
'@formael/actlint-mcp-fetch': minor
---

Add `--header "<name>: <value>"` to send request headers when connecting to an `--http` server, so
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
