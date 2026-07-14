---
'@formael/action-risk-vocabulary': minor
'@formael/actlint-core': minor
---

Schema-shape signals may constrain the matched parameter's declared JSON type via an optional
`typeMatches`. The schema reader now exposes each parameter's declared type(s), and schema-shape
matching requires both the name and type to match when `typeMatches` is present. No vocabulary data
changes, so existing findings are byte-identical.
