/**
 * Minimal typed HTTP client for the Zvid orchestrator REST API.
 *
 * Auth: every request carries the user's API key in the `X-Api-Key` header
 * (format `zvid_<64 hex chars>`). Create keys in the Zvid dashboard.
 *
 * TODO: superseded by the official SDK in ../../sdk-typescript (package
 * `zvid-sdk`) — same fetch surface plus typed resources, waitForRender and
 * webhook signature verification. Once zvid-sdk is published to npm, replace
 * this file with `import { ZvidClient } from "zvid-sdk"`.
 */

export interface ZvidClientOptions {
  apiKey: string;
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ZvidClientOptions) {
    if (!opts.apiKey) {
      throw new Error(
        "Missing Zvid API key. Set the ZVID_API_KEY environment variable (create a key in the Zvid dashboard under Settings → API Keys)."
      );
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const res = await this.fetchImpl(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey,
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
