<p align="center">
  <img src="https://cdn.zvid.io/assets/logo.svg" alt="Zvid" width="184" />
</p>

# zvid-mcp

Official [Zvid](https://zvid.io) MCP server. Gives any MCP client (Claude Code, Claude Desktop, Codex CLI, Cursor, …) tools to render videos and images from JSON, manage templates, projects and webhooks, and check credits — all through the Zvid REST API.

## Requirements

- Hosted OAuth: a Zvid account and any OAuth-capable Streamable HTTP MCP client
- Local stdio: Node.js ≥ 18 and a Zvid API key

## Hosted setup (recommended)

The hosted endpoint is `https://mcp.zvid.io/mcp`. It publishes OAuth discovery
metadata, uses authorization code + PKCE, and issues short-lived access tokens
with rotating refresh tokens. Users sign in to Zvid; they do not create or
paste API keys.

### Claude Code

```bash
claude mcp add --transport http zvid https://mcp.zvid.io/mcp
claude mcp login zvid
```

You can also open `/mcp` inside Claude Code and authenticate there.

### OpenAI Codex

Add this to `~/.codex/config.toml`, then authenticate from MCP settings or run
`codex mcp login zvid`:

```toml
[mcp_servers.zvid]
url = "https://mcp.zvid.io/mcp"
auth = "oauth"
scopes = ["zvid:mcp"]
oauth_resource = "https://mcp.zvid.io/mcp"
```

## Local stdio / self-hosted setup

The npm/stdio entry point remains API-key based because OAuth is defined for
HTTP transports. Configuration resolution is CLI flags, then environment, then
`~/.zvid-mcp.json`:

```bash
npx -y zvid-mcp --api-key zvid_your_key_here --api-url http://localhost:4000
```

| Env var | CLI flag | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `ZVID_API_KEY` | `--api-key zvid_…` | stdio only | — | Zvid API key |
| `ZVID_API_URL` | `--api-url http://…` | no | `https://api.zvid.io` | Orchestrator base URL |

For a self-hosted OAuth deployment, keep the resource and issuer identical on
both services:

| Service | Variable | Production default |
| --- | --- | --- |
| Orchestrator | `OAUTH_ISSUER` | `https://api.zvid.io` |
| Orchestrator | `OAUTH_MCP_RESOURCE` | `https://mcp.zvid.io/mcp` |
| Orchestrator | `OAUTH_CONSENT_URL` | `https://app.zvid.io/oauth/authorize` |
| MCP | `ZVID_MCP_RESOURCE` | `https://mcp.zvid.io/mcp` |
| MCP | `ZVID_OAUTH_ISSUER` | `https://api.zvid.io` |

The orchestrator also accepts `OAUTH_ACCESS_TOKEN_TTL_SECONDS` and
`OAUTH_REFRESH_TOKEN_TTL_SECONDS`; their defaults are one hour and 30 days.

From a checkout:

```bash
cd mcp && npm install && npm run build
claude mcp add zvid --env ZVID_API_KEY=zvid_your_key_here -- node /absolute/path/to/mcp/dist/index.js
```

## Tools

| Tool | Description |
| --- | --- |
| `get_project_schema` | Live caller-plan-aware JSON Schema (draft 2020-12) for a project payload or full render request, plus validation notes, professional authoring guidelines, and required workflow; falls back to the bundled default schema when the endpoint is unavailable |
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
| `list_templates` / `get_template` | Browse owned templates; `get_template` returns the full project JSON |
| `create_template` / `update_template` | Create a plan-validated reusable template or update its name, description, and/or project JSON |
| `duplicate_template` / `delete_template` | Make an active editable copy, or archive an active template (explicit removal requests only) |
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

For a reusable template, replace step 5 with `create_template`. Later use `get_template` before `update_template`, `preview_template` before rendering, `duplicate_template` for a safe editable copy, and `delete_template` only when the user explicitly asks to archive it.

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
