// AUTO-GENERATED — DO NOT EDIT.
// Vendored from zvid-integrations/schema/src/zvidSchema.ts by
// `npm run sync` in zvid-integrations/schema. Edit the source there,
// then re-run the sync (backend validation in orch/middleware/validation.js
// is the ultimate source of truth).

/**
 * Zvid project schema — the integrations-side source of truth.
 *
 * Everything in this file is derived from the LIVE backend validation in
 * `orch/middleware/validation.js` (Joi) and `orch/services/renderSubmission.js`
 * (render request envelope). When public docs and this file disagree with the
 * backend, THE BACKEND WINS — update this file, never the other way around.
 *
 * Keep in lockstep with:
 *   - orch/middleware/validation.js   createProjectSchema() + helpers
 *   - orch/services/renderSubmission.js envelopeSchema / overridesSchema
 *   - orch/services/templateEngine     computeScenesTotalDuration()
 * Parity is spot-checked by schema/src/test/parity.test.ts, which runs the
 * same fixtures through the real Joi schema when orch is present on disk.
 *
 * This file is intentionally SELF-CONTAINED (no imports) so it can be
 * vendored verbatim into each integration by `schema/scripts/sync-integrations.mjs`.
 * Do not add imports.
 */

export const SCHEMA_VERSION = "1.0.0";
export const SOURCE_OF_TRUTH =
  "orch/middleware/validation.js (createProjectSchema)";

// ---------------------------------------------------------------------------
// Limits (plan-dependent). These are the "Default" tier baked into the
// legacy backend schema; the API validates against the CALLER'S plan, which
// may be tighter (Free) or looser (paid). Numbers here are guidance ceilings.
// ---------------------------------------------------------------------------

export interface PlanLimits {
  maxImagesCount: number;
  maxVideosCount: number;
  maxGifsCount: number;
  maxVisualElements: number;
  maxAudioElements: number;
  maxCaptionElements: number;
  maxDuration: number;
  maxInputResolution: number;
  maxOutputResolution: number;
  maxScenes: number;
  planName: string;
}

export const DEFAULT_LIMITS: PlanLimits = {
  maxImagesCount: 30,
  maxVideosCount: 15,
  maxGifsCount: 10,
  maxVisualElements: 200,
  maxAudioElements: 100,
  maxCaptionElements: 1000,
  maxDuration: 600,
  maxInputResolution: 3840,
  maxOutputResolution: 1920,
  maxScenes: 100,
  planName: "Default",
};

/** Free-plan limits (backend fallback tier) — the tightest tier in practice. */
export const FREE_PLAN_LIMITS: Partial<PlanLimits> = {
  maxImagesCount: 20,
  maxVideosCount: 5,
  maxGifsCount: 10,
  maxVisualElements: 50,
  maxAudioElements: 50,
  maxCaptionElements: 200,
  maxDuration: 300,
  maxInputResolution: 1920,
  maxOutputResolution: 1920,
  maxScenes: 25,
  planName: "Free",
};

// ---- hard caps that do not vary by plan ----
export const MAX_TEXT_LEN = 20_000;
export const MAX_HTML_LEN = 200_000;
export const MAX_NAME_LEN = 1000;
export const MAX_ID_LEN = 100;
export const MAX_STYLE_PROPS = 120;
export const MAX_STYLE_VALUE_LEN = 4000;
export const MAX_SVG_CHARS = 200_000;
export const MAX_SVG_DIMENSION = 4096;
export const MAX_SUBTITLE_WORD_LEN = 100;
export const MAX_SUBTITLE_TEXT_LEN = 1000;
export const MAX_FONT_SIZE = 1000;
export const MAX_OUTLINE_WIDTH = 100;
export const MAX_CUSTOM_CODE_LEN = 200_000;
export const MAX_CUSTOM_CODE_ANIMATION_DURATION = 15;
export const MAX_DESIGNER_JSON_LEN = 200_000;
export const MAX_URL_LEN = 2048;

// ---------------------------------------------------------------------------
// Enums (verbatim from the backend)
// ---------------------------------------------------------------------------

export const ELEMENT_TYPES = ["IMAGE", "VIDEO", "GIF", "SVG", "TEXT"] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const POSITION_PRESETS = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center-center",
  "center-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
  "custom",
] as const;

export const ANCHORS = POSITION_PRESETS;

export const RESIZE_MODES = ["contain", "cover"] as const;

export const RESOLUTION_PRESETS = [
  "sd",
  "hd",
  "full-hd",
  "squared",
  "youtube-short",
  "youtube-video",
  "tiktok",
  "instagram-reel",
  "instagram-post",
  "instagram-story",
  "instagram-feed",
  "twitter-landscape",
  "twitter-portrait",
  "twitter-square",
  "facebook-video",
  "facebook-story",
  "facebook-post",
  "snapchat",
  "custom",
] as const;

export const XFADE_EFFECTS = [
  "fade",
  "fadeblack",
  "fadewhite",
  "distance",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
  "circlecrop",
  "rectcrop",
  "circleclose",
  "circleopen",
  "horzclose",
  "horzopen",
  "vertclose",
  "vertopen",
  "diagbl",
  "diagbr",
  "diagtl",
  "diagtr",
  "hlslice",
  "hrslice",
  "vuslice",
  "vdslice",
  "dissolve",
  "pixelize",
  "radial",
  "hblur",
  "wipetl",
  "wipetr",
  "wipebl",
  "wipebr",
  "fadegrays",
  "zoomin",
  "hlwind",
  "hrwind",
  "squeezeh",
  "squeezev",
  "fadefast",
  "fadeslow",
  "vuwind",
  "vdwind",
  "coverleft",
  "coverright",
  "coverup",
  "coverdown",
  "revealleft",
  "revealright",
  "revealup",
  "revealdown",
] as const;

export const VIDEO_OUTPUT_FORMATS = ["mp4", "mov", "avi", "webm"] as const;
export const IMAGE_OUTPUT_FORMATS = ["png", "jpg", "jpeg", "webp"] as const;

export const SUBTITLE_ANIMATIONS = [
  "normal",
  "none",
  "one-word",
  "karaoke",
  "progressive",
  "highlight",
  "fill",
  "pop",
  "bounce",
  "fade",
  "slide",
  "typewriter",
] as const;

export const SUBTITLE_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center-center",
  "center-left",
  "center-right",
] as const;

/** v2 subtitle position additionally accepts the shorthand rows. */
export const SUBTITLE_POSITIONS_V2 = [
  ...SUBTITLE_POSITIONS,
  "top",
  "center",
  "bottom",
] as const;

export const SLIDE_DIRECTIONS = ["up", "down", "left", "right"] as const;
export const TEXT_TRANSFORMS = [
  "uppercase",
  "lowercase",
  "capitalize",
] as const;

export const WEBHOOK_EVENTS = ["render.completed", "render.failed"] as const;

// ---------------------------------------------------------------------------
// Regexes (verbatim from the backend)
// ---------------------------------------------------------------------------

export const HEX_COLOR = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export const HEX_COLOR_ALPHA = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
export const NAME_REGEX = /^[a-zA-Z0-9_\- ]+$/;
export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const TEMPLATE_ID_REGEX = /^tpl_[A-Za-z0-9]{20}$/;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const URL_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

// HTML allowed inside TEXT.html (anything else is rejected by the backend)
export const TEXT_HTML_ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "br",
  "span",
  "div",
  "p",
  "ul",
  "ol",
  "li",
  "img",
  "canvas",
  "svg",
  // svg-subtree geometry elements
  "g",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "path",
  "circle",
  "ellipse",
  "rect",
  "polygon",
  "polyline",
  "line",
] as const;

export const SVG_FORBIDDEN_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
] as const;

// customCode denylists (mirror of CUSTOM_CODE_FORBIDDEN_JS / _CSS)
const CUSTOM_CODE_FORBIDDEN_JS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bfetch\s*\(/, reason: "network access (fetch)" },
  {
    pattern: /\b(self|window|globalThis|frames|top|parent)\s*\[/,
    reason: "computed access to the global object (blocklist bypass)",
  },
  { pattern: /\bXMLHttpRequest\b/, reason: "network access (XMLHttpRequest)" },
  { pattern: /\bWebSocket\b/, reason: "network access (WebSocket)" },
  { pattern: /\bEventSource\b/, reason: "network access (EventSource)" },
  { pattern: /\bsendBeacon\b/, reason: "network access (sendBeacon)" },
  { pattern: /\bwebkitRequestFileSystem\b/, reason: "filesystem access" },
  {
    pattern: /\bshowOpenFilePicker\b|\bshowSaveFilePicker\b/,
    reason: "filesystem access",
  },
  { pattern: /\bimportScripts\b/, reason: "remote script loading" },
  { pattern: /\bimport\s*\(/, reason: "dynamic module loading" },
  { pattern: /^\s*import\b/m, reason: "module loading" },
  { pattern: /\brequire\s*\(/, reason: "module loading" },
  { pattern: /\beval\s*\(/, reason: "dynamic code execution (eval)" },
  {
    pattern: /\bnew\s+Function\b|\bFunction\s*\(/,
    reason: "dynamic code execution (Function)",
  },
  {
    pattern: /\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]/,
    reason: "dynamic code execution (string timer)",
  },
  { pattern: /\bdocument\s*\.\s*cookie\b/, reason: "cookie access" },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, reason: "storage access" },
  {
    pattern: /\bindexedDB\b|\bopenDatabase\b|\bcaches\b/,
    reason: "storage access",
  },
  { pattern: /\bserviceWorker\b/, reason: "service worker registration" },
  { pattern: /\bSharedWorker\b|\bnew\s+Worker\b/, reason: "worker creation" },
  { pattern: /\bwindow\s*\.\s*open\b/, reason: "window creation" },
  {
    pattern: /\blocation\s*(=|\.\s*(href|assign|replace|reload))/,
    reason: "navigation",
  },
  { pattern: /\bdocument\s*\.\s*write\b/, reason: "document rewriting" },
];

const CUSTOM_CODE_FORBIDDEN_CSS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /@import\b/i, reason: "external stylesheet loading (@import)" },
  {
    pattern: /\burl\(\s*['"]?\s*(?!data:)[a-z][a-z0-9+.-]*:/i,
    reason: "external resource loading (url() with a non-data: scheme)",
  },
  {
    pattern: /\burl\(\s*['"]?\s*\/\//i,
    reason: "external resource loading (protocol-relative url())",
  },
  {
    pattern: /expression\s*\(/i,
    reason: "dynamic code execution (expression)",
  },
  { pattern: /-moz-binding\b/i, reason: "script binding" },
  { pattern: /javascript\s*:/i, reason: "javascript: URL" },
  { pattern: /<\/?\s*(script|style)\b/i, reason: "HTML injection" },
];

const CSS_DANGEROUS_GLOBAL: RegExp[] = [
  /\burl\s*\(/i,
  /\b@import\b/i,
  /\bimage-set\s*\(/i,
  /\bexpression\s*\(/i,
  /\bbehavior\s*:/i,
  /\b-moz-binding\b/i,
  /\/\*/i,
];

const CSS_PROP_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const CSS_VAR_NAME = /^--[a-zA-Z0-9_-]+$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

// ---------------------------------------------------------------------------
// JSON Schema (draft 2020-12)
// ---------------------------------------------------------------------------

type JsonSchema = Record<string, unknown>;

function urlSchema(description: string): JsonSchema {
  return {
    type: "string",
    minLength: 1,
    maxLength: MAX_URL_LEN,
    pattern: "^https?://",
    description:
      description +
      " Must be a PUBLIC http(s) URL: no credentials, no spaces/backslashes, port 80/443 only, no localhost/.local, no private IPs.",
  };
}

function hexColorSchema(description: string, withAlpha = false): JsonSchema {
  return {
    type: "string",
    pattern: withAlpha ? HEX_COLOR_ALPHA.source : HEX_COLOR.source,
    description,
  };
}

function num(
  min: number | undefined,
  max: number | undefined,
  description?: string,
  extra?: JsonSchema,
): JsonSchema {
  const s: JsonSchema = { type: "number" };
  if (min !== undefined) s.minimum = min;
  if (max !== undefined) s.maximum = max;
  if (description) s.description = description;
  return { ...s, ...extra };
}

function int(
  min: number | undefined,
  max: number | undefined,
  description?: string,
  extra?: JsonSchema,
): JsonSchema {
  return { ...num(min, max, description, extra), type: "integer" };
}

/** Case-insensitive pattern for a visual `type` value (backend accepts any case). */
function ciTypePattern(t: string): string {
  return (
    "^" +
    t
      .split("")
      .map((c) => `[${c.toUpperCase()}${c.toLowerCase()}]`)
      .join("") +
    "$"
  );
}

function buildVisualBaseProperties(
  limits: PlanLimits,
): Record<string, JsonSchema> {
  return {
    x: num(
      undefined,
      limits.maxInputResolution,
      'Anchor-point X in canvas px (may be negative). ONLY used when position is "custom" — every other preset OVERWRITES x/y.',
    ),
    y: num(
      undefined,
      limits.maxInputResolution,
      'Anchor-point Y in canvas px (may be negative). ONLY used when position is "custom" — every other preset OVERWRITES x/y.',
    ),
    width: num(
      1,
      limits.maxInputResolution,
      "Element width in px (plan-limited).",
    ),
    height: num(
      1,
      limits.maxInputResolution,
      "Element height in px (plan-limited).",
    ),
    position: {
      enum: [...POSITION_PRESETS],
      description:
        'Placement preset. Sets BOTH the canvas point AND the default anchor (e.g. "bottom-center" puts the element\'s bottom edge flush with the frame bottom — no margin). x/y are IGNORED unless "custom". Two elements with the same preset render exactly stacked.',
    },
    anchor: {
      enum: [...ANCHORS],
      description:
        'Which point of the ELEMENT sits at the position point. Defaults to the position preset itself ("custom" defaults to top-left).',
    },
    resize: {
      enum: [...RESIZE_MODES],
      description:
        "How media fills its box: contain (letterbox) or cover (crop).",
    },
    enterBegin: num(
      0,
      limits.maxOutputResolution,
      "Seconds when the element starts appearing (enter animation start).",
    ),
    enterEnd: num(
      0,
      limits.maxOutputResolution,
      "Seconds when the enter animation finishes. Must be >= enterBegin.",
    ),
    exitBegin: num(
      0,
      limits.maxOutputResolution,
      "Seconds when the exit animation starts.",
    ),
    exitEnd: num(
      0,
      limits.maxOutputResolution,
      "Seconds when the element is fully gone. Must be >= exitBegin.",
    ),
    opacity: num(0, 1, "Element opacity, 0..1."),
    angle: num(-360, 360, "Rotation in degrees."),
    flipV: { type: "boolean", description: "Flip vertically." },
    flipH: { type: "boolean", description: "Flip horizontally." },
    track: int(0, 1_000_000, "Z-order track; higher tracks render on top."),
    enterAnimation: {
      anyOf: [{ enum: [...XFADE_EFFECTS] }, { type: "null" }],
      description: "Enter animation effect (xfade family) or null.",
    },
    exitAnimation: {
      anyOf: [{ enum: [...XFADE_EFFECTS] }, { type: "null" }],
      description: "Exit animation effect (xfade family) or null.",
    },
  };
}

function buildMediaSharedDefs(limits: PlanLimits): Record<string, JsonSchema> {
  return {
    cropParams: {
      type: "object",
      description: "Source crop rectangle in source-media pixels.",
      properties: {
        x: num(0, limits.maxInputResolution),
        y: num(0, limits.maxInputResolution),
        width: num(1, limits.maxInputResolution),
        height: num(1, limits.maxInputResolution),
      },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
    radius: {
      type: "object",
      description: "Rounded-corner radii in px (tl/tr/bl/br).",
      properties: {
        tl: num(0, limits.maxInputResolution),
        tr: num(0, limits.maxInputResolution),
        bl: num(0, limits.maxInputResolution),
        br: num(0, limits.maxInputResolution),
      },
      additionalProperties: false,
    },
    filter: {
      type: "object",
      description: "CSS-like color filters.",
      properties: {
        brightness: num(-100, 100),
        contrast: num(-100, 100),
        saturate: num(-100, 100),
        "hue-rotate": { type: "string", description: 'e.g. "90deg"' },
        blur: { type: "string", description: 'e.g. "4px"' },
        invert: { type: "boolean" },
        colorTint: hexColorSchema("Tint color (#rgb or #rrggbb)."),
      },
      additionalProperties: false,
    },
    chromaKey: {
      type: "object",
      description: "Green-screen keying.",
      properties: {
        color: hexColorSchema("Key color to remove (required)."),
        similarity: num(0, 100),
        blend: num(0, 100),
      },
      required: ["color"],
      additionalProperties: false,
    },
    zoom: {
      description:
        'Ken Burns zoom: true (default 1.2x depth) or { "depth": 1..10 }.',
      anyOf: [
        { type: "boolean" },
        {
          type: "object",
          properties: { depth: num(1, 10) },
          additionalProperties: false,
        },
      ],
    },
    customCode: {
      type: "object",
      description:
        "Sandboxed styling/animation code run inside the render browser (Design Studio). No network/filesystem/storage/navigation APIs — see validation notes.",
      properties: {
        css: { type: "string", maxLength: MAX_CUSTOM_CODE_LEN },
        js: { type: "string", maxLength: MAX_CUSTOM_CODE_LEN },
        animationDuration: {
          type: "number",
          exclusiveMinimum: 0,
          maximum: MAX_CUSTOM_CODE_ANIMATION_DURATION,
          description: "Seconds the customCode animation runs (max 15).",
        },
      },
      additionalProperties: false,
    },
    designer: {
      type: "object",
      description:
        "Opaque Design Studio round-trip metadata (max 200k chars serialized). Never rendered; keeps 'edit design' working.",
    },
  };
}

/**
 * Build the JSON Schema (draft 2020-12) for a Zvid project payload — the
 * object accepted as `payload` by POST /api/render[(/image)]/api-key.
 */
export function buildProjectJsonSchema(
  limits: PlanLimits = DEFAULT_LIMITS,
): JsonSchema {
  const base = buildVisualBaseProperties(limits);
  const media = buildMediaSharedDefs(limits);

  const srcRequired = urlSchema("Source media URL.");

  const imageLike = {
    src: srcRequired,
    cropParams: { $ref: "#/$defs/cropParams" },
    filter: { $ref: "#/$defs/filter" },
    chromaKey: { $ref: "#/$defs/chromaKey" },
    zoom: { $ref: "#/$defs/zoom" },
    radius: { $ref: "#/$defs/radius" },
  };

  const imageElement: JsonSchema = {
    type: "object",
    title: "IMAGE element",
    description: "A raster image placed on the canvas.",
    properties: {
      type: {
        type: "string",
        pattern: ciTypePattern("image"),
        description: '"IMAGE" (case-insensitive).',
      },
      ...base,
      ...imageLike,
    },
    required: ["type", "src"],
    additionalProperties: false,
  };

  const gifElement: JsonSchema = {
    type: "object",
    title: "GIF element",
    description: "An animated GIF placed on the canvas (video projects only).",
    properties: {
      type: {
        type: "string",
        pattern: ciTypePattern("gif"),
        description: '"GIF" (case-insensitive).',
      },
      ...base,
      ...imageLike,
    },
    required: ["type", "src"],
    additionalProperties: false,
  };

  const videoElement: JsonSchema = {
    type: "object",
    title: "VIDEO element",
    description: "A video clip placed on the canvas (video projects only).",
    properties: {
      type: {
        type: "string",
        pattern: ciTypePattern("video"),
        description: '"VIDEO" (case-insensitive).',
      },
      ...base,
      ...imageLike,
      videoBegin: num(
        0,
        limits.maxDuration,
        "Trim: source time (s) where playback starts.",
      ),
      videoEnd: num(
        0,
        limits.maxDuration,
        "Trim: source time (s) where playback ends.",
      ),
      videoDuration: num(
        0.1,
        limits.maxDuration,
        "Play only this many seconds of the source.",
      ),
      volume: num(0, 1, "Clip audio volume, 0..1."),
      speed: num(0.1, 10, "Playback speed multiplier, 0.1..10."),
      transition: {
        anyOf: [{ enum: [...XFADE_EFFECTS] }, { type: "null" }],
        description: "Transition into the linked clip (see transitionId).",
      },
      transitionDuration: num(
        0,
        limits.maxOutputResolution,
        "Transition length in seconds.",
      ),
      transitionId: {
        type: "string",
        pattern: ID_REGEX.source,
        maxLength: MAX_ID_LEN,
        description: "id of the clip this transition links to.",
      },
      frameRate: int(1, 60, "Override source frame rate (1..60)."),
      id: {
        type: "string",
        pattern: ID_REGEX.source,
        description: "Clip id (referenced by transitionId).",
      },
      hasAudio: {
        type: "boolean",
        description: "Hint that the source has an audio stream.",
      },
    },
    required: ["type", "src"],
    additionalProperties: false,
  };

  const svgElement: JsonSchema = {
    type: "object",
    title: "SVG element",
    description: "Inline SVG markup drawn on the canvas.",
    properties: {
      type: {
        type: "string",
        pattern: ciTypePattern("svg"),
        description: '"SVG" (case-insensitive).',
      },
      ...base,
      svg: {
        type: "string",
        minLength: 1,
        maxLength: MAX_SVG_CHARS,
        description:
          'Inline SVG markup starting with "<svg". Sanitized: no <script>/<foreignObject>/<iframe>/<object>/<embed>/<audio>/<video>, no on* event attributes, no external url()/href/src (only "#id" fragment refs), dimensions <= ' +
          MAX_SVG_DIMENSION +
          "px, no integers with 8+ digits.",
      },
      filter: { $ref: "#/$defs/filter" },
      chromaKey: { $ref: "#/$defs/chromaKey" },
      customCode: { $ref: "#/$defs/customCode" },
      designer: { $ref: "#/$defs/designer" },
    },
    required: ["type", "svg"],
    additionalProperties: false,
  };

  const textElement: JsonSchema = {
    type: "object",
    title: "TEXT element",
    description:
      "Styled text. Provide plain `text` (no < or > characters) and/or limited `html`. At least one of text/html must be non-empty.",
    properties: {
      type: {
        type: "string",
        pattern: ciTypePattern("text"),
        description: '"TEXT" (case-insensitive).',
      },
      ...base,
      text: {
        type: "string",
        maxLength: MAX_TEXT_LEN,
        description:
          "Plain text content. HTML markup (< or >) is rejected — use `html` for markup.",
      },
      html: {
        type: "string",
        maxLength: MAX_HTML_LEN,
        description:
          "Limited HTML. Allowed tags: " +
          TEXT_HTML_ALLOWED_TAGS.slice(0, 16).join(", ") +
          " (+ svg geometry). Allowed attributes: style, class, src, alt, width, height. No <script>/<style>, no event handlers, no external CSS url().",
      },
      style: {
        type: "object",
        maxProperties: MAX_STYLE_PROPS,
        description:
          "CSS style object applied to the text container (camelCase or kebab-case keys, and --custom-properties). LAYOUT MODEL: the container uses box-sizing: content-box, so padding/border render OUTSIDE the declared width/height and overflow gets cut — for cards/pills set the full size via width/height and center content with display:flex + alignItems:center + justifyContent:center instead of padding. Text sits at the TOP of the box unless flex-centered. Values must not contain url(), @import, expression(), comments or other dangerous tokens. Max value length " +
          MAX_STYLE_VALUE_LEN +
          " chars.",
      },
      customCode: { $ref: "#/$defs/customCode" },
      designer: { $ref: "#/$defs/designer" },
    },
    required: ["type"],
    additionalProperties: false,
  };

  const audioItem: JsonSchema = {
    type: "object",
    title: "Audio item",
    description:
      "A soundtrack / voice-over entry for `audios` (video projects only).",
    properties: {
      src: urlSchema("Audio file URL (mp3/wav/...)."),
      enter: num(
        0,
        limits.maxOutputResolution,
        "Timeline second the audio starts playing.",
      ),
      exit: num(
        0,
        limits.maxOutputResolution,
        "Timeline second the audio stops. Must be >= enter.",
      ),
      volume: num(0, 1),
      speed: num(0.1, 10),
      audioBegin: num(
        0,
        limits.maxDuration,
        "Trim: source second where playback starts.",
      ),
      audioEnd: num(
        0,
        limits.maxDuration,
        "Trim: source second where playback ends. Must be >= audioBegin.",
      ),
      audioDuration: num(
        0,
        limits.maxDuration,
        "Play only this many seconds of the source.",
      ),
    },
    additionalProperties: false,
  };

  const subtitleCaption: JsonSchema = {
    type: "object",
    properties: {
      start: num(
        0,
        limits.maxInputResolution,
        "Caption start time in seconds.",
      ),
      end: num(0, limits.maxInputResolution, "Caption end time in seconds."),
      text: { type: "string", minLength: 1, maxLength: MAX_SUBTITLE_TEXT_LEN },
      words: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            start: num(0, limits.maxInputResolution),
            end: num(0, limits.maxInputResolution),
            text: {
              type: "string",
              minLength: 1,
              maxLength: MAX_SUBTITLE_WORD_LEN,
            },
          },
          required: ["start", "end", "text"],
          additionalProperties: false,
        },
        description:
          "Per-word timings; auto-distributed from `text` when omitted.",
      },
    },
    required: ["start", "end"],
    anyOf: [{ required: ["text"] }, { required: ["words"] }],
    additionalProperties: false,
  };

  const subtitle: JsonSchema = {
    type: "object",
    title: "Subtitle",
    description:
      "Burned-in subtitles. Content: EXACTLY ONE of `src` (SRT/VTT URL) or `captions`. Style: v2 flat keys (animation/font/stroke/background/...) OR the legacy `styles` block — not both.",
    properties: {
      src: urlSchema("SRT or VTT file URL."),
      captions: {
        type: "array",
        minItems: 1,
        items: subtitleCaption,
        description: "Inline captions (plan-limited count).",
      },
      maxWordsPerLine: int(
        1,
        20,
        "Re-chunk captions to at most N words per line.",
      ),
      animation: {
        enum: [...SUBTITLE_ANIMATIONS],
        description: "Caption animation mode.",
      },
      direction: {
        enum: [...SLIDE_DIRECTIONS],
        description: 'Slide direction when animation is "slide".',
      },
      font: {
        type: "object",
        minProperties: 1,
        properties: {
          family: {
            type: "string",
            pattern: NAME_REGEX.source,
            maxLength: MAX_NAME_LEN,
          },
          size: num(1, MAX_FONT_SIZE),
          color: hexColorSchema("#rrggbb or #rrggbbaa", true),
          bold: { type: "boolean" },
          italic: { type: "boolean" },
          transform: { enum: [...TEXT_TRANSFORMS] },
        },
        additionalProperties: false,
      },
      stroke: {
        type: "object",
        properties: {
          color: hexColorSchema("#rrggbb or #rrggbbaa", true),
          width: num(0, MAX_OUTLINE_WIDTH),
        },
        required: ["color", "width"],
        additionalProperties: false,
      },
      background: {
        type: "object",
        minProperties: 1,
        properties: {
          color: hexColorSchema("#rrggbb or #rrggbbaa", true),
          opacity: num(0, 1),
          padding: num(0, 200),
          radius: num(0, 200),
        },
        additionalProperties: false,
      },
      activeWord: {
        type: "object",
        minProperties: 1,
        description: "Highlight styling for the currently spoken word.",
        properties: {
          color: hexColorSchema("#rrggbb or #rrggbbaa", true),
          background: hexColorSchema("#rrggbb or #rrggbbaa", true),
          radius: num(0, 200),
        },
        additionalProperties: false,
      },
      position: { enum: [...SUBTITLE_POSITIONS_V2] },
      margin: {
        type: "object",
        minProperties: 1,
        properties: {
          x: int(0, limits.maxOutputResolution),
          y: int(0, limits.maxOutputResolution),
        },
        additionalProperties: false,
      },
      styles: {
        type: "object",
        description:
          "LEGACY style block — prefer the flat v2 keys. Cannot be combined with them.",
        properties: {
          color: hexColorSchema("#rrggbb or #rrggbbaa", true),
          background: hexColorSchema("#rrggbb or #rrggbbaa", true),
          backgroundPadding: num(0, 200),
          backgroundRadius: num(0, 200),
          isBold: { type: "boolean" },
          isItalic: { type: "boolean" },
          fontSize: num(1, MAX_FONT_SIZE),
          fontFamily: {
            type: "string",
            pattern: NAME_REGEX.source,
            maxLength: MAX_NAME_LEN,
          },
          textTransform: { enum: [...TEXT_TRANSFORMS] },
          outline: {
            type: "object",
            properties: {
              width: num(0, MAX_OUTLINE_WIDTH),
              color: hexColorSchema("#rrggbb or #rrggbbaa", true),
            },
            required: ["width", "color"],
            additionalProperties: false,
          },
          position: { enum: [...SUBTITLE_POSITIONS] },
          marginV: int(0, limits.maxOutputResolution),
          marginH: int(0, limits.maxOutputResolution),
          mode: { enum: [...SUBTITLE_ANIMATIONS] },
          slideDirection: { enum: [...SLIDE_DIRECTIONS] },
          activeWord: {
            type: "object",
            minProperties: 1,
            properties: {
              color: hexColorSchema("#rrggbb or #rrggbbaa", true),
              background: hexColorSchema("#rrggbb or #rrggbbaa", true),
              radius: num(0, 200),
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
    oneOf: [
      { required: ["src"], not: { required: ["captions"] } },
      { required: ["captions"], not: { required: ["src"] } },
    ],
    dependentSchemas: {
      styles: {
        properties: {
          animation: false,
          direction: false,
          font: false,
          stroke: false,
          background: false,
          activeWord: false,
          position: false,
          margin: false,
        },
      },
    },
  };

  const scene: JsonSchema = {
    type: "object",
    title: "Scene",
    description:
      "A timeline segment. Scenes play sequentially; a scene's `transition` blends into the NEXT scene (xfade overlap is subtracted from the total duration).",
    properties: {
      id: { type: "string", pattern: ID_REGEX.source, maxLength: MAX_ID_LEN },
      duration: {
        description:
          "Seconds; -1 (or omitted) auto-computes from the scene's content.",
        anyOf: [{ const: -1 }, num(0.1, limits.maxDuration)],
      },
      transition: {
        anyOf: [{ enum: [...XFADE_EFFECTS] }, { type: "null" }],
        description: "Transition into the next scene.",
      },
      transitionId: {
        anyOf: [
          { type: "string", pattern: ID_REGEX.source, maxLength: MAX_ID_LEN },
          { type: "null" },
        ],
      },
      transitionDuration: num(
        0,
        60,
        "Transition overlap in seconds (default 0.5).",
      ),
      backgroundColor: hexColorSchema("Scene background (#rgb or #rrggbb)."),
      visuals: { type: "array", items: { $ref: "#/$defs/visual" } },
      audios: { type: "array", items: { $ref: "#/$defs/audioItem" } },
    },
    additionalProperties: false,
  };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://zvid.io/schemas/project.json",
    title: "Zvid project payload",
    description:
      `Zvid render project (schema v${SCHEMA_VERSION}, derived from backend validation; plan limits shown are the "${limits.planName}" tier — your plan may differ). ` +
      "Cross-field rules that JSON Schema cannot express are listed in the companion validation notes.",
    type: "object",
    properties: {
      type: {
        enum: ["video", "image"],
        default: "video",
        description:
          'Render type. "image" produces a still (png/jpg/webp) and forbids all time-domain fields.',
      },
      name: {
        type: "string",
        pattern: NAME_REGEX.source,
        maxLength: MAX_NAME_LEN,
        default: "unnamed",
        description:
          "Output name. Letters, digits, space, _ and - ONLY (no punctuation).",
      },
      resolution: {
        enum: [...RESOLUTION_PRESETS],
        description:
          'Canvas preset. Any value except "custom" OVERRIDES width/height.',
      },
      width: int(
        1,
        limits.maxOutputResolution,
        "Canvas width in px (plan-limited).",
        { default: 1280 },
      ),
      height: int(
        1,
        limits.maxOutputResolution,
        "Canvas height in px (plan-limited).",
        { default: 720 },
      ),
      duration: num(
        0.1,
        limits.maxDuration,
        "Video length in seconds (plan-limited). Ignored/auto-computed when every scene has an explicit duration.",
        { default: 10 },
      ),
      frameRate: int(1, 60, "Frames per second.", { default: 30 }),
      outputFormat: {
        type: "string",
        enum: [...VIDEO_OUTPUT_FORMATS, ...IMAGE_OUTPUT_FORMATS],
        description:
          'Videos: mp4 (default), mov, avi, webm. Images (type: "image"): png (default), jpg, jpeg, webp.',
      },
      backgroundColor: {
        ...hexColorSchema("Canvas background color."),
        default: "#ffffff",
      },
      snapshotTime: num(
        0,
        3600,
        "Image renders only: second of the (virtual) timeline to snapshot.",
      ),
      quality: int(
        1,
        100,
        "Image renders only: jpg/webp quality (NOT valid for png).",
      ),
      transparent: {
        type: "boolean",
        description:
          "Image renders only: transparent background (png/webp only, not jpg).",
      },
      visuals: {
        type: "array",
        items: { $ref: "#/$defs/visual" },
        description: "Elements shown for the whole project (outside scenes).",
      },
      audios: {
        type: "array",
        items: { $ref: "#/$defs/audioItem" },
        description:
          "Project-level audio tracks (video only, plan-limited count).",
      },
      scenes: {
        type: "array",
        maxItems: limits.maxScenes,
        items: { $ref: "#/$defs/scene" },
        description:
          "Sequential timeline segments (video only, plan-limited count).",
      },
      thumbnail: urlSchema("Custom thumbnail image URL (video only)."),
      subtitle: { $ref: "#/$defs/subtitle" },
    },
    additionalProperties: false,
    allOf: [
      {
        if: { properties: { type: { const: "image" } }, required: ["type"] },
        then: {
          properties: {
            duration: false,
            frameRate: false,
            audios: false,
            scenes: false,
            thumbnail: false,
            subtitle: false,
            outputFormat: { enum: [...IMAGE_OUTPUT_FORMATS], default: "png" },
          },
        },
        else: {
          properties: {
            snapshotTime: false,
            quality: false,
            transparent: false,
            outputFormat: { enum: [...VIDEO_OUTPUT_FORMATS], default: "mp4" },
          },
        },
      },
    ],
    $defs: {
      visual: {
        title: "Visual element",
        description:
          "One canvas element, discriminated by `type` (IMAGE | VIDEO | GIF | SVG | TEXT, case-insensitive).",
        type: "object",
        required: ["type"],
        oneOf: [
          { $ref: "#/$defs/imageElement" },
          { $ref: "#/$defs/videoElement" },
          { $ref: "#/$defs/gifElement" },
          { $ref: "#/$defs/svgElement" },
          { $ref: "#/$defs/textElement" },
        ],
      },
      imageElement,
      videoElement,
      gifElement,
      svgElement,
      textElement,
      audioItem,
      scene,
      subtitle,
      ...media,
    },
  };
}

/**
 * Build the JSON Schema for the FULL render request body accepted by
 * POST /api/render/api-key (and the /image, /validate variants):
 * either { payload } or { template, variables }, plus overrides/webhookUrl.
 */
export function buildRenderRequestJsonSchema(
  limits: PlanLimits = DEFAULT_LIMITS,
): JsonSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://zvid.io/schemas/render-request.json",
    title: "Zvid render request",
    description:
      "Body for POST /api/render/api-key (videos), /api/render/image/api-key (stills) and /api/render/validate/api-key (validation only). Provide EXACTLY ONE of `payload` or `template`.",
    type: "object",
    properties: {
      payload: {
        $ref: "https://zvid.io/schemas/project.json",
        description: "Full project JSON (see the project schema).",
      },
      template: {
        type: "string",
        pattern: TEMPLATE_ID_REGEX.source,
        description:
          'Stored template id, "tpl_" + 20 alphanumerics. Variables are resolved server-side BEFORE validation.',
      },
      variables: {
        type: "object",
        description:
          "Template variable values keyed by variable name (template renders only).",
      },
      overrides: {
        type: "object",
        description:
          'Output overrides applied on top of the payload/template. width/height force resolution to "custom".',
        properties: {
          resolution: { enum: [...RESOLUTION_PRESETS] },
          width: int(1, limits.maxOutputResolution),
          height: int(1, limits.maxOutputResolution),
          name: { type: "string", maxLength: MAX_NAME_LEN },
          outputFormat: { type: "string" },
          frameRate: int(1, 60),
          backgroundColor: { type: "string" },
          snapshotTime: num(0, undefined, "Image renders only."),
          quality: int(1, 100, "Image renders only."),
          transparent: { type: "boolean", description: "Image renders only." },
        },
        additionalProperties: false,
      },
      jobId: {
        type: "string",
        format: "uuid",
        description: "Optional idempotency/job id (UUID).",
      },
      clientKey: { type: "string" },
      webhookUrl: {
        type: "string",
        maxLength: MAX_URL_LEN,
        pattern: "^https?://",
        description:
          "Per-job webhook notified on render.completed / render.failed (HMAC-SHA256 signed).",
      },
    },
    additionalProperties: false,
    oneOf: [
      { required: ["payload"], not: { required: ["template"] } },
      { required: ["template"], not: { required: ["payload"] } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Validation notes — rules the JSON Schema cannot (fully) express
// ---------------------------------------------------------------------------

export const VALIDATION_NOTES: string[] = [
  "Plan limits: numeric ceilings (duration, canvas size, element counts, scene count, caption count, bulk size) come from the CALLER'S plan. A payload valid on a paid plan can 400 on Free. On 400 the API echoes your effective limits in `planLimits`.",
  "Timing cross-checks: enterEnd >= enterBegin and exitEnd >= exitBegin on every visual; exit >= enter and audioEnd >= audioBegin on every audio item.",
  "Element counts are summed across top-level `visuals` AND all `scenes[].visuals` (same for audios) before checking plan maxima.",
  'Image projects (type: "image") forbid: duration, frameRate, audios, scenes, thumbnail, subtitle; VIDEO/GIF elements; and per-element timing fields (enterBegin/enterEnd/exitBegin/exitEnd, videoBegin/videoEnd/videoDuration, transition/transitionId/transitionDuration).',
  "Image format rules: `transparent: true` is invalid with jpg/jpeg output; `quality` is invalid with png (jpg/webp only).",
  'If `resolution` is set to any preset except "custom", width and height are IGNORED (the preset wins).',
  "When EVERY scene has an explicit duration > 0, the total (sum minus xfade transition overlaps, default overlap 0.5s) must not exceed the plan's maxDuration; the project `duration` is then auto-set to that total.",
  "A scene's `transition` only applies when the scene is not last and `transitionId` is omitted/null/'none'/equal to the next scene's id; otherwise it's a hard cut.",
  "TEXT elements must have non-empty `text` and/or `html` (after trimming).",
  "URL fields (src, thumbnail, subtitle.src) are SSRF-checked: public http(s) only, max 2048 chars, no user:pass@, explicit ports other than 80/443 rejected, localhost/.local/.localhost and private/link-local IP literals rejected. DNS is re-checked at fetch time, so a URL that validates can still fail to download.",
  "webhookUrl gets a deeper SSRF check at delivery registration time (utils/safeUrl.js).",
  "Unknown fields are STRIPPED silently by the backend (Joi stripUnknown), not rejected. This schema sets additionalProperties: false to keep generators honest — an unknown key means the field will be IGNORED by the renderer.",
  'The HTTP layer coerces types (Joi convert: true): numeric strings like "10" are accepted for numbers. Don\'t rely on it — send real JSON numbers.',
  'SVG strings are sanitized by denylist: no script/foreignObject/iframe/object/embed/audio/video tags, no on* attributes, no external url()/href/src (only url(#id) / "#id"), no data: URIs, dimensions and viewBox <= 4096, no integers with 8 or more digits anywhere.',
  "TEXT.html is parsed and validated: only the allowed tag/attribute set survives; inline style attributes and the `style` object are scanned for url(), @import, image-set(), expression(), behavior:, -moz-binding and CSS comments — all rejected.",
  "customCode.js/.css are scanned against a denylist (network, storage, filesystem, navigation, dynamic code execution, worker creation...). customCode.animationDuration must be > 0 and <= 15 seconds.",
  "Template renders resolve variables/iterate/condition BEFORE validation; validation always runs on the resolved project. Use POST /api/templates/:id/preview (or the preview_template MCP tool) for a free dry run.",
  "Render submission reserves credits up front; validation itself (POST /api/render/validate/api-key) is free and does not enqueue anything.",
  "subtitle content: exactly one of `src` (SRT/VTT URL) or `captions`. Legacy `styles` cannot be combined with the flat v2 style keys (animation, direction, font, stroke, background, activeWord, position, margin).",
  "Project/template JSON is size-capped (resolved project must stay under 2 MB serialized).",
  "The API reports errors in stages: when top-level fields fail (e.g. duration over the plan max), element-level errors inside visuals/scenes may be withheld until the top-level problems are fixed — fix what's reported and re-validate. The local validateProject() reports everything in one pass.",
];

// ---------------------------------------------------------------------------
// Authoring guidelines — how to produce PROFESSIONAL-looking output.
// A payload can be perfectly valid and still render badly; these rules encode
// the renderer's layout model (package/src) so generators avoid the classic
// failure modes: stacked text, cut-off cards, unreadable contrast.
// ---------------------------------------------------------------------------

export const AUTHORING_GUIDELINES: string[] = [
  "START FROM THE LIBRARY: hundreds of professionally designed examples are published in the creative library — match the brief first (MCP: plan_creative_video / find_matching_examples, REST: GET /api/library/examples) and ADAPT the best one (keep layout/animations; swap copy, media, brand) instead of composing a layout from scratch. Compose from design-templates/canvas-presets/shapes only when no example is genuinely close.",
  'STRUCTURE WITH SCENES: for sequential messaging (hook → value → CTA) use `scenes`, one message per scene (2.5–5s each) with a subtle transition ("fade", transitionDuration 0.5) — NOT several timed texts stacked on one canvas. Scenes guarantee messages never collide.',
  'LAYOUT MODEL (critical): a `position` preset sets BOTH the canvas point and the element anchor, and OVERWRITES x/y. Offsets only work with position: "custom" + explicit x/y (+ anchor, default top-left). Two elements with the same preset render exactly on top of each other.',
  'EDGE MARGINS: presets are FLUSH with the frame edge ("bottom-center" touches the bottom, no margin). For breathing room use position: "custom" — e.g. a bottom CTA on a 720p canvas: { position: "custom", x: 640, y: 640, anchor: "center-center" }.',
  "ONE ELEMENT PER MESSAGE BLOCK: put a headline + subline INSIDE one TEXT element via `html` (two <p> tags styled inline) rather than two separately-positioned TEXT elements — the single block can never drift apart or overlap.",
  'CARDS / PILLS / BUTTONS: build them as ONE TEXT element — set the card size via width/height and put backgroundColor/borderRadius on `style` with display: "flex", alignItems: "center", justifyContent: "center" to center the label inside. Do NOT size cards with CSS padding (the renderer is box-sizing: content-box: padding grows the card beyond width/height and it gets cut off), and do NOT build a box in one element (SVG/IMAGE) with a separate TEXT floated on top — two-element stacks misalign.',
  "PREFER HTML OVER SVG: rectangles, pills, badges and cards should be TEXT elements with html/style (backgrounds, borderRadius, flex, gradients are all supported). Reserve SVG for genuine vector artwork (logos, icons, organic shapes) that HTML cannot express.",
  'VERTICAL CENTERING: text renders at the TOP of its box by default. Add display: "flex", alignItems: "center", justifyContent: "center" (plus textAlign: "center") to any TEXT whose box is taller than the text.',
  'CONTRAST: aim for WCAG-ish ≥ 4.5:1 between text color and what is actually behind it. Over photos/videos, first lay a scrim — a full-canvas TEXT element with html: "<div></div>" and style: { backgroundColor: "rgba(2,6,23,0.55)" } on a track between the media and the text — or put the text in a solid card. Light-blue-on-sky and white-on-white are the classic failures.',
  "TYPE SCALE: headline ≈ canvasHeight/9 px (e.g. 80px on 720p), subline ≈ half that, CTA label 28–36px. Keep any text block ≤ 80% of canvas width and ≤ 2 text elements visible at the same moment.",
  "SAFE TIMING: give enter animations 0.4–0.7s (enterEnd - enterBegin) and leave the last 0.5s of a scene animation-free so transitions don't fight element exits.",
  'FONTS: fontFamily loads from Google Fonts (default "Poppins"). Stick to 1–2 families per video; set the family on every text element for consistency.',
  "validateProject() lints these rules and returns layout warnings (overlaps, ignored x/y, off-canvas boxes, padding traps, low contrast) — treat every layout warning as a fix-before-render item.",
];

// ---------------------------------------------------------------------------
// Validator — mirrors backend verdicts with { field, message } errors
// ---------------------------------------------------------------------------

// Creative planning: template-driven, never template-only. The planner stops
// at art direction; clients still compose, validate, and render normal Zvid
// project JSON. This section stays dependency-free for MCP fallback use.

export const VARIATION_MODES = ["consistent", "fresh", "explore"] as const;
export type VariationMode = (typeof VARIATION_MODES)[number];

export const CREATIVE_ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:5",
  "custom",
] as const;
export type CreativeAspectRatio = (typeof CREATIVE_ASPECT_RATIOS)[number];

export const CREATIVE_MOTION_INTENSITIES = [
  "restrained",
  "balanced",
  "energetic",
] as const;
export type CreativeMotionIntensity =
  (typeof CREATIVE_MOTION_INTENSITIES)[number];

export interface CreativeStylePack {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  typography: string[];
  transitionFamily: string[];
  designQueries: string[];
  canvasQueries: string[];
  defaultMotion: CreativeMotionIntensity;
}

export const CREATIVE_STYLE_PACKS: CreativeStylePack[] = [
  {
    id: "adaptive-modern",
    title: "Adaptive modern",
    description:
      "Clean contemporary composition that adapts to the subject without forcing a niche visual genre.",
    keywords: [],
    typography: ["Sora", "Inter"],
    transitionFamily: ["fade", "smoothleft", "dissolve"],
    designQueries: ["gradient hero", "lower third", "quote card"],
    canvasQueries: ["gradient", "particles", "waves"],
    defaultMotion: "balanced",
  },
  {
    id: "modern-saas",
    title: "Modern SaaS",
    description:
      "Product-led layouts with UI framing, precise callouts, gradient accents and confident kinetic type.",
    keywords: [
      "saas",
      "software",
      "app",
      "platform",
      "startup",
      "developer",
      "ai",
      "technology",
    ],
    typography: ["Sora", "Inter"],
    transitionFamily: ["smoothleft", "slideleft", "fade"],
    designQueries: ["gradient hero", "terminal", "lower third"],
    canvasQueries: ["grid", "particles", "gradient"],
    defaultMotion: "balanced",
  },
  {
    id: "bold-commerce",
    title: "Bold commerce",
    description:
      "High-contrast promotional layouts with price emphasis, badges, product media and punchy CTAs.",
    keywords: [
      "sale",
      "shop",
      "store",
      "ecommerce",
      "product",
      "discount",
      "offer",
      "launch",
    ],
    typography: ["Bebas Neue", "Inter"],
    transitionFamily: ["slideleft", "circleopen", "fadefast"],
    designQueries: ["sale", "sunburst", "sticker"],
    canvasQueries: ["confetti", "rays", "burst"],
    defaultMotion: "energetic",
  },
  {
    id: "editorial-data",
    title: "Editorial data",
    description:
      "Structured information design for metrics, reports, explainers and news-style narratives.",
    keywords: [
      "data",
      "report",
      "analytics",
      "statistics",
      "finance",
      "news",
      "update",
      "results",
    ],
    typography: ["DM Sans", "Inter"],
    transitionFamily: ["fade", "wipeleft", "smoothup"],
    designQueries: ["metric", "quote", "lower third"],
    canvasQueries: ["grid", "data", "network"],
    defaultMotion: "restrained",
  },
  {
    id: "social-kinetic",
    title: "Social kinetic",
    description:
      "Fast, type-led vertical storytelling with punchy captions, rhythmic cuts and expressive motion.",
    keywords: [
      "social",
      "reel",
      "short",
      "tiktok",
      "creator",
      "viral",
      "announcement",
    ],
    typography: ["Anton", "Poppins"],
    transitionFamily: ["slideup", "zoomin", "fadefast"],
    designQueries: ["kinetic", "typewriter", "sparkle"],
    canvasQueries: ["glitch", "confetti", "hyperspace"],
    defaultMotion: "energetic",
  },
  {
    id: "luxury-minimal",
    title: "Luxury minimal",
    description:
      "Restrained premium art direction with generous whitespace, elegant typography and slow deliberate movement.",
    keywords: [
      "luxury",
      "premium",
      "elegant",
      "minimal",
      "fashion",
      "jewelry",
      "beauty",
      "hotel",
    ],
    typography: ["Playfair Display", "Inter"],
    transitionFamily: ["fade", "dissolve", "fadeslow"],
    designQueries: ["minimal", "quote card", "elegant"],
    canvasQueries: ["soft gradient", "bokeh", "light"],
    defaultMotion: "restrained",
  },
];

export interface CreativeSceneRecipe {
  role: string;
  goal: string;
  layoutPatterns: string[];
  mediaNeeds: string[];
  weight: number;
}

export const CREATIVE_SCENE_RECIPES: CreativeSceneRecipe[] = [
  {
    role: "hook-cta",
    goal: "Deliver one memorable promise and one action when only one scene is available.",
    layoutPatterns: [
      "type-led hero with integrated CTA",
      "media hero with headline card",
    ],
    mediaNeeds: ["one strong subject or product visual", "logo"],
    weight: 1,
  },
  {
    role: "hook",
    goal: "Earn attention immediately with the strongest promise, question or visual contrast.",
    layoutPatterns: [
      "type-led hero",
      "full-bleed media plus scrim",
      "asymmetric headline and subject",
    ],
    mediaNeeds: ["hero image or short video", "optional animated canvas"],
    weight: 0.9,
  },
  {
    role: "problem",
    goal: "Make the audience recognize the problem before introducing the solution.",
    layoutPatterns: [
      "split before state",
      "single pain-point statement",
      "three compact problem cards",
    ],
    mediaNeeds: ["contextual stock media", "supporting icon or shape"],
    weight: 1,
  },
  {
    role: "value",
    goal: "State the central benefit and show what changes for the viewer.",
    layoutPatterns: [
      "benefit headline plus proof line",
      "media-first value card",
      "before/after split",
    ],
    mediaNeeds: ["product or outcome visual", "one decorative design element"],
    weight: 1.15,
  },
  {
    role: "solution",
    goal: "Demonstrate how the product, service or idea solves the stated problem.",
    layoutPatterns: [
      "product screenshot with callouts",
      "three-step flow",
      "feature spotlight",
    ],
    mediaNeeds: ["product footage or screenshots", "callout shapes"],
    weight: 1.25,
  },
  {
    role: "features",
    goal: "Present a small scannable set of differentiators without turning the scene into a slide deck.",
    layoutPatterns: [
      "three-feature grid",
      "staggered cards",
      "one feature per beat",
    ],
    mediaNeeds: ["icons or shapes", "optional supporting media"],
    weight: 1.2,
  },
  {
    role: "proof",
    goal: "Add credibility through a metric, testimonial, customer result or demonstration.",
    layoutPatterns: ["large metric", "quote card", "logo or result strip"],
    mediaNeeds: ["portrait, customer logo or evidence visual"],
    weight: 1,
  },
  {
    role: "brand",
    goal: "Create an emotional brand beat before the final action.",
    layoutPatterns: [
      "logo plus positioning line",
      "visual montage",
      "minimal brand statement",
    ],
    mediaNeeds: ["logo", "brand-relevant media"],
    weight: 0.8,
  },
  {
    role: "cta",
    goal: "Close with one unambiguous action, destination and brand reminder.",
    layoutPatterns: [
      "centered CTA card",
      "product plus CTA",
      "minimal logo end card",
    ],
    mediaNeeds: ["logo", "optional product visual"],
    weight: 0.85,
  },
];

export const CREATIVE_WORKFLOW = {
  principle:
    "Template-driven, never template-only: curated work supplies design quality while the brief, storyboard, brand, media and variation seed determine the final video.",
  libraryKinds: {
    examples:
      "Complete project JSON; use only when genuinely close to the requested story.",
    "design-templates":
      "Animated Design Studio modules for titles, cards, callouts and decorative compositions.",
    "canvas-presets":
      "Responsive full-frame motion backgrounds and ambient effects.",
    shapes: "Reusable vector decoration and UI-building primitives.",
  },
  selectionPolicy: [
    "Search complete examples first with separate subject, purpose, audience and format queries.",
    "Inspect preview and thumbnail metadata; a title match alone is not enough.",
    "Exclude recently used asset slugs unless the caller explicitly requests consistency.",
    "Adapt a close example's scene structure, but replace every topic-specific visual, copy and brand token.",
  ],
  noExactMatchPolicy: [
    "Never force an unrelated full-video template.",
    "Create a storyboard from scene recipes, then assemble design modules, canvas presets, shapes and topic-specific stock media.",
    "Generate raw project JSON only after the storyboard, design system and motion direction are decided.",
  ],
  antiRepetition: [
    "Vary layout family, scene order, motion treatment, transition family, canvas treatment and media queries independently.",
    "Pass recentAssetSlugs from workflow history and exclude them for fresh or explore requests.",
    "Use variationSeed for reproducibility; omit or rotate it for new creative directions.",
    "Keep brand fonts, colors and logo stable while varying composition.",
  ],
  buildOrder: [
    "Plan narrative and scene roles.",
    "Select a style pack and variation direction.",
    "Search examples and reusable creative-library modules.",
    "Search topic-specific visual and audio media per scene.",
    "Compose complete scene-based project JSON.",
    "Validate and fix every schema error and layout warning.",
    "Render a draft, inspect representative frames, revise, then submit the final render.",
  ],
  qualityGate: [
    "Every scene has one job and one dominant focal point.",
    "Typography, color, radius, shadow and motion language stay consistent.",
    "Media is relevant to the claim rather than merely decorative.",
    "Motion supports hierarchy instead of applying a different effect everywhere.",
    "No collisions, clipping, weak contrast, dead time or competing transitions.",
    "The final CTA is readable, specific and visible long enough to act on.",
  ],
} as const;

export interface CreativePlanInput {
  brief: string;
  variationMode?: VariationMode;
  variationSeed?: string | number;
  nonce?: string | number;
  exploreCount?: number;
  aspectRatio?: CreativeAspectRatio;
  duration?: number;
  style?: string;
  motionIntensity?: CreativeMotionIntensity;
  preferredMedia?: "image" | "video" | "mixed";
  recentAssetSlugs?: string[];
  brand?: Record<string, unknown>;
}

const CREATIVE_LAYOUT_FAMILIES = [
  "media-first",
  "type-led",
  "editorial-split",
  "asymmetric-grid",
  "center-stage",
] as const;

function creativeHash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function creativeSeed(
  value: string | number | undefined,
  fallback: string,
): number {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.abs(Math.floor(value)) >>> 0;
  if (typeof value === "string" && value.trim())
    return creativeHash(value.trim());
  return creativeHash(fallback);
}

function creativeStyleIndex(brief: string): number {
  const lower = brief.toLowerCase();
  let best = 0;
  let bestScore = 0;
  CREATIVE_STYLE_PACKS.forEach((pack, index) => {
    const score = pack.keywords.reduce(
      (n, keyword) => n + (lower.includes(keyword) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

function sceneRolesForCount(count: number): string[] {
  if (count <= 1) return ["hook-cta"];
  if (count === 2) return ["hook", "cta"];
  if (count === 3) return ["hook", "value", "cta"];
  if (count === 4) return ["hook", "value", "proof", "cta"];
  if (count === 5) return ["hook", "problem", "solution", "proof", "cta"];
  if (count === 6)
    return ["hook", "problem", "solution", "features", "proof", "cta"];
  return ["hook", "problem", "solution", "features", "proof", "brand", "cta"];
}

function desiredSceneCount(duration: number): number {
  if (duration <= 8) return 2;
  if (duration <= 15) return 4;
  if (duration <= 30) return 5;
  if (duration <= 60) return 6;
  return 7;
}

const CREATIVE_STOPWORDS = new Set([
  "about", "after", "all", "and", "any", "are", "been", "before", "best",
  "big", "but", "can", "could", "create", "did", "does", "each", "for",
  "from", "get", "got", "great", "had", "has", "have", "her", "him", "his",
  "how", "into", "its", "just", "like", "make", "more", "most", "need",
  "new", "now", "off", "one", "only", "onto", "our", "out", "over", "per",
  "please", "should", "some", "such", "than", "that", "the", "their",
  "them", "then", "they", "this", "those", "top", "two", "use", "very",
  "want", "was", "way", "were", "what", "when", "where", "which", "who",
  "why", "will", "with", "would", "you", "your", "video",
]);

/**
 * Extract the subject terms of a brief: lowercased, punctuation stripped,
 * stopwords and short words removed. Used for library/stock search queries.
 */
export function briefSubjectTerms(brief: string, max = 6): string[] {
  const terms = String(brief ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !CREATIVE_STOPWORDS.has(term));
  return [...new Set(terms)].slice(0, max);
}

function creativeQueryTerms(brief: string): string[] {
  return briefSubjectTerms(brief, 6);
}

export function buildCreativePlan(
  input: CreativePlanInput,
  limits: PlanLimits = DEFAULT_LIMITS,
): Record<string, unknown> {
  const brief = String(input.brief || "").trim();
  if (!brief) throw new Error("brief is required");

  const variationMode = VARIATION_MODES.includes(
    input.variationMode as VariationMode,
  )
    ? (input.variationMode as VariationMode)
    : "fresh";
  const requestedDuration =
    Number.isFinite(input.duration) && Number(input.duration) > 0
      ? Number(input.duration)
      : 15;
  const duration = Math.min(requestedDuration, limits.maxDuration);
  const requestedSceneCount = desiredSceneCount(duration);
  const sceneCount = Math.max(
    1,
    Math.min(requestedSceneCount, limits.maxScenes),
  );
  const roles = sceneRolesForCount(sceneCount);
  const explicitPackIndex = CREATIVE_STYLE_PACKS.findIndex(
    (pack) => pack.id === input.style,
  );
  const baseStyleIndex =
    explicitPackIndex >= 0 ? explicitPackIndex : creativeStyleIndex(brief);
  const exploreCount =
    variationMode === "explore"
      ? Math.max(2, Math.min(5, Math.floor(input.exploreCount ?? 3)))
      : 1;
  const baseKey = [
    brief.toLowerCase(),
    input.aspectRatio ?? "16:9",
    duration,
    input.style ?? "auto",
  ].join("|");
  const seedFallback =
    variationMode === "consistent"
      ? baseKey
      : `${baseKey}|${String(input.nonce ?? "fresh")}`;
  const baseSeed = creativeSeed(input.variationSeed, seedFallback);
  const recentAssetSlugs = [
    ...new Set(
      (input.recentAssetSlugs ?? [])
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
  const transitionOverlap = roles.length > 1 ? 0.5 : 0;
  const sceneDurationBudget =
    duration + transitionOverlap * Math.max(0, roles.length - 1);
  const recipes = roles.map((role) =>
    CREATIVE_SCENE_RECIPES.find((recipe) => recipe.role === role)!,
  );
  const totalWeight = recipes.reduce((sum, recipe) => sum + recipe.weight, 0);
  const queryTerms = creativeQueryTerms(brief);

  const directions = Array.from({ length: exploreCount }, (_, index) => {
    const seed = (baseSeed + Math.imul(index, 2654435761)) >>> 0;
    const styleIndex =
      explicitPackIndex >= 0
        ? explicitPackIndex
        : (baseStyleIndex + index) % CREATIVE_STYLE_PACKS.length;
    const stylePack = CREATIVE_STYLE_PACKS[styleIndex];
    let allocated = 0;
    const sceneOutline = recipes.map((recipe, sceneIndex) => {
      const last = sceneIndex === recipes.length - 1;
      const targetDuration = last
        ? Math.max(0.1, Math.round((sceneDurationBudget - allocated) * 10) / 10)
        : Math.max(
            0.1,
            Math.round(
              ((sceneDurationBudget * recipe.weight) / totalWeight) * 10,
            ) / 10,
          );
      allocated += targetDuration;
      return {
        index: sceneIndex,
        role: recipe.role,
        goal: recipe.goal,
        targetDuration,
        layoutPattern:
          recipe.layoutPatterns[
            (seed + sceneIndex) % recipe.layoutPatterns.length
          ],
        mediaNeeds: recipe.mediaNeeds,
        ...(last
          ? {}
          : {
              transition:
                stylePack.transitionFamily[
                  (seed + sceneIndex) % stylePack.transitionFamily.length
                ],
              transitionDuration: transitionOverlap,
            }),
      };
    });
    return {
      id: `direction-${index + 1}`,
      seed,
      stylePack,
      layoutFamily:
        CREATIVE_LAYOUT_FAMILIES[
          (seed + index) % CREATIVE_LAYOUT_FAMILIES.length
        ],
      motionIntensity: input.motionIntensity ?? stylePack.defaultMotion,
      preferredMedia: input.preferredMedia ?? "mixed",
      sceneOutline,
    };
  });

  const warnings: string[] = [];
  if (requestedDuration > duration)
    warnings.push(
      `Requested duration ${requestedDuration}s was capped to the ${limits.planName} plan maximum of ${duration}s.`,
    );
  if (sceneCount < requestedSceneCount)
    warnings.push(
      `The storyboard was reduced from ${requestedSceneCount} to ${sceneCount} scenes for the ${limits.planName} plan.`,
    );

  return {
    creativePlanVersion: "1.0.0",
    request: {
      brief,
      variationMode,
      aspectRatio: input.aspectRatio ?? "16:9",
      duration,
      requestedStyle: input.style ?? "auto",
      recentAssetSlugs,
      brand: input.brand ?? {},
    },
    variation: {
      mode: variationMode,
      reproducible:
        variationMode === "consistent" || input.variationSeed !== undefined,
      directionCount: directions.length,
      instruction:
        variationMode === "consistent"
          ? "Reuse this seed and selected assets for stable automation output."
          : variationMode === "fresh"
            ? "Use this direction, exclude recent assets, and rotate layout, media and motion choices next time."
            : "Produce materially different storyboard and layout treatments, not recolors of one payload.",
    },
    searchQueries: {
      subjectTerms: queryTerms,
      examples: [
        queryTerms.slice(0, 3).join(" "),
        CREATIVE_STYLE_PACKS[baseStyleIndex].id.replace(/-/g, " "),
      ].filter(Boolean),
      designTemplates: CREATIVE_STYLE_PACKS[baseStyleIndex].designQueries,
      canvasPresets: CREATIVE_STYLE_PACKS[baseStyleIndex].canvasQueries,
      stockMedia: queryTerms.slice(0, 4),
    },
    exclusions: recentAssetSlugs,
    directions,
    creativeWorkflow: CREATIVE_WORKFLOW,
    nextActions: [
      "Search creative-library examples and inspect previews.",
      "If no close example exists, assemble scenes from design templates, canvas presets and shapes.",
      "Search topic-specific stock media and music for each scene.",
      "Compose scene-based project JSON with the selected direction and brand tokens.",
      "Validate, fix every error and layout warning, then render a draft before the final.",
    ],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Creative-library discovery & adaptation
//
// Pure helpers used by the MCP server (and available to every integration)
// to rank published /api/library items against a brief and to turn a chosen
// example into an adaptation worksheet. The quality premise: published
// examples carry the layout/motion design — clients adapt copy, media and
// brand tokens instead of composing layouts from scratch.
// ---------------------------------------------------------------------------

/**
 * Resolution-preset name → pixel size, mirroring package RESOLUTION_PRESETS.
 * Used only to derive an aspect ratio from a library item's meta.resolution.
 * "snapshat" is a historical package typo that older published examples carry.
 */
export const RESOLUTION_PRESET_DIMENSIONS: Record<
  string,
  readonly [number, number]
> = {
  sd: [640, 480],
  hd: [1280, 720],
  "full-hd": [1920, 1080],
  squared: [1080, 1080],
  "youtube-short": [1080, 1920],
  "youtube-video": [1920, 1080],
  tiktok: [1080, 1920],
  "instagram-reel": [1080, 1920],
  "instagram-post": [1080, 1080],
  "instagram-story": [1080, 1920],
  "instagram-feed": [1080, 1080],
  "twitter-landscape": [1200, 675],
  "twitter-portrait": [1080, 1350],
  "twitter-square": [1080, 1080],
  "facebook-video": [1080, 1920],
  "facebook-story": [1080, 1920],
  "facebook-post": [1080, 1080],
  snapchat: [1080, 1920],
  snapshat: [1080, 1920],
};

/**
 * Library-example category (meta.pack) → topic/industry synonyms, so a brief
 * mentioning "restaurant" surfaces the local pack even though no example title
 * contains the word. Mirrors editor/data/exampleCategories.ts keywords.
 */
export const EXAMPLE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  thumbnail: ["thumbnail", "thumbnails", "cover", "youtube", "poster", "clickbait", "hook", "preview", "cover image", "video cover", "og"],
  ecommerce: ["ecommerce", "e-commerce", "shop", "store", "product", "retail", "dtc", "dropshipping", "sale", "discount", "promo", "checkout", "brand", "online store", "shopify"],
  agency: ["ad", "ads", "advert", "advertising", "creative", "marketing", "campaign", "ugc", "performance", "roas", "agency", "a/b test"],
  realty: ["property", "listing", "home", "house", "apartment", "realtor", "realty", "mortgage", "rent", "agent", "open house", "estate"],
  auto: ["car", "cars", "vehicle", "dealer", "dealership", "automotive", "motor", "suv", "ev", "test drive", "trade-in", "auto"],
  saas: ["software", "app", "saas", "developer", "api", "product", "startup", "tech", "b2b", "changelog", "feature", "onboarding", "integration"],
  ogimage: ["open graph", "og image", "og", "blog", "article", "link preview", "social share", "meta", "docs", "changelog", "seo", "twitter card"],
  ai: ["ai", "artificial intelligence", "ml", "machine learning", "llm", "model", "prompt", "gpt", "agent", "genai", "automation", "neural"],
  social: ["creator", "influencer", "social", "tiktok", "reels", "reel", "instagram", "youtube", "content", "podcast", "follower", "thread", "meme"],
  news: ["news", "rss", "media", "headline", "breaking", "journalism", "press", "bulletin", "report", "article"],
  finance: ["finance", "investment", "invest", "crypto", "bitcoin", "trading", "stocks", "fintech", "money", "bank", "portfolio", "market"],
  hr: ["hr", "recruiting", "recruit", "hiring", "jobs", "job", "career", "talent", "employee", "onboarding", "workplace", "vacancy"],
  events: ["event", "events", "webinar", "conference", "summit", "meetup", "workshop", "ticket", "rsvp", "speaker", "agenda", "expo"],
  edtech: ["education", "edtech", "course", "learn", "learning", "school", "tutorial", "lesson", "quiz", "student", "teach", "exam"],
  travel: ["travel", "hotel", "tourism", "trip", "vacation", "flight", "destination", "booking", "resort", "holiday", "tour", "getaway"],
  local: ["restaurant", "food", "cafe", "café", "menu", "dish", "dining", "delivery", "chef", "coffee", "bar", "eatery", "meal"],
  fitness: ["fitness", "wellness", "gym", "workout", "health", "yoga", "nutrition", "trainer", "exercise", "coach", "diet", "training"],
  apppersonal: ["app", "personalized", "personalization", "retention", "engagement", "notification", "milestone", "streak", "wrapped", "recap", "reminder"],
  dataviz: ["dataviz", "data", "visualization", "chart", "graph", "report", "dashboard", "analytics", "metrics", "kpi", "stats", "infographic", "insights"],
  sports: ["sports", "sport", "match", "game", "team", "score", "fixture", "league", "athlete", "tournament", "player", "result"],
  localservice: ["local service", "plumber", "salon", "cleaning", "contractor", "repair", "handyman", "appointment", "booking", "trades", "service", "electrician"],
  marketplace: ["marketplace", "classified", "classifieds", "listing", "listings", "seller", "buyer", "secondhand", "rental", "gig", "peer-to-peer"],
  hotel: ["hotel", "hospitality", "resort", "room", "guest", "booking", "spa", "check-in", "checkout", "concierge", "suite", "stay"],
  health: ["healthcare", "clinic", "doctor", "medical", "patient", "appointment", "dental", "dentist", "pharmacy", "telehealth", "hospital", "checkup"],
  beauty: ["beauty", "salon", "spa", "hair", "nails", "skincare", "makeup", "stylist", "barber", "treatment", "manicure", "facial"],
  recipe: ["recipe", "recipes", "cooking", "ingredients", "baking", "meal prep", "kitchen", "dish", "cuisine", "nutrition", "vegetarian", "chef"],
  language: ["language", "vocabulary", "grammar", "translation", "word of the day", "phrase", "idiom", "pronunciation", "bilingual", "learn english"],
  books: ["book", "books", "author", "publishing", "reading", "novel", "ebook", "audiobook", "bestseller", "bookclub", "library", "literature"],
  music: ["music", "song", "album", "artist", "concert", "playlist", "dj", "festival", "streaming", "track", "band", "tour"],
  podcast: ["podcast", "episode", "guest", "audiogram", "show", "listener", "season", "clip", "interview", "host", "subscribe"],
  gaming: ["gaming", "game", "esports", "stream", "streamer", "tournament", "twitch", "leaderboard", "clan", "patch", "giveaway", "gamer"],
  construction: ["construction", "architecture", "renovation", "contractor", "builder", "interior design", "floor plan", "development", "engineering", "remodel"],
  legal: ["legal", "law", "lawyer", "attorney", "firm", "consultation", "contract", "immigration", "tax", "compliance", "notary", "court"],
  insurance: ["insurance", "policy", "coverage", "claim", "premium", "renewal", "broker", "insurer", "deductible", "quote", "protection"],
  logistics: ["logistics", "delivery", "shipping", "courier", "tracking", "parcel", "package", "freight", "warehouse", "fleet", "customs", "shipment"],
  industrial: ["manufacturing", "industrial", "factory", "production", "machinery", "quality control", "supplier", "plant", "engineering", "b2b"],
  agriculture: ["agriculture", "farming", "farm", "crop", "harvest", "livestock", "organic", "produce", "tractor", "irrigation", "agri", "farmer"],
  nonprofit: ["nonprofit", "charity", "donation", "fundraising", "volunteer", "ngo", "cause", "impact", "donor", "campaign", "giving", "foundation"],
  government: ["government", "public", "municipality", "city", "civic", "permit", "election", "announcement", "road closure", "utility", "citizen"],
  community: ["community", "religious", "faith", "mosque", "church", "prayer", "gathering", "congregation", "charity", "youth", "volunteer"],
  weddings: ["wedding", "weddings", "celebration", "invitation", "save the date", "anniversary", "birthday", "baby shower", "graduation", "party", "rsvp"],
  adpromo: ["commercial", "promo", "ad", "ads", "sale", "flash sale", "discount", "funny", "retro", "80s", "mascot", "offer", "advert", "campaign"],
  explainer: ["explainer", "explain", "how it works", "how to", "tutorial", "walkthrough", "steps", "character", "mascot", "service", "process"],
  infographic: ["infographic", "infographics", "stats", "statistics", "data", "chart", "graph", "numbers", "facts", "percent", "animated"],
  birthday: ["birthday", "bday", "cake", "celebration", "greetings", "party", "balloons", "wishes", "staff birthday", "team birthday"],
  welcome: ["welcome", "intro", "introduction", "new hire", "new employee", "meet the team", "team", "teammate", "introduce", "aboard"],
  recruiting: ["hiring", "we're hiring", "job", "job ad", "recruiting", "recruitment", "vacancy", "career", "resume", "cv", "apply", "talent", "job offer"],
  praise: ["praise", "thanks", "thank you", "kudos", "shout-out", "recognition", "great job", "you rock", "employee of the month", "appreciation"],
  updates: ["update", "weekly", "monthly", "quarterly", "results", "report", "briefing", "newsletter", "all-hands", "board meeting", "year in review", "status", "company update"],
  internalcomms: ["internal", "policy", "onboarding", "training", "wellness", "mental health", "leadership", "mission", "culture", "workplace", "announcement", "hybrid work"],
  launch: ["launch", "product launch", "demo", "product demo", "app demo", "release", "case study", "showcase", "reveal"],
  occasions: ["holiday", "holidays", "christmas", "wedding invitation", "slideshow", "party", "event", "presentation", "end of year", "school", "quiz night", "office party"],
  fun: ["fun", "funny", "trailer", "book trailer", "film", "movie", "credits", "superhero", "celebrate", "character", "cinematic"],
};

/** Aspect ratio (w/h) for a library item's meta.resolution, or null if unknown. */
export function libraryAspectRatio(resolution: unknown): number | null {
  if (typeof resolution !== "string" || !resolution) return null;
  const preset = Object.prototype.hasOwnProperty.call(
    RESOLUTION_PRESET_DIMENSIONS,
    resolution,
  )
    ? RESOLUTION_PRESET_DIMENSIONS[resolution]
    : undefined;
  if (preset) return preset[0] / preset[1];
  const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(resolution.trim());
  if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  return null;
}

function aspectFromRatioString(ratio: string | undefined): number | null {
  if (!ratio || ratio === "custom") return null;
  const m = /^(\d+):(\d+)$/.exec(ratio);
  if (!m || Number(m[2]) === 0) return null;
  return Number(m[1]) / Number(m[2]);
}

const recordOf = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Crude singularizer so "cats"/"cat" and "classes"/"class" count as one concept. */
function stemToken(term: string): string {
  if (term.length > 4 && /(?:s|x|z|ch|sh)es$/.test(term))
    return term.slice(0, -2);
  if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss"))
    return term.slice(0, -1);
  return term;
}

/**
 * Distinct stemmed subject tokens of a text (stopwords and short words
 * dropped). Both the brief and each item haystack pass through this, so a
 * shared word counts exactly once regardless of plural form.
 */
function matchStems(text: string): Set<string> {
  const stems = new Set<string>();
  for (const term of String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)) {
    if (term.length <= 2 || CREATIVE_STOPWORDS.has(term)) continue;
    stems.add(stemToken(term));
  }
  return stems;
}

/** Lowercase, punctuation → spaces, collapsed, space-padded for word-boundary includes(). */
function paddedNormalize(text: string): string {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? ` ${normalized} ` : "";
}

/** A row from GET /api/library/:kind (metadata only, content stays on CDN). */
export interface LibraryListItem {
  slug: string;
  kind?: string;
  title?: string | null;
  description?: string | null;
  meta?: Record<string, unknown> | null;
  contentUrl?: string | null;
  [key: string]: unknown;
}

export interface LibraryMatchOptions {
  /** The creative brief to match against. */
  brief: string;
  /** Restrict candidates to video or still-image examples ("any" = both). */
  projectType?: "video" | "image" | "any";
  /** Requested aspect ratio like "16:9"; orientation mismatches are penalized. */
  aspectRatio?: string;
  /** Target video duration in seconds (soft proximity signal). */
  duration?: number;
  /** Slugs to exclude (anti-repetition / already rejected). */
  excludeSlugs?: string[];
  /** Skip premium examples (their content is plan-gated). */
  excludePremium?: boolean;
  /** Max candidates returned (default 8). */
  limit?: number;
}

export interface ScoredLibraryCandidate {
  slug: string;
  title: string;
  description: string;
  pack: string | null;
  premium: boolean;
  type: "video" | "image";
  resolution: string | null;
  duration: number | null;
  scenes: number | null;
  thumbnail: string | null;
  preview: string | null;
  score: number;
  matchStrength: "strong" | "partial" | "weak";
  matchedOn: string[];
}

/** Score bands for scoreLibraryCandidates → matchStrength. */
export const LIBRARY_MATCH_THRESHOLDS = { strong: 8, partial: 4 } as const;

/**
 * Rank library example metadata against a brief. Pure and local — no HTTP —
 * so callers can fetch the full listing once and match far better than the
 * server's AND-of-substrings q search. Items with no TOPICAL signal (shared
 * subject terms or a category-keyword hit) are omitted entirely — aspect and
 * duration only refine topical matches, they never create one.
 */
export function scoreLibraryCandidates(
  items: LibraryListItem[],
  opts: LibraryMatchOptions,
): ScoredLibraryCandidate[] {
  const briefStems = matchStems(String(opts.brief ?? ""));
  const paddedBrief = paddedNormalize(String(opts.brief ?? ""));
  const projectType =
    opts.projectType === "image" || opts.projectType === "video"
      ? opts.projectType
      : "any";
  const wantAspect = aspectFromRatioString(opts.aspectRatio);
  const exclude = new Set(
    (opts.excludeSlugs ?? []).map((s) => String(s).toLowerCase()),
  );
  const rawLimit = Number(opts.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), 24)
      : 8;

  // Word-boundary keyword matching over the normalized brief, so short
  // ("ai", "hr"), hyphenated ("e-commerce" -> "e commerce") and multi-word
  // ("open house") keywords all work without substring false positives.
  const briefPacks = new Set<string>();
  if (paddedBrief) {
    for (const [pack, keywords] of Object.entries(EXAMPLE_CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        const padded = paddedNormalize(keyword);
        if (padded && paddedBrief.includes(padded)) {
          briefPacks.add(pack);
          break;
        }
      }
    }
  }

  const scored: ScoredLibraryCandidate[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!recordOf(item) || typeof item.slug !== "string" || !item.slug)
      continue;
    if (exclude.has(item.slug.toLowerCase())) continue;
    const meta = recordOf(item.meta) ? item.meta : {};
    const premium = Boolean(meta.premium);
    if (premium && opts.excludePremium) continue;
    const type: "video" | "image" = meta.type === "image" ? "image" : "video";
    if (projectType !== "any" && type !== projectType) continue;

    const title = typeof item.title === "string" ? item.title : "";
    const description =
      typeof item.description === "string" ? item.description : "";
    const pack = typeof meta.pack === "string" ? meta.pack : null;
    const haystack = matchStems(
      `${title} ${description} ${item.slug.replace(/-/g, " ")}`,
    );

    let score = 0;
    const matchedOn: string[] = [];

    let overlap = 0;
    for (const stem of briefStems) {
      if (haystack.has(stem)) overlap += 1;
    }
    if (overlap > 0) {
      score += Math.min(overlap, 4) * 2;
      matchedOn.push(`${overlap} shared term${overlap === 1 ? "" : "s"}`);
    }

    if (pack && briefPacks.has(pack)) {
      score += 4;
      matchedOn.push(`category "${pack}"`);
    }

    // No topical connection to the brief: skip. Aspect/duration alone must
    // not surface random same-shaped examples (e.g. for non-Latin briefs).
    if (score <= 0) continue;

    const itemAspect = libraryAspectRatio(meta.resolution);
    if (wantAspect !== null && itemAspect !== null) {
      if (Math.abs(Math.log(itemAspect / wantAspect)) < 0.06) {
        score += 2;
        matchedOn.push("aspect match");
      } else {
        const wantLandscape = wantAspect > 1.05;
        const itemLandscape = itemAspect > 1.05;
        const wantSquare = Math.abs(wantAspect - 1) <= 0.05;
        const itemSquare = Math.abs(itemAspect - 1) <= 0.05;
        if (!wantSquare && !itemSquare && wantLandscape !== itemLandscape) {
          score -= 3;
          matchedOn.push("orientation mismatch");
        }
      }
    }

    const itemDuration =
      typeof meta.duration === "number" && Number.isFinite(meta.duration)
        ? meta.duration
        : null;
    if (
      type === "video" &&
      itemDuration !== null &&
      typeof opts.duration === "number" &&
      opts.duration > 0 &&
      Math.abs(itemDuration - opts.duration) / opts.duration <= 0.5
    ) {
      score += 1;
      matchedOn.push("similar duration");
    }

    if (score <= 0) continue;

    scored.push({
      slug: item.slug,
      title,
      description,
      pack,
      premium,
      type,
      resolution: typeof meta.resolution === "string" ? meta.resolution : null,
      duration: itemDuration,
      scenes:
        typeof meta.scenes === "number" && Number.isFinite(meta.scenes)
          ? meta.scenes
          : null,
      thumbnail: typeof meta.thumbnail === "string" ? meta.thumbnail : null,
      preview: typeof meta.preview === "string" ? meta.preview : null,
      score,
      matchStrength:
        score >= LIBRARY_MATCH_THRESHOLDS.strong
          ? "strong"
          : score >= LIBRARY_MATCH_THRESHOLDS.partial
            ? "partial"
            : "weak",
      matchedOn,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return scored.slice(0, limit);
}

/**
 * Anti-repetition: when several candidates are comparably good (same
 * matchStrength as the best and within 2 score points), rotate which one
 * leads based on a variation seed — so identical repeated briefs do not
 * always adapt the same example. Pure and deterministic under a fixed seed;
 * pass a fresh seed (e.g. a timestamp) per request for variety.
 */
export function rotateComparableCandidates(
  candidates: ScoredLibraryCandidate[],
  seed: string | number,
): {
  candidates: ScoredLibraryCandidate[];
  rotated: boolean;
  comparableCount: number;
} {
  if (!Array.isArray(candidates) || candidates.length < 2) {
    return {
      candidates: candidates ?? [],
      rotated: false,
      comparableCount: candidates?.length ?? 0,
    };
  }
  const best = candidates[0];
  const band = candidates.filter(
    (c) =>
      c.matchStrength === best.matchStrength && c.score >= best.score - 2,
  );
  if (band.length < 2) {
    return { candidates, rotated: false, comparableCount: band.length };
  }
  const pick = band[creativeSeed(String(seed), String(seed)) % band.length];
  if (pick.slug === best.slug) {
    return { candidates, rotated: false, comparableCount: band.length };
  }
  const reordered = [
    pick,
    ...candidates.filter((c) => c.slug !== pick.slug),
  ];
  return { candidates: reordered, rotated: true, comparableCount: band.length };
}

/**
 * The rules for adapting a library example without destroying its design.
 * Returned by the MCP start_from_example tool and safe to show any client.
 */
export const ADAPTATION_CONTRACT: string[] = [
  "KEEP the example's layout skeleton — scene structure, element positions, sizes, animations, timings and transitions. That skeleton IS the premium design; rebuilding it from scratch is how quality is lost.",
  "If the example feels too complex to edit, do NOT simplify it: never drop its media, SVG or GIF elements, never collapse designed scenes into plain text-on-background. Change variable values (or the render_from_example tool) instead — the complexity you would remove is the design.",
  "If the example defines `variables`, adapt through them: change variable VALUES only (copy, media URLs, colors, labels) and leave `{{placeholder}}` references untouched. Variables are inert on a direct payload render — the easiest correct path is render_from_example { slug, variables }; the manual equivalent is create_template, preview_template, then create_render { template, variables }.",
  "If any element uses `condition` or `iterate`, the template route is REQUIRED — those only resolve server-side when rendering a template.",
  "Rewrite topic-specific copy at roughly the same length (±30%) so boxes, wrapping and type scale still fit; never shrink fontSize or widen boxes to squeeze in longer copy.",
  "Swap media via search_stock_media keeping each slot's media type (image stays image, video stays video); use the full-quality src URL — never the small preview URL — with natural size >= the slot's rendered size.",
  "Apply brand tokens globally, not per element: accent/background colors and at most 1-2 font families, changed consistently everywhere.",
  "Do not add or remove scenes or visuals unless the brief requires it; when you must, clone an existing scene of the same role and re-balance durations.",
  "Finish with validate_project_json (remote: true) on the final payload — or preview_template for template renders — and fix every error AND layout warning before rendering.",
];

const VARIABLE_REF_REGEX = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

function extractVariableRefs(json: string): string[] {
  const names = new Set<string>();
  for (const match of json.matchAll(VARIABLE_REF_REGEX)) names.add(match[1]);
  return [...names];
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|span)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface AdaptationTextSlot {
  /** JSON path of the element, e.g. "scenes[1].visuals[2]". */
  path: string;
  sceneIndex: number | null;
  track: number | null;
  /** Current copy (html stripped to text; {{placeholders}} left literal). */
  text: string;
  fontFamily: string | null;
  fontSize: string | number | null;
  position: string | null;
  width: number | null;
  height: number | null;
  usesVariables: string[];
}

export interface AdaptationMediaSlot {
  path: string;
  sceneIndex: number | null;
  track: number | null;
  type: string;
  src: string;
  width: number | null;
  height: number | null;
  resize: string | null;
  usesVariables: string[];
}

export interface AdaptationMap {
  projectType: "video" | "image";
  /** Output settings to preserve (resolution, format, background...). */
  output: Record<string, unknown>;
  /** Declared template variables with defaults and reference counts. */
  variables: { name: string; defaultValue: unknown; references: number }[];
  /** {{refs}} appearing in the payload without a matching `variables` entry —
   * these have no default and must be replaced with real values by hand. */
  undeclaredRefs: string[];
  templateFeatures: {
    usesVariables: boolean;
    usesCondition: boolean;
    usesIterate: boolean;
  };
  /**
   * "template-render": save via create_template and render with variables
   * (required for condition/iterate; correct whenever DECLARED variables
   * exist). "direct-adapt": edit the payload in place and render it directly
   * — also chosen when the only {{refs}} are undeclared (no defaults to
   * render with; replace them inline instead).
   */
  recommendedWorkflow: "template-render" | "direct-adapt";
  sceneCount: number;
  scenes: {
    index: number;
    duration: number | null;
    transition: string | null;
    visualCount: number;
  }[];
  textSlots: AdaptationTextSlot[];
  mediaSlots: AdaptationMediaSlot[];
  svgCount: number;
  audios: { path: string; src: string }[];
  hasSubtitle: boolean;
  fonts: string[];
}

/**
 * Summarize a library example's payload into the slots a client should adapt
 * (variables, copy, media) and the structure it must preserve. Pure; tolerant
 * of any malformed input.
 */
export function buildAdaptationMap(
  payload: Record<string, unknown>,
): AdaptationMap {
  const source = recordOf(payload) ? payload : {};
  const projectType = source.type === "image" ? "image" : "video";

  const output: Record<string, unknown> = {};
  for (const key of [
    "type",
    "name",
    "resolution",
    "width",
    "height",
    "outputFormat",
    "frameRate",
    "backgroundColor",
    "quality",
    "transparent",
    "duration",
  ]) {
    if (source[key] !== undefined) output[key] = source[key];
  }

  let wholeJson = "";
  try {
    wholeJson = JSON.stringify(source) ?? "";
  } catch {
    wholeJson = "";
  }

  const variables: AdaptationMap["variables"] = [];
  if (recordOf(source.variables)) {
    for (const [name, defaultValue] of Object.entries(source.variables)) {
      const pattern = new RegExp(
        `\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
        "g",
      );
      variables.push({
        name,
        defaultValue,
        references: (wholeJson.match(pattern) ?? []).length,
      });
    }
  }

  const scenes: AdaptationMap["scenes"] = [];
  const textSlots: AdaptationTextSlot[] = [];
  const mediaSlots: AdaptationMediaSlot[] = [];
  let svgCount = 0;
  let usesCondition = false;
  let usesIterate = false;

  const walkVisuals = (
    visuals: unknown,
    basePath: string,
    sceneIndex: number | null,
  ) => {
    if (!Array.isArray(visuals)) return;
    visuals.forEach((visual, i) => {
      if (!recordOf(visual)) return;
      if (visual.condition !== undefined) usesCondition = true;
      if (visual.iterate !== undefined) usesIterate = true;
      const path = `${basePath}[${i}]`;
      const type = String(visual.type ?? "").toUpperCase();
      let slotJson = "";
      try {
        slotJson = JSON.stringify(visual) ?? "";
      } catch {
        slotJson = "";
      }
      const usesVariables = extractVariableRefs(slotJson);
      const track =
        typeof visual.track === "number" && Number.isFinite(visual.track)
          ? visual.track
          : null;
      const dim = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
      if (type === "TEXT") {
        const style = recordOf(visual.style) ? visual.style : {};
        const text =
          typeof visual.html === "string"
            ? stripHtmlToText(visual.html)
            : typeof visual.text === "string"
              ? visual.text
              : "";
        textSlots.push({
          path,
          sceneIndex,
          track,
          text,
          fontFamily:
            typeof style.fontFamily === "string" ? style.fontFamily : null,
          fontSize:
            typeof style.fontSize === "string" ||
            typeof style.fontSize === "number"
              ? style.fontSize
              : null,
          position:
            typeof visual.position === "string" ? visual.position : null,
          width: dim(visual.width),
          height: dim(visual.height),
          usesVariables,
        });
      } else if (type === "IMAGE" || type === "VIDEO" || type === "GIF") {
        mediaSlots.push({
          path,
          sceneIndex,
          track,
          type,
          src: typeof visual.src === "string" ? visual.src : "",
          width: dim(visual.width),
          height: dim(visual.height),
          resize: typeof visual.resize === "string" ? visual.resize : null,
          usesVariables,
        });
      } else if (type === "SVG") {
        svgCount += 1;
      }
    });
  };

  walkVisuals(source.visuals, "visuals", null);
  if (Array.isArray(source.scenes)) {
    source.scenes.forEach((scene, i) => {
      if (!recordOf(scene)) return;
      if (scene.condition !== undefined) usesCondition = true;
      if (scene.iterate !== undefined) usesIterate = true;
      scenes.push({
        index: i,
        duration:
          typeof scene.duration === "number" && Number.isFinite(scene.duration)
            ? scene.duration
            : null,
        transition:
          typeof scene.transition === "string" ? scene.transition : null,
        visualCount: Array.isArray(scene.visuals) ? scene.visuals.length : 0,
      });
      walkVisuals(scene.visuals, `scenes[${i}].visuals`, i);
    });
  }

  const audios: AdaptationMap["audios"] = [];
  if (Array.isArray(source.audios)) {
    source.audios.forEach((audio, i) => {
      if (recordOf(audio) && typeof audio.src === "string") {
        audios.push({ path: `audios[${i}]`, src: audio.src });
      }
    });
  }

  const declaredNames = new Set(variables.map((v) => v.name));
  const undeclaredRefs = extractVariableRefs(wholeJson).filter(
    (name) => !declaredNames.has(name),
  );
  const usesVariables = variables.length > 0 || undeclaredRefs.length > 0;

  return {
    projectType,
    output,
    variables,
    undeclaredRefs,
    templateFeatures: { usesVariables, usesCondition, usesIterate },
    // Undeclared refs alone do NOT pick the template route: they have no
    // defaults to render with — the client must replace them inline.
    recommendedWorkflow:
      variables.length > 0 || usesCondition || usesIterate
        ? "template-render"
        : "direct-adapt",
    sceneCount: scenes.length,
    scenes,
    textSlots,
    mediaSlots,
    svgCount,
    audios,
    hasSubtitle: recordOf(source.subtitle),
    fonts: [
      ...new Set(
        textSlots
          .map((slot) => slot.fontFamily)
          .filter((font): font is string => !!font),
      ),
    ],
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  /** Non-fatal notes, e.g. unknown fields the backend will strip. */
  warnings: ValidationIssue[];
}

type Ctx = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  limits: PlanLimits;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function err(ctx: Ctx, field: string, message: string) {
  ctx.errors.push({ field, message });
}

function warn(ctx: Ctx, field: string, message: string) {
  ctx.warnings.push({ field, message });
}

function checkNumber(
  ctx: Ctx,
  field: string,
  v: unknown,
  opts: {
    min?: number;
    max?: number;
    integer?: boolean;
    exclusiveMin?: number;
  },
): boolean {
  if (!isNum(v)) {
    err(ctx, field, `${field} must be a number`);
    return false;
  }
  if (opts.integer && !Number.isInteger(v)) {
    err(ctx, field, `${field} must be an integer`);
    return false;
  }
  if (opts.exclusiveMin !== undefined && v <= opts.exclusiveMin) {
    err(ctx, field, `${field} must be greater than ${opts.exclusiveMin}`);
    return false;
  }
  if (opts.min !== undefined && v < opts.min) {
    err(ctx, field, `${field} must be at least ${opts.min}`);
    return false;
  }
  if (opts.max !== undefined && v > opts.max) {
    err(ctx, field, `${field} cannot exceed ${opts.max}`);
    return false;
  }
  return true;
}

function checkEnum(
  ctx: Ctx,
  field: string,
  v: unknown,
  values: readonly string[],
  allowNull = false,
): boolean {
  if (allowNull && v === null) return true;
  if (typeof v !== "string" || !values.includes(v)) {
    err(
      ctx,
      field,
      `${field} must be one of: ${values.join(", ")}${allowNull ? " (or null)" : ""}`,
    );
    return false;
  }
  return true;
}

function checkHex(
  ctx: Ctx,
  field: string,
  v: unknown,
  withAlpha = false,
): boolean {
  const re = withAlpha ? HEX_COLOR_ALPHA : HEX_COLOR;
  if (typeof v !== "string" || !re.test(v)) {
    err(
      ctx,
      field,
      `${field} must be a valid hex color (${withAlpha ? "#rrggbb or #rrggbbaa" : "e.g. #ffffff"})`,
    );
    return false;
  }
  return true;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  return (
    v === "::1" ||
    v === "::" ||
    v.startsWith("fe8") ||
    v.startsWith("fe9") ||
    v.startsWith("fea") ||
    v.startsWith("feb") ||
    v.startsWith("fc") ||
    v.startsWith("fd")
  );
}

function looksLikeIPv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function looksLikeIPv6(host: string): boolean {
  return host.includes(":");
}

/** Mirror of the backend's makeRemoteSrcSchema (SSRF-hardened public URL). */
export function checkRemoteUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "must be a non-empty URL string";
  }
  const v = value.trim();
  if (v.length > MAX_URL_LEN)
    return `must be at most ${MAX_URL_LEN} characters`;
  if (URL_CONTROL_CHARS.test(v)) return "contains control characters";
  if (/[\\\s]/.test(v)) return "must not contain spaces or backslashes";

  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "must be a valid absolute URL";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return "must use http or https";
  if (u.username || u.password) return "must not contain credentials";
  if (u.port && !["80", "443"].includes(u.port))
    return "may only use port 80 or 443";

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return "must not point at localhost/.local hosts";
  }
  if (looksLikeIPv4(host) && isPrivateIPv4(host))
    return "must not point at a private IPv4 address";
  if (looksLikeIPv6(host) && isPrivateIPv6(host))
    return "must not point at a private IPv6 address";
  return null;
}

function checkUrlField(ctx: Ctx, field: string, v: unknown): boolean {
  const problem = checkRemoteUrl(v);
  if (problem) {
    err(ctx, field, `${field} ${problem} (public http(s) URL required)`);
    return false;
  }
  return true;
}

/**
 * Template-engine fields (condition/iterate/iterateAs + scoped variables)
 * resolve during TEMPLATE rendering and are stripped by the engine before
 * validation; they are inert on direct payload renders. Recognized here so
 * validation warns accurately and repair never destroys template logic by
 * "cleaning" them away.
 */
const TEMPLATE_ONLY_KEYS = new Set([
  "condition",
  "iterate",
  "iterateAs",
  "variables",
]);

function checkUnknownKeys(
  ctx: Ctx,
  field: string,
  obj: Record<string, unknown>,
  allowed: Set<string>,
) {
  for (const k of Object.keys(obj)) {
    if (allowed.has(k)) continue;
    if (TEMPLATE_ONLY_KEYS.has(k)) {
      warn(
        ctx,
        `${field}.${k}`,
        `"${k}" is a template-only field — it resolves when the project is rendered as a TEMPLATE (create_template + variables) and is inert on a direct payload render`,
      );
      continue;
    }
    warn(
      ctx,
      `${field}.${k}`,
      `Unknown field "${k}" — the backend strips it silently and the renderer never sees it`,
    );
  }
}

// ---- sub-validators -------------------------------------------------------

const BASE_VISUAL_KEYS = [
  "type",
  "x",
  "y",
  "width",
  "height",
  "position",
  "anchor",
  "resize",
  "enterBegin",
  "enterEnd",
  "exitBegin",
  "exitEnd",
  "opacity",
  "angle",
  "flipV",
  "flipH",
  "track",
  "enterAnimation",
  "exitAnimation",
];

const IMAGE_LIKE_KEYS = [
  "src",
  "cropParams",
  "filter",
  "chromaKey",
  "zoom",
  "radius",
];

const VISUAL_KEYS: Record<ElementType, string[]> = {
  IMAGE: [...BASE_VISUAL_KEYS, ...IMAGE_LIKE_KEYS],
  GIF: [...BASE_VISUAL_KEYS, ...IMAGE_LIKE_KEYS],
  VIDEO: [
    ...BASE_VISUAL_KEYS,
    ...IMAGE_LIKE_KEYS,
    "videoBegin",
    "videoEnd",
    "videoDuration",
    "volume",
    "speed",
    "transition",
    "transitionDuration",
    "transitionId",
    "frameRate",
    "id",
    "hasAudio",
  ],
  SVG: [
    ...BASE_VISUAL_KEYS,
    "svg",
    "filter",
    "chromaKey",
    "customCode",
    "designer",
  ],
  TEXT: [
    ...BASE_VISUAL_KEYS,
    "text",
    "html",
    "style",
    "customCode",
    "designer",
  ],
};

function validateBaseVisual(ctx: Ctx, f: string, v: Record<string, unknown>) {
  const L = ctx.limits;
  if (v.x !== undefined)
    checkNumber(ctx, `${f}.x`, v.x, { max: L.maxInputResolution });
  if (v.y !== undefined)
    checkNumber(ctx, `${f}.y`, v.y, { max: L.maxInputResolution });
  if (v.width !== undefined)
    checkNumber(ctx, `${f}.width`, v.width, {
      min: 1,
      max: L.maxInputResolution,
    });
  if (v.height !== undefined)
    checkNumber(ctx, `${f}.height`, v.height, {
      min: 1,
      max: L.maxInputResolution,
    });
  if (v.position !== undefined)
    checkEnum(ctx, `${f}.position`, v.position, POSITION_PRESETS);
  if (v.anchor !== undefined) checkEnum(ctx, `${f}.anchor`, v.anchor, ANCHORS);
  if (v.resize !== undefined)
    checkEnum(ctx, `${f}.resize`, v.resize, RESIZE_MODES);
  for (const k of ["enterBegin", "enterEnd", "exitBegin", "exitEnd"] as const) {
    if (v[k] !== undefined)
      checkNumber(ctx, `${f}.${k}`, v[k], {
        min: 0,
        max: L.maxOutputResolution,
      });
  }
  if (v.opacity !== undefined)
    checkNumber(ctx, `${f}.opacity`, v.opacity, { min: 0, max: 1 });
  if (v.angle !== undefined)
    checkNumber(ctx, `${f}.angle`, v.angle, { min: -360, max: 360 });
  if (v.flipV !== undefined && typeof v.flipV !== "boolean")
    err(ctx, `${f}.flipV`, `${f}.flipV must be a boolean`);
  if (v.flipH !== undefined && typeof v.flipH !== "boolean")
    err(ctx, `${f}.flipH`, `${f}.flipH must be a boolean`);
  if (v.track !== undefined)
    checkNumber(ctx, `${f}.track`, v.track, {
      min: 0,
      max: 1_000_000,
      integer: true,
    });
  if (v.enterAnimation !== undefined)
    checkEnum(
      ctx,
      `${f}.enterAnimation`,
      v.enterAnimation,
      XFADE_EFFECTS,
      true,
    );
  if (v.exitAnimation !== undefined)
    checkEnum(ctx, `${f}.exitAnimation`, v.exitAnimation, XFADE_EFFECTS, true);
}

function validateMediaExtras(ctx: Ctx, f: string, v: Record<string, unknown>) {
  const L = ctx.limits;
  if (v.cropParams !== undefined) {
    if (!isObj(v.cropParams)) {
      err(ctx, `${f}.cropParams`, `${f}.cropParams must be an object`);
    } else {
      const c = v.cropParams;
      for (const k of ["x", "y", "width", "height"] as const) {
        if (c[k] === undefined)
          err(ctx, `${f}.cropParams.${k}`, `${f}.cropParams.${k} is required`);
      }
      if (c.x !== undefined)
        checkNumber(ctx, `${f}.cropParams.x`, c.x, {
          min: 0,
          max: L.maxInputResolution,
        });
      if (c.y !== undefined)
        checkNumber(ctx, `${f}.cropParams.y`, c.y, {
          min: 0,
          max: L.maxInputResolution,
        });
      if (c.width !== undefined)
        checkNumber(ctx, `${f}.cropParams.width`, c.width, {
          min: 1,
          max: L.maxInputResolution,
        });
      if (c.height !== undefined)
        checkNumber(ctx, `${f}.cropParams.height`, c.height, {
          min: 1,
          max: L.maxInputResolution,
        });
      checkUnknownKeys(
        ctx,
        `${f}.cropParams`,
        c,
        new Set(["x", "y", "width", "height"]),
      );
    }
  }
  if (v.radius !== undefined) {
    if (!isObj(v.radius)) {
      err(ctx, `${f}.radius`, `${f}.radius must be an object with tl/tr/bl/br`);
    } else {
      for (const k of ["tl", "tr", "bl", "br"] as const) {
        if (v.radius[k] !== undefined)
          checkNumber(ctx, `${f}.radius.${k}`, v.radius[k], {
            min: 0,
            max: L.maxInputResolution,
          });
      }
      checkUnknownKeys(
        ctx,
        `${f}.radius`,
        v.radius,
        new Set(["tl", "tr", "bl", "br"]),
      );
    }
  }
  if (v.filter !== undefined) {
    if (!isObj(v.filter)) {
      err(ctx, `${f}.filter`, `${f}.filter must be an object`);
    } else {
      const fl = v.filter;
      for (const k of ["brightness", "contrast", "saturate"] as const) {
        if (fl[k] !== undefined)
          checkNumber(ctx, `${f}.filter.${k}`, fl[k], { min: -100, max: 100 });
      }
      if (
        fl["hue-rotate"] !== undefined &&
        typeof fl["hue-rotate"] !== "string"
      )
        err(
          ctx,
          `${f}.filter.hue-rotate`,
          `${f}.filter.hue-rotate must be a string like "90deg"`,
        );
      if (fl.blur !== undefined && typeof fl.blur !== "string")
        err(
          ctx,
          `${f}.filter.blur`,
          `${f}.filter.blur must be a string like "4px"`,
        );
      if (fl.invert !== undefined && typeof fl.invert !== "boolean")
        err(ctx, `${f}.filter.invert`, `${f}.filter.invert must be a boolean`);
      if (fl.colorTint !== undefined)
        checkHex(ctx, `${f}.filter.colorTint`, fl.colorTint);
      checkUnknownKeys(
        ctx,
        `${f}.filter`,
        fl,
        new Set([
          "brightness",
          "contrast",
          "saturate",
          "hue-rotate",
          "blur",
          "invert",
          "colorTint",
        ]),
      );
    }
  }
  if (v.chromaKey !== undefined) {
    if (!isObj(v.chromaKey)) {
      err(ctx, `${f}.chromaKey`, `${f}.chromaKey must be an object`);
    } else {
      if (v.chromaKey.color === undefined)
        err(ctx, `${f}.chromaKey.color`, `${f}.chromaKey.color is required`);
      else checkHex(ctx, `${f}.chromaKey.color`, v.chromaKey.color);
      if (v.chromaKey.similarity !== undefined)
        checkNumber(ctx, `${f}.chromaKey.similarity`, v.chromaKey.similarity, {
          min: 0,
          max: 100,
        });
      if (v.chromaKey.blend !== undefined)
        checkNumber(ctx, `${f}.chromaKey.blend`, v.chromaKey.blend, {
          min: 0,
          max: 100,
        });
      checkUnknownKeys(
        ctx,
        `${f}.chromaKey`,
        v.chromaKey,
        new Set(["color", "similarity", "blend"]),
      );
    }
  }
  if (v.zoom !== undefined) {
    if (typeof v.zoom === "boolean") {
      // ok
    } else if (isObj(v.zoom)) {
      if (v.zoom.depth !== undefined)
        checkNumber(ctx, `${f}.zoom.depth`, v.zoom.depth, { min: 1, max: 10 });
      checkUnknownKeys(ctx, `${f}.zoom`, v.zoom, new Set(["depth"]));
    } else {
      err(
        ctx,
        `${f}.zoom`,
        `${f}.zoom must be a boolean or an object with a "depth" number (1-10)`,
      );
    }
  }
}

function validateCustomCode(ctx: Ctx, f: string, v: unknown) {
  if (!isObj(v)) {
    err(ctx, f, `${f} must be an object with css/js/animationDuration`);
    return;
  }
  for (const [key, rules] of [
    ["css", CUSTOM_CODE_FORBIDDEN_CSS],
    ["js", CUSTOM_CODE_FORBIDDEN_JS],
  ] as const) {
    const code = v[key];
    if (code === undefined) continue;
    if (typeof code !== "string") {
      err(ctx, `${f}.${key}`, `${f}.${key} must be a string`);
      continue;
    }
    if (code.length > MAX_CUSTOM_CODE_LEN) {
      err(
        ctx,
        `${f}.${key}`,
        `${f}.${key} exceeds ${MAX_CUSTOM_CODE_LEN} characters`,
      );
      continue;
    }
    if (CONTROL_CHARS.test(code)) {
      err(ctx, `${f}.${key}`, `${f}.${key} contains control characters`);
      continue;
    }
    for (const { pattern, reason } of rules) {
      if (pattern.test(code)) {
        err(
          ctx,
          `${f}.${key}`,
          `Unsafe customCode.${key}: contains ${reason}, which is not allowed inside the rendering browser`,
        );
        break;
      }
    }
  }
  if (v.animationDuration !== undefined) {
    checkNumber(ctx, `${f}.animationDuration`, v.animationDuration, {
      exclusiveMin: 0,
      max: MAX_CUSTOM_CODE_ANIMATION_DURATION,
    });
  }
  checkUnknownKeys(ctx, f, v, new Set(["css", "js", "animationDuration"]));
}

function validateDesigner(ctx: Ctx, f: string, v: unknown) {
  if (!isObj(v)) {
    err(ctx, f, `${f} must be an object`);
    return;
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(v);
  } catch {
    err(ctx, f, `${f} must be plain JSON`);
    return;
  }
  if (serialized.length > MAX_DESIGNER_JSON_LEN) {
    err(ctx, f, `${f} metadata too large (max ${MAX_DESIGNER_JSON_LEN} chars)`);
  }
  if (/"(?:__proto__|prototype|constructor)"\s*:/.test(serialized)) {
    err(ctx, f, `${f} contains forbidden keys`);
  }
}

function validateSvgString(ctx: Ctx, f: string, svg: unknown) {
  if (typeof svg !== "string" || svg.trim().length === 0) {
    err(ctx, f, `${f} must be a non-empty SVG string`);
    return;
  }
  if (svg.length > MAX_SVG_CHARS) {
    err(ctx, f, `${f} exceeds ${MAX_SVG_CHARS} characters`);
    return;
  }
  if (CONTROL_CHARS.test(svg)) {
    err(ctx, f, `${f}: control characters not allowed`);
    return;
  }
  if (!/^\s*<svg\b/i.test(svg)) {
    err(ctx, f, `${f} must start with <svg>`);
    return;
  }
  for (const t of SVG_FORBIDDEN_TAGS) {
    if (new RegExp(`<\\s*${t}\\b`, "i").test(svg)) {
      err(ctx, f, `${f}: forbidden SVG element <${t}>`);
      return;
    }
  }
  if (/\son[a-z]+\s*=/i.test(svg)) {
    err(ctx, f, `${f}: event handler attributes are not allowed`);
    return;
  }
  // external url() (only url(#id) allowed)
  const urlRe = /\burl\s*\(\s*([^)]+)\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(svg))) {
    let inside = m[1].trim();
    if (
      (inside.startsWith("'") && inside.endsWith("'")) ||
      (inside.startsWith('"') && inside.endsWith('"'))
    ) {
      inside = inside.slice(1, -1).trim();
    }
    if (!inside.startsWith("#")) {
      err(
        ctx,
        f,
        `${f}: external url() references are not allowed (only url(#id))`,
      );
      return;
    }
  }
  // external href/xlink:href/src
  const uriAttrRe = /\b(href|xlink:href|src)\s*=\s*(['"])(.*?)\2/gi;
  while ((m = uriAttrRe.exec(svg))) {
    const value = m[3].trim();
    const unsafe = value !== "" && !value.startsWith("#");
    if (unsafe) {
      err(
        ctx,
        f,
        `${f}: external ${m[1].toLowerCase()} is not allowed (only "#...")`,
      );
      return;
    }
  }
  if (/\b\d{8,}\b/.test(svg)) {
    err(ctx, f, `${f}: excessive numeric values`);
    return;
  }
  // dimension bounds
  const dim = (name: string): number | null => {
    const dm = svg.match(
      new RegExp(`\\b${name}\\s*=\\s*['"]([^'"]+)['"]`, "i"),
    );
    if (!dm) return null;
    const nm = dm[1].trim().match(/^(-?\d+(\.\d+)?)(px)?$/i);
    return nm ? Number(nm[1]) : null;
  };
  const dims = [dim("width"), dim("height")];
  const vb = svg.match(/\bviewBox\s*=\s*['"]([^'"]+)['"]/i);
  if (vb?.[1]) {
    const parts = vb[1].trim().split(/\s+/);
    if (parts.length === 4) {
      dims.push(Number(parts[2]), Number(parts[3]));
    }
  }
  for (const n of dims) {
    if (n == null || !Number.isFinite(n)) continue;
    if (n < 0) {
      err(ctx, f, `${f}: negative dimensions not allowed`);
      return;
    }
    if (n > MAX_SVG_DIMENSION) {
      err(ctx, f, `${f}: SVG dimensions too large (max ${MAX_SVG_DIMENSION})`);
      return;
    }
  }
}

const HTML_TAG_RE = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g;
const TEXT_HTML_ALLOWED = new Set<string>(
  TEXT_HTML_ALLOWED_TAGS.map((t) => t.toLowerCase()),
);

function validateTextHtml(ctx: Ctx, f: string, html: unknown) {
  if (typeof html !== "string") {
    err(ctx, f, `${f} must be a string`);
    return;
  }
  if (html.length > MAX_HTML_LEN) {
    err(ctx, f, `${f} exceeds ${MAX_HTML_LEN} characters`);
    return;
  }
  if (CONTROL_CHARS.test(html)) {
    err(ctx, f, `${f}: control characters not allowed`);
    return;
  }
  if (/<\s*script\b/i.test(html) || /<\/\s*script\s*>/i.test(html)) {
    err(ctx, f, `${f}: <script> not allowed`);
    return;
  }
  if (/<\s*style\b/i.test(html) || /<\/\s*style\s*>/i.test(html)) {
    err(ctx, f, `${f}: <style> not allowed`);
    return;
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    err(ctx, f, `${f}: event handler attributes are not allowed`);
    return;
  }
  let m: RegExpExecArray | null;
  HTML_TAG_RE.lastIndex = 0;
  while ((m = HTML_TAG_RE.exec(html))) {
    const tag = m[1].toLowerCase();
    if (!TEXT_HTML_ALLOWED.has(tag)) {
      err(
        ctx,
        f,
        `${f}: tag not allowed: <${tag}> (allowed: b, strong, i, em, u, s, br, span, div, p, ul, ol, li, img, canvas, svg + svg geometry)`,
      );
      return;
    }
  }
  // dangerous CSS in style attributes
  for (const rx of CSS_DANGEROUS_GLOBAL) {
    const styleAttrs = html.match(/style\s*=\s*(['"])(.*?)\1/gi) ?? [];
    for (const attr of styleAttrs) {
      if (rx.test(attr)) {
        err(
          ctx,
          f,
          `${f}: dangerous CSS in style attribute (url()/@import/expression()/comments are rejected)`,
        );
        return;
      }
    }
  }
}

function validateStyleObject(ctx: Ctx, f: string, style: unknown) {
  if (!isObj(style)) {
    err(ctx, f, `${f} must be an object of CSS properties`);
    return;
  }
  const entries = Object.entries(style);
  if (entries.length > MAX_STYLE_PROPS) {
    err(ctx, f, `${f} has too many properties (max ${MAX_STYLE_PROPS})`);
    return;
  }
  for (const [k, v] of entries) {
    if (FORBIDDEN_KEYS.has(k)) {
      err(ctx, f, `${f}: forbidden key: ${k}`);
      return;
    }
    const validName = k.startsWith("--")
      ? CSS_VAR_NAME.test(k)
      : CSS_PROP_NAME.test(k);
    if (!validName) {
      err(ctx, f, `${f}: invalid CSS property name: ${k}`);
      return;
    }
    if (v === null || v === undefined) continue;
    if (typeof v !== "string" && typeof v !== "number") {
      err(ctx, `${f}.${k}`, `${f}.${k} must be a string or number`);
      continue;
    }
    const s = String(v);
    if (s.length > MAX_STYLE_VALUE_LEN) {
      err(
        ctx,
        `${f}.${k}`,
        `${f}.${k} value too long (max ${MAX_STYLE_VALUE_LEN})`,
      );
      continue;
    }
    if (CONTROL_CHARS.test(s)) {
      err(ctx, `${f}.${k}`, `${f}.${k} contains control characters`);
      continue;
    }
    for (const rx of CSS_DANGEROUS_GLOBAL) {
      if (rx.test(s)) {
        err(
          ctx,
          `${f}.${k}`,
          `${f}.${k} contains a dangerous CSS token (url()/@import/image-set()/expression()/comments are rejected)`,
        );
        break;
      }
    }
  }
}

function normalizeType(v: Record<string, unknown>): ElementType | null {
  const t = v.type;
  if (typeof t !== "string") return null;
  const upper = t.toUpperCase();
  return (ELEMENT_TYPES as readonly string[]).includes(upper)
    ? (upper as ElementType)
    : null;
}

function validateVisual(
  ctx: Ctx,
  f: string,
  visual: unknown,
): ElementType | null {
  if (!isObj(visual)) {
    err(ctx, f, `${f} must be an object`);
    return null;
  }
  if (typeof visual.type !== "string") {
    err(ctx, f, `${f} is missing required field "type"`);
    return null;
  }
  const type = normalizeType(visual);
  if (!type) {
    err(
      ctx,
      f,
      `${f} has invalid type "${visual.type}". Must be one of: IMAGE, VIDEO, GIF, SVG, TEXT`,
    );
    return null;
  }

  checkUnknownKeys(ctx, f, visual, new Set(VISUAL_KEYS[type]));
  validateBaseVisual(ctx, f, visual);

  const L = ctx.limits;
  switch (type) {
    case "IMAGE":
    case "GIF": {
      if (visual.src === undefined)
        err(ctx, `${f}.src`, `${f}.src is required`);
      else checkUrlField(ctx, `${f}.src`, visual.src);
      validateMediaExtras(ctx, f, visual);
      break;
    }
    case "VIDEO": {
      if (visual.src === undefined)
        err(ctx, `${f}.src`, `${f}.src is required`);
      else checkUrlField(ctx, `${f}.src`, visual.src);
      validateMediaExtras(ctx, f, visual);
      if (visual.videoBegin !== undefined)
        checkNumber(ctx, `${f}.videoBegin`, visual.videoBegin, {
          min: 0,
          max: L.maxDuration,
        });
      if (visual.videoEnd !== undefined)
        checkNumber(ctx, `${f}.videoEnd`, visual.videoEnd, {
          min: 0,
          max: L.maxDuration,
        });
      if (visual.videoDuration !== undefined)
        checkNumber(ctx, `${f}.videoDuration`, visual.videoDuration, {
          min: 0.1,
          max: L.maxDuration,
        });
      if (visual.volume !== undefined)
        checkNumber(ctx, `${f}.volume`, visual.volume, { min: 0, max: 1 });
      if (visual.speed !== undefined)
        checkNumber(ctx, `${f}.speed`, visual.speed, { min: 0.1, max: 10 });
      if (visual.transition !== undefined)
        checkEnum(
          ctx,
          `${f}.transition`,
          visual.transition,
          XFADE_EFFECTS,
          true,
        );
      if (visual.transitionDuration !== undefined)
        checkNumber(ctx, `${f}.transitionDuration`, visual.transitionDuration, {
          min: 0,
          max: L.maxOutputResolution,
        });
      if (visual.transitionId !== undefined) {
        if (
          typeof visual.transitionId !== "string" ||
          !ID_REGEX.test(visual.transitionId) ||
          visual.transitionId.length > MAX_ID_LEN
        )
          err(
            ctx,
            `${f}.transitionId`,
            `${f}.transitionId must match ${ID_REGEX} (max ${MAX_ID_LEN} chars)`,
          );
      }
      if (visual.frameRate !== undefined)
        checkNumber(ctx, `${f}.frameRate`, visual.frameRate, {
          min: 1,
          max: 60,
          integer: true,
        });
      if (
        visual.id !== undefined &&
        (typeof visual.id !== "string" || !ID_REGEX.test(visual.id))
      )
        err(ctx, `${f}.id`, `${f}.id must match ${ID_REGEX}`);
      if (visual.hasAudio !== undefined && typeof visual.hasAudio !== "boolean")
        err(ctx, `${f}.hasAudio`, `${f}.hasAudio must be a boolean`);
      break;
    }
    case "SVG": {
      if (visual.svg === undefined)
        err(ctx, `${f}.svg`, `${f}.svg is required`);
      else validateSvgString(ctx, `${f}.svg`, visual.svg);
      if (visual.filter !== undefined || visual.chromaKey !== undefined) {
        validateMediaExtras(ctx, f, {
          filter: visual.filter,
          chromaKey: visual.chromaKey,
        });
      }
      if (visual.customCode !== undefined)
        validateCustomCode(ctx, `${f}.customCode`, visual.customCode);
      if (visual.designer !== undefined)
        validateDesigner(ctx, `${f}.designer`, visual.designer);
      break;
    }
    case "TEXT": {
      if (visual.text !== undefined) {
        if (typeof visual.text !== "string")
          err(ctx, `${f}.text`, `${f}.text must be a string`);
        else {
          if (visual.text.length > MAX_TEXT_LEN)
            err(
              ctx,
              `${f}.text`,
              `${f}.text exceeds ${MAX_TEXT_LEN} characters`,
            );
          if (CONTROL_CHARS.test(visual.text))
            err(ctx, `${f}.text`, `${f}.text contains control characters`);
          if (/[<>]/.test(visual.text))
            err(
              ctx,
              `${f}.text`,
              `${f}.text: HTML markup not allowed in text (use "html")`,
            );
        }
      }
      if (visual.html !== undefined)
        validateTextHtml(ctx, `${f}.html`, visual.html);
      if (visual.style !== undefined)
        validateStyleObject(ctx, `${f}.style`, visual.style);
      if (visual.customCode !== undefined)
        validateCustomCode(ctx, `${f}.customCode`, visual.customCode);
      if (visual.designer !== undefined)
        validateDesigner(ctx, `${f}.designer`, visual.designer);

      const hasText =
        typeof visual.text === "string" && visual.text.trim().length > 0;
      const hasHtml =
        typeof visual.html === "string" && visual.html.trim().length > 0;
      if (!hasText && !hasHtml) {
        err(ctx, f, `${f}: TEXT element needs non-empty "text" and/or "html"`);
      }
      break;
    }
  }
  return type;
}

const AUDIO_KEYS = new Set([
  "src",
  "enter",
  "exit",
  "volume",
  "speed",
  "audioBegin",
  "audioEnd",
  "audioDuration",
]);

function validateAudio(ctx: Ctx, f: string, a: unknown) {
  if (!isObj(a)) {
    err(ctx, f, `${f} must be an object`);
    return;
  }
  const L = ctx.limits;
  checkUnknownKeys(ctx, f, a, AUDIO_KEYS);
  if (a.src !== undefined) checkUrlField(ctx, `${f}.src`, a.src);
  else
    warn(
      ctx,
      `${f}.src`,
      `${f}.src is missing — an audio item without src plays nothing`,
    );
  if (a.enter !== undefined)
    checkNumber(ctx, `${f}.enter`, a.enter, {
      min: 0,
      max: L.maxOutputResolution,
    });
  if (a.exit !== undefined)
    checkNumber(ctx, `${f}.exit`, a.exit, {
      min: 0,
      max: L.maxOutputResolution,
    });
  if (a.volume !== undefined)
    checkNumber(ctx, `${f}.volume`, a.volume, { min: 0, max: 1 });
  if (a.speed !== undefined)
    checkNumber(ctx, `${f}.speed`, a.speed, { min: 0.1, max: 10 });
  if (a.audioBegin !== undefined)
    checkNumber(ctx, `${f}.audioBegin`, a.audioBegin, {
      min: 0,
      max: L.maxDuration,
    });
  if (a.audioEnd !== undefined)
    checkNumber(ctx, `${f}.audioEnd`, a.audioEnd, {
      min: 0,
      max: L.maxDuration,
    });
  if (a.audioDuration !== undefined)
    checkNumber(ctx, `${f}.audioDuration`, a.audioDuration, {
      min: 0,
      max: L.maxDuration,
    });
  // temporal
  if (isNum(a.enter) && isNum(a.exit) && a.exit < a.enter) {
    err(ctx, `${f}.exit`, "audio.exit cannot be before audio.enter");
  }
  if (isNum(a.audioBegin) && isNum(a.audioEnd) && a.audioEnd < a.audioBegin) {
    err(ctx, `${f}.audioEnd`, "audioEnd cannot be before audioBegin");
  }
}

const SUBTITLE_V2_KEYS = [
  "animation",
  "direction",
  "font",
  "stroke",
  "background",
  "activeWord",
  "position",
  "margin",
];
const SUBTITLE_KEYS = new Set([
  "src",
  "captions",
  "styles",
  "maxWordsPerLine",
  ...SUBTITLE_V2_KEYS,
]);

function validateActiveWord(ctx: Ctx, f: string, v: unknown) {
  if (!isObj(v) || Object.keys(v).length < 1) {
    err(
      ctx,
      f,
      `${f} must be an object with at least one of color/background/radius`,
    );
    return;
  }
  if (v.color !== undefined) checkHex(ctx, `${f}.color`, v.color, true);
  if (v.background !== undefined)
    checkHex(ctx, `${f}.background`, v.background, true);
  if (v.radius !== undefined)
    checkNumber(ctx, `${f}.radius`, v.radius, { min: 0, max: 200 });
  checkUnknownKeys(ctx, f, v, new Set(["color", "background", "radius"]));
}

function validateSubtitle(ctx: Ctx, subtitle: unknown) {
  const f = "subtitle";
  if (!isObj(subtitle)) {
    err(ctx, f, "subtitle must be an object");
    return;
  }
  const L = ctx.limits;
  checkUnknownKeys(ctx, f, subtitle, SUBTITLE_KEYS);

  const hasSrc = subtitle.src !== undefined;
  const hasCaptions = subtitle.captions !== undefined;
  if (hasSrc === hasCaptions) {
    err(
      ctx,
      f,
      'subtitle needs exactly one of "src" (SRT/VTT URL) or "captions"',
    );
  }
  if (hasSrc) checkUrlField(ctx, `${f}.src`, subtitle.src);
  if (hasCaptions) {
    if (!Array.isArray(subtitle.captions) || subtitle.captions.length < 1) {
      err(ctx, `${f}.captions`, "subtitle.captions must be a non-empty array");
    } else {
      if (subtitle.captions.length > L.maxCaptionElements) {
        err(
          ctx,
          `${f}.captions`,
          `Max captions allowed is ${L.maxCaptionElements} (based on your ${L.planName} plan)`,
        );
      }
      subtitle.captions.forEach((cap: unknown, i: number) => {
        const cf = `${f}.captions[${i}]`;
        if (!isObj(cap)) {
          err(ctx, cf, `${cf} must be an object`);
          return;
        }
        checkUnknownKeys(
          ctx,
          cf,
          cap,
          new Set(["start", "end", "text", "words"]),
        );
        if (cap.start === undefined)
          err(ctx, `${cf}.start`, `${cf}.start is required`);
        else
          checkNumber(ctx, `${cf}.start`, cap.start, {
            min: 0,
            max: L.maxInputResolution,
          });
        if (cap.end === undefined)
          err(ctx, `${cf}.end`, `${cf}.end is required`);
        else
          checkNumber(ctx, `${cf}.end`, cap.end, {
            min: 0,
            max: L.maxInputResolution,
          });
        const hasText = cap.text !== undefined;
        const hasWords = cap.words !== undefined;
        if (!hasText && !hasWords) {
          err(ctx, cf, `${cf} needs "text" and/or "words"`);
        }
        if (
          hasText &&
          (typeof cap.text !== "string" ||
            cap.text.length < 1 ||
            cap.text.length > MAX_SUBTITLE_TEXT_LEN)
        ) {
          err(
            ctx,
            `${cf}.text`,
            `${cf}.text must be a string of 1..${MAX_SUBTITLE_TEXT_LEN} characters`,
          );
        }
        if (hasWords) {
          if (!Array.isArray(cap.words) || cap.words.length < 1) {
            err(ctx, `${cf}.words`, `${cf}.words must be a non-empty array`);
          } else {
            cap.words.forEach((w: unknown, wi: number) => {
              const wf = `${cf}.words[${wi}]`;
              if (!isObj(w)) {
                err(ctx, wf, `${wf} must be an object`);
                return;
              }
              checkUnknownKeys(ctx, wf, w, new Set(["start", "end", "text"]));
              if (w.start === undefined)
                err(ctx, `${wf}.start`, `${wf}.start is required`);
              else
                checkNumber(ctx, `${wf}.start`, w.start, {
                  min: 0,
                  max: L.maxInputResolution,
                });
              if (w.end === undefined)
                err(ctx, `${wf}.end`, `${wf}.end is required`);
              else
                checkNumber(ctx, `${wf}.end`, w.end, {
                  min: 0,
                  max: L.maxInputResolution,
                });
              if (
                typeof w.text !== "string" ||
                w.text.length < 1 ||
                w.text.length > MAX_SUBTITLE_WORD_LEN
              ) {
                err(
                  ctx,
                  `${wf}.text`,
                  `${wf}.text must be a string of 1..${MAX_SUBTITLE_WORD_LEN} characters`,
                );
              }
            });
          }
        }
      });
    }
  }

  const hasLegacy = subtitle.styles !== undefined;
  const usedV2 = SUBTITLE_V2_KEYS.filter((k) => subtitle[k] !== undefined);
  if (hasLegacy && usedV2.length > 0) {
    err(
      ctx,
      `${f}.styles`,
      `legacy "styles" cannot be combined with the flat subtitle style fields (${usedV2.join(", ")})`,
    );
  }

  if (subtitle.maxWordsPerLine !== undefined) {
    checkNumber(ctx, `${f}.maxWordsPerLine`, subtitle.maxWordsPerLine, {
      min: 1,
      max: 20,
      integer: true,
    });
  }
  if (subtitle.animation !== undefined)
    checkEnum(ctx, `${f}.animation`, subtitle.animation, SUBTITLE_ANIMATIONS);
  if (subtitle.direction !== undefined)
    checkEnum(ctx, `${f}.direction`, subtitle.direction, SLIDE_DIRECTIONS);
  if (subtitle.position !== undefined)
    checkEnum(ctx, `${f}.position`, subtitle.position, SUBTITLE_POSITIONS_V2);

  if (subtitle.font !== undefined) {
    if (!isObj(subtitle.font) || Object.keys(subtitle.font).length < 1) {
      err(
        ctx,
        `${f}.font`,
        `${f}.font must be an object with at least one property`,
      );
    } else {
      const fo = subtitle.font;
      checkUnknownKeys(
        ctx,
        `${f}.font`,
        fo,
        new Set(["family", "size", "color", "bold", "italic", "transform"]),
      );
      if (
        fo.family !== undefined &&
        (typeof fo.family !== "string" ||
          !NAME_REGEX.test(fo.family) ||
          fo.family.length > MAX_NAME_LEN)
      )
        err(
          ctx,
          `${f}.font.family`,
          `${f}.font.family must contain only letters, digits, spaces, _ and -`,
        );
      if (fo.size !== undefined)
        checkNumber(ctx, `${f}.font.size`, fo.size, {
          min: 1,
          max: MAX_FONT_SIZE,
        });
      if (fo.color !== undefined)
        checkHex(ctx, `${f}.font.color`, fo.color, true);
      if (fo.bold !== undefined && typeof fo.bold !== "boolean")
        err(ctx, `${f}.font.bold`, `${f}.font.bold must be a boolean`);
      if (fo.italic !== undefined && typeof fo.italic !== "boolean")
        err(ctx, `${f}.font.italic`, `${f}.font.italic must be a boolean`);
      if (fo.transform !== undefined)
        checkEnum(ctx, `${f}.font.transform`, fo.transform, TEXT_TRANSFORMS);
    }
  }
  if (subtitle.stroke !== undefined) {
    if (!isObj(subtitle.stroke)) {
      err(
        ctx,
        `${f}.stroke`,
        `${f}.stroke must be an object with color and width`,
      );
    } else {
      const st = subtitle.stroke;
      checkUnknownKeys(ctx, `${f}.stroke`, st, new Set(["color", "width"]));
      if (st.color === undefined)
        err(ctx, `${f}.stroke.color`, `${f}.stroke.color is required`);
      else checkHex(ctx, `${f}.stroke.color`, st.color, true);
      if (st.width === undefined)
        err(ctx, `${f}.stroke.width`, `${f}.stroke.width is required`);
      else
        checkNumber(ctx, `${f}.stroke.width`, st.width, {
          min: 0,
          max: MAX_OUTLINE_WIDTH,
        });
    }
  }
  if (subtitle.background !== undefined) {
    if (
      !isObj(subtitle.background) ||
      Object.keys(subtitle.background).length < 1
    ) {
      err(
        ctx,
        `${f}.background`,
        `${f}.background must be an object with at least one property`,
      );
    } else {
      const bg = subtitle.background;
      checkUnknownKeys(
        ctx,
        `${f}.background`,
        bg,
        new Set(["color", "opacity", "padding", "radius"]),
      );
      if (bg.color !== undefined)
        checkHex(ctx, `${f}.background.color`, bg.color, true);
      if (bg.opacity !== undefined)
        checkNumber(ctx, `${f}.background.opacity`, bg.opacity, {
          min: 0,
          max: 1,
        });
      if (bg.padding !== undefined)
        checkNumber(ctx, `${f}.background.padding`, bg.padding, {
          min: 0,
          max: 200,
        });
      if (bg.radius !== undefined)
        checkNumber(ctx, `${f}.background.radius`, bg.radius, {
          min: 0,
          max: 200,
        });
    }
  }
  if (subtitle.activeWord !== undefined)
    validateActiveWord(ctx, `${f}.activeWord`, subtitle.activeWord);
  if (subtitle.margin !== undefined) {
    if (!isObj(subtitle.margin) || Object.keys(subtitle.margin).length < 1) {
      err(ctx, `${f}.margin`, `${f}.margin must be an object with x and/or y`);
    } else {
      const mg = subtitle.margin;
      checkUnknownKeys(ctx, `${f}.margin`, mg, new Set(["x", "y"]));
      if (mg.x !== undefined)
        checkNumber(ctx, `${f}.margin.x`, mg.x, {
          min: 0,
          max: L.maxOutputResolution,
          integer: true,
        });
      if (mg.y !== undefined)
        checkNumber(ctx, `${f}.margin.y`, mg.y, {
          min: 0,
          max: L.maxOutputResolution,
          integer: true,
        });
    }
  }

  if (subtitle.styles !== undefined) {
    const s = subtitle.styles;
    if (!isObj(s)) {
      err(ctx, `${f}.styles`, `${f}.styles must be an object`);
    } else {
      checkUnknownKeys(
        ctx,
        `${f}.styles`,
        s,
        new Set([
          "color",
          "background",
          "backgroundPadding",
          "backgroundRadius",
          "isBold",
          "isItalic",
          "fontSize",
          "fontFamily",
          "textTransform",
          "outline",
          "position",
          "marginV",
          "marginH",
          "mode",
          "slideDirection",
          "activeWord",
        ]),
      );
      if (s.color !== undefined)
        checkHex(ctx, `${f}.styles.color`, s.color, true);
      if (s.background !== undefined)
        checkHex(ctx, `${f}.styles.background`, s.background, true);
      if (s.backgroundPadding !== undefined)
        checkNumber(ctx, `${f}.styles.backgroundPadding`, s.backgroundPadding, {
          min: 0,
          max: 200,
        });
      if (s.backgroundRadius !== undefined)
        checkNumber(ctx, `${f}.styles.backgroundRadius`, s.backgroundRadius, {
          min: 0,
          max: 200,
        });
      if (s.isBold !== undefined && typeof s.isBold !== "boolean")
        err(ctx, `${f}.styles.isBold`, "isBold must be a boolean");
      if (s.isItalic !== undefined && typeof s.isItalic !== "boolean")
        err(ctx, `${f}.styles.isItalic`, "isItalic must be a boolean");
      if (s.fontSize !== undefined)
        checkNumber(ctx, `${f}.styles.fontSize`, s.fontSize, {
          min: 1,
          max: MAX_FONT_SIZE,
        });
      if (
        s.fontFamily !== undefined &&
        (typeof s.fontFamily !== "string" ||
          !NAME_REGEX.test(s.fontFamily) ||
          s.fontFamily.length > MAX_NAME_LEN)
      )
        err(
          ctx,
          `${f}.styles.fontFamily`,
          `${f}.styles.fontFamily must contain only letters, digits, spaces, _ and -`,
        );
      if (s.textTransform !== undefined)
        checkEnum(
          ctx,
          `${f}.styles.textTransform`,
          s.textTransform,
          TEXT_TRANSFORMS,
        );
      if (s.position !== undefined)
        checkEnum(ctx, `${f}.styles.position`, s.position, SUBTITLE_POSITIONS);
      if (s.marginV !== undefined)
        checkNumber(ctx, `${f}.styles.marginV`, s.marginV, {
          min: 0,
          max: L.maxOutputResolution,
          integer: true,
        });
      if (s.marginH !== undefined)
        checkNumber(ctx, `${f}.styles.marginH`, s.marginH, {
          min: 0,
          max: L.maxOutputResolution,
          integer: true,
        });
      if (s.mode !== undefined)
        checkEnum(ctx, `${f}.styles.mode`, s.mode, SUBTITLE_ANIMATIONS);
      if (s.slideDirection !== undefined)
        checkEnum(
          ctx,
          `${f}.styles.slideDirection`,
          s.slideDirection,
          SLIDE_DIRECTIONS,
        );
      if (s.outline !== undefined) {
        if (!isObj(s.outline)) {
          err(
            ctx,
            `${f}.styles.outline`,
            "outline must be an object with width and color",
          );
        } else {
          if (s.outline.width === undefined)
            err(ctx, `${f}.styles.outline.width`, "outline.width is required");
          else
            checkNumber(ctx, `${f}.styles.outline.width`, s.outline.width, {
              min: 0,
              max: MAX_OUTLINE_WIDTH,
            });
          if (s.outline.color === undefined)
            err(ctx, `${f}.styles.outline.color`, "outline.color is required");
          else
            checkHex(ctx, `${f}.styles.outline.color`, s.outline.color, true);
        }
      }
      if (s.activeWord !== undefined)
        validateActiveWord(ctx, `${f}.styles.activeWord`, s.activeWord);
    }
  }
}

const SCENE_KEYS = new Set([
  "id",
  "duration",
  "transition",
  "transitionId",
  "transitionDuration",
  "backgroundColor",
  "visuals",
  "audios",
]);

/** Mirror of templateEngine.transitionOverlap — see the note in VALIDATION_NOTES. */
function transitionOverlap(
  scene: Record<string, unknown>,
  index: number,
  scenes: Record<string, unknown>[],
): number {
  if (!scene.transition) return 0;
  const next = scenes[index + 1];
  if (!next) return 0;
  const nextId = (next.id as string | undefined) ?? `scene-${index + 1}`;
  const tid = scene.transitionId;
  const pointsToNext =
    tid === undefined || tid === null || tid === "none" || tid === nextId;
  if (!pointsToNext) return 0;
  return typeof scene.transitionDuration === "number"
    ? scene.transitionDuration
    : 0.5;
}

export function computeScenesTotalDuration(
  scenes: Array<Record<string, unknown>>,
): number {
  let total = 0;
  for (let i = 0; i < scenes.length; i++) {
    total +=
      (scenes[i].duration as number) - transitionOverlap(scenes[i], i, scenes);
  }
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------
// Layout lint — professional-output warnings that mirror the renderer's
// layout model (package/src/utils/calculatePosition.ts, anchorPosition.ts,
// lib/texts/buildHtmlContent.ts). Valid-but-ugly payloads get warnings here.
// ---------------------------------------------------------------------------

type VisualEntry = {
  v: Record<string, unknown>;
  type: ElementType | null;
  field: string;
};
type Rect = { x0: number; y0: number; x1: number; y1: number };
type Canvas = { w: number; h: number };

const PRESET_FRACTIONS: Record<string, [number, number]> = {
  "top-left": [0, 0],
  "top-center": [0.5, 0],
  "top-right": [1, 0],
  "center-left": [0, 0.5],
  "center-center": [0.5, 0.5],
  "center-right": [1, 0.5],
  "bottom-left": [0, 1],
  "bottom-center": [0.5, 1],
  "bottom-right": [1, 1],
};

/** Bounding box the renderer will use, or null when it can't be known. */
function rectOf(
  v: Record<string, unknown>,
  canvas: Canvas | null,
): Rect | null {
  const w = isNum(v.width) ? v.width : null;
  const h = isNum(v.height) ? v.height : null;
  if (w == null || h == null) return null;

  const pos = typeof v.position === "string" ? v.position : undefined;
  let px: number;
  let py: number;
  let anchorName: string;
  if (pos && pos !== "custom") {
    if (!canvas) return null;
    const f = PRESET_FRACTIONS[pos];
    if (!f) return null;
    px = f[0] * canvas.w;
    py = f[1] * canvas.h;
    anchorName = typeof v.anchor === "string" ? v.anchor : pos; // renderer defaults anchor to the preset
  } else {
    px = isNum(v.x) ? v.x : 0;
    py = isNum(v.y) ? v.y : 0;
    anchorName = typeof v.anchor === "string" ? v.anchor : "top-left";
  }
  const af = PRESET_FRACTIONS[anchorName] ?? [0, 0];
  const x0 = px - w * af[0];
  const y0 = py - h * af[1];
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

function hexToRgb(hex: string): [number, number, number] | null {
  let s = hex.replace(/^#/, "");
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  if (s.length !== 6) return null;
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fgHex: string, bgHex: string): number | null {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function visibilityWindow(v: Record<string, unknown>): [number, number] {
  const start = isNum(v.enterBegin) ? v.enterBegin : 0;
  const end = isNum(v.exitEnd) ? v.exitEnd : Number.POSITIVE_INFINITY;
  return [start, end];
}

function canvasCoverage(rect: Rect, canvas: Canvas): number {
  const ix = Math.max(0, Math.min(rect.x1, canvas.w) - Math.max(rect.x0, 0));
  const iy = Math.max(0, Math.min(rect.y1, canvas.h) - Math.max(rect.y0, 0));
  return (ix * iy) / (canvas.w * canvas.h);
}

function lintContainer(
  ctx: Ctx,
  entries: VisualEntry[],
  opts: { canvas: Canvas | null; bg?: string },
) {
  const { canvas } = opts;
  const rects = new Map<VisualEntry, Rect | null>();
  for (const e of entries) rects.set(e, rectOf(e.v, canvas));

  const isBackdrop = (e: VisualEntry): boolean => {
    if (e.type === "IMAGE" || e.type === "VIDEO" || e.type === "GIF")
      return true;
    // scrim / full-canvas colored layer
    const rect = rects.get(e);
    if (!rect || !canvas || canvasCoverage(rect, canvas) < 0.85) return false;
    const style = isObj(e.v.style) ? e.v.style : undefined;
    return !!style && style.backgroundColor !== undefined;
  };

  for (const e of entries) {
    const { v, field } = e;
    const pos = typeof v.position === "string" ? v.position : undefined;

    if ((v.x !== undefined || v.y !== undefined) && pos && pos !== "custom") {
      warn(
        ctx,
        field,
        `${field}: x/y are IGNORED because position "${pos}" overwrites them — the element will render at the preset point. Use position: "custom" (with anchor) for offset placement`,
      );
    }

    if (e.type === "TEXT" && isObj(v.style)) {
      const hasPadding = Object.keys(v.style).some((k) =>
        k.toLowerCase().replace(/-/g, "").startsWith("padding"),
      );
      if (hasPadding) {
        warn(
          ctx,
          `${field}.style`,
          `${field}.style uses padding, which renders OUTSIDE the declared width/height (the renderer is box-sizing: content-box) and can get cut off — set the full size via width/height and center the content with display: "flex", alignItems: "center", justifyContent: "center" instead`,
        );
      }
    }

    const rect = rects.get(e) ?? null;

    if (rect && canvas) {
      const over: string[] = [];
      if (rect.x0 < -2)
        over.push(`${Math.round(-rect.x0)}px past the left edge`);
      if (rect.y0 < -2)
        over.push(`${Math.round(-rect.y0)}px past the top edge`);
      if (rect.x1 > canvas.w + 2)
        over.push(`${Math.round(rect.x1 - canvas.w)}px past the right edge`);
      if (rect.y1 > canvas.h + 2)
        over.push(`${Math.round(rect.y1 - canvas.h)}px past the bottom edge`);
      if (over.length) {
        warn(
          ctx,
          field,
          `${field} extends ${over.join(" and ")} — that part will be cut off`,
        );
      }
    }

    // contrast vs a solid background (skipped when media or a scrim layer sits
    // underneath — then the effective background isn't the solid color)
    if (
      e.type === "TEXT" &&
      !entries.some((other) => other !== e && isBackdrop(other))
    ) {
      const style = isObj(v.style) ? v.style : undefined;
      const rawColor =
        style && typeof style.color === "string" ? style.color : undefined;
      const ownBg =
        style && typeof style.backgroundColor === "string"
          ? style.backgroundColor
          : undefined;
      const bgHex =
        ownBg && HEX_COLOR.test(ownBg)
          ? ownBg
          : opts.bg && HEX_COLOR.test(opts.bg)
            ? opts.bg
            : "#ffffff";
      // renderer default text color is black
      const fgHex =
        rawColor === undefined
          ? "#000000"
          : HEX_COLOR.test(rawColor)
            ? rawColor
            : null;
      if (fgHex) {
        const ratio = contrastRatio(fgHex, bgHex);
        if (ratio !== null && ratio < 3) {
          warn(
            ctx,
            field,
            `${field}: low contrast (${ratio.toFixed(1)}:1) between text ${fgHex} and background ${bgHex} — aim for at least 4.5:1 or put the text on a card/scrim`,
          );
        }
      }
    }
  }

  // pairwise: text colliding with text/SVG that is visible at the same time
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const textPair =
        (a.type === "TEXT" || b.type === "TEXT") &&
        ["TEXT", "SVG"].includes(a.type ?? "") &&
        ["TEXT", "SVG"].includes(b.type ?? "");
      if (!textPair) continue;

      const ra = rects.get(a) ?? null;
      const rb = rects.get(b) ?? null;
      // full-canvas layers are scrims/backgrounds — collisions with them are intentional
      if (
        canvas &&
        ((ra && canvasCoverage(ra, canvas) >= 0.85) ||
          (rb && canvasCoverage(rb, canvas) >= 0.85))
      ) {
        continue;
      }

      const [aS, aE] = visibilityWindow(a.v);
      const [bS, bE] = visibilityWindow(b.v);
      if (!(aS < bE && bS < aE)) continue; // never on screen together

      let overlapping = false;
      if (ra && rb) {
        overlapping =
          ra.x0 < rb.x1 - 4 &&
          rb.x0 < ra.x1 - 4 &&
          ra.y0 < rb.y1 - 4 &&
          rb.y0 < ra.y1 - 4;
      } else {
        const pa = typeof a.v.position === "string" ? a.v.position : undefined;
        const pb = typeof b.v.position === "string" ? b.v.position : undefined;
        overlapping = !!pa && pa === pb && pa !== "custom";
      }
      if (overlapping) {
        warn(
          ctx,
          b.field,
          `${a.field} and ${b.field} overlap on screen at the same time — give each its own region (different presets or position: "custom" coordinates), split them into scenes, or put headline + subline inside ONE element's html`,
        );
      }
    }
  }
}

const PROJECT_KEYS = new Set([
  "type",
  "name",
  "resolution",
  "width",
  "height",
  "duration",
  "frameRate",
  "outputFormat",
  "backgroundColor",
  "snapshotTime",
  "quality",
  "transparent",
  "visuals",
  "audios",
  "scenes",
  "thumbnail",
  "subtitle",
  // template-authoring keys resolved server-side before validation:
  "variables",
]);

const IMAGE_FORBIDDEN_TOP = [
  "duration",
  "frameRate",
  "audios",
  "scenes",
  "thumbnail",
  "subtitle",
] as const;
const IMAGE_FORBIDDEN_ITEM_FIELDS = [
  "enterBegin",
  "enterEnd",
  "exitBegin",
  "exitEnd",
  "videoBegin",
  "videoEnd",
  "videoDuration",
  "transition",
  "transitionId",
  "transitionDuration",
] as const;

/**
 * Validate a Zvid project payload against the backend rules.
 * Pure and side-effect free; returns every problem found (not just the first).
 */
export function validateProject(
  payload: unknown,
  options: { limits?: Partial<PlanLimits> } = {},
): ValidationResult {
  const ctx: Ctx = {
    errors: [],
    warnings: [],
    limits: { ...DEFAULT_LIMITS, ...(options.limits ?? {}) },
  };
  const L = ctx.limits;

  if (!isObj(payload)) {
    err(ctx, "payload", "payload must be a JSON object");
    return { valid: false, errors: ctx.errors, warnings: ctx.warnings };
  }

  const p = payload;
  checkUnknownKeys(ctx, "payload", p, PROJECT_KEYS);
  if (p.variables !== undefined) {
    warn(
      ctx,
      "payload.variables",
      '"variables" only has effect when the project is used as a TEMPLATE (placeholders are resolved server-side before validation)',
    );
  }

  // type
  const isImage = p.type === "image";
  if (p.type !== undefined && p.type !== "video" && p.type !== "image") {
    err(ctx, "type", 'Project type must be "video" or "image"');
  }

  if (p.name !== undefined) {
    if (
      typeof p.name !== "string" ||
      !NAME_REGEX.test(p.name) ||
      p.name.length > MAX_NAME_LEN
    ) {
      err(
        ctx,
        "name",
        "name may only contain letters, digits, spaces, _ and - (max 1000 chars)",
      );
    }
  }
  if (p.resolution !== undefined)
    checkEnum(ctx, "resolution", p.resolution, RESOLUTION_PRESETS);
  if (p.width !== undefined)
    checkNumber(ctx, "width", p.width, {
      min: 1,
      max: L.maxOutputResolution,
      integer: true,
    });
  if (p.height !== undefined)
    checkNumber(ctx, "height", p.height, {
      min: 1,
      max: L.maxOutputResolution,
      integer: true,
    });
  if (p.backgroundColor !== undefined)
    checkHex(ctx, "backgroundColor", p.backgroundColor);

  // type-branched fields
  if (isImage) {
    for (const k of IMAGE_FORBIDDEN_TOP) {
      if (p[k] !== undefined) {
        err(
          ctx,
          k,
          k === "thumbnail"
            ? '"thumbnail" is not applicable to image renders (the image is its own thumbnail)'
            : `"${k}" is not applicable to image renders`,
        );
      }
    }
    if (p.outputFormat !== undefined) {
      checkEnum(ctx, "outputFormat", p.outputFormat, IMAGE_OUTPUT_FORMATS);
    }
    if (p.snapshotTime !== undefined)
      checkNumber(ctx, "snapshotTime", p.snapshotTime, { min: 0, max: 3600 });
    if (p.quality !== undefined)
      checkNumber(ctx, "quality", p.quality, {
        min: 1,
        max: 100,
        integer: true,
      });
    if (p.transparent !== undefined && typeof p.transparent !== "boolean") {
      err(ctx, "transparent", "transparent must be a boolean");
    }
    const fmt = String(p.outputFormat ?? "png").toLowerCase();
    if (p.transparent === true && (fmt === "jpg" || fmt === "jpeg")) {
      err(
        ctx,
        "transparent",
        "transparent is not supported with jpg output (jpg has no alpha channel); use png or webp",
      );
    }
    if (p.quality !== undefined && fmt === "png") {
      err(
        ctx,
        "quality",
        "quality applies to jpg/webp outputs only (png is lossless)",
      );
    }
  } else {
    for (const k of ["snapshotTime", "quality", "transparent"] as const) {
      if (p[k] !== undefined) {
        err(
          ctx,
          k,
          `"${k}" is only applicable to image renders (type: "image")`,
        );
      }
    }
    if (p.duration !== undefined)
      checkNumber(ctx, "duration", p.duration, {
        min: 0.1,
        max: L.maxDuration,
      });
    if (p.frameRate !== undefined)
      checkNumber(ctx, "frameRate", p.frameRate, {
        min: 1,
        max: 60,
        integer: true,
      });
    if (p.outputFormat !== undefined)
      checkEnum(ctx, "outputFormat", p.outputFormat, VIDEO_OUTPUT_FORMATS);
    if (p.thumbnail !== undefined) checkUrlField(ctx, "thumbnail", p.thumbnail);
  }

  // visuals
  const topVisuals: Array<{
    v: Record<string, unknown>;
    type: ElementType | null;
    field: string;
  }> = [];
  if (p.visuals !== undefined) {
    if (!Array.isArray(p.visuals)) {
      err(ctx, "visuals", "visuals must be an array");
    } else {
      p.visuals.forEach((v: unknown, i: number) => {
        const field = `visuals[${i}]`;
        const t = validateVisual(ctx, field, v);
        if (isObj(v)) topVisuals.push({ v, type: t, field });
      });
    }
  }

  // audios
  if (!isImage && p.audios !== undefined) {
    if (!Array.isArray(p.audios)) {
      err(ctx, "audios", "audios must be an array");
    } else {
      p.audios.forEach((a: unknown, i: number) =>
        validateAudio(ctx, `audios[${i}]`, a),
      );
    }
  }

  // scenes
  const sceneVisuals: Array<{
    v: Record<string, unknown>;
    type: ElementType | null;
    field: string;
  }> = [];
  const sceneLintGroups: Array<{ entries: VisualEntry[]; bg?: string }> = [];
  let sceneAudioCount = 0;
  let validScenes: Record<string, unknown>[] = [];
  if (!isImage && p.scenes !== undefined) {
    if (!Array.isArray(p.scenes)) {
      err(ctx, "scenes", "scenes must be an array");
    } else {
      if (p.scenes.length > L.maxScenes) {
        err(
          ctx,
          "scenes",
          `Max scenes allowed is ${L.maxScenes} (based on your ${L.planName} plan)`,
        );
      }
      p.scenes.forEach((s: unknown, i: number) => {
        const sf = `scenes[${i}]`;
        if (!isObj(s)) {
          err(ctx, sf, `${sf} must be an object`);
          return;
        }
        validScenes.push(s);
        checkUnknownKeys(ctx, sf, s, SCENE_KEYS);
        if (
          s.id !== undefined &&
          (typeof s.id !== "string" ||
            !ID_REGEX.test(s.id) ||
            s.id.length > MAX_ID_LEN)
        ) {
          err(
            ctx,
            `${sf}.id`,
            `${sf}.id must match ${ID_REGEX} (max ${MAX_ID_LEN} chars)`,
          );
        }
        if (s.duration !== undefined) {
          if (
            !isNum(s.duration) ||
            (s.duration !== -1 &&
              (s.duration < 0.1 || s.duration > L.maxDuration))
          ) {
            err(
              ctx,
              `${sf}.duration`,
              `${sf}.duration must be -1 (auto) or between 0.1 and ${L.maxDuration} seconds`,
            );
          }
        }
        if (s.transition !== undefined)
          checkEnum(ctx, `${sf}.transition`, s.transition, XFADE_EFFECTS, true);
        if (s.transitionId !== undefined && s.transitionId !== null) {
          if (
            typeof s.transitionId !== "string" ||
            !ID_REGEX.test(s.transitionId) ||
            s.transitionId.length > MAX_ID_LEN
          ) {
            err(
              ctx,
              `${sf}.transitionId`,
              `${sf}.transitionId must match ${ID_REGEX} (max ${MAX_ID_LEN} chars) or null`,
            );
          }
        }
        if (s.transitionDuration !== undefined)
          checkNumber(ctx, `${sf}.transitionDuration`, s.transitionDuration, {
            min: 0,
            max: 60,
          });
        if (s.backgroundColor !== undefined)
          checkHex(ctx, `${sf}.backgroundColor`, s.backgroundColor);
        if (s.visuals !== undefined) {
          if (!Array.isArray(s.visuals)) {
            err(ctx, `${sf}.visuals`, `${sf}.visuals must be an array`);
          } else {
            const entries: VisualEntry[] = [];
            s.visuals.forEach((v: unknown, vi: number) => {
              const field = `${sf}.visuals[${vi}]`;
              const t = validateVisual(ctx, field, v);
              if (isObj(v)) {
                const entry: VisualEntry = { v, type: t, field };
                sceneVisuals.push(entry);
                entries.push(entry);
              }
            });
            sceneLintGroups.push({
              entries,
              bg:
                typeof s.backgroundColor === "string"
                  ? s.backgroundColor
                  : undefined,
            });
          }
        }
        if (s.audios !== undefined) {
          if (!Array.isArray(s.audios)) {
            err(ctx, `${sf}.audios`, `${sf}.audios must be an array`);
          } else {
            sceneAudioCount += s.audios.length;
            s.audios.forEach((a: unknown, ai: number) =>
              validateAudio(ctx, `${sf}.audios[${ai}]`, a),
            );
          }
        }
      });

      // total duration when all scenes are explicit
      const allExplicit =
        validScenes.length > 0 &&
        validScenes.every(
          (s) => isNum(s.duration) && (s.duration as number) > 0,
        );
      if (allExplicit) {
        const total = computeScenesTotalDuration(validScenes);
        if (total > L.maxDuration) {
          err(
            ctx,
            "scenes",
            `Total scenes duration (${total}s) cannot exceed ${L.maxDuration} seconds (based on your ${L.planName} plan)`,
          );
        }
      }
    }
  }

  // image-only per-element rules
  if (isImage) {
    topVisuals.forEach(({ v, field }) => {
      const t = typeof v.type === "string" ? v.type.toLowerCase() : "";
      if (t === "video" || t === "gif") {
        err(
          ctx,
          `${field}.type`,
          `${t} elements are not allowed in image projects — image canvases compose static sources only (image, text, svg)`,
        );
        return;
      }
      for (const fieldName of IMAGE_FORBIDDEN_ITEM_FIELDS) {
        if (v[fieldName] !== undefined) {
          err(
            ctx,
            `${field}.${fieldName}`,
            `"${fieldName}" is not applicable to image renders (visual elements are always on)`,
          );
        }
      }
    });
  }

  // temporal checks on visuals
  const allVisuals = [...topVisuals, ...sceneVisuals];
  for (const { v, field } of allVisuals) {
    if (isNum(v.enterBegin) && isNum(v.enterEnd) && v.enterEnd < v.enterBegin) {
      err(ctx, `${field}.enterEnd`, "enterEnd cannot be before enterBegin");
    }
    if (isNum(v.exitBegin) && isNum(v.exitEnd) && v.exitEnd < v.exitBegin) {
      err(ctx, `${field}.exitEnd`, "exitEnd cannot be before exitBegin");
    }
  }

  // plan-based media-type counts
  const countOf = (t: string) =>
    allVisuals.filter(
      ({ v }) => typeof v.type === "string" && v.type.toLowerCase() === t,
    ).length;
  if (countOf("image") > L.maxImagesCount) {
    err(
      ctx,
      "visuals",
      `Max images allowed is ${L.maxImagesCount} (based on your ${L.planName} plan)`,
    );
  }
  if (countOf("video") > L.maxVideosCount) {
    err(
      ctx,
      "visuals",
      `Max videos allowed is ${L.maxVideosCount} (based on your ${L.planName} plan)`,
    );
  }
  if (countOf("gif") > L.maxGifsCount) {
    err(
      ctx,
      "visuals",
      `Max gifs allowed is ${L.maxGifsCount} (based on your ${L.planName} plan)`,
    );
  }

  const audioCount =
    (Array.isArray(p.audios) ? p.audios.length : 0) + sceneAudioCount;
  if (audioCount > L.maxAudioElements) {
    err(
      ctx,
      "audios",
      `Max audios allowed is ${L.maxAudioElements} (based on your ${L.planName} plan)`,
    );
  }

  // subtitle
  if (!isImage && p.subtitle !== undefined && p.subtitle !== null) {
    validateSubtitle(ctx, p.subtitle);
  }

  // ---- layout lint (professional-output warnings, never errors) ----
  // Canvas is only known when no resolution preset overrides width/height.
  const resolutionIsPreset =
    typeof p.resolution === "string" && p.resolution !== "custom";
  const lintCanvas: Canvas | null = resolutionIsPreset
    ? null
    : {
        w: isNum(p.width) ? p.width : 1280,
        h: isNum(p.height) ? p.height : 720,
      };
  const projectBg =
    typeof p.backgroundColor === "string" ? p.backgroundColor : undefined;
  lintContainer(ctx, topVisuals, { canvas: lintCanvas, bg: projectBg });
  for (const group of sceneLintGroups) {
    lintContainer(ctx, group.entries, {
      canvas: lintCanvas,
      bg: group.bg ?? projectBg,
    });
  }

  return {
    valid: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

/** Validate a full render REQUEST body ({ payload } or { template, variables }). */
export function validateRenderRequest(
  body: unknown,
  options: { limits?: Partial<PlanLimits> } = {},
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!isObj(body)) {
    return {
      valid: false,
      errors: [
        { field: "body", message: "Request body must be a JSON object" },
      ],
      warnings,
    };
  }
  const hasPayload = body.payload !== undefined;
  const hasTemplate = body.template !== undefined;
  if (hasPayload === hasTemplate) {
    errors.push({
      field: "body",
      message:
        'Provide either "payload" (full project) or "template" (stored template id), not both',
    });
  }
  if (
    hasTemplate &&
    (typeof body.template !== "string" ||
      !TEMPLATE_ID_REGEX.test(body.template))
  ) {
    errors.push({
      field: "template",
      message:
        'Invalid template id format (expected "tpl_" + 20 alphanumerics)',
    });
  }
  if (body.variables !== undefined && !isObj(body.variables)) {
    errors.push({
      field: "variables",
      message: "variables must be an object keyed by variable name",
    });
  }
  if (body.webhookUrl !== undefined) {
    const problem = checkRemoteUrl(body.webhookUrl);
    if (problem)
      errors.push({ field: "webhookUrl", message: `webhookUrl ${problem}` });
  }
  if (body.overrides !== undefined && !isObj(body.overrides)) {
    errors.push({ field: "overrides", message: "overrides must be an object" });
  }
  if (hasPayload && !hasTemplate) {
    const res = validateProject(body.payload, options);
    errors.push(
      ...res.errors.map((e) => ({
        field: e.field === "payload" ? e.field : `payload.${e.field}`,
        message: e.message,
      })),
    );
    warnings.push(
      ...res.warnings.map((w) => ({
        field: w.field.startsWith("payload") ? w.field : `payload.${w.field}`,
        message: w.message,
      })),
    );
  }
  if (hasTemplate) {
    warnings.push({
      field: "template",
      message:
        "Template renders resolve variables server-side before validation — use the template preview endpoint (or preview_template tool) for a full free dry run.",
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Repair — conservative auto-fixes for common AI-generated mistakes
// ---------------------------------------------------------------------------

export interface RepairChange {
  field: string;
  change: string;
}

export interface RepairResult {
  repaired: unknown;
  changes: RepairChange[];
  /** Validation result of the repaired payload. */
  result: ValidationResult;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Attempt to repair an invalid project payload. Conservative: only fixes
 * mistakes with one obvious correction (case, clamping, format mismatches,
 * swapped timings, stripping fields the backend would reject). Anything it
 * cannot fix is left for `result.errors`.
 */
export function repairProject(
  payload: unknown,
  options: { limits?: Partial<PlanLimits> } = {},
): RepairResult {
  const changes: RepairChange[] = [];
  if (!isObj(payload)) {
    return {
      repaired: payload,
      changes,
      result: {
        valid: false,
        errors: [
          {
            field: "payload",
            message: "payload must be a JSON object — nothing to repair",
          },
        ],
        warnings: [],
      },
    };
  }
  const L = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };
  const p: Record<string, unknown> = JSON.parse(JSON.stringify(payload));

  const drop = (
    obj: Record<string, unknown>,
    key: string,
    field: string,
    why: string,
  ) => {
    if (obj[key] !== undefined) {
      delete obj[key];
      changes.push({ field, change: why });
    }
  };

  // type casing / validity
  if (typeof p.type === "string" && p.type !== "video" && p.type !== "image") {
    const lower = p.type.toLowerCase();
    if (lower === "video" || lower === "image") {
      p.type = lower;
      changes.push({ field: "type", change: `lowercased type to "${lower}"` });
    } else {
      drop(
        p,
        "type",
        "type",
        `removed invalid type "${p.type}" (defaults to "video")`,
      );
    }
  }
  const isImage = p.type === "image";

  // name sanitization
  if (typeof p.name === "string" && !NAME_REGEX.test(p.name)) {
    const cleaned = p.name
      .replace(/[^a-zA-Z0-9_\- ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_NAME_LEN);
    if (cleaned) {
      p.name = cleaned;
      changes.push({
        field: "name",
        change:
          "removed characters not allowed in name (letters, digits, spaces, _ and - only)",
      });
    } else {
      drop(p, "name", "name", "removed unusable name");
    }
  }

  // background color
  if (
    typeof p.backgroundColor === "string" &&
    !HEX_COLOR.test(p.backgroundColor)
  ) {
    const hex = p.backgroundColor.startsWith("#")
      ? p.backgroundColor
      : `#${p.backgroundColor}`;
    if (HEX_COLOR.test(hex)) {
      p.backgroundColor = hex;
      changes.push({
        field: "backgroundColor",
        change: `normalized color to "${hex}"`,
      });
    }
  }

  // clamp numeric ranges
  const clampField = (
    obj: Record<string, unknown>,
    key: string,
    field: string,
    min: number,
    max: number,
    integer = false,
  ) => {
    const v = obj[key];
    if (isNum(v) && (v < min || v > max || (integer && !Number.isInteger(v)))) {
      let nv = clamp(v, min, max);
      if (integer) nv = Math.round(nv);
      obj[key] = nv;
      changes.push({ field, change: `clamped ${key} from ${v} to ${nv}` });
    }
  };
  clampField(p, "width", "width", 1, L.maxOutputResolution, true);
  clampField(p, "height", "height", 1, L.maxOutputResolution, true);

  // type-branch cleanup
  if (isImage) {
    for (const k of IMAGE_FORBIDDEN_TOP) {
      drop(p, k, k, `removed "${k}" — not applicable to image renders`);
    }
    if (
      typeof p.outputFormat === "string" &&
      !(IMAGE_OUTPUT_FORMATS as readonly string[]).includes(p.outputFormat)
    ) {
      p.outputFormat = "png";
      changes.push({
        field: "outputFormat",
        change:
          'set outputFormat to "png" (image renders support png/jpg/jpeg/webp)',
      });
    }
    const fmt = String(p.outputFormat ?? "png").toLowerCase();
    if (p.transparent === true && (fmt === "jpg" || fmt === "jpeg")) {
      p.outputFormat = "png";
      changes.push({
        field: "outputFormat",
        change: "switched jpg to png because transparent: true was requested",
      });
    }
    if (
      p.quality !== undefined &&
      String(p.outputFormat ?? "png").toLowerCase() === "png"
    ) {
      drop(
        p,
        "quality",
        "quality",
        "removed quality (only valid for jpg/webp)",
      );
    }
  } else {
    for (const k of ["snapshotTime", "quality", "transparent"]) {
      drop(p, k, k, `removed "${k}" — only applicable to image renders`);
    }
    clampField(p, "duration", "duration", 0.1, L.maxDuration);
    clampField(p, "frameRate", "frameRate", 1, 60, true);
    if (
      typeof p.outputFormat === "string" &&
      !(VIDEO_OUTPUT_FORMATS as readonly string[]).includes(p.outputFormat)
    ) {
      p.outputFormat = "mp4";
      changes.push({
        field: "outputFormat",
        change:
          'set outputFormat to "mp4" (video renders support mp4/mov/avi/webm)',
      });
    }
  }

  // visuals
  const repairVisualArray = (
    arr: unknown[],
    prefix: string,
    imageMode: boolean,
  ): unknown[] => {
    const out: unknown[] = [];
    arr.forEach((v, i) => {
      const field = `${prefix}[${i}]`;
      if (!isObj(v)) {
        changes.push({ field, change: "removed non-object visual" });
        return;
      }
      const t = normalizeType(v);
      if (!t) {
        changes.push({
          field,
          change: `removed visual with unsupported type "${String(v.type)}"`,
        });
        return;
      }
      if (imageMode && (t === "VIDEO" || t === "GIF")) {
        changes.push({
          field,
          change: `removed ${t} element — not allowed in image projects`,
        });
        return;
      }
      if (
        (t === "IMAGE" || t === "GIF" || t === "VIDEO") &&
        typeof v.src !== "string"
      ) {
        changes.push({
          field,
          change: `removed ${t} element without a src URL (cannot invent media)`,
        });
        return;
      }
      if (t === "SVG" && typeof v.svg !== "string") {
        changes.push({
          field,
          change: "removed SVG element without svg markup",
        });
        return;
      }
      if (t === "TEXT") {
        const hasText = typeof v.text === "string" && v.text.trim().length > 0;
        const hasHtml = typeof v.html === "string" && v.html.trim().length > 0;
        if (!hasText && !hasHtml) {
          changes.push({
            field,
            change: "removed empty TEXT element (no text or html)",
          });
          return;
        }
        if (typeof v.text === "string" && /[<>]/.test(v.text) && !hasHtml) {
          v.html = v.text;
          delete v.text;
          changes.push({
            field,
            change: "moved markup from text to html (text must be plain)",
          });
        }
      }
      // strip unknown keys (backend would strip them anyway) — but KEEP
      // template-only fields (condition/iterate/...): they are the design
      // logic of template-shaped payloads and resolve at template render.
      for (const k of Object.keys(v)) {
        if (!VISUAL_KEYS[t].includes(k) && !TEMPLATE_ONLY_KEYS.has(k)) {
          delete v[k];
          changes.push({
            field: `${field}.${k}`,
            change: `removed unknown field "${k}"`,
          });
        }
      }
      if (imageMode) {
        for (const k of IMAGE_FORBIDDEN_ITEM_FIELDS) {
          drop(
            v,
            k,
            `${field}.${k}`,
            `removed "${k}" — timing fields are not applicable to image renders`,
          );
        }
      }
      // swap reversed timings
      if (
        isNum(v.enterBegin) &&
        isNum(v.enterEnd) &&
        v.enterEnd < v.enterBegin
      ) {
        [v.enterBegin, v.enterEnd] = [v.enterEnd, v.enterBegin];
        changes.push({ field, change: "swapped reversed enterBegin/enterEnd" });
      }
      if (isNum(v.exitBegin) && isNum(v.exitEnd) && v.exitEnd < v.exitBegin) {
        [v.exitBegin, v.exitEnd] = [v.exitEnd, v.exitBegin];
        changes.push({ field, change: "swapped reversed exitBegin/exitEnd" });
      }
      // clamp common numerics
      clampField(v, "opacity", `${field}.opacity`, 0, 1);
      clampField(v, "angle", `${field}.angle`, -360, 360);
      if (t === "VIDEO") {
        clampField(v, "volume", `${field}.volume`, 0, 1);
        clampField(v, "speed", `${field}.speed`, 0.1, 10);
      }
      out.push(v);
    });
    return out;
  };

  if (Array.isArray(p.visuals)) {
    p.visuals = repairVisualArray(p.visuals, "visuals", isImage);
  }
  if (Array.isArray(p.scenes)) {
    p.scenes.forEach((s: unknown, i: number) => {
      if (!isObj(s)) return;
      if (Array.isArray(s.visuals)) {
        s.visuals = repairVisualArray(
          s.visuals,
          `scenes[${i}].visuals`,
          isImage,
        );
      }
      if (isNum(s.duration) && s.duration !== -1 && s.duration <= 0) {
        s.duration = -1;
        changes.push({
          field: `scenes[${i}].duration`,
          change: "set non-positive duration to -1 (auto)",
        });
      }
    });
  }

  // audios (top-level and per-scene)
  const repairAudioArray = (audios: unknown, prefix: string) => {
    if (!Array.isArray(audios)) return;
    audios.forEach((a: unknown, i: number) => {
      if (!isObj(a)) return;
      const field = `${prefix}[${i}]`;
      // Editor-authored payloads carry fields (e.g. track) the backend
      // schema rejects with unknown(false) — strip them like visual keys,
      // keeping template-only fields intact.
      for (const k of Object.keys(a)) {
        if (!AUDIO_KEYS.has(k) && !TEMPLATE_ONLY_KEYS.has(k)) {
          delete a[k];
          changes.push({
            field: `${field}.${k}`,
            change: `removed unknown field "${k}"`,
          });
        }
      }
      clampField(a, "volume", `${field}.volume`, 0, 1);
      clampField(a, "speed", `${field}.speed`, 0.1, 10);
      if (isNum(a.enter) && isNum(a.exit) && a.exit < a.enter) {
        [a.enter, a.exit] = [a.exit, a.enter];
        changes.push({ field, change: "swapped reversed enter/exit" });
      }
      if (
        isNum(a.audioBegin) &&
        isNum(a.audioEnd) &&
        a.audioEnd < a.audioBegin
      ) {
        [a.audioBegin, a.audioEnd] = [a.audioEnd, a.audioBegin];
        changes.push({ field, change: "swapped reversed audioBegin/audioEnd" });
      }
    });
  };
  repairAudioArray(p.audios, "audios");
  if (Array.isArray(p.scenes)) {
    p.scenes.forEach((s: unknown, i: number) => {
      if (isObj(s)) repairAudioArray(s.audios, `scenes[${i}].audios`);
    });
  }

  // subtitle
  if (isObj(p.subtitle)) {
    const sub = p.subtitle;
    if (sub.src !== undefined && sub.captions !== undefined) {
      drop(
        sub,
        "src",
        "subtitle.src",
        "removed src — subtitle takes exactly one of src or captions (kept captions)",
      );
    }
    if (sub.src === undefined && sub.captions === undefined) {
      drop(
        p,
        "subtitle",
        "subtitle",
        "removed subtitle with neither src nor captions",
      );
    } else if (
      sub.styles !== undefined &&
      SUBTITLE_V2_KEYS.some((k) => sub[k] !== undefined)
    ) {
      drop(
        sub,
        "styles",
        "subtitle.styles",
        "removed legacy styles block — cannot be combined with flat v2 style keys (kept v2 keys)",
      );
    }
  }

  // strip unknown top-level keys
  for (const k of Object.keys(p)) {
    if (!PROJECT_KEYS.has(k)) {
      delete p[k];
      changes.push({
        field: k,
        change: `removed unknown top-level field "${k}"`,
      });
    }
  }

  return { repaired: p, changes, result: validateProject(p, options) };
}

// ---------------------------------------------------------------------------
// Element docs
// ---------------------------------------------------------------------------

export interface ElementFieldDoc {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ElementDoc {
  type: string;
  kind: "visual" | "audio" | "subtitle" | "scene";
  summary: string;
  requiredFields: string[];
  fields: ElementFieldDoc[];
  notes: string[];
  example: Record<string, unknown>;
}

const BASE_FIELD_DOCS: ElementFieldDoc[] = [
  {
    name: "position",
    type: `enum(${POSITION_PRESETS.length})`,
    description:
      'Placement preset. Sets BOTH the canvas point AND the anchor, and OVERWRITES x/y (they only work with "custom"). Presets are flush with the frame edges (no margin). Two elements with the same preset render exactly stacked.',
  },
  {
    name: "x / y",
    type: "number",
    description:
      'Anchor-point coordinates in canvas px — ONLY honored when position is "custom" (may be negative). E.g. a CTA 80px above the bottom of a 720p canvas: { position: "custom", x: 640, y: 640, anchor: "center-center" }.',
  },
  {
    name: "width / height",
    type: "number",
    description: "Element size in px (1..plan maxInputResolution).",
  },
  {
    name: "anchor",
    type: "enum",
    description:
      'Which point of the ELEMENT sits at the position point (same values as position). Defaults to the position preset; with "custom" it defaults to top-left.',
  },
  {
    name: "resize",
    type: '"contain" | "cover"',
    description: "How media fills its box.",
  },
  {
    name: "enterBegin / enterEnd",
    type: "number (s)",
    description: "Enter animation window in seconds; enterEnd >= enterBegin.",
  },
  {
    name: "exitBegin / exitEnd",
    type: "number (s)",
    description: "Exit animation window in seconds; exitEnd >= exitBegin.",
  },
  {
    name: "enterAnimation / exitAnimation",
    type: "xfade enum | null",
    description: `One of ${XFADE_EFFECTS.length} xfade effects, e.g. "fade", "slideleft", "circleopen".`,
  },
  { name: "opacity", type: "number 0..1", description: "Element opacity." },
  {
    name: "angle",
    type: "number -360..360",
    description: "Rotation in degrees.",
  },
  {
    name: "flipH / flipV",
    type: "boolean",
    description: "Mirror the element.",
  },
  {
    name: "track",
    type: "integer >= 0",
    description: "Z-order; higher tracks render on top.",
  },
];

const MEDIA_FIELD_DOCS: ElementFieldDoc[] = [
  {
    name: "src",
    type: "URL",
    required: true,
    description:
      "Public http(s) media URL (SSRF-checked; no private hosts, port 80/443 only).",
  },
  {
    name: "cropParams",
    type: "{x,y,width,height}",
    description:
      "Crop rectangle in source pixels (all four required if present).",
  },
  {
    name: "filter",
    type: "object",
    description:
      "brightness/contrast/saturate (-100..100), hue-rotate/blur (strings), invert, colorTint (#hex).",
  },
  {
    name: "chromaKey",
    type: "{color!, similarity?, blend?}",
    description:
      "Green-screen keying; color is a #hex, similarity/blend 0..100.",
  },
  {
    name: "zoom",
    type: "boolean | {depth: 1..10}",
    description: "Ken Burns zoom (true = 1.2x depth).",
  },
  {
    name: "radius",
    type: "{tl?,tr?,bl?,br?}",
    description: "Rounded corners in px.",
  },
];

export function getElementDocs(type: string): ElementDoc | undefined {
  const t = type.toUpperCase();
  const docs: Record<string, ElementDoc> = {
    IMAGE: {
      type: "IMAGE",
      kind: "visual",
      summary:
        "A raster image (jpg/png/webp/...) placed on the canvas. Allowed in video AND image projects.",
      requiredFields: ["type", "src"],
      fields: [...MEDIA_FIELD_DOCS, ...BASE_FIELD_DOCS],
      notes: [
        "Count is plan-limited across the whole project (project visuals + all scene visuals).",
        'Use resize: "cover" + width/height to fill a region; combine with zoom for Ken Burns.',
      ],
      example: {
        type: "IMAGE",
        src: "https://picsum.photos/seed/zvid/1280/720",
        position: "center-center",
        width: 1280,
        height: 720,
        resize: "cover",
        enterAnimation: "fade",
        enterBegin: 0,
        enterEnd: 0.5,
        zoom: { depth: 1.3 },
      },
    },
    VIDEO: {
      type: "VIDEO",
      kind: "visual",
      summary:
        "A video clip placed on the canvas. VIDEO projects only (forbidden in image renders).",
      requiredFields: ["type", "src"],
      fields: [
        ...MEDIA_FIELD_DOCS,
        {
          name: "videoBegin / videoEnd",
          type: "number (s)",
          description: "Trim window in SOURCE time; videoEnd >= videoBegin.",
        },
        {
          name: "videoDuration",
          type: "number (s)",
          description: "Play only this many seconds of the source.",
        },
        {
          name: "volume",
          type: "number 0..1",
          description: "Clip audio volume.",
        },
        {
          name: "speed",
          type: "number 0.1..10",
          description: "Playback speed multiplier.",
        },
        {
          name: "id / transitionId / transition / transitionDuration",
          type: "linking",
          description:
            "Chain clips: set transition on a clip and transitionId pointing at the next clip's id for an xfade between them.",
        },
        {
          name: "frameRate",
          type: "integer 1..60",
          description: "Override the source frame rate.",
        },
        {
          name: "hasAudio",
          type: "boolean",
          description: "Hint that the source has audio.",
        },
        ...BASE_FIELD_DOCS,
      ],
      notes: [
        "Count is plan-limited (Free: 5 videos).",
        "For sequential storytelling prefer `scenes` with per-scene visuals + scene transitions.",
      ],
      example: {
        type: "VIDEO",
        src: "https://your-cdn.example.com/clip.mp4",
        position: "center-center",
        width: 1280,
        height: 720,
        videoBegin: 2,
        videoEnd: 8,
        volume: 0.8,
      },
    },
    GIF: {
      type: "GIF",
      kind: "visual",
      summary: "An animated GIF placed on the canvas. VIDEO projects only.",
      requiredFields: ["type", "src"],
      fields: [...MEDIA_FIELD_DOCS, ...BASE_FIELD_DOCS],
      notes: [
        "Count is plan-limited.",
        "GIFs loop for the duration they are visible.",
      ],
      example: {
        type: "GIF",
        src: "https://media.example.com/sticker.gif",
        position: "bottom-right",
        width: 320,
        height: 320,
        enterBegin: 1,
        enterEnd: 1.4,
      },
    },
    SVG: {
      type: "SVG",
      kind: "visual",
      summary:
        "Inline SVG markup drawn on the canvas (shapes, badges, decorations). Allowed in video AND image projects.",
      requiredFields: ["type", "svg"],
      fields: [
        {
          name: "svg",
          type: "string",
          required: true,
          description: `Inline markup starting with <svg>, max ${MAX_SVG_CHARS} chars. Sanitized: no scripts/foreignObject/event handlers/external refs; dims <= ${MAX_SVG_DIMENSION}px; no 8+ digit integers.`,
        },
        {
          name: "filter / chromaKey",
          type: "object",
          description: "Same as IMAGE.",
        },
        {
          name: "customCode",
          type: "{css?, js?, animationDuration?}",
          description:
            "Sandboxed animation code (no network/storage/navigation; max 15s).",
        },
        {
          name: "designer",
          type: "object",
          description: "Opaque Design Studio round-trip metadata.",
        },
        ...BASE_FIELD_DOCS,
      ],
      notes: [
        "Only geometry elements are allowed inside: g, defs, linearGradient, radialGradient, stop, path, circle, ellipse, rect, polygon, polyline, line.",
        "Paint attributes accept keywords/#hex/rgb()/hsl() or url(#localGradientId) — never external URLs.",
        "PREFER HTML for rectangles/pills/cards/badges with text: build ONE TEXT element whose style carries backgroundColor/borderRadius and whose html carries the label — an SVG box plus a separately-positioned TEXT on top misaligns and overflows. Use SVG only for genuine vector artwork (logos, icons, organic shapes).",
      ],
      example: {
        type: "SVG",
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#7c3aed"/></svg>',
        position: "top-right",
        width: 160,
        height: 160,
      },
    },
    TEXT: {
      type: "TEXT",
      kind: "visual",
      summary:
        "Styled text. Needs non-empty `text` (plain) and/or `html` (limited markup). Allowed in video AND image projects.",
      requiredFields: ["type", "text (or html)"],
      fields: [
        {
          name: "text",
          type: "string",
          description: `Plain text, max ${MAX_TEXT_LEN} chars. MUST NOT contain < or > — use html for markup.`,
        },
        {
          name: "html",
          type: "string",
          description: `Limited HTML, max ${MAX_HTML_LEN} chars. Allowed tags: b, strong, i, em, u, s, br, span, div, p, ul, ol, li, img, canvas, svg. Allowed attrs: style, class, src, alt, width, height. No <script>/<style>/events.`,
        },
        {
          name: "style",
          type: "object",
          description: `CSS object (max ${MAX_STYLE_PROPS} props): {"fontSize": "64px", "color": "#ffffff", "fontWeight": 700, "fontFamily": "Inter"}. url()/@import/expression()/CSS comments are rejected.`,
        },
        {
          name: "customCode",
          type: "{css?, js?, animationDuration?}",
          description: "Sandboxed Design Studio animation code.",
        },
        {
          name: "designer",
          type: "object",
          description: "Opaque Design Studio metadata.",
        },
        ...BASE_FIELD_DOCS,
      ],
      notes: [
        "Font sizing/styling lives in `style` (CSS-like), not top-level fields — top-level fontSize/color are IGNORED.",
        'Style values must not contain url() or @import (fonts load from Google Fonts via fontFamily; default "Poppins").',
        'LAYOUT: text renders at the TOP of its box — add display: "flex", alignItems: "center", justifyContent: "center" to center it. Padding renders OUTSIDE width/height (content-box) and gets cut off: size cards via width/height + flex centering, never via padding.',
        "Put a headline + subline INSIDE one element via `html` (two <p> tags with inline styles) instead of two positioned elements — they can never overlap or drift apart.",
        "Cards/pills/buttons: ONE TEXT element with backgroundColor/borderRadius on `style` and the label inside — not an SVG/IMAGE box plus a separate TEXT on top.",
        'Contrast: keep text ≥ 4.5:1 against what\'s behind it; over photos/video add a scrim layer (full-canvas TEXT, html "<div></div>", style backgroundColor rgba(2,6,23,0.55)) beneath the text.',
      ],
      example: {
        type: "TEXT",
        html: '<p style="font-size:76px;font-weight:800;margin-bottom:14px">Launch day is here</p><p style="font-size:36px;color:#c7d2fe">One JSON in, one video out</p>',
        position: "center-center",
        width: 1000,
        height: 260,
        style: {
          color: "#ffffff",
          textAlign: "center",
          fontFamily: "Inter",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        },
        enterAnimation: "fade",
        enterBegin: 0.3,
        enterEnd: 0.8,
      },
    },
    AUDIO: {
      type: "AUDIO",
      kind: "audio",
      summary:
        "A soundtrack / voice-over entry in the `audios` array (project- or scene-level). VIDEO projects only.",
      requiredFields: [
        "src (practically — an entry without src plays nothing)",
      ],
      fields: [
        {
          name: "src",
          type: "URL",
          description: "Public http(s) audio URL (mp3/wav/...).",
        },
        {
          name: "enter / exit",
          type: "number (s)",
          description: "Timeline window when the audio plays; exit >= enter.",
        },
        {
          name: "volume",
          type: "number 0..1",
          description: "Playback volume.",
        },
        {
          name: "speed",
          type: "number 0.1..10",
          description: "Playback speed.",
        },
        {
          name: "audioBegin / audioEnd",
          type: "number (s)",
          description: "Trim window in SOURCE time; audioEnd >= audioBegin.",
        },
        {
          name: "audioDuration",
          type: "number (s)",
          description: "Play only this many seconds of the source.",
        },
      ],
      notes: [
        "Lives in `audios: [...]`, not `visuals`.",
        "Total audio count (project + scenes) is plan-limited.",
      ],
      example: {
        src: "https://cdn.example.com/music/upbeat.mp3",
        enter: 0,
        exit: 10,
        volume: 0.4,
      },
    },
    SUBTITLE: {
      type: "SUBTITLE",
      kind: "subtitle",
      summary:
        "Burned-in captions via the top-level `subtitle` object. VIDEO projects only. Content: exactly one of `src` (SRT/VTT URL) or `captions`.",
      requiredFields: ["src XOR captions"],
      fields: [
        { name: "src", type: "URL", description: "SRT or VTT file URL." },
        {
          name: "captions",
          type: "array",
          description:
            "[{start, end, text?, words?}] — seconds; words: [{start, end, text}] for word-accurate timing (auto-distributed from text when omitted).",
        },
        {
          name: "animation",
          type: `enum(${SUBTITLE_ANIMATIONS.length})`,
          description: SUBTITLE_ANIMATIONS.join(", "),
        },
        {
          name: "font",
          type: "object",
          description:
            "{family, size (1..1000), color (#rrggbb[aa]), bold, italic, transform}.",
        },
        {
          name: "stroke",
          type: "{color!, width!}",
          description: "Text outline; width 0..100.",
        },
        {
          name: "background",
          type: "object",
          description:
            "{color, opacity 0..1, padding 0..200, radius 0..200} caption box.",
        },
        {
          name: "activeWord",
          type: "object",
          description:
            "{color, background, radius} for the currently spoken word (karaoke/highlight modes).",
        },
        {
          name: "position",
          type: "enum",
          description: SUBTITLE_POSITIONS_V2.join(", "),
        },
        {
          name: "margin",
          type: "{x?, y?}",
          description: "Pixel margins from the frame edge.",
        },
        {
          name: "maxWordsPerLine",
          type: "integer 1..20",
          description: "Re-chunk captions to at most N words per line.",
        },
        {
          name: "direction",
          type: "up|down|left|right",
          description: 'Slide direction for animation: "slide".',
        },
        {
          name: "styles",
          type: "object (LEGACY)",
          description:
            "Old style block — cannot be combined with the flat keys above.",
        },
      ],
      notes: [
        "Caption count is plan-limited.",
        "Use the flat v2 style keys for new payloads; `styles` is legacy.",
      ],
      example: {
        captions: [
          { start: 0, end: 2.2, text: "Welcome to Zvid" },
          { start: 2.2, end: 4.5, text: "Videos from JSON in seconds" },
        ],
        animation: "karaoke",
        font: { family: "Inter", size: 42, color: "#ffffffff", bold: true },
        activeWord: { color: "#facc15ff" },
        position: "bottom-center",
        maxWordsPerLine: 6,
      },
    },
    SCENE: {
      type: "SCENE",
      kind: "scene",
      summary:
        "A timeline segment in `scenes`. Scenes play sequentially; each carries its own visuals/audios and an optional transition into the NEXT scene.",
      requiredFields: [],
      fields: [
        {
          name: "id",
          type: "string",
          description:
            "Scene id (letters/digits/_/-), referenced by transitionId.",
        },
        {
          name: "duration",
          type: "number (s) | -1",
          description:
            "-1 (or omitted) auto-computes from content; else 0.1..plan maxDuration.",
        },
        {
          name: "transition",
          type: "xfade enum | null",
          description: "Blend into the next scene.",
        },
        {
          name: "transitionDuration",
          type: "number 0..60",
          description:
            "Overlap seconds (default 0.5). Subtracted from the total duration.",
        },
        {
          name: "transitionId",
          type: "string | null",
          description:
            "Normally omit; the transition applies to the next scene when omitted/null/'none'/equal to its id.",
        },
        {
          name: "backgroundColor",
          type: "#hex",
          description: "Scene background.",
        },
        {
          name: "visuals",
          type: "array",
          description:
            "Elements visible during this scene (timing fields are scene-relative).",
        },
        {
          name: "audios",
          type: "array",
          description: "Audio entries scoped to this scene.",
        },
      ],
      notes: [
        "Scene count is plan-limited.",
        "When EVERY scene has an explicit duration, the project duration is auto-computed (sum minus transition overlaps) and must fit the plan's maxDuration.",
      ],
      example: {
        id: "intro",
        duration: 4,
        transition: "slideleft",
        transitionDuration: 0.5,
        backgroundColor: "#0b0b12",
        visuals: [
          {
            type: "TEXT",
            text: "Scene one",
            position: "center-center",
            style: { fontSize: "64px", color: "#ffffff" },
          },
        ],
      },
    },
  };
  return docs[t];
}

export function listElements(): Array<{
  type: string;
  kind: string;
  summary: string;
  requiredFields: string[];
}> {
  return [
    "IMAGE",
    "VIDEO",
    "GIF",
    "SVG",
    "TEXT",
    "AUDIO",
    "SUBTITLE",
    "SCENE",
  ].map((t) => {
    const d = getElementDocs(t)!;
    return {
      type: d.type,
      kind: d.kind,
      summary: d.summary,
      requiredFields: d.requiredFields,
    };
  });
}

// ---------------------------------------------------------------------------
// Examples (all payload examples pass validateProject)
// ---------------------------------------------------------------------------

export interface Example {
  name: string;
  title: string;
  description: string;
  /** A project payload (POST body's `payload`) unless `request` is set. */
  payload?: Record<string, unknown>;
  /** A full render request body (for template/webhook examples). */
  request?: Record<string, unknown>;
}

export const EXAMPLES: Example[] = [
  {
    name: "promo-video",
    title: "10-second scene-based promo video",
    description:
      "A professional 720p 10s promo built the recommended way: three scenes (hook → value → CTA) so messages never collide, a scrim between the photo and the headline for contrast, headline + subline inside ONE html block, and a CTA pill built as a single flex-centered card. Replace the media URLs with your own.",
    payload: {
      type: "video",
      name: "Promo 10s",
      width: 1280,
      height: 720,
      frameRate: 30,
      outputFormat: "mp4",
      backgroundColor: "#0b1020",
      scenes: [
        {
          id: "hook",
          duration: 3.5,
          transition: "fade",
          transitionDuration: 0.5,
          backgroundColor: "#0b1020",
          visuals: [
            {
              type: "IMAGE",
              src: "https://picsum.photos/seed/zvid-promo/1280/720",
              position: "center-center",
              width: 1280,
              height: 720,
              resize: "cover",
              zoom: { depth: 1.2 },
              track: 0,
            },
            {
              // scrim: guarantees headline contrast over any photo
              type: "TEXT",
              html: "<div></div>",
              position: "center-center",
              width: 1280,
              height: 720,
              style: { backgroundColor: "rgba(2,6,23,0.55)" },
              track: 1,
            },
            {
              // headline + subline live in ONE block — they can never overlap
              type: "TEXT",
              html: '<p style="font-size:80px;font-weight:800;margin-bottom:16px">Meet Zvid</p><p style="font-size:38px;color:#c7d2fe">Videos from JSON in seconds</p>',
              position: "center-center",
              width: 1040,
              height: 280,
              style: {
                color: "#ffffff",
                textAlign: "center",
                fontFamily: "Inter",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              },
              enterAnimation: "fade",
              enterBegin: 0.3,
              enterEnd: 0.9,
              track: 2,
            },
          ],
        },
        {
          id: "value",
          duration: 4,
          transition: "fade",
          transitionDuration: 0.5,
          backgroundColor: "#0b1020",
          visuals: [
            {
              type: "TEXT",
              html: '<p style="font-size:64px;font-weight:800;margin-bottom:18px">One JSON in.<br>One video out.</p><p style="font-size:34px;color:#93c5fd">Templates, subtitles, bulk renders and webhooks built in</p>',
              position: "center-center",
              width: 1040,
              height: 360,
              style: {
                color: "#ffffff",
                textAlign: "center",
                fontFamily: "Inter",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              },
              enterAnimation: "fade",
              enterBegin: 0.2,
              enterEnd: 0.7,
            },
          ],
        },
        {
          id: "cta",
          duration: 3.5,
          backgroundColor: "#0b1020",
          visuals: [
            {
              type: "TEXT",
              text: "Start creating today",
              position: "custom",
              x: 640,
              y: 300,
              anchor: "center-center",
              width: 900,
              height: 110,
              style: {
                fontSize: "64px",
                fontWeight: 800,
                color: "#ffffff",
                textAlign: "center",
                fontFamily: "Inter",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
              enterAnimation: "fade",
              enterBegin: 0.2,
              enterEnd: 0.7,
            },
            {
              // CTA pill: ONE element — size via width/height, label flex-centered
              // inside (no padding: it would render outside the box and get cut)
              type: "TEXT",
              text: "zvid.io — Start free",
              position: "custom",
              x: 640,
              y: 440,
              anchor: "center-center",
              width: 420,
              height: 76,
              style: {
                backgroundColor: "#facc15",
                color: "#0f172a",
                borderRadius: "38px",
                fontSize: "30px",
                fontWeight: 700,
                fontFamily: "Inter",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
              enterAnimation: "circleopen",
              enterBegin: 0.8,
              enterEnd: 1.4,
            },
          ],
        },
      ],
      audios: [
        {
          src: "https://cdn.example.com/music/upbeat.mp3",
          enter: 0,
          exit: 10,
          volume: 0.35,
        },
      ],
    },
  },
  {
    name: "template-render",
    title: "Render from a template with variables",
    description:
      "Render request that references a stored template and fills its {{placeholders}}. Use preview_template / POST /api/templates/:id/preview first for a free dry run.",
    request: {
      template: "tpl_Ab12Cd34Ef56Gh78Ij90",
      variables: {
        headline: "Summer sale",
        cta: "Shop now",
        brandColor: "#7c3aed",
      },
      overrides: { name: "summer-sale-v1" },
    },
  },
  {
    name: "still-image",
    title: "Still-image render (transparent PNG)",
    description:
      "A 1080x1080 social card rendered as a transparent PNG. The card is ONE html TEXT element — background, rounded corners and both text lines live together, so nothing can misalign (prefer this over an SVG box + separate TEXT). Image projects forbid time-domain fields (duration, scenes, audios, subtitle) and VIDEO/GIF elements.",
    payload: {
      type: "image",
      name: "Social card",
      width: 1080,
      height: 1080,
      outputFormat: "png",
      transparent: true,
      visuals: [
        {
          type: "TEXT",
          html: '<p style="font-size:132px;font-weight:900;margin-bottom:20px">50% OFF</p><p style="font-size:44px;color:#e9d5ff">This weekend only</p>',
          position: "center-center",
          width: 900,
          height: 900,
          style: {
            backgroundColor: "#7c3aed",
            borderRadius: "48px",
            color: "#ffffff",
            textAlign: "center",
            fontFamily: "Inter",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          },
        },
      ],
    },
  },
  {
    name: "subtitles",
    title: "Video with karaoke subtitles",
    description:
      "Scene-based video with burned-in captions using the v2 flat subtitle style (animation, font, activeWord). Content rule: exactly ONE of src or captions.",
    payload: {
      type: "video",
      name: "Subtitled clip",
      resolution: "youtube-short",
      scenes: [
        {
          id: "main",
          duration: 6,
          backgroundColor: "#111827",
          visuals: [
            {
              // youtube-short canvas is 1080x1920 — custom position gives the
              // title a real top margin (presets are flush with the edge)
              type: "TEXT",
              text: "Captions demo",
              position: "custom",
              x: 540,
              y: 320,
              anchor: "center-center",
              width: 900,
              height: 130,
              style: {
                fontSize: "60px",
                fontWeight: 700,
                color: "#ffffff",
                textAlign: "center",
                fontFamily: "Inter",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
          ],
        },
      ],
      subtitle: {
        captions: [
          { start: 0, end: 2, text: "Welcome to Zvid" },
          { start: 2, end: 4, text: "captions are burned in" },
          { start: 4, end: 6, text: "with word level timing" },
        ],
        animation: "karaoke",
        font: { family: "Inter", size: 44, color: "#ffffffff", bold: true },
        activeWord: { color: "#facc15ff" },
        background: { color: "#000000aa", padding: 12, radius: 8 },
        position: "bottom-center",
        maxWordsPerLine: 5,
      },
    },
  },
  {
    name: "webhook-flow",
    title: "Render with webhook notification",
    description:
      'Fire-and-forget render: attach a per-job webhookUrl and receive render.completed / render.failed (HMAC-SHA256 signed: X-Zvid-Signature over "<X-Zvid-Timestamp>.<raw body>") instead of polling.',
    request: {
      payload: {
        type: "video",
        name: "Webhook demo",
        width: 1280,
        height: 720,
        duration: 5,
        visuals: [
          {
            type: "TEXT",
            text: "Ping me when done",
            position: "center-center",
            width: 900,
            height: 140,
            style: {
              fontSize: "64px",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              fontFamily: "Inter",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          },
        ],
        backgroundColor: "#1e1b4b",
      },
      webhookUrl: "https://hooks.example.com/zvid/render-done",
    },
  },
];

export function getExample(name: string): Example | undefined {
  return EXAMPLES.find((e) => e.name === name);
}
