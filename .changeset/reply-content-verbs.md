---
"@formael/action-risk-vocabulary": minor
---

Screen the reply-content verbs `generate` and `install` out of the write families (`generate`
removed from `verb.create`, `install` removed from `verb.execute`). A name-verb lexeme cannot see
which side of the reply boundary an effect lands on, and across the published-server corpus these
two verbs dominantly name tools that return content in the reply — generated types, links, CLI
commands, installation *instructions* — while correctly declaring `readOnlyHint: true`. As
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
