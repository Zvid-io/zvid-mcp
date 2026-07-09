#!/usr/bin/env node
/**
 * zvid-mcp entry point: stdio transport.
 *
 * Env:
 *   ZVID_API_KEY  (required)  API key from the Zvid dashboard (zvid_...)
 *   ZVID_API_URL  (optional)  Orchestrator base URL, default https://api.zvid.io
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { DEFAULT_BASE_URL, ZvidClient } from "./client.js";
import { createZvidServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main() {
  const apiKey = process.env.ZVID_API_KEY ?? "";
  const baseUrl = process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    // stderr only — stdout is reserved for the MCP protocol.
    console.error(
      "zvid-mcp: ZVID_API_KEY is not set. Create an API key in the Zvid dashboard and export it before starting the server."
    );
    process.exit(1);
  }

  const client = new ZvidClient({ apiKey, baseUrl });
  const server = createZvidServer({ client, version });
  await server.connect(new StdioServerTransport());
  console.error(`zvid-mcp ${version} ready (API: ${baseUrl})`);
}

main().catch((err) => {
  console.error("zvid-mcp fatal:", err);
  process.exit(1);
});
