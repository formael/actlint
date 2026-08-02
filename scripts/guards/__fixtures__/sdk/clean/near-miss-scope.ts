// Fixture: near-miss names that merely contain "modelcontextprotocol" but are NOT under the
// `@modelcontextprotocol/` scope. The guard matches the scope prefix exactly, so these pass.
import type { Helper } from 'modelcontextprotocol-utils';
import type { Other } from '@modelcontextprotocols/x';

export type Surface = [Helper, Other];
