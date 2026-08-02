// Fixture: a PLANTED SDK-boundary violation using the v2 package scope.
// The MCP SDK v2 ships as `@modelcontextprotocol/client` (and `core`, `server`); it may
// appear ONLY in packages/mcp-fetch. check-sdk-boundary must fail on this file.
import { Client } from '@modelcontextprotocol/client/stdio';

export type Leaked = typeof Client;
