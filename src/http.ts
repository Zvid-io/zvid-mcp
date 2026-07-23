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
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DEFAULT_BASE_URL, ZvidClient } from "./client.js";
import {
  DEFAULT_TOOL_PROFILE,
  parseToolProfile,
  resolveToolProfile,
  type ToolProfile,
} from "./profiles.js";
import { createZvidServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const DEFAULT_MCP_RESOURCE = "https://mcp.zvid.io/mcp";
const DEFAULT_OAUTH_ISSUER = "https://api.zvid.io";
const OAUTH_SCOPE = "zvid:mcp";
const OAUTH_SCOPES = [OAUTH_SCOPE];
const DEFAULT_MAX_RENDER_CREDITS = 30;
const MAX_CONFIGURABLE_RENDER_CREDITS = 10_000;

type Credential =
  { kind: "apiKey"; value: string } | { kind: "oauth"; value: string };

export interface ZvidHttpServerOptions {
  baseUrl?: string;
  mcpResource?: string;
  oauthIssuer?: string;
  fallbackApiKey?: string;
  fetchImpl?: typeof fetch;
  profile?: ToolProfile;
  quoteSecret?: string;
  maxRenderCredits?: number;
}

export function protectedResourceMetadata(
  mcpResource = DEFAULT_MCP_RESOURCE,
  oauthIssuer = DEFAULT_OAUTH_ISSUER,
) {
  return {
    resource: mcpResource,
    authorization_servers: [oauthIssuer.replace(/\/+$/, "")],
    scopes_supported: OAUTH_SCOPES,
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
  fallbackApiKey?: string,
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
    "Content-Type, Authorization, X-Api-Key, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, WWW-Authenticate",
  );
}

function sendOAuthChallenge(
  res: ServerResponse,
  mcpResource: string,
  description: string,
) {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${protectedResourceMetadataUrl(
      mcpResource,
    )}", scope="${OAUTH_SCOPE}"`,
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
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(
    `${baseUrl.replace(/\/+$/, "")}/api/oauth/token-info`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "zvid-mcp",
      },
    },
  );
  if (!response.ok) return false;
  const info = (await response.json()) as {
    active?: boolean;
    resource?: string;
    scopes?: string[];
    scope?: string;
  };
  const scopes = info.scopes ?? String(info.scope ?? "").split(/\s+/);
  return Boolean(
    info.active === true &&
    info.resource === mcpResource &&
    scopes.includes(OAUTH_SCOPE),
  );
}

function requestedProfile(
  req: IncomingMessage,
): { ok: true; profile?: ToolProfile } | { ok: false; value: string } {
  const url = new URL(req.url ?? "/mcp", "http://zvid-mcp.local");
  const values = url.searchParams.getAll("profile");
  if (values.length === 0) return { ok: true };
  if (values.length !== 1) return { ok: false, value: values.join(",") };

  const value = values[0].trim().toLowerCase();
  const profile = resolveToolProfile(value);
  return profile
    ? { ok: true, profile }
    : { ok: false, value: values[0] };
}

function requestedMaxRenderCredits(
  req: IncomingMessage,
): { ok: true; maxRenderCredits?: number } | { ok: false; value: string } {
  const url = new URL(req.url ?? "/mcp", "http://zvid-mcp.local");
  const values = url.searchParams.getAll("maxRenderCredits");
  if (values.length === 0) return { ok: true };
  if (values.length !== 1) return { ok: false, value: values.join(",") };

  const value = Number(values[0]);
  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_CONFIGURABLE_RENDER_CREDITS
    ? { ok: true, maxRenderCredits: value }
    : { ok: false, value: values[0] };
}

async function dashboardPreferences(
  client: ZvidClient,
  fallbackProfile: ToolProfile,
  fallbackMaxRenderCredits: number,
): Promise<{
  defaultProfile: ToolProfile;
  defaultMaxRenderCredits: number;
}> {
  try {
    const preferences = await client.get<{
      defaultProfile?: unknown;
      defaultMaxRenderCredits?: unknown;
    }>("/api/mcp/preferences");
    const storedMaxRenderCredits = Number(preferences.defaultMaxRenderCredits);
    return {
      defaultProfile:
        resolveToolProfile(preferences.defaultProfile) ?? fallbackProfile,
      defaultMaxRenderCredits:
        Number.isSafeInteger(storedMaxRenderCredits) &&
        storedMaxRenderCredits > 0 &&
        storedMaxRenderCredits <= MAX_CONFIGURABLE_RENDER_CREDITS
          ? storedMaxRenderCredits
          : fallbackMaxRenderCredits,
    };
  } catch {
    return {
      defaultProfile: fallbackProfile,
      defaultMaxRenderCredits: fallbackMaxRenderCredits,
    };
  }
}

export function createZvidHttpServer(options: ZvidHttpServerOptions = {}) {
  const baseUrl =
    options.baseUrl ?? process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;
  const mcpResource =
    options.mcpResource ??
    process.env.ZVID_MCP_RESOURCE ??
    DEFAULT_MCP_RESOURCE;
  const oauthIssuer =
    options.oauthIssuer ??
    process.env.ZVID_OAUTH_ISSUER ??
    DEFAULT_OAUTH_ISSUER;
  const fallbackApiKey = options.fallbackApiKey ?? process.env.ZVID_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const configuredProfile =
    options.profile ??
    parseToolProfile(process.env.ZVID_MCP_PROFILE, DEFAULT_TOOL_PROFILE);
  const quoteSecret =
    options.quoteSecret ??
    process.env.ZVID_MCP_QUOTE_SECRET ??
    crypto.randomBytes(32).toString("hex");
  const configuredMaxRenderCredits =
    options.maxRenderCredits ??
    positiveNumber(process.env.ZVID_MCP_MAX_RENDER_CREDITS) ??
    DEFAULT_MAX_RENDER_CREDITS;

  async function handleMcpPost(req: IncomingMessage, res: ServerResponse) {
    const selected = requestedProfile(req);
    if (!selected.ok) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32602,
          message: `Invalid Zvid tool profile "${selected.value}". Use readonly, creator, automation, or developer.`,
        },
        id: null,
      });
      return;
    }
    const selectedMaxRenderCredits = requestedMaxRenderCredits(req);
    if (!selectedMaxRenderCredits.ok) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32602,
          message: `Invalid Zvid maxRenderCredits value "${selectedMaxRenderCredits.value}". Use an integer from 1 to ${MAX_CONFIGURABLE_RENDER_CREDITS}.`,
        },
        id: null,
      });
      return;
    }

    const credential = credentialFrom(req, fallbackApiKey);
    if (!credential) {
      sendOAuthChallenge(
        res,
        mcpResource,
        "Authentication required. Sign in with OAuth, or provide a Zvid API key for legacy access.",
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
          fetchImpl,
        );
      } catch {
        valid = false;
      }
      if (!valid) {
        sendOAuthChallenge(
          res,
          mcpResource,
          "The OAuth access token is invalid, expired, or was not issued for this MCP server.",
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
    const preferences =
      selected.profile !== undefined &&
      selectedMaxRenderCredits.maxRenderCredits !== undefined
        ? null
        : await dashboardPreferences(
            client,
            configuredProfile,
            configuredMaxRenderCredits,
          );
    const profile =
      selected.profile ?? preferences?.defaultProfile ?? configuredProfile;
    const maxRenderCredits =
      selectedMaxRenderCredits.maxRenderCredits ??
      preferences?.defaultMaxRenderCredits ??
      configuredMaxRenderCredits;
    const server = createZvidServer({
      client,
      version,
      profile,
      quoteSecret,
      maxRenderCredits,
    });
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
      sendJson(res, 404, {
        error: "not_found",
        message: "MCP endpoint is POST /mcp",
      });
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

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) &&
    parsed > 0 &&
    parsed <= MAX_CONFIGURABLE_RENDER_CREDITS
    ? parsed
    : undefined;
}

function start() {
  const port = Number(process.env.PORT || 8080);
  const baseUrl = process.env.ZVID_API_URL ?? DEFAULT_BASE_URL;
  const httpServer = createZvidHttpServer();
  httpServer.listen(port, () => {
    console.error(
      `zvid-mcp ${version} listening on :${port} (API: ${baseUrl})`,
    );
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    });
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) start();
