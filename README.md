# zvid-mcp

Official [Zvid](https://zvid.io) MCP server. Gives any MCP client (Claude Code, Claude Desktop, Codex CLI, Cursor, …) tools to render videos and images from JSON, manage templates, projects and webhooks, and check credits — all through the Zvid REST API.

## Requirements

- Node.js ≥ 18
- A Zvid API key (`zvid_…`) — create one in the Zvid dashboard under **Settings → API Keys**

## Configuration

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ZVID_API_KEY` | yes | — | Your Zvid API key |
| `ZVID_API_URL` | no | `https://api.zvid.io` | Orchestrator base URL (set for self-hosted / local dev) |

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

## Example prompts

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
