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
    "Full Zvid project JSON (scenes, elements, output settings). See https://zvid.io/docs for the project schema."
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
