import assert from "node:assert/strict";
import test from "node:test";

import { apiErrorText } from "@/lib/i18n/api-errors";
import { budgetFor, rateLimit } from "@/lib/security/rate-limit";

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
