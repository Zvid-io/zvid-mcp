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

| Env var        | CLI flag             | Required   | Default               | Purpose               |
| -------------- | -------------------- | ---------- | --------------------- | --------------------- |
| `ZVID_API_KEY` | `--api-key zvid_…`   | stdio only | —                     | Zvid API key          |
| `ZVID_API_URL` | `--api-url http://…` | no         | `https://api.zvid.io` | Orchestrator base URL |

For a self-hosted OAuth deployment, keep the resource and issuer identical on
both services:

| Service      | Variable             | Production default                    |
| ------------ | -------------------- | ------------------------------------- |
| Orchestrator | `OAUTH_ISSUER`       | `https://api.zvid.io`                 |
| Orchestrator | `OAUTH_MCP_RESOURCE` | `https://mcp.zvid.io/mcp`             |
| Orchestrator | `OAUTH_CONSENT_URL`  | `https://app.zvid.io/oauth/authorize` |
| MCP          | `ZVID_MCP_RESOURCE`  | `https://mcp.zvid.io/mcp`             |
| MCP          | `ZVID_OAUTH_ISSUER`  | `https://api.zvid.io`                 |

The orchestrator also accepts `OAUTH_ACCESS_TOKEN_TTL_SECONDS` and
`OAUTH_REFRESH_TOKEN_TTL_SECONDS`; their defaults are one hour and 30 days.

From a checkout:

```bash
cd mcp && npm install && npm run build
claude mcp add zvid --env ZVID_API_KEY=zvid_your_key_here -- node /absolute/path/to/mcp/dist/index.js
```

## Tools

| Tool                                                                                                                                  | Description                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan_creative_video`                                                                                                                 | Plan-aware storyboard and art direction from a brief — plus `libraryCandidates`: published examples ranked against the brief with an adapt-vs-assemble decision. Supports `consistent`, `fresh`, and `explore` modes, recent-asset exclusions, brand tokens, style packs, and scene recipes |
| `find_matching_examples`                                                                                                              | Rank the entire published examples library against a brief (category synonyms, aspect/duration fit) and return candidates with thumbnails plus a decision: `adapt-example`, `adapt-or-assemble`, or `assemble-similar` (with design-template/canvas-preset/shape modules) |
| `start_from_example`                                                                                                                  | Fetch an example's render-ready project JSON plus an adaptation map (variables, text/media slots, scene summary, fonts) and the adaptation contract — the premium path: keep the layout, swap copy/media/brand. Suggests free alternatives when a premium example is plan-locked |
| `render_from_example`                                                                                                                 | One-call premium render: example slug + new variable values → the server saves it as a template, dry-runs the variables, and queues the render with the designed layout fully intact. The most reliable path for smaller models |
| `search_creative_library`                                                                                                             | Search complete examples, animated Design Studio templates, canvas presets, or shapes; results include preview/thumbnail metadata when published                                                                                                             |
| `get_creative_asset`                                                                                                                  | Fetch metadata and full JSON content for one creative-library item                                                                                                                                                                                           |
| `list_stock_providers` / `search_stock_media`                                                                                         | Discover configured image/video/GIF/audio providers and search normalized render-ready media URLs                                                                                                                                                            |
| `get_project_schema`                                                                                                                  | Live caller-plan-aware JSON Schema (draft 2020-12) for a project payload or full render request, plus validation notes, professional authoring guidelines, and required workflow; falls back to the bundled default schema when the endpoint is unavailable  |
| `validate_project_json`                                                                                                               | Validate a payload before rendering — field-level errors, free. Also lints layout: overlapping texts, x/y ignored by presets, off-canvas boxes, padding cut-offs, low contrast. `remote: true` also runs the live API validator with your plan's real limits |
| `list_supported_elements`                                                                                                             | All element types (IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE) with required fields                                                                                                                                                                |
| `get_element_docs`                                                                                                                    | Per-element docs: every field, constraints, gotchas, and a valid example                                                                                                                                                                                     |
| `get_example_payload`                                                                                                                 | Validated example payloads: promo video, template render, still image, subtitles, webhook flow                                                                                                                                                               |
| `repair_project_json`                                                                                                                 | Conservative auto-fix for invalid payloads with an explanation of every change                                                                                                                                                                               |
| `create_render`                                                                                                                       | Queue a video render from a project JSON (`payload`) or a `template` + `variables`                                                                                                                                                                           |
| `create_image_render`                                                                                                                 | Queue a still-image render (PNG/JPEG/WebP; supports `snapshotTime`, `quality`, `transparent`)                                                                                                                                                                |
| `get_render`                                                                                                                          | Job state (`waiting\|active\|completed\|failed`), progress, output `url` + `thumbnailUrl`                                                                                                                                                                    |
| `list_renders`                                                                                                                        | List render jobs (filter by `type`)                                                                                                                                                                                                                          |
| `create_bulk_render`                                                                                                                  | One template/payload × N variable sets → N jobs (max 500)                                                                                                                                                                                                    |
| `get_bulk_render` / `list_bulk_renders`                                                                                               | Inspect bulk batches                                                                                                                                                                                                                                         |
| `list_templates` / `get_template`                                                                                                     | Browse owned templates; `get_template` returns the full project JSON                                                                                                                                                                                         |
| `create_template` / `update_template`                                                                                                 | Create a plan-validated reusable template or update its name, description, and/or project JSON                                                                                                                                                               |
| `duplicate_template` / `delete_template`                                                                                              | Make an active editable copy, or archive an active template (explicit removal requests only)                                                                                                                                                                 |
| `preview_template`                                                                                                                    | Dry-run variable resolution + validation — costs no credits                                                                                                                                                                                                  |
| `list_projects` / `get_project` / `create_project` / `update_project` / `delete_project`                                              | Editor draft projects (open at `https://zvid.io/editor?project=<id>`)                                                                                                                                                                                        |
| `list_webhooks` / `create_webhook` / `get_webhook` / `update_webhook` / `delete_webhook` / `test_webhook` / `list_webhook_deliveries` | Webhook endpoints for `render.completed` / `render.failed` (HMAC-SHA256 signed)                                                                                                                                                                              |
| `get_credits` / `get_usage_stats`                                                                                                     | Credit balance and usage                                                                                                                                                                                                                                     |

## Schema-aware authoring

The server doesn't just forward payloads — it knows the Zvid project schema. The schema tools are backed by a shared module (`../schema`, vendored as `src/zvidSchema.ts`) that is **derived from the live backend validation** (`orch/middleware/validation.js`) and parity-tested against it, so tool answers never drift from what the API actually accepts. When public docs and these tools disagree, the tools (backend) win.

The server also advertises this workflow as MCP `instructions`, so compliant clients receive it at initialize time. The example-first flow for an AI client authoring a video:

1. `plan_creative_video` with the brief, format, duration, brand and variation mode. The response includes ranked `libraryCandidates` and a decision.
2. Decision `adapt-example`: `start_from_example` with the top slug to see its variables and adaptation map, then the easiest premium path — pick new variable VALUES (copy, media URLs, brand colors) and call `render_from_example { slug, variables }`; the server keeps the designed layout/animations intact. Edit the payload manually only when variables cannot express the change (keep the layout skeleton; never simplify a complex example into plain text). Manual template route: `create_template` → `preview_template` → `create_render { template, variables }` — variables are inert on direct payload renders.
3. Decision `assemble-similar` (or nothing close on inspection): assemble the planned scene recipes from the returned `design-templates`, `canvas-presets` and `shapes` modules (or `search_creative_library`). Never force an unrelated full-video template.
4. Use `search_stock_media` for topic-specific visuals and music for each scene — full-quality `src` URLs, natural size ≥ the canvas.
5. When composing, call `get_project_schema` / `list_supported_elements` / `get_element_docs` for the exact shape.
6. Run `validate_project_json` (add `remote: true` to check against the caller's real plan) and fix every error and layout warning. Use `repair_project_json` only for mechanical mistakes.
7. `create_render` / `create_image_render`, inspect a draft, revise if needed, then poll `get_render` for the final output.

For stills or quick "make something like X" requests without a full plan, start at `find_matching_examples` (`type: "image"` for stills).

Variation behavior:

- `consistent` derives a stable seed from the brief (or accepts `variationSeed`) for reproducible automations.
- `fresh` produces one new direction and expects recent library assets to be excluded.
- `explore` returns 2-5 materially different style/layout/storyboard directions, not recolors of one payload.

For a reusable template, replace the final render with `create_template`. Later use `get_template` before `update_template`, `preview_template` before rendering, `duplicate_template` for a safe editable copy, and `delete_template` only when the user explicitly asks to archive it.

## Example prompts

- _"Create a valid Zvid JSON payload for a 10-second promo video with a headline and background music."_
- _"Plan three genuinely different 9:16 creative directions for this product launch, avoid these recently used example slugs, then build the strongest one."_
- _"Validate this payload before rendering and explain anything that's wrong."_
- _"Show me the required fields for a TEXT visual."_
- _"What subtitle animation modes does Zvid support?"_
- _"This payload fails — repair it and tell me what you changed."_
- _"Render a 1080p video from template tpl\_… with title 'Summer Sale' and give me the link when it's done."_
- _"Preview template tpl\_… with these variables and tell me if anything fails validation."_
- _"Create a webhook pointing at https://example.com/hooks/zvid for completed and failed renders."_
- _"How many credits do I have left, and what did I spend this month?"_

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
