import { test } from "node:test";
import assert from "node:assert/strict";
import { ZvidApiError, ZvidClient } from "../client.js";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

test("sends X-Api-Key header and builds query strings", async () => {
  const { impl, calls } = fakeFetch(200, { jobs: [] });
  const client = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000/",
    fetchImpl: impl,
  });

  const res = await client.get("/api/jobs", { page: 2, limit: 5, skip: undefined });
  assert.deepEqual(res, { jobs: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:4000/api/jobs?page=2&limit=5");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["X-Api-Key"], "zvid_test");
});

test("serializes POST bodies as JSON", async () => {
  const { impl, calls } = fakeFetch(202, { jobId: "j1", status: "queued" });
  const client = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000",
    fetchImpl: impl,
  });

  await client.post("/api/render/api-key", { template: "tpl_x", variables: { a: 1 } });
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    template: "tpl_x",
    variables: { a: 1 },
  });
});

test("normalizes API error responses into ZvidApiError", async () => {
  const { impl } = fakeFetch(402, {
    error: "Insufficient credits",
    message: "Not enough credits",
    details: [{ field: "credits" }],
  });
  const client = new ZvidClient({
    apiKey: "zvid_test",
    baseUrl: "http://localhost:4000",
    fetchImpl: impl,
  });

  await assert.rejects(
    () => client.post("/api/render/api-key", { payload: {} }),
    (err: unknown) => {
      assert.ok(err instanceof ZvidApiError);
      assert.equal(err.status, 402);
      assert.equal(err.error, "Insufficient credits");
      return true;
    }
  );
});

test("requires exactly one credential", () => {
  assert.throws(() => new ZvidClient({}), /exactly one Zvid credential/);
  assert.throws(
    () => new ZvidClient({ apiKey: "zvid_test", accessToken: "zvo_at_test" }),
    /exactly one Zvid credential/
  );
});

test("sends OAuth bearer tokens through user-authenticated API routes", async () => {
  const { impl, calls } = fakeFetch(200, { valid: true });
  const client = new ZvidClient({
    accessToken: "zvo_at_test",
    baseUrl: "http://localhost:4000",
    fetchImpl: impl,
  });

  await client.post("/api/render/validate/api-key", { payload: {} });
  assert.equal(calls[0].url, "http://localhost:4000/api/render/validate");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer zvo_at_test");
  assert.equal(headers["X-Api-Key"], undefined);
});
