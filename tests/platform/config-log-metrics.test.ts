import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { loadConfig } from "@/lib/platform/config";
import { ApiError } from "@/lib/platform/errors";
import { createLogger, sanitize } from "@/lib/platform/log";
import { Counter, Histogram, metrics } from "@/lib/platform/metrics";
import { problemType, toProblem } from "@/lib/platform/problem";

const goodSecret = randomBytes(32).toString("base64url");

test("[REQ-SEC-003] configuration: valid secrets load in order (first signs); weak or malformed ones are dropped without being echoed", () => {
  const config = loadConfig({ NODE_ENV: "production", RAAHI_TOKEN_SECRETS: `k2:${goodSecret}, k1:${randomBytes(48).toString("base64url")}` });
  assert.deepEqual(config.tokenSecrets.map((entry) => entry.kid), ["k2", "k1"]);

  const weak = loadConfig({ NODE_ENV: "production", RAAHI_TOKEN_SECRETS: "k1:c2hvcnQ,bad id:abc,k3" });
  assert.equal(weak.tokenSecrets.length, 0, "a weak or malformed secret must disable device tokens, never weaken them");
  assert.ok(weak.warnings.length >= 2);
  assert.ok(!weak.warnings.join(" ").includes("c2hvcnQ"), "warnings must not contain secret material");

  const duplicate = loadConfig({ RAAHI_TOKEN_SECRETS: `k1:${goodSecret},k1:${goodSecret}` });
  assert.equal(duplicate.tokenSecrets.length, 1);
});

test("[REQ-SEC-005] configuration: API key records are validated and bad entries are ignored individually", () => {
  const valid = { id: "neuroprep", hash: "a".repeat(64), scopes: ["read", "tools"], rpm: 600 };
  const config = loadConfig({
    RAAHI_API_KEYS: JSON.stringify([valid, { ...valid, id: "bad id" }, { ...valid, id: "weakhash", hash: "short" }, { ...valid, id: "extra", unknown: true }, valid]),
  });
  assert.deepEqual(config.apiKeys.map((key) => key.id), ["neuroprep"]);
  assert.equal(config.warnings.length, 4);
  assert.equal(loadConfig({ RAAHI_API_KEYS: "not json" }).apiKeys.length, 0);
  assert.equal(loadConfig({ RAAHI_API_KEYS: '{"id":"x"}' }).apiKeys.length, 0);
  assert.equal(loadConfig({ RAAHI_API_KEYS: JSON.stringify([{ ...valid, scopes: ["admin"] }]) }).apiKeys.length, 0, "an API key can never carry the admin scope");
});

test("[REQ-SEC-006] configuration: the admin secret needs 24+ characters; CRON_SECRET is honoured as a fallback", () => {
  assert.equal(loadConfig({ RAAHI_ADMIN_SECRET: "short" }).adminSecret, undefined);
  assert.equal(loadConfig({ RAAHI_ADMIN_SECRET: "x".repeat(24) }).adminSecret, "x".repeat(24));
  assert.equal(loadConfig({ CRON_SECRET: "y".repeat(30) }).adminSecret, "y".repeat(30));
  assert.equal(loadConfig({ RAAHI_ADMIN_SECRET: "x".repeat(24), CRON_SECRET: "y".repeat(30) }).adminSecret, "x".repeat(24));
  assert.equal(loadConfig({}).adminSecret, undefined);
  assert.ok(!loadConfig({ RAAHI_ADMIN_SECRET: "short-secret" }).warnings.join(" ").includes("short-secret"));
});

test("[REQ-SEC-011] configuration: CORS origins must be https (or localhost); site origin is always included", () => {
  const config = loadConfig({
    NEXT_PUBLIC_SITE_URL: "https://raahi-phi.vercel.app/path?x=1",
    RAAHI_CORS_ORIGINS: "https://psc-ajk.vercel.app, http://evil.example, javascript:alert(1), http://localhost:3000",
  });
  assert.deepEqual([...config.corsOrigins].sort(), ["http://localhost:3000", "https://psc-ajk.vercel.app", "https://raahi-phi.vercel.app"]);
  assert.equal(config.warnings.length, 2);
});

test("[REQ-OPS-001] configuration: sane defaults per environment and clamped numeric knobs", () => {
  const prod = loadConfig({ NODE_ENV: "production" });
  assert.equal(prod.trustedProxies, 1);
  assert.equal(prod.validateResponses, false);
  assert.equal(prod.logLevel, "info");
  assert.equal(loadConfig({ NODE_ENV: "development" }).trustedProxies, 0);
  assert.equal(loadConfig({ NODE_ENV: "development" }).validateResponses, true);
  assert.equal(loadConfig({ NODE_ENV: "test" }).logLevel, "silent");
  assert.equal(loadConfig({ RAAHI_TRUSTED_PROXIES: "99" }).trustedProxies, 5);
  assert.equal(loadConfig({ RAAHI_TOKEN_TTL_SECONDS: "5" }).tokenTtlSeconds, 300);
  assert.equal(loadConfig({ RAAHI_RATE_LIMIT_SCALE: "-3" }).rateLimitScale, 1);
  assert.equal(loadConfig({ RAAHI_RATE_LIMIT_SCALE: "1000" }).rateLimitScale, 100);
  assert.deepEqual(loadConfig({ RAAHI_POW_BITS: "18" }).powBits, { base: 18, max: 24 });
});

test("[REQ-SEC-016] logs redact credentials by key name, truncate long values, survive cycles and never throw", () => {
  const lines: string[] = [];
  const logger = createLogger({ level: "debug", sink: (line) => lines.push(line), now: () => new Date("2026-10-15T00:00:00Z") });
  const cyclic: Record<string, unknown> = { name: "loop" };
  cyclic.self = cyclic;

  logger.info("hello", {
    authorization: "Bearer abc",
    nested: { apiKey: "rk.x.y", Cookie: "s=1", password: "hunter2", keep: "visible", token: "t" },
    long: "z".repeat(1000),
    cyclic,
    error: new Error("boom", { cause: new Error("inner") }),
  });
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.ts, "2026-10-15T00:00:00.000Z");
  assert.equal(entry.level, "info");
  assert.equal(entry.authorization, "[redacted]");
  assert.deepEqual(entry.nested, { apiKey: "[redacted]", Cookie: "[redacted]", password: "[redacted]", keep: "visible", token: "[redacted]" });
  assert.ok(entry.long.length < 400);
  assert.equal(entry.cyclic.self, "[circular]");
  assert.equal(entry.error.message, "boom");
  assert.equal(entry.error.cause.message, "inner");
  assert.ok(!lines[0].includes("hunter2") && !lines[0].includes("Bearer abc"));

  const failing = createLogger({ level: "debug", sink: () => { throw new Error("disk full"); } });
  assert.doesNotThrow(() => failing.error("still fine"));
  assert.equal(sanitize(() => 1), undefined);
});

test("[REQ-OPS-001] log levels filter and child loggers add context", () => {
  const lines: string[] = [];
  const logger = createLogger({ level: "warn", sink: (line) => lines.push(line) });
  logger.debug("no");
  logger.info("no");
  logger.child({ requestId: "r-1" }).warn("yes");
  logger.error("also yes");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).requestId, "r-1");
});

test("[REQ-OPS-002] metrics render valid Prometheus text, escape labels and cap label cardinality", () => {
  const counter = new Counter("t_total", "A test counter.", ["route"]);
  counter.inc({ route: "a" });
  counter.inc({ route: "a" }, 2);
  counter.inc({ route: 'we"ird\nvalue\\' });
  const text = counter.expose().join("\n");
  assert.match(text, /# TYPE t_total counter/);
  assert.match(text, /t_total\{route="a"\} 3/);
  assert.match(text, /route="we\\"ird\\nvalue\\\\"/);

  for (let index = 0; index < 1_000; index++) counter.inc({ route: `attacker-${index}` });
  assert.ok(counter.expose().length < 400, "label sets are capped; excess folds into `other`");
  assert.equal(counter.total(), 3 + 1 + 1_000);

  const histogram = new Histogram("t_seconds", "A test histogram.", [0.1, 1], ["op"]);
  histogram.observe(0.05, { op: "x" });
  histogram.observe(0.5, { op: "x" });
  const lines = histogram.expose().join("\n");
  assert.match(lines, /t_seconds_bucket\{le="0.1",op="x"\} 1/);
  assert.match(lines, /t_seconds_bucket\{le="1",op="x"\} 2/);
  assert.match(lines, /t_seconds_bucket\{le="\+Inf",op="x"\} 2/);
  assert.match(lines, /t_seconds_count\{op="x"\} 2/);

  assert.match(metrics.expose(), /raahi_http_requests_total/);
});

test("[REQ-API-002] problems follow RFC 9457: stable code and URN type, request id, field errors; 5xx detail is generic", () => {
  const client = toProblem(new ApiError("validation_failed", "text: too long", { errors: [{ path: "text", code: "too_big", message: "too long" }] }), { requestId: "req-1", instance: "/api/v1/x" });
  assert.equal(client.problem.status, 422);
  assert.equal(client.problem.code, "validation_failed");
  assert.equal(client.problem.type, "urn:raahi:problem:validation-failed");
  assert.equal(client.problem.requestId, "req-1");
  assert.equal(client.problem.instance, "/api/v1/x");
  assert.equal(client.problem.detail, "text: too long");
  assert.equal(client.problem.errors?.length, 1);
  assert.equal(problemType("rate_limited"), "urn:raahi:problem:rate-limited");

  const leaky = toProblem(new Error("SQLITE_ERROR: no such table users at /srv/app/lib/db.ts:42"), { requestId: "req-2" });
  assert.equal(leaky.problem.status, 500);
  assert.equal(leaky.problem.code, "internal");
  assert.ok(!JSON.stringify(leaky.problem).match(/sqlite|\/srv|db\.ts/i), "internals must not reach the client");

  const server = toProblem(new ApiError("unavailable", "database password is hunter2"), {});
  assert.ok(!server.problem.detail?.includes("hunter2"), "even an ApiError's message is replaced for 5xx");

  const limited = toProblem(new ApiError("rate_limited", "slow down", { headers: { "Retry-After": "7" } }), {});
  assert.equal(limited.headers["Retry-After"], "7");
});
