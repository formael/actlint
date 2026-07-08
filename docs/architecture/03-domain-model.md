<!--
SPDX-FileCopyrightText: 2026 Formael
SPDX-License-Identifier: Apache-2.0
-->

# Domain model

actlint's types are designed so the design principles are hard to violate by accident. Every type
here is `readonly`, validated by a Zod schema, and where a closed set of cases exists, modeled as
a union with exhaustive handling (`assertNever` in the `default` branch, so adding a case fails to
compile at every switch that ignores it).

All types in this document live in `packages/core/src/`.

## Input: the manifest

### ToolManifest

The single input to the pure pipeline: a captured, SDK-independent snapshot of one server's
advertised tools.

```ts
interface ToolManifest {
  source: ManifestSource;       // where this capture came from
  capturedAt: IsoTimestamp;     // metadata only — the engine never reads it
  protocolRevision?: string;
  tools: readonly ToolDefinition[];
}
```

`ManifestSource` is a closed union of the four capture origins: `live` (stdio or HTTP, with the
endpoint stored redacted), `server-card`, `registry`, and `file`. The source appears in report
headers so a reader always knows what was scanned.

### ToolDefinition

Exactly the four MCP fields the engine needs. Nothing else crosses the boundary.

```ts
interface ToolDefinition {
  name: string;
  description?: string;          // absence is itself a signal
  inputSchema: JsonSchema;       // opaque JSON, walked by a defensive reader
  annotations: DeclaredProfile;  // what the tool says about itself
}
```

## The declared side

### DeclaredHint

An MCP annotation field is modeled as a three-state value, read literally.

```ts
type DeclaredHint =
  | { state: 'true' }     // an explicit claim
  | { state: 'false' }    // an explicit claim — "I am not destructive"
  | { state: 'absent' };  // silence — no claim made
```

`false` and `absent` are different things. An explicit `destructiveHint: false` on a destructive
tool actively removes a safety prompt, while silence leaves the client's conservative default in
place. Collapsing them into a boolean would erase the distinction between actlint's two most
different verdicts, so the three-state model is non-negotiable.

### DeclaredProfile

The normalized annotations block: optional `readOnly`, `destructive`, `idempotent`, and
`openWorld` hints, plus `unknownHints`, a bag for any annotation field actlint does not yet
model. Unknown hints are never silently dropped and never treated as safe.

### MCP spec defaults

Per the MCP specification, absent hints are not neutral. An absent `destructiveHint` defaults to
true (assumed destructive), an absent `openWorldHint` to true, an absent `readOnlyHint` to false,
and an absent `idempotentHint` to false. The classifier compares against these effective declared
values, which is why silence is a mild finding and an explicit false claim is a serious one.

## The derived side

### Dimensions

actlint derives risk along five dimensions. Four are sensed directly from the tool's text and
schema; the fifth is computed from the other four.

| Dimension | Levels, least to most concerning |
|---|---|
| Reversibility | `reversible`, `recoverable-with-effort`, `irreversible`, `unknown` |
| Destructiveness | `read-only`, `additive`, `mutating`, `deleting`, `unknown` |
| External reach | `local`, `org-internal`, `open-world`, `unknown` |
| Idempotency | `idempotent`, `non-idempotent`, `unknown` |
| Blast radius (computed) | `contained`, `moderate`, `severe`, `critical`, `unknown` |

Level order is meaningful and stable. Property tests assert that the engine's outputs move
monotonically along these ladders, and reordering or inserting a level is a breaking change.
`unknown` sits at the concerning end of every ladder; not knowing is never treated as safe.

### Dimension

A dimension reading is never a bare level.

```ts
interface Dimension<L extends string> {
  level: L;
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
  provenance: readonly SignalRef[];   // the vocabulary signals that produced it
}
```

Confidence lowers severity but never suppresses a finding. Provenance is what lets rationales be
generated rather than hand-written: every reading can name the exact vocabulary entries that
argued for it.

### ActionRiskProfile

The five dimension readings for one tool. This is what the derivation engine produces and what
the classifier compares against the declared profile.

## Output: findings

### Verdict

The four mutually exclusive comparison outcomes:

| Verdict | Meaning |
|---|---|
| `consistent` | declared and derived agree |
| `under-declared` | an explicit claim of safety contradicted by the evidence — the serious case |
| `undeclared` | silence about a risk the spec default already covers — a mild nudge |
| `over-declared` | declared riskier than derived — honest over-caution, noted for alarm fatigue |

Under-declared is far worse than undeclared, which is about as mild as over-declared. This
asymmetry runs through the whole product.

### Finding

The atomic output of the pipeline:

```ts
interface Finding {
  ruleId: RuleId;            // stable identifier from a closed set
  ruleClass: 'honesty' | 'advisory';
  toolName: string;
  verdict: Verdict;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  confidence: Confidence;
  rationale: string;         // non-empty, generated from provenance
  standards: StandardsRef;   // at least one external reference
  derived: ActionRiskProfile;
  declared: DeclaredProfile;
  evidence: readonly SignalRef[];
}
```

Findings are never constructed with object literals. The `makeFinding` constructor refuses an
empty rationale or an empty standards reference, so explainability is enforced at the type level.

`ruleClass` splits the rule set in two. Honesty rules carry a verdict, contribute to the grade,
and can fail a CI gate. Advisory rules are capability-hygiene nudges (for example, a free-form
string parameter that will be executed as code) with no declared-hint counterpart; they never gate
and never move the grade.

### RuleId

Every rule the engine can emit is declared in one file (`core/src/classify/rule-ids.ts`). The
current set covers seven honesty rules: `write-as-readonly`, `destructive-unflagged`,
`external-reach-undeclared`, `destructive-absent`, `reach-absent`, `irreversible-unflagged`, and
`over-declared-risk`. Two advisory rules: `freeform-input-as-code` and `no-scope-constraint`.

Rule IDs are a public contract. Baselines, SARIF dashboards, and report consumers key on them, so
renaming one is a breaking change. A rule without a crosswalk entry fails a completeness test, so
the set cannot grow without its standards mapping growing with it.

### ServerResult and the grade

The whole-server view the reporters consume: the finding list, the tool count, the source, a
letter grade A through F, and the exact versions (actlint, vocabulary, crosswalk, report schema)
that produced the result. Versions travel with the value rather than being read from globals, so
a reporter stays a pure function of its input.

The grade measures labeling honesty, not safety. A server full of destructive tools that declares
all of them truthfully is an A. How the grade is computed is described in the analysis pipeline.

## Errors as values

The pure core never throws for control flow. Fallible operations return
`Outcome<T> = { ok: true, value } | { ok: false, error }`, where the error is an `ActlintError`
with a code from a closed union and a human message. Exceptions are reserved for genuine
programmer bugs. The same discipline applies at the edge: `mcp-fetch` returns typed `IngestError`
values, which the CLI maps to its own exit code.
