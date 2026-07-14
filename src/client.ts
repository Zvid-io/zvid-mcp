/**
 * Minimal typed HTTP client for the Zvid orchestrator REST API.
 *
 * Auth: requests carry either a legacy API key in `X-Api-Key` or an OAuth
 * access token in `Authorization: Bearer`. Hosted MCP clients use OAuth; the
 * API-key path remains for stdio and self-hosted integrations.
 */

export interface ZvidClientOptions {
  apiKey?: string;
  accessToken?: string;
  /** Base URL of the orchestrator, default https://api.zvid.io */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export class ZvidApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ZvidApiError";
  }
}

export const DEFAULT_BASE_URL = "https://api.zvid.io";

export class ZvidClient {
  private readonly apiKey?: string;
  private readonly accessToken?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ZvidClientOptions) {
    if ((!opts.apiKey && !opts.accessToken) || (opts.apiKey && opts.accessToken)) {
      throw new Error("Provide exactly one Zvid credential: apiKey or accessToken.");
    }
    this.apiKey = opts.apiKey;
    this.accessToken = opts.accessToken;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    // API-key render/authoring aliases use a /api-key suffix. OAuth follows
    // the user-authenticated routes, which share the same handlers but do not
    // require an api_key_id.
    const effectivePath = this.accessToken
      ? path.replace(/\/api-key(?=\/|$)/g, "")
      : path;
    const url = new URL(this.baseUrl + effectivePath);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const res = await this.fetchImpl(url, {
      method,
      headers: {
        ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
        "Content-Type": "application/json",
        "User-Agent": "zvid-mcp",
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const err = json as { error?: string; message?: string; details?: unknown };
      throw new ZvidApiError(
        res.status,
        err.error ?? `HTTP ${res.status}`,
        err.message ?? `Zvid API request failed with HTTP ${res.status}`,
        err.details
      );
    }
    return json as T;
  }

  get<T = unknown>(path: string, query?: RequestOptions["query"]) {
    return this.request<T>("GET", path, { query });
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body });
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
