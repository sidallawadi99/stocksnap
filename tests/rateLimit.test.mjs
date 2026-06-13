import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, clientIp } from "../src/lib/rateLimit.js";

test("allows requests up to the limit, then blocks", () => {
  const key = `t1-${Math.random()}`;
  for (let i = 1; i <= 3; i++) assert.equal(rateLimit(key, 3, 1000).ok, true, `call ${i} should pass`);
  assert.equal(rateLimit(key, 3, 1000).ok, false, "4th call should be blocked");
});

test("different keys are counted independently", () => {
  const a = `t2a-${Math.random()}`;
  const b = `t2b-${Math.random()}`;
  rateLimit(a, 1, 1000);
  assert.equal(rateLimit(a, 1, 1000).ok, false, "key a exhausted");
  assert.equal(rateLimit(b, 1, 1000).ok, true, "key b is fresh");
});

test("the window resets after it elapses", async () => {
  const key = `t3-${Math.random()}`;
  assert.equal(rateLimit(key, 1, 40).ok, true);
  assert.equal(rateLimit(key, 1, 40).ok, false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(rateLimit(key, 1, 40).ok, true, "should allow again after the window");
});

test("reports remaining and a retryAfter", () => {
  const key = `t4-${Math.random()}`;
  const r = rateLimit(key, 5, 1000);
  assert.equal(r.remaining, 4);
  assert.ok(r.retryAfter >= 0 && r.retryAfter <= 1);
});

test("clientIp prefers x-forwarded-for, falls back to 'local'", () => {
  const withXff = { headers: { get: (h) => (h === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null) } };
  assert.equal(clientIp(withXff), "1.2.3.4");
  const none = { headers: { get: () => null } };
  assert.equal(clientIp(none), "local");
});
