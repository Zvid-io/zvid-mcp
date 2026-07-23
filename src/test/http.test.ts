import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  createZvidHttpServer,
  protectedResourceMetadataUrl,
  type ZvidHttpServerOptions,
} from "../http.js";

const DRAFT_ID = "prj_00000000000000000000";
const IMAGE_PAYLOAD = {
  type: "image",
  name: "Launch Card",
  width: 1280,
  height: 720,
  outputFormat: "png",
  backgroundColor: "#0b1020",
  visuals: [
    {
      type: "TEXT",
      text: "Launch faster",
      position: "center-center",
      width: 900,
      height: 160,
      style: {
        color: "#ffffff",
        fontSize: "72px",
        fontFamily: "Inter",
      },
    },
  ],
};

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  options: ZvidHttpServerOptions = {},
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
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("publishes RFC 9728 protected-resource metadata", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
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
      'Bearer resource_metadata="https://mcp.zvid.io/.well-known/oauth-protected-resource/mcp", scope="zvid:mcp"',
    );
  });
});

test("builds the path-specific protected-resource metadata URL", () => {
  assert.equal(
    protectedResourceMetadataUrl("https://mcp.zvid.io/mcp"),
    "https://mcp.zvid.io/.well-known/oauth-protected-resource/mcp",
  );
});

test("accepts an active OAuth token and reads the dashboard MCP defaults", async () => {
  const validations: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    validations.push(String(input));
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer zvo_at_test",
    );
    const body = String(input).endsWith("/api/oauth/token-info")
      ? {
          active: true,
          resource: "https://mcp.zvid.io/mcp",
          scopes: ["zvid:mcp"],
        }
      : { defaultProfile: "advanced", defaultMaxRenderCredits: 250 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
      assert.match(body.result.instructions, /plan_creative_video/);
      assert.deepEqual(validations, [
        "https://api.zvid.io/api/oauth/token-info",
        "https://api.zvid.io/api/mcp/preferences",
      ]);
    },
    { fetchImpl },
  );
});

test("concrete request settings override the dashboard snapshot source", async () => {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requests.push(String(input));
    return new Response(
      JSON.stringify({
        active: true,
        resource: "https://mcp.zvid.io/mcp",
        scopes: ["zvid:mcp"],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await withServer(
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/mcp?profile=developer&maxRenderCredits=400`,
        {
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
        },
      );

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.match(body.result.instructions, /plan_creative_video/);
      assert.deepEqual(requests, ["https://api.zvid.io/api/oauth/token-info"]);
    },
    { fetchImpl },
  );
});

test("rejects an unknown request profile before authentication", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp?profile=admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, -32602);
    assert.match(body.error.message, /Invalid Zvid tool profile/);
  });
});

test("maps legacy Advanced workflow URLs to Creator", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        active: true,
        resource: "https://mcp.zvid.io/mcp",
        scopes: ["zvid:mcp"],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp?profile=advanced`, {
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
            clientInfo: { name: "legacy-advanced", version: "1.0.0" },
          },
        }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.match(body.result.instructions, /Creator uses exact, quality-first/);
    },
    { fetchImpl },
  );
});

test("rejects an invalid request credit limit before authentication", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp?maxRenderCredits=10.5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, -32602);
    assert.match(body.error.message, /integer from 1 to 10000/);
  });
});

test("an explicit workflow credit limit overrides the hosted fallback", async () => {
  let renderCalls = 0;
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 29,
        payload: body.payload,
        warnings: [],
      });
    }
    if (url.pathname === "/api/projects" && init?.method === "POST") {
      return Response.json(
        {
          project: {
            id: DRAFT_ID,
            name: body.name,
            payload: body.payload,
            version: 1,
          },
        },
        { status: 201 },
      );
    }
    if (url.pathname === `/api/projects/${DRAFT_ID}`) {
      return Response.json({
        project: {
          id: DRAFT_ID,
          name: "Launch Card",
          payload: IMAGE_PAYLOAD,
          version: 1,
        },
      });
    }
    if (url.pathname === "/api/render/image/api-key") {
      renderCalls += 1;
      return Response.json({ jobId: body.jobId, status: "queued" });
    }
    return Response.json(
      { error: "NOT_FOUND", message: url.pathname },
      { status: 404 },
    );
  }) as typeof fetch;

  await withServer(
    async (baseUrl) => {
      const callTool = async (
        maxRenderCredits: number,
        name: string,
        args: Record<string, unknown>,
      ) => {
        const response = await fetch(
          `${baseUrl}/mcp?profile=creator&maxRenderCredits=${maxRenderCredits}`,
          {
            method: "POST",
            headers: {
              "X-Api-Key": "zvid_test",
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
              "Mcp-Protocol-Version": "2025-03-26",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name, arguments: args },
            }),
          },
        );
        assert.equal(response.status, 200);
        return (await response.json()).result;
      };

      const createdResult = await callTool(30, "create_media", {
        brief: "Create a launch card",
        type: "image",
        payload: IMAGE_PAYLOAD,
      });
      const created = JSON.parse(createdResult.content[0].text);
      assert.equal(created.estimatedCredits, 29);
      assert.equal(
        created.editorUrl,
        `https://editor.zvid.io/?project=${DRAFT_ID}`,
      );

      const rendered = await callTool(30, "render_media", {
        draftId: DRAFT_ID,
        quoteToken: created.quoteToken,
      });
      assert.equal(rendered.isError, undefined);
      assert.equal(renderCalls, 1);

      const blocked = await callTool(28, "render_media", {
        draftId: DRAFT_ID,
        quoteToken: created.quoteToken,
      });
      assert.equal(blocked.isError, true);
      assert.match(blocked.content[0].text, /per-render limit of 28/);
      assert.equal(renderCalls, 1);
    },
    {
      fetchImpl,
      quoteSecret: "http-credit-limit-test-secret",
      maxRenderCredits: 10,
    },
  );
});
