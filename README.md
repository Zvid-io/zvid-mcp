# zvid-mcp

Official [Zvid](https://zvid.io) MCP server. Gives any MCP client (Claude Code, Claude Desktop, Codex CLI, Cursor, …) tools to render videos and images from JSON, manage templates, projects and webhooks, and check credits — all through the Zvid REST API.

## Requirements

- Node.js ≥ 18
- A Zvid API key (`zvid_…`) — create one in the Zvid dashboard under **Settings → API Keys**

## Configuration

| Env var | CLI flag | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `ZVID_API_KEY` | `--api-key zvid_…` | yes | — | Your Zvid API key |
| `ZVID_API_URL` | `--api-url http://…` | no | `https://api.zvid.io` | Orchestrator base URL (set for self-hosted / local dev) |

CLI flags win over env vars. Use them when your MCP host has no way to set environment variables on a server entry — the whole configuration then fits in the command line:

```bash
npx -y zvid-mcp --api-key zvid_your_key_here --api-url http://localhost:4000
```

> Testing against a local orchestrator? The default API URL is **production** (`https://api.zvid.io`) — a key created on your local instance only exists there, so you must also pass `--api-url http://localhost:4000` (or set `ZVID_API_URL`), otherwise every call fails with 401 "Invalid API key".

## Setup

### Claude Code

```bash
claude mcp add zvid --env ZVID_API_KEY=zvid_your_key_here -- npx -y zvid-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json` (**Settings → Developer → Edit Config**):

```json
{
  "mcpServers": {
    "zvid": {
      "command": "npx",
      "args": ["-y", "zvid-mcp"],
      "env": {
        "ZVID_API_KEY": "zvid_your_key_here"
      }
    }
  }
}
```

### From a checkout (not yet published to npm)

```bash
cd mcp && npm install && npm run build
claude mcp add zvid --env ZVID_API_KEY=zvid_your_key_here -- node /absolute/path/to/mcp/dist/index.js
```

## Tools

| Tool | Description |
| --- | --- |
| `get_project_schema` | JSON Schema (draft 2020-12) for a project payload or the full render request, plus validation notes AND authoring guidelines (the renderer's layout model: scenes, position/anchor semantics, flex-centered cards, contrast/scrims) |
| `validate_project_json` | Validate a payload before rendering — field-level errors, free. Also lints layout: overlapping texts, x/y ignored by presets, off-canvas boxes, padding cut-offs, low contrast. `remote: true` also runs the live API validator with your plan's real limits |
| `list_supported_elements` | All element types (IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE) with required fields |
| `get_element_docs` | Per-element docs: every field, constraints, gotchas, and a valid example |
| `get_example_payload` | Validated example payloads: promo video, template render, still image, subtitles, webhook flow |
| `repair_project_json` | Conservative auto-fix for invalid payloads with an explanation of every change |
| `create_render` | Queue a video render from a project JSON (`payload`) or a `template` + `variables` |
| `create_image_render` | Queue a still-image render (PNG/JPEG/WebP; supports `snapshotTime`, `quality`, `transparent`) |
| `get_render` | Job state (`waiting\|active\|completed\|failed`), progress, output `url` + `thumbnailUrl` |
| `list_renders` | List render jobs (filter by `type`) |
| `create_bulk_render` | One template/payload × N variable sets → N jobs (max 500) |
| `get_bulk_render` / `list_bulk_renders` | Inspect bulk batches |
| `list_templates` / `get_template` | Browse templates; `get_template` returns the full project JSON |
| `preview_template` | Dry-run variable resolution + validation — costs no credits |
| `list_projects` / `get_project` / `create_project` / `update_project` / `delete_project` | Editor draft projects (open at `https://zvid.io/editor?project=<id>`) |
| `list_webhooks` / `create_webhook` / `get_webhook` / `update_webhook` / `delete_webhook` / `test_webhook` / `list_webhook_deliveries` | Webhook endpoints for `render.completed` / `render.failed` (HMAC-SHA256 signed) |
| `get_credits` / `get_usage_stats` | Credit balance and usage |

## Schema-aware authoring

The server doesn't just forward payloads — it knows the Zvid project schema. The schema tools are backed by a shared module (`../schema`, vendored as `src/zvidSchema.ts`) that is **derived from the live backend validation** (`orch/middleware/validation.js`) and parity-tested against it, so tool answers never drift from what the API actually accepts. When public docs and these tools disagree, the tools (backend) win.

Recommended flow for an AI client authoring a video:

1. `get_project_schema` / `list_supported_elements` / `get_element_docs` to learn the shape.
2. `get_example_payload` for a starting point close to the goal.
3. Compose the JSON, then `validate_project_json` (add `remote: true` to check against your plan's actual limits — the API echoes them in `planLimits` on failure).
4. If invalid, fix by hand or try `repair_project_json`.
5. `create_render` / `create_image_render`, then poll `get_render`.

## Example prompts

- *"Create a valid Zvid JSON payload for a 10-second promo video with a headline and background music."*
- *"Validate this payload before rendering and explain anything that's wrong."*
- *"Show me the required fields for a TEXT visual."*
- *"What subtitle animation modes does Zvid support?"*
- *"This payload fails — repair it and tell me what you changed."*
- *"Render a 1080p video from template tpl_… with title 'Summer Sale' and give me the link when it's done."*
- *"Preview template tpl_… with these variables and tell me if anything fails validation."*
- *"Create a webhook pointing at https://example.com/hooks/zvid for completed and failed renders."*
- *"How many credits do I have left, and what did I spend this month?"*

## Webhook signature verification

Deliveries are signed: `X-Zvid-Signature: sha256=HMAC_SHA256(secret, "<X-Zvid-Timestamp>.<raw body>")`. The secret (`whsec_…`) is returned by `create_webhook`/`get_webhook`.

## Development

```bash
npm install
npm run build     # tsc → dist/
npm test          # unit + in-memory MCP round-trip tests
# real E2E against a local orchestrator:
ZVID_API_KEY=zvid_… ZVID_API_URL=http://localhost:4000 node scripts/e2e-local.mjs
```

## Publishing (manual)

Not published yet. To publish: bump `version` in `package.json`, then `npm publish --access public` from `mcp/`. The `prepublishOnly` hook builds `dist/`.
