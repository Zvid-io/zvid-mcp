#!/usr/bin/env node
// Manual E2E for the template facade: spawns the built zvid-mcp server over
// stdio and exercises create_media_template / create_media_from_template
// against a running orchestrator, then checks persistence through the REST
// API directly. Spends NO render credits.
//
// Usage:
//   ZVID_API_KEY=zvid_... ZVID_API_URL=http://localhost:4000 node scripts/e2e-templates.mjs
//
// Creates two templates and one draft, then archives/deletes them.

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

async function rest(method, pathName, body) {
  const res = await fetch(`${apiUrl}${pathName}`, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathName} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: {
    ...process.env,
    ZVID_API_KEY: apiKey,
    ZVID_API_URL: apiUrl,
    ZVID_MCP_PROFILE: "developer",
    // A machine-local ~/.zvid-mcp.json with "override": true would silently
    // replace the key under test — point the config lookup at nothing.
    ZVID_MCP_CONFIG: path.join(here, "e2e-no-config.json"),
  },
});
const client = new Client({ name: "zvid-template-e2e", version: "0.0.0" });
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
  if (result.isError) throw new Error(`${label}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const PARAMETERIZED_PAYLOAD = {
  type: "video",
  name: "Shoes Promo Template E2E",
  width: 720,
  height: 1280,
  frameRate: 30,
  outputFormat: "mp4",
  backgroundColor: "{{brandColor}}",
  variables: {
    headline: "Step Into Comfort",
    productImage:
      "https://cdn.pixabay.com/photo/2016/11/19/18/06/feet-1840619_1280.jpg",
    price: "$79",
    brandName: "StrideCo",
    brandColor: "#0b1020",
  },
  scenes: [
    {
      id: "hook",
      duration: 4,
      transition: "fade",
      transitionDuration: 0.5,
      visuals: [
        {
          type: "IMAGE",
          src: "{{productImage}}",
          width: 720,
          height: 720,
          position: "top-center",
        },
        {
          type: "TEXT",
          html: '<p style="font-size:64px;font-weight:800">{{headline}}</p>',
          width: 600,
          height: 220,
          position: "bottom-center",
          style: { color: "#ffffff", fontFamily: "Inter", textAlign: "center" },
        },
      ],
    },
    {
      id: "cta",
      duration: 4,
      visuals: [
        {
          type: "TEXT",
          html: '<p style="font-size:52px;font-weight:800">{{brandName}} — {{price}}</p>',
          width: 620,
          height: 180,
          position: "center-center",
          style: { color: "#ffffff", fontFamily: "Inter", textAlign: "center" },
        },
      ],
    },
  ],
};

let templateId;
let fallbackTemplateId;
let draftId;

await step("tools/list exposes the template facade", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const name of ["create_media_template", "create_media_from_template"]) {
    if (!names.includes(name)) throw new Error(`missing ${name}`);
  }
  return `${tools.length} tools`;
});

await step("create_media_template (provided payload)", async () => {
  const res = parse(
    await client.callTool({
      name: "create_media_template",
      arguments: {
        brief: "Reusable vertical promo template for adult male shoes",
        type: "video",
        payload: PARAMETERIZED_PAYLOAD,
      },
    }),
    "create_media_template",
  );
  if (res.kind !== "template") throw new Error(`kind=${res.kind}`);
  if (!/^tpl_/.test(res.templateId ?? "")) {
    throw new Error(`bad templateId: ${res.templateId}`);
  }
  templateId = res.templateId;
  const varNames = (res.declaredVariables ?? []).map((v) => v.name);
  for (const name of ["headline", "productImage", "price", "brandName"]) {
    if (!varNames.includes(name)) throw new Error(`missing variable ${name}`);
  }
  if (!(res.estimatedCreditsWithDefaults > 0)) {
    throw new Error("no credit estimate");
  }
  if (!res.editorUrl.includes(`?template=${templateId}`)) {
    throw new Error(`bad editorUrl ${res.editorUrl}`);
  }
  return `${templateId} vars=[${varNames.join(",")}] credits=${res.estimatedCreditsWithDefaults}`;
});

await step("REST GET /api/templates/:id keeps variables verbatim", async () => {
  const { template } = await rest("GET", `/api/templates/${templateId}`);
  const declared = template.project?.variables ?? {};
  if (declared.headline !== "Step Into Comfort") {
    throw new Error("variables were not persisted");
  }
  const json = JSON.stringify(template.project);
  if (!json.includes("{{headline}}") || !json.includes("{{productImage}}")) {
    throw new Error("{{placeholders}} were flattened");
  }
  return `variablesSummary=${(template.variablesSummary ?? []).length}`;
});

await step("create_media_template (brief-only fallback)", async () => {
  const res = parse(
    await client.callTool({
      name: "create_media_template",
      arguments: {
        brief: "Fallback promo template for a coffee brand launch",
        type: "video",
        aspectRatio: "9:16",
        duration: 12,
        brandKit: { name: "Roastly", primaryColor: "#1e1b4b" },
      },
    }),
    "create_media_template",
  );
  // Without sampling the server prefers the closest library example that
  // declares variables and only then the generic type-led template.
  if (
    res.composition !== "deterministic-fallback" &&
    res.composition !== "example-fallback"
  ) {
    throw new Error(`composition=${res.composition}`);
  }
  fallbackTemplateId = res.templateId;
  const varNames = (res.declaredVariables ?? []).map((v) => v.name);
  if (res.composition === "deterministic-fallback") {
    for (const name of ["brandName", "headline", "message", "ctaText"]) {
      if (!varNames.includes(name)) throw new Error(`missing variable ${name}`);
    }
  } else if (!varNames.length) {
    throw new Error("example-fallback template declared no variables");
  }
  return `${fallbackTemplateId} (${res.composition}) vars=[${varNames.join(",")}]`;
});

await step("create_media_from_template substitutes new values", async () => {
  const res = parse(
    await client.callTool({
      name: "create_media_from_template",
      arguments: {
        templateId,
        variables: {
          headline: "Live E2E New Drop",
          price: "$59",
          bogusName: "should-be-reported",
        },
        brief: "Autumn drop announcement",
      },
    }),
    "create_media_from_template",
  );
  if (res.composition !== "template-instantiation") {
    throw new Error(`composition=${res.composition}`);
  }
  if (!/^prj_/.test(res.draftId ?? "")) throw new Error("no draftId");
  draftId = res.draftId;
  if (!res.quoteToken) throw new Error("no quoteToken");
  if (!(res.estimatedCredits > 0)) throw new Error("no credit estimate");
  if ((res.unknownVariables ?? []).join(",") !== "bogusName") {
    throw new Error(`unknownVariables=${JSON.stringify(res.unknownVariables)}`);
  }
  return `${draftId} credits=${res.estimatedCredits}`;
});

await step("REST GET /api/projects/:id shows the resolved draft", async () => {
  const { project } = await rest("GET", `/api/projects/${draftId}`);
  const json = JSON.stringify(project.payload);
  if (!json.includes("Live E2E New Drop")) {
    throw new Error("substituted headline missing from draft");
  }
  if (!json.includes("$59")) throw new Error("substituted price missing");
  if (json.includes("{{")) throw new Error("unresolved {{placeholders}} left");
  if (project.payload.variables !== undefined) {
    throw new Error("resolved draft must not re-declare variables");
  }
  return "substitution verified";
});

await step("cleanup", async () => {
  const results = [];
  if (draftId) {
    await rest("DELETE", `/api/projects/${draftId}`).then(
      () => results.push("draft"),
      (err) => results.push(`draft? ${err.message.slice(0, 60)}`),
    );
  }
  for (const id of [templateId, fallbackTemplateId]) {
    if (!id) continue;
    await rest("DELETE", `/api/templates/${id}`).then(
      () => results.push(id),
      (err) => results.push(`${id}? ${err.message.slice(0, 60)}`),
    );
  }
  return results.join(", ");
});

await client.close();
if (failures.length) {
  console.error(`\n${failures.length} step(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll template E2E steps passed.");
