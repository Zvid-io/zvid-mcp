#!/usr/bin/env node
// Test bridge: lets a shell-driven agent act as an MCP client against the
// LOCAL zvid-mcp build (dist/index.js) over stdio.
//
//   node tool-bridge.mjs list
//     → prints the server instructions + every tool name/description
//   node tool-bridge.mjs call <tool> '<json-args>'
//   node tool-bridge.mjs call <tool> --args-file <path.json>
//     → prints the tool result text (capped), and appends the call to the
//       JSONL trace file given by the TRACE env var (ground truth for evals).
//
// Env: ZVID_API_KEY (or ZVID_KEY_FILE pointing at a file containing it),
//      ZVID_API_URL (default http://localhost:4000), TRACE (JSONL path).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "dist", "index.js");

const apiKey =
  process.env.ZVID_API_KEY ??
  (process.env.ZVID_KEY_FILE
    ? readFileSync(process.env.ZVID_KEY_FILE, "utf8").trim()
    : undefined);
if (!apiKey) {
  console.error("Set ZVID_API_KEY or ZVID_KEY_FILE");
  process.exit(1);
}
const apiUrl = process.env.ZVID_API_URL ?? "http://localhost:4000";
const OUTPUT_CAP = 24000;

const [, , cmd, toolName, ...rest] = process.argv;
if (!cmd || !["list", "call", "wait"].includes(cmd)) {
  console.error(
    "Usage: tool-bridge.mjs list | call <tool> (<json> | --args-file <path>) | wait <jobId>",
  );
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env, ZVID_API_KEY: apiKey, ZVID_API_URL: apiUrl },
});
const client = new Client({ name: "quality-test-bridge", version: "0.0.0" });
await client.connect(transport);

try {
  if (cmd === "wait") {
    if (!toolName) throw new Error("wait requires a jobId");
    const deadline = Date.now() + 5 * 60 * 1000;
    let last = "";
    for (;;) {
      const result = await client.callTool({
        name: "get_render",
        arguments: { jobId: toolName },
      });
      last = (result.content ?? [])
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n");
      const job = JSON.parse(last);
      if (job.state === "completed" || job.state === "failed") break;
      if (Date.now() > deadline) {
        console.log("WAIT_TIMEOUT after 5 minutes:");
        break;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    if (process.env.TRACE) {
      appendFileSync(
        process.env.TRACE,
        JSON.stringify({
          t: new Date().toISOString(),
          tool: "wait:get_render",
          args: { jobId: toolName },
          preview: last.slice(0, 500),
        }) + "\n",
      );
    }
    console.log(last);
  } else if (cmd === "list") {
    const instructions = client.getInstructions();
    const { tools } = await client.listTools();
    console.log("=== SERVER INSTRUCTIONS ===");
    console.log(instructions ?? "(none)");
    console.log("\n=== TOOLS ===");
    for (const t of tools) console.log(`- ${t.name}: ${t.description}`);
  } else {
    if (!toolName) throw new Error("call requires a tool name");
    let args = {};
    if (rest[0] === "--args-file") {
      args = JSON.parse(readFileSync(rest[1], "utf8"));
    } else if (rest[0]) {
      args = JSON.parse(rest[0]);
    }
    const started = Date.now();
    const result = await client.callTool({ name: toolName, arguments: args });
    const text = (result.content ?? [])
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");
    if (process.env.TRACE) {
      appendFileSync(
        process.env.TRACE,
        JSON.stringify({
          t: new Date().toISOString(),
          ms: Date.now() - started,
          tool: toolName,
          args,
          isError: Boolean(result.isError),
          chars: text.length,
          preview: text.slice(0, 500),
        }) + "\n",
      );
    }
    if (result.isError) console.log("TOOL_ERROR:");
    console.log(
      text.length > OUTPUT_CAP
        ? `${text.slice(0, OUTPUT_CAP)}\n...[truncated ${text.length - OUTPUT_CAP} chars]`
        : text,
    );
  }
} finally {
  await client.close();
}
