import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZvidApiError, type ZvidClient } from "./client.js";
import {
  ADAPTATION_CONTRACT,
  AUTHORING_GUIDELINES,
  TEMPLATE_AUTHORING_GUIDELINES,
  TEMPLATE_ID_REGEX,
  buildAdaptationMap,
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

interface StoredTemplate {
  id: string;
  name?: string;
  description?: string;
  project?: Record<string, unknown>;
  type?: string;
  variablesSummary?: unknown;
  version?: number;
  status?: string;
}

const PROJECT_ID_RE = /^prj_[A-Za-z0-9]{20}$/;
const MAX_SAMPLE_REFERENCE_CHARS = 120_000;
const DEFAULT_MAX_RENDER_CREDITS = 120;

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

/**
 * Parameterized twin of deterministicFallbackPayload: the same safe type-led
 * design, but every replaceable value is a declared variable referenced via
 * {{name}} so the saved template stays reusable. Defaults are HTML-escaped at
 * declaration time because they land inside TEXT html.
 */
function deterministicFallbackTemplate(input: {
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
  const font =
    typeof input.brandKit?.headlineFont === "string"
      ? input.brandKit.headlineFont
      : "Inter";
  const name = sanitizeName(input.name, `${words.slice(0, 8).join(" ")} template`);
  const fontSize = Math.max(48, Math.round(height / 10));

  const variables: Record<string, unknown> = {
    brandName:
      typeof input.brandKit?.name === "string"
        ? escapeHtml(input.brandKit.name)
        : "Created with Zvid",
    headline: escapeHtml(words.slice(0, 8).join(" ")),
    message: escapeHtml(
      words.slice(8, 28).join(" ") || "A polished story, ready to share.",
    ),
    ctaText: "Discover more",
    primaryColor:
      typeof input.brandKit?.primaryColor === "string"
        ? input.brandKit.primaryColor
        : "#0b1020",
  };

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
      backgroundColor: "{{primaryColor}}",
      variables,
      visuals: [
        messageBlock("{{headline}}", "{{message}}", "rgba(15,23,42,0.88)"),
      ],
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
    backgroundColor: "{{primaryColor}}",
    variables,
    scenes: [
      {
        id: "hook",
        duration: sceneDuration,
        transition: "fade",
        transitionDuration: 0.5,
        backgroundColor: "{{primaryColor}}",
        visuals: [
          messageBlock("{{headline}}", "A story worth watching.", "#111827"),
        ],
      },
      {
        id: "story",
        duration: sceneDuration,
        transition: "fade",
        transitionDuration: 0.5,
        backgroundColor: "#111827",
        visuals: [
          messageBlock("{{message}}", "Clear. Focused. Memorable.", "#1f2937"),
        ],
      },
      {
        id: "cta",
        duration: Math.round((duration - sceneDuration * 2) * 10) / 10,
        backgroundColor: "#1e1b4b",
        visuals: [messageBlock("{{ctaText}}", "{{brandName}}", "#312e81")],
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

function templateFromResponse(response: unknown): StoredTemplate {
  const template = (response as { template?: unknown })?.template;
  if (!template || typeof template !== "object") {
    throw new Error("Zvid template API returned no template");
  }
  const stored = template as StoredTemplate;
  if (!TEMPLATE_ID_REGEX.test(String(stored.id ?? ""))) {
    throw new Error("Zvid template API returned an invalid template");
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

interface ResolvedExampleDraft {
  ok: true;
  payload: Record<string, unknown>;
  adaptationMap: ReturnType<typeof buildAdaptationMap>;
  contentRepairs: unknown;
  unknownVariables: string[];
  resolvedViaTemplate: boolean;
}

interface ResolvedExampleFailure {
  ok: false;
  previewErrors: unknown;
  declaredVariables: unknown;
  unknownVariables: string[];
}

/**
 * Turn raw library-example content into a render-clean static payload.
 * Template-only features (variables/condition/iterate) only resolve through a
 * template dry run, so those examples take a create→preview→archive round trip;
 * the temporary template never outlives the call.
 */
async function resolveExampleDraftPayload(
  client: ZvidClient,
  rawContent: Record<string, unknown>,
  slug: string,
  variables?: Record<string, unknown>,
): Promise<ResolvedExampleDraft | ResolvedExampleFailure> {
  const repair = repairProject(rawContent);
  let payload = repair.repaired as Record<string, unknown>;
  const adaptationMap = buildAdaptationMap(payload);
  const declared = new Set(adaptationMap.variables.map((v) => v.name));
  const provided = variables ?? {};
  const unknownVariables = Object.keys(provided).filter(
    (key) => !declared.has(key),
  );
  const needsTemplate =
    adaptationMap.recommendedWorkflow === "template-render" ||
    Object.keys(provided).length > 0;

  if (needsTemplate) {
    const template = (await client.post("/api/templates", {
      name: `Example ${slug} ${Date.now()}`.replace(/[^A-Za-z0-9 _-]+/g, " "),
      description: `Auto-created by create_media_from_example from library example "${slug}"`,
      payload,
    })) as { template?: { id?: string }; id?: string };
    const templateId = template.template?.id ?? template.id;
    if (!templateId) {
      throw new Error(
        "Template creation did not return an id — cannot continue.",
      );
    }
    try {
      const preview = (await client.post(
        `/api/templates/${encodeURIComponent(templateId)}/preview`,
        variables !== undefined ? { variables } : {},
      )) as { project?: unknown };
      payload = recordValue(preview.project, "Resolved example project");
    } catch (err) {
      if (err instanceof ZvidApiError && err.status === 400) {
        return {
          ok: false,
          previewErrors: err.details ?? err.message,
          declaredVariables: adaptationMap.variables,
          unknownVariables,
        };
      }
      throw err;
    } finally {
      await client
        .delete(`/api/templates/${encodeURIComponent(templateId)}`)
        .catch(() => undefined);
    }
  }

  return {
    ok: true,
    payload,
    adaptationMap,
    contentRepairs: repair.changes,
    unknownVariables,
    resolvedViaTemplate: needsTemplate,
  };
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
    /** Author a reusable template (declared `variables` + {{refs}}) instead of a static project. */
    templateMode?: boolean;
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

  const templateMode = input.templateMode === true;
  const response = await options.server.server.createMessage({
    systemPrompt: templateMode
      ? "You are Zvid's template composer. Return only one complete parameterized Zvid template project JSON object: it declares a top-level `variables` object of safe defaults and references them via {{name}} placeholders. Never include Markdown or commentary."
      : "You are Zvid's project composer. Return only one complete JSON object accepted by the Zvid renderer. Never include Markdown or commentary.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: JSON.stringify(
            {
              task: safeCorrection
                ? templateMode
                  ? "Correct the supplied template project JSON without changing the creative intent or dropping its declared variables."
                  : "Correct the supplied project JSON without changing the creative intent."
                : templateMode
                  ? "Create a polished REUSABLE Zvid template project JSON for this brief: parameterize every replaceable copy, media and brand value through declared variables."
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
                ? templateMode
                  ? "Adapt this designed reference in place. Keep its scene structure, layout, animations and timing. Keep any variables it already declares (with their {{placeholder}} references) and declare variables for every remaining replaceable copy/media/brand value."
                  : "Adapt this designed reference in place. Keep its scene structure, layout, animations and timing; replace topic copy/media/brand."
                : templateMode
                  ? "Build a scene-based template with readable composition, explicit dimensions and explicit scene durations."
                  : "Build a scene-based project with readable composition and explicit dimensions.",
              invalidPayload: safeCorrection?.payload,
              validationErrors: safeCorrection?.errors,
              authoringGuidelines: AUTHORING_GUIDELINES,
              ...(templateMode
                ? { templateAuthoringGuidelines: TEMPLATE_AUTHORING_GUIDELINES }
                : {}),
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
  let composition:
    | "provided"
    | "sampling"
    | "example-fallback"
    | "deterministic-fallback" = input.payload
    ? "provided"
    : canSample
      ? "sampling"
      : "deterministic-fallback";
  let payload = input.payload;
  if (!payload && canSample) {
    payload = await samplePayload(options, {
      ...input,
      referencePayload: context.referencePayload,
    });
  }
  if (!payload && context.referencePayload) {
    // Without sampling, the closest designed example (with its default
    // content) beats improvising a generic text card.
    const slug = String(
      (context.candidate as { slug?: unknown } | undefined)?.slug ?? "example",
    );
    const adapted = await resolveExampleDraftPayload(
      options.client,
      context.referencePayload,
      slug,
    ).catch(() => undefined);
    if (adapted?.ok) {
      payload = adapted.payload;
      composition = "example-fallback";
    }
  }
  if (!payload) payload = deterministicFallbackPayload(input);
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

interface TemplateIssue {
  field: string;
  message: string;
}

/**
 * Local template-readiness lint, run BEFORE any API call so sampling can
 * correct cheaply. Mirrors the template-only rules the render validator
 * cannot express for direct payloads: declared non-empty variables, no
 * undeclared {{references}}, and explicit scene durations for video.
 */
function templateReadinessIssues(
  payload: Record<string, unknown>,
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const variables = payload.variables;
  const declaredCount =
    variables && typeof variables === "object" && !Array.isArray(variables)
      ? Object.keys(variables).length
      : 0;
  if (declaredCount === 0) {
    issues.push({
      field: "variables",
      message:
        "A reusable template must declare a non-empty top-level `variables` object of safe defaults, referenced via {{name}} placeholders. For a one-off static draft use create_media instead.",
    });
  }
  for (const ref of buildAdaptationMap(payload).undeclaredRefs) {
    issues.push({
      field: "variables",
      message: `"{{${ref}}}" is referenced but has no declared default in \`variables\` — template validation rejects unresolved references`,
    });
  }
  if (payload.type !== "image" && Array.isArray(payload.scenes)) {
    payload.scenes.forEach((scene, index) => {
      const duration =
        scene && typeof scene === "object" && !Array.isArray(scene)
          ? (scene as Record<string, unknown>).duration
          : undefined;
      if (typeof duration !== "number" || duration <= 0) {
        issues.push({
          field: `scenes[${index}].duration`,
          message:
            "Video template scenes must declare an explicit numeric duration > 0 — template validation requires it",
        });
      }
    });
  }
  return issues;
}

/**
 * Remote validate + credit quote for a parameterized payload. The validate
 * endpoint resolves declared defaults server-side before validating, so this
 * both proves the defaults render and prices the untouched template.
 */
async function validateTemplateCandidate(
  client: ZvidClient,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; validation: ValidationQuote }
  | { ok: false; issues: TemplateIssue[] }
> {
  try {
    return { ok: true, validation: await validateAndQuote(client, payload) };
  } catch (error) {
    if (error instanceof ZvidApiError && error.status === 400) {
      const details = Array.isArray(error.details)
        ? (error.details as TemplateIssue[])
        : [{ field: "payload", message: error.message }];
      return { ok: false, issues: details };
    }
    throw error;
  }
}

async function prepareTemplatePayload(
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
  let composition:
    | "provided"
    | "sampling"
    | "example-fallback"
    | "deterministic-fallback" = input.payload
    ? "provided"
    : canSample
      ? "sampling"
      : "deterministic-fallback";
  let payload = input.payload;
  if (!payload && canSample) {
    payload = await samplePayload(options, {
      ...input,
      templateMode: true,
      referencePayload: context.referencePayload,
    });
  }
  if (!payload && context.referencePayload) {
    // Without sampling, a designed example that already declares variables is
    // a far better template than the generic type-led fallback — adopt it
    // verbatim (its defaults become the template defaults).
    const repaired = repairProject(context.referencePayload)
      .repaired as Record<string, unknown>;
    const candidate = { ...repaired, type: input.type };
    if (
      buildAdaptationMap(candidate).variables.length > 0 &&
      templateReadinessIssues(candidate).length === 0
    ) {
      payload = candidate;
      composition = "example-fallback";
    }
  }
  if (!payload) payload = deterministicFallbackTemplate(input);
  payload = { ...payload, type: input.type };
  if (input.name) payload.name = sanitizeName(input.name, "Zvid template");

  let issues = templateReadinessIssues(payload);
  let validation: ValidationQuote | undefined;
  if (!issues.length) {
    const check = await validateTemplateCandidate(options.client, payload);
    if (check.ok) validation = check.validation;
    else issues = check.issues;
  }
  if (issues.length && composition === "sampling") {
    payload = await samplePayload(options, {
      ...input,
      templateMode: true,
      referencePayload: context.referencePayload,
      correction: { payload, errors: issues },
    });
    payload = { ...payload, type: input.type };
    if (input.name) payload.name = sanitizeName(input.name, "Zvid template");
    issues = templateReadinessIssues(payload);
    if (!issues.length) {
      const check = await validateTemplateCandidate(options.client, payload);
      if (check.ok) validation = check.validation;
      else issues = check.issues;
    }
  }
  if (issues.length || !validation) {
    throw new Error(
      `Template composition failed validation: ${JSON.stringify(issues)}`,
    );
  }
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
  const templateProjectPayloadSchema = z
    .record(z.unknown())
    .describe(
      requiresAuthoredPayload
        ? "Required complete PARAMETERIZED project JSON: a top-level `variables` object of safe defaults, referenced via {{name}} placeholders in copy/media/brand fields. Build it through planning, examples or library assets (start_from_example keeps existing variables), following the templateAuthoringGuidelines from the zvid://authoring/guidelines resource. Creator never composes a template from a brief alone."
        : "Optional complete parameterized project JSON (top-level `variables` + {{name}} references). Supply it to preserve an exact authored template design.",
    );

  registerTool(
    "create_media",
    {
      title: "Create a Zvid media draft",
      description:
        requiresAuthoredPayload
          ? "Save an exact, validated project payload as a persistent video or image draft and return a signed credit quote. First use the planning, example/library, stock-media, repair and validation tools; then pass the complete payload here. When a library example matches the brief, prefer create_media_from_example { slug, variables } instead — it resolves the design server-side without this payload round trip. When the user asks for a reusable TEMPLATE with replaceable fields, use create_media_template instead — drafts saved here are static one-offs. Creator refuses brief-only composition so weak models cannot improvise a low-quality design. Draft creation does NOT spend render credits."
          : "Turn a natural-language brief or exact payload into a validated, persistent video or image draft and a signed credit quote. The brief argument is required. This does NOT spend render credits. When a library example matches the brief, prefer create_media_from_example { slug, variables } — it keeps the designed layout intact. When the user asks for a reusable TEMPLATE with replaceable fields, use create_media_template instead — drafts saved here are static one-offs.",
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
          : prepared.composition === "example-fallback"
            ? {
                qualityNotice:
                  "The connected MCP client does not support sampling, so Zvid adapted the closest matching library example with its default content. Review it in the editor, or call create_media_from_example with new variable values to put your own copy and media into the design.",
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
    "create_media_from_example",
    {
      title: "Create a draft from a library example",
      description:
        "The EASIEST approval-safe example path: pick a library example and supply new VARIABLE VALUES (copy, media URLs, brand colors). The server fetches the example, dry-runs the variables, saves the fully resolved design as a persistent draft and returns a signed credit quote — the designed layout and animations stay intact and NO credits are spent. Use start_from_example (or plan_creative_video libraryCandidates) to see variable names and defaults first. Render later with render_media once the quoted credits are approved.",
      inputSchema: {
        slug: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .describe(
            "Library example slug from plan_creative_video libraryCandidates, find_matching_examples, or search_creative_library",
          ),
        variables: z
          .record(z.unknown())
          .optional()
          .describe(
            "New values for the example's declared variables (see start_from_example adaptationMap.variables). Omitted variables keep their defaults.",
          ),
        brief: z
          .string()
          .trim()
          .max(5000)
          .optional()
          .describe(
            "The user's original media request, used for draft naming and review context.",
          ),
        name: z.string().max(255).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ slug, variables, brief, name }) => {
      const base = `/api/library/examples/${encodeURIComponent(slug)}`;
      const item = await options.client.get(base);
      let content: Record<string, unknown>;
      try {
        content = (await options.client.getRedirectedJson(
          `${base}/content`,
        )) as Record<string, unknown>;
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
              "This example is premium — adapting it requires a paid Zvid plan. Pick a free candidate from find_matching_examples (excludePremium: true) instead.",
          };
        }
        throw err;
      }

      const resolved = await resolveExampleDraftPayload(
        options.client,
        content,
        slug,
        variables,
      );
      if (!resolved.ok) {
        return {
          drafted: false,
          slug,
          message:
            "The variable values failed the template dry run — fix them and call create_media_from_example again.",
          previewErrors: resolved.previewErrors,
          declaredVariables: resolved.declaredVariables,
          ...(resolved.unknownVariables.length
            ? {
                unknownVariables: resolved.unknownVariables,
                unknownVariablesNote:
                  "These provided names are not declared by the example and were ignored — likely typos.",
              }
            : {}),
        };
      }

      let payload = resolved.payload;
      const validation = await validateAndQuote(options.client, payload);
      payload = validation.payload ?? payload;
      const meta = item as { title?: string };
      const draftName = sanitizeName(
        name,
        `${meta.title ?? slug}${brief ? ` ${brief.slice(0, 60)}` : ""} draft`,
      );
      const project = await saveProject(options.client, draftName, payload);
      const signedQuote = quoteFor(project, validation, options);
      return draftResult(project, validation, signedQuote, {
        composition: "example-adaptation",
        slug,
        selectedExample: item,
        ...(Array.isArray(resolved.contentRepairs) &&
        resolved.contentRepairs.length
          ? { contentRepairs: resolved.contentRepairs }
          : {}),
        ...(resolved.unknownVariables.length
          ? {
              unknownVariables: resolved.unknownVariables,
              unknownVariablesNote:
                "These provided names are not declared by the example and had no effect — check adaptationMap.variables from start_from_example.",
            }
          : {}),
        nextStep:
          "Review the draft in the editor. Call render_media with draftId + quoteToken only when the user approves the quoted credits.",
      });
    }),
  );

  registerTool(
    "create_media_template",
    {
      title: "Create a reusable media template",
      description:
        requiresAuthoredPayload
          ? "Save a complete PARAMETERIZED project payload as a persistent REUSABLE template (tpl_...) owned by this account. Use this whenever the user asks for a TEMPLATE, a reusable design, or replaceable fields — create_media saves only static one-off drafts. Follow the same example-first workflow as drafts: plan_creative_video, adapt the best example via start_from_example (it keeps existing variables), THEN parameterize — never compose the layout from scratch when an example matches. The payload must declare a top-level `variables` object of safe defaults referenced via {{name}} placeholders; the backend validates by rendering the defaults and rejects unresolved references and video scenes without explicit durations. Creating a template spends NO credits. Instantiate it later with create_media_from_template { templateId, variables }."
          : "Turn a natural-language brief (or exact parameterized payload) into a persistent REUSABLE template (tpl_...): a designed project that declares `variables` with safe defaults and references them via {{name}} placeholders, so every instantiation swaps copy, media and brand values without touching the layout. Use this whenever the user asks for a TEMPLATE, a reusable design, or replaceable fields — create_media saves only static one-off drafts. Brief-only calls adapt the best matching library example server-side; for an authored payload, follow the example-first workflow (plan_creative_video, start_from_example) before parameterizing. Spends NO credits. Instantiate with create_media_from_template { templateId, variables }.",
      inputSchema: {
        brief: z
          .string()
          .trim()
          .min(3)
          .max(5000)
          .describe(
            "Required. Copy or summarize the user's actual template request. Never call create_media_template without this value.",
          ),
        type: mediaTypeSchema.default("video"),
        name: z.string().max(255).optional(),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Template description shown in the dashboard."),
        aspectRatio: z
          .enum(["16:9", "9:16", "1:1", "4:5", "custom"])
          .optional(),
        duration: z.number().positive().max(3600).optional(),
        brandKit: agentBrandKitSchema.optional(),
        mediaUrls: z.array(z.string().url()).max(30).optional(),
        payload: requiresAuthoredPayload
          ? templateProjectPayloadSchema
          : templateProjectPayloadSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async (args) => {
      const prepared = await prepareTemplatePayload(options, args);
      const name = sanitizeName(
        args.name,
        `${args.brief.slice(0, 80)} template`,
      );
      const saved = await options.client.post("/api/templates", {
        name,
        description:
          args.description ??
          `Created by create_media_template from brief: ${args.brief.slice(0, 500)}`,
        payload: prepared.payload,
      });
      const template = templateFromResponse(saved);
      const declaredVariables =
        Array.isArray(template.variablesSummary) &&
        template.variablesSummary.length
          ? template.variablesSummary
          : buildAdaptationMap(prepared.payload).variables;
      return {
        kind: "template",
        templateId: template.id,
        name: template.name ?? name,
        mediaType: mediaTypeOf(template.project ?? prepared.payload),
        version: Number(template.version ?? 1),
        editorUrl: `https://editor.zvid.io/?template=${encodeURIComponent(template.id)}`,
        declaredVariables,
        estimatedCreditsWithDefaults: prepared.validation.creditsRequired,
        warnings: prepared.validation.warnings ?? [],
        composition: prepared.composition,
        ...(prepared.composition === "deterministic-fallback"
          ? {
              qualityNotice:
                "The connected MCP client does not support sampling, so Zvid created a safe type-led template with standard variables (brandName, headline, message, ctaText, primaryColor). Review it in the editor, or supply an exact parameterized payload for richer composition.",
            }
          : prepared.composition === "example-fallback"
            ? {
                qualityNotice:
                  "The connected MCP client does not support sampling, so Zvid adopted the closest matching library example — its declared variables (with the example's content as defaults) are now this template's variables. Review it in the editor, or supply an exact parameterized payload to change the design.",
              }
            : {}),
        selectedExample: prepared.candidate,
        creativePlan: prepared.plan,
        nextStep:
          "The template persists on this account; no credits were spent. Instantiate it with create_media_from_template { templateId, variables } to get an approval-gated draft and credit quote, review it in the editor via editorUrl, then render with render_media once the user approves.",
      };
    }),
  );

  registerTool(
    "create_media_from_template",
    {
      title: "Create a draft from a saved template",
      description:
        "Instantiate one of THIS account's saved templates (tpl_...): supply new values for its declared variables and the server dry-runs them, saves the fully resolved design as a persistent draft and returns a signed credit quote — the designed layout and animations stay intact and NO credits are spent. Use the create_media_template result or get_template to see declared variable names and defaults. Render with render_media once the quoted credits are approved. (For public library examples use create_media_from_example instead.)",
      inputSchema: {
        templateId: z
          .string()
          .regex(
            TEMPLATE_ID_REGEX,
            'Template IDs look like "tpl_" + 20 characters',
          ),
        variables: z
          .record(z.unknown())
          .optional()
          .describe(
            "New values for the template's declared variables. Omitted variables keep their declared defaults.",
          ),
        brief: z
          .string()
          .trim()
          .max(5000)
          .optional()
          .describe(
            "The user's original media request, used for draft naming and review context.",
          ),
        name: z.string().max(255).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    guarded(async ({ templateId, variables, brief, name }) => {
      const template = templateFromResponse(
        await options.client.get(
          `/api/templates/${encodeURIComponent(templateId)}`,
        ),
      );
      const declaredDefaults =
        template.project &&
        typeof template.project.variables === "object" &&
        template.project.variables &&
        !Array.isArray(template.project.variables)
          ? (template.project.variables as Record<string, unknown>)
          : {};
      const declared = new Set(Object.keys(declaredDefaults));
      const provided = variables ?? {};
      const unknownVariables = Object.keys(provided).filter(
        (key) => !declared.has(key),
      );

      let preview: { project?: unknown };
      try {
        preview = (await options.client.post(
          `/api/templates/${encodeURIComponent(templateId)}/preview`,
          variables !== undefined ? { variables } : {},
        )) as { project?: unknown };
      } catch (err) {
        if (err instanceof ZvidApiError && err.status === 400) {
          return {
            drafted: false,
            templateId,
            message:
              "The variable values failed the template dry run — fix them and call create_media_from_template again.",
            previewErrors: err.details ?? err.message,
            declaredVariables: template.variablesSummary ?? declaredDefaults,
            ...(unknownVariables.length
              ? {
                  unknownVariables,
                  unknownVariablesNote:
                    "These provided names are not declared by the template and were ignored — likely typos.",
                }
              : {}),
          };
        }
        throw err;
      }
      const resolved = recordValue(
        preview.project,
        "Resolved template project",
      );
      const validation = await validateAndQuote(options.client, resolved);
      const draftName = sanitizeName(
        name,
        `${template.name ?? templateId}${brief ? ` ${brief.slice(0, 60)}` : ""} draft`,
      );
      const project = await saveProject(
        options.client,
        draftName,
        validation.payload ?? resolved,
      );
      const signedQuote = quoteFor(project, validation, options);
      return draftResult(project, validation, signedQuote, {
        composition: "template-instantiation",
        templateId,
        templateVersion: Number(template.version ?? 1),
        ...(unknownVariables.length
          ? {
              unknownVariables,
              unknownVariablesNote:
                "These provided names are not declared by the template and had no effect — check declaredVariables via get_template.",
            }
          : {}),
        nextStep:
          "Review the draft in the editor. Call render_media with draftId + quoteToken only when the user approves the quoted credits.",
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
          `This render requires ${validation.creditsRequired} credits, above the MCP per-render limit of ${maxRenderCredits}. The dashboard MCP credit limit is a hard ceiling and the workflow's Max Render Credits requests within it — raise whichever is lower, then request a fresh quote.`,
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
              templateAuthoringGuidelines: TEMPLATE_AUTHORING_GUIDELINES,
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
