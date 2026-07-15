// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// End-to-end classification against the real vocabulary: derive → classify + advisories →
// makeFinding, and the manifest fold. These exercise the whole seam a reporter will consume.

import { VOCABULARY } from '@formael/action-risk-vocabulary';
import { describe, expect, it } from 'vitest';

import type { JsonSchema, ToolDefinition, ToolManifest } from '../manifest.ts';
import { isoTimestampSchema } from '../primitives.ts';
import { classifyManifest, classifyTool } from './classify-tool.ts';
import { RULE } from './rule-ids.ts';
import { declared, hint } from './test-builders.ts';

function tool(over: Partial<ToolDefinition> & { name: string; inputSchema: JsonSchema }): ToolDefinition {
  return { annotations: declared(), ...over };
}

const findingIds = (fs: readonly { ruleId: unknown }[]) => fs.map((f) => f.ruleId as string);

describe('classifyTool', () => {
  it('flags a deleting tool that declares readOnlyHint:true as critical write-as-readonly', () => {
    const out = classifyTool(
      tool({
        name: 'delete_account',
        inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9]+$' } } },
        annotations: declared({ readOnly: hint.true }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(findingIds(out.value)).toContain(RULE.writeAsReadonly as string);
    const wr = out.value.find((f) => f.ruleId === RULE.writeAsReadonly);
    expect(wr?.severity).toBe('critical');
    expect(wr?.rationale.length).toBeGreaterThan(0);
  });

  it('flags a write_file that declares readOnlyHint:true as critical write-as-readonly', () => {
    // The write-family recall case: `write` derives `mutating`, so a read-only declaration on a tool
    // that overwrites a file is caught as the highest-severity under-declaration — the lie a
    // spec-conformant client would otherwise trust to skip its confirmation prompt.
    const out = classifyTool(
      tool({
        name: 'write_file',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' }, contents: { type: 'string' } },
        },
        annotations: declared({ readOnly: hint.true }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const wr = out.value.find((f) => f.ruleId === RULE.writeAsReadonly);
    expect(wr, 'write_file with readOnlyHint:true must produce a write-as-readonly finding').toBeDefined();
    expect(wr?.verdict).toBe('under-declared');
    expect(wr?.severity).toBe('critical');
    expect(wr?.rationale.length).toBeGreaterThan(0);
  });

  it('does not flag a generate-named tool that honestly declares readOnlyHint:true', () => {
    // The reply-content regression case (shape of Supabase's generate_typescript_types): `generate`
    // dominantly names tools that return generated content in the reply, so it is screened out of
    // the write families. With no signal fired, derivation is silence, and silence cannot
    // contradict an explicit honest declaration.
    const out = classifyTool(
      tool({
        name: 'generate_typescript_types',
        inputSchema: { type: 'object', properties: { project_id: { type: 'string' } } },
        annotations: declared({
          readOnly: hint.true,
          destructive: hint.false,
          openWorld: hint.false,
          idempotent: hint.true,
        }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(findingIds(out.value)).not.toContain(RULE.writeAsReadonly as string);
  });

  it('does not flag a generate-named tool with an empty input schema and honest annotations', () => {
    // The shape of HubSpot's hubspot-generate-feedback-link: no parameters at all, returns a URL
    // in the reply, honestly declared read-only. A correct linter emits nothing.
    const out = classifyTool(
      tool({
        name: 'hubspot-generate-feedback-link',
        inputSchema: { type: 'object', properties: {} },
        annotations: declared({
          readOnly: hint.true,
          destructive: hint.false,
          openWorld: hint.false,
          idempotent: hint.true,
        }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toHaveLength(0);
  });

  it('does not flag an install-named tool that honestly declares readOnlyHint:true', () => {
    // The shape of Azure's extension_cli_install, which returns installation *instructions* in the
    // reply: `install` is screened out of the execute family for the same reply-content reason.
    const out = classifyTool(
      tool({
        name: 'extension_cli_install',
        inputSchema: {
          type: 'object',
          properties: {
            'auth-method': { type: 'string', enum: ['Credential', 'Key', 'ConnectionString'] },
            'cli-type': { type: 'string' },
          },
        },
        annotations: declared({
          readOnly: hint.true,
          destructive: hint.false,
          openWorld: hint.false,
          idempotent: hint.true,
        }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(findingIds(out.value)).not.toContain(RULE.writeAsReadonly as string);
  });

  it('flags a silent, out-of-vocabulary write tool as destructive-absent from its schema shape', () => {
    // The verb-recall case: `reconcile` is in no verb family, so the name is silent. The write is
    // carried entirely by the schema — `create`/`update` operation params typed as collections —
    // which derives `mutating`. Fully unannotated, the spec default already prompts, so this is the
    // informational destructive-absent nudge, not an accusation.
    const out = classifyTool(
      tool({
        name: 'reconcile_ledger',
        inputSchema: {
          type: 'object',
          properties: {
            create: { type: 'array', items: { type: 'object' } },
            update: { type: 'array', items: { type: 'object' } },
          },
        },
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const da = out.value.find((f) => f.ruleId === RULE.destructiveAbsent);
    expect(
      da,
      'a write-shaped schema must derive a destructive write even with an unknown verb',
    ).toBeDefined();
    expect(da?.verdict).toBe('undeclared');
    expect(da?.rationale.length).toBeGreaterThan(0);
  });

  it('flags an out-of-vocabulary write tool declaring readOnlyHint:true as critical write-as-readonly', () => {
    // The dangerous residual case: the same write-shaped schema under an unknown verb, now carrying a
    // false readOnlyHint:true. The schema evidence is what lets the top-severity rule fire where the
    // name alone would have derived silence and let the false claim through.
    const out = classifyTool(
      tool({
        name: 'reconcile_ledger',
        inputSchema: {
          type: 'object',
          properties: {
            create: { type: 'array', items: { type: 'object' } },
            update: { type: 'array', items: { type: 'object' } },
          },
        },
        annotations: declared({ readOnly: hint.true }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const wr = out.value.find((f) => f.ruleId === RULE.writeAsReadonly);
    expect(wr, 'a write-shaped schema under readOnlyHint:true must produce write-as-readonly').toBeDefined();
    expect(wr?.verdict).toBe('under-declared');
    expect(wr?.severity).toBe('critical');
  });

  it('does not flag a read tool whose write-op-named filter is an object, even under readOnlyHint:true', () => {
    // The benign-conflict gate, closed by construction: a read tool carrying an `update` *object*
    // filter. The write-op shape requires an array of records, so an object filter never fires; the
    // tool derives silence, and its honest readOnlyHint:true stays consistent. This is the guard
    // against the highest-severity false positive — a false write-as-readonly on an honest read.
    const out = classifyTool(
      tool({
        name: 'get_changes',
        inputSchema: {
          type: 'object',
          properties: { update: { type: 'object', properties: { since: { type: 'string' } } } },
        },
        annotations: declared({ readOnly: hint.true }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(findingIds(out.value)).not.toContain(RULE.writeAsReadonly as string);
    expect(out.value.filter((f) => f.ruleClass === 'honesty')).toHaveLength(0);
  });

  it('surfaces an unconstrained code parameter as an advisory (non-verdict) finding', () => {
    const out = classifyTool(
      tool({
        name: 'run_shell_command',
        inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const freeform = out.value.find((f) => f.ruleId === RULE.freeformInputAsCode);
    expect(freeform).toBeDefined();
    expect(freeform?.ruleClass).toBe('advisory');
    expect(freeform?.severity).toBe('medium');
  });

  it('a clean, honest read produces no findings', () => {
    const out = classifyTool(
      tool({
        name: 'get_user',
        inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9]+$' } } },
        annotations: declared({ readOnly: hint.true }),
      }),
      VOCABULARY,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toHaveLength(0);
  });
});

describe('classifyManifest fold', () => {
  it('concatenates per-tool findings in manifest order, deterministically', () => {
    const manifest: ToolManifest = {
      source: { kind: 'file', path: 'example.json' },
      capturedAt: isoTimestampSchema.parse('2026-07-05T00:00:00Z'),
      tools: [
        tool({
          name: 'delete_account',
          inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9]+$' } } },
          annotations: declared({ readOnly: hint.true }),
        }),
        tool({
          name: 'get_user',
          inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9]+$' } } },
          annotations: declared({ readOnly: hint.true }),
        }),
      ],
    };
    const out = classifyManifest(manifest, VOCABULARY);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(findingIds(out.value)).toContain(RULE.writeAsReadonly as string);
    // Re-running yields byte-identical output (determinism).
    const again = classifyManifest(manifest, VOCABULARY);
    expect(JSON.stringify(again.ok && again.value)).toBe(JSON.stringify(out.value));
  });
});
