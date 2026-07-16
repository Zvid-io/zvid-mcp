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

  /**
   * API-key render/authoring aliases use a /api-key suffix. OAuth follows
   * the user-authenticated routes, which share the same handlers but do not
   * require an api_key_id. Only /api/render paths carry such aliases —
   * scoping the rewrite there keeps arbitrary path segments (e.g. a library
   * slug literally named "api-key") intact.
   */
  private effectivePath(path: string): string {
    return this.accessToken && path.startsWith("/api/render")
      ? path.replace(/\/api-key(?=\/|$)/g, "")
      : path;
  }

  private authHeaders(): Record<string, string> {
    return {
      ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
      ...(this.accessToken
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {}),
      "Content-Type": "application/json",
      "User-Agent": "zvid-mcp",
    };
  }

  private async parseResponse<T>(res: Response): Promise<T> {
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

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const url = new URL(this.baseUrl + this.effectivePath(path));
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const res = await this.fetchImpl(url, {
      method,
      headers: this.authHeaders(),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return this.parseResponse<T>(res);
  }

  /**
   * GET a JSON document that the API may answer with a redirect to a public
   * CDN (e.g. /api/library/:kind/:slug/content → 302 cdn.zvid.io). The
   * redirect is followed manually WITHOUT auth headers so the account
   * credential never reaches the CDN host — fetch's automatic redirect
   * forwards X-Api-Key cross-origin.
   */
  async getRedirectedJson<T = unknown>(path: string): Promise<T> {
    const url = new URL(this.baseUrl + this.effectivePath(path));
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: this.authHeaders(),
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new ZvidApiError(
          res.status,
          `HTTP ${res.status}`,
          "Redirect response was missing a Location header"
        );
      }
      // CDN connects are occasionally flaky — retry transient network
      // failures (not HTTP errors) a couple of times before giving up.
      let cdnRes: Response | undefined;
      let lastNetworkError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          cdnRes = await this.fetchImpl(new URL(location, url), {
            method: "GET",
            headers: { "User-Agent": "zvid-mcp" },
          });
          break;
        } catch (err) {
          lastNetworkError = err;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }
      if (!cdnRes) {
        throw new ZvidApiError(
          502,
          "CONTENT_FETCH_FAILED",
          `Content host unreachable after 3 attempts: ${
            lastNetworkError instanceof Error
              ? lastNetworkError.message
              : String(lastNetworkError)
          }`
        );
      }
      if (!cdnRes.ok) {
        throw new ZvidApiError(
          cdnRes.status,
          `HTTP ${cdnRes.status}`,
          `Content fetch failed with HTTP ${cdnRes.status}`
        );
      }
      const text = await cdnRes.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ZvidApiError(
          502,
          "INVALID_CONTENT",
          "Content host returned non-JSON content"
        );
      }
    }

    return this.parseResponse<T>(res);
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
