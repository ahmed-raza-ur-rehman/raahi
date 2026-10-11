import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps-latest.test.db");
process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";

import { GET as calendarGET } from "@/app/api/opportunities/calendar/route";
import { GET as feedGET } from "@/app/api/opportunities/feed/route";
import { GET as listGET } from "@/app/api/opportunities/route";
import { parseOpportunityQuery } from "@/lib/opportunities/api";
import { setClock } from "@/lib/opportunities/clock";
import { buildAtom, buildJsonFeed, buildRss, describeQuery, itemDescription, siteOrigin, xmlEscape } from "@/lib/opportunities/feeds";
import { cheerio } from "@/lib/opportunities/scrapers/dom";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { loadSnapshotIntoDb } from "@/lib/opportunities/store";
import type { OpportunityView } from "@/lib/opportunities/types";
import { allSourceRoutes, createFixtureHttp, fixtureSources } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
setClock(() => NOW);
const get = (path: string, headers: Record<string, string> = {}) => new Request(`http://localhost${path}`, { headers });
const xml = (text: string) => cheerio.load(text, { xml: true });

test("setup: load a scraped snapshot", async () => {
  const snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  loadSnapshotIntoDb(snapshot, NOW);
});

const view = (patch: Partial<OpportunityView> = {}): OpportunityView => ({
  id: "src-1234567890",
  kind: "scholarship",
  scope: "international",
  title: "Fully funded <Master's> & “PhD” scholarship\u0007 2027",
  organization: "Ministry of Education & Culture",
  summary: "Covers tuition, a monthly stipend & flights. Apply <b>early</b>.",
  url: "https://example.org/apply?x=1&y=2",
  sourceId: "src",
  sourceName: "Example Source",
  sourceUrl: "https://example.org/",
  country: "Germany",
  levels: ["masters"],
  fields: [],
  tags: ["fully-funded", "masters"],
  deadline: "2026-12-01",
  postedAt: "2026-10-09T10:00:00.000Z",
  firstSeen: "2026-10-10T00:00:00.000Z",
  lastSeen: "2026-10-11T00:00:00.000Z",
  openToPakistan: true,
  dedupeKey: "x",
  status: "open",
  daysLeft: 51,
  isNew: true,
  ...patch,
});

const META = { title: "RAAHI — Scholarships", description: "d & <e>", origin: "https://raahi.example", homeUrl: "https://raahi.example/opportunities?kind=scholarship", selfUrl: "https://raahi.example/api/opportunities/feed?kind=scholarship", updated: NOW };

test("feeds: text from third-party sites is escaped and control characters never break the XML", () => {
  assert.equal(xmlEscape(`a & b <c> "d" 'e'\u0000\u0007`), "a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;");

  const rss = xml(buildRss([view()], META));
  assert.equal(rss("channel > title").text(), "RAAHI — Scholarships");
  assert.equal(rss("channel > description").text(), "d & <e>");
  const item = rss("item").first();
  assert.equal(item.children("title").text(), "Fully funded <Master's> & “PhD” scholarship 2027");
  assert.equal(item.children("link").text(), "https://raahi.example/opportunities/src-1234567890", "entries link to RAAHI's own page");
  assert.equal(item.children("guid").attr("isPermaLink"), "true");
  assert.equal(new Date(item.children("pubDate").text()).toISOString(), "2026-10-09T10:00:00.000Z", "uses the posting date when the source gave one");
  assert.ok(item.children("category").toArray().some((node) => rss(node).text() === "Germany"));
  assert.equal(item.children("source").text(), "Example Source");
  assert.match(item.children("description").text(), /Deadline: 2026-12-01/);
  assert.match(item.children("description").text(), /Listed via Example Source; confirm details on the official page/);

  const atom = xml(buildAtom([view()], META));
  const entry = atom("entry").first();
  assert.equal(entry.children("title").text(), "Fully funded <Master's> & “PhD” scholarship 2027");
  assert.equal(entry.children('link[rel="related"]').attr("href"), "https://example.org/apply?x=1&y=2", "the original listing stays reachable");
  assert.equal(entry.children('link[rel="alternate"]').attr("href"), "https://raahi.example/opportunities/src-1234567890");
  assert.equal(entry.children("author").children("name").text(), "Example Source");
  assert.equal(entry.children("category").attr("term"), "scholarship");
  assert.equal(atom("feed > updated").text(), NOW.toISOString());

  const json = buildJsonFeed([view({ deadline: undefined, status: "rolling", daysLeft: null })], META) as { version: string; items: Array<Record<string, unknown>> };
  assert.equal(json.version, "https://jsonfeed.org/version/1.1");
  assert.equal(json.items[0].external_url, "https://example.org/apply?x=1&y=2");
  assert.equal((json.items[0]._raahi as { deadline: unknown }).deadline, null);
  assert.match(itemDescription(view({ deadline: undefined, status: "rolling", daysLeft: null })), /Rolling applications/);
  assert.match(itemDescription(view({ openToPakistan: false })), /May not be open to applicants in Pakistan/);
});

test("GET /api/opportunities/feed: RSS, Atom and JSON, with the same filters as the search API", async () => {
  const rss = await feedGET(get("/api/opportunities/feed?kind=job&scope=pakistan&limit=5"));
  assert.equal(rss.status, 200);
  assert.match(rss.headers.get("content-type") ?? "", /^application\/rss\+xml/);
  assert.match(rss.headers.get("cache-control") ?? "", /s-maxage=600/);
  assert.equal(rss.headers.get("access-control-allow-origin"), "*");
  const doc = xml(await rss.text());
  assert.equal(doc("item").length, 5);
  assert.match(doc("channel > title").text(), /^RAAHI — Jobs · in Pakistan$/);
  assert.equal(doc("atom\\:link[rel=self]").attr("href"), "http://localhost/api/opportunities/feed?kind=job&scope=pakistan&limit=5");

  const atom = await feedGET(get("/api/opportunities/feed?format=atom&kind=scholarship"));
  assert.match(atom.headers.get("content-type") ?? "", /^application\/atom\+xml/);
  assert.ok(xml(await atom.text())("entry").length > 0);

  const jsonResponse = await feedGET(get("/api/opportunities/feed?format=json&kind=job&scope=pakistan"));
  assert.match(jsonResponse.headers.get("content-type") ?? "", /^application\/feed\+json/);
  const feed = (await jsonResponse.json()) as { items: Array<{ _raahi: { kind: string; scope: string } }> };
  assert.ok(feed.items.length > 0);
  assert.ok(feed.items.every((entry) => entry._raahi.kind === "job" && entry._raahi.scope === "pakistan"));

  const proxied = await feedGET(get("/api/opportunities/feed", { "x-forwarded-host": "raahi.example", "x-forwarded-proto": "https" }));
  assert.match(await proxied.text(), /<link>https:\/\/raahi\.example\/opportunities\/[a-z0-9-]+<\/link>/);
  assert.equal(siteOrigin(get("/x", { "x-forwarded-host": "a.example", "x-forwarded-proto": "https, http" })), "https://a.example");

  assert.equal((await feedGET(get("/api/opportunities/feed?format=xml"))).status, 400);
});

test("feeds: newest first, capped at 100, and restricted listings are left out unless asked for", async () => {
  const feed = async (query: string) => ((await (await feedGET(get(`/api/opportunities/feed?format=json&${query}`))).json()) as { items: Array<{ id: string; date_published: string; _raahi: { openToPakistan: boolean | null } }> }).items;
  const items = await feed("limit=500");
  assert.ok(items.length <= 100);
  const dates = items.map((entry) => Date.parse(entry.date_published));
  assert.deepEqual([...dates].sort((a, b) => b - a), dates);
  assert.ok(items.every((entry) => entry._raahi.openToPakistan !== false), "Pakistan-eligible by default");
  const everything = await feed("pk=0&limit=100");
  assert.ok(everything.some((entry) => entry._raahi.openToPakistan === false), "pk=0 includes listings that look restricted");
});

test("since: only listings RAAHI first saw after that instant; bad or future values are ignored", async () => {
  const total = async (query: string) => ((await (await listGET(get(`/api/opportunities?${query}&limit=1`))).json()) as { total: number }).total;
  const all = await total("pk=1");
  assert.ok(all > 20);
  assert.equal(await total("pk=1&since=2026-10-11T05:59:59Z"), all, "everything was first seen at 06:00:00");
  assert.equal(await total("pk=1&since=2026-10-11T06:00:00Z"), 0, "strictly after — nothing is newer than the snapshot itself");
  assert.equal(await total("pk=1&since=not-a-date"), all);
  assert.equal(await total("pk=1&since=2099-01-01T00:00:00Z"), all, "a date in the future cannot mean anything");
  assert.equal(parseOpportunityQuery(new URLSearchParams("since=2026-10-01")).since, "2026-10-01T00:00:00.000Z");
  assert.equal(parseOpportunityQuery(new URLSearchParams("since=")).since, undefined);
});

test("GET /api/opportunities/calendar: one subscribable calendar of the deadlines of a search", async () => {
  const response = await calendarGET(get("/api/opportunities/calendar?kind=scholarship&scope=international"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/calendar/);
  assert.match(response.headers.get("content-disposition") ?? "", /^inline/);
  const ics = (await response.text()).replace(/\r\n[ \t]/g, "");
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /X-WR-CALNAME:RAAHI deadlines — Scholarships/);
  const starts = [...ics.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map((match) => match[1]);
  assert.ok(starts.length > 0);
  assert.ok(starts.every((date) => date >= "20261011"), "no deadline that has already passed");
  assert.deepEqual([...starts].sort(), starts, "ordered by deadline");
  assert.equal([...ics.matchAll(/BEGIN:VEVENT/g)].length, [...ics.matchAll(/END:VEVENT/g)].length);
  assert.match(ics, /Always confirm the deadline on the official page/);
  assert.match(ics, /More: http:\/\/localhost\/opportunities\//);

  const download = await calendarGET(get("/api/opportunities/calendar?download=1"));
  assert.match(download.headers.get("content-disposition") ?? "", /^attachment/);
});

test("describeQuery names a search in plain words", () => {
  assert.equal(describeQuery({}), "All opportunities");
  assert.equal(describeQuery({ kinds: ["scholarship"], country: "Germany", funding: "full" }), "Scholarships · Germany · full funding");
  assert.equal(describeQuery({ kinds: ["job", "internship"], scope: "pakistan", deadlineWithinDays: 14 }), "Jobs / Internships · in Pakistan · closing within 14 days");
  assert.equal(describeQuery({ q: "python", remote: true }), "“python” · remote");
});
