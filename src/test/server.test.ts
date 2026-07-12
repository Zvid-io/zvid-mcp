import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ZvidClient } from "../client.js";
import { createZvidServer } from "../server.js";

const EXPECTED_TOOLS = [
  "create_render",
  "create_image_render",
  "get_project_schema",
  "validate_project_json",
  "list_supported_elements",
  "get_element_docs",
  "get_example_payload",
  "repair_project_json",
  "get_render",
  "list_renders",
  "create_bulk_render",
  "get_bulk_render",
  "list_bulk_renders",
  "list_templates",
  "get_template",
  "preview_template",
  "list_projects",
  "get_project",
  "create_project",
  "update_project",
  "delete_project",
  "list_webhooks",
  "create_webhook",
  "get_webhook",
  "update_webhook",
  "delete_webhook",
  "test_webhook",
  "list_webhook_deliveries",
  "get_credits",
  "get_usage_stats",
];

async function connectedClient(fetchImpl: typeof fetch) {
  const zvid = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000",
    fetchImpl,
  });
  const server = createZvidServer({ client: zvid });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
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
});

test("get_render calls GET /api/jobs/:id and returns the job", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (url: URL | RequestInfo) => {
    seen.push(String(url));
    return new Response(
      JSON.stringify({ id: "job-1", state: "completed", progress: 100 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
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
    arguments: { payload: { type: "video" }, template: "tpl_00000000000000000000" },
  });

  assert.equal(called, false);
  assert.equal(result.isError, true);
});

function firstJson(result: unknown): any {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0].text);
}

test("get_project_schema returns a structured JSON Schema + notes", async () => {
  const client = await connectedClient(fetch);
  const result = await client.callTool({ name: "get_project_schema", arguments: {} });
  const body = firstJson(result);

  assert.equal(body.jsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(body.jsonSchema.type, "object");
  assert.ok(body.jsonSchema.properties.visuals, "schema should describe visuals");
  assert.ok(body.jsonSchema.$defs.textElement, "schema should define textElement");
  assert.ok(Array.isArray(body.validationNotes) && body.validationNotes.length > 0);
  assert.ok(Array.isArray(body.authoringGuidelines) && body.authoringGuidelines.length >= 8);
  assert.ok(body.planLimits.freeTier.maxDuration);

  const envelope = await client.callTool({
    name: "get_project_schema",
    arguments: { target: "render-request" },
  });
  const envBody = firstJson(envelope);
  assert.ok(envBody.jsonSchema.properties.template, "envelope schema should describe template");
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
          { type: "TEXT", text: "Hello", style: { fontSize: "64px", color: "#ffffff" } },
        ],
      },
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
          { type: "TEXT", text: "A", position: "center-center", width: 900, height: 150, style: { color: "#ffffff" } },
          { type: "TEXT", text: "B", position: "center-center", width: 900, height: 150, y: 60, style: { color: "#ffffff" } },
        ],
      },
    },
  });
  const body = firstJson(result);
  assert.equal(body.valid, true, "layout problems are warnings, not errors");
  const all = body.warnings.map((w: { message: string }) => w.message).join("\n");
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
      payload: { type: "video", duration: 5, visuals: [{ type: "TEXT", text: "x" }] },
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
    await client.callTool({ name: "list_supported_elements", arguments: {} })
  );
  const types = list.elements.map((e: { type: string }) => e.type);
  assert.deepEqual(types, ["IMAGE", "VIDEO", "GIF", "SVG", "TEXT", "AUDIO", "SUBTITLE", "SCENE"]);

  const text = firstJson(
    await client.callTool({ name: "get_element_docs", arguments: { element: "TEXT" } })
  );
  assert.equal(text.type, "TEXT");
  assert.ok(text.fields.length > 0);
  assert.ok(text.example);

  const bad = await client.callTool({
    name: "get_element_docs",
    arguments: { element: "HOLOGRAM" },
  });
  assert.equal(bad.isError, true);
});

test("get_example_payload returns validated examples", async () => {
  const client = await connectedClient(fetch);
  const one = firstJson(
    await client.callTool({ name: "get_example_payload", arguments: { name: "promo-video" } })
  );
  assert.equal(one.name, "promo-video");
  assert.equal(one.payload.scenes.length, 3, "promo example should be scene-based");

  const all = firstJson(await client.callTool({ name: "get_example_payload", arguments: {} }));
  assert.equal(all.length, 5);
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
          visuals: [
            { type: "TEXT", text: "hi" },
            { type: "TEXT" },
          ],
        },
      },
    })
  );
  assert.equal(body.valid, true);
  assert.equal(body.repaired.type, "video");
  assert.equal(body.repaired.quality, undefined);
  assert.equal(body.repaired.visuals.length, 1);
  assert.ok(body.changes.length >= 3);
});

test("API errors surface as isError tool results", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ error: "Invalid API key", message: "revoked" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  const client = await connectedClient(fetchImpl);
  const result = await client.callTool({ name: "get_credits", arguments: {} });
  assert.equal(result.isError, true);
  const content = result.content as { type: string; text: string }[];
  assert.match(content[0].text, /Invalid API key/);
});
