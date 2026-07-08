---
"@formael/action-risk-vocabulary": minor
---

Recognize the write family — `write`, `overwrite`, `save`, `upsert` — as mutating verbs in the
name-verb lexicon (`verb.mutate`). Tools named like `write_file`, `overwrite_file`, `save_document`,
or `upsert_record` now derive `destructiveness: mutating`, so a `readOnlyHint: true` declaration on
such a tool surfaces as a `write-as-readonly` finding instead of resolving to `unknown`. Purely
additive: it can only add findings, never remove or reclassify an existing one. Vocabulary data
version bumped to 0.3.0.
