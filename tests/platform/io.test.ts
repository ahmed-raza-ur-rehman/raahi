import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ApiError } from "@/lib/platform/errors";
import { readJsonBody } from "@/lib/platform/net/body";
import { anonymiseIp, clientIp, normaliseIp } from "@/lib/platform/net/client-ip";
import { corsHeaders, isCrossSiteWrite } from "@/lib/platform/net/cors";
import { etagOf, ifNoneMatchHits } from "@/lib/platform/net/etag";
import { apiSecurityHeaders, buildPageCsp, pageSecurityHeaders } from "@/lib/platform/net/headers";
import { parseBody, parseQuery } from "@/lib/platform/net/validate";

const post = (body: BodyInit | null, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Request("http://localhost/x", { method: "POST", body, headers });

const code = (expected: string) => (error: unknown) => error instanceof ApiError && error.code === expected;

// ─── Request bodies ────────────────────────────────────────────────────────────

test("[REQ-SEC-008] JSON bodies must declare a JSON content type", async () => {
  await assert.rejects(readJsonBody(post("{}", { "content-type": "text/plain" }), 1024), code("unsupported_media_type"));
  await assert.rejects(readJsonBody(post("{}", {}), 1024), code("unsupported_media_type"));
  assert.deepEqual(await readJsonBody(post('{"a":1}', { "content-type": "application/json; charset=utf-8" }), 1024), { a: 1 });
  assert.deepEqual(await readJsonBody(post('{"a":1}', { "content-type": "application/vnd.api+json" }), 1024), { a: 1 });
});

test("[REQ-SEC-008] the size limit is enforced while streaming, not after buffering", async () => {
  await assert.rejects(readJsonBody(post(JSON.stringify({ text: "x".repeat(2000) })), 1000), code("payload_too_large"));

  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1000;
      controller.enqueue(new Uint8Array(1000).fill(0x61));
      if (pulled > 1_000_000) controller.close();
    },
  });
  const hostile = new Request("http://localhost/x", { method: "POST", body: stream, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonBody(hostile, 4096), code("payload_too_large"));
  assert.ok(pulled < 100_000, `the reader kept pulling after the limit (${pulled} bytes)`);

  await assert.rejects(readJsonBody(post("{}", { "content-type": "application/json", "content-length": "999999" }), 1024), code("payload_too_large"));
});

test("[REQ-SEC-008] malformed, empty, non-UTF-8 and prototype-polluting bodies are rejected with generic messages", async () => {
  await assert.rejects(readJsonBody(post("{not json"), 1024), code("invalid_json"));
  await assert.rejects(readJsonBody(post(""), 1024), code("invalid_json"));
  await assert.rejects(readJsonBody(post(new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])), 1024), code("invalid_json"));
  for (const evil of ['{"__proto__":{"admin":true}}', '{"a":{"constructor":{"prototype":{"x":1}}}}', '{"nested":[{"__proto__":1}]}']) {
    await assert.rejects(readJsonBody(post(evil), 1024), code("invalid_json"));
  }
  assert.equal(({} as Record<string, unknown>).admin, undefined);
  try {
    await readJsonBody(post("{oops"), 1024);
  } catch (error) {
    assert.ok(!/position|token|unexpected/i.test((error as Error).message), "parser internals must not leak");
  }
});

// ─── Query / body validation ───────────────────────────────────────────────────

const querySchema = z.object({ q: z.string().max(10).optional(), limit: z.string().regex(/^\d+$/).optional() }).strict();

test("[REQ-API-003] queries: duplicates, unknown keys and over-long strings are rejected; the value is never echoed", () => {
  assert.deepEqual(parseQuery(querySchema, new URLSearchParams("q=abc&limit=5")), { q: "abc", limit: "5" });
  assert.throws(() => parseQuery(querySchema, new URLSearchParams("q=a&q=b")), code("invalid_parameter"));
  assert.throws(() => parseQuery(querySchema, new URLSearchParams("nope=1")), code("unknown_parameter"));
  assert.throws(() => parseQuery(querySchema, new URLSearchParams("limit=abc")), code("invalid_parameter"));
  assert.throws(() => parseQuery(querySchema, new URLSearchParams(`q=${"x".repeat(3000)}`)), code("invalid_parameter"));

  try {
    parseQuery(querySchema, new URLSearchParams("q=SECRET-VALUE-THAT-IS-TOO-LONG"));
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error instanceof ApiError);
    assert.ok(!JSON.stringify(error.errors).includes("SECRET-VALUE"), "field errors must not echo submitted values");
    assert.equal(error.errors?.[0].path, "q");
  }
});

test("[REQ-API-003] unknown parameter names are sanitised before they appear in an error", () => {
  try {
    parseQuery(querySchema, new URLSearchParams([["<script>alert(1)</script>", "1"]]));
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error instanceof ApiError);
    assert.match(error.errors?.[0].path ?? "", /^[\w.[\]-]+$/);
  }
});

test("[REQ-API-003] bodies map to field-level errors with stable codes (422)", () => {
  const schema = z.object({ text: z.string().max(5), answers: z.object({ a: z.boolean().optional() }).strict().optional() }).strict();
  try {
    parseBody(schema, { text: "toolongvalue", answers: { b: true }, extra: 1 });
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "validation_failed");
    assert.equal(error.status, 422);
    const paths = (error.errors ?? []).map((entry) => entry.path).sort();
    assert.deepEqual(paths, ["answers.b", "extra", "text"]);
  }
});

// ─── Client address ────────────────────────────────────────────────────────────

test("[REQ-SEC-001] X-Forwarded-For is read from the right: forged left-hand entries are ignored", () => {
  const headers = (value: string) => new Headers({ "x-forwarded-for": value });
  assert.equal(clientIp(headers("203.0.113.9"), 1), "203.0.113.9");
  assert.equal(clientIp(headers("6.6.6.6, 203.0.113.9"), 1), "203.0.113.9", "a client-supplied first entry must not win");
  assert.equal(clientIp(headers("6.6.6.6, 198.51.100.4, 203.0.113.9"), 2), "198.51.100.4");
  assert.equal(clientIp(headers("203.0.113.9"), 0), undefined, "0 trusted proxies = ignore the header");
  assert.equal(clientIp(headers("not-an-ip"), 1), undefined);
  assert.equal(clientIp(new Headers({ "x-real-ip": "192.0.2.7" }), 1), "192.0.2.7");
  assert.equal(clientIp(new Headers(), 1), undefined);
});

test("[REQ-SEC-001] IPv6 clients are bucketed by /64 and IPv4-mapped addresses collapse to IPv4", () => {
  assert.equal(normaliseIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
  assert.equal(normaliseIp("2001:db8:1:2::1"), "2001:db8:1:2::/64");
  assert.equal(normaliseIp("2001:DB8:1:2:ffff::"), "2001:db8:1:2::/64");
  assert.equal(normaliseIp("::ffff:192.0.2.128"), "192.0.2.128");
  assert.equal(normaliseIp("[2001:db8::1]"), "2001:db8:0:0::/64");
  assert.equal(normaliseIp("192.0.2.1"), "192.0.2.1");
  for (const bad of ["", "999.1.1.1", "1:2:3", "::g", "a::b::c", "1.2.3.4.5", "javascript:alert(1)"]) assert.equal(normaliseIp(bad), undefined, bad);
});

test("[REQ-SEC-016] anonymised addresses are keyed, stable per salt and contain no part of the address", () => {
  const salt = new Uint8Array(32).fill(7);
  const a = anonymiseIp("203.0.113.9", salt);
  assert.equal(a, anonymiseIp("203.0.113.9", salt));
  assert.notEqual(a, anonymiseIp("203.0.113.9", new Uint8Array(32).fill(8)));
  assert.notEqual(a, anonymiseIp("203.0.113.10", salt));
  assert.ok(!a.includes("203"));
  assert.equal(anonymiseIp(undefined, salt), "unknown");
});

// ─── CORS, CSRF, headers, ETag ─────────────────────────────────────────────────

const corsConfig = { corsOrigins: ["https://raahi-phi.vercel.app", "https://psc-ajk.vercel.app"] };

test("[REQ-SEC-011] public CORS is open for bearer-token APIs; restricted CORS echoes only allow-listed origins and never allows credentials", () => {
  const open = corsHeaders("public", "https://anything.example", corsConfig, ["GET"]);
  assert.equal(open["Access-Control-Allow-Origin"], "*");
  assert.ok(!("Access-Control-Allow-Credentials" in open));
  assert.match(open["Access-Control-Expose-Headers"], /ETag/);

  const allowed = corsHeaders("restricted", "https://psc-ajk.vercel.app", corsConfig, ["POST"]);
  assert.equal(allowed["Access-Control-Allow-Origin"], "https://psc-ajk.vercel.app");
  assert.equal(allowed.Vary, "Origin");
  const denied = corsHeaders("restricted", "https://evil.example", corsConfig, ["POST"]);
  assert.ok(!("Access-Control-Allow-Origin" in denied));
  assert.ok(!("Access-Control-Allow-Origin" in corsHeaders("restricted", null, corsConfig, ["POST"])));
  for (const headers of [open, allowed, denied]) assert.ok(!("Access-Control-Allow-Credentials" in headers));
});

test("[REQ-SEC-012] cross-site writes are refused; same-origin, allow-listed and non-browser callers pass", () => {
  const origin = "https://raahi-phi.vercel.app";
  const check = (headers: Record<string, string>) => isCrossSiteWrite(new Headers(headers), origin, corsConfig);
  assert.equal(check({ origin, "sec-fetch-site": "same-origin" }), false);
  assert.equal(check({ "sec-fetch-site": "none" }), false);
  assert.equal(check({}), false, "curl and the mobile app send neither header and carry no cookies");
  assert.equal(check({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }), true);
  assert.equal(check({ origin: "https://evil.example" }), true);
  assert.equal(check({ origin: "null" }), true, "sandboxed iframes and data: URLs send Origin: null");
  assert.equal(check({ origin: "https://psc-ajk.vercel.app", "sec-fetch-site": "cross-site" }), false);
});

test("[REQ-SEC-010] API responses carry the hardening headers; HSTS only in production", () => {
  const dev = apiSecurityHeaders({ env: "development" });
  assert.equal(dev["X-Content-Type-Options"], "nosniff");
  assert.equal(dev["Content-Security-Policy"], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(dev["X-Frame-Options"], "DENY");
  assert.ok(!("Strict-Transport-Security" in dev));
  assert.match(apiSecurityHeaders({ env: "production" })["Strict-Transport-Security"], /max-age=63072000/);
  assert.match(pageSecurityHeaders({ env: "production" })["Permissions-Policy"], /microphone=\(self\)/);
});

test("[REQ-SEC-013] the page CSP is nonce-based: no unsafe-inline scripts, no framing, no foreign origins", () => {
  const production = buildPageCsp("abc123", { dev: false });
  const script = production.split("; ").find((directive) => directive.startsWith("script-src ")) ?? "";
  assert.ok(script.includes("'nonce-abc123'") && script.includes("'strict-dynamic'"));
  assert.ok(!script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"));
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "upgrade-insecure-requests"]) {
    assert.ok(production.includes(directive), `missing ${directive}`);
  }
  assert.ok(!/https?:\/\//.test(production), "no third-party origin may be allow-listed");

  const dev = buildPageCsp("abc123", { dev: true });
  assert.ok(dev.includes("'unsafe-eval'"), "development needs eval for React's debugging");
  assert.ok(!dev.includes("upgrade-insecure-requests"));
});

test("[REQ-API-005] ETags are stable per body and honour If-None-Match with weak comparison", () => {
  const tag = etagOf('{"a":1}');
  assert.match(tag, /^W\/"[A-Za-z0-9_-]{22}"$/);
  assert.equal(tag, etagOf('{"a":1}'));
  assert.notEqual(tag, etagOf('{"a":2}'));
  assert.equal(ifNoneMatchHits(tag, tag), true);
  assert.equal(ifNoneMatchHits(tag.replace("W/", ""), tag), true, "weak comparison ignores the W/ prefix");
  assert.equal(ifNoneMatchHits(`"other", ${tag}`, tag), true);
  assert.equal(ifNoneMatchHits("*", tag), true);
  assert.equal(ifNoneMatchHits('"other"', tag), false);
  assert.equal(ifNoneMatchHits(null, tag), false);
});
