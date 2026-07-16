# @formael/actlint-core

## 0.1.0

### Minor Changes

- e8fc55f: Scorecards now report assessment coverage. A tool actlint finds no recognized risk signal for is
  reported as unassessed rather than folded into the consistent count, and a server that declares no
  MCP annotations anywhere is stated plainly — silence is no longer presented as a clean bill of
  health. The `--json` and SARIF reports carry a new `coverage` object, and the summary gains an
  `unassessed` count (report-schema 1.0.0 → 1.1.0, additive and non-breaking). The honesty grade is
  unchanged: an unassessed tool still weighs as non-dishonest, so no grade flips. No flag, exit-code,
  or gate behavior changes.
- a92f46d: Schema-shape signals may constrain the matched parameter's declared JSON type via an optional
  `typeMatches`. The schema reader now exposes each parameter's declared type(s), and schema-shape
  matching requires both the name and type to match when `typeMatches` is present. No vocabulary data
  changes, so existing findings are byte-identical.

### Patch Changes

- Updated dependencies [a92f46d]
- Updated dependencies [ee77a2c]
  - @formael/action-risk-vocabulary@0.5.0

## 0.0.1

### Patch Changes

- Updated dependencies [5bc8f78]
- Updated dependencies [a00b579]
  - @formael/action-risk-vocabulary@0.3.0
