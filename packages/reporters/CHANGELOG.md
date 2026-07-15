# @formael/actlint-reporters

## 0.1.0

### Minor Changes

- e8fc55f: Scorecards now report assessment coverage. A tool actlint finds no recognized risk signal for is
  reported as unassessed rather than folded into the consistent count, and a server that declares no
  MCP annotations anywhere is stated plainly — silence is no longer presented as a clean bill of
  health. The `--json` and SARIF reports carry a new `coverage` object, and the summary gains an
  `unassessed` count (report-schema 1.0.0 → 1.1.0, additive and non-breaking). The honesty grade is
  unchanged: an unassessed tool still weighs as non-dishonest, so no grade flips. No flag, exit-code,
  or gate behavior changes.

### Patch Changes

- Updated dependencies [e8fc55f]
- Updated dependencies [a92f46d]
- Updated dependencies [ee77a2c]
  - @formael/actlint-core@0.1.0
  - @formael/action-risk-vocabulary@0.5.0

## 0.0.1

### Patch Changes

- Updated dependencies [5bc8f78]
- Updated dependencies [a00b579]
  - @formael/action-risk-vocabulary@0.3.0
  - @formael/actlint-core@0.0.1
