#!/usr/bin/env node
/**
 * zvid-mcp entry point: stdio transport.
 *
 * Credential resolution (first match wins per field — see cli.ts):
 *   flags (--api-key / --api-url) > env (ZVID_API_KEY / ZVID_API_URL)
 *   > ~/.zvid-mcp.json > default https://api.zvid.io
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { loadConfigFile, parseCliOptions, resolveCredentials } from "./cli.js";
import { DEFAULT_BASE_URL, ZvidClient } from "./client.js";
import { parseToolProfile } from "./profiles.js";
import { createZvidServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main() {
  const cli = parseCliOptions(process.argv.slice(2));
  const fileConfig = loadConfigFile();
  const resolved = resolveCredentials(
    cli,
    {
      apiKey: process.env.ZVID_API_KEY,
      apiUrl: process.env.ZVID_API_URL,
      profile: process.env.ZVID_MCP_PROFILE,
    },
    fileConfig
  );
  const apiKey = resolved.apiKey;
  const baseUrl = resolved.apiUrl ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    // stderr only — stdout is reserved for the MCP protocol.
    console.error(
      "zvid-mcp: no API key. Set the ZVID_API_KEY environment variable, pass --api-key zvid_... on the command line, or put { \"apiKey\": \"zvid_...\" } in ~/.zvid-mcp.json (create a key in the Zvid dashboard under Settings → API Keys)."
    );
    process.exit(1);
  }

  const client = new ZvidClient({ apiKey, baseUrl });
  const server = createZvidServer({
    client,
    version,
    profile: parseToolProfile(resolved.profile),
    quoteSecret: process.env.ZVID_MCP_QUOTE_SECRET,
    maxRenderCredits: positiveNumber(
      process.env.ZVID_MCP_MAX_RENDER_CREDITS,
    ),
  });
  await server.connect(new StdioServerTransport());
  console.error(`zvid-mcp ${version} ready (API: ${baseUrl})`);
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

main().catch((err) => {
  console.error("zvid-mcp fatal:", err);
  process.exit(1);
});
