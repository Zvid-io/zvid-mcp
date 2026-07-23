import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { parseSampledPayload } from "../agentFacade.js";
import { ZvidClient } from "../client.js";
import { createZvidServer } from "../server.js";

const DRAFT_ID = "prj_00000000000000000000";
const REVISION_ID = "prj_11111111111111111111";
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

function firstJson(result: unknown): any {
  const content = (result as { content: { type: string; text: string }[] })
    .content;
  return JSON.parse(content[0].text);
}

async function creatorClient(
  fetchImpl: typeof fetch,
  sampling?: (prompt: string) => Record<string, unknown>,
) {
  const zvid = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000",
    fetchImpl,
  });
  const server = createZvidServer({
    client: zvid,
    profile: "developer",
    quoteSecret: "agent-facade-test-secret",
    maxRenderCredits: 10,
    now: () => new Date("2026-07-20T10:00:00.000Z"),
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "agent-facade-test", version: "1.0.0" },
    sampling ? { capabilities: { sampling: {} } } : undefined,
  );
  if (sampling) {
    client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
      const message = request.params.messages[0];
      const prompt =
        !Array.isArray(message.content) && message.content.type === "text"
          ? message.content.text
          : "";
      return {
        model: "test-composer",
        role: "assistant",
        content: {
          type: "text",
          text: JSON.stringify(sampling(prompt)),
        },
      };
    });
  }
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

test("sampled project parser accepts fenced JSON and rejects prose-only output", () => {
  assert.deepEqual(
    parseSampledPayload('```json\n{"type":"image","visuals":[]}\n```'),
    { type: "image", visuals: [] },
  );
  assert.throws(() => parseSampledPayload("I cannot do that"), /JSON object/);
  assert.throws(() => parseSampledPayload("{bad json}"), /invalid JSON/);
});

test("create_media saves a validated draft and render_media spends only the signed quote", async () => {
  const seen: Array<{ method: string; path: string; body?: any }> = [];
  let storedPayload = IMAGE_PAYLOAD;
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ method: init?.method ?? "GET", path: url.pathname, body });
    const respond = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname === "/api/render/validate/api-key") {
      return respond({
        valid: true,
        creditsRequired: 3,
        payload: body.payload,
        warnings: [],
      });
    }
    if (url.pathname === "/api/projects" && init?.method === "POST") {
      storedPayload = body.payload;
      return respond(
        {
          project: {
            id: DRAFT_ID,
            name: body.name,
            payload: storedPayload,
            version: 1,
          },
        },
        201,
      );
    }
    if (url.pathname === `/api/projects/${DRAFT_ID}`) {
      return respond({
        project: {
          id: DRAFT_ID,
          name: "Launch Card",
          payload: storedPayload,
          version: 1,
        },
      });
    }
    if (url.pathname === "/api/render/image/api-key") {
      return respond({ jobId: body.jobId, status: "queued" }, 202);
    }
    return respond({ error: "NOT_FOUND", message: url.pathname }, 404);
  }) as typeof fetch;

  const client = await creatorClient(fetchImpl);
  const created = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "Create a dark launch card",
        type: "image",
        payload: IMAGE_PAYLOAD,
      },
    }),
  );
  assert.equal(created.draftId, DRAFT_ID);
  assert.equal(
    created.editorUrl,
    `https://editor.zvid.io/?project=${DRAFT_ID}`,
  );
  assert.equal(created.readyToRender, true);
  assert.equal(created.estimatedCredits, 3);
  assert.ok(created.quoteToken);
  assert.equal(
    seen.some((call) => call.path === "/api/render/image/api-key"),
    false,
    "draft creation must not spend credits",
  );

  const idempotencyKey = "00000000-0000-4000-8000-000000000001";
  const rendered = firstJson(
    await client.callTool({
      name: "render_media",
      arguments: {
        draftId: DRAFT_ID,
        quoteToken: created.quoteToken,
        idempotencyKey,
      },
    }),
  );
  assert.equal(rendered.jobId, idempotencyKey);
  const renderCall = seen.find(
    (call) => call.path === "/api/render/image/api-key",
  );
  assert.equal(renderCall?.body.jobId, idempotencyKey);
  assert.deepEqual(renderCall?.body.payload, IMAGE_PAYLOAD);
});

test("render_media rejects a tampered quote before calling the render API", async () => {
  const paths: string[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 3,
        payload: body.payload,
      });
    }
    if (url.pathname === "/api/projects" && init?.method === "POST") {
      return Response.json(
        {
          project: {
            id: DRAFT_ID,
            name: "Draft",
            payload: body.payload,
            version: 1,
          },
        },
        { status: 201 },
      );
    }
    return Response.json({
      project: {
        id: DRAFT_ID,
        name: "Draft",
        payload: IMAGE_PAYLOAD,
        version: 1,
      },
    });
  }) as typeof fetch;
  const client = await creatorClient(fetchImpl);
  const created = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "Create a launch card",
        type: "image",
        payload: IMAGE_PAYLOAD,
      },
    }),
  );
  const result = await client.callTool({
    name: "render_media",
    arguments: {
      draftId: DRAFT_ID,
      quoteToken: `${created.quoteToken}tampered`,
    },
  });
  assert.equal(result.isError, true);
  assert.equal(
    paths.some(
      (path) =>
        path.startsWith("/api/render/image") || path === "/api/render/api-key",
    ),
    false,
  );
});

test("render_media enforces the server-side per-render credit ceiling", async () => {
  const paths: string[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    paths.push(url.pathname);
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 11,
        payload: body.payload,
      });
    }
    if (url.pathname === "/api/projects" && init?.method === "POST") {
      return Response.json(
        {
          project: {
            id: DRAFT_ID,
            name: "Draft",
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
          name: "Draft",
          payload: IMAGE_PAYLOAD,
          version: 1,
        },
      });
    }
    return Response.json({ jobId: "must-not-render" });
  }) as typeof fetch;
  const client = await creatorClient(fetchImpl);
  const created = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "Create a launch card",
        type: "image",
        payload: IMAGE_PAYLOAD,
      },
    }),
  );
  const result = await client.callTool({
    name: "render_media",
    arguments: {
      draftId: DRAFT_ID,
      quoteToken: created.quoteToken,
    },
  });
  assert.equal(result.isError, true);
  assert.match(
    (result.content as { text: string }[])[0].text,
    /above the MCP per-render limit/,
  );
  assert.match(
    (result.content as { text: string }[])[0].text,
    /dashboard MCP credit limit|Max Render Credits/,
  );
  assert.equal(
    paths.some((path) => path === "/api/render/image/api-key"),
    false,
  );
});

test("revise_media creates an immutable project copy and never updates its source", async () => {
  const seen: Array<{ method: string; path: string }> = [];
  const revisedPayload = {
    ...IMAGE_PAYLOAD,
    visuals: [{ ...IMAGE_PAYLOAD.visuals[0], text: "Launch smarter" }],
  };
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ method: init?.method ?? "GET", path: url.pathname });
    if (url.pathname === `/api/projects/${DRAFT_ID}`) {
      return Response.json({
        project: {
          id: DRAFT_ID,
          name: "Original",
          payload: IMAGE_PAYLOAD,
          version: 4,
        },
      });
    }
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 3,
        payload: body.payload,
      });
    }
    if (url.pathname === "/api/projects" && init?.method === "POST") {
      return Response.json(
        {
          project: {
            id: REVISION_ID,
            name: body.name,
            payload: body.payload,
            version: 1,
          },
        },
        { status: 201 },
      );
    }
    return Response.json({}, { status: 404 });
  }) as typeof fetch;
  const client = await creatorClient(fetchImpl);
  const revised = firstJson(
    await client.callTool({
      name: "revise_media",
      arguments: {
        draftId: DRAFT_ID,
        instruction: "Use a smarter headline",
        payload: revisedPayload,
      },
    }),
  );
  assert.equal(revised.draftId, REVISION_ID);
  assert.equal(revised.revisionOf, DRAFT_ID);
  assert.equal(revised.previousVersion, 4);
  assert.equal(
    seen.some((call) => call.method === "PUT"),
    false,
    "revisions must never mutate the source project",
  );
});

test("create_media composes from a brief through MCP sampling when supported", async () => {
  let sampledPrompt = "";
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname === "/api/render/creative-plan/api-key") {
      return Response.json({ directions: [{ style: "modern" }] });
    }
    if (url.pathname === "/api/library/examples") {
      return Response.json({ items: [] });
    }
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 3,
        payload: body.payload,
      });
    }
    if (url.pathname === "/api/projects") {
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
    return Response.json({}, { status: 404 });
  }) as typeof fetch;
  const client = await creatorClient(fetchImpl, (prompt) => {
    sampledPrompt = prompt;
    return IMAGE_PAYLOAD;
  });
  const created = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "A modern launch card for an analytics product",
        type: "image",
      },
    }),
  );
  assert.equal(created.composition, "sampling");
  assert.match(sampledPrompt, /analytics product/);
  assert.equal(created.draftId, DRAFT_ID);
});

test("brief-only creation falls back safely when the MCP client lacks sampling", async () => {
  const paths: string[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    paths.push(url.pathname);
    if (url.pathname === "/api/render/creative-plan/api-key") {
      return Response.json({ directions: [] });
    }
    if (url.pathname === "/api/library/examples") {
      return Response.json({ items: [] });
    }
    if (url.pathname === "/api/render/validate/api-key") {
      return Response.json({
        valid: true,
        creditsRequired: 3,
        payload: body.payload,
      });
    }
    if (url.pathname === "/api/projects") {
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
    return Response.json({}, { status: 404 });
  }) as typeof fetch;
  const client = await creatorClient(fetchImpl);
  const created = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "Create a launch card without a supplied payload",
        type: "image",
      },
    }),
  );
  assert.equal(created.composition, "deterministic-fallback");
  assert.match(created.qualityNotice, /does not support sampling/);
  assert.equal(created.draftId, DRAFT_ID);
  assert.equal(paths.includes("/api/projects"), true);

  const video = firstJson(
    await client.callTool({
      name: "create_media",
      arguments: {
        brief: "Create a concise vertical product launch video",
        type: "video",
        aspectRatio: "9:16",
        duration: 12,
      },
    }),
  );
  assert.equal(video.composition, "deterministic-fallback");
  assert.equal(video.mediaType, "video");
  assert.equal(
    paths.some(
      (path) =>
        path.startsWith("/api/render/image") || path === "/api/render/api-key",
    ),
    false,
  );
});

test("agent facade publishes quality-first workflow prompts and safe resources", async () => {
  const client = await creatorClient(fetch);
  const prompts = await client.listPrompts();
  assert.deepEqual(prompts.prompts.map((prompt) => prompt.name).sort(), [
    "create-product-promo",
    "create-social-reel",
    "create-square-post",
    "create-thumbnail",
  ]);
  const renderedPrompt = await client.getPrompt({
    name: "create-product-promo",
    arguments: { brief: "Launch a premium t-shirt" },
  });
  const promptText = renderedPrompt.messages[0].content;
  assert.equal(promptText.type, "text");
  assert.match(promptText.text, /plan_creative_video/);
  assert.match(promptText.text, /exact validated payload/);
  const resources = await client.listResources();
  assert.deepEqual(resources.resources.map((resource) => resource.uri).sort(), [
    "zvid://account/summary",
    "zvid://authoring/guidelines",
  ]);
  const guide = await client.readResource({
    uri: "zvid://authoring/guidelines",
  });
  assert.ok("text" in guide.contents[0]);
  assert.match(String(guide.contents[0].text), /adaptationContract/);
});
