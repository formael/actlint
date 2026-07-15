# actlint

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
