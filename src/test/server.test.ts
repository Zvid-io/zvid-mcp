import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ZvidClient } from "../client.js";
import { createZvidServer } from "../server.js";
import type { ToolProfile } from "../profiles.js";

const EXPECTED_TOOLS = [
  "create_media",
  "revise_media",
  "render_media",
  "get_media",
  "list_media",
  "get_account",
  "create_render",
  "create_image_render",
  "get_project_schema",
  "validate_project_json",
  "list_supported_elements",
  "get_element_docs",
  "get_example_payload",
  "plan_creative_video",
  "find_matching_examples",
  "start_from_example",
  "render_from_example",
  "search_creative_library",
  "get_creative_asset",
  "list_stock_providers",
  "search_stock_media",
  "repair_project_json",
  "get_render",
  "list_renders",
  "create_bulk_render",
  "get_bulk_render",
  "list_bulk_renders",
  "list_templates",
  "get_template",
  "create_template",
  "duplicate_template",
  "preview_template",
  "list_projects",
  "get_project",
  "create_project",
  "list_webhooks",
  "create_webhook",
  "get_webhook",
  "test_webhook",
  "list_webhook_deliveries",
  "get_credits",
  "get_usage_stats",
];

const DISABLED_MUTATION_TOOLS = [
  "update_template",
  "delete_template",
  "update_project",
  "delete_project",
  "update_webhook",
  "delete_webhook",
];

async function connectedClient(
  fetchImpl: typeof fetch,
  profile: ToolProfile = "developer",
) {
  const zvid = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000",
    fetchImpl,
  });
  const server = createZvidServer({
    client: zvid,
    profile,
    quoteSecret: "server-test-secret",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

test("lists all Zvid tools", async () => {
  const client = await connectedClient(fetch);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...EXPECTED_TOOLS].sort());
  assert.deepEqual(
    names.filter((name) => DISABLED_MUTATION_TOOLS.includes(name)),
    [],
    "update/delete tools must remain hidden from MCP clients",
  );
});

test("creator profile exposes quality authoring and requires exact payloads", async () => {
  const client = await connectedClient(fetch, "creator");
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  for (const name of [
    "plan_creative_video",
    "find_matching_examples",
    "start_from_example",
    "search_creative_library",
    "search_stock_media",
    "validate_project_json",
    "create_project",
    "create_template",
    "create_media",
    "render_media",
  ]) {
    assert.ok(names.includes(name), name);
  }
  for (const name of [
    "create_render",
    "create_image_render",
    "render_from_example",
    "create_bulk_render",
    "create_webhook",
  ]) {
    assert.equal(names.includes(name), false, name);
  }
  const render = tools.find((tool) => tool.name === "render_media");
  assert.equal(render?.annotations?.readOnlyHint, false);
  assert.equal(render?.annotations?.destructiveHint, true);
  const account = tools.find((tool) => tool.name === "get_account");
  assert.equal(account?.annotations?.readOnlyHint, true);
  const create = tools.find((tool) => tool.name === "create_media");
  assert.ok(create?.inputSchema.required?.includes("brief"));
  assert.ok(create?.inputSchema.required?.includes("payload"));
  assert.match(
    String((create?.inputSchema as any).properties.brief.description),
    /Never call create_media without this value/,
  );
  assert.match(String(create?.description), /refuses brief-only composition/);
  const revise = tools.find((tool) => tool.name === "revise_media");
  assert.ok(revise?.inputSchema.required?.includes("payload"));
});

test("automation profile caps bulk calls and redacts stored webhook secrets", async () => {
  const fetchImpl = (async () =>
    Response.json({
      webhook: {
        id: "whk_00000000000000000000",
        url: "https://hooks.example.com/zvid",
        secret: "whsec_do_not_expose",
        nested: { signingSecret: "whsec_nested" },
      },
    })) as typeof fetch;
  const client = await connectedClient(fetchImpl, "automation");
  const { tools } = await client.listTools();
  const bulk = tools.find((tool) => tool.name === "create_bulk_render");
  assert.equal(
    (bulk?.inputSchema as any).properties.items.maxItems,
    25,
  );

  const webhook = firstJson(
    await client.callTool({
      name: "get_webhook",
      arguments: { webhookId: "whk_00000000000000000000" },
    }),
  );
  assert.equal(webhook.webhook.secret, "[REDACTED]");
  assert.equal(webhook.webhook.nested.signingSecret, "[REDACTED]");
  assert.ok(!JSON.stringify(webhook).includes("whsec_do_not_expose"));
});

test("advertises the example-first workflow as server instructions", async () => {
  const client = await connectedClient(fetch);
  const instructions = client.getInstructions();
  assert.ok(instructions, "initialize result should carry instructions");
  assert.match(instructions!, /example-first/);
  assert.match(instructions!, /start_from_example/);
  assert.match(instructions!, /render_from_example/);
  assert.match(instructions!, /validate_project_json/);
});

test("get_render calls GET /api/jobs/:id and returns the job", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (url: URL | RequestInfo) => {
    seen.push(String(url));
    return new Response(
      JSON.stringify({ id: "job-1", state: "completed", progress: 100 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({
    name: "get_render",
    arguments: { jobId: "job-1" },
  });

  assert.equal(seen[0], "http://localhost:4000/api/jobs/job-1");
  const content = result.content as { type: string; text: string }[];
  const body = JSON.parse(content[0].text);
  assert.equal(body.state, "completed");
});

test("create_render rejects payload+template together without calling the API", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({
    name: "create_render",
    arguments: {
      payload: { type: "video" },
      template: "tpl_00000000000000000000",
    },
  });

  assert.equal(called, false);
  assert.equal(result.isError, true);
});

test("template tools expose create and duplicate without risky mutations", async () => {
  const seen: Array<{ method: string; path: string; body?: unknown }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({
        template: {
          id: "tpl_00000000000000000000",
          name: "Promo",
          project: { duration: 5 },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  const templateId = "tpl_00000000000000000000";

  await client.callTool({
    name: "create_template",
    arguments: { name: "Promo", payload: { duration: 5 } },
  });
  await client.callTool({
    name: "duplicate_template",
    arguments: { templateId },
  });

  assert.deepEqual(
    seen.map(({ method, path }) => `${method} ${path}`),
    [
      "POST /api/templates",
      `POST /api/templates/${templateId}/duplicate`,
    ],
  );
  assert.deepEqual(seen[0].body, { name: "Promo", payload: { duration: 5 } });
});

function firstJson(result: unknown): any {
  const content = (result as { content: { type: string; text: string }[] })
    .content;
  return JSON.parse(content[0].text);
}

test("get_project_schema returns a structured JSON Schema + notes", async () => {
  const client = await connectedClient(fetch);
  const result = await client.callTool({
    name: "get_project_schema",
    arguments: {},
  });
  const body = firstJson(result);

  assert.equal(
    body.jsonSchema.$schema,
    "https://json-schema.org/draft/2020-12/schema",
  );
  assert.equal(body.jsonSchema.type, "object");
  assert.ok(
    body.jsonSchema.properties.visuals,
    "schema should describe visuals",
  );
  assert.ok(
    body.jsonSchema.$defs.textElement,
    "schema should define textElement",
  );
  assert.ok(
    Array.isArray(body.validationNotes) && body.validationNotes.length > 0,
  );
  assert.ok(
    Array.isArray(body.authoringGuidelines) &&
      body.authoringGuidelines.length >= 8,
  );
  assert.ok(body.planLimits.freeTier.maxDuration);

  const envelope = await client.callTool({
    name: "get_project_schema",
    arguments: { target: "render-request" },
  });
  const envBody = firstJson(envelope);
  assert.ok(
    envBody.jsonSchema.properties.template,
    "envelope schema should describe template",
  );
});

test("get_project_schema prefers the live plan-aware authoring endpoint", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (url: URL | RequestInfo) => {
    seen.push(String(url));
    return new Response(
      JSON.stringify({
        schemaVersion: "1.0.0",
        sourceOfTruth: "orch/middleware/validation.js (createProjectSchema)",
        target: "project",
        jsonSchema: { type: "object", maximumFromPlan: 42 },
        validationNotes: [],
        authoringGuidelines: ["Use scenes"],
        authoringWorkflow: ["Validate before rendering"],
        planLimits: { planName: "Test", maxDuration: 42 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  const body = firstJson(
    await client.callTool({ name: "get_project_schema", arguments: {} }),
  );
  assert.equal(
    seen[0],
    "http://localhost:4000/api/render/schema/api-key?target=project",
  );
  assert.equal(body.planLimits.maxDuration, 42);
  assert.equal(body.authoringWorkflow[0], "Validate before rendering");
});

test("validate_project_json accepts a valid payload without calling the API", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({
    name: "validate_project_json",
    arguments: {
      payload: {
        type: "video",
        duration: 10,
        visuals: [
          {
            type: "TEXT",
            text: "Hello",
            style: { fontSize: "64px", color: "#ffffff" },
          },
        ],
      },
      remote: false,
    },
  });

  assert.equal(called, false, "local validation must not hit the API");
  const body = firstJson(result);
  assert.equal(body.valid, true);
  assert.deepEqual(body.errors, []);
});

test("validate_project_json returns field-level errors for an invalid payload", async () => {
  const client = await connectedClient(fetch);
  const result = await client.callTool({
    name: "validate_project_json",
    arguments: {
      payload: {
        type: "image",
        duration: 10, // forbidden on image renders
        visuals: [
          { type: "IMAGE" }, // missing src
          { type: "VIDEO", src: "https://cdn.example.com/v.mp4" }, // not allowed in image
        ],
      },
      remote: false,
    },
  });

  const body = firstJson(result);
  assert.equal(body.valid, false);
  const fields = body.errors.map((e: { field: string }) => e.field);
  assert.ok(fields.includes("duration"));
  assert.ok(fields.includes("visuals[0].src"));
  assert.ok(fields.includes("visuals[1].type"));
  for (const e of body.errors) {
    assert.equal(typeof e.field, "string");
    assert.equal(typeof e.message, "string");
  }
});

test("validate_project_json surfaces layout lint warnings", async () => {
  const client = await connectedClient(fetch);
  const result = await client.callTool({
    name: "validate_project_json",
    arguments: {
      payload: {
        width: 1280,
        height: 720,
        visuals: [
          {
            type: "TEXT",
            text: "A",
            position: "center-center",
            width: 900,
            height: 150,
            style: { color: "#ffffff" },
          },
          {
            type: "TEXT",
            text: "B",
            position: "center-center",
            width: 900,
            height: 150,
            y: 60,
            style: { color: "#ffffff" },
          },
        ],
      },
      remote: false,
    },
  });
  const body = firstJson(result);
  assert.equal(body.valid, true, "layout problems are warnings, not errors");
  const all = body.warnings
    .map((w: { message: string }) => w.message)
    .join("\n");
  assert.match(all, /overlap on screen at the same time/);
  assert.match(all, /x\/y are IGNORED/);
});

test("validate_project_json remote: true posts to /api/render/validate/api-key", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (url: URL | RequestInfo) => {
    seen.push(String(url));
    return new Response(JSON.stringify({ valid: true, creditsRequired: 2 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({
    name: "validate_project_json",
    arguments: {
      payload: {
        type: "video",
        duration: 5,
        visuals: [{ type: "TEXT", text: "x" }],
      },
      remote: true,
    },
  });

  assert.equal(seen[0], "http://localhost:4000/api/render/validate/api-key");
  const body = firstJson(result);
  assert.equal(body.valid, true);
  assert.equal(body.remote.valid, true);
});

test("list_supported_elements and get_element_docs describe the element set", async () => {
  const client = await connectedClient(fetch);

  const list = firstJson(
    await client.callTool({ name: "list_supported_elements", arguments: {} }),
  );
  const types = list.elements.map((e: { type: string }) => e.type);
  assert.deepEqual(types, [
    "IMAGE",
    "VIDEO",
    "GIF",
    "SVG",
    "TEXT",
    "AUDIO",
    "SUBTITLE",
    "SCENE",
  ]);

  const text = firstJson(
    await client.callTool({
      name: "get_element_docs",
      arguments: { element: "TEXT" },
    }),
  );
  assert.equal(text.element.type, "TEXT");
  assert.ok(text.element.fields.length > 0);
  assert.ok(text.element.example);

  const bad = await client.callTool({
    name: "get_element_docs",
    arguments: { element: "HOLOGRAM" },
  });
  assert.equal(bad.isError, true);
});

test("get_example_payload returns validated examples", async () => {
  const client = await connectedClient(fetch);
  const one = firstJson(
    await client.callTool({
      name: "get_example_payload",
      arguments: { name: "promo-video" },
    }),
  );
  assert.equal(one.example.name, "promo-video");
  assert.equal(
    one.example.payload.scenes.length,
    3,
    "promo example should be scene-based",
  );

  const all = firstJson(
    await client.callTool({ name: "get_example_payload", arguments: {} }),
  );
  assert.equal(all.examples.length, 5);
});

test("plan_creative_video uses the live plan-aware endpoint", async () => {
  const seen: Array<{ path: string; body?: any }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({
        creativePlanVersion: "1.0.0",
        directions: [{ seed: 42 }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  const body = firstJson(
    await client.callTool({
      name: "plan_creative_video",
      arguments: {
        brief: "Launch an AI analytics product",
        variationMode: "fresh",
        recentAssetSlugs: ["old-one"],
      },
    }),
  );
  assert.equal(seen[0].path, "/api/render/creative-plan/api-key");
  assert.equal(seen[0].body.brief, "Launch an AI analytics product");
  assert.deepEqual(seen[0].body.recentAssetSlugs, ["old-one"]);
  assert.equal(body.directions[0].seed, 42);
});

test("plan_creative_video falls back to the bundled planner", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ error: "NOT_FOUND", message: "not deployed" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  const body = firstJson(
    await client.callTool({
      name: "plan_creative_video",
      arguments: {
        brief: "Introduce an AI analytics platform",
        variationMode: "consistent",
      },
    }),
  );
  assert.equal(body.live, false);
  assert.equal(body.directions[0].stylePack.id, "modern-saas");
  assert.match(body.creativeWorkflow.principle, /never template-only/i);
});

test("creative-library tools search metadata and fetch content", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    seen.push(url.pathname + url.search);
    const response = url.pathname.endsWith("/content")
      ? { type: "video", scenes: [] }
      : url.pathname.includes("/examples/demo")
        ? { slug: "demo", title: "Demo" }
        : { items: [{ slug: "demo" }], total: 1 };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const client = await connectedClient(fetchImpl);

  await client.callTool({
    name: "search_creative_library",
    arguments: { kind: "examples", query: "saas launch", limit: 8, offset: 0 },
  });
  const asset = firstJson(
    await client.callTool({
      name: "get_creative_asset",
      arguments: { kind: "examples", slug: "demo", includeContent: true },
    }),
  );
  assert.equal(seen[0], "/api/library/examples?q=saas+launch&limit=8&offset=0");
  assert.deepEqual(seen.slice(1), [
    "/api/library/examples/demo",
    "/api/library/examples/demo/content",
  ]);
  assert.equal(asset.item.slug, "demo");
  assert.equal(asset.content.type, "video");
});

test("stock-media tools expose providers and normalized search", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    seen.push(url.pathname + url.search);
    return new Response(
      JSON.stringify(
        url.pathname.endsWith("providers")
          ? { image: ["pexels"] }
          : { items: [] },
      ),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  await client.callTool({ name: "list_stock_providers", arguments: {} });
  await client.callTool({
    name: "search_stock_media",
    arguments: {
      type: "video",
      provider: "pexels",
      query: "analytics dashboard",
      page: 1,
      perPage: 6,
    },
  });
  assert.deepEqual(seen, [
    "/api/stock/providers",
    "/api/stock/search?type=video&provider=pexels&query=analytics+dashboard&page=1&perPage=6",
  ]);
});

test("repair_project_json fixes fixable problems and reports changes", async () => {
  const client = await connectedClient(fetch);
  const body = firstJson(
    await client.callTool({
      name: "repair_project_json",
      arguments: {
        payload: {
          type: "VIDEO",
          quality: 90,
          visuals: [{ type: "TEXT", text: "hi" }, { type: "TEXT" }],
        },
      },
    }),
  );
  assert.equal(body.valid, true);
  assert.equal(body.repaired.type, "video");
  assert.equal(body.repaired.quality, undefined);
  assert.equal(body.repaired.visuals.length, 1);
  assert.ok(body.changes.length >= 3);
});

const LIBRARY_LISTING = {
  kind: "examples",
  items: [
    {
      slug: "pro-ecom-flash-sale",
      title: "Flash Sale Countdown",
      description: "Flash sale promo with strike-through price and promo code",
      meta: {
        pack: "ecommerce",
        premium: true,
        resolution: "instagram-reel",
        duration: 16,
        scenes: 4,
        thumbnail: "https://cdn.example/t.jpg",
        preview: "https://cdn.example/p.mp4",
      },
    },
    {
      slug: "pro-holiday-sale",
      title: "Holiday Sale Blast",
      description: "Seasonal sale promo with gift badges",
      meta: {
        pack: "ecommerce",
        premium: true,
        resolution: "instagram-reel",
        duration: 12,
        scenes: 3,
      },
    },
    {
      slug: "ecom-hero-promo",
      title: "Product Hero Promo",
      description: "Hero product promo for online stores",
      meta: { pack: "ecommerce", resolution: "hd", duration: 30, scenes: 3 },
    },
    {
      slug: "gym-class-schedule",
      title: "Gym Class Schedule",
      description: "Weekly workout timetable for fitness studios",
      meta: { pack: "fitness", resolution: "hd", duration: 12, scenes: 3 },
    },
    {
      slug: "img-thumb-before-after",
      title: "Before / After",
      description: "Split-frame before and after thumbnail",
      meta: { pack: "thumbnail", type: "image", resolution: "hd" },
    },
  ],
};

/** Router-style fake fetch: first matching prefix wins. */
function routedFetch(
  seen: string[],
  routes: Array<[string, () => Response]>,
): typeof fetch {
  return (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    seen.push(url.pathname + url.search);
    for (const [prefix, respond] of routes) {
      if (url.pathname.startsWith(prefix)) return respond();
    }
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

const jsonResponse = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("find_matching_examples ranks the library and decides adapt-example", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [["/api/library/examples", jsonResponse(LIBRARY_LISTING)]]),
  );
  const body = firstJson(
    await client.callTool({
      name: "find_matching_examples",
      arguments: {
        brief: "Flash sale promo video for our online shoe store",
        type: "video",
        aspectRatio: "9:16",
        duration: 15,
        variationMode: "consistent",
      },
    }),
  );

  assert.equal(seen[0], "/api/library/examples");
  assert.equal(body.decision, "adapt-example");
  assert.equal(body.poolSize, 5);
  assert.equal(body.examples[0].slug, "pro-ecom-flash-sale");
  assert.equal(body.examples[0].matchStrength, "strong");
  assert.equal(body.examples[0].premium, true);
  assert.match(body.premiumNote, /paid plan/);
  assert.equal(body.assembleFrom, undefined, "strong match skips parts");
  assert.ok(
    !body.examples.some(
      (c: { slug: string }) => c.slug === "img-thumb-before-after",
    ),
    "image examples are filtered out for video briefs",
  );
  assert.match(body.nextSteps[0], /start_from_example/);
  assert.ok(Array.isArray(body.adaptationContract));
});

test("creator discovery routes exact payloads through create_media", async () => {
  const client = await connectedClient(
    routedFetch([], [["/api/library/examples", jsonResponse(LIBRARY_LISTING)]]),
    "creator",
  );
  const body = firstJson(
    await client.callTool({
      name: "find_matching_examples",
      arguments: {
        brief: "Flash sale promo video for our online shoe store",
        type: "video",
        aspectRatio: "9:16",
        variationMode: "consistent",
      },
    }),
  );
  const guidance = body.nextSteps.join("\n");
  assert.match(guidance, /create_media/);
  assert.doesNotMatch(guidance, /render_from_example|create_render/);
});

test("find_matching_examples falls back to assemble-similar with library parts", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [
      [
        "/api/library/design-templates",
        jsonResponse({
          items: [
            {
              slug: "gradient-hero",
              title: "Gradient Hero",
              description: "Animated gradient title",
              meta: { thumbnail: "https://cdn.example/dt.jpg" },
            },
          ],
        }),
      ],
      [
        "/api/library/shapes",
        jsonResponse({
          items: [
            {
              slug: "callout-arrow",
              title: "Callout Arrow",
              description: "callout-",
              meta: { width: 120, height: 80, svg: "<svg>big markup</svg>" },
            },
          ],
        }),
      ],
      ["/api/library/examples", jsonResponse(LIBRARY_LISTING)],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "find_matching_examples",
      arguments: { brief: "quantum physics lecture recap", type: "video" },
    }),
  );

  assert.equal(body.decision, "assemble-similar");
  assert.deepEqual(body.examples, []);
  assert.equal(body.assembleFrom.designTemplates[0].slug, "gradient-hero");
  assert.equal(body.assembleFrom.shapes[0].slug, "callout-arrow");
  assert.equal(
    body.assembleFrom.shapes[0].meta.svg,
    undefined,
    "inline SVG markup is trimmed from parts results",
  );
  assert.equal(body.assembleFrom.shapes[0].meta.width, 120);

  assert.equal(seen[0], "/api/library/examples");
  const partPaths = seen.slice(1);
  assert.ok(partPaths.length > 0);
  for (const p of partPaths) {
    assert.match(
      p,
      /^\/api\/library\/(design-templates|canvas-presets|shapes)\?q=[^&+]+&limit=8&offset=0$/,
      `parts searches must use short single-term queries: ${p}`,
    );
  }
});

test("plan_creative_video threads recentAssetSlugs into candidate exclusion", async () => {
  const client = await connectedClient(
    routedFetch([], [
      [
        "/api/render/creative-plan",
        jsonResponse({ error: "NOT_FOUND", message: "not deployed" }, 404),
      ],
      ["/api/library/examples", jsonResponse(LIBRARY_LISTING)],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "plan_creative_video",
      arguments: {
        brief: "Flash sale promo for our online shoe store",
        aspectRatio: "9:16",
        duration: 15,
        recentAssetSlugs: ["pro-ecom-flash-sale"],
      },
    }),
  );
  assert.ok(
    !body.libraryCandidates.examples.some(
      (c: { slug: string }) => c.slug === "pro-ecom-flash-sale",
    ),
    "recently used slugs must be excluded from candidates",
  );
  assert.ok(body.libraryCandidates.examples.length > 0);
});

test("start_from_example returns payload, adaptation map and template-route guidance", async () => {
  const payload = {
    type: "image",
    resolution: "hd",
    outputFormat: "png",
    variables: { headline: "Big Sale", img: "https://example.com/a.jpg" },
    visuals: [
      {
        type: "TEXT",
        html: "<p>{{headline}}</p><p>50% off</p>",
        style: { fontFamily: "Inter", fontSize: "64px", color: "#fff" },
        width: 800,
        height: 200,
        position: "center-center",
        track: 1,
      },
      { type: "IMAGE", src: "{{img}}", width: 1280, height: 720, track: 0 },
    ],
  };
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [
      [
        "/api/library/examples/img-thumb-before-after/content",
        jsonResponse(payload),
      ],
      [
        "/api/library/examples/img-thumb-before-after",
        jsonResponse(
          LIBRARY_LISTING.items.find(
            (i) => i.slug === "img-thumb-before-after",
          ),
        ),
      ],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "start_from_example",
      arguments: { slug: "img-thumb-before-after" },
    }),
  );

  assert.deepEqual(seen, [
    "/api/library/examples/img-thumb-before-after",
    "/api/library/examples/img-thumb-before-after/content",
  ]);
  assert.equal(body.item.slug, "img-thumb-before-after");
  assert.equal(body.payload.type, "image");
  assert.equal(body.adaptationMap.recommendedWorkflow, "template-render");
  assert.deepEqual(
    body.adaptationMap.variables.map((v: { name: string }) => v.name),
    ["headline", "img"],
  );
  assert.equal(body.adaptationMap.textSlots[0].text, "{{headline}} 50% off");
  assert.deepEqual(body.adaptationMap.mediaSlots[0].usesVariables, ["img"]);
  assert.match(body.validationNote, /template/i);
  assert.equal(body.validation, undefined);
  assert.match(body.nextSteps.join("\n"), /create_template/);
  assert.ok(Array.isArray(body.adaptationContract));
});

test("start_from_example validates static payloads for direct adaptation", async () => {
  const payload = {
    type: "video",
    duration: 8,
    visuals: [
      { type: "TEXT", text: "Hello", style: { fontSize: "64px", color: "#ffffff" } },
    ],
  };
  const client = await connectedClient(
    routedFetch([], [
      ["/api/library/examples/demo/content", jsonResponse(payload)],
      ["/api/library/examples/demo", jsonResponse({ slug: "demo", meta: {} })],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "start_from_example",
      arguments: { slug: "demo" },
    }),
  );
  assert.equal(body.adaptationMap.recommendedWorkflow, "direct-adapt");
  assert.equal(body.validation.valid, true);
  assert.match(body.nextSteps.join("\n"), /validate_project_json/);
});

test("start_from_example surfaces premium locks with free alternatives", async () => {
  const client = await connectedClient(
    routedFetch([], [
      [
        "/api/library/examples/pro-ecom-flash-sale/content",
        jsonResponse(
          { error: "PREMIUM_REQUIRED", message: "Premium plan required" },
          403,
        ),
      ],
      [
        "/api/library/examples/pro-ecom-flash-sale",
        jsonResponse(LIBRARY_LISTING.items[0]),
      ],
      ["/api/library/examples", jsonResponse(LIBRARY_LISTING)],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "start_from_example",
      arguments: { slug: "pro-ecom-flash-sale" },
    }),
  );
  assert.equal(body.premiumLocked, true);
  assert.match(body.message, /paid Zvid plan/);
  assert.ok(
    body.freeAlternatives.length > 0,
    "free alternatives should be suggested",
  );
  assert.ok(
    body.freeAlternatives.some(
      (c: { slug: string }) => c.slug === "ecom-hero-promo",
    ),
    "the free ecommerce example should surface as an alternative",
  );
  assert.ok(
    !body.freeAlternatives.some(
      (c: { slug: string }) => c.slug === "pro-holiday-sale",
    ),
    "other premium examples must be excluded from alternatives",
  );
  assert.ok(
    body.freeAlternatives.every((c: { premium: boolean }) => !c.premium),
  );
  assert.equal(body.payload, undefined);
});

test("start_from_example rethrows non-premium 401/403 errors", async () => {
  const client = await connectedClient(
    routedFetch([], [
      [
        "/api/library/examples/demo/content",
        jsonResponse({ error: "FORBIDDEN", message: "WAF block" }, 403),
      ],
      ["/api/library/examples/demo", jsonResponse({ slug: "demo", meta: {} })],
    ]),
  );
  const result = await client.callTool({
    name: "start_from_example",
    arguments: { slug: "demo" },
  });
  assert.equal(result.isError, true, "non-PREMIUM_REQUIRED 403 is a hard error");
  const content = result.content as { type: string; text: string }[];
  assert.match(content[0].text, /FORBIDDEN/);
});

test("get_creative_asset propagates premium content errors and honours includeContent:false", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [
      [
        "/api/library/examples/pro-x/content",
        jsonResponse(
          { error: "PREMIUM_REQUIRED", message: "Premium plan required" },
          403,
        ),
      ],
      ["/api/library/examples/pro-x", jsonResponse({ slug: "pro-x", meta: {} })],
    ]),
  );

  const locked = await client.callTool({
    name: "get_creative_asset",
    arguments: { kind: "examples", slug: "pro-x", includeContent: true },
  });
  assert.equal(locked.isError, true);
  const lockedText = (locked.content as { text: string }[])[0].text;
  assert.match(lockedText, /PREMIUM_REQUIRED/);
  assert.ok(!lockedText.includes("premiumLocked"), "no premiumLocked shape here");

  seen.length = 0;
  const metaOnly = firstJson(
    await client.callTool({
      name: "get_creative_asset",
      arguments: { kind: "examples", slug: "pro-x", includeContent: false },
    }),
  );
  assert.deepEqual(seen, ["/api/library/examples/pro-x"]);
  assert.equal(metaOnly.item.slug, "pro-x");
  assert.equal(metaOnly.content, undefined);
});

test("find_matching_examples reports adapt-or-assemble for partial matches with parts", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [["/api/library/examples", jsonResponse(LIBRARY_LISTING)]]),
  );
  const body = firstJson(
    await client.callTool({
      name: "find_matching_examples",
      arguments: {
        brief: "workout schedule video",
        type: "video",
        aspectRatio: "9:16",
      },
    }),
  );
  assert.equal(body.decision, "adapt-or-assemble");
  assert.equal(body.examples[0].slug, "gym-class-schedule");
  assert.equal(body.examples[0].matchStrength, "partial");
  assert.match(body.decisionReason, /partial matches/);
  assert.ok(body.assembleFrom, "partial matches still include assembly parts");
});

test("find_matching_examples honours explicit includeParts and threads filter args", async () => {
  // includeParts: false suppresses every parts search even with no match
  const seenOff: string[] = [];
  const clientOff = await connectedClient(
    routedFetch(seenOff, [
      ["/api/library/examples", jsonResponse(LIBRARY_LISTING)],
    ]),
  );
  const off = firstJson(
    await clientOff.callTool({
      name: "find_matching_examples",
      arguments: { brief: "quantum physics lecture recap", includeParts: false },
    }),
  );
  assert.equal(off.decision, "assemble-similar");
  assert.equal(off.assembleFrom, undefined);
  assert.deepEqual(seenOff, ["/api/library/examples"]);

  // includeParts: true forces parts even on a strong match
  const seenOn: string[] = [];
  const clientOn = await connectedClient(
    routedFetch(seenOn, [["/api/library/examples", jsonResponse(LIBRARY_LISTING)]]),
  );
  const on = firstJson(
    await clientOn.callTool({
      name: "find_matching_examples",
      arguments: {
        brief: "Flash sale promo video for our online shoe store",
        type: "video",
        aspectRatio: "9:16",
        includeParts: true,
      },
    }),
  );
  assert.equal(on.decision, "adapt-example");
  assert.ok(on.assembleFrom, "includeParts: true must force parts");
  const partPaths = seenOn.filter((p) => !p.startsWith("/api/library/examples"));
  assert.ok(partPaths.length > 0);
  for (const p of partPaths) {
    assert.match(
      p,
      /^\/api\/library\/(design-templates|canvas-presets|shapes)\?q=[^&+]+&limit=8&offset=0$/,
      `parts searches must use short single-term queries: ${p}`,
    );
  }

  // excludeSlugs / excludePremium / limit all thread through to the ranker
  const clientFiltered = await connectedClient(
    routedFetch([], [["/api/library/examples", jsonResponse(LIBRARY_LISTING)]]),
  );
  const filtered = firstJson(
    await clientFiltered.callTool({
      name: "find_matching_examples",
      arguments: {
        brief: "fitness before after promo",
        type: "any",
        excludeSlugs: ["gym-class-schedule"],
        excludePremium: true,
        limit: 1,
        includeParts: false,
      },
    }),
  );
  assert.equal(filtered.examples.length, 1);
  assert.equal(filtered.examples[0].slug, "ecom-hero-promo");
});

test("plan_creative_video enriches the plan with ranked library candidates", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [
      [
        "/api/render/creative-plan",
        jsonResponse({ error: "NOT_FOUND", message: "not deployed" }, 404),
      ],
      ["/api/library/examples", jsonResponse(LIBRARY_LISTING)],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "plan_creative_video",
      arguments: {
        brief: "Flash sale promo for our online shoe store",
        aspectRatio: "9:16",
        duration: 15,
        variationMode: "consistent",
      },
    }),
  );

  assert.equal(body.live, false, "plan falls back locally");
  assert.ok(body.directions?.length >= 1);
  assert.equal(body.libraryCandidates.decision, "adapt-example");
  assert.equal(
    body.libraryCandidates.examples[0].slug,
    "pro-ecom-flash-sale",
  );
});

test("find_matching_examples rotates comparable leads in fresh mode, stays fixed in consistent", async () => {
  const twin = {
    kind: "examples",
    items: [
      {
        slug: "promo-alpha",
        title: "Flash Sale Promo",
        description: "Flash sale promo reel",
        meta: { pack: "ecommerce", resolution: "instagram-reel", duration: 12 },
      },
      {
        slug: "promo-beta",
        title: "Flash Sale Promo B",
        description: "Flash sale promo reel",
        meta: { pack: "ecommerce", resolution: "instagram-reel", duration: 12 },
      },
    ],
  };
  const client = await connectedClient(
    routedFetch([], [["/api/library/examples", jsonResponse(twin)]]),
  );

  const leads = new Set<string>();
  for (const seed of [0, 1, 2, 3, 4, 5]) {
    const body = firstJson(
      await client.callTool({
        name: "find_matching_examples",
        arguments: {
          brief: "flash sale promo",
          type: "video",
          variationSeed: seed,
          includeParts: false,
        },
      }),
    );
    assert.equal(body.variation.comparableCount, 2);
    leads.add(body.examples[0].slug);
  }
  assert.ok(leads.size >= 2, `fresh mode should vary the lead, got ${[...leads]}`);

  const fixed = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const body = firstJson(
      await client.callTool({
        name: "find_matching_examples",
        arguments: {
          brief: "flash sale promo",
          type: "video",
          variationMode: "consistent",
          includeParts: false,
        },
      }),
    );
    assert.equal(body.variation, undefined, "consistent mode does not rotate");
    fixed.add(body.examples[0].slug);
  }
  assert.equal(fixed.size, 1);
});

test("render_from_example composes template save, dry run and render in one call", async () => {
  const payload = {
    type: "video",
    resolution: "instagram-reel",
    variables: { headline: "Big Sale", promoCode: "SAVE20" },
    scenes: [
      {
        duration: 5,
        visuals: [{ type: "TEXT", html: "<p>{{headline}}</p>", style: {} }],
      },
    ],
  };
  const seen: Array<{ method: string; path: string; body?: any }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const respond = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname.endsWith("/content")) return respond(payload);
    if (url.pathname === "/api/library/examples/ad-flash-sale")
      return respond({ slug: "ad-flash-sale", meta: {} });
    if (url.pathname === "/api/templates")
      return respond({ template: { id: "tpl_00000000000000000001" } });
    if (url.pathname.endsWith("/preview")) return respond({ valid: true });
    if (url.pathname === "/api/render/api-key")
      return respond({ jobId: "job-9", status: "queued" });
    return respond({});
  }) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const body = firstJson(
    await client.callTool({
      name: "render_from_example",
      arguments: {
        slug: "ad-flash-sale",
        variables: { headline: "70% Off Kicks", promoCode: "KICK20", oops: "typo" },
      },
    }),
  );

  assert.deepEqual(
    seen.map((s) => `${s.method} ${s.path}`),
    [
      "GET /api/library/examples/ad-flash-sale",
      "GET /api/library/examples/ad-flash-sale/content",
      "POST /api/templates",
      "POST /api/templates/tpl_00000000000000000001/preview",
      "POST /api/render/api-key",
    ],
  );
  assert.equal(body.rendered, true);
  assert.equal(body.templateId, "tpl_00000000000000000001");
  assert.equal(body.render.jobId, "job-9");
  assert.deepEqual(seen[4].body.template, "tpl_00000000000000000001");
  assert.equal(seen[4].body.variables.headline, "70% Off Kicks");
  assert.deepEqual(body.unknownVariables, ["oops"]);
  assert.match(body.nextSteps.join("\n"), /get_render/);
});

test("render_from_example uses the image endpoint for image examples and stops on preview failure", async () => {
  const imagePayload = {
    type: "image",
    resolution: "hd",
    variables: { title: "Hello" },
    visuals: [{ type: "TEXT", text: "{{title}}", style: {} }],
  };
  const routes = (previewStatus: number) =>
    (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const respond = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (url.pathname.endsWith("/content")) return respond(imagePayload);
      if (url.pathname === "/api/library/examples/img-card")
        return respond({ slug: "img-card", meta: { type: "image" } });
      if (url.pathname === "/api/templates")
        return respond({ template: { id: "tpl_00000000000000000002" } });
      if (url.pathname.endsWith("/preview"))
        return previewStatus === 200
          ? respond({ valid: true })
          : respond(
              { error: "Invalid", message: "bad variables", details: [{ field: "title" }] },
              400,
            );
      if (url.pathname === "/api/render/image/api-key")
        return respond({ jobId: "img-job-1" });
      if (url.pathname === "/api/render/api-key")
        return respond({ jobId: "WRONG-ENDPOINT" });
      return respond({});
    }) as typeof fetch;

  const okClient = await connectedClient(routes(200));
  const ok = firstJson(
    await okClient.callTool({
      name: "render_from_example",
      arguments: { slug: "img-card", variables: { title: "New Title" } },
    }),
  );
  assert.equal(ok.rendered, true);
  assert.equal(ok.projectType, "image");
  assert.equal(ok.render.jobId, "img-job-1", "image examples render via the image endpoint");

  const failClient = await connectedClient(routes(400));
  const fail = firstJson(
    await failClient.callTool({
      name: "render_from_example",
      arguments: { slug: "img-card", variables: { title: "New Title" } },
    }),
  );
  assert.equal(fail.rendered, false);
  assert.ok(fail.previewErrors, "preview failure is surfaced");
  assert.equal(fail.templateId, "tpl_00000000000000000002");
});

test("render_from_example reports premium locks without creating a template", async () => {
  const seen: string[] = [];
  const client = await connectedClient(
    routedFetch(seen, [
      [
        "/api/library/examples/pro-ecom-flash-sale/content",
        jsonResponse({ error: "PREMIUM_REQUIRED", message: "Premium" }, 403),
      ],
      [
        "/api/library/examples/pro-ecom-flash-sale",
        jsonResponse(LIBRARY_LISTING.items[0]),
      ],
    ]),
  );
  const body = firstJson(
    await client.callTool({
      name: "render_from_example",
      arguments: { slug: "pro-ecom-flash-sale" },
    }),
  );
  assert.equal(body.premiumLocked, true);
  assert.ok(!seen.some((p) => p.startsWith("/api/templates")), "no template created");
});

test("plan_creative_video degrades gracefully when the library is unreachable", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: "NOT_FOUND", message: "down" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  const client = await connectedClient(fetchImpl);
  const body = firstJson(
    await client.callTool({
      name: "plan_creative_video",
      arguments: { brief: "Introduce an AI analytics platform" },
    }),
  );
  assert.ok(body.directions?.length >= 1, "the plan itself still returns");
  assert.equal(body.libraryCandidates.unavailable, true);
  assert.match(body.libraryCandidates.note, /search_creative_library/);
});

test("API errors surface as isError tool results", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ error: "Invalid API key", message: "revoked" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({ name: "get_credits", arguments: {} });
  assert.equal(result.isError, true);
  const content = result.content as { type: string; text: string }[];
  assert.match(content[0].text, /Invalid API key/);
});
