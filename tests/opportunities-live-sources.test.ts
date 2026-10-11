import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { extractDeadline, parseLooseDate } from "@/lib/opportunities/dates";
import { normalizeAll, type SourceMeta } from "@/lib/opportunities/normalize";
import { filterFeedItems, parseFeed } from "@/lib/opportunities/scrapers/adapters/feeds";
import { parseBpsc, parseEtea, parseSpsc } from "@/lib/opportunities/scrapers/adapters/pk";
import {
  himalayasAdapter,
  parseCtftime,
  parseHimalayas,
  parseRemoteOk,
  parseWeWorkRemotely,
  parseWorkingNomads,
  remoteOkAdapter,
  weWorkRemotelyAdapter,
  workingNomadsAdapter,
} from "@/lib/opportunities/scrapers/adapters/remote";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { SOURCES } from "@/lib/opportunities/scrapers/sources";
import type { AdapterContext } from "@/lib/opportunities/scrapers/types";
import { allSourceRoutes, createFixtureHttp, fixture, fixtureSources, himalayasWithOpenJobs } from "./helpers/fixture-http";

/**
 * Parsers for the sources added after the first live run from GitHub's servers. Every fixture used here is an
 * excerpt of a response captured from the real site on 2026-10-11 (see tests/fixtures/opportunities/README.md).
 */

const NOW = new Date("2026-10-11T06:00:00Z");
const json = (name: string) => JSON.parse(fixture(name)) as unknown;
const source = (id: string) => {
  const found = SOURCES.find((entry) => entry.id === id);
  assert.ok(found, `source ${id} exists`);
  return found;
};
const context = (id: string, routes = allSourceRoutes()): AdapterContext => ({ source: source(id), http: createFixtureHttp(routes), now: NOW, log: () => undefined });
const meta = (id: string): SourceMeta => ({ id, name: id, homepage: `https://${id}.example/`, defaultKind: "job", scope: "international" });

// ─── Dates ───────────────────────────────────────────────────────────────────

test("dates: two-digit years, dd-mm-yyyy and year-less deadlines (as written on real Pakistani sites) are understood", () => {
  assert.equal(parseLooseDate("Closing dt: 23.10.26"), "2026-10-23");
  assert.equal(parseLooseDate("Closing dt: 23.10.2026."), "2026-10-23");
  assert.equal(parseLooseDate("Press release (23-09-2026)"), "2026-09-23");
  assert.equal(parseLooseDate("Apply by 1 October"), undefined, "without a reference date nothing is guessed");

  const at = (text: string, reference: string) => extractDeadline(text, { reference }).date;
  assert.equal(at("Capital Development Authority Jobs 2026 – Apply by 1 October", "2026-09-11"), "2026-10-01");
  assert.equal(at("Application Deadline: October 16th", "2026-10-09"), "2026-10-16");
  assert.equal(at("Deadline: 5 January", "2026-12-20"), "2027-01-05", "a date that has already passed this year means next year");
  assert.equal(at("Apply by 1 October 2027", "2026-09-11"), "2027-10-01", "an explicit year always wins");
  assert.equal(at("Deadline: 12:30", "2026-09-11"), undefined, "a clock time is not a date");
});

test("normalizer: a year-less deadline in a title takes the year the item was posted in", () => {
  const { items } = normalizeAll(
    [{ title: "Capital Development Authority Jobs 2026 – Apply by 1 October", url: "https://example.pk/cda", kind: "job", postedAt: "2026-09-11T13:44:41+05:00" }],
    { ...meta("example"), scope: "pakistan" },
    NOW,
  );
  assert.equal(items[0].deadline, "2026-10-01");
});

// ─── Himalayas ───────────────────────────────────────────────────────────────

test("Himalayas: reads the real API shape, including location restrictions, expiry and time zones", () => {
  const [brazil, usa] = parseHimalayas(json("himalayas.sample.json"));
  assert.equal(brazil.title, "Analista de Demand Generation (Home Office)");
  assert.equal(brazil.organization, "Somos BHS 💚");
  assert.equal(brazil.url, "https://himalayas.app/companies/somos-bhs/jobs/analista-de-demand-generation-home-office");
  assert.equal(brazil.openToPakistan, false, "restricted to Brazil");
  assert.match(brazil.eligibilityNote ?? "", /only to applicants in: Brazil/);
  assert.match(brazil.eligibilityNote ?? "", /UTC−5 to UTC−2/);
  assert.equal(brazil.postedAt, "2026-10-11T00:48:41.000Z");
  assert.equal(brazil.deadline, "2026-12-10");
  assert.equal(usa.openToPakistan, false);

  const sample = json("himalayas.sample.json") as { jobs: Array<{ locationRestrictions: string[] }> };
  sample.jobs[0].locationRestrictions = [];
  sample.jobs[1].locationRestrictions = ["Pakistan", "India"];
  const [worldwide, includesPakistan] = parseHimalayas(sample);
  assert.equal(worldwide.openToPakistan, true);
  assert.equal(worldwide.location, "Worldwide");
  assert.equal(includesPakistan.openToPakistan, true);
  assert.match(includesPakistan.eligibilityNote ?? "", /Open to applicants in Pakistan/);
});

test("Himalayas adapter: follows the cursor, keeps only jobs Pakistan-based people can apply for", async () => {
  const requested: string[] = [];
  const routes = allSourceRoutes();
  const items = await himalayasAdapter({ ...context("himalayas", routes), http: createFixtureHttp(routes, requested) });
  assert.equal(items.length, 2, "the Brazil-only job is dropped, the worldwide and the Pakistan-eligible ones stay");
  assert.ok(items.every((item) => item.openToPakistan === true));
  assert.ok(requested[0].includes("limit=20"));
  assert.ok(requested.some((url) => url.includes("cursor=")), "pages with the cursor the API returned");

  const onlyRestricted = await himalayasAdapter({ ...context("himalayas"), http: createFixtureHttp({ "https://himalayas.app/jobs/api": fixture("himalayas.sample.json") }) });
  assert.equal(onlyRestricted.length, 0);
  assert.ok(himalayasWithOpenJobs().includes("Pakistan"));
});

// ─── Remote OK, Working Nomads, We Work Remotely ─────────────────────────────

test("Remote OK: the legal notice is not a job; jobs keep their own listing link", async () => {
  const items = parseRemoteOk(json("remoteok.sample.json"));
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.url.toLowerCase().startsWith("https://remoteok.com/remote-jobs/")), "the API serves links as remoteOK.com — the listing URL is kept as given");
  assert.ok(items.every((item) => item.kind === "job" && item.remote === true && item.funding === "paid"));
  assert.equal(items[0].title, "Manager Clinical Data Management");
  assert.equal(items[0].organization, "EDETEK");
  assert.equal(items[0].postedAt, "2026-10-10T08:00:08.000Z");
  assert.ok((items[0].tags ?? []).includes("medical"));
  assert.equal((await remoteOkAdapter(context("remoteok"))).length, 2);
});

test("Working Nomads: a time-zone preference is not mistaken for a country restriction", () => {
  const items = parseWorkingNomads(json("workingnomads.sample.json"));
  assert.equal(items.length, 4);
  const proxify = items[0];
  assert.equal(proxify.organization, "Proxify");
  assert.match(proxify.url, /^https:\/\/www\.workingnomads\.com\/job\/go\/\d+\/$/);
  assert.equal(proxify.openToPakistan, null);
  assert.match(proxify.eligibilityNote ?? "", /Time zone: CET/);
  assert.ok((proxify.tags ?? []).includes("Development"));
  assert.ok((proxify.tags ?? []).includes("nodejs"));
});

test("We Work Remotely: custom feed fields (region, type, expiry) are kept and region drives eligibility", async () => {
  const feed = parseFeed(fixture("weworkremotely.sample.xml"));
  assert.equal(feed[0].fields.region, "Anywhere in the World");
  assert.equal(feed[0].fields.type, "Full-Time");
  assert.ok(feed[0].fields.expires_at);

  const items = parseWeWorkRemotely(feed);
  assert.equal(items[0].organization, "Descript");
  assert.equal(items[0].title, "Brand Design Lead");
  assert.equal(items[0].location, "Anywhere in the World");
  assert.equal(items[0].deadline, "2026-11-10");
  assert.ok((items[0].tags ?? []).includes("Sales and Marketing"));

  const kept = await weWorkRemotelyAdapter(context("weworkremotely"));
  assert.ok(kept.length >= 1 && kept.length <= items.length);
  const { items: normalized } = normalizeAll(kept, meta("weworkremotely"), NOW);
  assert.ok(normalized.every((item) => item.openToPakistan !== false));
  const workingNomads = await workingNomadsAdapter(context("workingnomads"));
  assert.ok(workingNomads.length > 0);
});

// ─── CTFtime ─────────────────────────────────────────────────────────────────

test("CTFtime: entry restrictions decide whether Pakistani teams can join", () => {
  const events = parseCtftime(json("ctftime.sample.json"), NOW);
  assert.equal(events.length, 5);
  const byTitle = (title: string) => events.find((event) => event.title === title)!;

  const open = byTitle("Securinets CTF Quals 2026");
  assert.equal(open.openToPakistan, true);
  assert.equal(open.remote, true);
  assert.equal(open.startsAt, "2026-10-17");
  assert.equal(open.url, "https://ctftime.org/event/3364/");
  assert.equal(open.applyUrl, "https://ctf.securinets.tn/");
  assert.equal(open.organization, "Securinets");

  const academic = byTitle("SOLAR CTF 2026");
  assert.equal(academic.openToPakistan, null);
  assert.match(academic.eligibilityNote ?? "", /students/i);

  const finals = byTitle("SAS CTF 2026 Finals");
  assert.equal(finals.openToPakistan, false, "prequalified teams only");
  assert.equal(finals.remote, false);

  const later = parseCtftime(json("ctftime.sample.json"), new Date("2026-10-19T12:00:00Z"));
  assert.ok(later.length < events.length, "events that have finished are dropped");
});

// ─── Pakistani official sources ──────────────────────────────────────────────

test("SPSC: only advertisements that are still open are listed, with the closing date and the PDF", () => {
  const items = parseSpsc(fixture("spsc.sample.html"), "https://spsc.gos.pk/advertisement.php");
  assert.equal(items.length, 1, "the page keeps years of closed advertisements; they are not opportunities");
  const [ad] = items;
  assert.equal(ad.title, "Sindh Public Service Commission — Advertisement 05/2026");
  assert.equal(ad.url, "https://spsc.gos.pk/advertisement/2026/adv-05-2026.pdf");
  assert.equal(ad.deadline, "2026-10-23");
  assert.equal(ad.scope, "pakistan");
  assert.match(ad.summary ?? "", /Open it for the posts, qualifications, age limits and how to apply/);
});

test("BPSC: advertisements only — corrigenda, press releases and departmental exams are not openings", () => {
  const items = parseBpsc(fixture("bpsc.sample.html"), "https://bpsc.gob.pk/BPSC/pages?jobs", NOW);
  assert.deepEqual(items.map((item) => item.title), [
    "Balochistan Public Service Commission — Advertisement 09/2026",
    "Balochistan Public Service Commission — Advertisement 07/2026",
  ]);
  assert.equal(items[0].url, "https://bpsc.gob.pk/uploads/Jobs/1791632671.pdf");
  assert.equal(items[0].postedAt, new Date(1791632671 * 1000).toISOString(), "the upload time is the Unix timestamp in the file name");
  assert.equal(items[0].applyUrl, "https://bpsc.gob.pk/apply_now");
});

test("ETEA: recruitment cards only — merit lists and results are skipped", () => {
  const items = parseEtea(fixture("etea.sample.html"), "https://www.etea.edu.pk/");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "RESCUE Department Khyber Pakhtunkhwa - 2026 (recruitment through ETEA)");
  assert.equal(items[0].url, "https://etea.online/advertisement/839_rescue_2026.jpg");
  assert.equal(items[0].applyUrl, "https://etea.online/apply/");
  assert.equal(items[0].organization, "RESCUE Department Khyber Pakhtunkhwa");
});

// ─── Aggregator filters ──────────────────────────────────────────────────────

test("feed filters: include, exclude and maxAgeDays keep aggregator noise out", () => {
  const post = (title: string, daysAgo: number, tags: string[] = []) => ({ title, url: `https://x.pk/${title}`, tags, postedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString() });
  const posts = [
    post("NADRA Jobs 2026 Online Apply", 1),
    post("NTS Result 2026 Roll No Slip", 1),
    post("Punjab Police Special Branch Jobs October 2026", 2, ["Government Jobs"]),
    post("PBCC Extends Class-XI Admission Schedule", 1, ["Latest Educational Notifications"]),
    post("Old Jobs 2025", 90),
  ];
  const kept = filterFeedItems(posts, { include: "jobs?\\b|vacanc|recruit", exclude: "result|roll no|slip", maxAgeDays: 30 }, NOW).map((item) => item.title);
  assert.deepEqual(kept, ["NADRA Jobs 2026 Online Apply", "Punjab Police Special Branch Jobs October 2026"]);
  assert.equal(filterFeedItems(posts, undefined, NOW).length, posts.length, "no params → no filtering");
});

test("aggregators: real WordPress and Atom samples flow through the filters into dated, labelled items", async () => {
  const snapshot = await runScrapers({ sources: fixtureSources().filter((entry) => ["ntslogin", "schoolsti", "mauqapakistan"].includes(entry.id)), http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  const byTitle = (re: RegExp) => snapshot.items.find((item) => re.test(item.title));

  assert.ok(byTitle(/Punjab Tourism Department Jobs 2026/), "ntslogin job post kept");
  assert.equal(snapshot.items.filter((item) => item.sourceId === "schoolsti").length, 1, "schoolsti: only the job post of three survives the include filter");
  assert.ok(byTitle(/Punjab Police Special Branch/));

  const cda = byTitle(/Capital Development Authority/);
  assert.equal(cda?.deadline, "2026-10-01", "'Apply by 1 October' → 2026-10-01 from the Blogger Atom feed");
  assert.equal(cda?.scope, "pakistan");
  assert.ok(snapshot.items.every((item) => item.sourceName.length > 0 && item.url.startsWith("http")));
  assert.ok(snapshot.items.filter((item) => item.sourceId !== "mauqapakistan").every((item) => item.openToPakistan === true));
});

// ─── Registry rules ──────────────────────────────────────────────────────────

test("registry: sources that need a Pakistani network are skipped elsewhere, run on request; disabled ones say why", async () => {
  const requested: string[] = [];
  const http = createFixtureHttp(allSourceRoutes(), requested);

  const anywhere = await runScrapers({ http, now: NOW, force: true, env: {} });
  const report = (id: string) => anywhere.sources.find((entry) => entry.sourceId === id);
  assert.equal(report("njp")?.status, "skipped");
  assert.match(report("njp")?.note ?? "", /connection inside Pakistan/);
  assert.equal(report("beoe-notices")?.status, "skipped");
  assert.equal(report("scholarshiptab")?.status, "skipped");
  assert.match(report("scholarshiptab")?.note ?? "", /403/);
  assert.ok(requested.every((url) => !/njp\.gov\.pk|beoe\.gov\.pk|scholarshiptab\.com/.test(url)), "never even tries the unreachable or disabled sites");
  assert.equal(report("spsc")?.status, "ok");

  const inPakistan = await runScrapers({ http, now: NOW, force: true, region: "pk", env: {} });
  assert.equal(inPakistan.sources.find((entry) => entry.sourceId === "njp")?.status, "ok");
  const viaEnv = await runScrapers({ http, now: NOW, force: true, env: { RAAHI_REGION: "pk" }, only: ["beoe-notices"] });
  assert.equal(viaEnv.sources.find((entry) => entry.sourceId === "beoe-notices")?.status, "ok");
  const named = await runScrapers({ http, now: NOW, force: true, env: {}, only: ["njp"] });
  assert.equal(named.sources.find((entry) => entry.sourceId === "njp")?.status, "ok", "naming a source explicitly overrides the region gate");
});

test("registry: robots.txt is skipped only for documented public APIs; every source credits and explains itself", () => {
  const documented = new Set(["remotive", "jobicy", "arbeitnow", "codeforces", "himalayas", "remoteok", "weworkremotely", "ctftime"]);
  for (const entry of SOURCES) {
    assert.equal(entry.respectRobots === false, documented.has(entry.id), `${entry.id}: respectRobots`);
    assert.ok(entry.attribution.length > 10, `${entry.id}: attribution`);
    assert.ok((entry.terms ?? "").length > 10, `${entry.id}: terms`);
    if (!entry.enabled) assert.ok(entry.disabledReason, `${entry.id}: says why it is off`);
  }
  const pk = SOURCES.filter((entry) => entry.network === "pk").map((entry) => entry.id);
  assert.deepEqual(pk.sort(), ["beoe-notices", "njp"]);
  assert.ok(source("himalayas").minIntervalMinutes >= 1440, "Himalayas refreshes daily — never poll it faster");
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === ".next" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("terms guard: no JobPosting structured data — Himalayas forbids resubmitting its listings to Google Jobs", () => {
  const offenders = ["app", "components", "lib"]
    .flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
    .filter((file) => /["']@type["']\s*:\s*["']JobPosting["']|schema\.org\/JobPosting/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
});
