import assert from "node:assert/strict";
import test from "node:test";

import { apiErrorText } from "@/lib/i18n/api-errors";
import { buildCsp } from "@/proxy";
import {
  budgetFor,
  newVisitorId,
  rateLimit,
  rateLimitRequest,
  readVisitorId,
} from "@/lib/security/rate-limit";

/* ─────────────────── Errors people can actually read ─────────────────── */

test("known server errors are translated for the reader", () => {
  const urdu = apiErrorText("Please check the request details.", "ur");
  assert.notEqual(urdu, "Please check the request details.", "must not leak raw English");
  assert.ok(urdu.length > 0);

  // English speakers still get English.
  const english = apiErrorText("Please check the request details.", "en");
  assert.match(english, /[A-Za-z]/, "English readers must see English");
});

test("an untranslated error degrades to a readable message, never English", () => {
  const message = "Some brand new server error nobody mapped yet";
  const urdu = apiErrorText(message, "ur");
  assert.notEqual(urdu, message, "an unmapped error must not be shown verbatim");
  assert.ok(urdu.length > 0);
});

test("every RTL language gets a readable error", () => {
  for (const language of ["ur", "ps", "hkp"] as const) {
    const text = apiErrorText("Not found.", language);
    assert.ok(text.length > 0, `${language} must render an error`);
    // Pashto and Hindko fall back to Urdu rather than showing English.
    assert.ok(text.includes("نہیں"), `${language} should fall back to Urdu, got: ${text}`);
  }
});

test("a missing error still yields a message", () => {
  assert.ok(apiErrorText(undefined, "ur").length > 0);
  assert.ok(apiErrorText("", "ur").length > 0);
});

/* ─────────────────── Inbound rate limiting ─────────────────── */

test("the rate limiter allows a budget, then refuses", () => {
  const key = `rl-${Date.now()}-allow`;

  for (let i = 0; i < 5; i += 1) {
    assert.equal(rateLimit(key, 5, 60_000).allowed, true, `request ${i + 1} must be allowed`);
  }

  const blocked = rateLimit(key, 5, 60_000);
  assert.equal(blocked.allowed, false, "the request past the budget must be refused");
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfter > 0, "the refusal must say how long to wait");
  assert.equal(blocked.limit, 5);
});

test("the limiter counts each caller separately", () => {
  const shared = `rl-${Date.now()}-shared`;
  rateLimit(`${shared}:a`, 1, 60_000);
  rateLimit(`${shared}:b`, 1, 60_000);

  assert.equal(rateLimit(`${shared}:a`, 1, 60_000).allowed, false, "a is now over budget");
  assert.equal(rateLimit(`${shared}:b`, 1, 60_000).allowed, false, "b is now over budget");
  assert.equal(rateLimit(`${shared}:c`, 1, 60_000).allowed, true, "c is a different caller");
});

test("the window resets once it has passed", () => {
  const key = `rl-${Date.now()}-window`;
  rateLimit(key, 1, 50); // 50ms window

  assert.equal(rateLimit(key, 1, 50).allowed, false, "over budget inside the window");

  const reset = new Promise<void>((resolve) => setTimeout(resolve, 80));
  return reset.then(() => {
    assert.equal(rateLimit(key, 1, 50).allowed, true, "allowed again after the window");
  });
});

test("expensive endpoints get a smaller budget than cheap ones", () => {
  // Routes that reach a paid model must be tighter than local SQLite reads.
  const ask = budgetFor("/api/ask");
  const local = budgetFor("/api/some-local-read");

  assert.ok(ask.limit < local.limit, "a model call must be capped tighter than a local read");
  assert.equal(budgetFor("/api/vision").limit <= 10, true, "OCR is expensive and must stay small");
});

/* ─────────────────── Shared addresses (CGNAT) ─────────────────── */

test("visitors behind one shared address each get their own budget", () => {
  const shared = new Request("http://localhost/api/ask", {
    headers: { "x-forwarded-for": "10.9.9.9" },
  });

  // /api/ask allows 20 per minute. Two different people on the same mobile
  // carrier must not be sharing those 20 requests between them.
  const personA = new Request("http://localhost/api/ask", {
    headers: { "x-forwarded-for": "10.9.9.9", cookie: "raahi_vid=person-a" },
  });
  const personB = new Request("http://localhost/api/ask", {
    headers: { "x-forwarded-for": "10.9.9.9", cookie: "raahi_vid=person-b" },
  });

  for (let index = 0; index < 20; index += 1) {
    assert.equal(rateLimitRequest(personA, "/api/ask").allowed, true, "person A should have their own 20");
  }
  assert.equal(rateLimitRequest(personA, "/api/ask").allowed, false, "person A is now over their limit");

  assert.equal(rateLimitRequest(personB, "/api/ask").allowed, true, "person B is unaffected by person A");
  assert.equal(rateLimitRequest(shared, "/api/ask").allowed, true, "so is a brand new visitor");
});

test("the shared address still has a ceiling, so rotating cookies is not unlimited", () => {
  // Burn through the IP ceiling with a different cookie every time.
  let allowed = 0;
  for (let index = 0; index < 700; index += 1) {
    const request = new Request("http://localhost/api/ask", {
      headers: { "x-forwarded-for": "203.0.113.7", cookie: `raahi_vid=rotating-${index}` },
    });
    if (rateLimitRequest(request, "/api/ask").allowed) allowed += 1;
  }
  assert.ok(allowed > 0, "a fresh address should not be blocked outright");
  assert.ok(allowed < 700, `one address must not get unlimited requests (got ${allowed})`);
});

test("a visitor without a cookie yet is still counted", () => {
  const request = new Request("http://localhost/api/ask", {
    headers: { "x-forwarded-for": "198.51.100.4", "user-agent": "test-browser" },
  });
  let allowed = 0;
  for (let index = 0; index < 25; index += 1) {
    if (rateLimitRequest(request, "/api/ask").allowed) allowed += 1;
  }
  assert.ok(allowed <= 20, "the cookieless fallback must not be more generous than a real visitor");
});

test("the visitor cookie is read from a realistic cookie header", () => {
  assert.equal(newVisitorId().length > 10, true);
  assert.notEqual(newVisitorId(), newVisitorId(), "every visitor gets a distinct id");

  const withOthers = new Request("http://localhost/api/ask", {
    headers: { cookie: "theme=dark; raahi_vid=abc-123; other=1" },
  });
  assert.equal(readVisitorId(withOthers), "abc-123");
  assert.equal(readVisitorId(new Request("http://localhost/api/ask")), undefined);
});

/* ─────────────────── Content-Security-Policy ─────────────────── */

test("the CSP is built around a nonce, not 'unsafe-inline'", () => {
  const csp = buildCsp("test-nonce-value", true);

  assert.match(csp, /script-src [^;]*'nonce-test-nonce-value'/, "scripts must be authorised by nonce");
  assert.ok(!csp.includes("unsafe-inline"), "'unsafe-inline' defeats the nonce entirely");

  // 'strict-dynamic' is what lets the bundles load their own chunks without
  // us having to list every content-hashed file.
  assert.match(csp, /'strict-dynamic'/);
});

test("the production CSP does not allow eval, but development must", () => {
  // React uses eval in development to rebuild server error stacks.
  assert.ok(!buildCsp("n", true).includes("unsafe-eval"), "no eval in production");
  assert.match(buildCsp("n", false), /unsafe-eval/, "development needs it or the app will not run");
});

test("the CSP keeps the hardening that matters for this app", () => {
  const csp = buildCsp("n", true);
  for (const directive of ["object-src 'none'", "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(csp.includes(directive), `${directive} must stay`);
  }
  // The document scanner captures photos to object URLs, and the service
  // worker is loaded from a blob worker context.
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /worker-src 'self' blob:/);
});

test("every request gets a different nonce", () => {
  // A reused nonce is not a nonce. Proxy generates one per request; this
  // guards the helper stays nonce-driven rather than constant-driven.
  const first = buildCsp("aaaa", true);
  const second = buildCsp("bbbb", true);
  assert.notEqual(first, second);
});
