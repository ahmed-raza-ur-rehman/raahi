import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { beforeEach } from "node:test";
import { z } from "zod";
import { generateApiKey } from "@/lib/platform/auth/api-keys";
import { issueDeviceToken } from "@/lib/platform/auth/tokens";
import { setPlatformClock } from "@/lib/platform/clock";
import { loadConfig, setConfigForTests, type PlatformConfig } from "@/lib/platform/config";
import { MemoryRateLimitStore, setRateLimitStore } from "@/lib/platform/limit/store";
import { createLogger, setLoggerForTests } from "@/lib/platform/log";
import { metrics } from "@/lib/platform/metrics";
import { defineOperation, reply } from "@/lib/platform/route";

const NOW_MS = 1_800_000_000_000;
const ADMIN = "an-admin-secret-with-more-than-24-chars";
const partner = generateApiKey("partner");
const readOnlyPartner = generateApiKey("readonly");

let config: PlatformConfig;
let logLines: string[];
let clock = NOW_MS;

beforeEach(() => {
  config = loadConfig({
    NODE_ENV: "test",
    RAAHI_TOKEN_SECRETS: `k1:${randomBytes(32).toString("base64url")}`,
    RAAHI_ADMIN_SECRET: ADMIN,
    RAAHI_TRUSTED_PROXIES: "1",
    RAAHI_CORS_ORIGINS: "https://psc-ajk.vercel.app",
    RAAHI_API_KEYS: JSON.stringify([
      { id: partner.id, hash: partner.hash, scopes: ["read", "tools"], rpm: 900 },
      { id: readOnlyPartner.id, hash: readOnlyPartner.hash, scopes: ["read"], rpm: 90 },
    ]),
  });
  setConfigForTests(config);
  setRateLimitStore(new MemoryRateLimitStore());
  clock = NOW_MS;
  setPlatformClock(() => clock);
  logLines = [];
  setLoggerForTests(createLogger({ level: "debug", sink: (line) => logLines.push(line) }));
  metrics.reset();
});

// ─── A small operation set that exercises every pipeline stage ────────────────

const item = z.object({ id: z.string(), n: z.number().optional() });

const readOp = defineOperation({
  id: "testRead",
  method: "GET",
  path: "/api/v1/test/{id}",
  summary: "Read",
  tags: ["Test"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: { kind: "public", maxAge: 30, sMaxAge: 300, swr: 600 },
  params: z.object({ id: z.string().regex(/^[a-z0-9-]{1,20}$/) }),
  query: z.object({ n: z.string().regex(/^\d+$/).transform(Number).optional() }).strict(),
  responses: { 200: { description: "ok", schema: item } },
  handler: ({ params, query }) => ({ id: params.id, n: query.n }),
});

const toolOp = defineOperation({
  id: "testTool",
  method: "POST",
  path: "/api/v1/test-tool",
  summary: "Tool",
  tags: ["Test"],
  auth: "optional",
  scope: "tools",
  rate: "tools",
  cors: "restricted",
  bodyLimit: 200,
  body: z.object({ text: z.string().max(20) }).strict(),
  responses: { 200: { description: "ok", schema: z.object({ echoed: z.string() }) }, 201: { description: "created", schema: z.object({ echoed: z.string() }) } },
  handler: ({ body }) => (body.text === "make" ? reply({ echoed: body.text }, { status: 201, headers: { Location: "/x" } }) : { echoed: body.text }),
});

const adminOp = defineOperation({
  id: "testAdmin",
  method: "GET",
  path: "/api/v1/test-admin",
  summary: "Admin",
  tags: ["Test"],
  auth: "admin",
  rate: "admin",
  cors: "restricted",
  responses: { 200: { description: "ok", schema: z.object({ ok: z.literal(true) }) } },
  handler: () => ({ ok: true }),
});

const brokenOp = defineOperation({
  id: "testBroken",
  method: "GET",
  path: "/api/v1/test-broken",
  summary: "Returns a body that violates its own schema",
  tags: ["Test"],
  auth: "none",
  rate: "read",
  cors: "public",
  responses: { 200: { description: "ok", schema: z.object({ id: z.string() }) } },
  handler: () => ({ id: 42 }),
});

const crashOp = defineOperation({
  id: "testCrash",
  method: "GET",
  path: "/api/v1/test-crash",
  summary: "Throws",
  tags: ["Test"],
  auth: "none",
  rate: "read",
  cors: "public",
  responses: { 200: { description: "ok" } },
  handler: () => {
    throw new Error("SQLITE_ERROR: no such table secrets (/srv/app/db.ts:7)");
  },
});

const get = (op: typeof readOp, path: string, headers: Record<string, string> = {}, params: Record<string, string> = {}) =>
  op.handle(new Request(`http://localhost${path}`, { headers }), { params: Promise.resolve(params) });

const post = (op: typeof toolOp, body: BodyInit, headers: Record<string, string> = { "content-type": "application/json" }) =>
  op.handle(new Request("http://localhost/api/v1/test-tool", { method: "POST", body, headers }));

const deviceToken = async (installId = "install-1") => (await issueDeviceToken(config, { installId, platform: "android" }, Math.floor(clock / 1000))).token;

// ─── Success path ──────────────────────────────────────────────────────────────

test("[REQ-API-001][REQ-SEC-010] a public GET returns the hardening headers, a request id and public cache headers", async () => {
  const response = await get(readOp, "/api/v1/test/abc?n=5", {}, { id: "abc" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "abc", n: 5 });
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=30, s-maxage=300, stale-while-revalidate=600");
  assert.match(response.headers.get("etag") ?? "", /^W\//);
  assert.match(response.headers.get("vary") ?? "", /Accept-Encoding/);
  assert.equal(response.headers.get("ratelimit-limit"), null, "a shared-cacheable response must not carry one caller's rate-limit budget");
});

test("[REQ-API-005] a matching If-None-Match yields 304 with no body and the same ETag", async () => {
  const first = await get(readOp, "/api/v1/test/abc", {}, { id: "abc" });
  const etag = first.headers.get("etag") ?? "";
  const second = await get(readOp, "/api/v1/test/abc", { "if-none-match": etag }, { id: "abc" });
  assert.equal(second.status, 304);
  assert.equal(await second.text(), "");
  assert.equal(second.headers.get("etag"), etag);
  assert.ok(second.headers.get("cache-control")?.includes("s-maxage"));
  const changed = await get(readOp, "/api/v1/test/abc?n=1", { "if-none-match": etag }, { id: "abc" });
  assert.equal(changed.status, 200, "a different representation must not match");
});

test("[REQ-API-006] credentialed responses are private and report the caller's rate-limit budget", async () => {
  const response = await get(readOp, "/api/v1/test/abc", { authorization: `Bearer ${await deviceToken()}` }, { id: "abc" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, max-age=30");
  assert.equal(response.headers.get("ratelimit-limit"), String(90 * 4), "device tokens get 4x the anonymous budget");
  assert.ok(Number(response.headers.get("ratelimit-remaining")) <= 90 * 4);
  assert.match(response.headers.get("vary") ?? "", /Authorization/);
});

test("[REQ-API-001] handlers can choose a status and extra headers; undeclared statuses are caught as contract violations", async () => {
  const token = await deviceToken();
  const created = await post(toolOp, JSON.stringify({ text: "make" }), { "content-type": "application/json", authorization: `Bearer ${token}` });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("location"), "/x");
  assert.equal(created.headers.get("cache-control"), "no-store");

  const undeclared = defineOperation({ id: "testUndeclared", method: "GET", path: "/x", summary: "x", tags: [], auth: "none", rate: "read", cors: "public", responses: { 200: { description: "ok" } }, handler: () => reply({}, { status: 202 }) });
  const response = await undeclared.handle(new Request("http://localhost/x"));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "contract_violation");
});

// ─── Validation ────────────────────────────────────────────────────────────────

test("[REQ-API-003] strict parameter handling returns problem+json with field paths", async () => {
  const unknown = await get(readOp, "/api/v1/test/abc?bogus=1", {}, { id: "abc" });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.headers.get("content-type"), "application/problem+json; charset=utf-8");
  const problem = await unknown.json();
  assert.equal(problem.code, "unknown_parameter");
  assert.equal(problem.type, "urn:raahi:problem:unknown-parameter");
  assert.equal(problem.instance, "/api/v1/test/abc");
  assert.ok(problem.requestId);
  assert.equal(problem.errors[0].path, "bogus");
  assert.equal(unknown.headers.get("cache-control"), "no-store");

  assert.equal((await (await get(readOp, "/api/v1/test/abc?n=1&n=2", {}, { id: "abc" })).json()).code, "invalid_parameter");
  assert.equal((await (await get(readOp, "/api/v1/test/abc?n=-1", {}, { id: "abc" })).json()).code, "invalid_parameter");
  assert.equal((await (await get(readOp, "/api/v1/test/Bad_Id!", {}, { id: "Bad_Id!" })).json()).code, "invalid_parameter");
  const noQueryOp = defineOperation({ id: "testNoQuery", method: "GET", path: "/x", summary: "x", tags: [], auth: "none", rate: "read", cors: "public", responses: { 200: { description: "ok" } }, handler: () => ({}) });
  assert.equal((await noQueryOp.handle(new Request("http://localhost/x?anything=1"))).status, 400, "an operation without a query schema accepts no query parameters");
});

test("[REQ-SEC-008] request bodies: content type, size, syntax and shape are all enforced before the handler runs", async () => {
  const headers = { "content-type": "application/json", authorization: `Bearer ${await deviceToken()}` };
  assert.equal((await post(toolOp, JSON.stringify({ text: "hello" }), headers)).status, 200);
  assert.equal((await post(toolOp, "text=hello", { ...headers, "content-type": "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await post(toolOp, JSON.stringify({ text: "x".repeat(500) }), headers)).status, 413);
  assert.equal((await post(toolOp, "{nope", headers)).status, 400);
  const invalid = await post(toolOp, JSON.stringify({ text: "x".repeat(30), extra: true }), headers);
  assert.equal(invalid.status, 422);
  const problem = await invalid.json();
  assert.equal(problem.code, "validation_failed");
  assert.deepEqual(problem.errors.map((entry: { path: string }) => entry.path).sort(), ["extra", "text"]);
});

// ─── Authentication, authorisation, rate limits ───────────────────────────────

test("[REQ-SEC-002] scopes: anonymous gets 401, a read-only key gets 403, a device token and a tools key succeed", async () => {
  const body = JSON.stringify({ text: "hi" });
  const anonymous = await post(toolOp, body);
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("www-authenticate") ?? "", /^Bearer realm="raahi"/);

  const readOnly = await post(toolOp, body, { "content-type": "application/json", authorization: `Bearer ${readOnlyPartner.key}` });
  assert.equal(readOnly.status, 403);
  assert.equal((await readOnly.json()).code, "forbidden");

  for (const credential of [await deviceToken(), partner.key]) {
    assert.equal((await post(toolOp, body, { "content-type": "application/json", authorization: `Bearer ${credential}` })).status, 200);
  }
});

test("[REQ-SEC-006] admin operations: only the admin secret opens them", async () => {
  const call = (authorization?: string) => adminOp.handle(new Request("http://localhost/api/v1/test-admin", { headers: authorization ? { authorization } : {} }));
  assert.equal((await call()).status, 401);
  assert.equal((await call(`Bearer ${await deviceToken()}`)).status, 403);
  assert.equal((await call(`Bearer ${partner.key}`)).status, 403);
  assert.equal((await call("Bearer a-wrong-admin-secret-that-is-long-enough")).status, 401);
  assert.equal((await call(`Bearer ${ADMIN}`)).status, 200);

  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_ADMIN_SECRET: "too-short" }));
  assert.equal((await call("Bearer too-short")).status, 401, "a weak secret disables admin access instead of weakening it");
});

test("[REQ-SEC-001] exceeding the limit gives 429 with Retry-After and recovers as time passes", async () => {
  const ip = { "x-forwarded-for": "203.0.113.50" };
  let status = 0;
  let last: Response | undefined;
  for (let index = 0; index < 200 && status !== 429; index++) {
    last = await get(readOp, "/api/v1/test/abc", ip, { id: "abc" });
    status = last.status;
  }
  assert.equal(status, 429);
  assert.ok(last);
  const problem = await last.json();
  assert.equal(problem.code, "rate_limited");
  assert.ok(Number(last.headers.get("retry-after")) >= 1);
  assert.equal(last.headers.get("ratelimit-remaining"), "0");
  assert.equal(last.headers.get("cache-control"), "no-store");

  const neighbour = await get(readOp, "/api/v1/test/abc", { "x-forwarded-for": "203.0.113.51" }, { id: "abc" });
  assert.equal(neighbour.status, 200, "another client is unaffected");

  clock += 61_000;
  assert.equal((await get(readOp, "/api/v1/test/abc", ip, { id: "abc" })).status, 200, "the bucket refills with time");
  assert.ok(metrics.rateLimited.total() >= 1);
});

test("[REQ-SEC-007] repeated bad credentials are throttled so a secret cannot be guessed at wire speed", async () => {
  const statuses: number[] = [];
  for (let index = 0; index < 40; index++) {
    const response = await get(readOp, "/api/v1/test/abc", { authorization: `Bearer guess-${index}`, "x-forwarded-for": "198.51.100.77" }, { id: "abc" });
    statuses.push(response.status);
  }
  assert.equal(statuses[0], 401);
  assert.ok(statuses.includes(429), `no throttling observed: ${[...new Set(statuses)]}`);
  assert.ok(statuses.filter((status) => status === 401).length <= 15);
});

test("[REQ-SEC-002] an expired token is reported as token_expired (so the app knows to re-register)", async () => {
  const token = await deviceToken();
  clock += 2 * 3600 * 1000;
  const response = await get(readOp, "/api/v1/test/abc", { authorization: `Bearer ${token}` }, { id: "abc" });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "token_expired");
  assert.match(response.headers.get("www-authenticate") ?? "", /invalid_token/);
});

// ─── CORS ──────────────────────────────────────────────────────────────────────

test("[REQ-SEC-011] preflight answers without authentication; restricted operations only echo allow-listed origins", async () => {
  const preflight = toolOp.preflight(new Request("http://localhost/api/v1/test-tool", { method: "OPTIONS", headers: { origin: "https://psc-ajk.vercel.app" } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://psc-ajk.vercel.app");
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /Authorization/);
  assert.equal(preflight.headers.get("allow"), "POST, OPTIONS");

  const stranger = toolOp.preflight(new Request("http://localhost/api/v1/test-tool", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  assert.equal(stranger.headers.get("access-control-allow-origin"), null);

  const rejected = await post(toolOp, JSON.stringify({ text: "x" }), { "content-type": "application/json", origin: "https://evil.example" });
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  assert.equal(rejected.headers.get("access-control-allow-credentials"), null);
});

// ─── Opacity, correlation, hygiene ────────────────────────────────────────────

test("[REQ-SEC-015] internal failures return a generic problem; the cause is logged server-side only", async () => {
  const response = await get(crashOp, "/api/v1/test-crash");
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.ok(!/sqlite|\/srv|db\.ts|secrets/i.test(text), `leaked: ${text}`);
  const problem = JSON.parse(text);
  assert.equal(problem.code, "internal");
  assert.ok(problem.requestId);

  const errorLine = logLines.map((line) => JSON.parse(line)).find((line) => line.level === "error" && line.msg === "request failed");
  assert.ok(errorLine, "the failure must be logged");
  assert.match(JSON.stringify(errorLine), /SQLITE_ERROR/);
  assert.equal(errorLine.requestId, problem.requestId, "client and log share the request id");

  const broken = await get(brokenOp, "/api/v1/test-broken");
  assert.equal(broken.status, 500);
  assert.equal((await broken.json()).code, "contract_violation");
  assert.equal(metrics.contractViolations.total(), 1);
});

test("[REQ-OPS-001] request ids: a sane inbound id is kept for correlation, a hostile one is replaced", async () => {
  const kept = await get(readOp, "/api/v1/test/abc", { "x-request-id": "client-trace-12345" }, { id: "abc" });
  assert.equal(kept.headers.get("x-request-id"), "client-trace-12345");
  for (const hostile of ["short", "has space in it 12345", "x".repeat(200), "line\nbreak-forged-entry"]) {
    const response = await get(readOp, "/api/v1/test/abc", { "x-request-id": hostile.replaceAll("\n", " ") }, { id: "abc" });
    assert.notEqual(response.headers.get("x-request-id"), hostile);
    assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  }
});

test("[REQ-SEC-016] request logs carry correlation and tier but never credentials, raw addresses or query strings", async () => {
  const token = await deviceToken("install-secret-id");
  await get(readOp, "/api/v1/test/abc?n=123456", { authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.99" }, { id: "abc" });
  await get(readOp, "/api/v1/test/abc", { "x-forwarded-for": "203.0.113.98" }, { id: "abc" });
  const text = logLines.join("\n");
  assert.ok(!text.includes(token), "the bearer token must never be logged");
  assert.ok(!text.includes("203.0.113.9"), "raw addresses must never be logged");
  assert.ok(!text.includes("install-secret-id"), "install ids are hashed in logs");
  assert.ok(!text.includes("123456"), "query strings must not be logged");
  const entry = logLines.map((line) => JSON.parse(line)).find((line) => line.msg === "request");
  assert.equal(entry.op, "testRead");
  assert.equal(entry.status, 200);
  assert.equal(entry.tier, "device");
  assert.match(entry.subject, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(typeof entry.ms, "number");
});

test("[REQ-OPS-002] every handled request is counted and timed per operation", async () => {
  await get(readOp, "/api/v1/test/abc", {}, { id: "abc" });
  await get(readOp, "/api/v1/test/abc?bogus=1", {}, { id: "abc" });
  assert.equal(metrics.httpRequests.value({ operation: "testRead", method: "GET", status: "2xx" }), 1);
  assert.equal(metrics.httpRequests.value({ operation: "testRead", method: "GET", status: "4xx" }), 1);
  assert.match(metrics.expose(), /raahi_http_request_duration_seconds_count\{operation="testRead"\} 2/);
});
