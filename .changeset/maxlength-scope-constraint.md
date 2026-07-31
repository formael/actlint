---
'@formael/actlint-core': patch
---

Recognize a string's `maxLength` as a scope constraint in the `no-scope-constraint` advisory.

A sensitive tool whose only narrowing is a length bound (e.g. an opaque `channelId` declared as
`{ type: "string", maxLength: 255 }`) no longer trips `no-scope-constraint`. A `maxLength` bounds how
much can flow through a field, so it counts as scope narrowing here — the same way an `enum`, `const`,
`pattern`, or `format` already silences the advisory.

The change is confined to the advisory. A size bound does not fix a string's shape, so it does not
affect `isFreeformString` or the verdict-bearing `freeform-input-as-code` signal: a code parameter
carrying a `maxLength` still fires it, because bounded code is still code. A new `SchemaParam.hasSizeBound`
facet keeps the two predicates separate, and a property test locks in that adding a `maxLength` never
changes `isFreeformString`.
