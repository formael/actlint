// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The usage text — printed for `--help` and appended to a usage error so a mistake is self-correcting
// without leaving the terminal. It is product copy: calm and concrete, describing exactly the small,
// obvious surface a linter should have. A linter is a library with a thin CLI; the surface stays small.

export const USAGE = `actlint — a static action-risk linter for MCP servers.

Usage:
  actlint <target> [options]
  actlint explain <ruleId>
  actlint --version

Target (exactly one):
  <command...>              launch a stdio MCP server and read its tools
  --http <url>              connect to a Streamable-HTTP MCP server
  --card <url>              read a .well-known MCP Server Card (experimental)
  --registry <serverId>     resolve a server from the MCP Registry
  --manifest <path|->       read a previously captured manifest, or '-' for stdin

Stdio server:
  --env KEY[=VALUE]         pass an environment variable to the launched server; bare KEY
                            forwards the value from your environment (repeatable)

HTTP server:
  --header "<name>: <value>"  send a request header when connecting with --http; use an
                            environment variable for tokens (repeatable). Header values are
                            never written to captures, reports, or errors

Output:
  (default)                 human scorecard to stdout
  --json                    machine report (a versioned public API)
  --sarif                   SARIF 2.1.0 for code scanning
  -o, --output <path>       write the report to a file instead of stdout

CI gate:
  --fail-on <severity>      fail if any finding is at or above <severity> (default: high)
                            one of: info, low, medium, high, critical
  --baseline <path>         suppress findings recorded in a baseline file
  --write-baseline <path>   record the current findings as an accepted baseline

Diagnostics:
  --capture <path>          write the normalized manifest for replay
  --vocabulary <path>       pin a specific vocabulary version (default: bundled)
  --experimental            permit still-draft ingestion sources (server cards)
  --version                 print the actlint, vocabulary, crosswalk, and report-schema versions
  -h, --help                print this message

Options must appear before a stdio <command...>; everything after the command is passed to it.
A launched stdio server receives a minimal environment, not your shell's; use --env for
variables it needs.
actlint reads a server's advertised tools. It never calls them, and it phones home to no one.`;
