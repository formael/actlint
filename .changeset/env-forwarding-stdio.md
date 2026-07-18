---
'actlint': minor
'@formael/actlint-mcp-fetch': minor
---

Add `--env KEY[=VALUE]` to forward named environment variables to a launched stdio server.

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
