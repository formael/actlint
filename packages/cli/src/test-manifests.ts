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
