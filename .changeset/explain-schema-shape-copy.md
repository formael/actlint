---
'actlint': patch
---

`actlint explain` now notes on the `write-as-readonly` and `destructive-absent` pages that the
finding can rest on the input schema's write operations, independent of the tool's name. Copy only;
no behavior, flag, or exit-code change.
