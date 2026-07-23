<p align="center">
  <img src="https://cdn.zvid.io/assets/logo.svg" alt="Zvid" width="184" />
</p>

# @zvid/mcp

Official [Zvid](https://zvid.io) agent and MCP server. Creator follows a quality-first workflow: plan the brief, adapt designed examples or library assets, validate exact project JSON, save a reviewable draft, then render only after approval. Automation and Developer add trusted direct operations.

## Requirements

- Hosted OAuth: a Zvid account and any OAuth-capable Streamable HTTP MCP client
- Local stdio: Node.js ≥ 18 and a Zvid API key

## Hosted setup (recommended)

The hosted endpoint is `https://mcp.zvid.io/mcp`. It publishes OAuth discovery
metadata, uses authorization code + PKCE, and issues short-lived access tokens
with rotating refresh tokens. Most users just sign in to Zvid — no API key to
create or paste. The hosted endpoint also accepts a Zvid API key via the
`X-Api-Key` header for legacy or programmatic access.

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

OAuth uses one scope, `zvid:mcp`. The dashboard stores the default tool profile
and maximum credits per render for MCP clients. A client may connect with
concrete values in the endpoint, for example
`https://mcp.zvid.io/mcp?profile=creator&maxRenderCredits=60`; this is connection
configuration and cannot be changed by the model during a conversation. The
default per-render credit limit is 120, and the dashboard limit, when set, is a
hard ceiling: the effective limit is the lower of the dashboard value and the
value requested in the endpoint.

The official n8n workflow copies both dashboard defaults into its workflow JSON
when downloaded. Each workflow can then choose another concrete profile and
credit ceiling locally without updating the dashboard or any other workflow.

## Local stdio / self-hosted setup

The npm/stdio entry point remains API-key based because OAuth is defined for
HTTP transports. Configuration resolution is CLI flags, then environment, then
`~/.zvid-mcp.json`:

```bash
npx -y @zvid/mcp --api-key zvid_your_key_here --api-url http://localhost:4000
```

| Env var                       | CLI flag             | Required   | Default               | Purpose                                                                         |
| ----------------------------- | -------------------- | ---------- | --------------------- | ------------------------------------------------------------------------------- |
| `ZVID_API_KEY`                | `--api-key zvid_…`   | stdio only | —                     | Zvid API key                                                                    |
| `ZVID_API_URL`                | `--api-url http://…` | no         | `https://api.zvid.io` | Orchestrator base URL                                                           |
| `ZVID_MCP_PROFILE`            | `--profile creator`  | no         | `creator`             | Tool profile                                                                    |
| `ZVID_MCP_MAX_RENDER_CREDITS` | —                    | no         | `120`                  | Legacy/fallback hosted limit; dashboard and explicit n8n values take precedence |
| `ZVID_MCP_MAX_BULK_ITEMS`     | —                    | no         | `25`                  | Automation/developer bulk-call item ceiling                                     |
| `ZVID_MCP_QUOTE_SECRET`       | —                    | hosted     | process-random        | Shared HMAC secret for multi-instance quotes                                    |

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

## Default Creator workflow

The default `creator` profile is the former Advanced authoring surface. It exposes
planning, designed examples, creative-library search, stock media, schema/docs,
repair, validation, projects and templates alongside approval-aware draft tools.

Creator deliberately rejects `create_media` and `revise_media` calls that omit the
complete project `payload`. This prevents a weak model from improvising a poor
layout from a brief. The agent must plan, adapt or assemble an exact payload,
validate it remotely, fix every error and layout warning, and only then save the
draft. `create_media` remains non-spending; `render_media` still requires the
user-approved signed quote.

Rendering is deliberately separate from drafting. Quote tokens are
HMAC-signed, expire after 15 minutes, bind the draft ID, project version,
canonical payload hash, media type and estimated credits, and are revalidated
immediately before submission. An idempotency UUID prevents retry duplication.

## Capability profiles

| Profile      | Intended use         | Surface                                                                          |
| ------------ | -------------------- | -------------------------------------------------------------------------------- |
| `readonly`   | Inspection           | `get_media`, `list_media`, `get_account`                                         |
| `creator`    | Most users           | Quality authoring, libraries, validation, projects/templates and approved renders |
| `automation` | Trusted workflows    | Creator tools plus direct renders, capped bulk rendering and webhook operations  |
| `developer`  | Full API development | Every registered non-destructive/raw tool                                        |

Update and delete tools remain disabled in every profile. Stored webhook
secrets are redacted by `get_webhook`; only `create_webhook` returns a new
secret. Bulk calls default to 25 items even though the underlying API can
accept more.

The server also publishes four user-invoked workflow prompts (product promo,
social reel, thumbnail and square post) and safe MCP resources at
`zvid://authoring/guidelines` and `zvid://account/summary`.

## Creator, Automation and Developer tools

The following low-level capabilities are available only in the profiles
described above:

| Tool                                                                                            | Description                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_creative_video`                                                                           | Plan-aware storyboard and art direction from a brief — plus `libraryCandidates`: published examples ranked against the brief with an adapt-vs-assemble decision. Supports `consistent`, `fresh`, and `explore` modes, recent-asset exclusions, brand tokens, style packs, and scene recipes |
| `find_matching_examples`                                                                        | Rank the entire published examples library against a brief (category synonyms, aspect/duration fit) and return candidates with thumbnails plus a decision: `adapt-example`, `adapt-or-assemble`, or `assemble-similar` (with design-template/canvas-preset/shape modules)                   |
| `start_from_example`                                                                            | Fetch an example's render-ready project JSON plus an adaptation map (variables, text/media slots, scene summary, fonts) and the adaptation contract — the premium path: keep the layout, swap copy/media/brand. Suggests free alternatives when a premium example is plan-locked            |
| `render_from_example`                                                                           | One-call premium render: example slug + new variable values → the server saves it as a template, dry-runs the variables, and queues the render with the designed layout fully intact. The most reliable path for smaller models                                                             |
| `search_creative_library`                                                                       | Search complete examples, animated Design Studio templates, canvas presets, or shapes; results include preview/thumbnail metadata when published                                                                                                                                            |
| `get_creative_asset`                                                                            | Fetch metadata and full JSON content for one creative-library item                                                                                                                                                                                                                          |
| `list_stock_providers` / `search_stock_media`                                                   | Discover configured image/video/GIF/audio providers and search normalized render-ready media URLs                                                                                                                                                                                           |
| `get_project_schema`                                                                            | Live caller-plan-aware JSON Schema (draft 2020-12) for a project payload or full render request, plus validation notes, professional authoring guidelines, and required workflow; falls back to the bundled default schema when the endpoint is unavailable                                 |
| `validate_project_json`                                                                         | Validate a payload before rendering — field-level errors, free. Also lints layout: overlapping texts, x/y ignored by presets, off-canvas boxes, padding cut-offs, low contrast. `remote: true` also runs the live API validator with your plan's real limits                                |
| `list_supported_elements`                                                                       | All element types (IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE) with required fields                                                                                                                                                                                               |
| `get_element_docs`                                                                              | Per-element docs: every field, constraints, gotchas, and a valid example                                                                                                                                                                                                                    |
| `get_example_payload`                                                                           | Validated example payloads: promo video, template render, still image, subtitles, webhook flow                                                                                                                                                                                              |
| `repair_project_json`                                                                           | Conservative auto-fix for invalid payloads with an explanation of every change                                                                                                                                                                                                              |
| `create_render`                                                                                 | Queue a video render from a project JSON (`payload`) or a `template` + `variables`                                                                                                                                                                                                          |
| `create_image_render`                                                                           | Queue a still-image render (PNG/JPEG/WebP; supports `snapshotTime`, `quality`, `transparent`)                                                                                                                                                                                               |
| `get_render`                                                                                    | Job state (`waiting\|active\|completed\|failed`), progress, output `url` + `thumbnailUrl`                                                                                                                                                                                                   |
| `list_renders`                                                                                  | List render jobs (filter by `type`)                                                                                                                                                                                                                                                         |
| `create_bulk_render`                                                                            | One template/payload × N variable sets → N jobs (max 500)                                                                                                                                                                                                                                   |
| `get_bulk_render` / `list_bulk_renders`                                                         | Inspect bulk batches                                                                                                                                                                                                                                                                        |
| `list_templates` / `get_template`                                                               | Browse owned templates; `get_template` returns the full project JSON                                                                                                                                                                                                                        |
| `create_template` / `duplicate_template`                                                        | Create a plan-validated reusable template or make an active editable copy                                                                                                                                                                                                                   |
| `preview_template`                                                                              | Dry-run variable resolution + validation — costs no credits                                                                                                                                                                                                                                 |
| `list_projects` / `get_project` / `create_project`                                              | Editor draft projects (open at `https://editor.zvid.io/?project=<id>`)                                                                                                                                                                                                                      |
| `list_webhooks` / `create_webhook` / `get_webhook` / `test_webhook` / `list_webhook_deliveries` | Webhook endpoints for `render.completed` / `render.failed` (HMAC-SHA256 signed)                                                                                                                                                                                                             |
| `get_credits` / `get_usage_stats`                                                               | Credit balance and usage                                                                                                                                                                                                                                                                    |

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

For a reusable template, replace the final render with `create_template`. Later use `get_template` to inspect it, `preview_template` before rendering, and `duplicate_template` for a safe editable copy. Update and delete mutations are intentionally not exposed as MCP tools.

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

Deliveries are signed: `X-Zvid-Signature: sha256=HMAC_SHA256(secret, "<X-Zvid-Timestamp>.<raw body>")`. The secret (`whsec_…`) is returned once by `create_webhook`; `get_webhook` redacts it.

## Development

```bash
npm install
npm run build     # tsc → dist/
npm test          # unit + in-memory MCP round-trip tests
# real E2E against a local orchestrator:
ZVID_API_KEY=zvid_… ZVID_API_URL=http://localhost:4000 node scripts/e2e-local.mjs
```

## Publishing (manual)

Not published yet.

**npm.** Bump `version` in `package.json`, then `npm publish` from `mcp/` (public access is set via `publishConfig`). The `prepublishOnly` hook builds `dist/`.

**Official MCP Registry** (`registry.modelcontextprotocol.io`) — lists the server for discovery in MCP-aware clients. It reads `server.json`; ownership of the `io.zvid/*` namespace is proven with a DNS TXT record on `zvid.io` (or switch the `mcpName`/`server.json` `name` to `io.github.Zvid-io/zvid-mcp` to verify via GitHub instead). After `npm publish`:

```bash
# one-time: install the publisher CLI, then log in (DNS or GitHub)
mcp-publisher login dns --domain zvid.io      # or: mcp-publisher login github
mcp-publisher publish                          # reads ./server.json
```

**Keep versions in sync** on every release — a mismatch blocks the registry publish. Update all three together: `package.json` `version`, `server.json` `version`, and `server.json` `packages[0].version`. The server name must match in both files: `package.json` `mcpName` == `server.json` `name`.
