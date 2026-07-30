// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Manifest text used by the CLI test suites. These are the captured-manifest form the file and stdin
// sources accept: no `source` field (the source is set by the reader from where the bytes came from),
// a provenance-only `capturedAt`, and the four MCP tool fields. Not part of the shipped surface.

// A single honest read-only tool: it derives read-only and declares readOnlyHint: true, so the scan
// is clean — no findings, grade A, exit 0.
export const CLEAN_MANIFEST = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  protocolRevision: '2025-06-18',
  tools: [
    {
      name: 'get_user',
      description: 'Fetch a user by id.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { readOnly: { state: 'true' }, unknownHints: {} },
    },
  ],
});

// A destructive tool that simply declares nothing. Its worst honesty finding is `destructive-absent`
// (undeclared, low) — the spec default already prompts — so it produces findings but does NOT fail
// the default `high` gate. It exercises the "findings present, below threshold" path.
export const UNDECLARED_MANIFEST = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  protocolRevision: '2025-06-18',
  tools: [
    {
      name: 'delete_repository',
      description: 'Permanently delete a repository.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { unknownHints: {} },
    },
  ],
});

// A tool whose name/schema derive a mutating write while it declares readOnlyHint: true — the
// canonical write-as-readonly under-declaration (critical), which fails the default gate.
export const DISHONEST_MANIFEST = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  protocolRevision: '2025-06-18',
  tools: [
    {
      name: 'exec_sql',
      description: 'Run a SQL statement against the database.',
      inputSchema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
      annotations: { readOnly: { state: 'true' }, unknownHints: {} },
    },
  ],
});

// A tool with an opaque, out-of-vocabulary name and a signal-free schema, declaring no annotations:
// actlint recognizes nothing, so it derives all-silent and produces no findings. Coverage reports it
// as unassessed — the case where a grade must not read as a clean bill of health.
export const UNASSESSED_MANIFEST = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  protocolRevision: '2025-06-18',
  tools: [
    {
      name: 'zorp_widget',
      description: 'Operate on a widget.',
      inputSchema: { type: 'object', properties: { handle: { type: 'string' } } },
      annotations: { unknownHints: {} },
    },
  ],
});

// A multi-tool server whose tools carry recognizable risk signals (so they are assessed) but which
// declares no MCP annotation anywhere. Coverage reports annotatedTools: 0, so a scorecard states
// plainly that nothing was declared — an all-consistent read can no longer hide a silent server.
export const SILENT_SERVER_MANIFEST = JSON.stringify({
  capturedAt: '2026-01-01T00:00:00.000Z',
  protocolRevision: '2025-06-18',
  tools: [
    {
      name: 'get_user',
      description: 'Fetch a user by id.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { unknownHints: {} },
    },
    {
      name: 'list_items',
      description: 'List items in a collection.',
      inputSchema: { type: 'object', properties: { collection: { type: 'string' } } },
      annotations: { unknownHints: {} },
    },
  ],
});
