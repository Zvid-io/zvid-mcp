#!/usr/bin/env node
/**
 * zvid-mcp entry point: Streamable HTTP transport (hosted mode, e.g. https://mcp.zvid.io/mcp).
 *
 * Stateless: every POST /mcp creates a fresh McpServer + transport pair, so the
 * service needs no session affinity and scales horizontally.
 *
 * Auth — per-request Zvid API key, first match wins:
 *   1. `Authorization: Bearer zvid_...`  (recommended; what MCP clients send via "headers")
 *   2. `X-Api-Key: zvid_...`             (same header the REST API uses)
 *   3. `ZVID_API_KEY` env                (single-tenant/self-hosted deployments only)
 *
 * Env:
 *   PORT          (optional) listen port, default 8080
 *   ZVID_API_URL  (optional) orchestrator base URL, default https://api.zvid.io
 *   ZVID_API_KEY  (optional) fallback API key when the request carries none
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DEFAULT_BASE_URL, ZvidClient } from "./client.js";
import { createZvidServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const PORT = Number(process.env.PORT || 8080);
const BASE_URL = process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;

function apiKeyFrom(req: IncomingMessage): string {
  const auth = req.headers.authorization;
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim()) return headerKey.trim();
  return process.env.ZVID_API_KEY ?? "";
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// Permissive CORS so browser-based MCP clients can connect.
function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Api-Key, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse) {
  const apiKey = apiKeyFrom(req);
  if (!apiKey) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="zvid-mcp"');
    sendJson(res, 401, {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Missing Zvid API key. Send it as `Authorization: Bearer zvid_...` (create a key in the Zvid dashboard under Settings → API Keys).",
      },
      id: null,
    });
    return;
  }

  const client = new ZvidClient({ apiKey, baseUrl: BASE_URL });
  const server = createZvidServer({ client, version });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createServer((req, res) => {
  setCors(res);
  const path = (req.url ?? "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (path === "/healthz" || (path === "/" && req.method === "GET")) {
    sendJson(res, 200, { ok: true, name: "zvid-mcp", version });
    return;
  }
  if (path !== "/mcp") {
    sendJson(res, 404, { error: "not_found", message: "MCP endpoint is POST /mcp" });
    return;
  }
  if (req.method !== "POST") {
    // Stateless mode: no server-initiated SSE streams (GET) or sessions to delete.
    res.setHeader("Allow", "POST");
    sendJson(res, 405, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST (stateless Streamable HTTP)." },
      id: null,
    });
    return;
  }

  handleMcpPost(req, res).catch((err) => {
    console.error("zvid-mcp request error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    } else {
      res.end();
    }
  });
});

httpServer.listen(PORT, () => {
  console.error(`zvid-mcp ${version} listening on :${PORT} (API: ${BASE_URL})`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
