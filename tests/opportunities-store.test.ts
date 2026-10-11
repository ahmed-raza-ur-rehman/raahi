import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps.test.db");

import { interpretQuery } from "@/lib/opportunities/query";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import {
  ensureOpportunitiesReady,
  getOpportunity,
  getStatus,
  loadSnapshotIntoDb,
  refreshFromRemote,
  relatedOpportunities,
  remoteSnapshotUrl,
  resetRemoteRefreshState,
  searchOpportunities,
} from "@/lib/opportunities/store";
import type { Snapshot } from "@/lib/opportunities/types";
import { allSourceRoutes, createFixtureHttp } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
let snapshot: Snapshot;

test("setup: scrape fixtures and load them into SQLite", async () => {
  snapshot = await runScrapers({ http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  const { loaded } = loadSnapshotIntoDb(snapshot, NOW);
  assert.equal(loaded, snapshot.items.length);
  assert.ok(loaded > 40);
});

// ─── Query understanding ─────────────────────────────────────────────────────

test("interprets English, Urdu and Roman-Urdu sentences into filters", () => {
  assert.deepEqual(interpretQuery("fully funded masters scholarship in germany"), {
    terms: [], kinds: ["scholarship"], country: "Germany", level: "masters", funding: "full", scope: "international",
  });
  const urdu = interpretQuery("سعودی عرب میں نوکری");
  assert.deepEqual(urdu.kinds, ["job"]);
  assert.equal(urdu.country, "Saudi Arabia");
  assert.equal(interpretQuery("بیرون ملک اسکالرشپ").scope, "international");
  assert.deepEqual(interpretQuery("بیرون ملک اسکالرشپ").kinds, ["scholarship"]);

  const roman = interpretQuery("sarkari naukri");
  assert.deepEqual(roman.kinds, ["job"]);
  assert.equal(roman.scope, "pakistan");

  const free = interpretQuery("free udemy python course");
  assert.equal(free.funding, "free");
  assert.ok(free.kinds?.includes("coupon") && free.kinds.includes("course"));
  assert.deepEqual(free.terms, ["python"]);

  assert.equal(interpretQuery("hackathons closing soon").deadlineWithinDays, 7);
  assert.equal(interpretQuery("remote jobs").remote, true);
  assert.equal(interpretQuery("pakistan jobs 2027").scope, "pakistan");
  assert.deepEqual(interpretQuery("2027 chevening").terms, ["chevening"], "years are not search terms");
  assert.equal(interpretQuery("ماسٹرز").level, "masters");
  assert.equal(interpretQuery("پی ایچ ڈی").level, "phd");
  assert.deepEqual(interpretQuery("").terms, []);
});

// ─── Search ──────────────────────────────────────────────────────────────────

test("search: regulator notices are hidden from opportunity searches but available on request", () => {
  const all = searchOpportunities({}, NOW);
  assert.ok(all.items.every((item) => item.kind !== "notice"));
  const notices = searchOpportunities({ kinds: ["notice"] }, NOW);
  assert.ok(notices.total >= 5);
  assert.ok(notices.items.every((item) => item.tags.includes("beoe")));
  assert.equal(searchOpportunities({ q: "blacklisted agent complaint" }, NOW).items.every((item) => item.kind === "notice"), true, "the words 'blacklist'/'complaint' ask for notices");
});

test("search: text relevance finds the right listing in several languages and ranks official sources higher", () => {
  const commonwealth = searchOpportunities({ q: "commonwealth masters" }, NOW);
  assert.match(commonwealth.items[0].title, /Commonwealth/);
  assert.equal(commonwealth.interpreted.level, "masters");

  const govtJobs = searchOpportunities({ q: "sarkari naukri" }, NOW);
  assert.ok(govtJobs.total >= 10);
  assert.ok(govtJobs.items.every((item) => item.kind === "job" && item.scope === "pakistan"));

  const urduJobs = searchOpportunities({ q: "نوکری" }, NOW);
  assert.ok(urduJobs.items.every((item) => item.kind === "job"));

  const coupons = searchOpportunities({ q: "free udemy python" }, NOW);
  assert.ok(coupons.items.length > 0 && coupons.items.every((item) => item.kind === "coupon" || item.kind === "course"));
  assert.match(coupons.items[0].title, /Python/i);

  const finance = searchOpportunities({ q: "financial analyst" }, NOW);
  assert.match(finance.items[0].title, /Financial Analyst/);
  assert.equal(searchOpportunities({ q: "zzzzqqqq nothing like this" }, NOW).total, 0);
});

test("search: browsing without a query returns a mix of kinds and sources, not one portal's jobs", () => {
  const firstPage = searchOpportunities({ limit: 12 }, NOW).items;
  const kinds = new Set(firstPage.map((item) => item.kind));
  assert.ok(kinds.size >= 4, `expected at least four kinds on the first page, got ${[...kinds].join(", ")}`);
  const njp = firstPage.filter((item) => item.sourceId === "njp").length;
  assert.ok(njp <= 5, `NJP should not fill the page (${njp} of 12)`);
  // a text query is still ranked purely by relevance
  assert.match(searchOpportunities({ q: "financial analyst" }, NOW).items[0].title, /Financial Analyst/);
  // and a single-kind browse still works
  assert.ok(searchOpportunities({ kinds: ["competition"], limit: 12 }, NOW).items.every((item) => item.kind === "competition"));
});

test("search: filters for Pakistan eligibility, deadlines, sources, tags and paging", () => {
  const everything = searchOpportunities({ kinds: ["scholarship"], limit: 100 }, NOW);
  const eligible = searchOpportunities({ kinds: ["scholarship"], openToPakistan: true, limit: 100 }, NOW);
  assert.ok(everything.items.some((item) => item.openToPakistan === false), "Africa-only scholarships exist in the data");
  assert.ok(eligible.items.every((item) => item.openToPakistan !== false));
  assert.ok(eligible.total < everything.total);

  const soon = searchOpportunities({ deadlineWithinDays: 14, sort: "deadline" }, NOW);
  assert.ok(soon.total > 0);
  assert.ok(soon.items.every((item) => item.deadline && item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 14));
  const deadlines = soon.items.map((item) => item.deadline as string);
  assert.deepEqual([...deadlines].sort(), deadlines, "soonest first");

  assert.ok(searchOpportunities({ sourceId: "njp" }, NOW).items.every((item) => item.sourceId === "njp"));
  assert.ok(searchOpportunities({ tag: "government" }, NOW).items.length >= 10);
  assert.ok(searchOpportunities({ remote: true, kinds: ["job"] }, NOW).items.every((item) => item.remote));

  const page1 = searchOpportunities({ limit: 5, offset: 0, sort: "newest" }, NOW);
  const page2 = searchOpportunities({ limit: 5, offset: 5, sort: "newest" }, NOW);
  assert.equal(page1.items.length, 5);
  assert.ok(page1.items.every((a) => !page2.items.some((b) => b.id === a.id)));
  assert.equal(page1.total, page2.total);

  const result = searchOpportunities({ newWithinDays: 1 }, NOW);
  assert.ok(result.items.every((item) => item.isNew));
  assert.ok(result.facets.kind.length > 0 && result.facets.source.length > 0);
});

test("search: closed items are hidden by default yet still resolvable by id during the grace period", () => {
  const later = new Date("2026-10-23T06:00:00Z"); // NJP's 21 October deadlines have passed; grace period (14 d) has not
  loadSnapshotIntoDb(snapshot, NOW); // nothing expired yet at load time
  const open = searchOpportunities({ sourceId: "njp" }, later);
  const withClosed = searchOpportunities({ sourceId: "njp", includeClosed: true }, later);
  assert.ok(open.total < withClosed.total, "closed jobs are excluded unless asked for");

  const closedJob = withClosed.items.find((item) => item.status === "closed");
  assert.ok(closedJob);
  const resolved = getOpportunity(closedJob.id, later);
  assert.equal(resolved?.status, "closed");
  assert.ok((resolved?.daysLeft ?? 0) < 0);

  const muchLater = new Date("2026-11-20T06:00:00Z");
  assert.equal(getOpportunity(closedJob.id, muchLater), undefined, "after the grace period the item is gone");
  loadSnapshotIntoDb(snapshot, NOW);
});

test("expired and stale items are never loaded: coupons older than two days are skipped", () => {
  const coupons = snapshot.items.filter((item) => item.kind === "coupon");
  assert.ok(coupons.length > 0);
  const { loaded } = loadSnapshotIntoDb(snapshot, new Date(NOW.getTime() + 3 * 86_400_000));
  assert.ok(loaded < snapshot.items.length);
  assert.equal(searchOpportunities({ kinds: ["coupon"] }, new Date(NOW.getTime() + 3 * 86_400_000)).total, 0);
  loadSnapshotIntoDb(snapshot, NOW);
});

test("getOpportunity returns computed status and related items share kind and tags", () => {
  const job = searchOpportunities({ sourceId: "njp", limit: 1 }, NOW).items[0];
  const view = getOpportunity(job.id, NOW);
  assert.ok(view);
  assert.equal(view.status, view.daysLeft !== null && view.daysLeft <= 7 ? "closing-soon" : "open");
  assert.equal(view.isNew, true);
  const related = relatedOpportunities(view, 3, NOW);
  assert.ok(related.length > 0 && related.every((entry) => entry.kind === "job" && entry.id !== view.id));
  assert.equal(getOpportunity("nope-123", NOW), undefined);
});

// ─── Loading, status, remote refresh ─────────────────────────────────────────

test("ensureOpportunitiesReady reloads only when the offered snapshot is newer", () => {
  loadSnapshotIntoDb(snapshot, NOW);
  const before = getStatus(NOW).total;
  ensureOpportunitiesReady({ ...snapshot, items: snapshot.items.slice(0, 3) }, NOW); // same generatedAt → ignored
  assert.equal(getStatus(NOW).total, before);
  ensureOpportunitiesReady({ ...snapshot, generatedAt: new Date(NOW.getTime() + 3_600_000).toISOString(), items: snapshot.items.slice(0, 3) }, NOW);
  assert.equal(getStatus(NOW).total, 3);
  loadSnapshotIntoDb(snapshot, NOW);
});

test("status reports freshness, counts and per-source results", () => {
  loadSnapshotIntoDb(snapshot, NOW);
  const fresh = getStatus(new Date(NOW.getTime() + 2 * 3_600_000));
  assert.equal(fresh.stale, false);
  assert.ok(Math.abs((fresh.ageHours ?? 0) - 2) < 0.01);
  assert.ok(fresh.byKind.some((row) => row.value === "scholarship" && row.count > 3));
  assert.ok(fresh.sources.some((source) => source.sourceId === "njp" && source.status === "ok"));
  assert.equal(getStatus(new Date(NOW.getTime() + 40 * 3_600_000)).stale, true, "older than 36 h is flagged");
});

test("remote refresh: updates when newer, ignores older, never replaces data with garbage", async () => {
  loadSnapshotIntoDb(snapshot, NOW);
  const url = "https://example.test/snapshot.json";
  const newer = { ...snapshot, generatedAt: new Date(NOW.getTime() + 6 * 3_600_000).toISOString(), items: snapshot.items.slice(0, 5) };
  const respond = (body: unknown, status = 200) => (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

  resetRemoteRefreshState();
  assert.equal(await refreshFromRemote({ url, fetchImpl: respond(newer), now: NOW, force: true }), "updated");
  assert.equal(getStatus(NOW).total, 5);

  assert.equal(await refreshFromRemote({ url, fetchImpl: respond(newer), now: NOW, force: true }), "unchanged");
  assert.equal(await refreshFromRemote({ url, fetchImpl: respond(newer), now: NOW }), "skipped", "TTL: asked again too soon");

  resetRemoteRefreshState();
  assert.equal(await refreshFromRemote({ url, fetchImpl: respond("<html>not json</html>"), now: NOW, force: true }), "failed");
  assert.equal(await refreshFromRemote({ url, fetchImpl: respond({ ...newer, items: [] , generatedAt: "2030-01-01T00:00:00Z"}), now: NOW, force: true }), "failed", "an empty snapshot never wins");
  assert.equal(await refreshFromRemote({ url, fetchImpl: respond("gone", 404), now: NOW, force: true }), "failed");
  assert.equal(await refreshFromRemote({ url, fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch, now: NOW, force: true }), "failed");
  assert.equal(getStatus(NOW).total, 5, "good data survives every failure");
  assert.equal(await refreshFromRemote({ url: undefined, now: NOW, force: true }), "skipped");
  loadSnapshotIntoDb(snapshot, NOW);
});

test("remote snapshot URL: on by default only on Vercel, configurable, and can be switched off", () => {
  assert.equal(remoteSnapshotUrl({}), undefined);
  assert.match(remoteSnapshotUrl({ VERCEL: "1" }) ?? "", /raw\.githubusercontent\.com\/ahmed-raza-ur-rehman\/raahi\/master\/data\/opportunities\/snapshot\.json/);
  assert.equal(remoteSnapshotUrl({ VERCEL: "1", OPPORTUNITIES_SNAPSHOT_URL: "off" }), undefined);
  assert.equal(remoteSnapshotUrl({ OPPORTUNITIES_SNAPSHOT_URL: "https://mine.example/s.json" }), "https://mine.example/s.json");
});
