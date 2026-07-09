#!/usr/bin/env node
// Manual E2E: spawns the built zvid-mcp server over stdio (exactly how MCP
// clients run it) and exercises real API calls against a running orchestrator.
//
// Usage:
//   ZVID_API_KEY=zvid_... ZVID_API_URL=http://localhost:4000 node scripts/e2e-local.mjs
//
// Creates one real image render (1 credit on the account).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "dist", "index.js");

const apiKey = process.env.ZVID_API_KEY;
const apiUrl = process.env.ZVID_API_URL ?? "http://localhost:4000";
if (!apiKey) {
  console.error("Set ZVID_API_KEY");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env, ZVID_API_KEY: apiKey, ZVID_API_URL: apiUrl },
});
const client = new Client({ name: "zvid-mcp-e2e", version: "0.0.0" });
await client.connect(transport);

const failures = [];
async function step(name, fn) {
  try {
    const out = await fn();
    console.log(`PASS ${name}${out ? ` — ${out}` : ""}`);
  } catch (err) {
    failures.push(name);
    console.error(`FAIL ${name} — ${err.message}`);
  }
}

function parse(result, label) {
  const text = result.content?.[0]?.text ?? "";
  if (result.isError) throw new Error(`${label}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

let jobId;

await step("tools/list", async () => {
  const { tools } = await client.listTools();
  if (tools.length < 20) throw new Error(`only ${tools.length} tools`);
  return `${tools.length} tools`;
});

await step("get_credits", async () => {
  const res = parse(await client.callTool({ name: "get_credits", arguments: {} }), "get_credits");
  if (typeof res.balance !== "number")
    throw new Error(`unexpected shape: ${JSON.stringify(res).slice(0, 200)}`);
  return `balance=${res.balance}`;
});

await step("list_renders", async () => {
  const res = parse(
    await client.callTool({ name: "list_renders", arguments: { limit: 2 } }),
    "list_renders"
  );
  if (!Array.isArray(res.jobs)) throw new Error("no jobs array");
  return `${res.pagination?.total ?? res.jobs.length} total`;
});

await step("list_templates", async () => {
  const res = parse(
    await client.callTool({ name: "list_templates", arguments: { limit: 2 } }),
    "list_templates"
  );
  const list = res.templates ?? res.items ?? [];
  return `${Array.isArray(list) ? list.length : "?"} on first page`;
});

await step("create_image_render", async () => {
  const res = parse(
    await client.callTool({
      name: "create_image_render",
      arguments: {
        payload: {
          type: "image",
          name: "mcp-e2e",
          width: 320,
          height: 240,
          visuals: [
            {
              type: "text",
              text: "Zvid MCP E2E",
            },
          ],
        },
      },
    }),
    "create_image_render"
  );
  jobId = res.jobId;
  if (!jobId) throw new Error(`no jobId: ${JSON.stringify(res).slice(0, 200)}`);
  return `jobId=${jobId} credits=${res.creditsReserved}`;
});

await step("get_render", async () => {
  if (!jobId) throw new Error("skipped: no job created");
  const res = parse(
    await client.callTool({ name: "get_render", arguments: { jobId } }),
    "get_render"
  );
  if (!res.state && !res.id) throw new Error(`unexpected: ${JSON.stringify(res).slice(0, 200)}`);
  return `state=${res.state} progress=${res.progress}`;
});

await step("list_webhooks", async () => {
  const res = parse(await client.callTool({ name: "list_webhooks", arguments: {} }), "list_webhooks");
  return `${(res.webhooks ?? []).length} webhooks (limit ${res.usage?.limit})`;
});

await client.close();
if (failures.length) {
  console.error(`\n${failures.length} step(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll E2E steps passed.");
