# actlint

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
