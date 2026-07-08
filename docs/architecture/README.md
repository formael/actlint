<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# actlint architecture

These documents describe how actlint is built and why. They are written for contributors and for
anyone integrating with the tool's output.

actlint is a static action-risk linter for MCP servers. It reads the tools a server advertises,
derives what each tool does from its name, description, and input schema, compares that against
what the tool declares about itself, and reports the gaps. It never runs, routes, blocks, or
executes anything.

## Reading order

| Document | Covers |
|---|---|
| [Overview](01-overview.md) | The problem, the design principles, and the pipeline |
| [Packages and boundaries](02-packages-and-boundaries.md) | Workspace layout, dependency rules, and the purity boundary |
| [Domain model](03-domain-model.md) | The core types: manifests, profiles, dimensions, findings |
| [Analysis pipeline](04-analysis-pipeline.md) | Derivation, classification, severity, and the grade |
| [Vocabulary and policies](05-vocabulary-and-policies.md) | The versioned data that holds actlint's judgment |
| [Public contracts](06-public-contracts.md) | The CLI, exit codes, report formats, baseline, and version lines |
| [Testing and quality](07-testing-and-quality.md) | Test layers, static guards, and the eval corpus |

Start with the overview. If you are changing code, also read packages and boundaries, which
explains the rules CI enforces.

## The short version

One package, `mcp-fetch`, talks to the outside world and produces a plain snapshot of a server's
tools. Everything after that snapshot is a pure function: same input, byte-identical output, no
network, no clock, no filesystem, no randomness, no model calls. That structure is what makes
every finding reproducible and every rationale checkable.

```
INGEST      NORMALIZE       DERIVE          CLASSIFY        REPORT
mcp-fetch   mcp-fetch       core            core            reporters, cli
impure      impure          pure            pure            pure
```
