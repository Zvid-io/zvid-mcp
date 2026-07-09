import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ZvidClient } from "../client.js";
import { createZvidServer } from "../server.js";

const EXPECTED_TOOLS = [
  "create_render",
  "create_image_render",
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
