// Fixture: a PLANTED SDK-boundary violation. The MCP SDK may appear ONLY in packages/mcp-fetch.
// check-sdk-boundary must fail on this file.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type Leaked = typeof Client;
