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
