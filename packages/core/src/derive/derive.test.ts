// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The engine's top-level acceptance suite: the golden fixtures (the executable spec, one file per
// signal family), the determinism check (byte-identical across runs), and the property tests that
// are the anti-sweet-talk backbone — laws that must hold for ALL inputs, not just the examples.

import { VOCABULARY } from '@formael/action-risk-vocabulary';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { DeclaredHint, DeclaredProfile } from '../declared.ts';
import { actionRiskProfileSchema } from '../dimensions.ts';
import type { JsonSchema, ToolDefinition } from '../manifest.ts';
import { concernRank } from './ordinals.ts';
import type { DerivationResult } from './types.ts';

import descriptionPhrase from './__fixtures__/description-phrase.json' with { type: 'json' };
import nameVerb from './__fixtures__/name-verb.json' with { type: 'json' };
import schemaShape from './__fixtures__/schema-shape.json' with { type: 'json' };
import silenceAndUnknown from './__fixtures__/silence-and-unknown.json' with { type: 'json' };
import workedExample from './__fixtures__/worked-example.json' with { type: 'json' };
import { derive } from './derive.ts';

interface FixtureFile {
  readonly family: string;
  readonly intent: string;
  readonly cases: readonly {
    readonly name: string;
    readonly intent: string;
    readonly tool: ToolDefinition;
    readonly expected: DerivationResult;
  }[];
}

const FIXTURES = [
  nameVerb,
  descriptionPhrase,
  schemaShape,
  workedExample,
  silenceAndUnknown,
] as unknown as FixtureFile[];

describe('golden fixtures (per signal family)', () => {
  for (const file of FIXTURES) {
    describe(file.family, () => {
      for (const testCase of file.cases) {
        it(`${testCase.name} — ${testCase.intent}`, () => {
          const result = derive(testCase.tool, VOCABULARY);
          expect(result).toEqual(testCase.expected);
          // The profile a fixture pins is always a structurally valid profile.
          expect(actionRiskProfileSchema.safeParse(result.profile).success).toBe(true);
        });
      }
    });
  }
});

describe('determinism', () => {
  const allTools = FIXTURES.flatMap((f) => f.cases.map((c) => c.tool));

  it('re-running derive on the same tool yields byte-identical output', () => {
    for (const tool of allTools) {
      const first = JSON.stringify(derive(tool, VOCABULARY));
      const second = JSON.stringify(derive(tool, VOCABULARY));
      expect(second).toBe(first);
    }
  });
});

// ---------------------------------------------------------------------------
// Property tests — the laws that make the engine impossible to sweet-talk.
// ---------------------------------------------------------------------------

const hintArb: fc.Arbitrary<DeclaredHint> = fc.constantFrom(
  { state: 'true' },
  { state: 'false' },
  { state: 'absent' },
);

const annotationsArb: fc.Arbitrary<DeclaredProfile> = fc
  .record(
    {
      readOnly: hintArb,
      destructive: hintArb,
      idempotent: hintArb,
      openWorld: hintArb,
    },
    { requiredKeys: [] },
  )
  .map((hints) => ({ ...hints, unknownHints: {} }));

// A pool of names spanning every verb family plus neutral (no-verb) names.
const nameArb = fc.constantFrom(
  'get_user',
  'create_record',
  'update_config',
  'delete_repository',
  'send_notification',
  'wire_transfer',
  'exec_sql',
  'ping',
  'handle_event',
  'process_item',
);

const descriptionArb = fc.option(
  fc.constantFrom(
    'Reads a value.',
    'This will permanently delete the row and cannot be undone.',
    'Posts to an external service.',
    'Does not permanently delete anything.',
  ),
  { nil: undefined },
);

const schemaArb: fc.Arbitrary<JsonSchema> = fc.constantFrom<JsonSchema>(
  { type: 'object', properties: {} },
  { type: 'object', properties: { id: { type: 'string' } } },
  { type: 'object', properties: { sql: { type: 'string' } } },
  { type: 'object', properties: { to: { type: 'string', format: 'email' } } },
  { type: 'object', properties: { webhook: { type: 'string' } } },
);

const toolArb: fc.Arbitrary<ToolDefinition> = fc
  .record({ name: nameArb, description: descriptionArb, inputSchema: schemaArb, annotations: annotationsArb })
  .map(({ description, ...rest }) => (description === undefined ? rest : { ...rest, description }));

describe('property: derivation is declaration-blind', () => {
  it('the derived profile is independent of tool.annotations', () => {
    fc.assert(
      fc.property(toolArb, annotationsArb, annotationsArb, (tool, annotationsA, annotationsB) => {
        const a = derive({ ...tool, annotations: annotationsA }, VOCABULARY);
        const b = derive({ ...tool, annotations: annotationsB }, VOCABULARY);
        expect(a).toEqual(b);
      }),
    );
  });

  it('adding a reassuring annotation never changes a derived level (cannot be sweet-talked)', () => {
    const reassuring: DeclaredProfile = {
      readOnly: { state: 'true' },
      destructive: { state: 'false' },
      openWorld: { state: 'false' },
      unknownHints: {},
    };
    fc.assert(
      fc.property(toolArb, (tool) => {
        const before = derive(tool, VOCABULARY).profile;
        const after = derive({ ...tool, annotations: reassuring }, VOCABULARY).profile;
        expect(after).toEqual(before);
      }),
    );
  });
});

describe('property: silence is unknown, never a benign default', () => {
  it('any dimension with no provenance is `unknown`, never a safe level', () => {
    fc.assert(
      fc.property(toolArb, (tool) => {
        const { profile } = derive(tool, VOCABULARY);
        for (const dimension of Object.values(profile)) {
          if (dimension.provenance.length === 0) {
            expect(dimension.level).toBe('unknown');
          }
        }
      }),
    );
  });
});

describe('property: adding a signal never lowers a derived concern level', () => {
  // Monotonicity at the derive boundary: extending a tool name with a more-concerning verb never
  // walks a dimension back down the concern order. (A neutral name is the baseline.)
  it('prefixing a delete verb never lowers destructiveness below the neutral baseline', () => {
    fc.assert(
      fc.property(schemaArb, annotationsArb, (inputSchema, annotations) => {
        const neutral = derive({ name: 'handle_item', inputSchema, annotations }, VOCABULARY);
        const escalated = derive({ name: 'delete_item', inputSchema, annotations }, VOCABULARY);
        const neutralRank = concernRank('destructiveness', neutral.profile.destructiveness.level);
        const escalatedRank = concernRank('destructiveness', escalated.profile.destructiveness.level);
        expect(escalatedRank).toBeGreaterThanOrEqual(neutralRank);
      }),
    );
  });
});
