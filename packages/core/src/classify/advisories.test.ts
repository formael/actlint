// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Advisory (hygiene) detection: fires on schema-shape properties with no MCP hint counterpart, and
// stays quiet on benign tools. Advisories are never verdict-bearing and never gate.

import { describe, expect, it } from 'vitest';

import type { JsonSchema } from '../manifest.ts';
import { advisories } from './advisories.ts';
import { RULE } from './rule-ids.ts';
import { dim, profile, sig } from './test-builders.ts';

const ids = (fs: ReturnType<typeof advisories>) => fs.map((f) => f.ruleId as string);

describe('freeform-input-as-code', () => {
  it('fires when the engine already fired the unconstrained-code signal', () => {
    const derived = profile({
      destructiveness: dim('mutating', 'medium', [sig('shape.freeform-code-input')]),
    });
    const out = advisories({ type: 'object' }, derived, [sig('shape.freeform-code-input', 'strong')]);
    expect(ids(out)).toContain(RULE.freeformInputAsCode as string);
  });

  it('stays quiet when no code signal fired', () => {
    const derived = profile({ destructiveness: dim('read-only', 'high', [sig('verb.read')]) });
    const out = advisories({ type: 'object' }, derived, [sig('verb.read')]);
    expect(ids(out)).not.toContain(RULE.freeformInputAsCode as string);
  });
});

describe('no-scope-constraint', () => {
  const unconstrained: JsonSchema = { type: 'object', properties: { target: { type: 'string' } } };
  const constrained: JsonSchema = {
    type: 'object',
    properties: { target: { type: 'string', enum: ['a', 'b'] } },
  };

  it('fires on a sensitive tool whose schema bounds nothing', () => {
    const derived = profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) });
    const out = advisories(unconstrained, derived, [sig('verb.delete')]);
    expect(ids(out)).toContain(RULE.noScopeConstraint as string);
  });

  it('stays quiet when the schema constrains its parameters', () => {
    const derived = profile({ destructiveness: dim('deleting', 'high', [sig('verb.delete')]) });
    const out = advisories(constrained, derived, [sig('verb.delete')]);
    expect(ids(out)).not.toContain(RULE.noScopeConstraint as string);
  });

  it('stays quiet on a non-sensitive tool even with an unconstrained schema', () => {
    const derived = profile({ destructiveness: dim('read-only', 'high', [sig('verb.read')]) });
    const out = advisories(unconstrained, derived, [sig('verb.read')]);
    expect(ids(out)).not.toContain(RULE.noScopeConstraint as string);
  });

  it('stays quiet when a sensitive reading is only uncertain', () => {
    const derived = profile({ destructiveness: dim('deleting', 'uncertain', [sig('verb.delete')]) });
    const out = advisories(unconstrained, derived, [sig('verb.delete')]);
    expect(ids(out)).not.toContain(RULE.noScopeConstraint as string);
  });
});
