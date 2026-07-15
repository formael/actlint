---
'@formael/action-risk-vocabulary': minor
---

Vocabulary data 0.4.0 → 0.5.0. Broadens write-verb recall and lets a write-shaped input schema carry
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

MINOR, not MAJOR: this release only *adds* findings — no existing input is re-classified more
leniently. Upgrading users may see new findings attributed to vocabulary 0.5.0 entry ids; the
`--write-baseline` review-and-accept path absorbs them so no green pipeline turns red without a
visible, attributed delta.
