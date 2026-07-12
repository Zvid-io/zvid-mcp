/**
 * Zvid MCP server — exposes the Zvid rendering API as MCP tools.
 *
 * Endpoint map (orchestrator REST API):
 *   POST /api/render/api-key                 create video render
 *   POST /api/render/image/api-key           create image render
 *   POST /api/render/bulk/api-key            bulk video render
 *   POST /api/render/image/bulk/api-key      bulk image render
 *   GET  /api/jobs/:id                       render status
 *   GET  /api/jobs                           list renders
 *   GET  /api/render/bulk(/:id)              bulk render status/list
 *   GET  /api/templates(/:id)                templates
 *   POST /api/templates/:id/preview          dry-run variable resolution
 *   CRUD /api/projects                       editor draft projects
 *   CRUD /api/webhooks                       webhook endpoints
 *   GET  /api/credits/balance|usage-stats    credits
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZvidApiError, ZvidClient } from "./client.js";
import {
  buildProjectJsonSchema,
  buildRenderRequestJsonSchema,
  getElementDocs,
  getExample,
  listElements,
  repairProject,
  validateProject,
  validateRenderRequest,
  AUTHORING_GUIDELINES,
  DEFAULT_LIMITS,
  EXAMPLES,
  FREE_PLAN_LIMITS,
  SCHEMA_VERSION,
  SOURCE_OF_TRUTH,
  VALIDATION_NOTES,
} from "./zvidSchema.js";

export interface ServerOptions {
  client: ZvidClient;
  version?: string;
}

/** JSON-stringify a successful API response into MCP text content. */
function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err: unknown) {
  const payload =
    err instanceof ZvidApiError
      ? {
          status: err.status,
          error: err.error,
          message: err.message,
          details: err.details,
        }
      : { message: err instanceof Error ? err.message : String(err) };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

/** Wrap an async handler so Zvid API errors surface as MCP tool errors. */
function handler<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };
}

// ---- shared schema fragments -------------------------------------------------

const payloadSchema = z
  .record(z.unknown())
  .describe(
    "Full Zvid project JSON (scenes, elements, output settings). Call get_project_schema for the JSON Schema, list_supported_elements / get_element_docs for element docs, and validate_project_json BEFORE rendering."
  );

const templateIdSchema = z
  .string()
  .regex(/^tpl_[A-Za-z0-9]{20}$/, 'Template IDs look like "tpl_" + 20 chars')
  .describe('Template ID, e.g. "tpl_AbC123..." (20 chars after the prefix)');

const variablesSchema = z
  .record(z.unknown())
  .describe("Template variable values, keyed by variable name.");

const overridesSchema = z
  .object({
    name: z.string().optional().describe("Output/job name"),
    resolution: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    outputFormat: z.string().optional(),
    frameRate: z.number().positive().optional(),
    backgroundColor: z.string().optional(),
    snapshotTime: z
      .number()
      .nonnegative()
      .optional()
      .describe("Image renders only: time (seconds) to snapshot"),
    quality: z.number().optional().describe("Image renders only"),
    transparent: z.boolean().optional().describe("Image renders only"),
  })
  .describe("Optional output overrides applied on top of the payload/template.");

const webhookUrlSchema = z
  .string()
  .url()
  .describe(
    "Optional per-job webhook URL notified on render.completed / render.failed."
  );

const paginationShape = {
  page: z.number().int().min(1).optional().describe("Page number (default 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Items per page (default 20, max 100)"),
};

const renderEnvelopeShape = {
  payload: payloadSchema.optional(),
  template: templateIdSchema.optional(),
  variables: variablesSchema.optional(),
  overrides: overridesSchema.optional(),
  webhookUrl: webhookUrlSchema.optional(),
};

export function createZvidServer({ client, version = "0.1.0" }: ServerOptions) {
  const server = new McpServer({ name: "zvid", version });

  // ---- renders ----------------------------------------------------------------

  server.registerTool(
    "create_render",
    {
      title: "Create video render",
      description:
        "Queue a video render. Provide either a full project JSON as `payload` or a `template` ID (optionally with `variables`). Returns a jobId to poll with get_render. Credits are reserved up front.",
      inputSchema: renderEnvelopeShape,
    },
    handler(async (args) => {
      requireOneOf(args, "payload", "template");
      return client.post("/api/render/api-key", args);
    })
  );

  server.registerTool(
    "create_image_render",
    {
      title: "Create image render",
      description:
        "Queue a still-image render (PNG/JPEG) from a project JSON or an image-type template. Overrides support snapshotTime, quality and transparent. Returns a jobId to poll with get_render.",
      inputSchema: renderEnvelopeShape,
    },
    handler(async (args) => {
      requireOneOf(args, "payload", "template");
      return client.post("/api/render/image/api-key", args);
    })
  );

  server.registerTool(
    "get_render",
    {
      title: "Get render status",
      description:
        "Get a render job's state (waiting|active|completed|failed), progress (0-100), and — when completed — the output url and thumbnailUrl.",
      inputSchema: {
        jobId: z.string().describe("Render job ID (UUID) returned when the render was created"),
      },
    },
    handler(({ jobId }) => client.get(`/api/jobs/${encodeURIComponent(jobId)}`))
  );

  server.registerTool(
    "list_renders",
    {
      title: "List renders",
      description: "List this account's render jobs, newest first. Optionally filter by type (video|image).",
      inputSchema: {
        ...paginationShape,
        type: z.enum(["video", "image"]).optional(),
      },
    },
    handler((args) => client.get("/api/jobs", args))
  );

  // ---- schema & authoring -------------------------------------------------------
  // Backed by the shared zvid-schema module (vendored zvidSchema.ts), which is
  // derived from the LIVE backend validation (orch/middleware/validation.js).
  // Backend wins over public docs when they disagree.

  server.registerTool(
    "get_project_schema",
    {
      title: "Get project JSON Schema",
      description:
        "Get the JSON Schema (draft 2020-12) for a Zvid render payload — element types, required fields, enums, defaults, min/max bounds and URL restrictions — plus notes for cross-field rules the schema cannot express (timing checks, plan limits, sanitizer rules). Use target: \"render-request\" for the full request envelope (payload XOR template + variables/overrides/webhookUrl). Derived from the backend validation code, which always wins over docs.",
      inputSchema: {
        target: z
          .enum(["project", "render-request"])
          .optional()
          .describe('What to describe: "project" (the payload object, default) or "render-request" (the full POST body)'),
      },
    },
    handler(async ({ target }) => {
      const jsonSchema =
        target === "render-request"
          ? buildRenderRequestJsonSchema()
          : buildProjectJsonSchema();
      return {
        schemaVersion: SCHEMA_VERSION,
        sourceOfTruth: SOURCE_OF_TRUTH,
        jsonSchema,
        validationNotes: VALIDATION_NOTES,
        authoringGuidelines: AUTHORING_GUIDELINES,
        planLimits: {
          note: "Numeric ceilings are plan-dependent; the schema uses the Default tier. Free-tier ceilings shown for reference. On 400 the API echoes your effective limits in planLimits.",
          defaultTier: DEFAULT_LIMITS,
          freeTier: FREE_PLAN_LIMITS,
        },
      };
    })
  );

  server.registerTool(
    "validate_project_json",
    {
      title: "Validate project JSON",
      description:
        "Validate a Zvid project payload BEFORE rendering (free, no credits). Returns { valid, errors: [{field, message}], warnings }. Warnings include LAYOUT LINT — overlapping texts, x/y ignored by position presets, boxes extending off-canvas, padding that will get cut off, low text contrast — treat every layout warning as a fix-before-render item. Local validation mirrors the backend rules; set remote: true to ALSO run the payload through the live API validator (POST /api/render/validate/api-key — resolves templates and applies your plan's real limits).",
      inputSchema: {
        payload: z.record(z.unknown()).describe("The project JSON to validate (the `payload` you would pass to create_render)"),
        kind: z
          .enum(["project", "render-request"])
          .optional()
          .describe('Validate as a bare "project" payload (default) or as a full "render-request" body'),
        remote: z
          .boolean()
          .optional()
          .describe("Also validate server-side against your account's actual plan limits (default false)"),
      },
    },
    handler(async ({ payload, kind, remote }) => {
      const local =
        kind === "render-request"
          ? validateRenderRequest(payload)
          : validateProject(payload);

      const result: Record<string, unknown> = {
        valid: local.valid,
        errors: local.errors,
        warnings: local.warnings,
        validatedBy: "local schema (mirrors backend validation)",
      };

      if (remote) {
        const body = kind === "render-request" ? payload : { payload };
        try {
          const remoteRes = await client.post("/api/render/validate/api-key", body);
          result.remote = { valid: true, response: remoteRes };
        } catch (err) {
          if (err instanceof ZvidApiError && err.status === 400) {
            result.remote = { valid: false, errors: err.details ?? err.message };
            result.valid = false;
          } else if (err instanceof ZvidApiError && err.status === 404) {
            result.remote = {
              valid: null,
              note: "The API does not expose POST /api/render/validate yet — local verdict returned.",
            };
          } else {
            throw err;
          }
        }
      }
      return result;
    })
  );

  server.registerTool(
    "list_supported_elements",
    {
      title: "List supported elements",
      description:
        "List every element type a Zvid project supports (visuals: IMAGE, VIDEO, GIF, SVG, TEXT; plus AUDIO items, SUBTITLE and SCENE) with a summary and required fields. Use get_element_docs for full per-type docs and examples.",
      inputSchema: {},
    },
    handler(async () => ({
      schemaVersion: SCHEMA_VERSION,
      elements: listElements(),
      notes: [
        'Visual elements live in `visuals` (project-level or per-scene); the discriminator is `type` (case-insensitive).',
        "AUDIO items live in `audios`, SUBTITLE in the top-level `subtitle` object, SCENEs in `scenes`.",
        'Image projects (type: "image") only allow IMAGE, TEXT and SVG visuals.',
      ],
      authoringGuidelines: AUTHORING_GUIDELINES,
    }))
  );

  server.registerTool(
    "get_element_docs",
    {
      title: "Get element docs",
      description:
        "Get concise docs for one element type — required fields, every supported field with constraints, gotchas, and a valid example. Types: IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE (case-insensitive).",
      inputSchema: {
        element: z
          .string()
          .describe('Element type, e.g. "TEXT", "IMAGE", "VIDEO", "GIF", "SVG", "AUDIO", "SUBTITLE", "SCENE"'),
      },
    },
    handler(async ({ element }) => {
      const doc = getElementDocs(element);
      if (!doc) {
        throw new Error(
          `Unknown element type "${element}". Supported: IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE.`
        );
      }
      return doc;
    })
  );

  server.registerTool(
    "get_example_payload",
    {
      title: "Get example payload",
      description:
        "Get a validated, layout-clean example for a common flow: promo-video (10s scene-based hook/value/CTA with scrim + flex-centered card), template-render (variables), still-image (transparent PNG, single html card), subtitles (karaoke captions), webhook-flow (per-job webhookUrl). These encode the authoring guidelines — start from one instead of composing from scratch. Omit `name` to list all examples.",
      inputSchema: {
        name: z
          .enum(["promo-video", "template-render", "still-image", "subtitles", "webhook-flow"])
          .optional()
          .describe("Example name; omit to get every example"),
      },
    },
    handler(async ({ name }) => {
      if (!name) return EXAMPLES;
      const example = getExample(name);
      if (!example) throw new Error(`Unknown example "${name}"`);
      return example;
    })
  );

  server.registerTool(
    "repair_project_json",
    {
      title: "Repair project JSON",
      description:
        "Attempt conservative auto-fixes on an invalid project payload (wrong-case type, clamped numbers, format conflicts like transparent+jpg, swapped begin/end timings, unknown fields, empty/impossible elements) and explain every change. Returns the repaired payload plus its validation result — problems that need real input (e.g. missing media URLs) are left as errors.",
      inputSchema: {
        payload: z.record(z.unknown()).describe("The (possibly invalid) project JSON to repair"),
      },
    },
    handler(async ({ payload }) => {
      const { repaired, changes, result } = repairProject(payload);
      return {
        repaired,
        changes,
        valid: result.valid,
        remainingErrors: result.errors,
        warnings: result.warnings,
      };
    })
  );

  // ---- bulk renders -----------------------------------------------------------

  server.registerTool(
    "create_bulk_render",
    {
      title: "Create bulk render",
      description:
        "Queue N renders from one template/payload and a list of per-item variable sets (max 500 items, plan-limited). Validation is best-effort per item: valid items queue, invalid ones are reported in itemErrors. Returns bulkId + jobIds.",
      inputSchema: {
        kind: z
          .enum(["video", "image"])
          .default("video")
          .describe("What the payload/template renders"),
        payload: payloadSchema.optional(),
        template: templateIdSchema.optional(),
        items: z
          .array(
            z.object({
              variables: variablesSchema.optional(),
              name: z.string().optional().describe("Per-item output name override"),
            })
          )
          .min(1)
          .max(500)
          .describe("One entry per render; each item's variables merge over the base variables."),
        variables: variablesSchema.optional().describe("Base variables applied to every item"),
        overrides: overridesSchema.optional(),
        name: z.string().optional().describe("Name for the bulk batch"),
        webhookUrl: webhookUrlSchema.optional(),
      },
    },
    handler(async ({ kind, ...body }) => {
      requireOneOf(body, "payload", "template");
      const path =
        kind === "image" ? "/api/render/image/bulk/api-key" : "/api/render/bulk/api-key";
      return client.post(path, body);
    })
  );

  server.registerTool(
    "get_bulk_render",
    {
      title: "Get bulk render",
      description: "Get a bulk render batch by ID (blk_...) including its jobs' states.",
      inputSchema: { bulkId: z.string().describe('Bulk render ID, e.g. "blk_..."') },
    },
    handler(({ bulkId }) => client.get(`/api/render/bulk/${encodeURIComponent(bulkId)}`))
  );

  server.registerTool(
    "list_bulk_renders",
    {
      title: "List bulk renders",
      description: "List this account's bulk render batches.",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/render/bulk", args))
  );

  // ---- templates ----------------------------------------------------------------

  server.registerTool(
    "list_templates",
    {
      title: "List templates",
      description: "List this account's render templates (id, name, description).",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/templates", args))
  );

  server.registerTool(
    "get_template",
    {
      title: "Get template",
      description:
        "Get a template by ID including its full project JSON (inspect it to discover the variables it expects).",
      inputSchema: { templateId: templateIdSchema },
    },
    handler(({ templateId }) => client.get(`/api/templates/${encodeURIComponent(templateId)}`))
  );

  server.registerTool(
    "preview_template",
    {
      title: "Preview template (dry run)",
      description:
        "Resolve a template's variables and validate the result WITHOUT rendering or spending credits. Use this to check variable values before create_render.",
      inputSchema: {
        templateId: templateIdSchema,
        variables: variablesSchema.optional(),
        overrides: overridesSchema.optional(),
      },
    },
    handler(({ templateId, ...body }) =>
      client.post(`/api/templates/${encodeURIComponent(templateId)}/preview`, body)
    )
  );

  // ---- projects (editor drafts) -------------------------------------------------

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List editor draft projects saved on this account.",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/projects", args))
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Get a draft project (prj_...) including its project JSON.",
      inputSchema: { projectId: projectIdSchema() },
    },
    handler(({ projectId }) => client.get(`/api/projects/${encodeURIComponent(projectId)}`))
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "Save a new editor draft project. It becomes editable at https://zvid.io/editor?project=<id>.",
      inputSchema: {
        name: z.string().min(1).max(255),
        payload: payloadSchema,
      },
    },
    handler((body) => client.post("/api/projects", body))
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Rename a draft project and/or replace its project JSON.",
      inputSchema: {
        projectId: projectIdSchema(),
        name: z.string().min(1).max(255).optional(),
        payload: payloadSchema.optional(),
      },
    },
    handler(({ projectId, ...body }) => {
      if (body.name === undefined && body.payload === undefined) {
        throw new Error("Provide name and/or payload to update.");
      }
      return client.put(`/api/projects/${encodeURIComponent(projectId)}`, body);
    })
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Permanently delete a draft project.",
      inputSchema: { projectId: projectIdSchema() },
    },
    handler(({ projectId }) => client.delete(`/api/projects/${encodeURIComponent(projectId)}`))
  );

  // ---- webhooks -------------------------------------------------------------------

  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description: "List webhook endpoints registered on this account, plus usage vs plan limit.",
      inputSchema: {},
    },
    handler(() => client.get("/api/webhooks"))
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Register a webhook endpoint for render events. The response includes the signing secret (whsec_...) shown in full only here and on get_webhook — deliveries are signed with HMAC-SHA256 in the X-Zvid-Signature header.",
      inputSchema: {
        url: z.string().url().describe("HTTPS endpoint to deliver events to"),
        events: z
          .array(z.enum(["render.completed", "render.failed"]))
          .min(1)
          .describe("Events to subscribe to"),
        description: z.string().max(255).optional(),
      },
    },
    handler((body) => client.post("/api/webhooks", body))
  );

  server.registerTool(
    "get_webhook",
    {
      title: "Get webhook",
      description: "Get a webhook endpoint (whk_...) including its signing secret and failure state.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(({ webhookId }) => client.get(`/api/webhooks/${encodeURIComponent(webhookId)}`))
  );

  server.registerTool(
    "update_webhook",
    {
      title: "Update webhook",
      description: "Update a webhook's url, events, description, or enable/disable it.",
      inputSchema: {
        webhookId: webhookIdSchema(),
        url: z.string().url().optional(),
        events: z.array(z.enum(["render.completed", "render.failed"])).min(1).optional(),
        description: z.string().max(255).optional(),
        status: z.enum(["active", "disabled"]).optional(),
      },
    },
    handler(({ webhookId, ...body }) => {
      if (Object.values(body).every((v) => v === undefined)) {
        throw new Error("Provide at least one field to update.");
      }
      return client.put(`/api/webhooks/${encodeURIComponent(webhookId)}`, body);
    })
  );

  server.registerTool(
    "delete_webhook",
    {
      title: "Delete webhook",
      description: "Delete a webhook endpoint.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(({ webhookId }) => client.delete(`/api/webhooks/${encodeURIComponent(webhookId)}`))
  );

  server.registerTool(
    "test_webhook",
    {
      title: "Send test webhook",
      description: "Queue a signed test event delivery to a webhook endpoint.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(({ webhookId }) => client.post(`/api/webhooks/${encodeURIComponent(webhookId)}/test`))
  );

  server.registerTool(
    "list_webhook_deliveries",
    {
      title: "List webhook deliveries",
      description: "List recent delivery attempts for a webhook endpoint (status, attempts, response codes).",
      inputSchema: { webhookId: webhookIdSchema(), ...paginationShape },
    },
    handler(({ webhookId, ...query }) =>
      client.get(`/api/webhooks/${encodeURIComponent(webhookId)}/deliveries`, query)
    )
  );

  // ---- account ----------------------------------------------------------------------

  server.registerTool(
    "get_credits",
    {
      title: "Get credit balance",
      description:
        "Get the account's credit balance (total balance, subscription credits, and add-on credit pack balance).",
      inputSchema: {},
    },
    handler(() => client.get("/api/credits/balance"))
  );

  server.registerTool(
    "get_usage_stats",
    {
      title: "Get usage stats",
      description: "Get render/credit usage statistics for a timeframe (e.g. 7d, 30d, 90d).",
      inputSchema: {
        timeframe: z.string().optional().describe('Timeframe like "30d" (default)'),
      },
    },
    handler((args) => client.get("/api/credits/usage-stats", args))
  );

  return server;
}

function projectIdSchema() {
  return z
    .string()
    .regex(/^prj_[A-Za-z0-9]{20}$/, 'Project IDs look like "prj_" + 20 chars')
    .describe('Project ID, e.g. "prj_..."');
}

function webhookIdSchema() {
  return z
    .string()
    .regex(/^whk_[A-Za-z0-9]{20}$/, 'Webhook IDs look like "whk_" + 20 chars')
    .describe('Webhook ID, e.g. "whk_..."');
}

function requireOneOf(obj: Record<string, unknown>, a: string, b: string) {
  const hasA = obj[a] !== undefined;
  const hasB = obj[b] !== undefined;
  if (hasA === hasB) {
    throw new Error(`Provide exactly one of "${a}" or "${b}".`);
  }
}
