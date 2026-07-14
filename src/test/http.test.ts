import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  createZvidHttpServer,
  protectedResourceMetadataUrl,
  type ZvidHttpServerOptions,
} from "../http.js";

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  options: ZvidHttpServerOptions = {}
) {
  const server = createZvidHttpServer({
    mcpResource: "https://mcp.zvid.io/mcp",
    oauthIssuer: "https://api.zvid.io",
    fallbackApiKey: "",
    ...options,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test("publishes RFC 9728 protected-resource metadata", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      resource: "https://mcp.zvid.io/mcp",
      authorization_servers: ["https://api.zvid.io"],
      scopes_supported: ["zvid:mcp"],
      bearer_methods_supported: ["header"],
      resource_name: "Zvid MCP",
      resource_documentation: "https://docs.zvid.io",
    });
  });
});

test("unauthenticated MCP requests return an OAuth discovery challenge", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("www-authenticate"),
      'Bearer resource_metadata="https://mcp.zvid.io/.well-known/oauth-protected-resource/mcp", scope="zvid:mcp"'
    );
  });
});

test("builds the path-specific protected-resource metadata URL", () => {
  assert.equal(
    protectedResourceMetadataUrl("https://mcp.zvid.io/mcp"),
    "https://mcp.zvid.io/.well-known/oauth-protected-resource/mcp"
  );
});

test("accepts an active OAuth token issued for this MCP resource", async () => {
  const validations: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    validations.push(String(input));
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer zvo_at_test"
    );
    return new Response(
      JSON.stringify({
        active: true,
        resource: "https://mcp.zvid.io/mcp",
        scopes: ["zvid:mcp"],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer zvo_at_test",
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "oauth-test", version: "1.0.0" },
          },
        }),
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.result.serverInfo.name, "zvid");
      assert.deepEqual(validations, [
        "https://api.zvid.io/api/oauth/token-info",
      ]);
    },
    { fetchImpl }
  );
});
