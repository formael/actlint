// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// @formael/actlint-mcp-fetch — IMPURE boundary.
// The single impurity: the only network code and the only place @modelcontextprotocol/sdk
// appears. It acquires a server's tools (live, server-card, registry, or file), never calls
// them, and returns a normalized ToolManifest behind an anti-corruption boundary.
export const MCP_FETCH_PACKAGE = '@formael/actlint-mcp-fetch';
