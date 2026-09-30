import assert from "node:assert/strict";
import test from "node:test";

/**
 * A "verified" badge is only honest if it can expire.
 *
 * These tests pin down two things: that old information is visibly old, and
 * that the health endpoint tells an operator what is wrong without telling
 * the world anything secret.
 */

// A sentinel key, so we can prove the health endpoint reports capability
// without ever echoing a credential.
process.env.DASHSCOPE_API_KEY = "sk-sentinel-must-never-appear-in-a-response";

import { daysSince, describeAge, freshnessOf, summariseFreshness } from "@/lib/freshness";
import { GET } from "@/app/api/health/route";

const TODAY = new Date("2026-09-30T00:00:00Z");
const ago = (days: number) => new Date(TODAY.getTime() - days * 86_400_000).toISOString().slice(0, 10);

/* ─────────────────── Age ─────────────────── */

test("days are counted from the verification date", () => {
  assert.equal(daysSince("2026-09-03", TODAY), 27);
  assert.equal(daysSince("2026-09-30", TODAY), 0);
});

test("an unreadable date is unknown, never fresh", () => {
  assert.equal(daysSince("not-a-date"), null);
  assert.equal(daysSince(""), null);
  assert.equal(freshnessOf("not-a-date", "general", TODAY).state, "unknown");
  assert.equal(freshnessOf(undefined, "general", TODAY).state, "unknown");
});

/* ─────────────────── Deadlines age faster than helplines ─────────────────── */

test("a scholarship deadline goes stale long before a helpline number", () => {
  const twentyDaysAgo = ago(20);

  const deadline = freshnessOf(twentyDaysAgo, "opportunity", TODAY);
  const helpline = freshnessOf(twentyDaysAgo, "contact", TODAY);

  assert.equal(deadline.state, "aging", "a 20-day-old deadline is worth re-checking");
  assert.equal(helpline.state, "fresh", "a 20-day-old phone number is not");
});

test("a medical camp is the most perishable kind of record", () => {
  assert.equal(freshnessOf(ago(10), "camp", TODAY).state, "aging");
  assert.equal(freshnessOf(ago(20), "camp", TODAY).state, "stale");
});

test("thresholds step fresh → aging → stale in order", () => {
  assert.equal(freshnessOf(ago(5), "general", TODAY).state, "fresh");
  assert.equal(freshnessOf(ago(70), "general", TODAY).state, "aging");
  assert.equal(freshnessOf(ago(200), "general", TODAY).state, "stale");
});

/* ─────────────────── Age, in the reader's language ─────────────────── */

test("the age is described, not just counted", () => {
  for (const language of ["en", "ur", "ps", "hkp"] as const) {
    assert.ok(describeAge(0, language).length > 0, `${language}: today`);
    assert.ok(describeAge(1, language).length > 0, `${language}: yesterday`);
    assert.ok(describeAge(27, language).length > 0, `${language}: 27 days`);
    assert.ok(describeAge(200, language).length > 0, `${language}: months`);
  }
  assert.match(describeAge(0, "en"), /today/);
  assert.match(describeAge(1, "en"), /yesterday/);
  assert.match(describeAge(27, "en"), /27 days ago/);
  assert.match(describeAge(200, "en"), /months ago/);
  assert.equal(describeAge(null, "en"), "");
});

/* ─────────────────── Whole-corpus summary ─────────────────── */

test("the summary counts what needs a re-check and names the worst offenders", () => {
  const summary = summariseFreshness(
    [
      { id: "fresh-1", kind: "contact", lastVerified: ago(3) },
      { id: "aging-1", kind: "general", lastVerified: ago(70) },
      { id: "stale-1", kind: "opportunity", lastVerified: ago(200) },
      { id: "undated", kind: "general" },
    ],
    TODAY,
  );

  assert.equal(summary.total, 4);
  assert.equal(summary.fresh, 1);
  assert.equal(summary.aging, 1);
  assert.equal(summary.stale, 1);
  assert.equal(summary.unknown, 1);
  assert.deepEqual(summary.staleIds, ["stale-1"]);
  assert.equal(summary.oldestDays, 200);
});

/* ─────────────────── The health endpoint ─────────────────── */

test("the health endpoint answers, and never leaks a credential", async () => {
  const response = await GET();
  assert.equal(response.status, 200, "a degraded Raahi still serves citizens");

  const body = (await response.json()) as Record<string, never>;
  const serialised = JSON.stringify(body);

  assert.ok(serialised.length > 0);
  assert.equal(body["ready"], true);
  assert.ok(["ok", "degraded"].includes(body["status"] as string));

  // The whole point: capabilities are booleans, secrets stay secret.
  assert.equal((body["capabilities"] as { ai: boolean }).ai, true, "it should know the key is set");
  assert.doesNotMatch(serialised, /sk-sentinel/, "but it must never print the key");
  assert.doesNotMatch(serialised, /DASHSCOPE_API_KEY/i);
});

test("the health endpoint reports every provider we fall back from", async () => {
  const body = (await GET().then((response) => response.json())) as {
    providers: Record<string, { open: boolean; failures: number }>;
  };
  for (const name of ["dashscope-chat", "dashscope-vision", "dashscope-audio", "dashscope-embeddings"]) {
    assert.ok(body.providers[name], `${name} should be reported so an outage is visible`);
    assert.equal(typeof body.providers[name].open, "boolean");
  }
});

test("the health endpoint reports how much of the corpus has gone stale", async () => {
  const body = (await GET().then((response) => response.json())) as {
    dataFreshness: { total: number; fresh: number; aging: number; stale: number; unknown: number; staleIds: string[] };
  };
  assert.ok(body.dataFreshness.total > 50, "the whole corpus should be scanned");
  assert.equal(
    body.dataFreshness.fresh + body.dataFreshness.aging + body.dataFreshness.stale + body.dataFreshness.unknown,
    body.dataFreshness.total,
    "every record is accounted for",
  );
  assert.ok(Array.isArray(body.dataFreshness.staleIds));
});

test("the health endpoint is not cached", async () => {
  const response = await GET();
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});
