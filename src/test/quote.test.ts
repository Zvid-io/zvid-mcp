import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPayload,
  idempotencyKeyForQuote,
  issueRenderQuote,
  verifyRenderQuote,
} from "../quote.js";

const NOW = new Date("2026-07-20T10:00:00.000Z");

test("payload hashes are stable across object key order", () => {
  assert.equal(
    hashPayload({ b: 2, nested: { y: 2, x: 1 }, a: 1 }),
    hashPayload({ a: 1, nested: { x: 1, y: 2 }, b: 2 }),
  );
});

test("render quotes are signed, expiring, and tamper evident", () => {
  const issued = issueRenderQuote(
    {
      draftId: "prj_00000000000000000000",
      payloadHash: hashPayload({ type: "video" }),
      projectVersion: 1,
      mediaType: "video",
      estimatedCredits: 4,
    },
    "test-secret",
    { now: () => NOW, ttlSeconds: 60 },
  );

  assert.equal(
    verifyRenderQuote(issued.quoteToken, "test-secret", { now: () => NOW })
      .estimatedCredits,
    4,
  );
  assert.throws(
    () =>
      verifyRenderQuote(`${issued.quoteToken}x`, "test-secret", {
        now: () => NOW,
      }),
    /signature/,
  );
  assert.throws(
    () =>
      verifyRenderQuote(issued.quoteToken, "test-secret", {
        now: () => new Date("2026-07-20T10:01:01.000Z"),
      }),
    /expired/,
  );
});

test("quote-derived idempotency keys are stable UUIDs", () => {
  const first = idempotencyKeyForQuote("signed.quote");
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(idempotencyKeyForQuote("signed.quote"), first);
  assert.notEqual(idempotencyKeyForQuote("other.quote"), first);
});
