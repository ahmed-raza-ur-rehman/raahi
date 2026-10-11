import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { join } from "node:path";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps-api.test.db");
process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";

import { GET as ecosystemGET } from "@/app/api/ecosystem/route";
import { GET as calendarGET } from "@/app/api/opportunities/[id]/calendar/route";
import { GET as detailGET } from "@/app/api/opportunities/[id]/route";
import { POST as matchPOST } from "@/app/api/opportunities/match/route";
import { GET as refreshGET } from "@/app/api/opportunities/refresh/route";
import { GET as listGET, OPTIONS as listOPTIONS } from "@/app/api/opportunities/route";
import { POST as scamPOST } from "@/app/api/opportunities/scam-check/route";
import { GET as statusGET } from "@/app/api/opportunities/status/route";
import { GET as resourcesGET } from "@/app/api/resources/route";
import { parseOpportunityQuery } from "@/lib/opportunities/api";
import { setClock } from "@/lib/opportunities/clock";
import { checkLink, checkResources, classify } from "@/lib/opportunities/linkcheck";
import { searchResources } from "@/lib/opportunities/directory";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { loadSnapshotIntoDb } from "@/lib/opportunities/store";
import type { OpportunityView } from "@/lib/opportunities/types";
import { resources } from "@/data/opportunities/resources";
import { allSourceRoutes, createFixtureHttp, fixtureSources } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
setClock(() => NOW);
const get = (path: string) => new Request(`http://localhost${path}`);
const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("setup: load a scraped snapshot", async () => {
  const snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  loadSnapshotIntoDb(snapshot, NOW);
});

test("GET /api/opportunities: filters, CORS and CDN caching", async () => {
  const response = await listGET(get("/api/opportunities?kind=job&scope=pakistan&limit=5&sort=deadline"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);
  const body = (await response.json()) as { total: number; items: OpportunityView[]; facets: { kind: unknown[] }; generatedAt: string };
  assert.ok(body.total >= 10);
  assert.equal(body.items.length, 5);
  assert.ok(body.items.every((item) => item.kind === "job" && item.scope === "pakistan"));
  assert.equal(body.generatedAt, NOW.toISOString());

  const natural = (await (await listGET(get(`/api/opportunities?q=${encodeURIComponent("نوکری")}&limit=3`))).json()) as { items: OpportunityView[]; interpreted: { kinds: string[] } };
  assert.deepEqual(natural.interpreted.kinds, ["job"]);
  assert.ok(natural.items.every((item) => item.kind === "job"));

  const preflight = listOPTIONS();
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /GET/);
});

test("query parameters are validated and clamped, never trusted", () => {
  const parsed = parseOpportunityQuery(new URLSearchParams("kind=job,scholarship,hacking&scope=mars&level=masters&funding=full&pk=1&remote=no&within=9999&limit=100000&offset=-3&sort=weird&q=" + "x".repeat(500)));
  assert.deepEqual(parsed.kinds, ["job", "scholarship"]);
  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.level, "masters");
  assert.equal(parsed.funding, "full");
  assert.equal(parsed.openToPakistan, true);
  assert.equal(parsed.remote, false);
  assert.equal(parsed.deadlineWithinDays, 365);
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.offset, undefined);
  assert.equal(parsed.sort, undefined);
  assert.equal(parsed.q?.length, 200);
});

test("GET /api/opportunities/:id returns the item with a plan, checklist, related items and relevant prep apps", async () => {
  const list = (await (await listGET(get("/api/opportunities?q=financial+advisor+cda&limit=1"))).json()) as { items: OpportunityView[] };
  const job = list.items[0];
  assert.match(job.title, /Financial Advisor/);

  const response = await detailGET(get(`/api/opportunities/${job.id}`), ctx(job.id));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { item: OpportunityView; plan: Array<{ id: string; due: string }>; checklist: unknown[]; related: unknown[]; prep: Array<{ id: string; url: string }> };
  assert.equal(body.item.id, job.id);
  assert.equal(body.item.daysLeft, 14);
  assert.ok(body.plan.some((step) => step.id === "read-ad"));
  assert.ok(body.checklist.length >= 6);
  assert.ok(body.related.length > 0);
  assert.deepEqual(body.prep, [], "a contract post does not get the MCQ-test suggestion");

  const missing = await detailGET(get("/api/opportunities/nope"), ctx("nope"));
  assert.equal(missing.status, 404);
  assert.match(((await missing.json()) as { error: string }).error, /not found/);
});

test("a course-coupon page recommends the study-habits app, with a link tagged as coming from RAAHI", async () => {
  const list = (await (await listGET(get("/api/opportunities?kind=coupon&limit=5"))).json()) as { items: OpportunityView[] };
  assert.ok(list.items.length > 0);
  const coupon = list.items[0];
  const body = (await (await detailGET(get(`/api/opportunities/${coupon.id}`), ctx(coupon.id))).json()) as { prep: Array<{ id: string; url: string; reason: { en: string }; boundary?: { en: string } }>; plan: Array<{ id: string }> };
  assert.deepEqual(body.prep.map((app) => app.id), ["cognitive-fitness"]);
  assert.match(body.prep[0].url, /^https:\/\/cognitive-fitness-blond\.vercel\.app\/\?utm_source=raahi&utm_medium=opportunity$/);
  assert.match(body.prep[0].boundary?.en ?? "", /not medical advice/i, "the app's own limits travel with the recommendation");
  assert.deepEqual(body.plan.map((step) => step.id), ["enrol"]);
});

test("GET /api/opportunities/:id/calendar returns a valid .ics, with optional plan steps", async () => {
  const list = (await (await listGET(get("/api/opportunities?q=commonwealth&limit=1"))).json()) as { items: OpportunityView[] };
  const id = list.items[0].id;
  const response = await calendarGET(get(`/api/opportunities/${id}/calendar`), ctx(id));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/calendar/);
  assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="raahi-commonwealth/);
  const text = await response.text();
  assert.match(text, /DTSTART;VALUE=DATE:20261020/);
  assert.match(text, /SUMMARY:Deadline: Commonwealth/);
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 1);

  const withPlan = await (await calendarGET(get(`/api/opportunities/${id}/calendar?plan=1`), ctx(id))).text();
  assert.ok((withPlan.match(/BEGIN:VEVENT/g) ?? []).length > 3);

  const noDeadline = (await (await listGET(get("/api/opportunities?q=global+korea&limit=1"))).json()) as { items: OpportunityView[] };
  const noDeadlineId = noDeadline.items[0].id;
  assert.equal((await calendarGET(get(`/api/opportunities/${noDeadlineId}/calendar`), ctx(noDeadlineId))).status, 404);
});

test("POST /api/opportunities/match ranks for a profile and rejects malformed input", async () => {
  const ok = await matchPOST(post("/api/opportunities/match", { level: "masters", interests: ["scholarship"], needsFunding: true, keywords: "erasmus europe" }));
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { results: Array<{ item: OpportunityView; score: number; reasons: unknown[] }> };
  assert.ok(body.results.length > 0);
  assert.ok(body.results.every((entry) => entry.item.kind === "scholarship" && entry.item.openToPakistan !== false));
  assert.ok(body.results[0].reasons.length > 0);
  const scores = body.results.map((entry) => entry.score);
  assert.deepEqual([...scores].sort((a, b) => b - a), scores);

  assert.equal((await matchPOST(post("/api/opportunities/match", "not json"))).status, 400);
  assert.equal((await matchPOST(post("/api/opportunities/match", { level: "wizard" }))).status, 400);
});

test("POST /api/opportunities/scam-check analyses text and checklist, and refuses empty input", async () => {
  const response = await scamPOST(post("/api/opportunities/scam-check", { text: "Visa ready, 100% guaranteed. Pay advance fee on JazzCash to my personal account." }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.json()) as { level: string; signals: unknown[] };
  assert.equal(body.level, "high");

  const checklist = (await (await scamPOST(post("/api/opportunities/scam-check", { answers: { askedForOtpOrPassword: true } }))).json()) as { level: string };
  assert.equal(checklist.level, "medium");

  assert.equal((await scamPOST(post("/api/opportunities/scam-check", {}))).status, 400);
  assert.equal((await scamPOST(post("/api/opportunities/scam-check", { text: "   " }))).status, 400);
  assert.equal((await scamPOST(post("/api/opportunities/scam-check", { text: "x".repeat(7000) }))).status, 400);
  assert.equal((await scamPOST(post("/api/opportunities/scam-check", "{broken"))).status, 400);
});

test("GET /api/opportunities/status exposes freshness and the source registry with each source's terms", async () => {
  const body = (await (await statusGET()).json()) as { total: number; stale: boolean; sources: Array<{ sourceId: string; status: string }>; registry: Array<{ id: string; attribution: string; terms?: string }>; remoteRefresh: boolean };
  assert.ok(body.total > 40);
  assert.equal(body.stale, false);
  assert.equal(body.remoteRefresh, false);
  assert.ok(body.sources.some((source) => source.sourceId === "njp" && source.status === "ok"));
  const remotive = body.registry.find((source) => source.id === "remotive");
  assert.match(remotive?.terms ?? "", /link back/i);
  assert.ok(body.registry.every((source) => source.attribution.length > 10));
});

test("GET /api/resources searches the directory in several languages and honours filters", async () => {
  const names = async (query: string) => ((await (await resourcesGET(get(`/api/resources?${query}`))).json()) as { items: Array<{ id: string }> }).items.map((item) => item.id);

  assert.ok((await names("q=njp")).includes("njp"));
  assert.ok((await names("q=" + encodeURIComponent("نوکری") + "&scope=pakistan")).includes("njp"));
  const overseas = await names("category=overseas-employment&official=1");
  assert.ok(overseas.includes("beoe") && overseas.includes("oec") && !overseas.includes("bayt"));
  assert.ok((await names("q=free+udemy+coupons")).includes("real-discount"));
  assert.ok((await names("q=scholarship+germany")).includes("daad"));

  const verified = (await (await resourcesGET(get("/api/resources?verified=1"))).json()) as { items: Array<{ checked?: string }>; total: number };
  assert.ok(verified.items.every((item) => item.checked === "2026-10-11"));
  assert.ok(verified.total < resources.length);

  const free = searchResources({ free: true, category: "learning" });
  assert.ok(free.items.every((item) => item.free));
  assert.ok(free.categories.every((category) => category.value === "learning"));
  const urdu = searchResources({ q: "ڈیجی اسکلز" });
  assert.equal(urdu.items[0]?.id, "digiskills");
});

test("GET /api/ecosystem lists the three sibling apps with tagged launch links", async () => {
  const body = (await (await ecosystemGET()).json()) as { apps: Array<{ id: string; launchUrl: string; routes?: Array<{ url: string }> }>; feeds: Record<string, string> };
  assert.deepEqual(body.apps.map((app) => app.id), ["neuroprep", "mdcat-prepmaster", "cognitive-fitness"]);
  assert.ok(body.apps.every((app) => app.launchUrl.includes("utm_source=raahi")));
  assert.ok(body.apps[2].routes?.some((route) => route.url.startsWith("https://cognitive-fitness-blond.vercel.app/journeys")));
  assert.equal(body.feeds.opportunities, "/api/opportunities");
});

test("refresh endpoint is invisible until CRON_SECRET is set, then requires the secret", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await refreshGET(get("/api/opportunities/refresh"))).status, 404);
  process.env.CRON_SECRET = "s3cret-value";
  try {
    assert.equal((await refreshGET(get("/api/opportunities/refresh"))).status, 401);
    assert.equal((await refreshGET(new Request("http://localhost/api/opportunities/refresh", { headers: { authorization: "Bearer wrong-secret" } }))).status, 401);
  } finally {
    delete process.env.CRON_SECRET;
  }
});

// ─── Link health checker ─────────────────────────────────────────────────────

test("link checker: ok / redirect / blocked / broken are told apart, HEAD falls back to GET", async () => {
  const seen: string[] = [];
  const server: Server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url === "/ok") return void res.end("fine");
    if (req.url === "/moved") {
      res.statusCode = 301;
      res.setHeader("location", "/ok");
      return void res.end();
    }
    if (req.url === "/forbidden") {
      res.statusCode = 403;
      return void res.end("bots not welcome");
    }
    if (req.url === "/head-rejected") {
      if (req.method === "HEAD") {
        res.statusCode = 405;
        return void res.end();
      }
      return void res.end("fine with GET");
    }
    if (req.url === "/error") {
      res.statusCode = 500;
      return void res.end("boom");
    }
    res.statusCode = 404;
    res.end("gone");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const verdict = async (path: string) => (await checkLink(`${base}${path}`, { now: NOW })).verdict;
    assert.equal(await verdict("/ok"), "ok");
    assert.equal(await verdict("/moved"), "ok");
    assert.equal(await verdict("/forbidden"), "blocked");
    assert.equal(await verdict("/head-rejected"), "ok");
    assert.equal(await verdict("/missing"), "broken");
    assert.equal(await verdict("/error"), "broken");
    assert.equal((await checkLink(`${base}/moved`, { now: NOW })).finalUrl, `${base}/ok`);
    assert.deepEqual(await checkLink("http://127.0.0.1:1/unreachable", { now: NOW, timeoutMs: 500 }), { ok: false, status: 0, verdict: "unreachable", checkedAt: NOW.toISOString() });

    const results = await checkResources(
      [
        { ...resources[0], id: "a", url: `${base}/ok` },
        { ...resources[1], id: "b", url: `${base}/missing` },
      ],
      { now: NOW, hostDelayMs: 0 },
    );
    assert.equal(results.a.verdict, "ok");
    assert.equal(results.b.verdict, "broken");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal(classify(204), "ok");
  assert.equal(classify(429), "blocked");
  assert.equal(classify(410), "broken");
});
