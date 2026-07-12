# @formael/action-risk-vocabulary

## 0.3.0

### Minor Changes

- 5bc8f78: Screen the reply-content verbs `generate` and `install` out of the write families (`generate`
  removed from `verb.create`, `install` removed from `verb.execute`). A name-verb lexeme cannot see
  which side of the reply boundary an effect lands on, and across the published-server corpus these
  two verbs dominantly name tools that return content in the reply — generated types, links, CLI
  commands, installation _instructions_ — while correctly declaring `readOnlyHint: true`. As
  write-family lexemes they read such read-only tools as writes, producing false `write-as-readonly`
  findings on honestly-annotated tools (observed on `generate_typescript_types` in
  `@supabase/mcp-server-supabase`, `hubspot-generate-feedback-link` in `@hubspot/mcp-server`, and
  `extension_cli_generate`/`extension_cli_install` in `@azure/mcp`).

  This is a **classification flip**, not an additive change: tools whose only write-family evidence
  was one of these two name verbs now derive destructiveness `unknown` (silence), and silence does
  not contradict an explicit honest declaration — the four findings above disappear. Tools that
  genuinely write state remain catchable by their schema shape (a destination or path parameter,
  free-form code input) or an unambiguous sibling verb in their name. The screening principle is
  recorded in the vocabulary `limitations`. Vocabulary data version bumped to 0.4.0.

- a00b579: Recognize the write family — `write`, `overwrite`, `save`, `upsert` — as mutating verbs in the
  name-verb lexicon (`verb.mutate`). Tools named like `write_file`, `overwrite_file`, `save_document`,
  or `upsert_record` now derive `destructiveness: mutating`, so a `readOnlyHint: true` declaration on
  such a tool surfaces as a `write-as-readonly` finding instead of resolving to `unknown`. Purely
  additive: it can only add findings, never remove or reclassify an existing one. Vocabulary data
  version bumped to 0.3.0.
