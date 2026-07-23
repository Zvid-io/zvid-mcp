import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZvidApiError, type ZvidClient } from "./client.js";
import {
  ADAPTATION_CONTRACT,
  AUTHORING_GUIDELINES,
  buildCreativePlan,
  repairProject,
  scoreLibraryCandidates,
  validateProject,
  type LibraryListItem,
} from "./zvidSchema.js";
import {
  hashPayload,
  idempotencyKeyForQuote,
  issueRenderQuote,
  verifyRenderQuote,
  type RenderQuote,
} from "./quote.js";
import type { ToolProfile } from "./profiles.js";

type RegisterTool = McpServer["registerTool"];

export interface AgentFacadeOptions {
  server: McpServer;
  registerTool: RegisterTool;
  client: ZvidClient;
  profile: ToolProfile;
  quoteSecret: string;
  quoteTtlSeconds?: number;
  maxRenderCredits?: number;
  now?: () => Date;
}

interface StoredProject {
  id: string;
  name?: string;
  payload: Record<string, unknown>;
  type?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ValidationQuote {
  valid?: boolean;
  creditsRequired: number;
  payload?: Record<string, unknown>;
  warnings?: unknown[];
}

const PROJECT_ID_RE = /^prj_[A-Za-z0-9]{20}$/;
const MAX_SAMPLE_REFERENCE_CHARS = 120_000;
const DEFAULT_MAX_RENDER_CREDITS = 30;

const mediaTypeSchema = z.enum(["video", "image"]);

const agentBrandKitSchema = z
  .object({
    name: z.string().max(200).optional(),
    primaryColor: z.string().max(32).optional(),
    secondaryColor: z.string().max(32).optional(),
    accentColor: z.string().max(32).optional(),
    headlineFont: z.string().max(100).optional(),
    bodyFont: z.string().max(100).optional(),
    logoUrl: z.string().url().max(2048).optional(),
    tone: z.string().max(500).optional(),
  })
  .describe("Optional brand constraints to apply consistently.");

function success(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function failure(error: unknown) {
  const body =
    error instanceof ZvidApiError
      ? {
          status: error.status,
          error: error.error,
          message: error.message,
          details: error.details,
        }
      : {
          error: "AGENT_WORKFLOW_FAILED",
          message: error instanceof Error ? error.message : String(error),
        };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
  };
}

function guarded<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return success(await fn(args));
    } catch (error) {
      return failure(error);
    }
  };
}

function sanitizeName(value: string | undefined, fallback: string): string {
  const cleaned = String(value || fallback)
    .replace(/[^A-Za-z0-9 _-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
  return cleaned || "Zvid draft";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deterministicFallbackPayload(input: {
  brief: string;
  type: "video" | "image";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "custom";
  duration?: number;
  name?: string;
  brandKit?: Record<string, unknown>;
}): Record<string, unknown> {
  const dimensions: Record<string, [number, number]> = {
    "16:9": [1280, 720],
    "9:16": [720, 1280],
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    custom: [1280, 720],
  };
  const [width, height] = dimensions[input.aspectRatio ?? "16:9"];
  const words = input.brief.trim().split(/\s+/);
  const headline = escapeHtml(words.slice(0, 8).join(" "));
  const detail = escapeHtml(
    words.slice(8, 28).join(" ") || "A polished story, ready to share.",
  );
  const primary =
    typeof input.brandKit?.primaryColor === "string"
      ? input.brandKit.primaryColor
      : "#0b1020";
  const font =
    typeof input.brandKit?.headlineFont === "string"
      ? input.brandKit.headlineFont
      : "Inter";
  const name = sanitizeName(input.name, words.slice(0, 8).join(" "));
  const fontSize = Math.max(48, Math.round(height / 10));

  const messageBlock = (
    main: string,
    supporting: string,
    backgroundColor: string,
  ) => ({
    type: "TEXT",
    html:
      `<p style="font-size:${fontSize}px;font-weight:800;margin-bottom:18px">${main}</p>` +
      `<p style="font-size:${Math.max(26, Math.round(fontSize / 2))}px;color:#cbd5e1">${supporting}</p>`,
    position: "center-center",
    width: Math.round(width * 0.82),
    height: Math.round(height * 0.48),
    style: {
      color: "#ffffff",
      backgroundColor,
      borderRadius: "32px",
      textAlign: "center",
      fontFamily: font,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    ...(input.type === "video"
      ? {
          enterAnimation: "fade",
          enterBegin: 0.2,
          enterEnd: 0.8,
        }
      : {}),
  });

  if (input.type === "image") {
    return {
      type: "image",
      name,
      width,
      height,
      outputFormat: "png",
      backgroundColor: primary,
      visuals: [messageBlock(headline, detail, "rgba(15,23,42,0.88)")],
    };
  }

  const duration = Math.min(30, Math.max(6, input.duration ?? 15));
  const sceneDuration = Math.round((duration / 3) * 10) / 10;
  return {
    type: "video",
    name,
    width,
    height,
    frameRate: 30,
    outputFormat: "mp4",
    backgroundColor: primary,
    scenes: [
      {
        id: "hook",
        duration: sceneDuration,
        transition: "fade",
        transitionDuration: 0.5,
        backgroundColor: primary,
        visuals: [messageBlock(headline, "A story worth watching.", "#111827")],
      },
      {
        id: "story",
        duration: sceneDuration,
        transition: "fade",
        transitionDuration: 0.5,
        backgroundColor: "#111827",
        visuals: [
          messageBlock(detail, "Clear. Focused. Memorable.", "#1f2937"),
        ],
      },
      {
        id: "cta",
        duration: Math.round((duration - sceneDuration * 2) * 10) / 10,
        backgroundColor: "#1e1b4b",
        visuals: [
          messageBlock(
            "Discover more",
            input.brandKit?.name
              ? escapeHtml(String(input.brandKit.name))
              : "Created with Zvid",
            "#312e81",
          ),
        ],
      },
    ],
  };
}

function mediaTypeOf(payload: Record<string, unknown>): "video" | "image" {
  return payload.type === "image" ? "image" : "video";
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} was not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function projectFromResponse(response: unknown): StoredProject {
  const project = (response as { project?: unknown })?.project;
  if (!project || typeof project !== "object") {
    throw new Error("Zvid project API returned no project");
  }
  const stored = project as StoredProject;
  if (
    !PROJECT_ID_RE.test(String(stored.id ?? "")) ||
    !stored.payload ||
    typeof stored.payload !== "object" ||
    Array.isArray(stored.payload)
  ) {
    throw new Error("Zvid project API returned an invalid project");
  }
  return stored;
}

async function getProject(
  client: ZvidClient,
  draftId: string,
): Promise<StoredProject> {
  if (!PROJECT_ID_RE.test(draftId)) {
    throw new Error('Draft IDs look like "prj_" followed by 20 characters');
  }
  return projectFromResponse(
    await client.get(`/api/projects/${encodeURIComponent(draftId)}`),
  );
}

async function validateAndQuote(
  client: ZvidClient,
  payload: Record<string, unknown>,
): Promise<ValidationQuote> {
  const response = (await client.post("/api/render/validate/api-key", {
    payload,
  })) as ValidationQuote;
  if (
    response.valid !== true ||
    !Number.isFinite(response.creditsRequired) ||
    response.creditsRequired < 0
  ) {
    throw new Error("Zvid validation did not return a valid credit estimate");
  }
  return response;
}

function quoteFor(
  project: StoredProject,
  validation: ValidationQuote,
  options: AgentFacadeOptions,
): { quote: RenderQuote; quoteToken: string } {
  const payload = validation.payload ?? project.payload;
  return issueRenderQuote(
    {
      draftId: project.id,
      payloadHash: hashPayload(payload),
      projectVersion: Number(project.version ?? 1),
      mediaType: mediaTypeOf(payload),
      estimatedCredits: validation.creditsRequired,
    },
    options.quoteSecret,
    {
      now: options.now,
      ttlSeconds: options.quoteTtlSeconds,
    },
  );
}

function extractSamplingText(response: unknown): string {
  const content = (response as { content?: unknown })?.content;
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    (content as { type?: unknown }).type === "text"
  ) {
    return String((content as { text?: unknown }).text ?? "");
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { type?: unknown }).type === "text",
      )
      .map((item) => String((item as { text?: unknown }).text ?? ""))
      .join("\n");
  }
  throw new Error("The connected agent returned no text from MCP sampling");
}

export function parseSampledPayload(text: string): Record<string, unknown> {
  const trimmed = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The connected agent did not return a JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    throw new Error(
      `The connected agent returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The connected agent must return one project JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function creativeContext(
  client: ZvidClient,
  input: {
    brief: string;
    type: "video" | "image";
    aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "custom";
    duration?: number;
    brandKit?: Record<string, unknown>;
  },
) {
  let plan: Record<string, unknown>;
  try {
    plan = (await client.post("/api/render/creative-plan/api-key", {
      brief: input.brief,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      brand: input.brandKit,
      variationMode: "fresh",
    })) as Record<string, unknown>;
  } catch {
    plan = buildCreativePlan({
      brief: input.brief,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      brand: input.brandKit,
      variationMode: "fresh",
    });
  }

  let candidate: Record<string, unknown> | undefined;
  let referencePayload: Record<string, unknown> | undefined;
  try {
    const listing = (await client.get("/api/library/examples")) as {
      items?: unknown;
    };
    const pool = Array.isArray(listing.items)
      ? (listing.items as LibraryListItem[])
      : [];
    const candidates = scoreLibraryCandidates(pool, {
      brief: input.brief,
      projectType: input.type,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      limit: 5,
    });
    for (const match of candidates) {
      try {
        const payload = await client.getRedirectedJson<Record<string, unknown>>(
          `/api/library/examples/${encodeURIComponent(match.slug)}/content`,
        );
        candidate = match as unknown as Record<string, unknown>;
        referencePayload = payload;
        break;
      } catch {
        // Premium or temporarily unavailable candidates are skipped.
      }
    }
  } catch {
    // A library outage must not prevent an explicit-payload workflow.
  }
  return { plan, candidate, referencePayload };
}

async function samplePayload(
  options: AgentFacadeOptions,
  input: {
    brief: string;
    type: "video" | "image";
    aspectRatio?: string;
    duration?: number;
    name?: string;
    brandKit?: Record<string, unknown>;
    mediaUrls?: string[];
    referencePayload?: Record<string, unknown>;
    correction?: {
      payload: Record<string, unknown>;
      errors: unknown[];
    };
  },
): Promise<Record<string, unknown>> {
  if (!options.server.server.getClientCapabilities()?.sampling) {
    throw new Error(
      "This MCP client does not support sampling. Call create_media/revise_media with an explicit payload, or use an MCP client that supports sampling.",
    );
  }

  const referenceJson = input.referencePayload
    ? JSON.stringify(input.referencePayload)
    : "";
  const safeReference =
    referenceJson.length <= MAX_SAMPLE_REFERENCE_CHARS
      ? input.referencePayload
      : undefined;
  const correctionJson = input.correction
    ? JSON.stringify(input.correction.payload)
    : "";
  const safeCorrection =
    correctionJson.length <= MAX_SAMPLE_REFERENCE_CHARS
      ? input.correction
      : undefined;

  const response = await options.server.server.createMessage({
    systemPrompt:
      "You are Zvid's project composer. Return only one complete JSON object accepted by the Zvid renderer. Never include Markdown or commentary.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: JSON.stringify(
            {
              task: safeCorrection
                ? "Correct the supplied project JSON without changing the creative intent."
                : "Create a polished Zvid project JSON for this brief.",
              requirements: {
                brief: input.brief,
                type: input.type,
                aspectRatio: input.aspectRatio,
                duration: input.duration,
                name: input.name,
                brandKit: input.brandKit,
                suppliedMediaUrls: input.mediaUrls,
              },
              referencePayload: safeReference,
              referenceRule: safeReference
                ? "Adapt this designed reference in place. Keep its scene structure, layout, animations and timing; replace topic copy/media/brand."
                : "Build a scene-based project with readable composition and explicit dimensions.",
              invalidPayload: safeCorrection?.payload,
              validationErrors: safeCorrection?.errors,
              authoringGuidelines: AUTHORING_GUIDELINES,
              adaptationContract: ADAPTATION_CONTRACT,
            },
            null,
            2,
          ),
        },
      },
    ],
    maxTokens: 16_000,
    temperature: 0.2,
  });
  return parseSampledPayload(extractSamplingText(response));
}

async function preparePayload(
  options: AgentFacadeOptions,
  input: {
    brief: string;
    type: "video" | "image";
    aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "custom";
    duration?: number;
    name?: string;
    brandKit?: Record<string, unknown>;
    mediaUrls?: string[];
    payload?: Record<string, unknown>;
  },
) {
  const context = input.payload
    ? {
        plan: buildCreativePlan({
          brief: input.brief,
          aspectRatio: input.aspectRatio,
          duration: input.duration,
          brand: input.brandKit,
          variationMode: "fresh",
        }),
        candidate: undefined,
        referencePayload: undefined,
      }
    : await creativeContext(options.client, input);
  const canSample = Boolean(
    options.server.server.getClientCapabilities()?.sampling,
  );
  let composition: "provided" | "sampling" | "deterministic-fallback" =
    input.payload
      ? "provided"
      : canSample
        ? "sampling"
        : "deterministic-fallback";
  let payload =
    input.payload ??
    (canSample
      ? await samplePayload(options, {
          ...input,
          referencePayload: context.referencePayload,
        })
      : deterministicFallbackPayload(input));
  payload = { ...payload, type: input.type };
  if (input.name) payload.name = sanitizeName(input.name, "Zvid draft");

  let local = validateProject(payload);
  if (!local.valid) {
    const repaired = repairProject(payload);
    if (repaired.result.valid) {
      payload = recordValue(repaired.repaired, "Repaired project");
      local = repaired.result;
    } else if (composition === "sampling") {
      payload = await samplePayload(options, {
        ...input,
        referencePayload: context.referencePayload,
        correction: { payload, errors: repaired.result.errors },
      });
      payload = { ...payload, type: input.type };
      local = validateProject(payload);
    }
  }
  if (!local.valid) {
    throw new Error(
      `Project composition failed validation: ${JSON.stringify(local.errors)}`,
    );
  }

  const validation = await validateAndQuote(options.client, payload);
  payload = validation.payload ?? payload;
  return {
    payload,
    validation,
    composition,
    plan: context.plan,
    candidate: context.candidate,
  };
}

async function saveProject(
  client: ZvidClient,
  name: string,
  payload: Record<string, unknown>,
): Promise<StoredProject> {
  return projectFromResponse(
    await client.post("/api/projects", { name, payload }),
  );
}

function draftResult(
  project: StoredProject,
  validation: ValidationQuote,
  signedQuote: { quote: RenderQuote; quoteToken: string },
  extra: Record<string, unknown> = {},
) {
  return {
    kind: "draft",
    draftId: project.id,
    name: project.name,
    mediaType: mediaTypeOf(project.payload),
    version: Number(project.version ?? 1),
    editorUrl: `https://editor.zvid.io/?project=${encodeURIComponent(project.id)}`,
    readyToRender: true,
    estimatedCredits: validation.creditsRequired,
    quoteExpiresAt: signedQuote.quote.expiresAt,
    quoteToken: signedQuote.quoteToken,
    warnings: validation.warnings ?? [],
    ...extra,
  };
}

export function registerAgentFacade(options: AgentFacadeOptions): void {
  const registerTool = options.registerTool;
  const maxRenderCredits =
    options.maxRenderCredits ?? DEFAULT_MAX_RENDER_CREDITS;
  const requiresAuthoredPayload = options.profile === "creator";
  const projectPayloadSchema = z
    .record(z.unknown())
    .describe(
      requiresAuthoredPayload
        ? "Required complete project JSON. Build it through planning, examples or library assets, then validate it before creating the draft. Creator never composes from a brief alone."
        : "Optional complete project JSON. Supply it to preserve an exact authored design.",
    );

  registerTool(
    "create_media",
    {
      title: "Create a Zvid media draft",
      description:
        requiresAuthoredPayload
          ? "Save an exact, validated project payload as a persistent video or image draft and return a signed credit quote. First use the planning, example/library, stock-media, repair and validation tools; then pass the complete payload here. Creator refuses brief-only composition so weak models cannot improvise a low-quality design. Draft creation does NOT spend render credits."
          : "Turn a natural-language brief or exact payload into a validated, persistent video or image draft and a signed credit quote. The brief argument is required. This does NOT spend render credits.",
      inputSchema: {
        brief: z
          .string()
          .trim()
          .min(3)
          .max(5000)
          .describe(
            "Required. Copy or summarize the user's actual media request. Never call create_media without this value.",
          ),
        type: mediaTypeSchema.default("video"),
        name: z.string().max(255).optional(),
        aspectRatio: z
          .enum(["16:9", "9:16", "1:1", "4:5", "custom"])
          .optional(),
        duration: z.number().positive().max(3600).optional(),
        brandKit: agentBrandKitSchema.optional(),
        mediaUrls: z.array(z.string().url()).max(30).optional(),
        payload: requiresAuthoredPayload
          ? projectPayloadSchema
          : projectPayloadSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async (args) => {
      const prepared = await preparePayload(options, args);
      const name = sanitizeName(
        args.name,
        `${args.brief.slice(0, 80)} ${args.type}`,
      );
      const project = await saveProject(options.client, name, prepared.payload);
      const signedQuote = quoteFor(project, prepared.validation, options);
      return draftResult(project, prepared.validation, signedQuote, {
        composition: prepared.composition,
        ...(prepared.composition === "deterministic-fallback"
          ? {
              qualityNotice:
                "The connected MCP client does not support sampling, so Zvid created a safe type-led draft. Review it in the editor or supply exact project JSON for richer composition.",
            }
          : {}),
        selectedExample: prepared.candidate,
        creativePlan: prepared.plan,
        nextStep:
          "Review the draft in the editor or call revise_media. Call render_media with draftId + quoteToken only when ready to spend the quoted credits.",
      });
    }),
  );

  registerTool(
    "revise_media",
    {
      title: "Revise a Zvid media draft",
      description:
        requiresAuthoredPayload
          ? "Create a new immutable draft revision from a complete replacement payload that you have validated. The original remains unchanged. Creator refuses instruction-only creative rewriting."
          : "Create a new immutable draft revision from an existing draft. The original remains unchanged. Describe the revision naturally when sampling is supported, or include the complete replacement payload.",
      inputSchema: {
        draftId: z.string().regex(PROJECT_ID_RE),
        instruction: z.string().trim().min(2).max(5000),
        name: z.string().max(255).optional(),
        payload: requiresAuthoredPayload
          ? projectPayloadSchema
          : projectPayloadSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    guarded(async ({ draftId, instruction, name, payload }) => {
      const source = await getProject(options.client, draftId);
      let revised = payload;
      let composition: "provided" | "sampling" = payload
        ? "provided"
        : "sampling";
      if (!revised) {
        revised = await samplePayload(options, {
          brief: instruction,
          type: mediaTypeOf(source.payload),
          name,
          referencePayload: source.payload,
        });
      }
      revised = { ...revised, type: mediaTypeOf(source.payload) };
      const local = validateProject(revised);
      if (!local.valid) {
        const repaired = repairProject(revised);
        if (!repaired.result.valid) {
          throw new Error(
            `Revised project failed validation: ${JSON.stringify(
              repaired.result.errors,
            )}`,
          );
        }
        revised = recordValue(repaired.repaired, "Repaired revision");
      }
      const validation = await validateAndQuote(options.client, revised);
      const revisionName = sanitizeName(
        name,
        `${source.name ?? "Zvid draft"} revision`,
      );
      const project = await saveProject(
        options.client,
        revisionName,
        validation.payload ?? revised,
      );
      const signedQuote = quoteFor(project, validation, options);
      return draftResult(project, validation, signedQuote, {
        composition,
        revisionOf: source.id,
        previousVersion: Number(source.version ?? 1),
        nextStep:
          "The source draft was preserved. Review this revision, revise again if needed, or call render_media with its quote.",
      });
    }),
  );

  registerTool(
    "render_media",
    {
      title: "Render an approved Zvid draft",
      description:
        "Spend credits to render exactly the quoted immutable draft. Requires the short-lived quoteToken returned by create_media, revise_media, or get_media. Revalidates payload, version, hash and credits before submission. Safe retries use an idempotencyKey.",
      inputSchema: {
        draftId: z.string().regex(PROJECT_ID_RE),
        quoteToken: z.string().min(20),
        idempotencyKey: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional caller-provided stable UUID. When omitted, Zvid derives a deterministic UUID from the signed quote so retries remain safe.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guarded(async ({ draftId, quoteToken, idempotencyKey }) => {
      const quote = verifyRenderQuote(quoteToken, options.quoteSecret, {
        now: options.now,
      });
      if (quote.draftId !== draftId) {
        throw new Error("Render quote belongs to a different draft");
      }
      const project = await getProject(options.client, draftId);
      if (Number(project.version ?? 1) !== quote.projectVersion) {
        throw new Error(
          "Draft version changed after quoting; call get_media for a new quote",
        );
      }
      const validation = await validateAndQuote(
        options.client,
        project.payload,
      );
      const resolvedPayload = validation.payload ?? project.payload;
      if (hashPayload(resolvedPayload) !== quote.payloadHash) {
        throw new Error(
          "Draft payload changed after quoting; call get_media for a new quote",
        );
      }
      if (validation.creditsRequired !== quote.estimatedCredits) {
        throw new Error(
          "Render cost changed after quoting; call get_media for a new quote",
        );
      }
      if (validation.creditsRequired > maxRenderCredits) {
        throw new Error(
          `This render requires ${validation.creditsRequired} credits, above the MCP per-render limit of ${maxRenderCredits}. Raise Maximum credits per render in the Zvid dashboard or Max Render Credits in this n8n workflow, then request a fresh quote.`,
        );
      }
      const jobId = idempotencyKey ?? idempotencyKeyForQuote(quoteToken);
      const endpoint =
        quote.mediaType === "image"
          ? "/api/render/image/api-key"
          : "/api/render/api-key";
      const render = await options.client.post(endpoint, {
        payload: resolvedPayload,
        jobId,
      });
      return {
        kind: "render",
        draftId,
        jobId,
        mediaType: quote.mediaType,
        creditsQuoted: quote.estimatedCredits,
        render,
        nextStep: `Call get_media with mediaId "${jobId}" to monitor progress.`,
      };
    }),
  );

  registerTool(
    "get_media",
    {
      title: "Get a Zvid draft or render",
      description:
        "Get one saved draft (prj_...) with a fresh signed render quote, or one render job by ID. Draft payloads are omitted unless includePayload is true.",
      inputSchema: {
        mediaId: z.string().trim().min(1),
        includePayload: z.boolean().default(false),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guarded(async ({ mediaId, includePayload }) => {
      if (!PROJECT_ID_RE.test(mediaId)) {
        return {
          kind: "render",
          render: await options.client.get(
            `/api/jobs/${encodeURIComponent(mediaId)}`,
          ),
        };
      }
      const project = await getProject(options.client, mediaId);
      const validation = await validateAndQuote(
        options.client,
        project.payload,
      );
      const signedQuote = quoteFor(project, validation, options);
      return {
        ...draftResult(project, validation, signedQuote),
        ...(includePayload
          ? { payload: validation.payload ?? project.payload }
          : {}),
      };
    }),
  );

  registerTool(
    "list_media",
    {
      title: "List Zvid media",
      description:
        "List recent saved drafts and render jobs together. Payloads are omitted.",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        type: mediaTypeSchema.optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guarded(async ({ page, limit, type }) => {
      const [drafts, renders] = await Promise.all([
        options.client.get("/api/projects", { page, limit }),
        options.client.get("/api/jobs", { page, limit, type }),
      ]);
      return { drafts, renders };
    }),
  );

  registerTool(
    "get_account",
    {
      title: "Get Zvid account summary",
      description:
        "Get credit balance and usage statistics. This never changes account data.",
      inputSchema: {
        timeframe: z.string().trim().max(20).default("30d"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guarded(async ({ timeframe }) => {
      const [credits, usage] = await Promise.all([
        options.client.get("/api/credits/balance"),
        options.client.get("/api/credits/usage-stats", { timeframe }),
      ]);
      return { credits, usage };
    }),
  );
}

export function registerAgentResourcesAndPrompts(
  server: McpServer,
  client: ZvidClient,
  profile: ToolProfile,
): void {
  server.registerResource(
    "zvid-authoring-guidelines",
    "zvid://authoring/guidelines",
    {
      title: "Zvid authoring guidelines",
      description:
        "The stable quality and adaptation rules used by the Zvid agent.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(
            {
              authoringGuidelines: AUTHORING_GUIDELINES,
              adaptationContract: ADAPTATION_CONTRACT,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "zvid-account-summary",
    "zvid://account/summary",
    {
      title: "Zvid account summary",
      description: "Current credit balance and 30-day usage.",
      mimeType: "application/json",
    },
    async (uri) => {
      const [credits, usage] = await Promise.all([
        client.get("/api/credits/balance"),
        client.get("/api/credits/usage-stats", { timeframe: "30d" }),
      ]);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ credits, usage }, null, 2),
          },
        ],
      };
    },
  );

  if (profile === "readonly") return;

  const prompt = (
    name: string,
    title: string,
    description: string,
    defaults: Record<string, unknown>,
  ) => {
    server.registerPrompt(
      name,
      {
        title,
        description,
        argsSchema: {
          brief: z.string().trim().min(3).max(5000),
          brand: z.string().max(1000).optional(),
        },
      },
      async ({ brief, brand }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Use Zvid's quality-first authoring workflow for this request. First call plan_creative_video. Prefer adapting a strong matching example with start_from_example; otherwise assemble from creative-library and stock-media results. Produce complete project JSON, validate it with validate_project_json (remote: true), fix every error and layout warning, then call create_media with both the original brief and the exact validated payload. Never call create_media from the brief alone. Do not render until I approve the quoted credits.\n` +
                JSON.stringify(
                  { ...defaults, brief, brand: brand || undefined },
                  null,
                  2,
                ),
            },
          },
        ],
      }),
    );
  };

  prompt(
    "create-product-promo",
    "Create product promo",
    "Prepare a polished product-promotion video draft.",
    { type: "video", aspectRatio: "16:9", duration: 15 },
  );
  prompt(
    "create-social-reel",
    "Create social reel",
    "Prepare a vertical social-video draft.",
    { type: "video", aspectRatio: "9:16", duration: 15 },
  );
  prompt(
    "create-thumbnail",
    "Create thumbnail",
    "Prepare a high-impact still thumbnail draft.",
    { type: "image", aspectRatio: "16:9" },
  );
  prompt(
    "create-square-post",
    "Create square post",
    "Prepare a square social-image draft.",
    { type: "image", aspectRatio: "1:1" },
  );
}
