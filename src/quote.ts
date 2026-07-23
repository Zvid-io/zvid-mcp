import crypto from "node:crypto";

export interface RenderQuote {
  version: 1;
  draftId: string;
  payloadHash: string;
  projectVersion: number;
  mediaType: "video" | "image";
  estimatedCredits: number;
  expiresAt: string;
}

export interface QuoteOptions {
  now?: () => Date;
  ttlSeconds?: number;
}

const DEFAULT_QUOTE_TTL_SECONDS = 15 * 60;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function idempotencyKeyForQuote(quoteToken: string): string {
  const bytes = crypto
    .createHash("sha256")
    .update(`zvid-render:${quoteToken}`)
    .digest()
    .subarray(0, 16);
  // RFC 4122 version 5 + variant bits. The hash input is already namespaced.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

export function issueRenderQuote(
  input: Omit<RenderQuote, "version" | "expiresAt">,
  secret: string,
  options: QuoteOptions = {},
): { quote: RenderQuote; quoteToken: string } {
  if (!secret) throw new Error("A quote signing secret is required");
  const now = options.now?.() ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
  const quote: RenderQuote = {
    version: 1,
    ...input,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
  const body = encode(canonicalJson(quote));
  return { quote, quoteToken: `${body}.${sign(body, secret)}` };
}

export function verifyRenderQuote(
  token: string,
  secret: string,
  options: Pick<QuoteOptions, "now"> = {},
): RenderQuote {
  if (!secret) throw new Error("A quote signing secret is required");
  const [body, signature, extra] = String(token).split(".");
  if (!body || !signature || extra !== undefined) {
    throw new Error("Invalid render quote token");
  }
  const expected = sign(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("Invalid render quote signature");
  }

  let quote: RenderQuote;
  try {
    quote = JSON.parse(decode(body)) as RenderQuote;
  } catch {
    throw new Error("Invalid render quote payload");
  }
  if (
    quote.version !== 1 ||
    typeof quote.draftId !== "string" ||
    typeof quote.payloadHash !== "string" ||
    typeof quote.projectVersion !== "number" ||
    !["video", "image"].includes(quote.mediaType) ||
    typeof quote.estimatedCredits !== "number" ||
    typeof quote.expiresAt !== "string"
  ) {
    throw new Error("Invalid render quote fields");
  }
  const now = options.now?.() ?? new Date();
  if (new Date(quote.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Render quote expired; call get_media to obtain a new quote");
  }
  return quote;
}
