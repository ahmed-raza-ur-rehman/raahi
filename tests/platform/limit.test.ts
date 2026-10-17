import assert from "node:assert/strict";
import test from "node:test";
import { gcra } from "@/lib/platform/limit/gcra";
import { RATE_POLICIES, checkRateLimit, rateLimitHeaders } from "@/lib/platform/limit/limiter";
import { MemoryRateLimitStore } from "@/lib/platform/limit/store";

test("[REQ-SEC-001] GCRA lets a burst through, limits the next request and recovers one cell per interval", () => {
  const params = { intervalMs: 1000, burst: 3 };
  let tat: number | undefined;
  const at = (now: number) => {
    const result = gcra(tat, now, params);
    if (result.allowed) tat = result.nextTat;
    return result;
  };
  const first = at(0);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 2);
  assert.equal(first.resetAfterMs, 1000);
  assert.equal(at(0).remaining, 1);
  assert.equal(at(0).remaining, 0);

  const denied = at(0);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 1000);
  assert.equal(denied.remaining, 0);
  assert.equal(at(999).allowed, false);
  assert.equal(at(1000).allowed, true);
});

test("[REQ-SEC-001] GCRA state is untouched by a rejected request and fully recovers after a quiet period", () => {
  const params = { intervalMs: 500, burst: 2 };
  let tat: number | undefined;
  for (const now of [0, 0]) tat = gcra(tat, now, params).nextTat;
  const rejected = gcra(tat, 0, params);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.nextTat, tat, "a rejected request must not consume credit");

  const later = gcra(tat, 60_000, params);
  assert.equal(later.allowed, true);
  assert.equal(later.remaining, 1, "after a long pause the whole burst is available again");
});

test("[REQ-SEC-001] GCRA rejects nonsensical parameters and a cost larger than the burst can never succeed", () => {
  assert.throws(() => gcra(undefined, 0, { intervalMs: 0, burst: 1 }), RangeError);
  assert.throws(() => gcra(undefined, 0, { intervalMs: 10, burst: 0 }), RangeError);
  const impossible = gcra(undefined, 0, { intervalMs: 1000, burst: 2, cost: 3 });
  assert.equal(impossible.allowed, false);
  assert.equal(impossible.retryAfterMs, Number.POSITIVE_INFINITY);
});

test("[REQ-SEC-001] checkRateLimit scales policies by tier and reports headers clients can act on", async () => {
  const store = new MemoryRateLimitStore();
  const anon = RATE_POLICIES.tools;
  let last = await checkRateLimit({ policy: "tools", tier: "anonymous", subject: "a", nowMs: 0, store });
  assert.equal(last.limit, anon.rpm);
  assert.equal(last.allowed, true);

  for (let index = 1; index < anon.burst; index++) last = await checkRateLimit({ policy: "tools", tier: "anonymous", subject: "a", nowMs: 0, store });
  assert.equal(last.allowed, true);
  const denied = await checkRateLimit({ policy: "tools", tier: "anonymous", subject: "a", nowMs: 0, store });
  assert.equal(denied.allowed, false);

  const headers = rateLimitHeaders(denied);
  assert.equal(headers["RateLimit-Limit"], String(anon.rpm));
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.ok(Number(headers["Retry-After"]) >= 1);
  assert.match(headers["RateLimit-Policy"], /^\d+;w=60$/);

  const device = await checkRateLimit({ policy: "tools", tier: "device", subject: "d", multiplier: 4, nowMs: 0, store });
  assert.equal(device.limit, anon.rpm * 4);
  const other = await checkRateLimit({ policy: "tools", tier: "anonymous", subject: "someone-else", nowMs: 0, store });
  assert.equal(other.allowed, true, "buckets are per subject");
});

test("[REQ-SEC-001] the global scale knob raises and lowers every limit", async () => {
  const store = new MemoryRateLimitStore();
  const halved = await checkRateLimit({ policy: "read", tier: "anonymous", subject: "x", scale: 0.5, nowMs: 0, store });
  assert.equal(halved.limit, Math.ceil(RATE_POLICIES.read.rpm * 0.5));
  const doubled = await checkRateLimit({ policy: "read", tier: "anonymous", subject: "y", scale: 2, nowMs: 0, store });
  assert.equal(doubled.limit, RATE_POLICIES.read.rpm * 2);
});

test("[REQ-SEC-001] the in-memory store is bounded: an attacker rotating identities cannot grow memory without limit", () => {
  const store = new MemoryRateLimitStore(100);
  const params = { intervalMs: 1000, burst: 5 };
  for (let index = 0; index < 1_000; index++) store.hit(`attacker-${index}`, 0, params);
  assert.ok(store.size <= 100, `store grew to ${store.size}`);
});

test("[REQ-SEC-001] expired entries disappear on their own (no leak for well-behaved traffic)", () => {
  const store = new MemoryRateLimitStore(50);
  const params = { intervalMs: 1000, burst: 2 };
  for (let index = 0; index < 50; index++) store.hit(`k${index}`, 0, params);
  // All 50 entries are expired by t = 10 s; the next insert past the cap sweeps them.
  for (let index = 0; index < 5; index++) store.hit(`fresh-${index}`, 10_000, params);
  assert.ok(store.size <= 50);
  const reused = store.hit("k0", 10_000, params);
  assert.equal(reused.allowed, true);
  assert.equal(reused.remaining, 1, "an expired entry behaves exactly like a fresh bucket");
});
