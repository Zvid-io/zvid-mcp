#!/usr/bin/env node
/**
 * Hosted Streamable HTTP MCP resource.
 *
 * OAuth is the default for hosted clients. Legacy API keys are still accepted
 * for backwards compatibility and self-hosted callers.
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DEFAULT_BASE_URL, ZvidClient } from "./client.js";
import { createZvidServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const DEFAULT_MCP_RESOURCE = "https://mcp.zvid.io/mcp";
const DEFAULT_OAUTH_ISSUER = "https://api.zvid.io";
const OAUTH_SCOPE = "zvid:mcp";

type Credential =
  | { kind: "apiKey"; value: string }
  | { kind: "oauth"; value: string };

export interface ZvidHttpServerOptions {
  baseUrl?: string;
  mcpResource?: string;
  oauthIssuer?: string;
  fallbackApiKey?: string;
  fetchImpl?: typeof fetch;
}

export function protectedResourceMetadata(
  mcpResource = DEFAULT_MCP_RESOURCE,
  oauthIssuer = DEFAULT_OAUTH_ISSUER
) {
  return {
    resource: mcpResource,
    authorization_servers: [oauthIssuer.replace(/\/+$/, "")],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Zvid MCP",
    resource_documentation: "https://docs.zvid.io",
  };
}

export function protectedResourceMetadataUrl(mcpResource: string) {
  const resource = new URL(mcpResource);
  const suffix = resource.pathname === "/" ? "" : resource.pathname;
  return new URL(`/.well-known/oauth-protected-resource${suffix}`, resource)
    .toString()
    .replace(/\/$/, "");
}

function credentialFrom(
  req: IncomingMessage,
  fallbackApiKey?: string
): Credential | null {
  const auth = req.headers.authorization;
  if (auth && /^bearer\s+/i.test(auth)) {
    const value = auth.replace(/^bearer\s+/i, "").trim();
    if (value) {
      return value.startsWith("zvid_")
        ? { kind: "apiKey", value }
        : { kind: "oauth", value };
    }
  }
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return { kind: "apiKey", value: headerKey.trim() };
  }
  return fallbackApiKey ? { kind: "apiKey", value: fallbackApiKey } : null;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Api-Key, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, WWW-Authenticate"
  );
}

function sendOAuthChallenge(
  res: ServerResponse,
  mcpResource: string,
  description: string
) {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${protectedResourceMetadataUrl(
      mcpResource
    )}", scope="${OAUTH_SCOPE}"`
  );
  sendJson(res, 401, {
    jsonrpc: "2.0",
    error: { code: -32001, message: description },
    id: null,
  });
}

async function validateOAuthToken(
  token: string,
  baseUrl: string,
  mcpResource: string,
  fetchImpl: typeof fetch
) {
  const response = await fetchImpl(
    `${baseUrl.replace(/\/+$/, "")}/api/oauth/token-info`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "zvid-mcp",
      },
    }
  );
  if (!response.ok) return false;
  const info = (await response.json()) as {
    active?: boolean;
    resource?: string;
    scopes?: string[];
    scope?: string;
  };
  const scopes = info.scopes ?? String(info.scope ?? "").split(/\s+/);
  return (
    info.active === true &&
    info.resource === mcpResource &&
    scopes.includes(OAUTH_SCOPE)
  );
}

export function createZvidHttpServer(options: ZvidHttpServerOptions = {}) {
  const baseUrl = options.baseUrl ?? process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;
  const mcpResource =
    options.mcpResource ?? process.env.ZVID_MCP_RESOURCE ?? DEFAULT_MCP_RESOURCE;
  const oauthIssuer =
    options.oauthIssuer ?? process.env.ZVID_OAUTH_ISSUER ?? DEFAULT_OAUTH_ISSUER;
  const fallbackApiKey = options.fallbackApiKey ?? process.env.ZVID_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function handleMcpPost(req: IncomingMessage, res: ServerResponse) {
    const credential = credentialFrom(req, fallbackApiKey);
    if (!credential) {
      sendOAuthChallenge(
        res,
        mcpResource,
        "Authentication required. Sign in with OAuth, or provide a Zvid API key for legacy access."
      );
      return;
    }

    if (credential.kind === "oauth") {
      let valid = false;
      try {
        valid = await validateOAuthToken(
          credential.value,
          baseUrl,
          mcpResource,
          fetchImpl
        );
      } catch {
        valid = false;
      }
      if (!valid) {
        sendOAuthChallenge(
          res,
          mcpResource,
          "The OAuth access token is invalid, expired, or was not issued for this MCP server."
        );
        return;
      }
    }

    const client = new ZvidClient({
      ...(credential.kind === "apiKey"
        ? { apiKey: credential.value }
        : { accessToken: credential.value }),
      baseUrl,
      fetchImpl,
    });
    const server = createZvidServer({ client, version });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  }

  return createServer((req, res) => {
    setCors(res);
    const path = (req.url ?? "/").split("?")[0].replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (
      path === "/.well-known/oauth-protected-resource" ||
      path === "/.well-known/oauth-protected-resource/mcp"
    ) {
      sendJson(res, 200, protectedResourceMetadata(mcpResource, oauthIssuer));
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
      res.setHeader("Allow", "POST");
      sendJson(res, 405, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed. Use POST (stateless Streamable HTTP).",
        },
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
}

function start() {
  const port = Number(process.env.PORT || 8080);
  const baseUrl = process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;
  const httpServer = createZvidHttpServer();
  httpServer.listen(port, () => {
    console.error(`zvid-mcp ${version} listening on :${port} (API: ${baseUrl})`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    });
  }
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) start();
