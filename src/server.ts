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
 *   GET/POST /api/templates                  list/create templates
 *   GET/PUT/DELETE /api/templates/:id        read/update/archive templates
 *   POST /api/templates/:id/(duplicate|preview)
 *                                               copy or dry-run variable resolution
 *   CRUD /api/projects                       editor draft projects
 *   CRUD /api/webhooks                       webhook endpoints
 *   GET  /api/credits/balance|usage-stats    credits
 */

import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  registerAgentFacade,
  registerAgentResourcesAndPrompts,
} from "./agentFacade.js";
import { ZvidApiError, ZvidClient } from "./client.js";
import {
  DEFAULT_TOOL_PROFILE,
  isToolEnabled,
  parseToolProfile,
  type ToolProfile,
} from "./profiles.js";
import {
  briefSubjectTerms,
  buildAdaptationMap,
  buildProjectJsonSchema,
  buildRenderRequestJsonSchema,
  buildCreativePlan,
  getElementDocs,
  getExample,
  listElements,
  repairProject,
  rotateComparableCandidates,
  scoreLibraryCandidates,
  validateProject,
  validateRenderRequest,
  ADAPTATION_CONTRACT,
  AUTHORING_GUIDELINES,
  CREATIVE_ASPECT_RATIOS,
  CREATIVE_MOTION_INTENSITIES,
  CREATIVE_STYLE_PACKS,
  DEFAULT_LIMITS,
  EXAMPLES,
  FREE_PLAN_LIMITS,
  SCHEMA_VERSION,
  SOURCE_OF_TRUTH,
  VALIDATION_NOTES,
  type LibraryListItem,
  type ScoredLibraryCandidate,
} from "./zvidSchema.js";

export interface ServerOptions {
  client: ZvidClient;
  version?: string;
  profile?: ToolProfile;
  quoteSecret?: string;
  quoteTtlSeconds?: number;
  maxRenderCredits?: number;
  maxBulkItems?: number;
  now?: () => Date;
}

const PROCESS_QUOTE_SECRET =
  process.env.ZVID_MCP_QUOTE_SECRET ?? crypto.randomBytes(32).toString("hex");
const DEFAULT_MCP_MAX_BULK_ITEMS = positiveInteger(
  process.env.ZVID_MCP_MAX_BULK_ITEMS,
  25,
);

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
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

async function liveAuthoringOrFallback<T>(
  load: () => Promise<T>,
  fallback: () => T,
): Promise<T | (T & { live: false; liveError: string })> {
  try {
    return await load();
  } catch (error) {
    const local = fallback();
    const liveError =
      error instanceof Error ? error.message : "Live authoring API unavailable";
    return Object.assign(local as object, { live: false, liveError }) as T & {
      live: false;
      liveError: string;
    };
  }
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
    "Full Zvid project JSON (scenes, elements, output settings). Call get_project_schema for the JSON Schema, list_supported_elements / get_element_docs for element docs, and validate_project_json BEFORE rendering.",
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
  .describe(
    "Optional output overrides applied on top of the payload/template.",
  );

const webhookUrlSchema = z
  .string()
  .url()
  .describe(
    "Optional per-job webhook URL notified on render.completed / render.failed.",
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

const creativeLibraryKindSchema = z.enum([
  "examples",
  "design-templates",
  "canvas-presets",
  "shapes",
]);

const brandKitSchema = z
  .object({
    name: z.string().max(200).optional(),
    primaryColor: z
      .string()
      .regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
      .optional(),
    accentColor: z
      .string()
      .regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
      .optional(),
    headlineFont: z.string().max(100).optional(),
    bodyFont: z.string().max(100).optional(),
    logoUrl: z.string().url().max(2048).optional(),
  })
  .describe(
    "Optional brand tokens that remain stable across creative variations.",
  );

// ---- creative-library discovery ---------------------------------------------
// The orch q search is an AND-of-substrings over title/slug/description, so
// model-authored queries often return nothing. Instead we fetch the full
// examples metadata listing once (Redis-cached server-side) and rank locally
// with scoreLibraryCandidates, which also matches category keyword synonyms.

interface LibraryDiscoveryOptions {
  brief: string;
  projectType: "video" | "image" | "any";
  aspectRatio?: string;
  duration?: number;
  excludeSlugs?: string[];
  excludePremium?: boolean;
  limit?: number;
  /** undefined = automatic: include parts unless a strong example match exists. */
  includeParts?: boolean;
  /** Style-pack queries from a creative plan, when available. */
  partsQueries?: { designTemplates?: string[]; canvasPresets?: string[] };
  /**
   * When set, rotates which comparable top candidate leads (anti-repetition
   * for repeated identical briefs). Omit for deterministic ranking.
   */
  variationSeed?: string | number;
}

interface LibraryDiscoveryResult {
  poolSize: number;
  decision: "adapt-example" | "adapt-or-assemble" | "assemble-similar";
  decisionReason: string;
  variation?: { rotated: boolean; comparableCount: number; note: string };
  examples: ScoredLibraryCandidate[];
  premiumNote?: string;
  assembleFrom?: {
    designTemplates: Record<string, unknown>[];
    canvasPresets: Record<string, unknown>[];
    shapes: Record<string, unknown>[];
  };
  adaptationContract: string[];
  nextSteps: string[];
}

/** Trim a parts search hit to lightweight metadata (drops inline SVG markup). */
function trimPartItem(
  kind: string,
  item: Record<string, unknown>,
): Record<string, unknown> {
  const meta =
    item.meta && typeof item.meta === "object" && !Array.isArray(item.meta)
      ? (item.meta as Record<string, unknown>)
      : {};
  const trimmedMeta: Record<string, unknown> = {};
  for (const key of [
    "thumbnail",
    "preview",
    "previewWidth",
    "previewHeight",
    "animationDuration",
    "width",
    "height",
    "category",
  ]) {
    if (meta[key] !== undefined) trimmedMeta[key] = meta[key];
  }
  return {
    kind,
    slug: item.slug,
    title: item.title,
    description: item.description,
    meta: trimmedMeta,
  };
}

async function searchLibraryParts(
  client: ZvidClient,
  kind: string,
  queries: string[],
): Promise<Record<string, unknown>[]> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const pages = await Promise.all(
    unique
      .slice(0, 3)
      .map((q) =>
        client
          .get(`/api/library/${kind}`, { q, limit: 8, offset: 0 })
          .catch(() => null),
      ),
  );
  const seen = new Map<string, Record<string, unknown>>();
  for (const page of pages) {
    const items = (page as { items?: unknown[] } | null)?.items;
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      if (!item || typeof item.slug !== "string" || seen.has(item.slug))
        continue;
      seen.set(item.slug, trimPartItem(kind, item));
    }
  }
  return [...seen.values()].slice(0, 12);
}

async function discoverLibraryCandidates(
  client: ZvidClient,
  opts: LibraryDiscoveryOptions,
  profile: ToolProfile = "developer",
): Promise<LibraryDiscoveryResult> {
  const listing = (await client.get("/api/library/examples")) as {
    items?: unknown;
  };
  const pool = Array.isArray(listing?.items)
    ? (listing.items as LibraryListItem[])
    : [];

  let examples = scoreLibraryCandidates(pool, {
    brief: opts.brief,
    projectType: opts.projectType,
    aspectRatio: opts.aspectRatio,
    duration: opts.duration,
    excludeSlugs: opts.excludeSlugs,
    excludePremium: opts.excludePremium,
    limit: opts.limit,
  });

  let variation: LibraryDiscoveryResult["variation"];
  if (opts.variationSeed !== undefined) {
    const rotation = rotateComparableCandidates(examples, opts.variationSeed);
    examples = rotation.candidates;
    variation = {
      rotated: rotation.rotated,
      comparableCount: rotation.comparableCount,
      note:
        rotation.comparableCount >= 2
          ? `${rotation.comparableCount} candidates are comparably good; the lead rotates per request so repeated identical briefs vary. Pass excludeSlugs/recentAssetSlugs with previously used slugs for stronger anti-repetition, or variationMode "consistent" (+ variationSeed) for reproducible picks.`
          : "One candidate stands clearly above the rest, so no rotation applied. Pass excludeSlugs/recentAssetSlugs with previously used slugs to force different designs on repeats.",
    };
  }

  const best = examples[0];
  let decision: LibraryDiscoveryResult["decision"];
  let decisionReason: string;
  let nextSteps: string[];
  if (best && best.matchStrength === "strong") {
    decision = "adapt-example";
    decisionReason = `"${best.slug}" is a strong match (score ${best.score}) — adapt it with start_from_example instead of composing from scratch.`;
    nextSteps =
      profile === "creator"
        ? [
            `start_from_example { slug: "${best.slug}" } returns the full payload and adaptation map.`,
            "Adapt the designed payload in place. If template-only variables or iteration cannot be materialized safely, choose a static candidate or assemble from library parts instead of simplifying the design.",
            "Validate the complete static payload with validate_project_json (remote: true), fix every issue, then call create_media with the original brief and that exact payload.",
          ]
        : [
            `start_from_example { slug: "${best.slug}" } returns the full payload, its variables, and an adaptation map.`,
            "EASIEST premium path when it has variables: choose new variable VALUES (copy, media URLs from search_stock_media, brand colors) and call render_from_example { slug, variables } — the server keeps the design intact.",
            "Only edit the payload itself when variables cannot express the change; keep layout/animations/timings, then validate_project_json (remote: true) and create_render / create_image_render.",
          ];
  } else {
    decision =
      best && best.matchStrength === "partial"
        ? "adapt-or-assemble"
        : "assemble-similar";
    const noSubjectTerms = briefSubjectTerms(opts.brief, 1).length === 0;
    decisionReason =
      decision === "adapt-or-assemble"
        ? "Only partial matches found — inspect their thumbnails/previews; adapt the closest one if its scene structure fits the story, otherwise assemble a similar video from library parts."
        : best
          ? "Only weak matches found — treat them as browsing references, not starting points; assemble a similar video from design-templates, canvas-presets, shapes and stock media."
          : noSubjectTerms
            ? "No subject terms could be extracted from the brief (non-Latin script or filler-only text) — matching is keyword-based, so browse the library with search_creative_library or assemble a similar video from parts, and consider restating the brief's topic in English."
            : "No published example matches this brief — assemble a similar video from design-templates, canvas-presets, shapes and stock media, following the plan's scene recipes.";
    nextSteps = [
      "Inspect candidate thumbnails/previews before dismissing them; adapt the closest fit when its scene structure matches.",
      "Otherwise assemble the planned scenes: search_creative_library for modules and search_stock_media for topic media (full-quality src, natural size >= canvas).",
      profile === "creator"
        ? "Compose scene-based project JSON, validate_project_json (remote: true), fix everything, then call create_media with the original brief and exact payload."
        : "Compose scene-based project JSON, validate_project_json (remote: true), fix everything, then render.",
    ];
  }

  const result: LibraryDiscoveryResult = {
    poolSize: pool.length,
    decision,
    decisionReason,
    ...(variation ? { variation } : {}),
    examples,
    adaptationContract: ADAPTATION_CONTRACT,
    nextSteps,
  };

  if (examples.some((candidate) => candidate.premium)) {
    result.premiumNote =
      "Candidates marked premium require a paid plan to fetch content; start_from_example suggests free alternatives when locked.";
  }

  const includeParts = opts.includeParts ?? decision !== "adapt-example";
  if (includeParts) {
    const subjectTerms = briefSubjectTerms(opts.brief, 4);
    const [designTemplates, canvasPresets, shapes] = await Promise.all([
      searchLibraryParts(client, "design-templates", [
        ...(opts.partsQueries?.designTemplates ?? []),
        ...subjectTerms.slice(0, 2),
      ]),
      searchLibraryParts(client, "canvas-presets", [
        ...(opts.partsQueries?.canvasPresets ?? []),
        ...subjectTerms.slice(0, 1),
      ]),
      searchLibraryParts(client, "shapes", [
        "callout",
        "badge",
        ...subjectTerms.slice(0, 1),
      ]),
    ]);
    result.assembleFrom = { designTemplates, canvasPresets, shapes };
  }

  return result;
}

const READONLY_INSTRUCTIONS = `Use get_media and list_media to inspect existing work, and get_account for credits and usage. This profile cannot create, revise, or render media.`;

const CREATOR_INSTRUCTIONS = `Zvid Creator uses exact, quality-first project authoring. Brief-only creative composition is disabled because weak models produce unreliable layouts. Follow this workflow:
1. Call plan_creative_video with the brief and use its ranked libraryCandidates and decision.
2. For "adapt-example", call start_from_example with the best slug, preserve its designed structure, layout, animations and timing, and replace only the necessary copy, media URLs and brand values. Never simplify a designed example into plain text on a background.
3. For "adapt-or-assemble", adapt the closest candidate when its scene structure fits; otherwise use the assemble-similar route.
4. For "assemble-similar", build the planned scenes from creative-library design templates, canvas presets and shapes plus full-quality search_stock_media URLs. Never invent media URLs.
5. Always call validate_project_json with remote: true and fix every error and layout warning.
6. Call create_media with the original brief and the complete validated payload. Creator rejects calls without payload, so it never improvises a design from the brief. Draft creation does not spend credits.
7. Review the editor link. Revisions also require a complete validated replacement payload. Call render_media only after the user approves the exact quoted credits, using the returned draftId and quoteToken.
For repeated briefs, pass recentAssetSlugs or excludeSlugs so fresh mode can rotate comparable candidates. get_example_payload's canned payloads are a last-resort scaffold, not the creative library.`;

const DEVELOPER_INSTRUCTIONS = `For low-level authoring, Zvid renders project JSON into videos and images. Follow the example-first quality workflow — hand-composed layouts are the #1 cause of low-quality output:
1. plan_creative_video with the brief. The response includes ranked libraryCandidates (matching published examples) and a decision.
2. decision "adapt-example": start_from_example with the top slug to see its variables and adaptation map, then take the EASIEST premium path — pick new variable VALUES (copy, media URLs from search_stock_media, brand colors) and call render_from_example { slug, variables }. The server keeps the example's designed layout/animations intact. Only edit the payload manually when variables cannot express the change — and NEVER simplify a complex example into plain text-on-background; the complexity IS the design.
3. decision "adapt-or-assemble": inspect the candidates' thumbnails/previews; adapt the closest fit when its scene structure matches the story, otherwise treat it as assemble-similar.
4. decision "assemble-similar": build the planned scenes from search_creative_library design-templates / canvas-presets / shapes plus search_stock_media media. Use full-quality src URLs (never preview URLs) with natural size >= the canvas; never invent media URLs.
5. For manually composed or edited payloads, always validate_project_json (remote: true) and fix EVERY error and layout warning before create_render / create_image_render.
Repeated or similar briefs: pass recentAssetSlugs (plan) / excludeSlugs (find_matching_examples) with slugs you already used; fresh mode also rotates among comparable candidates automatically so identical prompts do not always yield the same design.
For a quick "make something like X" without a full plan, call find_matching_examples (type: "image" for stills). get_example_payload's five canned payloads are a last-resort scaffold, not the library.`;

function instructionsForProfile(profile: ToolProfile): string {
  if (profile === "readonly") return READONLY_INSTRUCTIONS;
  return profile === "automation" || profile === "developer"
    ? `${CREATOR_INSTRUCTIONS}\n\n${DEVELOPER_INSTRUCTIONS}`
    : CREATOR_INSTRUCTIONS;
}

function inferredAnnotations(name: string) {
  const readOnly =
    /^(get|list|search|find|validate|plan)_/.test(name) ||
    ["start_from_example", "preview_template", "repair_project_json"].includes(
      name,
    );
  const costly =
    name === "render_media" ||
    name === "render_from_example" ||
    name === "create_render" ||
    name === "create_image_render" ||
    name === "create_bulk_render";
  const openWorld =
    name === "search_stock_media" ||
    name === "create_webhook" ||
    name === "test_webhook" ||
    costly;
  return {
    readOnlyHint: readOnly,
    destructiveHint: costly,
    idempotentHint: readOnly,
    openWorldHint: openWorld,
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      /^(secret|signingSecret|webhookSecret)$/i.test(key)
        ? "[REDACTED]"
        : redactSecrets(child),
    ]),
  );
}

export function createZvidServer({
  client,
  version = "0.1.0",
  profile = parseToolProfile(
    process.env.ZVID_MCP_PROFILE,
    DEFAULT_TOOL_PROFILE,
  ),
  quoteSecret = PROCESS_QUOTE_SECRET,
  quoteTtlSeconds,
  maxRenderCredits,
  maxBulkItems = DEFAULT_MCP_MAX_BULK_ITEMS,
  now,
}: ServerOptions) {
  const server = new McpServer(
    { name: "zvid", version },
    { instructions: instructionsForProfile(profile) },
  );

  const baseRegisterTool = server.registerTool.bind(
    server,
  ) as McpServer["registerTool"];
  const registerTool = ((
    name: string,
    config: Record<string, unknown>,
    callback: unknown,
  ) => {
    const registered = baseRegisterTool(
      name,
      {
        ...config,
        annotations: {
          ...inferredAnnotations(name),
          ...((config.annotations as Record<string, unknown> | undefined) ??
            {}),
        },
        _meta: {
          ...((config._meta as Record<string, unknown> | undefined) ?? {}),
          "io.zvid/tool-profile": profile,
        },
      } as never,
      callback as never,
    );
    if (!isToolEnabled(profile, name)) registered.disable();
    return registered;
  }) as McpServer["registerTool"];

  server.registerTool = registerTool;

  registerAgentFacade({
    server,
    registerTool,
    client,
    profile,
    quoteSecret,
    quoteTtlSeconds,
    maxRenderCredits,
    now,
  });

  // ---- renders ----------------------------------------------------------------

  server.registerTool(
    "create_render",
    {
      title: "Create video render",
      description:
        "Queue a video render. Provide either a full project JSON as `payload` or a `template` ID (optionally with `variables`). Returns a jobId to poll with get_render. Credits are reserved up front. For NEW creative content do not hand-compose the payload: run plan_creative_video (or find_matching_examples) first and adapt a library example via start_from_example, then validate_project_json before rendering.",
      inputSchema: renderEnvelopeShape,
    },
    handler(async (args) => {
      requireOneOf(args, "payload", "template");
      return client.post("/api/render/api-key", args);
    }),
  );

  server.registerTool(
    "create_image_render",
    {
      title: "Create image render",
      description:
        'Queue a still-image render (PNG/JPEG) from a project JSON or an image-type template. Overrides support snapshotTime, quality and transparent. Returns a jobId to poll with get_render. For NEW creative stills, first run find_matching_examples with type: "image" and adapt a library example via start_from_example instead of composing from scratch.',
      inputSchema: renderEnvelopeShape,
    },
    handler(async (args) => {
      requireOneOf(args, "payload", "template");
      return client.post("/api/render/image/api-key", args);
    }),
  );

  server.registerTool(
    "get_render",
    {
      title: "Get render status",
      description:
        "Get a render job's state (waiting|active|completed|failed), progress (0-100), and — when completed — the output url and thumbnailUrl.",
      inputSchema: {
        jobId: z
          .string()
          .describe(
            "Render job ID (UUID) returned when the render was created",
          ),
      },
    },
    handler(({ jobId }) =>
      client.get(`/api/jobs/${encodeURIComponent(jobId)}`),
    ),
  );

  server.registerTool(
    "list_renders",
    {
      title: "List renders",
      description:
        "List this account's render jobs, newest first. Optionally filter by type (video|image).",
      inputSchema: {
        ...paginationShape,
        type: z.enum(["video", "image"]).optional(),
      },
    },
    handler((args) => client.get("/api/jobs", args)),
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
        'Get the JSON Schema (draft 2020-12) for a Zvid render payload — element types, required fields, enums, defaults, min/max bounds and URL restrictions — plus notes for cross-field rules the schema cannot express (timing checks, plan limits, sanitizer rules). Use target: "render-request" for the full request envelope (payload XOR template + variables/overrides/webhookUrl). Derived from the backend validation code, which always wins over docs.',
      inputSchema: {
        target: z
          .enum(["project", "render-request"])
          .optional()
          .describe(
            'What to describe: "project" (the payload object, default) or "render-request" (the full POST body)',
          ),
      },
    },
    handler(async ({ target }) =>
      liveAuthoringOrFallback(
        () =>
          client.get("/api/render/schema/api-key", {
            target: target ?? "project",
          }),
        () => {
          const jsonSchema =
            target === "render-request"
              ? buildRenderRequestJsonSchema()
              : buildProjectJsonSchema();
          return {
            schemaVersion: SCHEMA_VERSION,
            sourceOfTruth: SOURCE_OF_TRUTH,
            target: target ?? "project",
            jsonSchema,
            validationNotes: VALIDATION_NOTES,
            authoringGuidelines: AUTHORING_GUIDELINES,
            planLimits: {
              note: "Live plan-aware schema unavailable; these are bundled default limits.",
              defaultTier: DEFAULT_LIMITS,
              freeTier: FREE_PLAN_LIMITS,
            },
          };
        },
      ),
    ),
  );

  server.registerTool(
    "validate_project_json",
    {
      title: "Validate project JSON",
      description:
        "Validate a Zvid project payload BEFORE rendering (free, no credits). Returns { valid, errors: [{field, message}], warnings }. Warnings include LAYOUT LINT — overlapping texts, x/y ignored by position presets, boxes extending off-canvas, padding that will get cut off, low text contrast — treat every layout warning as a fix-before-render item. Local validation mirrors the backend rules; set remote: true to ALSO run the payload through the live API validator (POST /api/render/validate/api-key — resolves templates and applies your plan's real limits).",
      inputSchema: {
        payload: z
          .record(z.unknown())
          .describe(
            "The project JSON to validate (the `payload` you would pass to create_render)",
          ),
        kind: z
          .enum(["project", "render-request"])
          .optional()
          .describe(
            'Validate as a bare "project" payload (default) or as a full "render-request" body',
          ),
        remote: z
          .boolean()
          .default(true)
          .describe(
            "Also validate server-side against your account's actual plan limits (default true; set false only for offline diagnostics)",
          ),
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
          const remoteRes = await client.post(
            "/api/render/validate/api-key",
            body,
          );
          result.remote = { valid: true, response: remoteRes };
        } catch (err) {
          if (err instanceof ZvidApiError && err.status === 400) {
            result.remote = {
              valid: false,
              errors: err.details ?? err.message,
            };
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
    }),
  );

  server.registerTool(
    "list_supported_elements",
    {
      title: "List supported elements",
      description:
        "List every element type a Zvid project supports (visuals: IMAGE, VIDEO, GIF, SVG, TEXT; plus AUDIO items, SUBTITLE and SCENE) with a summary and required fields. Use get_element_docs for full per-type docs and examples.",
      inputSchema: {},
    },
    handler(async () =>
      liveAuthoringOrFallback(
        () => client.get("/api/render/elements/api-key"),
        () => ({
          schemaVersion: SCHEMA_VERSION,
          sourceOfTruth: SOURCE_OF_TRUTH,
          elements: listElements(),
          notes: [
            "Visual elements live in `visuals` (project-level or per-scene); the discriminator is `type` (case-insensitive).",
            "AUDIO items live in `audios`, SUBTITLE in the top-level `subtitle` object, SCENEs in `scenes`.",
            'Image projects (type: "image") only allow IMAGE, TEXT and SVG visuals.',
          ],
          authoringGuidelines: AUTHORING_GUIDELINES,
        }),
      ),
    ),
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
          .describe(
            'Element type, e.g. "TEXT", "IMAGE", "VIDEO", "GIF", "SVG", "AUDIO", "SUBTITLE", "SCENE"',
          ),
      },
    },
    handler(async ({ element }) =>
      liveAuthoringOrFallback(
        () =>
          client.get(
            `/api/render/elements/${encodeURIComponent(element)}/api-key`,
          ),
        () => {
          const doc = getElementDocs(element);
          if (!doc) {
            throw new Error(
              `Unknown element type "${element}". Supported: IMAGE, VIDEO, GIF, SVG, TEXT, AUDIO, SUBTITLE, SCENE.`,
            );
          }
          return {
            schemaVersion: SCHEMA_VERSION,
            sourceOfTruth: SOURCE_OF_TRUTH,
            element: doc,
          };
        },
      ),
    ),
  );

  server.registerTool(
    "get_example_payload",
    {
      title: "Get example payload",
      description:
        "Get one of five GENERIC starter payloads for a common flow: promo-video (10s scene-based hook/value/CTA with scrim + flex-centered card), template-render (variables), still-image (transparent PNG, single html card), subtitles (karaoke captions), webhook-flow (per-job webhookUrl). These are schema scaffolds, NOT the designed library — for premium creative work use find_matching_examples / start_from_example first and fall back here only when no library example fits. Omit `name` to list all examples.",
      inputSchema: {
        name: z
          .enum([
            "promo-video",
            "template-render",
            "still-image",
            "subtitles",
            "webhook-flow",
          ])
          .optional()
          .describe("Example name; omit to get every example"),
      },
    },
    handler(async ({ name }) =>
      liveAuthoringOrFallback(
        () =>
          client.get(
            name
              ? `/api/render/examples/${encodeURIComponent(name)}/api-key`
              : "/api/render/examples/api-key",
          ),
        () => {
          if (!name) {
            return {
              schemaVersion: SCHEMA_VERSION,
              sourceOfTruth: SOURCE_OF_TRUTH,
              examples: EXAMPLES,
            };
          }
          const example = getExample(name);
          if (!example) throw new Error(`Unknown example "${name}"`);
          return {
            schemaVersion: SCHEMA_VERSION,
            sourceOfTruth: SOURCE_OF_TRUTH,
            example,
          };
        },
      ),
    ),
  );

  server.registerTool(
    "plan_creative_video",
    {
      title: "Plan a professional creative video",
      description:
        "Turn a brief into a plan-aware storyboard, style/layout direction, scene recipes and anti-repetition rules BEFORE authoring JSON — plus libraryCandidates: concrete published examples ranked against the brief with an adapt-vs-assemble decision. Follow that decision: adapt the top example via start_from_example, or assemble from the returned design-template/canvas-preset/shape modules. Modes: consistent reuses a stable seed; fresh produces a new direction; explore returns 2-5 materially different directions.",
      inputSchema: {
        brief: z
          .string()
          .trim()
          .min(3)
          .max(4000)
          .describe(
            "What the video should communicate, for whom, and the desired outcome.",
          ),
        variationMode: z
          .enum(["consistent", "fresh", "explore"])
          .default("fresh"),
        variationSeed: z
          .union([z.string().min(1).max(128), z.number().int()])
          .optional()
          .describe(
            "Optional reproducible seed. Reuse it for the same composition; change or omit it for a fresh direction.",
          ),
        exploreCount: z.number().int().min(2).max(5).default(3).optional(),
        aspectRatio: z.enum(CREATIVE_ASPECT_RATIOS).default("16:9"),
        duration: z.number().positive().max(86400).default(15),
        style: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .default("auto")
          .describe(
            `Style pack id or auto. Built-ins: ${CREATIVE_STYLE_PACKS.map((p) => p.id).join(", ")}.`,
          ),
        motionIntensity: z.enum(CREATIVE_MOTION_INTENSITIES).optional(),
        preferredMedia: z.enum(["image", "video", "mixed"]).default("mixed"),
        recentAssetSlugs: z
          .array(z.string().trim().min(1).max(255))
          .max(20)
          .default([])
          .describe(
            "Recently used creative-library slugs to exclude from fresh/explore results.",
          ),
        brand: brandKitSchema.optional(),
      },
    },
    handler(async (args) => {
      const plan = (await liveAuthoringOrFallback(
        () => client.post("/api/render/creative-plan/api-key", args),
        () => ({
          schemaVersion: SCHEMA_VERSION,
          sourceOfTruth: SOURCE_OF_TRUTH,
          planLimits: DEFAULT_LIMITS,
          ...buildCreativePlan(
            {
              ...args,
              ...(args.variationMode === "consistent" ||
              args.variationSeed !== undefined
                ? {}
                : { nonce: Date.now() }),
            },
            DEFAULT_LIMITS,
          ),
        }),
      )) as Record<string, unknown>;

      const searchQueries = plan.searchQueries as
        { designTemplates?: string[]; canvasPresets?: string[] } | undefined;
      const libraryCandidates = await discoverLibraryCandidates(client, {
        brief: args.brief,
        projectType: "video",
        aspectRatio: args.aspectRatio,
        duration: args.duration,
        excludeSlugs: args.recentAssetSlugs,
        partsQueries: {
          designTemplates: searchQueries?.designTemplates,
          canvasPresets: searchQueries?.canvasPresets,
        },
        // fresh/explore rotate the leading comparable candidate per request;
        // consistent (or an explicit seed) keeps picks reproducible.
        variationSeed:
          args.variationSeed ??
          (args.variationMode === "consistent" ? undefined : Date.now()),
      }, profile).catch((error: unknown) => ({
        unavailable: true,
        error: error instanceof Error ? error.message : String(error),
        note: "Creative-library lookup failed — search_creative_library manually and adapt an example before composing from scratch.",
      }));

      return { ...plan, libraryCandidates };
    }),
  );

  server.registerTool(
    "find_matching_examples",
    {
      title: "Find matching library examples",
      description:
        'Match a brief against the ENTIRE published examples library (hundreds of professionally designed, render-ready projects) and return ranked candidates with thumbnails/previews plus a decision: "adapt-example" (strong match — call start_from_example), "adapt-or-assemble", or "assemble-similar" (compose from the returned design-template/canvas-preset/shape modules). Use this before authoring any project JSON by hand; matching runs over full metadata with category synonyms, so it finds examples the plain search_creative_library query cannot.',
      inputSchema: {
        brief: z
          .string()
          .trim()
          .min(3)
          .max(4000)
          .describe(
            "What to create, for whom, and the goal — same brief you would give plan_creative_video.",
          ),
        type: z
          .enum(["video", "image", "any"])
          .default("any")
          .describe(
            "Restrict to video examples, still-image examples, or both.",
          ),
        aspectRatio: z.enum(CREATIVE_ASPECT_RATIOS).optional(),
        duration: z
          .number()
          .positive()
          .max(86400)
          .optional()
          .describe("Target video duration in seconds (soft signal)."),
        excludeSlugs: z
          .array(z.string().trim().min(1).max(255))
          .max(20)
          .default([])
          .describe(
            "Recently used example slugs to exclude (anti-repetition).",
          ),
        excludePremium: z
          .boolean()
          .default(false)
          .describe(
            "Set true on free-plan accounts to skip premium examples (their content is plan-gated).",
          ),
        limit: z.number().int().min(1).max(24).default(8),
        includeParts: z
          .boolean()
          .optional()
          .describe(
            "Include design-template/canvas-preset/shape modules for assembly. Default: automatic (included unless a strong example match exists).",
          ),
        variationMode: z
          .enum(["consistent", "fresh"])
          .default("fresh")
          .describe(
            'fresh (default) rotates which comparable top candidate leads, so repeated identical briefs vary; "consistent" keeps ranking deterministic.',
          ),
        variationSeed: z
          .union([z.string().min(1).max(128), z.number().int()])
          .optional()
          .describe(
            "Optional reproducible seed for the rotation; omit for a new pick per request.",
          ),
      },
    },
    handler((args) =>
      discoverLibraryCandidates(client, {
        brief: args.brief,
        projectType: args.type ?? "any",
        aspectRatio: args.aspectRatio,
        duration: args.duration,
        excludeSlugs: args.excludeSlugs,
        excludePremium: args.excludePremium,
        limit: args.limit,
        includeParts: args.includeParts,
        variationSeed:
          args.variationSeed ??
          (args.variationMode === "consistent" ? undefined : Date.now()),
      }, profile),
    ),
  );

  server.registerTool(
    "render_from_example",
    {
      title: "Render an adapted library example",
      description:
        "The EASIEST premium render path: pick a library example and supply new VARIABLE VALUES (copy, media URLs, colors) — the server fetches the example, saves it as a template, dry-runs your variables, and queues the render, keeping the example's designed layout/animations fully intact. Use start_from_example first to see the variable names and defaults. Provide only declared variables; unknown names are reported. Spends credits like create_render; returns jobId + the created templateId for reuse.",
      inputSchema: {
        slug: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .describe("Library example slug to render"),
        variables: variablesSchema
          .optional()
          .describe(
            "New values for the example's declared variables (see start_from_example adaptationMap.variables). Omitted variables keep their defaults.",
          ),
        overrides: overridesSchema.optional(),
        name: z
          .string()
          .max(255)
          .optional()
          .describe("Output/job name (letters, digits, spaces, _ and - only)"),
      },
    },
    handler(async ({ slug, variables, overrides, name }) => {
      const base = `/api/library/examples/${encodeURIComponent(slug)}`;
      const item = await client.get(base);
      let payload: Record<string, unknown>;
      try {
        payload = (await client.getRedirectedJson(`${base}/content`)) as Record<
          string,
          unknown
        >;
      } catch (err) {
        if (
          err instanceof ZvidApiError &&
          (err.status === 401 || err.status === 403) &&
          err.error === "PREMIUM_REQUIRED"
        ) {
          return {
            premiumLocked: true,
            slug,
            item,
            message:
              "This example is premium — rendering it requires a paid Zvid plan. Pick a free candidate from find_matching_examples (excludePremium: true) instead.",
          };
        }
        throw err;
      }

      // Library content is editor-canonical and may carry fields the strict
      // template-create validation rejects (e.g. audios[].track) — repair
      // conservatively before saving it as a template.
      const repair = repairProject(payload);
      payload = repair.repaired as Record<string, unknown>;

      const adaptationMap = buildAdaptationMap(payload);
      const declared = new Set(adaptationMap.variables.map((v) => v.name));
      const provided = variables ?? {};
      const unknownVariables = Object.keys(provided).filter(
        (key) => !declared.has(key),
      );

      const template = (await client.post("/api/templates", {
        name: `Example ${slug} ${Date.now()}`.replace(/[^A-Za-z0-9 _-]+/g, " "),
        description: `Auto-created by render_from_example from library example "${slug}"`,
        payload,
      })) as { template?: { id?: string }; id?: string };
      const templateId = template.template?.id ?? template.id;
      if (!templateId) {
        throw new Error(
          "Template creation did not return an id — cannot continue.",
        );
      }

      const previewBody: Record<string, unknown> = {};
      if (variables !== undefined) previewBody.variables = variables;
      if (overrides !== undefined) previewBody.overrides = overrides;
      let preview: unknown;
      try {
        preview = await client.post(
          `/api/templates/${encodeURIComponent(templateId)}/preview`,
          previewBody,
        );
      } catch (err) {
        if (err instanceof ZvidApiError && err.status === 400) {
          return {
            rendered: false,
            templateId,
            slug,
            message:
              "The variable values failed the template dry run — fix them and either call render_from_example again or render the returned template directly.",
            previewErrors: err.details ?? err.message,
            declaredVariables: adaptationMap.variables,
            ...(unknownVariables.length
              ? {
                  unknownVariables,
                  unknownVariablesNote:
                    "These provided names are not declared by the example and were ignored — likely typos.",
                }
              : {}),
          };
        }
        throw err;
      }

      const renderPath =
        adaptationMap.projectType === "image"
          ? "/api/render/image/api-key"
          : "/api/render/api-key";
      const render = await client.post(renderPath, {
        template: templateId,
        ...(variables !== undefined ? { variables } : {}),
        ...(overrides !== undefined ? { overrides } : {}),
        ...(name !== undefined ? { overrides: { ...overrides, name } } : {}),
      });

      return {
        rendered: true,
        slug,
        templateId,
        projectType: adaptationMap.projectType,
        render,
        preview,
        ...(repair.changes.length ? { contentRepairs: repair.changes } : {}),
        ...(unknownVariables.length
          ? {
              unknownVariables,
              unknownVariablesNote:
                "These provided names are not declared by the example and had no effect — check for typos against adaptationMap.variables.",
            }
          : {}),
        nextSteps: [
          "Poll get_render with the returned jobId until completed.",
          `Re-render variations cheaply with create_render { template: "${templateId}", variables } — or delete_template when done with it.`,
        ],
      };
    }),
  );

  server.registerTool(
    "start_from_example",
    {
      title: "Start from a library example",
      description:
        "Fetch a library example's complete render-ready project JSON plus an ADAPTATION MAP (declared variables with defaults, text slots with current copy, media slots, scene/timing summary, fonts) and the adaptation contract. This is the premium-quality path: keep the example's layout and animations, swap copy/media/brand. When adaptationMap.recommendedWorkflow is \"template-render\" (variables/condition/iterate present), save the payload with create_template and render with variables instead of editing placeholders inline. Premium examples need a paid plan — if locked, free alternatives are suggested.",
      inputSchema: {
        slug: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .describe(
            "Example slug from find_matching_examples, plan_creative_video libraryCandidates, or search_creative_library",
          ),
      },
    },
    handler(async ({ slug }) => {
      const base = `/api/library/examples/${encodeURIComponent(slug)}`;
      const item = await client.get(base);
      let payload: Record<string, unknown>;
      try {
        payload = (await client.getRedirectedJson(`${base}/content`)) as Record<
          string,
          unknown
        >;
      } catch (err) {
        if (
          err instanceof ZvidApiError &&
          (err.status === 401 || err.status === 403) &&
          err.error === "PREMIUM_REQUIRED"
        ) {
          const meta = item as { title?: string; description?: string };
          const alternatives = await discoverLibraryCandidates(client, {
            brief:
              `${meta.title ?? ""} ${meta.description ?? ""} ${slug.replace(/-/g, " ")}`.trim(),
            projectType: "any",
            excludeSlugs: [slug],
            excludePremium: true,
            limit: 5,
            includeParts: false,
          }, profile).catch(() => null);
          return {
            premiumLocked: true,
            slug,
            item,
            message:
              err.status === 403
                ? "This example is premium — fetching its content requires a paid Zvid plan. Upgrade, or adapt one of the free alternatives below."
                : "This example is premium and the request was not recognized as authenticated — check the API key/OAuth credential; on a paid plan this fetch would succeed. Meanwhile, the free alternatives below need no plan.",
            freeAlternatives: alternatives?.examples ?? [],
          };
        }
        throw err;
      }

      // Library content is editor-canonical; strip fields the render/template
      // validation would reject so the returned payload is render-clean.
      const repair = repairProject(payload);
      payload = repair.repaired as Record<string, unknown>;

      const adaptationMap = buildAdaptationMap(payload);
      const templateRoute =
        adaptationMap.recommendedWorkflow === "template-render";
      const hasUndeclaredRefs = adaptationMap.undeclaredRefs.length > 0;
      const validationNote = templateRoute
        ? "This payload uses template features (variables/condition/iterate) that only resolve when rendered as a template — do not validate or render it as a raw payload."
        : hasUndeclaredRefs
          ? `This payload contains literal {{placeholders}} with no declared variables (${adaptationMap.undeclaredRefs.join(", ")}) — replace them with real values, then validate.`
          : undefined;
      return {
        item,
        payload,
        ...(repair.changes.length ? { contentRepairs: repair.changes } : {}),
        adaptationMap,
        adaptationContract: ADAPTATION_CONTRACT,
        ...(validationNote
          ? { validationNote }
          : { validation: validateProject(payload) }),
        nextSteps:
          profile === "creator"
            ? [
                templateRoute
                  ? "This example depends on template-only features. Materialize every variable, condition and iteration into a complete static payload; if that is not safe, choose a static candidate or assemble from library parts."
                  : "Adapt textSlots and mediaSlots in place while preserving the designed layout, animation and timing.",
                "Use search_stock_media for full-quality media URLs, validate_project_json (remote: true), fix every issue, then call create_media with the original brief and exact payload.",
              ]
            : templateRoute
              ? [
                  "Adapt through the `variables` defaults (copy, media URLs, colors); keep {{placeholder}} references and layout untouched." +
                    (hasUndeclaredRefs
                      ? ` Also replace the undeclared literal refs inline: ${adaptationMap.undeclaredRefs.join(", ")}.`
                      : ""),
                  `EASIEST: render_from_example { slug: "${slug}", variables } does the template save, dry run and render in one call. Manual equivalent: create_template, preview_template, create_render { template, variables }.`,
                ]
              : [
                  (hasUndeclaredRefs
                    ? `Replace the literal {{placeholders}} (${adaptationMap.undeclaredRefs.join(", ")}) with real values, then edit`
                    : "Edit") +
                    " textSlots/mediaSlots in place per the adaptationContract; replace media via search_stock_media (full-quality src, natural size >= the slot).",
                  'validate_project_json (remote: true), fix every error and layout warning, then create_render (or create_image_render when adaptationMap.projectType is "image").',
                ],
      };
    }),
  );

  server.registerTool(
    "search_creative_library",
    {
      title: "Search the creative library",
      description:
        "Search curated complete project examples, animated Design Studio templates, canvas motion presets, or shapes. NOTE: the server search is a plain AND-of-substrings over title/slug/description — use short single-word queries here, and prefer find_matching_examples when matching a brief to examples (it ranks the whole library with category synonyms). Inspect preview/thumbnail metadata before choosing. For fresh/explore work, exclude recent slugs returned by plan_creative_video.",
      inputSchema: {
        kind: creativeLibraryKindSchema,
        query: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe(
            "Short search text (server max 80 chars; only the first 4 whitespace-separated terms are ANDed)",
          ),
        limit: z.number().int().min(1).max(60).default(12),
        offset: z.number().int().min(0).default(0),
      },
    },
    handler(({ kind, query, limit, offset }) =>
      client.get(`/api/library/${encodeURIComponent(kind)}`, {
        q: query,
        limit,
        offset,
      }),
    ),
  );

  server.registerTool(
    "get_creative_asset",
    {
      title: "Get a creative-library asset",
      description:
        "Get metadata and, by default, the full JSON content for one creative-library item. Examples are complete projects — when you intend to ADAPT one, prefer start_from_example (it also returns an adaptation map and contract). Design templates/canvas presets/shapes are reusable modules and must be composed into a project.",
      inputSchema: {
        kind: creativeLibraryKindSchema,
        slug: z.string().trim().min(1).max(255),
        includeContent: z.boolean().default(true),
      },
    },
    handler(async ({ kind, slug, includeContent }) => {
      const base = `/api/library/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`;
      const item = await client.get(base);
      if (!includeContent) return { item };
      const content = await client.getRedirectedJson(`${base}/content`);
      return { item, content };
    }),
  );

  server.registerTool(
    "list_stock_providers",
    {
      title: "List configured stock-media providers",
      description:
        "List the stock providers currently available for image, video, GIF and audio searches.",
      inputSchema: {},
    },
    handler(() => client.get("/api/stock/providers")),
  );

  server.registerTool(
    "search_stock_media",
    {
      title: "Search stock media",
      description:
        "Search server-configured stock image, video, GIF or music providers. Results contain preview and full-quality src URLs suitable for Zvid payloads plus dimensions/duration and attribution metadata.",
      inputSchema: {
        type: z.enum(["image", "video", "gif", "audio"]),
        provider: z
          .enum(["all", "pexels", "pixabay", "unsplash", "giphy", "jamendo"])
          .default("all"),
        query: z.string().trim().max(200).default(""),
        page: z.number().int().min(1).max(500).default(1),
        perPage: z.number().int().min(1).max(60).default(12),
      },
    },
    handler((args) => client.get("/api/stock/search", args)),
  );

  server.registerTool(
    "repair_project_json",
    {
      title: "Repair project JSON",
      description:
        "Attempt conservative auto-fixes on an invalid project payload (wrong-case type, clamped numbers, format conflicts like transparent+jpg, swapped begin/end timings, unknown fields, empty/impossible elements) and explain every change. Returns the repaired payload plus its validation result — problems that need real input (e.g. missing media URLs) are left as errors.",
      inputSchema: {
        payload: z
          .record(z.unknown())
          .describe("The (possibly invalid) project JSON to repair"),
      },
    },
    handler(async ({ payload }) =>
      liveAuthoringOrFallback(
        () => client.post("/api/render/repair/api-key", { payload }),
        () => {
          const { repaired, changes, result } = repairProject(payload);
          return {
            schemaVersion: SCHEMA_VERSION,
            sourceOfTruth: SOURCE_OF_TRUTH,
            repaired,
            changes,
            valid: result.valid,
            remainingErrors: result.errors,
            warnings: result.warnings,
          };
        },
      ),
    ),
  );

  // ---- bulk renders -----------------------------------------------------------

  server.registerTool(
    "create_bulk_render",
    {
      title: "Create bulk render",
      description: `Queue N renders from one template/payload and a list of per-item variable sets (MCP safety max ${maxBulkItems}; the API and plan may impose lower limits). Validation is best-effort per item: valid items queue, invalid ones are reported in the errors array (each entry keyed by original item index). Returns bulkId + jobIds.`,
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
              name: z
                .string()
                .optional()
                .describe("Per-item output name override"),
            }),
          )
          .min(1)
          .max(maxBulkItems)
          .describe(
            "One entry per render; each item's variables merge over the base variables.",
          ),
        variables: variablesSchema
          .optional()
          .describe("Base variables applied to every item"),
        overrides: overridesSchema.optional(),
        name: z.string().optional().describe("Name for the bulk batch"),
        webhookUrl: webhookUrlSchema.optional(),
      },
    },
    handler(async ({ kind, ...body }) => {
      requireOneOf(body, "payload", "template");
      const path =
        kind === "image"
          ? "/api/render/image/bulk/api-key"
          : "/api/render/bulk/api-key";
      return client.post(path, body);
    }),
  );

  server.registerTool(
    "get_bulk_render",
    {
      title: "Get bulk render",
      description:
        "Get a bulk render batch by ID (blk_...) including its jobs' states.",
      inputSchema: {
        bulkId: z.string().describe('Bulk render ID, e.g. "blk_..."'),
      },
    },
    handler(({ bulkId }) =>
      client.get(`/api/render/bulk/${encodeURIComponent(bulkId)}`),
    ),
  );

  server.registerTool(
    "list_bulk_renders",
    {
      title: "List bulk renders",
      description: "List this account's bulk render batches.",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/render/bulk", args)),
  );

  // ---- templates ----------------------------------------------------------------

  server.registerTool(
    "list_templates",
    {
      title: "List templates",
      description:
        "List this account's render templates (id, name, description).",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/templates", args)),
  );

  server.registerTool(
    "get_template",
    {
      title: "Get template",
      description:
        "Get a template by ID including its full project JSON (inspect it to discover the variables it expects).",
      inputSchema: { templateId: templateIdSchema },
    },
    handler(({ templateId }) =>
      client.get(`/api/templates/${encodeURIComponent(templateId)}`),
    ),
  );

  server.registerTool(
    "create_template",
    {
      title: "Create template",
      description:
        "Create a reusable template from complete project JSON. Read get_project_schema first; every placeholder must have a safe default and video-template scenes need explicit durations. The backend validates the template against this account's plan before saving it. This is also the render path for adapted library examples that use variables/condition/iterate: create_template -> preview_template -> create_render { template, variables }.",
      inputSchema: {
        name: z.string().trim().min(1).max(255),
        description: z.string().max(2000).optional(),
        payload: payloadSchema,
      },
    },
    handler((body) => client.post("/api/templates", body)),
  );

  /*
   * Disabled from the MCP surface: update/delete mutations are too risky for
   * weaker models to invoke. Keep the registrations here for deliberate,
   * reviewed re-enablement later.
   *
  server.registerTool(
    "update_template",
    {
      title: "Update template",
      description:
        "Rename a template, change its description, and/or replace its project JSON. Get the current template first so fields are not accidentally lost; replacement JSON is fully validated before saving.",
      inputSchema: {
        templateId: templateIdSchema,
        name: z.string().trim().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        payload: payloadSchema.optional(),
      },
    },
    handler(({ templateId, ...body }) => {
      if (Object.keys(body).length === 0) {
        throw new Error(
          "Provide at least one of name, description, or payload",
        );
      }
      return client.put(
        `/api/templates/${encodeURIComponent(templateId)}`,
        body,
      );
    }),
  );

  server.registerTool(
    "delete_template",
    {
      title: "Archive template",
      description:
        "Archive an active template owned by this account. Archived templates cannot be rendered or updated, so call this only when the user explicitly asks to remove it.",
      inputSchema: { templateId: templateIdSchema },
    },
    handler(({ templateId }) =>
      client.delete(`/api/templates/${encodeURIComponent(templateId)}`),
    ),
  );
  */

  server.registerTool(
    "duplicate_template",
    {
      title: "Duplicate template",
      description:
        "Create an editable copy of an owned template, including archived templates. The copy is active and counts against the account's template quota.",
      inputSchema: { templateId: templateIdSchema },
    },
    handler(({ templateId }) =>
      client.post(`/api/templates/${encodeURIComponent(templateId)}/duplicate`),
    ),
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
      client.post(
        `/api/templates/${encodeURIComponent(templateId)}/preview`,
        body,
      ),
    ),
  );

  // ---- projects (editor drafts) -------------------------------------------------

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List editor draft projects saved on this account.",
      inputSchema: { ...paginationShape },
    },
    handler((args) => client.get("/api/projects", args)),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Get a draft project (prj_...) including its project JSON.",
      inputSchema: { projectId: projectIdSchema() },
    },
    handler(({ projectId }) =>
      client.get(`/api/projects/${encodeURIComponent(projectId)}`),
    ),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "Save a new editor draft project. It becomes editable at https://editor.zvid.io/?project=<id>.",
      inputSchema: {
        name: z.string().min(1).max(255),
        payload: payloadSchema,
      },
    },
    handler((body) => client.post("/api/projects", body)),
  );

  /*
   * Disabled from the MCP surface: update/delete mutations are too risky for
   * weaker models to invoke. Keep the registrations here for deliberate,
   * reviewed re-enablement later.
   *
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
    }),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Permanently delete a draft project.",
      inputSchema: { projectId: projectIdSchema() },
    },
    handler(({ projectId }) =>
      client.delete(`/api/projects/${encodeURIComponent(projectId)}`),
    ),
  );
  */

  // ---- webhooks -------------------------------------------------------------------

  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description:
        "List webhook endpoints registered on this account, plus usage vs plan limit.",
      inputSchema: {},
    },
    handler(() => client.get("/api/webhooks")),
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Register a webhook endpoint for render events. The response includes the signing secret (whsec_...) once; later get_webhook calls redact it. Deliveries are signed with HMAC-SHA256 in the X-Zvid-Signature header.",
      inputSchema: {
        url: z.string().url().describe("HTTPS endpoint to deliver events to"),
        events: z
          .array(z.enum(["render.completed", "render.failed"]))
          .min(1)
          .describe("Events to subscribe to"),
        description: z.string().max(255).optional(),
      },
    },
    handler((body) => client.post("/api/webhooks", body)),
  );

  server.registerTool(
    "get_webhook",
    {
      title: "Get webhook",
      description:
        "Get a webhook endpoint (whk_...) with its signing secret redacted, plus its status and failure state.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(async ({ webhookId }) =>
      redactSecrets(
        await client.get(`/api/webhooks/${encodeURIComponent(webhookId)}`),
      ),
    ),
  );

  /*
   * Disabled from the MCP surface: update/delete mutations are too risky for
   * weaker models to invoke. Keep the registrations here for deliberate,
   * reviewed re-enablement later.
   *
  server.registerTool(
    "update_webhook",
    {
      title: "Update webhook",
      description:
        "Update a webhook's url, events, description, or enable/disable it.",
      inputSchema: {
        webhookId: webhookIdSchema(),
        url: z.string().url().optional(),
        events: z
          .array(z.enum(["render.completed", "render.failed"]))
          .min(1)
          .optional(),
        description: z.string().max(255).optional(),
        status: z.enum(["active", "disabled"]).optional(),
      },
    },
    handler(({ webhookId, ...body }) => {
      if (Object.values(body).every((v) => v === undefined)) {
        throw new Error("Provide at least one field to update.");
      }
      return client.put(`/api/webhooks/${encodeURIComponent(webhookId)}`, body);
    }),
  );

  server.registerTool(
    "delete_webhook",
    {
      title: "Delete webhook",
      description: "Delete a webhook endpoint.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(({ webhookId }) =>
      client.delete(`/api/webhooks/${encodeURIComponent(webhookId)}`),
    ),
  );
  */

  server.registerTool(
    "test_webhook",
    {
      title: "Send test webhook",
      description: "Queue a signed test event delivery to a webhook endpoint.",
      inputSchema: { webhookId: webhookIdSchema() },
    },
    handler(({ webhookId }) =>
      client.post(`/api/webhooks/${encodeURIComponent(webhookId)}/test`),
    ),
  );

  server.registerTool(
    "list_webhook_deliveries",
    {
      title: "List webhook deliveries",
      description:
        "List recent delivery attempts for a webhook endpoint (status, attempts, response codes).",
      inputSchema: { webhookId: webhookIdSchema(), ...paginationShape },
    },
    handler(({ webhookId, ...query }) =>
      client.get(
        `/api/webhooks/${encodeURIComponent(webhookId)}/deliveries`,
        query,
      ),
    ),
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
    handler(() => client.get("/api/credits/balance")),
  );

  server.registerTool(
    "get_usage_stats",
    {
      title: "Get usage stats",
      description:
        "Get render/credit usage statistics for a timeframe (e.g. 7d, 30d, 90d).",
      inputSchema: {
        timeframe: z
          .string()
          .optional()
          .describe('Timeframe like "30d" (default)'),
      },
    },
    handler((args) => client.get("/api/credits/usage-stats", args)),
  );

  registerAgentResourcesAndPrompts(server, client, profile);

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
