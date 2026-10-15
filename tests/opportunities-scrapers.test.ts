import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { normalizeAll, type SourceMeta } from "@/lib/opportunities/normalize";
import { beoeNoticesAdapter, parseBeoeNotices, parseNjpJobs, parseScholarshipTab } from "@/lib/opportunities/scrapers/adapters/html";
import {
  parseArbeitnow,
  parseCodeforces,
  parseDevpost,
  parseJobicy,
  parseRealDiscount,
  parseRemotive,
} from "@/lib/opportunities/scrapers/adapters/apis";
import { kindFromCategories, parseFeed, parseWordPressPosts } from "@/lib/opportunities/scrapers/adapters/feeds";
import { HttpError, RobotsDisallowedError, ROBOTS_TOKEN, USER_AGENT, createHttpClient } from "@/lib/opportunities/scrapers/http";
import { expiryOf, isExpired, mergeSnapshot } from "@/lib/opportunities/scrapers/merge";
import { isAllowed, parseRobots } from "@/lib/opportunities/scrapers/robots";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { SOURCES } from "@/lib/opportunities/scrapers/sources";
import { parseSnapshot, serializeSnapshot } from "@/lib/opportunities/snapshot";
import type { Opportunity } from "@/lib/opportunities/types";
import { allSourceRoutes, createFixtureHttp, fixture, fixtureSources } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
const meta = (id: string, scope: SourceMeta["scope"] = "international", defaultKind: SourceMeta["defaultKind"] = "scholarship"): SourceMeta => ({ id, name: id, homepage: `https://${id}.example/`, defaultKind, scope });
const json = (name: string) => JSON.parse(fixture(name)) as unknown;

// ─── robots.txt ──────────────────────────────────────────────────────────────

test("robots.txt: the rules ScholarshipTab publishes allow pages but not search or query strings", () => {
  const rules = parseRobots("User-agent: *\r\nDisallow: /search\r\nDisallow: /*?\r\n\r\nSitemap: https://www.scholarshiptab.com/sitemapindex.xml");
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/"), true);
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/scholarships/global-korea-scholarship-2027"), true);
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/search"), false);
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/search/masters"), false);
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/?page=2"), false);
  assert.deepEqual(rules.sitemaps, ["https://www.scholarshiptab.com/sitemapindex.xml"]);
});

test("robots.txt: specific agent groups, longest match, Allow ties and $ anchors follow RFC 9309", () => {
  const rules = parseRobots(`
    User-agent: *
    Disallow: /private/
    Disallow: /*.pdf$
    Allow: /private/public/
    Crawl-delay: 5

    User-agent: raahi-opportunitybot
    Disallow: /only-for-us
  `);
  // our own group replaces the wildcard group entirely
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/private/x"), true);
  assert.equal(isAllowed(rules, ROBOTS_TOKEN, "/only-for-us/page"), false);
  assert.equal(isAllowed(rules, "SomeOtherBot/2.0", "/private/x"), false);
  assert.equal(isAllowed(rules, "SomeOtherBot/2.0", "/private/public/file"), true, "longer Allow beats shorter Disallow");
  assert.equal(isAllowed(rules, "SomeOtherBot/2.0", "/files/report.pdf"), false);
  assert.equal(isAllowed(rules, "SomeOtherBot/2.0", "/files/report.pdf?x=1"), true, "$ anchors the end of the URL");
  assert.equal(isAllowed(parseRobots("User-agent: *\nDisallow:"), ROBOTS_TOKEN, "/anything"), true, "empty Disallow allows everything");
});

// ─── HTTP client against a real local server ────────────────────────────────

interface Seen {
  path: string;
  userAgent?: string;
}

async function withServer(handler: (req: IncomingMessage, res: ServerResponse, seen: Seen[]) => void, run: (base: string, seen: Seen[]) => Promise<void>) {
  const seen: Seen[] = [];
  const server: Server = createServer((req, res) => {
    seen.push({ path: req.url ?? "", userAgent: req.headers["user-agent"] });
    handler(req, res, seen);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const noSleep = async () => undefined;

test("REQ-DAT-006 http client identifies honestly, obeys robots.txt and caches it", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/robots.txt") {
        res.setHeader("content-type", "text/plain");
        res.end("User-agent: *\nDisallow: /private\n");
      } else {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, path: req.url }));
      }
    },
    async (base, seen) => {
      const http = createHttpClient({ hostDelayMs: 0, sleep: noSleep });
      assert.deepEqual(await http.getJson(`${base}/api/a`), { ok: true, path: "/api/a" });
      await http.getJson(`${base}/api/b`);
      await assert.rejects(http.getText(`${base}/private/area`), RobotsDisallowedError);

      assert.equal(seen.filter((s) => s.path === "/robots.txt").length, 1, "robots.txt is fetched once per host");
      assert.ok(seen.every((s) => s.userAgent === USER_AGENT), "every request carries the honest bot User-Agent");
      assert.ok(!seen.some((s) => s.path.startsWith("/private")), "a disallowed URL is never requested");
      assert.match(USER_AGENT, /RAAHI-OpportunityBot\/1\.0 \(\+https:\/\/github\.com\//);

      // documented APIs may opt out of the robots check
      const direct = await http.getText(`${base}/private/api`, { respectRobots: false });
      assert.equal(direct.status, 200);
    },
  );
});

test("http client treats a broken robots.txt (5xx) as 'do not crawl' but a missing one (404) as 'no rules'", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/robots.txt") {
        res.statusCode = 503;
        res.end("down");
      } else res.end("hello");
    },
    async (base) => {
      const http = createHttpClient({ hostDelayMs: 0, sleep: noSleep, retries: 0 });
      await assert.rejects(http.getText(`${base}/page`), (error: unknown) => error instanceof HttpError && /robots\.txt returned HTTP 503/.test(error.message));
    },
  );
  await withServer(
    (req, res) => {
      if (req.url === "/robots.txt") {
        res.statusCode = 404;
        res.end("nope");
      } else res.end("hello");
    },
    async (base) => {
      const http = createHttpClient({ hostDelayMs: 0, sleep: noSleep });
      assert.equal((await http.getText(`${base}/page`)).text, "hello");
    },
  );
});

test("http client retries 503 with backoff, gives up on 404, rejects oversized and non-JSON bodies", async () => {
  let hits = 0;
  await withServer(
    (req, res) => {
      if (req.url === "/robots.txt") return void res.end("");
      if (req.url === "/flaky") {
        hits += 1;
        if (hits < 3) {
          res.statusCode = 503;
          res.setHeader("retry-after", "1");
          return void res.end("busy");
        }
        return void res.end("recovered");
      }
      if (req.url === "/missing") {
        res.statusCode = 404;
        return void res.end("no");
      }
      if (req.url === "/big") return void res.end("x".repeat(5000));
      res.end("<html>not json</html>");
    },
    async (base) => {
      const sleeps: number[] = [];
      const http = createHttpClient({ hostDelayMs: 0, sleep: async (ms) => void sleeps.push(ms), maxBytes: 1000 });
      assert.equal((await http.getText(`${base}/flaky`)).text, "recovered");
      assert.equal(hits, 3);
      assert.ok(sleeps.filter((ms) => ms >= 1000).length >= 2, "honours Retry-After");

      await assert.rejects(http.getText(`${base}/missing`), (error: unknown) => error instanceof HttpError && error.status === 404);
      await assert.rejects(http.getText(`${base}/big`), /too large/i);
      await assert.rejects(http.getJson(`${base}/html`), /Expected JSON/);
    },
  );
});

test("REQ-DAT-006 http client spaces requests to the same host", async () => {
  await withServer(
    (req, res) => void res.end(req.url === "/robots.txt" ? "" : "ok"),
    async (base) => {
      const waits: number[] = [];
      const http = createHttpClient({ hostDelayMs: 200, sleep: async (ms) => void waits.push(ms) });
      await Promise.all([http.getText(`${base}/a`), http.getText(`${base}/b`), http.getText(`${base}/c`)]);
      assert.ok(waits.length >= 2 && waits.every((ms) => ms > 0 && ms <= 200), `expected spacing waits, got ${JSON.stringify(waits)}`);
    },
  );
});

// ─── Parsers over recorded fixtures ─────────────────────────────────────────

test("Real.Discount: keeps only fully-discounted Udemy courses and drops sponsored ads", () => {
  const raw = parseRealDiscount(json("real-discount.json"));
  assert.equal(raw.length, 3, "2 Spanish + 1 English free; the ad and the half-price course are dropped");
  const [first] = raw;
  assert.equal(first.kind, "coupon");
  assert.equal(first.extra?.couponCode, "GRATIS100OCT2026");
  assert.equal(first.extra?.listPrice, 19.99);
  assert.equal(first.extra?.rating, 4.3);
  assert.deepEqual(first.languages, ["Spanish"]);
  assert.equal(first.postedAt, "2026-10-11T05:41:04.000Z");
  assert.ok(first.fields?.includes("computer-science"));
  assert.ok(!raw.some((item) => /bibyaqqz|half-price/.test(item.url)));

  const { items } = normalizeAll(raw, meta("realdiscount", "international", "coupon"), NOW);
  assert.ok(items.every((item) => item.funding === "free" && item.openToPakistan === true && item.url.includes("couponCode=")));
});

test("Remotive: maps remote jobs and works out whether candidates in Pakistan qualify", () => {
  const { items } = normalizeAll(parseRemotive(json("remotive.json")), meta("remotive", "international", "job"), NOW);
  assert.equal(items.length, 3);
  const sales = items.find((item) => /Inside Sales/.test(item.title));
  const desk = items.find((item) => /US-only Support/.test(item.title));
  assert.ok(sales && desk);
  assert.equal(sales.kind, "job");
  assert.equal(sales.organization, "Credit Wellness, LLC");
  assert.equal(sales.remote, true);
  assert.equal(sales.openToPakistan, true, "Worldwide");
  assert.equal(sales.extra?.salary, "OTE $25k - $35k");
  assert.equal(sales.postedAt, "2026-10-08T21:47:32.000Z");
  assert.equal(desk.openToPakistan, false, "USA Only");
  assert.match(desk.eligibilityNote ?? "", /USA Only/);
});

test("Jobicy and Arbeitnow: salary, location, visa/relocation hints", () => {
  const jobicy = normalizeAll(parseJobicy(json("jobicy.json")), meta("jobicy", "international", "job"), NOW).items;
  assert.equal(jobicy[0].title, "RevOps Analyst");
  assert.equal(jobicy[0].extra?.salary, "USD 140000 – 170000");
  assert.equal(jobicy[0].openToPakistan, false, "USA geo");

  const arbeitnow = normalizeAll(parseArbeitnow(json("arbeitnow.json")), meta("arbeitnow", "international", "job"), NOW).items;
  const munich = arbeitnow.find((item) => /Solutions Architect/.test(item.title));
  const berlin = arbeitnow.find((item) => /Bank Analytics/.test(item.title));
  const visa = arbeitnow.find((item) => /Backend Developer/.test(item.title));
  assert.ok(munich && berlin && visa);
  assert.equal(munich.country, "Germany");
  assert.equal(munich.extra?.visaMentioned, undefined, "no visa wording → no claim");
  assert.match(munich.eligibilityNote ?? "", /work visa/i);
  assert.equal(munich.postedAt, "2026-10-11T02:55:13.000Z");
  assert.equal(berlin.remote, true);
  assert.equal(visa.extra?.visaMentioned, true);
  assert.ok(visa.tags.some((tag) => /visa/.test(tag)));
});

test("Devpost: skips invite-only events, reads end dates from ranges and cleans prize markup", () => {
  const raw = parseDevpost(json("devpost.json"));
  assert.equal(raw.length, 7);
  assert.ok(!raw.some((item) => /invite-only/.test(item.title)));
  const amazon = raw.find((item) => /Amazon/.test(item.title));
  assert.ok(amazon);
  assert.equal(amazon.deadline, "2026-10-23");
  assert.equal(amazon.startsAt, "2026-08-31");
  assert.equal(amazon.extra?.prize, "$138,000");
  assert.equal(amazon.remote, true);
  assert.ok(amazon.tags?.includes("machine learning/ai"));
  assert.equal(raw.find((item) => /OpenCV/.test(item.title))?.deadline, "2026-10-27");
  assert.equal(raw.find((item) => /Meta VR/.test(item.title))?.extra?.prize, "$1,000,000");
  assert.equal(raw.find((item) => /Multimodal/.test(item.title))?.extra?.prize, "₹ 100,000");
  const { items } = normalizeAll(raw, meta("devpost", "international", "competition"), NOW);
  assert.ok(items.every((item) => item.kind === "competition"));
});

test("Codeforces: lists only upcoming contests inside the horizon", () => {
  const raw = parseCodeforces(json("codeforces.json"), NOW);
  assert.equal(raw.length, 1);
  assert.equal(raw[0].url, "https://codeforces.com/contests/2300");
  assert.equal(raw[0].deadline, "2026-10-14");
  assert.equal(raw[0].funding, "free");
});

test("WordPress REST posts: category names classify the post and feed boilerplate is removed", () => {
  const names = new Map([[62, "Scholarships"], [46, "Masters"], [64, "Europe"], [100, "Uncategorized"]]);
  const { items } = normalizeAll(parseWordPressPosts(json("wp-scholars4dev.json"), names), meta("scholars4dev"), NOW);
  assert.equal(items.length, 2);
  const ens = items.find((item) => /ENS/.test(item.title));
  assert.ok(ens);
  assert.equal(ens.deadline, "2026-12-15");
  assert.equal(ens.country, "France");
  assert.equal(ens.postedAt, "2026-10-06T20:46:48.000Z", "falls back to the site-local date when date_gmt is absent");
  assert.ok(ens.tags.includes("masters") && !ens.tags.includes("uncategorized"));
  assert.ok(!ens.summary?.includes("Read more"));

  const od = normalizeAll(parseWordPressPosts(json("wp-opportunitydesk.json"), new Map([[21738, "Opportunities"], [30, "Grants"], [12, "Fellowships"], [105, "Volunteer"]])), meta("opportunitydesk"), NOW).items;
  assert.equal(od.find((item) => /WomanKind/.test(item.title))?.kind, "grant");
  assert.equal(od.find((item) => /WomanKind/.test(item.title))?.deadline, "2026-11-01");
  assert.equal(od.find((item) => /Ambassador/.test(item.title))?.kind, "fellowship");
  assert.equal(kindFromCategories(["Jobs", "Internships"]), "internship");
  assert.equal(kindFromCategories(["Misc"]), undefined);
});

test("WordPress REST: date_gmt takes precedence over the site-local date", () => {
  const [raw] = parseWordPressPosts([{ link: "https://x.example/p", title: { rendered: "A post title" }, date: "2026-10-06T20:46:48", date_gmt: "2026-10-06T15:46:48", categories: [] }]);
  assert.equal(raw.postedAt, "2026-10-06T15:46:48Z");
});

test("RSS and Atom feeds parse, including CDATA, categories and alternate links", () => {
  const rss = parseFeed(fixture("feed-rss.xml"));
  assert.equal(rss.length, 1, "the item without a link is skipped");
  assert.equal(rss[0].title, "DAAD EPOS Scholarships 2027 for Development-Related Master’s Courses &amp; More");
  assert.deepEqual(rss[0].categories, ["Scholarships", "Germany"]);
  const { items } = normalizeAll(
    rss.map((entry) => ({ title: entry.title, url: entry.link, summary: entry.summary, postedAt: entry.published, tags: entry.categories })),
    meta("demo"),
    NOW,
  );
  assert.equal(items[0].title, "DAAD EPOS Scholarships 2027 for Development-Related Master’s Courses & More");
  assert.equal(items[0].url, "https://demo.example/daad-epos-2027");
  assert.equal(items[0].deadline, "2026-10-31");
  assert.equal(items[0].funding, "full");
  assert.equal(items[0].country, "Germany");
  assert.equal(items[0].openToPakistan, true);

  const atom = parseFeed(fixture("feed-atom.xml"));
  assert.equal(atom.length, 1);
  assert.equal(atom[0].link, "https://demo.example/internship-2027", "prefers rel=alternate over rel=self");
  assert.deepEqual(atom[0].categories, ["Internships"]);
});

test("ScholarshipTab: finds every card by its detail link, whatever the markup around it", () => {
  const raw = parseScholarshipTab(fixture("scholarshiptab.html"), "https://www.scholarshiptab.com/");
  assert.equal(raw.length, 9, "promo links to other sites are not mistaken for scholarships");
  const commonwealth = raw.find((item) => /Commonwealth/.test(item.title));
  assert.ok(commonwealth);
  assert.equal(commonwealth.title, "Commonwealth Master's Scholarships 2027/2028");
  assert.equal(commonwealth.deadline, "2026-10-20");
  assert.equal(commonwealth.postedAt, "2026-08-10T00:00:00Z");
  assert.equal(commonwealth.url, "https://www.scholarshiptab.com/scholarships/commonwealth-master-s-scholarships-2027-2028");
  assert.match(commonwealth.summary ?? "", /agency-nominated/);
  assert.ok(!/Featured|Deadline/.test(commonwealth.summary ?? ""));

  const korea = raw.find((item) => /Global Korea/.test(item.title));
  assert.ok(korea);
  assert.equal(korea.deadline, undefined, "'Not Specified' means no deadline");
  assert.equal(korea.url, "https://www.scholarshiptab.com/scholarships/global-korea-scholarship-2027", "relative links are resolved");

  const { items } = normalizeAll(raw, meta("scholarshiptab"), NOW);
  const rwanda = items.find((item) => /Rwanda/.test(item.title));
  assert.equal(rwanda?.openToPakistan, false, "Africa-only programmes are flagged");
  assert.equal(items.find((item) => /Erasmus Mundus Scholarship 2027$/.test(item.title))?.country, "Europe");
  assert.equal(items.find((item) => /Open Doors/.test(item.title))?.country, "Russia");
});

test("NJP: parses grade, vacancies, experience and deadline from separate or glued badges", () => {
  const raw = parseNjpJobs(fixture("njp-live.html"), "https://njp.gov.pk/jobs/live");
  assert.equal(raw.length, 10);
  const byTitle = (re: RegExp) => raw.find((item) => re.test(item.title));

  const financial = byTitle(/Financial Advisor/);
  assert.ok(financial);
  assert.equal(financial.url, "https://njp.gov.pk/jobs/9818", "relative link resolved");
  assert.equal(financial.organization, "Ministry of Interior and Narcotics Control");
  assert.equal(financial.deadline, "2026-10-25");
  assert.deepEqual(financial.extra, { grade: "BPS-20", vacancies: 1, experienceYears: 12, jobType: "Contract" });

  const research = byTitle(/Research Assistant/);
  assert.deepEqual(research?.extra, { grade: "PPS-6", vacancies: 6, experienceYears: 2, jobType: "Contract" });

  const accounts = byTitle(/Accounts officer/);
  assert.equal(accounts?.extra?.grade, "PPS-7", "glued 'PPS-71' is split into PPS-7 and 1 vacancy");
  assert.equal(accounts?.extra?.vacancies, 1);

  const consultants = byTitle(/Consultants/);
  assert.equal(consultants?.extra?.vacancies, 6, "glued 'PPS-116' is split into PPS-11 and 6 vacancies");
  assert.equal(consultants?.extra?.experienceYears, undefined, "no experience line");

  const { items } = normalizeAll(raw, meta("njp", "pakistan", "job"), NOW);
  assert.equal(items.length, 10);
  assert.ok(items.every((item) => item.kind === "job" && item.scope === "pakistan" && item.openToPakistan === true && item.country === "Pakistan"));
  assert.match(items[0].summary ?? "", /Contract · BPS-20 · 1 vacancy/);
});

test("BE&OE notices: de-duplicates the repeated list and classifies regulator actions", () => {
  const raw = parseBeoeNotices(fixture("beoe-news.html"));
  assert.equal(raw.length, 8, "the list appears twice on the page but each notice once in the result");
  const blacklist = raw.find((item) => /Blacklisting/.test(item.title));
  assert.ok(blacklist);
  assert.equal(blacklist.url, "https://beoe.gov.pk/news-updates/7703");
  assert.equal(blacklist.postedAt, "2026-10-02T00:00:00.000Z");
  assert.ok(blacklist.tags?.includes("blacklisting"));
  assert.ok(raw.find((item) => /Show Cause/.test(item.title))?.tags?.includes("show-cause-notice"));
  assert.ok(raw.find((item) => /Referred to FIA/.test(item.title))?.tags?.includes("complaint"));
  assert.equal(raw.find((item) => /Cashless/.test(item.title))?.postedAt, "2026-07-15T00:00:00.000Z", "'Jul 15,2026' without a space still parses");
  assert.equal(raw.find((item) => /Show Cause/.test(item.title))?.title, "Show Cause Notice To M/s. Hussain & Co,OEPL No.0947/RWP");

  const { items } = normalizeAll(raw, meta("beoe-notices", "pakistan", "notice"), NOW);
  assert.ok(items.every((item) => item.kind === "notice" && item.country === "Pakistan" && item.levels.length === 0));
});

// ─── Merge / expiry ──────────────────────────────────────────────────────────

function item(overrides: Partial<Opportunity> & { id: string; sourceId: string }): Opportunity {
  const { id, sourceId, ...rest } = overrides;
  return {
    id,
    kind: "scholarship",
    scope: "international",
    title: `Title ${id}`,
    url: `https://${sourceId}.example/${id}`,
    sourceId,
    sourceName: sourceId,
    sourceUrl: `https://${sourceId}.example/`,
    levels: [],
    fields: [],
    tags: [],
    firstSeen: "2026-10-01T00:00:00.000Z",
    lastSeen: "2026-10-10T00:00:00.000Z",
    dedupeKey: `key-${id}`,
    ...rest,
  };
}

test("expiry: closed items linger for a grace period, then go; coupons go after two days", () => {
  assert.equal(isExpired(item({ id: "a", sourceId: "x", deadline: "2026-10-05" }), NOW), false, "closed 6 days ago is still reachable");
  assert.equal(isExpired(item({ id: "b", sourceId: "x", deadline: "2026-09-20" }), NOW), true);
  assert.equal(isExpired(item({ id: "c", sourceId: "x", kind: "coupon", lastSeen: "2026-10-08T00:00:00.000Z" }), NOW), true);
  assert.equal(isExpired(item({ id: "d", sourceId: "x", kind: "coupon", lastSeen: "2026-10-10T20:00:00.000Z" }), NOW), false);
  assert.equal(isExpired(item({ id: "e", sourceId: "x", kind: "notice", postedAt: "2026-05-01T00:00:00.000Z" }), NOW), true, "notices live 120 days");
  assert.ok(expiryOf(item({ id: "f", sourceId: "x", deadline: "2026-10-20" })) > NOW.getTime());
});

test("merge: keeps firstSeen, keeps a failed source's items, drops what a healthy source stopped listing", () => {
  const previous = [
    item({ id: "keep", sourceId: "good", firstSeen: "2026-09-01T00:00:00.000Z", deadline: "2026-12-01" }),
    item({ id: "gone-coupon", sourceId: "coupons", kind: "coupon", lastSeen: "2026-10-11T00:00:00.000Z" }),
    item({ id: "gone-scholarship", sourceId: "good", deadline: "2026-12-31" }),
    item({ id: "from-broken", sourceId: "broken", deadline: "2026-12-31" }),
  ];
  const fresh = [item({ id: "keep", sourceId: "good", title: "Updated title", firstSeen: "2026-10-11T00:00:00.000Z", deadline: "2026-12-01" })];
  const merged = mergeSnapshot({
    previous,
    fresh,
    now: NOW,
    succeeded: new Set(["good", "coupons"]),
    retainHours: new Map([["coupons", 0]]),
  });
  const ids = merged.map((entry) => entry.id).sort();
  assert.deepEqual(ids, ["from-broken", "gone-scholarship", "keep"]);
  const kept = merged.find((entry) => entry.id === "keep");
  assert.equal(kept?.title, "Updated title");
  assert.equal(kept?.firstSeen, "2026-09-01T00:00:00.000Z", "a returning item is not 'new' again");
  assert.equal(kept?.lastSeen, NOW.toISOString());
});

// ─── Whole pipeline, offline ─────────────────────────────────────────────────

test("pipeline: every registered source runs against fixtures; failures are reported, not fatal", async () => {
  const requested: string[] = [];
  const snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes(), requested), now: NOW, force: true, concurrency: 4 });

  const status = Object.fromEntries(snapshot.sources.map((report) => [report.sourceId, report.status]));
  assert.equal(snapshot.sources.length, SOURCES.length);
  for (const id of ["njp", "beoe-notices", "scholarshiptab", "scholars4dev", "opportunitydesk", "remotive", "jobicy", "arbeitnow", "devpost", "codeforces", "realdiscount", "spsc", "bpsc", "etea", "himalayas", "remoteok", "workingnomads", "weworkremotely", "ctftime", "ntslogin", "schoolsti", "mauqapakistan"]) {
    assert.equal(status[id], "ok", `${id} should parse its fixture`);
  }
  // These have no fixture route → the fake network 404s on both REST and RSS: reported as errors, never fatal.
  for (const id of ["fundsforngos", "opportunitiescorners", "scholarshiproar", "opportunitiesforyouth"]) assert.equal(status[id], "error", id);
  assert.match(snapshot.sources.find((r) => r.sourceId === "fundsforngos")?.error ?? "", /404/);

  const kinds = new Set(snapshot.items.map((entry) => entry.kind));
  for (const kind of ["scholarship", "job", "competition", "coupon", "notice", "grant", "fellowship"]) assert.ok(kinds.has(kind as Opportunity["kind"]), `has ${kind}`);
  assert.equal(new Set(snapshot.items.map((entry) => entry.id)).size, snapshot.items.length, "ids are unique");
  assert.ok(snapshot.items.every((entry) => entry.firstSeen === NOW.toISOString()));
  assert.ok(requested.filter((url) => url.includes("scholarshiptab.com")).every((url) => !/\/search|[?&]q=/.test(url)), "never requests ScholarshipTab search pages");

  // sorted newest-first
  const times = snapshot.items.map((entry) => Date.parse(entry.postedAt ?? entry.firstSeen));
  assert.deepEqual([...times].sort((a, b) => b - a), times);
});

test("pipeline: a source that suddenly returns nothing keeps its previous items; minimum intervals are honoured", async () => {
  const first = await runScrapers({ http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true, only: ["njp", "remotive"] });
  const njpBefore = first.items.filter((entry) => entry.sourceId === "njp").length;
  assert.equal(njpBefore, 10);

  // 3 hours later NJP serves an unrecognisable page (layout change) and Remotive is inside its 6 h minimum interval.
  const later = new Date(NOW.getTime() + 3 * 3_600_000);
  const routes = { ...allSourceRoutes(), "https://njp.gov.pk/jobs/live": "<html><body><h1>Maintenance</h1></body></html>", "https://njp.gov.pk/": "<html></html>" };
  const second = await runScrapers({ http: createFixtureHttp(routes), now: later, previous: first, only: ["njp", "remotive"] });

  const njp = second.sources.find((r) => r.sourceId === "njp");
  assert.equal(njp?.status, "empty");
  assert.match(njp?.note ?? "", /layout or API may have changed/);
  assert.equal(second.items.filter((entry) => entry.sourceId === "njp").length, njpBefore, "previous NJP items survive");
  const remotive = second.sources.find((r) => r.sourceId === "remotive");
  assert.equal(remotive?.status, "skipped");
  assert.match(remotive?.note ?? "", /minimum interval is 360 min/);
  assert.equal(remotive?.lastSuccessAt, NOW.toISOString());
  assert.equal(second.items.filter((entry) => entry.sourceId === "remotive").length, 3, "items of a skipped source are kept");
});

test("pipeline: robots.txt refusals and missing credentials are reported as skipped/error, never crash the run", async () => {
  const snapshot = await runScrapers({
    now: NOW,
    sources: [
      { ...SOURCES.find((s) => s.id === "remotive")!, id: "needs-key", requiresEnv: ["SOME_KEY_THAT_IS_NOT_SET"] },
      { ...SOURCES.find((s) => s.id === "remotive")!, id: "blocked" },
    ],
    http: {
      getText: async (url) => {
        throw new RobotsDisallowedError(url);
      },
      getJson: async (url) => {
        throw new RobotsDisallowedError(url);
      },
    },
    env: {},
  });
  assert.equal(snapshot.sources.find((r) => r.sourceId === "needs-key")?.status, "skipped");
  const blocked = snapshot.sources.find((r) => r.sourceId === "blocked");
  assert.equal(blocked?.status, "error");
  assert.match(blocked?.error ?? "", /Blocked by robots\.txt/);
  assert.equal(snapshot.items.length, 0);
});

test("pipeline: the same scholarship from two sources collapses and credits both", async () => {
  const snapshot = await runScrapers({
    now: NOW,
    force: true,
    sources: fixtureSources().filter((s) => ["scholarshiptab", "scholars4dev"].includes(s.id)),
    http: createFixtureHttp({
      "https://www.scholarshiptab.com/": `<ul><li><h2><a href="/scholarships/ens-international-selection-scholarships-2027">ENS International Selection Scholarships 2027</a></h2><p>Master’s degree in Paris, France.</p><span>Deadline: December 15, 2026</span><span>Posted: October 6, 2026</span></li></ul>`,
      "https://www.scholars4dev.com/wp-json/wp/v2/posts": fixture("wp-scholars4dev.json"),
      "https://www.scholars4dev.com/wp-json/wp/v2/categories": fixture("wp-categories.json"),
    }),
  });
  const ens = snapshot.items.filter((entry) => /ENS International/.test(entry.title));
  assert.equal(ens.length, 1);
  assert.equal(ens[0].alsoOn?.length, 1);
  assert.deepEqual(new Set([ens[0].sourceName, ens[0].alsoOn?.[0].sourceName]), new Set(["ScholarshipTab", "Scholars4Dev"]));
});

test("beoe adapter surfaces an error when no page could be fetched", async () => {
  const http = createFixtureHttp({});
  await assert.rejects(
    beoeNoticesAdapter({ source: SOURCES.find((s) => s.id === "beoe-notices")!, http, now: NOW, log: () => undefined }),
    /404/,
  );
});

// ─── Snapshot file format ────────────────────────────────────────────────────

test("snapshot: serialises one item per line, round-trips, and drops malformed items", async () => {
  const snapshot = await runScrapers({ http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true, only: ["njp", "devpost"] });
  const text = serializeSnapshot(snapshot);
  assert.equal(text.split("\n").filter((line) => line.startsWith("    {")).length, snapshot.items.length + snapshot.sources.length);
  const parsed = parseSnapshot(JSON.parse(text));
  assert.equal(parsed.dropped, 0);
  assert.equal(parsed.snapshot.items.length, snapshot.items.length);
  assert.equal(parsed.snapshot.generatedAt, NOW.toISOString());

  const damaged = JSON.parse(text) as { items: unknown[] };
  damaged.items.push({ id: "x", title: "no url" }, "garbage");
  const recovered = parseSnapshot(damaged);
  assert.equal(recovered.dropped, 2);
  assert.equal(recovered.snapshot.items.length, snapshot.items.length);
  assert.equal(parseSnapshot(null).snapshot.items.length, 0);
});
