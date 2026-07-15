# @formael/action-risk-vocabulary

## 0.5.0

The published package version now equals the vocabulary dataset version (`VOCABULARY_VERSION`, the
number every report stamps): both are 0.5.0. Earlier releases let the npm line trail the dataset line
by one minor; this release closes that gap so the version you install and the version in your reports
agree. The npm line skips 0.4.0 as a result — nothing was published there.

### Minor Changes

- a92f46d: Schema-shape signals may constrain the matched parameter's declared JSON type via an optional
  `typeMatches`. The schema reader now exposes each parameter's declared type(s), and schema-shape
  matching requires both the name and type to match when `typeMatches` is present. No vocabulary data
  changes, so existing findings are byte-identical.
- ee77a2c: Vocabulary data 0.4.0 → 0.5.0. Broadens write-verb recall and lets a write-shaped input schema carry
  a write claim on its own, so a state-changing tool whose name verb is out of vocabulary is no longer
  invisible.

  Finding-level impact (one line per change):

  - adds lexemes `provision`, `ingest`, `seed`, `clone`, `duplicate`, `copy` to `verb.create`
    (additive); flips 0 corpus tools' findings.
  - adds lexemes `populate`, `sync`, `synchronize`, `migrate`, `persist`, `materialize`, `rotate`,
    `merge`, `restore` to `verb.mutate` (mutating); flips 0 corpus tools' findings (the tools whose
    derivation changed — a commit, a reversible restore, a declared-destructive merge — stay
    consistent because a bare mutating derivation cannot contradict an honest annotation).
  - adds `shape.write-operation-keys` (mutating) and `shape.delete-operation-keys` (deleting, with an
    evidence-backed unknown reversibility): a parameter named like a write or delete operation whose
    value is an array of records now derives a write from the schema alone. On the real corpus this
    flips 0 tools; its recall is demonstrated by the `synthetic-writes` fixtures, where an
    out-of-vocabulary write derives `destructive-absent` when silent and `write-as-readonly` under a
    false `readOnlyHint: true`.

  Screened out, with the reason recorded in the vocabulary's `limitations`: `commit`, `store`,
  `record`, `snapshot`, `stage`, `load` (noun/verb homographs that would misfire inside common reads
  like `get_commit`, `get_store`), and — unchanged — the reply-content verbs `generate` and `install`.
  The write shapes match only an array of records; a single object is indistinguishable from a read
  tool's filter, so it resolves to silence rather than risk a false read-only flag.

  MINOR, not MAJOR: this release only _adds_ findings — no existing input is re-classified more
  leniently. Upgrading users may see new findings attributed to vocabulary 0.5.0 entry ids; the
  `--write-baseline` review-and-accept path absorbs them so no green pipeline turns red without a
  visible, attributed delta.

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
